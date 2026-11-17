# Change: Phase 0.7C-3 — p07c-command-contract（Command Contract Foundation：请求语义，非执行计划）

## Why

0.7C-2 交付 Runtime Query Model（Pure Read）；Phase Map §3 下一项 = **Command Contract**——系统第一次拥有"改变状态的正式入口"。终审裁定：Command 绝不能是 SessionManager 内部方法的换名包装，必须先冻结契约层（vocabulary/envelope/target/参数/result/validation），且**第一红线 = Command 不可执行性**：Command 只表达"请求改变什么"，绝不携带 Backend/GStreamer/FFmpeg/DeviceHandle/Pipeline 等执行细节。这决定后续 Idempotency→Error Model→Event Projection→External API 能否保持干净。

## What Changes

- **`src/command.rs`（新，编排层）**：
  - **Command vocabulary（封闭枚举）**：`CommandKind { StartSession, StopSession, ReleaseSession }`——仅三命令（对应 SessionManager 既有 create+start / stop / close 生命周期）；**词表快照测试**防静默增删（新命令须过架构评审）。
  - **Command envelope**：`CommandEnvelope { command_id: CommandId(Uuid), kind: CommandKind, target: CommandTarget, issued_at_ms, requested_by: String }`；`CommandTarget { Session { intent: GraphRuntimeIntent }, SessionById { session_id: SessionId } }`（Start 携带 canonical intent；Stop/Release 按 id）。
  - **Command result**：`CommandOutcome { command_id, kind, status: CommandStatus, detail: Option<String> }`；`CommandStatus { Accepted, Rejected(reason), Executed, Failed(reason) }`——描述命令生命周期结果，非 Runtime 状态。
  - **Validation contract（纯函数）**：`validate(envelope) -> Result<(), CommandRejection>`——目标在场性/幂等形状基础校验（如 SessionById 的 id 非 nil、Session intent 非空设备）；**不触碰 Runtime 状态**（validation 与 execution 分离）。
  - **Command → Runtime lifecycle boundary（薄映射，非万能 Executor）**：`dispatch(mgr: &SessionManager, envelope) -> CommandOutcome`——三个命令各自一行映射（Start→create+start、Stop→stop、Release→close），错误转 `Rejected/Failed`；**无通用命令循环/插件机制/命令总线**（终审禁令）。
  - **不可执行性红线（三重守护）**：①类型层——envelope/target/outcome 字段仅 canonical 类型（GraphRuntimeIntent/SessionId/Uuid/String）；②serde 反向断言——envelope JSON 零 gst/pipeline/device_number/backend/handle/ffmpeg 字样；③公开面 allowlist（6 方法）+ denylist（execute_pipeline/configure_backend/万能 executor 类动词禁入）。
  - **Query/Command 分离白盒**：command.rs 不 import runtime_query；runtime_query 不 import command（互不引用——分离由编译结构保证）。
- **门禁 COMMAND-CONTRACT-RT-01（三层）**：Unit（词表快照/不可执行性 serde 断言/allowlist/validation 纯函数各拒绝路径）；Simulation（mock 世界三命令全生命周期经 envelope 驱动 + Rejected 路径 + Query/Command 分离断言）；Hardware（真机 SESSION_LIFECYCLE 追加 command 驱动段——envelope 走 Start→observe→Stop→Release，与直接 SessionManager 调用路径结果等价）。
- **CI**：测试并入现有矩阵。

## Capabilities

（`skip_specs: true`——SoT 为 PHASE_IMPLEMENTATION_MAP §3（Command Contract 项）+ 终审裁定。）

## Impact

- 编译：五套 feature 不回退；command.rs 零 vendor 依赖。
- 受影响：新 `command.rs`；`main.rs`（mod + SESSION_LIFECYCLE 追加 command 段）；Phase Map。Session/Resource/Lease 语义零变更（薄映射只调用既有公共 API）。
- **明确不做**：Idempotency/Retry（含 command_id 去重——envelope 携带 id 但不实现幂等语义，属下一 change）；Event/Event Projection；REST/WebSocket/External API；Scheduler；Command Bus；Kafka/NATS；**万能 CommandExecutor**；不新增命令（词表封闭在三命令）。
