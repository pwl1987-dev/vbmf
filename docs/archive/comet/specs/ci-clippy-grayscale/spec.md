# ci-clippy-grayscale spec

## Authority

- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.2（阶梯 P2-D）、§15.6（冻结边界）、
  §15.7/15.9（pin 契约与 out-of-band 执行平面）；
- `.project/STATE.md` §3.6/§3.7（RCA：显式 RUSTUP_HOME/CARGO_HOME；scp 后 chmod 755）、
  §3.9（P2-C4 条件 runs-on 模式，commit `41400e1…`）；
- 现状缺口实测（2026-09-15）：host1 `sudo -u vbmf-ci env RUSTUP_HOME=/usr/local/rustup
  CARGO_HOME=/usr/local/cargo cargo clippy --version` →
  `error: 'cargo-clippy' is not installed for the toolchain '1.98.1-…'`。

## 阶段 1 —— 脚本扩展（三脚本 + 测试）

### pin-system-rust.sh

- `toolchain install "$VERSION" --profile minimal --component rustfmt --component clippy`
- 工具存在性检查与 `/usr/local/bin` symlink 循环加入 `cargo-clippy` 与 `clippy-driver`
  （`cargo clippy` 子命令经 rustup proxy 解析需要两者在 toolchain bin + proxy 可见）。
- 其余 fail-closed 语义不变；幂等复跑在已装 rustfmt 的双机上预期只新增 clippy 组件。

### verify-system-rust.sh

- 新增 clippy gate（编号顺延）：以显式 `RUSTUP_HOME=/usr/local/rustup
  CARGO_HOME=/usr/local/cargo` 调 `/usr/local/bin/cargo clippy --version`，断言输出
  `clippy 1.98.1 (…)` 前缀；零 mutation 不变。

### collect-toolchain.sh

- `TOOLS` 追加 `cargo-clippy`（以 `cargo-clippy --version` 采集）；
  manifest 结构/路径不变。

### test-system-rust-scripts.sh

- 对应扩展：clippy 组件参数、cargo-clippy/clippy-driver 暴露断言、verify clippy
  gate 的正/负 case；既有 41 项全部保持 PASS。

### Host 执行（两台，§15.9 out-of-band）

1. coordinator 确认新 exact SHA → `prepare-system-rust-bundle.sh` → checksum；
2. host1 直连 / host2 经 devbox 跳板：`chmod 755` → `sha256sum -c` → root 幂等
   pin 复跑（`--version 1.98.1`）→ 扩展 verify 全 gate → `vbmf-ci` 身份刷新
   manifest（显式系统 env）；
3. 管理机只读收口：`verify-runner.sh --name vbmf-ci-01/02` R1–R5 + scope PASS。

## 阶段 2 —— workflow 迁移（media-agent.yml 仅 rust-clippy job）

```yaml
rust-clippy:
  name: rust-clippy
  runs-on: ${{ (github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork) && fromJSON('["self-hosted","Linux","X64","vbmf","vbmf-general"]') || 'ubuntu-latest' }}
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v5
    - uses: dtolnay/rust-toolchain@stable
      if: runner.environment == 'github-hosted'
      with:
        toolchain: 1.98.1
        components: clippy
    - name: Cache cargo
      if: runner.environment == 'github-hosted'
      uses: actions/cache@v5
      with: {…现状不变…}
    - name: Clippy (default, -D warnings)
      env:
        RUNNER_ENV: ${{ runner.environment }}
      run: |
        if [ "$RUNNER_ENV" = "self-hosted" ]; then
          export RUSTUP_HOME=/usr/local/rustup
          export CARGO_HOME="${GITHUB_WORKSPACE%/*}/.cargo-home"
          export CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-clippy"
          unset RUSTUP_TOOLCHAIN
          mkdir -p "$CARGO_HOME" "$CARGO_TARGET_DIR"
        fi
        cargo clippy --all-targets -- -D warnings
    - name: Clippy (mock, -D warnings)
      # 同上 env 结构，--features mock
```

### 关键语义

- `CARGO_HOME`/`CARGO_TARGET_DIR` 放 `${GITHUB_WORKSPACE%/*}/`（runner 持久
  `_work/<repo>/` 目录）：不被 checkout 的 clean 清除、跨 run 复用；绕开
  root-only `/usr/local/cargo`。
- self-hosted 路径禁 `actions/cache`（持久目录替代；避免经不稳出网传 cache）。
- fork（GitHub-hosted）路径行为 = 现状 + toolchain pin `1.98.1`（D4）。
- 双 clippy 命令各自独立 step（现状结构），共享同一 env 分流模式。

## 不变量（Verifier 核对）

1. 其余 6 job byte-identical；7 required context 名称不变。
2. 无 `pull_request_target`；permissions/concurrency/timeout(20m) 不变。
3. self-hosted 零 install；显式系统 Rust env 契约（§3.6 RCA）。
4. 双机 clippy 版本 = 1.98.1 且 manifest 双证一致。
5. `vbmf-ci` 零新 sudo；宿主机零 git；verify 零 mutation。

## Evidence 要求

- 阶段 1：CI run id（脚本扩展 commit）；双机 bundle checksum + pin 幂等 + verify
  gate + manifest 时间戳 + `verify-runner.sh` PASS。
- 阶段 2：push 后 CI run id 7/7；`rust-clippy` job `runner_name`；log 内
  `RUNNER_ENV: self-hosted`、导出 env、两次 clippy PASS。
- STATE.md：P2-D COMPLETE、P2-E1 READY、全部 evidence 登记。
