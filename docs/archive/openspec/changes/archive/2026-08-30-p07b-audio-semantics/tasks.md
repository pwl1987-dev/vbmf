# Tasks: Phase 0.7B-2B — p07b-audio-semantics

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。

## 1. audio.rs 类型族（canonical 层，零 vendor 依赖）

- [x] 1.1 `AudioRole`(Program/Commentary/Ambient/Auxiliary/Unknown — 业务词冻结禁止) / `AudioLayout`(Mono/Stereo/FiveOne/SevenOne/Unknown — 只描述) / `AudioSampleFormat`(最小集) / `ObservationEvidence` + serde
  - Contract: CANONICAL_MEDIA_MODEL §4 + 终审裁定词表 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.2 `CanonicalAudioStream`（presence 复用 normalize 三态; Unknown(id) 构造器 presence/role 全 Unknown + evidence）+ `CanonicalAudioStream::from_description` 桥
  - Contract: 契约 §4 + 终审 Unknown 贯穿 | Implementation: Complete | Verification: Test | Gate: Pass

## 2. AudioRouteIntent（Semantic Intent）

- [x] 2.1 `AudioRouteIntent { source, destination: AudioSemanticTarget, policy: RoutePolicy }` — 类型层面不可能产出 pipeline/backend/gst 引用
  - Contract: 纪律① 同构; 终审"不能 Intent→gst_pipeline" | Implementation: Complete | Verification: Test(serde 反向断言) | Gate: Pass

## 3. 门禁 AUDIO-SEMANTICS-RT-01（三层）

- [x] 3.1 Unit: provider 无关性 / Unknown 贯穿（绝不默认 Program）/ Route 零 pipeline 引用 / Role 词表快照
  - Contract: 终审测试要求 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: MockProvider 世界装配 audio stream
  - Contract: 契约 §4 | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: 真机 loopback audio stream 证据输出（role=Unknown 合法; channels/sample_rate Unknown 合法）
  - Contract: 终审 Hardware 要求 | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 交付

- [x] 4.1 禁改清单核验（session/resource/lease/pipeline/backend 五文件零触碰）+ 盒上全矩阵 + CI 七 checks 不回退
  - Contract: 终审"不修改"清单 | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.2 债务登记 D11 (Clock Observation Timeline) / D12 (ObservationSource) 入 PHASE_0_7A_POST_MERGE_DEBT.md
  - Contract: 终审登记要求 | Implementation: Complete | Verification: Docs | Gate: Pass
- [x] 4.3 verify（full）→ archive → PR#5 → merge → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口证据 (2026-08-30)

- audio.rs 4 单测 (provider 无关性 / Unknown 贯穿绝不默认 Program / Route intent 零 pipeline·backend·gst 引用 / Role 词表快照) + Simulation (Mock 装配)。
- 盒上最终矩阵: fmt 0 · test **128/128/148/128** · clippy -D ×4 零警告 · build ×3 · PROOF PASS。
- Hardware 层: 真机 loopback 门禁 `GATE_EXIT=0` + CanonicalAudioStream 真机装配输出 (presence=Unknown 合法 — 观测源在 PLAYING 捕获路径, 归 0.7B 主体; role=Unknown 绝不默认 Program)。
- 禁改清单核验: session.rs/resource.rs/lease.rs/pipeline.rs/backend.rs 零触碰 (git diff 断言)。
- 债务登记: D11/D12 已入 PHASE_0_7A_POST_MERGE_DEBT.md。
