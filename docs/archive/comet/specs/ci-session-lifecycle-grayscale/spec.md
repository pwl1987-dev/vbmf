# ci-session-lifecycle-grayscale spec

## Authority

- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.2（阶梯 P2-E）、§15.6（冻结边界）；
- `.project/STATE.md` §3.9（P2-C4 条件 runs-on 模式，commit `41400e1…`）、
  §3.10（P2-D self-hosted 持久缓存目录设计 + 出网故障窗记录，commit `eca00b7…`）、
  §3.6 RCA（显式 Rust env 调用契约）、risk 8（出网抖动观察口径）。

## job 迁移（media-agent.yml 仅 session-lifecycle job）

```yaml
session-lifecycle:
  name: session-lifecycle
  runs-on: ${{ (github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork) && fromJSON('["self-hosted","Linux","X64","vbmf","vbmf-general"]') || 'ubuntu-latest' }}
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v5
    - uses: dtolnay/rust-toolchain@stable
      if: runner.environment == 'github-hosted'
    - name: Cache cargo
      if: runner.environment == 'github-hosted'
      uses: actions/cache@v5
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          services/media-agent/target
        key: ${{ runner.os }}-cargo-session-${{ hashFiles('services/media-agent/Cargo.toml') }}
    - name: Test (mock) — session + resource + lease + preflight gate tests
      env:
        RUNNER_ENV: ${{ runner.environment }}
      run: |
        if [ "$RUNNER_ENV" = "self-hosted" ]; then
          export RUSTUP_HOME=/usr/local/rustup
          export CARGO_HOME="${GITHUB_WORKSPACE%/*}/.cargo-home"
          export CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-session"
          unset RUSTUP_TOOLCHAIN
          mkdir -p "$CARGO_HOME" "$CARGO_TARGET_DIR"
        fi
        cargo test --features mock session::
        cargo test --features mock resource::
        cargo test --features mock lease::
        cargo test --features mock preflight::
```

要点：

- 条件 `runs-on` 表达式与 P2-C4/P2-D 逐字一致（brief D1）。
- GitHub-hosted（fork）路径：dtolnay 步骤与 `actions/cache` 保持现状语义，仅加
  `if: runner.environment == 'github-hosted'` 分流（cache 步骤现状无条件执行，
  self-hosted 侧由持久目录替代——P2-D 同例）；不加 toolchain pin 参数（brief D2）。
- self-hosted 路径：零 install；`RUSTUP_HOME` 显式指向系统 pin；可写
  `CARGO_HOME` 共享 `.cargo-home`（registry 复用）；`CARGO_TARGET_DIR` 独立
  `target-session`（与 clippy 构建参数不同，隔离防缓存互踩；brief D3）；
  `unset RUSTUP_TOOLCHAIN`（§3.6 RCA）。
- 四条 `cargo test --features mock` 命令逐字不变（测试集语义零变化）。

## 稳定性观察窗（只记录不缓解）

- 覆盖范围：本 packet 验证期内全部 media-agent CI 运行（implementation push、
  任何 rerun、最终 HEAD 收口 run）。
- 每次出网故障窗登记四元组：时间窗（UTC）、命中 runner、失败步骤（预期为
  checkout `git fetch` TLS 错误）、收口方式（rerun）。
- 无故障则明确登记 "0 故障窗"。
- 数据写入 STATE risk 8；缓解方案裁决（job 级 git 代理 vs probe workflow-env
  红线）不在本 change。

## 验证

1. 本地结构断言（diff 对 origin/main）：
   - 仅 `session-lifecycle` job hunk；其余 6 job byte-identical；
   - `on:` 触发键 = {push, pull_request}（无 `pull_request_target`）；
   - job id/name = `session-lifecycle`；required context 名不变；
   - YAML 解析有效。
2. push `main` → CI 7/7 required 全绿（故障窗 rerun 收口可接受，计数）。
3. `session-lifecycle` job：`runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；log 显示
   self-hosted env 契约 + 四条 mock 门禁测试 PASS。
4. STATE 更新：§3.11 P2-E1 COMPLETE（run id、runner identity、观察数据）、
   §5.1 P2-E2 READY、risk 8 数据刷新。
