# Change: Phase 0.7B-2C — p07b-timecode-foundation（Timecode Foundation：时间标签，非时间本体）

## Why

Canonical Media Model 三基础（Video✅/Audio✅/Clock✅）缺最后一块：Timecode。**Clock = 流速/同步参考；Timecode = 媒体帧携带的时间标签**——两者是不同概念，绝不因 Timecode 有 frame_rate 就与 Clock 的 rate 混同。冻结契约 `CLOCK_TIMECODE_CONTRACT.md` §2（#148）只冻结了状态词表 `Present/Absent/Invalid/Discontinuous/Recovered`，**没有冻结格式族**——按终审裁定：只实现状态与最小描述结构，**不做 LTC/VITC/ATC/SMPTE 解析器**。

## What Changes

- **`src/timecode.rs`（新，canonical 层，零 vendor 依赖）**：
  - `TimecodePresence { Present, Absent, Invalid, Discontinuous, Recovered, Unknown }`——#148 冻结五态 + Unknown 观测前置态（与 0.7B-2A Clock 同构；无观测源时恒 Unknown，真机合法）。
  - `TimecodeFormat { Ltc, Vitc, Embedded, Unknown }`——**只声明格式标签，不实现解析**（终审建议的最小格式族，只作 canonical 标签存在）。
  - `TimecodeValue { hours, minutes, seconds, frames }`（u32 四元组）——**只在 presence=Present 且有真实观测时携带**；无观测绝不臆造 `00:00:00:00`。
  - `CanonicalTimecode { presence, format, value: Option<TimecodeValue>, frame_rate: Option<(u32,u32)>（标签所属媒体帧率, 语义上≠Clock rate）, evidence: Vec<TimecodeEvidence> }`。
  - `CanonicalTimecode::unknown()` / `absent()` 构造器——Unknown/Absent 不臆造。
  - `observe_invalid(code, detail)` 构造路径——**Invalid 保留证据，绝不悄悄转成合法 Timecode**。
  - **零决策红线**：类型族零方法（构造器除外）——clock selection / master clock / drift correction / sync decision / resampling / timestamp correction 全部类型层面不存在（白盒 allowlist 测试，同 0.7B-2A 先例）；**Timecode 变更不可能影响 CanonicalClockDomain**（隔离测试：类型无互相引用路径）。
- **`normalize.rs` 联动（最小）**：`CanonicalMediaDescriptor` 增 `timecode: CanonicalTimecode` 平级字段（四基础齐备；normalize 恒 `unknown()`——无观测源）。既有测试同步（构造点+断言）。
- **`main.rs`（最小）**：`mod timecode;` + loopback 证据挂点（timecode 段真机装配输出）。
- **门禁 TIMECODE-SEMANTICS-RT-01（三层）**：
  - Unit：**词表快照**（#148 五态+Unknown serde 往返）；**Clock/Timecode 隔离**（公开面无 clock/master/sync 决策 API + Timecode 类型与 CanonicalClockDomain 无引用路径）；**Unknown/Absent 不臆造**（无观测 → Unknown/Absent，value=None，绝不 00:00:00:00）；**Invalid 保留证据**（observe_invalid → presence=Invalid + evidence，不转合法值）；**Discontinuous/Recovered 语义保持**（构造为观察事实，无"修正"路径）；Vendor independence（BMD/Mock 相同 canonical observation → 相同 CanonicalTimecode；serde 零 vendor 字样）。
  - Simulation：Mock observation → canonical timecode。
  - Hardware：真机 loopback timecode 段证据输出（Unknown 合法——只证明"能观察/描述"，不证明"能解析全部格式"）。
- **CI**：测试并入现有矩阵。

## Capabilities

（`skip_specs: true`——SoT 为 `CLOCK_TIMECODE_CONTRACT.md` §2（#148 冻结词表）+ 终审裁定。）

## Impact

- 编译：五套 feature 不回退；零 vendor 依赖。
- 受影响：新 `timecode.rs`；`normalize.rs`（descriptor 增 timecode 字段 + 既有测试同步）；`main.rs`（mod + loopback 挂点）。
- 明确不做：**Timecode parser（LTC/VITC/ATC/SMPTE 解析）**；帧号计算/PTS 推导/Clock 校正/Graph 修改/pipeline 启动；Clock 策略；不触碰 session/resource/lease/pipeline/backend 五文件。
- 后续：2C 合并后先做 **0.7B Media Semantics Consolidation Review**（终审裁定），通过后再进 0.7C External API。
