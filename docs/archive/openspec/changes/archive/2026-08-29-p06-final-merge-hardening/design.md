# Design: Phase 0.6 Final Merge Hardening — 合并前清债

## Context

聚合候选分支 `comet/p06-final-merge-hardening`（自 hi HEAD 0f2a2bf 拉出）已含 0.6 全部代码：真 trait SPI（`HardwareProvider`/`MediaBackend`）、Mock/BMD/GStreamer 三实现、`AdapterRegistry`、`RuntimeEvent`/`Resource`/Preflight、ARCH-PORTABILITY-01 词法 lint + simulation/mock 编译门禁、真机三闭环证据。冻结契约（`docs/architecture/`）与实现之间存在四处结构性偏差（BMD identity 泄漏、Backend 契约形状、trait feature 门控、Registry 静默优先级），加上四处 P1 债务。约束：master 合入后修这些将成 breaking；盒上 bmd+gstreamer 真机构建不可破坏。

## Goals / Non-Goals

**Goals:**
- Canonical Domain 完全去 vendor 身份字段；Provider 身份只存在于 `adapters/blackmagic`
- `MediaBackend` SPI 形状 = 冻结契约 `instantiate/start/stop/recover/observe`，且 trait 无条件编译
- feature 冲突 fail-closed；架构门禁从"词法 lint"升级为"remove-adapter 真实编译证明"
- Mock/事件/资源四处 P1 债务清偿至"不阻断 Baseline"程度
- 单一 PR 合入 master 并打 Baseline 标记 + branch protection

**Non-Goals:**
- 不做 Normalize(0.7)、Session ownership 完整层、Audio loopback 独立门禁、Clock/External API
- 不做完整 Resource Orchestration（bind→instantiate 全链编排；仅最小原子 `acquire` 原语 + 债务记账）
- 不引入新硬件厂商 / 新采集传输抽象（IP/NDI/SRT 等属 0.7+ 路线）
- 不改 `PipelinePlan` canonical 字段语义

## Decisions

- **D1 (P0-1) ProviderIdentity 收敛方向**：`DeviceInfo` 仅保留 `device_id`/`model`/`display_name`/`serial_number`/`identity_strength`/`identity_source`/`capabilities`/`ports` 等 canonical 字段；`bmd_*` 三字段迁入 `adapters/blackmagic` 的 `BmdIdentity { persistent_id, device_handle, topological_id }`，经 `Provider Identity Adapter`（blackmagic 模块内函数）在 discovery 时完成 `→ DeviceId (UUIDv5) + IdentityStrength` 映射。`resolver.rs` 匹配签名改为 `(canonical_device, &BmdIdentity, probes)`——由调用方（provider 侧/诊断路径）传入 provider 证据，Domain 不携带。备选"保留字段但 lint 禁读"被否：字段在即泄漏，无法防下游误用。
- **D2 (P0-2) 契约对齐为更名+补齐而非重构**：`prepare→instantiate`、`poll_bus→observe`（返回 `Vec<PipelineBusEvent>` 保留现事件载荷，但载荷类型已 vendor-neutral 于 `pipeline_events.rs`，命名对齐契约）、新增 `stop`（GStreamer 侧 `set_state(Null)` + join 线程；Mock 侧 no-op Ok）。不引入 `BackendError` 新类型（复用 `PipelineError`，避免二连 breaking）。`MEDIA_BACKEND_CONTRACT.md` 加对齐注记。
- **D3 (P0-3) trait 门控解除**：`contracts/backend.rs` 去 `#[cfg(any(...))]`——其依赖（`pipeline.rs`/`pipeline_events.rs`）已 vendor-neutral 无条件编译，可直接解除；两个 `impl` 块各自保留 feature 门控。default 构建由此获得"有契约、无实现"的合法状态。
- **D4 (P0-4) fail-closed 判定信号**：`AdapterRegistry` 选择处区分"显式测试模式"（`MEDIA_AGENT_MODE=simulation|diagnostic` 或 `VBMF_ALLOW_MOCK=1`）与默认生产模式；生产模式下 mock+真实 feature 组合 → 启动即报错退出（列出冲突 feature 与解除方法），绝不静默取 Mock。simulation/mock 单独 feature（无真实实现共存）行为不变。
- **D5 (P0-5) remove-adapter 编译证明机制**：新脚本 `scripts/check_remove_adapters.py`：临时副本中删除 `adapters/blackmagic/`、`adapters/gstreamer/` 目录并修 `adapters/mod.rs`/`main.rs` 对应引用后 `cargo check --no-default-features --features simulation`（+mock）；通过后删除副本。接入 CI 独立步骤。词法 lint 保留但文档定位改为 Architecture Lint（Proof = 本脚本）。备选 cfg 空实现被否：cfg 仍保留代码路径，移除目录才是真证明。
- **D6 (P0-6) 勘误方式**：归档文件就地修正旧表述 + 追加 `> [勘误 2026-08-29]` 引用块说明原口径与真实语义（三态 + absence-of-evidence），保留上下文可追溯；不改写其他历史内容。
- **D7 (P1-1) Mock 句柄统一**：`MockBackend` 改用 `crate::pipeline::NEXT_PIPELINE_ID`（pub(crate) AtomicU64，从 1 起）分配句柄，与生产同源；测试断言从 `PipelineHandle(0)` 哨兵改为"非零且递增"。
- **D8 (P1-2) discover Result 化**：`HardwareProvider::discover -> Result<Vec<DeviceInfo>, ProviderError>`（新增 `ProviderError` 于 `contracts/provider.rs`）；BMD SDK 不可用/驱动错显式报错，与"无硬件=Ok(vec![])"区分；frozen 契约文档同步修正并注明 hardening 修正。**BREAKING**：全部 impl（BMD/Mock A/B/simulation/filesystem）+ registry 调用点更新。
- **D9 (P1-3) 事件两级语义**：`RuntimeEvent` 增 `severity: Observation | Critical`（fault/identity 类 = Critical）；`RuntimeEventLog` 满时仍挤出 Observation，Critical 不可被挤出——溢出时强推 Critical 并递增 `dropped_observations` 计数暴露给 Health。不改 VecDeque 结构，仅入队策略。
- **D10 (P1-4) 原子 acquire 最小原语**：`ResourceRegistry` 包 `Mutex` 后提供 `acquire(req) -> Result<Reservation, PreflightError>`（锁内 preflight+reserve 原子完成）；`main.rs` Preflight 闸门改走 `acquire`；materialize 失败路径调 `release_reservation` 回滚。完整编排层记 0.7 债务（proposal 已列）。

## Risks / Trade-offs

- **D1 触面最大**：resolver 匹配、BMD discovery、mock/simulation provider、诊断输出全要改；以真机 HW-IDENT-02 回归（C1 证据仍须 ManifestVerified/High + Unresolved fail-closed）兜底。风险换取消"换厂商不进 Domain"的长期正确性。
- **D2/D8 双 breaking**：本 change 内一次付清，避免 Baseline 后二次 breaking；盒上 bmd+gstreamer 全矩阵 + 三闭环回归为回归兜底。
- **D4 模式判定依赖 env**：env 信号可被误设；以启动日志显式打印当前模式与生效 adapter 为缓解（运维可见）。
- **D5 脚本操作文件树**：只在临时副本操作 + 异常清理，杜绝污染工作区；CI 步骤超时上限防卡死。
- **D9 Critical 强推可能挤掉普通事件**：接受——观测事件可丢、故障不可丢与 VBMF fail-closed 原则一致；dropped 计数保证可观测。
