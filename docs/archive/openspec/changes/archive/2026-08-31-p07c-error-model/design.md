# Design: Phase 0.7C-5 — p07c-error-model

## 0. 红线与裁定落点

| 终审裁定 | 设计落点 |
|---|---|
| **第一道红线：`CommandStatus ≠ IdempotentDispatch ≠ ErrorClassification`，禁万能 CommandResult** | §1 三平面正交表；ErrorClassification 零字段单元变体（不嵌套其他平面） |
| Error classification 维度：Rejected / Conflict / InProgress / Retryable / Permanent | §2 词表五项 + 不纳入项的显式理由 |
| 错误分类须有真实消费点（接线纪律：只写 helper 不接线=未实现） | §3 classification 接线到 CommandOutcome（错误边界处产生） |
| "重复命令是 Rejected/Executed/新状态"的疑问（0.7C-3 Gate §10） | 0.7C-4 已答：Replayed（幂等平面）；本 change 只归因**失败**，不重表达成功 |
| D9 措辞收紧（0.7C-4 Gate §11） | §5 债表搭车任务（非纯清债——随本 change 文档对账） |

## 1. 三平面正交（红线守护结构）

```
CommandStatus        (0.7C-3, 零改动)   命令生命周期:  Accepted / Rejected / Executed / Failed
IdempotentDispatch   (0.7C-4, 零改动)   本请求裁决:    Executed / Replayed / Conflict / Rejected
ErrorClassification  (0.7C-5, 新)       失败归因:      Rejected / Conflict / RetryableFailure
                                                      / PermanentFailure / Unknown
```

- 三个独立 enum，互不 impl `From`，互不嵌套（ErrorClassification 全部为**零字段单元变体**——serde 断言序列化只含分类标签，无任何其他平面数据）。
- `CommandOutcome.classification: Option<ErrorClassification>` 是**嵌入**而非**合并**：status 语义不变；分类是失败归因的附加视图。
- 幂等层 `Replayed` 重放的 outcome 含 claimant 时的 classification——**同一命令重放同一归因**（与 D9-D 逐字节重放语义一致，天然成立）。

## 2. 词表（封闭五项）与不纳入理由

| 变体 | 语义 | 调用方动作 |
|---|---|---|
| `Rejected` | 形状/契约不满足（validate 拒绝） | 修改请求后重发 |
| `Conflict` | command_id 被不同 payload 占用（D9-B） | 修正 id 或 payload |
| `RetryableFailure` | 换时机重试同请求有意义 | 稍后重试（可结合 Query 观察） |
| `PermanentFailure` | 重试无意义（时序/状态机错误、目标不存在） | 不要再试（查 Query 修正认知） |
| `Unknown` | 无法归因（claimant panic 兜底） | 不臆造；走运维/日志（D6 三态 Unknown 先例） |

**不纳入（显式理由，防词表膨胀成万能分类）**：
- `InProgress`——0.7C-4 dispatch 是同步等待语义（Condvar 等到 Completed 才返回），当前**不存在** InProgress 终态出口；属未来 async/查询面（External API 阶段若有异步提交再过评审引入）。
- `AlreadyApplied`——无对应场景（create 幂等键命中已存在资源的场景不存在：Start 的 replay 是 D9-D 结果重放，不是效果重算）。
- `Duplicate`——不是错误；= `IdempotentDispatch::Replayed`，已由幂等平面表达。分类平面**只归因失败**，绝不重复表达成功/幂等成功。

## 3. 分类产生点：错误边界（决策 D-1 对勘）

**问题**：Retryable vs Permanent 需要结构化错误；而 0.7C-3 的 `CommandOutcome.detail` 是 `Option<String>`（类型擦除）。

- 选项 A（**选定**）：outcome 增 `classification` 字段，在 dispatch 三臂的 `Err(e: SessionError)` 分支处分类——**错误仍为类型态**，纯函数投影，零字符串匹配。
- 选项 B（否决）：事后 `classify(outcome)` 从 detail 字符串恢复——脆弱、vendor-neutral 假象、违背"文档语义>实现行为"。
- 选项 C（否决）：只提供 `classify_session_error` 纯函数库不接线——违背接线纪律（无消费点=未实现）。
- 选项 D（否决）：`IdempotentDispatch` 增分类出口——改 0.7C-4 词表平面，红线。

选项 A 触碰 command.rs 的**类型定义**（加字段），不触碰其**冻结语义**（四态封闭/零执行字段/不可执行性/validate 纯函数/dispatch 薄映射）——语义冻结 vs serde JSON 演进分开对待，本 change 即架构评审事件（两平面词表快照测试同步更新为含 classification 的断言）。

## 4. `classify_session_error` 封闭映射（九臂→五类，无通配臂）

| SessionError 变体 | 分类 | 理由（逐臂记录，测试锁定） |
|---|---|---|
| `PreflightFailed(_)` | RetryableFailure | 预检=现实 vs 请求判定（judge-only）；端口无信号/资源暂占等随时间变化。注：能力 Unsupported 子情形本质 Permanent，但分类粒度按报告整体保守判 Retryable——细化属演进项，不臆造 |
| `ResourceConflict(_)` | RetryableFailure | 资源被他会话占用，释放后可重试 |
| `ResourceState(_)` | PermanentFailure | 资源状态机拒绝（时序错误），重试同序列仍错 |
| `Lease(AlreadyLeased(_))` | RetryableFailure | 设备被占，租约释放后可再 acquire |
| `Lease(Expired)` | RetryableFailure | TTL 到期可重新 acquire |
| `Lease(NotFound(_))` | PermanentFailure | 释放不存在的租约=调用方记账错误 |
| `UnknownSession(_)` | PermanentFailure | 目标会话不存在（ghost）；真机探针实证项 |
| `InvalidTransition(_)` | PermanentFailure | 会话状态机白名单拒绝（如 close Released） |
| `Pipeline(_)` | RetryableFailure | 管线执行期错误（Supervisor 领地，0.6 起有 recover 语义） |
| `BackendUnavailable(_)` | RetryableFailure | 后端暂时不可用 |

**panic 兜底**（idempotency.rs claimant catch_unwind）→ `Unknown`（没有理由臆造 Retryable 或 Permanent）。

封闭性保障：match **无 `_` 通配臂**——SessionError 新增变体时编译失败，强制逐臂评审（与"新命令=架构评审事件"同构）。

## 5. 不变量与接线面

- `CommandOutcome` 不变量（测试锁定）：`Failed ⇒ Some(RetryableFailure|PermanentFailure|Unknown)`；`Rejected ⇒ Some(Rejected)`；`Executed/Accepted ⇒ None`。
- 接线点：①command.rs dispatch 三臂 Err 分支；②idempotency.rs panic 兜底；③main.rs gate 段输出 `classification=?` + 新增 ghost 探针步（真机实证 PermanentFailure）。
- 白盒：ErrorClassification allowlist `[classify_session_error]`；无 get_/list_/execute 动词；零 runtime_query 引用。
- 债表搭车（终审 §11）：D9 行改写为 "D9-A~E Foundation: CLOSED（进程内 Command Idempotency）/ External API·持久化·跨重启语义: deferred to External API stage"。

## 6. 测试矩阵（err-model-rt-01_*，feature=mock）

| 测试 | 覆盖 |
|---|---|
| `vocabulary_snapshot` | 五变体 serde snake_case 快照 + 零字段单元变体断言（禁嵌套平面） |
| `classify_matrix_closed_mapping` | §4 详表逐臂断言（10 case）；编译级无通配臂 |
| `outcome_invariant` | 三不变量（Failed/Rejected/Executed × classification） |
| `three_plane_separation` | CommandStatus 4 变体与 IdempotentDispatch 4 出口快照零改动回归；ErrorClassification allowlist；禁 From 互转（源码白盒） |
| `dispatch_failure_classification` | Simulation：validate 拒绝→Rejected；ghost stop→PermanentFailure；正常链→None；replay 重放含原 classification |
| 真机 ERROR-MODEL-RT-01 | Hardware：gate 段 classification 输出 + ghost 探针 `PermanentFailure` + 回归 SESSION/RESOURCE/IDEMPOTENCY-RT-01 |
