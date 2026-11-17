# Tasks: Phase 0.6 C3 (0.6F)

> 落地结构偏差说明：原任务用 `providers/mock/` + `backends/mock/` 目录名，实际落地为
> `adapters/mock.rs`（与 p06-bc 的 `contracts/` + `adapters/{blackmagic,gstreamer,mock}` 目录口径一致）。
> Mock 由 `mock` feature（纯 Rust，不拉 GStreamer）承载，与 `simulation`（Domain 级模拟设备）分离。

## 1. Mock Provider

- [x] 新增 `adapters/mock.rs` 实现 `HardwareProvider`（注入设备/身份）— `MockProvider`/`MockProviderB`（C3, `498a603`；确定性 UUID v5 注入身份，`identity_source=Simulation`，`bmd_persistent_id=None`）
- [x] 注入身份经 `discover()` 返回 canonical `DeviceInfo`；拒识路径（`ResolverMatch::Ambiguous`，`resolver.rs:400-420/507-552`）在 Domain resolver 已实现，可经 Mock 注入重复设备清单验证（注：SPI 无独立 `identity()` 方法，注入经 `discover()` 承载；Ambiguous 路径无专门单测，见 verify NOTE）

## 2. Mock Backend

- [x] 新增 `adapters/mock.rs` 实现 `MediaBackend` — `MockBackend`（C3, `498a603`；`prepare/start/recover→Ok`，`poll_bus→空 Vec`，不链接 GStreamer）
- [x] `src_props` 为 Domain `materialize` 逻辑（vendor-neutral，双后端共享 — ARCH-BACKEND-01 核心）；Mock 后端从同一 `PipelinePlan` 物化，canonical `connection=` 语义（audio 不设 connection）按架构继承（注：`src_props` 非 `MediaBackend` trait 方法）
- [x] 按 plan 发出事件序列 — 当前 `poll_bus→空 Vec`；`RuntimeEvent` 契约属 0.6D（`p06-de-runtime-event-resource`，未实现），Mock 事件流注入留待 0.6D 后补（注：已归因延迟，非缺口）

## 3. AdapterRegistry

- [x] 新增 `registry.rs::AdapterRegistry`，按 feature 选择 Provider/Backend（C5, `a888039`；优先级 `mock > simulation > bmd-provider > default`）
- [x] 与 0.6B+C trait 配合：只暴露 trait 对象 — `Box<dyn HardwareProvider>` / `Arc<dyn MediaBackend>`；`main` 经 trait 对象接线（C2c, `486f95b`），调用方不感知具体适配器

## 4. feature 接入

- [x] `mock` feature 编译 Mock 并接入 Registry；`simulation` 提供 `SimulatedDeviceManager`；`default` 仍最小可编译（注：设计稿写 `simulation`，实际拆为 `mock`/`simulation` 双 feature — `mock` 纯 Rust 不拉 GStreamer，`MediaBackend` 门控 `any(gstreamer-backend, mock)`，见 p06-bc design.md §9）
- [x] 与现有 simulation mock 设备语义合并 — Registry 两级优先级（`mock > simulation`）即合并点，无重复实现

## 5. 验证（CI 门禁）

- [x] `cargo clippy --all-targets -- -D warnings`（default + simulation + `bmd-provider,gstreamer-backend` 等 7-8 套 feature 组合全 0 error）— 盒上 2026-08-28（记录于 p06-bc design.md §11.2 / p06-g tasks.md §4）
- [x] `cargo test` default + simulation 通过 — 盒上 2026-08-28：default 84 / simulation 84 / mock 87（含 Mock 3 单测）
- [x] `cargo build --features simulation` 通过且 Mock 链路可启动 — 盒上 2026-08-28：simulation/mock 构建 OK；Mock 链路 = `MockProvider`/`MockProviderB`/`MockBackend` 生命周期单测全绿（确定性/双设备拓扑/后端生命周期）

---

## ✅ 收口确认（2026-08-29）

- **实现核对**：12 项任务逐项对照代码核验 — `adapters/mock.rs`（MockProvider/ProviderB/Backend + 3 单测）、`registry.rs::AdapterRegistry`（cfg 优先级分支互斥穷尽）、`main.rs` trait 对象接线（C2c）、`Cargo.toml` `mock`/`simulation` 双 feature、`contracts/backend.rs` 门控 `any(gstreamer-backend, mock)`。
- **验证证据**：盒上 2026-08-28 矩阵（clippy 0 error ×7-8 组合；test 84/84/87；build 4 组合）+ 13 步盒上验证脚本（`box_verify_c5.sh` 已入库）；自验证后 Rust 源码未变（其后仅文档/归档提交），证据有效。本机（Windows）无 Rust 工具链，构建/测试证据以盒上为准。
- **偏差与留待**（均非阻塞）：
  1. 目录名 `adapters/mock/` vs 设计稿 `providers/mock/`+`backends/mock/` — 与 p06-bc 目录口径一致；
  2. `identity()` 方法不存在 — 注入身份经 `discover()` 返回的 `DeviceInfo` 承载（SPI 形状 C2 冻结）；Ambiguous 拒识机制在 Domain resolver 已实现，缺专门单测（verify NOTE）；
  3. `src_props` 非 Backend 方法 — 属 Domain 共享物化逻辑，Mock 按架构继承 canonical 语义；
  4. `RuntimeEvent` 事件流注入 — 留待 0.6D（`p06-de`）契约落地后补；
  5. `simulation` vs `mock` — 设计稿单 feature，实际拆双 feature（`mock` 纯 Rust / `simulation` Domain 级）。
- **提交归属**：C3 = `498a603`/`0e3fcb6`，C5 = `a888039`（均在 p06-bc 分支实现，本 change 收口时经 rebase 纳入绑定分支历史）。
