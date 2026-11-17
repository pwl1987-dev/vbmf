# Tasks: Phase 0.6 C2 (0.6D+E)

## 1. RuntimeEvent 模型

- [x] 新增 `events.rs` 定义 `RuntimeEvent` 枚举（全生命周期成员）
  - 证据: `services/media-agent/src/events.rs` — `RuntimeEvent` 11 变体 (IdentityResolved/SourceMaterialized/SignalVerified/LoopbackVerified/LeaseGranted/ResourceAllocated/ResourceReservationExpired/PipelineFault/HardwareFault/HealthChanged/AmbiguousIdentity), `#[serde(tag="kind", rename_all="snake_case")]` canonical 字段 (Uuid/String/Vec<String>, 无 vendor 指针); `EventSource` (Upstream/Supervisor/Operator); `kind()` + `is_fault()`。
- [x] 定义 vendor 错误 → `RuntimeEvent` 的映射 trait / 辅助
  - 证据: `events.rs` — `RuntimeEventMapper` trait (`map_upstream(source, observation) -> Option<RuntimeEvent>`) + `DefaultRuntimeEventMapper` (分类 ambiguous/hardware/pipeline-fault 关键词, 丢弃噪声); `RuntimeEventLog` (Mutex<VecDeque> 有界, 满则丢最旧, push/drain/len/is_empty); 4 单元测试。

## 2. Supervisor 归一化

- [x] `supervisor.rs` 改为唯一 `RuntimeEvent` 出口，消费 Provider/Backend 上抛事件
  - 证据: `supervisor.rs` — `events: RuntimeEventLog` 字段; `ingest(source, observation)` (经 `DefaultRuntimeEventMapper` 归一化); `record(ev)` (canonical 事件直记, Preflight 闸门用); `drain_events()`/`pending_events()`; `report_failure` → `PipelineFault{retryable:true}` / `HealthChanged{..manual_required}`; `report_recovered`/`escalate` → `HealthChanged`; 3 新增测试。下游 (Health/RPC/日志) 只经 `drain_events` 消费 canonical 事件, 不再直接触碰 vendor 类型。
- [x] Health / RPC / 日志改为只消费 `RuntimeEvent`，移除直接 vendor 错误依赖
  - 证据: Supervisor 为唯一出口; `drain_events` 为下游唯一消费面。`main.rs` Preflight 闸门经 `sup.lock().record(RuntimeEvent::...)` 发射 (AmbiguousIdentity/HealthChanged), 不经 vendor 类型。

## 3. Resource 模型

- [x] 新增 `resource.rs`：`Resource` + 状态机（Available→Reserved→Allocated→Releasing→Faulted），对齐 V0.2 §3.11
  - 证据: `services/media-agent/src/resource.rs` — `ResourceState` (Available/Reserved/Allocated/Releasing/Faulted) + `can_transition_to()` 白名单 + `is_available_for_preflight()`; `Resource { id, name, capability, capacity, device_id, state, reservation, allocated_to }` + reserve/allocate/expire_reservation/begin_release/finish_release/fault/recover; `ResourceStateError` (thiserror); 7 单元测试。
- [x] Resource 由 Discovery（`DeviceCapabilities` / `PortRegistry`）派生
  - 证据: `resource.rs` — `ResourceRegistry::derive_from_discovery(&PortRegistry)` 仅对 `port_id = Some` 的端口派生 (Unknown 不伪造 ID), 按方向映射能力键, 记录 `device_id` (供 Preflight 按设备校验)。

## 4. Preflight 闸门

- [x] `materialize` 入口前置 `preflight(plan, resources)`：可用性 + 冲突预留 + 身份 Resolve 校验
  - 证据: `resource.rs` — `preflight(registry, req)` (存在 + 能力交叉校验 + Available + 容量, 绝不抢占/回退) + `resolve_identity(chosen, candidates)` (多重候选 → `AmbiguousIdentity` 拒识) + `AcquisitionRequest`/`PreflightOutcome`/`PreflightError`; `main.rs` auto-start 入口: `registry=Some` 时 `derive_from_discovery` → 定位目标设备 input Resource → `preflight`; 失败 fail-closed (Degraded + 拒物化), `registry=None` 沿 legacy 路径。
- [x] 失败返回 `AmbiguousIdentity` / `ResourceUnavailable`，由 Policy 决策；禁止静默回退
  - 证据: `main.rs` — Preflight `Err(AmbiguousIdentity)` → `sup.record(RuntimeEvent::AmbiguousIdentity{..})`; 其他 `PreflightError` (ResourceUnavailable/NotAcquirable) → `RuntimeEvent::HealthChanged{degraded}`; 均 `AgentState::Degraded` + 跳过 materialize (绝不静默回退 device 0)。

## 5. 验证（CI 门禁）— 盒上 (10.30.15.10) 2026-08-29 执行

- [x] `cargo clippy --all-targets -- -D warnings`（default + `bmd-provider,gstreamer-backend` 两套 feature）
  - 证据: 盒上 `p06de_verify.sh` — default `-D warnings` **exit 0 (0 warning)**; bmd,gstreamer 下本 change 代码 (events/resource/supervisor/main) **0 warning** (fresh build 全量 lint 确认)。注: bmd `-D warnings` 组合下 build-script (bindgen, Gate 6/7) 触发环境性 cargo-clippy `Unrecognized option: 'features'` (与 p06-de 源码无关, build.rs 未改; 详见 verify 报告 §风险)。
- [x] `cargo test` default + simulation 通过
  - 证据: 盒上 — default **98 passed / 0 failed**; simulation **98 passed / 0 failed** (含 events.rs 4 测试 / resource.rs 7 测试 / supervisor 3 新增测试)。
- [x] `cargo build --features bmd-provider,gstreamer-backend` 通过
  - 证据: 盒上 — **exit 0**。

## 收口确认 (2026-08-29)

- §1-§4 代码已完成, §5 三项 CI 门禁已于盒上 (10.30.15.10, cargo 1.98.0) 实际执行: test 98/98 (default+sim)、default clippy -D 0 warning、bmd build ok、bmd clippy 本 change 代码 0 warning。
- 唯一非绿项为 bmd `-D warnings` 组合下 build-script 的环境性 cargo-clippy bug (`Unrecognized option: 'features'`), 与 p06-de 源码无关 (build.rs/Cargo.toml 未改, 错误发生在 build-script 编译单元, 先于 src 任何文件); 已隔离复现确认。详见 verify 报告。
- 本 change 为**新代码** (非 C 系列已存在实现的补勾), 盒上验证为通过前置条件。
