# 目标

P2-E1：`session-lifecycle` 单 job self-hosted grayscale（P2-E 首项），并承担
**双 runner 出网稳定性观察窗口**（STATE §3.10 / risk 8）：

- **job 迁移**：`session-lifecycle`（`cargo test --features mock` 四模块门禁）按
  P2-C4/P2-D 已确立模式迁条件 `runs-on`（trusted push/same-repo PR →
  `vbmf-general` 池；fork PR → `ubuntu-latest`）。self-hosted 零 install，显式
  `RUSTUP_HOME=/usr/local/rustup` + checkout 外可写 `CARGO_HOME`/`CARGO_TARGET_DIR`
  + `unset RUSTUP_TOOLCHAIN`（§3.6 RCA）。
- **稳定性观察**：本 packet 验证期内（implementation push + 必要 rerun）计数出网
  故障窗（checkout fetch 失败窗口、命中 runner、rerun 收口结果），登记入 STATE
  risk 8；不引入缓解变更（job 级 git 代理与 probe workflow-env 红线冲突仍为
  未裁决项，留待数据充分后单独 change）。

# 范围

- `.github/workflows/media-agent.yml` 仅 `session-lifecycle` job；
- `.project/STATE.md`（P2-E1 闭环 + 观察窗数据 + P2-E2 解锁）；
- 本 change 的 Comet 正式产物。

# 非目标

- 其余 6 个 required job 任何改动；
- `ci-infra-probe.yml` 任何改动；
- 出网缓解方案实施（代理注入/重试策略变更——未裁决，非本 change）；
- runner 标签 / 安全模型（§15.6 冻结）变更；
- 测试集本身增删（job 命令语义不变）；
- 给 `vbmf-ci` 任何新 sudo/root。

# 验收示例

- Scenario: `session-lifecycle` job 迁条件 `runs-on` 后 push `main`：CI 7/7
  required 全绿；`session-lifecycle` job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；
  job log 显示 self-hosted 分支零 install、显式 Rust env 契约、四条
  `cargo test --features mock`（session/resource/lease/preflight）全 PASS。
- Scenario: workflow diff 审计——仅 `session-lifecycle` job 变化，其余 6 job
  byte-identical；job id/name 仍 `session-lifecycle`；无 `pull_request_target`；
  fork 路径保持 dtolnay 现状（本 job 原本无 toolchain pin 参数——GitHub-hosted
  路径不改 dtolnay 步骤语义，见 D2）；`timeout-minutes: 20`、concurrency、
  `permissions` 不变。
- Scenario: 稳定性观察登记——验证期内每次出网故障窗记录（时间窗、命中 runner、
  失败步骤、rerun 收口）；无故障窗则明确记 "0 故障窗"；数据入 STATE risk 8。
- Scenario: `.project/STATE.md` 更新：P2-E1 COMPLETE（run id、runner identity、
  观察数据）、P2-E2 变 READY。

# 约束与不变量

- §15.6 冻结边界全部不变：fork 双通道、concurrency、`timeout-minutes: 20`、
  `permissions: contents: read`、7 required context 名称。
- §3.6 RCA 调用契约：self-hosted 分支显式 `RUSTUP_HOME=/usr/local/rustup`、
  `unset RUSTUP_TOOLCHAIN`；`CARGO_HOME` 不用 root-only `/usr/local/cargo`。
- self-hosted 路径零 install。
- 本 repo public：内网地址/fingerprint/凭据不入 repo/logs/evidence。
- 观察窗只记录不缓解；rerun 收口可接受（STATE blocker 口径）。

# 决策

- D1（coordinator，沿用 P2-C4/P2-D）：条件 `runs-on` 表达式与 step 分流
  （`runner.environment == 'github-hosted'`）逐字沿用已确立模式，不再新设计。
- D2（coordinator）：GitHub-hosted（fork）路径保持现状 `dtolnay/rust-toolchain@stable`
  无参数——本 job 原本未 pin 参数，测试断言语义不依赖 exact rustc 补丁版本；
  不在 P2-E1 顺手加 pin（避免无关语义变化；若要统一 pin 留独立裁决）。
- D3（coordinator）：self-hosted 持久目录沿用 P2-D 设计但**独立命名**——
  `CARGO_HOME="${GITHUB_WORKSPACE%/*}/.cargo-home"`（与 clippy 共享，registry
  缓存天然复用）+ `CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-session"`
  （独立于 `target-clippy`：clippy 与 test 构建参数不同，混用同一 target 目录
  会互相失效缓存反复重编；单 runner 串行执行 job，无并发写冲突）。
- D4（coordinator）：稳定性观察窗 = 本 packet 验证期（push + rerun + 最终 HEAD
  CI），不设人为长时间窗——后续 P2-E2/E3 push 继续自然累计数据，每次 packet
  闭环时更新 risk 8。
- D5（coordinator）：GitHub-hosted 路径保留 `actions/cache` 现状（P2-C4/P2-D
  同例——只动 self-hosted 侧）。

# 待解决问题

（无——全部决策已按既有模式收敛，等待用户确认 Shape。）

# 验证预期

- 本地结构断言：仅 `session-lifecycle` job diff、其余 6 job byte-identical、
  YAML 语法、`on:` 触发键不含 `pull_request_target`。
- push `main` 后 CI 7/7 required 全绿（必要时出网故障窗 rerun 收口并计数）；
  `session-lifecycle` job runner identity + log 内 env 契约与四条测试 PASS 证据。
- 独立 Verifier 全项核对；STATE 闭环（含观察数据）。
