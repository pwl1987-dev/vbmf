---
title: "Phase 0.6 C2 (0.6D+E): RuntimeEvent / Resource — 技术设计"
change: p06-de-runtime-event-resource
change_id: p06-de-runtime-event-resource
comet_change: p06-de-runtime-event-resource
role: technical-design
spec: openspec
canonical_spec: openspec
links:
  - "[p06-de-runtime-event-resource](p06-de-runtime-event-resource)"
---

# Design: Phase 0.6 C2 — RuntimeEvent / Resource

## RuntimeEvent（草拟）

- 枚举成员覆盖生命周期：IdentityResolved / SourceMaterialized / SignalVerified / LoopbackVerified / LeaseGranted / ResourceAllocated / ResourceReservationExpired / PipelineFault / HardwareFault / HealthChanged / AmbiguousIdentity(device_handle, candidates)；
- `supervisor.rs` 订阅 Provider/Backend 归一化事件，作为唯一 `RuntimeEvent` 出口；下游（Health / RPC / 日志）只消费 `RuntimeEvent`，不再直接碰 vendor 类型。

## Resource 模型（对齐 V0.2 §3.11）

- `Resource { id, capability: CapabilityValue<…>, capacity, availability, allocation, reservation }`；状态机：Available → Reserved → Allocated → (Releasing | Faulted)；
- Resource 是对 Capability 的抽象（≠ Device/Port）；一个 Device 可暴露多个 Resource；
- 与 `DeviceCapabilities`(`port.rs`) / `PortRegistry` 衔接：Resource 由 Discovery 结果派生。

## Preflight（防自动 Fallback）

- `materialize` 入口前置 `preflight(plan, resources)`：校验目标 Resource 可用 + 无冲突预留 + 身份已 Resolve；
- 失败路径：返回 `RuntimeEvent::AmbiguousIdentity` / `ResourceUnavailable`，由上层 Policy 决策；**绝不静默回退到 device 0 或另一硬件**；
- 与 0.6B+C 的 Provider/Backend SPI 配合：Provider 暴露的 identity 作为 Preflight 输入。

## 关键约束（来自 CODEBUDDY.md）

- 多重 HIGH → `Ambiguous`（拒）；`device-number` 绝不默认 0；
- MEDIA-RT-01：`pts_monotonic` 只置 false；`PipelineHealth` Default=true；
- 不改 V0.2 的 12 Engines / Switch Mode 3 种 / Data Plane 4 Layer。

## 不做（本 change 边界）

- 不做 Mock Provider/Backend（0.6F）；
- 不做架构 lint 门禁（0.6G）；
- 不做 HW-PORT-01 真机回路（0.6H/I）。
