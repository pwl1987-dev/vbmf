# VENDOR_NEUTRALITY_RULES — 厂商中立守则（CI 防回归）

> Phase 0.6 的**厂商中立防回归守则**，作为 CI Lint 与 Code Review 判据。详细论述见 [`IMPLEMENTATION_ADDENDUM.md §14`](./IMPLEMENTATION_ADDENDUM.md)。

## 规则
1. **Domain 不得 import 任何具体 vendor / backend 类型**（BMD / GStreamer / FFmpeg / AJA / SRS）。
2. **禁止自动 Fallback**：Provider / Backend 失败必须 `Policy + Capability + Preflight + 决策` 才能切换；绝不静默换硬件/换后端。
3. **`GraphRuntimeIntent` 仅允许 Canonical DeviceId + PortId + Media Semantics**，不得出现 GStreamer/BMD 字段。
4. **Configuration / Runtime State / Observed State 严格三分离**（见 Addendum §3.2）。
5. **删除具体实现后，上层（Domain/Graph/Supervisor/Health）仍能编译**。
6. **`Runtime Resource` 绝不等同于 `Identity`**；device-number 仅是运行时地址，绝不默认 0。
7. **Canonical Identity 不含 vendor handle**：`DeviceHandle`/`PersistentId`/`TopologicalId` 是 Provider Identity，须经 Provider Identity Adapter 映射为 Canonical `DeviceId`（见 [`CANONICAL_IDENTITY.md`](./CANONICAL_IDENTITY.md)）；Canonical Domain / Graph / UI 只认 `DeviceId` + `IdentityStrength`。

## CI 防回归门禁
```yaml
# "真正可替换"的严格判据：删除具体实现后上层仍能编译
cargo build --no-default-features --features simulation
cargo build --features mock-only        # BMD feature absent + GStreamer feature absent
# 要求：Domain / Runtime Contract / Simulation 仍能编译
```
- `ARCH-PORTABILITY-01`：删除/禁用 BMD Provider，要求 Domain/Graph/Session/Supervisor/Health/Acceptance 编译通过（当前：编译不过，是 P0 缺口）。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- `ARCH-BACKEND-01`：MockBackend vs GStreamerBackend 必须共享 CanonicalPipelinePlan / CanonicalMediaFormat / CanonicalRuntimeEvent。

## 失败闭合
- Identity / Capability / Binding 冲突必须拒绝；绝不盲开 device 0 / 自动换卡。
- 换卡：Old Device → Removed → Binding Stale → Session Degraded；**绝不**自动寻找下一张卡，除非 Failover Policy 明确允许。
