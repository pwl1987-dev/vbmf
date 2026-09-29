# SDK-ENTRY-01 — Verification Report（2026-09-29）

> Verification report，非第二动态状态控制面；动态状态以 `.project/STATE.md` §3.83 为准。

## 结论

**SDK-ENTRY-01 COMPLETE。** `@vbmf/sdk`（`packages/vbmf-sdk`）以 Fastify JSON Schema 单源机械派生类型、经 Web Console dogfood 成为唯一 transport/types/SSE 实现；最终 exact commit `144ea60` 双 lane CI 绿（含新 SDK lane），BMD bounded regression 全项 PASS，teardown 零残留。frozen Architecture/Contract 修改 = 0。

## 交付链

- **Planning（375971f）**：`docs/superpowers/plans/2026-09-29-sdk-entry-01-planning.md`（Reality Matrix、debt A-D、S1-S8、SDK-01A..E、验证矩阵）。
- **SDK-01A（f98a120）**：`graphRuntimeIntentSchema`（graph_intent.rs 冻结 wire：decklink/rtmp/self_test tagged union + appsink/hls/rtmp sink 词表）进入 Product schema——missing pipeline 等 BUG-F 类缺陷在 route 层 400 + 零 submit；Fastify `removeAdditional:false`；contract test 未声明 status = FAIL + SSE 帧机械验证；`packages/vbmf-sdk` + json-schema-to-typescript 物化生成 + drift/red-line gate。
- **SDK-01B/01C（606a1d7）**：`VbmfClient`（credential provider / VbmfApiError 全保留 status·envelope·request_id·retryable·Retry-After / 显式 idempotency / AbortSignal）+ `VbmfEventClient`（BMD 验证 SSE 语义全套）。
- **SDK-01D（aa7f1fa）**：Web Console dogfood——净删 163 行（双栈→单栈）；UI 零改；69 测试零退化；Dockerfile.web 双阶段构建 + setgid dist chmod 修复。
- **SDK-01E（f926419）**：control-plane lane SDK steps（drift/red-line/typecheck/29 tests/build/pack smoke）；npm pack 自包含 tarball；fresh Node + Vite consumer smoke。
- **BUG-H（144ea60）**：SDK 默认 fetch 未 bind → 真浏览器 Illegal invocation（BMD dogfood 首验发现，Node 注入路径掩盖）；bind 修复 + this 敏感替身 regression。

## 测试与验证

- apps/api 65/65 · apps/web-console 69/69（dogfood 前后零退化）· vbmf-sdk 29/29；三包 typecheck/build 绿；control-plane/WCE/SDK 三重红线 gate PASS。
- BMD bounded regression @ `144ea60`：credential/Health/Runtime/Events（SDK SSE：事件驱动零重连）/Start 4-state 收敛/Stop/Release/failure visible（agent 死亡→UI 如实 DEPENDENCY_UNAVAILABLE）→恢复/SSE 断流→`?cursor=13` strictly-after 重连零重复→live 恢复/reload→gate→canonical 收敛；device-2 untouched；teardown 零残留。证据：`evidence/bmd-10.30.15.10/2026-09-29-sdk-01d-bmd-regression/`。
- 中间 commit（f98a120/40fca02/aa7f1fa）control-plane 红为变更集内配套缺失（F12 字面量/SDK 构建前置 workflow 在后续 commit），f926419 起双绿；media-agent 7/7 全程绿。

## 遗留（非本包范围，已在 STATE 登记）

SDK npm public publish、Python SDK、V0.3 endpoint 扩张、Web Console 长稳、RuntimeSnapshot opaque 投影稳定化（debt B 决策维持 unknown）。
