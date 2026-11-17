# Design: Phase 0.7B-2B — p07b-audio-semantics（Audio Semantic Model）

## Context

冻结契约 `CANONICAL_MEDIA_MODEL.md` §4：Audio 独立建模（第 9 替换轴；AudioSource/AudioPort/AudioRoute/AudioChannel/AudioFormat/AudioClock；语义 Embedded/De-embedded/Independent/Mixed/External）。终审裁定：只回答"这个音频是什么"，不回答"应该怎么处理"；Unknown 贯穿；禁止 AudioMixer/AudioBusManager/ChannelAllocator/Gain/DelayCompensation。

## Goals / Non-Goals

**Goals:** `CanonicalAudioStream` + `AudioRole`（Program/Commentary/Ambient/Auxiliary/Unknown）+ `AudioLayout`（Mono/Stereo/FiveOne/SevenOne/Unknown）+ `AudioSampleFormat`（最小集）+ `AudioRouteIntent`（Semantic Intent）+ `ObservationEvidence`；AUDIO-SEMANTICS-RT-01 三层。
**Non-Goals:** mixer/bus/channel allocator/gain/delay/sample clock；GStreamer/ALSA 接线；Session 语义变更；Timecode（0.7B-2C）。

## Decisions

- **D1 Role 冻结词表**：`Program | Commentary | Ambient | Auxiliary | Unknown`。Main/Backup/Emergency/TX/RX 是业务词汇——冻结禁止。**默认 Unknown，绝不默认 Program**（与 0.7A "absence≠evidence" 同构）。
- **D2 presence 复用**：`AudioPresence` 复用 `normalize.rs` 既有三态（Present{channels_hint}/NotPresent/Unknown）——终审"保持 Present/Absent/Unknown 不要改"；Absent≡NotPresent（既有命名，测试已锁定，不重命名制造 churn）。
- **D3 `CanonicalAudioStream`**：`{ id: AudioStreamId, presence, channels: Option<u32>, sample_rate: Option<u32>, sample_format: Option<AudioSampleFormat>, layout: AudioLayout, role: AudioRole, evidence: Vec<ObservationEvidence> }`。`unknown(id)` 构造器：presence/role/layout 全 Unknown + evidence 记录"无 audio 观测"。
- **D4 `AudioRouteIntent` = Semantic Intent**：`{ source: AudioStreamId, destination: AudioSemanticTarget, policy: RoutePolicy }`；`AudioSemanticTarget { Role(AudioRole), Named(String) }`；`RoutePolicy { required: bool }`（mix/duck/switch 等 policy 词汇属后续 Runtime/Control Plane）。**类型层面不可能产出 pipeline/backend/gst 引用**（纪律①同构：Intent → (未来) Execution Plan → Backend）。
- **D5 Normalize → Stream 桥**：`CanonicalAudioStream::from_description(id, &CanonicalAudioDescription)`——presence 直映；channels/sample_rate/sample_format → None（0.7B-2B 无观测源）；layout → Unknown；role → Unknown。桥是纯映射，不改 `normalize_input` 返回类型与既有诊断。
- **D6 `ObservationEvidence { code, detail }`**：与 clock 的 `ClockEvidence` 形状统一——定义于 audio.rs；两处合并为共享类型登记为后续统一债务（避免本轮 churn clock.rs）。
- **D7 门禁 AUDIO-SEMANTICS-RT-01 三层**：
  - Unit：provider 无关性（BMD 形状 vs Mock 形状 description → 同一 stream 媒体语义）；**Unknown 贯穿**（无观测 → presence=Unknown + role=Unknown，绝不默认 Program）；Route 测试（A/B streams → intent，serde 反向断言零 pipeline/backend/gst 引用）；Role 冻结词表快照。
  - Simulation：MockProvider 世界装配 audio stream。
  - Hardware：真机 loopback audio stream 证据输出（presence/channels/role；channels/sample_rate Unknown 合法）。

## Risks / Trade-offs

- `AudioSemanticTarget::Named(String)` 可能被滥用为业务名：文档锁定"opaque 语义标签，非路由配置"。
- `ObservationEvidence` 与 `ClockEvidence` 形状重复：本轮不合并（避免 churn clock.rs，0.7C 统一）。
- main.rs 仅 mod + loopback 诊断挂点（0.7A/0.7B-2A 先例）：不触碰五模块禁改清单。
