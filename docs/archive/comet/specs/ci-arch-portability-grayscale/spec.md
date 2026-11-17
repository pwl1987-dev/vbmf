# ci-arch-portability-grayscale spec

## Authority

- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.2（阶梯 P2-E）、§15.6（冻结边界）；
- `.project/STATE.md` §3.9/§3.10/§3.11（条件 runs-on 模式、env 契约、持久缓存
  目录设计）、§3.6 RCA（显式 Rust env 调用契约）、risk 8（出网观察口径 + 窗 #6
  补记义务）；
- 脚本实测（2026-09-16）：`check_arch_portability.py` 纯 python3 词法扫描；
  `check_remove_adapters.py` 经 `subprocess.run([cargo, "check",
  --no-default-features, --features, …])` 在 tmp crate 副本内执行（继承 step
  env；`--cargo` 默认 `cargo`）。

## job 迁移（media-agent.yml 仅 architecture-portability job）

```yaml
architecture-portability:
  name: architecture-portability
  # P2-E2: conditional runner (same boundary as P2-C4/P2-D/P2-E1).
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
        key: ${{ runner.os }}-cargo-arch-${{ hashFiles('services/media-agent/Cargo.toml') }}
    - name: Architecture Lint (ARCH-PORTABILITY-01 lexical)
      run: python3 ${{ github.workspace }}/scripts/check_arch_portability.py
    - name: Architecture Proof (remove-adapter compile, P0-5)
      env:
        RUNNER_ENV: ${{ runner.environment }}
      run: |
        if [ "$RUNNER_ENV" = "self-hosted" ]; then
          export RUSTUP_HOME=/usr/local/rustup
          export CARGO_HOME="${GITHUB_WORKSPACE%/*}/.cargo-home"
          export CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-arch"
          unset RUSTUP_TOOLCHAIN
          mkdir -p "$CARGO_HOME" "$CARGO_TARGET_DIR"
        fi
        python3 ${{ github.workspace }}/scripts/check_remove_adapters.py
```

要点：

- 条件 `runs-on` 表达式与 P2-C4/P2-D/P2-E1 逐字一致（brief D1）。
- GitHub-hosted（fork）路径：dtolnay 与 `actions/cache` 保持现状语义，仅加
  `if: runner.environment == 'github-hosted'`；不加 pin 参数（brief D2）。
- Lint 步骤：零改动（不加 env 分流——纯 python3 无 cargo；brief D4）。
- Proof 步骤：self-hosted 分支显式 `RUSTUP_HOME=/usr/local/rustup` + 共享
  `.cargo-home` + 独立 `target-arch` + `unset RUSTUP_TOOLCHAIN`（§3.6 RCA；
  brief D3/D4）；python 命令本身逐字不变；脚本内部 subprocess 继承 env，tmp
  crate 副本的 cargo check 依赖编译进共享 `target-arch`，跨 run 复用。
- 脚本文件本身零改动（门禁语义不变）。

## STATE 更新（Build 阶段一次性完成）

1. risk 8 补记窗 #6（2026-09-15 23:26–23:33 UTC，双机 ci-01×2+ci-02×1，3 次
   job 失败，run `35035748405` 1 次 rerun 收口；当日累计 6 窗）；
2. §3.12 P2-E2 COMPLETE（run id、runner identity、观察数据）；
3. §5.1 P2-E3 READY；§2/§4/§5/§10 联动更新。

## 验证

1. 本地结构断言（对 `9fe1045` 基线 + origin/main diff）：仅
   `architecture-portability` job 变化；`on:` 键 = {push, pull_request}；job
   id/name 不变；YAML 有效。
2. push `main` → CI 7/7 required 全绿（故障窗 rerun 收口可接受，计数）。
3. job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；log 显示 Lint（宿主
   python3）与 Proof（env 契约 + `remove-adapters` cargo check 两条 feature
   PASS）证据。
4. STATE 闭环核对（窗 #6 + §3.12 + P2-E3 READY）。
