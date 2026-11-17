# Change: Phase 0.7C-7 — p07c-external-api（External API Foundation：API Boundary Model + Idempotency 持久化边界 + 三平面映射）

## Why

0.7C-6 Merge Gate PASS（master=`9b475c1`）。终审裁定（2026-08-31）：
- **正确顺序**：Contract Probe（只读四问，已完成 `docs/superpowers/reports/2026-08-31-p07c7-external-api-contract-probe.md`）→ **API Boundary Model（独立资源模型，非 Runtime Resource Model 投影）** → Idempotency 持久化边界裁决 → Query/Command/Event 三平面映射 → transport 实现。
- **三 NOTE**：①EventProjection 不得取代 CanonicalRuntimeState ②禁 `REST handler → serialize Rust struct`（不暴露 Rust serde tag 习惯）③API Resource Model 独立定义；transport 保持 0.7A std-only 纪律（禁 axum/hyper/tower 大依赖）。
- **PR 规模判定**：生产代码 diff 按文件白名单审核，不按 PR 总行数（Comet 归档产物不计入 scope creep）。

## What Changes

- **`src/api_boundary.rs`（新）**——独立 API Resource Model（**非 Runtime Resource Model 投影**，禁万能 struct，加严红线）：
  - 资源五件套（API 视角）：`ApiDevice`、`ApiPort`、`ApiResource`、`ApiSession`、`ApiCapability`——字段仅由 API 消费语义驱动，**不绑回** `ResourceState`/`SessionPhase` 等 Runtime 内部枚举（serde 显式映射为 API 字符串）。
  - **`pub fn to_api_X(...)` 纯转换函数**（Query 平面）：`CanonicalRuntimeState` 子项 → `ApiX`——字段命名按 API 习惯（如 `state` 用 "available"/"reserved" 等 API 友好态），**与 Rust 内部 enum 名解耦**。
  - **Command API model**：`ApiCommandRequest`（含 `command_id: String`——客户端提供，**接受任意 string 后续持久化为 UUID 内部表示**）、`ApiCommandResponse { status: ApiCommandStatus, kind: ApiKind, classification: ApiErrorClass, outcome_equal, sessions, fingerprint_conflict?, detail? }`——**ApiCommandStatus ≠ CommandStatus**（"accepted" vs `Accepted`、"rejected" vs `Rejected` 等）独立 enum，避免暴露 serde tag。
  - **Event API model**：`ApiEventEnvelope { kind, session_id?, severity, ts_ms }` + `ApiProjectionResponse { total, kind_counts, session_states, session_failures, has_critical }`——`EventProjection` 是**辅助视图**，**不替代** `CanonicalRuntimeState`（API 暴露时标注"event projection snapshot, not authoritative state"）。
  - **红线白盒**：`api_boundary.rs` 零 runtime_query/command/idempotency 公开类型依赖（仅经 `to_api_*` 纯函数读 canonical 子项构造 API 模型）；serde 反向断言禁 vendor/执行词；allowlist `[to_api_device, to_api_port, to_api_resource, to_api_session, to_api_capabilities, to_api_event_envelope, to_api_projection]`。
- **Idempotency 持久化边界裁决**（**契约层，非实现**）：`ApiIdempotencyBoundary` 文档型结构（`pub` 字段）——**External 提交幂等键的契约承诺**（API 文档级，**不引入持久化实现**，避免越界做存储层）：
  - **承诺**：External API 端持久化 `command_id → outcome` 映射；提交同 `command_id` 重发**期望**返回原 outcome（**契约**）；
  - **当前实现边界**：进程内 `CommandIdempotency` 表——**仅承诺同进程内重放**，**跨重启/跨进程持久化**留待后续 change（契约层先冻结，实现层分步）；
  - **三选项对勘公开化**：①进程内（当前）②durable log/SQLite（External API 实现阶段二）③外部 KV/Redis（实现阶段三）——本 change 仅冻结**契约**与**选项标记**，不动存储实现。
- **门禁 EXTERNAL-API-RT-01（三层）**：Unit（API 资源模型与 Runtime 内部类型解耦——serde 反向断言禁 `ResourceState`/`SessionPhase`/`CommandStatus` 等字样；API 字段快照测试；allowlist 白盒）；Simulation（Query→API 五资源转换完整字段+值域；Command API 模型字段闭包；Idempotency 契约层三选项对勘）；Hardware（真机 SESSION_LIFECYCLE gate 段追加 API 资源快照打印 + 回归全部门禁）。
- **CI**：测试并入现有矩阵。

## Capabilities

（`skip_specs: true`——SoT 为终审 0.7C-6 Gate（External API 顺序+三 NOTE）+ probe 报告 + PHASE_IMPLEMENTATION_MAP §3。）

## Impact

- 编译：五套 feature 不回退；api_boundary.rs 零 vendor 依赖，零 transport 依赖。
- 受影响：新 `api_boundary.rs`；`main.rs`（mod + 真机 gate 段追加 API 资源快照）；Phase Map（0.7C-7 行）；债表（Idempotency 持久化条目登记）。
- **明确不做**：transport 实现（HTTP/RPC server——下一 change）；durable 持久化存储实现（SQLite/Redis/Kafka 禁令延续）；API Resource Model = Runtime Resource Model 投影（违反 NOTE-3）；REST handler → serialize Rust struct（违反 NOTE-2）；EventProjection 替代 CanonicalRuntimeState（违反 NOTE-1）；大依赖（axum/hyper/tower/grpc）；CommandId 持久化实现（仅契约冻结）；万能 API DTO（禁万能 struct 加严红线）；任何 Runtime 内部 enum 原样暴露。

**终审 0.7C-6 禁清单（开工边界冻结）**：❌ Axum/Hyper/Warp/Actix/gRPC；❌ HTTP listener；❌ REST route；❌ OpenAPI generator；❌ 数据库持久化；❌ 跨重启 Idempotency；❌ Event persistence；❌ Health Reducer 完整实现；❌ 修改 Command/Query/Event 内部契约；❌ 内部 Rust DTO 直接作 API DTO；❌ `ApiResponse<T>` 万能包装；❌ 新建第二套 Runtime State。**本 change 仅为 API Contract / Boundary Foundation，不是 Web Server**。

**API-BOUNDARY-01 白盒门禁**：api_boundary.rs 不得 `use` backend / gstreamer / decklink / ffmpeg / pipeline implementation / provider implementation；允许消费 Canonical / RuntimeState / RuntimeQuery / CommandContract / Idempotency outcome / ErrorClassification / EventProjection（API 层是消费者，不反向修改这些模型）。