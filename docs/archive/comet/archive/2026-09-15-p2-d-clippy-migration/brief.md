# 目标

P2-D：`rust-clippy` 单 job self-hosted grayscale。因 clippy 组件不在现行 system pin 内
（host1 实测 `cargo clippy` → `error: 'cargo-clippy' is not installed`；pin 脚本只装
rustfmt），本 change 分两阶段：

- **阶段 1（host-admin 组件收口）**：扩展 `pin-system-rust.sh`（`--component clippy` +
  `cargo-clippy`/`clippy-driver` 暴露）、`verify-system-rust.sh`（新增 clippy gate）、
  `collect-toolchain.sh`（manifest 增 clippy）、`test-system-rust-scripts.sh` 对应测试；
  经 §15.9 out-of-band 通道在 **两台** 宿主机幂等补装并双机 verify + manifest。
- **阶段 2（workflow 迁移）**：`rust-clippy` job 按 P2-C4 已确立模式迁条件 `runs-on`
  （trusted → `vbmf-general`；fork → `ubuntu-latest`）。

# 范围

- `scripts/ci/pin-system-rust.sh`、`scripts/ci/verify-system-rust.sh`、
  `scripts/ci/collect-toolchain.sh`、`scripts/ci/test-system-rust-scripts.sh`；
- `.github/workflows/media-agent.yml` 仅 `rust-clippy` job；
- `.project/STATE.md`（P2-D0 前置记录、P2-D 闭环、P2-E1 解锁）；
- 本 change 的 Comet 正式产物。

# 非目标

- 其余 6 个 required job 任何改动；
- `ci-infra-probe.yml`（tool 列表不加 clippy——verify 脚本 + manifest 已覆盖证据）；
- runner 标签 / 安全模型（§15.6 冻结）变更；
- P2-E1（session-lifecycle）提前实施；
- 给 `vbmf-ci` 任何新 sudo/root（红线不变）。

# 验收示例

- Scenario: 阶段 1 脚本扩展合入 `main` 且 focused tests（shellcheck +
  `test-system-rust-scripts.sh`）全 PASS，CI 全绿。
- Scenario: 两台宿主机经 out-of-band 通道以新 bundle 幂等补装 clippy 组件：
  `sha256sum -c SHA256SUMS` OK；pin 复跑 exit 0；扩展版 verify 全 gate PASS
  （含 clippy 版本 = `clippy 1.98.1 (…)`）；双机 manifest 含 clippy 行且
  rustc/cargo/clippy 版本逐字符一致。
- Scenario: `rust-clippy` job 迁条件 `runs-on` 后 push `main`：CI 7/7 required
  全绿；`rust-clippy` job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；job log 显示
  self-hosted 分支零 install、显式 `RUSTUP_HOME=/usr/local/rustup` + 可写
  `CARGO_HOME`/`CARGO_TARGET_DIR` + `unset RUSTUP_TOOLCHAIN`，两次 clippy
  （default + mock）`-D warnings` PASS。
- Scenario: workflow diff 审计——仅 `rust-clippy` job 变化，其余 6 job
  byte-identical；job id/name 仍 `rust-clippy`；无 `pull_request_target`；fork 路径
  结构保持（表达式与 P2-C4 相同语义，toolchain 步骤仅 github-hosted 执行且 pin
  `1.98.1`）。
- Scenario: `.project/STATE.md` 更新：P2-D COMPLETE（run id、runner identity、双机
  clippy evidence、bundle SHA）、P2-E1 变 READY。

# 约束与不变量

- §15.6 冻结边界全部不变：fork 双通道、concurrency、`timeout-minutes: 20`（不调，
  见 D5）、`permissions: contents: read`、7 required context 名称。
- §15.9 红线：宿主机零 git；bundle 从 coordinator 确认的 exact full SHA 制备；
  verify 零 mutation；`vbmf-ci` 零新 sudo；scp 中转后 `chmod 755`（§3.7 RCA）；
  `vbmf-ci` 身份调用 rust 工具显式 `RUSTUP_HOME=/usr/local/rustup
  CARGO_HOME=/usr/local/cargo`（§3.6 RCA）。
- self-hosted clippy 路径零 install（不在 job 内 rustup add component）。
- 本 repo public：内网地址/fingerprint/凭据不入 repo/logs/evidence。

# 决策

- D1（coordinator）：阶段拆分——组件收口（host-admin）与 workflow 迁移同一 change
  内两阶段执行，验收分项覆盖（沿用 P2-C1/C2 的 host 工作入 change 先例）。
- D2（coordinator）：clippy 组件经 pin 脚本扩展（`--component clippy`）+ 幂等复跑
  补装，不做 host 上 ad-hoc `rustup component add`（保持 runbook 可审计与可重复）。
- D3（coordinator）：self-hosted clippy 的可写缓存设计——`CARGO_HOME` 与
  `CARGO_TARGET_DIR` 指向 checkout 工作区**外**的持久目录
  （`${GITHUB_WORKSPACE%/*}/.cargo-home` 与 `/target-clippy`），绕开
  `/usr/local/cargo` root-only 与 checkout clean 对 untracked 的清除；self-hosted
  路径不用 `actions/cache`（持久目录天然跨 run 复用，避免每次经不稳出网传 cache）；
  GitHub-hosted（fork）路径保持 `actions/cache` 现状。
- D4（coordinator，沿用 P2-C4 已确认原则）：fork 路径 dtolnay toolchain pin
  exact `1.98.1`（components: clippy）。
- D5（coordinator）：`timeout-minutes: 20` 不调——§15.6 冻结值；首次冷编译 +
  crate 下载经不稳出网存在超时风险，接受 rerun；持久目录使后续 run 显著加速。
- D6（coordinator）：`rust-clippy` 两条 clippy 命令（default + mock）共享同一
  self-hosted env 分流步骤结构，与 P2-C4 的 `RUNNER_ENV` 模式一致。
- D7（用户授权 2026-09-15）：阶段 1 允许经既有 out-of-band host-admin 通道在两台
  宿主机以 root 执行幂等 pin 复跑补装 clippy；`vbmf-ci` 零新 sudo；宿主机零 git。

# 待解决问题

（无——Q1 已授权，见 Decisions D7。）

# 验证预期

- 阶段 1 本地：shellcheck + `test-system-rust-scripts.sh` 全 PASS；push 后 CI 全绿。
- 双机 host evidence：bundle checksum、pin 幂等、verify 全 gate（含 clippy）、
  manifest 双证、`verify-runner.sh` R1–R5。
- 阶段 2：push `main` CI 7/7；`rust-clippy` job runner identity + log 内 env 契约；
  独立 Verifier 全项核对；STATE 闭环。
