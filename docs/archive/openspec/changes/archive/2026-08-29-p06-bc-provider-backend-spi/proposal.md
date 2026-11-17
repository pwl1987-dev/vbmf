# Change: Phase 0.6 C1 — HardwareProvider / MediaBackend SPI 抽取 (0.6B+C)

## Why

`media-agent` 当前在 `main.rs` / `resolver.rs` / `signal.rs` / `pipeline.rs` 中**直接依赖 `decklink`（BMD FFI）与 `gstreamer` crate**，违反 V0.2 四层抽象（Domain → Contract/Runtime → Adapter）。后果：

- 无法在删去真实硬件依赖时编译 Domain/Graph/Session/Supervisor/Health —— 即 ARCH-PORTABILITY-01 门禁的前提不满足；
- 难以接入 Mock Provider 做仿真矩阵（0.6F）与统一 RuntimeEvent（0.6D）；
- vendor 错误类型（HRESULT / GStreamer Message）渗入 Supervisor，破坏 Canonical Error-Event 契约。

Phase 0.6 裁决顺序：先冻契约 → 过两道门禁 → 降级 BMD/GStreamer 为 Reference Adapter → 才进 Normalize(0.7)。C1 是“冻契约 + 建 SPI”的第一步。

## What is Changing

- 新增 `providers/` 模块：`providers/blackmagic/` 承载 BMD FFI（`decklink.rs` / `sdk.rs` 迁入），对外**仅暴露 `HardwareProvider` trait**；
- 新增 `backends/` 模块：`backends/gstreamer/` 承载 GStreamer 采集执行（`pipeline.rs` 的媒体路径迁入），对外**仅暴露 `MediaBackend` trait**；
- 定义 `HardwareProvider` / `MediaBackend` trait（Provider/Runtime 契约层）；`main` / `resolver` / `signal` / `pipeline` 改为依赖 trait 而非 crate 顶层；
- feature 重构：`bmd` → `bmd-provider`，`gstreamer` → `gstreamer-backend`（保留兼容或平滑迁移）；
- canonical 采集管线（`decklinkvideosrc`+`decklinkaudiosrc` → RAW → Normalize → FRAME/MASTER SWITCH → Encode → 分发）仍由 `GStreamerBackend` 实现，身份/探测逻辑迁入 Provider。

## Impact

- 编译：`default` / `simulation` 单测保持通过；`--features bmd-provider,gstreamer-backend` 真机构建保持可用；
- 不受影响：V0.2 核心定义、JSON-RPC 契约、Resolver 身份优先级（PersistentId > DeviceHandle > TopologicalId）、canonical 管线语义；
- 后续铺垫：0.6D RuntimeEvent/Supervisor、0.6E Resource/Preflight、0.6F Mock Provider/Backend、0.6G 架构门禁。
