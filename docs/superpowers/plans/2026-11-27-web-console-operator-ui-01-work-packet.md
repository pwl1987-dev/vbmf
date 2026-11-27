# WEB-CONSOLE-OPERATOR-UI-01（WCO-01）— Phase 0.5 操作台落地 MVP【Work Packet · owner 已裁决 · READY】

- 状态：**READY（owner 2026-11-27 裁决通过：「通过，按此登记排期」）** — D1–D4 按本稿建议整体采纳；开工排在 PR-STAB-01 收口落笔之后
- 起草：2026-11-27（device lane 切换 + HLS 可视化验证会话之后）
- 前置事实（本会话实测，非声明）：
  - media-agent 已切 **device lane**（`/etc/vbmf/device-binding.json`，`devices=3`，`NRestarts=0`）；`runtime.query` 返回 devices/ports/resources/sessions。
  - 命令面可真实起停 FFmpeg 会话；`sink.kind=hls` 会话产出 `/var/lib/vbmf/hls/index.m3u8`，经 nginx `/hls/`（本会话已挂 ro + no-store + CORS）由 **hls.js 1.5.17 在 Chrome 播出 SDI-IN-1 真实节目**；IINA 可播；Safari 原生对该流黑屏（数据 200 正常，引擎特性）。
  - 现有 `apps/web-console` = CP-01/WCE-01 控制面验收工程：5 页 / 1652 LOC / 导航硬编码英文 / 无 i18n / 无播放器。
  - Phase 0.5 设计权威在仓：33 份 HTML 线框（operator 29 + product 4）+ `DESIGN_SYSTEM.md` V0.2 + `SURFACE_REGISTRY.yaml`（56 = 32 LOCK + 24 SPEC）+ `I18N_SPEC.md`（**zh-CN 默认**、en-US fallback、canonical 词表不翻译）。

## 目标（用户可感知的结果）

Web 控制台按线框重做第一批表面：**默认中文、看得见真实信号、源注册表按设计呈现**。不是视觉大改版，而是把「验收工程」升级为「Phase 0.5 操作台」的第一个 bounded 切片。

## 待 owner 裁决的决策点

| # | 决策 | 建议 |
|---|---|---|
| D1 | MVP 范围 = `01-dashboard` + `02-sources` + i18n 层 + 监看窗播放器；其余 31 份线框后续逐包 | 采纳 |
| D2 | 播放器技术 = **hls.js**（前端唯一新依赖；Safari 原生对该流实测黑屏，不作依据） | 采纳 |
| D3 | i18n = **自研 ~50 行 t() + zh/en 词典文件**，不引 react-i18next（ICU 复数当前无需求）；现有 5 页文案一并接入（用户抱怨点就是「还是英文」） | 采纳 |
| D4 | 旧 5 页处置：新控制台为主入口（dashboard 落地页），旧页保留至后续包宣布退役 | 采纳 |

## 子包分解（各自满足 §5.1 Work Packet minimum fields）

### WCO-01A — i18n 基础层
- **Authority**：`docs/phase-0.5/I18N_SPEC.md`（zh-CN 默认 / en-US fallback / canonical 词表不翻译）
- **allowed**：`apps/web-console/src/**`（新增 i18n 模块 + 现有页面文案接入）、`apps/web-console/src/i18n/*.ts`（新）、测试
- **forbidden**：新依赖；Product API wire 改动；Rust
- **acceptance**：默认渲染 zh-CN；🌐 切换 en-US 全站生效并持久（localStorage）；canonical 词（LOCKED/DeckLink 等）不翻译；现有 52 测试不回归 + i18n 单测（缺失 key 回落 fallback、词表守卫）
- **verification**：本地 typecheck/vitest/build + 红线 gate + control-plane CI lane

### WCO-01B — 01-dashboard 主控台（含监看窗播放器）
- **Authority**：`docs/phase-0.5/operator/01-dashboard.html`（LOCK 表面）+ `DESIGN_SYSTEM.md` 对应组件/token
- **allowed**：`apps/web-console/src/**`（新 surface + hls.js 依赖入 `package.json`）、测试
- **forbidden**：media-agent Rust source（含去隔行 `-vf yadif` ⇒ 独立 runtime packet，见风险）；frozen Contract；nginx/compose（本会话已就绪）
- **acceptance**：双子图监看窗经 hls.js 播 **同源 `/hls/index.m3u8`**（SDI-IN-1 真实画面）；NOW/NEXT 与告警表按线框呈现；起停 HLS 会话走既有 Product API 命令旅程（四状态分离不得破坏）；**开工首项检查**：apps/api 命令透传是否已支持 `sink.kind=hls` intent，缺则 additive 字段（契约测试同步）
- **verification**：本地全绿 + control-plane CI exact-head + BMD bounded 真机验收（起会话见画面 → 停会话 → teardown 零残留）

### WCO-01C — 02-sources 源管理
- **Authority**：`docs/phase-0.5/operator/02-sources.html`（LOCK 表面）+ `SURFACE_REGISTRY.yaml` 对应条目
- **allowed**：`apps/web-console/src/**`；如线框必需字段缺失，`apps/api` 只读 additive 字段 + `schemas.ts` 单源同步
- **forbidden**：Runtime 状态机新增；对 device-binding 清单的写操作（清单仍 systemd/env 权威）
- **acceptance**：表列含设备名/BMD handle（或 PCI 别名）/connector/format/LOCK 态/Used By；数据全部来自 `/api/v1/*`，无本地假成功；无线框要求但 API 无源的列显 N/A 并登记
- **verification**：同 01B

## 全局红线（三个子包共同）

1. 前端只消费 Fastify `/api/v1/*` + SSE（C13 零直连 media-agent；`check_web_console_red_lines.py` 保持绿）。
2. frozen Contract 零修改；任何新字段按 additive 非破坏条款（schema 单源 + 契约测试）。
3. 不触碰 `docs/phase-0.5/` 权威文件；LOCK 表面实现偏差须 owner 签字，Agent 不得自改。
4. SDI 基带预览 = V0.2 RESERVED（Target V0.4），不在本包；监看窗语义 =「近实时 HLS（~6–10s 延迟）」，广播级监看仍是 Mini Monitor。
5. 默认不 commit；完成时 STATE/EVIDENCE-INDEX 同步登记。

## 风险与未验证项

- **去隔行在 runtime 侧不在 UI 侧**：x264 按 progressive 编 1080i，运动字幕有梳状撕裂（实测）；修它 = `-vf yadif` = Runtime source 变更 ⇒ 若先于 STABILITY VERIFIED 落笔采纳会触发重走 ladder，**建议排在 stability 提交之后**。
- **E-42 Source Runtime Preview Stream 尚未实现**：MVP 播放器吃 HLS 会话产物而非 canonical 预览端点；接口留适配层，E-42 包落地时只换数据源。
- apps/api 对 `sink.kind=hls` intent 的透传能力**本会话未验证**（当时经 RPC 直发）——已列为 WCO-01B 开工首项检查。
- 监看窗双画面同播对 nginx/带宽无压力（同源静态切片），但未做 2 路并发实测。

## 排期依赖

- 建议排在 **owner 完成 PR-STAB-01 收口落笔（STABILITY VERIFIED + 是否 commit）** 之后启动，避免工作树混线；本包纯前端 + 可能的 apps/api additive 字段，与 ladder 无冲突。
