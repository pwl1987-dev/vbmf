# Change: Phase 0.7B Consolidation — p07b-consolidation（文档对账 + Phase Map 冻结 + Canonical Integration Audit + 债务重分类）

## Why

0.7B-2C 已合并（master `c574238`，PR#1-#6 全 merged，六个 baseline tag 完整），但**文档 SoT 与实际实现发生漂移**（终审 P0）：`PHASE_0_6_MASTER_PRD.md` 仍标 CLOCK_TIMECODE/AUDIO_ROUTING = NOT_STARTED 且沿用旧 0.7A-G 标签；`README.md` 仍述"Phase 0.6 实施中/Gate NOT PASSED"；`ROADMAP.md` 仍把 Phase 0.6 标为 **Next**；Gap/Acceptance Matrix 的 SPI/Session/Resource 行停在 NOT_STARTED、ARCH-PORTABILITY-01 停在 FAIL。同时需要回答终审核心问题：**Canonical Model 是否已成为 Runtime 统一输入契约，还是有旁路**——本次做代码级 Integration Audit 给出权威答案。**本 change 零代码改动（src/ 不触碰）。**

## What Changes

- **`docs/architecture/PHASE_IMPLEMENTATION_MAP.md`（新）**：冻结 Implementation Phase Map（0.6 Runtime Abstraction / 0.7A Session Runtime / 0.7B Media Semantics(1/2A/2B/2C) / 0.7C External Integration / 0.7D Event Projection / 0.8 Federation），声明"Implementation Roadmap，不改变冻结 Architecture Contract"；收录 **0.7 全阶段最高架构红线**（Observation≠Configuration / Semantic Intent≠Execution Plan / Canonical 不绑回 Vendor）。
- **文档对账（只修状态与路线，不修改冻结语义/原文，历史口径以就地注记保留）**：
  - `PHASE_0_6_MASTER_PRD.md`：契约状态行（AUDIO_ROUTING/CLOCK_TIMECODE → PARTIAL 等）+ 旧 0.7A-G 段加"已被 PHASE_IMPLEMENTATION_MAP 取代"注记。
  - `README.md`：阶段导航更新为当前实态（0.6 完成 + 0.7A/0.7B 完成态 + 入口指向 Phase Map）。
  - `ROADMAP.md`：状态总览重构为三段式（Historical Architecture / Current Implementation（指向 Phase Map）/ Future Product），Phase 0.6 ✅。
  - `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`：SPI/Session/Resource/Preflight/Registry/Lint 等行 IMPLEMENTATION 列与 Gate 列对齐实态。
  - `PHASE_0_6_ACCEPTANCE_MATRIX.md`：ARCH-PORTABILITY-01 FAIL→PASS（CI 六/七 gate + remove-adapter proof）、补充 0.7A/0.7B 门禁行（SESSION-RT-01/RESOURCE-RT-01/NORMALIZE-RT-01/MEDIA-SEMANTICS-RT-01/AUDIO-SEMANTICS-RT-01/TIMECODE-SEMANTICS-RT-01）。
- **Integration Audit 报告**（`docs/superpowers/reports/2026-08-30-p07b-consolidation-integration-audit.md`）：三区审计结论（Provider→Canonical 统一 / Canonical→Runtime Intent 旁路 / Canonical→Backend 直连）+ 结构性事实（Canonical 与 Runtime 目前为不相交子图，红线平凡满足；待补 Canonical→Runtime/Policy 边）+ P2 观察（Mock 无生产 canonical 路径，unification 由测试证明）。
- **债务重分类**（`PHASE_0_7A_POST_MERGE_DEBT.md`）：0.7C 前必须（D2 derive_claims FAIL 化 / D4 PortAvailability 精确化 / D5 IdentityBinding 实查 / D6 BACKEND-CAPABILITY-01）vs 可延后（D1/D3/D7/D9/D10）；D11 优先级上调说明；**D13 新登记**（`observe_transitional` 的 debug_assert release 不强制 → Result 化，P1 semantic hardening）。
- **0.7C 前置顺序声明**（Phase Map 内）：Canonical Runtime State → Runtime Query Model → Command Contract → Idempotency → Error Model → Event Projection → External API（不直接做 REST）。

## Capabilities

（`skip_specs: true`——对账与地图文档，无新能力。）

## Impact

- **零代码改动**：`services/media-agent/` 不触碰；CI 七 checks 于 PR 实跑即全矩阵证明（盒上矩阵无代码可验，引用 master 基线 134/134/154/134）。
- 受影响：`docs/architecture/{PHASE_IMPLEMENTATION_MAP(新), PHASE_0_6_MASTER_PRD, README, PHASE_0_6_IMPLEMENTATION_GAP_MATRIX, PHASE_0_6_ACCEPTANCE_MATRIX, PHASE_0_7A_POST_MERGE_DEBT}`、`ROADMAP.md`、新 audit 报告。
- 明确不做：不改任何冻结契约语义/V0.2；不写功能代码；不提前做 0.7C。
