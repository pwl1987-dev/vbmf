# VBMF 智能体宪章

[`CLAUDE.md`](CLAUDE.md) 仅指向本文。命令/验证按需 → [`docs/agent-toolchain.md`](docs/agent-toolchain.md)。Cursor 配置 → [`docs/cursor-setup.md`](docs/cursor-setup.md)。

**Authority**：[`.project/current-work.yaml`](.project/current-work.yaml)（当前任务快照）+ [`.project/STATE.md`](.project/STATE.md)（完整队列与 §3 ledger，**冷启动只读 §4–§5 + 相关 Work Packet**）+ 冻结 `docs/architecture/` / Contract / ADR。`.cursorignore` 已降索引；勿用 README/Roadmap/旧聊天推断完成度。

**当前（摘要）**：PR-STAB-01 **STABILITY VERIFIED**（v3 阶梯 2h/8h/24h 三档全 PASS；绑定 exact Runtime `8b68f7b4` / binary `c569aca7` / Desktop Video `16.5a1` / kernel `7.0.0-44-generic`——**任一项变更即失效，须重走 2h 起步 ladder**）；PR-STAB 与 WCO-01 两组 commit 已落 main；**RD-01A Runtime 实施仍冻结**。**唯一下一步 = owner 拍板：RD-01A 解冻**（`evidence/**/*.json` 窄例外与 BMD 冻结 clone 两验收配置处置已于 §3.120 / §3.121 关闭，不再是待拍板项）。**产品层唯一入口 = [`docs/VBMF_PRODUCT_PRD.md`](docs/VBMF_PRODUCT_PRD.md)**（V1.0 DRAFT：定位 / 角色 / 4 条操作链 / 56 表面范围 / 现状基线 / M0–M5 路线图 / 6 项待拍板）。细节以 `current-work.yaml` 为准。

## 动手前

1. `git fetch`，对齐 `origin/main`（live HEAD 优先于聊天记忆）。
2. 读 **current-work** + STATE **§4–§5**（非整份 STATE）。
3. 打开任务相关 frozen Authority → **先看代码**再改。
4. **单 Work Packet、单 Writer**；无平行 STATUS/TODO/HANDOFF。

## 门控

- Comet 已退役；勿 `comet resume-probe` 除非用户显式调用 Comet。
- **Cursor = 默认**；Pi/Claude 仅用户显式 `_shared` dispatch。
- Git：仅 `main`；禁止 destructive reset / force push；默认 **不 commit/push**（除非用户要求）。
- BMD 硬件/长稳证据绑定 exact commit/binary；VM 软件 PASS 不替代。

## 边界

VBMF = Broadcast Runtime / Fabric；standalone first；**Runtime owns truth**；与 `media-digital-*` compatible, not dependent。改 frozen Contract 须 assigned packet + 协调者审查。Executor 不得自写 AGENTS/STATE Authority 模型。

## 收工前

1. 跑变更范围内**最低充分**验证（见 agent-toolchain）；不行则 **`NOT RUN`**。
2. 汇报：测试/CI 范围/frozen 偏差（`NONE`）/是否需 BMD deferred。
3. `git status`；不自行标 COMPLETE / stability verified；不 commit（除非要求）。
