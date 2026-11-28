# HARDWARE_PROVIDER_CONTRACT — 硬件 Provider SPI 契约

> **[实现修正注记 2026-08-29, p06-final-merge-hardening]** `discover` 签名修正为
> `fn discover(&self) -> Result<Vec<DiscoveredDevice>, ProviderError>` (P1-2 fail-closed):
> SDK 不可用/驱动失败/权限不足显式报错, 与 "无硬件 = `Ok(vec![])`" 严格区分。
> 同时 (P0-1) Provider 身份证据以 `ProviderIdentity` 随 `DiscoveredDevice` 配对输出,
> Canonical `DeviceInfo` 不再携带 vendor 身份字段 (见 CANONICAL_IDENTITY §4)。


> Phase 0.6 门禁依据（P0）。综合论述见 [`IMPLEMENTATION_ADDENDUM.md §1,§6,§9`](./IMPLEMENTATION_ADDENDUM.md)。

## 1. SPI 边界（trait 形状级，非实现）
```
trait MediaHardwareProvider {
    fn discover(&self) -> Vec<CanonicalDevice>;          // 返回 Canonical Device/Port，不返回 vendor handle
    fn translate(&self, physical: PhysicalResource) -> ProviderResource;
    fn capabilities(&self, dev: &DeviceId) -> CapabilitySnapshot;
    // 不接收整个 Manifest：由 Binding 层先完成 Manifest → ResolvedBinding，
    // Provider 只收已解析的 Provider 资源请求（见 CANONICAL_IDENTITY.md）。
    // Provider 最多：discover/resolve/open resource/close resource/observe；
    // 绝不包含 create_session/create_lease/modify_health（否则破坏 Session Ownership）。
    fn open_input(&self, request: &ProviderInputRequest)
        -> Result<ProviderInputSession, ProviderError>;
    fn open_output(&self, request: &ProviderOutputRequest)
        -> Result<ProviderOutputSession, ProviderError>;
    fn close(&self, session: &ProviderSessionRef) -> Result<(), ProviderError>;
    fn observe(&self) -> ProviderObservation;
}
```
- Provider 负责 **Vendor Resource ↔ Physical Resource ↔ Provider Resource** 翻译。
- Domain / Graph / Session **不得** `use gstreamer::*` / `use decklink::*`（当前 `pipeline.rs`/`signal.rs` 直接依赖，是 P0 缺口）。

## 1.1 Discovery 与 Control 分离（P0-9，概念边界）

> `discover` / `capabilities` / `open_*` / `observe` / `close` 同在一个 trait 并非错误，但权限等级不同，概念上须分离：

```
Discovery Adapter        — discover / capabilities（只读、低权限、可频繁调用）
Resource Control Adapter  — open_input / open_output / close / observe（运行时控制、高权限）
```

- 不要求两个 Rust trait，但**文档与权限模型**须把 Discovery（只读探测）与 Control（运行时占用）分开，避免「探测权限 = 控制权限」。
- Control 操作须经 Runtime Orchestrator 授权（Reservation/Lease 已建）后才可调用。

## 2. 身份与失败闭合
- **Provider Identity（非 Canonical）**：`DeviceHandle`（经 `IDeckLinkProfileAttributes::GetString(BMDDeckLinkDeviceHandle)`，详见 memory FFI 常量）是 **BMD Provider 内部**的稳定句柄——属于 Provider Identity，**不是** VBMF Canonical Identity（见 [`CANONICAL_IDENTITY.md`](./CANONICAL_IDENTITY.md)）。Provider 内部优先级 PersistentId > DeviceHandle > TopologicalId > EnumerationOnly；解析结果统一收敛为 Canonical `DeviceId` + `IdentityStrength`。
- `device-number` 绝不默认 0；SDK 枚举序 ≠ GStreamer `device-number`（见 Canonical Ingest 边界）。Canonical 主身份是 `DeviceId`，`device-number` 仅是运行时地址。
- Identity / Capability / Binding 冲突必须拒绝；绝不盲开 device 0 / 自动换卡。

## 3. 门禁判据（ARCH-PORTABILITY-01 Test A）
- 删除/禁用 BMD Provider 后，要求 **Domain / Graph / Session / Supervisor / Health / Acceptance 仍能编译**。
- **当前状态：编译不过**（main/resolver/signal/pipeline 直接依赖 decklink/gstreamer 模块）→ 这是 P0 必须消除的缺口，列为门禁目标。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- CI：`cargo build --no-default-features --features simulation` 与 `--features mock-only` 必须通过。
