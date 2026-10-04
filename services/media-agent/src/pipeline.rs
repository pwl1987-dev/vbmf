//! Canonical media ingest pipeline (Phase 0.6): GStreamer `decklinkvideosrc/audiosrc` → RAW.
//!
//! Boundary (SoT §14 / Phase 0.6 锁死):
//! - **canonical 媒体采集 = GStreamer**, 不是 `IDeckLinkInput` SDK 直采 (后者仅 SDK 诊断探针).
//! - 链路: `DeckLink → GStreamer → RAW → Normalize → FRAME/MASTER SWITCH → Program Master RAW
//!   → Encode → SRS → RTMP/HLS/WHEP`. Encode 在 Switcher 之后, 不得提前.
//! - 身份: `Device Registry`(SDK DeviceHandle) → `Resolver`(GStreamer `hw-serial-number` 解析)
//!   → `RuntimeBinding`(Backend runtime address). **SDK 枚举 index ≠ GStreamer device-number**.
//!
//! 当前 MEDIA-RT-01 范围: canonical ingest 首帧/PTS/稳定性验收. Normalize/Switch/Encode/SRS 为后续阶段.

#![allow(dead_code)]

use crate::device::{DeviceInfo, IdentityStrength};
use crate::graph_intent::GraphRuntimeIntent;
use crate::port::{ConnectorType, PortDirection};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use uuid::Uuid;

/// 全局唯一 pipeline 句柄计数器 (P1-1: 多 controller 共用全局 `HEALTH_ARCS` 时避免 handle 碰撞).
pub(crate) static NEXT_PIPELINE_ID: AtomicU64 = AtomicU64::new(1);

/// Bus 事件因 channel 满被丢弃的累计计数 (P1 §十三: 溢出策略).
/// RH-BUS-02: 关键 ERROR/EOS 事件溢出时存**每实例** fatal fallback
/// (controller `GstInstance.fatal_fallback`, `poll_bus` 原子 take)——全局单槽
/// 已删 (多输入下互相覆盖 sticky 证据); 此处仅保留全局计数 metric.
pub static DROPPED_BUS_EVENTS: AtomicU64 = AtomicU64::new(0);

/// Bus channel 累计丢弃事件数 (P1 §十三 溢出 metric), 由 `/health` 暴露.
pub fn dropped_bus_events() -> u64 {
    DROPPED_BUS_EVENTS.load(Ordering::SeqCst)
}

/// ClockLost 事件累计计数 (P1-4 最低策略: ClockLost = degraded, 不自动重启; 完整 Clock Recovery 属 V0.3/P2).
/// 即便 channel 不丢, 仍独立计数以便健康面暴露 "AV 同步降级" 信号.
pub static CLOCK_LOST_EVENTS: AtomicU64 = AtomicU64::new(0);

/// ClockLost 累计计数 (P1-4 降级 metric), 由 `/health` 暴露.
pub fn clock_lost_events() -> u64 {
    CLOCK_LOST_EVENTS.load(Ordering::SeqCst)
}

/// Canonical source 与 RuntimeBinding 的关系类别。
///
/// 只表达“绑定证据/用途”，**不携带任何 Backend 运行时地址**。具体 GStreamer
/// `device-number` / `persistent-id` 等地址由 GStreamer Backend 注入的
/// `ResolvedDeviceBinding` 解析；未来 FFmpegBackend 可消费自己的 RuntimeBinding。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SourceBindingClass {
    /// 稳定持久身份已被 Resolver/Provider 证明；Backend 可优先消费其持久 runtime binding。
    Persistent,
    /// 稳定设备身份已解析到 Backend runtime binding。
    Resolved,
    /// 显式 Diagnostic 模式；允许已解析 binding，缺席时保留历史 device-0 诊断 fallback。
    DiagnosticFallback,
    /// MEDIA-RT-01 自测源；无需任何硬件 RuntimeBinding。
    SelfTest,
}

/// 物化后的 canonical 单路采集源计划。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SourcePlan {
    /// Hardware input; runtime device address is resolved only by the backend.
    Device {
        device_id: String,
        connector: Option<ConnectorType>,
        binding_class: SourceBindingClass,
    },
    /// Network input; no DeviceId/PortId projection exists in this variant.
    Network {
        source_id: crate::source::NetworkSourceId,
        endpoint: crate::source::NetworkEndpoint,
    },
    /// MEDIA-RT-01 self-test source.
    SelfTest,
}

impl SourcePlan {
    pub fn device_id(&self) -> Option<&str> {
        match self {
            Self::Device { device_id, .. } => Some(device_id),
            Self::Network { .. } | Self::SelfTest => None,
        }
    }

    pub fn connector(&self) -> Option<ConnectorType> {
        match self {
            Self::Device { connector, .. } => *connector,
            Self::Network { .. } | Self::SelfTest => None,
        }
    }

    pub fn binding_class(&self) -> SourceBindingClass {
        match self {
            Self::Device { binding_class, .. } => *binding_class,
            Self::Network { .. } => SourceBindingClass::Resolved,
            Self::SelfTest => SourceBindingClass::SelfTest,
        }
    }

    #[cfg(test)]
    fn device_mut(
        &mut self,
    ) -> Option<(
        &mut String,
        &mut Option<ConnectorType>,
        &mut SourceBindingClass,
    )> {
        match self {
            Self::Device {
                device_id,
                connector,
                binding_class,
            } => Some((device_id, connector, binding_class)),
            Self::Network { .. } | Self::SelfTest => None,
        }
    }
}

/// 物化后的 canonical 管线计划；Backend runtime address 不进入本类型。
///
/// RuntimeBinding 由 Backend 组合根注入；PipelinePlan 仅携带 canonical source semantics.
/// P1a: 物化后的输出计划（domain 持有; controller 纯执行, 不硬编码 element 名）。
///
/// 词表封闭: `Hls | Rtmp`。`appsink` = 纯分析 = 无输出段（不入此 enum, 现行为默认）;
/// 未知 kind ⇒ materialize fail-closed 拒绝（词表第一次有牙齿, 用户 2026-09-02 裁定）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OutputKind {
    Hls,
    Rtmp,
}

impl OutputKind {
    /// 契约词（与 `SinkIntent.kind` 词表一致; 运行时可见性投影用）。
    pub fn as_str(&self) -> &'static str {
        match self {
            OutputKind::Hls => "hls",
            OutputKind::Rtmp => "rtmp",
        }
    }
}

/// P1a: 单输出计划。**单会话单输出**（`SinkIntent.kind` 是单字符串, materialize 至多产 1 项;
/// 多输出 HLS+RTMP 并行留 Alpha）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OutputPlan {
    pub kind: OutputKind,
    /// x264/openh264 视频码率 demo 默认（config 单位 kbps = 6000; launch 注入时转 bps;
    /// 正式契约化留产品配置模型阶段）。
    pub video_bitrate_kbps: u32,
    /// avenc_aac 单位 bit/s（demo 默认 128000）。
    pub audio_bitrate_bps: u32,
    /// Hls: 分片目录（绝对路径）; Rtmp: `rtmp://` URL。
    pub target: String,
}

/// C-TIMELINE-01（IMP-1/OQ-10, 第三十一轮终裁）: 时间线声明策略——取代
/// 裸 `normalize: bool`（词表纪律: 裸 bool 禁; normalize=true/fix_pts/
/// force_continuity 类无法证明语义的开关禁）。
///
/// **纯声明面（Intent）**: 本字段只承载控制面对该输入的媒体时间线意图,
/// Program Timeline 的建立/映射/证据在 Program Execution 层
/// （`program_timeline.rs::TimelineAuthority`——IMP-2 纠偏: PipelinePlan
/// 属 ingest, 不承载 Program Timeline 语义）; **改本声明 ≠ 完成 Program
/// Timeline**。当前 Execution Adapter 仍不消费（A2-7-01 Execution Adapter
/// Gap 登记移交至此）: 两值生成的 ingest 管线相同, Gap 可见/可追踪/不伪装
/// 成成功; Intent ≠ Execution Fact。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimelinePolicy {
    /// 源原生时间戳直通（不声明 Program Timeline 映射意图）。
    SourceNative,
    /// 声明: 该输入进入 Program 时应映射到 Program Timeline（映射/证据由
    /// Program Execution 层 Timeline Authority 承担——本字段不是 Fact）。
    ProgramTimelineMapped,
}

/// 物化后的 canonical 管线计划；Backend runtime address 不进入本类型。
///
/// RuntimeBinding 由 Backend 组合根注入；PipelinePlan 仅携带 canonical source semantics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelinePlan {
    pub source: SourcePlan,
    /// C-TIMELINE-01: 时间线声明策略（IMP-1——原裸 `normalize: bool` 删除,
    /// 语义迁移见 TimelinePolicy 文档; A2-7-01 Gap 登记同步移交）。
    pub timeline_policy: TimelinePolicy,
    /// A2-1: 类型化 SwitchPolicy（V0.2 §1.17 词表; 默认 FRAME_SWITCH = 旧占位值,
    /// wire 序列化值不变——兼容锚见 tests）。
    pub switch_mode: crate::program::SwitchPolicy,
    /// P1a: 物化输出段（空 = 纯分析, 行为与逐字节一致）。
    pub outputs: Vec<OutputPlan>,
}

impl PipelinePlan {
    /// RF-SRC-RTMP-02 TG-5 (plan D9): deterministic, endpoint-free rendering
    /// for canonical identity hashing and any canonical debug surface.
    /// Network endpoints and output targets (HLS paths / `rtmp://` URLs) are
    /// structurally replaced by fixed markers: stable per canonical semantics
    /// (source kind + canonical ids + policies + output kinds) while carrying
    /// no host/port/path/URL text — two plans differing only in endpoint
    /// content render identically.
    pub fn redacted_debug(&self) -> String {
        let source = match &self.source {
            SourcePlan::Device {
                device_id,
                connector,
                binding_class,
            } => format!("Device({device_id}, {connector:?}, {binding_class:?})"),
            SourcePlan::Network { source_id, .. } => {
                format!("Network({source_id}, endpoint=redacted)")
            }
            SourcePlan::SelfTest => "SelfTest".into(),
        };
        let outputs = self
            .outputs
            .iter()
            .map(|o| {
                format!(
                    "Output({:?}, v={}kbps, a={}bps, target=redacted)",
                    o.kind, o.video_bitrate_kbps, o.audio_bitrate_bps
                )
            })
            .collect::<Vec<_>>()
            .join(", ");
        format!(
            "PipelinePlan {{ source: {source}, timeline: {:?}, switch: {:?}, outputs: [{outputs}] }}",
            self.timeline_policy, self.switch_mode
        )
    }
}

impl PipelinePlan {
    /// 从控制面 `GraphRuntimeIntent` 物化 (Device Registry + Resolver 前置).
    pub fn from_intent(
        intent: &GraphRuntimeIntent,
        devices: &[DeviceInfo],
        authorizations: &std::collections::HashMap<Uuid, crate::resolver::BindingAuthorization>,
        mode: MaterializeMode,
        registry: Option<&crate::port::PortRegistry>,
    ) -> Result<Vec<PipelinePlan>, PipelineError> {
        materialize(intent, devices, mode, authorizations, registry)
    }

    /// P1a: 输出物化 launch 全串（含 tee 双分支; 空 outputs ⇒ `""`, controller 走今日串）。
    ///
    /// **分析红线**: appsink 保持 `async=false`，但其观察 queue 必须显式 bounded + leaky，
    /// 防止健康/PTS 观测反压 canonical ingest；编码分支继续使用独立普通 `queue` 解耦。
    /// src 前缀由参数注入——本方法与 `src_props` 同层（domain 物化）, controller 纯拼接执行,
    /// **不出现**于本方法外的 element 名硬编码（用户边界修正）。
    pub(crate) fn output_launch(&self, video_src: &str, audio_src: &str) -> String {
        let Some(out) = self.outputs.first() else {
            return String::new();
        };
        let v = out.video_bitrate_kbps;
        let a = out.audio_bitrate_bps;
        // 接线 = 盒上实证（probe 2026-09-02, 自持 1080p25 环回信号交替复验）:
        // - HLS 用 hlssink2 **命名 request pad** (out.video/out.audio; 内部自带 mux,
        //   外置 mpegtsmux 反而链接失败);
        // - RTMP 用 flvmux 命名 request pad (mux.video/mux.audio) + rtmpsink;
        // - 视频编码器 = **openh264enc**（本机 x264enc 与任何格式 caps 约束互斥死锁
        //   ——下游约束触发 decklinkvideosrc 运行中重协商即 Internal data stream error;
        //   零 caps 时 x264 输出 4:4:4 浏览器不可播。openh264enc 零 caps 稳定且输出
        //   Constrained Baseline yuv420p = 4:2:0 浏览器最大兼容）。bitrate 单位 **bps**。
        let (v_sink, a_sink, tail) = match out.kind {
            OutputKind::Hls => {
                let dir = &out.target;
                (
                    "out.video".to_string(),
                    "out.audio".to_string(),
                    format!(
                        "hlssink2 name=out playlist-location={dir}/index.m3u8 \
                         location={dir}/seg%05d.ts target-duration=2 max-files=10 \
                         playlist-length=5 send-keyframe-requests=true"
                    ),
                )
            }
            OutputKind::Rtmp => {
                let url = &out.target;
                (
                    "mux.video".to_string(),
                    "mux.audio".to_string(),
                    format!(
                        "flvmux name=mux streamable=true ! rtmp2sink location=\"{url}\" timeout=5 sync=false"
                    ),
                )
            }
        };
        let observer_queue = OBSERVER_QUEUE;
        format!(
            "{video_src} ! video/x-raw ! tee name=v \
             v. ! {observer_queue} ! appsink name=videosink async=false \
             v. ! queue ! videoconvert ! openh264enc bitrate={} gop-size=50 \
             min-force-key-unit-interval=2000000000 ! h264parse ! {v_sink} \
             {audio_src} ! audio/x-raw ! tee name=a \
             a. ! {observer_queue} ! appsink name=audiosink async=false \
             a. ! queue ! audioconvert ! avenc_aac bitrate={a} ! aacparse ! {a_sink} {tail}",
            v * 1000
        )
    }

    /// MEDIA-RT-01 自测计划 (videotestsrc/audiotestsrc, 不依赖 DeckLink).
    pub fn self_test() -> PipelinePlan {
        PipelinePlan {
            source: SourcePlan::SelfTest,
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        }
    }
}

/// PTS 单调性四态 (P1-3 三态 + C-TIMELINE-01 §6 第四态, 第三十一轮终裁 §十):
/// 区分 "未观测任何有效 PTS" / "已观测且帧间非回退" / "已声明的合法时间线
/// 边界被观测证实" / "观测到回退"。旧 `pts_monotonic: bool` 把 `Unknown`
/// 与 `NonMonotonic` 压成一个 `false`, 导致 UI/Evidence/Supervisor 无法
/// 区分 "没收到帧" 与 "流损坏", 故升级为枚举. 语义独立到 video/audio 两路
/// (PIPELINE-AV 之前的最小解耦, 用户 §三)。
///
/// **四态纪律（Freeze §6/终裁 §十）**: `declared discontinuity + expected
/// transition ≠ unexpected backward PTS`——前者=系统知道发生了合法时间线
/// 边界; 后者=观测到不符合当前连续性规则的事实。**禁把 NonMonotonic 简单
/// 改回 ValidMonotonic, 也禁把两者混同**（不洗状态）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PtsMonotonicity {
    /// 尚未收到任何有效 PTS — 无证据, 不得等同于 NonMonotonic 或 PASS (absence≠evidence).
    Unknown,
    /// 已收到且帧间严格非回退 (`pts >= last_pts`) — 流时间戳健康.
    ValidMonotonic,
    /// C-TIMELINE-01: 已声明的合法时间线边界被观测证实（Segment transition
    /// declared + expected transition）——合法边界事实, 非 NonMonotonic,
    /// 亦非普通 ValidMonotonic（保留"发生过边界"事实; L4 判定不计为未声明
    /// 回退, Freeze §14）。仅经 `observe_*_pts_declared` 产生——ingest 平面
    /// 无声明源, 永不出现。
    DiscontinuityDeclared,
    /// 观测到 PTS 回退 (`pts < last_pts`) — 流损坏/时间戳错乱; sticky (一旦回退不再自动恢复).
    NonMonotonic,
}

/// 管线运行时健康状态 + MEDIA-RT-01 acceptance 现场.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineHealth {
    pub video_frame_count: u64,
    pub audio_frame_count: u64,
    pub video_first_pts: Option<u64>,
    pub audio_first_pts: Option<u64>,
    /// 上一帧已观测 PTS (video/audio 分别) — 真正单调性判定基准 (用户复核 §十一):
    /// 由 `observe_video_pts`/`observe_audio_pts` 推进 `video_pts_state`/`audio_pts_state`.
    pub video_last_pts: Option<u64>,
    pub audio_last_pts: Option<u64>,
    /// PTS 单调性三态 (P1-3), video/audio 独立: Unknown/ValidMonotonic/NonMonotonic.
    /// 旧版单一 `pts_monotonic: bool` 无法区分 "未观测" 与 "回退", 已被此取代.
    pub video_pts_state: PtsMonotonicity,
    pub audio_pts_state: PtsMonotonicity,
    pub last_error: Option<String>,
    pub acceptance: MediaRt01Acceptance,
    /// 管线启动时刻 (UNIX 秒) — C 稳定性窗口计时起点 (watchdog 计算 observed_ms).
    pub started_at: Option<i64>,
    /// 管线是否已进入 PLAYING (`start()` 成功后置 true; recover 停止时置 false).
    /// watchdog 据此推导 `a3_pipeline_playing` (P1-2: 不得靠 default=true 蒙混).
    pub playing: bool,
    /// 累计接获的 GStreamer Bus 事件数 (P1-4: 证明 Bus watch→channel→poll_bus 链路真实生效;
    /// 运维可据此判断事件率, Supervisor 不依赖此计数做决策).
    pub bus_event_count: u64,
}

impl PipelineHealth {
    /// MEDIA-RT-01A: 首帧 (video+audio) + PTS 单调, 即视为 ingest 打开成功.
    pub fn first_frame_ok(&self) -> bool {
        self.video_first_pts.is_some()
            && self.audio_first_pts.is_some()
            && self.video_pts_state == PtsMonotonicity::ValidMonotonic
            && self.audio_pts_state == PtsMonotonicity::ValidMonotonic
    }

    /// 完整 acceptance (A+B+C 全过).
    pub fn pass(&self) -> bool {
        self.acceptance.a_pass() && self.acceptance.b_pass() && self.acceptance.c_pass()
    }

    /// 观测一帧 video PTS, 推进 `video_pts_state` 三态机 (P1-3).
    /// 规则: 首有效 PTS → ValidMonotonic; 之后 `pts < last` → NonMonotonic (sticky);
    /// 否则保持 (ValidMonotonic 或已 NonMonotonic). 无 PTS 帧 (None) 不参与 (调用方已过滤).
    /// 与 `video_first_pts` 解耦: 首帧 PTS 记录由 appsink 回调单独维护, 本方法只管单调性状态.
    pub fn observe_video_pts(&mut self, pts: u64) {
        if let Some(last) = self.video_last_pts {
            if pts < last {
                self.video_pts_state = PtsMonotonicity::NonMonotonic;
            }
            // 否则保持当前状态 (ValidMonotonic / 已 NonMonotonic 均 sticky).
        } else {
            self.video_pts_state = PtsMonotonicity::ValidMonotonic;
        }
        self.video_last_pts = Some(pts);
    }

    /// 观测一帧 audio PTS, 推进 `audio_pts_state` 三态机 (P1-3). 语义同 `observe_video_pts`,
    /// 独立维护 audio 一路 (PIPELINE-AV 之前的最小解耦, 用户 §三).
    pub fn observe_audio_pts(&mut self, pts: u64) {
        if let Some(last) = self.audio_last_pts {
            if pts < last {
                self.audio_pts_state = PtsMonotonicity::NonMonotonic;
            }
            // 否则保持当前状态 (sticky).
        } else {
            self.audio_pts_state = PtsMonotonicity::ValidMonotonic;
        }
        self.audio_last_pts = Some(pts);
    }

    /// C-TIMELINE-01 §6 四态: 观测一枚**已声明边界**的 video 帧（Segment
    /// transition declared + expected transition 被证实——如切换后首枚
    /// 已映射 B 帧）。PTS 非回退 → `DiscontinuityDeclared`（合法边界事实,
    /// 保留不洗）; **即便有声明, PTS 回退仍 → NonMonotonic sticky**——声明
    /// 不豁免连续性违反（映射的职责就是连续; 禁以声明洗回退）。
    pub fn observe_video_pts_declared(&mut self, pts: u64) {
        if self.video_last_pts.is_some_and(|last| pts < last) {
            self.video_pts_state = PtsMonotonicity::NonMonotonic;
        } else {
            // 已声明边界被证实——即便此前 ValidMonotonic 亦升级为
            // DiscontinuityDeclared（边界事实保留）; NonMonotonic 不洗（sticky）。
            if self.video_pts_state != PtsMonotonicity::NonMonotonic {
                self.video_pts_state = PtsMonotonicity::DiscontinuityDeclared;
            }
        }
        self.video_last_pts = Some(pts);
    }

    /// C-TIMELINE-01 §6 四态: audio 侧已声明边界观测（语义同
    /// `observe_video_pts_declared`, audio 路独立）。
    pub fn observe_audio_pts_declared(&mut self, pts: u64) {
        if self.audio_last_pts.is_some_and(|last| pts < last) {
            self.audio_pts_state = PtsMonotonicity::NonMonotonic;
        } else {
            if self.audio_pts_state != PtsMonotonicity::NonMonotonic {
                self.audio_pts_state = PtsMonotonicity::DiscontinuityDeclared;
            }
        }
        self.audio_last_pts = Some(pts);
    }
}

impl Default for PipelineHealth {
    fn default() -> Self {
        Self {
            video_frame_count: 0,
            audio_frame_count: 0,
            video_first_pts: None,
            audio_first_pts: None,
            video_last_pts: None,
            audio_last_pts: None,
            // 两路 PTS 三态起始 `Unknown`: 无帧即"未观测", 不得 absence-of-evidence = pass
            // (用户复核 §十一/§十 P1-2 / P1-3). appsink 回调经 `observe_*_pts` 推进状态:
            // 首有效 PTS → ValidMonotonic; 回退 → NonMonotonic (sticky).
            video_pts_state: PtsMonotonicity::Unknown,
            audio_pts_state: PtsMonotonicity::Unknown,
            last_error: None,
            acceptance: MediaRt01Acceptance::default(),
            started_at: None,
            playing: false,
            bus_event_count: 0,
        }
    }
}

/// MEDIA-RT-01 acceptance 子项 (A/B/C 三组).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MediaRt01Acceptance {
    // A — Ingest Open
    pub a1_identity_resolved: bool,
    pub a2_lease_acquired: bool,
    pub a3_pipeline_playing: bool,
    pub a4_signal_detected: bool,
    // B — First Valid Buffer
    pub b1_first_video: bool,
    pub b2_first_audio: bool,
    pub b3_valid_pts: bool,
    pub b4_pts_monotonic: bool,
    // C — Short Stability (测量型, 非仅"无 error"; 用户复核 §十二)
    pub c1_no_unexpected_eos: bool,
    pub c2_no_pipeline_error: bool,
    pub c3_no_repeated_reneg: bool,
    pub c4_counters_continue: bool,
    // —— C 稳定性测量窗口 (Phase 0.6: C = 测量型 acceptance) ——
    /// 已观测稳定时长 (ms); 由 watchdog 计时 (started_at → now).
    pub c_observed_ms: Option<u64>,
    /// 配置的稳定窗口 (ms); 默认 10_000. `c_observed_ms >= 此值` 视为窗口达标.
    pub c_configured_window_ms: u64,
    pub c_video_frames: u64,
    pub c_audio_frames: u64,
    pub c_unexpected_eos: u64,
    pub c_pipeline_errors: u64,
    pub c_renegotiations: u64,
}

impl MediaRt01Acceptance {
    /// A — Ingest Open: 身份解析 + 租约 + 管线 playing + 信号检测.
    pub fn a_pass(&self) -> bool {
        self.a1_identity_resolved
            && self.a2_lease_acquired
            && self.a3_pipeline_playing
            && self.a4_signal_detected
    }

    /// B — First Valid Buffer: 首视频帧 + 首音频帧 + 有效 PTS + PTS 单调.
    pub fn b_pass(&self) -> bool {
        self.b1_first_video && self.b2_first_audio && self.b3_valid_pts && self.b4_pts_monotonic
    }

    /// C — Short Stability (测量型, 用户复核 §十二): 稳定窗口达标 + 无致命 pipeline error +
    /// 计数持续增长 + PTS 单调. 仅 "没有 error" 不够, 必须达到配置观测窗口.
    pub fn c_pass(&self) -> bool {
        let window_ok = self
            .c_observed_ms
            .is_some_and(|o| o >= self.c_configured_window_ms);
        window_ok
            && self.c1_no_unexpected_eos
            && self.c2_no_pipeline_error
            && self.c3_no_repeated_reneg
            && self.c4_counters_continue
            && self.b4_pts_monotonic
    }
}

impl Default for MediaRt01Acceptance {
    fn default() -> Self {
        // P1-2: 默认全 `false` — "Default Health = all PASS" 不合理. 各**正向成就**项
        // (身份/租约/播放/信号/首帧/有效PTS/单调/计数增长) 由真实运行时事件逐项置 true;
        // 从未观测到 = 未通过, 绝不 absence-of-evidence = PASS. 负向项 (c1/c2/c3 无错误)
        // 由 watchdog 从对应计数器推导 (见 main.rs).
        Self {
            a1_identity_resolved: false,
            a2_lease_acquired: false,
            a3_pipeline_playing: false,
            a4_signal_detected: false,
            b1_first_video: false,
            b2_first_audio: false,
            b3_valid_pts: false,
            b4_pts_monotonic: false,
            c1_no_unexpected_eos: false,
            c2_no_pipeline_error: false,
            c3_no_repeated_reneg: false,
            c4_counters_continue: false,
            c_observed_ms: None,
            c_configured_window_ms: 10_000,
            c_video_frames: 0,
            c_audio_frames: 0,
            c_unexpected_eos: 0,
            c_pipeline_errors: 0,
            c_renegotiations: 0,
        }
    }
}

/// 物化模式 (控制面/运行时策略).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaterializeMode {
    /// 生产: 身份解析失败直接 `IdentityUnresolved`, 绝不盲开 device 0.
    Production,
    /// Diagnostic: 显式回退 `device-number` (仅验证/排障, 非静默 fallback).
    Diagnostic,
}

/// 管线错误.
#[derive(Debug, thiserror::Error)]
pub enum PipelineError {
    #[error("identity unresolved: {0}")]
    IdentityUnresolved(String),
    #[error("pipeline prepare failed: {0}")]
    PrepareFailed(String),
    #[error("pipeline start failed: {0}")]
    StartFailed(String),
    /// P0-2 (p07-session-runtime): Backend.stop 失败 (additive; SessionManager 据此
    /// 记录停止失败但仍完成 Session 层资源归还)。
    #[error("pipeline stop failed: {0}")]
    StopFailed(String),
}

/// Pipeline Controller trait — 媒体运行时生命周期 (prepare/start/recover).
pub trait PipelineController {
    fn prepare(&self, plan: &PipelinePlan) -> Result<PipelineHandle, PipelineError>;
    fn start(&self, handle: &PipelineHandle) -> Result<(), PipelineError>;
    fn recover(&self, handle: &PipelineHandle) -> Result<(), PipelineError>;
}

/// 管线句柄 (GStreamer 运行时实例标识).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PipelineHandle(pub u64);

/// 健康/PTS appsink 是观测面，不是 canonical media path。它必须有界且 leaky，
/// 避免观测锁竞争/消费者抖动反压 DeckLink ingest，迫使 native frame allocator
/// 抬高整帧高水位。bytes/time 设 0 表示仅由单 buffer 上限约束。
pub(crate) const OBSERVER_QUEUE: &str =
    "queue max-size-buffers=1 max-size-bytes=0 max-size-time=0 leaky=downstream";

/// GStreamer 选卡属性 (decklinkvideosrc/audiosrc).
///
/// 选卡属性语义 (用户复核 §十, 纠正旧注释 "hw-serial-number=<BMD PersistentID>" 的错误表达):
/// - PersistentID 可用 → GStreamer `persistent-id=<BMD PersistentID>` (官方首选, 优先级高于 device-number).
/// - PersistentID 不可用 → Resolver 探测 `hw-serial-number` 匹配 SDK DeviceHandle, 解析出
///   确定的 GStreamer `device-number` → `decklinkvideosrc device-number=<n>`.
/// - `hw-serial-number` 是 **GStreamer 侧** 硬件序列号/硬件 ID 探测属性 (只读), 与 "BMD PersistentID"
///   是两回事; 它不是 PersistentID 的别名. SDK 枚举 index 绝不直接当 device-number.
pub(crate) fn src_props(
    plan: &PipelinePlan,
    bindings: &std::collections::HashMap<Uuid, crate::resolver::ResolvedDeviceBinding>,
) -> Result<(String, String), PipelineError> {
    if matches!(plan.source, SourcePlan::Network { .. }) {
        return Err(PipelineError::PrepareFailed(
            "GStreamer DeckLink src_props cannot consume a Network source; use FFmpeg network input"
                .into(),
        ));
    }
    let device_id = plan.source.device_id().ok_or_else(|| {
        PipelineError::IdentityUnresolved("source plan has no hardware device identity".into())
    })?;
    // 连接类型 → GStreamer `connection=` 属性. 仅 decklinkvideosrc 需要; decklinkaudiosrc 无此属性
    // (音频内嵌于视频 SDI/HDMI 流, 跟随视频连接). `None` 或无对应枚举的连接器 → 不显式指定, 由插件默认
    // (auto) 探测, 绝不硬编码 `connection=sdi`.
    let connection = match plan.source.connector() {
        Some(ConnectorType::Sdi) => " connection=sdi",
        Some(ConnectorType::Hdmi) => " connection=hdmi",
        // GStreamer `decklinkvideosrc` 连接枚举 nick 为 "optical-sdi" (对应 BMD bmdVideoConnectionOpticalSDI), 绝非 "optical".
        Some(ConnectorType::Optical) => " connection=optical-sdi",
        Some(ConnectorType::DisplayPort)
        | Some(ConnectorType::Analog)
        | Some(ConnectorType::Unknown)
        | None => "",
    };
    let binding_for_device =
        || -> Result<&crate::resolver::ResolvedDeviceBinding, PipelineError> {
            let device_id = Uuid::parse_str(device_id).map_err(|e| {
                PipelineError::IdentityUnresolved(format!(
                    "canonical device_id 解析失败 {device_id}: {e}"
                ))
            })?;
            bindings.get(&device_id).ok_or_else(|| {
                PipelineError::IdentityUnresolved(format!(
                    "device_id={device_id} 缺少 RuntimeBinding"
                ))
            })
        };

    let (video_src, audio_src) = match plan.source.binding_class() {
        SourceBindingClass::Persistent => {
            let binding = binding_for_device()?;
            let pid = binding.persistent_id.ok_or_else(|| {
                PipelineError::IdentityUnresolved(format!(
                    "Persistent binding 缺少 persistent_id (device_id={device_id})"
                ))
            })?;
            (
                format!("decklinkvideosrc persistent-id={pid}{connection}"),
                format!("decklinkaudiosrc persistent-id={pid}"),
            )
        }
        SourceBindingClass::Resolved => {
            let binding = binding_for_device()?;
            (
                format!(
                    "decklinkvideosrc device-number={}{}",
                    binding.device_number, connection
                ),
                format!("decklinkaudiosrc device-number={}", binding.device_number),
            )
        }
        SourceBindingClass::DiagnosticFallback => {
            let device_uuid = Uuid::parse_str(device_id).map_err(|e| {
                PipelineError::IdentityUnresolved(format!(
                    "diagnostic canonical device_id 解析失败 {device_id}: {e}"
                ))
            })?;
            let device_number = bindings
                .get(&device_uuid)
                .map(|b| b.device_number)
                .unwrap_or(0);
            (
                format!("decklinkvideosrc device-number={device_number}{connection}"),
                format!("decklinkaudiosrc device-number={device_number}"),
            )
        }
        SourceBindingClass::SelfTest => (
            "videotestsrc is-live=true pattern=ball".to_string(),
            "audiotestsrc is-live=true".to_string(),
        ),
    };
    Ok((video_src, audio_src))
}

/// 物化 `GraphRuntimeIntent` → `PipelinePlan` 列表.
///
/// 身份层级状态机 (用户复核 §二/§三/§十九): 严格按 `identity_strength` 判定.
/// P0-1: 强度由 Provider 在 discovery 时按自身证据自证 (Domain 无 vendor 字段可伪造,
/// filesystem 合成身份强度恒为 Enumeration); 合成身份在生产路径必须拒绝.
///
/// 关键不变量: `materialize` 只消费 backend-neutral BindingAuthorization，绝不读取
/// GStreamer device-number / FFmpeg DeviceHandle 等执行地址；concrete RuntimeBinding 由 Backend 持有。
pub fn materialize(
    intent: &GraphRuntimeIntent,
    devices: &[DeviceInfo],
    mode: MaterializeMode,
    authorizations: &std::collections::HashMap<Uuid, crate::resolver::BindingAuthorization>,
    registry: Option<&crate::port::PortRegistry>,
) -> Result<Vec<PipelinePlan>, PipelineError> {
    // P1a: env 读取在 materialize 内（签名零改动）——**显式 demo 层缝**, 正式配置模型阶段收口
    // （Design Doc §3.2; 用户裁定 PrototypeOutputConfig 不进 Runtime Contract）。
    materialize_with_output(
        intent,
        devices,
        mode,
        authorizations,
        registry,
        &crate::config::PrototypeOutputConfig::from_env(),
    )
}

/// P1a: 可测物化变体（cfg 注入; 全部物化逻辑在此, `materialize` 仅 env 委托）。
pub fn materialize_with_output(
    intent: &GraphRuntimeIntent,
    devices: &[DeviceInfo],
    mode: MaterializeMode,
    authorizations: &std::collections::HashMap<Uuid, crate::resolver::BindingAuthorization>,
    registry: Option<&crate::port::PortRegistry>,
    cfg: &crate::config::PrototypeOutputConfig,
) -> Result<Vec<PipelinePlan>, PipelineError> {
    let mut plans = Vec::new();
    for d in &intent.devices {
        if let crate::graph_intent::SourceIntent::Rtmp {
            source_id,
            endpoint,
        } = &d.pipeline.source
        {
            // RF-SRC-RTMP-02 TG-3: widen the old loopback-only gate through
            // D2 canonical validation (frozen audit appendix directive).
            // Production admission (five-tuple binding) already happened at
            // the Session layer; Diagnostic network fixtures stay loopback.
            let canonical = endpoint
                .to_canonical()
                .map_err(PipelineError::IdentityUnresolved)?;
            if mode == MaterializeMode::Diagnostic && !canonical.ip().is_loopback() {
                return Err(PipelineError::IdentityUnresolved(
                    "diagnostic network fixtures must stay loopback (plan D2)".into(),
                ));
            }
            let outputs = if plans.is_empty() {
                materialize_outputs(&d.pipeline.sink.kind, cfg)?
            } else {
                Vec::new()
            };
            plans.push(PipelinePlan {
                source: SourcePlan::Network {
                    source_id: *source_id,
                    endpoint: endpoint.clone(),
                },
                timeline_policy: TimelinePolicy::ProgramTimelineMapped,
                switch_mode: crate::program::SwitchPolicy::FrameSwitch,
                outputs,
            });
            continue;
        }

        let info = devices
            .iter()
            .find(|x| x.device_id.to_string() == d.device_id)
            .ok_or_else(|| {
                PipelineError::IdentityUnresolved(format!("设备未注册: {}", d.device_id))
            })?;

        let authorization = authorizations.get(&info.device_id);
        let production_authorized = authorization.is_some_and(|a| a.is_production_grade());
        // 身份层级状态机只消费 authorization fact；concrete runtime address 不参与 canonical 物化。
        let binding_class = match info.identity_strength {
            IdentityStrength::PersistentId => {
                if production_authorized && authorization.is_some_and(|a| a.persistent_identity) {
                    SourceBindingClass::Persistent
                } else {
                    return Err(PipelineError::IdentityUnresolved(format!(
                        "{}: PersistentId 档位缺少 production-grade persistent authorization",
                        d.device_id
                    )));
                }
            }
            IdentityStrength::DeviceHandle if production_authorized => SourceBindingClass::Resolved,
            IdentityStrength::TopologicalId if authorization.is_some() => {
                // 拓扑敏感: 即使有 authorization evidence，也仅 Diagnostic 显式模式允许。
                match mode {
                    MaterializeMode::Production => {
                        return Err(PipelineError::IdentityUnresolved(format!(
                            "{}: TopologicalId 身份强度不足, 生产路径拒绝 (需 production-grade authorization)",
                            d.device_id
                        )));
                    }
                    MaterializeMode::Diagnostic => SourceBindingClass::DiagnosticFallback,
                }
            }
            _ => {
                // Enumeration / 未授权 DeviceHandle / 无 authorization：生产拒绝；Diagnostic 明确 fallback。
                match mode {
                    MaterializeMode::Production => {
                        return Err(PipelineError::IdentityUnresolved(format!(
                            "{}: 身份未获 production authorization (identity_strength={:?}, authorization_present={}); 生产拒绝",
                            d.device_id, info.identity_strength, authorization.is_some()
                        )));
                    }
                    MaterializeMode::Diagnostic => SourceBindingClass::DiagnosticFallback,
                }
            }
        };

        // 连接类型: 优先按 Control Plane 显式声明的 `port_id` 精确定位端口; 否则回退到该设备
        // 的首个输入端口. 显式 `port_id` 在 Discovery 无对应端口 ⇒ 生产失败闭合 (绝不静默回退 auto 探测).
        let connector = match d.pipeline.source.port_id() {
            Some(pid) => {
                let u = match Uuid::parse_str(pid) {
                    Ok(u) => u,
                    Err(e) => {
                        return Err(PipelineError::IdentityUnresolved(format!(
                            "{}: port_id 解析失败: {e}",
                            d.device_id
                        )))
                    }
                };
                match registry.and_then(|r| {
                    r.ports
                        .iter()
                        .find(|p| p.identity.port_id == Some(u))
                        .map(|p| p.identity.connector)
                }) {
                    Some(c) => Some(c),
                    None => {
                        if matches!(mode, MaterializeMode::Production) {
                            return Err(PipelineError::IdentityUnresolved(format!(
                                "{}: 显式 port_id {} 在 Discovery 端口中无匹配 (生产拒绝静默回退 auto)",
                                d.device_id, pid
                            )));
                        } else {
                            None // Diagnostic: 回退 auto 探测
                        }
                    }
                }
            }
            None => registry.and_then(|r| {
                r.ports
                    .iter()
                    .find(|p| p.device_id == info.device_id && p.direction == PortDirection::Input)
                    .map(|p| p.identity.connector)
            }),
        };

        let source = SourcePlan::Device {
            device_id: d.device_id.clone(),
            connector,
            binding_class,
        };
        // P1a: sink.kind 第一次被消费——输出意图 → 输出物化（词表 appsink/hls/rtmp）。
        // Alpha-1 单输出承诺（design D3）: **仅首设备**保留输出段; 次设备词表校验照常
        // （fail-closed 不豁免）但强制纯分析（多输出/混流 = Alpha-2/3）。
        let outputs = {
            let o = materialize_outputs(&d.pipeline.sink.kind, cfg)?;
            if plans.is_empty() {
                o
            } else {
                if !o.is_empty() {
                    tracing::warn!(
                        "Alpha-1 单输出承诺: 仅首输入物化输出; 次设备 {} 声明 {} ⇒ 强制纯分析",
                        d.device_id,
                        d.pipeline.sink.kind
                    );
                }
                Vec::new()
            }
        };
        plans.push(PipelinePlan {
            source,
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs,
        });
    }
    Ok(plans)
}

/// P1a: `SinkIntent.kind` 词表物化。
///
/// - `appsink` ⇒ 无输出段（纯分析, 现行为默认）;
/// - `hls`/`rtmp` 且对应目标 env 在位 ⇒ 物化 `OutputPlan`（demo 默认码率注入）;
/// - `hls`/`rtmp` 但目标缺失 ⇒ **fail-soft** 降级纯分析（部署态, 非契约违约; log warn）;
/// - 其他未知 kind ⇒ **fail-closed** 拒绝（契约违约, 生产/诊断一致, 绝不静默回退）。
fn materialize_outputs(
    kind: &str,
    cfg: &crate::config::PrototypeOutputConfig,
) -> Result<Vec<OutputPlan>, PipelineError> {
    let plan_for = |kind: OutputKind, target: String| {
        vec![OutputPlan {
            kind,
            video_bitrate_kbps: cfg.video_bitrate_kbps,
            audio_bitrate_bps: cfg.audio_bitrate_bps,
            target,
        }]
    };
    match kind {
        "appsink" => Ok(Vec::new()),
        "hls" => match &cfg.hls_dir {
            Some(dir) => Ok(plan_for(OutputKind::Hls, dir.clone())),
            None => {
                tracing::warn!(
                    "sink.kind=hls 但 VBMF_OUTPUT_HLS_DIR 未设 ⇒ 降级纯分析 (fail-soft)"
                );
                Ok(Vec::new())
            }
        },
        "rtmp" => match &cfg.rtmp_url {
            Some(url) => Ok(plan_for(OutputKind::Rtmp, url.clone())),
            None => {
                tracing::warn!(
                    "sink.kind=rtmp 但 VBMF_OUTPUT_RTMP_URL 未设 ⇒ 降级纯分析 (fail-soft)"
                );
                Ok(Vec::new())
            }
        },
        other => Err(PipelineError::IdentityUnresolved(format!(
            "未知 sink kind {other:?}: 词表=[appsink, hls, rtmp] (P1a 契约词, fail-closed)"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::device::DeviceIdentitySource;
    use crate::graph_intent::{
        DeviceIntent, GraphRuntimeIntent, PipelineIntent, SinkIntent, SourceIntent,
    };
    use crate::port::{
        PortIdentity, PortInfo, PortOrdinal, PortRegistry, SignalStatus, VideoContentState,
    };
    use crate::resolver::{Confidence, ResolvedDeviceBinding, ResolverMatch};
    use uuid::Uuid;

    fn dev_handle(strength: IdentityStrength) -> DeviceInfo {
        DeviceInfo {
            device_id: Uuid::new_v4(),
            model: "DeckLink SDI".to_string(),
            display_name: "dv".to_string(),
            serial_number: None,
            identity_strength: strength,
            identity_source: DeviceIdentitySource::RealBmd,
            capabilities: crate::port::DeviceCapabilities::default(),
            video_input_connections: 0,
            video_output_connections: 0,
            ports: Vec::new(),
        }
    }

    fn runtime_bindings(
        device_id: Uuid,
        device_number: u32,
        persistent_id: Option<i64>,
    ) -> std::collections::HashMap<Uuid, ResolvedDeviceBinding> {
        let mut bindings = std::collections::HashMap::new();
        bindings.insert(
            device_id,
            ResolvedDeviceBinding {
                device_number,
                hw_serial_number: None,
                persistent_id,
                confidence: Confidence::High,
                match_kind: ResolverMatch::ManifestVerified,
            },
        );
        bindings
    }

    fn intent_with_port(device_id: &str, port_id: Option<&str>) -> GraphRuntimeIntent {
        GraphRuntimeIntent {
            version: "1.0".into(),
            devices: vec![DeviceIntent {
                device_id: device_id.into(),
                role: "CAPTURE".into(),
                pipeline: PipelineIntent {
                    source: SourceIntent::decklink(device_id, port_id.map(|s| s.into())),
                    sink: SinkIntent {
                        kind: "appsink".into(),
                    },
                },
            }],
        }
    }

    fn registry_with_port(dev_id: Uuid, pid: Uuid, connector: ConnectorType) -> PortRegistry {
        PortRegistry {
            ports: vec![PortInfo {
                device_id: dev_id,
                provider_binding_ref: Some("h".into()),
                identity: PortIdentity {
                    port_id: Some(pid),
                    connector,
                    ordinal: PortOrdinal::Known(1),
                },
                direction: PortDirection::Input,
                capabilities: crate::port::PortCapabilities::default(),
                runtime_binding: None,
                signal: SignalStatus::default(),
                content: VideoContentState::Unknown,
            }],
        }
    }

    fn intent_with_sink(device_id: &str, kind: &str) -> GraphRuntimeIntent {
        GraphRuntimeIntent {
            version: "1.0".into(),
            devices: vec![DeviceIntent {
                device_id: device_id.into(),
                role: "CAPTURE".into(),
                pipeline: PipelineIntent {
                    source: SourceIntent::decklink(device_id, None),
                    sink: SinkIntent { kind: kind.into() },
                },
            }],
        }
    }

    fn output_cfg_with(
        hls_dir: Option<&str>,
        rtmp_url: Option<&str>,
        v_kbps: u32,
        a_bps: u32,
    ) -> crate::config::PrototypeOutputConfig {
        crate::config::PrototypeOutputConfig {
            sink_kind_override: None,
            hls_dir: hls_dir.map(|s| s.to_string()),
            rtmp_url: rtmp_url.map(|s| s.to_string()),
            video_bitrate_kbps: v_kbps,
            audio_bitrate_bps: a_bps,
        }
    }

    fn plans_for_sink(
        kind: &str,
        cfg: &crate::config::PrototypeOutputConfig,
    ) -> Result<Vec<PipelinePlan>, PipelineError> {
        let dev = dev_handle(IdentityStrength::DeviceHandle);
        let did = dev.device_id.to_string();
        let devices = vec![dev];
        let mut bindings = std::collections::HashMap::new();
        bindings.insert(
            devices[0].device_id,
            ResolvedDeviceBinding {
                device_number: 1,
                hw_serial_number: None,
                persistent_id: None,
                confidence: Confidence::High,
                match_kind: ResolverMatch::ManifestVerified,
            },
        );
        let authorizations = crate::resolver::authorizations_from_runtime_bindings(&bindings);
        materialize_with_output(
            &intent_with_sink(&did, kind),
            &devices,
            MaterializeMode::Diagnostic,
            &authorizations,
            None,
            cfg,
        )
    }

    #[test]
    fn pipeline_rt_01_sink_kind_hls_materializes_with_dir() {
        let cfg = output_cfg_with(Some("/tmp/p1a-hls"), None, 6000, 128_000);
        let plans = plans_for_sink("hls", &cfg).expect("hls + dir ⇒ 物化");
        assert_eq!(plans.len(), 1);
        assert_eq!(
            plans[0].outputs,
            vec![OutputPlan {
                kind: OutputKind::Hls,
                video_bitrate_kbps: 6000,
                audio_bitrate_bps: 128_000,
                target: "/tmp/p1a-hls".into(),
            }],
            "物化含 kind/默认码率/目标"
        );
    }

    #[test]
    fn pipeline_rt_01_multi_device_only_first_plan_gets_outputs() {
        // Alpha-1 单输出承诺（design D3）: 多设备 intent 仅**首** plan 物化输出段,
        // 其余设备强制纯分析（多输出/混流 = Alpha-2/3）。
        let cfg = output_cfg_with(Some("/tmp/h"), Some("rtmp://h/l"), 6000, 128_000);
        let devs = vec![
            dev_handle(IdentityStrength::DeviceHandle),
            dev_handle(IdentityStrength::DeviceHandle),
        ];
        let ids: Vec<String> = devs.iter().map(|d| d.device_id.to_string()).collect();
        let mut bindings = std::collections::HashMap::new();
        for (n, d) in devs.iter().enumerate() {
            bindings.insert(
                d.device_id,
                ResolvedDeviceBinding {
                    device_number: n as u32,
                    hw_serial_number: None,
                    persistent_id: None,
                    confidence: Confidence::High,
                    match_kind: ResolverMatch::ManifestVerified,
                },
            );
        }
        let intent = GraphRuntimeIntent {
            version: "1.0".into(),
            devices: ids
                .iter()
                .map(|id| DeviceIntent {
                    device_id: id.clone(),
                    role: "CAPTURE".into(),
                    pipeline: PipelineIntent {
                        source: SourceIntent::decklink(id.clone(), None),
                        sink: SinkIntent { kind: "hls".into() },
                    },
                })
                .collect(),
        };
        let authorizations = crate::resolver::authorizations_from_runtime_bindings(&bindings);
        let plans = materialize_with_output(
            &intent,
            &devs,
            MaterializeMode::Diagnostic,
            &authorizations,
            None,
            &cfg,
        )
        .expect("双设备物化");
        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].outputs.len(), 1, "首设备物化输出");
        assert!(
            plans[1].outputs.is_empty(),
            "次设备强制纯分析（单输出承诺）"
        );
    }

    #[test]
    fn pipeline_rt_01_sink_kind_rtmp_materializes_with_url() {
        let cfg = output_cfg_with(None, Some("rtmp://127.0.0.1:1935/live/p1a"), 6000, 128_000);
        let plans = plans_for_sink("rtmp", &cfg).expect("rtmp + url ⇒ 物化");
        assert_eq!(
            plans[0].outputs,
            vec![OutputPlan {
                kind: OutputKind::Rtmp,
                video_bitrate_kbps: 6000,
                audio_bitrate_bps: 128_000,
                target: "rtmp://127.0.0.1:1935/live/p1a".into(),
            }]
        );
    }

    #[test]
    fn pipeline_rt_01_sink_target_missing_degrades_to_analysis() {
        // fail-soft: kind 声明输出但目标 env 缺失 ⇒ 无输出段（部署态, 非契约违约）。
        let cfg = output_cfg_with(None, None, 6000, 128_000);
        let plans = plans_for_sink("rtmp", &cfg).expect("缺目标不报错");
        assert!(plans[0].outputs.is_empty(), "降级纯分析");
        let plans = plans_for_sink("hls", &cfg).expect("缺目标不报错");
        assert!(plans[0].outputs.is_empty(), "降级纯分析");
    }

    #[test]
    fn pipeline_rt_01_sink_appsink_stays_analysis() {
        let cfg = output_cfg_with(Some("/tmp/x"), Some("rtmp://x/live"), 6000, 128_000);
        let plans = plans_for_sink("appsink", &cfg).expect("appsink 合法");
        assert!(plans[0].outputs.is_empty(), "appsink = 纯分析（现行为）");
    }

    #[test]
    fn pipeline_rt_01_sink_unknown_kind_rejected() {
        let cfg = output_cfg_with(None, None, 6000, 128_000);
        let err = plans_for_sink("bogus", &cfg).expect_err("未知 kind 必须 fail-closed");
        assert!(
            matches!(err, PipelineError::IdentityUnresolved(_)) || err.to_string().contains("sink"),
            "词表第一次有牙齿: {err:?}"
        );
    }

    #[test]
    fn pipeline_rt_01_sink_kind_vocabulary_snapshot() {
        // 词表快照: appsink/hls/rtmp 三词受纳, 其余拒绝（契约词锁定）。
        let cfg = output_cfg_with(Some("/tmp/h"), Some("rtmp://h/l"), 6000, 128_000);
        for ok in ["appsink", "hls", "rtmp"] {
            assert!(plans_for_sink(ok, &cfg).is_ok(), "受纳词表: {ok}");
        }
        for bad in ["", "file", "rtsp", "hls2", "RTMP"] {
            assert!(plans_for_sink(bad, &cfg).is_err(), "词表外拒绝: {bad:?}");
        }
    }

    #[test]
    fn pipeline_rt_01_output_bitrate_env_passthrough() {
        let cfg = output_cfg_with(None, Some("rtmp://h/l"), 4500, 96_000);
        let plans = plans_for_sink("rtmp", &cfg).expect("物化");
        assert_eq!(plans[0].outputs[0].video_bitrate_kbps, 4500);
        assert_eq!(plans[0].outputs[0].audio_bitrate_bps, 96_000);
    }

    #[test]
    fn pipeline_rt_01_output_launch_empty_when_no_outputs() {
        let plan = PipelinePlan {
            outputs: Vec::new(),
            ..analysis_only_plan()
        };
        assert_eq!(
            plan.output_launch("VSRC", "ASRC"),
            "",
            "无输出 ⇒ 空 launch 段（controller 走今日串）"
        );
    }

    fn analysis_only_plan() -> PipelinePlan {
        PipelinePlan {
            source: SourcePlan::Device {
                device_id: "d".into(),
                connector: None,
                binding_class: SourceBindingClass::SelfTest,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        }
    }

    fn plan_with_output(out: OutputPlan) -> PipelinePlan {
        PipelinePlan {
            outputs: vec![out],
            ..analysis_only_plan()
        }
    }

    #[test]
    fn pr_stab_01_observer_queue_is_bounded_non_backpressure() {
        assert_eq!(
            OBSERVER_QUEUE,
            "queue max-size-buffers=1 max-size-bytes=0 max-size-time=0 leaky=downstream"
        );
    }

    #[test]
    fn pipeline_rt_01_output_launch_hls_shape() {
        let plan = plan_with_output(OutputPlan {
            kind: OutputKind::Hls,
            video_bitrate_kbps: 6000,
            audio_bitrate_bps: 128_000,
            target: "/tmp/p1a-hls".into(),
        });
        let launch = plan.output_launch(
            "decklinkvideosrc device-number=0",
            "decklinkaudiosrc device-number=0",
        );
        // 分析分支红线: appsink 元素串与 async=false 语义逐字符保留。
        assert!(
            launch.contains(&format!(
                "v. ! {OBSERVER_QUEUE} ! appsink name=videosink async=false"
            )),
            "{launch}"
        );
        assert!(
            launch.contains(&format!(
                "a. ! {OBSERVER_QUEUE} ! appsink name=audiosink async=false"
            )),
            "{launch}"
        );
        // tee 双分支骨架。
        assert!(launch.contains("video/x-raw ! tee name=v"), "{launch}");
        assert!(launch.contains("audio/x-raw ! tee name=a"), "{launch}");
        // 编码分支（openh264enc = probe 终裁: 零 caps 稳定 + Constrained Baseline yuv420p
        // 4:2:0 浏览器最大兼容; bitrate 单位 bps。hlssink2 命名 request pad——内部自带 mux）。
        assert!(
            launch.contains(
                "v. ! queue ! videoconvert ! openh264enc bitrate=6000000 gop-size=50 min-force-key-unit-interval=2000000000 ! h264parse ! out.video"
            ),
            "{launch}"
        );
        assert!(
            launch.contains(
                "a. ! queue ! audioconvert ! avenc_aac bitrate=128000 ! aacparse ! out.audio"
            ),
            "{launch}"
        );
        // HLS 落盘（hlssink2 属性 = 盒上 probe 实证面）。
        assert!(
            launch.contains(
                "hlssink2 name=out playlist-location=/tmp/p1a-hls/index.m3u8 location=/tmp/p1a-hls/seg%05d.ts target-duration=2 max-files=10 playlist-length=5 send-keyframe-requests=true"
            ),
            "{launch}"
        );
        assert!(
            !launch.contains("mpegtsmux"),
            "hlssink2 内部 mux——外置 mpegtsmux 属接线错误: {launch}"
        );
        assert!(
            launch.starts_with("decklinkvideosrc device-number=0 ! "),
            "src 前缀由参数注入: {launch}"
        );
    }

    #[test]
    fn pipeline_rt_01_output_launch_rtmp_shape() {
        let plan = plan_with_output(OutputPlan {
            kind: OutputKind::Rtmp,
            video_bitrate_kbps: 6000,
            audio_bitrate_bps: 128_000,
            target: "rtmp://127.0.0.1:1935/live/p1a".into(),
        });
        let launch = plan.output_launch(
            "decklinkvideosrc device-number=0",
            "decklinkaudiosrc device-number=0",
        );
        assert!(
            launch.contains(
                "flvmux name=mux streamable=true ! rtmp2sink location=\"rtmp://127.0.0.1:1935/live/p1a\" timeout=5 sync=false"
            ),
            "{launch}"
        );
        assert!(
            !launch.contains("hlssink2"),
            "rtmp 串不得混入 hls sink: {launch}"
        );
    }

    #[test]
    fn pipeline_rt_01_output_launch_bitrate_injected() {
        let plan = plan_with_output(OutputPlan {
            kind: OutputKind::Hls,
            video_bitrate_kbps: 4500,
            audio_bitrate_bps: 96_000,
            target: "/tmp/h".into(),
        });
        let launch = plan.output_launch("V", "A");
        assert!(
            launch.contains("openh264enc bitrate=4500000 gop-size=50"),
            "{launch}"
        );
        assert!(launch.contains("avenc_aac bitrate=96000"), "{launch}");
        assert!(!launch.contains("bitrate=6000000"), "{launch}");
    }

    #[test]
    fn pipeline_rt_01_switch_mode_wire_compat_anchor() {
        // A2-1 wire 兼容锚: 类型化后序列化值不变（"FRAME_SWITCH" 在 JSON 中逐字保留）。
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: "d".into(),
                connector: None,
                binding_class: SourceBindingClass::SelfTest,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let json = serde_json::to_value(&plan).expect("serialize");
        assert_eq!(
            json.get("switch_mode").and_then(|v| v.as_str()),
            Some("FRAME_SWITCH"),
            "wire 值不变（V0.2 §1.17 词表名）: {json}"
        );
        let back: PipelinePlan = serde_json::from_value(json).expect("roundtrip");
        assert_eq!(back.switch_mode, crate::program::SwitchPolicy::FrameSwitch);
        // 反序列化未知串 fail-closed（与 parse 同牙齿）。
        let bad = serde_json::to_string(&plan)
            .expect("ser")
            .replace("\"FRAME_SWITCH\"", "\"SWITCH\"");
        assert!(serde_json::from_str::<PipelinePlan>(&bad).is_err());
    }

    #[test]
    fn src_props_sdi_uses_connection_sdi() {
        let device_id = Uuid::new_v4();
        let bindings = runtime_bindings(device_id, 2, None);
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: device_id.to_string(),
                connector: Some(ConnectorType::Sdi),
                binding_class: SourceBindingClass::Resolved,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let json = serde_json::to_value(&plan).expect("serialize canonical plan");
        let source = json
            .get("source")
            .and_then(|v| v.as_object())
            .expect("source object");
        for forbidden in [
            "device_number",
            "provider_persistent_id",
            "persistent_id",
            "gstreamer",
        ] {
            assert!(
                !source.contains_key(forbidden),
                "canonical source leaked {forbidden}: {json}"
            );
        }
        let (v, a) = src_props(&plan, &bindings).expect("src_props");
        assert!(
            v.contains("decklinkvideosrc device-number=2 connection=sdi"),
            "video={v}"
        );
        assert!(a.contains("decklinkaudiosrc device-number=2"), "audio={a}");
        assert!(!a.contains("connection"), "audio 不得含 connection: {a}");
    }

    #[test]
    fn src_props_optical_uses_connection_optical_sdi() {
        let device_id = Uuid::new_v4();
        let bindings = runtime_bindings(device_id, 3, None);
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: device_id.to_string(),
                connector: Some(ConnectorType::Optical),
                binding_class: SourceBindingClass::Resolved,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let (v, _) = src_props(&plan, &bindings).expect("src_props");
        assert!(
            v.contains("connection=optical-sdi"),
            "video={v} (不得 optical)"
        );
    }

    #[test]
    fn src_props_unknown_has_no_connection() {
        let device_id = Uuid::new_v4();
        let bindings = runtime_bindings(device_id, 4, None);
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: device_id.to_string(),
                connector: Some(ConnectorType::Unknown),
                binding_class: SourceBindingClass::Resolved,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let (v, _) = src_props(&plan, &bindings).expect("src_props");
        assert!(
            !v.contains("connection"),
            "Unknown 不得显式 connection: {v}"
        );
    }

    #[test]
    fn materialize_persistent_id_without_evidence_rejected_both_modes() {
        // 02-I 前置（第十七轮 §七①）: PersistentId 档位但无 binding / 无 persistent_id
        // ⇒ IdentityUnresolved（生产/诊断一致）, 绝不物化 persistent-id=0。
        let dev = dev_handle(IdentityStrength::PersistentId);
        let did = dev.device_id.to_string();
        let devices = vec![dev];
        let intent = intent_with_sink(&did, "appsink");
        let cfg = output_cfg_with(None, None, 6000, 128_000);
        // 无 binding:
        for mode in [MaterializeMode::Production, MaterializeMode::Diagnostic] {
            let err = materialize_with_output(
                &intent,
                &devices,
                mode,
                &std::collections::HashMap::new(),
                None,
                &cfg,
            )
            .expect_err("无 binding 的 PersistentId 档必须拒绝");
            assert!(
                matches!(err, PipelineError::IdentityUnresolved(_))
                    && err.to_string().contains("persistent authorization"),
                "拒绝信息必须锚定缺失的中性持久授权: {err:?}"
            );
        }
        // binding 在但 persistent_id=None（证据断链）:
        let mut bindings = std::collections::HashMap::new();
        bindings.insert(
            devices[0].device_id,
            ResolvedDeviceBinding {
                device_number: 3,
                hw_serial_number: None,
                persistent_id: None,
                confidence: Confidence::High,
                match_kind: ResolverMatch::ManifestVerified,
            },
        );
        let authorizations = crate::resolver::authorizations_from_runtime_bindings(&bindings);
        for mode in [MaterializeMode::Production, MaterializeMode::Diagnostic] {
            assert!(
                materialize_with_output(&intent, &devices, mode, &authorizations, None, &cfg)
                    .is_err(),
                "persistent_id=None 同样拒绝 ({mode:?})"
            );
        }
    }

    #[test]
    fn materialize_persistent_id_with_evidence_uses_canonical() {
        // 正控制: binding.persistent_id=Some → PersistentIdCanonical + launch 串
        // persistent-id=<id>（unwrap_or(0) 影子路径已封死）。
        let dev = dev_handle(IdentityStrength::PersistentId);
        let did = dev.device_id.to_string();
        let devices = vec![dev];
        let mut bindings = std::collections::HashMap::new();
        bindings.insert(
            devices[0].device_id,
            ResolvedDeviceBinding {
                device_number: 0,
                hw_serial_number: None,
                persistent_id: Some(77),
                confidence: Confidence::High,
                match_kind: ResolverMatch::PersistentIdExact,
            },
        );
        let authorizations = crate::resolver::authorizations_from_runtime_bindings(&bindings);
        let plans = materialize_with_output(
            &intent_with_sink(&did, "appsink"),
            &devices,
            MaterializeMode::Production,
            &authorizations,
            None,
            &output_cfg_with(None, None, 6000, 128_000),
        )
        .expect("证据齐备的 PersistentId 档应物化");
        assert_eq!(
            plans[0].source.binding_class(),
            SourceBindingClass::Persistent
        );
        let (v, a) = src_props(&plans[0], &bindings).expect("src_props");
        assert!(v.contains("persistent-id=77"), "video={v}");
        assert!(a.contains("persistent-id=77"), "audio={a}");
        assert!(!v.contains("persistent-id=0"), "绝不盲 0: {v}");
    }

    #[test]
    fn src_props_persistent_id_canonical_without_evidence_rejected() {
        let device_id = Uuid::new_v4();
        let bindings = runtime_bindings(device_id, 0, None);
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: device_id.to_string(),
                connector: None,
                binding_class: SourceBindingClass::Persistent,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let err = src_props(&plan, &bindings).expect_err("persistent_id=None 必须拒绝");
        assert!(
            matches!(err, PipelineError::IdentityUnresolved(_))
                && err.to_string().contains("persistent_id"),
            "{err:?}"
        );
    }

    #[test]
    fn src_props_resolved_missing_binding_fails_closed() {
        let device_id = Uuid::new_v4();
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: device_id.to_string(),
                connector: Some(ConnectorType::Sdi),
                binding_class: SourceBindingClass::Resolved,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let err = src_props(&plan, &std::collections::HashMap::new())
            .expect_err("Resolved source 缺 RuntimeBinding 必须 fail-closed");
        assert!(
            matches!(err, PipelineError::IdentityUnresolved(_)),
            "{err:?}"
        );
        assert!(err.to_string().contains("RuntimeBinding"), "{err:?}");
    }

    #[test]
    fn src_props_diagnostic_fallback_uses_binding_then_device_zero_only_when_absent() {
        let device_id = Uuid::new_v4();
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: device_id.to_string(),
                connector: Some(ConnectorType::Sdi),
                binding_class: SourceBindingClass::DiagnosticFallback,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let bindings = runtime_bindings(device_id, 7, None);
        let (bound_v, _) = src_props(&plan, &bindings).expect("diagnostic resolved binding");
        assert!(bound_v.contains("device-number=7"), "{bound_v}");

        let (fallback_v, _) =
            src_props(&plan, &std::collections::HashMap::new()).expect("diagnostic fallback");
        assert!(fallback_v.contains("device-number=0"), "{fallback_v}");
    }

    #[test]
    fn src_props_diagnostic_fallback_rejects_noncanonical_device_id() {
        let plan = PipelinePlan {
            source: SourcePlan::Device {
                device_id: "not-a-canonical-uuid".into(),
                connector: None,
                binding_class: SourceBindingClass::DiagnosticFallback,
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: Vec::new(),
        };
        let err = src_props(&plan, &std::collections::HashMap::new())
            .expect_err("非法 canonical device_id 不得退化到 device 0");
        assert!(
            matches!(err, PipelineError::IdentityUnresolved(_)),
            "{err:?}"
        );
        assert!(err.to_string().contains("device_id"), "{err:?}");
    }

    #[test]
    fn materialize_rejects_explicit_port_id_missing_in_registry_production() {
        // TDD(RED→GREEN): Control Plane 显式 port_id 但 Discovery 无匹配 ⇒ 生产失败闭合 (绝不静默回退 auto).
        let dev = dev_handle(IdentityStrength::DeviceHandle);
        let dev_id = dev.device_id;
        let missing_pid = Uuid::new_v4();
        let intent = intent_with_port(&dev_id.to_string(), Some(&missing_pid.to_string()));
        let mut bindings = std::collections::HashMap::new();
        bindings.insert(
            dev_id,
            ResolvedDeviceBinding {
                device_number: 2,
                hw_serial_number: None,
                persistent_id: None,
                confidence: Confidence::High,
                match_kind: ResolverMatch::SerialExact,
            },
        );
        let other = Uuid::new_v4();
        let registry = registry_with_port(dev_id, other, ConnectorType::Sdi);
        let authorizations = crate::resolver::authorizations_from_runtime_bindings(&bindings);
        let res = materialize(
            &intent,
            &[dev],
            MaterializeMode::Production,
            &authorizations,
            Some(&registry),
        );
        assert!(res.is_err(), "显式 port_id 缺失须被生产拒绝: {res:?}");
    }

    #[test]
    fn materialize_resolves_explicit_port_id_in_registry() {
        // 回归: 显式 port_id 匹配 Discovery ⇒ Ok 且 connector 取该端口 (精确绑定, 不猜).
        let dev = dev_handle(IdentityStrength::DeviceHandle);
        let dev_id = dev.device_id;
        let pid = Uuid::new_v4();
        let intent = intent_with_port(&dev_id.to_string(), Some(&pid.to_string()));
        let mut bindings = std::collections::HashMap::new();
        bindings.insert(
            dev_id,
            ResolvedDeviceBinding {
                device_number: 2,
                hw_serial_number: None,
                persistent_id: None,
                confidence: Confidence::High,
                match_kind: ResolverMatch::SerialExact,
            },
        );
        let registry = registry_with_port(dev_id, pid, ConnectorType::Sdi);
        let authorizations = crate::resolver::authorizations_from_runtime_bindings(&bindings);
        let plans = materialize(
            &intent,
            &[dev],
            MaterializeMode::Production,
            &authorizations,
            Some(&registry),
        )
        .unwrap();
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].source.connector(), Some(ConnectorType::Sdi));
    }

    #[test]
    fn materialize_rejects_unresolved_identity_production() {
        // 回归: 合成身份 + 无 Resolver 绑定 ⇒ 生产拒绝 (绝不盲开 device 0).
        let dev = dev_handle(IdentityStrength::Enumeration);
        let dev_id = dev.device_id;
        let intent = intent_with_port(&dev_id.to_string(), None);
        let bindings = std::collections::HashMap::new();
        let registry = PortRegistry::default();
        let res = materialize(
            &intent,
            &[dev],
            MaterializeMode::Production,
            &bindings,
            Some(&registry),
        );
        assert!(res.is_err(), "未解析身份须被生产拒绝: {res:?}");
    }

    #[test]
    fn pts_state_starts_unknown() {
        let h = PipelineHealth::default();
        assert_eq!(h.video_pts_state, PtsMonotonicity::Unknown);
        assert_eq!(h.audio_pts_state, PtsMonotonicity::Unknown);
        assert!(!h.first_frame_ok());
    }

    #[test]
    fn first_video_pts_is_valid_monotonic() {
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        assert_eq!(h.video_pts_state, PtsMonotonicity::ValidMonotonic);
        // first_pts 由回调单独维护, 本方法只推进状态; 此处未设 first_pts.
        assert!(!h.first_frame_ok());
    }

    #[test]
    fn video_regression_becomes_non_monotonic() {
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        h.observe_video_pts(1001);
        h.observe_video_pts(999); // 回退
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
    }

    #[test]
    fn non_monotonic_is_sticky() {
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        h.observe_video_pts(500); // 回退 -> NonMonotonic
        h.observe_video_pts(2000); // 后续正常帧不得自动恢复
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
    }

    #[test]
    fn equal_pts_keeps_valid_monotonic() {
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        h.observe_video_pts(1000); // pts == last, 非严格递增但非回退
        assert_eq!(h.video_pts_state, PtsMonotonicity::ValidMonotonic);
    }

    #[test]
    fn video_audio_states_independent() {
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        h.observe_video_pts(500); // video 坏
        h.observe_audio_pts(1000);
        h.observe_audio_pts(1001); // audio 好
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
        assert_eq!(h.audio_pts_state, PtsMonotonicity::ValidMonotonic);
    }

    // ── C-TIMELINE-01 §6: 四态纪律（第三十一轮终裁 §十）────────────────

    #[test]
    fn declared_boundary_observation_sets_discontinuity_declared() {
        // 已声明边界 + expected transition（映射后非回退）→
        // DiscontinuityDeclared（合法边界事实）; 首观测经 declared 路径亦同。
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        h.observe_video_pts(1040);
        h.observe_video_pts_declared(1080); // 声明边界帧, 非回退
        assert_eq!(h.video_pts_state, PtsMonotonicity::DiscontinuityDeclared);
        // 后续普通单调帧保持 DiscontinuityDeclared（边界事实保留, 不洗）。
        h.observe_video_pts(1120);
        assert_eq!(h.video_pts_state, PtsMonotonicity::DiscontinuityDeclared);
        // 首观测即声明边界（recover 后重建场景）。
        let mut h2 = PipelineHealth::default();
        h2.observe_audio_pts_declared(1000);
        assert_eq!(h2.audio_pts_state, PtsMonotonicity::DiscontinuityDeclared);
    }

    #[test]
    fn declared_boundary_does_not_wash_backward_regression() {
        // 声明不豁免连续性违反: declared 路径观测到回退 → NonMonotonic
        // sticky（映射的职责就是连续; 禁以声明洗回退）。
        let mut h = PipelineHealth::default();
        h.observe_video_pts(1000);
        h.observe_video_pts_declared(900); // 声明边界但 PTS 回退
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
        h.observe_video_pts_declared(5000); // 后续声明帧也不洗回
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
        h.observe_video_pts(6000); // 普通帧同样不洗
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
    }

    #[test]
    fn timeline_policy_replaces_bare_bool_and_locks_wire() {
        // IMP-1: 裸 bool 删除——TimelinePolicy 词表 + wire 值锁
        // （snake_case: source_native/program_timeline_mapped）; PipelinePlan
        // 键集含 timeline_policy 且不含 normalize（字段蔓延防线）。
        let plan = PipelinePlan::self_test();
        let json = serde_json::to_value(&plan).expect("序列化");
        let keys = json.as_object().expect("对象");
        assert!(keys.contains_key("timeline_policy"));
        assert!(!keys.contains_key("normalize"), "裸 bool 已删除（IMP-1）");
        assert_eq!(json["timeline_policy"], "program_timeline_mapped");
        assert_eq!(
            serde_json::to_value(TimelinePolicy::SourceNative).expect("序列化"),
            "source_native"
        );
        // 声明面往返（无 serde(default)——字段必显）。
        let round: PipelinePlan = serde_json::from_value(json).expect("反序列化");
        assert_eq!(round.timeline_policy, TimelinePolicy::ProgramTimelineMapped);
    }

    #[test]
    fn first_frame_ok_requires_both_valid() {
        let mut h = PipelineHealth {
            video_first_pts: Some(1000),
            audio_first_pts: Some(1000),
            ..PipelineHealth::default()
        };
        // 仅 video 有效 -> 未过.
        h.observe_video_pts(1000);
        h.observe_audio_pts(1000);
        assert!(h.first_frame_ok());
        // 任一回退 -> 不过.
        h.observe_audio_pts(999);
        assert!(!h.first_frame_ok());
    }

    // ── p06-hi MEDIA-RT-01 acceptance gate ─────────────────────────────────────────
    // 门禁不变量: (1) Default = absence-of-evidence, 绝不默认假过 (P1-2);
    // (2) PTS 三态区分 Unknown 与 NonMonotonic, 只在真实回退时置 false;
    // (3) B/C 子项语义: B 为帧证据, C 为测量窗口 (仅"无 error"不够);
    // (4) self_test plan 是 canonical 自测源 (device_number=0 为自测哨兵, 非真实卡默认).

    #[test]
    fn media_rt_01_health_default_is_absence_not_pass() {
        let h = PipelineHealth::default();
        assert_eq!(h.video_pts_state, PtsMonotonicity::Unknown);
        assert_eq!(h.audio_pts_state, PtsMonotonicity::Unknown);
        assert!(!h.playing);
        assert!(h.video_first_pts.is_none());
        // 未观测 = 未通过: pass() / first_frame_ok() 默认必须为 false, 绝不默认假过.
        assert!(!h.pass());
        assert!(!h.first_frame_ok());
        // acceptance 正向成就项默认全 false (P1-2): absence-of-evidence ≠ PASS.
        let a = MediaRt01Acceptance::default();
        assert!(!a.a_pass() && !a.b_pass() && !a.c_pass());
    }

    #[test]
    fn media_rt_01_pts_only_false_on_real_regression() {
        let mut h = PipelineHealth::default();
        // Unknown ≠ NonMonotonic: 未收帧前状态为 Unknown, 不得当作 "置 false" 的失败证据.
        assert_eq!(h.video_pts_state, PtsMonotonicity::Unknown);
        h.observe_video_pts(1000);
        h.observe_video_pts(2000);
        assert_eq!(h.video_pts_state, PtsMonotonicity::ValidMonotonic);
        // 只在真实回退时置 false: NonMonotonic (sticky, 不自动恢复).
        h.observe_video_pts(1500);
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
        h.observe_video_pts(3000);
        assert_eq!(h.video_pts_state, PtsMonotonicity::NonMonotonic);
    }

    #[test]
    fn media_rt_01_b_and_c_pass_semantics() {
        // B: 首视频帧 + 首音频帧 + 有效 PTS + PTS 单调 — 四项全真才 pass.
        let b_ok = MediaRt01Acceptance {
            b1_first_video: true,
            b2_first_audio: true,
            b3_valid_pts: true,
            b4_pts_monotonic: true,
            ..MediaRt01Acceptance::default()
        };
        assert!(b_ok.b_pass());
        // C: 测量型 — 观测窗口未达标即不过, 即使当前无任何错误.
        assert!(!b_ok.c_pass());
        // 窗口达标 + 无致命项 → c_pass.
        let c_ok = MediaRt01Acceptance {
            b4_pts_monotonic: true,
            c_observed_ms: Some(10_000),
            c1_no_unexpected_eos: true,
            c2_no_pipeline_error: true,
            c3_no_repeated_reneg: true,
            c4_counters_continue: true,
            ..MediaRt01Acceptance::default()
        };
        assert!(c_ok.c_pass());
    }

    #[test]
    fn rf_src_rtmp_materializes_without_device_registry() {
        let source_id = crate::source::NetworkSourceId(Uuid::new_v4());
        let endpoint = crate::source::NetworkEndpoint {
            protocol: crate::source::NetworkProtocol::Rtmp,
            host: "127.0.0.1".into(),
            port: 1935,
            path: "/live/source".into(),
        };
        let intent = GraphRuntimeIntent {
            version: "1.0".into(),
            devices: vec![DeviceIntent {
                device_id: "network-node".into(),
                role: "CAPTURE".into(),
                pipeline: PipelineIntent {
                    source: SourceIntent::rtmp(source_id, endpoint.clone()),
                    sink: SinkIntent {
                        kind: "appsink".into(),
                    },
                },
            }],
        };
        let plans = materialize_with_output(
            &intent,
            &[],
            MaterializeMode::Production,
            &std::collections::HashMap::new(),
            None,
            &output_cfg_with(None, None, 6000, 128_000),
        )
        .expect("network source does not require a hardware registry");
        assert!(matches!(
            &plans[0].source,
            SourcePlan::Network {
                source_id: actual,
                endpoint: actual_endpoint,
            } if *actual == source_id && actual_endpoint == &endpoint
        ));
    }

    // ── RF-SRC-RTMP-02 TG-3: materialize widens through D2 canonical ───────────

    fn rtmp_lan_intent() -> GraphRuntimeIntent {
        let source_id = crate::source::NetworkSourceId(Uuid::new_v4());
        let endpoint = crate::source::NetworkEndpoint {
            protocol: crate::source::NetworkProtocol::Rtmp,
            host: "10.30.15.10".into(),
            port: 19350,
            path: "/live/source".into(),
        };
        GraphRuntimeIntent {
            version: "1.0".into(),
            devices: vec![DeviceIntent {
                device_id: "network-node".into(),
                role: "CAPTURE".into(),
                pipeline: PipelineIntent {
                    source: SourceIntent::rtmp(source_id, endpoint),
                    sink: SinkIntent {
                        kind: "appsink".into(),
                    },
                },
            }],
        }
    }

    #[test]
    fn rf_src_rtmp_02_tg3_production_materializes_canonical_lan() {
        // Production: eligible LAN endpoint materializes (admission happened
        // at the Session layer); plan keeps the wire endpoint shape.
        let plans = materialize_with_output(
            &rtmp_lan_intent(),
            &[],
            MaterializeMode::Production,
            &std::collections::HashMap::new(),
            None,
            &output_cfg_with(None, None, 6000, 128_000),
        )
        .expect("production LAN endpoint materializes through D2 canonical");
        assert!(matches!(&plans[0].source, SourcePlan::Network { .. }));
    }

    #[test]
    fn rf_src_rtmp_02_tg3_diagnostic_fixtures_stay_loopback() {
        // Diagnostic keeps the loopback fixture boundary (plan D2).
        let err = match materialize_with_output(
            &rtmp_lan_intent(),
            &[],
            MaterializeMode::Diagnostic,
            &std::collections::HashMap::new(),
            None,
            &output_cfg_with(None, None, 6000, 128_000),
        ) {
            Ok(_) => panic!("diagnostic LAN endpoint must reject"),
            Err(e) => e,
        };
        assert!(
            matches!(err, PipelineError::IdentityUnresolved(_)),
            "{err:?}"
        );

        // loopback regression: the existing Diagnostic loopback fixture path
        // still materializes unchanged.
        let source_id = crate::source::NetworkSourceId(Uuid::new_v4());
        let endpoint = crate::source::NetworkEndpoint {
            protocol: crate::source::NetworkProtocol::Rtmp,
            host: "127.0.0.1".into(),
            port: 1935,
            path: "/live/source".into(),
        };
        let intent = GraphRuntimeIntent {
            version: "1.0".into(),
            devices: vec![DeviceIntent {
                device_id: "network-node".into(),
                role: "CAPTURE".into(),
                pipeline: PipelineIntent {
                    source: SourceIntent::rtmp(source_id, endpoint.clone()),
                    sink: SinkIntent {
                        kind: "appsink".into(),
                    },
                },
            }],
        };
        let plans = materialize_with_output(
            &intent,
            &[],
            MaterializeMode::Diagnostic,
            &std::collections::HashMap::new(),
            None,
            &output_cfg_with(None, None, 6000, 128_000),
        )
        .expect("diagnostic loopback fixture regression");
        assert!(matches!(&plans[0].source, SourcePlan::Network { .. }));
    }

    #[test]
    fn rf_src_rtmp_02_tg3_non_canonical_wire_endpoint_rejects_in_both_modes() {
        let source_id = crate::source::NetworkSourceId(Uuid::new_v4());
        let endpoint = crate::source::NetworkEndpoint {
            protocol: crate::source::NetworkProtocol::Rtmp,
            host: "010.030.015.010".into(), // leading-zero spelling
            port: 19350,
            path: "/live/source".into(),
        };
        let intent = GraphRuntimeIntent {
            version: "1.0".into(),
            devices: vec![DeviceIntent {
                device_id: "network-node".into(),
                role: "CAPTURE".into(),
                pipeline: PipelineIntent {
                    source: SourceIntent::rtmp(source_id, endpoint),
                    sink: SinkIntent {
                        kind: "appsink".into(),
                    },
                },
            }],
        };
        for mode in [MaterializeMode::Production, MaterializeMode::Diagnostic] {
            assert!(
                materialize_with_output(
                    &intent,
                    &[],
                    mode,
                    &std::collections::HashMap::new(),
                    None,
                    &output_cfg_with(None, None, 6000, 128_000),
                )
                .is_err(),
                "non-canonical endpoint must reject in {mode:?}"
            );
        }
    }

    #[test]
    fn rf_src_rtmp_02_tg5_redacted_debug_is_endpoint_free_and_stable() {
        // D9: identity-hash input rendering carries no host/port/path/URL
        // text and does not depend on endpoint content.
        let source_id = crate::source::NetworkSourceId(Uuid::new_v4());
        let endpoint = |port: u16| crate::source::NetworkEndpoint {
            protocol: crate::source::NetworkProtocol::Rtmp,
            host: "10.30.15.10".into(),
            port,
            path: "/live/source".into(),
        };
        let plan = PipelinePlan {
            source: SourcePlan::Network {
                source_id,
                endpoint: endpoint(19350),
            },
            timeline_policy: TimelinePolicy::ProgramTimelineMapped,
            switch_mode: crate::program::SwitchPolicy::FrameSwitch,
            outputs: vec![OutputPlan {
                kind: OutputKind::Rtmp,
                video_bitrate_kbps: 6000,
                audio_bitrate_bps: 128_000,
                target: "rtmp://10.30.15.10:19351/live/out".into(),
            }],
        };
        let rendered = plan.redacted_debug();
        for literal in [
            "10.30.15.10",
            "19350",
            "/live/source",
            "rtmp://",
            "/live/out",
        ] {
            assert!(!rendered.contains(literal), "leak {literal}: {rendered}");
        }
        // endpoint/output-target independence
        let same_canonical_semantics = PipelinePlan {
            source: SourcePlan::Network {
                source_id,
                endpoint: endpoint(19351),
            },
            outputs: vec![OutputPlan {
                kind: OutputKind::Rtmp,
                video_bitrate_kbps: 6000,
                audio_bitrate_bps: 128_000,
                target: "/tmp/other-dir".into(),
            }],
            ..plan.clone()
        };
        assert_eq!(rendered, same_canonical_semantics.redacted_debug());
    }

    #[test]
    fn media_rt_01_self_test_plan_is_canonical() {
        let plan = PipelinePlan::self_test();
        assert!(matches!(plan.source, SourcePlan::SelfTest));
        assert_eq!(plan.source.binding_class(), SourceBindingClass::SelfTest);
        assert_eq!(
            plan.timeline_policy,
            TimelinePolicy::ProgramTimelineMapped,
            "原 normalize:true 声明意图迁移（IMP-1）"
        );
        assert_eq!(plan.switch_mode, crate::program::SwitchPolicy::FrameSwitch);
        // SelfTest canonical plan 不携带任何 Backend runtime address。
    }

    // ── p06-hi ARCH-BACKEND-01 gate (Test C 延伸到 Backend 侧) ─────────────────────
    // 门禁不变量: `MediaBackend` 实现以 trait-object 级可互换 — Domain/Graph/Session/
    // Supervisor/Health 只依赖 `dyn MediaBackend` 与 canonical `PipelinePlan`,
    // 不依赖具体 backend 类型; canonical plan 是不可变输入, backend 不得回写.

    #[cfg(feature = "mock")]
    #[test]
    fn arch_backend_01_mock_backend_implements_media_backend() {
        let backend: Box<dyn crate::contracts::backend::MediaBackend> =
            Box::new(crate::adapters::mock::MockBackend);
        let plan = PipelinePlan::self_test();
        let handle = backend
            .instantiate(&plan)
            .expect("MockBackend instantiate 应接受 canonical plan");
        backend.start(&handle).expect("MockBackend start 应成功");
        backend
            .recover(&handle)
            .expect("MockBackend recover 应成功");
        backend.stop(&handle).expect("MockBackend stop 应成功");
        assert!(backend.observe(&handle).is_empty());
        // P1-1: 句柄与生产同源分配 (NEXT_PIPELINE_ID, 从 1 起), 绝不为 0 哨兵.
        assert_ne!(handle, PipelineHandle(0));
        // canonical 字段未被 backend 回写.
        assert_eq!(plan.source.binding_class(), SourceBindingClass::SelfTest);
        assert_eq!(plan.timeline_policy, TimelinePolicy::ProgramTimelineMapped);
    }

    #[cfg(feature = "gstreamer-backend")]
    #[test]
    fn arch_backend_01_gstreamer_backend_implements_media_backend() {
        // 同一 trait 对象 + 同一 canonical plan: GStreamer Reference Backend 与 Mock
        // 在 SPI 层面可互换. prepare 构建 videotestsrc/audiotestsrc 管线 (无需硬件;
        // 该断言在 GStreamer 运行时构建下执行, CI 无 GStreamer 时仅 Mock 侧运行).
        let backend: Box<dyn crate::contracts::backend::MediaBackend> =
            Box::new(crate::adapters::gstreamer::GStreamerPipelineController::new());
        let plan = PipelinePlan::self_test();
        let handle = backend
            .instantiate(&plan)
            .expect("GStreamerBackend instantiate 应接受同一 canonical plan (self_test)");
        // 句柄为运行时实例标识, 不得与 Mock 固定哨兵冲突.
        assert_ne!(handle, PipelineHandle(0));
        // canonical 字段未被 backend 回写.
        assert_eq!(plan.source.binding_class(), SourceBindingClass::SelfTest);
        assert_eq!(plan.timeline_policy, TimelinePolicy::ProgramTimelineMapped);
    }
}
