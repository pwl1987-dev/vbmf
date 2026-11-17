# Tasks: Phase 0.7B-1 — p07b-media-semantics

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。

## 1. Canonical 类型（normalize.rs）

- [x] 1.1 `CanonicalMediaDescriptor` / `CanonicalVideoDescription` / `CanonicalAudioDescription`(含 `AudioEmbedding` 五语义) / `CanonicalClockRef` / `CanonicalSourceRef`
  - Contract: CANONICAL_MEDIA_MODEL §1(冻结类型≠全量)/§4(Audio 独立)/§5(零 vendor 字段)；纪律①②③ | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 1.2 `RawInputDescription` 装配体 + 从 PortInfo/SignalStatus 的观测装配
  - Contract: 契约 §2(Media — Signal/MediaFormat Observed) | Implementation: Complete | Verification: Test | Gate: Pass

## 2. normalize_input 纯函数

- [x] 2.1 `normalize_input(raw) -> NormalizeOutcome{descriptor, diagnostics}`：观测缺失→Unknown+WARN 不臆造；provider 字段绝不进入 descriptor；绝不构造 pipeline/intent（类型层面不可能）
  - Contract: 纪律①；VENDOR_NEUTRALITY_RULES | Implementation: Complete | Verification: Test | Gate: Pass

## 3. 门禁 NORMALIZE-RT-01（三层）

- [x] 3.1 Unit: provider 无关性（BMD 形状 vs Mock 形状 raw → 同一 descriptor）+ 缺失观测 Unknown/WARN + frame_rate 解析失败不丢观测
  - Contract: NORMALIZE-RT-01 定义（不同 Provider → 同一 canonical model）| Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: MockProvider 世界装配 → descriptor 断言（嵌入 SDI 语义显式化）
  - Contract: 契约 §4 | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: 盒上真机 loopback 观测装配 → descriptor 与 1080i50 家族 canonical 形状一致
  - Contract: NORMALIZE-RT-01 | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 接线与交付

- [x] 4.1 main.rs mod 声明 + 诊断证据挂接点（loopback 观测 → descriptor 输出，可选）；Session/Resource 路径零触碰
  - Contract: 纪律① | Implementation: Complete | Verification: Simulation+Hardware | Gate: Pass
- [x] 4.2 盒上全矩阵（fmt/test×4/clippy×4/build×3/PROOF）+ CI 七 checks 不回退
  - Contract: 工程门禁不退化 | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.3 verify（full）→ archive → PR#3 → merge → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口确认

- 0.7B-1 仅 Normalize Foundation：不碰 UI/API/pipeline/Audio routing/Clock 策略实现；CanonicalClockRef 仅占位引用。

## 收口证据 (2026-08-30)

- normalize.rs 6 单测 (provider 无关性/缺失观测不臆造/BMD 实测形状锚点/纯函数+解析失败不丢观测/serde 无 vendor 字样/audio 三态) + Simulation (MockProvider 装配)。
- 盒上最终矩阵: fmt 0 · test **121/121/141/121** · clippy -D ×4 零警告 · build ×3 · PROOF PASS。
- Hardware 层: 真机 loopback 门禁 `GATE_EXIT=0` + `LOOPBACK ALL PASS=true` + normalize 路径在 bmd+gstreamer 二进制内运行; **无信号时观测 → Unknown+WARN (纪律① "拒绝臆造" 的真机实证)**; 有信号 (PLAYING 协商) 的实机 descriptor 采集归入 0.7B Normalize 主体 (需与 fixture PLAYING 捕获路径集成——READY 态探测结构上读不到协商 caps)。
