# Design: Phase 0.7C-2 — p07c-runtime-query

## Context

0.7C Foundation 交付 `runtime_state()` snapshot 聚合；终审批准进入 Query Model（严格只读）并关闭 D6。现有素材：`DeviceInfo.capabilities: DeviceCapabilities`（port.rs:109-117，input/output 端口数 + audio 能力，`CapabilityValue<T>` Unknown/Supported/Unsupported 三态）；SPI `probe_capabilities() -> Vec<CapabilityReport>`（Mock 已返回非空 items）；preflight BackendCapability 恒 WARN（session.rs run_preflight 传空 caps）。

## Goals / Non-Goals

**Goals:** RuntimeQuery 只读门面（Pure Read 白盒）+ D6 capability projection/preflight 硬判定 + D14/D15 登记 + RUNTIME-QUERY-RT-01 三层。
**Non-Goals:** 见 proposal 不做清单（尤其：无命令动词、无 External DTO、无 SDK 深探针、D14/D15 只登记）。

## Decisions

- **D1 RuntimeQuery 门面（零 DTO）**：`pub struct RuntimeQuery(Arc<SessionManager>)`；`get_runtime_state()`（委托 mgr.runtime_state()）+ `get_device/get_port/get_resource/get_session(id)`（在 snapshot 内查，Option 返回既有类型克隆）+ `list_sessions()` + `get_capabilities()`（Vec<(Uuid, DeviceCapabilitiesSummary)>）。**不加新查询结果类型**——返回既有 CanonicalRuntimeState 子项（防第二套模型）。
- **D2 Pure Read 白盒（终审新原则）**：公开面 allowlist = 全部 `get_/list_` 前缀；测试硬编码清单比对（防 start/stop/allocate/release/route/switch/probe/refresh/cleanup 静默进入——Preflight 副作用教训的延续）；实现层不持有可变引用（构造后仅读 Arc<SessionManager> 的只读方法 + runtime_state()）。
- **D3 Capability projection（D6）**：`DeviceCapabilitiesSummary { can_input: CapabilityFlag, can_output: CapabilityFlag, input_ports: Option<u32>, output_ports: Option<u32> }`（CapabilityFlag = Unknown/Supported/Unsupported，直取 DeviceCapabilities 三态）；`DeviceRuntimeState` 增 `capabilities: Option<DeviceCapabilitiesSummary>`（assemble 从 `DeviceInfo.capabilities` 投影；None = 数据不在场）。
- **D4 Preflight 硬判定（D6）**：BackendCapability stage——当 `inputs.devices` 的 capability 投影可知（Some）：Capture intent 设备 `can_input == Unsupported` ⇒ **FAIL**（"设备无输入能力"）；`Unknown` 或投影缺失 ⇒ 保持 WARN（absence≠evidence）。需 PreflightInputs 已含 devices（现有字段，直接读 `DeviceInfo.capabilities`——零新输入）。
- **D5 SPI 报告消费（最小）**：`RuntimeQuery::get_capabilities()` 附带 SPI `CapabilityReport` 计数摘要（source 维度）——只聚合展示，不进判定（判定用 D3 投影，同源更可信）。
- **D6 D14 契约标注**：`CanonicalRuntimeState` 文档注释显式 "snapshot, 非事务一致（D14——各源独立观测时刻拼合；一致性语义属后续）"；`generated_at_ms` 保留。
- **D7 D15 契约标注**：`PortMediaSemantics` 文档注释 "PortId 是物理/逻辑绑定关系，**不等于**单一 media flow（一 Port 可对应 0/1/N flows——audio 多轨/timecode 属后续）"。
- **D8 门禁 RUNTIME-QUERY-RT-01**：Unit（白盒 allowlist / get_* 路径含 None / D6 三态 FAIL·WARN·Pass）；Simulation（mock 全查询面 + capability 投影断言）；Hardware（SESSION_LIFECYCLE 的 runtime_state 输出含 capabilities + RuntimeQuery 冒烟）。

## Risks / Trade-offs

- DeviceCapabilities 在 mock 世界多为 Unknown/default（三态 Unknown）⇒ D4 判定在 mock 下走 WARN 分支——Simulation 测试需构造 Supported/Unsupported 的 DeviceCapabilities 注入（直接构造 DeviceInfo.capabilities）。
- preflight test1（clean case）devices 由 `device()` helper 构造（capabilities: default = 全 Unknown）⇒ 保持 WARN，verdict 仍 Warn——零破坏预期；需验证。
- RuntimeQuery 包 Arc<SessionManager>——SessionManager 现无 Arc 自投影；门面构造改为接受 `Arc<SessionManager>`（main.rs 持有 mgr 为局部值——需 Arc 化或门面持引用泛型。**取舍**：`RuntimeQuery` 持 `&SessionManager` 生命周期或改为 `RuntimeQuery::new(Arc<SessionManager>)` 要求 main.rs 的 mgr Arc 化（局部小改，值得——后续 Command Contract 也要共享所有权）。

## 实施顺序

runtime_state.rs 投影+注释 → runtime_query.rs 门面+白盒 → preflight D4 → main.rs mgr Arc 化+挂点 → 测试 → 盒上矩阵+真机 → 债务表/Phase Map。
