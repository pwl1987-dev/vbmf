//! 共享媒体事件/健康类型与全局健康表 (C7: 从 `pipeline.rs` / `adapters/gstreamer/controller.rs` 抽出的中性模块)。
//!
//! 这些类型只依赖 `std` 与 `crate::pipeline` 的领域类型, **不**依赖 vendor `gstreamer` crate,
//! 因此在 default / simulation / mock 等无 gstreamer 构建下也必须编译. 消费方
//! (main.rs / contracts/backend.rs / adapters/mock.rs) 直接 `use crate::pipeline_events::*`,
//! `pipeline.rs` 仅引用自身用到的 `PipelineBusEvent`, 不再经 `crate::pipeline` 重导出共享项.

use crate::pipeline::{PipelineHandle, PipelineHealth};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::LazyLock;
use std::sync::Mutex;

/// 运行时健康共享状态 (GStreamer 回调/bus 监控/监控线程共享).
pub(crate) static HEALTH_ARCS: LazyLock<
    Mutex<HashMap<PipelineHandle, Arc<Mutex<PipelineHealth>>>>,
> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// 克隆单条健康弧后立即释放全局 registry 锁。媒体回调/Watchdog 不得在
/// 持有 `HEALTH_ARCS` HashMap mutex 时再等待 per-pipeline mutex，否则纯观测面
/// 可能把锁竞争反压到 GStreamer streaming thread。
#[allow(dead_code)]
pub(crate) fn health_arc(handle: &PipelineHandle) -> Option<Arc<Mutex<PipelineHealth>>> {
    HEALTH_ARCS.lock().unwrap().get(handle).cloned()
}

/// 读取管线健康快照 (监控 API 用). 在部分 feature 组合下无调用点 (main 的 health endpoint
/// 经 cfg 门控), 故允许 dead_code; 与迁移前 `controller.rs` 模块级 `#![allow(dead_code)]` 一致.
#[allow(dead_code)]
pub fn read_health(handle: &PipelineHandle) -> Option<PipelineHealth> {
    health_arc(handle).map(|h| h.lock().unwrap().clone())
}

/// GStreamer Bus 事件严重度 (喂 Supervisor 决策时判优先级).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BusSeverity {
    /// 致命: pipeline error / 解码失败 → Supervisor 必响应.
    Error,
    /// 告警: Warning / ClockLost 等可恢复异常.
    Warning,
    /// 信息: StateChanged / Eos / AsyncDone 等正常生命周期事件.
    Info,
}

/// GStreamer Bus 事件类型 (P1-4: 覆盖 Error/EOS/StateChanged/Warning/ClockLost, 真实接线到 Supervisor).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PipelineBusEventKind {
    Error,
    Eos,
    StateChanged,
    Warning,
    /// ClockLost 等 AV 同步相关 (PIPELINE-AV 后续消费; 当前仅记录).
    ClockLost,
}

/// Bus 事件 → Supervisor 恢复策略 (P1-4 最低策略映射, 用户复核 §十二):
/// - `Error` / `Eos`     : 致命 → 触发 Supervisor `report_failure` (重启/升级).
/// - `ClockLost`         : 降级 (degraded), **不**自动重启 (完整 Clock Recovery 属 V0.3/P2); 仅计数 + 健康降级.
/// - `Warning`           : 告警, 记录 + 日志, 不重启.
/// - `StateChanged`      : 信息, 仅生命周期日志.
// 在部分 feature 组合下无调用点 (main 的 bus 监控经 cfg 门控), 允许 dead_code.
#[allow(dead_code)]
pub fn bus_event_recovery_policy(kind: PipelineBusEventKind) -> &'static str {
    match kind {
        PipelineBusEventKind::Error | PipelineBusEventKind::Eos => "restart",
        PipelineBusEventKind::ClockLost => "degraded",
        PipelineBusEventKind::Warning => "warn",
        PipelineBusEventKind::StateChanged => "info",
    }
}

// ── RF-SRC-RTMP-02 TG-4 (plan D9/D7/D8): finite network exit attribution ──────

/// The only observable products of captured listener stderr (plan D9): the
/// frozen four categories. Vendor text never crosses this vocabulary.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkExitClass {
    BindFailure,
    PublisherDisconnected,
    SpawnFailure,
    UnknownExit,
}

impl std::fmt::Display for NetworkExitClass {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::BindFailure => "BindFailure",
            Self::PublisherDisconnected => "PublisherDisconnected",
            Self::SpawnFailure => "SpawnFailure",
            Self::UnknownExit => "UnknownExit",
        };
        f.write_str(name)
    }
}

/// Frozen event-detail format the FFmpeg adapter emits on a network-listener
/// child exit (raw stderr is never in the detail — category name only).
pub const NETWORK_EXIT_DETAIL_PREFIX: &str = "network listener exit classified: ";

/// Parse the finite classification back out of a canonical event detail.
/// Single producer (ffmpeg adapter) + single parser share the frozen prefix;
/// anything unparseable is `None` and the recovery side must treat it as
/// `UnknownExit` (plan INV-1: never an exploratory restart).
pub fn network_exit_class_from_detail(detail: &str) -> Option<NetworkExitClass> {
    let class = detail.strip_prefix(NETWORK_EXIT_DETAIL_PREFIX)?;
    match class {
        "BindFailure" => Some(NetworkExitClass::BindFailure),
        "PublisherDisconnected" => Some(NetworkExitClass::PublisherDisconnected),
        "SpawnFailure" => Some(NetworkExitClass::SpawnFailure),
        "UnknownExit" => Some(NetworkExitClass::UnknownExit),
        _ => None,
    }
}

// ── STAB-O4 E4-1: ingest allocation-face anatomy (diagnostic-only exposure) ──
// 冻结设计: evidence/bmd-10.30.15.10/c2o3-analysis/c2o4-e4-ingest-anatomy-design.txt。
// 观测面 = decklinkvideosrc/audiosrc src pad 的 BUFFER pad probe + bus watch
// 消息计数 (gstreamer crate 可达面)。本结构只描述形态, 永不构成因果证据
// (c2rules ③)。观测代码自身服从 FIX 原则 A: 全部固定容量计数, 溢出另计,
// probe 侧零逐帧堆分配。

/// 单平面 anatomy 直方图容量 (size 指纹 / meta API 各 8; 超出计 overflow)。
pub const INGEST_ANATOMY_SIZES_CAP: usize = 8;
pub const INGEST_ANATOMY_META_CAP: usize = 8;

/// 每平面 ingest anatomy (probe 逐 buffer 更新; min/max 以 buffers==1 初始化)。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct IngestAnatomyPlane {
    pub buffers: u64,
    pub bytes_total: u64,
    pub size_min_bytes: u64,
    pub size_max_bytes: u64,
    /// (size_bytes, count) 固定容量 [`INGEST_ANATOMY_SIZES_CAP`]。
    pub sizes: Vec<(u64, u64)>,
    pub sizes_overflow: u64,
    /// (meta api 数字 id, api 名, count) 固定容量 [`INGEST_ANATOMY_META_CAP`]。
    /// id 优先匹配 (probe 侧零分配); 名字仅首次入库物化。
    pub meta_counts: Vec<(u64, String, u64)>,
    pub meta_overflow: u64,
    pub no_pts: u64,
    pub pts_last_ns: Option<u64>,
    /// 前向 delta (pts < last 记 saturating 0, 另计 pts_backward)。
    pub pts_delta_min_ns: Option<u64>,
    pub pts_delta_max_ns: Option<u64>,
    pub pts_backward: u64,
}

impl IngestAnatomyPlane {
    pub fn observe_buffer(&mut self, size_bytes: u64, pts_ns: Option<u64>) {
        self.buffers += 1;
        self.bytes_total += size_bytes;
        if self.buffers == 1 {
            self.size_min_bytes = size_bytes;
            self.size_max_bytes = size_bytes;
        } else {
            self.size_min_bytes = self.size_min_bytes.min(size_bytes);
            self.size_max_bytes = self.size_max_bytes.max(size_bytes);
        }
        if let Some((_, c)) = self.sizes.iter_mut().find(|(s, _)| *s == size_bytes) {
            *c += 1;
        } else if self.sizes.len() < INGEST_ANATOMY_SIZES_CAP {
            self.sizes.push((size_bytes, 1));
        } else {
            self.sizes_overflow += 1;
        }
        match pts_ns {
            None => self.no_pts += 1,
            Some(pts) => {
                if let Some(last) = self.pts_last_ns {
                    if pts < last {
                        self.pts_backward += 1;
                    }
                    let delta = pts.saturating_sub(last);
                    self.pts_delta_min_ns = Some(match self.pts_delta_min_ns {
                        Some(m) => m.min(delta),
                        None => delta,
                    });
                    self.pts_delta_max_ns = Some(match self.pts_delta_max_ns {
                        Some(m) => m.max(delta),
                        None => delta,
                    });
                }
                self.pts_last_ns = Some(pts);
            }
        }
    }

    pub fn observe_meta(&mut self, api_id: u64, api_name: &str) {
        if let Some((_, _, c)) = self.meta_counts.iter_mut().find(|(id, _, _)| *id == api_id) {
            *c += 1;
        } else if self.meta_counts.len() < INGEST_ANATOMY_META_CAP {
            self.meta_counts.push((api_id, api_name.to_string(), 1));
        } else {
            self.meta_overflow += 1;
        }
    }
}

/// 每管线 anatomy: video/audio 两平面 + bus 消息流计数。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct IngestAnatomy {
    pub video: IngestAnatomyPlane,
    pub audio: IngestAnatomyPlane,
    pub bus_msgs_total: u64,
}

/// E4-1 全局观测表 (probe 写入 / 诊断采样读取; 与 HEALTH_ARCS 同层中性全局;
/// register 于 build、remove 于 stop——生命周期与实例表同律)。
pub(crate) static INGEST_ANATOMY: LazyLock<Mutex<HashMap<PipelineHandle, IngestAnatomy>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 诊断采样快照 (bin 侧 diagnostic-only 采样线程调用; 生产面不调用)。
pub fn ingest_anatomy_snapshot() -> Vec<(PipelineHandle, IngestAnatomy)> {
    INGEST_ANATOMY
        .lock()
        .unwrap()
        .iter()
        .map(|(h, a)| (*h, a.clone()))
        .collect()
}

/// probe/bus 写入门 (controller gstreamer 层调用; 非 gstreamer 构建无调用点,
/// 与 read_health 同律允许 dead_code)。
#[allow(dead_code)]
pub(crate) fn ingest_anatomy_register(handle: PipelineHandle) {
    INGEST_ANATOMY
        .lock()
        .unwrap()
        .insert(handle, IngestAnatomy::default());
}

#[allow(dead_code)]
pub(crate) fn ingest_anatomy_remove(handle: &PipelineHandle) {
    INGEST_ANATOMY.lock().unwrap().remove(handle);
}

#[allow(dead_code)]
pub(crate) fn with_ingest_anatomy<R>(
    handle: &PipelineHandle,
    f: impl FnOnce(&mut IngestAnatomy) -> R,
) -> Option<R> {
    INGEST_ANATOMY.lock().unwrap().get_mut(handle).map(f)
}

/// GStreamer Bus 事件 (监控线程消费, 喂 Supervisor 决策).
///
/// P1-4 改造 (用户复核 §七): 之前只有 `Error(String)` 等薄枚举, 多 pipeline 后无法诊断
/// "哪一路出的错". 现结构化携带 `handle`(哪条管线) / `source`(哪个 element 发出) /
/// `timestamp`(观测墙钟 ms) / `detail`(错误串/状态转移) / `severity`. 事件经专门 GLib
/// MainContext 线程的 Bus watch 投递进 bounded mpsc channel, `poll_bus` 非阻塞 drain.
/// C2: MediaBackend SPI 实现（复用既有 `PipelineController` + 固有 `poll_bus`）。
/// 物理迁移到中性模块 `pipeline_events` (C7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PipelineBusEvent {
    pub handle: PipelineHandle,
    pub kind: PipelineBusEventKind,
    pub source: String,
    pub timestamp: i64,
    pub detail: String,
    pub severity: BusSeverity,
}

// —— STAB-O4 E4-1 单元测试 (中性层; 无 gstreamer 构建可跑 = CI 全矩阵) ——
#[cfg(test)]
mod e4_anatomy_unit_tests {
    use super::*;

    #[test]
    fn e4_plane_size_histogram_bounded_with_overflow() {
        let mut p = IngestAnatomyPlane::default();
        for i in 0..12u64 {
            p.observe_buffer(100 + i, Some(i * 40_000_000));
        }
        assert_eq!(p.buffers, 12);
        assert_eq!(p.sizes.len(), INGEST_ANATOMY_SIZES_CAP);
        assert_eq!(p.sizes_overflow, 12 - INGEST_ANATOMY_SIZES_CAP as u64);
        assert_eq!(p.size_min_bytes, 100);
        assert_eq!(p.size_max_bytes, 111);
        assert_eq!(p.bytes_total, 12 * 100 + (0..12).sum::<u64>());
        // pts delta: 等距 40ms 单调 ⇒ min==max, 无 backward。
        assert_eq!(p.pts_delta_min_ns, Some(40_000_000));
        assert_eq!(p.pts_delta_max_ns, Some(40_000_000));
        assert_eq!(p.pts_backward, 0);
        assert_eq!(p.no_pts, 0);
    }

    #[test]
    fn e4_plane_pts_backward_and_no_pts() {
        let mut p = IngestAnatomyPlane::default();
        p.observe_buffer(10, Some(1_000));
        p.observe_buffer(10, Some(1_040)); // delta 40
        p.observe_buffer(10, Some(1_010)); // backward ⇒ delta saturating 0
        p.observe_buffer(10, None); // no pts
        assert_eq!(p.pts_delta_min_ns, Some(0));
        assert_eq!(p.pts_delta_max_ns, Some(40));
        assert_eq!(p.pts_backward, 1);
        assert_eq!(p.no_pts, 1);
        assert_eq!(p.pts_last_ns, Some(1_010), "基准随最新观测推进");
    }

    #[test]
    fn e4_plane_meta_id_first_dedup_and_capacity() {
        let mut p = IngestAnatomyPlane::default();
        p.observe_meta(7, "GstVideoMeta");
        p.observe_meta(7, "ignored-name-after-first"); // id 命中 ⇒ 名字不再物化
        assert_eq!(p.meta_counts.len(), 1);
        assert_eq!(p.meta_counts[0], (7, "GstVideoMeta".to_string(), 2));
        for id in 100..(100 + INGEST_ANATOMY_META_CAP as u64 + 4) {
            p.observe_meta(id, "api");
        }
        assert_eq!(p.meta_counts.len(), INGEST_ANATOMY_META_CAP);
        // 原 id=7 占 1 席 + 新 id 共 cap; 溢出 = 新 id 数 - 空席。
        let distinct_new = (100..(100 + INGEST_ANATOMY_META_CAP as u64 + 4)).count() as u64;
        assert_eq!(
            p.meta_overflow,
            distinct_new - (INGEST_ANATOMY_META_CAP as u64 - 1)
        );
    }

    #[test]
    fn e4_registry_register_write_snapshot_remove() {
        let h = PipelineHandle(424_242);
        ingest_anatomy_register(h);
        with_ingest_anatomy(&h, |a| a.video.observe_buffer(5, Some(1))).unwrap();
        with_ingest_anatomy(&h, |a| a.bus_msgs_total += 1);
        let snap = ingest_anatomy_snapshot();
        let entry = snap.iter().find(|(k, _)| k == &h).expect("条目在场");
        assert_eq!(entry.1.video.buffers, 1);
        assert_eq!(entry.1.bus_msgs_total, 1);
        // recover 重置语义 = build_pipeline 对同 handle 重新 register (覆盖
        // 旧条目 ⇒ 零计数)——确定性证明在此; 控制器测试只证重注册发生。
        ingest_anatomy_register(h);
        let reset = ingest_anatomy_snapshot();
        let entry = reset.iter().find(|(k, _)| k == &h).expect("覆盖后条目在场");
        assert_eq!(entry.1.video.buffers, 0, "register 覆盖 ⇒ 计数重置");
        assert_eq!(entry.1.bus_msgs_total, 0);
        ingest_anatomy_remove(&h);
        assert!(ingest_anatomy_snapshot().iter().all(|(k, _)| k != &h));
    }

    // ── RF-SRC-RTMP-02 TG-4 (plan D9/INV-1): finite detail parsing ─────────────

    #[test]
    fn rf_src_rtmp_02_tg4_exit_class_detail_roundtrip_and_fail_closed() {
        use super::NetworkExitClass;
        for class in [
            NetworkExitClass::BindFailure,
            NetworkExitClass::PublisherDisconnected,
            NetworkExitClass::SpawnFailure,
            NetworkExitClass::UnknownExit,
        ] {
            let detail = format!("{NETWORK_EXIT_DETAIL_PREFIX}{class}");
            assert_eq!(network_exit_class_from_detail(&detail), Some(class));
        }
        // fail-closed: anything not exactly the frozen vocabulary is None —
        // the recovery side must treat that as UnknownExit (INV-1).
        for junk in [
            "",
            "network listener exit classified: ", // truncated
            "network listener exit classified: PublisherDisconnect",
            "pipeline error: vendor noise",
            "network listener exit classified: UnknownExit ",
        ] {
            assert_eq!(network_exit_class_from_detail(junk), None, "{junk:?}");
        }
    }
}
