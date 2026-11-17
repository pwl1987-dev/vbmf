# ci-runner-parity-reprobe — 完整目标规格

Capability：双 `vbmf-general` runner 的 read-only Rust toolchain parity re-probe 与 probe 工具 env 修正。Authority：STATE §5.1 P2-C3、§3.6 RCA、CI_RUNNER_STRATEGY §15.7/§15.9。

## 前提（已成立）

- P2-C1/P2-C2 COMPLETE：两机 `/usr/local` exact 1.98.1 pin + manifest 已刷新（§3.6/§3.7）。
- 事实：`ci-infra-probe.yml` capability step 以 plain `"$t" --version` 探测；`vbmf-ci` 身份下 rustup proxy 无 `RUSTUP_HOME` 时因 `$HOME/.rustup` 不可写而失败（§3.6 RCA），probe 会得到报错而非 1.98.1。

## §1 probe env 修正

capability step 增加显式 `RUSTUP_HOME=/usr/local/rustup`、`CARGO_HOME=/usr/local/cargo`，并 unset 调用方 `RUSTUP_TOOLCHAIN` —— 与 `verify-system-rust.sh` V2/V3/V4 的调用契约同语义；只动该 step，不触碰只读红线与其余结构。

## §2 dispatch 纪律

push `main` 后 workflow_dispatch（tier=`vbmf-general`）重复执行，直到两台 runner.name 各命中 ≥1 次；记录每次 run ID 与命中身份；不并发 matrix。

## §3 parity 判据

每份命中报告：`rustc: /usr/local/bin/rustc (rustc 1.98.1 …)`、`cargo: /usr/local/bin/cargo (cargo 1.98.1 …)`；无 MISSING / rustup 错误；labels exact `{self-hosted,Linux,X64,vbmf,vbmf-general}`。

## §4 evidence 与 STATE 闭环

登记 probe run IDs、两机命中与对照行；引用 §3.6/§3.7 manifest（不重跑）；STATE 置 P2-C3 COMPLETE、P2-C4 READY。

## 红线

probe 保持零 install / 零 mutation / 零 secrets / 零 sudo / workflow_dispatch-only / 单 job；单分支 `main`。
