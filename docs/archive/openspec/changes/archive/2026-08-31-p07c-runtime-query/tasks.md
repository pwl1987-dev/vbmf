# Tasks: Phase 0.7C-2 — p07c-runtime-query

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。证据规范（终审 §七）：commit + test name + command + result。

## 1. Runtime Query Model（runtime_query.rs 新）

- [x] 1.1 RuntimeQuery 只读门面（get_/list_ 全集; 零新 DTO——返回既有类型; Pure Read 白盒 allowlist）
  - Contract: 终审 §十二/§十四 (Pure Read / Snapshot Semantics) | Implementation: Complete | Verification: Test(白盒+路径) | Gate: Pass
- [x] 1.2 D14/D15 契约标注（snapshot 非事务一致; PortId ≠ media flow）
  - Contract: 终审 §四/§五 | Implementation: Complete | Verification: Test(文档契约编译) | Gate: Pass

## 2. D6 Backend Capability

- [x] 2.1 Capability projection（DeviceCapabilities → DeviceCapabilitiesSummary 进 DeviceRuntimeState）
  - Contract: BACKEND-CAPABILITY-01 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 2.2 Preflight 硬判定（can_input=Unsupported ⇒ FAIL; Unknown ⇒ WARN 不臆造）
  - Contract: BACKEND-CAPABILITY-01 (hard decision) | Implementation: Complete | Verification: Test(三态) | Gate: Pass

## 3. 门禁 RUNTIME-QUERY-RT-01（三层）

- [x] 3.1 Unit: 白盒 + get_* 路径 + D6 三态
  - Contract: 本 change 门禁 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: mock 世界全查询面 + capability 投影
  - Contract: 同上 | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: SESSION_LIFECYCLE runtime_state 含 capabilities + 查询冒烟
  - Contract: 同上 | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 交付

- [x] 4.1 盒上全矩阵 + CI 七 checks + 真机 SESSION/RESOURCE-RT-01 回归
  - Contract: 盒上绿≠CI绿 | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.2 债务表 D6 CLOSED + D14/D15 登记 + Phase Map 0.7C-2 行 → verify → archive → PR#9 → tag phase-0.7C2-runtime-query → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口确认

- 不做: External API/REST/命令动词/Idempotency/Event Projection/SDK 深探针/D14·D15 实现。

## 收口证据 (2026-08-31)

- 盒上最终矩阵: fmt 0 · test **138/138/165/138** · clippy -D ×4 零警告 · build ×3 · PROOF PASS; 真机 SESSION/RESOURCE-RT-01 回归 ALL PASS。
- RUNTIME-QUERY-RT-01 三层: Unit (Pure Read 白盒 allowlist + 命令动词禁入 / get_* 命中与幽灵 None / D6 三态) / Simulation (mock 世界全查询面 + capability 投影 + 会话生命周期投影) / Hardware (真机 runtime_state 含 capabilities 投影——真机 DeviceCapabilities 未探测 → Unknown 合法, absence≠evidence)。
- 迭代: RQ1 (types 首轮断言失败未写盘—长补丁教训再现, 已分段修复) → RQ2 (import) → RQ3 (fixture 空数组) → RQ4 (borrow) → RQ5 (needless borrow) → RQ6 全绿。
