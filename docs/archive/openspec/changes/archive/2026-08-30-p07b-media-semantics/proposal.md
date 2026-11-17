# Change: Phase 0.7B-1 — p07b-media-semantics（Normalize Foundation：Raw Device Description → Canonical Media Description）

## Why

0.7A 让 Runtime Ownership 闭环，但媒体语义仍散落在 vendor 观测结构里（`SignalStatus.video_format`、loopback 探测的 ad-hoc 字段）。按冻结契约 `CANONICAL_MEDIA_MODEL.md`，必须先建立 **Canonical 媒体描述层**，后续 Normalize/Switch/Audio 才有稳定语义地基。终审裁定 0.7B-1 只做最小地基：`Raw Device Description → CanonicalMediaDescriptor`，配门禁 **NORMALIZE-RT-01**（不同 Provider → 同一 canonical 表征）。

**三条设计纪律（终审冻结）**：① Normalize 不吞 Runtime Intent——只描述"是什么"，链路 `Input → Normalize → Canonical Media Model → (未来) Execution Plan → MediaBackend`；② Audio 独立 Flow 建模（契约 §4：Embedded/De-embedded/Independent/Mixed/External），绝不做 Video 的 Option 附属；③ Clock 只挂 `ClockDomain` 引用占位——绝不允许 Backend 偷偷决定 clock。

## What Changes

- **`src/normalize.rs`（新，canonical 层）**：
  - `CanonicalMediaDescriptor`：`{ source: CanonicalSourceRef{device_id, port_id}, video: CanonicalVideoDescription, audio: CanonicalAudioDescription, clock: CanonicalClockRef }`——只填当前用到字段（契约 §1：冻结类型≠全量实现）；零 vendor 字段（§5）。
  - `CanonicalVideoDescription`：dims / frame_rate / interlaced / pixel_format（对齐现有 `VideoFormat` 观测形状）。
  - `CanonicalAudioDescription`：`presence` + `embedding: AudioEmbedding{Embedded, DeEmbedded, Independent, Mixed, External}`（契约 §4 语义，显式建模）。
  - `CanonicalClockRef`：`Unspecified(ClockDomainId)` 占位——clock 策略属 0.7B Clock 阶段，此处仅引用不决策。
  - `RawInputDescription`（输入侧 raw 描述，provider 中立装配体：来自 `DeviceInfo`/`PortInfo`/`SignalStatus` 的观测值）。
  - `normalize_input(raw) -> NormalizeOutcome{descriptor, diagnostics}`：**纯函数、无副作用、绝不构造 pipeline/intent**（纪律①）。
- **门禁 NORMALIZE-RT-01（三层）**：不同 Provider 装配的 Raw 输入（BMD 真机观测形状 vs Mock 形状）在逻辑媒体相同时 → **同一 descriptor**（provider 无关性证明）；三层：Unit / Simulation-Mock / Hardware（盒上 BMD loopback 观测 → descriptor 与期望 canonical 形状一致）。
- **CI**：normalize 门禁测试并入现有 `rust-test-matrix`（不新增 job——无独立运行时依赖）。
- **债务联动**：D4（PortAvailability 精确化）与 D8（EventSink）不变；本 change 不碰。

## Capabilities

（`skip_specs: true`——canonical 语义 SoT 为 `CANONICAL_MEDIA_MODEL.md` 冻结契约 + 本 change 记录。）

## Impact

- **编译**：五套 feature 矩阵不回退；fmt/clippy -D 全绿；normalize.rs 零 vendor 依赖（ARCH-PORTABILITY-01 词法+PROOF 保持）。
- **受影响**：新 `normalize.rs`；`main.rs` mod 声明；无既有行为变更（纯新增模块，Session 路径零触碰）。
- **明确不做**：不生成 Execution Plan / pipeline；不做 Audio routing；不做 Clock 策略实现（`CanonicalClockRef` 仅占位）；不碰 UI/API/Scheduler；不改 Session/Resource/Lease 任何语义；不做色度学/编解码全量（§1 冻结≠全量）。
