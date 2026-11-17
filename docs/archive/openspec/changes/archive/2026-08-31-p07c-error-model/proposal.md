# Change: Phase 0.7C-5 — p07c-error-model（Error Model Foundation：失败归因分类，非万能 CommandResult）

## Why

0.7C-4 交付 Idempotency Foundation（第四次 Merge Gate PASS，master=317d99d）；Phase Map §3 下一项 = **Error Model**。终审（2026-08-31）已把三平面事实摆清：`CommandStatus`（执行状态）与 `IdempotentDispatch`（幂等裁决）之外，失败细分（Retryable vs Permanent）尚无归宿。**0.7C-5 第一道架构红线（终审冻结）：`CommandStatus ≠ IdempotentDispatch ≠ ErrorClassification`——绝不把三维度合成"万能 CommandResult"**。Error Model 只补第三个独立平面：失败归因分类，并接线到命令面（有消费点才算实现——接线纪律）。

## What Changes

- **`src/error_model.rs`（新，分类平面）**：
  - **封闭词表 `ErrorClassification`（五变体）**：`Rejected`（形状/契约拒绝——改请求后重发）/ `Conflict`（幂等 ID 复用——修正 id 或 payload）/ `RetryableFailure`（换时机重试同请求有意义）/ `PermanentFailure`（重试无意义）/ `Unknown`（无法归因，不臆造——D6 三态先例）。词表快照测试锁定；**不纳入** InProgress（同步 dispatch 无此终态出口，属未来 async 查询面）/ AlreadyApplied（无对应场景）/ Duplicate（= Replayed 已由幂等平面表达）——理由显式记录于 design.md §2。
  - **`classify_session_error(&SessionError) -> ErrorClassification` 纯函数**：九变体→五分类**封闭映射**（match 无通配臂——新增 SessionError 变体时编译失败，强制架构评审）。映射详表（逐臂测试锁定）：PreflightFailed→Retryable / ResourceConflict→Retryable / ResourceState→Permanent / Lease(AlreadyLeased|Expired)→Retryable / Lease(NotFound)→Permanent / UnknownSession→Permanent / InvalidTransition→Permanent / Pipeline→Retryable / BackendUnavailable→Retryable。
  - **CommandOutcome 增 `classification: Option<ErrorClassification>`（嵌套独立 enum，非合并）**：`Failed ⇒ Some(Retryable|Permanent|Unknown)`、`Rejected ⇒ Some(Rejected)`、`Executed/Accepted ⇒ None`（不变量测试锁定）。这是分类能**在错误仍为类型态的错误边界处**（dispatch 三臂的 `Err(e)` 分支）产生的唯一干净路径——事后从 `detail` 字符串恢复分类 = 字符串匹配 = 脆弱且违背纪律（design.md §3 记录选项对勘）。0.7C-3 冻结的**语义**（四态封闭/零执行字段/不可执行性）零触碰；serde JSON 演进经本 change 架构评审（词表快照同步更新）。
  - **panic 兜底对齐**：idempotency.rs claimant panic 兜底的 Failed → `classification: Some(Unknown)`（诚实不臆造）。
  - **三平面分离白盒**：ErrorClassification 零字段单元变体（serde 只含分类标签，不嵌套其他平面数据）；CommandStatus/IdempotentDispatch 词表快照零改动回归；禁 From 互转。
- **门禁 ERROR-MODEL-RT-01（三层）**：Unit（词表快照/classify 封闭映射矩阵/outcome 分类不变量）；Simulation（dispatch 全失败路径分类正确：Rejected/ghost-Permanent 等）；Hardware（真机 SESSION_LIFECYCLE 幂等段追加 classification 输出 + ghost stop 探针实证 `PermanentFailure` + 正常链路 `classification=None`）。
- **文档搭车（终审 §11 措辞裁定）**：债表 D9 行收紧为 "D9-A~E **Foundation**: CLOSED（进程内）/ External API·持久化·跨重启语义 **deferred** to External API stage"。
- **CI**：测试并入现有矩阵（不新增 required check）。

## Capabilities

（`skip_specs: true`——SoT 为终审 0.7C-4 Gate（三平面分离红线）+ 0.7C-3 Gate §10（Error Model 范围）+ PHASE_IMPLEMENTATION_MAP §3。）

## Impact

- 编译：五套 feature 不回退；error_model.rs 零 vendor 依赖、零 runtime_query 引用。
- 受影响：新 `error_model.rs`；`command.rs`（outcome 字段 + Err 分支 classify + 快照测试更新）；`idempotency.rs`（panic 兜底 classification + outcome 构造补字段）；`main.rs`（mod + gate 段 classification 输出 + ghost 探针）；Phase Map（0.7C-5 行）；债表（D9 措辞收紧）。SessionManager/SessionError 本体**零改动**（分类是纯函数投影）。
- **明确不做**：Retry 执行器；HTTP/gRPC 状态码映射（External API 阶段）；错误事件/Event Projection（0.7D，D8 同期）；CommandStatus 与 IdempotentDispatch 词表改动；InProgress/AlreadyApplied/Duplicate 词表项；**万能 CommandResult**；EventSink 解耦（D8）；SessionError 类型改动；不做纯清债（D9 措辞是下一 change 文档对账搭车项）。
