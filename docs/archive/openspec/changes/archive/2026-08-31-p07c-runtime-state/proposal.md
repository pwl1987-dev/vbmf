# Change: Phase 0.7C Foundation — p07c-runtime-state（Canonical Runtime State 接线 + D2/D4/D5 伴随清债）

## Why

0.7B Consolidation 的 Integration Audit 确认：Canonical 层与 Runtime 层是**不相交子图**（canonical 输出仅 loopback 证据打印；SessionManager 零 canonical 输入）——0.7C 前置顺序的第一步就是补这条边。终审执行令：**不做纯清债 change**——D2（Resource Resolution）/D4（Port Availability）/D5（Identity Binding）恰好是 Canonical Runtime State 建立时必须消费的三类真实运行事实，随接线一并关闭；D6（BACKEND-CAPABILITY-01）靠近 Runtime Query/Capability 层，留给第二 change。

## What Changes

- **`src/runtime_state.rs`（新，编排层）——CanonicalRuntimeState 聚合（组合，绝不展开成万能 struct）**：
  - **加严红线**（终审）：`Canonical Media Semantics（是什么）≠ Runtime State（现在运行成什么状态）`——媒体语义以 `CanonicalMediaDescriptor` **整值组合**（`PortMediaSemantics { port_id, descriptor }` 列表），Runtime 侧只存运行事实字段（bound/running/health），**绝不**把 descriptor 字段平铺进 state 结构。
  - `DeviceRuntimeState { device_id, model, identity_strength, binding: Option<BindingStatus> }`（BindingStatus = production_grade binding 的摘要：match_kind + confidence）
  - `PortRuntimeState { port_id, device_id, direction, connector }`
  - `ResourceRuntimeState { resource_id, device_id, capability, state: ResourceState }`
  - `SessionRuntimeState { session_id, state, phase, resource_claims 摘要, pipeline: Option<u64> }`
  - `CanonicalRuntimeState { devices, ports, resources, sessions, media_semantics: Vec<PortMediaSemantics>, generated_at_ms }` + serde（证据输出）。
  - `assemble(devices, &PortRegistry, &ResourceRegistry, &bindings, &[MediaSession]) -> CanonicalRuntimeState`：纯装配（组合 canonical descriptor：对每个有观测的端口 normalize）。
- **`SessionManager::runtime_state(&self) -> CanonicalRuntimeState`**：第一条**生产路径**（SessionManager 字段已持有 devices/bindings/registry——snapshot 聚合 + `self.list()`）；**这是 Canonical→Runtime 边的建立**，非 loopback 证据补丁。
- **D2（derive_claims FAIL 化 / RESOURCE-RESOLUTION-01）**：preflight Stage3 升级为三态 Resolution——intent 设备在 ResourceRegistry 中**无派生 input 资源 ⇒ FAIL**（"declared capability missing"不再 WARN）；有资源但 claim 不可满足 ⇒ FAIL（现有 preflight 复用）。
- **D4（PortAvailability 端口级精确化）**：镜像 materialize 已冻结语义（pipeline.rs:485-523）——`port_id: Some` ⇒ 精确端口必须存在且 direction 为 Input/Bidirectional（缺失 ⇒ FAIL）；`port_id: None` ⇒ 设备须有 ≥1 Input 方向端口（升级现 any-port 检查）；`registry=None ⇒ WARN`（legacy 路径不变）。
- **D5（IdentityBinding 实查 / IDENTITY-BINDING-01）**：`ResolvedDeviceBinding::is_production_grade()`（`Confidence::High && matches!(match_kind, PersistentIdExact|SerialExact|DeviceHandleExact|ManifestVerified)`）共享 helper；preflight IdentityBinding 与 session.rs create 步 5 Binding verify 同步使用（key-existence → 实查强度）。对现生产者行为保持（只产 High+exact）。
- **门禁 RUNTIME-STATE-RT-01（三层）**：Unit（D2 无资源 FAIL/D4 端口级三态/D5 强度实查/聚合组合性——state 结构零 descriptor 字段平铺断言）；Simulation（mock 世界 create→runtime_state 投影）；Hardware（VBMF_SESSION_LIFECYCLE 输出 CanonicalRuntimeState JSON——真机证据）。
- **债务表**：D2/D4/D5 标记 CLOSED（本 change）；Phase Map 0.7C 行更新。

## Capabilities

（`skip_specs: true`——SoT 为 PHASE_IMPLEMENTATION_MAP §2/§3/§4 + 终审执行令。）

## Impact

- 编译：五套 feature 不回退；runtime_state.rs 位于编排层（可引 canonical + port/resource/resolver 类型，零 vendor）。
- 受影响：新 `runtime_state.rs`；`preflight.rs`（Stage2/3/5 升级）；`resolver.rs`（+is_production_grade）；`session.rs`（+runtime_state 方法；create 步 5 改用 helper；derive_claims 不动签名）；`main.rs`（mod + SESSION_LIFECYCLE 证据挂点）；债务表 + Phase Map。
- 测试影响面：preflight test 1 更新（clean case 需注册派生资源）；session.rs 现有测试零破坏（fixture 每设备有 sdi-input 资源与 Input 端口；port_id=None 走 fallback）。
- **明确不做**：D6；REST/External API/Command Contract/Event Projection/Idempotency；Audio Routing Execution；Clock Policy；Timecode Parser；D11 Timeline。
