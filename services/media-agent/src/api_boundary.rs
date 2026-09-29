//! Phase 0.7C-7: External API Foundation — **API Boundary Model + Idempotency 持久化契约**。
//!
//! 终审 0.7C-6 批准范围（**禁清单 11 项开工边界冻结**）:
//! - ❶ Axum/Hyper/Warp/Actix/gRPC ❷ HTTP listener ❸ REST route ❹ OpenAPI ❺ 数据库持久化
//! - ❻ 跨重启 Idempotency ❼ Event persistence ❽ Health Reducer 完整实现
//! - ❾ 修改 Command/Query/Event 内部契约 ❿ 内部 Rust DTO 直接作 API DTO
//! - ⓫ `ApiResponse<T>` 万能包装 ⓬ 新建第二套 Runtime State
//!
//! 本模块 = API Contract / Boundary Foundation（非 Web Server）。transport 实现属下一 change（std-only 纪律）。
//!
//! 设计原则：
//! - **API Resource Model 独立定义**（不绑回 Runtime 内部 enum；`to_api_*` 纯函数显式映射）
//! - **不暴露 Rust serde tag 习惯**（`verdict`/`retryable_failure` 等内部命名不出现在 JSON）
//! - **EventProjection ≠ CanonicalRuntimeState**（`ApiProjectionKind::EventProjectionSnapshot` 序列化字段守门）
//! - **Command/Query/Event 三平面分离**（各自独立 enum，不聚合"万能 ApiResult"）
//! - **Idempotency 持久化边界契约层**（仅契约冻结，无持久化实现——三选项对勘公开化）
//!
//! **API-BOUNDARY-01 白盒门禁**：本模块不得 `use` `backend` / `gstreamer` / `decklink` / `ffmpeg` / `pipeline` (impl) / `provider` (impl)。
//! 允许消费：`Canonical` types / `CanonicalRuntimeState` 子项 / `RuntimeQuery` 输出 / `CommandEnvelope/Outcome/Status/Rejection` / `IdempotentDispatch` / `ErrorClassification` / `EventProjection` —— 经 `to_api_*` 纯函数构造 API 模型。

#![allow(dead_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::event_projection::EventProjection;
use crate::runtime_state::{
    CanonicalRuntimeState, DeviceRuntimeState, PortRuntimeState, ResourceRuntimeState,
    SessionRuntimeState,
};

// === Query 平面：API 资源模型（独立定义） ====================================

/// API 设备资源。字段仅由 API 消费语义驱动 (0.7B 加严红线: 禁万能 struct)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiDevice {
    pub id: String,
    pub model: String,
    /// canonical binding_status 字符串化 (high/manifest_verified/...), **不暴露** Runtime BindingStatus enum。
    pub binding: Option<String>,
    pub capabilities: Option<Vec<ApiCapability>>,
}

/// API 能力项 — 字段由 DeviceCapabilitiesSummary 实际字段 (can_input/can_output/
/// input_ports/output_ports) 显式映射, 不暴露内部 CapabilityFlag enum。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiCapability {
    /// "supported" / "unsupported" / "unknown" — D6 三态字符串化。
    pub can_input: String,
    pub can_output: String,
    pub input_ports: Option<u32>,
    pub output_ports: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiPort {
    pub id: String,
    pub device_id: String,
    /// "input" / "output" / "bidirectional"。
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiResource {
    pub id: String,
    pub device_id: String,
    /// API 字符串 ("available"/"reserved"/"allocated"/"releasing"/"faulted") —
    /// **不绑回** `ResourceState` enum (终审 NOTE-3: API 资源模型独立)。
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiSession {
    pub id: String,
    /// SessionState 字符串化 ("reserved"/"running"/"paused"/"releasing"/"released"/"terminated")。
    pub state: String,
    /// SessionPhase 字符串化 ("requested"/"provisioning"/"binding"/"leased"/"starting"/"running"/"stopping"/"released"/"failed")。
    pub phase: String,
    /// P1b: 物化输出事实投影（空 = 纯分析/降级, 绝不虚报——P1a 物化回填语义的 wire 面）。
    pub outputs: Vec<String>,
    /// Alpha-1 (D10): 会话输入摘要 wire 投影（多输入可见性）。
    pub inputs: Vec<ApiInputSummary>,
}

/// Alpha-1: 会话输入摘要 API 模型（独立 DTO, 不绑回内部 SessionInput）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ApiInputSummary {
    pub id: String,
    pub handle: u64,
}

// 纯函数: Query 五资源转换 (CanonicalRuntimeState 子项 → API 模型)
// 输入是 canonical 公开 DTO (CanonicalRuntimeState 不绑 vendor), 输出是 API 独立 enum/字符串。
pub fn to_api_device(d: &DeviceRuntimeState) -> ApiDevice {
    ApiDevice {
        id: d.device_id.to_string(),
        model: d.model.clone(),
        binding: d
            .binding
            .as_ref()
            .map(|b| format!("{:?}", b).to_lowercase()),
        capabilities: None, // 全 capabilities 由 to_api_capabilities 单独产出
    }
}

pub fn to_api_port(p: &PortRuntimeState) -> ApiPort {
    ApiPort {
        id: p.port_id.to_string(),
        device_id: p.device_id.to_string(),
        direction: format!("{:?}", p.direction).to_lowercase(),
    }
}

pub fn to_api_resource(r: &ResourceRuntimeState) -> ApiResource {
    ApiResource {
        id: r.resource_id.to_string(),
        device_id: r.device_id.to_string(),
        state: format!("{:?}", r.state).to_lowercase(),
    }
}

pub fn to_api_session(s: &SessionRuntimeState) -> ApiSession {
    ApiSession {
        id: s.session_id.to_string(),
        state: format!("{:?}", s.state).to_lowercase(),
        phase: format!("{:?}", s.phase).to_lowercase(),
        outputs: s.outputs.clone(),
        inputs: s
            .inputs
            .iter()
            .map(|i| ApiInputSummary {
                id: i.device_id.clone(),
                handle: i.handle,
            })
            .collect(),
    }
}

pub fn to_api_capabilities(
    cs: &[(uuid::Uuid, crate::runtime_state::DeviceCapabilitiesSummary)],
) -> Vec<(String, ApiCapability)> {
    cs.iter()
        .map(|(id, cap)| {
            (
                id.to_string(),
                ApiCapability {
                    can_input: format!("{:?}", cap.can_input).to_lowercase(),
                    can_output: format!("{:?}", cap.can_output).to_lowercase(),
                    input_ports: cap.input_ports,
                    output_ports: cap.output_ports,
                },
            )
        })
        .collect()
}

/// 顶层 Query 响应:返回 CanonicalRuntimeState 的 API 视图。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiQuerySnapshot {
    pub devices: Vec<ApiDevice>,
    pub ports: Vec<ApiPort>,
    pub resources: Vec<ApiResource>,
    pub sessions: Vec<ApiSession>,
    pub capabilities: Vec<(String, ApiCapability)>,
    pub generated_at_ms: u64,
    /// D14: 观察信封 additive 投影 (wire 同名字段, 非破坏)。
    /// 有意**不带** `#[serde(default)]`: 本结构是响应模型, 无旧 JSON 反序列化消费方
    /// （与 CanonicalRuntimeState 的 additive 兼容义务不对称是设计决定）。
    pub observation_revision: u64,
    pub observation_lineage: uuid::Uuid,
    /// v0.2（R60 裁决③）: program_switch 顶层投影块——数据源唯一绑定
    /// `observe_execution`（Query Plane 事实回读; 不污染 sessions[]）。
    /// null = 无活跃执行平面/已 teardown（诚实缺席; 由 transport 组装处
    /// 合并——canonical 状态面不携带, to_api_query_snapshot 恒置 None）。
    pub program_switch: Option<ApiProgramSwitchState>,
}

/// v0.2: `program_switch` 投影块（program 观测面字段——observed 双平面
/// active/epoch/PTS 状态/帧计数）。API 字符串化**不绑回** Domain 枚举
/// （终审 NOTE-3: API 资源模型独立）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiProgramSwitchState {
    pub session_id: String,
    pub observed_active: Option<String>,
    pub video_active: Option<String>,
    pub audio_active: Option<String>,
    pub switch_epoch: u64,
    pub program_video_pts_state: String,
    pub program_audio_pts_state: String,
    pub program_video_frames: u64,
    pub program_audio_frames: u64,
    /// timeline 证据行摘要（observe_execution 第二分量）。
    pub timeline: ApiTimelineEvidence,
}

/// v0.2: timeline 证据行摘要 wire 投影（十键形状的观测子集——epoch/
/// 段世代/两平面连续性/声明态）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiTimelineEvidence {
    pub program_epoch: u64,
    pub source_id: Option<String>,
    pub segment_id: Option<u64>,
    pub discontinuity_state: String,
    pub video_continuity: String,
    pub audio_continuity: String,
    pub observed_at_ms: u64,
}

/// 纯函数: 枚举 → snake_case wire 字符串（serde 命名优先; 无 serde rename
/// 的 PascalCase 变体统一转 snake_case——多词变体不失下划线; 已 snake_case
/// 的原样通过）。
fn enum_tag<T: serde::Serialize + std::fmt::Debug>(v: &T) -> String {
    let raw = serde_json::to_value(v)
        .ok()
        .and_then(|x| x.as_str().map(str::to_owned))
        .unwrap_or_else(|| format!("{v:?}"));
    if !raw.chars().any(char::is_uppercase) {
        return raw;
    }
    let mut out = String::with_capacity(raw.len() + 4);
    for (i, ch) in raw.char_indices() {
        if ch.is_uppercase() {
            if i > 0 {
                out.push('_');
            }
            out.extend(ch.to_lowercase());
        } else {
            out.push(ch);
        }
    }
    out
}

/// 纯函数: `ProgramExecutionObservation` → `program_switch` 投影块
/// （v0.2 Query Plane 唯一数据源绑定; 缺席字段保持 Option 缺席——不伪造）。
pub fn to_api_program_switch(
    session_id: &crate::session::SessionId,
    obs: &crate::contracts::switch::ProgramExecutionObservation,
) -> ApiProgramSwitchState {
    let p = &obs.program;
    let t = &obs.timeline;
    ApiProgramSwitchState {
        session_id: session_id.0.to_string(),
        observed_active: p.observed_active.map(|u| u.to_string()),
        video_active: p.video_active.map(|u| u.to_string()),
        audio_active: p.audio_active.map(|u| u.to_string()),
        switch_epoch: p.switch_epoch,
        program_video_pts_state: enum_tag(&p.program_video_pts_state),
        program_audio_pts_state: enum_tag(&p.program_audio_pts_state),
        program_video_frames: p.program_video_frames,
        program_audio_frames: p.program_audio_frames,
        timeline: ApiTimelineEvidence {
            program_epoch: t.program_epoch.0,
            source_id: t.source_id.map(|u| u.to_string()),
            segment_id: t.segment_id.map(|s| s.0),
            discontinuity_state: enum_tag(&t.discontinuity_state),
            video_continuity: enum_tag(&t.video_continuity),
            audio_continuity: enum_tag(&t.audio_continuity),
            observed_at_ms: t.observed_at_ms,
        },
    }
}

pub fn to_api_query_snapshot(state: &CanonicalRuntimeState) -> ApiQuerySnapshot {
    // capabilities 是 per-device 字段 (CanonicalRuntimeState 无独立 capabilities 平面 — 不发明)。
    let caps: Vec<(uuid::Uuid, crate::runtime_state::DeviceCapabilitiesSummary)> = state
        .devices
        .iter()
        .filter_map(|d| d.capabilities.as_ref().map(|c| (d.device_id, *c)))
        .collect();
    ApiQuerySnapshot {
        devices: state.devices.iter().map(to_api_device).collect(),
        ports: state.ports.iter().map(to_api_port).collect(),
        resources: state.resources.iter().map(to_api_resource).collect(),
        sessions: state.sessions.iter().map(to_api_session).collect(),
        capabilities: to_api_capabilities(&caps),
        generated_at_ms: state.generated_at_ms,
        observation_revision: state.observation_revision,
        observation_lineage: state.observation_lineage,
        // canonical 状态面不携带执行平面事实——v0.2 投影由 transport 组装处
        // 合并（Query Plane 数据源=observe_execution, 非 CanonicalRuntimeState）。
        program_switch: None,
    }
}

// === Command 平面: 独立 enum 命名 ============================================

/// API 命令请求 — 接受客户端 command_id 字符串 (后续持久化为 UUID 内部表示;
/// **不绑回** 内部 CommandId 类型)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiCommandRequest {
    pub command_id: String,
    /// API 友好命名 ("start_session"/"stop_session"/"release_session") — **不绑回** CommandKind。
    pub kind: String,
    pub target: ApiCommandTarget,
    pub requested_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "target_type", rename_all = "snake_case")]
pub enum ApiCommandTarget {
    /// Session target: intent 以 JSON Value 透传 (不绑回 GraphRuntimeIntent 结构)。
    Session {
        intent: serde_json::Value,
    },
    SessionById {
        session_id: String,
    },
    /// SwitchProgram 用（v0.2·R60 裁决②）: 目标会话 + 目标输入设备
    /// （canonical UUID 字符串; policy 固定 FrameSwitch 不入 wire）。
    SwitchProgram {
        session_id: String,
        target_device: String,
    },
}

/// API 命令状态 — 4 态闭包 (Executed/Replayed/Rejected/Conflict), **不暴露** Failed
/// (终审 NOTE-2 + 0.7C-5 三平面分离: 失败归因通过 classification 传达)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ApiCommandStatus {
    Executed,
    Replayed,
    Rejected,
    Conflict,
}

/// API 错误分类 — 与 ErrorClassification 同构, 但去 `_failure` 后缀, 命名 API 友好
/// (终审 NOTE-2: 不暴露 Rust serde tag 习惯 "retryable_failure")。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiErrorClass {
    Rejected,
    Conflict,
    Retryable,
    Permanent,
    Unknown,
}

impl From<&crate::error_model::ErrorClassification> for ApiErrorClass {
    fn from(c: &crate::error_model::ErrorClassification) -> Self {
        use crate::error_model::ErrorClassification as E;
        match c {
            E::Rejected => Self::Rejected,
            E::Conflict => Self::Conflict,
            E::RetryableFailure => Self::Retryable,
            E::PermanentFailure => Self::Permanent,
            E::Unknown => Self::Unknown,
        }
    }
}

/// API 命令响应 — 不聚合万能包装 (终审 NOTE: ❶❶); 字段仅由消费语义驱动。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiCommandResponse {
    pub command_id: String,
    pub status: ApiCommandStatus,
    pub kind: String,
    pub classification: Option<ApiErrorClass>,
    pub detail: Option<String>,
}

// === Event 平面: Projection ≠ State 红线守护 ==================================

/// API 事件封套。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiEventEnvelope {
    pub kind: String,
    pub session_id: Option<String>,
    /// "observation" / "critical" — EventSeverity 字符串化, 不暴露内部 enum。
    pub severity: String,
    pub ts_ms: u64,
}

/// **API 投影守门字段** — 序列化必含 `"event_projection_snapshot"` 字面量,
/// 防客户端误作权威状态 (终审 NOTE-1 + 0.7C-6 EventProjection ≠ CanonicalRuntimeState)。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiProjectionKind {
    EventProjectionSnapshot,
}

/// API 投影响应。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiProjectionResponse {
    /// **守门字段**: 序列化必为 "event_projection_snapshot" (终审 NOTE-1)。
    pub snapshot_kind: ApiProjectionKind,
    pub total: usize,
    pub kind_counts: BTreeMap<String, usize>,
    pub session_states: BTreeMap<String, String>,
    pub session_failures: BTreeMap<String, usize>,
    pub has_critical: bool,
    /// 故障类事件摘要 (HEALTH-INCIDENT-ENTRY-01 D1: additive 扩展; 旧载荷无此字段
    /// 时反序列化为空——非破坏 versioning)。字段照抄 canonical RuntimeEvent 载荷。
    #[serde(default)]
    pub faults: Vec<crate::event_projection::FaultDigest>,
}

impl From<&EventProjection> for ApiProjectionResponse {
    fn from(p: &EventProjection) -> Self {
        ApiProjectionResponse {
            snapshot_kind: ApiProjectionKind::EventProjectionSnapshot,
            total: p.total,
            kind_counts: p.kind_counts.clone(),
            session_states: p.session_states.clone(),
            session_failures: p.session_failures.clone(),
            has_critical: p.has_critical,
            faults: p.faults.clone(),
        }
    }
}

// === Idempotency 持久化边界契约 (仅契约, 无实现) ==============================

/// **API Idempotency 边界契约层** — 公开 "当前实现承诺" 与 "跨重启语义承诺"。
/// 三选项对勘公开化 (终审裁定: 暴露非隐藏), 防止未来悄悄切换实现被消费者无感。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiIdempotencyBoundary {
    pub current_backend: ApiIdempotencyBackend,
    pub durable_persistence: ApiPersistenceOption,
    pub cross_restart_semantics: ApiCrossRestartSemantics,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiIdempotencyBackend {
    /// 当前实现: 进程内 `CommandIdempotency` 表 (0.7C-4 Foundation)。
    ProcessLocal,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiPersistenceOption {
    /// 实现阶段二: durable log / SQLite (本 change 不实现)。
    DurableLogDeferred,
    /// 实现阶段三: 外部 KV/Redis (本 change 不实现)。
    ExternalKvDeferred,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiCrossRestartSemantics {
    /// 当前: 重启后同 command_id 视为新命令实例 (D9 措辞已锁定)。
    RestartBreaksReplay,
    /// 持久化后 (后续阶段): 重启后同 command_id 重放原 outcome。
    RestartAllowsReplay,
}

/// 默认边界契约 = 当前能力快照 (消费者文档生成器/健康端点可序列化)。
pub fn default_idempotency_boundary() -> ApiIdempotencyBoundary {
    ApiIdempotencyBoundary {
        current_backend: ApiIdempotencyBackend::ProcessLocal,
        durable_persistence: ApiPersistenceOption::DurableLogDeferred,
        cross_restart_semantics: ApiCrossRestartSemantics::RestartBreaksReplay,
    }
}

// === Program 平面：ProgramMaster 语义快照投影（A2-6-02） =====================
//
// **A2-6-02 复核终裁（CHANGES REQUIRED 已修复）**: API DTO 字段禁直接持有
// Domain 容器对象——"Canonical types 允许 mapper 消费"≠"允许 DTO 字段类型
// 等于 Domain 类型"（两层权限不可混同）。修复 = 薄镜像 DTO（字段严格 1:1
// 对应 canonical wire shape, mapper 只做显式机械复制）——镜像 ≠ 重新解释
// Domain（语义来自 Domain, 所有权与演进边界属于 API; Domain 字段增加不再
// 自动改 API contract）。不碰: Query/Transport/Custody/producer（零挂载
// 仍有效）。

/// VideoMaster 语义快照投影（薄镜像: 字段 1:1 canonical wire shape;
/// 词表子类型为 LOCK FINAL canonical vocabulary, 当前允许直接复用——其变化
/// 必须经对应版本/架构变更流程, 非天然"零风险"; 一旦叶子开始承载 Runtime/
/// vendor/execution 语义须重新判断复用合法性）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiVideoMaster {
    pub stage: crate::program::VideoMasterStage,
    pub data_plane: crate::program::VideoDataPlane,
    pub composition: crate::program::ProgramComposition,
}

/// AudioMaster 语义快照投影（薄镜像, 同律）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiAudioMaster {
    pub stage: crate::program::AudioMasterStage,
    pub data_plane: crate::program::AudioDataPlane,
    pub mix_layout: crate::program::MixLayout,
    pub delay_ms: Option<std::num::NonZeroU16>,
    pub loudness_lufs: Option<f32>,
}

/// MetadataMaster 语义快照投影（薄镜像, 同律; facts 元素 `MetadataFact` 与
/// `CanonicalSourceRef` 属 LOCK FINAL 词表层直接复用——键集恰三已由 A2-4
/// 测试锁死, 无容器演化面）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiMetadataMaster {
    pub data_plane: crate::program::MetadataDataPlane,
    pub facts: Vec<crate::program::MetadataFact>,
    pub join_declaration: crate::program::MetadataJoinDeclaration,
}

/// ProgramMaster 语义快照投影（A2-6-01 终裁: 命名 `ApiProgramMaster`——
/// 直译组合根; 禁 ApiProgram[过早吞 A2-7 完整 Program 语义]/ApiChannelProgram/
/// ApiProgramSnapshot）。
///
/// **whole-value 整体投影（禁 flatten）**: video/audio/metadata 嵌套 API
/// DTO 原样出现, 顶层禁 video_stage/audio_stage/metadata_xxx 平铺——API 不
/// 重新解释 Domain。
///
/// **avsync = Join classification input projection**（A2-5 唯一家
/// master_join.rs 的 `AVSyncClassification` 四值零转换透传）——**不是**
/// health/status/program_status; `AVSync=FAILED` 禁推 `join_result=FAILED`
/// 以外的任何语义（§8.10 red 后须 Runtime classify_failure_domain）。
///
/// **零挂载（A2-6-01 终裁 OQ-8）**: 本 DTO 当前无 producer（join() 零生产
/// 调用者）无 consumer——仅 to_api_* 纯映射到位; RuntimeQuery/
/// ApiQuerySnapshot/transport 端点零接线（等 A2-7 生产生命周期 + 真实消费者）。
/// 零 serde(default)（缺省语义=数据类型行为, 不放宽 API Contract）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiProgramMaster {
    pub video: ApiVideoMaster,
    pub audio: ApiAudioMaster,
    pub metadata: ApiMetadataMaster,
    /// `None` = Join Result 尚未形成（wire: `null`; **禁** UNKNOWN/NOT_READY/
    /// FAILED/DEGRADED 字符串化——None 不是第五语义, R-A）。
    pub join_result: Option<crate::program::MasterJoinResult>,
    pub avsync: crate::program::AVSyncClassification,
}

/// VideoMaster → ApiVideoMaster 显式机械映射（薄镜像 1:1; 零语义创造）。
pub fn to_api_video_master(v: &crate::program::VideoMaster) -> ApiVideoMaster {
    ApiVideoMaster {
        stage: v.stage,
        data_plane: v.data_plane,
        composition: v.composition,
    }
}

/// AudioMaster → ApiAudioMaster 显式机械映射（薄镜像 1:1）。
pub fn to_api_audio_master(a: &crate::program::AudioMaster) -> ApiAudioMaster {
    ApiAudioMaster {
        stage: a.stage,
        data_plane: a.data_plane,
        mix_layout: a.mix_layout,
        delay_ms: a.delay_ms,
        loudness_lufs: a.loudness_lufs,
    }
}

/// MetadataMaster → ApiMetadataMaster 显式机械映射（薄镜像 1:1）。
pub fn to_api_metadata_master(m: &crate::program::MetadataMaster) -> ApiMetadataMaster {
    ApiMetadataMaster {
        data_plane: m.data_plane,
        facts: m.facts.clone(),
        join_declaration: m.join_declaration,
    }
}

/// ProgramMaster → ApiProgramMaster 纯映射（A2-6-02: PMAPI 属性——pure/
/// deterministic/零 cache/零 mutation/零 assembly/零 Runtime lookup/零
/// Event/零 Query/零 transport/零 custody; **mapper 不创建 ProgramMaster**,
/// 输入是已存在的引用[硬 Gate: 无 owner 时不产假快照]）。
///
/// `avsync` 独立参数化（ProgramMaster 无此字段——双 SoT 禁, A2-5-04 终裁;
/// 来源 = 调用方持有的 `JoinClassificationInput.avsync` 透传）。
pub fn to_api_program_master(
    pm: &crate::program::ProgramMaster,
    avsync: crate::program::AVSyncClassification,
) -> ApiProgramMaster {
    ApiProgramMaster {
        video: to_api_video_master(&pm.video),
        audio: to_api_audio_master(&pm.audio),
        metadata: to_api_metadata_master(&pm.metadata),
        join_result: pm.join_result,
        avsync,
    }
}

// === 单元测试 ================================================================

#[cfg(all(test, feature = "mock"))]
mod tests {
    use super::*;
    use crate::error_model::ErrorClassification as E;

    /// v0.2（R60 裁决③）: program_switch 投影等值 + 诚实缺席——字段逐项
    /// 从 ProgramExecutionObservation 透传, Option 缺席不伪造。
    #[test]
    fn api_rt_01_program_switch_projection() {
        use crate::contracts::switch::{InputPts, ProgramExecutionObservation, ProgramObservation};
        use crate::program_timeline::{
            PlaneContinuity, ProgramEpoch, SegmentId, TimelineObservation,
        };
        let dev = uuid::Uuid::new_v4();
        let obs = ProgramExecutionObservation {
            program: ProgramObservation {
                observed_active: Some(dev),
                video_active: Some(dev),
                audio_active: Some(dev),
                switch_epoch: 3,
                input_pts: vec![InputPts {
                    device_id: dev,
                    video_pts: Some(100),
                    audio_pts: Some(80),
                    video_pts_state: crate::pipeline::PtsMonotonicity::ValidMonotonic,
                    audio_pts_state: crate::pipeline::PtsMonotonicity::ValidMonotonic,
                    stalled: false,
                }],
                program_video_pts: Some(100),
                program_audio_pts: Some(80),
                program_video_pts_state: crate::pipeline::PtsMonotonicity::DiscontinuityDeclared,
                program_audio_pts_state: crate::pipeline::PtsMonotonicity::ValidMonotonic,
                program_video_frames: 42,
                program_audio_frames: 40,
            },
            timeline: TimelineObservation {
                program_epoch: ProgramEpoch(1),
                source_id: Some(dev),
                segment_id: Some(SegmentId(2)),
                input_pts: Some(100),
                mapped_program_pts: Some(120),
                mapping_offset: Some(20),
                discontinuity_state: crate::pipeline::PtsMonotonicity::DiscontinuityDeclared,
                video_continuity: PlaneContinuity::Continuous,
                audio_continuity: PlaneContinuity::Continuous,
                observed_at_ms: 12345,
            },
        };
        let sid = crate::session::SessionId(uuid::Uuid::new_v4());
        let api = to_api_program_switch(&sid, &obs);
        assert_eq!(api.session_id, sid.0.to_string());
        assert_eq!(
            api.observed_active.as_deref(),
            Some(dev.to_string().as_str())
        );
        assert_eq!(api.switch_epoch, 3);
        // snake_case 统一（无 serde rename 的 PascalCase 变体亦转 snake）。
        assert_eq!(api.program_video_pts_state, "discontinuity_declared");
        assert_eq!(api.program_video_frames, 42);
        assert_eq!(api.timeline.program_epoch, 1);
        assert_eq!(api.timeline.segment_id, Some(2));
        assert_eq!(api.timeline.video_continuity, "continuous");
        assert_eq!(api.timeline.observed_at_ms, 12345);
        // 诚实缺席: observed None 透传为 None（不伪造字符串）。
        let mut obs2 = obs;
        obs2.program.observed_active = None;
        let api2 = to_api_program_switch(&sid, &obs2);
        assert_eq!(api2.observed_active, None);
    }

    /// **API-BOUNDARY-01 白盒门禁** — 静态扫描: 本文件/模块不得 `use` vendor 实现路径。
    #[test]
    fn api_rt_01_boundary_no_vendor_imports() {
        // 列出本模块源码中出现的全部顶级 use 路径, 任何匹配 vendor 字样者失败。
        // 这是编译级白盒 — 若未来提交偷加 use, 须同步在本测试更新 (与红线白盒同款)。
        let banned = [
            "backend",
            "gstreamer",
            "decklink",
            "ffmpeg",
            "pipeline::",
            "provider::",
        ];
        // 读取本测试模块自身的 src 字符串 (用 include_str!  让仓库静态校验)。
        // 实际 file!() 指向本文件, 含全部源码; banned 出现在 use 语句路径内即失败。
        let src = include_str!("api_boundary.rs");
        for line in src.lines() {
            let trimmed = line.trim_start();
            if !trimmed.starts_with("use ") {
                continue;
            }
            for b in &banned {
                assert!(
                    !trimmed.contains(b),
                    "API-BOUNDARY-01 违规: api_boundary.rs 不得 import `{b}` 实现 — `{trimmed}`"
                );
            }
        }
    }

    /// **终审禁清单 11 项零偷渡** — 静态扫描: api_boundary.rs 不出现 transport/持久化/ApiResponse 等关键字。
    #[test]
    fn api_rt_01_no_transport_no_persistence() {
        // 只扫描测试模块之前的生产代码 (剔除注释行; 测试自身的禁清单字面量不算违规)。
        let prod_src = include_str!("api_boundary.rs");
        let prod_part = prod_src.split("#[cfg(all(test").next().unwrap_or(prod_src);
        let src = prod_part
            .lines()
            .filter(|l| !l.trim_start().starts_with("//"))
            .collect::<Vec<_>>()
            .join("\n");
        for banned in [
            "axum",
            "hyper",
            "warp",
            "actix",
            "tower",
            "tonic",
            "grpc",
            "TcpListener",
            "HttpServer",
            "Router",
            "OpenAPI",
            "tokio::main",
            "async fn",
            "Sqlite",
            "Redis",
            "Kafka",
            "ApiResponse", // 禁止万能包装
        ] {
            assert!(
                !src.contains(banned),
                "终审禁清单违规: api_boundary.rs 含 `{banned}` — 本 change 禁 transport/persistence/万能包装"
            );
        }
    }

    /// **NOTE-2 + 0.7C-5 三平面分离白盒** — serde 反向断言:
    /// ApiCommandStatus JSON 禁出现 CommandStatus 变体名 (failed/accepted/executed/rejected);
    /// ApiErrorClass JSON 禁出现 ErrorClassification 后缀 (retryable_failure/permanent_failure);
    /// ApiProjectionResponse 必含 snapshot_kind="event_projection_snapshot"。
    #[test]
    fn api_rt_01_api_models_decoupled_from_runtime_types() {
        // ApiCommandStatus: 不暴露 failed (失败用 classification=Retryable/Permanent 传达)
        let resp = ApiCommandResponse {
            command_id: "x".into(),
            status: ApiCommandStatus::Executed,
            kind: "start_session".into(),
            classification: Some(ApiErrorClass::Retryable),
            detail: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(
            !json.contains("\"failed\""),
            "ApiCommandStatus 不得暴露 failed"
        );
        assert!(
            json.contains("\"retryable\""),
            "ApiErrorClass 必须 snake_case 简短命名"
        );
        assert!(
            !json.contains("retryable_failure"),
            "不得暴露内部 ErrorClassification 命名"
        );
        // ApiProjectionResponse 守门
        let p = ApiProjectionResponse {
            snapshot_kind: ApiProjectionKind::EventProjectionSnapshot,
            total: 1,
            kind_counts: BTreeMap::from([("session_created".into(), 1)]),
            session_states: BTreeMap::new(),
            session_failures: BTreeMap::new(),
            has_critical: false,
            faults: Vec::new(),
        };
        let pj = serde_json::to_string(&p).unwrap();
        assert!(
            pj.contains("\"event_projection_snapshot\""),
            "snapshot_kind 守门必出现, 防误作权威状态"
        );
    }

    /// **NOTE-2 验证**: ApiCommandStatus 不暴露 Failed 变体。
    #[test]
    fn api_rt_01_api_command_status_no_failed_state() {
        // 穷举 ApiCommandStatus, 任何变体的 serde 标签不得含 "failed"。
        let kinds = [
            serde_json::to_value(ApiCommandStatus::Executed).unwrap(),
            serde_json::to_value(ApiCommandStatus::Replayed).unwrap(),
            serde_json::to_value(ApiCommandStatus::Rejected).unwrap(),
            serde_json::to_value(ApiCommandStatus::Conflict).unwrap(),
        ];
        for k in &kinds {
            let s = k.to_string();
            assert!(!s.contains("failed"), "ApiCommandStatus 禁 Failed: {s}");
        }
        // ApiErrorClass: retryable 标签非 retryable_failure
        let r = serde_json::to_value(ApiErrorClass::Retryable).unwrap();
        assert_eq!(r, "retryable");
        let pf = serde_json::to_value(ApiErrorClass::Permanent).unwrap();
        assert_eq!(pf, "permanent");
    }

    /// **NOTE-1 守门**: ApiProjectionResponse 序列化必含 snapshot_kind 字段且字面量为
    /// `"event_projection_snapshot"` (客户端凭此标识知"非权威")。
    #[test]
    fn api_rt_01_api_projection_kind_enforced() {
        let ep = EventProjection {
            total: 0,
            ..Default::default()
        };
        let api: ApiProjectionResponse = (&ep).into();
        let v = serde_json::to_value(&api).unwrap();
        assert_eq!(
            v["snapshot_kind"], "event_projection_snapshot",
            "ApiProjectionKind 守门字段必出现, 防 EventProjection 伪装 RuntimeState"
        );
    }

    /// **to_api_query_models** — Query 五资源 + 全 capabilities 转换完整字段+值域。
    /// 用空 snapshot + 一项设备 (minimal fields) 锁定 to_api_* 全部入口编译级可用。
    #[test]
    fn api_rt_01_to_api_query_models() {
        let state = CanonicalRuntimeState {
            devices: vec![],
            ports: vec![],
            resources: vec![],
            sessions: vec![],
            media_semantics: vec![],
            generated_at_ms: 1_700_000_000_000,
            observation_revision: 42,
            observation_lineage: uuid::Uuid::new_v4(),
        };
        let snap = to_api_query_snapshot(&state);
        assert_eq!(snap.generated_at_ms, 1_700_000_000_000);
        assert_eq!(snap.observation_revision, 42, "投影透传 revision");
        assert_eq!(
            snap.observation_lineage, state.observation_lineage,
            "投影透传 lineage"
        );
        assert!(snap.devices.is_empty());
        assert!(snap.ports.is_empty());
        assert!(snap.resources.is_empty());
        assert!(snap.sessions.is_empty());
        // Alpha-1: 会话输入摘要 wire 投影（多输入可见性）。
        let mut s = state.clone();
        s.sessions = vec![crate::runtime_state::SessionRuntimeState {
            session_id: crate::session::SessionId(uuid::Uuid::new_v4()),
            state: crate::session::SessionState::Running,
            phase: crate::session::SessionPhase::Running,
            claims: 0,
            pipeline: Some(7),
            outputs: vec!["hls".into()],
            inputs: vec![
                crate::runtime_state::InputRuntimeSummary {
                    device_id: "d1".into(),
                    handle: 7,
                },
                crate::runtime_state::InputRuntimeSummary {
                    device_id: "d2".into(),
                    handle: 8,
                },
            ],
        }];
        let snap2 = to_api_query_snapshot(&s);
        assert_eq!(snap2.sessions[0].inputs.len(), 2, "输入行 wire 投影");
        assert_eq!(snap2.sessions[0].inputs[0].handle, 7);
        // ErrorClassification → ApiErrorClass 转换闭包 (5 类齐全)。
        for (e, expected) in [
            (E::Rejected, ApiErrorClass::Rejected),
            (E::Conflict, ApiErrorClass::Conflict),
            (E::RetryableFailure, ApiErrorClass::Retryable),
            (E::PermanentFailure, ApiErrorClass::Permanent),
            (E::Unknown, ApiErrorClass::Unknown),
        ] {
            assert_eq!(ApiErrorClass::from(&e), expected);
        }
    }

    /// **Command API request 字段形状** — command_id 非空、kind 三词表封闭、
    /// target 二选一、requested_by 非空 (终审 NOTE: 验证 API 模型独立完整性)。
    #[test]
    fn api_rt_01_api_command_request_field_shape() {
        // 合法形态
        let ok = ApiCommandRequest {
            command_id: "client-abc-123".into(),
            kind: "start_session".into(),
            target: ApiCommandTarget::SessionById {
                session_id: "sess-1".into(),
            },
            requested_by: "ops@example.com".into(),
        };
        let json = serde_json::to_string(&ok).unwrap();
        assert!(json.contains("client-abc-123"));
        assert!(json.contains("session_by_id"));
        // Session target: intent JSON 透传 (不绑回 GraphRuntimeIntent 结构)
        let ok2 = ApiCommandRequest {
            command_id: "x".into(),
            kind: "start_session".into(),
            target: ApiCommandTarget::Session {
                intent: serde_json::json!({"version": "1.0", "devices": []}),
            },
            requested_by: "t".into(),
        };
        let j2 = serde_json::to_string(&ok2).unwrap();
        assert!(j2.contains("\"session\""));
        assert!(j2.contains("\"intent\""));
    }

    /// **Idempotency 边界契约三选项对勘** — 终审裁定公开化 (ProcessLocal/DurableLogDeferred/
    /// ExternalKvDeferred + RestartBreaksReplay/RestartAllowsReplay)。
    #[test]
    fn api_rt_01_idempotency_boundary_contract() {
        let b = default_idempotency_boundary();
        assert_eq!(b.current_backend, ApiIdempotencyBackend::ProcessLocal);
        assert_eq!(
            b.durable_persistence,
            ApiPersistenceOption::DurableLogDeferred
        );
        assert_eq!(
            b.cross_restart_semantics,
            ApiCrossRestartSemantics::RestartBreaksReplay
        );
        // boundary 只序列化**当前选定值** (process_local / durable_log_deferred /
        // restart_breaks_replay) — 未选定选项不出现。
        let json = serde_json::to_string(&b).unwrap();
        assert!(json.contains("process_local"));
        assert!(json.contains("durable_log_deferred"));
        assert!(json.contains("restart_breaks_replay"));
        assert!(!json.contains("\"failed\""));
        // 三选项对勘公开化: **全部枚举变体**的稳定 snake_case 序列化名 (公开 API 面,
        // 消费者凭此知"当前 vs 未来可选"边界)。未选定选项的稳定性在此锁定。
        assert_eq!(
            serde_json::to_string(&ApiPersistenceOption::ExternalKvDeferred).unwrap(),
            "\"external_kv_deferred\""
        );
        assert_eq!(
            serde_json::to_string(&ApiCrossRestartSemantics::RestartAllowsReplay).unwrap(),
            "\"restart_allows_replay\""
        );
    }

    // === A2-6-02: ProgramMaster API Projection（PMAPI-01..12 终裁 Gate） ===

    use crate::program::{
        join, AVSyncClassification, MasterJoinInput, MasterJoinResult, MetadataJoinDeclaration,
        MetadataMaster, ProgramMaster,
    };

    /// PMAPI 底座: 经**真实 join()** 产出的 ProgramMaster（不从零构造假快照
    /// ——三 Master 推进到终态 + declaration 后 join, 与生产链同构）。
    fn composed_program_master(join_result: Option<MasterJoinResult>) -> ProgramMaster {
        let mut video = crate::program::VideoMaster::new();
        for _ in 0..4 {
            video = video.advance().expect("相邻推进");
        }
        let mut audio = crate::program::AudioMaster::new();
        for _ in 0..4 {
            audio = audio.advance().expect("相邻推进");
        }
        let metadata = crate::program::MetadataMaster {
            join_declaration: MetadataJoinDeclaration::Participating,
            ..MetadataMaster::default()
        };
        let input = MasterJoinInput {
            video,
            audio,
            metadata: metadata.clone(),
            avsync: AVSyncClassification::Unknown,
            video_failed: false,
            audio_failed: false,
        };
        let output = join(&input);
        assert_eq!(output.result, Some(MasterJoinResult::Acceptable));
        ProgramMaster::compose(
            input.video,
            input.audio,
            metadata,
            join_result.or(output.result),
        )
    }

    /// PMAPI-01/07/08: 顶层五键存在（whole-value——video/audio/metadata 是
    /// 嵌套对象非平铺标量; 反向禁 video_stage 等展平键与 eligibility/
    /// classification_input/inconsistency 过程键）; **镜像独立性（A2-6-02
    /// 复核终裁）**: ApiProgramMaster 字段类型为 Api* 镜像 DTO 非 Domain
    /// 容器——行为证 = Domain 容器上不存在的构造/字段访问在 Api DTO 上成立,
    /// 且独立结构各自序列化（Domain 字段未来增加不自动进 API wire）。
    #[test]
    fn pmapi_01_top_level_keys_whole_value_not_alias() {
        let pm = composed_program_master(None);
        let api = to_api_program_master(&pm, AVSyncClassification::Acceptable);
        let obj = serde_json::to_value(&api)
            .unwrap()
            .as_object()
            .unwrap()
            .clone();
        for must in ["video", "audio", "metadata", "join_result", "avsync"] {
            assert!(obj.contains_key(must), "顶层必须存在 {must}");
        }
        // whole-value: 域是嵌套对象（非平铺标量键）。
        assert!(obj.get("video").unwrap().is_object());
        assert!(obj.get("audio").unwrap().is_object());
        assert!(obj.get("metadata").unwrap().is_object());
        // 反向: 平铺键与 Join 过程键禁入顶层。
        for banned in [
            "video_stage",
            "audio_stage",
            "metadata_facts",
            "metadata_join_declaration",
            "eligibility",
            "classification_input",
            "inconsistency",
            "health",
            "status",
        ] {
            assert!(!obj.contains_key(banned), "顶层禁入 {banned}");
        }
    }

    /// PMAPI-02: join_result=Some → wire 词表正确（真实 join 产 ACCEPTABLE;
    /// 显式 Degraded 亦逐字透传）。
    #[test]
    fn pmapi_02_join_result_some_serializes() {
        let pm = composed_program_master(None);
        let api = to_api_program_master(&pm, AVSyncClassification::Unknown);
        assert_eq!(
            serde_json::to_value(&api)
                .unwrap()
                .get("join_result")
                .unwrap(),
            &serde_json::json!("ACCEPTABLE")
        );
        let pm2 = ProgramMaster::compose(
            pm.video,
            pm.audio,
            pm.metadata,
            Some(MasterJoinResult::Degraded),
        );
        assert_eq!(
            serde_json::to_value(to_api_program_master(&pm2, AVSyncClassification::Unknown))
                .unwrap()
                .get("join_result")
                .unwrap(),
            &serde_json::json!("DEGRADED")
        );
    }

    /// PMAPI-03/04: join_result=None → wire `null`（**非** UNKNOWN/NOT_READY/
    /// FAILED/DEGRADED 任何字符串化——None 不是第五语义）; 且 UNKNOWN 串在
    /// join_result 位置反序列化 fail-closed。
    #[test]
    fn pmapi_03_04_join_result_none_is_null_not_semantic_string() {
        // 显式 None（helper 的 or(output.result) 会回填真实结果, 此处须直取）。
        let real = composed_program_master(None);
        let pm = ProgramMaster::compose(real.video, real.audio, real.metadata, None);
        let api = to_api_program_master(&pm, AVSyncClassification::Unknown);
        let json = serde_json::to_value(&api).unwrap();
        assert_eq!(
            json.get("join_result").unwrap(),
            &serde_json::Value::Null,
            "None → null（Option absence 内建语义）"
        );
        // null 往返恒等 None。
        let back: ApiProgramMaster = serde_json::from_value(json).unwrap();
        assert_eq!(back.join_result, None);
        // 语义串冒充 None 状态禁入 join_result 词表。
        for fake in ["UNKNOWN", "NOT_READY"] {
            let mut forged = serde_json::to_value(&api).unwrap();
            forged
                .as_object_mut()
                .unwrap()
                .insert("join_result".into(), serde_json::json!(fake));
            assert!(
                serde_json::from_value::<ApiProgramMaster>(forged).is_err(),
                "join_result 拒收 {fake}（None≠语义串, 词表封闭）"
            );
        }
    }

    /// PMAPI-05: AVSync 四值零转换透传（ACCEPTABLE/DEGRADED/FAILED/UNKNOWN
    /// 逐值恒等——投影层不是分类器也不是改写器）。
    #[test]
    fn pmapi_05_avsync_four_values_passthrough() {
        let pm = composed_program_master(None);
        for (input, wire) in [
            (AVSyncClassification::Acceptable, "\"ACCEPTABLE\""),
            (AVSyncClassification::Degraded, "\"DEGRADED\""),
            (AVSyncClassification::Failed, "\"FAILED\""),
            (AVSyncClassification::Unknown, "\"UNKNOWN\""),
        ] {
            let api = to_api_program_master(&pm, input);
            let v = serde_json::to_value(&api).unwrap();
            assert_eq!(v.get("avsync").unwrap(), &serde_json::json!(input));
            assert_eq!(
                serde_json::to_string(v.get("avsync").unwrap()).unwrap(),
                wire
            );
        }
    }

    /// PMAPI-06: inconsistency/eligibility/classification_input 不进入 API
    /// （Join 内部分类输入与运算过程输出非用户语义——05 终裁维持）。
    #[test]
    fn pmapi_06_inconsistency_not_exposed() {
        let pm = composed_program_master(None);
        let json =
            serde_json::to_string(&to_api_program_master(&pm, AVSyncClassification::Unknown))
                .unwrap();
        for absent in ["inconsistency", "eligibility", "classification_input"] {
            assert!(!json.contains(absent), "API 禁暴露 {absent}");
        }
    }

    /// PMAPI-09/10: mapper 纯度——同输入两次调用恒等（deterministic 零
    /// cache）; 输入 pm 不被 mutation; 签名零 Runtime 依赖（编译期: 参数仅
    /// &ProgramMaster + AVSyncClassification——RuntimeState/SessionManager/
    /// RuntimeQuery/EventLog 无法进入, 本测试锁定行为面）。
    #[test]
    fn pmapi_09_10_mapper_pure_deterministic_no_mutation() {
        let pm = composed_program_master(None);
        let before = pm.clone();
        let a = to_api_program_master(&pm, AVSyncClassification::Degraded);
        let b = to_api_program_master(&pm, AVSyncClassification::Degraded);
        assert_eq!(a, b, "同输入恒等（零 cache 零随机性）");
        assert_eq!(pm, before, "mapper 零 mutation");
    }

    /// PMAPI-12: 零 serde(default)——三 Master 字段与 avsync 缺失 fail-closed
    /// （join_result 缺失=Option 内建 absence, 与 A2-5-04 同律）。
    #[test]
    fn pmapi_12_no_serde_default_fail_closed() {
        let api = to_api_program_master(
            &composed_program_master(None),
            AVSyncClassification::Unknown,
        );
        let json = serde_json::to_value(&api).unwrap();
        for drop_key in ["video", "audio", "metadata", "avsync"] {
            let mut partial = json.as_object().unwrap().clone();
            assert!(partial.remove(drop_key).is_some());
            assert!(
                serde_json::from_value::<ApiProgramMaster>(serde_json::Value::Object(partial))
                    .is_err(),
                "缺 {drop_key} 必须 fail-closed（零 serde(default)）"
            );
        }
        // join_result 缺失 = Option 内建 absence（→None）。
        let mut no_result = json.as_object().unwrap().clone();
        assert!(no_result.remove("join_result").is_some());
        let back: ApiProgramMaster =
            serde_json::from_value(serde_json::Value::Object(no_result)).unwrap();
        assert_eq!(back.join_result, None);
    }

    /// 薄镜像 1:1 映射保真（A2-6-02 复核终裁）: 三子 mapper 对**非默认状态**
    /// 的逐字段显式复制——wire shape 与 Domain canonical shape 恒等（含
    /// delay_ms=Some / loudness_lufs=Some / facts 非空等带值场景, 防映射漏
    /// 字段）。
    #[test]
    fn pmapi_mirror_dtos_one_to_one_field_fidelity() {
        use crate::program::{AudioMasterStage, MetadataType as Mt, MixLayout as Ml};
        use std::num::NonZeroU16;

        let mut video = crate::program::VideoMaster::new();
        for _ in 0..2 {
            video = video.advance().expect("推进");
        }
        let audio = crate::program::AudioMaster {
            stage: AudioMasterStage::DelayCompensated,
            mix_layout: Ml::StereoAndSub,
            delay_ms: Some(NonZeroU16::new(80).unwrap()),
            loudness_lufs: Some(-23.0),
            ..crate::program::AudioMaster::new()
        };
        let metadata = crate::program::MetadataMaster {
            facts: vec![crate::program::MetadataFact {
                kind: Mt::Caption,
                source: crate::normalize::CanonicalSourceRef {
                    device_id: uuid::Uuid::nil(),
                    port_id: None,
                },
                presence: crate::program::MetadataPresence::Present,
            }],
            join_declaration: MetadataJoinDeclaration::NotPresent,
            ..MetadataMaster::default()
        };

        let av = to_api_video_master(&video);
        assert_eq!(av.stage, video.stage);
        assert_eq!(av.data_plane, video.data_plane);
        assert_eq!(av.composition, video.composition);

        let aa = to_api_audio_master(&audio);
        assert_eq!(aa.stage, audio.stage);
        assert_eq!(aa.data_plane, audio.data_plane);
        assert_eq!(aa.mix_layout, audio.mix_layout);
        assert_eq!(aa.delay_ms, audio.delay_ms);
        assert_eq!(aa.loudness_lufs, audio.loudness_lufs);

        let am = to_api_metadata_master(&metadata);
        assert_eq!(am.data_plane, metadata.data_plane);
        assert_eq!(am.facts, metadata.facts);
        assert_eq!(am.join_declaration, metadata.join_declaration);

        // 组合根映射后 wire 面与 Domain 事实逐字段一致（嵌套层同值）。
        let pm = ProgramMaster::compose(video, audio, metadata, None);
        let api = to_api_program_master(&pm, AVSyncClassification::Failed);
        assert_eq!(api.video.stage, crate::program::VideoMasterStage::Switched);
        assert_eq!(api.audio.stage, AudioMasterStage::DelayCompensated);
        assert_eq!(api.audio.delay_ms, Some(NonZeroU16::new(80).unwrap()));
        assert_eq!(api.metadata.facts.len(), 1);
        assert_eq!(
            api.metadata.join_declaration,
            MetadataJoinDeclaration::NotPresent
        );
        assert_eq!(api.join_result, None);
        assert_eq!(api.avsync, AVSyncClassification::Failed);
    }
}
