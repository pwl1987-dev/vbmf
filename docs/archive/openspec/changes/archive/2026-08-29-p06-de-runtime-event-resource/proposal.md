# Change: Phase 0.6 C2 — RuntimeEvent / Supervisor 统一 + Resource / Preflight (0.6D+E)

## Why

- 当前 `supervisor.rs` / `health.rs` 直接使用 GStreamer `Message` / HRESULT 等 vendor 错误，违反 Canonical Error-Event 契约；事件源分散，难以做统一可观测与回放。
- 缺 Resource 模型：`materialize` 前不校验设备/端口可用性，易出现「自动 Fallback 到错误硬件」——而 ARCH 防回退门禁要求 **Policy + Capability + Preflight + 决策**，绝不静默换硬件。
- 0.6F（Mock）、0.6G（解耦门禁）、0.6H/I（多门禁）都依赖统一的 `RuntimeEvent` 与 `Resource` 抽象作为前提。

## What is Changing

- 新增 `events.rs`：`RuntimeEvent` 枚举（IdentityResolved / SourceMaterialized / SignalVerified / LoopbackVerified / LeaseGranted / ResourceAllocated / PipelineFault / HardwareFault / HealthChanged / AmbiguousIdentity），取代散落的 vendor 错误；`supervisor.rs` 成为唯一事件源。
- 重构 `supervisor.rs`：消费 Provider/Backend 上抛的归一化事件，统一发出 `RuntimeEvent`；Rust 错误类型不再携带 BMD/GStreamer specifics。
- 新增 `resource.rs`：`Resource` 模型（Capability / Capacity / Availability / Allocation / Reservation），状态机 Available→Reserved→Allocated→Releasing→Faulted，对齐 V0.2 §3.11；**Resource ≠ Device**。
- 新增 Preflight：`materialize` 前做 Resource 可用性校验 + 防自动 Fallback（失败须 Policy+Capability+Preflight+决策，绝不静默换硬件）。
- 不改 JSON-RPC 契约、V0.2 核心定义、canonical 管线语义。

## Impact

- 编译：`default` / `simulation` 单测保持通过；
- 受影响：Supervisor/Health 事件链路、`materialize` 入口（加 Preflight 闸门）；Provider/Backend 错误须映射到 `RuntimeEvent`；
- 后续铺垫：0.6F Mock（用 `RuntimeEvent` 仿真）、0.6G 解耦门禁、0.6H/I 的 Resource-01 / HW-PORT-01 / HW-IDENT-02 / MEDIA-RT-01。
