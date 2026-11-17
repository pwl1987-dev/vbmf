# ci-runner-rust-pin-host1 — 完整目标规格

Capability：`vbmf-ci-01` general runner 宿主机的 system Rust 1.98.1 pin 正式收口、agent 分工契约落盘与证据/状态闭环。Authority：`.project/STATE.md` §5.1 P2-C1、`docs/architecture/CI_RUNNER_STRATEGY.md` §15.7/§15.8/§15.9。

## 前提（已成立，不由本 change 重做）

- live canonical `main` = `b0f5df3b215c536b598aed7938079572edf87395`（本地/远端一致）；CI `34949135299` 7/7 required jobs SUCCESS。
- host-admin 通道已恢复并严格验证（encrypted probe + host-key 严格比对 + BatchMode SSH + `sudo -n` PASS）；`vbmf-ci-01` 已完成一次 Rust 1.98.1 system pin 且修复版 verifier 实机 V1–V4 PASS；verifier caller-rustup 污染 RCA 已修复（`0f375c8`）。
- STATE Task Queue 已落盘（`b0f5df3`），P2-C1 为第一个 READY。
- 分支收敛已完成：本地/远端仅存 `main`；本 change 以 `current` 隔离在 `main` 直接工作。

## §1 bundle 制备（Development VM）

`scripts/ci/prepare-system-rust-bundle.sh --repo <VBMF> --sha b0f5df3b215c536b598aed7938079572edf87395 --out <mktemp 安全空目录>`（coordinator 已确认该 exact canonical main SHA）：

- 只接受 full 40-hex exact SHA；拒绝 floating ref/短 SHA/missing script/非空目标目录。
- 从该 commit byte-exact 导出 `pin-system-rust.sh` / `verify-system-rust.sh` / `collect-toolchain.sh` + 确定性 `SHA256SUMS`，打印 `BUNDLE_SOURCE_SHA`。
- `BUNDLE_SOURCE_SHA` 与 `SHA256SUMS` 全文记录为 evidence。

## §2 host1 执行（out-of-band host-admin，只用 bundle）

按 §15.9 步骤 B，对 `vbmf-ci-01`：

1. `cd "$BUNDLE_DIR" && sha256sum -c SHA256SUMS` 全 PASS，任一 mismatch 立即停止。
2. 幂等复核：`sudo "$PIN_DIR/pin-system-rust.sh" --version 1.98.1` 原样重跑，0 退出且 `PINNED_RUST_VERSION=1.98.1` 不变（需要时 proxy 只按命令经 `sudo env VBMF_CI_PROXY=...` 传入）。
3. 正式验证：非 root、零 mutation 执行 `"$PIN_DIR/verify-system-rust.sh" --expect-version 1.98.1`，V1–V4 全 PASS，输出 `RESULT: PASS` 与 `PINNED_RUST_VERSION=1.98.1`；V2 证明 `rustup default = 1.98.1-<target>`（无 rolling stable）；V2/V3/V4 以显式 `RUSTUP_HOME=/usr/local/rustup`、`CARGO_HOME=/usr/local/cargo` 且清除调用方 `RUSTUP_TOOLCHAIN` 执行，用户态 rustup 状态不得冒充 system pin 证据。
4. manifest：`sudo -u vbmf-ci "$BUNDLE_DIR/collect-toolchain.sh" --name vbmf-ci-01`，写入 `/data/actions-runners/vbmf/manifests/vbmf-ci-01/{toolchain.yaml,toolchain.txt}`，记录 1.98.1 与 `/usr/local` 路径，不含 secrets。
5. 清理：只删除本次传输的 bundle 临时目录。

## §3 管理机只读收口

`scripts/ci/verify-runner.sh --name vbmf-ci-01`：R1 registered / R2 identity exact / R3 online / R4 idle / R5 labels exact set（`self-hosted,Linux,X64,vbmf,vbmf-general`）+ repository scope，期望 `RESULT: PASS`。

## §4 evidence 与 STATE 闭环

- evidence 项：`BUNDLE_SOURCE_SHA`、`SHA256SUMS` 全文、host1 各步输出摘要（checksum PASS / 幂等 0 退出 / V1–V4 PASS / manifest 路径与版本）、`verify-runner.sh` PASS、AGENTS.md 落盘结果。
- `.project/STATE.md`：§3 Last Completed 增 P2-C1 条目；§5.1 Task Queue 置 P2-C1 = COMPLETE、P2-C2 = READY；§7/§8/§9 相应核对更新。STATE 内不写 host 地址/指纹/凭据。
- 本 change 的 repo 侧改动限于 STATE、`AGENTS.md`（tiering 条款）与 Comet 正式产物；不改 `scripts/ci/*`。

## §5 AGENTS.md 分工契约落盘

在 `AGENTS.md` "Agent execution" 节追加（只增不改）：

- Coordination tiering：driving session 中最强可用模型任 coordinator——dispatch、Work Packet 设计、diff review、verification、STATE/Authority 转正；Claude Code 驱动工作会话（如 Comet change）时即 coordinator 层。
- Pi 为默认 executor 层：bounded/机械工作 + 大部分模式化编码（backend CRUD/schema、web console surfaces、SDK bindings、按既有模式的 adapters、tests、scripts、CI workflow 编辑）；state machine、并发、恢复、跨域、难 RCA 仍由 Claude Code 执行。
- Executor 不写自己的调度契约：AGENTS.md、STATE 转正、frozen Architecture/Contract、分工规则归 coordinator；Pi 只可按显式 packet 起草 STATE/evidence 修改并由 coordinator 复核。

与 `_shared/README.md` coordination tiering 段（dev-agent-kit main `93a6451`）语义一致。落地时若 `AGENTS.md` 存在并发 agent 未提交改动，等其落定或由用户裁决，不得混合提交。

## 红线（不变量）

- 宿主机零 git 操作；verify 脚本零 mutation；`vbmf-ci` 零新增 sudo/root；不迁移任何 workflow `runs-on`；public repo 零敏感信息；全程零新建分支/worktree，仅 `main`；主 checkout 并发 agent 未提交文件零触碰。
