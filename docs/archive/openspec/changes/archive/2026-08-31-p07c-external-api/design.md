# Design: Phase 0.7C-7 — p07c-external-api

## 0. 终审裁定落点 + probe 引用

| 终审裁定 + probe 结论 | 设计落点 |
|---|---|
| **API Resource Model 独立定义**（非 Runtime 投影，NOTE-3） | §1 api_boundary.rs 五大独立 API 类型 + to_api_* 纯转换 |
| **不暴露 Rust serde tag 习惯**（NOTE-2：verdict/retryable_failure 等） | §1 ApiCommandStatus ≠ CommandStatus；ApiErrorClass ≠ ErrorClassification；字段命名与 Rust enum 解耦 |
| **EventProjection ≠ CanonicalRuntimeState**（NOTE-1） | §1.3 ApiProjectionResponse 标注 "event projection snapshot, not authoritative state" |
| **顺序：Contract Probe ✓ → Boundary → Idempotency 边界 → 三平面映射 → transport** | §2 Idempotency 边界契约（仅契约，非实现）+ §3 三平面映射表；transport 留下一 change |
| **transport std-only 纪律**（0.7A） | 本 change 零 transport 依赖（README）；transport 实现属下一 change |

## 1. API 资源模型（api_boundary.rs 新）

### 1.1 Query 五资源独立 API 类型

```rust
/// 字段仅由 API 消费语义驱动 (加严红线: 禁万能 struct); 不绑回 Runtime 内部 enum。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiDevice {
    pub id: String,
    pub model: String,
    pub binding: Option<String>,       // canonical binding_status 字符串化
    pub capabilities: Option<Vec<ApiCapability>>,  // 当前恒 None: capabilities 在 snapshot 平面统一收集
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiPort { pub id: String, pub device_id: String, pub direction: String }
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiResource { pub id: String, pub device_id: String, pub state: String }
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiSession { pub id: String, pub state: String, pub phase: String }
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiCapability {
    pub can_input: String,    // "supported"/"unsupported"/"unknown" — D6 三态字符串化
    pub can_output: String,
    pub input_ports: Option<u32>,
    pub output_ports: Option<u32>,
}
```

> 注：`ApiCapability` 字段直接镜像 `DeviceCapabilitiesSummary` 实际字段（can_input/can_output/input_ports/output_ports），值域字符串化（CapabilityFlag enum 名不暴露）。capabilities 为 **per-device** 字段（`CanonicalRuntimeState` 无独立 capabilities 平面——不发明），`to_api_query_snapshot` 从 `devices[*].capabilities` 收集。

**关键解耦**：`ApiResource.state` 是 **API 字符串**（`"available"` / `"reserved"` / `"allocated"` / `"releasing"` / `"faulted"`），**不是** `ResourceState` enum 直接暴露；`ApiSession.state/phase` 同理。to_api_* 纯函数显式映射。

```rust
pub fn to_api_device(d: &DeviceRuntimeState) -> ApiDevice;
pub fn to_api_port(p: &PortRuntimeState) -> ApiPort;
pub fn to_api_resource(r: &ResourceRuntimeState) -> ApiResource;
pub fn to_api_session(s: &SessionRuntimeState) -> ApiSession;
pub fn to_api_capabilities(cs: &[(Uuid, DeviceCapabilitiesSummary)]) -> Vec<(String, ApiCapability)>;
```

### 1.2 Command API model（独立 enum 命名）

```rust
/// 接受客户端 command_id 字符串 (后续持久化为 UUID 内部表示); 不绑回 CommandId 内部类型。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiCommandRequest {
    pub command_id: String,       // 客户端提供 (任意非空字符串); API 层负责规范化
    pub kind: String,             // API 友好: "start_session" / "stop_session" / "release_session"
    pub target: ApiCommandTarget, // 见下
    pub requested_by: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "target_type", rename_all = "snake_case")]
pub enum ApiCommandTarget {
    Session { intent: serde_json::Value },  // intent 不绑回 GraphRuntimeIntent 结构 (JSON 透传)
    SessionById { session_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ApiCommandStatus {
    Executed, Replayed, Rejected, Conflict,  // 4 态 (与 CommandStatus 4 态同构, 但命名 API 友好)
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiErrorClass {
    Rejected, Conflict, Retryable, Permanent, Unknown,  // 5 类 (与 ErrorClassification 同构, 但无 _failure 后缀)
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiCommandResponse {
    pub command_id: String,
    pub status: ApiCommandStatus,
    pub kind: String,
    pub classification: Option<ApiErrorClass>,
    pub detail: Option<String>,
}
```

**命名解耦**：
- `CommandStatus::Failed` → API 端**不暴露**（"执行失败的命令也响应 Executed + classification=Retryable/Permanent"——归因通过 classification 传达，与 0.7C-5 三平面分离一致）
- `IdempotentDispatch::Replayed` → API 用 `ApiCommandStatus::Replayed`（命名解耦；"verdict" Rust 字段不出现）
- `ErrorClassification::RetryableFailure` → API 用 `ApiErrorClass::Retryable`（去后缀，避免内部习惯暴露）

### 1.3 Event API model（Projection ≠ State 红线守护）

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiEventEnvelope {
    pub kind: String,
    pub session_id: Option<String>,
    pub severity: String,   // "observation" / "critical" — EventSeverity 字符串化
    pub ts_ms: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiProjectionResponse {
    pub snapshot_kind: ApiProjectionKind,  // 枚举守门: 绝不被误作 authoritative state
    pub total: usize,
    pub kind_counts: BTreeMap<String, usize>,
    pub session_states: BTreeMap<String, String>,
    pub session_failures: BTreeMap<String, usize>,
    pub has_critical: bool,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiProjectionKind {
    /// 强制序列化字段 = "event_projection_snapshot": API 消费者凭此标识知"非权威"
    EventProjectionSnapshot,
}
```

`ApiProjectionKind` 是**防误用守门**——任何返回 ApiProjectionResponse 的端点必须序列化此字段为 `"event_projection_snapshot"`，防止客户端误作权威状态（NOTE-1 红线）。

## 2. Idempotency 持久化边界契约（仅契约，非实现）

```rust
/// External 提交幂等键的契约承诺 (API 文档级; 不引入持久化实现)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiIdempotencyBoundary {
    /// 当前实现承诺: 进程内 idempotency (0.7C-4 Foundation)。
    pub current_backend: ApiIdempotencyBackend,
    /// 跨重启/跨进程承诺 (本 change 不实现, 仅契约冻结)。
    pub durable_persistence: ApiPersistenceOption,
    /// 跨重启后已知 command_id 的语义承诺 (供 API 文档生成)。
    pub cross_restart_semantics: ApiCrossRestartSemantics,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiIdempotencyBackend {
    ProcessLocal,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiPersistenceOption {
    /// 实现阶段二: durable log / SQLite
    DurableLogDeferred,
    /// 实现阶段三: 外部 KV/Redis
    ExternalKvDeferred,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiCrossRestartSemantics {
    /// 重启后同 command_id 视为新命令实例 (当前)
    RestartBreaksReplay,
    /// 持久化后同 command_id 重放 (后续阶段)
    RestartAllowsReplay,
}
```

**三选项对勘公开化**（终审要求"暴露"非"隐藏"）：API 文档/健康端点可序列化此契约让消费者明辨"当前能力边界"——**避免未来悄悄切换实现被消费者无感**。

## 3. 三平面映射表

| 内部平面 | API 模型 | 命名解耦 | Idempotency 边界 |
|---|---|---|---|
| Query → RuntimeQuery::get_X | ApiX (`to_api_X` 纯转换) | 字段名与 RuntimeState 解耦；state 字符串化 | N/A |
| Command → command::dispatch + idempotency::dispatch | ApiCommandRequest → ApiCommandResponse | ApiCommandStatus ≠ CommandStatus（不暴露 Executed/Failed 二分；用 classification）；独立 command_id 字符串 | ApiIdempotencyBoundary 契约 |
| Event → RuntimeEventLog.drain → project | ApiEventEnvelope + ApiProjectionResponse | snapshot_kind="event_projection_snapshot" 防误用；severity 字符串化 | 进程内（投影非跨重启） |

## 4. 测试矩阵（api_rt_01_*，feature=mock，8 项单元测试）

| 测试 | 覆盖 |
|---|---|
| `api_rt_01_boundary_no_vendor_imports` | **API-BOUNDARY-01** 白盒：静态扫描 api_boundary.rs 全部 `use` 行禁 `backend`/`gstreamer`/`decklink`/`ffmpeg`/`pipeline::`/`provider::` 实现路径（终审批准） |
| `api_rt_01_no_transport_no_persistence` | **终审禁清单 11 项零偷渡**：静态扫描生产代码（剔除注释/测试模块）禁 `axum`/`hyper`/`TcpListener`/`OpenAPI`/`Sqlite`/`Redis`/`Kafka`/`ApiResponse` 等 |
| `api_rt_01_api_models_decoupled_from_runtime_types` | 红线白盒：serde 反向断言——`ApiCommandStatus` 不暴露 `failed`；`ApiErrorClass` 去 `_failure` 后缀（不出现 `retryable_failure`）；`ApiProjectionResponse` 必含 `snapshot_kind` 守门 |
| `api_rt_01_api_command_status_no_failed_state` | `ApiCommandStatus` 4 态穷举序列化均不含 `failed`（失败归因经 classification 传达）；`ApiErrorClass` snake_case 命名解耦（`retryable`/`permanent`） |
| `api_rt_01_api_projection_kind_enforced` | `EventProjection → ApiProjectionResponse` 序列化 `snapshot_kind` 必为 `"event_projection_snapshot"`（NOTE-1 守门，防伪装权威态） |
| `api_rt_01_to_api_query_models` | `to_api_query_snapshot` 空 snapshot 全字段 + 值域；`ErrorClassification → ApiErrorClass` 5 类闭包映射齐全 |
| `api_rt_01_api_command_request_field_shape` | `ApiCommandRequest` 字段形状：command_id 非空、kind 三词表、target 二选一（Session/SessionById）、requested_by 非空；Session target intent JSON 透传 |
| `api_rt_01_idempotency_boundary_contract` | 三选项对勘公开化：默认 boundary = ProcessLocal/DurableLogDeferred/RestartBreaksReplay；全部枚举变体稳定 snake_case 序列化名锁定 |
| 真机 EXTERNAL-API-RT-01（Hardware） | gate 段：真机 `RuntimeQuery.get_runtime_state()` → `to_api_query_snapshot` 序列化往返 + `ApiProjectionResponse`/`ApiIdempotencyBoundary` 序列化守门校验 + 全门禁回归 |

## 5. 不做（终审 NOTE + probe 锁定）

- transport 实现（HTTP/RPC server——下一 change，std-only 纪律）
- durable 持久化实现（SQLite/Redis/Kafka——禁令延续；本 change 仅契约）
- API Resource Model = Runtime Resource Model 投影（违反 NOTE-3）
- `REST handler → serialize Rust struct`（违反 NOTE-2）
- EventProjection 替代 CanonicalRuntimeState（违反 NOTE-1；snapshot_kind 守门）
- 大依赖（axum/hyper/tower/grpc）
- CommandId 持久化实现（仅契约冻结）
- 万能 API DTO（禁万能 struct 加严红线）
- 任何 Runtime 内部 enum 原样暴露

## 6. 红线延续

- 0.7 全阶段最高红线：Observation≠Configuration / Semantic Intent≠Execution Plan / Canonical 不绑回 Vendor
- 0.7B 加严红线：禁万能 struct（API 模型字段仅由消费语义驱动）
- 0.7C-3 不可执行性第一红线：API 模型不携带任何执行字段
- 0.7C-5 三平面分离红线：API 模型各自独立 enum，不聚合"万能 ApiResult"
- 0.7C-6 NOTE：EventProjection 不得取代 CanonicalRuntimeState（snapshot_kind 守门）

**API-BOUNDARY-01 白盒门禁（终审 0.7C-6 批准）**：api_boundary.rs 不得 `use` `backend` / `gstreamer` / `decklink` / `ffmpeg` / `pipeline` (implementation) / `provider` (implementation)。允许消费：`canonical` types / `runtime_state` (Canonical 子项) / `runtime_query` 输出 / `command` 公开模型（envelope/outcome/status/classification 经 to_api_* 纯函数） / `idempotency` outcome（IdempotentDispatch 终态经 to_api_* 映射） / `error_model` ErrorClassification（to ApiErrorClass） / `event_projection` EventProjection（to ApiProjectionResponse，snapshot_kind 守门）。**API 层是消费者，不反向修改这些模型**。

**终审 0.7C-6 禁清单（开工边界冻结）**：本 change ❶ ❷ ❸ ❹ ❺ ❻ ❼ ❽ ❾ ❿ ⓫ ⓬——参见 proposal.md "明确不做"。本 change 仅为 API Contract / Boundary Foundation，不是 Web Server。