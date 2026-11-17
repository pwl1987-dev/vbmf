# Change: Phase 0.7C-2 — p07c-runtime-query（Runtime Query Model + D6 Backend Capability）

## Why

0.7C Foundation 建立了 Canonical→Runtime 聚合边（`runtime_state()` snapshot），但还没有形成 External API 之前的缺失关键层：**Runtime Query Model**（只读、snapshot-oriented 的内部 Contract）。终审裁定：不做 External API——先把查询层做稳，避免把 Rust 内部 snapshot 直接变成 External DTO 产生第二套模型。同时 **D6（BACKEND-CAPABILITY-01）是 0.7C 剩余唯一前置债务**：BackendCapability stage 当前恒 WARN 占位，应升级为 `Provider → Capability Probe → Runtime State → Query Model` 的 canonical capability projection + Preflight 硬判定。

## What Changes

- **`src/runtime_query.rs`（新，编排层只读门面）**：
  - `RuntimeQuery`（包 `Arc<SessionManager>`）——**Pure Read / Snapshot Semantics**（终审新原则）：`get_runtime_state() / get_device(id) / get_port(id) / get_resource(id) / get_session(id) / list_sessions() / get_capabilities()`——**全部只读**；公开面 allowlist 白盒锁定（零 mut/命令动词：start/stop/restart/allocate/release/route/switch/probe/refresh/cleanup 全部类型层面不存在）。
  - 查询结果类型 = 既有 `CanonicalRuntimeState` 子项的引用/克隆视图（**不造第二套 DTO**）。
- **D6（BACKEND-CAPABILITY-01）**：
  - **Capability projection**：`DeviceCapabilities`（port.rs 既有：input/output 端口数与能力）投影进 `DeviceRuntimeState.capabilities: Option<DeviceCapabilitiesSummary>`；`CapabilityReport`（SPI）→ 汇总。
  - **Preflight 硬判定**：BackendCapability stage 升级——registry 在场且设备 capability 投影可知时：Capture intent 设备**无输入能力**（input=Unsupported）⇒ **FAIL**（不再恒 WARN）；能力 Unknown ⇒ 保持 WARN（absence≠evidence，不臆造）。
  - **Mock 探针实化**：`MockProvider::probe_capabilities` 返回确定性报告（sdi-capture——现已有 items: vec!["sdi-capture"]，非空）；`SessionManager` 增 capability 投影装配（devices 的 DeviceCapabilities 进 runtime_state）。
- **D14/D15 登记（新债务，随本 PR 入债务表）**：
  - **D14 Runtime Snapshot Consistency**：`runtime_state()` 当前为各源（devices/ports/resources/sessions 分别 clone）拼合的 snapshot，非事务一致——语义定义（source observation time/state version）留 Runtime Query 后续；本 change 在类型文档显式标注"snapshot, 非事务一致"。
  - **D15 Media Flow Cardinality**：`PortId ≠ Media Stream`——一个 Port 可对应 0/1/N media flows（未来 audio 多轨/timecode/metadata）；`media_semantics: Vec<PortMediaSemantics>` 已避免过度限制，契约注释补写"PortId 是物理/逻辑绑定关系，不等于单一 media flow"。
- **门禁 RUNTIME-QUERY-RT-01（三层）**：Unit（查询只读白盒 + get_* 各返回路径 + D6 FAIL/WARN/FAIL 三态）；Simulation（mock 世界全查询面 + capability 投影）；Hardware（真机 SESSION_LIFECYCLE 输出含 capabilities 的 runtime_state + 查询面冒烟）。
- **CI**：测试并入现有矩阵。

## Capabilities

（`skip_specs: true`——SoT 为 PHASE_IMPLEMENTATION_MAP §3（Query Model 项）+ 终审裁定。）

## Impact

- 编译：五套 feature 不回退；runtime_query.rs 零 vendor 依赖。
- 受影响：新 `runtime_query.rs`；`runtime_state.rs`（DeviceRuntimeState 增 capabilities 投影 + D14/D15 契约注释）；`preflight.rs`（BackendCapability 硬判定）；`session.rs`（assemble 消费 DeviceCapabilities——DeviceInfo 已有该字段）；`main.rs`（mod + gate 挂点）；债务表 + Phase Map。
- **明确不做**：External API/REST/Fastify/Webhook/GraphQL；Command Contract（start/stop 等命令动词）；Idempotency；Event Projection；Multi-site/Global Scheduler；D6 的真实 BMD SDK 深度能力探针（用既有 DeviceCapabilities 投影，SDK 深探针属 Provider 后续演进）；D14 实现（只登记）；D15 实现（只契约注释）。
