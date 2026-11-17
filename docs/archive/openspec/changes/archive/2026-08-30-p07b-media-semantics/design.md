# Design: Phase 0.7B-1 — p07b-media-semantics（Normalize Foundation）

## Context

冻结契约 `CANONICAL_MEDIA_MODEL.md`：§1 冻结类型≠全量实现（只填当前用到字段）；§4 Audio 独立建模（Embedded/De-embedded/Independent/Mixed/External）；§5 canonical 类型被 Domain/Graph/Session/Health 共享且零 vendor 字段。现有观测形状：`port.rs::VideoFormat {width,height,frame_rate,interlaced,pixel_format}`、`SignalStatus {video_locked,audio_locked,...}`、真机 loopback 实证（720x486 / 30000÷1001 / interlaced / v210 + embedded audio）。约束：纪律①（Normalize 不构造 pipeline/intent）、②（Audio 独立 Flow）、③（Clock 仅引用）。

## Goals / Non-Goals

**Goals:** `CanonicalMediaDescriptor`（canonical 媒体描述类型）+ `normalize_input` 纯函数（Raw → Canonical）；NORMALIZE-RT-01 provider 无关性证明（三层）。
**Non-Goals:** Execution Plan/pipeline 生成、Audio routing、Clock 策略实现、色度学/编解码全量、UI/API、Session/Resource 语义变更。

## Decisions

- **D1 描述符形状（契约 §1 最小字段）**：`CanonicalMediaDescriptor { source: CanonicalSourceRef{device_id, port_id: Option<Uuid>}, video: CanonicalVideoDescription{ width: u32, height: u32, frame_rate: Option<Rational>（用 (num, u64) 元组或字符串, 与 VideoFormat 的 "30000/1001" 观测对齐—设计取 (u32,u32) 结构化）, interlaced: bool, pixel_format: String }, audio: CanonicalAudioDescription{ presence: AudioPresence{Present{channels_hint: Option<u32>} | NotPresent | Unknown}, embedding: AudioEmbedding{Embedded|DeEmbedded|Independent|Mixed|External} }, clock: CanonicalClockRef{ domain: Option<Uuid> } }`。零 vendor 字段；serde 可序列化（证据输出用）。
- **D2 RawInputDescription（provider 中立装配体）**：`{ device_id, port_id: Option<Uuid>, observed: Option<ObservedMedia{video: Option<ObservedVideo{width,height,frame_rate:Option<(u32,u32)>,interlaced:Option<bool>,pixel_format:Option<String>}>, audio_present: Option<bool>}> , transport: String }`——由 PortInfo/SignalStatus 装配（port.rs 观测类型 → raw），装配函数放 normalize.rs 的 `From` 实现或独立 fn（canonical 层内，不依赖 adapters）。
- **D3 normalize_input 纯函数**：`normalize_input(raw: &RawInputDescription) -> NormalizeOutcome`；`NormalizeOutcome { descriptor: CanonicalMediaDescriptor, diagnostics: Vec<NormalizeDiagnostic> }`。规则：观测缺失字段 → descriptor 字段 `Unknown` 占位 + diagnostic WARN（不臆造）；provider 字段（persistent_id/handle）**绝不**进入 descriptor（契约 §2 身份层级）；transport 字符串原样保留为 canonical 标签。**绝不**返回 pipeline/intent（纪律①，类型层面即不可能——返回类型不含此类）。
- **D4 NORMALIZE-RT-01 provider 无关性**：`normalize_input(BMD 形状 raw) == normalize_input(Mock 形状 raw)` 当且仅当观测媒体相同——Unit 层用两组装配体证明结构相等；Simulation 层经 MockProvider 世界装配；Hardware 层盒上真机 loopback 观测装配 → descriptor 断言（1080i50 家族形状）。
- **D5 Clock 占位（纪律③）**：`CanonicalClockRef { domain: Option<Uuid> }`，0.7B-1 恒 `None` + diagnostic INFO（clock 策略后续阶段实现；类型在场防将来 Video/Audio 偷塞 clock 字段）。
- **D6 Audio 独立（纪律②/契约 §4）**：`CanonicalAudioDescription` 与 video 平级字段，非 `Option<Audio>` 嵌套；0.7B-1 由 `audio_present` 观测推导 `presence`，`embedding` 缺省 `Embedded`（SDI 内嵌现状显式化）+ diagnostic 注记（MADI/AES 等后续由 Audio Provider 声明）。

## Risks / Trade-offs

- 观测字段缺失时的 Unknown 占位 vs FAIL：0.7B-1 取"Unknown+WARN diagnostics"（描述层不决策；决策属未来 Preflight/Policy——与 D2 derive_claims FAIL 化债务 D2 衔接）。
- frame_rate 结构化 (num,den) vs 字符串：取 (u32,u32)，`VideoFormat.frame_rate: Option<String>` 装配时解析，解析失败→Unknown+WARN（不丢观测）。
- `port.rs::VideoFormat` 与 canonical 结构形状重叠：**不替换**既有观测类型（runtime 探测层不动），normalize 层转换——避免触碰 Session 路径。

## 实施顺序

normalize.rs 类型 → 装配 From → normalize_input → Unit 测试 → NORMALIZE-RT-01 Simulation → main.rs mod + 真机观测装配点（loopback/diagnostic 证据输出可选挂接）→ 盒上矩阵 + 真机门禁 → CI 重跑。
