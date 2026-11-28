# 架构决策日志 — Phase 0.6 Architecture Contract FROZEN（Implementation Gate NOT PASSED）

> 一句话裁决：**先冻结四层契约，再过 ARCH-PORTABILITY-01 + ARCH-BACKEND-01 两门禁，通过后才把 BMD/GStreamer 降级为 Reference Adapter；此步完成前不进 Normalize、不进 BMD-specific 开发。**
> 详细载体：[`IMPLEMENTATION_ADDENDUM.md`](./IMPLEMENTATION_ADDENDUM.md)；讨论脉络：[`REVIEW_2026-08-28.md`](./REVIEW_2026-08-28.md)。

## 1. 决策上下文
- 输入 PRD 201 条混含四类（主架构/PRD/EngSpec/Acceptance），需逐条核对合理性。
- 约束：V0.2 LOCK FINAL，架构改动走 V0.3；当前 `services/media-agent` 应定位为 **Canonical Media Runtime**，BMD/GStreamer 仅是当前 Reference Implementation。

## 2. 201 条核对结论摘要
| 类别 | 结论 |
|---|---|
| 绝大多数功能条目 / 工程规格 | 成立（与已闭环硬件发现层一致） |
| 「Domain 语义全部已实现」 | 不成立（过头）—— V0.2 已定义但 Rust 层未落地 |
| 「201 条无一与 V0.2 冲突」 | 证据不足 → 严谨为「已知范围不冲突」，架构改动仍须 V0.3 |
| #20 Format「过度设计」 | 混淆冻结契约与完整实现；冻结契约必要 |

## 3. 二次评审 → 修正点
1. Domain 全实现过头（V0.2 语义已定义，Rust 实现未落地）。
2. 冲突证据不足，架构改动须 V0.3 拍板。
3. #20 冻结契约 ≠ 过度设计。
4. PRD 应拆 主架构/PRD/EngSpec/Acceptance 四类。
5. 「无消费方不建抽象」精确界：P0 冻结 / P1 定边界 / P2 暂缓。

## 4. 最终裁决要点
- **四层**：Canonical Domain → Runtime Contracts/SPI → Runtime Orchestration → Concrete Adapters。
- **P0**：Domain Boundary / HardwareProvider SPI / MediaBackend SPI / RuntimeBinding / Canonical Error-Event / Session Ownership(只冻结) / Portability Gate。
- **P0.5**：Resource Model（Capability/Capacity/Availability/Allocation/Reservation，对齐 V0.2 §3.11 Resource Vector，Resource≠Device）。
- **P1**：Clock / Timecode / Audio Backend-Routing / Capability Negotiation / Encoder / Gateway（只定 Contract）。
- **P2**：DB / Queue / ObjectStore / Auth / Deployment（连契约暂缓）。
- **门禁**：ARCH-PORTABILITY-01（删 BMD Provider 仍能编译——当前编译不过）、ARCH-BACKEND-01。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- **子阶段**：0.6A~0.6G（P0/P0.5）→ 0.7（P1：Audio/Clock/Timecode/Capability/Encoder/Gateway + External Integration）→ 0.8（P2 Multi-site/Federation）。

## 5. 影响范围
- 新增 6+1 契约文档（本目录）作为 Phase 0.6 门禁依据。
- Rust 实现层需消除 `main/resolver/signal/pipeline` 对 `decklink/gstreamer` 的直接依赖（当前编译不过，是 P0 缺口）。
- 不修改 `ARCHITECTURE_V0.2.md` 任何语义。

## 6. 关联索引
- 综合契约：`IMPLEMENTATION_ADDENDUM.md`
- 讨论留档：`REVIEW_2026-08-28.md`
- 契约门禁：`IMPLEMENTATION_BOUNDARIES.md` / `HARDWARE_PROVIDER_CONTRACT.md` / `MEDIA_BACKEND_CONTRACT.md` / `RUNTIME_RESOURCE_MODEL.md` / `CANONICAL_MEDIA_MODEL.md` / `TECHNOLOGY_PORTABILITY_MATRIX.md` / `VENDOR_NEUTRALITY_RULES.md` / `CANONICAL_IDENTITY.md` / `RUNTIME_TOPOLOGY_CONTRACT.md`

## 7. Final Hardening（2026-08-28 第三轮审查，用户裁决）
> 用户重新核对 GitHub master 上的 Master PRD / Addendum / Canonical Model / Session/Resource/Provider Contract / V0.2，结论：**方向正确、文档基本对齐，但仍差一轮 Architecture Contract Coherence Fix，不能直接宣布 Freeze**。
- **不推翻现有 PRD**，只修硬冲突（非重做）。
- 新建 `CANONICAL_IDENTITY.md`：统一 ID Vocabulary（`DeviceId`/`PortId`/`SessionId`/`ResourceId`/... + `IdentityStrength`/`Source`/`Scope`/`Stability`）；明确 `DeviceHandle`/`PersistentId` 是 **Provider Identity**，须经 Adapter 映射为 Canonical `DeviceId`（解决 BMD 身份泄漏风险，#1/#2）。
- 新建 `RUNTIME_TOPOLOGY_CONTRACT.md`：PhysicalConnection / LogicalRoute / Topology 分离（#6）。
- `SessionId` 由 `PersistentId` 改为 `SessionId(Uuid)`，冻结 Session Creator/Owner/Terminator（#3/#4）。
- Resource 加 `parent_resource_id`，严格区分 Resource/Vector/Constraint/Token 四概念（#5）。
- 统一阶段：0.6 = P0/P0.5 only，0.7 = P1（Audio/Clock/Timecode 从 0.6 移入 0.7，仅冻结 Contract 边界），0.8 = P2（#5 阶段矛盾）。
- Provider `open()` 收窄为 `open_input`/`open_output`（收 resolved request，不收整个 Manifest）；Backend `plan/build` 收窄为 `instantiate/start/stop/recover/observe`（#15/#17）。
- 统一术语：CONTRACT STATUS / IMPLEMENTATION STATUS / GATE STATUS（#13/#14）。
- **状态降级**：本文档标题由 "Runtime Abstraction Freeze" 改为 "Contract Coherence — Final Hardening"；待本轮硬冲突修复 + 过 `ARCH-PORTABILITY-01`/`ARCH-BACKEND-01` 门禁后，正式宣布 `PHASE-0.6-RUNTIME-ABSTRACTION-CONTRACT-FROZEN`，再进入 0.6 实施 → Normalize。

## 8. 第四轮审查 → 正式 Freeze（2026-08-28）
> 用户按 GitHub master 实际内容复核（非「看 201 条」），结论：**方向正确，但文档自洽 + 与代码状态仍不一致，须再做一轮收敛后正式 Freeze**。
- 采纳的合理建议（全部落地，commit 见 `REVIEW_2026-08-28.md` §9）：
  - 统一状态模型 → `DOCUMENT_STATUS_MODEL.md`（CONTRACT/IMPLEMENTATION/VERIFICATION/GATE 四类正交）。
  - Implementation Gap Matrix → `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`。
  - Acceptance Matrix → `PHASE_0_6_ACCEPTANCE_MATRIX.md`。
  - Runtime Lifecycle Sequence → `RUNTIME_LIFECYCLE_SEQUENCE.md`（含失败释放责任）。
  - V0.2↔0.6 Crosswalk + ADR-001（DeviceToken BMD_* 不扩展为 Vendor Identity）→ `V0_2_TO_PHASE_0_6_CROSSWALK.md`。
  - Provider-local Identity Precedence（非 Global）；Canonical DeviceId/PortId 生成规则（namespace/normalization/collision/migration）；Port 身份层级（Unknown 禁伪造）。
  - Aggregate Boundary + State Mutation Boundary（owner 拥有合法状态变更 API）。
  - TopologyEvidence + 时间维度；Reservation 生命周期状态机；Resource 层级 mutation。
  - Backend 不得自行获取未注册资源；Provider Discovery/Control 概念分离。
  - 四事件分层（RuntimeEvent/ExternalEvent/AuditEvent/SecurityEvent）。
- **正式宣布**：`PHASE-0.6-RUNTIME-ABSTRACTION-CONTRACT-FROZEN`（Architecture Contract FROZEN）。但 **Implementation Gate = NOT PASSED**（ARCH-PORTABILITY-01/BACKEND-01 编译不过），须先过门禁才进 0.6 实施 → Normalize。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- **明确**：Architecture Freeze ≠ Implementation Freeze；文档存在 ≠ 代码实现（见 GAP MATRIX）。
- 暂停继续新增 PRD/契约（避免「每发现一个问题就新增一份 PRD」循环）；进入纯实现阶段。
