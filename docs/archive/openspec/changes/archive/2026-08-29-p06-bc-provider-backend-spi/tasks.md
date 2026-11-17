# Tasks: Phase 0.6 C1 (0.6B+C)

> 落地结构偏差说明: 原任务用 `providers/`+`backends/` 目录名, 实际落地为
> `contracts/`(SPI 冻结) + `adapters/blackmagic` + `adapters/gstreamer`(Reference Adapter 命名空间).
> SPI 采用 "canonical 名 = 既有 trait 别名" 的零风险冻结策略.
>
> **⚠️ 状态重判（2026-08-28 审计）**：本分支当前提交 `997e9dd` **不应**标记为 "Phase 0.6B+C SPI 已建立完成"。
> 实际交付 = **C1 / SPI Namespace Scaffold**（命名空间 + transitional alias）。
> `HardwareProvider = DeviceManager`、`MediaBackend = PipelineController` 是类型别名，
> Domain 仍按路径引用 `adapters/blackmagic`（依赖方向未解），故 ARCH-PORTABILITY-01 / ARCH-BACKEND-01 尚未通过。
> 真正 SPI 解耦从 C2 起推进（见下 "C2/C3/C4 待办"）。

## 1. 建立 Provider/Backend SPI 命名空间 (C1 = Scaffold, 非 SPI Complete)
- [x] `contracts/` + `adapters/blackmagic` + `adapters/gstreamer` 命名空间建立（SPI/Adapter 边界冻结）
- [x] `contracts/provider.rs`: `HardwareProvider` = `device::DeviceManager` 重导出别名 (transitional, C2 替换为真 trait)
- [x] `contracts/backend.rs`: `MediaBackend` = `pipeline::PipelineController` 重导出别名 (transitional, C2 替换为真 trait)
- [x] **解耦修复(A批)**: `MediaBackend` 仅 `gstreamer-backend` 门控, 不再依赖 `bmd-provider` (Backend/Provider 正交)
- [x] trait 不含 vendor 错误类型 (沿用既有 error 模型; 统一到 RuntimeEvent 留 0.6D)

## 1b. C2 / C3 / C4 待办（真正 SPI 解耦，非 C1 范围）

> **✅ 收口确认（2026-08-29）**：以下 7 项代码均已落地提交，本地代码级核对 +
> 盒上验证记录（2026-08-28，p06-g tasks §4：clippy 7 套 feature 组合 0 error；
> test default 84 / simulation 84 / mock 87 全过）通过后补勾。
> `48e23d8` 仅恢复文档/脚本，未动 Rust 源码，盒上验证对当前树仍有效。

- [x] **C2** 真正的 `trait HardwareProvider` (`discover()` + `probe_capabilities()` + `probe_connector_config()`) — `contracts/provider.rs:40` (commit `f27888e`)；返回 canonical `Vec<DeviceInfo>`，错误沿用既有模型（统一到 RuntimeEvent 留 0.6D）
- [x] **C2** 真正的 `trait MediaBackend` (`prepare`/`start`/`recover`/`poll_bus`) — `contracts/backend.rs:21` (commit `f27888e`)
- [x] **C2** `BlackmagicHardwareProvider` / `GStreamerMediaBackend` 实现上述 trait — `impl HardwareProvider for DeckLinkDeviceManager` (`adapters/blackmagic/device_manager.rs:94`)、`impl MediaBackend for GStreamerPipelineController` (`adapters/gstreamer/controller.rs:191`)
- [x] **C3** `MockHardwareProvider` / `MockMediaBackend`（解锁正交矩阵 Mock×Mock / Mock×GStreamer）— `adapters/mock.rs`: `MockProvider`/`MockProviderB`/`MockBackend` (commit `498a603`)
- [x] **C4** ARCH-PORTABILITY-01：移除 `adapters/blackmagic` 后 `domain/contracts/runtime` 仍可编译 — 盒上 `--no-default-features --features simulation` / `--features mock` 构建 OK + 词法门禁 0 违规 (commits `ab8e189`/`46c9a11`/`48e23d8`)
- [x] **C4** ARCH-BACKEND-01：`MockBackend` 与 `GStreamerBackend` 用同一 `PipelinePlan` 物化 — `MediaBackend::prepare(&PipelinePlan)` 为共享契约，两个实现同形
- [x] **C8** CI 增加 `architecture-boundary` gate：`domain/** contracts/** runtime/**` 禁止出现 `decklink`/`gstreamer`/`ffmpeg`/`srs` 引用 — `scripts/check_arch_portability.py` 接入 `media-agent.yml` test job (commits `46c9a11` + `48e23d8` 空文件修复)

## 2. 迁移 BMD FFI 到 adapters/blackmagic
- [x] `decklink.rs` / `sdk.rs` 迁入 `adapters/blackmagic/` (git mv), 仅经 `crate::adapters::blackmagic::decklink` 暴露
- [x] `IDeckLinkInput` 限定 Discovery/诊断用途 (既有语义未改)
- [x] feature `bmd` → `bmd-provider` (Cargo.toml 规范名 + 旧名 `bmd` 作兼容别名; build.rs 与全部 .rs 已改用 `bmd-provider`)
> 注: `DeckLinkDeviceManager` 定义保留 `device.rs` (Domain), 仅将其 `crate::decklink` 引用改为 `crate::adapters::blackmagic::decklink`. "Domain 不依赖 decklink crate 顶层" 已满足; 彻底迁出 Domain 留待 C4 ARCH-PORTABILITY-01 收尾.

## 3. 迁移 GStreamer 执行到 adapters/gstreamer
- [x] `pipeline.rs` 的 `GStreamerPipelineController` gstreamer 引用已全在 `#[cfg(feature="gstreamer-backend")]` 内; `adapters/gstreamer/mod.rs` 重导出 + 提供 `gstreamer_runtime_version()`
- [x] canonical 管线语义保留 (decklinkvideosrc + decklinkaudiosrc → RAW → Normalize → FRAME/MASTER SWITCH → Encode → 分发)
- [x] `src_props` 按 connector 拼 `connection=`; audio audiosrc 不设 connection (既有未改)
- [x] feature `gstreamer` → `gstreamer-backend` (Cargo.toml 规范名 + 旧名 `gstreamer` 作兼容别名)
> 注: 未物理移动 GStreamerPipelineController 出 pipeline.rs (其 gstreamer 引用已全 gated, 满足验收); adapters/gstreamer 经重导出确立 adapter 命名空间.

## 4. 解耦调用方
- [x] `main`/`resolver`/`signal`/`pipeline` 改为依赖 trait / adapters 命名空间, 移除对 `decklink`/`gstreamer` crate 顶层的直接依赖 (gstreamer 引用均 gated; main 的 `gstreamer::version()` 改经 `adapters/gstreamer::gstreamer_runtime_version()`)
- [x] Resolver 身份优先级与 `set_state(READY)` 遍历逻辑保持 (resolver 内, gated)

## 5. 验证 (CI 门禁) — 盒 10.30.15.10 已全绿 (2026-08-28)
- [x] `cargo test` default → DEF_TEST_EXIT=0
- [x] `cargo test --features simulation` → SIM_TEST_EXIT=0
- [x] `cargo clippy --all-targets -- -D warnings` (default) → DEF_CLIPPY_EXIT=0
- [x] `cargo build --features bmd,gstreamer` (兼容别名) → COMPAT_BLD_EXIT=0
- [x] `cargo clippy --all-targets --features bmd,gstreamer -- -D warnings` → COMPAT_CLIPPY_EXIT=0
- [x] `cargo build --features bmd-provider,gstreamer-backend` (规范名) → CANON_BLD_EXIT=0
- [x] `cargo clippy --all-targets --features bmd-provider,gstreamer-backend -- -D warnings` → CANON_CLIPPY_EXIT=0
> 验证脚本 `box_verify_c1.sh` (tar+scp 到盒, `bash ~/box_verify_c1.sh`). 修复了 4 个 clippy 门禁问题: decklink.rs `probe_connector_config` re-export 按 bmd-provider gated; main 改经 `HardwareProvider`/`MediaBackend` SPI 别名; resolver `map_or`→`is_some_and`; main 的 `GStreamerPipelineController` 引用改走 `adapters/gstreamer` 命名空间. (初版脚本曾把 `--features` 误置于 `--` 之后导致 clippy 误报, 已修正.)
