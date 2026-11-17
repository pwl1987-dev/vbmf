# Tasks: Phase 0.7C-3 — p07c-command-contract

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。

## 1. Command Contract（command.rs 新）

- [x] 1.1 CommandKind 封闭词表（Start/Stop/Release 三命令）+ CommandEnvelope/CommandId/CommandTarget + serde + 词表快照
  - Contract: 终审 §七 (vocabulary/envelope/target) | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.2 CommandOutcome/CommandStatus 四态 + CommandRejection
  - Contract: 终审 §七 (result/error) | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.3 validate() 纯函数（形状校验; 不触 Runtime; validation/execution 分离）
  - Contract: 终审 §六 (Validation 分离) | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.4 dispatch() 薄映射 boundary（match 三臂 → SessionManager 公共 API; 无 Executor/Bus）
  - Contract: 终审 §六/§七 (lifecycle boundary; 禁万能 Executor) | Implementation: Complete | Verification: Test+Simulation | Gate: Pass

## 2. 红线守护

- [x] 2.1 不可执行性三重守护（类型层 canonical-only / serde 反向断言 / allowlist+denylist）
  - Contract: 终审执行令 (第一红线: Command 不携带执行细节) | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 2.2 Query/Command 分离白盒（两模块互不 import）
  - Contract: 终审 §六 | Implementation: Complete | Verification: Test | Gate: Pass

## 3. 门禁 COMMAND-CONTRACT-RT-01（三层）

- [x] 3.1 Unit: 词表快照 / serde 不可执行断言 / allowlist / validation 拒绝路径
  - Contract: 本 change 门禁 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: mock 世界三命令经 envelope 全生命周期 + Rejected/Failed 路径
  - Contract: 同上 | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: 真机 SESSION_LIFECYCLE command 驱动段（与直接路径等价）
  - Contract: 同上 | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 交付

- [x] 4.1 盒上全矩阵 + CI 七 checks + 真机回归不退
  - Contract: 盒上绿≠CI绿 | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.2 Phase Map 0.7C-3 行 → verify → archive → PR#10 → tag phase-0.7C3-command-contract → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口确认

- 不做: Idempotency/Retry/Event/REST/WS/Scheduler/Command Bus/Kafka·NATS/万能 Executor/新命令词表扩展。

## 收口证据 (2026-08-31)

- 盒上最终矩阵: fmt 0 · test **138/138/170/138** · clippy -D ×4 零警告 · build ×3 · PROOF PASS; 真机 SESSION/RESOURCE-RT-01 回归 ALL PASS。
- COMMAND-CONTRACT-RT-01 三层: Unit (词表快照 / serde 不可执行断言注记 pipeline 为 canonical intent 冻结键名 / allowlist / validation 四拒绝路径) / Simulation (三命令 envelope 全生命周期 + Rejected 不触 Runtime + Failed 路径) / **Hardware (真机 envelope 驱动 start→observe 10s(running=true)→stop→release 全 Executed, 与直接路径等价)**。
- 迭代: CC1 (banned 列表含 canonical 冻结键名 pipeline + create intent move) → CC2/3 (clone) → CC4 (enum_variant_names allow) → 全绿。
