# Tasks: Phase 0.7B-2A — p07b-clock-domain

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。

## 1. clock.rs 类型族（canonical 层，零 vendor 依赖）

- [x] 1.1 `CanonicalClockDomain` / `ClockKind` / `ClockReference` / `ClockObservationState`(#147 词表+Unknown) / `ClockConfidence` / `ClockEvidence` + serde
  - Contract: CLOCK_TIMECODE_CONTRACT §1(#147 词表; Observation≠Configuration) + 终审裁定形状 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.2 零决策红线: 类型族无任何选择/仲裁方法; 无 Graph 写回路径
  - Contract: CLOCK_TIMECODE_CONTRACT §1 (Observation≠Configuration, R3); 终审红线 (禁 choose_master_clock/select_clock/auto_route) | Implementation: Complete | Verification: Test(编译期存在性白盒) | Gate: Pass

## 2. normalize.rs 联动（最小）

- [x] 2.1 `CanonicalClockRef.domain_description: Option<Box<CanonicalClockDomain>>`（默认 None；normalize 恒 None + 既有 INFO 诊断不变；0.7B-1 测试同步）
  - Contract: CANONICAL_MEDIA_MODEL §2 (Clock 属 Media 实体关系) | Implementation: Complete | Verification: Test(0.7B-1 测试不回退) | Gate: Pass

## 3. 门禁 MEDIA-SEMANTICS-RT-01（Clock 部分，三层）

- [x] 3.1 Unit: #147 六态+Unknown 全可表达 / serde roundtrip / 白名单语义
  - Contract: #147 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: MockProvider 世界装配 Unknown domain + evidence 记录"无 clock 探针"
  - Contract: Observation≠Configuration | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: 盒上装配证据输出（Unknown kind + evidence——Unknown 合法）
  - Contract: 终审"Unknown 合法" | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 交付

- [x] 4.1 盒上全矩阵 + CI 七 checks 不回退（首提交仅类型+serde+单测，不接 runtime）
  - Contract: 终审"第一提交只允许新类型/serde/unit test/canonical contract" | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.2 verify（full）→ archive → PR#4 → merge → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口证据 (2026-08-30)

- clock.rs 3 单测 (#147 词表完备+serde 往返 / Unknown domain 合法且全 Unknown / 公开面红线 allowlist) + normalize.rs 联动 (CanonicalClockRef.domain_description: Option<Box<CanonicalClockDomain>>, 0.7B-1 测试同步)。
- 盒上最终矩阵: fmt 0 · test **124/124/144/124** · clippy -D ×4 零警告 · build ×3 · PROOF PASS。
- Hardware 层: 真机 loopback 门禁 `GATE_EXIT=0` + MEDIA-SEMANTICS-RT-01 clock 段真机装配输出 (Unknown 组合 + no_clock_probe evidence — **Unknown 合法**, Observation≠Configuration)。
- 修复轨迹: gs-only 构建下 `Uuid::nil()` 全路径化 (E0433, 同 PR#1 Uuid 门控教训); normalize serde Arc→Box (serde 默认不支持 Arc)。
