# ci-runner-rust-pin-host2 — 完整目标规格

Capability：`vbmf-ci-02` general runner（devbox KVM guest）的 system Rust 1.98.1 exact pin 对称收口与证据/状态闭环。Authority：`.project/STATE.md` §5.1 P2-C2、`docs/architecture/CI_RUNNER_STRATEGY.md` §15.7/§15.8/§15.9、STATE §3.6 RCA。

## 前提（已成立，不由本 change 重做）

- P2-C1 COMPLETE：`vbmf-ci-01` 已 current-SHA 正式收口（bundle/checksum/幂等 pin/V1–V4/manifest/verify-runner 全 PASS）。
- live `main` = `9e47721eb30355ffe23cea12592445e8f0575c6a`（归档提交已 push，CI `34961151910` 7/7 SUCCESS）；自 `b0f5df3` 起 `scripts/ci/*` 三脚本 byte-identical。
- devbox host-admin 通道已严格验证（双路径 host-key 一致 + BatchMode + `sudo -n`）。
- guest 通道实测：devbox 跳板 SSH `ubuntu@<guest>`（libvirt NAT 地址）BatchMode PASS；guest `sudo -n` PASS；`actions-runner-vbmf@vbmf-ci-02.service` active；`/usr/local/bin/rustc` MISSING（pin 前基线）。
- guest qemu-guest-agent 的 `virsh qemu-agent-exec` 不可用（virsh 版本无此命令），host-key 验证须另选路径。

## §1 bundle 制备（Development VM）

`prepare-system-rust-bundle.sh --repo <VBMF> --sha <coordinator 确认 full 40-hex SHA> --out <mktemp 安全空目录>`；导出三脚本 + deterministic `SHA256SUMS`，打印 `BUNDLE_SOURCE_SHA`，全文记为 evidence。

## §2 guest 执行（经 devbox 跳板，只用 bundle）

按 §15.9 步骤 B 对 `vbmf-ci-02`：

1. `sha256sum -c SHA256SUMS` 全 PASS，任一 mismatch 立即停止。
2. 首次 pin：`sudo "$PIN_DIR/pin-system-rust.sh" --version 1.98.1`，期望尾行 `PINNED_RUST_VERSION=1.98.1`；随后原样重跑一次，0 退出且版本不变（幂等证明；guest 需可联网取 toolchain，必要时 proxy 只按命令经 `sudo env VBMF_CI_PROXY=...` 传入）。
3. 正式验证：非 root、零 mutation `"$PIN_DIR/verify-system-rust.sh" --expect-version 1.98.1`，V1–V4 全 PASS（`RESULT: PASS`），V2 证明 `rustup default=1.98.1-<target>`、无 rolling stable，V2/V3/V4 显式 `/usr/local` env 语义。
4. manifest：`sudo -u vbmf-ci env RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo bash "$PIN_DIR/collect-toolchain.sh" --name vbmf-ci-02`，写入 `/data/actions-runners/vbmf/manifests/vbmf-ci-02/{toolchain.yaml,toolchain.txt}`，不含 secrets。
5. 清理：只删本次传输的 bundle 临时目录。

## §3 管理机只读收口

`scripts/ci/verify-runner.sh --name vbmf-ci-02`：R1–R5 + scope，期望 `RESULT: PASS`；labels exact `{self-hosted,Linux,X64,vbmf,vbmf-general}`。

## §4 evidence 与 STATE 闭环

- evidence：`BUNDLE_SOURCE_SHA`、`SHA256SUMS` 全文、guest 各步输出摘要、manifest 摘要、`verify-runner.sh` PASS。
- STATE：§3 增 P2-C2 条目；§5.1 置 P2-C2 COMPLETE、P2-C3 READY；§7/§8/§9 对应更新。不写 guest 地址/指纹/凭据。

## 红线（不变量）

- guest 零 git；verifier 零 mutation；`vbmf-ci` 零新增 sudo；零 runs-on 变更；public repo 零敏感信息；单分支 `main` 零新建分支/worktree；与 host1 exact 对称（1.98.1、`/usr/local` 路径、byte-identical 脚本）。
