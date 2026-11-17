# ci-rust-format-grayscale spec

## 背景与 Authority

- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.2（灰度阶梯：P2-C = rust-format
  单 job 最便宜最先）、§15.6（P2-B 冻结边界）、§15.7/15.8/15.9（system Rust pin
  契约与执行平面）。
- `.project/STATE.md` §3.6/§3.7/§3.8（双机 exact Rust 1.98.1 pin + parity
  re-probe 全部 COMPLETE）；§3.6 RCA（self-hosted job 必须显式
  `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo` +
  `unset RUSTUP_TOOLCHAIN`）。
- §15.7/§15.8 末条前置（双机 parity 证据齐备）已满足，允许迁移。

## 目标 workflow 结构（`media-agent.yml` 仅 `rust-format` job）

```yaml
rust-format:
  name: rust-format
  runs-on: ${{ (github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork) && fromJSON('["self-hosted","Linux","X64","vbmf","vbmf-general"]') || 'ubuntu-latest' }}
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v5
    - uses: dtolnay/rust-toolchain@stable
      if: runner.environment == 'github-hosted'
      with:
        toolchain: 1.98.1        # D3：待用户确认；若否决则删除此行回 rolling stable
        components: rustfmt
    - name: Format check (required)
      run: |
        if [ "$RUNNER_ENV" = "self-hosted" ]; then
          export RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo
          unset RUSTUP_TOOLCHAIN
        fi
        cargo fmt --all -- --check
      env:
        RUNNER_ENV: ${{ runner.environment }}
```

## 行为矩阵

| 触发 | event | runs-on 解析 | toolchain 来源 |
|---|---|---|---|
| trusted push `main` | `push` | `self-hosted,Linux,X64,vbmf,vbmf-general` | 系统 pin 1.98.1（零 install） |
| same-repo PR | `pull_request`（head.repo.fork=false） | 同上 | 同上 |
| fork PR | `pull_request`（head.repo.fork=true） | `ubuntu-latest` | dtolnay 安装（D3 决定版本） |

- push 事件中 `github.event.pull_request` 为空对象，`!github.event.pull_request.head.repo.fork`
  为 true → trusted 分支；表达式语义等价于三元选择。
- GitHub 表达式 `&& ... || ...`：trusted 命中返回 label 数组；fork 命中返回
  `ubuntu-latest`。
- `runner.environment` 是 GitHub 官方 context（`github-hosted` / `self-hosted`），
  用于步骤分流，不参与调度选择。

## 不变量（Verifier 核对项）

1. 其余 6 个 job（rust-test-matrix / rust-clippy / session-lifecycle /
   hardware-test-compile / architecture-portability / gstreamer-build）
   diff 后 byte-identical。
2. job id 与 `name:` 仍为 `rust-format`；required context 集合不变。
3. 无 `pull_request_target`；workflow 顶层 `permissions: contents: read` 不变。
4. concurrency 组与 `timeout-minutes: 10` 不变。
5. self-hosted 路径零 install 步骤；format check 显式系统 pin env + unset
   `RUSTUP_TOOLCHAIN`（STATE §3.6 RCA）。
6. `defaults.run.working-directory: services/media-agent` 不变（cargo fmt 在
   `services/media-agent` 内执行，与现状一致）。

## Evidence 要求

- push 后 Actions run：7/7 required checks PASS。
- `gh api /repos/pwl1987/VBMF/actions/runs/<run>/jobs`：`rust-format` job
  `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}，`labels` 命中 vbmf-general 池。
- job log 含 `cargo fmt --all -- --check` 在系统 toolchain 下 PASS。
- STATE.md §3.9/§5.1 更新：P2-C4 COMPLETE、P2-C 收口、P2-D READY、run id 与
  runner identity evidence。
