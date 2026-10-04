#![allow(dead_code)]

//! GStreamer 媒体后端实现 (C7: 从 `pipeline.rs` 编排层迁入, 业务层不再直接 `use gstreamer`)。
//! 仅 `gstreamer`/`gstreamer_app`/`glib` 三个门面 crate 须在 `gstreamer-backend` 下才可用, 其余
//! (`std` 与 `crate::pipeline` 共享类型) 常驻; 非 gstreamer 构建下整块为 unused, 故 `allow(dead_code)`。
//! 共享事件/健康类型 (HEALTH_ARCS/BusSeverity/PipelineBusEvent 等) 已迁至中性模块 `pipeline_events`,
//! 不在此文件定义, 故 `unused_imports` 由 `adapters/gstreamer/mod.rs` 的 `#[allow(unused_imports)]`
//! 在门面层统一收敛, 此处不再重复声明以避免 duplicated attribute。

#[cfg(feature = "gstreamer-backend")]
use crate::contracts::backend::MediaBackend;
use crate::pipeline::{
    src_props, PipelineController, PipelineError, PipelineHandle, PipelineHealth, PipelinePlan,
    DROPPED_BUS_EVENTS, NEXT_PIPELINE_ID, OBSERVER_QUEUE,
};
#[cfg(feature = "gstreamer-backend")]
use glib;
#[cfg(feature = "gstreamer-backend")]
use gstreamer::prelude::*;
#[cfg(feature = "gstreamer-backend")]
use gstreamer_app::AppSink;
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{sync_channel, Receiver, SyncSender};
use std::sync::Arc;
use std::sync::Mutex;
// C7: 共享事件/健康类型已物理迁至中性模块 `pipeline_events` (不依赖 gstreamer crate),
// 此处仅 `use` 业务实现实际用到的子集 (HEALTH_ARCS/BusSeverity/PipelineBusEvent/PipelineBusEventKind);
// read_health/bus_event_recovery_policy 仅被 main/supervisor 经 `crate::pipeline` 重导出消费, 本实现不引用.
use crate::pipeline_events::{BusSeverity, PipelineBusEvent, PipelineBusEventKind, HEALTH_ARCS};
/// GStreamer 实现 (feature `gstreamer`).
pub struct GStreamerPipelineController {
    /// Backend-owned RuntimeBinding view. Canonical PipelinePlan 不携带任何
    /// GStreamer runtime address；instantiate 时按 canonical device_id 解析。
    runtime_bindings: Arc<HashMap<uuid::Uuid, crate::resolver::ResolvedDeviceBinding>>,
    /// 运行时 pipeline 实例 (GStreamer Bin 对 + 物化计划), 供 start/recover 操作 (P0-2 修复核心:
    /// 旧 `launch()` 内部 Bin 未留存, start/recover 无对象可操作). 非 gstreamer 构建无此字段.
    #[cfg(feature = "gstreamer-backend")]
    instances: Mutex<HashMap<PipelineHandle, GstInstance>>,
    /// A2-8-02-G/H: Bridge 观测统计——分流分支 pad probe 实测（帧计数/
    /// 最后 PTS/三态单调, 按 (handle, channel, plane)）。runtime
    /// observation fact, 与 GstInstance.media_taps 静态簿记严格分层
    /// （第十四轮 §5）; detach 摘分支即移除条目（absence≠evidence）。
    #[cfg(feature = "gstreamer-backend")]
    bridge_stats: BridgeStatsMap,
    /// A2-8-02-G/H-1: 桥**观察时钟**原点（liveness 判定的 wall clock——
    /// 观察时序, 与媒体时序 PTS 严格分离, 第十五轮 §8）。
    #[cfg(feature = "gstreamer-backend")]
    bridge_clock_origin: std::time::Instant,
}

/// A2-8-02-G/H: 桥观测统计表类型别名（(handle, channel, plane) → 单平面
/// 统计; probe 写入 / port 查询读取）。
#[cfg(feature = "gstreamer-backend")]
type BridgeStatsMap =
    std::sync::Arc<Mutex<HashMap<(PipelineHandle, String, &'static str), BridgeStat>>>;

/// A2-8-02-G/H: 单平面桥统计（probe 侧维护——三态与 PipelineHealth
/// observe_*_pts 同语义: Unknown 起步/回退 sticky NonMonotonic）。
#[cfg(feature = "gstreamer-backend")]
#[derive(Debug, Clone, Copy)]
pub(crate) struct BridgeStat {
    pub last_pts: Option<u64>,
    pub state: crate::pipeline::PtsMonotonicity,
    pub frames: u64,
    /// A2-8-02-G/H-1: 最后实测时刻（观察时钟 ms——liveness 证据;
    /// 与历史证据 frames 分层, 第十五轮 §7）。
    pub last_observed_ms: Option<u64>,
}

#[cfg(feature = "gstreamer-backend")]
impl Default for BridgeStat {
    fn default() -> Self {
        // 无证据起步 = Unknown（absence≠evidence——与三态语义一致）。
        Self {
            last_pts: None,
            state: crate::pipeline::PtsMonotonicity::Unknown,
            frames: 0,
            last_observed_ms: None,
        }
    }
}

/// 三态推进（与 PipelineHealth::observe_video_pts 同律）+ 观察时刻。
#[cfg(feature = "gstreamer-backend")]
fn bridge_observe_pts(stat: &mut BridgeStat, pts: u64, observed_at_ms: u64) {
    stat.frames += 1;
    stat.last_observed_ms = Some(observed_at_ms);
    match (stat.last_pts, stat.state) {
        (Some(last), crate::pipeline::PtsMonotonicity::NonMonotonic)
        | (Some(last), crate::pipeline::PtsMonotonicity::ValidMonotonic) => {
            if pts < last {
                stat.state = crate::pipeline::PtsMonotonicity::NonMonotonic; // sticky
            } else {
                stat.state = crate::pipeline::PtsMonotonicity::ValidMonotonic;
            }
        }
        _ => stat.state = crate::pipeline::PtsMonotonicity::ValidMonotonic,
    }
    stat.last_pts = Some(pts);
}

/// 运行时 pipeline 实例 (仅 gstreamer 构建存在).
///
/// P1-4: 由 **单个** `GstPipeline`(内含 video+audio 两路 branch) 取代原先分离的两个 `Bin`
/// (PIPELINE-AV-01 前置: 统一 Bus + 单一 Clock domain). Bus watch 运行在专用 GLib
/// MainContext 线程 (`thread` + `stop_flag`), 经 bounded mpsc (`bus_rx`) 把事件交给 `poll_bus`.
#[cfg(feature = "gstreamer-backend")]
struct GstInstance {
    pipeline: gstreamer::Pipeline,
    plan: PipelinePlan,
    bus_rx: Receiver<PipelineBusEvent>,
    stop_flag: Arc<std::sync::atomic::AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
    /// A2-8-02-D: MediaTap attachment bookkeeping——recover 重建后重放
    /// attach 的**唯一事实源**（第六轮终裁: execution resource bookkeeping,
    /// 非第二 identity/execution registry; tap branch 生命周期由
    /// MediaTapPort 控制, 本字段只做簿记）。
    media_taps: Vec<crate::contracts::media_tap::MediaTapAttachment>,
    /// RH-BUS-02: **本实例独占**的致命事件 overflow fallback 单槽（Error/EOS
    /// 在 channel Full 时才落入; 成功 send 零 fallback——无重复投递）。
    /// 取代进程级 `LAST_FATAL_BUS_EVENT` 全局单槽（多输入下 A 溢出会覆盖
    /// B 的 sticky 证据）。生命周期随实例: stop/recover 销毁重建即自然
    /// 重置。`poll_bus` 在 drain channel 后原子 `take` 本槽。
    fatal_fallback: Arc<Mutex<Option<PipelineBusEvent>>>,
}

#[cfg(feature = "gstreamer-backend")]
impl GstInstance {
    /// 通知 Bus watch 线程退出并释放 DeckLink 设备 (recover / drop 前置).
    fn stop(&mut self) {
        self.stop_flag
            .store(true, std::sync::atomic::Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
        let _ = self.pipeline.set_state(gstreamer::State::Null);
    }
}

/// RH-BUS-02: Bus watch 投递策略（**per-instance** fatal overflow fallback）。
///
/// - 成功 `try_send` ⇒ 零 fallback（无重复投递——旧全局槽在 send 成功时也
///   写 sticky, 读侧会拿到双份语义）;
/// - channel `Full` ⇒ 全局 `DROPPED_BUS_EVENTS` 计数 +1（溢出 metric 保留）,
///   且**仅致命（Error/EOS）**事件落入调用方持有的本实例 fallback 单槽
///   （非致命溢出如实丢弃——计数即可, 不伪造致命语义）;
/// - `Disconnected` ⇒ 记录不 fallback（实例已销毁, 无人再读）。
///
/// 纯投递策略（std mpsc; 无 gstreamer 依赖）——`rh_bus_02_*` 单元测试直测。
pub(crate) fn deliver_bus_event(
    evt: PipelineBusEvent,
    tx: &SyncSender<PipelineBusEvent>,
    fatal_fallback: &Mutex<Option<PipelineBusEvent>>,
) {
    let h = evt.handle;
    match tx.try_send(evt) {
        Ok(()) => {}
        Err(std::sync::mpsc::TrySendError::Full(evt)) => {
            DROPPED_BUS_EVENTS.fetch_add(1, Ordering::SeqCst);
            let fatal = matches!(
                evt.kind,
                PipelineBusEventKind::Error | PipelineBusEventKind::Eos
            );
            if fatal {
                *fatal_fallback.lock().unwrap() = Some(evt);
            }
            tracing::warn!(
                handle = %h.0,
                fatal,
                "Bus channel 溢出: 事件计数为丢弃 (致命事件已存本实例 fallback, 不静默丢失)"
            );
        }
        Err(std::sync::mpsc::TrySendError::Disconnected(_)) => {
            tracing::warn!(handle = %h.0, "Bus channel 已断开 (controller dropped)");
        }
    }
}

impl GStreamerPipelineController {
    /// SelfTest / structure-only controller: no hardware RuntimeBinding.
    pub fn new() -> Self {
        Self::with_runtime_bindings(Arc::new(HashMap::new()))
    }

    /// Production / hardware-gate constructor: inject the authoritative Resolver result.
    pub fn with_runtime_bindings(
        runtime_bindings: Arc<HashMap<uuid::Uuid, crate::resolver::ResolvedDeviceBinding>>,
    ) -> Self {
        Self {
            runtime_bindings,
            #[cfg(feature = "gstreamer-backend")]
            instances: Mutex::new(HashMap::new()),
            #[cfg(feature = "gstreamer-backend")]
            bridge_stats: std::sync::Arc::new(Mutex::new(HashMap::new())),
            #[cfg(feature = "gstreamer-backend")]
            bridge_clock_origin: std::time::Instant::now(),
        }
    }
}

impl Default for GStreamerPipelineController {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelineController for GStreamerPipelineController {
    fn prepare(&self, plan: &PipelinePlan) -> Result<PipelineHandle, PipelineError> {
        #[cfg(feature = "gstreamer-backend")]
        {
            let handle = PipelineHandle(NEXT_PIPELINE_ID.fetch_add(1, Ordering::SeqCst));
            // 每个 pipeline 实例独占一条 bounded mpsc channel: Bus watch 投递, poll_bus 非阻塞 drain.
            let (bus_tx, bus_rx) = sync_channel::<PipelineBusEvent>(256);
            let (pipeline, thread, stop_flag, fatal_fallback) =
                self.build_pipeline(plan, handle, bus_tx)?;
            // 注册健康 (默认全 false — P1-2; 由真实事件逐项置 true).
            HEALTH_ARCS
                .lock()
                .unwrap()
                .insert(handle, Arc::new(Mutex::new(PipelineHealth::default())));
            if let Some(hp) = crate::pipeline_events::health_arc(&handle) {
                hp.lock().unwrap().started_at = Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0),
                );
            }
            self.instances.lock().unwrap().insert(
                handle,
                GstInstance {
                    pipeline,
                    plan: plan.clone(),
                    bus_rx,
                    stop_flag,
                    thread: Some(thread),
                    media_taps: Vec::new(),
                    fatal_fallback,
                },
            );
            Ok(handle)
        }
        #[cfg(not(feature = "gstreamer-backend"))]
        {
            let _ = plan;
            Ok(PipelineHandle(1))
        }
    }

    fn start(&self, handle: &PipelineHandle) -> Result<(), PipelineError> {
        #[cfg(feature = "gstreamer-backend")]
        {
            // 统一 GstPipeline: 单一 set_state(Playing) 同时启动 video+audio 两路 (P1-4).
            let res = {
                let guard = self.instances.lock().unwrap();
                let inst = guard.get(handle).ok_or_else(|| {
                    PipelineError::StartFailed(format!("未知 pipeline handle (start): {handle:?}"))
                })?;
                inst.pipeline.set_state(gstreamer::State::Playing)
            };
            res.map_err(|e| PipelineError::StartFailed(format!("pipeline play: {e}")))?;
            // 标记 playing (watchdog 推导 a3_pipeline_playing). 与 instances 锁不嵌套, 避免死锁.
            if let Some(hp) = crate::pipeline_events::health_arc(handle) {
                hp.lock().unwrap().playing = true;
            }
            Ok(())
        }
        #[cfg(not(feature = "gstreamer-backend"))]
        {
            let _ = handle;
            Ok(())
        }
    }

    fn recover(&self, handle: &PipelineHandle) -> Result<(), PipelineError> {
        #[cfg(feature = "gstreamer-backend")]
        {
            let plan = {
                let guard = self.instances.lock().unwrap();
                guard.get(handle).map(|i| i.plan.clone()).ok_or_else(|| {
                    PipelineError::StartFailed(format!(
                        "未知 pipeline handle (recover): {handle:?}"
                    ))
                })?
            };
            // 停止并丢弃旧实例: 通知 GLib 线程退出 + join + 释放 DeckLink 设备.
            // A2-8-02-D: 旧实例销毁前捕获 tap 簿记（重建后重放——唯一事实源）。
            let saved_taps: Vec<crate::contracts::media_tap::MediaTapAttachment> = {
                let guard = self.instances.lock().unwrap();
                guard
                    .get(handle)
                    .map(|i| i.media_taps.clone())
                    .unwrap_or_default()
            };
            if let Some(mut old) = self.instances.lock().unwrap().remove(handle) {
                old.stop();
            }
            // STAB-O4 E4-1: 旧实例 anatomy 移除 (build_pipeline 随后重注册新实例)。
            crate::pipeline_events::ingest_anatomy_remove(handle);
            // 重建统一 GstPipeline (新 bus channel).
            let (bus_tx, bus_rx) = sync_channel::<PipelineBusEvent>(256);
            let (pipeline, thread, stop_flag, fatal_fallback) =
                self.build_pipeline(&plan, *handle, bus_tx)?;
            pipeline
                .set_state(gstreamer::State::Playing)
                .map_err(|e| PipelineError::StartFailed(format!("pipeline play: {e}")))?;
            self.instances.lock().unwrap().insert(
                *handle,
                GstInstance {
                    pipeline,
                    plan,
                    bus_rx,
                    stop_flag,
                    thread: Some(thread),
                    media_taps: Vec::new(),
                    // RH-BUS-02: 旧实例槽随实例销毁, 新实例新槽——fatal
                    // fallback 生命周期自然重置。
                    fatal_fallback,
                },
            );
            if let Some(hp) = crate::pipeline_events::health_arc(handle) {
                hp.lock().unwrap().playing = true;
            }
            // A2-8-02-D: attachment replay——新管线上按簿记重放 tap（失败
            // 不阻断 recover 本体: 管线已恢复, tap 恢复失败诚实记录降级）。
            {
                let mut guard = self.instances.lock().unwrap();
                if let Some(inst) = guard.get_mut(handle) {
                    for tap in saved_taps {
                        let req = crate::contracts::media_tap::MediaTapRequest {
                            channel: tap.channel.clone(),
                            planes: tap.planes,
                        };
                        match Self::attach_tap_to_instance(
                            *handle,
                            inst,
                            &req,
                            &self.bridge_stats,
                            self.bridge_clock_origin,
                        ) {
                            Ok(()) => tracing::info!(
                                handle = handle.0,
                                channel = %tap.channel,
                                "A2-8-02-D recover: tap 簿记重放成功 (新管线)"
                            ),
                            Err(e) => tracing::warn!(
                                handle = handle.0,
                                channel = %tap.channel,
                                error = ?e,
                                "A2-8-02-D recover: tap 重放失败 (管线本体已恢复, tap 降级待重挂)"
                            ),
                        }
                    }
                }
            }
            Ok(())
        }
        #[cfg(not(feature = "gstreamer-backend"))]
        {
            let _ = handle;
            Ok(())
        }
    }
}

#[cfg(feature = "gstreamer-backend")]
// P0-2: MediaBackend 方法形状对齐冻结契约 (instantiate/start/stop/recover/observe);
// 实现委托旧 `PipelineController` trait 方法 (prepare/recover 语义不变) 与固有 poll_bus。
impl MediaBackend for GStreamerPipelineController {
    fn instantiate(&self, plan: &PipelinePlan) -> Result<PipelineHandle, PipelineError> {
        <Self as PipelineController>::prepare(self, plan)
    }
    fn start(&self, handle: &PipelineHandle) -> Result<(), PipelineError> {
        <Self as PipelineController>::start(self, handle)
    }
    /// P0-2 补齐契约 `stop`: 通知 Bus watch 退出 + `set_state(Null)` 释放 DeckLink +
    /// 从实例表/健康表移除 (防句柄与健康条目泄漏)。
    fn stop(&self, handle: &PipelineHandle) -> Result<(), PipelineError> {
        let inst = {
            let mut guard = self.instances.lock().unwrap();
            guard.remove(handle)
        };
        if let Some(mut inst) = inst {
            inst.stop();
        } else {
            return Err(PipelineError::StartFailed(format!(
                "未知 pipeline handle (stop): {handle:?}"
            )));
        }
        crate::pipeline_events::HEALTH_ARCS
            .lock()
            .unwrap()
            .remove(handle);
        // STAB-O4 E4-1: 终态注销同律清理 anatomy 条目 (防观测表泄漏)。
        crate::pipeline_events::ingest_anatomy_remove(handle);
        Ok(())
    }
    fn recover(&self, handle: &PipelineHandle) -> Result<(), PipelineError> {
        <Self as PipelineController>::recover(self, handle)
    }
    fn observe(&self, handle: &PipelineHandle) -> Vec<PipelineBusEvent> {
        GStreamerPipelineController::poll_bus(self, handle)
    }
}

// A2-8-02-I 第三十四轮终裁: Diagnostic Runtime Fault Injection——同一
// concrete controller 的第四 trait view（仅诊断消费, 禁入 MediaBackend
// 冻结 SPI）。注入"运行故障"非"生命周期终止": 真实执行面停流
// （set_state(Paused)——源/分支停止产出 buffer, frames/PTS 冻结,
// liveness 窗口自然过期）而 instances/HEALTH_ARCS 登记**保持**; 随后
// `MediaBackend::recover(handle)` 即为生产行为（同 handle 原 plan 重建）。
// 红线: 不注销 handle（那是 stop 的 P0-2 终态语义）; 不合成 Bus Error
// 事件（Observation Fact ≠ Synthetic Event——只作用于实际执行面）。
#[cfg(feature = "gstreamer-backend")]
impl crate::contracts::diagnostic::DiagnosticFaultInjection for GStreamerPipelineController {
    fn inject_runtime_stall(&self, handle: &PipelineHandle) -> Result<(), String> {
        let guard = self.instances.lock().unwrap();
        let inst = guard
            .get(handle)
            .ok_or_else(|| format!("未知 pipeline handle (inject stall): {handle:?}"))?;
        inst.pipeline
            .set_state(gstreamer::State::Paused)
            .map(|_| ())
            .map_err(|e| format!("diagnostic stall set_state(Paused) 失败: {e}"))
    }
}

impl GStreamerPipelineController {
    /// 构造 decklinkvideosrc/audiosrc → video/x-raw → appsink 的采集 pipeline (P0-2 修复核心).
    /// 仅构建 + 注册 appsink 回调, **不**立即 Playing; Playing 由 `PipelineController::start` 负责
    /// (统一生命周期: prepare 构建 → start 播放 → recover 重建+播放). 旧 `launch()` 已被此拆分取代,
    /// 不再作为绕过 `PipelineController` 的第二入口.
    ///
    /// 注: appsink 当前用作 MEDIA-RT-01 首帧/PTS acceptance 探针; 最终生产媒体出口
    /// (Normalize → FRAME/MASTER SWITCH → Encode → SRS) 待 A2+ 实现 (用户复核 §十三).
    /// 构造 **单个** `GstPipeline`(video+audio 两路 branch 同处一个 pipeline) — P1-4 前置
    /// (PIPELINE-AV-01: 统一 Bus + 单一 Clock domain). 挂载 appsink 回调(首帧/PTS 探针),
    /// 并在专用 GLib MainContext 线程上挂 Bus watch, 把 Error/EOS/StateChanged/Warning/ClockLost
    /// 经 bounded mpsc 投递; `poll_bus` 非阻塞 drain.
    ///
    /// 旧 `build_bins` 把 video/audio 拆成两个独立 `Bin`(各自无统一 Bus/Clock), 导致 `poll_bus`
    /// 只能 stub. 现统一为单 `GstPipeline`, Bus watch 才能真实生效.
    /// GLib main loop 必须运行 (用户复核 §五): watch 回调在 `MainLoop` 迭代的 MainContext 上分发,
    /// 故 spawn 专用线程持有 `MainContext`+`MainLoop` 并 `run()`.
    #[cfg(feature = "gstreamer-backend")]
    #[allow(clippy::type_complexity)]
    fn build_pipeline(
        &self,
        plan: &PipelinePlan,
        handle: PipelineHandle,
        bus_tx: SyncSender<PipelineBusEvent>,
    ) -> Result<
        (
            gstreamer::Pipeline,
            std::thread::JoinHandle<()>,
            Arc<std::sync::atomic::AtomicBool>,
            // RH-BUS-02: 本实例 fatal overflow fallback 槽（随 GstInstance 存亡）。
            Arc<Mutex<Option<PipelineBusEvent>>>,
        ),
        PipelineError,
    > {
        gstreamer::init().map_err(|e| PipelineError::StartFailed(format!("gst init: {e}")))?;
        let (video_src, audio_src) = src_props(plan, &self.runtime_bindings)?;
        // P1a: 有输出段 ⇒ plan.output_launch 全串（tee 双分支: 分析 + 编码输出）;
        // 无输出段 ⇒ 今日串逐字节不变（纯分析, 向后兼容承诺）。controller 纯拼接执行,
        // 不在此出现任何编码/输出 element 名（用户边界修正: 输出物化在 pipeline.rs domain 层）。
        let launch = {
            let with_outputs = plan.output_launch(&video_src, &audio_src);
            if with_outputs.is_empty() {
                // A2-8-02-A: 纯分析形态同样构造**命名 tee = 通用 tap 点**
                // （MediaTapPort attach 的物化前提; tee 单消费分支行为等价
                // =透传, appsink 名/async 语义不变; **假实现禁令**: 构造期
                // 只建 tap 点, 不预塞 tap branch——branch 生命周期归
                // MediaTapPort）。pipeline.rs 零 diff（本组装在 controller 侧）。
                let video_branch = format!(
                    "{video_src} ! video/x-raw ! tee name=v \
                     v. ! {OBSERVER_QUEUE} ! appsink name=videosink async=false"
                );
                let audio_branch = format!(
                    "{audio_src} ! audio/x-raw ! tee name=a \
                     a. ! {OBSERVER_QUEUE} ! appsink name=audiosink async=false"
                );
                format!("{video_branch} {audio_branch}")
            } else {
                with_outputs
            }
        };
        let pipeline = gstreamer::parse::launch(&launch)
            .map_err(|e| PipelineError::StartFailed(format!("pipeline parse: {e}")))?
            .dynamic_cast::<gstreamer::Pipeline>()
            .map_err(|_| PipelineError::StartFailed("launch 结果非 GstPipeline".into()))?;
        let v_appsink = pipeline
            .by_name("videosink")
            .and_then(|e| e.dynamic_cast::<AppSink>().ok())
            .ok_or_else(|| PipelineError::StartFailed("videosink cast".into()))?;
        let a_appsink = pipeline
            .by_name("audiosink")
            .and_then(|e| e.dynamic_cast::<AppSink>().ok())
            .ok_or_else(|| PipelineError::StartFailed("audiosink cast".into()))?;

        self.attach_video_sink(&v_appsink, handle);
        self.attach_audio_sink(&a_appsink, handle);

        // —— STAB-O4 E4-1: ingest allocation-face anatomy probe ——
        // decklinkvideosrc/audiosrc src pad 逐 buffer 形态计数 (gstreamer
        // crate 可达面; 冻结设计 c2o4-e4-ingest-anatomy-design.txt)。计数恒挂
        // (暴露门在 bin 诊断采样——生产面零暴露); probe 只观察不改动数据流;
        // 固定容量计数, probe 侧零逐帧堆分配。register 于 build (recover 重建
        // 即重置——per-instance 视图, 如实披露), remove 于 stop。
        crate::pipeline_events::ingest_anatomy_register(handle);
        use glib::translate::IntoGlib; // Type→GType 数字 id (meta 去重键; 零分配)
        for el in pipeline.iterate_elements() {
            let Ok(el) = el else { continue };
            let Some(factory) = el.factory() else {
                continue;
            };
            let video_plane = match factory.name().as_str() {
                "decklinkvideosrc" => true,
                "decklinkaudiosrc" => false,
                _ => continue,
            };
            let Some(src_pad) = el.static_pad("src") else {
                continue;
            };
            let h = handle;
            src_pad.add_probe(gstreamer::PadProbeType::BUFFER, move |_pad, info| {
                if let Some(buf) = info.buffer() {
                    let pts = buf.pts().map(|c| c.nseconds());
                    let size = buf.size() as u64;
                    crate::pipeline_events::with_ingest_anatomy(&h, |a| {
                        let p = if video_plane {
                            &mut a.video
                        } else {
                            &mut a.audio
                        };
                        p.observe_buffer(size, pts);
                        buf.foreach_meta(|meta| {
                            let ty = meta.api();
                            p.observe_meta(ty.into_glib() as u64, ty.name());
                            core::ops::ControlFlow::Continue(())
                        });
                    });
                }
                gstreamer::PadProbeReturn::Ok
            });
        }

        // —— Bus watch: 专用 GLib MainContext/MainLoop 线程 (用户复核 §五/§六) ——
        // 注意: Bus watch 回调只在 MainLoop 迭代其 MainContext 时才分发. 因此必须有独立线程
        // 持有 MainContext 并 run MainLoop; 否则编译通过但事件永远不到 (用户 §五 风险点).
        let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop_for_thread = stop_flag.clone();
        // RH-BUS-02: 本实例 fatal fallback 槽——watch 线程写 / poll_bus 读
        //（Arc 共享; 旧实例销毁即随 GstInstance 释放）。
        let fatal_fallback: Arc<Mutex<Option<PipelineBusEvent>>> = Arc::new(Mutex::new(None));
        let fallback_for_thread = std::sync::Arc::clone(&fatal_fallback);
        let p = pipeline.clone();
        let thread = std::thread::spawn(move || {
            // RH-BUS-01: 每实例私有 MainContext——进程级 `MainContext::default()`
            // 同一时刻仅一线程可持有, 双输入下第二个 watch 线程 with_thread_default
            // 失败即静默退出 (BMD E4 实证: handle2 bus_msgs_total=0, 致命事件通道
            // 单管线化)。新建 ctx 由本专用线程独占, 多实例互不竞争。
            //
            // RH-BUS-01 修复迭代 1 (协调者 crate 源 RCA): `Bus::add_watch()` 走
            // `gst_bus_add_watch_full` = default-context watch; `timeout_add_local()`
            // 内部显式取 `MainContext::default()`。两者都不挂本私有 ctx——MainLoop
            // 迭代私有 ctx 而 source 落在 default ctx: 事件与 stop 计时永不分发,
            // stop/join 挂起 (BMD 双 RH 测试实测)。故 Bus watch 与 stop 轮询均改
            // `create_watch`/`timeout_source_new` + 显式 `attach(Some(&ctx))`,
            // source 与迭代 ctx 同处一个上下文; with_thread_default 随之移除
            // (无 default-context 依赖的最简所有权模型)。
            let ctx = glib::MainContext::new();
            let ml = glib::MainLoop::new(Some(&ctx), false);
            let bus = match p.bus() {
                Some(b) => b,
                None => {
                    tracing::warn!(handle = %handle.0, "pipeline 无 bus, Bus watch 未挂载");
                    return;
                }
            };
            let tx = bus_tx.clone();
            let h = handle;
            // watch 回调: 把消息翻译为结构化 PipelineBusEvent 投递进 channel.
            // source 绑定存活至线程闭包结束 (attach 后 ctx 亦持引用, 不泄漏).
            let _bus_source = bus.create_watch(
                Some("rh-bus-watch"),
                glib::Priority::DEFAULT,
                move |_, msg| {
                    // STAB-O4 E4-1: bus 消息流计数 (逐消息; 罕频——锁开销可忽略)。
                    crate::pipeline_events::with_ingest_anatomy(&h, |a| a.bus_msgs_total += 1);
                    if let Some(evt) = GStreamerPipelineController::translate_bus(msg, h) {
                        // RH-BUS-02: 投递策略收敛于 deliver_bus_event——成功 send
                        // 零 fallback; 仅 channel Full 时致命 (Error/EOS) 事件落入
                        // **本实例** fallback 单槽（取代旧全局 LAST_FATAL_BUS_EVENT
                        // ——多输入下全局单槽会互相覆盖 sticky 证据）。
                        deliver_bus_event(evt, &tx, &fallback_for_thread);
                    }
                    glib::ControlFlow::Continue
                },
            );
            // 显式挂到私有 ctx (非 default ctx)——MainLoop 迭代的正是它.
            _bus_source.attach(Some(&ctx));
            // 周期检查 stop_flag, 置位则退出 MainLoop (recover/stop 时通知线程结束, 避免线程泄漏).
            // 同样显式挂私有 ctx (旧 timeout_add_local 挂 default ctx 永不分发 = stop/join 挂起根因).
            let ml_timeout = ml.clone();
            let stop = stop_for_thread.clone();
            let _stop_source = glib::timeout_source_new(
                std::time::Duration::from_millis(200),
                Some("rh-bus-stop-poll"),
                glib::Priority::DEFAULT,
                move || {
                    if stop.load(std::sync::atomic::Ordering::SeqCst) {
                        ml_timeout.quit();
                        glib::ControlFlow::Break
                    } else {
                        glib::ControlFlow::Continue
                    }
                },
            );
            _stop_source.attach(Some(&ctx));
            ml.run();
            tracing::debug!(handle = %h.0, "GStreamer Bus watch 线程退出");
        });
        Ok((pipeline, thread, stop_flag, fatal_fallback))
    }

    /// 将 GStreamer `Message` 翻译为结构化 `PipelineBusEvent` (P1-4).
    /// 仅保留 Supervisor 关心的 Error/EOS/StateChanged/Warning/ClockLost; 其余消息忽略.
    #[cfg(feature = "gstreamer-backend")]
    fn translate_bus(msg: &gstreamer::Message, handle: PipelineHandle) -> Option<PipelineBusEvent> {
        let (kind, severity, detail) = match msg.view() {
            gstreamer::MessageView::Error(e) => (
                PipelineBusEventKind::Error,
                BusSeverity::Error,
                format!("{} | debug={:?}", e.error(), e.debug()),
            ),
            gstreamer::MessageView::Eos(_) => (
                PipelineBusEventKind::Eos,
                BusSeverity::Info,
                "end-of-stream".to_string(),
            ),
            gstreamer::MessageView::Warning(w) => (
                PipelineBusEventKind::Warning,
                BusSeverity::Warning,
                format!("{}", w.error()),
            ),
            gstreamer::MessageView::StateChanged(sc) => (
                PipelineBusEventKind::StateChanged,
                BusSeverity::Info,
                format!("{:?} -> {:?}", sc.old(), sc.current()),
            ),
            gstreamer::MessageView::ClockLost(_) => (
                PipelineBusEventKind::ClockLost,
                BusSeverity::Warning,
                "clock-lost".to_string(),
            ),
            _ => return None,
        };
        let source = msg.src().map(|s| s.name().to_string()).unwrap_or_default();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        Some(PipelineBusEvent {
            handle,
            kind,
            source,
            timestamp,
            detail,
            severity,
        })
    }

    /// 注册视频 appsink 回调: 首帧/PTS 探测 (MEDIA-RT-01 B).
    #[cfg(feature = "gstreamer-backend")]
    fn attach_video_sink(&self, sink: &AppSink, handle: PipelineHandle) {
        sink.set_callbacks(
            gstreamer_app::AppSinkCallbacks::builder()
                .new_sample(move |sink| {
                    let sample = sink.pull_sample().map_err(|_| gstreamer::FlowError::Eos)?;
                    let buf = sample.buffer().ok_or(gstreamer::FlowError::Error)?;
                    if let Some(h) = crate::pipeline_events::health_arc(&handle) {
                        let mut h = h.lock().unwrap();
                        h.video_frame_count += 1;
                        let pts = buf.pts().map(|c| c.nseconds());
                        if let Some(pts) = pts {
                            // 记录首帧 PTS (与单调性状态解耦, P1-3).
                            if h.video_first_pts.is_none() {
                                h.video_first_pts = Some(pts);
                            }
                            // 真正单调性三态机 (用户复核 §十一/§三 P1-3): 首有效 PTS → ValidMonotonic,
                            // 回退 → NonMonotonic (sticky). 无 PTS 帧 (None) 已在上方跳过, 不污染判定.
                            h.observe_video_pts(pts);
                        }
                    }
                    Ok(gstreamer::FlowSuccess::Ok)
                })
                .build(),
        );
    }

    /// 注册音频 appsink 回调: 首帧/PTS 探测 (MEDIA-RT-01 B, 含真实单调判定).
    #[cfg(feature = "gstreamer-backend")]
    fn attach_audio_sink(&self, sink: &AppSink, handle: PipelineHandle) {
        sink.set_callbacks(
            gstreamer_app::AppSinkCallbacks::builder()
                .new_sample(move |sink| {
                    let sample = sink.pull_sample().map_err(|_| gstreamer::FlowError::Eos)?;
                    let buf = sample.buffer().ok_or(gstreamer::FlowError::Error)?;
                    if let Some(h) = crate::pipeline_events::health_arc(&handle) {
                        let mut h = h.lock().unwrap();
                        h.audio_frame_count += 1;
                        let pts = buf.pts().map(|c| c.nseconds());
                        if let Some(pts) = pts {
                            // 记录首帧 PTS (与单调性状态解耦, P1-3).
                            if h.audio_first_pts.is_none() {
                                h.audio_first_pts = Some(pts);
                            }
                            // 音频同样做真实单调性三态判定 (用户复核 §十一/§三 P1-3).
                            h.observe_audio_pts(pts);
                        }
                    }
                    Ok(gstreamer::FlowSuccess::Ok)
                })
                .build(),
        );
    }

    /// 非阻塞 drain 当前 GStreamer Bus 事件 (Bus watch 线程已投递进 bounded mpsc).
    /// watchdog 每 500ms 调用一次, 不阻塞媒体/GStreamer 线程 (用户复核 §六: 解耦节拍).
    /// RH-BUS-02: drain 正常事件后, 在同一实例锁内**原子 take** 本 handle 自己的
    /// fatal overflow fallback（溢出致命事件恰一次补投——take 语义无重复）。
    #[cfg(feature = "gstreamer-backend")]
    pub fn poll_bus(&self, handle: &PipelineHandle) -> Vec<PipelineBusEvent> {
        let guard = self.instances.lock().unwrap();
        match guard.get(handle) {
            Some(inst) => {
                let mut events: Vec<PipelineBusEvent> = inst.bus_rx.try_iter().collect();
                if let Some(fatal) = inst.fatal_fallback.lock().unwrap().take() {
                    events.push(fatal);
                }
                events
            }
            None => Vec::new(),
        }
    }

    /// tap branch 元素名（detach 定位/簿记外独立验证锚）。
    #[cfg(feature = "gstreamer-backend")]
    fn tap_element_name(plane: &str, channel: &str) -> String {
        format!("tap-{plane}-{channel}")
    }

    /// 在实例管线上物化一个 tap branch（tee request pad → inter sink →
    /// sync_state_with_parent），并记入簿记。构造期命名 tee（"v"/"a"）
    /// = 通用 tap 点（两形态皆有, §02-A）; branch 本体在此动态创建
    /// （**非构造期预设**——假实现禁令, probe §11.2）。
    #[cfg(feature = "gstreamer-backend")]
    fn attach_tap_to_instance(
        handle: PipelineHandle,
        inst: &mut GstInstance,
        req: &crate::contracts::media_tap::MediaTapRequest,
        bridge_stats: &BridgeStatsMap,
        clock_origin: std::time::Instant,
    ) -> Result<(), crate::contracts::media_tap::TapError> {
        use crate::contracts::media_tap::{TapError, TapPlanes};
        use gstreamer::prelude::*;
        let wants_video = matches!(req.planes, TapPlanes::Video | TapPlanes::Both);
        let wants_audio = matches!(req.planes, TapPlanes::Audio | TapPlanes::Both);
        // (tee 名, 是否需要, inter sink 工厂, 平面前缀)——video/audio 平面
        // 独立命名空间, 同 channel 两平面互不冲突。
        // **事务式物化（第七轮终裁 P2 债修复）**: 成功项入 staged, 任一平面
        // 失败 → 全部回滚（释放 tee request pad + Null + remove）——保证
        // Gst 真实图与 media_taps 簿记**原子一致**（簿记=recover 唯一事实
        // 源, Reality≠bookkeeping 不可发生）。
        let mut staged: Vec<(gstreamer::Element, gstreamer::Pad, gstreamer::Element)> = Vec::new();
        let materialize = (|| -> Result<(), TapError> {
            for (tee_name, want, factory, plane) in [
                ("v", wants_video, "intervideosink", "v"),
                ("a", wants_audio, "interaudiosink", "a"),
            ] {
                if !want {
                    continue;
                }
                let tee = inst.pipeline.by_name(tee_name).ok_or_else(|| {
                    TapError::TapPointUnavailable(format!(
                        "命名 tee {tee_name} 不在管线（tap 点缺失）"
                    ))
                })?;
                let el = gstreamer::ElementFactory::make(factory)
                    .name(Self::tap_element_name(plane, &req.channel))
                    .build()
                    .map_err(|e| TapError::Backend(format!("{factory} 构造失败: {e}")))?;
                el.set_property("channel", req.channel.as_str());
                inst.pipeline
                    .add(&el)
                    .map_err(|e| TapError::Backend(format!("tap 元素入管线: {e}")))?;
                el.sync_state_with_parent()
                    .map_err(|e| TapError::Backend(format!("tap 元素状态同步: {e}")))?;
                let tee_src = tee
                    .request_pad_simple("src_%u")
                    .ok_or_else(|| TapError::Backend("tee request pad 失败".into()))?;
                let el_sink = el
                    .static_pad("sink")
                    .ok_or_else(|| TapError::Backend("tap 元素 sink pad 缺失".into()))?;
                tee_src
                    .link(&el_sink)
                    .map_err(|e| TapError::Backend(format!("tap 链接: {e:?}")))?;
                // A2-8-02-G/H: 桥观测 probe——分流分支 sink pad 实测缓冲
                //（tap→inter 段真实经过的数据; 非输入/程序观测复制——
                // 三列各自独立测量, 第十四轮 §4）。键含 plane（"v"/"a"）。
                // G/H-1: probe 同时记录观察时刻（liveness 证据——观察时钟
                // 与媒体时序 PTS 分离, 第十五轮 §8）。
                {
                    let key = (handle, req.channel.clone(), plane);
                    let stats_for_probe = std::sync::Arc::clone(bridge_stats);
                    el_sink.add_probe(gstreamer::PadProbeType::BUFFER, move |_pad, info| {
                        if let Some(buf) = info.buffer() {
                            if let Some(pts) = buf.pts().map(|c| c.nseconds()) {
                                let now_ms = clock_origin.elapsed().as_millis() as u64;
                                let mut stats = stats_for_probe.lock().unwrap();
                                let st = stats.entry(key.clone()).or_default();
                                bridge_observe_pts(st, pts, now_ms);
                            }
                        }
                        gstreamer::PadProbeReturn::Ok
                    });
                }
                staged.push((tee, tee_src, el));
            }
            Ok(())
        })();
        match materialize {
            Ok(()) => {
                inst.media_taps
                    .push(crate::contracts::media_tap::MediaTapAttachment {
                        channel: req.channel.clone(),
                        planes: req.planes,
                    });
                Ok(())
            }
            Err(e) => {
                // 回滚（逆序）: 已物化分支全部移除, 簿记零增加。
                for (tee, tee_src, el) in staged.into_iter().rev() {
                    if let Some(sink_pad) = el.static_pad("sink") {
                        let _ = sink_pad.unlink(&tee_src);
                        tee.release_request_pad(&tee_src);
                    }
                    let _ = el.set_state(gstreamer::State::Null);
                    let _ = inst.pipeline.remove(&el);
                }
                tracing::warn!(
                    channel = %req.channel,
                    error = ?e,
                    "A2-8-02-C attach 部分失败已整体回滚（图与簿记原子一致）"
                );
                Err(e)
            }
        }
    }
}

// === A2-8-02-C: MediaTapPort 物化（同 ownership——无第二 registry, probe §11.3） ===
#[cfg(feature = "gstreamer-backend")]
impl crate::contracts::media_tap::MediaTapPort for GStreamerPipelineController {
    fn attach_media_tap(
        &self,
        handle: &PipelineHandle,
        req: &crate::contracts::media_tap::MediaTapRequest,
    ) -> Result<(), crate::contracts::media_tap::TapError> {
        use crate::contracts::media_tap::TapError;
        let mut guard = self.instances.lock().unwrap();
        let inst = guard
            .get_mut(handle)
            .ok_or(TapError::UnknownPipeline(*handle))?;
        if inst.media_taps.iter().any(|a| a.channel == req.channel) {
            return Err(TapError::AlreadyAttached(req.channel.clone()));
        }
        let stats = std::sync::Arc::clone(&self.bridge_stats);
        Self::attach_tap_to_instance(*handle, inst, req, &stats, self.bridge_clock_origin)
    }

    fn detach_media_tap(
        &self,
        handle: &PipelineHandle,
        channel: &str,
    ) -> Result<(), crate::contracts::media_tap::TapError> {
        use crate::contracts::media_tap::{TapError, TapPlanes};
        use gstreamer::prelude::*;
        let mut guard = self.instances.lock().unwrap();
        let inst = guard
            .get_mut(handle)
            .ok_or(TapError::UnknownPipeline(*handle))?;
        let planes = inst
            .media_taps
            .iter()
            .find(|a| a.channel == channel)
            .map(|a| a.planes)
            .ok_or_else(|| TapError::NotAttached(channel.into()))?;
        let wants_video = matches!(planes, TapPlanes::Video | TapPlanes::Both);
        let wants_audio = matches!(planes, TapPlanes::Audio | TapPlanes::Both);
        for (tee_name, want, plane) in [("v", wants_video, "v"), ("a", wants_audio, "a")] {
            if !want {
                continue;
            }
            let name = Self::tap_element_name(plane, channel);
            let Some(el) = inst.pipeline.by_name(&name) else {
                continue;
            };
            // 解链 + 释放 tee request pad + 移除元素（分支生命周期归本端口）。
            if let Some(sink_pad) = el.static_pad("sink") {
                if let Some(peer) = sink_pad.peer() {
                    let _ = sink_pad.unlink(&peer);
                    if let Some(tee) = inst.pipeline.by_name(tee_name) {
                        tee.release_request_pad(&peer);
                    }
                }
            }
            let _ = el.set_state(gstreamer::State::Null);
            let _ = inst.pipeline.remove(&el);
        }
        inst.media_taps.retain(|a| a.channel != channel);
        // A2-8-02-G/H: 分支已摘——桥观测条目随之移除（absence≠evidence,
        // 非冻结零值伪装）。
        self.bridge_stats
            .lock()
            .unwrap()
            .retain(|(h, ch, _), _| !(*h == *handle && ch == channel));
        Ok(())
    }

    fn tap_attachments(
        &self,
        handle: &PipelineHandle,
    ) -> Vec<crate::contracts::media_tap::MediaTapAttachment> {
        self.instances
            .lock()
            .unwrap()
            .get(handle)
            .map(|i| i.media_taps.clone())
            .unwrap_or_default()
    }
}

// === A2-8-02-G/H: Bridge 观测查询面（pad probe 实测, 第十四轮 §4） ===
#[cfg(feature = "gstreamer-backend")]
impl crate::contracts::media_tap::BridgeObservationPort for GStreamerPipelineController {
    fn bridge_observations(
        &self,
        handle: &PipelineHandle,
    ) -> Vec<crate::contracts::media_tap::BridgeObservation> {
        use crate::contracts::media_tap::BridgeObservation;
        // 按簿记 channel 分组——attached 才有观测行（摘除=absence≠evidence）。
        let attachments = {
            self.instances
                .lock()
                .unwrap()
                .get(handle)
                .map(|i| i.media_taps.clone())
                .unwrap_or_default()
        };
        let stats = self.bridge_stats.lock().unwrap();
        attachments
            .into_iter()
            .map(|a| {
                let v = stats
                    .get(&(*handle, a.channel.clone(), "v"))
                    .copied()
                    .unwrap_or_default();
                let s = stats
                    .get(&(*handle, a.channel.clone(), "a"))
                    .copied()
                    .unwrap_or_default();
                BridgeObservation {
                    channel: a.channel,
                    video_last_pts: v.last_pts,
                    video_pts_state: v.state,
                    video_frames: v.frames,
                    audio_last_pts: s.last_pts,
                    audio_pts_state: s.state,
                    audio_frames: s.frames,
                }
            })
            .collect()
    }

    /// A2-8-02-G/H-1: 当前推进性——观察时钟窗口判定（now - last_observed
    /// ≤ window; frames=历史证据, last_observed=活性证据, 严格分层）。
    fn bridge_liveness(
        &self,
        handle: &PipelineHandle,
        window_ms: u64,
    ) -> Vec<crate::contracts::media_tap::BridgeChannelLiveness> {
        use crate::contracts::media_tap::BridgeChannelLiveness;
        let attachments = {
            self.instances
                .lock()
                .unwrap()
                .get(handle)
                .map(|i| i.media_taps.clone())
                .unwrap_or_default()
        };
        let now_ms = self.bridge_clock_origin.elapsed().as_millis() as u64;
        let stats = self.bridge_stats.lock().unwrap();
        attachments
            .into_iter()
            .map(|a| {
                let v = stats
                    .get(&(*handle, a.channel.clone(), "v"))
                    .copied()
                    .unwrap_or_default();
                let s = stats
                    .get(&(*handle, a.channel.clone(), "a"))
                    .copied()
                    .unwrap_or_default();
                // 活性证据取双平面最近实测时刻。
                let last_observed = v.last_observed_ms.max(s.last_observed_ms);
                let alive_in_window = last_observed
                    .map(|t| now_ms.saturating_sub(t) <= window_ms)
                    .unwrap_or(false);
                BridgeChannelLiveness {
                    channel: a.channel,
                    frames: v.frames.max(s.frames),
                    last_observed_at_ms: last_observed,
                    alive_in_window,
                }
            })
            .collect()
    }
}

// —— 真实 GStreamer tap 验证（盒上 bmd+gstreamer; self_test 计划=纯分析形态） ——
#[cfg(all(test, feature = "gstreamer-backend"))]
mod media_tap_tests {
    use super::*;
    use crate::contracts::backend::MediaBackend;
    use crate::contracts::media_tap::{MediaTapPort, MediaTapRequest, TapError, TapPlanes};
    use crate::pipeline::PipelinePlan;

    fn started_analysis_pipeline() -> (GStreamerPipelineController, PipelineHandle) {
        let ctrl = GStreamerPipelineController::new();
        let h =
            MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("纯分析管线物化");
        MediaBackend::start(&ctrl, &h).expect("启动");
        (ctrl, h)
    }

    fn element_present(ctrl: &GStreamerPipelineController, h: &PipelineHandle, name: &str) -> bool {
        ctrl.instances
            .lock()
            .unwrap()
            .get(h)
            .map(|i| i.pipeline.by_name(name).is_some())
            .unwrap_or(false)
    }

    #[test]
    fn tap_rt_01_analysis_form_attach_detach_cycle() {
        // 02-A/C: 纯分析形态（原无 tee）现具通用 tap 点; attach 动态物化
        // 分支（簿记外独立验证元素实存——非"登记式假实现"）。
        let (ctrl, h) = started_analysis_pipeline();
        let req = MediaTapRequest {
            channel: "tap-t1".into(),
            planes: TapPlanes::Both,
        };
        ctrl.attach_media_tap(&h, &req)
            .expect("纯分析形态 attach（tee tap 点在）");
        assert_eq!(
            ctrl.tap_attachments(&h),
            vec![crate::contracts::media_tap::MediaTapAttachment {
                channel: "tap-t1".into(),
                planes: TapPlanes::Both,
            }],
            "簿记恰一行保真"
        );
        assert_eq!(
            ctrl.attach_media_tap(&h, &req),
            Err(TapError::AlreadyAttached("tap-t1".into())),
            "重复 attach fail-closed"
        );
        assert!(element_present(&ctrl, &h, "tap-v-tap-t1"), "video 分支实存");
        assert!(element_present(&ctrl, &h, "tap-a-tap-t1"), "audio 分支实存");

        ctrl.detach_media_tap(&h, "tap-t1").expect("detach");
        assert!(ctrl.tap_attachments(&h).is_empty());
        assert!(!element_present(&ctrl, &h, "tap-v-tap-t1"), "分支已移除");
        assert!(!element_present(&ctrl, &h, "tap-a-tap-t1"));
        assert_eq!(
            ctrl.detach_media_tap(&h, "tap-t1"),
            Err(TapError::NotAttached("tap-t1".into()))
        );
        let _ = ctrl.stop(&h);
    }

    #[test]
    fn tap_rt_01_video_only_planes_and_unknown_pipeline() {
        let (ctrl, h) = started_analysis_pipeline();
        ctrl.attach_media_tap(
            &h,
            &MediaTapRequest {
                channel: "tap-vonly".into(),
                planes: TapPlanes::Video,
            },
        )
        .expect("video-only attach");
        assert!(element_present(&ctrl, &h, "tap-v-tap-vonly"));
        assert!(
            !element_present(&ctrl, &h, "tap-a-tap-vonly"),
            "video-only 不建 audio 分支"
        );
        let _ = ctrl.stop(&h);

        let unknown = PipelineHandle(987_654);
        assert_eq!(
            ctrl.attach_media_tap(
                &unknown,
                &MediaTapRequest {
                    channel: "x".into(),
                    planes: TapPlanes::Both
                }
            ),
            Err(TapError::UnknownPipeline(unknown))
        );
    }

    #[test]
    fn tap_rt_01_recover_replays_attachments() {
        // 02-D: recover 销毁重建管线→簿记重放→tap 在新管线上恢复
        // （元素实存于**新** pipeline 对象——C2 闭环实证）。
        let (ctrl, h) = started_analysis_pipeline();
        ctrl.attach_media_tap(
            &h,
            &MediaTapRequest {
                channel: "tap-rc".into(),
                planes: TapPlanes::Both,
            },
        )
        .expect("attach");
        MediaBackend::recover(&ctrl, &h).expect("recover 重建");
        assert_eq!(ctrl.tap_attachments(&h).len(), 1, "簿记等值恢复");
        assert_eq!(ctrl.tap_attachments(&h)[0].channel, "tap-rc");
        assert!(
            element_present(&ctrl, &h, "tap-v-tap-rc"),
            "新管线上 video tap 分支重挂"
        );
        assert!(element_present(&ctrl, &h, "tap-a-tap-rc"), "audio 分支重挂");
        let _ = ctrl.stop(&h);
    }

    #[test]
    fn tap_rt_01_attach_partial_failure_rolls_back() {
        // 02-C P2 债（第七轮终裁）: Both 时 video 成功 + audio 失败 →
        // video 分支必须整体回滚, 簿记零增加——Gst 图与 media_taps 原子
        // 一致（簿记=recover 唯一事实源, Reality≠bookkeeping 不可发生）。
        // 故障注入: 从运行中管线移除 audio tee（模拟 tap 点缺失）。
        let (ctrl, h) = started_analysis_pipeline();
        {
            let mut guard = ctrl.instances.lock().unwrap();
            let inst = guard.get_mut(&h).unwrap();
            if let Some(a_tee) = inst.pipeline.by_name("a") {
                let _ = inst.pipeline.remove(&a_tee);
            }
        }
        let err = ctrl
            .attach_media_tap(
                &h,
                &MediaTapRequest {
                    channel: "tap-pf".into(),
                    planes: TapPlanes::Both,
                },
            )
            .expect_err("audio tap 点缺失应失败");
        assert!(matches!(err, TapError::TapPointUnavailable(_)));
        assert!(
            ctrl.tap_attachments(&h).is_empty(),
            "簿记零增加（无半条 attachment）"
        );
        assert!(
            !element_present(&ctrl, &h, "tap-v-tap-pf"),
            "已物化的 video 分支被回滚（图与簿记一致）"
        );
        assert!(!element_present(&ctrl, &h, "tap-a-tap-pf"));
        let _ = ctrl.stop(&h);
    }
}

// —— A2-8-02-I 第三十四轮: Diagnostic Runtime Fault Injection 真实验证 ——
#[cfg(all(test, feature = "gstreamer-backend"))]
mod diagnostic_tests {
    use super::*;
    use crate::contracts::backend::MediaBackend;
    use crate::contracts::diagnostic::DiagnosticFaultInjection;
    use crate::pipeline::PipelinePlan;

    fn started() -> (GStreamerPipelineController, PipelineHandle) {
        let ctrl = GStreamerPipelineController::new();
        let h =
            MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("纯分析管线物化");
        MediaBackend::start(&ctrl, &h).expect("启动");
        (ctrl, h)
    }

    fn frames(h: &PipelineHandle) -> Option<u64> {
        crate::pipeline_events::read_health(h).map(|x| x.video_frame_count)
    }

    // 契约证明（结构面）: 注入"运行故障"≠注销——instance 登记保持;
    // 随后 recover=生产行为（同 handle 原 plan 重建）。33 轮 stop→recover
    // 非法组合的反面: 注入后 recover 必须成功。
    #[test]
    fn diagnostic_rt_01_stall_keeps_registration_and_recovers() {
        let (ctrl, h) = started();
        ctrl.inject_runtime_stall(&h)
            .expect("注入成功（handle 在册）");
        assert!(
            ctrl.instances.lock().unwrap().get(&h).is_some(),
            "注入≠注销: instance 登记保持（终态注销是 stop 的 P0-2 语义）"
        );
        MediaBackend::recover(&ctrl, &h).expect("注入后 recover=生产行为（原 plan 重建）");
        assert!(
            ctrl.instances.lock().unwrap().get(&h).is_some(),
            "recover 后同 handle 在册"
        );
        let _ = MediaBackend::stop(&ctrl, &h);
    }

    // 契约证明（行为面）: 注入=真实执行面停流（帧冻结）→ recover 后复流。
    #[test]
    fn diagnostic_rt_02_stall_freezes_media_and_resumes_after_recover() {
        let (ctrl, h) = started();
        std::thread::sleep(std::time::Duration::from_millis(800));
        ctrl.inject_runtime_stall(&h).expect("注入");
        // 深入 Paused 稳态后采样（避开翻转在途帧的单帧噪声）。
        std::thread::sleep(std::time::Duration::from_millis(500));
        let f1 = frames(&h);
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let f2 = frames(&h);
        assert_eq!(f2, f1, "停流: 注入期间帧冻结（观测面仍在——absence≠注销）");
        MediaBackend::recover(&ctrl, &h).expect("recover");
        std::thread::sleep(std::time::Duration::from_millis(800));
        let f3 = frames(&h);
        assert!(
            f1.is_some_and(|a| f3.is_some_and(|b| b > a)),
            "复流: recover 后帧重新推进 (stalled={f1:?} recovered={f3:?})"
        );
        let _ = MediaBackend::stop(&ctrl, &h);
    }

    // 同一注册事实源: stop 终态注销后注入面诚实 fail-closed（与 recover
    // 报 UnknownPipeline 同源——非法组合的错误在入口即暴露）。
    #[test]
    fn diagnostic_rt_03_unknown_handle_fail_closed() {
        let (ctrl, h) = started();
        let _ = MediaBackend::stop(&ctrl, &h);
        assert!(
            ctrl.inject_runtime_stall(&h).is_err(),
            "已注销 handle 拒收（无第二注册表）"
        );
    }
}

// —— STAB-O4 E4-1: ingest anatomy probe 真实验证 (需 gstreamer 构建; 盒上执行) ——
// RH-BUS-01 后 watch 线程各持私有 MainContext, 并行测试无 default-context
// 单持有者竞争 (旧顺序分段约束解除); anatomy pad probe 本身不依赖
// MainLoop (streaming 线程触发)。
#[cfg(all(test, feature = "gstreamer-backend"))]
mod e4_anatomy_tests {
    use super::*;
    use crate::contracts::backend::MediaBackend;
    use crate::pipeline::PipelinePlan;
    use crate::pipeline_events::ingest_anatomy_snapshot;

    fn bus_count(h: &PipelineHandle) -> u64 {
        ingest_anatomy_snapshot()
            .iter()
            .find(|(k, _)| k == h)
            .map(|(_, a)| a.bus_msgs_total)
            .unwrap_or(0)
    }

    #[test]
    fn e4_rt_01_lifecycle_recover_reset_honest_absence() {
        // 段1: selftest (videotestsrc/audiotestsrc) 无 decklink 源 ⇒ 平面计数
        // 诚实为零 (absence≠evidence——观测点只挂 decklink 元素); bus 消息流
        // 计数真实推进 (轮询有界 5s——异步状态消息分发非瞬时)。
        let ctrl = GStreamerPipelineController::new();
        let h = MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("物化");
        MediaBackend::start(&ctrl, &h).expect("启动");
        let mut before = 0u64;
        for _ in 0..50 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            before = bus_count(&h);
            if before > 0 {
                break;
            }
        }
        let snap = ingest_anatomy_snapshot();
        let entry = snap
            .iter()
            .find(|(k, _)| k == &h)
            .expect("anatomy 条目在场");
        assert_eq!(
            entry.1.video.buffers, 0,
            "无 decklink 源 ⇒ video 平面零观测"
        );
        assert_eq!(
            entry.1.audio.buffers, 0,
            "无 decklink 源 ⇒ audio 平面零观测"
        );
        assert!(before > 0, "bus 消息流 (StateChanged 等) 应已计数");
        // 段2: recover = 旧实例销毁 + 新实例重建 ⇒ anatomy 重注册 (新实例已
        // Playing, 其自身启动消息即刻计数——非零是诚实的新实例视图; 重置
        // 语义的确定性证明在中性层 register-覆盖 单元测试)。
        MediaBackend::recover(&ctrl, &h).expect("recover 重建");
        let snap = ingest_anatomy_snapshot();
        assert!(
            snap.iter().any(|(k, _)| k == &h),
            "recover 后条目重注册在场"
        );
        // 段3: stop 终态注销 ⇒ 条目移除 (与 HEALTH_ARCS 同生命周期律)。
        let _ = MediaBackend::stop(&ctrl, &h);
        assert!(
            ingest_anatomy_snapshot().iter().all(|(k, _)| k != &h),
            "stop 终态注销后条目移除"
        );
    }
}

// —— RH-BUS-01: per-pipeline MainContext / Bus-watch isolation 真实验证 ——
// (需 gstreamer 构建) 双并发 self-test pipeline 各自收到真实 Bus 证据 +
// stop/recover 生命周期无死 watch / 无跨 handle 投递。有界轮询 (100ms 步进,
// 5s deadline)——Bus watch 异步分发非瞬时, 不用固定 sleep 判定。
#[cfg(all(test, feature = "gstreamer-backend"))]
mod rh_bus_isolation_tests {
    use super::*;
    use crate::contracts::backend::MediaBackend;
    use crate::contracts::diagnostic::DiagnosticFaultInjection;
    use crate::pipeline::PipelinePlan;
    use crate::pipeline_events::ingest_anatomy_snapshot;
    use std::time::{Duration, Instant};

    const DEADLINE: Duration = Duration::from_secs(5);

    fn bus_msgs(h: &PipelineHandle) -> u64 {
        ingest_anatomy_snapshot()
            .iter()
            .find(|(k, _)| k == h)
            .map(|(_, a)| a.bus_msgs_total)
            .unwrap_or(0)
    }

    /// 有界轮询: bus 消息计数超过 floor 即真; deadline 到仍不满足返回 None。
    fn wait_bus_msgs_above(h: &PipelineHandle, floor: u64) -> Option<u64> {
        let start = Instant::now();
        loop {
            let cur = bus_msgs(h);
            if cur > floor {
                return Some(cur);
            }
            if start.elapsed() >= DEADLINE {
                return None;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }

    fn wait_bus_msgs_positive(h: &PipelineHandle) -> Option<u64> {
        wait_bus_msgs_above(h, 0)
    }

    /// channel 面有界 drain: 非空即返回 (watch 异步投递, 非瞬时)。
    fn drain_events(
        ctrl: &GStreamerPipelineController,
        h: &PipelineHandle,
    ) -> Vec<PipelineBusEvent> {
        let start = Instant::now();
        loop {
            let evts = ctrl.poll_bus(h);
            if !evts.is_empty() {
                return evts;
            }
            if start.elapsed() >= DEADLINE {
                return evts;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }

    // 生产缺陷回归: 双并发 pipeline 的 Bus watch 各持私有 MainContext——
    // 缺陷形态 (default context 单持有者) 下第二 watch 静默缺席, h2 证据恒零。
    #[test]
    fn rh_bus_01_dual_pipelines_both_receive_bus_evidence() {
        let ctrl = GStreamerPipelineController::new();
        let h1 = MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("物化 h1");
        let h2 = MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("物化 h2");
        MediaBackend::start(&ctrl, &h1).expect("启动 h1");
        MediaBackend::start(&ctrl, &h2).expect("启动 h2");
        let e1 = wait_bus_msgs_positive(&h1);
        let e2 = wait_bus_msgs_positive(&h2);
        assert!(e1.is_some(), "h1 bus 消息计数推进 (实测 {e1:?})");
        assert!(
            e2.is_some(),
            "h2 bus 消息计数推进 (实测 {e2:?}) — 缺陷回归: 双输入下第二 watch 不再静默缺席"
        );
        // channel 面: 各自通道事件 handle 归属正确 (无跨 handle 投递)。
        for h in [&h1, &h2] {
            let evts = drain_events(&ctrl, h);
            assert!(!evts.is_empty(), "handle {h:?} channel 面有真实事件");
            assert!(
                evts.iter().all(|e| e.handle == *h),
                "事件 handle 归属 {h:?}: 实得 {:?}",
                evts.iter().map(|e| e.handle).collect::<Vec<_>>()
            );
        }
        let _ = MediaBackend::stop(&ctrl, &h1);
        let _ = MediaBackend::stop(&ctrl, &h2);
    }

    // 生命周期: recover 重建后新 watch 线程真实存活 (新实例计数器重新推进);
    // stop 终态注销后无残留事件面; 全程邻柄互不串扰。
    #[test]
    fn rh_bus_01_recover_restores_watch_stop_leaves_no_residual() {
        let ctrl = GStreamerPipelineController::new();
        let h1 = MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("物化 h1");
        let h2 = MediaBackend::instantiate(&ctrl, &PipelinePlan::self_test()).expect("物化 h2");
        MediaBackend::start(&ctrl, &h1).expect("启动 h1");
        MediaBackend::start(&ctrl, &h2).expect("启动 h2");
        assert!(wait_bus_msgs_positive(&h1).is_some(), "h1 初始 watch 存活");
        let b2 = wait_bus_msgs_positive(&h2).expect("h2 初始 watch 存活");

        // 邻柄在册期间真实停流 (Paused) ⇒ StateChanged 经 h2 自己的 watch 计数
        // ——与 h1 并行运行互不干扰。
        ctrl.inject_runtime_stall(&h2).expect("h2 停流注入");
        assert!(
            wait_bus_msgs_above(&h2, b2).is_some(),
            "h2 watch 在 h1 并行运行下继续交付"
        );

        // recover h1 = 旧实例销毁 + 新 watch 线程 (新私有 MainContext): 计数器
        // 随新实例归零后必须再次推进——死 watch (线程在而 loop 不跑) 无此证据。
        MediaBackend::recover(&ctrl, &h1).expect("recover h1");
        assert!(
            wait_bus_msgs_positive(&h1).is_some(),
            "recover 后新 watch 线程存活并计数"
        );

        // stop h1 终态: 实例注销 + 事件面关闭 + anatomy 条目移除。
        let _ = MediaBackend::stop(&ctrl, &h1);
        assert!(
            ctrl.instances.lock().unwrap().get(&h1).is_none(),
            "stop 后实例注销"
        );
        assert!(ctrl.poll_bus(&h1).is_empty(), "stop 后无残留事件面");
        assert_eq!(bus_msgs(&h1), 0, "stop 后 anatomy 条目移除 (计数面归零)");

        // h2 不受 h1 stop 影响: recover 重建 (回 Playing) 后 watch 继续独立交付。
        MediaBackend::recover(&ctrl, &h2).expect("recover h2");
        assert!(
            wait_bus_msgs_positive(&h2).is_some(),
            "h2 在 h1 stop 后 recover 仍独立交付"
        );
        let _ = MediaBackend::stop(&ctrl, &h2);
    }
}

// —— RH-BUS-02: per-handle fatal overflow fallback 投递策略 ——
// (纯 std mpsc + 单槽; 无 gstreamer 构建可跑 = CI 全矩阵) 全局 metric
// (DROPPED_BUS_EVENTS) 断言取 delta 且测试间串行 (锁), 防并行互扰。
#[cfg(test)]
mod rh_bus_02_deliver_tests {
    use super::*;
    use std::sync::atomic::Ordering;

    /// 并行测试共享全局 DROPPED_BUS_EVENTS——断言 delta 的用例持此锁串行。
    static METRIC_LOCK: Mutex<()> = Mutex::new(());

    fn evt(handle: u64, kind: PipelineBusEventKind) -> PipelineBusEvent {
        PipelineBusEvent {
            handle: PipelineHandle(handle),
            kind,
            source: format!("src-{handle}"),
            timestamp: 0,
            detail: format!("detail-{handle}"),
            severity: BusSeverity::Error,
        }
    }

    #[test]
    fn rh_bus_02_fatal_overflow_fallback_is_per_handle() {
        let _m = METRIC_LOCK.lock().unwrap();
        // 双实例各自独立槽: A 溢出的致命事件只落 A 槽——不覆盖、不串投 B
        // (旧全局 LAST_FATAL_BUS_EVENT 单槽缺陷的确定性反证)。
        let (tx_a, rx_a) = sync_channel::<PipelineBusEvent>(1);
        let (tx_b, rx_b) = sync_channel::<PipelineBusEvent>(1);
        let slot_a: Mutex<Option<PipelineBusEvent>> = Mutex::new(None);
        let slot_b: Mutex<Option<PipelineBusEvent>> = Mutex::new(None);
        // 占满各自 channel 后再投致命事件 → Full → 各自槽。
        deliver_bus_event(evt(1, PipelineBusEventKind::Warning), &tx_a, &slot_a);
        deliver_bus_event(evt(1, PipelineBusEventKind::Error), &tx_a, &slot_a);
        deliver_bus_event(evt(2, PipelineBusEventKind::Warning), &tx_b, &slot_b);
        deliver_bus_event(evt(2, PipelineBusEventKind::Eos), &tx_b, &slot_b);
        let fa = slot_a.lock().unwrap().clone().expect("A fallback 在场");
        let fb = slot_b.lock().unwrap().clone().expect("B fallback 在场");
        assert_eq!(fa.handle, PipelineHandle(1), "A 槽只收 A 的致命事件");
        assert_eq!(fa.kind, PipelineBusEventKind::Error);
        assert_eq!(fb.handle, PipelineHandle(2), "B 槽只收 B 的致命事件");
        assert_eq!(fb.kind, PipelineBusEventKind::Eos);
        // channel 面无跨 handle 投递。
        let drained_a: Vec<_> = rx_a.try_iter().collect();
        assert!(drained_a.iter().all(|e| e.handle == PipelineHandle(1)));
        let drained_b: Vec<_> = rx_b.try_iter().collect();
        assert!(drained_b.iter().all(|e| e.handle == PipelineHandle(2)));
    }

    #[test]
    fn rh_bus_02_successful_send_no_fallback_duplicate() {
        let _m = METRIC_LOCK.lock().unwrap();
        // channel 有余量: 致命事件成功 send ⇒ 零 fallback (无重复投递), 零丢弃。
        let (tx, rx) = sync_channel::<PipelineBusEvent>(4);
        let slot: Mutex<Option<PipelineBusEvent>> = Mutex::new(None);
        let dropped_before = DROPPED_BUS_EVENTS.load(Ordering::SeqCst);
        deliver_bus_event(evt(7, PipelineBusEventKind::Error), &tx, &slot);
        assert!(slot.lock().unwrap().is_none(), "成功 send 不得写 fallback");
        assert_eq!(
            DROPPED_BUS_EVENTS.load(Ordering::SeqCst),
            dropped_before,
            "成功投递不计数丢弃"
        );
        let drained: Vec<_> = rx.try_iter().collect();
        assert_eq!(drained.len(), 1, "恰一次投递");
        assert_eq!(drained[0].handle, PipelineHandle(7));
    }

    #[test]
    fn rh_bus_02_nonfatal_overflow_is_not_fatal_fallback() {
        let _m = METRIC_LOCK.lock().unwrap();
        // 非致命 (Warning) 溢出: 全局计数如实 +1, 但不伪造致命 fallback。
        let (tx, _rx) = sync_channel::<PipelineBusEvent>(1);
        let slot: Mutex<Option<PipelineBusEvent>> = Mutex::new(None);
        deliver_bus_event(evt(9, PipelineBusEventKind::Warning), &tx, &slot);
        let dropped_before = DROPPED_BUS_EVENTS.load(Ordering::SeqCst);
        deliver_bus_event(evt(9, PipelineBusEventKind::Warning), &tx, &slot);
        assert!(slot.lock().unwrap().is_none(), "非致命溢出不落 fallback");
        assert_eq!(
            DROPPED_BUS_EVENTS.load(Ordering::SeqCst),
            dropped_before + 1,
            "溢出 metric 保留 (全局计数)"
        );
    }
}
