# Change: Phase 0.7A — p07-session-runtime（Session Runtime：让 0.6 冻结架构成为真正工作的媒体运行时）

## Why

0.6 Baseline（master `d1cfaa9`，tag `phase-0.6-runtime-abstraction-baseline`）完成了架构解耦，但 Gap Matrix 中 **0.6A Session Model / 0.6E Resource Model+Preflight 的实现仍为 NOT_STARTED**：`session.rs` 不存在；`lease.rs` 无 renew；resource 编排缺 allocate/release-to-stop/TTL 触发；main.rs diagnostic 路径的内联生命周期（acquire→materialize→instantiate→start→watchdog，main.rs:583-771）无测试、无 stop 路径（`MediaBackend::stop` 全仓零调用）、7 个 RuntimeEvent 变体零发射。Pipeline/Lease/Resource/Health 各自独立运行，没有统一 owner。这些是**冻结契约（RUNTIME_SESSION_MODEL / RUNTIME_RESOURCE_MODEL / RUNTIME_LIFECYCLE_SEQUENCE，均 P0 FROZEN）的实现债务**，也是后续 Normalize/Audio/API 稳定运行的前置。

**分段编号说明**：本 change 沿用 roadmap 新分段 **0.7A = Runtime Ownership**（用户终审裁定），替代 MASTER_PRD §5 旧 0.7A-G 子阶段标签（旧 0.7A=External API 等）；PRD 文档本身不改（§二十五 禁令），替代关系记录于本 change 文档。实现语义严格对齐冻结契约，无任何新发明。

## What Changes

- **`src/session.rs`（新）**：`MediaSession`（session_id/graphs 语义描述/source+output ports/resource_claims/lease/pipeline: Option<PipelineHandle>/health 快照）——逻辑持有、物理引用，绝不含 concrete backend 对象；两级状态机（粗态 RESERVED→RUNNING→PAUSED→RELEASING→RELEASED，RELEASED→RUNNING 拒绝；微相位 Requested→Provisioning→Binding→Leased→Starting→Running→Stopping→Released + 失败态），白名单迁移。
- **`SessionManager`（唯一生命周期 owner，RUNTIME_SESSION_MODEL §4.1）**：`create/start/stop/close/status/list`；生命周期引擎实现冻结顺序 `Intent→Preflight→Reserve→Create Session→Lease→Binding verify→Backend.instantiate→Allocate→Backend.start→RUNNING`；失败精确逆序回滚（Allocate→Lease→Reservation→销毁 Session），creator=destroyer，零孤儿。
- **Resource Orchestration 补全（resource.rs）**：`allocate_for`（instantiate 成功后 Reserved→Allocated）、`release_allocation`（对接 `MediaBackend::stop`——该 trait 方法首次被真实调用）、预留 TTL 过期触发。
- **Lease（lease.rs）**：trait 增 `renew`；接线 config 既有未消费旋钮（`default_lease_ttl`/`lease_renew_window`）；过期扫描由 health tick 驱动（无后台线程）；设备丢失后恢复前强制重验 lease（既有不变量）。
- **Preflight 分级报告（新 `preflight.rs`）**：`graph→port availability→resource capacity→lease conflict→identity/binding→backend capability` 逐阶段结果 + PASS/WARN/FAIL 裁决；topology/risk 级 report-only；**只判断不执行**（V0.2 §1.2 三层 Preflight 语义）。
- **事件补线（events.rs）**：additive `SessionCreated/SessionStateChanged/SessionFailed` kinds；点亮零发射事件（LeaseGranted/ResourceAllocated/ResourceReservationExpired/IdentityResolved）；不加新事件平面（TD-16 保持）。
- **main.rs 重接线**：diagnostic auto-start 路径改走 SessionManager；Production 仍 Ready 等控制面；MEDIA-RT-01 selftest 路径不动。
- **门禁**：**SESSION-RT-01**（全生命周期 + 失败回滚 + double-start/stop 拒绝）与 **RESOURCE-RT-01**（并发争抢/容量/冲突/release/expiry/crash cleanup），各三层测试（Unit/Simulation-Mock/Hardware）；CI 新增 `session-lifecycle` required job（七 context）。

## Capabilities

（`skip_specs: true`——canonical 语义 SoT 为 `docs/architecture/` 冻结契约 RUNTIME_SESSION_MODEL / RUNTIME_RESOURCE_MODEL / RUNTIME_LIFECYCLE_SEQUENCE / MEDIA_BACKEND_CONTRACT §1.1；本 change 是其实现，非新需求。）

## Impact

- **编译**：default/simulation/mock/bmd,gstreamer/hardware-test 五套保持可编译；fmt/clippy -D 全绿（CI 七 gate 不降）。
- **受影响代码**：新 `session.rs`/`preflight.rs`；`resource.rs`/`lease.rs`/`events.rs`/`main.rs`/`supervisor.rs`（recovery 服务 Session 的接线点）/CI workflow + protection。
- **行为变化**：diagnostic auto-start 从内联代码变为 SessionManager 驱动（事件更完整、有 stop 路径）；新增 `VBMF_SESSION_LIFECYCLE=1` 真机门禁入口。
- **明确不做**：Normalize/Clock/Timecode/Audio/External API/Webhook/UI/全局 Scheduler/多站点/AJA/ONVIF/Kafka/NATS/GraphQL/第二套 Resource·Event Model/V0.2 §3.11 九维资源向量（记 0.7 债务，本期 DEVICE_EXCLUSIVITY=capacity-1 端口语义）/PAUSED 媒体面语义（状态保留，行为 0.7B）。
