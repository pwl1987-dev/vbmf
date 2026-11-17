# VBMF 文档索引（docs/INDEX.md）

> 本文件只做**导航**，不改任何文档语义。更新规则：新增/归档文档时在此登记一行即可。
> 实时任务状态唯一入口 = `.project/STATE.md` §4–§5（用 `scripts/agent/state-scope.sh 4-5` 读取，勿通读整份）。
> 冲突时权威顺序按 `AGENTS.md`：用户最新指令 → 冻结 Architecture/Contract/ADR → `.project/STATE.md` → live `main` → 代码/测试/CI/BMD 证据 → 历史文档。

---

## L1 · 权威层（每天开工先看）

| 文档 | 地位 | 状态 |
|---|---|---|
| `.project/current-work.yaml` | 当前任务快照 | 动态 |
| `.project/STATE.md`（§4–§5） | 完整任务队列 + §3 历史 ledger | 动态（全文 2089 行，勿通读） |
| `AGENTS.md` | 智能体宪章 | 冻结 |
| `docs/agent-toolchain.md` | 命令与验证 SoR | 维护中 |
| `docs/cursor-setup.md` | Cursor 配置 | 维护中 |

## L2 · 架构与契约（docs/architecture/，CONTRACT = FROZEN 区）

### 顶层架构

| 文档 | 地位 | 状态 |
|---|---|---|
| `ARCHITECTURE_V0.2.md`（4028 行） | Runtime 语义 SoT | **LOCK FINAL**（V0.2.4） |
| `IMPLEMENTATION_ADDENDUM.md` | Phase 0.6 实现层架构补充载体 | CONTRACT = FROZEN / IN_PROGRESS |
| `TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md` | Ownership 对账 SoT | RECONCILIATION SoT |
| `DEPLOYMENT_AND_DEV_RUNTIME.md` | 部署 SoT（与 V0.2 构成三层 SoT） | 冻结 |
| `DOCUMENT_STATUS_MODEL.md` | 文档状态词统一模型（✅/LOCK/Frozen 混用终结者） | 全局规则 |
| `PHASE_0_6_MASTER_PRD.md` | 两份 PRD + 评审 + 契约的**整合权威** | 权威整合版 |
| `ARCHITECTURE_DECISION_LOG.md` | 架构决策日志 | FROZEN（Implementation Gate NOT PASSED→已推进） |

### P0 契约（Phase 0.6）

| 契约 | 状态 |
|---|---|
| `CANONICAL_IDENTITY.md` | FROZEN；§4 已实现收口（P0-1） |
| `CANONICAL_MEDIA_MODEL.md` | FROZEN（P0 Canonical Media Format） |
| `HARDWARE_PROVIDER_CONTRACT.md` | FROZEN；实现侧已收口（discover fail-closed + ProviderIdentity） |
| `MEDIA_BACKEND_CONTRACT.md` | FROZEN；trait 形状已实现收口 |
| `RUNTIME_SESSION_MODEL.md` | FROZEN；IMPLEMENTATION NOT_STARTED（声明行）→ 随 0.7A/0.7B 推进 |
| `RUNTIME_BINDING_MODEL.md` | FROZEN；IMPLEMENTATION NOT_STARTED（声明行）→ 同上 |
| `RUNTIME_RESOURCE_MODEL.md` | FROZEN；须与 V0.2 §3.11 九维 Resource Vector 对齐 |
| `RUNTIME_TOPOLOGY_CONTRACT.md` | FROZEN；IMPLEMENTATION NOT_STARTED（声明行） |
| `RUNTIME_LIFECYCLE_SEQUENCE.md` | FROZEN；时序合成图（TD-02） |
| `IMPLEMENTATION_BOUNDARIES.md` | FROZEN；实现层边界红线 |
| `VENDOR_NEUTRALITY_RULES.md` | FROZEN；厂商中立防回归守则（CI Lint 判据） |
| `TECHNOLOGY_PORTABILITY_MATRIX.md` | FROZEN；9 条替换轴 |

### P1 契约（Phase 0.7 方向）

| 契约 | 状态 |
|---|---|
| `AUDIO_ROUTING_CONTRACT.md` | FROZEN；PARTIAL（0.7B-2B 已落语义层，Routing Runtime 属后续） |
| `CLOCK_TIMECODE_CONTRACT.md` | FROZEN；PARTIAL（0.7B-2A/2C 已落，策略/解析属后续） |
| `EVENT_CONTRACT.md` | FROZEN；IMPLEMENTATION NOT_STARTED（P1） |
| `EXTERNAL_API_CONTRACT.md` | FROZEN；NOT_STARTED（P1 暂不实施） |
| `DEVICE_INTEGRATION_CONTRACT.md` | FROZEN；NOT_STARTED（P1，部分 P2） |

### 状态对账（回答"文档要求 vs 代码完成度"）

| 文档 | 地位 |
|---|---|
| `PHASE_0_6_ACCEPTANCE_MATRIX.md` | 验收集中表 |
| `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md` | **唯一完成度对账 SoT**（2026-08-30 已对齐实态：0.6 系列全落地） |
| `PHASE_0_7A_POST_MERGE_DEBT.md` | P1 债务登记 |

### 评审与过程留档（docs/architecture/ 内）

| 文档 | 地位 |
|---|---|
| `PRD_REVIEW_RUNTIME_ABSTRACTION.md` | Portability PRD 165 条逐条裁决 |
| `PRD_REVIEW_EXTERNAL_API.md` | API PRD 170 条评审；**结论：不全盘接受，#138–#170 外置 P2** |
| `REVIEW_2026-08-28.md` | 评审过程留档（非逐字原文） |
| `MEDIA_AGENT_STATE_MACHINE.md` | **HISTORICAL REFERENCE**，非现行 Runtime Contract |

## L3 · 需求源头（docs/ 根）

| 文档 | 行数 | 定位 | 采纳状态 |
|---|---|---|---|
| `docs/VBMF 下一阶段总架构升级方案 + PRD.md` | 4770 | 总纲：Vendor/Backend/Infrastructure Decoupled | 目标性文档，条款由契约承接 |
| `docs/VBMF Runtime Abstraction & Portability PRD.md` | 3900 | Runtime 内层需求（P0/P0.5） | 165 条评审采纳，落 Phase 0.6 |
| `docs/VBMF External Integration & Device Interoperability API PRD.md` | 4197 | External 外层需求（P1/P2） | **裁剪采纳**：#1–#137 可作 P1 规划，#138–#170 外置 |

## L4 · 阶段与历史

| 文档/目录 | 地位 | 状态 |
|---|---|---|
| `docs/phase-0.5/` | UX 基线（IA/Workflow/Surface/Design System） | **UX BASELINE LOCK FINAL** |
| `docs/phase-0.6/` | 可执行验收规范（A1/A2/B + 故障注入 + Health） | 验收 Harness SoT |
| `architecture/V0.3/API_MASTER_DESIGN.md` | V0.3 API 总体设计 | 顶层接口冻结 |
| `architecture/PHASE_IMPLEMENTATION_MAP.md` | 宏观实施地图 | HISTORICAL ROADMAP（实时状态只看 STATE） |
| `docs/SYSTEM_AND_PROJECT_PLAN.md` | V0.1 初始系统 + 项目计划 | 历史基线，冲突以 V0.2 为准 |
| `docs/V0.1_RETROSPECTIVE.md` | V0.1 回顾 | 历史 |

## L5 · 过程产物

| 目录 | 地位 |
|---|---|
| `docs/superpowers/` | Work Packet plans / reports。**注意：部分 plan 文档被 STATE §3 引用为 Authority 锚点，保留原路径不归档** |
| `docs/archive/comet/` | Comet 工作流（已退役）归档。内容仅作历史参考，git 历史可查，非现行 Authority |
| `docs/archive/openspec/` | OpenSpec 变更历史（含 .comet 残留）归档。同上 |
