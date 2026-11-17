# 目标

P2-E2：`architecture-portability` 单 job self-hosted grayscale（P2-E 第 2 项），
沿用 P2-C4/P2-D/P2-E1 已确立条件 `runs-on` 模式（trusted push/same-repo PR →
`vbmf-general` 池；fork PR → `ubuntu-latest`）。本 job 特殊点：

- **Lint 步骤**（`check_arch_portability.py`）：纯 python3 词法扫描，零 cargo 依赖，
  self-hosted 侧直接用宿主 python3（双机 parity 报告已证存在）；
- **Proof 步骤**（`check_remove_adapters.py`）：脚本内部 `cargo check
  --no-default-features --features simulation/mock`（经 `subprocess` 继承 step
  env）——self-hosted 侧必须带 §3.6 RCA Rust env 契约 + checkout 外持久
  `CARGO_TARGET_DIR`（脚本把 crate 拷到 tmp 工作目录执行，依赖编译产物进共享
  target 目录后跨 run 复用）。

同时补记：P2-E1 验收 risks 中登记的**故障窗 #6**（23:26–23:33 UTC）随本 packet
Build 阶段 STATE 更新一并写入 risk 8（Verify 阶段禁实现写入所致的顺延）。

# 范围

- `.github/workflows/media-agent.yml` 仅 `architecture-portability` job；
- `.project/STATE.md`（窗 #6 补记 + P2-E2 闭环 + P2-E3 解锁）；
- 本 change 的 Comet 正式产物。

# 非目标

- 其余 6 个 required job 任何改动；
- `scripts/check_arch_portability.py` / `check_remove_adapters.py` 任何改动
  （门禁语义零变化，仅迁移执行环境）；
- 出网缓解方案实施（未裁决，非本 change；观察窗继续计数）；
- runner 标签 / 安全模型（§15.6 冻结）变更；
- 给 `vbmf-ci` 任何新 sudo/root。

# 验收示例

- Scenario: `architecture-portability` 迁条件 `runs-on` 后 push `main`：CI 7/7
  required 全绿；job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；job log 显示
  self-hosted 分支 Lint（宿主 python3）与 Proof（显式 Rust env 契约 +
  `target-arch`）两条门禁 PASS。
- Scenario: workflow diff 审计——仅 `architecture-portability` job 变化，其余
  6 job byte-identical；job id/name 仍 `architecture-portability`；无
  `pull_request_target`；fork 路径 dtolnay 保持无 pin 参数；`timeout-minutes: 20`、
  concurrency、`permissions` 不变。
- Scenario: STATE 更新——窗 #6 补记入 risk 8（当日 6 窗口径）；P2-E2 COMPLETE
  （run id、runner identity、观察数据）；P2-E3 变 READY。
- Scenario: 稳定性观察继续——本 packet 验证期故障窗四元组记录（或 "0 故障窗"）。

# 约束与不变量

- §15.6 冻结边界全部不变：fork 双通道、concurrency、`timeout-minutes: 20`、
  `permissions: contents: read`、7 required context 名称。
- §3.6 RCA 调用契约：Proof 步骤 self-hosted 分支显式 `RUSTUP_HOME=/usr/local/rustup`、
  `unset RUSTUP_TOOLCHAIN`；`CARGO_HOME` 不用 root-only `/usr/local/cargo`。
- self-hosted 路径零 install（无 rustup/apt 操作）。
- 本 repo public：内网地址/fingerprint/凭据不入 repo/logs/evidence。
- 观察窗只记录不缓解；rerun 收口可接受。

# 决策

- D1（coordinator，沿用已冻结模式）：条件 `runs-on` 表达式与
  `runner.environment == 'github-hosted'` step 分流逐字沿用。
- D2（coordinator，同 P2-E1 D2）：fork 路径 dtolnay 步骤保持现状无 pin 参数——
  Lint 是词法门禁、Proof 断言 "移除 vendor adapters 后仍编译"，均不依赖 exact
  rustc 补丁版本；不顺手改语义。
- D3（coordinator）：self-hosted 持久目录——`CARGO_HOME` 共享 `.cargo-home` +
  **独立 `CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-arch"`**（Proof 构建
  特征组合 `--no-default-features --features simulation/mock` 与 clippy/test 均
  不同，独立目录防缓存互踩；单 runner 串行无并发写冲突）。
- D4（coordinator）：**只给 Proof 步骤加 env 分流**；Lint 步骤（纯 python3）与
  checkout/dtolnay/cache 步骤的分流按既有模式（dtolnay + cache 仅 github-hosted）。
- D5（coordinator）：GitHub-hosted 路径保留 `actions/cache` 现状。
- D6（coordinator）：窗 #6 补记随本 packet STATE 更新落盘（P2-E1 验收 risks 已
  登记，数据不丢）。

# 待解决问题

（无——全部决策按既有模式收敛，等待用户确认 Shape。）

# 验证预期

- 本地结构断言：仅 `architecture-portability` job diff、其余 6 job byte-identical、
  `on:` 触发键 {push, pull_request}。
- push `main` 后 CI 7/7 required 全绿（故障窗 rerun 收口可接受，计数）；job
  runner identity + log 内 Lint/Proof PASS 证据。
- 独立 Verifier 全项核对；STATE 闭环（窗 #6 补记 + P2-E2 数据 + P2-E3 READY）。
