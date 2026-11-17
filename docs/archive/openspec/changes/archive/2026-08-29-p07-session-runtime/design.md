# Design: Phase 0.7A — p07-session-runtime

## Context

0.6 Baseline 上，Session/Resource/Preflight 的契约已冻结（RUNTIME_SESSION_MODEL、RUNTIME_RESOURCE_MODEL、RUNTIME_LIFECYCLE_SEQUENCE、MEDIA_BACKEND_CONTRACT §1.1、V0.2 §1.2/§3.11）而实现缺位（见 proposal Why）。现有可复用件：`SharedResourceRegistry::acquire`（原子 preflight+reserve，P1-4）、Supervisor 全套（Restart/Backoff/Escalate）、`MediaBackend::instantiate/start/stop/recover/observe`（stop 未被调用）、`LeaseManager`（无 renew）、mock 世界（MockProvider/MockBackend）。constraints：分层法则（Domain/编排层不得依赖 adapters 类型）、P0-8（Backend 只消费已授权 Resource）、creator=destroyer 铁律、RELEASED→RUNNING 拒绝。

## Goals / Non-Goals

**Goals:** MediaSession + SessionManager 唯一 owner；冻结生命周期顺序 + 精确逆序回滚真正跑通；Resource 编排闭环（Reserve/Acquire/Allocate/Release/Expire/Recover）；Lease renew；Preflight 分级判定；SESSION-RT-01/RESOURCE-RT-01 三层门禁；单 agent 多会话并发仲裁。
**Non-Goals:** 见 proposal 不做清单；另加：PAUSED 媒体面语义、九维资源向量、多卡 placement/balancing（P1/P2）。

## Decisions

- **D1 Session 结构（RUNTIME_SESSION_MODEL §2-3 + Addendum §4.1）**：`MediaSession` 仅持语义描述与句柄——`session_id: SessionId(Uuid)`（独立于硬件身份）、`graphs: GraphRuntimeIntent`（canonical 语义图）、`source_ports/output_ports: Vec<Uuid>`、`resource_claims: Vec<ResourceClaim{resource_id, holder, phase}>`、`lease: Option<DeviceLease>`、`pipeline: Option<PipelineHandle>`、`health: SessionHealthSnapshot`、`created_at`。绝不含 `gstreamer::Pipeline` 等具体对象（"逻辑持有、物理引用"）。备选"直接持 Arc<dyn MediaBackend>"被否：Backend 对象由 Manager 持有，Session 只拿 `PipelineHandle` 链接（"Session owns lifecycle / Backend owns object / Handle links the two"）。
- **D2 两级状态机（模型 §3 + Addendum §4.3）**：粗态 `SessionState`（Reserved/Running/Paused/Releasing/Released，白名单迁移，RELEASED→Running 拒绝 #114）+ 微相位 `SessionPhase`（Requested/Provisioning/Binding/Leased/Starting/Running/Stopping/Released + ProvisioningFailed/BindingFailed/StartFailed/Degraded/Recovery/Terminated）。两级分离的原因：粗态对外（映射 AgentState/Projection），微相位对内（生命周期引擎步进）。
- **D3 SessionManager 单 owner**：`SessionManager { resources: SharedResourceRegistry, leases: Arc<dyn LeaseManager>, backend: OnceLock<Arc<dyn MediaBackend>>（工厂经 AdapterRegistry）, sup, events, sessions: Mutex<HashMap<SessionId, SessionInner>> , config 旋钮 }`。API：`create(intent)->SessionId`（Preflight→Reserve→建 Session→Lease→Binding verify，失败逆序回滚至 create 前态）、`start(id)->Result`（instantiate→Allocate→start→Running；失败回滚 Allocate→Lease→Reservation→Terminated）、`stop(id)`（stop pipeline→release allocation→release lease→release reservation→Released→销毁）、`close(id)`（幂等收尾）、`status/list`。并发：会话表 Mutex + SharedResourceRegistry 原子性；多会话争用同一 Resource 由 acquire 原子性裁决（后到者 NotAcquirable）。
- **D4 生命周期引擎**：每步显式阶段记录 + `rollback_to(phase)` 表驱动精确逆序（RUNTIME_LIFECYCLE_SEQUENCE §2）；任何一步失败 → 逆序回滚 → `SessionFailed` 事件 → 相位 Terminated；Session 保留供诊断直到 `close`。
- **D5 Preflight 分级（V0.2 §1.2）**：`preflight.rs` 输出 `PreflightReport { stages: Vec<(PreflightStage, StageOutcome)>, verdict }`；0.7A 实装 stages：Graph（intent 形状/设备引用）、PortAvailability（PortRegistry 端口存在 + 方向匹配）、ResourceCapacity（现有 preflight()）、LeaseConflict（lease 已被他人持有）、IdentityBinding（bindings 含目标设备且 HIGH/ManifestVerified）、BackendCapability（probe_capabilities 报告，WARN-only）；Topology/Risk 两级 report-only 占位（WARN 不阻塞）。verdict=FAIL → create 前拒绝，零预留零回滚。
- **D6 Resource 编排补全**：`ResourceRegistry::allocate_for(resource_id, holder)`（Reserved→Allocated，校验 holder 与 reservation.holder 一致）；`release_allocation(holder)`（Allocated→Releasing→Available，供 stop 路径）；`expire_reservations(cutoff)`（供 tick 驱动）。claim 相位与 Resource.state 由 SessionManager 在同一锁域推进。
- **D7 Lease renew + TTL**：`LeaseManager::renew(device_id, owner, ttl)`；SessionManager 提供 `tick()`（由 health 端点/watchdog 周期调用）：lease 到期扫描 + 预留 TTL 过期（`ResourceReservationExpired` 事件）+ 会话健康快照刷新。无后台线程（沿用现模式）。`default_lease_ttl`/`lease_renew_window` 接入 Config。
- **D8 事件**：additive kinds（serde tag 不变）：`SessionCreated{session_id}`、`SessionStateChanged{session_id, from, to}`、`SessionFailed{session_id, reason}`（Critical）；点亮 `LeaseGranted/ResourceAllocated/ResourceReservationExpired/IdentityResolved/SourceMaterialized`。事件仍经 Supervisor::record 单出口。
- **D9 main.rs 接线**：diagnostic auto_start → `SessionManager::create(start intent)` + `start()`（原内联代码删除）；`VBMF_SESSION_LIFECYCLE=1`（bmd+gstreamer）：真机跑 create→start→观察 10s→stop→close 全链，逐步 verdict 输出（SESSION-RT-01 硬件证据入口）；Production Ready 语义不变；selftest 不动。进程常驻期 Manager.tick 挂到现有 watchdog 循环。
- **D10 崩溃恢复**：pipeline 故障仍走既有 Supervisor→recover 链；recover 前强制 `lm.is_valid`（不变量）；Session 相位 Degraded/Recovery 由 watchdog 上报；Supervisor Escalate → 会话 Degraded + ManualRequired（会话不被静默销毁，等运维）。
- **D11 测试三层**：Unit（状态机/回滚表纯逻辑）；Simulation（MockBackend + MockProvider 全链——含 `FailingBackend` 测试桩注入 instantiate/start 失败验证回滚、双会话并发（线程）争抢、expiry、crash cleanup（manager 重建后孤儿预留回收））；Hardware（盒上 VBMF_SESSION_LIFECYCLE + 双会话拒绝）。

## Risks / Trade-offs

- main.rs diagnostic 路径重构触面中等：以既有 MEDIA-RT-01/LOOPBACK/HW-IDENT 回归 + SESSION-RT-01 真机新证据兜底。
- 两级状态机有表达冗余风险：以白名单单测锁死迁移，Phase 映射表唯一。
- Backend 工厂全局单例（OnceLock）：多会话共享同一 backend 实例（MediaBackend Send+Sync，controller 内部 per-handle 状态），符合现架构；多 backend 实例化留 P1。
- `stop` 首次被真实调用：GStreamer stop 路径（Bus watch join + Null + 健康表清理）在真机生命周期门禁中首次实测。
