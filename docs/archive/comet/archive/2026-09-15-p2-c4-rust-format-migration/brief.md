# 目标

P2-C4：只把 `media-agent.yml` 现有 `rust-format` 单个 job 迁到**条件 `runs-on`**——
trusted 路径（canonical `main` push 与 same-repository PR）走 `vbmf-general`
self-hosted 双机池；fork PR 永留 GitHub-hosted `ubuntu-latest`。其余 6 个 job
不动。完成后 P2-C 收口（P2-D 解锁）。

# 范围

- `.github/workflows/media-agent.yml`：仅 `rust-format` job 的 `runs-on`、
  toolchain 获取步骤与 format check step env；job id/name 保持 `rust-format`。
- `.project/STATE.md`：P2-C4 → COMPLETE、P2-C 收口、P2-D 解锁、evidence 登记。
- 本 change 的 Comet 正式产物（brief/spec）。

# 非目标

- 其余 6 个 required job（rust-test-matrix / rust-clippy / session-lifecycle /
  hardware-test-compile / architecture-portability / gstreamer-build）的任何改动。
- `ci-infra-probe.yml`、runner 标签、安全模型（§15.6 已冻结）的改动。
- P2-D（rust-clippy 迁移）的任何提前实施。
- 新增/改名的 required context；`pull_request_target` 引入（永久禁止）。

# 验收示例

- Scenario: push canonical `main` 触发 CI，`rust-format` job 由 `vbmf-general`
  池中一台 self-hosted runner（`vbmf-ci-01` 或 `vbmf-ci-02`）执行；使用系统
  pin Rust（`/usr/local/bin` + 显式 `RUSTUP_HOME=/usr/local/rustup
  CARGO_HOME=/usr/local/cargo` + `unset RUSTUP_TOOLCHAIN`，STATE §3.6 RCA），
  `cargo fmt --all -- --check` PASS；本次 run 7/7 required checks 全绿；
  Actions API 中该 job 的 `runner_name` 为两机之一（runner identity evidence）。
- Scenario: workflow diff 审计——仅 `rust-format` job 变化，其余 6 个 job
  byte-identical；job id/name 仍为 `rust-format`（required context 不变）；
  未引入 `pull_request_target`。
- Scenario: fork PR 路径结构保持——`runs-on` 表达式对 fork
  `pull_request` 解析为 `ubuntu-latest`；toolchain 安装步骤只在
  `runner.environment == 'github-hosted'` 执行；self-hosted 路径零
  install 步骤（直接用系统 pin）。
- Scenario: 本地静态验证（YAML 解析 + workflow 结构检查）在提交前 PASS；
  push 后 GitHub 接受 workflow（无语法拒绝）。
- Scenario: `.project/STATE.md` 更新：P2-C4 COMPLETE（含 run id、runner
  identity、commit SHA evidence），P2-C 整体收口，P2-D 变为 READY。

# 约束与不变量

- §15.6 冻结边界：fork PR 双通道、concurrency、timeout（`rust-format=10m`）、
  `permissions: contents: read`、7 个 required context 名称——全部不变。
- §15.7/15.8/15.9：self-hosted 路径**禁止** job 内 rolling stable 或任何
  install；必须用已 pin 的系统 toolchain（双机 exact 1.98.1，§3.6/§3.7/§3.8）。
- STATE §3.6 RCA（绑定）：self-hosted job 调用 cargo/rustfmt 必须显式
  `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo` 并
  `unset RUSTUP_TOOLCHAIN`。
- 单人单分支：全部直接 `main`，不建分支/PR 验证（fork live test 见 Open questions）。
- 本 repo public：LAN IP、SSH fingerprint、账户名、凭据不入 repo/logs/evidence。

# 决策

- D1（技术，coordinator）：单 job 表达式 `runs-on`（trusted = push 或非 fork PR →
  `fromJSON('["self-hosted","Linux","X64","vbmf","vbmf-general"]')`；fork PR →
  `ubuntu-latest`），保持单 job id `rust-format`，不拆双 job（拆分会改 required
  context 或引入 skip 状态，违反 §15.6）。
- D2（技术，coordinator）：toolchain 步骤按 `runner.environment` 分流——
  GitHub-hosted 走 `dtolnay/rust-toolchain`；self-hosted 零 install，format check
  step 内按 runner 环境显式设置系统 pin env。
- D3（用户确认 2026-09-15）：GitHub-hosted（fork）路径 toolchain 从 rolling
  `stable` 收敛为 exact `1.98.1`（`dtolnay/rust-toolchain@stable` +
  `toolchain: 1.98.1`），与 self-hosted 对称，防 rustfmt 版本漂移造成 fork/main
  双通道判定分歧。
- D4（用户确认 2026-09-15）：fork 路径 live 验证 = 用户从自有 fork 发一次测试
  PR 实证（fork 误路由 self-hosted 是 public repo 真实安全风险，live fork PR 是
  唯一实证手段）；若用户最终无法提供 fork PR，回退为真值表审查 + STATE 明示
  残余风险，不阻塞其余验收。

# 待解决问题

（无——D3/D4 已确认，见 Decisions。）

# 验证预期

- 本地：YAML 解析 + 结构自检（job 集合、id/name、其余 6 job 不变、无
  `pull_request_target`）。
- Push `main`：Actions 全绿（7/7 required）；`rust-format` job 的
  `runner_name` ∈ {`vbmf-ci-01`, `vbmf-ci-02`}；job log 显示系统路径
  `/usr/local/bin/cargo` 与 1.98.1。
- Verifier：独立只读核对上述全部 + STATE 闭环。
