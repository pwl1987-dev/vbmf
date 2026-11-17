# Tasks: Phase 0.7C-4 — p07c-idempotency

四栏纪律：`Contract: 已有(引用冻结文档节号) / Implementation / Verification / Gate`。

## 1. 语义冻结（design.md §1/§5）
- [x] D9-A fingerprint 组成冻结：参与=kind+target；不参与=command_id/issued_at_ms/requested_by（含理由）
      Contract: 终审 0.7C-3 Gate §8（"command_id + command kind + canonical target/payload 一致性"）
      Implementation: design.md §1 + `CommandFingerprint`/`fingerprint()` 纯函数
      Verification: `idem_rt_01_fingerprint_semantics`
      Gate: IDEMPOTENCY-RT-01 Unit 层
- [x] 两平面分层冻结：CommandStatus 四态零改动；IdempotentDispatch 四出口 {Executed, Replayed, Conflict, Rejected}
      Contract: 终审 0.7C-3 Gate §10（Error Model 不被吞——0.7C-5）
      Implementation: design.md §5
      Verification: `idem_rt_01_vocabulary_snapshot` + command.rs 词表快照零改动回归
      Gate: IDEMPOTENCY-RT-01 Unit 层

## 2. Atomic Claim 与执行（design.md §2）
- [x] D9-C 原子 claim：锁内 check-and-insert；执行锁外；catch_unwind 终态兜底；poison 恢复
      Contract: 终审 0.7C-3 Gate §9（禁 check-then-act；Atomic Claim → first claimant executes）
      Implementation: `CommandIdempotency::dispatch` 步骤 1-5
      Verification: `idem_rt_01_validate_rejected_does_not_claim` + `idem_rt_01_concurrent_duplicate_single_execution`
      Gate: IDEMPOTENCY-RT-01 Simulation 层
- [x] D9-E 并发裁决：8 线程 barrier 击穿——恰一次执行 + 其余 replay + 会话数 1
      Contract: 同上（§9 竞态图）
      Implementation: design.md §5
      Verification: `idem_rt_01_concurrent_duplicate_single_execution`
      Gate: IDEMPOTENCY-RT-01 Simulation 层

## 3. Replay 与 Conflict（design.md §3/§4）
- [x] D9-D result replay：原 outcome 逐字节重放；Failed 同样 replay；重复≠重新执行（stop 案例）
      Contract: 终审 0.7C-3 Gate §9（duplicates replay result）
      Implementation: `RecordState::Completed` + `Replayed` 出口
      Verification: `idem_rt_01_execute_once_and_replay` + `idem_rt_01_stop_replay_not_reexecute`
      Gate: IDEMPOTENCY-RT-01 Simulation 层
- [x] D9-B payload conflict：同 id 异 payload → Conflict（不执行/不改写原记录）
      Contract: 终审 0.7C-3 Gate §8（ID reuse 绝不能 already executed）
      Implementation: `Conflict{command_id, expected, actual}` 出口
      Verification: `idem_rt_01_payload_conflict`
      Gate: IDEMPOTENCY-RT-01 Simulation 层

## 4. 红线延续（design.md §6）
- [x] 不可执行性 + Query/Command 分离 + 无万能 Executor 白盒
      Contract: 0.7C-3 三重守护 + 0.7 三红线
      Implementation: 类型仅 canonical；零 runtime_query 引用；包住 command::dispatch 不侵入
      Verification: `idem_rt_01_non_executability_surface`
      Gate: IDEMPOTENCY-RT-01 Unit 层

## 5. 接线与真机（design.md §8）
- [x] main.rs：mod idempotency + SESSION_LIFECYCLE 幂等段（COMMAND-CONTRACT-RT-01 → IDEMPOTENCY-RT-01：Executed/Replayed/Conflict 逐步输出 + 会话数断言）
      Contract: PHASE_IMPLEMENTATION_MAP §3（Idempotency 项）
      Implementation: main.rs gate 段升级
      Verification: 盒上 `VBMF_SESSION_LIFECYCLE=1` 真机跑
      Gate: IDEMPOTENCY-RT-01 Hardware 层 + SESSION/RESOURCE-RT-01 回归
- [x] 五套 feature 编译不回退 + 盒上全矩阵（fmt/test×4/clippy×4/build×3/PROOF）
      Contract: CI 七 checks 口径
      Implementation: 无 feature 门控新依赖
      Verification: p07_verify.sh 全绿
      Gate: PR required checks

## 6. 文档与收尾
- [x] Phase Map：0.7C-4 行 COMPLETE（tag）；0.7C 行下一项 = Error Model → Event Projection → External API
      Contract: PHASE_IMPLEMENTATION_MAP=唯一 SoT（文档漂移=P0）
      Verification: 文档对账
      Gate: verify
- [x] 债表：D9 → CLOSED@0.7C-4，按 D9-A/B/C/D/E 逐项引用测试证据（防假关闭）
      Contract: 终审 0.7C-3 Gate §11
      Verification: PHASE_0_7A_POST_MERGE_DEBT.md
      Gate: verify
- [x] verify（0 CRIT/0 IMP 目标）→ archive 7/7 → PR → merge → tag phase-0.7C4-idempotency → 删分支
