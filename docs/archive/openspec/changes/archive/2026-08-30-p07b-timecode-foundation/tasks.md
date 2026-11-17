# Tasks: Phase 0.7B-2C — p07b-timecode-foundation

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。

## 1. timecode.rs 类型族（canonical 层，零 vendor 依赖）

- [x] 1.1 `TimecodePresence`(#148 五态+Unknown) / `TimecodeFormat`(标签不解析) / `TimecodeValue`(仅真实观测携带) / `TimecodeEvidence` + serde
  - Contract: CLOCK_TIMECODE_CONTRACT §2(#148 冻结词表) + 终审最小格式族 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.2 `CanonicalTimecode`（unknown()/absent() 不臆造; observe_invalid 保证据; Discontinuous/Recovered 为观察事实）+ 零决策红线（公开面 allowlist 白盒）
  - Contract: 终审红线 (禁 clock/sync/resample/correct; 不实现 parser) | Implementation: Complete | Verification: Test | Gate: Pass

## 2. normalize.rs 联动（最小）

- [x] 2.1 `CanonicalMediaDescriptor` 增 `timecode` 平级字段（四基础齐备; normalize 恒 unknown(); 既有测试同步）
  - Contract: CANONICAL_MEDIA_MODEL §2 (Media—Signal/MediaFormat Observed; Timecode P1 Contract) | Implementation: Complete | Verification: Test(既有测试不回退) | Gate: Pass

## 3. 门禁 TIMECODE-SEMANTICS-RT-01（三层）

- [x] 3.1 Unit: 词表快照 / Clock·Timecode 隔离（无决策 API + 无引用路径）/ Unknown·Absent 不臆造 / Invalid 保证据 / Discontinuous·Recovered 语义 / Vendor independence
  - Contract: #148 + 终审 6 项测试要求 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: Mock observation → canonical timecode
  - Contract: 同上 | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: 真机 loopback timecode 段证据输出（Unknown 合法; 只证明"能观察/描述"）
  - Contract: 终审 Hardware 要求 | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 交付

- [x] 4.1 禁改五文件核验 + 盒上全矩阵（fmt/test×4/clippy×4/build×3/PROOF）+ CI 七 checks 不回退
  - Contract: 盒上绿≠CI绿 铁律 | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.2 verify（full）→ archive → PR#6 → merge → 删分支 →（后续 Consolidation Review, 不直接进 0.7C）
  - Contract: 分支纪律 + 终审"2C 后先 Consolidation" | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口证据 (2026-08-30)

- timecode.rs 6 单测 (#148 词表快照+serde / Clock·Timecode 隔离+零决策 API+serde 互不串字样 / Unknown·Absent 不臆造 / Invalid 保证据 / Discontinuous·Recovered 观察事实 / Vendor independence+roundtrip) + Simulation (Mock 装配)。
- 盒上最终矩阵: fmt 0 · test **134/134/154/134** · clippy -D ×4 零警告 · build ×3 · PROOF PASS。
- Hardware 层: 真机 loopback 门禁 `GATE_EXIT=0` + TIMECODE-SEMANTICS-RT-01 真机装配输出 (Unknown 合法 — 只证明"能观察/描述")。
- 禁改五文件核验: session/resource/lease/pipeline/backend 零触碰。
- Canonical Media Model 四基础齐备: video/audio/clock/timecode 平级字段于 CanonicalMediaDescriptor。
