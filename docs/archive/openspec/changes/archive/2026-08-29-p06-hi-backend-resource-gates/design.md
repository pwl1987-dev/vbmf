# Design: Phase 0.6 C5 — 门禁组

## ARCH-BACKEND-01

- Mock(`backends/mock/`) 与 GStreamer(`backends/gstreamer/`) 实现同一 `MediaBackend` trait，且都从同一 `CanonicalPipelinePlan` 物化；
- 断言：交换 Backend 实现，Domain/Graph/Session/Supervisor/Health 行为一致（Test C 延伸）。

## RESOURCE-01

- 复用 C2 `Resource` 模型 + C4 门禁框架：materialize 前 `preflight` 校验 Resource 可用；不可用则拒（绝不静默回退）。

## HW-PORT-01

- 端口级绑定闭环：`manifest` 声明端口 → 实际探测（亮度黑场 / 格式匹配 / state=locked）→ 闭环验收；
- 复用 `hw_port_01::verify` 遍历 manifest 端口，实际 rank < 声明 rank ⇒ 失败闭环。

## HW-IDENT-02

- 身份优先级 PersistentId > DeviceHandle > TopologicalId > EnumerationOnly；多重 HIGH → `Ambiguous`（拒）；`device-number` 绝不默认 0；
- 复用 `resolver.rs` 的 `set_state(READY)` 遍历 + 禁 `GstDeviceMonitor`。

## MEDIA-RT-01

- `pts_monotonic` 只置 false；`PipelineHealth` Default=true；`MEDIA_AGENT_SELFTEST=1` 跑通即 A+B+C；appsink 仅 observer。

> [勘误 2026-08-29, p06-final-merge-hardening P0-6] "PipelineHealth Default=true" 为旧口径草稿表述;
> 实际实现为三态 PtsMonotonicity + Default=absence-of-evidence (acceptance 全 false, 绝不默认假过)。
> 详见本归档 tasks.md §5 勘误注记与 verify 报告 INFO。

## 关键约束（来自 CODEBUDDY.md / 真机核验）

- `connection` nick：`optical-sdi` 非 `optical`；audio audiosrc 不设 connection；
- 已核验官方常量随 FFI 在 Provider 内，改前对盒 SDK 头 grep；
- 真机闭环事实：loopback = MiniMon sink2 → Duo capture0；双门全绿基线 default+sim 84 / bmd 83。

## 不做（本 change 边界）

- 不进 Normalize(0.7)（须本门禁组全绿后才允许）；
- 不做新增硬件适配器（AJA 等 P2）。
