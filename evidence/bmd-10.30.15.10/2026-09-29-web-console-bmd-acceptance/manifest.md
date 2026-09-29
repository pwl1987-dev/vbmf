# WEB-CONSOLE-BMD-ACCEPTANCE-01 — BMD 真机验收证据（2026-09-29）

## Provenance（exact-commit 链）

- 最终验收 commit = `dc780c8`（main; git archive sha256 = `acfce0acaddd73032f593f63a6d587a79037d6a1daf35c82263e5a3f05c3c3c1`）
- exact-head CI（dc780c8）：media-agent run `36527255975` SUCCESS（7/7 required）+ control-plane run `36527256048` SUCCESS
- media-agent binary：CI artifact `media-agent-gstreamer-linux`（bmd,gstreamer; sha256 `3426108dd9e117bce0d7c50dfbab74376112fc0179b42f2fb6df5db814d7eb06`）
  - fad0072 / 59324cc / 5b9cadb / ec12f2b / dc780c8 五个 commit 的该 artifact 位元一致（Rust 源零改动、确定性构建）；
    运行中 agent 以 `/proc/<pid>/exe` sha256 实证 = 同一 bit（见 agent-binary-identity.txt）
- 设备 binding manifest = `a2-8-02i-v5.manifest.json`（machine_id=10.30.15.10; SDI-IN-1/SDI-IN-2 输入 jack；不涉及 device-number 2）

## 发现并修复的真 bug（全部 failure-first → RCA → 最小修复 → CI 双绿 → exact-archive 重部署 → 从头重验）

| # | Bug | Fix commit | CI runs (media/control) |
|---|-----|-----------|------------------------|
| BUG-A | EventsPage `[cursor]` effect 每事件重建 SSE；sse.ts EOF 静默；malformed 帧不终止流（并行双 transport 风险） | `fad0072` | 36523254344 / 36523254380 |
| BUG-B | SessionsPage `[rows,four]` effect → OBSERVE dispatch 无限重建 polling（请求风暴） | `fad0072` | 同上 |
| BUG-C | BMD/software acceptance overlay 仍以 CP-01E placeholder nginx 覆盖 web（非真实 Web Console） | `fad0072`（overlay+gate） | 同上 |
| BUG-D | web 容器 healthcheck 抖动：busybox wget 解析 localhost 间歇走 ::1，nginx 仅听 IPv4 → 永久 unhealthy | `59324cc`（127.0.0.1 字面量 + 双栈 5173） | 36524528934 / 36524528956 |
| BUG-E | nginx 未路由契约路径 `/healthz`（前缀 `/health/` 不匹配）→ Health 页收 SPA HTML | `5b9cadb`（exact location = /healthz） | 36525093958 / 36525093945 |
| BUG-F | Web Console Start intent 缺 `devices[].pipeline` → 真实 agent `invalid_intent` 拒绝（StubPlane 掩盖） | `ec12f2b`（canonical GraphRuntimeIntent builder + wire guard 测试） | 36526449012 / 36526449029 |
| BUG-G | Release 按钮在 Stop 后死路（pickSessionId 仅认 running；真实 Runtime release=released 会话幂等 executed） | `dc780c8`（Release 目标=running 优先→最近非 terminated） | 36527255975 / 36527256048 |

## 拓扑（CP-01E 已验证形态复用）

Browser（dev VM Playwright Chromium 1243）→ BMD nginx :8081 → web（真实 Vite production build, Dockerfile.web）→ Fastify → docker bridge gateway 172.18.0.1 → native media-agent :50051（bmd+gstreamer systemd lane 外运行, nohup）→ DeckLink dv0/dv1。
ufw 临时规则（已记录 before/after，验收后即撤）：50051←172.18.0.0/16、8081/15433←10.30.5.80。

## 验收旅程（screens/ + browser-journey.log）

- **Phase A** credential gate → 真实 key → 分层 Health（api/runtime/db up; agent Ready devices=3）；凭证零落盘（ls/ss/cookie/URL）
- **Phase B** Runtime 页真实快照（devices=3 / ports=2 / resources=2）
- **Phase C** Start（canonical device 4fa33dcb…）：Desired=Running → Requested=completed(693c8176…) → Executing=completed → Observed=running；divergence=ok after convergence；PG/命令记录/API 交叉一致
- **Phase D** Stop → observed released（资源 available）；Release → completed（幂等 canonical removal）
- **Phase E** 故障注入（agent SIGTERM）：UI 真实显示失败；故障窗 Start → 503 + PG `timeout|retryable|agent dispatch transport failure`（043b83f9…）；重启同 binary agent → API 200 + UI 收敛（devices=3 无 error）
- **Phase F** SSE：事件 #10/#11 到达期间 stream 请求恒为 1（正常事件零重连 = BUG-A 修复反证）；docker restart fastify → 重连请求全部 `?cursor=11`（strictly-after）→ replay 无重复 → 新事件 #12/#13 live 恢复 → conn=live
- **Phase G** 有 running session 时 reload → credential-required（memory-only 设计）→ 重输 key → canonical runtime 先行收敛（observed=running）→ 凭证零落盘
- 最终 Runtime：全部 session released、resources 全部 available、零 ffmpeg/gst 孤儿（除保护对象）

## device-2 保护边界

PID 992634 gst-launch-1.0 decklinkvideosink device-number=2 1080p25 —— 验收 before/after 存活、从未被 acceptance acquire（agent 日志 device-2 探测 WARN = 被占用证据）；`/opt/vbmf-dev/repo` 未触碰；`/opt/vbmf/current` 保持 0.1.0-06bc01a。

## 结论

WEB-CONSOLE-BMD-ACCEPTANCE-01 全部验收条件成立 → WEB-CONSOLE-ENTRY-01 BMD RUNTIME ACCEPTANCE 由 DEFERRED 升级（非 24h soak，不写 stability verified）。
