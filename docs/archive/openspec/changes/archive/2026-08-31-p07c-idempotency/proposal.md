# Change: Phase 0.7C-4 — p07c-idempotency（Idempotency Foundation：什么叫"同一个命令"）

## Why

0.7C-3 交付 Command Contract（envelope 携带 `command_id` 幂等键**占位**）；终审（2026-08-31，master=7de969b）批准进入 **Idempotency Foundation**，并给出核心裁定：**重点不是"实现一个幂等存储"，而是先冻结"什么叫同一个命令"的语义，以及并发重复请求的裁决规则**。终审明确反模式：①`HashMap<CommandId, bool>` 式假关闭；②check-then-act 竞态（两个请求同时 `exists=false` → 双执行）；③同 id 不同 payload 简单返回 "already executed"（ID 复用/语义碰撞）。D9 在本 change 必须具体化为 **D9-A~E** 并全部锁死。

## What Changes

- **`src/idempotency.rs`（新，Command 平面）**——`CommandId → Canonical Command Fingerprint → Atomic Claim → Execute once → Persist Outcome → Duplicate → Replay/Conflict` 全链：
  - **D9-A command identity**：`CommandFingerprint = kind 判别式 + CommandTarget 的 canonical serde JSON`（确定性纯函数 `fingerprint(&envelope)`）。**参与**：kind + target（canonical payload）；**不参与**：`command_id`（查表键本身）、`issued_at_ms`（投递时刻元数据，重试会变，非命令语义）、`requested_by`（审计标签，非负载语义）。同 id + 同 fingerprint = 同一命令（重复投递）；同 id + 不同 fingerprint = **ID 复用/语义碰撞**。
  - **D9-B payload conflict**：`StartSession(id=X, intent=A)` 后收到 `StartSession(id=X, intent=B)` → **Conflict** 出口（携带 expected/actual fingerprint），绝不 replay、绝不执行第二个 payload；原记录原样保留（此后同 A 的重复仍可 replay）。
  - **D9-C atomic claim**：单锁 `Mutex<HashMap<CommandId, Record>>` + `Condvar`——claim（check-and-insert）在锁内**原子**完成，first claimant 在锁外独占执行，完成后落终态并 `notify_all`；**非 check-then-act**。validate 拒绝不写表不占 id（不可执行的请求未进入系统）。claimant panic 防御：`catch_unwind` → 终态 Failed（防等待者死等）；Mutex poison 用 `into_inner` 恢复。
  - **D9-D result replay**：`Record: InFlight{fingerprint} → Completed{fingerprint, outcome}`；重复请求等待/读取终态后 `Replayed(原 outcome)`——**Failed 结果同样 replay**（同一命令重放同一失败；重试语义属 Error Model/调用方新 command_id，本 change 不做）。
  - **D9-E concurrent duplicate**：N 线程同时 dispatch 同 envelope——恰一次执行 + 其余 replay 原结果（线程级击穿测试锁定）。
  - **两平面分层（不吞 Error Model）**：0.7C-3 冻结的 `CommandStatus` 四态**零改动**（执行状态平面）；新增 `IdempotentDispatch` 四出口 `{ Executed, Replayed, Conflict, Rejected }`（**幂等裁决平面**）——词表快照测试防静默加出口（InProgress/AlreadyApplied/Retryable 等细分属 0.7C-5 Error Model）。
- **门禁 IDEMPOTENCY-RT-01（三层）**：Unit（fingerprint 语义冻结/词表快照/allowlist 白盒）；Simulation（execute-once + replay + failed-replay + conflict + validate-不占 id + 8 线程并发击穿 + stop 重复 replay 非 re-execute）；Hardware（真机 SESSION_LIFECYCLE 追加幂等段：Start Executed → 同 envelope 重发 Replayed → 同 id 换 intent Conflict → observe 10s → Stop/Release 幂等路径 Executed）。
- **CI**：测试并入现有矩阵（不新增 required check）。

## Capabilities

（`skip_specs: true`——SoT 为终审 0.7C-3 Gate §8-§11（D9-A~E 定义）+ PHASE_IMPLEMENTATION_MAP §3。）

## Impact

- 编译：五套 feature 不回退；idempotency.rs 零 vendor 依赖、零 runtime_query 引用（Query/Command 分离延续）。
- 受影响：新 `idempotency.rs`；`main.rs`（mod + SESSION_LIFECYCLE 幂等段升级 COMMAND-CONTRACT-RT-01 → IDEMPOTENCY-RT-01）；Phase Map（0.7C-4 行）；债表（D9 → CLOSED@0.7C-4，按 D9-A~E 逐项引用证据）。Session/Resource/Lease 语义零变更（幂等层包住 command::dispatch 薄映射，不改 0.7C-3 冻结面）。
- **明确不做**：Error Model（Rejected/Failed/Duplicate/Conflict/InProgress/Retryable 的统一错误分类——0.7C-5）；Retry；Event/Event Projection；REST/WebSocket/External API；Scheduler/Command Bus/Kafka/NATS；跨进程/跨重启持久化幂等（进程内内存表，与 InMemoryLeaseManager 同决策级别；容量驱逐策略——幂等记录不可随意驱逐否则 replay 退化成重执行——留 External API 阶段决策）；不新增命令词表。
