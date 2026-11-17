# Change: Phase 0.6 C3 — Registry / Mock / Simulation (0.6F)

## Why

- 0.6B+C 已冻 SPI，但只有真实 BMD/GStreamer 适配器；CI 与单测无法在无硬件/无 SDK 环境覆盖采集/信号逻辑。
- 缺统一的 Adapter Registry：无法按配置在 Mock 与真实适配器间选择，也无法为 0.6G/0.6H/I 门禁提供可切换实现。
- 0.6D 的 `RuntimeEvent` 需要可注入的仿真源来验证 Supervisor 行为。

## What is Changing

- 新增 `providers/mock/`：实现 `HardwareProvider` 的 Mock（可注入设备清单/身份/故障），无 BMD SDK 依赖；
- 新增 `backends/mock/`：实现 `MediaBackend` 的 Mock（可注入 SourcePlan→事件流），无 GStreamer 依赖；
- 新增 `registry.rs`：`AdapterRegistry` 按配置（`simulation` feature / 环境变量 / manifest）选择 Provider/Backend 实现；
- feature `simulation` 编译 Mock 适配器并接入 Registry；`default` 仍最小可编译；
- Mock 发出的事件遵循 C2 的 `RuntimeEvent` 契约（为 0.6G/0.6H/I 门禁提供可测实现）。

## Impact

- 编译：`default` / `simulation` 单测保持通过；`--features simulation` 可跑 Mock 采集链路；
- 不受影响：真实 BMD/GStreamer 适配器（0.6B+C）、V0.2 核心定义、canonical 管线语义；
- 后续铺垫：0.6G 解耦门禁（用 Mock 验证 Domain 编译）、0.6H/I 门禁（Mock vs 真实共享 CanonicalPipelinePlan）。
