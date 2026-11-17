# Design: Phase 0.7B Consolidation — p07b-consolidation

## Context

终审确认：代码主线健康（PR#1-#6 全 merged、六 tag 完整、0.7B 四基础齐备），但文档 SoT 漂移为 P0。Integration Audit 已完成（代码级，三区全 CLEAN）。DOCUMENT_STATUS_MODEL 的铁律是"文档存在≠代码实现；实现进度 SoT=Gap Matrix"——本次把该铁律反向应用：**实现前进后，状态 SoT 必须回写**。

## Goals / Non-Goals

**Goals:** Phase Map 冻结 + 五文档状态对账 + Audit 报告落盘 + 债务重分类 + 0.7C 前置顺序声明。
**Non-Goals:** 改冻结语义/V0.2；写代码；做 0.7C；清偿债务（只分类）。

## Decisions

- **D1 PHASE_IMPLEMENTATION_MAP.md 为唯一 Implementation 路线 SoT**：旧 PRD §5 的 0.7A-G 标签**保留原文 + 就地注记被取代**（同 P0-6 勘误先例：历史可追溯，不删改）；新地图为活文档（状态列随阶段推进更新）。
- **D2 对账只动状态字段**：PRD 契约表 / Gap Matrix IMPLEMENTATION+Gate 列 / Acceptance Matrix 结果列 / README 阶段导航 / ROADMAP 状态总览——均为状态词（NOT_STARTED→PARTIAL/IMPLEMENTED；FAIL→PASS），不触碰需求语义行。
- **D3 ROADMAP 三段式**：`Historical Architecture Roadmap`（Phase 0/0.5，LOCK FINAL 不动）/ `Current Implementation Roadmap`（0.6→0.8，指向 Phase Map，本段仅存概要+链接防双源）/ `Future Product Roadmap`（Phase 1-5/V0.3-V1.0 原文保留）。单一事实源=Phase Map；ROADMAP 不再复制细节。
- **D4 Acceptance Matrix 增补 0.7 门禁行**：SESSION-RT-01/RESOURCE-RT-01（Hardware PASS，0.7A）、NORMALIZE-RT-01（三层 PASS，0.7B-1）、MEDIA-SEMANTICS-RT-01 Clock（0.7B-2A）、AUDIO-SEMANTICS-RT-01（0.7B-2B）、TIMECODE-SEMANTICS-RT-01（0.7B-2C）——证据列指向各 verify 报告。
- **D5 Audit 报告落 reports/ 而非 architecture/**：architecture/ 只放契约与地图；审计是时点快照证据，归 `docs/superpowers/reports/`（comet 惯例），Phase Map 引用其结论。
- **D6 债务重分类标注**（不改 D 编号，加"优先级"列分组）：0.7C 前必须 = D2/D4/D5/D6（External API 依赖：资源解析 fail 硬化/端口精确化/身份绑定实查/后端能力门禁）；延后 = D1 LifecycleJournal/D3 per-claim TTL/D7 OnceLock/D9 幂等键/D10 多 Pipeline；D11 Clock Timeline 优先级上调（广播时钟天然是时间序列）；D8 EventSink 与 0.7D Event Projection 合并考虑。**D13 新登记**：timecode `observe_transitional` debug_assert（release 不强制）→ 后续 Result 化（P1 semantic hardening，不单独开 change，随 timecode 下一触碰点处理）。
- **D7 0.7C 前置顺序写死在 Phase Map**：Canonical Runtime State → Runtime Query Model → Command Contract → Idempotency → Error Model → Event Projection → External API。
- **D8 验证口径**：零代码改动 → 盒上矩阵引用 master 基线（134/134/154/134）；PR CI 七 checks 实跑为 CI 层证明；`python scripts/check_docs.py` 跑通（文档链接/数字口径校验，若规则覆盖新增文件）。

## Risks / Trade-offs

- ROADMAP 概要段与 Phase Map 存在双源风险 → D3 以"仅链接不复制"化解。
- Gap Matrix 行多、手改易漏 → 用精确锚点批量替换 + 逐行 grep 复核。
- PRD 状态行修改可能被误读为"解冻" → 每处注记显式写明"CONTRACT 仍 FROZEN；仅 IMPLEMENTATION 状态对账"。
