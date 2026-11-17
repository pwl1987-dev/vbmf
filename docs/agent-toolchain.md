# 智能体：命令与验证（按需阅读）

> 根目录 [`AGENTS.md`](../AGENTS.md) 只保留宪章；跑门禁或本地开发时再打开本文。

**Canonical checkout**：`/home/ubuntu/dev/VBMF`（Development VM `ubuntu2604`）。

## Rust Runtime（media-agent）

| 场景 | 命令 |
| --- | --- |
| 单元/集成测试 | `cd services/media-agent && cargo test` |
| Clippy | `cd services/media-agent && cargo clippy -- -D warnings` |
| Format check | `cargo fmt --all --check`（仓库根或 media-agent 视 CI 约定） |
| Focused CI 脚本 | `scripts/ci/test-system-rust-scripts.sh`（41 项 pin 脚本，无 root） |

## 智能体上下文预算（token 节省）

上表命令是 **SoR**；下列包装只改变**输出形态**，不改变判定（exit code 透传）。

| 场景 | 命令 | 效果 |
| --- | --- | --- |
| 读 STATE 指定章节 | `scripts/agent/state-scope.sh 4-5` | §4–§5 ≈ 28KB；整份 STATE = 361KB，勿整读 |
| Rust 门禁（输出过滤） | `scripts/agent/cargo-check.sh test\|clippy\|fmt` | `cargo test` 28.8KB → 1.2KB（丢 `test ... ok` 噪声行，保留失败详情与 `test result:` 摘要） |

- `state-scope.sh` 支持 `N` / `N-M` / `all`；`all` 仅在 Work Packet 明确要求时使用。
- 需要 `docs/phase-0.5` / `docs/openspec` / `evidence/` 等被 `.cursorignore` 降索引的历史材料时，用 shell（`sed`/`cat`）按需读取，勿整库索引。

## Control Plane + Web + SDK

| 场景 | 命令 |
| --- | --- |
| API | `cd apps/api && npm test` / `npm run build`（以 package.json 为准） |
| Web Console | `cd apps/web-console && npm test` / `npm run build` |
| SDK | `cd packages/vbmf-sdk && npm test` |

## GitHub CI

- Workflow：`.github/workflows/media-agent.yml` 等；**7 required checks** 见 `.project/STATE.md` §1。
- Fork PR 永留 GitHub-hosted；trusted `main` / same-repo PR 可走 self-hosted（`vbmf-general` / `vbmf-media`）。
- v3 harness tooling lane：`.github/workflows/v3-harness-tooling.yml`（`r64-probe/test_analyze_long_v3.py` 等）。

## BMD / 长稳（非 VM 替代）

- Long Stability v3：`r64-probe/`（manifest、`VBMF_MACHINE_ID`、exact binary pin）。
- 证据目录：`evidence/bmd-10.30.15.10/`（按需 Read，勿整库索引）。

## Legacy VM executors（仅显式 dispatch）

```bash
/home/ubuntu/dev/_shared/bin/run-pi-agent.sh …
/home/ubuntu/dev/_shared/bin/run-claude-agent.sh …   # 长任务建议 tmux
```

同一 checkout 同时仅一个 write-capable agent（`flock`）。
