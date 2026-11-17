---
title: "Phase 0.6 C1 (0.6B+C): Provider/Backend SPI 抽取 — 技术设计"
change: p06-bc-provider-backend-spi
change_id: p06-bc-provider-backend-spi
comet_change: p06-bc-provider-backend-spi
role: technical-design
spec: openspec
canonical_spec: openspec
links:
  - "[p06-bc-provider-backend-spi](p06-bc-provider-backend-spi)"
---

# Design Doc — Phase 0.6 C1 (0.6B+C): Provider/Backend SPI 抽取

> 本设计文档对应 OpenSpec change [`p06-bc-provider-backend-spi`](../../../changes/p06-bc-provider-backend-spi)（canonical spec = OpenSpec）。
> Superpowers 深度设计文档。配套 `proposal.md` / `tasks.md`（open 阶段产物）。本文件是 design 阶段交付物，聚焦**可执行边界**与**逐文件迁移方案**。

## 1. 现状事实（已核验，非臆测）

- `pipeline.rs`（1279 行）**已经**把 GStreamer 相关代码用 `#[cfg(feature = "gstreamer")]` 隔离：
  - vendor-neutral：`SourcePlan` / `PipelinePlan` / `materialize` / `src_props` / `PipelineHealth` / `PtsMonotonicity` / `MediaRt01Acceptance` / `PipelineError` / `PipelineController` trait / `PipelineHandle` / `BusSeverity` / `PipelineBusEventKind` / `PipelineBusEvent` / `bus_event_recovery_policy` / `read_health`。
  - gstreamer-gated：`GStreamerPipelineController` 的 `build_pipeline` / `translate_bus` / `attach_video_sink` / `attach_audio_sink` / `poll_bus`，以及 `HEALTH_ARCS` 的 GstInstance 字段。
  - `#[cfg(not(feature = "gstreamer"))]` 为 `prepare/start/recover` 提供 stub。
- `decklink.rs` / `sdk.rs` 是 BMD FFI 层（`main.rs` 经 `#[cfg(feature = "bmd")]` 在模块级引用；模块内部 FFI 调用用 cfg 隔离）。`device.rs:20` 顶层 `use crate::decklink::BmdDeviceIdentity;` 与 `device.rs:182` `crate::decklink::enumerate()` 是**未 cfg 隔离**的跨层依赖（C1 需处理）。
- `resolver.rs` / `signal.rs` 大量 `use gstreamer::*`（probe / 测试 pipeline），均在某 feature 路径下被调用，但模块内部部分 `gstreamer::` 引用需确认 cfg 边界。
- `main.rs`（891 行）直接调用 `crate::decklink::*`（probe_connector_config / registry / start_capture）、`sdk::probe_sdk`、`crate::pipeline::*`、`gstreamer::version()`。

## 2. 目标架构（四层 → 模块目录）

```
src/
  domain/            (Canonical Media Runtime, 无 vendor top-level 引用)
    mod.rs  port.rs  device.rs  resolver.rs  signal.rs  lease.rs  config.rs
    health.rs  supervisor.rs  rpc.rs  graph_intent.rs  hw_port_01.rs
    pipeline.rs        ← canonical ingest 模型 + Materialize 逻辑(保留, vendor-neutral)
  contracts/         (SPI = Runtime Contracts)
    mod.rs  provider.rs  backend.rs
  runtime/           (Runtime Orchestration)
    mod.rs  session.rs  binding.rs  preflight.rs  scheduler.rs(冻结)
  adapters/
    mod.rs
    blackmagic/      ← 仅此目录引用 decklink/sdk + bmd-provider feature
      mod.rs  decklink.rs  sdk.rs
    gstreamer/       ← 仅此目录引用 gstreamer + gstreamer-backend feature
      mod.rs  controller.rs
```

> **最低可行边界（本 change 锁定）**：① `adapters/blackmagic/` 独占 `bmd`/`decklink`/`sdk` 引用；② `adapters/gstreamer/` 独占 `gstreamer`/`gstreamer_app`/`glib` 引用；③ `domain/`+`contracts/`+`runtime/` 编译期不含 vendor crate 顶层引用（`default` / `simulation` 构建验证）。
> `resolver.rs`/`signal.rs` 的 GStreamer 探活逻辑本质依赖 GStreamer，采用「保留在 domain 但用 `#[cfg(feature = "gstreamer-backend")]` 包裹」最小化移动面（其产出 `ResolvedDeviceBinding`/`SignalStatus` 属 Domain 语义）。

## 3. Trait 定义（契约冻结）

> **⚠️ C1 实际交付说明（2026-08-28 审计后）**：本节下方给出的富 `HardwareProvider` / `MediaBackend` trait
> 是 **C2 目标契约**，并非 C1 已实现内容。C1 仅落地了 "canonical 名 = 既有 trait 别名"
> （`HardwareProvider = DeviceManager` / `MediaBackend = PipelineController`，见 `contracts/*.rs`），
> 且 `MediaBackend` 已在 A 批修复为仅 `gstreamer-backend` 门控（解除对 `bmd-provider` 的耦合）。
> 真正的 trait 与 Adapter 物理抽取（迁出 `device.rs` / `pipeline.rs`）在 C2 起完成。

> **✅ C2 已实现（2026-08-28）**：`contracts/provider.rs` / `contracts/backend.rs` 已落地独立的
> `trait HardwareProvider` / `trait MediaBackend`，分别由 `device::*DeviceManager`
> （Blackmagic / Filesystem / Simulation）与 `pipeline::GStreamerPipelineController` 实现；
> `MediaBackend` 沿用 A 批约定仅 `gstreamer-backend` 门控。
> **与下方契约的偏差（已对齐审计）**：`HardwareProvider::discover()` 当前返回 `Vec<DeviceInfo>`
> （非 `Result<Vec<DeviceInfo>, ProviderError>`）——因 `main.rs` 在 C2c 之前仍按 `Vec` 消费，
> 且 vendor 错误类型统一到 `RuntimeEvent` 留 0.6D；`probe_capabilities` / `probe_connector_config`
> 已就位但返回占位空值，真实 SDK 能力/端口探针回填留 C5/C...。Adapter 物理迁出留 C6/C7。

### `contracts/provider.rs` — `HardwareProvider`

```rust
pub trait HardwareProvider: Send + Sync {
    /// 枚举硬件并解析为 canonical DeviceInfo（BMD 身份细节在 Adapter 内消化，不外泄）。
    fn discover(&self) -> Result<Vec<DeviceInfo>, ProviderError>;
    /// SDK 能力探针（仅 Reference Adapter 实现；返回 canonical 能力报告）。
    fn probe_capabilities(&self) -> Vec<CapabilityReport>;
    /// 连接配置探针（diagnostic / 端口闭环）。
    fn probe_connector_config(&self) -> ConnectorConfig;
}
```

- `DeviceInfo` / `CapabilityReport` / `ConnectorConfig` 均为 Domain 类型（`device.rs` / `port.rs`）。
- BMD 实现：`adapters/blackmagic/decklink.rs` 的 `discover` 内部调用原 `enumerate()` + 身份映射；`sdk.rs` 的 `probe_sdk` 映射为 `probe_capabilities`。
- 不引入 `device-number` 作为业务主身份（C1 起继续消除，全量在 C5）。

### `contracts/backend.rs` — `MediaBackend`

```rust
pub trait MediaBackend: Send + Sync {
    fn prepare(&self, plan: &PipelinePlan) -> Result<PipelineHandle, PipelineError>;
    fn start(&self, handle: &PipelineHandle) -> Result<(), PipelineError>;
    fn recover(&self, handle: &PipelineHandle) -> Result<(), PipelineError>;
    fn poll_bus(&self, handle: &PipelineHandle) -> Vec<PipelineBusEvent>;
}
```

- 即现有 `PipelineController` trait 语义（改名 `MediaBackend`）；`GStreamerPipelineController` 改名 `GStreamerMediaBackend` 移入 `adapters/gstreamer/controller.rs`。
- `PipelinePlan` / `PipelineHandle` / `PipelineError` / `PipelineBusEvent` 留在 `domain/pipeline.rs`（vendor-neutral，已是）。

## 4. Feature 变更（Cargo.toml）

- `bmd` → **`bmd-provider`**；`gstreamer` → **`gstreamer-backend`**。
- 同步更新所有 `#[cfg(feature = "bmd")]` → `#[cfg(feature = "bmd-provider")]`，`#[cfg(feature = "gstreamer")]` → `#[cfg(feature = "gstreamer-backend")]`（含 `main.rs` 模块声明、`decklink.rs`/`sdk.rs`/`pipeline.rs`/`resolver.rs`/`signal.rs` 内部）。
- `hardware-test` 互斥约束（`compile_error!`）同步改名。
- **兼容策略**：保留旧 `bmd`/`gstreamer` feature 名作为 alias（`bmd = ["bmd-provider"]`、`gstreamer = ["gstreamer-backend"]`），避免真机构建脚本立刻失效。C2–C5 期间再择机清理别名。

## 5. 逐文件迁移计划

1. **Cargo.toml**：feature 改名 + 别名；`[dependencies]` 中 `decklink`/`gstreamer`/`gstreamer-app`/`glib` 保持 optional。
2. **新建 `contracts/`**：`provider.rs` / `backend.rs` / `mod.rs` 定义 trait。
3. **新建 `adapters/`**：`mod.rs` + `blackmagic/`（移入 `decklink.rs`/`sdk.rs`）+ `gstreamer/`（移入 `controller.rs` = 原 `GStreamerPipelineController` 的 gstreamer-gated 部分）。
4. **`device.rs`**：`use crate::decklink::BmdDeviceIdentity` → 改从 `contracts::provider` 或 domain 内 canonical 类型；`crate::decklink::enumerate()` 调用改为经 `HardwareProvider::discover()`。`BmdDeviceIdentity` 若仅为内部别名，移入 `adapters/blackmagic` 并仅 adapter 内使用。
5. **`pipeline.rs`**：`PipelineController` → 保留为别名 `pub use contracts::backend::MediaBackend as PipelineController;`（避免 main.rs 大改）；`GStreamerPipelineController` 与 gstreamer-gated 方法体移入 `adapters/gstreamer/controller.rs`，`pipeline.rs` 仅留 trait + stub + vendor-neutral 逻辑。
6. **`resolver.rs` / `signal.rs`**：GStreamer 探活函数整体用 `#[cfg(feature = "gstreamer-backend")]` 包裹；顶层 `use gstreamer::*` 移入函数级或 cfg 块内，确保 `default`/`simulation` 无 gstreamer 引用。
7. **`main.rs`**：模块声明 `mod decklink`/`mod sdk` → `mod adapters`；调用 `crate::decklink::*` / `sdk::*` / `gstreamer::version()` 改为经 `HardwareProvider` / `MediaBackend` trait 对象（由 Registry 在 `simulation`/`bmd-provider,gstreamer-backend` 下选择）；`gstreamer::version()` 证据打印改为后端实现内。
8. **`rpc.rs:30`** `PipelineStarted(crate::pipeline::PipelineHandle)` 路径不变（PipelineHandle 仍在 domain）。

## 6. 风险与回滚

- **量极大、易回归**：核心不变量是 canonical 采集语义（`connection=optical-sdi` 非 `optical`；audiosrc 无 `connection`；`device-number` 绝不默认 0）。所有 `src_props`/`materialize` 逻辑**原样保留**，仅移动 GStreamer 实现，不改动语义。
- **default/simulation 必须保持 84 单测通过**、`cargo clippy --all-targets -- -D warnings` 两套 feature 通过、`--features bmd-provider,gstreamer-backend` 构建通过。
- 回滚：本 change 独立分支，失败直接丢弃分支，master 不受影响。

## 7. 验证（与 CI 门禁对齐）

- `cargo clippy --all-targets -- -D warnings`（default + `bmd-provider,gstreamer-backend`）通过。
- `cargo test` default + simulation 通过（基线 84）。
- `cargo build --features bmd-provider,gstreamer-backend` 通过（基线 bmd 83 单测）。
- 真机闭环（C5 验收用）：`--features bmd-provider,gstreamer-backend` + loopback 双门全绿不变。

## 8. 非目标（本 change 不碰）

- 不改 `materialize`/`src_props` 语义；**Mock Provider/Backend 已落地（见 §9 C3）**；不做 Supervisor 改造（C2）；不做 Resource/Preflight（C2）；不做架构 lint 门禁（C4）；不进 Normalize（0.7）。

## 9. C3 追加：Mock Provider/Backend（解锁 ARCH-PORTABILITY-01 Test B/C Mock 侧）

> 2026-08-28 落地。C1/C2 仅冻结 SPI 形状；C3 补齐「无 BMD / 无 GStreamer」的 Reference Adapter
> 实现，证明 SPI 可由非 vendor 适配器满足，从而解锁架构解耦门禁的 Mock 侧。

### 9.1 改动
- **`Cargo.toml`**：新增 feature `mock = []`（纯 Rust，不拉 `gstreamer` / 不依赖真实硬件）。
- **`contracts/backend.rs`**：`MediaBackend` 门控由 `gstreamer-backend` 放宽到
  `any(gstreamer-backend, mock)`——使无 GStreamer 的 `MockBackend` 也能适用该契约；
  `gstreamer` 构建语义不变（`any` 仍命中 `gstreamer-backend`）。因 `mock` 下 `MockBackend`
  尚未被 `main` 接线（C2c），trait 级 `#[allow(dead_code)]` 与 `HardwareProvider` 一致
  （避免 SPI 方法被判死代码致 clippy `-D warnings` 失败）。
- **`adapters/mock.rs`（新增）**：`MockProvider` / `MockProviderB`（均 `impl HardwareProvider`）
  与 `MockBackend`（`impl MediaBackend`）。`MockProvider A`=1 路 SDI 单设备；`MockProvider B`=2 设备
  （SDI+HDMI），拓扑不同，用于 Test C 替换 A 验证 Domain/Graph/UI 无需改动。`MockBackend`
  prepare/start/recover 直接成功、poll_bus 返回空，不链接 GStreamer。
- **`adapters/mod.rs`**：`#[cfg(feature = "mock")] pub mod mock;`。

### 9.2 验证（与 C2 门禁对齐）
- `cargo build --features mock` / `cargo clippy --all-targets --features mock -- -D warnings` 通过。
- `cargo test --features mock`：新增 3 单测（Provider A 单设备+确定性 / Provider B 双设备 / Backend 生命周期）通过。
- 既有 4 套配置（default / simulation / `bmd,gstreamer`(compat) / `bmd-provider,gstreamer-backend`(canonical)）
  **不受影响**：`mock` 模块与 `MediaBackend` 放宽门控在其它 feature 下均不激活。

### 9.3 架构影响
- 无（Phase 0.6 Acceptance Validation，未触碰 V0.2 核心定义）。
- 为 C4 ARCH-PORTABILITY-01（删 BMD Provider 后 Domain 仍可编译 + Mock 共享 Graph/Session/Supervisor/Health
  + 换 Mock B 不改 Domain/Graph/UI）与 C2c（main 经 `dyn HardwareProvider`/`dyn MediaBackend` 接线）提供前置。

## 10. C4：BMD 与 Domain 解耦（ARCH-PORTABILITY-01 Test A）

> 2026-08-28 落地。将 BMD 真实设备发现下沉到 Concrete Adapters 层, Domain (`device.rs`) 彻底脱离 vendor `decklink` 依赖。

### 10.1 改动
- **新增 `adapters/blackmagic/device_manager.rs`**：原 `device.rs` 中的 `DeckLinkDeviceManager`（struct + `impl DeviceManager` + `impl HardwareProvider` + `VBMF_BMD_NS`）整体平移至此, 属 Concrete Adapters 层。
- **`adapters/blackmagic/mod.rs`**：`#[cfg(feature = "bmd-provider")] pub mod device_manager;` + 同条件 `pub use device_manager::DeckLinkDeviceManager;`（按 `bmd-provider` 门控, 无 BMD 时整模块不编译）。
- **`device.rs`（Domain）**：删除对 `crate::adapters::blackmagic::decklink::BmdDeviceIdentity` 的无条件 `use`、整段 `DeckLinkDeviceManager` 实现与 `VBMF_BMD_NS`。仅保留 `FilesystemDeviceManager`/`SimulatedDeviceManager`（非硬件 Domain/Dev Manager）与 `DeviceManager`/`HardwareProvider` SPI。
- **`main.rs`**：`bmd-provider` 分支接线由 `device::DeckLinkDeviceManager::new()` 改为 `adapters::blackmagic::DeckLinkDeviceManager::new()`。
- **`adapters/blackmagic/decklink.rs`**：`pub use imp::enumerate;` 改为 `#[cfg(feature = "bmd-provider")]` 门控（与 `probe_connector_config` 一致）。原因：`enumerate` 的唯一消费者是 BMD `DeckLinkDeviceManager`（已下沉到 `bmd-provider` 门控的 `device_manager.rs`）；非 `bmd-provider` 构建下若不门控该 re-export, 会触发 clippy `-D warnings` 的 unused import。

### 10.2 验证
- **Test A（删 BMD Provider 后 Domain 仍可编译）**：`--no-default-features --features simulation`（无 `bmd-provider`）下 `device.rs` 不再 `use`/`调用` `decklink`, Domain 独立编译通过；架构 lint（grep `decklink` 于 domain）0 命中（仅大写 `DeckLink`/`BMD` 文档/字符串）。
- **Test B/C（Mock 侧）**：C3 已落 `MockProvider`/`MockProviderB`/`MockBackend`, 经 `HardwareProvider`/`MediaBackend` trait 多态消费, 与 Domain/Graph/Session/Supervisor/Health 解耦——换 Mock B 不改 Domain/Graph/UI（C3 设计已证）。本步不新增 Mock 端到端测试（留待 C2c 接线后补）。
- **无回归**：default / simulation / `mock` / `bmd,gstreamer`(compat) / `bmd-provider,gstreamer-backend`(canonical) 五套 build+clippy(`-D warnings`) 全绿。

### 10.3 架构影响
- 无（Phase 0.6 Acceptance Validation, 未触碰 V0.2 核心定义）。BMD 降级为 Reference Adapter 的实质一步（Concrete Adapters 层）。

## 11. C5（实现）: AdapterRegistry — Provider/Backend 选择收口（SPI 分层收口）

> 2026-08-28 落地。将 main 中散落的 `Box<dyn HardwareProvider>` / `Arc<dyn MediaBackend>` 构造与
> feature 优先级选择集中到 `registry.rs::AdapterRegistry`, 调用方(Domain/Graph/main)只拿 trait 对象,
> 绝不感知具体适配器。此为 C2c 接线之后的 SPI 分层收口, 与 §7「C5 验收用真机闭环」为不同概念: 本步是
> 实现步骤, 真机闭环验收仍属 §7 范畴。

### 11.1 改动
- **新增 `registry.rs`**：`AdapterRegistry` 提供 `build_provider()` 与 `build_media_backend()`。
  - `build_provider()` 优先级(高→低): `mock` > `simulation` > `bmd-provider` > `default`(filesystem), 返回 `Box<dyn HardwareProvider>`。
  - `build_media_backend()` 仅在 `all(bmd-provider, gstreamer-backend)` 下编译, 优先级 `mock` > `gstreamer-backend`, 返回 `Arc<dyn MediaBackend>`。
  - 二者逻辑与 C2c 内联块逐字一致(cfg 分支完全相同), 仅从 main 抽到独立模块。
- **`main.rs`**：删除内联 `build_media_backend` 自由函数与 Provider 选择块, 改调 `AdapterRegistry::build_provider()` / `AdapterRegistry::build_media_backend()`（2 处调用点）。
- **`adapters/gstreamer/mod.rs`**：`gstreamer_runtime_version` 的 cfg 由 `gstreamer-backend` 收紧到 `all(gstreamer-backend, bmd-provider)`（其唯一消费者 `main` evidence 日志位于 `#[cfg(bmd-provider)]` 块内）。消除 `gstreamer-backend` 单独组合下的 dead-code（`-D warnings` 门禁暴露的潜在告警, 此前未被该组合 clippy 覆盖）。

### 11.2 验证
- 盒上矩阵(同步 tar+scp → `bash box_verify_c5.sh`)覆盖 default/simulation/mock 三套 test + 全部 feature 组合 build/clippy(`-D warnings`), 13 项全绿；复检(`box_recheck_c5.sh`)7 项 clippy 全绿(含 `gstreamer-backend` 单独组合的 GS_ONLY_CLIPPY, 修复后通过)。
- Domain/Graph/UI 不引用具体适配器类型, ARCH-PORTABILITY-01 收敛不变。

### 11.3 架构影响
- SPI 分层收口: Provider/Backend 选择逻辑单点化, C6 BMD 迁移 / C7 GStreamer 迁移 / 运行时可插拔(显式配置选择适配器)只需改 `registry.rs`, 不动 main 与 Domain/Graph。
- 为 C8 架构边界 CI gate 与最终验收(C9)打下基础。
