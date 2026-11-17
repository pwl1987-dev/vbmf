# ci-test-matrix-grayscale spec

## 阶段 1 —— rustdoc 暴收录口（四脚本 + 双机 host-admin）

### pin-system-rust.sh

- `toolchain install` 增加 `--component rust-docs`（幂等；双机已有二进制，
  本轮预期零下载）；
- symlink 循环与工具存在性检查加入 `rustdoc`（`/usr/local/bin/rustdoc` ->
  `/usr/local/cargo/bin/rustdoc` proxy）。

### verify-system-rust.sh

- V1 循环加入 `rustdoc`；
- 新 V6：以 audited `RUSTUP_HOME/CARGO_HOME` 调 `$BIN_DIR/rustdoc --version`，
  断言输出以 `rustdoc ` 开头即可（版本方案独立于 rustc，presence+执行，
  同 V4 rustfmt 口径）；零 mutation 不变。

### collect-toolchain.sh

- `TOOLS` 追加 `rustdoc`。

### test-system-rust-scripts.sh

- fixture 增加 rustdoc shim；正/负 case：rustdoc 缺失 verify FAIL、pin 脚本
  含 `--component rust-docs` 与 rustdoc 暴露断言、drift case 不回归。

### Host 执行（双机，§15.9，用户已授权 D8）

同 P2-D 流程：exact SHA bundle → checksum → root 幂等 pin 复跑 → V1–V6 verify
→ `vbmf-ci` manifest 刷新（显式系统 env）→ `verify-runner.sh` R1–R5。

## 阶段 2 —— workflow 迁移（media-agent.yml 仅 rust-test-matrix job）

## Authority

- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.2（阶梯 P2-E 收口）、§15.6；
- `.project/STATE.md` §3.9–§3.12（条件 runs-on 模式、env 契约、持久目录设计）、
  §3.6 RCA、risk 8（观察口径 + 2026-09-16 窗补记义务）。

## job 迁移（media-agent.yml 仅 rust-test-matrix job）

```yaml
rust-test-matrix:
  name: rust-test-matrix
  # P2-E3: conditional runner (same boundary as P2-C4/P2-D/P2-E1/P2-E2) —
  # last required job on the general pool.
  runs-on: ${{ (github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork) && fromJSON('["self-hosted","Linux","X64","vbmf","vbmf-general"]') || 'ubuntu-latest' }}
  timeout-minutes: 30
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
        key: ${{ runner.os }}-cargo-test-${{ hashFiles('services/media-agent/Cargo.toml') }}
      # Self-hosted env prep: one step writes the §3.6 RCA contract into
      # GITHUB_ENV so all subsequent cargo steps inherit it (brief D4).
    - name: Rust env (self-hosted)
      if: runner.environment == 'self-hosted'
      run: |
        if [ -n "${RUSTUP_TOOLCHAIN:-}" ]; then
          echo "caller RUSTUP_TOOLCHAIN present; refusing" >&2; exit 1
        fi
        ws_parent="$(dirname "$GITHUB_WORKSPACE")"
        mkdir -p "$ws_parent/.cargo-home" "$ws_parent/target-testmatrix"
        echo "RUSTUP_HOME=/usr/local/rustup" >> "$GITHUB_ENV"
        echo "CARGO_HOME=$ws_parent/.cargo-home" >> "$GITHUB_ENV"
        echo "CARGO_TARGET_DIR=$ws_parent/target-testmatrix" >> "$GITHUB_ENV"
    - name: Build (default)
      env:
        CARGO_TERM_COLOR: always
      run: cargo build
    - name: ARCH-PORTABILITY-01 compile gate — simulation (no vendor adapters)
      run: cargo build --no-default-features --features simulation
    - name: ARCH-PORTABILITY-01 compile gate — mock (no vendor adapters)
      run: cargo build --no-default-features --features mock
    - name: Test (default features)
      run: cargo test
    - name: Test (simulation feature)
      run: cargo test --features simulation
    - name: Test (mock feature) — p06-hi gates (ARCH-BACKEND-01 Mock side + gate assertions)
      run: cargo test --features mock
    - name: Upload media-agent Linux binary (default)
      uses: actions/upload-artifact@v4
      with:
        name: media-agent-linux-default
        path: ${{ runner.environment == 'self-hosted' && format('{0}/../target-testmatrix/debug/media-agent', github.workspace) || 'services/media-agent/target/debug/media-agent' }}
```

要点：

- 6 条 cargo 命令逐字不变（无 env 字段新增——env 经 `GITHUB_ENV` 继承）。
- prep 步骤仅 self-hosted 执行；`RUSTUP_TOOLCHAIN` fail-closed（存在即失败，
  替代内联 `unset`——GITHUB_ENV 无法 unset，改为拒绝启动）。
- `mkdir` 显式建目录（首次运行冷启动）。
- upload `path:` 条件表达式（brief D5）；`github.workspace/../` 父目录 runner
  用户可写（P2-D 已实证 `.cargo-home`/`target-clippy` 同模式）。
- GitHub-hosted（fork）路径：dtolnay + cache 保持现状语义；cargo 步骤零变化。

## STATE 更新（Build 阶段一次性完成）

1. risk 8 补记 2026-09-16 窗（07:04–07:05 UTC，ci-01，run `35066419711`
   checkout fetch TLS，1 rerun 收口）；
2. §3.13 P2-E3 COMPLETE（run id、runner identity、观察数据）+ **P2-E 整体收口**
   （5 个 general-pool required job 全部灰度完成）；
3. §5.1 P2-M0 READY；§2/§4/§5/§8/§9/§10 联动更新。

## 验证

1. 本地结构断言（对 `53a01b8`）：仅 `rust-test-matrix` job 变化；6 条 cargo
   命令逐字不变；`on:` 键 = {push, pull_request}；job id/name 不变；YAML 有效。
2. push `main` → CI 7/7 required 全绿（故障窗 rerun 收口可接受，计数）。
3. job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；log 显示 prep 步骤 env 写入、
   6 条 cargo 命令 PASS、upload-artifact 成功（self-hosted 分支路径）。
4. STATE 闭环核对（窗补记 + §3.13 + P2-M0 READY）。
