# SDK-ENTRY-01 Planning / Reconciliation（FROZEN 2026-09-29）

> 状态：PLAN FROZEN。Authority 依据：STATE §3.79/§3.80/§3.82/§4/§5；EXTERNAL_API_CONTRACT / EVENT_CONTRACT / IMPLEMENTATION_BOUNDARIES / VENDOR_NEUTRALITY_RULES / RUNTIME_SESSION_MODEL（全部 FROZEN，零修改）；live code = `main@dff6bab`。V0.3 文档仅作低优先级 future reference，不扩张当前 surface。

## 0. 目标 / 非目标

**目标**：`vbmf-sdk`（TypeScript，`packages/vbmf-sdk/`）作为 Product API / Event API / Health API 的 consumer library——类型由 Fastify JSON Schema **机械派生**，transport 语义继承 BMD 已验证行为，最终由 Web Console dogfood 消除双份 transport 实现。

**非目标（scope 冻结）**：Python/Go/Rust SDK、npm public publish、BullMQ/Worker、webhook、multi-instance event delivery、Resource PUT、ChangeSet、跨主机 mTLS、SRT unblock、storage/SRS 修复、V0.3 endpoint 扩张（/devices //ports /routing /capabilities 独立 endpoint、pagination）、Web Console 大改版、新 Runtime state machine。

## 1. Authority / 单源裁决（S0）

- **`apps/api/src/routes/schemas.ts` 继续是唯一 Product API JSON Schema authority**。本 packet 不迁移、不复制、不建 parallel contract package（无结构性前提）。
- SDK 与 Web Console 只能**消费/机械派生**。派生机制：**`json-schema-to-ts`（`FromSchema`）+ build 时从 authority 相对路径 import schema 常量** —— 源内构建期单源、发布物自包含（类型编译进 d.ts/产物，consumer 不依赖 apps/api 源码）。选择依据：零 codegen 步骤、类型级（非运行时）依赖最小、`as const` schema 直接可用、CI 可机械 drift gate。不引入 Zod/TypeBox 重写（scope 扩张）。
- Rust `services/media-agent/src/graph_intent.rs` 是 GraphRuntimeIntent **wire** authority；Product API JSON Schema 必须精确表达该既有 wire（reconciliation，非发明）；**不得修改 Rust wire 迁就 SDK**。

## 2. Product API Reality Matrix（live code 盘点 @ dff6bab）

| Endpoint | Method | Auth | Permission | Request schema | Response 200 | 实际 error statuses | Idempotency | Runtime truth semantics | Consumer evidence | BMD evidence | SDK 决策 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/health/live` | GET | 无（pre-auth 探针面） | — | — | `{status:"live"}` | 500(罕见) | — | 进程存活，非依赖健康 | Web Console HealthPage | dc780c8 journey | **支持** |
| `/healthz` | GET | 无 | — | — | HealthLayers（层内如实降级 unreachable/not_configured，恒 200） | 500(罕见) | — | 分层观测（api/runtime/db/auth/events） | HealthPage | E1/E2 截图 | **支持** |
| `/api/v1/runtime` | GET | x-api-key | runtime.read | query `session_id?`(uuid) | RuntimeSnapshot | 400/401/403/404/429/500/503 | — | **Runtime 现状唯一 live 来源**（无缓存） | RuntimePage/SessionsPage | B1/CD 截图 | **支持** |
| `/api/v1/sessions` | POST | x-api-key | session.start | StartSessionBody | CommandOperation | 400/401/403/404/409/429/500/503 | Idempotency-Key（同键同 fingerprint 重放首响；异 target 409） | **accepted≠running**：返回 Command 终态，actual 需 getRuntime | SessionsPage Start | CD1 | **支持** |
| `/api/v1/sessions/:id/stop` | POST | x-api-key | session.stop | params uuid + body command_id? | CommandOperation | 同上（非 running 会话 → 200+failed(permanent) 诚实拒绝） | 同上 | stop=released 语义（真机实证） | SessionsPage Stop | CD2 | **支持** |
| `/api/v1/sessions/:id/release` | POST | x-api-key | session.release | 同上 | CommandOperation | 同上（released 会话幂等 executed） | 同上 | canonical 幂等 removal | SessionsPage Release | CD3 | **支持** |
| `/api/v1/commands/:id` | GET | x-api-key | command.read | params id | CommandOperation | 400/401/403/404/429/500/503 | — | Operation 真相（≠Runtime actual） | SessionsPage polling | PG/命令记录交叉 | **支持** |
| `/events/v1/stream` | GET | x-api-key | events.read | query `cursor?`(\d{1,19}) \| Last-Event-ID | SSE 流（retry/id/event:projection/data JSON + `: heartbeat`） | 400/401/403/429/500/503（hijack 后无 200 envelope） | — | at-least-once + `id:`=outbox sequence 去重；weak_ordering=true；cursor tri-state（undefined=tail/N=strictly-after/≤0=全量） | EventsPage | F1-F4 | **支持** |

**不支持的 endpoint 类别**：`/devices` `/ports` `/routing` `/capabilities` 独立资源 API、PUT Resource、pagination、webhook、ChangeSet——Contract 有未来形态、**无实现**，SDK 一律不伪造。

## 3. Schema debt matrix（本 packet 清偿计划）

| Debt | 现状 | 证据 | 清偿 |
|---|---|---|---|
| **A — Start intent schema 过宽** | `startSessionBodySchema` 仅要求 version+devices[]；真实 wire 要求 `devices[].pipeline={source,sink}` | BMD BUG-F（`ec12f2b`）：schema 过 → PG 记录过 → agent `invalid_intent` 拒 | SDK-01A：把 graph_intent.rs 冻结 wire 表达进 startSessionBodySchema（SourceIntent serde tagged kind：decklink{device_id,port_id?}/rtmp{source_id,endpoint{protocol:"rtmp",host,port,path}}/self_test；SinkIntent.kind enum **["appsink","hls","rtmp"]**——pipeline.rs 快照测试 `pipeline_rt_01_sink_kind_vocabulary_snapshot` 锁定的受纳词表，fail-closed）；Fastify 层 400 拦截（BUG-F 类缺陷不再穿透到命令面） |
| **B — RuntimeSnapshot 半 opaque** | sessions ProductSession 已 typed+schema；devices/ports/resources/capabilities/program_switch = Fastify 透传 agent wire（normalize.ts `unknown[]`），无承诺 shape | normalize.ts 注释 + schema `additionalProperties:true` | **决策 B（opaque）**：SDK v0.1 如实暴露 `Record<string, unknown>[]`/`unknown|null`，不假造字段；future packet 若 Runtime 投影稳定化再补（届时 Rust wire + contract tests 先行） |
| **C — Web Console 手工 TS mirror** | `apps/web-console/src/api/schemas.ts` by-hand interface + 手工 authority 测试兜底 | 文件头注释自认 | SDK-01A 建立机械派生（json-schema-to-ts）+ drift gate；SDK-01D Web Console 改为消费 SDK 类型，mirror 删除 |
| **D — 契约测试 silently-allowed status** | `routes.schema.contract.test.ts` 对未声明 status 只跳过 | 测试 L147 | SDK-01A：SDK 支持的 endpoint 实际响应 status 必须全部有 declared shape，未知 status = FAIL；SSE 200 用 `sseFramePayloadSchema` 独立机械验证 |

## 4. 冻结决策 S1–S8

- **S1 identity**：TS；`packages/vbmf-sdk/`；npm publish name/publish 本轮 deferred；必须 `npm pack` 自包含。
- **S2 dependency direction**：schemas.ts（authority）→ mechanically derived types → vbmf-sdk → Web Console/external consumers。禁止：SDK→Rust internals/Fastify DB model/agent JSON-RPC/`/internal/*`/`:50051`；禁止 SDK 本地缓存成为第二 Runtime truth。
- **S3 transport**：仅 Product/Event/Health API；browser+Node fetch（`globalThis.fetch`）、AbortSignal、custom fetch 注入（测试）；认证 `x-api-key` 经 **credential provider callback**（`() => string | Promise<string>`，支持 rotation）；SDK 不持久化 credential、不写 storage/cookie/URL/logs。
- **S4 errors**：`VbmfApiError` 保留 HTTP status + typed ErrorEnvelope + request_id + retryable + `retryAfterMs`（429 Retry-After 头解析）。禁止 catch→null/false/success。
- **S5 command semantics**：`startSession()` 返回 `CommandOperation`（≠ session running）；`waitForCommand()` 若提供只证明 Operation terminal；actual 状态必须另行 `getRuntime()` 观察。禁止 `startAndAssumeRunning()` 类 API。
- **S6 idempotency**：调用方显式传 `idempotencyKey`；**v0.1 无自动 write retry**（自动 transport retry 若未来引入必须绑定同 key）。
- **S7 SSE**：继承 BMD 验证语义（fad0072 修复后）：fetch+ReadableStream（非 EventSource——需 header 认证）；cursor tri-state；dedupe by sequence；weak_ordering=true 透传不宣称全局序；retry hint；unexpected EOF→error→reconnect；malformed frame→terminate stream→reconnect；**单 active transport**；AbortSignal；backoff 由调用方策略或 SDK 默认阶梯（500/1000/2000/5000/10000ms cap）。
- **S8 standalone first**：media-agent 独立安装/启动/运行/健康/恢复/关闭不依赖 SDK/Web Console/Fastify/PG；SDK 只是 consumer library（静态 gate 保证）。

## 5. 子包分解（bounded packets）

| 子包 | 范围 | 不做 | BMD gate |
|---|---|---|---|
| **SDK-01A** Product Contract Closure + Type Generation | Debt A/B/D 清偿（intent schema closure + declared-status 完备 + SSE 帧 contract）、`packages/vbmf-sdk` 骨架 + json-schema-to-ts 机械类型 + drift gate + failure-first 契约测试（missing pipeline→400→zero submit/dispatch；invalid source kind→400；sink 词表外→400；valid decklink/rtmp/self_test→200；Rust canonical fixture 跨语言对照，不建第二 fixture authority） | HTTP client、SSE client、Web Console 迁移、Python | 不需要（不改 Runtime 行为） |
| **SDK-01B** SDK Core | `VbmfClient`（healthLive/health/getRuntime/startSession/stopSession/releaseSession/getCommand）+ VbmfApiError + credential provider + baseUrl + custom fetch + AbortSignal + idempotency | optimistic state、自动 write retry | 不需要 |
| **SDK-01C** Event Client | `streamEvents()` 复用 SDK-01A 类型 + BMD 验证 SSE 语义（单 parser，SDK 内单份实现；Web Console 后续共享） | 第二套 parser | 不需要 |
| **SDK-01D** Web Console Dogfood | Web Console transport/types/SSE 切换到 vbmf-sdk；保留 credential UI/4-state reducer/pages/failure presentation；69 tests 零退化 + BUG-A..G 行为回归 | UI 重写 | **bounded BMD regression**（真实 transport 改变）：Health/Runtime/Start→actual running/Stop/Release/failure visible/SSE disconnect-cursor-replay/reload convergence/device-2 untouched/teardown 零残留 |
| **SDK-01E** Distribution / Acceptance | `npm pack` + fresh temp Node consumer 编译运行 + 最小 Vite/browser consumer bundle 验证 + packed 不依赖 `../../../apps/api`（发布物自包含）+ control-plane lane 增 SDK typecheck/test/build/pack smoke（不改 required contexts/branch protection） | npm publish | 不需要 |

## 6. 验证矩阵 / failure matrix（摘要）

- **SDK-01A gate**：①Ajv 契约测试（每 endpoint 全 status 声明 + SSE 帧验证）②missing-pipeline 400 + zero dispatch（用 StubPlane 断言 submits=0）③类型 drift gate（schema 改动→派生类型不一致=CI FAIL；SDK 内 handwritten ErrorCode/CommandState/SessionState 重复=gate FAIL）④Rust fixture 对照（graph_intent.rs SAMPLE JSON 双向 parse）。
- **SDK-01B**：hermetic 单测（fake fetch：200/4xx/5xx envelope/网络失败/429 Retry-After/abort）+ 真实 Fastify fixture（复用 WCE-01F 模式 buildAppHandle+StubPlane）旅程 Start→Stop→Release + 401/403/429/503。
- **SDK-01C**：parser/EOF/malformed/cursor/dedupe 单测（继承 api.sse.test.ts 全语义）+ 真实 Fastify SSE inject（replay strictly-after）。
- **SDK-01D**：web-console 69/69 零退化 + 7 bug 行为回归（EventsPage 7 生命周期 + SessionsPage cadence 4 + release 1）+ BMD bounded regression。
- **SDK-01E**：npm pack → temp dir npm init + install tgz → Node consumer 编译运行（getRuntime + error envelope 断言）→ Vite consumer build；`tar -tzf` 无 app source 断言。
- **静态红线 gate**（S2/S8）：SDK production source 禁止出现 `/internal/v1/`、`:50051`、`media-agent:`、`DeckLinkAPI`、`/dev/blackmagic`、`gst-launch`、`ffmpeg`、`drizzle`、`better-auth`、`commands`/`event_outbox` SQL 字样（脚本同 check_web_console_red_lines.py 模式；文档注释按规则排除）。
- **frozen Architecture/Contract 修改 = 0**；若无法 reconciliation → HARD BLOCKER 上报。

## 7. Owner map / CI / BMD 规则

- Owner：schemas.ts=Fastify 侧（WCE-01A 模式延续）；SDK 类型=机械派生（无 owner 人工同步）；SSE parser=SDK 单份（SDK-01D 后 Web Console 删除自有实现）；UI state machine=Web Console（SDK 不拥有 UI state）。
- CI：control-plane lane 内追加 SDK steps（typecheck/test/build/pack smoke）；**required contexts/branch protection 不动**。
- BMD gate：按上表——仅 SDK-01D 触发 bounded regression（exact commit 绑定、device-2 保护、teardown 零残留——复用 WEB-CONSOLE-BMD-ACCEPTANCE-01 runbook）。

## 8. 推进

Planning FROZEN → 直接进入 SDK-01A（不等待确认）。
