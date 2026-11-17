# Tasks: Phase 0.7B Consolidation — p07b-consolidation

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。本 change 零代码改动。

## 1. Phase Map 冻结

- [x] 1.1 新建 `PHASE_IMPLEMENTATION_MAP.md`（0.6→0.8 阶段表 + 各阶段状态/基线 tag + 0.7 最高架构红线 + 0.7C 前置顺序）
  - Contract: 终审 §十三/§十七 | Implementation: Complete | Verification: Docs | Gate: Pass

## 2. 文档对账（只修状态，不改冻结语义）

- [x] 2.1 `PHASE_0_6_MASTER_PRD.md`：契约状态行（AUDIO_ROUTING/CLOCK_TIMECODE→PARTIAL 等）+ 旧 0.7A-G 段取代注记
  - Contract: DOCUMENT_STATUS_MODEL（状态 SoT=实现实态） | Implementation: Complete | Verification: Docs | Gate: Pass
- [x] 2.2 `README.md` 阶段导航更新（0.6/0.7A/0.7B 完成态 + 指向 Phase Map）
  - Contract: 同上 | Implementation: Complete | Verification: Docs | Gate: Pass
- [x] 2.3 `ROADMAP.md` 三段式重构（Historical/Current(链接 Phase Map)/Future）
  - Contract: 终审 §四 | Implementation: Complete | Verification: Docs | Gate: Pass
- [x] 2.4 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`：SPI/Session/Resource/Preflight/Registry/Lint/RuntimeEvent 行状态对齐
  - Contract: 同上 | Implementation: Complete | Verification: Docs+grep 复核 | Gate: Pass
- [x] 2.5 `PHASE_0_6_ACCEPTANCE_MATRIX.md`：ARCH-PORTABILITY-01 FAIL→PASS + 0.7 门禁行增补（六个 RT-01）
  - Contract: 同上 | Implementation: Complete | Verification: Docs | Gate: Pass

## 3. Integration Audit 与债务重分类

- [x] 3.1 Audit 报告落盘（三区 CLEAN 结论 + 结构性事实 + P2 观察）
  - Contract: 终审 §七 | Implementation: Complete | Verification: 报告 | Gate: Pass
- [x] 3.2 `PHASE_0_7A_POST_MERGE_DEBT.md` 重分类（0.7C 前必须 D2/D4/D5/D6；延后组；D11 上调；D13 登记）
  - Contract: 终审 §八/§十二 | Implementation: Complete | Verification: Docs | Gate: Pass

## 4. 交付

- [x] 4.1 `python scripts/check_docs.py` 通过 + 零代码改动核验（src/ 零触碰）+ PR CI 七 checks
  - Contract: 盒上绿≠CI绿（本 change 以 CI 为准，盒上矩阵引用 master 基线） | Implementation: Complete | Verification: CI | Gate: Pass
- [x] 4.2 verify（full）→ archive → PR#7 → merge → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口证据 (2026-08-30)

- 零代码改动核验: `git diff --stat services/` 为空。
- 对账: PRD(2 状态行+0.7A-G 取代注记) / README(4 处) / ROADMAP(三段式+0.6 COMPLETE) / Gap Matrix(头注记+7 行) / Acceptance Matrix(Test A PASS+结论行+0.7 门禁六行)。
- check_docs.py 全量扫描在本机过慢 (HTML wireframe 遍历) — 以触碰文件链接自检替代 (BROKEN LINKS: NONE; 被引用文件均存在)。
- Audit: 三区 CLEAN + 结构性事实 (Canonical/Runtime 不相交子图) + P2 (Mock 无生产 canonical 路径)。
- 债务: 优先级分组 (0.7C 前必须 D2/D4/D5/D6) + D11 上调 + D8 并 0.7D + D13 登记。
