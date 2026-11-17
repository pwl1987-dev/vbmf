# Change: Phase 0.6 Final Merge Hardening — 合并前清债与 Runtime Abstraction Baseline 收口

## Why

0.6 系列五个 change（bc/f/g/de/hi）已在 `comet/p06-hi-backend-resource-gates`（0f2a2bf，相对 master 29 commits ahead / 0 behind）形成串行聚合链，门禁全绿、真机证据齐备。但分支终审发现：**SPI 已是可实现的真 trait，但契约与实现尚未完全对齐**——`DeviceInfo` 仍泄漏 BMD 身份机制（违反 CANONICAL_IDENTITY.md "Provider Identity ≠ Canonical Identity"）、`MediaBackend` 实现契约仍带 GStreamer 遗留（`poll_bus`/缺 `stop`，与冻结契约 `instantiate/start/stop/recover/observe` 不一致）、trait 本身被 adapter feature 门控、Registry 对 feature 冲突静默降级。这些问题现在修成本最低；合入 master 后再修将形成 breaking 变更并污染 Baseline。因此：**合入 master 前做一次集中清债，然后以单一 PR 把 master 定义为 Phase 0.6 Runtime Abstraction Baseline。**

## What Changes

- **P0-1 DeviceInfo 去 BMD identity 泄漏（BREAKING，SPI 内部轴）**：`device.rs` 的 `bmd_persistent_id` / `bmd_device_handle` / `bmd_topological_id` 移出 Canonical Domain，收敛为 `adapters/blackmagic` 内的 Provider Identity（经 Provider Identity Adapter 映射为 canonical `DeviceId` + `IdentityStrength`/`IdentitySource`）；`resolver.rs` 匹配逻辑改为消费 Provider 侧身份证据结构，不再读 Domain 字段。
- **P0-2 MediaBackend 契约对齐冻结契约（BREAKING，SPI 方法轴）**：`prepare→instantiate`、`poll_bus→observe`（返回 canonical 事件集，非 GStreamer Bus Message 语义）、补 `stop`；同步对齐 `MEDIA_BACKEND_CONTRACT.md` 的形状并更新两实现 + 调用点（main.rs watchdog / supervisor 接线）。
- **P0-3 MediaBackend trait 去 adapter feature 门控**：`contracts/backend.rs` 的 trait 无条件编译（default 无任何 backend 实现时契约仍存在）；`impl` 块保留 feature 门控。
- **P0-4 Registry feature 冲突 fail-closed**：生产路径（非显式 simulation/mock 模式）下 `mock` 与 `bmd-provider`/`gstreamer-backend` 组合不再静默按优先级取 Mock，而是显式报错拒启；显式测试模式（env/flag）下允许。
- **P0-5 Architecture Gate 升级为真实编译验证**：新增 remove-adapter 编译验证（移除 `adapters/blackmagic` / `adapters/gstreamer` 后 Domain/Contract/Runtime 仍可编译），接入 CI；现有词法 lint 明确定位为 Architecture Lint（非 Proof）。
- **P0-6 Archived 证据旧口径勘误**：修正 p06-hi 归档 tasks/design 中 "`PipelineHealth` Default=true" 旧表述（实际为 P1-2 三态 + absence-of-evidence 全 false），以显式勘误注记保留历史可读性。
- **P1-1 MockBackend 弃用 `PipelineHandle(0)` 哨兵**：与生产同一 `PipelineId` 生成机制（`NEXT_PIPELINE_ID`，从 1 起），消除与哨兵值撞车的隐患。
- **P1-2 `HardwareProvider::discover` Result 化（BREAKING，对 `HARDWARE_PROVIDER_CONTRACT.md` 的显式修正）**：`discover(&self) -> Result<Vec<DeviceInfo>, ProviderError>`，SDK 不可用/驱动失败不再与"无硬件"（空 Vec）混淆；契约文档同步修正。
- **P1-3 RuntimeEvent 分级（critical/droppable）**：`RuntimeEventLog` 满时 fault/identity 类关键事件不可被静默挤出（至少两级语义：Durable 计数保底 / Observation 可丢弃）。
- **P1-4 Resource 原子占用最小原语**：`preflight + reserve` 在注册表锁内原子完成（`acquire`），materialize 失败有显式释放回滚；完整 Resource Orchestration（bind/instantiate 全链编排）**不在本 change**，记为 0.7 明确债务。
- **收尾交付**：盒上全矩阵复跑（4 套 test / clippy -D / build）+ 真机三闭环回归（SELFTEST / loopback / HW-IDENT）+ 单一 PR `comet/p06-final-merge-hardening` → `master` + GitHub required checks / branch protection 补齐 + master 标记为 Phase 0.6 Runtime Abstraction Baseline（tag + 文档）。

**不拆分说明**：各项为同一清债刀的组成部分，共享同一验证矩阵与同一 PR 交付物，用户已明确以"一次 hardening、单一 PR" framing；拆分会制造中间不可合入态。

## Capabilities

（`skip_specs: true`——本仓库 canonical 语义 SoT 为 `docs/architecture/*.md` 冻结契约，OpenSpec 层零 delta spec 与 bc/f/g/de/hi 五个前序 change 一致；契约修正直接落在 docs/architecture 对应文档并归档于本 change。）

## Impact

- **编译**：`default` / `simulation` / `mock` / `bmd-provider,gstreamer-backend` 全套 feature 矩阵须保持可编译 + 单测通过；SPI 方法更名/新增为 breaking，所有 impl 与调用点同步更新。
- **受影响代码**：`services/media-agent/src/{device.rs, contracts/{backend.rs,provider.rs}, adapters/{blackmagic/*,mock.rs,gstreamer/*}, registry.rs, resolver.rs, events.rs, resource.rs, main.rs, supervisor.rs}`；`scripts/check_arch_portability.py`；`.github/workflows/media-agent.yml`。
- **受影响文档**：`docs/architecture/{MEDIA_BACKEND_CONTRACT.md, HARDWARE_PROVIDER_CONTRACT.md, CANONICAL_IDENTITY.md}`（对齐注记）；p06-hi 归档目录勘误。
- **外部交付**：GitHub branch protection + required checks（`gh`，pwl1987/VBMF）；合并后 master = Phase 0.6 Runtime Abstraction Baseline。
- **风险**：P0-1 触及 resolver 匹配与真机身份链路，须真机 HW-IDENT-02 回归兜底；P0-4 不得破坏盒上现有 bmd+gstreamer 真机构建（该组合无 mock，不受影响）。
