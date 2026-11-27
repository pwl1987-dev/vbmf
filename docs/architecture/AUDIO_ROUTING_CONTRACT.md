# AUDIO_ROUTING_CONTRACT（音频路由契约）

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.7/P1，第 9 替换轴）（**状态订正 2026-11-27 · Acceptance Matrix 0.7 节**）：IMPLEMENTATION = `PARTIAL`（Audio 语义已落地，Audio Backend 替换轴（#63）仍 P1 未落地）；VERIFICATION = **`HARDWARE_VERIFIED`**（`AUDIO-SEMANTICS-RT-01` 真机 PASS，报告 `docs/superpowers/reports/2026-08-30-p07b-audio-semantics-verify.md`）——**仅覆盖 Audio 语义**（Role 词表 / Unknown 贯穿 / Route 零 pipeline 引用）；`ARCH-AUDIO-01`（Embedded SDI/AES/MADI/Mock Matrix）无门禁判定记录 ⇒ 未计入 ⇒ **不判 `ACCEPTED`**；GATE 以 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 0.7 节为准。
> 来源：Portability PRD #55, #63, #80, #146
> 关联：`CANONICAL_MEDIA_MODEL.md`、`RUNTIME_SESSION_MODEL.md`

## 1. 独立建模
Video / Audio / Metadata 是**独立 Graph**，统一 Runtime container 不合并业务 Graph（#55）。Audio Graph 可独立 Rebind/替换，不影响 Video Graph。

## 2. Audio Backend 替换轴（#63，第 9 替换轴之一）
支持：Embedded SDI / AES / MADI / Dante / Mock Matrix。
替换 Audio Backend（Embedded→MADI）只换 Audio Provider/Backend，**Video Graph 不重构**。

## 3. Audio Lost / Reconnected（#146）
- **Audio Lost**：Audio Graph 标记 LOST，Video 继续，不级联失败。
- **Audio Reconnected**：重新绑定，不重建 Session。

## 4. 验收
- `ARCH-AUDIO-01`（Embedded SDI/AES/MADI/Mock Matrix，Video Graph 不变）
- #146 Audio Acceptance（Embedded / Independent / No Audio / Audio Lost / Audio Reconnected）
