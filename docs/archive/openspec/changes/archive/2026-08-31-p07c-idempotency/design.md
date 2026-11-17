# Design: Phase 0.7C-4 — p07c-idempotency

## 0. 冻结语义（终审 2026-08-31 裁定逐条落点）

| 终审裁定 | 设计落点 |
|---|---|
| "重点不是实现幂等存储，而是先冻结**什么叫同一个命令**" | §1 Fingerprint 语义（参与/不参与字段显式冻结 + 测试锁定） |
| 同 id + 不同 payload 绝不能简单返回 already executed | §3 Conflict 出口（独立于 Replayed，携带 expected/actual） |
| 禁 check-then-act（两请求同时 exists=false → 双执行） | §2 Atomic Claim（锁内 check-and-insert 原子；执行在锁外） |
| Atomic Claim → first claimant executes → result persisted → duplicates replay | §2 Record 状态机 + §4 replay |
| D9-A~E 具体化（防 "CLOSED 但只做了 HashMap<CommandId, bool>"） | §6 测试矩阵逐项对应 + 债表按 A~E 逐项引用证据关闭 |
| Error Model 不被顺手吞掉 | §5 两平面分层（CommandStatus 四态零改动；IdempotentDispatch 四出口） |

## 1. D9-A — Canonical Command Fingerprint（同一命令的定义）

```rust
/// canonical 命令指纹 — "什么叫同一个命令"的冻结语义 (D9-A)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandFingerprint(pub String);

/// 纯函数: envelope → fingerprint。确定性 (同输入同输出)。
pub fn fingerprint(env: &CommandEnvelope) -> CommandFingerprint;
```

组成 = `kind 的 serde 判别式（"start_session" 等 snake_case 冻结词表）` + `serde_json::to_string(&env.target)`（`CommandTarget` 为 tagged enum，字段按声明序序列化——serde struct/enum 序列化是确定性的，`Uuid`/`String` 无哈希随机性）。

**参与字段**：`kind` + `target`（canonical payload——终审原文 "command_id + command kind + canonical target/payload 的一致性"）。
**不参与字段（显式冻结）**：
- `command_id`——它是查表键本身（fingerprint 是**值**的同一性，command_id 是**请求实例**的同一性；同 id 异值 = 碰撞，见 §3）；
- `issued_at_ms`——投递时刻元数据：网络重试会重算时间戳，参与 fingerprint 会把全部重试判成冲突；
- `requested_by`——审计标签（opaque，非身份模型——0.7C-3 已冻结该注释），非负载语义。

裁决规则（冻结）：

```
同 command_id + 同 fingerprint  → 同一命令的重复投递 → Replay
同 command_id + 异 fingerprint  → ID 复用 / 语义碰撞  → Conflict（绝不 replay，绝不执行）
```

## 2. D9-C — Atomic Claim（并发安全的第一原则）

```rust
enum RecordState {
    InFlight,                          // claimant 执行中
    Completed(CommandOutcome),         // 终态（含 Failed——失败也是结果）
}
struct Record { fingerprint: CommandFingerprint, state: RecordState }

pub struct CommandIdempotency {
    mgr: Arc<SessionManager>,
    records: Mutex<HashMap<CommandId, Record>>,
    completed: Condvar,
}
```

dispatch 流程（顺序即契约）：

```
1. validate(env)            → Err: 返回 Rejected（不写表、不占 id——不可执行的请求未进入系统）
2. fp = fingerprint(env)
3. lock(records):
     a. 表无该 id            → 插入 {fp, InFlight} → 本请求是 claimant → 释放锁
     b. 有该 id 且 fp 相同:
          Completed(outcome) → 释放锁 → 返回 Replayed(outcome)
          InFlight           → condvar.wait 直到 Completed → 返回 Replayed(outcome)
     c. 有该 id 且 fp 不同    → 释放锁 → 返回 Conflict{command_id, expected(表内), actual(本次)}
                               （无论表内 InFlight/Completed——id 已被不同 payload 占用即碰撞）
4. claimant（锁外独占执行权）:
     outcome = catch_unwind(|| command::dispatch(&self.mgr, env))
                 .unwrap_or_else(|_| Failed("claimant panicked" 终态))
     lock(records) → 该 id 记录 → Completed(outcome) → notify_all
5. 返回 Executed(outcome)   （outcome.status 可为 Executed 或 Failed——执行失败也是"已执行一次"）
```

要点：
- **claim 是锁内原子 check-and-insert**——两个线程同时到达步骤 3，只有一个插入成功成为 claimant，另一个必然看到记录（Completed → replay / InFlight → 等待 replay）。不存在两个 "exists=false"。
- **执行在锁外**——claimant 执行期间不持 records 锁，无关命令的 dispatch 不被阻塞（锁只保护裁决表这个临界资源）。
- **catch_unwind + AssertUnwindSafe**——claimant 若 panic，记录仍落终态 Failed，等待者不会死等（防御性终态保障；SessionManager 各 API 返回 Result 不主动 panic，此为兜底）。
- **Mutex poison** 用 `unwrap_or_else(PoisonError::into_inner)` 恢复——记录表本身是纯数据，poison 不破坏不变量。

## 3. D9-B — Payload Conflict（ID 复用是错误，不是命中）

```rust
Conflict {
    command_id: CommandId,
    expected: CommandFingerprint,   // 表内已占用的指纹（先到的 payload）
    actual: CommandFingerprint,     // 本次请求的指纹（后到的异值 payload）
}
```

行为契约：
- **绝不执行**本次 payload（会话表/资源零变化——测试锁定）；
- **绝不改写**表内记录（原 fingerprint 的后续重复仍能 replay——测试锁定）；
- 出口信息携带两个指纹，供上层（未来 Error Model）分类 ID reuse。

## 4. D9-D — Result Replay（结果是持久事实，重复只读不执行）

- Replay 返回的是 claimant 执行时的**原 CommandOutcome**（逐字节相等——测试锁定 `assert_eq!(replayed, executed_outcome)`）。
- **Failed 同样 replay**：`StopSession(id=X, ghost)` 首次 Failed、重复 Replayed(同 Failed)——同一命令重放同一失败；"重试"是**新 command_id 的新命令**（调用方决策 + 未来 Error Model 的 Retryable 语义），本 change 明确不做。
- **重复 ≠ 重新执行**：`StopSession` 第一次 Executed（会话 → Released）后，同 envelope 重发得到 Replayed(Executed)——**不是**对已 Released 会话再 stop 一次产生的 Failed。这是幂等与"幂等方法重入"的本质区别（测试锁定）。

## 5. D9-E + 两平面分层（不吞 Error Model）

- **并发裁决**：N 线程 barrier 对齐后同时 dispatch 同 envelope → 恰 1 个 `Executed`、N-1 个 `Replayed`、全部 outcome 相等、`mgr.list().len() == 1`（§2 的必然推论，用线程级击穿测试锁定而非自证）。
- **两平面**：
  - `CommandStatus { Accepted, Rejected, Executed, Failed }`——0.7C-3 冻结的**执行状态平面**，本 change **零改动**；
  - `IdempotentDispatch { Executed(CommandOutcome), Replayed(CommandOutcome), Conflict{..}, Rejected(CommandRejection) }`——**幂等裁决平面**（本请求的 dispatch 结果），词表快照测试锁定四出口。
  - 终审列举的 `Duplicate/Conflict/AlreadyApplied/InProgress/RetryableFailure/PermanentFailure` 细分状态**不引入**——Conflict 以结构化出口表达（非字符串塞 detail），其余属 0.7C-5 Error Model。

## 6. 红线延续（0.7C-3 全部继承）

- **不可执行性**：idempotency.rs 新增类型仅含 canonical（CommandFingerprint=字符串/CommandId/CommandOutcome/CommandRejection）；serde 反向断言 banned 列表沿用 command.rs（含 `pipeline` 精化注释）；公开面 allowlist `[fingerprint, dispatch]` + 执行动词禁入。
- **Query/Command 分离**：零 `runtime_query` 引用（allowlist 无 get_/list_ 动词——同款白盒）。
- **无万能 Executor**：幂等层包住 `command::dispatch` 薄映射，不新增命令循环/插件/总线/调度。
- **command.rs 0.7C-3 冻结面零改动**（幂等层是外包装，非侵入）。

## 7. 边界（显式不做 + 决策级别）

- **进程内内存表**：单 agent 单进程（与 `InMemoryLeaseManager` 同决策级别，Mutex+Condvar 足够）；跨进程/跨重启持久化幂等不做（External API 阶段决策——重启后同 command_id 视为新命令实例）。
- **容量驱逐不做**：幂等记录不可随意驱逐（驱逐 = replay 退化成重执行，破坏 execute-once）；gate 场景命令量级极小，无界增长不构成现实风险；上界策略留 External API 阶段（记 NOTE，不新开债务编号——D9 语义已完整）。
- **时间参数不做**：无 TTL/窗口（幂等键无过期——过期语义需要时钟域决策，属 External API/调用方契约）。

## 8. 测试矩阵（idem_rt_01_*，feature=mock）

| 测试 | 覆盖 | 断言要点 |
|---|---|---|
| `fingerprint_semantics` | D9-A | 同 kind+target 稳定相等；issued_at_ms/requested_by 变化**不变**（语义冻结）；kind 变/target 变必不等；多次计算确定 |
| `vocabulary_snapshot` | 词表 | IdempotentDispatch 四出口 serde 快照（防静默加出口） |
| `non_executability_surface` | 红线 | allowlist `[fingerprint, dispatch]` 恒等；banned 执行动词/vendor 词禁入；无 get_/list_ |
| `validate_rejected_does_not_claim` | D9-C 前置 | Rejected 不写表：invalid(同 id) → 修正 valid(同 id) 仍 Executed |
| `execute_once_and_replay` | D9-D | 首次 Executed+会话1；重发 Replayed(outcome 相等)+会话仍 1；**Failed 也 replay**（ghost stop ×2 → Failed + Replayed(Failed)） |
| `stop_replay_not_reexecute` | D9-D | stop Executed 后同 envelope 重发 → Replayed(Executed)（非对 Released 再 stop 的 Failed） |
| `payload_conflict` | D9-B | 同 id 异 intent → Conflict；会话数不增；conflict 后**原** fingerprint 重发仍 Replayed（记录未被改写） |
| `concurrent_duplicate_single_execution` | D9-E | 8 线程 barrier → Executed×1 + Replayed×7；outcome 全等；会话数 1 |
| 真机 IDEMPOTENCY-RT-01 | 三层 Hardware | Start Executed → 同 envelope 重发 Replayed（会话数不增）→ 同 id 换 intent Conflict → observe 10s running=true → Stop/Release 幂等路径 Executed；回归 SESSION/RESOURCE-RT-01 |
