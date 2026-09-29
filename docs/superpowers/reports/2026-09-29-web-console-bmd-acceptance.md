# WEB-CONSOLE-BMD-ACCEPTANCE-01 — Verification Report（2026-09-29）

> 本报告是 verification report，不是第二动态状态控制面；动态状态以 `.project/STATE.md` §3.82 为准。

## 结论

**WEB-CONSOLE-BMD-ACCEPTANCE-01 = COMPLETE。** exact commit `dc780c8`（git archive sha256 `acfce0ac…`，exact-head CI 双绿：media-agent `36527255975` / control-plane `36527256048`）上，真实 production Web Console → Fastify → native media-agent（bmd,gstreamer）→ DeckLink 全旅程验收 PASS。**WEB-CONSOLE-ENTRY-01 BMD Runtime acceptance 由 DEFERRED 升级为 BMD RUNTIME ACCEPTED**（非 24h soak，不写 stability verified）。

## 验收前修复（7 个真 bug，failure-first 全链）

| Bug | 现象 | 根因 | Commit | 关键回归 |
|---|---|---|---|---|
| BUG-A | EventsPage 每事件断开重连；EOF 静默；malformed 帧可并行双流 | effect deps `[cursor]`；`read() done=true` 不上报；契约违例不终止旧流 | `fad0072` | 生命周期 7 测试（mount=1 / payload 后仍 1 / backoff ladder / cursor 续传 / unmount 无重连）+ sse 3 新单测（EOF 报错、operator close 不误报、malformed 后旧流死） |
| BUG-B | SessionsPage 2s polling 退化为请求风暴 | effect deps `[rows,four]` × reducer 恒新对象 | `fad0072` | mount=1 / settle 无增长 / 1999ms=1 / 2000ms=2 / 4000ms=3 + 命令轮询独立 |
| BUG-C | BMD/software acceptance web 仍是 placeholder | overlay 以 placeholder nginx 覆盖 base web | `fad0072` | gate 扩展（无 web override / 无 placeholder conf / Dockerfile.web/5173 / nginx /→web / bridge RPC）+ 负向自检 + compose render |
| BUG-D | web 容器 healthcheck 抖动（同命令时成时败） | busybox/musl localhost 间歇解析 ::1；nginx 仅 IPv4 | `59324cc` | 127.0.0.1 字面量 + 双栈 5173；BMD 实测 healthy fails=0 |
| BUG-E | `/healthz` 返回 SPA HTML | nginx 仅有前缀 `/health/`，无 exact `/healthz` | `5b9cadb` | nginx -t + 真机 200 application/json 分层 health |
| BUG-F | Start 恒 503（PG `timeout\|retryable`） | console intent 缺 `devices[].pipeline`（agent `invalid_intent`；StubPlane 掩盖） | `ec12f2b` | `api/intent.ts` canonical builder + wire guard 3 测试（pipeline 必在 / 结构 / 零执行细节字段） |
| BUG-G | Stop 后 Release 恒 "no active session" | pickSessionId 仅认 running；真实语义 release=released 幂等 executed | `dc780c8` | Release 目标=running 优先→最近非 terminated；Stop 拒绝 + Release 发令 regression |

Rust 源零改动（fad0072→dc780c8 五 commit 的 `media-agent-gstreamer-linux` artifact sha256 位元一致 `3426108d…`，运行进程 `/proc/<pid>/exe` 实证）。

## 真机旅程（Playwright Chromium 1243 @ dev VM → BMD nginx :8081）

- **A credential/health**：gate 强制 key；分层 health（api/runtime/db/auth/events up，agent Ready devices=3）；ls/ss/cookie/URL 零 key。
- **B runtime**：真实快照 devices=3 / ports=2 / resources=2（3 台 DeckLink：`4fa33dcb`/`6ede00d0`/`1afe2dcc`）。
- **C start**：canonical device `4fa33dcb…` → Desired=Running → Requested=completed(`693c8176…`) → Executing=completed → Observed=running；divergence=ok after convergence；PG 命令记录/agent verdict/API 三方一致；resource `allocated`。
- **D stop/release**：Stop → completed → observed released、resources available；Release → completed（幂等 canonical removal，真机语义实测）。
- **E failure-first**：agent SIGTERM → UI 真实失败；故障窗 Start → 503 DEPENDENCY_UNAVAILABLE，PG `timeout|retryable|agent dispatch transport failure`（`043b83f9…`）与 UI 一致；同 binary 重启 → API 200 + UI 收敛。
- **F SSE**：事件 `#10/#11` 期间 stream 请求恒 1（正常事件零重连 = BUG-A 修复真机反证）；`docker restart fastify` → 重连请求全 `?cursor=11` strictly-after → replay 零重复 → 新事件 `#12/#13` live 恢复。
- **G reload**：running session 下 reload → credential-required（memory-only 设计）→ 重输 key → canonical runtime 先行 → observed=running 收敛；凭证零落盘复核。

## 边界与 teardown

- device-2 PID `992634`（decklinkvideosink device-number=2, 1080p25）before/after 存活，从未被 acceptance acquire；`/opt/vbmf-dev/repo`（`7cc33dd` + 历史本地改动）与 `/opt/vbmf/current`（`0.1.0-06bc01a`）未触碰。
- Teardown：sessions 全 Stop/Release → agent SIGTERM 优雅退出 → `compose down -v` → ufw 3 条临时规则删除（恢复仅 SSH）→ API key 官方 revoke → 双端 /tmp 清理 → 零进程/零容器/零 listener 复核通过。

## 证据

`evidence/bmd-10.30.15.10/2026-09-29-web-console-bmd-acceptance/`（manifest + 24 screens + agent.log + compose-rendered.yml + pg-commands.txt + device2-before-after.txt + ufw-during.txt + sha256sums.txt + browser-journey.log；无 key/secret）。
