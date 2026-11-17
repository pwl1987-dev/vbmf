---
title: "Phase 0.6 C3 (0.6F): Registry / Mock / Simulation — 技术设计"
change: p06-f-registry-mock-simulation
change_id: p06-f-registry-mock-simulation
comet_change: p06-f-registry-mock-simulation
role: technical-design
spec: openspec
canonical_spec: openspec
links:
  - "[p06-f-registry-mock-simulation](p06-f-registry-mock-simulation)"
---

# Design: Phase 0.6 C3 — Registry / Mock / Simulation

## Mock Provider / Backend

- `providers/mock/` 实现 `HardwareProvider`：`discover()` 返回注入的设备清单；`open()` 返回可配置 DeviceHandle；`identity()` 返回注入的 CanonicalDeviceId；可注入故障（如 AmbiguousIdentity）以验证 C2 的拒识路径。
- `backends/mock/` 实现 `MediaBackend`：`materialize(plan)` 返回注入的 Pipeline（不触碰 GStreamer）；`src_props()` 返回与真实一致的 `connection=` 片段（audio 不设 connection）；按 plan 发出 C2 的 `RuntimeEvent` 序列（IdentityResolved→SourceMaterialized→SignalVerified…）。

## AdapterRegistry

- `registry.rs::AdapterRegistry` 持有 Provider/Backend 工厂；按解析顺序：显式配置 > `simulation` feature > 默认（真实）；
- 与 0.6B+C 的 trait 配合：Registry 只返回 `HardwareProvider` / `MediaBackend` trait 对象，调用方不感知具体适配器；
- 真机构建（`bmd-provider,gstreamer-backend`）仍走真实适配器；`simulation` 走 Mock。

## feature 映射

- `simulation` 编译 `providers/mock/` + `backends/mock/` + 接入 Registry；`default` 不含 Mock（最小可编译）；
- 与现有 `simulation` feature（已有 mock 设备）合并语义，避免重复。

## 关键约束

- Mock 必须复用 C2 的 `RuntimeEvent` 契约，不得另起事件类型；
- canonical 管线语义保持不变（Mock 仅仿真，不改语义）；
- 防自动 Fallback：Registry 选择失败须走 C2 的 Preflight/Policy，绝不静默换适配器。

## 不做（本 change 边界）

- 不做架构 lint 门禁（0.6G）；
- 不做 HW-PORT-01 真机回路（0.6H/I）；
- 不做 Scheduler（仅冻结契约）。
