# Change: Phase 0.7B-2A — p07b-clock-domain（Clock Domain 建模：只描述观测，绝不决策）

## Why

0.7A 的 `CanonicalClockRef { domain: Option<Uuid> }` 过弱——Clock Domain 的 kind/reference/置信/证据没有 canonical 表达。冻结契约 `CLOCK_TIMECODE_CONTRACT.md` §1（#147）已定义 Clock **观测态**词表（Locked/Unlocked/Offset/Drift/Clock Lost/Clock Recovered）且钦定 **Observation≠Configuration**（R3：Clock 是运行时观测，绝不写回 Graph）。0.7B-2A 把它落成 canonical 类型，为 Audio Routing（依赖 Clock）与未来 Execution Plan 提供语义地基。**只描述"观察到什么"，绝不决定"应该使用什么 clock"**（那是 Runtime/Backend/Control Plane 的责任）。

## What Changes

- **`src/clock.rs`（新，canonical 层，零 vendor 依赖）**：
  - `CanonicalClockDomain { id: Uuid, kind, reference, state, confidence, evidence }`：
    - `kind: ClockKind { Internal, External, Unknown }`
    - `reference: ClockReference { FreeRunning, Locked, Unknown }`
    - `state: ClockObservationState { Locked, Unlocked, Offset, Drift, ClockLost, ClockRecovered, Unknown }`（**对齐冻结词表 #147**；Unknown 为 0.7B-2A 观测前置态）
    - `confidence: ClockConfidence { Observed, Inferred, Unknown }`
    - `evidence: Vec<ClockEvidence { code, detail }>`（观测证据条目，可序列化）
  - serde 全可序列化；`PartialEq`；**无任何决策方法**（类型层面不存在 `choose_master_clock` 之类）。
- **门禁 MEDIA-SEMANTICS-RT-01（Clock 部分，三层）**：
  - Unit：词表完备性（冻结 #147 六态全部可表达）/ serde roundtrip / Observation≠Configuration（类型层面无写回路径）/ 未知 kind/reference/state 的合法表达。
  - Simulation：MockProvider 世界装配 `CanonicalClockDomain`（Unknown kind + evidence 记录"无 clock 探针"）。
  - Hardware：盒上真机观测装配证据（当前硬件无 clock 探针 → Unknown kind + evidence，**Unknown 合法**——终审明确）。
- **`normalize.rs` 联动（最小）**：`CanonicalClockRef` 增补 `domain_description: Option<Box<CanonicalClockDomain>>`（引用升级为可携带观测描述；默认 None，normalize 恒 None + 既有 INFO 诊断不变——**不接 runtime，不接 clock 探针**）。
- **CI**：测试并入现有矩阵，无新 job。

## Capabilities

（`skip_specs: true`——SoT 为 `CLOCK_TIMECODE_CONTRACT.md`（#147 冻结词表）+ 终审裁定形状。）

## Impact

- 编译：五套 feature 不回退；零 vendor 依赖。
- 受影响：新 `clock.rs`；`normalize.rs`（CanonicalClockRef 最小增补）；`main.rs` mod 声明。Session/Resource/Lease/Pipeline 零触碰。
- 明确不做：不实现 clock 探针/源选择/master 仲裁/PTP/Genlock/恢复算法；不接 GStreamer/ALSA；不改 Session 语义；不做 Timecode（0.7B-2C）。
