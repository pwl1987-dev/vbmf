# Cursor 在本仓库的用法（已自动配置）

VBMF 已按 **newsreview 同构** 做 Cursor 专项优化：短宪章 + 任务快照 + 分区 rules + 降索引。

## 已写入仓库（随 git 生效）

| 文件 | 作用 |
| --- | --- |
| [`AGENTS.md`](../AGENTS.md) | 短宪章（每轮 Agent 上下文） |
| [`.project/current-work.yaml`](../.project/current-work.yaml) | 当前任务快照（对齐 STATE §4–§5） |
| [`.project/STATE.md`](../.project/STATE.md) | 完整动态 Authority + §3 历史 ledger |
| [`docs/agent-toolchain.md`](agent-toolchain.md) | 命令与验证（按需读） |
| [`.cursorignore`](../.cursorignore) | 排除 Comet 归档、superpowers、evidence 等大目录 |
| [`.cursor/rules/`](../.cursor/rules/) | 改 Runtime / TS 面 / CI 时才附加的规则 |
| [`.vscode/settings.json`](../.vscode/settings.json) | 搜索/监听排除、敏感文件 ignore |

## 一次性操作

1. **重载窗口**：`Developer: Reload Window`，让 `.cursorignore` 与 VS Code 排除生效。
2. **索引（可选）**：Cursor Settings → Indexing → Resync。
3. **User Rules**：若全局规则与 `AGENTS.md` 重复，缩短全局层，避免叠两层。

工作区搜索/监听排除见 [`.vscode/settings.json`](../.vscode/settings.json)（若本地被 gitignore 旧规则挡住，以仓库内文件为准）。

## 聊天习惯（省 token）

- 查「现在该干什么」：先 `@.project/current-work.yaml`，再按需 `@.project/STATE.md` §4–§5。
- 不要通读 STATE §3 完成史；不要 `@Codebase` 扫 `evidence/` 或 `docs/comet/`。
- 跑验证：让 Agent 读 `docs/agent-toolchain.md`。
- CodeGraph：有 `.codegraph/` 时优先 MCP/`codegraph explore`（见 `.cursor/rules/codegraph.mdc`）。

## Comet / Pi / Claude

- 仓库内 **Comet 运行时已退役**（skill 镜像与 ambient resume 已移除）；`docs/comet/archive/` 只读历史。
- 仍可在 VM 上显式 dispatch Pi/Claude（`_shared`）；与 Cursor 同 checkout 时注意 writer `flock`。
