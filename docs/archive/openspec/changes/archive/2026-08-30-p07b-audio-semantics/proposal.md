# Change: Phase 0.7B-2B — p07b-audio-semantics（Audio Semantic Model：Canonical Audio Semantics，非 Audio Engine）

## Why

0.7B-1 的 `CanonicalAudioDescription` 只回答"有没有音频"；音频会快速滑向 mixer/routing/bus/channel mapping/DSP——必须先冻结 **Canonical Audio Semantics**（"这个音频是什么"），把"应该怎么处理"留给后续 Runtime/Control Plane。契约 §4 已显式建模 Audio 独立性（第 9 替换轴）；本 change 落成类型。**不实现**：GStreamer clock / ALSA/JACK/PipeWire / SDI embedded extraction / Audio mixer / Frame sync / 实时同步算法。

## What Changes

- **`src/audio.rs`（新，canonical 层，零 vendor 依赖）**：
  - `AudioStreamId(Uuid)`。
  - `AudioRole { Program, Commentary, Ambient, Auxiliary, Unknown }` —— **语义角色**；Main/Backup/Emergency/TX/RX 是业务词汇，冻结禁止。
  - `AudioLayout { Mono, Stereo, FiveOne, SevenOne, Unknown }` —— 只描述；Downmix/Upmix/Normalize 是处理，禁止。
  - `AudioSampleFormat { PcmS16, PcmS24, PcmS32, PcmFloat, Unknown }`（最小集；0.7B-2B 无观测源，恒 None/Unknown）。
  - `ObservationEvidence { code, detail }`（观测证据条目；与 clock 的 ClockEvidence 形状统一化留后续统一登记）。
  - `CanonicalAudioStream { id: AudioStreamId, presence: AudioPresence(复用 normalize 既有三态 Present/NotPresent/Unknown), channels: Option<u32>, sample_rate: Option<u32>, sample_format: Option<AudioSampleFormat>, layout: AudioLayout, role: AudioRole, evidence: Vec<ObservationEvidence> }`。
  - `CanonicalAudioStream::unknown(id)`：presence=Unknown / role=Unknown —— **Unknown 贯穿，禁止默认 Program**（终审 Unknown 测试要求）。
  - `AudioSemanticTarget { Role(AudioRole), Named(String) }` + `RoutePolicy { required: bool }`（policy 词汇 mix/duck/switch 属后续）+ `AudioRouteIntent { source: AudioStreamId, destination: AudioSemanticTarget, policy: RoutePolicy }` —— **Semantic Intent**：从 `CanonicalAudioStream` 语义映射（如 Embedded 相机音 → Program），类型层面不可能产出 pipeline/backend/gst 引用（纪律①同构）。
  - `CanonicalAudioStream::from_description(id, &CanonicalAudioDescription)`：Normalize → Stream 桥（presence 直映；channels/sample_rate 0.7B-2B 无观测源 → None；role=Unknown——**绝不默认 Program**）。
- **`normalize.rs` 联动（最小）**：桥接函数消费既有 `CanonicalAudioDescription`（不动 `normalize_input` 返回类型与既有诊断）。
- **`main.rs`（最小）**：`mod audio;` + loopback 证据挂点扩展（audio stream 证据输出——Hardware 层载体；同 0.7A/0.7B-2A 挂点先例，仅诊断路径）。
- **门禁 AUDIO-SEMANTICS-RT-01（三层）**：
  - Unit：provider 无关性（BMD 形状 vs Mock 形状 audio description → 同一 CanonicalAudioStream 媒体语义）；**Unknown 测试**（无观测 → presence=Unknown + role=Unknown，绝不默认 Program）；Route 测试（streams A/B → AudioRouteIntent，**零 pipeline/backend/gst 引用**——serde 反向断言）。
  - Simulation：MockProvider 世界装配。
  - Hardware：真机 loopback audio stream 证据输出（如 presence=Present / role=Unknown；channels/sample_rate Unknown 合法）。
- **CI**：测试并入现有矩阵。
- **债务登记（随本 PR）**：D11 Clock Observation Timeline（时钟是事件流非静态属性）；D12 Clock Confidence 的 ObservationSource 细分。

## Capabilities

（`skip_specs: true`——SoT 为 CANONICAL_MEDIA_MODEL §4 + 终审裁定形状。）

## Impact

- 编译：五套 feature 不回退；零 vendor 依赖。
- 受影响：新 `audio.rs`；`normalize.rs`（桥接函数）；`main.rs`（mod + loopback 挂点）；`PHASE_0_7A_POST_MERGE_DEBT.md`（D11/D12 登记）。
- 明确不做：AudioMixer / AudioBusManager / ChannelAllocator / Gain / Delay Compensation / sample clock / SDI embedded extraction / 任何 pipeline 生成；**不触碰 session.rs / resource.rs / lease.rs / pipeline.rs / backend.rs**（触碰即范围越界）。
