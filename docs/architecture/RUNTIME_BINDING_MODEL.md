# RUNTIME_BINDING_MODEL（Binding 契约）

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.6, P0）（**状态订正 2026-11-27 · gap matrix `Runtime Binding` 行**）：IMPLEMENTATION = `PARTIAL`；VERIFICATION = **`LAB_VERIFIED`**（仅单测 `Partial`，**无真机执行**；所引 `evidence/.../acceptance` 在仓内不可解析）；GATE 以 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 为准。**边界**：本节 `HW-PORT-01` / #144 Device Replacement Acceptance 在 Acceptance Matrix 无门禁判定记录 ⇒ 未计入验证级别。
> 来源：Portability PRD #19, #60, #102, #115, #116, #117, #118, #119
> 关联：`RUNTIME_SESSION_MODEL.md`、`RUNTIME_RESOURCE_MODEL.md`

## 1. 定位
Binding 连接 **Physical ↔ Provider ↔ Runtime Resource**，是硬件替换的基本单元。

## 2. 字段（Canonical）
- `binding_id`
- `physical_ref: PhysicalPortRef`（DeviceHandle + PortId，非 device-number）
- `provider_ref: ProviderRef`
- `runtime_resource_ref: RuntimeResourceRef`
- `state: CURRENT | STALE | CONFLICT | FAILED`

## 3. 替换语义
- 硬件移除（DeviceRemoved）→ Binding STALE → Session DEGRADED，**禁自动发现新卡顶替**（#58/#116）。
- 硬件新增：DISCOVERED→CAPABILITY_VERIFIED→PROVISIONED→AVAILABLE，不自动进 Production（#59）。
- Runtime Resource 变更（GStreamer #1→#3）：DeviceId/PortId/GraphIntent **不变**，仅 RuntimeBinding 更新（#60）。
- Identity Collision（重复 stable identity）→ **reject discovery**，不自动随机 UUID 掩盖（#118）。
- Backend Resource Collision（两 Pipeline 争同 runtime resource）→ 一个赢、一个拒（#119）。

## 4. Drift（配置漂移）
- Manifest ≠ Hardware → **DRIFT**，不自动改 Manifest（#115）。
- Topology 变 → capability rediscovery + binding revalidation（#117）。

## 5. 验收
- `HW-PORT-01` / `HW-IDENT-02`
- #144 Device Replacement Acceptance
