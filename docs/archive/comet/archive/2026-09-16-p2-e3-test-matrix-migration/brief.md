# 目标

P2-E3：`rust-test-matrix` 迁条件 `runs-on`（general pool 最后一个 required job，
P2-E 收口项）。**二阶段**（2026-09-16 首跑实测发现 rustdoc 缺口后扩展，
用户已接受）：

- **阶段 1（rustdoc 暴收录口）**：首跑 run `35075935539` 在 @vbmf-ci-02 失败于
  doctest——`cargo test` doctest 阶段 PATH 找不到 `rustdoc`。双机实机探测确认：
  toolchain bin **已有** rustdoc（历史 provisioning 所致），但 pin 脚本 symlink
  循环只暴露 6 工具，`/usr/local/bin/rustdoc` 缺失。修复：四脚本扩展
  （pin：`--component rust-docs` 显式 + symlink 循环加 `rustdoc`；verify：新
  V6 rustdoc gate；collect：TOOLS 加 `rustdoc`；test 脚本对应正/负 case）+
  §15.9 out-of-band 双机幂等复跑（不下载新组件，仅补 symlink + verify +
  manifest）。
- **阶段 2（workflow 迁移，已实现 commit `145669c`）**：6 个 cargo 步骤经单个
  prep 步骤写 `$GITHUB_ENV` 继承 Rust env 契约（RUSTUP_TOOLCHAIN fail-closed）；
  upload-artifact 条件 `path:` 表达式（self-hosted 二进制在 checkout 外
  `target-testmatrix`）；6 条 cargo 命令逐字不变。

同时补记：2026-09-16 首个故障窗（07:04–07:05 UTC，ci-01，run `35066419711`，
1 rerun 收口）随本 packet STATE 更新入 risk 8。

# 范围

- `scripts/ci/pin-system-rust.sh`、`scripts/ci/verify-system-rust.sh`、
  `scripts/ci/collect-toolchain.sh`、`scripts/ci/test-system-rust-scripts.sh`
  （rustdoc 暴录）；
- `.github/workflows/media-agent.yml` 仅 `rust-test-matrix` job（已完成）；
- `.project/STATE.md`（窗补记 + P2-E3 闭环 + P2-E 收口 + P2-M0 解锁）；
- 本 change 的 Comet 正式产物。

# 非目标

- 其余 6 个 required job 任何改动；
- 测试集/feature 组合增删（6 条 cargo 命令逐字不变）；
- artifact 消费方/名称/保留策略变更（`media-agent-linux-default` 名称不变）；
- 出网缓解方案实施（未裁决；观察窗继续计数）；
- runner 标签 / 安全模型（§15.6 冻结）变更；
- 给 `vbmf-ci` 任何新 sudo/root。

# 验收示例

- Scenario: 阶段 1 脚本扩展合入 `main` 且 focused tests（shellcheck +
  `test-system-rust-scripts.sh`）全 PASS，CI 全绿。
- Scenario: 双机经 out-of-band 通道以新 bundle 幂等复跑：`sha256sum -c
  SHA256SUMS` OK；pin 复跑 exit 0（无新组件下载，仅 symlink 收口）；扩展
  verify V1–V6 全 PASS（V6 = rustdoc 经 proxy 可执行且版本可读）；双机
  manifest 含 rustdoc 行。
- Scenario: `rust-test-matrix` 迁条件 `runs-on` 后 push `main`：CI 7/7 required
  全绿（rust-test-matrix 含 doctest 阶段全 PASS）；job `runner_name` ∈
  {`vbmf-ci-01`,`vbmf-ci-02`}；job log 显示 prep 步骤写入 `GITHUB_ENV` 的
  Rust env 契约、6 条 cargo 命令全 PASS、artifact 上传成功且来源路径为
  self-hosted 分支路径。
- Scenario: workflow diff 审计——仅 `rust-test-matrix` job 变化，其余 6 job
  byte-identical；job id/name 仍 `rust-test-matrix`；无 `pull_request_target`；
  fork 路径 dtolnay 保持无 pin；`timeout-minutes: 30`、concurrency、
  `permissions` 不变；6 条 cargo 命令逐字不变。
- Scenario: STATE 更新——2026-09-16 窗（07:04–07:05）补记 risk 8；P2-E3
  COMPLETE（run id、runner identity、观察数据）；P2-E 收口、P2-M0 变 READY。
- Scenario: 稳定性观察继续——本 packet 验证期故障窗四元组记录（或 "0 故障窗"）。

# 约束与不变量

- §15.6 冻结边界全部不变：fork 双通道、concurrency、`timeout-minutes: 30`、
  `permissions: contents: read`、7 required context 名称。
- §3.6 RCA 调用契约：self-hosted 路径显式 `RUSTUP_HOME=/usr/local/rustup`，
  caller `RUSTUP_TOOLCHAIN` 不得存在（fail-closed 拒绝）；`CARGO_HOME` 不用
  root-only `/usr/local/cargo`。
- self-hosted 路径零 install。
- 本 repo public：内网地址/fingerprint/凭据不入 repo/logs/evidence。
- 观察窗只记录不缓解；rerun 收口可接受。

# 决策

- D1（coordinator，沿用已冻结模式）：条件 `runs-on` 表达式与 dtolnay/cache 的
  `runner.environment == 'github-hosted'` 分流逐字沿用。
- D2（coordinator，同 D2 谱系）：fork 路径 dtolnay 保持无 pin 参数——build/test
  断言不依赖 exact rustc 补丁版本。
- D3（coordinator）：持久目录——`CARGO_HOME` 共享 `.cargo-home` + **新
  `CARGO_TARGET_DIR="target-testmatrix"`**（本 job 6 步共享一个目录，与
  GitHub-hosted 单 target 语义对齐；与他 job 目录隔离防 feature 组合互踩）。
- D4（coordinator）：**env 经单个 prep 步骤写 `$GITHUB_ENV`**（替代 6 份内联
  if 块）；prep 步骤 fail-closed：caller 已设 `RUSTUP_TOOLCHAIN` 则直接失败。
- D5（coordinator）：upload-artifact 单步骤条件 `path:` 表达式
  （self-hosted → checkout 外 `target-testmatrix/debug/media-agent`；github-hosted
  → 原 `services/media-agent/target/debug/media-agent`）；artifact
  `name: media-agent-linux-default` 不变。
- D6（coordinator）：2026-09-16 窗补记随本 packet STATE 更新落盘。
- D7（coordinator，2026-09-16 扩展）：rustdoc 经 pin 脚本 symlink 循环暴露 +
  `--component rust-docs` 显式化（幂等；双机已存在二进制，本轮零下载）；verify
  V6 断言 rustdoc 经 audited proxy 可执行（版本方案独立，presence+执行即可，
  同 V4 rustfmt 口径）。
- D8（用户授权 2026-09-16）：阶段 1 允许经既有 out-of-band host-admin 通道在
  双机以 root 幂等复跑 pin（仅 symlink + verify + manifest）；`vbmf-ci` 零新
  sudo；宿主机零 git。

# 待解决问题

（无——二阶段扩展与 host-admin 授权均已由用户接受，见 D7/D8。）

# 验证预期

- 阶段 1 本地：shellcheck + `test-system-rust-scripts.sh` 全 PASS；push 后 CI 全绿。
- 双机 host evidence：bundle checksum、pin 幂等（零下载）、verify V1–V6、
  manifest 双证、`verify-runner.sh` R1–R5。
- 结构断言：仅 `rust-test-matrix` job diff（其余 6 job byte-identical）、6 条
  cargo 命令逐字不变、`on:` 键 {push, pull_request}。
- push `main` 后 CI 7/7 required 全绿（故障窗 rerun 收口可接受，计数）；job
  runner identity + log 内 prep env 契约 + 6 命令 PASS + artifact 上传证据。
- 独立 Verifier 全项核对；STATE 闭环（P2-E 收口 + P2-M0 READY）。
