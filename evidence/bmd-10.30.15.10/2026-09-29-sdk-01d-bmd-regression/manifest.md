# SDK-01D bounded BMD regression — 证据（2026-09-29）

## Provenance

- 最终验收 commit = `144ea60`（git archive sha256 `c09edf44a6d6d005be0ae6cd579cf03697555932ebbde8bb1734d3ee1ca0fb9c`）
- exact-head CI（144ea60）：media-agent run `36539013523` SUCCESS（7/7 required）+ control-plane run `36539013617` SUCCESS（含新 SDK lane：drift gate / red-line gate / typecheck / 29 tests / build / pack smoke）
- native agent binary = CI artifact `media-agent-gstreamer-linux`（sha256 `3426108d…`，`/proc/<pid>/exe` 实证位元一致；Rust 源自 dc780c8 起零改动）
- 触发条件：SDK-01D 将真实 Web Console production transport 切换到 `@vbmf/sdk` → §20 要求 bounded BMD regression

## 发现并修复

- **BUG-H**：SDK 默认 fetch 未 `bind(globalThis)` —— 真浏览器（Chromium → BMD dogfood 栈）中认证后所有页面
  `Failed to execute 'fetch' on 'Window': Illegal invocation`（Node 注入测试路径掩盖）。修复 `144ea60`
  （transport + events 双处 bind + this 敏感 fetch 替身 regression 2 测试）。首验 commit f926419 上暴露、144ea60 重验通过。

## 旅程结果（screens/ + browser-journey.log，全部 PASS @ 144ea60）

| 项 | 结果 |
|---|---|
| credential gate → Health 分层 | PASS（runtime up 等） |
| Runtime 页真实快照 | PASS（devices=3） |
| Events 页（SDK SSE transport）：事件到达期间 stream 请求恒 1 | PASS（正常事件零重连） |
| Sessions 页 Start（SDK client）→ Desired/Requested/Executing/Observed 收敛 running | PASS（divergence ok after convergence） |
| Stop → observed released | PASS |
| Release → completed（幂等 canonical removal） | PASS |
| failure visible：agent SIGTERM 完全退出 → UI 如实 DEPENDENCY_UNAVAILABLE | PASS |
| 重启同 binary agent → UI 恢复收敛 | PASS |
| SSE 断流（docker restart fastify）→ 重连全部 `?cursor=13` strictly-after | PASS |
| replay 零重复 + 新事件 live 恢复 | PASS |
| reload → credential-required → canonical 收敛 observed=running | PASS |

## 边界与 teardown

- device-2 PID `992634` before/after 存活、从未被 acquire；`/opt/vbmf-dev/repo` 与 `/opt/vbmf/current`（0.1.0-06bc01a）未触碰
- Teardown：API key 官方 revoke（key_id 0yv5V0CDE…）；agent SIGTERM 优雅退出（无 50051 残留监听）；compose down -v；ufw 3 条临时规则删除（恢复仅 SSH）；BMD/dev VM /tmp 全清；零 ffmpeg/gst 孤儿、零容器、零 listener
