# Design: Phase 0.7B-2A — p07b-clock-domain（Clock Domain 建模）

## Context

冻结契约 `CLOCK_TIMECODE_CONTRACT.md` §1（#147）：Clock 观测态词表 `Locked/Unlocked/Offset/Drift/Clock Lost/Clock Recovered`；**Observation≠Configuration**（R3：Clock 观测绝不写回 Graph）。0.7A 遗留 `CanonicalClockRef { domain: Option<Uuid> }` 过弱。终审裁定形状：`CanonicalClockDomain { id, kind, reference, confidence, evidence }`——只描述观测，类型层面不存在任何决策方法。

## Goals / Non-Goals

**Goals:** canonical Clock Domain 类型族（kind/reference/state/confidence/evidence）+ serde + 单测；`CanonicalClockRef` 最小增补（可携带 domain 描述）；MEDIA-SEMANTICS-RT-01 Clock 部分三层。
**Non-Goals:** clock 探针/源选择/master 仲裁/PTP/Genlock/恢复算法；GStreamer/ALSA 接线；Session 语义变更；Timecode（0.7B-2C）；Audio Routing（0.7B-2B）。

## Decisions

- **D1 形状（终审裁定 + #147 词表合并）**：
  ```rust
  pub struct CanonicalClockDomain {
      pub id: Uuid,
      pub kind: ClockKind,            // Internal | External | Unknown
      pub reference: ClockReference,  // FreeRunning | Locked | Unknown
      pub state: ClockObservationState, // 冻结 #147: Locked/Unlocked/Offset/Drift/ClockLost/ClockRecovered + Unknown(观测前置)
      pub confidence: ClockConfidence, // Observed | Inferred | Unknown
      pub evidence: Vec<ClockEvidence>, // { code: String, detail: String }
  }
  ```
  `state` 采用 #147 冻结词表（终审形状未列，系契约对齐的**加法**；`Unknown` 表"0.7B-2A 尚无 clock 探针"——真机 Unknown 合法，终审明确）。
- **D2 无决策（终审红线）**：类型族**零方法**（除派生 trait）；`choose_master_clock`/`select_clock`/`auto_route` 在本模块类型层面不存在。Clock 策略属 Runtime/Backend/Control Plane。
- **D3 Observation≠Configuration**：无任何 `-> GraphIntent` / 写回路径；evidence 只增不解释（Policy 层职责）。
- **D4 `CanonicalClockRef` 增补**：`domain_description: Option<Box<CanonicalClockDomain>>`（Box 防递归膨胀；默认 None → 既有 normalize 行为与诊断不变——`normalize_input` 恒 None + INFO，**不接探针**）。
- **D5 Confidence 语义**：`Observed`（有直接探针证据）/`Inferred`（从 transport/拓扑推断）/`Unknown`——0.7B-2A 只会产出 Unknown（无探针），枚举为 0.7B 探针阶段预留。
- **D6 门禁 MEDIA-SEMANTICS-RT-01（Clock 部分）**：Unit（#147 六态+Unknown 全可表达 / serde roundtrip / 无决策方法的存在性断言——编译期类型核查+白盒）/ Simulation（MockProvider 世界装配 Unknown domain + evidence）/ Hardware（盒上装配证据输出：Unknown kind + evidence "无 clock 探针"——**Unknown 合法**）。

## Risks / Trade-offs

- `state` 字段为终审形状的加法（#147 对齐）：若 0.7B 探针阶段发现词表不够，只能**加变体**不能改义（冻结词表约束）。
- `evidence` 用字符串对而非强类型：0.7B-2A 无探针 schema 依据，强类型留探针阶段（演进空间，登记债务不必要——枚举化属探针实现细节）。
- `CanonicalClockRef` 增字段 → normalize 既有断言（`clock == CanonicalClockRef{domain:None}`）需同步更新（0.7B-1 测试为编译+断言级小改）。
