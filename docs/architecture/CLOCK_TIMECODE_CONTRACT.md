# CLOCK_TIMECODE_CONTRACT（时钟 / 时码契约）

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.7/P1）（**状态订正 2026-11-27 · Acceptance Matrix 0.7 节**）：IMPLEMENTATION = `IMPLEMENTED`（gap matrix 无对应行；依据 0.7B 落地声明与下列真机门禁）；VERIFICATION = **`ACCEPTED`**（`MEDIA-SEMANTICS-RT-01`（Clock）与 `TIMECODE-SEMANTICS-RT-01` 均 Unit/Simulation/**Hardware** PASS，报告 `docs/superpowers/reports/2026-08-30-p07b-clock-domain-verify.md` 与 `docs/superpowers/reports/2026-08-30-p07b-timecode-foundation-verify.md`）；GATE 以 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 0.7 节为准。
> 来源：Portability PRD #57, #147, #148
> 关联：`CANONICAL_MEDIA_MODEL.md`、`RUNTIME_RESOURCE_MODEL.md`

## 1. Clock（#147）
状态：`Locked / Unlocked / Offset / Drift / Clock Lost / Clock Recovered`。
Clock 是运行时**观测**，不写回 Graph（R3 Observation≠Configuration）。

## 2. Timecode（#148）
状态：`Present / Absent / Invalid / Discontinuous / Recovered`。

## 3. 替换不变量
Clock/Timecode 源（BMD / GPIO / NTP）替换，GraphIntent 不变。

## 4. 验收
- #147 Clock Acceptance（Locked/Unlocked/Offset/Drift/Clock Lost/Clock Recovered）
- #148 Timecode Acceptance（Present/Absent/Invalid/Discontinuous/Recovered）
