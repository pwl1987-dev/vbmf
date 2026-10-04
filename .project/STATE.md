# VBMF Project State

> **Dynamic Project State Authority**
>
> 本文件是 VBMF 唯一动态项目状态与跨 Chat / Work handoff 入口。
> `ROADMAP.md` 与 `docs/architecture/PHASE_IMPLEMENTATION_MAP.md` 只承担宏观/历史路线职责；冻结 Architecture / Contract / ADR 仍承担设计 Authority。
> 若本文件与 live `main`、真实代码、测试或 Runtime / hardware evidence 冲突，先做 reconciliation，不得凭旧 roadmap、旧聊天或历史分支让项目倒退。

## 1. Repository / Git Authority

- Repository: `pwl1987-dev/vbmf`（2026-09-29 REPO-MIGRATION-01 正式 transfer 自 `pwl1987/VBMF`，见 §3.81；旧地址 GitHub 重定向仅作兼容，不再作为 canonical Authority）
- Canonical development branch: `main`
- Default branch: `main`
- Git Authority policy: `main` 是唯一开发 Authority；不得再创建 `feature/*`、`fix/*`、`temp/*`、`repair/*`、`experiment/*` 等并行开发分支。
- `master → main` migration: **COMPLETE**（2026-09-13，原位 rename；历史链未复制、未 rewrite、未 force-push）。
- Remote `master` ref: **ABSENT**（GitHub 旧路径兼容重定向不构成实际 ref）。
- Single-branch convergence（2026-09-15）：单人开发裁定，`main` 为唯一分支；7 个历史远端分支（`diag/c2-o3-e2-single-input` / `diag/c2-o3-e3a-selftest` / `docs/v03-architecture-reorg` / `docs/v03-p1-plan` / `docs/v03-p1-plan-2` / `feat/v03-p1-standalone-control-plane` / `feat/v03-standalone-product-baseline`）已删除，远端 heads 仅存 `main`；PR #31 随 head 分支删除自动 CLOSED。
- Branch protection: `main` protected；required contexts 保持 7 个：
  - `rust-format`
  - `rust-test-matrix`
  - `rust-clippy`
  - `hardware-test-compile`
  - `architecture-portability`
  - `gstreamer-build`
  - `session-lifecycle`
- Repository rulesets: 当前远端查询为空；classic branch protection 仍有效。
- Last non-state-init implementation / CI reconciliation anchor: `cf1e07d1cbd8e8f304bfaf8a3fac8fd0d6408cc7` (`ci: automate P2-C host-admin bundle preparation`; GitHub Actions `34935730648` PASS).
- Dynamic state baseline: **以包含本 `.project/STATE.md` 当前版本的 live `main` commit 为准**；冷启动时用 `git log -1 -- .project/STATE.md` / GitHub file history 取得，不在文件内硬编码自引用 SHA。

### Local Working Tree / Execution Environment

2026-09-15 已迁入标准 Development VM 布局并可真实观察：

- Development VM: `ubuntu2604`；development checkout = `/home/ubuntu/dev/VBMF`；
- checkout 从 GitHub canonical `main` 新建，P2-B push 后与 live `main` 对齐；
- 当前窗口可直接核查 staged / unstaged / untracked，不再使用 `NOT OBSERVABLE` 口径；
- 旧 STATE 记录的另一环境未提交 `docs/architecture/DEPLOYMENT_AND_DEV_RUNTIME.md` 修改**不在本新 checkout 中**；未取得原 checkout 证据前不得声称其已删除或已迁移。
- Development VM 只承担开发/软件验证；BMD `lytv` 承担部署、Broadcast Runtime、DeckLink/hardware verification。

Agent foundation（2026-09-15 复核）：`/home/ubuntu/dev/_shared/bin/agent-preflight.sh /home/ubuntu/dev/VBMF --smoke` 已证明 Pi provider/model smoke **PASS**、Claude Code auth/model smoke **PASS**、Claude project trust **PASS**。Claude Code 后续写任务通过 `_shared/bin/run-claude-agent.sh` 在 tmux 持久会话中执行，保留 writer lock / structured activity / acceptance state；agent 输出仍不构成项目完成 Authority。

## 2. Current Phase

**Runtime Features ACTIVE；RF-FF-02/RF-FF-03 + RH-CLOCK-01 + RF-NORM-01 + RF-MASTER-01 + RF-SRC-RTMP-01 COMPLETE；RF-SRC-01 BLOCKED；RF-SRC-RTMP-02 COMPLETE（closure reconciliation 已收口·§3.60）；STANDALONE-ENTRY-01 全链 COMPLETE（SE-01A/SE-01C/SE-01D/SE-01B·§3.62–§3.65 + SE-01B-FIX reconciliation 收口·§3.66–§3.67）；RUNTIME-CONTROL-ENTRY-01 全链 COMPLETE（§3.68–§3.70）+ RCE-D3 COMPLETE（§3.71）+ CONTROL-PLANE-ENTRY-01 PLAN FROZEN（§3.72·C1–C14）+ **CP-01A COMPLETE（§3.73·2026-09-23）+ CP-01B COMPLETE（§3.74·2026-09-23·RH-IDEM-01 清偿）+ CP-01C COMPLETE（§3.75·2026-09-24·Auth/RBAC/限流/审计硬化）+ CP-01D COMPLETE（§3.76·2026-09-24·Event plane）+ CP-01E COMPLETE（§3.77·2026-09-25·全栈/BMD 集成验收）→ **CONTROL-PLANE-ENTRY-01 全链 COMPLETE**；**PRODUCTION-READINESS-ENTRY-01 PLAN FROZEN（§3.84·2026-09-29·Reality Review + Production Core Dependency Rule）；PR-01A/PR-01B COMPLETE（§3.85）+ HEALTH-INCIDENT-ENTRY-01 全链 COMPLETE（§3.86–§3.87）；当前 = PR-STAB-01 FIX VERIFICATION ACTIVE（§3.93–§3.94；exact Runtime `6fc1b1a` / binary `3898ced3…`；Development + exact-head CI + BMD build PASS；新 2h rung IN PROGRESS）+ RD-01A planning-only COMPLETE 但 Runtime implementation 继续受 freeze 阻止（§4/§5.1）**

Phase 2 与 STAB-O3.1/O4 均已收口；本阶段只处理进入 Runtime Features 前会扩大故障面的关键 hardening。采用“按依赖按需清偿”而非一次清空全部历史债务：已被 BMD 实证的多输入 Bus/故障观测缺陷最高优先，随后是会被新 Source/Output 生命周期放大的 D1/D3/D7；D11+D13 在 Clock/Timecode 下一触碰点前清偿，D15 在多流 Audio/Metadata 前清偿，durable idempotency 在外部持久控制面前清偿。

当前已进入 Runtime Features bounded-packet 开发阶段。Phase 2、STAB-O3.1/O4 与 immediate Runtime Hardening gates 均已按各自 verification level 收口；Runtime Features 必须逐 packet 对齐 frozen Contract，按 touch-gate 触发 RH-CLOCK/RH-FLOW/RH-IDEM，不允许一次性扩面。7 个 required CI job 的 self-hosted 条件灰度已完成（5 general + 2 media）；GitHub-hosted 仅余 fork 回退路径。旧 `ROADMAP.md` / `PHASE_IMPLEMENTATION_MAP.md` 中更早的 “NEXT” 不得重新成为当前任务。

VBMF 的永久产品定位保持：

- Broadcast Runtime / Fabric；
- standalone first；
- 与 `media-digital-*` compatible, not dependent；
- Runtime owns truth; Web Console observes and commands；
- 广播专业 Contract 留在 VBMF / `vbmf-sdk`；
- Health / Watchdog / Recovery 是核心能力。

## 3. Last Completed

### 3.1 P2-A — dual general-runner parity / merge

Status: **COMPLETE**

Authority / evidence: `docs/architecture/CI_RUNNER_STRATEGY.md` §15.5 + commit `db54d45c76bbd05917292131c0a4a803b2907f36`.

Recorded result:

- `vbmf-ci-01` + `vbmf-ci-02` 已同挂 `{self-hosted,Linux,X64,vbmf,vbmf-general}`；
- 6 个被测工具 parity 逐字符一致；4 项环境差异已裁决；
- 两台 R Gate PASS，dispatch 随机派发已实测；
- `vbmf-ci-02` 运行于 devbox KVM VM，与 `vbmf-ci-01` 同物理故障域，事实已登记；
- P2-C 前两台需要对称执行系统级 Rust toolchain pin，禁止只改一台。

### 3.2 Git Authority convergence

Status: **COMPLETE**

- 默认分支已由 `master` 原位 rename 为 `main`；
- HEAD 在迁移时保持 `db54d45c76bbd05917292131c0a4a803b2907f36`；
- 保护规则及 7 required checks 保留；
- 远端无实际 `master` ref；
- 历史 feature/fix/实验分支只作为 historical refs，本轮未删除。

### 3.3 Project state-system initialization

Status: **COMPLETE in the commit containing this file**

- 建立唯一动态入口 `.project/STATE.md`；
- `ROADMAP.md` 与 `PHASE_IMPLEMENTATION_MAP.md` 已明确降级为宏观/历史 Roadmap；
- 未创建 `STATUS.md` / `TODO.md` / `DECISIONS.md` / `RISKS.md` / `HANDOFF.md` 等第二套动态状态文件；
- 未推进 Runtime / Web 业务功能。

### 3.4 P2-B — CI safety / scheduling boundary

Status: **COMPLETE / SOFTWARE VERIFIED**

Implementation commit: `9d6df61c1e8164d65cc94c4a0a1f4a9febe0a1c2`.

- fork PR 安全边界已冻结：P2-C+ 仅 trusted `main` push / same-repository PR 可进入 self-hosted；fork `pull_request` 永留 GitHub-hosted，禁止 `pull_request_target` 执行 PR code；
- `media-agent.yml` push branch 收敛到 canonical `main`，并加入 workflow-level `contents: read`、concurrency/cancel-in-progress 与全部 7 jobs 的 timeout；
- 7 required job/context 名称未变化，P2-B 本身未修改任何 `runs-on`；
- Strategy 操作性 `--ref master` 已改为 `--ref main`，历史 baseline 中 `master` 仅保留为历史证据；
- GitHub Actions run `34920528957`：7/7 required jobs **PASS**。

### 3.5 P2-C host-admin Rust pin tooling / runbook hardening

Status: **IMPLEMENTATION COMPLETE / SOFTWARE VERIFIED; HOST EXECUTION IN PROGRESS**

Implementation chain: `5a9ae16857ff28b29ca6f2da3f2db5acefe4fd37` → `cf1e07d1cbd8e8f304bfaf8a3fac8fd0d6408cc7` → `4eeb16e358cb7fd811763112dbaa9d0d2b954e84` → `0f375c8b49fdb61df507d7a75020c8d7c662b359`.

- exact system pin 固定为 Rust `1.98.1`，root-only `pin-system-rust.sh` + read-only `verify-system-rust.sh` 已落地；
- `prepare-system-rust-bundle.sh` 只接受 full 40-hex exact commit SHA，从该 commit byte-exact 导出 pin/verify/collect 三脚本并生成 deterministic `SHA256SUMS`；拒绝 floating ref / short SHA / missing script / 非空目标目录；
- focused non-root / zero-network tests：`scripts/ci/test-system-rust-scripts.sh` 在 verifier RCA 修复后扩展为 **41/41 PASS**；ShellCheck（touched scripts）PASS；docs targeted check / `git diff --check` PASS；
- encrypted runner route probe (`4eeb16e…`) 仅在显式 dispatch 时输出 RSA-OAEP-SHA256 密文；4 次真实 dispatch `34947844469` / `34947851225` / `34947857864` / `34947863953` 全部 PASS，并分别命中 `vbmf-ci-01` / `vbmf-ci-02`；内部管理地址/host key 信息未写入 Git/STATE/公开日志；
- host-route evidence 已恢复并严格验证 devbox host identity：Development VM 到精确宿主 SSH 可达、runner 本机 ED25519 fingerprint 与精确目标 `ssh-keyscan` 匹配、已有 key BatchMode 登录 PASS、host-admin `sudo -n` PASS；原“无 host-admin 通道”阻塞已解除；
- `vbmf-ci-01` 已实际 system-pin Rust `1.98.1` 并完成第二次 pin 幂等执行；首次独立 verify 暴露 caller rustup 污染 RCA，`0f375c8…` 已把 V2/V3/V4 锁定到 audited `/usr/local/{rustup,cargo}` 并清除 caller `RUSTUP_TOOLCHAIN`；真实 host1 正常环境与 poisoned caller env 均 V1–V4 PASS；
- GitHub Actions：`5a9ae16…` run `34934058858` PASS；`cf1e07d…` run `34935730648` PASS；`4eeb16e…` run `34947630667` PASS；`0f375c8…` run `34949135299` PASS；
- rejected CI-root maintenance path 的真实 evidence：run `34921727757` 同时命中 `vbmf-ci-01` / `vbmf-ci-02`，两机都在 `sudo -n true` fail，system pin step skipped，**无系统修改发生**；
- CI service account `vbmf-ci` 继续保持无通用 sudo/root；唯一合法执行平面是 Strategy §15.9 的 out-of-band host-admin runbook。

本子任务不等于 P2-C 完成：`vbmf-ci-01` 已完成实际 system pin 与修复版 verifier 实机验证；current-SHA bundle/manifest 收口见 §3.6。`vbmf-ci-02` 尚未 system pin；双机 parity re-probe 与 `rust-format.runs-on` 迁移均未执行。

### 3.6 P2-C1 — `vbmf-ci-01` current-SHA 正式收口

Status: **COMPLETE / HOST VERIFIED（2026-09-15，§15.9 步骤 A+B 实际执行）**

- coordinator 确认 bundle 源 exact SHA：`b0f5df3b215c536b598aed7938079572edf87395`（时点 live canonical `main` tip；与 `0f375c8` 仅差 docs，三脚本 byte-identical）；
- `prepare-system-rust-bundle.sh` 导出三脚本 + deterministic `SHA256SUMS`：`collect 5af0bfaa04607973b97ca9a40e1cdbc277818428a49181d27ec434b47b039f1a` / `pin 46056167848a2e1a71350650650ed7fcd2073aa504474ffafe0e2e6f31d995b1` / `verify d0ae04fc424824951fabb9154da5e0bb766bdaa54d72f182d7d5fa61c03d57db`；`BUNDLE_SOURCE_SHA` 与 SHA 一致；
- host1（devbox）`sha256sum -c SHA256SUMS` 3/3 OK；
- 幂等 pin 复跑（正式 bundle 脚本）：`PINNED_RUST_VERSION=1.98.1`，exit 0，版本不变；
- 正式 verifier V1–V4：`RESULT: PASS`（rustc `1.98.1 (48a229cea 2026-09-01)`、cargo `1.98.1 (797e8a9bc 2026-08-05)`、rustfmt `1.9.0-stable`；`rustup default=1.98.1-x86_64-unknown-linux-gnu`，无 rolling stable）；
- manifest 以 `vbmf-ci` 身份刷新成功（需显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`，见下方 RCA）：`/data/actions-runners/vbmf/manifests/vbmf-ci-01/{toolchain.yaml,toolchain.txt}` @ `2026-09-15T10:01:21Z`，rustc/cargo = `/usr/local/bin/*` 1.98.1；`clang: MISSING` 为既有宿主状态，非本 gate 项；
- 管理机只读收口：`verify-runner.sh --name vbmf-ci-01` R1–R5 + scope 全 PASS（`RESULT: PASS`），labels 仍为 exact `{self-hosted,Linux,X64,vbmf,vbmf-general}`；
- host key 采信依据：Development VM 直连 `ssh-keyscan` 与 BMD 服务器侧交叉 scan 双独立路径 fingerprint 一致后写入 `known_hosts_agents`；地址/fingerprint 依红线不写入本文件；
- `vbmf-ci` 权限零变更（无 generic sudo/root 新增）；宿主机零 git 操作；bundle 临时目录已清理；
- **运维 RCA（对 P2-C2/P2-C4 有约束力）**：rustup proxy 在 `vbmf-ci` 身份下若不显式设置 `RUSTUP_HOME`/`CARGO_HOME`，会尝试 `$HOME/.rustup` 且因 runner base 目录不可写而失败（2026-09-11 旧 manifest 同样止步于 python3 的原因）。凡以 `vbmf-ci` 身份调用 rustc/cargo/rustfmt（manifest collect、未来 self-hosted CI job）必须显式携带 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`；
- 本轮同步落盘 `AGENTS.md` coordination tiering（强模型 = coordinator，Pi = 默认 executor，executor 不写调度契约）；`_shared/README.md` 对应条款先行落盘（dev-agent-kit main `93a6451`）。

### 3.7 P2-C2 — `vbmf-ci-02` 对称 system Rust pin 收口

Status: **COMPLETE / HOST VERIFIED（2026-09-15，§15.9 步骤 A+B 经 devbox 跳板实际执行）**

- coordinator 确认 bundle 源 exact SHA：`9e47721eb30355ffe23cea12592445e8f0575c6a`（时点 live canonical `main` tip）；三脚本与 `b0f5df3`（P2-C1）byte-identical，`SHA256SUMS` 完全一致（collect `5af0bfaa…` / pin `46056167…` / verify `d0ae04fc…`）；
- guest（devbox KVM `vbmf-ci-02`）host-key 严格验证：devbox 管理面 `ssh-keyscan` 所得 ED25519 fingerprint 与用户 guest 控制台读出的 `/etc/ssh/ssh_host_ed25519_key.pub` fingerprint 比对一致后写入信任；地址/fingerprint 不落盘；
- guest `sha256sum -c SHA256SUMS` 3/3 OK；
- 首次 system pin + 幂等复跑：两次 `sudo pin-system-rust.sh --version 1.98.1` 均 exit 0，`PINNED_RUST_VERSION=1.98.1`（首次运行输出含 `unchanged` 提示 `/usr/local` 下 toolchain 组件已在此前 provisioning 中就位，本论完成 default/链接收口，符合幂等语义）；
- 正式 verifier V1–V4：`RESULT: PASS`（rustc `1.98.1 (48a229cea)`、cargo `1.98.1 (797e8a9bc)`、rustfmt `1.9.0-stable`；`rustup default=1.98.1-x86_64-unknown-linux-gnu`，无 rolling stable）——与 host1 exact 对称；
- manifest 以 `vbmf-ci` 身份（显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`，§3.6 RCA 生效）刷新：`/data/actions-runners/vbmf/manifests/vbmf-ci-02/{toolchain.yaml,toolchain.txt}` @ `2026-09-15T11:14:31Z`，rustc/cargo = `/usr/local/bin/*` 1.98.1；
- 管理机只读收口：`verify-runner.sh --name vbmf-ci-02` R1–R5 + scope 全 PASS（`RESULT: PASS`），labels exact；
- **运维 RCA（对 P2-C3+ 有约束力）**：bundle 经 devbox 中转 scp 到 guest 后可能丢失执行/读权限位，宿主机执行前必须 `chmod 755` 脚本，否则 `sudo -u vbmf-ci bash <script>` 以 126 `Permission denied` 失败；
- `vbmf-ci` 权限零变更；guest 零 git 操作；guest/devbox/VM 三方 bundle 临时目录均已清理。

### 3.8 P2-C3 — 双 runner parity re-probe + probe env 修正

Status: **COMPLETE / PROBE VERIFIED（2026-09-15）**

- 前置修正：`ci-infra-probe.yml` capability step 补显式 `RUSTUP_HOME=/usr/local/rustup`、`CARGO_HOME=/usr/local/cargo` 并 `unset RUSTUP_TOOLCHAIN`（commit `53cf25b…`，与 verify-system-rust.sh V2–V4 同调用契约；§3.6 RCA 落地——plain `--version` 在 `vbmf-ci` 下会因 `$HOME/.rustup` 不可写而报错）；只读红线/结构不变；push 后 CI run `34963352333` SUCCESS；
- dispatch 证据：两次 `workflow_dispatch`（tier=`vbmf-general`）分别命中两机——run `34963581888` → `runner.name=vbmf-ci-02`（workspace `/data/actions-runners/vbmf/runners/vbmf-ci-02/_work/…`），run `34963608876` → `runner.name=vbmf-ci-01`（workspace `…/vbmf-ci-01/_work/…`）；
- parity 双证：两份报告 `rustc: /usr/local/bin/rustc (rustc 1.98.1 (48a229cea 2026-09-01))`、`cargo: /usr/local/bin/cargo (cargo 1.98.1 (797e8a9bc 2026-08-05))`，逐字符一致，无 MISSING、无 rustup 报错；
- labels：GitHub runners API 实查两机均 online 且 exact `{self-hosted,Linux,X64,vbmf,vbmf-general}`；
- manifest：引用 §3.6（host1 @10:01:21Z）/§3.7（host2 @11:14:31Z），未重跑；
- §15.7 末条与 §15.9 收尾段的 parity 前置已满足：P2-C4 允许迁 `rust-format.runs-on`。


### 3.9 P2-C4 — `rust-format` 条件 `runs-on` self-hosted 灰度（P2-C 收口）

Status: **COMPLETE / CI VERIFIED（2026-09-15）**

- implementation commit `41400e1b36e67a36cbd9a9395d4f42efb42c76ad`：仅改 `rust-format` 单 job——条件 `runs-on` 表达式（trusted = 非 fork PR 或 push → `["self-hosted","Linux","X64","vbmf","vbmf-general"]`；fork PR → `ubuntu-latest`）；dtolnay toolchain 步骤仅 `runner.environment == 'github-hosted'` 时执行且 pin exact `1.98.1`（D3，与系统 pin 对称防 rustfmt 漂移）；self-hosted 路径零 install，format check 内显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo` + `unset RUSTUP_TOOLCHAIN`（§3.6 RCA 调用契约）；
- 结构不变量已断言（本地检查 PASS）：其余 6 job 与 origin/main 完全一致、job id/name 仍 `rust-format`、无 `pull_request_target`、`permissions: contents: read`、timeout 10m、concurrency 不变；
- GitHub Actions run `34969039593`（push `main` 触发）：**7/7 required checks PASS**；`rust-format` job 由 **`vbmf-ci-02`** 执行（labels `self-hosted,Linux,X64,vbmf,vbmf-general`），job log 显示 `RUNNER_ENV: self-hosted` 分支与 `cargo fmt --all -- --check` 在系统 pin 下通过——push 路径 runner identity + 系统 toolchain 双证据落库；
- fork 路径 live 验证（brief D4）：默认真值表+结构审查；若用户提供自有 fork 测试 PR，补充实证后在本节登记；残余风险 = fork 分支未 live 实测，将来外部 fork PR 首次出现时以 job `runner_name` evidence 立即核验；
- P2-C 整体收口：§15.2 灰度阶梯 P2-C 完成，P2-D（rust-clippy）解锁。

### 3.10 P2-D — clippy 组件收口 + `rust-clippy` self-hosted 灰度

Status: **COMPLETE / HOST + CI VERIFIED（2026-09-15）**

- 前置实测发现：系统 pin 只含 rustfmt，host1 `cargo clippy` 报 `cargo-clippy is not installed`——P2-D 需先补组件再迁 job；
- 阶段 1（脚本，commits `fe58aab…` + `4afa771…`）：pin/verify/collect/test 四脚本加 clippy（`--component clippy`、暴露 `cargo-clippy`/`clippy-driver`、verify 新 V5 gate、manifest 增行）；**RCA：clippy 版本方案为 `0.1.<rustc-minor>`（1.98.1 → `clippy 0.1.98`），gate 必须按此推导**（首次 host1 实测 `clippy 1.98.1` 断言失败后修正）；tests **45/45 PASS**，ShellCheck（warning 级，预存 info SC2031 除外）PASS；CI runs `35025999239` / `35027349065` 全绿（前者经一次出网窗口 rerun）；
- 阶段 1（host-admin，bundle 源 exact SHA `4afa7717615fbe161f640bdcd8f8ad640374b583`，collect `9dbd189d…` / pin `6f2fdca4…` / verify `cff27669…`）：host1 直连 tar 管道、host2 经 devbox 跳板 scp 中转，双机 `sha256sum -c` 3/3 OK → root 幂等 pin 复跑 exit 0 → 扩展 verify **V1–V5 全 PASS**（V5 `clippy 0.1.98 (48a229ceae 2026-09-01)`）→ `vbmf-ci` 身份 manifest 刷新（显式系统 env）：host1 @`2026-09-15T21:47:27Z`、host2 @`21:48:28Z`，`cargo-clippy: /usr/local/bin/cargo-clippy` 双证一致；`verify-runner.sh` 双机 R1–R5+scope PASS；`vbmf-ci` 零新 sudo、宿主机零 git、临时目录四方清理；
- **运维 RCA（tar/scp 中转补充 §3.7）**：中转目录若以 umask 077 建立（`drwx------`），`vbmf-ci` 无法穿越——传输后必须 `chmod 755` 目录本身，仅 chmod 脚本不够；
- 阶段 2（workflow，commit `eca00b7…`）：`rust-clippy` 条件 `runs-on`（P2-C4 同模式）；dtolnay 步骤与 `actions/cache` 仅 `runner.environment == 'github-hosted'`（fork 路径 toolchain pin `1.98.1`）；self-hosted 零 install，两条 clippy 命令内联导出 `RUSTUP_HOME=/usr/local/rustup` + checkout 外持久 `CARGO_HOME="${GITHUB_WORKSPACE%/*}/.cargo-home"`、`CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-clippy"` + `unset RUSTUP_TOOLCHAIN`（绕开 root-only `/usr/local/cargo` 与 checkout clean；持久目录替代 actions/cache）；
- CI run `35027740186`（push `main` `eca00b7`）：首跑双 self-hosted job 同遇出网故障窗（21:51–21:56 双机 fetch 断）失败，窗口过后 rerun **7/7 required 全绿**；`rust-clippy` @**vbmf-ci-02**（labels self-hosted/Linux/X64/vbmf/vbmf-general），log 实证 env 契约与真实编译（22 crates，`Finished dev 28.91s`；mock 复用 target `10.50s`）；
- **出网稳定性观察（升级为风险项）**：2026-09-15 三次故障窗（~13:12 host1、21:32–21:40 双机、21:51–21:56 双机），均表现为 runner agent 通道正常而 git fetch 新建 TLS 连接失败；影响所有 self-hosted job 首步 checkout，当前靠 rerun 收口；P2-E1 前需裁决缓解方案（job 级 git 代理与 ci-infra-probe 的 workflow-env 红线冲突，需单独决策）。

### 3.11 P2-E1 — `session-lifecycle` 条件 `runs-on` self-hosted 灰度 + 出网观察窗

Status: **COMPLETE / CI VERIFIED（2026-09-15）**

- implementation commit `810b60c8e333a48a26055bcdaf655c6fd5b022f7`：仅改 `session-lifecycle` 单 job——条件 `runs-on` 表达式与 P2-C4/P2-D 逐字一致；dtolnay 步骤与 `actions/cache` 加 `runner.environment == 'github-hosted'` 分流，fork 路径 dtolnay 保持无 pin 参数（D2：本 job 测试断言不依赖 exact 补丁版本，不顺手改语义）；self-hosted 零 install，测试步骤内联显式 `RUSTUP_HOME=/usr/local/rustup` + `unset RUSTUP_TOOLCHAIN`（§3.6 RCA）+ checkout 外持久 `CARGO_HOME="${GITHUB_WORKSPACE%/*}/.cargo-home"`（与 clippy 共享 registry）+ **独立 `CARGO_TARGET_DIR="${GITHUB_WORKSPACE%/*}/target-session"`**（D3：clippy 与 test 构建参数不同，隔离防缓存互踩）；四条 `cargo test --features mock`（session/resource/lease/preflight）逐字不变；
- 结构不变量本地断言 PASS：其余 6 job 与 origin/main byte-identical、job id/name 仍 `session-lifecycle`、`on:` 触发键 = {push, pull_request}、timeout 20 / concurrency / permissions 不变；
- GitHub Actions run `35033319131`（push `main` `810b60c`）：首跑三 self-hosted job 全部命中当日第 4 个出网故障窗（~22:55–23:05 UTC，双机 fetch TLS 失败），两次 rerun 后 **7/7 required 全绿**；`session-lifecycle` job 由 **`vbmf-ci-01`** 执行，log 实证 `RUNNER_ENV: self-hosted` 分支 + env 契约 + 四条 mock 门禁测试 **50 passed / 0 failed**；
- 出网稳定性观察（risk 8 数据）：P2-E1 验证期 2 个故障窗——窗 #4（22:55–23:05 UTC，双机，4 次 job 失败，run `35033319131` 2 次 rerun 收口）；窗 #5（23:14–23:19 UTC，双机：ci-01×2 + ci-02×1，3 次 job 失败，STATE 闭环 push `0294450` 的 run `35034627908` 1 次 rerun 收口，收口后 7/7 全绿且 `session-lifecycle` 在 **vbmf-ci-02** 亦有 live PASS 证据）；runner agent 通道始终正常；当日累计 5 窗，数据不足以裁决缓解方案，P2-E2 继续累计。

### 3.12 P2-E2 — `architecture-portability` 条件 `runs-on` self-hosted 灰度

Status: **COMPLETE / CI VERIFIED（2026-09-16）**

- implementation commit `fe2e04a…`：仅改 `architecture-portability` 单 job——条件 `runs-on` 与既有模式逐字一致；dtolnay 与 `actions/cache` 加 github-hosted 分流（fork 路径无 pin 参数，D2）；**Lint 步骤零改动**（纯宿主 python3，双机 parity 已证）；Proof 步骤 self-hosted 分支显式 `RUSTUP_HOME=/usr/local/rustup` + `unset RUSTUP_TOOLCHAIN`（§3.6 RCA）+ checkout 外持久 `CARGO_HOME=".cargo-home"`（共享）+ **独立 `CARGO_TARGET_DIR="target-arch"`**（D3：`--no-default-features --features simulation/mock` 组合独立，防缓存互踩）；两个门禁脚本零改动，`check_remove_adapters.py` 经 subprocess 继承 step env；
- 结构不变量本地断言 PASS：其余 6 job byte-identical、job id/name 不变、`on:` 键 {push, pull_request}；
- GitHub Actions run `35061944269`（push `main` `fe2e04a`）：**7/7 required 首跑全绿（无 rerun）**；job @**vbmf-ci-01**，log 实证 Lint（宿主 python3）PASS + Proof（`RUNNER_ENV: self-hosted` 分支 + env 契约 + `remove-adapters` 两条 feature cargo check 执行）成功；
- 窗 #6 补记（自 P2-E1 验收 risks 顺延，D6）：2026-09-15 23:26–23:33 UTC，双机（ci-01×2 + ci-02×1），3 次 job 失败均 checkout fetch TLS，run `35035748405` 1 次 rerun 收口；
- 出网稳定性观察（risk 8 数据）：P2-E2 验证期 **0 故障窗**（首跑全绿）；当日（2026-09-16）暂无新窗。

### 3.13 P2-E3 — `rust-test-matrix` 条件 `runs-on` self-hosted 灰度（P2-E 收口）

Status: **COMPLETE / HOST + CI VERIFIED（2026-09-16）**

- 阶段 2 先行（workflow，commits `145669c` + `a975036`）：条件 `runs-on`（第 5 个也是最后一个 general-pool required job）；**env 经单个 prep 步骤写 `$GITHUB_ENV`**（D4：6 个 cargo 步骤零改动自动继承；caller `RUSTUP_TOOLCHAIN` fail-closed 拒绝）；持久 `.cargo-home` + 独立 `target-testmatrix`；upload-artifact 因 v4 禁 `..` 路径改为 self-hosted 专用 staging 步骤（`a975036`：拷贝二进制入 workspace 后双路径条件表达式，`35079837269` 的 `Relative pathing '.' and '..' is not allowed` RCA）；6 条 cargo 命令逐字不变；
- 阶段 1（rustdoc 暴录，commit `43b665e`）：**RCA：`--profile minimal` pin 不含 rustdoc，`cargo test` doctest 阶段 PATH 找不到 rustdoc 即失败**（首跑 `35075935539` @vbmf-ci-02 实测：232 单测全过、doctest `could not execute process rustdoc`）；双机 toolchain bin 均已有 rustdoc 二进制（历史 provisioning），仅缺 `/usr/local/bin` 暴露；四脚本扩展（`--component rust-docs` 显式化 + symlink 循环 + verify V6 presence/执行 gate + manifest）后 **48/48 tests PASS**、shellcheck 零 warning；
- host-admin（bundle 源 exact SHA `43b665eb287ace31cddf2c984068ace42eb2b6bb`，collect `089d4bcc…` / pin `3afb1644…` / verify `d9c0443e…`，用户授权 D8）：双机 checksum 3/3 → root 幂等 pin 复跑 exit 0（零工具链下载）→ verify **V1–V6 全 PASS**（V6 `rustdoc 1.98.1 (48a229cea 2026-09-01)`）→ manifest 刷新 host1 @`2026-09-16T09:38:10Z` / host2 @`09:55:59Z`（`rustdoc: /usr/local/bin/rustdoc`）；GitHub API 双机 online + exact labels；临时目录三方清理；**运维 RCA：host2 首次 pin 复跑经 devbox 跳板在 rustup 网络 self-update 检查处缓慢，管道 `timeout` 曾截断 symlink 循环且 `tail` 掩盖退出码——host-admin 必须整跑判 pin 自身 RC，不得管道截断**；
- CI：run `35079837269`（`43b665e`）rust-test-matrix 仅败于 upload `..` 路径（6 cargo 步骤已全过）；run `a975036` 对应 run **7/7 required 全绿首跑**，rust-test-matrix @**vbmf-ci-01**：prep env 契约 + 232×3 单测 + **Doc-tests 三轮执行 0 FAILED**（rustdoc 生效）+ artifact 上传成功；
- **P2-E 整体收口**：5 个 general-pool required job（rust-format/rust-clippy/session-lifecycle/architecture-portability/rust-test-matrix）全部完成条件 runs-on 灰度；hardware-test-compile/gstreamer-build 留 GitHub-hosted 待 P2-M0 裁决；
- 出网稳定性观察：risk 8 补记 2026-09-16 窗（07:04–07:05 UTC，ci-01，run `35066419711`，1 rerun）；P2-E3 验证期（`145669c`/`43b665e`/`a975036` 三 push + rerun 0 次）出网零故障（`35075935539` 失败为 rustdoc 真实缺陷非出网）。

### 3.14 P2-M0 — DeckLink SDK 注入模式裁决

Status: **COMPLETE / ADJUDICATED（2026-09-16）**

- 用户裁决：**B——media 主机预装 + 版本锁定（去 secret 化）**；A（维持 secrets
  分片注入）未采纳。裁决 + 五条理由 + 三条隐含义务 + 过渡期口径已落
  `docs/architecture/CI_RUNNER_STRATEGY.md` §15.3（docs-only commit）；
- 隐含义务（P2-M1 范围）：`vbmf-media` tier 供给 runbook（SDK pin/verify/collect
  同构 + libclang/GStreamer dev/protobuf 清单）；workflow 删 secrets 注入改宿主
  路径门控（fork 空过语义不变）；SDK secrets 分片 P2-M1 收口时删除；
- 出网稳定性观察（risk 8 补记）：2026-09-16 窗 #2（10:09–10:22 UTC，ci-01，
  run `35083349130`，arch×2 + session-lifecycle，2 rerun）、窗 #3（11:54–11:59
  UTC，ci-02，run `35091905412`，1 rerun）、**窗 #4（13:20–14:50+ UTC，双机，
  run `35101465356`，10+ 次 job 失败跨 4 轮 rerun——最长窗，新签名 codeload
  action 下载超时；由本 packet 内授权的 git 代理缓解收口，7/7 全绿）**——当日
  累计 4 窗，两日累计 10 窗；
- **git 出网缓解已授权并落地（2026-09-16，用户"两项都做"裁决）**：双机
  `git config --system http.https://github.com/.proxy` 指向 devbox 8118 代理
  （host1 本机、host2 经网关；地址不入 repo）；宿主机级 git 配置经既有
  out-of-band 通道下发，**不触碰 systemd unit / runner .env / workflow env，
  probe 的 proxy-env 证据面零污染（红线兼容）**；双机以 `vbmf-ci` 身份
  `git ls-remote` 经代理实测通过；**残余面：codeload action 下载走 runner
  HttpClient，仅进程代理可治——维持 rerun 口径（用户未豁免 systemd 注入红线）**；
  Strategy §15.11 文档化随 P2-M1 落盘。

### 3.15 P2-M1 — `hardware-test-compile` 迁移 vbmf-media tier（SDK host 预装落地）

Status: **COMPLETE（2026-09-17）**

- **段 1（repo 侧，`c351edd`）**：`pin-decklink-sdk.sh` / `verify-decklink-sdk.sh` /
  `collect-toolchain.sh` SDK 段 / `test-decklink-sdk-scripts.sh`（29/29 PASS）；
  Strategy §15.10（media tier 供给 runbook，§15.3 义务 1）+ §15.11（出网 git
  代理缓解文档化，P2-M0 欠账）；probe allowlist += `vbmf-media`；
- **段 2（host 侧，用户一次授权五项）**：KVM VM `vbmf-ci-media`（8C·16G·100G，
  devbox libvirtd，cloud-init seed 复用 ci-02 模式）；系统库（libclang-21 /
  GStreamer 1.28.2 dev / protoc 3.21.12 / pkg-config）；runner 注册 labels
  exact `{self-hosted,Linux,X64,vbmf,vbmf-media}`，R1–R5 PASS；Rust 1.98.1
  pin（幂等双跑，V1–V6 全 PASS）；**DeckLink SDK 16.0.0 host pin（zip 经
  out-of-band 三段 md5 一致中继上机；42 头；V1–V4 全 PASS；manifest
  `decklink_sdk` 段落盘）**；probe（tier=vbmf-media）PASS @ vbmf-ci-media；
- **RCA（`11e9dfb`）**：必备头清单修正——SDK 16.0 的 `DeckLinkAPIDispatch`
  是 `.cpp` sample 非 header；正确核心四头 = `DeckLinkAPI.h` /
  `DeckLinkAPIConfiguration.h` / `DeckLinkAPITypes.h` / `DeckLinkAPIModes.h`
  （fail-closed 预检在动 canonical 路径前拦住，零污染）；
- **段 3（workflow，`7196a0a`）**：条件 `runs-on`（vbmf-media）；secrets
  env/unpack/`_private` cleanup 全删；self-hosted fail-closed SDK 验证步 +
  §3.6 RCA env 契约 + `target-hwtest` 外置 + staging 拷贝；github-hosted
  （fork）空过语义不变；CI run `35172539232` rerun 后 **7/7 全绿**，
  `hardware-test-compile` @ **vbmf-ci-media** 实跑（log：`DeckLink SDK:
  16.0.0 (host-preprovisioned)`；`media-agent-linux` artifact 6495056B +
  `decklink-bindings-debug` 15872B，非空过）；
- **secrets 收口**：`DECKLINK_SDK_HEADERS_1/2` + `DECKLINK_SDK_VERSION` 已从
  GitHub 删除（`gh secret list` 空）；**D1 裁决的 gstreamer-build 空过窗口
  自此开启**（其 yaml 未动，`env != ''` 门自然为假，github-hosted 上空过绿；
  P2-M2 迁 vbmf-media 后恢复真实构建）；
- 出网观察：2026-09-17 窗 #1（media VM 首跑 checkout GnuTLS 失败，
  run `35172539232` 首次尝试，rerun 收口）；缓解同日扩展到 media host
  （git system proxy → 网关 8118，模式与双 general 机一致，红线兼容）。

### 3.16 P2-M2 — `gstreamer-build` 迁移 vbmf-media tier（P2-M 全链收口）

Status: **COMPLETE（2026-09-17）**

- 单 commit `0c4bbd1`（基线 `8238f0b`）：条件 `runs-on`（vbmf-media，P2-M1 逐字
  模式）；secrets env（`DECKLINK_SDK_HEADERS_1/2`/`DECKLINK_SDK_VERSION`）+
  `_private` unpack + `if: always()` cleanup 全删；self-hosted fail-closed 门 =
  SDK 16.0.0（P2-M1 同款）**+ pkg-config `gstreamer-1.0`/
  `gstreamer-plugins-base-1.0` 门（D2 新增）**；§3.6 RCA GITHUB_ENV 契约 +
  独立 `target-gstbuild`；staging 拷贝 + upload-artifact v4；fork 路径
  checkout+dtolnay+apt 保留 github-hosted 门控（D3，语义零变化）；
- Strategy 事实同步：§15.1 `vbmf-ci-02`/`vbmf-ci-media` 行翻 ✅ 在役（D4，
  ci-02 为 P2-A 历史欠账）、§10 L218 "（secret 注入）" → "（host 预装，§15.3
  裁决 B）"；
- CI run `35177980436`（push main `0c4bbd1`，run_attempt 1）：**7/7 required
  首跑全绿，零 rerun、零出网窗**；`gstreamer-build` @ **vbmf-ci-media**
  （job `105063812333`，labels exact）；log `DeckLink SDK: 16.0.0
  (host-preprovisioned); GStreamer dev: 1.28.2`；真实构建 109 crates
  `Finished dev 53.26s`；
- **D1 空过窗口关闭**：artifact `media-agent-gstreamer-linux` 恢复非空
  （12331677B）；P2-M1 删 secrets 后的空过绿过渡态结束；
- 结构断言：其余 6 job byte-identical（基线 `8238f0b`，comment-stripped
  job-block diff）；workflow 级 triggers/permissions/concurrency/defaults 不变；
- 验证：Runtime 机械检查 5/5 passed + 独立只读 Verifier 两轮（attempt 1 的
  log-evidence 检查 grep ANSI 正则缺陷——色码位于 `Finished` 与 `` `dev` ``
  之间；attempt 2 以 sed 去 ANSI 版替换后 5/5 passed；实现零缺陷）；用户已
  接受验收结果；
- **P2-M 全链完成 / Phase 2 灰度阶梯走完**：P2-M0 裁决 B → P2-M1（tier 供给 +
  SDK 预装 + hardware-test-compile + secrets 删除）→ P2-M2（gstreamer-build）；
  self-hosted 条件 `runs-on` 已覆盖全部 7 个 required job。

### 3.17 STAB-O3.1 — C2-O3-1/E2 + C2-O3-2/E3A 证据恢复登记（RSS RCA 分叉收窄）

Status: **RECOVERED / REGISTERED（2026-09-17；分叉证据·非因果·不改判 24h FAIL）**

- **恢复叙事**：E2（单输入 2.5h·2026-09-11）与 E3A（selftest 源族 45m·2026-09-12）
  在旧环境执行于 `diag/c2-o3-e2-single-input` / `diag/c2-o3-e3a-selftest` 两分支，
  随 2026-09-15 分支收敛删除且未 merge——证据从未入 main。本轮经 dev VM→盒
  （lytv@10.30.15.10·id_pwl·本窗口打通的通道）只读拉取 165+2 件，md5 盒=origin
  161/161（唯一披露：E2 observer-console.log 的 md5s 行为终行追加前旧哈希·
  双端直核一致）；盒上 `~/media-agent-build` .rs 78/78 与 main 逐字节一致。
- **E2 裁定**（冻结判读表行1）：单输入下 reservation-family 扩展照旧 ⇒
  **双输入/双实例不是必要条件**；附属行3 事实：量子化 workload-sensitive
  （连续涓流 0.87kB/s·边界 ~1190s 迁 ~1MB vs 双输入离散 5.5MB@7100s）；
  每输入聚合速率相等（2.99 vs 2.81MB/h·差 6%）；PROGRAM_SWITCH=ABSENT 且
  零切换下照增 ⇒ program graph/切换/ExecutionGroup/make_mut 探针全部排除为
  必要条件。
- **E3A 裁定**（同 bin 干净差分）：DeckLink 源族整体移除后 45min VmRSS 恒定
  21956kB·smaps 零变化 ⇒ **DeckLink 源族配置 = 形态必要条件之一**。
- **候选空间收敛**：每输入 DeckLink 源族 ingest native 分配链 × allocator
  reservation/arena 行为；六环已过 same-reservation/magnitude/repeatability，
  allocation-path/allocator-behavior 未证——无 root cause 结论。
- **偏差披露**：E2/E3A bin=ad89c6d3 ≠ 冻结 f52b0161（盒上构建时 Cargo.lock
  重解析——main 的锁不含 glib/gstreamer 可选条目·结构性债务登记）；E2 vs
  双输入历史 run 对比带依赖补丁版本混杂（E3A 同 bin 对照干净）；f52b0161
  锁版本不可重建（历史 build.log 均缓存命中）。
- 通道事实：盒 SSH = lytv@10.30.15.10 + `~/.ssh/id_pwl`（dev VM·非默认键名）；
  设备占用复核：gst-launch 历史进程（device-number=2）仍在（pid 992634），
  诊断 run 绑定空闲设备不受阻；盒上无残留 media-agent 服务。
- 分析文件：`evidence/bmd-10.30.15.10/c2o3-analysis/c2o3-e2-e3a-recovery-analysis.txt`
  + EVIDENCE-INDEX 三行。
- **收口（2026-09-17 用户裁决"123"）**：①STAB-O3.1 判定
  **INCONCLUSIVE-at-allocation-path + 候选空间收敛登记**（验收满足
  "owner 候选收敛或明确 INCONCLUSIVE"——procfs observer 面已尽·禁入清单未动·
  allocation-path/allocator-behavior 两环在现红线内不可证）；②深挖转为
  STAB-O4 首刀 = E4 型生产代码观测点（用户已授权该面·gstreamer crate API
  内省/pool 统计属 Rust 可达面·非 GST_DEBUG env）；③Cargo.lock 结构性债务
  已修：commit `7a9f696`（盒已知良全量锁·纯超集 94⊆145·双版本共存非抬升），
  CI run `35185240143` 7/7 首跑全绿——盒上 feature 构建不再重锁。

### 3.18 STAB-O4/FIX 收口（2026-09-17·E4-1 观测完成 + NO-FIX-IN-REPO）

**STAB-O4 首刀 E4-1 = INGEST-ANATOMY 生产观测点（已执行并判读）**

- 实现：中性层 `pipeline_events::IngestAnatomy`（固定容量计数·probe 侧零逐帧
  堆分配）+ controller decklinkvideosrc/audiosrc src pad BUFFER probe + bus
  watch 计数 + bin 诊断模式 30s 采样线程（`E4_INGEST_ANATOMY` info 行·
  diagnostic-only·生产模式零 spawn 零暴露·wire 契约零改动）；commits
  `430d5e7`+`e769cb9`+`9146e1e`（CI 35189959415 7/7；盒 `cargo test e4_` 3×绿）。
  设计先于数据冻结：`c2o3-analysis/c2o4-e4-ingest-anatomy-design.txt`。
- 盒执行：CYCLES=315 DWELL=28 双输入（bin=9146e1e·.rs 78/78 md5==main·零重锁）
  + observer v2.1 同面（COMPLETE/95%/trig 2+）；runner 机械 verdict
  PASS 10/10（informational only·不入梯）。
- 判读（冻结表机判·`c2o4-e4-ingest-anatomy-analysis.txt`）：**R-A 稳态成立**
  ——604 快照 video 速率 24.987-25.033/s·sizes 单指纹·meta 恰
  2.0×GstReferenceTimestampMeta/buffer·pts_backward=0·bus 线性低量 ⇒
  重协商/meta 累积/PTS 抖动/bus 洪流四类 pad 可见异常**排除**；
  **5.5MB 批触不在 pad 可见分配流内**（时窗三点计数全稳）；observer 逐 kB
  对账 ΔRss==ΔVmData==ΔRssAnon·VmSize 平直·批触 = 两离散台阶
  +5588/+5588kB（恰一台阶/输入·rel 7136/7148）落在既有 64MiB 形态匿名预留
  ——RESERVATION-EXTENSION 第五次复现·步量与 c2o2 逐 kB 相同·每输入
  2.50MB/h 对上历史 2.81/2.99（窗效应内差异）。六环：same-reservation/
  magnitude/repeatability 再证；**allocation-path 收窄至 pad 面之下 native
  分配链（仍开放）**；allocator-behavior 不可证（红线内）；root cause 未定。
- **FIX 判定 = NO-FIX-IN-REPO（诚实缺席）**：Rust 可达面（FIX 原则 A–D 作用面：
  显式 retention/pool acquire→release 链）在全部观测面上零表征；对 native
  内部行为做 repo 侧修复 = 无证据投机。后果：修复后 2h/8h/24h ladder
  **不触发**；24h rss_bounded FAIL 原样立档；stability verified 维持未标。
  E4 观测点本身保留（diagnostic-only 诊断能力）。残留路径登记不执行：
  SDK/插件版本变更后重跑 E3A 同构差分。
- 附带发现（独立登记·RUNTIME-HARDEN 候选）：**MainContext::default() 单持有者
  缺陷**——build_pipeline Bus watch 线程 push 进程级默认 context，双输入下
  第二条管线 bus watch 静默缺席（handle2 bus_msgs_total=0 生产实证·致命事件
  通道单管线化）；修复方向 = 每实例独立 `MainContext::new()`。
- 证据：`2026-09-17-c2o4-e4-ingest-anatomy-2p5h{,-observer}/`（21+99 件·md5
  盒=origin）+ 分析文件 + EVIDENCE-INDEX 三行。

### 3.19 RUNTIME-HARDEN entry review（2026-09-17）

Status: **COMPLETE / ADJUDICATED**。

- 入场裁决：进入 RUNTIME-HARDEN；不先做低风险代码洁癖，而先关闭 §3.18 BMD 已实证的多输入 Bus 故障观测缺口。
- RCA 复核确认这是两层缺陷：① `build_pipeline` 每实例 Bus 线程使用进程级 `MainContext::default()`，第二实例 `with_thread_default` 获取失败而静默退出；② Execution Group 形态的 `spawn_execution_group_watchdog()` 只读 `HEALTH_ARCS`/Program observation，**不 drain `ctrl.observe(handle)`**，因此即使 Bus watch 恢复，多输入 Error/EOS/ClockLost 仍不会进入 canonical event→Supervisor 闭环。
- 裁决：拆成两个连续 bounded packets，禁止只改 `MainContext::new()` 后宣称故障闭环修复。`RH-BUS-01` 先恢复 per-pipeline Bus watch 隔离与生命周期；`RH-BUS-02` 再把每输入 Bus event 消费/归因/overflow fatal fallback 收敛到多输入 watchdog。
- 后续 hardening 采用 dependency gate：D1 LifecycleJournal → D3 per-claim TTL → D7 backend direct field 为 Runtime Features 通用前置；D11 Clock timeline 与 D13 timecode hardening 合并到 Clock/Timecode 下一触碰点；D15 在多 flow 能力前；durable idempotency 在持久 Control Plane 前。不得为“清债”阻塞与其无依赖的 Runtime Feature。
- Authority/Contract：**无 frozen Contract 变化**；本裁决只把已有 Runtime truth / failure-first / multi-input isolation 约束转换为执行顺序。

### 3.20 RH-BUS-01 收口（2026-09-17）

Status: **COMPLETE / SOFTWARE + BMD HARDWARE VERIFIED**。

- 实现 commit：`9b32004fa6b9d5f1d6492bd37b15070339f7b22d`。每个 GStreamer pipeline 的 Bus thread 使用私有 `glib::MainContext::new()`；Bus 通过 `Bus::create_watch(...).attach(Some(&ctx))`、stop poll 通过 `timeout_source_new(...).attach(Some(&ctx))` 显式附着同一 context。禁止退回 `add_watch` / `timeout_add_local` 的默认 context 隐式绑定。
- RCA 中间态被测试拦截：仅把 `MainContext::default()` 改成 `new()` 会让 Bus source/stop timer 仍挂默认 context，私有 MainLoop 无 source，导致 stop join 卡死；该半修复**未入库**。
- 软件验证：BMD `/tmp` 非设备 self-test 形态 `cargo fmt --all -- --check` PASS；focused `cargo test --features gstreamer rh_bus_` **2/2 PASS**；full `cargo test --features gstreamer` **268/268 PASS**。
- BMD exact-commit hardware：由 `git archive 9b32004`（archive sha256 `08f278e5…a255d`）构建 `--features bmd,gstreamer`；manifest v5 md5 `7521d17e…43dd`，输入 device-number `0/1`，现存输出 device-number `2` 未停止/未受扰。30s E4 快照：**handle1 bus_msgs_total=65，handle2=65**，两路 video/audio 均持续出帧且 `pts_backward=0`；历史同形 E4 的 handle2=0 缺陷不再复现。`stop_session`=executed，Program teardown + group-watchdog stop 均有日志；Bus/MainContext failure 行=0。
- CI：GitHub Actions run `35214894696`，commit `9b32004…`，**7/7 success**。
- 证据：`evidence/bmd-10.30.15.10/2026-09-17-rh-bus-01-per-pipeline-context/` + `docs/superpowers/reports/2026-09-17-rh-bus-01-per-pipeline-bus-context.md`。
- 边界：RH-BUS-01 只关闭“每 pipeline Bus source 可被独立分发 + lifecycle 可终止”；Execution Group 仍未 drain 每输入 `ctrl.observe(handle)`，以及 fatal sticky 仍为全局单槽——两者由 RH-BUS-02 接管，**不得把 RH-BUS-01 写成多输入故障闭环已完成**。

### 3.21 RH-BUS-02 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + BMD HARDWARE + CI VERIFIED**。

- 实现 commit：`92d60075161ef080b599ce69a89a482b3798786b`。Execution Group watchdog 对每个 `(device_id, handle)` 每 tick 独立 drain `ctrl.observe(handle)`；handle 错配 fail-closed 拒收，绝不重归因。Error/EOS 先经既有 `Supervisor::ingest` 归一为 exact-device canonical `PipelineFault`，再由 intake drain 后的 canonical RuntimeEvent 派生 Supervisor 决策候选；raw Bus 事实不形成第二条决策 truth path。ClockLost 保持 degraded/no-auto-restart 冻结策略。
- fatal overflow：进程级 `LAST_FATAL_BUS_EVENT` 单槽退出生产路径，改为 `GstInstance` per-handle `fatal_fallback`；成功 send 不写 fallback，只有 channel Full + Error/EOS 落槽，`poll_bus(handle)` drain 后原子 take，stop/recover 随实例生命周期重置。
- software：BMD `/tmp` exact source tree `cargo fmt` PASS；RH-BUS focused GStreamer **12/12 PASS**；full `cargo test --features gstreamer` **278/278 PASS**；协调者 default/mock regression PASS。确定性测试覆盖 Error/EOS exact-device canonicalization、ClockLost no-restart、mismatched-handle rejection、same-device dedup、A/B 独立候选、per-handle overflow fallback 与 successful-send no-duplicate。
- BMD exact-commit：`git archive 92d6007`，archive sha256 `1007ac91de95a861382488abfc5051f660eb96b56e981951d94faa403504536d`，manifest v5 MD5 `7521d17e7fd02e50eb2b0a84374a43dd`。A2-8 dual-input L1–L5+Teardown **10/10 PASS**：A fail→B alive/program advancing；recover A→A bridge 恢复；B fail→A alive；故障归因不跨输入；teardown 完整。
- production group-watchdog 证据：handle 1/2 均出现首次真实 Bus 消费行；同一 30s E4 snapshot `bus_msgs_total=65/65`，两路 video/audio advancing、`pts_backward=0`。`stop_session=executed`；post-stop session=`released`、两 input resource=`available`、Program=null；既有 output device-number 2 进程保持存活。
- CI：codeload 出网故障在 RH-BUS-02 收口期确定性复现，不归因代码。已采用 GitHub Runner 官方 `ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE` 作为主缓解，4 个 external Actions pin immutable SHA，三台 self-hosted runner cache/probe 均 PASS；current-tree run `35248227420` @ `94bf34e659fadc8c8b58a3a252fd36b53fc177db` **7/7 success**，其中此前失败的 `rust-test-matrix@vbmf-ci-02` 已越过 Set up job 并完成真实 default/simulation/mock tests。
- 证据：`evidence/bmd-10.30.15.10/2026-09-17-rh-bus-02-multi-input-fault-isolation/`（14 件 sha256）+ `docs/superpowers/reports/2026-09-18-rh-bus-02-multi-input-bus-fault-isolation.md`。后续 `f05ec60/86669b7/94bf34e` 仅 CI infrastructure；**hardware verified 仍只归 exact Runtime commit `92d6007`**。
- Authority/Contract：无 frozen Runtime Contract 变化；仅关闭既有多输入 failure-observation / attribution 缺口。

### 3.22 RH-LC-01 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI VERIFIED / BMD RUNTIME SMOKE DEFERRED**。

- 实现 commit：`c72ce5dba94fe815299ddfbbe2921f8252df7e59`。`SessionManager::start()` 新增私有 `CompletedStep[]` journal 与单一 `rollback_start_journal()`，materialize / empty-plan / instantiate / partial-allocation / backend.start 失败统一进入同一 rollback owner；create/stop/Program ownership 不变。
- 冻结安全序保持：全部已实例化/已启动 handles 逆序 stop → holder allocations → leases → reservations；`AllocationAcquired` 仅在首个 claim 成功后登记，journal 不记录未完成副作用。
- failure-first：新增双输入“第二句柄 start 失败”测试，机械断言 stop 顺序 `[101,100]`、每句柄恰一次、零 lease/resource orphan、失败会话不回填 handles；既有 materialize/instantiate/instantiate-second/partial-allocation/start failure 全部继续通过。
- Development VM：Rust 1.98.1；mock lib **429/429** + integration **9/9 + 12/12**；default lib **246/246**；fmt + default/mock clippy `-D warnings` PASS；CodeGraph 已同步。
- CI：GitHub Actions `35279581145` @ `c72ce5d…` **7/7 success**；`gstreamer-build --features bmd,gstreamer`、`hardware-test-compile`、`session-lifecycle`、完整 `rust-test-matrix` 均 PASS。
- BMD：exact commit archive 已复制到 `/tmp/vbmf-rh-lc01-c72ce5d`，archive sha256 `78de0709ea7e757d34e1497361cc3fbab725e972441551a6c4a1feba050fdeb9`，manifest v5 MD5 `7521d17e7fd02e50eb2b0a84374a43dd`；旧 `/opt/vbmf-dev/repo` 未改、device-number 2 未触碰。远端 build/runtime smoke 被当前工具安全层拦截，故明确 **DEFERRED**，不得继承旧硬件 PASS。
- Authority/Contract：无 frozen Contract 变化；`PHASE_0_7A_POST_MERGE_DEBT.md` D1 标 CLOSED。验收报告：`docs/superpowers/reports/2026-09-18-rh-lc-01-lifecycle-journal.md`。

### 3.23 RH-RES-01A 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI VERIFIED / BMD NOT REQUIRED**。

- Runtime commit：`0718757e42146cb41bd313e227f5fc7f19f3a171`。Reservation TTL truth 从 Session `created_at_ms` 近似迁入 Resource Registry 的 per-claim lifecycle。
- `Reservation` 持有内部 `expires_at_ms`（`#[serde(skip)]`）；`acquire(req, now, ttl)` 建立独立 deadline；`renew_claims` expected-claims 同锁域 all-or-none；`expire_due` per-claim Expire；`abort_reservations_of` exact-holder Abort。
- Session 不再维护第二套 Reservation 时间真值；Binding 完成作为进度点 Renew，tick 只消费 Registry expired claims 并执行 sibling Abort、lease cleanup、Session→Terminated 收敛。
- failure-first：wrong-holder Renew 拒绝；TTL 已到但未 scan 不得 Renew 复活；multi-claim Renew 失败不得部分延长 sibling；单 claim 到期触发同 Session 其余 claim Abort；wire JSON 不暴露 TTL 内部字段。
- Development VM：Resource focused **7/7**；Session `resource_rt_01_*` **6/6**；mock **432/432 + integration 9/9 + 12/12**；default **248/248**；fmt + default/mock clippy PASS。
- CI：GitHub Actions `35293309933` @ `0718757…` **7/7 success**，含 `gstreamer-build` 与 `hardware-test-compile`。
- Hardware：本 packet 未改 DeckLink/GStreamer adapter 或媒体数据面，BMD runtime/hardware smoke **NOT REQUIRED**；不得写成 hardware verified。
- Authority/Contract：无 frozen Contract / wire vocabulary 变化；D3 标 CLOSED。报告：`docs/superpowers/reports/2026-09-18-rh-res-01a-per-claim-reservation-ttl.md`。

### 3.24 RH-RES-01B 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI VERIFIED / BMD NOT REQUIRED**。

- Runtime commit：`fb8bc81c737bfb668342181e62d0cf903e29c941`；`SessionManager.backend` 从 `OnceLock<Arc<dyn MediaBackend>>` 收敛为 constructor-owned `Arc<dyn MediaBackend>`。
- 全仓 audit：`set_backend()` 真实 caller = **0**；删除 late-injection helper 与“backend 未注入”运行分支，`SessionManager::new(... backend ...)` 继续是唯一注入点。
- `SessionError::BackendUnavailable` 与 error-model 分类仍保留，本 packet 不扩大词表/错误模型清理范围。
- diff 仅 `session.rs` **+5/-19**；start 用 `Arc::clone(&self.backend)`，stop 直接消费同一 constructor instance；MediaBackend/Adapter 行为不变。
- Development VM：mock **433/433 + integration 9/9 + 12/12**；default **249/249**；fmt + default/mock clippy PASS；CodeGraph 已同步。
- CI：GitHub Actions `35293860197` @ `fb8bc81…` **7/7 success**。
- Hardware：constructor representation only，未改 GStreamer/DeckLink 数据面；BMD smoke **NOT REQUIRED**。
- Authority/Contract：无 frozen Contract 变化；D7 标 CLOSED。

### 3.25 Runtime Features entry review（2026-09-18）

Status: **COMPLETE / RECONCILED；RF-FF-01A READY**。

- 旧 `ARCHITECTURE_V0.2.md` Source Adapter 表中的“11 adapters 已实现”属于历史 implementation/status 描述，不能覆盖 live STATE/code/tests。live `SourcePlan` 仅 DeckLink selection + SelfTest，adapter tree 无 network-source adapter；Network Sources 仍是 BACKLOG。
- PACKET_SWITCH 需要 compressed source domain；live execution 明确拒绝 Packet/Master。MASTER_SWITCH 依赖 Normalize，并在触碰时触发 RH-CLOCK-01。Hot-Standby 依赖可用 source/switch；Composition/Audio 会触发 RH-FLOW-01；persistent control-plane 前才触发 RH-IDEM-01。
- `MEDIA_BACKEND_CONTRACT §4` 明确 GStreamer→FFmpeg 是合法替换轴，要求只替换 Backend + RuntimeBinding、不改变 CanonicalPipelinePlan。
- live `PipelinePlan::SourcePlan` 仍含 GStreamer 专属 `device_number / SourceSelectionMode`，与 frozen Backend contract 存在实现漂移。直接做 FFmpegBackend 会迫使 FFmpeg 解释 GStreamer binding，禁止。
- 因此第一 bounded feature packet 裁决为 **RF-FF-01A — Backend-neutral RuntimeBinding extraction（FFmpeg prerequisite）**：先把 backend-specific runtime address 从 canonical plan 分层出去；GraphRuntimeIntent/wire 不变，属于实现对齐 frozen Contract，不是修改 frozen Contract。
- RF-FF-01A 会触及 GStreamer input binding，验收必须包含 BMD exact-commit 双输入 smoke。报告：`docs/superpowers/reports/2026-09-18-runtime-features-entry-review.md`。

### 3.26 RF-FF-01A 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED**。

- Runtime commit：`0dd37bc1215677cdd2c823d31e9ca3eb307dde26`。canonical `SourcePlan` 删除 GStreamer runtime address：`device_number` / `provider_persistent_id` / old `SourceSelectionMode`。
- 新 `SourceBindingClass::{Persistent, Resolved, DiagnosticFallback, SelfTest}` 只表达 backend-neutral binding class；实际 `ResolvedDeviceBinding` 由同一 `GStreamerPipelineController` 在组合根注入并于 instantiate 时解析。
- `AdapterRegistry` 保持单 concrete controller ownership；production + 四个真实 hardware gate 走 explicit `*_with_bindings`，空-binding constructor 只留 SelfTest/structure-only tests。
- failure-first：Resolved 缺 binding FAIL；Persistent 缺 persistent_id FAIL；Diagnostic 非 canonical device_id FAIL；仅 canonical ID + binding 缺席的 Diagnostic 明确保留 device-0 fallback；SelfTest 无 hardware binding。
- canonical SourcePlan serde 守门断言禁止 `device_number/provider_persistent_id/persistent_id/gstreamer` runtime-address key 泄漏；`GraphRuntimeIntent`、command/wire、Session/Resource truth 未改。
- Development VM：focused `src_props_*` **7/7** + Persistent materialize **2/2**；mock **435/435 + integration 9/9 + 12/12**；default **251/251**；fmt + default/mock clippy PASS。Dev VM `bmd,gstreamer` 因缺 system pkg-config 开发库未完成，不记 PASS/FAIL。
- CI：Actions `35296461203` @ `0dd37bc…` **7/7 success**；其中 vbmf-media `gstreamer-build` 与 `hardware-test-compile` PASS，补齐 Dev VM GStreamer build 环境缺口。
- BMD exact commit：archive sha256 `d9ec96bd…514401`；v5 manifest MD5 `7521d17e…43dd`；native `cargo build --features bmd,gstreamer --bin media-agent-gates` PASS；Dual Input Gate **10/10 ALL PASS / rc=0**，输入 0/1 production binding 2/2、实际帧/PTS、L4、L5 recover、teardown 全 PASS。
- BMD historical output device-number 2 PID before/after 均 `992634`；stale `/opt/vbmf-dev/repo` 未改。Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01a-runtime-binding/`。
- Authority/Contract：无 frozen Contract 变化；本 change 是 live implementation 向既有 `MEDIA_BACKEND_CONTRACT §4` 收敛。报告：`docs/superpowers/reports/2026-09-18-rf-ff-01a-runtime-binding-extraction.md`。

### 3.27 RF-FF-01B 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD RUNTIME SMOKE VERIFIED；DECKLINK HARDWARE NOT EXERCISED**。

- Implementation chain：`7ebd5514497c5428b5f865db0333be690b425386` → architecture fix `4ad8135e8c4f1daa7c73cd193a888cc29a93f830`。
- `FFmpegBackend` 在 adapter 层持有唯一 `PipelineHandle -> Child` process table；通过既有 `MediaBackend` SPI 实现 instantiate/start/stop/recover/observe。
- 启动使用 `std::process::Command` + backend-owned argv，不接受 shell command string；stop/recover/drop 均回收 child。failure-first tests 覆盖 spawn failure、abnormal exit、duplicate start、unknown/never-started recover、recover-spawn failure 与 orphan PID。
- 第一轮 CI `35312763403` @ `7ebd551` 因 registry 直接命名 concrete FFmpeg type 触发 architecture-portability FAIL；`4ad8135` 将 concrete construction 收回 `adapters::build_process_media_backend()`，protected orchestration 仅见 `Arc<dyn MediaBackend>`。
- Development VM：focused FFmpeg lifecycle **8/8 PASS + 1 ignored real-binary smoke**；full ffmpeg-backend **261 PASS / 1 ignored**；default **252/252**；mock **436/436 + integration 9/9 + 12/12**；fmt、ffmpeg-feature clippy `-D warnings`、`git diff --check` PASS。
- CI：Actions `35313253516` @ exact `4ad8135…` **7/7 required jobs PASS**。
- BMD exact commit：archive sha256 `90c11f7983b8711f78bc37eee0b92e6ccb48b09de0a3ae47cd5220d560a2eca0`；真实 `/usr/local/bin/ffmpeg` canonical SelfTest **1/1 PASS**；历史 output device-number 2 PID before/after 均 `992634`。
- Verification level：本 packet 的 FFmpeg process/runtime smoke 已在 BMD 实证；测试路径为 lavfi video/audio → null，**未打开 DeckLink input/output，因此不得写成 DeckLink hardware verified**。
- Authority/Contract：无 frozen Contract 变化；GraphRuntimeIntent/wire/Session/Resource truth 未改。Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01b-ffmpeg-selftest/`；报告：`docs/superpowers/reports/2026-09-18-rf-ff-01b-ffmpeg-process-lifecycle.md`。

### 3.28 RF-FF-01C 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED**。

- Runtime commit：`ffee3a057d7d4bebde26a7bf9a6294501047a021`。FFmpeg DeckLink input address 不复用 GStreamer `device-number`；BMD `ffmpeg -sources decklink` 实证输入地址为 Blackmagic DeviceHandle。
- FFmpeg adapter 只从**授权 v2 DeviceBindingManifest + live Blackmagic Provider identity** 生成私有 `DeviceId -> DeviceHandle` view；CanonicalPipelinePlan/GraphRuntimeIntent/wire 不新增 vendor address。
- 仅 manifest Input/Bidirectional + exact single live Provider match 被接受；missing/ambiguous/output-only/non-SDI/invalid canonical ID/unsupported binding class/output plan 全 fail-closed；无 shell-string、无 runtime 自枚举/猜测/fallback。
- Development VM：focused `ffmpeg_rt_02` **5/5 PASS**；full ffmpeg-backend **266 PASS + 1 ignored BMD acceptance**；default **252/252**；mock **436/436 + integration 9/9 + 12/12**；fmt、ffmpeg/mock clippy `-D warnings`、diff-check、architecture lint、remove-adapters proof 全 PASS。
- CI：Actions `35339165383` @ exact `ffee3a0…` **7/7 required jobs PASS**；media runner 新增 `cargo test --no-run --features bmd-provider,ffmpeg-backend` PASS。
- BMD exact commit：archive sha256 `384d798791174bc851116202f401d8b41ff82dabdee24e910ce59c0da90022e7`；manifest `/home/lytv/a2-8-02i-v5.manifest.json`；显式输入 `46:00000000:002e4500`。
- BMD frame probe：自动识别 **1920x1080 25.00i** + embedded stereo audio，**50 frames / 2.00s / rc=0**；VBMF `ffmpeg_rt_02_real_decklink_resolved_binding_lifecycle` **1/1 PASS**，覆盖 start→observe→recover→observe→stop。
- teardown：FFmpeg leftover=NONE；历史 output device-number 2 PID before/after 均 `992634`，未扰动输出。
- Authority/Contract：无 frozen Contract 变化；Session/Resource truth 未改。Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01c-decklink/`；报告：`docs/superpowers/reports/2026-09-18-rf-ff-01c-ffmpeg-decklink-binding.md`。

### 3.29 RF-FF-01D 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED**。

- Runtime commit：`dd0eb8ce5f6dd7925731b23cc44d542805ed43e3`。新增 backend-neutral `BindingAuthorization`，Session/Preflight/materialize/RuntimeState 不再把 `ResolvedDeviceBinding` 的 concrete runtime address 当 binding truth。
- authorization 只携 confidence/match 语义 + persistent identity evidence bit；GStreamer `device-number/persistent-id` 与 FFmpeg DeviceHandle 均继续留在 concrete RuntimeBinding/adapter 层。
- manifest authorization 只接受 exact live `RealBmd` + provider=`blackmagic` DeviceHandle；missing/ambiguous/foreign-provider/weak authorization fail-closed。中性授权使用 `DeviceHandleExact`，不冒充 concrete GStreamer `ManifestVerified`。
- Production Preflight 缺 authorization 直接 FAIL；Diagnostic 保留显式 WARN fallback。Resource Reservation→Binding→Backend 顺序与 Session/Resource owner 不变。
- Development VM：focused RF-FF-01D **6/6 PASS**；Session focused mock **31/31**；default **258/258**；mock **436/436 + integration 9/9 + 12/12**；ffmpeg-backend **272 PASS + 1 ignored HW**；fmt、default/mock/ffmpeg clippy `-D warnings`、diff-check、architecture lint、remove-adapters proof 全 PASS。
- full regression 曾捕获 `PreflightInputs.require_authorization` 新字段在测试构造点缺失的 compile gap；已按 Diagnostic=false / Production mode 显式语义修正，未删除测试或降低门禁。
- CI：Actions `35342501850` @ exact `dd0eb8c…` **7/7 required jobs PASS**。
- BMD exact commit：archive sha256 `e622f08337477fbb7206a8353399279f926a6b8a6ed787ad70366850ed549875`；v5 manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd`；native bmd,gstreamer build PASS；Dual Input Gate **10/10 ALL PASS / rc=0**，L1–L5 + recover + teardown 全 PASS。
- BMD historical output device-number 2 PID before/after 均 `992634`，leftover=NONE。运行中观察到既有 interlace converter / pad-unlink GStreamer CRITICAL diagnostics，但未导致本 exact run 的 verdict/frame/PTS/recover/teardown/process-leak failure；作为 observed runtime warning 保留。
- Authority/Contract：无 frozen Contract 变化；CanonicalPipelinePlan、GraphRuntimeIntent/wire、Session/Resource/Lease owner 未改。Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01d-binding-authorization/`；报告：`docs/superpowers/reports/2026-09-18-rf-ff-01d-session-binding-authorization.md`。

### 3.30 RF-FF-01E 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED**。

- Runtime implementation：`265667817bb9e3f4e50a404f6c4ee8af525593a9`；acceptance dispatch fix：`96f8055e1a9fa791cdbed8146fbd2b8eedfc9495`。新增唯一 production `bootstrap::build_ffmpeg_session_composition`，由 production bin 与 BMD gate 同源消费。
- production composition 保持单链：Device/Port authorization → ResourceRegistry → Lease/Preflight → SessionManager → FFmpeg `MediaBackend`；未增加第二套 Session/Resource/Lease/Runtime truth，FFmpeg DeviceHandle 仍只在 adapter 私有 view。
- production 启动只构造依赖，不自动选择/启动媒体；BMD production smoke 实证 provider=blackmagic、backend=ffmpeg、authorized_devices=2、authorized_ports=2，且目标 FFmpeg process 未出现。
- Development VM：focused RF-FF-01E **3/3 PASS**；implementation commit 上 ffmpeg-backend **275 PASS + 1 ignored HW**、default **258/258**、mock **443/443 + integration 9/9 + 12/12**；fmt、default/mock/ffmpeg clippy、architecture lint、remove-adapters、diff-check PASS。final fix exact `96f8055` 再跑 focused 3/3 + ffmpeg clippy/fmt/diff PASS。
- 首轮 BMD @ `2656678` 的真实 Session create→Leased→start→Running→stop→Released 已全部成功，但 gate 成功后 fall-through 到通用 footer 导致进程 rc=2；RCA 为 acceptance dispatch bug，不是 Runtime failure。最小修复 `96f8055` 增加成功 `exit(0)`，并清除 bmd+ffmpeg unused diagnostic variable / 过时 GStreamer-only 启动日志。
- CI：Actions `35344678284` @ exact `96f8055…` **7/7 required jobs PASS**，含 media runner `bmd-provider,ffmpeg-backend` compile。
- BMD exact `96f8055…`：archive sha256 `880400611a073d8a2b5715c12e090d52365a250f19e80c1783f52765ed38561d`；manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd`；显式 target `46:00000000:002e4500`。
- BMD Session gate：create=Leased PASS；start=Running PASS；backend actual observe alive；Resource=Allocated；stop=Released；Resource=Available；Lease=NONE；close 后 Session removed；gate rc=0；FFmpeg leftover=NONE。
- historical output device-number 2 PID before/after 均 `992634`。Authority/Contract 无变化；CanonicalPipelinePlan/GraphRuntimeIntent/wire 与 Session/Resource/Lease owner 未改。Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01e-session-composition/`；报告：`docs/superpowers/reports/2026-09-18-rf-ff-01e-ffmpeg-session-composition.md`。
- Post-01E reconciliation：FFmpeg `MediaBackend::observe/recover` 已存在，但 live single-input watchdog 被 `bmd-provider + gstreamer-backend` feature 锁定且混有 GStreamer `HEALTH_ARCS/appsink` acceptance bookkeeping；直接放开给 FFmpeg 会错误耦合 backend-specific health evidence。因此下一 bounded packet 必须先抽取 canonical event/recovery monitor。

### 3.31 RF-FF-01F 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED**。

- Runtime commit：f868420cedca2ba38ece320ef2c9b60e48e0b6e1。新增 backend-neutral RecoveryMonitor：MediaBackend::observe → canonical PipelineBusEvent/RuntimeEvent → Supervisor single decision → Lease revalidation → same-handle MediaBackend::recover；SessionStopHook 负责 stop/cancel/join。
- neutral monitor 不引用 GStreamer crate/element、device-number 或 vendor runtime address；现有 GStreamer watchdog 的 HEALTH_ARCS/appsink frame/PTS bookkeeping 保持原路径，未新增第二套 Session/Resource/Lease truth。
- fail-closed：Error/EOS 只经 canonical mapper 进入 Supervisor；Lease 无效进入 ManualRequired 且不 recover；recover failure 进入 ManualRequired；stop 后 monitor exited。
- Development VM：default 261/261；simulation 261/261；mock 446/446 + integration 9/9 + 12/12；ffmpeg-backend 278 PASS / 1 ignored 既有 real-binary hardware test；fmt、default/mock/ffmpeg clippy -D warnings、architecture lint、remove-adapters proof 全 PASS。
- BMD exact commit：archive sha256 3ae7c8a233ec1b705e2a6685d5f39126bfd8d43d9541c9ea1aa7f1cab27cf63e；manifest /home/lytv/a2-8-02i-v5.manifest.json MD5 7521d17e7fd02e50eb2b0a84374a43dd；native bmd-provider,ffmpeg-backend release build PASS。
- BMD failure-first gate：target 46:00000000:002e4500，真实 Session Running 后外部 SIGTERM child，canonical failure→Supervisor Recovered→new child PID，随后 stop/close；Released、Resource Available、Lease NONE、monitor exited、FFmpeg orphan NONE，marker RF_FF_01F_BMD_RECOVERY_PASS。
- output device-number 2 未触碰；stale /opt/vbmf-dev/repo 未使用/未修改。Evidence：evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01f-recovery/；报告：docs/superpowers/reports/2026-09-18-rf-ff-01f-ffmpeg-recovery-monitor.md。
- Authority/Contract：无 frozen Contract、CanonicalPipelinePlan、GraphRuntimeIntent/wire、Session/Resource/Lease owner 变化；RF-FF-01F 是既有 contract 的实现收敛。

### 3.32 Post RF-FF-01F adjudication（2026-09-18）

Status: **COMPLETE / SINGLE-INPUT LIVE FFMPEG SLICE ACCEPTED**。

- 证据裁决：RF-FF-01F 已满足当前 bounded acceptance；real child termination → canonical failure → Supervisor recovery → same-handle recovery/new child → stop/close teardown 链完整，且由 VM architecture/CI 与 BMD exact-commit gate 双侧独立支撑。
- 不新增 recovery/health follow-up packet：本 slice 的 monitor、Supervisor、lease fail-closed 与 cancellable lifecycle 已达到当前范围要求；后续只有在扩大到 multi-input、network source/output、clock/timecode 或更广 health policy 时重新拆 packet。
- 范围裁决：不得把本裁决解释为 Network Source/Output/Program multi-input 已获准实施；必须先有明确 bounded packet、touch-gate 与 acceptance。
- 稳定性裁决：历史 24h `rss_bounded` FAIL 仍是独立 verification debt；RF-FF-01F 不宣称 24h stability verified。

### 3.33 RF-FF-02 packet selection（2026-09-18）

Status: **READY / PLAN FROZEN**。

- 推荐理由：当前 `PipelinePlan` 已有 canonical `OutputPlan { Hls, Rtmp }` 且 GStreamer output path 已实证；FFmpeg adapter 仍明确拒绝 non-empty outputs，这是完成单输入 FFmpeg backend slice 的直接缺口。
- 边界：只做单 input + 至多一个 HLS/RTMP output 的 FFmpeg adapter argv/lifecycle；保留现有 Session/Resource/Lease/RecoveryMonitor owner 与 canonical event path。
- 明确排除：Network Source、第二 input、Program Switch、PACKET/MASTER、Composition/Audio、SRS ownership、Recording/Replay、output device-number 2。
- 计划：`docs/superpowers/plans/2026-09-18-rf-ff-02-ffmpeg-single-input-egress.md`。

### 3.34 RF-FF-02 收口（2026-09-18）

Status: **COMPLETE / SINGLE-INPUT FFMPEG EGRESS + HLS RECOVERY VERIFIED**。

- Implementation chain：`860013c` 冻结 RF-FF-02 plan/adapter/output gate；`ae8a2ce` 将 BMD 盒上缺失 `ffprobe` 的证据探针改为同一 FFmpeg stream probe；`a2715b3` 修正 BMD FFmpeg 拒绝的 AAC bitrate argv（`128000b` → `128000` bit/s）。
- Scope：既有 canonical `OutputPlan { Hls, Rtmp }`；FFmpeg adapter 只接受单 input + 至多一个 output，HLS/RTMP target fail-closed，argv 由 adapter 直接构造且无 shell；无 output 继续 `-f null -`；Session/Resource/Lease/RecoveryMonitor owner、wire/GraphRuntimeIntent 与 contract 均未改。
- BMD failure-first：首轮 exact `ae8a2ce` 暴露真实参数单位错误并 FAIL，未被掩盖；修正后 exact `a2715b3` 通过 HLS playlist/segments + h264/aac、same-handle recovery/new child、canonical teardown。
- Development VM：RF-FF-02 focused **4/4 PASS**；ffmpeg-backend **282 PASS + 1 ignored**；default **261/261**；simulation **261/261**；mock **446/446 + integration 9/9 + 12/12**；fmt、ffmpeg clippy `-D warnings`、architecture lint、remove-adapters、diff-check PASS。
- CI：Actions `35375536871` @ exact `a2715b3…` **7/7 required jobs PASS**，含 rust-test-matrix、hardware-test-compile、gstreamer-build、clippy 与 architecture portability。
- BMD exact：archive sha256 `fd36c119e28f4399a56d287c75cec2c3be27999eb29cb3dbf52b5444b03dab25`；manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd`；target `46:00000000:002e4500` / manifest device-number 0；HLS dir `/tmp/rf-ff-02-hls-a2715b3`；old child `3400656` → new child `3400805`；marker `RF_FF_02_BMD_OUTPUT_RECOVERY_PASS`。
- Teardown：Released、Resource Available、Lease NONE、monitor exited、FFmpeg orphan NONE；output device-number 2 untouched；stale `/opt/vbmf-dev/repo` unused。Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-ff-02-ffmpeg-egress/`。
- 非本 packet：没有 RTMP server/network acceptance、multi-output、Network Source、second input、Program Switch、SRS ownership、Recording/Replay、Clock/FLOW/IDEM 扩展；24h `rss_bounded` debt 仍独立未验证。

### 3.35 RF-FF-03 packet selection（2026-09-18）

Status: **READY / PLAN FROZEN**。

- 选择：补齐单输入 FFmpeg RTMP egress 的 runtime/recovery/teardown；使用同一 BMD FFmpeg 构建的 loopback `-rtmp_listen 1` 作为 gate-owned acceptance fixture。
- 选择依据：RF-FF-02 已验证 HLS；FFmpeg RTMP argv 已存在但无 runtime receiver evidence；BMD 无 mediamtx/SRS/rtmpdump，capability probe 已证明同一 FFmpeg 支持 loopback listener，依赖最小。
- Allowed：一个 `OutputPlan::Rtmp`、受控 loopback URL、producer/receiver h264+aac evidence、same-handle recovery/new child、canonical teardown。
- Forbidden：Network Source、第二 input、Program/Packet/Master Switch、multi-output、SRS ownership、外部 RTMP server、Recording/Replay、output device-number 2、Graph/wire/Clock/FLOW/IDEM 扩展、24h stability。
- Touch-gates：adapter argv 与 fail-closed；receiver 只绑定 loopback 且由 gate 回收；Session/Resource/Lease/RecoveryMonitor owner 不变；BMD 仍只用 exact handle `46:00000000:002e4500` / device-number 0。
- Plan：`docs/superpowers/plans/2026-09-18-rf-ff-03-ffmpeg-rtmp-egress.md`。

### 3.36 RF-FF-03 收口（2026-09-18）

Status: **COMPLETE / SINGLE-INPUT FFMPEG RTMP LOOPBACK + RECOVERY VERIFIED**。

- Implementation：exact `c03976d61a2166b6bcd4260c17801567a9f90354`；FFmpeg recovery gate 增加 loopback-only `-rtmp_listen 1` receiver，RAII 回收 receiver，producer argv/Session/RecoveryMonitor owner 不变。
- Development VM：focused `ffmpeg_rt_03` **4/4 PASS**；ffmpeg-backend **282 PASS + 1 ignored**；default/simulation **261/261**；mock **446/446 + integration 9/9 + 12/12**；fmt、clippy `-D warnings`、architecture portability、remove-adapters、diff-check PASS。
- CI：Actions `35379282990` @ exact commit **7/7 required jobs PASS**。
- BMD build：archive sha256 `24e4b5abc7000e4ab962e2e68ba0f54275c56c00da2cae01d339a24426073007`；binary sha256 `2b8beacb6bf15d05a8f11174ce919bd1213a499cf0a22b6d8a813ef32bc7ecaa`；manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd`。
- BMD runtime：exact handle `46:00000000:002e4500` / device-number 0；loopback `rtmp://127.0.0.1:19350/live/rf-ff-03` receiver initial/recovery 均 h264/aac PASS；producer PID `3403465→3403611`；marker `RF_FF_03_BMD_RTMP_OUTPUT_RECOVERY_PASS`。
- Teardown：Released、Resource Available、Lease NONE、monitor exited、FFmpeg orphan NONE；port 19350 无 listener；output device-number 2 untouched；evidence `evidence/bmd-10.30.15.10/2026-09-18-rf-ff-03-ffmpeg-rtmp-egress/`。
- 非本 packet：没有 SRS ownership、外部 RTMP server、Network Source、multi-output、second input、Program Switch、Recording/Replay、Clock/FLOW/IDEM 扩展；24h `rss_bounded` debt 仍独立未验证。

## 3.37 RH-CLOCK-01 packet selection（2026-09-18）

Status: **READY / PLAN FROZEN**。

- 候选比较已完成：Network Source、PACKET/MASTER、Hot-Standby、Recording/Replay、SRS/Output 均存在新的 source/switch/flow/external ownership 依赖；FFmpeg 当前 single-input output/recovery slice 已在 RF-FF-03 收口。
- 唯一 READY 包 = `RH-CLOCK-01`：D11 bounded Clock observation timeline + D13 timecode release-build fail-closed。
- Authority / plan：`docs/superpowers/specs/2026-09-18-rh-clock-01-clock-timeline-timecode-release-hardening.md`、`CLOCK_TIMECODE_CONTRACT.md`、D11/D13 debt record。
- Scope：仅 canonical Clock/Timecode observation semantics；不改 GraphIntent、wire、Session/Resource/Lease、Backend/provider、BMD handle/device-number、Program/Packet/Master、Network Source、D15 flow、24h RSS。
- Acceptance：`Locked → ClockLost → ClockRecovered` timeline；容量满显式失败且不静默丢事件；非法 transitional timecode 在 debug/release 均 fail-closed；focused/default/release/mock/simulation/format/clippy/architecture/diff + CI 7/7。
- Hardware boundary：不触碰 provider/backend/DeckLink path，本包不新增 BMD hardware claim；clock/timecode hardware probe 仍 NOT IMPLEMENTED/NOT VERIFIED。

## 3.38 RH-CLOCK-01 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE VERIFIED**。

- Implementation：exact `6433afb63f73cc28a9fe14390d0152210e961466`；仅 `clock.rs` / `timecode.rs` 改动。
- D11：bounded append-only Clock observation timeline；`Locked → ClockLost → ClockRecovered` 顺序与容量溢出 fail-closed 均通过。
- D13：`observe_transitional` 非法 presence 改为 Result；debug/release 均 fail-closed，合法 Discontinuous/Recovered observation 与零 action 语义保持。
- Software：focused Clock 2/2 + Timecode 1/1；debug default 264/264；simulation 264/264；mock 449/449 + 9/9 + 12/12；release focused 2/2 + 1/1；release default 264/264；fmt/clippy/architecture/remove-adapters/diff-check PASS。
- CI：Actions `35387811774`，7/7 required contexts PASS。
- Scope：GraphIntent/wire/Session/Resource/Lease/Backend/provider/BMD path 零改动；本包不需要新的 BMD hardware acceptance；clock/timecode hardware probe 仍 NOT IMPLEMENTED/NOT VERIFIED。
- Evidence：`docs/superpowers/reports/2026-09-18-rh-clock-01-verify.md`。

## 3.39 RF-NORM-01 packet selection（2026-09-18）

Status: **READY / PLAN FROZEN；IMPLEMENTATION NEXT**。

- 候选裁决：Network Source、PACKET/MASTER、Hot-Standby、Recording/Replay、SRS/Output 仍分别受 source/switch/normalize/external ownership 依赖；直接推进会越过当前边界。
- 唯一 READY 包：`RF-NORM-01`——显式 Program RAW target + backend-neutral Normalize execution contract + bounded GStreamer per-plane execution/evidence。
- Live comprehension：`normalize.rs` 目前是纯 Raw→Canonical 描述层；`TimelinePolicy`/`program_timeline.rs` 是时间线映射层；Program GStreamer graph 仍是 raw branch→selector，FrameSwitch 是唯一可执行 switch policy，Packet/Master fail-closed。
- 初始 bounded target 沿用既有 SDI acceptance shape：video I420 1920×1080 25/1 interleaved；audio S16LE 2ch 48000Hz。该 target 必须显式传入，缺失不得默认。
- Scope：先建立 typed target/plan/evidence，再物化 GStreamer Normalize chain；不启用 MASTER_SWITCH，不改 FFmpeg/Network/Output/Session/Resource/Lease/Clock/Flow/Idem/24h。
- Plan：`docs/superpowers/specs/2026-09-18-rf-norm-01-normalize-execution.md`。
- Hardware boundary：因触及 canonical GStreamer graph，软件与 CI 全绿后必须用 exact commit 做 BMD 双输入 acceptance；output device-number 2 保持 untouched。

## 3.40 RF-NORM-01 Phase A 收口（2026-09-18）

Status: **PHASE A COMPLETE / SOFTWARE + CI VERIFIED；GSTREAMER/BMD EXECUTION NOT YET**。

- Implementation：exact `324c70a3758deca5902e9b4d3311dab90fff349c`；新增 vendor-neutral `normalize_execution.rs` 与 Phase A plan/report；未改 GStreamer/FFmpeg/硬件 path。
- Domain：显式 video/audio RAW target；缺 target、非法尺寸/速率/声道 fail-closed；双 plane evidence 独立追踪，必须 V/A 均 `ObservedExact` 才 complete。
- Development VM：focused 5/5；default library 269/269；fmt/clippy/architecture/remove-adapters/diff-check PASS。
- CI：Actions `35389637837`，7/7 required contexts success；包含 default/simulation/mock/ffmpeg-backend compile/test 与 hardware/gstreamer build compile。
- Boundary：本阶段不宣称 Normalize GStreamer execution 或 BMD hardware verification；Phase B 才触及 canonical GStreamer graph，届时必须 exact-commit BMD 双输入 acceptance；output device-number 2 继续 untouched。
- Evidence：`docs/superpowers/reports/2026-09-18-rf-norm-01-phase-a.md`。

### 3.41 RF-NORM-01 Phase B 收口（2026-09-18）

Status: **PHASE B COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED；RUNTIME WARNINGS REGISTERED**。

- Implementation chain：`721a8ea` 补齐 progressive/interlaced Normalize chain；`75e7159` 保留 interlaced probe caps；`cb14014` 将 selector boundary exact V+A evidence 接入 L2c hard gate。
- Interlaced target 路径：deinterlace → videoconvert → videoscale → videorate → 2x progressive rate → interlace field-pattern=1:1 → exact interleaved target caps；progressive target 保持 direct normalized chain。
- Development VM：cargo test **269/269**；fmt、clippy `-D warnings`、diff-check PASS。
- CI：Actions `35393863201`，7/7 required contexts PASS。
- BMD exact acceptance：source archive SHA-256 `7999e2fe1b59493db3d02b3b54abf69f080cb74860e8ce26d72f694a0b8a99f1`；native build PASS；binary SHA-256 `c25b146df2bc8391607c4940a392c9ae20b2f00b61896c5a95bfc5451b840444`；manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd`。
- BMD inputs：`46:00000000:002e4500` / device-number 0 与 `46:00000000:002e4400` / device-number 1；output device-number 2 未触碰。
- Gate：**11/11 PASS**；L2c = `video=ObservedExact audio=ObservedExact complete=true`；L4/L5/恢复/teardown PASS；output PID `992634` unchanged；无 orphan/残留。
- Evidence：`evidence/bmd-10.30.15.10/2026-09-18-rf-norm-01-phase-b/`。
- Runtime warning debt：setup/recover 观察到非致命 `gst_video_converter_*` assertions，teardown 观察到 `gst_pad_unlink` assertion；已如实登记，未隐藏，未改变 11/11 verdict；本包不宣称 warning-free。
- Boundary：不启用 MASTER_SWITCH；不宣称 Network/Output/Recording/Replay/24h stability；24h `rss_bounded` 仍是独立 debt。
- Next：RF-MASTER-01 方案已冻结，进入实现与验证。

### 3.42 RF-MASTER-01 packet selection（2026-09-18）

Status: **READY / PLAN FROZEN；IMPLEMENTATION NEXT**。

- 选择：消费 RF-NORM-01 的 exact V+A selector-boundary evidence，在现有 GStreamer normalized Program graph 上启用 bounded MASTER_SWITCH。
- 依据：A2-1 将 MASTER_SWITCH 定义为 normalize → unified output format → switch；RF-NORM-01 Phase B 已证明 explicit target、materialized chain 与 exact V+A evidence，但明确把 Master enablement留给后续包。
- Allowed：内部 ExecutionGroup 允许 MASTER_SWITCH plan；GStreamer adapter 在 selector flip 前强制要求 explicit Normalize plan + evidence.complete()；复用既有双平面 selector、epoch、observed、teardown；bounded simulation/dual-input acceptance。
- Forbidden：PACKET_SWITCH、Network Source、Hot-Standby/automatic failover、Recording/Replay、SRS/Output expansion、FFmpeg、Session/Resource/Lease/wire/command-plane exposure、Clock/Flow/Idem、24h、output device-number 2。
- Fail-closed：缺 Normalize plan、缺任一 plane exact evidence、V/A divergence 或 backend 不支持时均不得改变 selector/bookkeeping。
- Plan：`docs/superpowers/plans/2026-09-18-rf-master-01-master-switch-normalized-execution.md`。

### 3.43 RF-MASTER-01 收口（2026-09-18）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED；WARNING DEBT REGISTERED**。

- Implementation：exact `9981273a`；内部 ExecutionGroup 允许 MASTER_SWITCH，PACKET_SWITCH 继续 fail-closed；GStreamer adapter 在 selector mutation 前要求 explicit Normalize plan + exact V+A evidence；Mock/command/wire 面不扩展。
- Development VM：default **269/269**；mock **455/455**；integration **9/9 + 12/12**；fmt、clippy `-D warnings`、diff-check PASS。
- CI：Actions `35400579632`，7/7 required contexts PASS；hardware-test-compile/gstreamer-build PASS。
- BMD exact：source archive SHA-256 `6fa541ba1b0bbba52e1c39ff03d0a051e9a3de7b3193114b66601087375d2d0d`；native `bmd,gstreamer` build PASS；binary SHA-256 `3179fdd9807fd2174f3ccf25abd0b4ece83dd7130edd7231867b3ee0c449b499`；manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd` before/after unchanged。
- Inputs：`46:00000000:002e4500` / device 0 与 `46:00000000:002e4400` / device 1；output device-number 2 的 PID `992634` 与命令 unchanged before/after。
- Gate：**11/11 PASS**；L2c exact V+A；L4 `MASTER_SWITCH timing/switch+timeline(A→B)` PASS；L5 failure isolation/recovery、Supervisor role、Teardown PASS；无 orphan/残留。
- Warning debt：setup/recover 仍有非致命 `gst_video_converter_*` assertions，teardown 仍有四条 `gst_pad_unlink` assertions；已归档，未改变 verdict，不宣称 warning-free。
- Evidence：`docs/superpowers/reports/2026-09-18-rf-master-01-verify.md` 与 `evidence/bmd-10.30.15.10/2026-09-18-rf-master-01/`。
- Boundary：不宣称 24h `rss_bounded` 关闭；下一步回到 bounded packet selection。

### 3.44 RF-SRC-01 packet selection（2026-09-18）

Status: **PLAN FROZEN / READY FOR CAPABILITY GATE**

- 选择：单协议、单输入、FFmpeg 消费的 SRT Network Source boundary + runtime/lifecycle slice。
- 选择依据：现有 SourceIntent 仍是 device-bound；直接塞 URL 会破坏 canonical plan / RuntimeBinding 分层。RF-FF-01A–01F 已提供 FFmpeg lifecycle、canonical event/recovery 与 teardown owner，可复用。
- Plan：docs/superpowers/plans/2026-09-18-rf-src-01-srt-source-boundary.md
- 前置能力结果见 §3.45；未通过则不以其它协议替换。

### 3.45 RF-SRC-01 capability gate / RTMP re-selection（2026-09-18）

Status: **SRT BLOCKED / RTMP PLAN FROZEN**

- BMD read-only probe：FFmpeg version git-2026-08-23-1019f8f；protocol list 无 srt，因此 RF-SRC-01 停在 capability gate，未写代码、未宣称 SRT 支持。
- 同一 probe 确认 rtmp 在 Input/Output protocol list；RF-FF-03 已有 FFmpeg RTMP loopback producer/receiver、A/V 与 recovery/teardown 证据，因此重新选择更小的 RF-SRC-RTMP-01。
- RTMP plan：docs/superpowers/plans/2026-09-18-rf-src-rtmp-01-source-boundary.md；SRT blocker plan：docs/superpowers/plans/2026-09-18-rf-src-01-srt-source-boundary.md。
- 边界：SRT 不替换成 RTMP 偷改；RTMP 是独立新 packet，仍只做单协议/单输入/FFmpeg/loopback。
- 未触碰：BMD output device-number 2、manifest、运行媒体、wire/API、Session/Resource/Lease owner、Clock/Flow/Idempotency、24h。

### 3.46 RF-SRC-RTMP-01 boundary inventory（2026-09-18）

Status: **PLAN REQUIRED / DESIGN BLOCKER FOUND**

- live SourceIntent 有 20+ 个设备源构造点；PipelinePlan/Session 继续从 source.device_id 派生 Resource、SessionInput 与释放身份。
- 结论：不能直接新增 URL 或让 FFmpeg 解释设备 binding；否则网络源会伪装成 DeckLink，授权、recovery 和 teardown 语义均不成立。
- 需要先冻结：NetworkSourceId、authorized network RuntimeBinding/resource reference、单输入 Session ownership/release 以及 canonical failure/recovery 事件映射。
- 已完成：SRT blocker 证据、RTMP protocol/FLV/H.264/AAC capability 证据、RTMP plan 初稿；未改 runtime code。
- 下一步：补 boundary design/acceptance，再决定实现包；当前没有 READY Runtime Features 实施包。

### 3.47 RF-SRC-RTMP-01 boundary design 收口（2026-09-18）

Status: **DESIGN FROZEN / IMPLEMENTATION READY**

- 设计：NetworkSourceId、SourceRef、ResourceOwner、LeaseKey、SessionInput 类型化；保留 DeckLink 旧 JSON 语义兼容，网络源不再借用 device_id。
- Ownership：ResourceRegistry 仍唯一修改 Resource；LeaseManager 仍唯一修改 Lease；SessionManager 仍唯一创建/销毁 Session；Backend 只消费已授权 binding，不自行 acquire。
- Lifecycle：Network Source 必须在组合根注册 Network Resource + RuntimeBinding；Preflight → Reservation → Lease → instantiate → allocation → start → recover/stop/release 全部沿既有 Session journal。
- Security：RTMP endpoint 在 binding 前校验，禁止凭据；canonical state/log/health/evidence 不输出 URL secret。
- Plan：docs/superpowers/plans/2026-09-18-rf-src-rtmp-01-boundary-design.md；实现包唯一 ID = RF-SRC-RTMP-01-IMPLEMENTATION。
- 设计验收后已进入实现；禁止另开 Network/Output/Program 包。

### 3.48 RF-SRC-RTMP-01 typed ownership/session implementation（2026-09-18）

Status: **IMPLEMENTATION CHECKPOINT / SOFTWARE VERIFIED；BMD RUNTIME ACCEPTANCE PENDING**

Implementation commit: **`fd04625`**（已推送 `origin/main`）。

- Contract/type：`SourceRef`、`ResourceOwner`、`LeaseKey`、credential-free `NetworkEndpoint` 与 tagged `SourceIntent::Rtmp` 已落地；DeckLink JSON 兼容测试保持通过。
- Ownership：Network Resource 注册、ResourceCapacity/preflight 分流、typed network lease 冲突/续期/health 清扫、Session reservation/allocation/release 已接线；网络源不再解析为硬件 DeviceId。
- Runtime：FFmpeg Network `SourcePlan` 生成受控 RTMP argv（V+A map）；`SessionInput` 使用 `SourceRef::Network`，legacy `device_id` 对网络源保持 nil。
- Software evidence：mock **463/463**；FFmpeg backend **298 passed / 1 ignored**；`cargo check --all-targets` PASS；mock integration `--no-run` PASS；`git diff --check` PASS。
- Explicitly pending：BMD 上的 network-source loopback A/V、receiver recovery/teardown、CI 7/7 与最终 evidence report；不触碰 output device-number 2，不把 RF-FF-03 egress evidence 继承为 source acceptance。
- Scope remains single RTMP protocol / single input / FFmpeg; no SRT substitution, SRS ownership, Network umbrella, UI/API, multi-input, switch, Clock/FLOW/IDEM or 24h expansion.

### 3.49 RF-SRC-RTMP-01 acceptance closure（2026-09-19）

Status: **COMPLETE / SOFTWARE + CI + BMD SOURCE RUNTIME VERIFIED**

- Implementation closure commit: **`ffd8889`**；CI run **`35407985671`**，7/7 required checks PASS。
- Software: mock **463/463**；FFmpeg backend **298 passed / 1 ignored**；`cargo check --all-targets` PASS；final BMD/FFmpeg gate binary SHA256 `17b55178cc9c6168eae86a710a6f9f3db1476187c770eeb32829d63aba4901e7`。
- BMD source acceptance: bounded loopback RTMP H.264/AAC source Session Running；publisher termination触发 canonical failure，RecoveryMonitor 创建新 consumer（`3436259 → 3436455`），Supervisor=Recovered；teardown=Released / Resource Available / Lease NONE / monitor exited / publisher orphan NONE。
- Safety boundary: manifest MD5 `7521d17e7fd02e50eb2b0a84374a43dd`；output device-number 2 PID `992634` 与完整命令 before/after unchanged；只使用 loopback fixture，不继承 RF-FF-03 egress 作为 source evidence。
- Evidence：`docs/superpowers/reports/2026-09-18-rf-src-rtmp-01-verify.md` 与 `evidence/bmd-10.30.15.10/2026-09-18-rf-src-rtmp-01/`。

### 3.50 Runtime Features next candidate review（2026-09-19）

Status: **PLAN REQUIRED / NO READY PACKET**

- RF-SRC-RTMP-01 已完成；live §5.1 没有新的 READY Work Packet，只有 `RUNTIME-FEATURES-NEXT` 占位。
- SRT 仍是 capability BLOCKED；RTMP 非 loopback 扩展、PACKET/Program、Hot-Standby、Recording/Replay、SRS/Output 均需要新的 bounded design/ownership/acceptance，不能从 BACKLOG 直接实施。
- RH-FLOW-01 继续 DEFER-UNTIL-TOUCH；RH-IDEM-01 继续 DEFER-UNTIL-CONTROL-PLANE；24h RSS 是独立 verification debt。
- Candidate review：`docs/superpowers/plans/2026-09-19-runtime-features-next-candidate-review.md`。
- 决定：冻结下一个 bounded packet 前不改代码、不扩 scope；下一包必须先有 Authority、allowed/forbidden、touch-gates 与 acceptance。

### 3.51 RF-SRC-RTMP-02 production RTMP input boundary（2026-09-19）

Status: **READY / PLAN FROZEN；IMPLEMENTATION NOT STARTED**

- 决策：在 RF-SRC-RTMP-01 已验收的 typed Network Source / FFmpeg listener
  基础上，冻结 production LAN admission boundary；VBMF 仍是被动 RTMP
  listener，仍只使用 `-rtmp_listen 1`，不引入 pull、SRS 或外部媒体服务器。
- Design Authority：
  `docs/superpowers/plans/2026-09-19-rf-src-rtmp-02-production-rtmp-input-boundary.md`；
  引用 `MEDIA_BACKEND_CONTRACT` §§1/1.1 P0-8/3/4、
  `RUNTIME_SESSION_MODEL` §§4/4.1、`RUNTIME_RESOURCE_MODEL` §§3/4/4.2、
  `RUNTIME_BINDING_MODEL`、RF-SRC-RTMP-01 两份 plan 与本节之前的 §3.50
  candidate review；设计文档 §8 的 live-tree audit appendix 同属本 Authority 链。
- Frozen decisions D1–D11：strict canonical IP-literal endpoint；startup-only
  `NetworkSourceBinding` manifest with machine pin/0600/one-to-one entries；
  local-interface ownership；OS `bind()` authority；D7 lifecycle table；per
  `(Session, endpoint)` bounded budget；bounded stderr reader and complete
  redaction；Network-only zero DeckLink side effects；unchanged
  `SourceIntent::Rtmp` wire shape。
- Capability prerequisite：implementation Step 0 must perform the BMD read-only
  `-rtmp_listen 1` non-loopback LAN bind probe and the listen-mode path/app
  enforcement probe. Either failure returns to `PLAN REQUIRED`; path-only
  routing is not publisher authentication.
- Evidence boundary：Tier 1 may state only “non-loopback listener binding
  verified”; Tier 2 independent-host/namespace push is required for
  “cross-host third-party push verified”。优先争取 Development VM → BMD LAN
  address；不得把 Tier 1 扩大为 Tier 2。
- Network-only negative invariants：no DeviceLease/`LeaseKey::Device`, no
  DeckLink input/output, Device Resource remains `Available`, input 0/1 and
  output device-number 2 unchanged, only Network Resource registered. Existing
  `bootstrap.rs:50` / `99-120` and
  `build_ffmpeg_network_source_composition` `227-234` side effects are an
  explicit implementation audit item。
- Pre-implementation amendment（2026-09-19 第二轮审阅）：设计文档补入
  **Implementation Invariants**——INV-1 恢复触发 = 子进程已退出且经"退出状态 +
  既有事件 + 有界 stderr"正向归因 `PublisherDisconnected`（子进程存活回到
  Waiting 不重启；UnknownExit/stderr reader 异常/状态不可确认直接
  ManualRequired）；INV-2 recovery generation 隔离（恢复任务携带启动时
  session/lease generation，stop/close/ManualRequired 后迟到事件与重启动作全部
  丢弃，复用既有 epoch/cancellation，不新增 truth store）；INV-3 manifest 严格
  解析（≤1 MiB、拒绝重复字段/未知字段/尾随数据、source_id 用 canonical UUID
  表示、read 后同 fd 再 fstat 复核、owner/权限校验在降权后的实际服务用户身份
  上执行）。同轮：探针②扩展为负向矩阵（错误 path / 尾部 `/` / query /
  fragment / 编码变体，结论二选一登记 "path enforced" 或 "path is a routing
  label only"）；§3 登记 deferred ingress risks（见 §9）；§6 验收新增强类型
  endpoint 唯一流通（禁止裸 String 比较绕过 D2）与 "authorized endpoint ≠
  authenticated publisher" 文案纪律。
- Scope：本节只冻结设计文档与 STATE；runtime 实现、BMD Step 0、LAN fixture
  与 implementation acceptance 尚未启动。

### 3.52 RF-SRC-RTMP-02 TG-0 capability probe 收口（2026-09-19）

Status: **TG-0 PASS / IMPLEMENTATION STEP 1 (TG-1) UNLOCKED**

- 前置对账：exact `bf0a8e0` 本地/origin/GitHub 三方一致后上盒；BMD = `lytv@10.30.15.10`
  （eno1 `10.30.15.10/16`），FFmpeg `/usr/local/bin/ffmpeg`
  `git-2026-08-23-1019f8f`，rtmp 双向协议在表；无 VBMF 服务运行；旧
  `/opt/vbmf-dev/repo`（`7cc33dd`）未动；device-2 输出进程 PID `992634`
  探针前后存活（仅观察）。
- **探针① PASS**：`-rtmp_listen 1` 绑定**显式非 loopback LAN 地址**——`ss`
  实证 `LISTEN 10.30.15.10:19352`（非通配 0.0.0.0）；同机 lavfi→h264+aac
  推流 `publisher_rc=0 listener_rc=0`、mpegts 244776 B、A/V 双流 muxed。
  有利事实：URL host 即 OS bind 地址（支撑 D2/D5 显式地址语义）。
- **探针② 裁定 "path is a routing label only"**：负向矩阵五变体
  （正确 path / 错误 path / 尾部 `/` / query / `%`编码）全部被接受且输出
  md5 逐字节一致（`86cd3c82…`）→ BMD FFmpeg listen 模式不校验来连方
  app/play path。按冻结 D4 默认裁决采纳（不阻塞、文案降级强制、永不称
  path 认证）；若未来要求 path 级 publisher 隔离须回 PLAN REQUIRED。
- **探针③ PASS**：`bf0a8e0` 上 `SourceIntent::Rtmp { source_id, endpoint }`
  确认 source_id 已在 wire，无需新增字段。
- 隔离：仅用隔离端口 19351/19352/19361-19365 与 lavfi 媒体；零 DeckLink
  参数；零 ffmpeg 残留；零监听端口残留；盒上临时目录证据回拉后已删；
  本轮零代码改动。
- Deferred 标注（并入 §9）：RTMP `-timeout`（等待来连上限·Implies
  `-rtmp_listen`）存在；post-accept 握手/空闲连接超时选项未观察到。
- Evidence：`evidence/bmd-10.30.15.10/2026-09-19-rf-src-rtmp-02-tg0-capability-probe/`
  （39 件 + tg0-manifest；二进制输出以 md5/字节数登记，未入仓库）；
  报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg0-capability-probe.md`。

### 3.53 RF-SRC-RTMP-02 TG-1 收口（2026-09-19）— canonical endpoint + NetworkSourceBinding

Status: **TG-1 COMPLETE / SOFTWARE VERIFIED（含 reconciliation 增量）；TG-2 NEXT**

- 实现（scope：仅 `source.rs` + 新模块 `network_binding.rs` + `lib.rs` 声明 + `Cargo.toml` linux `libc` 唯一新依赖）：
  - `CanonicalIp`/`CanonicalPath`/`CanonicalRtmpEndpoint`/`ListenerKey` 强类型落地 D2——IPv4 无前导零、IPv6 仅 RFC 5952 规范小写压缩拼写（非规范拒绝而非规范化后比较）、地址类别 allowlist（仅 loopback/RFC1918/ULA；mapped/CGNAT/文档/公网/链路本地/组播/广播/通配全拒）、端口 1024..=65535、path 段字符集 `[A-Za-z0-9._-]` 无点段/编码/query/fragment、尾部 `/` 为不同值；`NetworkEndpoint::to_canonical()` 为 wire→canonical 唯一桥；全部 canonical 类型 Debug redacted（D9）。
  - `NetworkSourceBinding` 加载器落地 D3+INV-3——单 fd `open(O_NOFOLLOW)→fstat→校验(普通文件/owner==euid/mode恰0600/≤1MiB/非空)→read→parse→再fstat` 防竞态；严格 JSON（unknown/duplicate/trailing 拒绝）；machine_id pin 复用 `resolver::current_machine_id`（未解析即拒）；canonical UUID + canonical endpoint；source_id 双向 1:1、完整 endpoint 去重、同 `(ip,port)` 多 path = `ListenerConflict`；API 仅 `load/authorize/authorized_sources`，无热加载、不生成 `SourceIntent`、path 仅精确准入标签。
- 软件（Development VM）：focused source **25** / network_binding **12**；default **296/296**；mock **483/483 + 9/9 + 12/12**；simulation **296/296**；ffmpeg-backend **318 passed/1 ignored**；clippy default/mock/ffmpeg `-D warnings`、fmt、`check --all-targets`、architecture lint、remove-adapters proof、diff-check 全 PASS。
- 边界：未接线 preflight/session/bootstrap/recovery/ffmpeg adapter（TG-2+）；既有 `NetworkEndpoint` wire/loopback 强制/argv 路径零回归；INV-3 owner 校验以当前 euid 实现（未来特权启动须降权后加载——模块头已注明）。
- 报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg1-endpoint-manifest.md`。
- **Reconciliation 增量（`8b8aa32` 之后的新 main 提交，独立复核驱动，不抹除历史；报告 §4）**：
  - **D5 补齐（原为硬缺口）**：生产 `load()` 启动一次 `getifaddrs`（libc 只读枚举，AF_INET/AF_INET6）取得本机地址快照 + machine_id；每 entry 在全部结构性拒绝后执行 exact-IP 本机归属比对，任一 eligible-but-not-local → `AddressNotLocal` **整体失败**（混合 entry 锚定无部分接受）；枚举失败 fail-closed；测试经 `load_verified(path, machine_id, local_ips)` 注入快照，不依赖 VM 实际 IP；真实枚举器有 focused test（快照必含 127.0.0.1）。无 DNS/watch/reload。
  - **D2 收紧**：host text ≤255 字节检查先于一切地址解析（URL/wire/manifest 三路径）；端口文本仅接受纯 ASCII 十进制且 `port.to_string()==port_text`（`01935`/`+1935`/空白/尾随垃圾/全角/空端口全拒；范围 1024..=65535 不变）。
  - **INV-3 加强**：`FileIdentity` 扩为 dev/ino/size/mtime/mtime_nsec/ctime/ctime_nsec/uid/mode 九元——同秒改写、读中 chmod/chown 全部在同一 `O_NOFOLLOW` fd 的 before/after 全等比较中 fail-closed；守卫提纯为 `load_state_unchanged`（快照全等 + size==读得字节数）；清理原双重首 fstat。
  - **口径纠正**：竞态覆盖定性为 **identity-transition guard 单测 + 实文件确定性元数据转换**（chmod/append/truncate/set_times + 九字段结构矩阵），非并发竞态注入实测；STATE/报告不再使用"竞态实测"表述。
  - 软件（reconciliation 后全量重跑）：focused source **27** / network_binding **15**；default **301/301**；mock **488/488 + 9/9 + 12/12**；simulation **301/301**；ffmpeg-backend **323 passed/1 ignored**；clippy×3 `-D warnings`、fmt、`check --all-targets`、architecture lint、remove-adapters proof、diff-check（仅 `source.rs`+`network_binding.rs` 两文件）全 PASS。
  - Reconciliation 提交 = `a29da14`（`8b8aa32` 之后增量，无 amend/rebase/reset/force-push）；exact-commit CI run `35443669027` **7/7 required PASS**；local/origin/GitHub 三方对齐。

### 3.54 RF-SRC-RTMP-02 TG-2 收口（2026-09-19）— network-only 生产组合 + 五元组授权接线

Status: **TG-2 COMPLETE / SOFTWARE VERIFIED；TG-3 NEXT**

- 实现（核心：`config.rs`/`preflight.rs`/`session.rs`/`bootstrap.rs`/`gates/ffmpeg_recovery.rs` + 组合所需 neutral factory `adapters/mod.rs`/`registry.rs` + `SessionManager::new` 签名引发的 13 处 1 行 `None` 机械适配）：
  - **D10 组合**：拆掉旧 `build_ffmpeg_network_source_composition()`（依赖 DeviceBindingManifest + bootstrap 占位 Device lease 的冻结错误路径）；新 `build_ffmpeg_network_only_composition()`——生产 `NetworkSourceBinding::load()`（D5 getifaddrs + machine pin + 0600 单 fd）启动加载一次；无 discovery/无 DeviceBindingManifest/零占位 Device lease；仅按 authorized sources 注册 Network `rtmp-input` Resource；SessionManager=Production + `network_binding` 类型化字段 + device authorizations map 刻意为空（D11：Network 授权绝不入 device map）；同实例暴露 supervisor/lease_manager 供 acceptance 接线（非第二 owner）。
  - **Config**：`network_binding_path`（`MEDIA_AGENT_NETWORK_BINDING`）startup-only 入口；缺失 → 生产 network 组合拒启。
  - **Preflight**：IdentityBinding 重构——Production + RTMP 无 binding = FAIL（终结"Network/SelfTest 自动 PASS"）；有 binding = 五元组逐 source 精确授权（redaction-safe detail）；Diagnostic 无 binding = loopback fixture Pass-with-note（回归保留）；硬件分支逻辑不变，混合 intent 单条合并结论。
  - **Session**：`create_inner` 步 5 二次核验（BindingFailed fail-closed）；授权先于任何 spawn 路径。
  - **gate 迁移**：`ffmpeg_recovery` 改走新组合（gate 自写 0600/machine-pin loopback manifest → 真实生产准入）；`bmd-provider,ffmpeg-backend` 交叉 cfg 本 VM/CI 均不编译，已用临时 cfg 降级完成编译验证后原样恢复（披露于报告 §1），最终权威 = TG-6 BMD native build。
  - `SourceIntent::Rtmp` wire 不变；pipeline.rs/FFmpeg argv/stderr/recovery 未触碰（TG-3/TG-4）：Production LAN endpoint 在 start 的 loopback 校验处继续 fail-closed，不会误启 FFmpeg。
- D10 负向测试（bootstrap::rf_src_rtmp_02_tg2_tests）：仅 Network Resource（device_id=nil/Available）、devices 空、DeviceLease 集合构造前后均为空、manifest 字节不变、五元组 create 仅 `LeaseKey::Network`、失配 PreflightFailed 且资源回 Available；单测不 start（真 start 会 spawn listener child，属 TG-3/BMD）；input 0/1 与 output device-number 2 零动作 = 结构性（无 discovery/无 device plane），硬件级证据按冻结设计属 TG-6。
- 软件（Development VM）：focused preflight **12** / session(mock) **36** / bootstrap(ffmpeg) **7**；default **304/304**；simulation **304/304**；mock **494/494 + 9/9 + 12/12**；ffmpeg-backend **330 passed/1 ignored**；clippy 四档 `-D warnings`、fmt、`check --all-targets`(default+mock)、architecture lint、remove-adapters proof、diff-check 全 PASS；既有 loopback/Diagnostic/生命周期回归零降低。
- 报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg2-network-composition.md`。

### 3.55 RF-SRC-RTMP-02 TG-3 收口（2026-09-19）— listener argv + 有界 stderr + 有限归因

Status: **TG-3 COMPLETE / SOFTWARE VERIFIED；TG-4 NEXT**

- 实现（仅 `adapters/ffmpeg.rs` + `pipeline.rs`，后者按冻结审计附录"经 D2–D5 放宽"指令）：
  - **argv**：`SourcePlan::Network` 输入改为 strict canonical（`to_canonical().to_url()`，IPv6 方括号）→ `-rtmp_listen 1 -i <url>`；OS bind() 最终权威（D6）；非 canonical 在 argv 前 `PrepareFailed`；argv URL 为 D9 例外绝不 log。
  - **物化放宽**：pipeline Network 分支恒过 `to_canonical()`；Diagnostic 锁 loopback（fixture 回归保留）；Production 接受 eligible 类别（LAN 打开；准入在 TG-2 Session 层）。计划形态 wire endpoint 不变（D11）。
  - **D9 stderr**：StderrRing（≤64KiB/≤256 行/行 512B UTF-8 边界截断/FIFO）+ 独立 reader 线程持续排空（network 子进程 stderr=piped，其余 null）；reaper 排序 stop/recover/observe/Drop 统一 = terminate+wait → join reader → 释放 ring（无 child/reader 遗漏，测试探针锚定）。
  - **有限归因**：`NetworkExitClass` 冻结四类；`classify_network_exit`：bind 错误文本→BindFailure（D6 列举）；其余→UnknownExit；**INV-1：PublisherDisconnected 绝不从 stderr 关键词单独归因**（正向归因需 canonical signal 历史，构造点属 TG-4，枚举位预留注释锚定）；退出事件 detail 仅类别名，raw stderr 永不出 adapter（e2e 断言）。
- 软件：focused `rf_src_rtmp_02_tg3` **9**（ffmpeg-backend 6 + default 3）；default **307/307**；simulation **307/307**；ffmpeg-backend **339 passed/1 ignored**；mock **497/497 + 9/9 + 12/12**；clippy 三档 `-D warnings`、fmt、`check --all-targets`、architecture lint、remove-adapters proof、diff-check 全 PASS；既有回归（loopback fixture/Diagnostic/生命周期）零降低。
- 报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg3-listener-stderr.md`。

### 3.56 RF-SRC-RTMP-02 TG-4 收口（2026-09-19）— D7/D8 recovery 决策接线

Status: **TG-4 COMPLETE / SOFTWARE VERIFIED；TG-5 NEXT**

- 实现（`pipeline_events.rs`/`supervisor.rs`/`recovery_monitor.rs` + `adapters/ffmpeg.rs` 复用共享枚举 + `bootstrap.rs` 暴露同实例 resources + `gates/ffmpeg_recovery.rs` 新签名；SessionManager 所有权零变化）：
  - 中性 `NetworkExitClass`（冻结四类）+ detail 解析器（不可解析 → UnknownExit fail-closed，INV-1）。
  - `Supervisor::report_network_exit`：BindFailure/SpawnFailure/UnknownExit → ManualRequired 立即零预算零重试；PublisherDisconnected → 既有预算化路径（max 5 / 1s·2^n cap 60s = D8 数学）。`report_restart_completed` 回 Running 不重置预算；`report_recovered` 收窄为 SignalVerified 级唯一会话内重置；`attempts()` 观测面。
  - RecoveryMonitor 网络环：Waiting 非故障；INV-1 终局归因（退出分类 + SignalVerified 历史 ⇒ PublisherDisconnected，否则 manual，绝不探索性重启）；D8 双重验证（lease + registry claim Reserved/Allocated）；重启后 signal 标志清除（新 listener 须重新验证）；stop_and_join 清预算（stop/close 语义）、ManualRequired 持续到 operator stop；INV-2 backoff 内 stop 丢弃重启代。设备域 run() 零变化。
  - gate 交叉 cfg（bmd+ffmpeg）无 CI 编译覆盖——临时 cfg 降级编译验证后原样恢复；最终权威 = TG-6 BMD native build。
- 软件：focused `rf_src_rtmp_02_tg4` **10**；default **317/317**；simulation **317/317**；ffmpeg-backend **349 passed/1 ignored**；mock **507/507 + 9/9 + 12/12**；clippy 三档、fmt、`check --all-targets`、architecture lint、remove-adapters proof、diff-check 全 PASS。
- 边界：`report_signal_verified()` 生产调用方（网络信号探测面，signal.rs 现为 DeckLink 探测）随 TG-6 消费入口落位，本轮交付 API + 全语义测试；BMD 实机路径 = TG-6 Tier 1/Tier 2。
- 报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg4-recovery-decisions.md`。

### 3.57 RF-SRC-RTMP-02 TG-5 收口（2026-09-19）— redaction helper + 统一负向套件

Status: **TG-5 COMPLETE / SOFTWARE VERIFIED；TG-6 NEXT（BMD exact-commit）**

- 实现（仅 `pipeline.rs` + `session.rs`）：
  - `PipelinePlan::redacted_debug()`：确定性无 endpoint 文本渲染（Network endpoint 与输出 target——HLS 路径/rtmp URL——结构性 marker 化；保留 canonical 语义）。
  - **D9 点名路径修复**：session.rs `SourceMaterialized` 身份哈希输入由派生 Debug（endpoint 文本进哈希 = 端点依赖身份泄漏）改为 `redacted_debug()`；仅 endpoint 不同的计划哈希输入相同。
  - 统一负向套件（mock 全生命周期）：特征字面量（host/port/path/`rtmp://`）在 runtime_state JSON、canonical 强类型 Debug、redacted 渲染（含端点无关性）、PreflightReport JSON、SessionError Display、NetworkBindingError 全 23 变体、事件日志逐事件 JSON 全部缺席；default 域另附 redacted_debug 单测。D10 负向套件（TG-2）复核无缺口、矩阵保持全绿。
- 软件：focused tg5 default **1** + mock **2**；default **318/318**；simulation **318/318**；ffmpeg-backend **350 passed/1 ignored**；mock **509/509 + 9/9 + 12/12**；clippy 三档、fmt、`check --all-targets`、architecture lint、remove-adapters proof、diff-check 全 PASS。
- 边界：证据命令行 redact 随 TG-6 证据归档执行；wire 入站例外由既有兼容测试锚定。
- 报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg5-redaction-suite.md`。

### 3.58 RF-SRC-RTMP-02 TG-6 收口（2026-09-19）— BMD exact-commit Tier 1 + Tier 2 验收；实现包 COMPLETE

Status: **TG-6 COMPLETE / HARDWARE VERIFIED（Tier 1 + Tier 2）；RF-SRC-RTMP-02-IMPLEMENTATION COMPLETE**

- 预备提交（各 CI 7/7）：`145908b`（gate LAN fixture canonical 放宽）→ `fc3eada`（dead wrapper 清理）→ `ee856d4`（SignalVerified 证据接线 + 归因/消息如实化）→ `58fd33d`（external 第三方推流模式）。
- **Tier 1 PASS** @ `ee856d4`（CI 35448354450·archive `7b96e2aa…`·binary `aceb3a12…`）："non-loopback listener binding verified"——生产 network-only 组合显式绑定 `10.30.15.10:19350`（ss LISTEN 实证）+ 同宿 h264/aac 已验证 + 断连 `attributed=PublisherDisconnected` 预算化恢复（PID 3454663→3454862·supervisor=Running=D8 不重置）+ teardown 全绿；gate manifest MD5 `29570aa7…` 前后不变。
- **Tier 2 PASS** @ `58fd33d`（CI 35448724626·archive `b1d096c1…`·binary `ebe1a0a6…`）："cross-host third-party push verified"（frozen §3 允许的 independent netns 形态）——docker 容器（172.17.0.2）→ `10.30.15.10:19351` 真实第三方推流（ss ESTAB 实证）+ 已验证 A/V + 归因恢复（PID 3460834→3461243）+ 二次外部推流 + teardown 全绿；VM 直推被网络边界阻断（如实记录）；UFW 临时规则已删除复核；前两次失败（网络阻断/编排时序）如实披露。
- 边界完整性：device-2 PID 992634 全程存活（15-07:09:51→15-07:46:40）；零 ffmpeg 残留；deferred risks 逐项标注（tg6-manifest §Deferred risks）。
- 证据：`evidence/bmd-10.30.15.10/2026-09-19-rf-src-rtmp-02-tg6-lan-acceptance/` + EVIDENCE-INDEX 行；报告=`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-tg6-bmd-acceptance.md`。
- **收口**：RF-SRC-RTMP-02 全部 touch-gate（TG-0 探针/TG-1 canonical+manifest（含 reconciliation）/TG-2 组合+五元组/TG-3 listener+stderr/TG-4 D7/D8/TG-5 redaction/TG-6 硬件）通过；无 frozen stop condition 触发；`SourceIntent::Rtmp` wire 未变；未扩大任何边界（SRT/Program/Switch/SRS/Recording/Replay/24h stability 维持）。
- **Reconciliation 注记（2026-09-19，§3.59）**：本节 Tier 1/Tier 2 的 listener/A/V/归因恢复/teardown 事实对其 exact gate revisions（`ee856d4`/`58fd33d`）继续成立；但两 gate revision 的进程均在进入 RTMP source gate 前无条件执行了 `bootstrap::build()`（`device discovery complete count=3` + 3 条 bootstrap 占位 DeviceLease），因此**不构成严格 D10"进程级零 DeviceLease/零 Device side effect"硬件证据**。该缺口已由 RF-SRC-RTMP-02-CLOSURE-RECONCILIATION 修复并在 `d13f1fd` 上重验（§3.60）；本节历史证据保留。

### 3.59 RF-SRC-RTMP-02 closure reconciliation entry（2026-09-19）

Status: **COMPLETE（§3.60 收口；本节保留触发与修复面记录）**

- 触发：用户独立复核（live `main = d257250`、CI `35449818448` 7/7、TG-1~TG-5 软件面接受、Tier 2 netns 符合 frozen §3）发现两个真实闭环缺口，开 bounded packet **`RF-SRC-RTMP-02-CLOSURE-RECONCILIATION`**（不推倒既有实现）：
  1. **production-root gap**：`MEDIA_AGENT_NETWORK_BINDING` 与 `build_ffmpeg_network_only_composition()` 只被 tests / `media-agent-gates` 消费；真实 `src/bin/media-agent.rs` 没有 Network-only 模式选择或构造分支——TG-2 report §4 预留的"随 TG-3/TG-6 BMD 验收一并落位"承诺至 `d257250` 未实现（frozen D10/D11 的 production composition root 缺口）。
  2. **TG-6 gate D10 gap**：`src/bin/gates.rs` 无条件先执行 `bootstrap::build()` 再 dispatch；`VBMF_FFMPEG_RTMP_SOURCE` 命中时 gate 进程日志出现 `device discovery complete count=3` 与 3 条 bootstrap `lease acquired`——该路径不能作为严格 D10 硬件证据。
- 修复范围（frozen D3/D10/D11 对齐）：production root 在进入 `bootstrap::build()` 的 Device discovery / 占位 DeviceLease 路径**之前**完成 mode selection；Network-only 直接消费 `MEDIA_AGENT_NETWORK_BINDING` → `NetworkSourceBinding::load()` → `build_ffmpeg_network_only_composition()`；不 discovery / 不读 DeviceBindingManifest / 不取 `LeaseKey::Device` / 不开 DeckLink input/output；单 Runtime owner；零媒体自动启动；不扩大 Control Plane/API exposure。gate 侧：`VBMF_FFMPEG_RTMP_SOURCE` 在通用 bootstrap 之前进入 Network-only gate 并复用同一 production builder；旧 Device/GStreamer gates 保持 common bootstrap 不变。
- 重验：新 implementation commit 上重跑 Development VM 全矩阵 + CI 7/7 + 同一 exact commit 的 BMD TG-6（loopback 回归、Tier 1 LAN、Tier 2 independent netns、D7/D8 disconnect→attribution→recovery、D10 before/after、clean teardown）。
- 历史证据保留：§3.52–§3.58 不删除；Tier 1/Tier 2 listener/A/V/归因恢复事实对其 exact gate revisions 继续成立，仅"进程级严格 D10"结论待重验。
- **收口（§3.60）**：修复 = implementation commit `d13f1fd`（CI 7/7）+ 同 commit BMD TG-6R 重验全 PASS；RF-SRC-RTMP-02 恢复 COMPLETE。

### 3.60 RF-SRC-RTMP-02-CLOSURE-RECONCILIATION 收口（2026-09-19）

Status: **COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED（严格 D10 进程级）**

- Commit 链：STATE 降级 `3eff73a`（CI 35486389929 7/7）→ **implementation `d13f1fd`**（CI `35487255383` **7/7 required PASS**）→ 本 STATE/evidence 收口提交。
- 修复① production root：`bootstrap::select_startup_composition_mode()`（`StartupCompositionMode::{Device, NetworkOnly}`）在 `bootstrap::build()` 之前完成模式选择——`MEDIA_AGENT_NETWORK_BINDING` 为显式 Network-only 选择器，与 `MEDIA_AGENT_DEVICE_BINDING`/diagnostic/selftest 叠加均 fail-closed；`bin/media-agent.rs` `run_network_only_runtime() -> !` 直消费 production builder（无 discovery / 无 DeviceBindingManifest / 无 `LeaseKey::Device` / 无 DeckLink open / 无 SDK probe），单 Runtime owner，零媒体自动启动，exposure 与 Device production 一致（query/command/idem/switch = None ⇒ 503 契约）。`FfmpegNetworkComposition` 增 `projection_log` 只读观测面。
- 修复② gate：`bin/gates.rs` 的 `VBMF_FFMPEG_RTMP_SOURCE` dispatch 先于 common `bootstrap::build()`（`run_network_only_gate()`）；旧 gates 走唯一 bootstrap 不变；gates.rs A20-03 注释最小 reconciliation（Network-only = 冻结受限 composition path，非第二 Runtime truth）；gate 内新增 D10 机械断言（startup：无 device plane/仅 rtmp-input/恰 1 Resource/DeviceLease=0；teardown：FFmpeg child 无残留/manifest 字节不变），各打印 `RF-SRC-RTMP-02 D10 … PASS` 行；source gate 失败 marker 修正为 RF-SRC-RTMP-02。Mimosa 钩子触发的真实加固：gate manifest 写入拆纯 body + temp-dir-only 路径（endpoint 只进 JSON body）、读回 canonicalize+前缀校验、HLS fixture 目录拒绝 `..` 并限 temp dir。
- 软件（Dev VM，最终态）：focused mode **6/6** + closure **3/3**（真实 production 入口 zero-device）+ tg2 **4/4** + rf_ff_01e **3/3**；default **324/324**；simulation **324/324**；mock **536/536**；ffmpeg-backend **359+1 ignored**；clippy×3 `-D warnings`、fmt、check --all-targets、architecture lint（含 A20-03-BS-01）、remove-adapters、diff-check 全 PASS。
- BMD exact `d13f1fd`（archive `7f242a25…`=盒一致；binary `3d784e2a…`；cargo 1.98.0）：**4 次 gate 运行日志中 device discovery/lease acquired/adapter selection/DeckLinkAPI = 0 行**；loopback 回归 PASS（recovery 3473648→3473845）；Tier 1 PASS（`LISTEN 10.30.15.10:19350` 显式 LAN 绑定·recovery 3474113→3474312·manifest MD5 `29570aa7…` 字节不变）；Tier 2 PASS（`ESTAB ← 172.17.0.2:52228` 独立 netns 第三方推流·recovery 3474624→3475042·二次外部推流）；全部含 D10 startup/teardown PASS + `RF_SRC_RTMP_01_BMD_SOURCE_RECOVERY_PASS`；device-2 PID 992634 全程存活；零 ffmpeg/listener/docker 残留；UFW 临时规则已删除复核。
- Evidence：`evidence/bmd-10.30.15.10/2026-09-19-rf-src-rtmp-02-tg6r-closure-reacceptance/` + EVIDENCE-INDEX 行；报告：`docs/superpowers/reports/2026-09-19-rf-src-rtmp-02-closure-reconciliation.md`。
- 边界：`SourceIntent::Rtmp` wire 未变；无 Control Plane/API 扩展；未触发 frozen stop condition；SRT/Program/Switch/SRS/Recording/Replay/RH-FLOW/RH-IDEM/24h 维持。如实披露：Dev VM 侧 Mimosa 完整扫描两次 commit 均 scanner_enobufs（聚焦 normal 扫描 0 findings，不宣称完整审计）；Tier 2 PEER2 ss 行未捕获（gate 内 recovered-A/V 为证）。
- **增补（2026-09-20，Mimosa L2 停钩复查）**：`06e272c` gate 路径产出点收口——`write_gate_manifest_file` 返回前 canonicalize + temp-dir 限定（binding path 一律规范化限定值）；读回 helper 纵深再校验；HLS fixture 创建前词法限定。wire/流程/D10 断言零变化。BMD @ `06e272c`（archive `7ae0cd87…`·binary `38af7706…`）native build + loopback gate leg rc=0（D10 全行 + `manifest_bytes_unchanged=true` + 零残留）；日志归档 tg6r 目录 `l2r-gate.log`；CI 结论见 §7。
- **增补 2（2026-09-20，用户边界复查：symlink side-effect 窗口）**：`777319f` gate fixture 路径协议彻底关闭——manifest 单 fd `create_new`+`O_NOFOLLOW`+创建时 0600（无先写后 chmod 窗口、umask 干扰显式失败、无 `fs::write` fallback）；canonical temp root 先解析 + direct-child 等式校验（拒绝先于任何文件系统变更）；HLS fixture 仅允许 canonical temp root 直接子目录、leaf 预存在（含 symlink）即拒、非递归 `create_dir`。新增 7 个 focused path-only negative tests（cfg=acceptance 特性对）。BMD @ `777319f`（archive `84d58532…`·binary `47ba78a7…`）native build + **path tests 7/7 PASS** + loopback gate leg rc=0（D10 startup/teardown + `manifest_bytes_unchanged=true` + 本轮 manifest mode 600/159B 落盘复核 + 零残留 + device-2 未触碰）；日志 `pa2-gate.log`（md5 `956ab9f4…`）。按授权仅复跑 loopback leg；Runtime/wire/D10/TG-6 判据零变化，RF-SRC-RTMP-02 维持 COMPLETE。

### 3.61 STANDALONE-ENTRY-01 planning/reconciliation 收口（2026-09-19）

Status: **PLAN FROZEN / SE-01A READY（planning packet 完成，首个 bounded 实施子包解冻）**

- 只读 live-tree audit + Authority reconciliation + 冻结设计（S1–S10）+ bounded 子包分解（SE-01A/C/D/B）+ acceptance matrix 已落 `docs/superpowers/plans/2026-09-19-standalone-entry-01-planning.md`。
- 审计关键事实：全仓**无 POSIX 信号处理**（SIGTERM 孤儿化 FFmpeg 子进程 = 硬缺口 A）；machine pin 仅 env 身份（缺口 B）；`ops/` 为 V0.2 全栈占位形态（9 服务，`Dockerfile.media-agent` 注释模板）；Deployment SoT（2026-08-25@`a6eca1f`）早于 FFmpeg/Network-only 全部演进；BMD 无 VBMF 服务、`/opt/vbmf-dev/repo` 旧树（risk 4）待以版本化 install 正面解决；readiness/liveness 未区分。
- 冻结裁决：standalone lane = 单 `media-agent` 进程 + `/etc/vbmf` manifests（0600）+ env/unit + `/health` + systemd，运行不依赖任何容器/DB/控制面（S1）；三层 SoT 不重开，全栈 lane 与 standalone lane 并存互不依赖（§3 reconciliation）；部署工件零状态复制（Runtime owns truth）；install/upgrade/rollback = 版本化目录 + symlink + exact-commit manifest（S6）；SIGHUP 不做热加载（frozen D3）。
- 子包顺序：**SE-01A graceful shutdown（SIGTERM/SIGINT 有序停止 + Starting 置位）→ SE-01C readiness/文档面 → SE-01D machine-id 收敛 /etc/machine-id → SE-01B install/unit/BMD 部署对账（需 BMD 窗口）**。
- Forbidden（全系列）：Web Console/Fastify/SoR/SDK 建设、ops/ 全栈占位修改、/health wire 变更、manifests 热加载、第二 Runtime/监督 owner、`/opt/vbmf-dev/repo` 破坏性同步、24h stability 宣称。

### 3.62 SE-01A 收口（2026-09-19）— standalone graceful shutdown

Status: **COMPLETE / SOFTWARE + CI + BMD SMOKE VERIFIED（runtime smoke 级；无媒体会话）**

- Implementation chain：`eb49718`（`src/shutdown.rs` 新模块 + `bin/media-agent.rs` 双 runtime 接线 + `bootstrap` Starting 置位）→ `e3e7fe4`（测试 env 泄漏 RCA 修复）。**e3e7fe4 CI `35489924796` 7/7 required PASS**（BMD smoke 绑定该 SHA；archive `c715d373…`，binary `82abccb3…`）。
- 语义（plan S3/S4）：SIGTERM/SIGINT → SessionManager 唯一 owner 按 `created_at` 降序 drain 活跃会话 → exit 0（**SIGTERM 不再孤儿化 FFmpeg listener**）；SIGHUP 捕获但 warn 无操作（frozen D3 startup-only）；第一终止信号后恢复默认处置（二次信号逃生门）；`AgentState::Starting` 起始、组合根完成置 Ready（readiness）。
- failure-first RCA ×3：①二次 install 失败未回滚写端原子 → handler 写已关闭 fd → wait 永久挂起（测试暴露，已修）；②drain 序首版依赖 HashMap 投影序 → 并行测试随机翻转（改 created_at 降序 + tie-break）；③CI `35487902795` @ `9067989` rust-test-matrix FAIL——`rejects_diagnostic_mode` 泄漏 `MEDIA_AGENT_MODE=diagnostic` 至 closure 测试 + mutex 中毒级联（5 failed/354 passed）；`e3e7fe4` 以 `StartupEnvGuard`（Drop 清理）+ 抗中毒锁修复，9 连跑全绿。`9067989` 失败与 `eb49718` 恰好 success（35489769503 7/7）如实并存登记。
- 软件（e3e7fe4 最终态）：default **326/326**；simulation **326/326**；mock **541/541**；ffmpeg-backend **361+1 ignored**；clippy×3、fmt、architecture lint、remove-adapters、diff-check 全 PASS。
- BMD smoke（真实 production binary `--features ffmpeg-backend` + 运维形态 manifest）：零设备行为行；`/health` `state:Ready, devices:0`；SIGHUP 存活+warn；SIGTERM → exit 0 + drain + complete；零残留；device-2 PID 992634 未触碰。Evidence：`evidence/bmd-10.30.15.10/2026-09-19-se01a-graceful-shutdown/` + EVIDENCE-INDEX 行；报告：`docs/superpowers/reports/2026-09-19-se01a-graceful-shutdown.md`。
- 覆盖缺口（如实）：进程级 binary 测试未入库（Mimosa 写入钩子拒绝 `Command::new(env!(...))` 测试形态，三轮重构后放弃）；真实 binary 会话内 drain 演示不可行（P1-3 零自动启动 + 控制面未接）——语义由 mock 套件 + TG-6 gate stop 链锚定，完整演示留 SE-01B。Dev VM 侧 Mimosa 完整扫描持续 scanner_enobufs（钩子多数回落兼容策略；聚焦扫描 0 findings；不宣称安全审计完成）。
- 下一子包：**SE-01C**（readiness/liveness 文档面 + 配置权威清单 + 退出码契约；/health wire 零变化）。

### 3.63 SE-01C 收口（2026-09-20）— standalone 运维语义文档

Status: **COMPLETE / DOCS-ONLY + CI VERIFIED（零 Runtime 代码改动；/health wire 零变化）**

- 交付：`docs/architecture/STANDALONE_MEDIA_AGENT_OPERATIONS.md`（语义权威页：/health as-is 契约、readiness/liveness 八态全矩阵、production vs gates 双退出码契约、配置权威清单四组——A 组 11 个 `MEDIA_AGENT_*` + B 组 5 个 `VBMF_OUTPUT_*` + C 组身份/运行环境 + D 组 gates acceptance env 全表，逐项七列）+ `DEPLOYMENT_AND_DEV_RUNTIME.md` §17 standalone lane 增补（full-stack lane 与 `ops/` 不动，install/unit 留 SE-01B）+ architecture README 索引 + 本报告。
- **S4 reconciliation 立档**：冻结 S4"非 Starting/ManualRequired 即 ready"收敛为 **ready ⟺ Ready|Capturing**（Degraded/Restarting/Backoff/Escalated = live-but-not-ready；依据 `health.rs` 优先级格 + Supervisor Escalate→manual_required 唯一出口）。判据收紧，非 wire/状态机变更。
- 如实披露（写入语义页）：`Restarting`/`Backoff` 无事件生产者、`Escalated` 无 /health 构造点（冻结词表登记）；Network-only 生产路径 `state` 现仅 Starting→Ready（projection_log 未接 fold 消费者，Degraded 派生属 watchdog 演进项）；health bind 失败仅日志、进程继续；machine identity 按现实现（`VBMF_MACHINE_ID` > `HOSTNAME` > 空串跳过 pin，未提前实现 SE-01D）；`MEDIA_AGENT_RPC_BIND` UNWIRED；`VBMF_OUTPUT_*` 为 P1a demo 层。
- 验证：code-to-doc cross-check 全一致（env 枚举 grep 逐项对表）；/health 既有测试回归 PASS（default 324/324·mock 536/536·ffmpeg-backend 361+1 ignored，`777319f` 上运行）；architecture lint + remove-adapters PASS；CI 见 §7。`scripts/check_docs.py` 本 VM 病态挂起（Sep14/17 起即有孤儿进程），未作门禁（不在 7 个 required context 内）。
- 报告：`docs/superpowers/reports/2026-09-20-se01c-standalone-operations-docs.md`。
- 下一子包：**SE-01D**（machine-id 收敛；Runtime 行为变化，独立 commit/验收）。

### 3.64 SE-01D 收口（2026-09-20）— machine identity 收敛（S5）

Status: **COMPLETE / SOFTWARE + CI + BMD RE-PIN VERIFIED（Runtime 行为变化·独立 commit `6932d5e`）**

- 实现（frozen S5）：`resolver.rs::current_machine_id` 解析链 = `VBMF_MACHINE_ID`（显式覆盖·trim·空白视为未提供）> `/etc/machine-id`（生产权威·trim·纯空白=未解析出）> 空串；**HOSTNAME fallback 移除**。消费点 fail-closed 语义零变化（NetworkSourceBinding 空=拒绝 `MachineIdUnresolved`；DeviceBindingManifest `check_machine_identity` 空=跳过且永不匹配）。可测缝隙 `current_machine_id_from(env, etc)`；`network_binding` 错误消息与注释同步去 HOSTNAME。
- 回归：6 项 `se01d_*` 解析链测试（含 **HOSTNAME 不再被读取**的直接证明）+ 两类 manifest pin 既有锚定全绿（network Mismatch/Unresolved；device mismatch/空跳过）。
- Dev VM：default **332/332**；simulation **332/332**；mock **547/547**（520+9+12）；ffmpeg-backend **367**；clippy×4 档、fmt、architecture lint、remove-adapters 全 PASS。CI run `35492879328` **7/7 required PASS**。
- BMD exact `6932d5e`（archive `4c79b0d5…`；binary `media-agent 491942be…`/`gates 30661ab3…`；native `bmd,ffmpeg-backend --bins`）：全部 leg `env -u VBMF_MACHINE_ID`，身份唯一来源 `/etc/machine-id`（`709cec…a39`）。**Network 类**：loopback gate rc=0（D10 startup/teardown PASS·manifest_bytes=176·落盘 machine_id=/etc 值且生产 loader 载入）；production binary 负 pin → exit 2 mismatch、正 pin → `/health Ready devices:0` + SIGTERM exit 0。**Device 类**：v5 manifest 重 pin → 真实 binary 全启动（只读 discovery count=3·`/health Ready devices:3`·零自动启动）+ SIGTERM exit 0；负 pin → exit 2 + `ManifestEnvironmentMismatch … 当前主机 '709cec…'`（身份来源直接证据）。device-2 PID 992634 全程存活；零 ffmpeg/listener 残留。Evidence：`evidence/bmd-10.30.15.10/2026-09-20-se01d-machine-id/` + EVIDENCE-INDEX 行；报告：`docs/superpowers/reports/2026-09-20-se01d-machine-id.md`；语义页 §4.3/§4.5 已随实现回改（HOSTNAME 行移除、`/etc/machine-id` 行新增、迁移注记）。
- 运维影响：既有以 HOSTNAME 风格值（如 `10.30.15.10`）pin 的清单在无 env 时将被拒——重 pin 或显式设 `VBMF_MACHINE_ID`。
- 下一子包：**SE-01B**（install/upgrade/rollback + systemd unit + BMD 部署对账执行；需 BMD 窗口）。

### 3.65 SE-01B 收口（2026-09-20）— standalone 部署对账（S6/S7/S8）·STANDALONE-ENTRY-01 全链完成

Status: **COMPLETE / CI + BMD DEPLOYMENT VERIFIED（部署工件 + 实机对账·§6 矩阵 6/6）**

- 工件链：`50a12fa`（`ops/standalone/`：installer/switcher/unit/README 入库）→ `0228849`（installer `/var/lib` sudo 修复，RCA-1）；CI `35493350858`/`35493444527` 均 **7/7**。
- BMD 实机（exact `0228849`；v1=`6932d5e` 回滚基准）：`/opt/vbmf/` 双版本目录 + 原子 `current` + install-manifest.json（sha256/features/ci-run-id）；`/etc/vbmf/`（env file + 0600 `/etc/machine-id`-pinned network binding）；`/var/lib/vbmf` 预留；unit 已装、终态 inactive 未 enable。service start → `/health Ready devices:0`；SIGTERM → `Result=success ExecMainStatus=0`；重启再 ready；外部 netns 第三方推流（已安装树 gates binary）→ source/recovery（3498005→3498287·PublisherDisconnected）/teardown/D10 `manifest_bytes_unchanged=true` 全 PASS；device 模式零回归（Ready·devices:3·exit 0）；rollback 双向 digest-verified。边界：device-2 PID 992634 全程存活、`/opt/vbmf-dev` 未触碰、UFW 临时规则删除复核、零残留。
- Failure-first：RCA-2 外部推流验收编排三轮（固定 sleep 错过 6s 恢复窗口——时间戳实证；等 `recovery PASS` 行推二路=死锁 + 二路无重试）→ 事件触发断连 + `--restart=on-failure` 二路容器；**产品代码零改动**。P1-3 reconciliation 沿用 SE-01A（service 进程内会话演示待控制面；A/V 腿经已安装树 acceptance root）。本地 Mimosa 钩子把"远端执行已提交脚本"误判为写源码——`ls|grep` 选择形式调用，报告透明登记；scanner_enobufs 沿用，不宣称安全审计。
- Evidence：`evidence/bmd-10.30.15.10/2026-09-20-se01b-standalone-deploy/` + EVIDENCE-INDEX 行；报告：`docs/superpowers/reports/2026-09-20-se01b-standalone-deploy.md`。
- **STANDALONE-ENTRY-01 收口**：SE-01A（graceful shutdown）→ SE-01C（运维语义文档）→ SE-01D（machine identity）→ SE-01B（部署对账）四子包全 COMPLETE；STANDALONE umbrella 其余项维持 BACKLOG。硬化建议登记（不阻塞）：专用服务用户替代 `User=lytv`。

### 3.66 SE-01B reconciliation-required entry（2026-09-20）

Status: **SE-01B RECONCILIATION REQUIRED（2026-09-20 登记）— 已由 SE-01B-FIX 清偿（§3.67 收口；本节保留缺陷记录）**

- 触发：用户独立复核（live `main = 261d819`、CI `35494022684` 7/7、SE-01B BMD evidence 逐项核对）接受主体成果（SE-01A/C/D 主体接受；SE-01B 真实 install/Ready/stop/restart/第三方推流/recovery/Device smoke/rollback 证据有效），但发现 **3 个 closure defect**，开 bounded packet **`SE-01B-FIX`**（不回退已完成的 Runtime/RTMP/SE-01A/C/D）：
  1. **Git working tree 口径**：`?? .zcodeignore` 未提交文件存在的同时报告 clean——harness 本地文件经 checkout-local `.git/info/exclude` 处理（不改 repo `.gitignore`，不提交该文件）。
  2. **systemd unit 真实失效**：BMD `se01b-unit.log` 出现 `Unknown key 'StartLimitIntervalSec' in section [Service], ignoring.`——`StartLimitIntervalSec`/`StartLimitBurst` 必须移入 `[Unit]`；原报告 `StartLimitBurst=3/30s` 结论不能维持；修正后 `systemd-analyze verify` 必须零 warning/零 unknown key；旧 warning 日志保留为历史证据。
  3. **install provenance 不满足 frozen S6 "exact SHA"**：现实现只有 caller 提供的 `version_tag = 0.1.0-<shortsha>`，未证明 archive 真属于该 commit——改 fail-closed：`git get-tar-commit-id` 从 archive 读取 embedded full 40-hex SHA；short SHA 必须为 full SHA 前缀否则拒装；manifest 新增 `git_commit_sha`；`switch-current.sh` 切换时验证 full SHA 格式 / tag 前缀一致 / binary digest。
  4. **install failure atomicity（RCA-1 已实证）**：现实现先建正式 `<tag>` 目录再解包/构建/写 manifest——中途失败留下占用正式版本名的半安装目录，只能人工删除。改 staging 协议：同文件系统 `.staging-<tag>-<pid>` 完成全部步骤（验证→extract→build→manifest→self-check），trap 自动清理，全部成功后同 FS `mv -T` 原子落成，最终目录已存在则 fail-closed；补 failure-injection matrix。
  5. **S7 权限再核（不扩权）**：`/var/lib/vbmf`（root 属主）owner/mode 写入 install manifest/report；未来 Runtime 写入该目录必须另过 Authority；`/etc/vbmf` manifests 继续 0600 + service-user 属主。
- 验收（SE-01B-FIX DoD）：shell/static + `systemd-analyze verify` 零 warning + installer focused failure matrix + Dev VM regression + CI 7/7 + BMD（新 exact commit 安装 / exact-SHA provenance 链 / failed install 不污染正式目录与 current / valid install Ready / systemd bad-config StartLimit 命中后 reset-failed 恢复 / SIGTERM exit 0 不 restart / rollback / device-2 不受扰 / `/opt/vbmf-dev` 不触碰）+ SE-01B report/evidence/STATE 更新。修复完成前 STANDALONE-ENTRY-01 不写"无遗留 COMPLETE"。
- 同轮登记（本包不修）：BMD Device smoke 两条真实 `PortId 碰撞` warning（`se01b-device-smoke.log` L9/L10；`port.rs` derive 键不含 direction/Analog 位折叠，代码注释已预告专门 closure）→ §8 Active risks + §5.1 BACKLOG `PORT-COLLISION-01`，防跨窗口丢失；registry 现 fail-closed，非本包 blocker。`scripts/check_docs.py` 本 VM hang + 旧孤儿进程继续登记 Verification Debt，不为绿灯杀未知归属进程。

### 3.67 SE-01B-FIX 收口（2026-09-20）— provenance/atomicity/systemd reconciliation；STANDALONE-ENTRY-01 恢复全链 COMPLETE

Status: **COMPLETE / CI + BMD DEPLOYMENT VERIFIED（§3.66 DoD 全项）**

- Commit 链：STATE 降级 `f14cede` → **implementation `a238558`**（CI `35541709917` **7/7 required PASS**；diff 仅 `ops/standalone/` 5 文件，Runtime/RTMP 零改动）→ 本 STATE/evidence 收口提交。
- 缺陷1 `.zcodeignore`：checkout-local `.git/info/exclude`（repo `.gitignore` 未动）→ `git status --porcelain --untracked-files=all` = 空。
- 缺陷2 systemd：`StartLimit*` 移 `[Unit]`；BMD `systemd-analyze verify` 新 unit **零 warning/零 unknown key**（旧 unit 同机复现 line 21 Unknown key，历史 `se01b-unit.log` 保留）；**StartLimit 实证**：错误 machine-pin → 恰 3 次 exit 2（machine_id mismatch）→ `Start request repeated too quickly` → failed；恢复 + reset-failed → `/health Ready devices:0`；SIGTERM → `Result=success ExecMainStatus=0 NRestarts=0` 无 respawn；重启再 Ready。
- 缺陷3 provenance：`git get-tar-commit-id` full-SHA fail-closed（bad archive / 伪造 shortsha 拒装）+ manifest `git_commit_sha` + installer self-check；switcher 四类篡改拒绝（digest / SHA / legacy 无字段 / version_tag 错位）；**BMD 六环链机械核验**：GitHub main SHA `a238558ac0e2…` → embedded SHA → archive sha256 `341f0822…` → manifest → binary `fd2412d2…` → current symlink。
- 缺陷4 atomicity：staging 协议（trap 清理 + promote 前 fail-closed + `mv -T`）；VM failure matrix **37/37**（`ops/standalone/tests/install-failure-matrix.sh`）；BMD 拒绝矩阵全部 `/opt/vbmf` 零变化 + 零 `.staging-*` 残留。
- S7：`/var/lib/vbmf` = `root:root 755` 入 manifest（`var_lib_path`/`var_lib_owner_mode`）；不扩权；`/etc/vbmf` 0600 + lytv 复核。
- BMD 现场处置（如实）：legacy `0.1.0-0228849`（manifest 无 git_commit_sha）隔离改名保内容后以修复版 installer 正规重装为 provenance-verified 回滚伙伴（binary 同 digest 确定性佐证）；rollback 双向 verified + Ready；device-2 PID 992634 存活；`/opt/vbmf-dev` 未触碰；零残留；终态 `current -> 0.1.0-a238558`、unit inactive+disabled。
- Evidence：`evidence/bmd-10.30.15.10/2026-09-20-se01b-fix-reconciliation/`（12 文件）+ EVIDENCE-INDEX 行；报告：`docs/superpowers/reports/2026-09-20-se01b-fix-reconciliation.md`。如实披露：build-failure 注入仅 VM stub；installer self-check 安装中触发分支无独立注入。
- **收口**：SE-01B 恢复无遗留 COMPLETE；STANDALONE-ENTRY-01 全链（SE-01A/C/D/B + reconciliation）COMPLETE。下一 = `RUNTIME-CONTROL-ENTRY-01`（PLAN ONLY）。

### 3.68 RUNTIME-CONTROL-ENTRY-01 planning/reconciliation 收口（2026-09-20）

Status: **PLAN FROZEN / RCE-01A READY（planning packet 完成，首个 bounded 实施子包解冻并按用户裁定直接开工）**

- 交付：`docs/superpowers/plans/2026-09-20-runtime-control-entry-01-planning.md`——live-tree audit A1–A10（file:line 锚定）+ 五项 Authority 裁定 + 冻结设计 D1–D8 + failure-first matrix F1–F10 + security/exposure + Device/Network-only parity + 子包 RCE-01A/B + acceptance matrix。
- **R1 漂移裁定**：现 Rust `/api/v1/*` 五端点 = prototype/diagnostic surface（0.7C-8/R60 冻结；生产 query/idem=None ⇒ 503 不变）；Product `/api/v1/*` 归 Fastify（CONTROL-PLANE）；internal Runtime Control = `/internal/v1/*`（EXTERNAL_API_CONTRACT §1 命名空间）+ JSON-RPC 2.0（TECHNOLOGY_STACK wire 形态）——**两份 frozen 文档零修改同时满足，无 stop condition**。
- **R3**：`rpc.rs` SoT §14 旧 verb 集（lease/pipeline-handle 模型）按 Authority 顺序被 Phase 0.7C 会话命令面取代（历史记录保留 + 头注 reconciliation）；**R4**：requested→actual-state 九段旅程 = 命令面（四状态+四幂等出口）+ 查询面（SessionPhase/`runtime.query`//health）两平面分层映射，`Executed`≠SignalVerified≠healthy 红线锚定，`Accepted` 为保留态如实登记；**R5**：RH-IDEM-01 维持 DEFER-UNTIL-CONTROL-PLANE（内部面进程内幂等 = 传输重试守卫；外部 durable = boundary-of-record；分层非双 truth）。
- 冻结设计要点：四方法封闭词表（`runtime.query`/`command.dispatch`/`events.projection`/`agent.health`）；`MEDIA_AGENT_CONTROL_BIND` 默认 `127.0.0.1:8081` 回环；Device + Network-only 两生产组合根对称接线；P1-3 "等待显式 Intent" 由 internal 面承接；prototype 面/`/health`/SE-01A 关停语义零变化；零媒体自动启动红线不变。
- 子包：**RCE-01A**（internal control surface 实现 + 生产接线 + F1–F10 focused tests + 全矩阵 + CI 7/7）→ **RCE-01B**（BMD 真机命令旅程：systemd service 经 internal 面 create/start/query actual state/stop/SIGTERM 活会话 drain + 边界）。
- Forbidden（全系列）：Fastify/PostgreSQL/BullMQ/Web Console/SDK/SRS 建设、新 Runtime owner、新 wire shape、frozen 文本修改、RH-IDEM 提前解冻、intent 执行字段解禁。

### 3.69 RCE-01A 收口（2026-09-20）— internal Runtime Control surface 实现

Status: **COMPLETE / SOFTWARE + CI + VM PRODUCTION SMOKE VERIFIED（BMD 命令旅程 = RCE-01B）**

- Implementation `06bc01a`（CI `35543068464` **7/7 required PASS**）：
  - **新模块 `internal_control.rs`**：`POST /internal/v1/agent` JSON-RPC 2.0（envelope：非 JSON→400 / `jsonrpc` 版本错→`-32600` / 缺 method→`-32602` / 未知 method→`-32601`（附封闭词表）/ 组合根未装配→503）；四方法 `runtime.query`（快照 + program_switch 合并复用）/ `command.dispatch`（经 `map_command_request`→`CommandIdempotency`→`map_dispatch`，复用 transport 纯函数）/ `events.projection`（守门字段 `event_projection_snapshot`）/ `agent.health`（与 `/health` 单源 `health_snapshot_json`）；per-connection thread + 读 10s/写 30s 超时 + `MAX_REQUEST_BYTES` 上限（R62/R63 形态）。
  - **生产接线**：Device-gstreamer / Device-ffmpeg / Network-only 三生产根均构造 internal ctx 并监听 `MEDIA_AGENT_RPC_BIND`（`config.rs` 既有字段，默认 `127.0.0.1:50051` 回环——SE-01C 登记的 UNWIRED 债就此关闭；localhost/UDS 告警面维持）；诊断路径不启动本面；prototype `/api/v1/*` 生产 503 契约与 `/health` wire 零变化（`api_mgr` 语义不动）。
  - **`rpc.rs` reconciliation**（§3.68 R3）：旧 §14 verb 集标注 HISTORICAL，头注指向 internal control；`transport.rs` `apply_program_switch` 升 `pub(crate)` 复用；语义页新增 §6（面/词表/两平面红线/幂等/已知 wire 缝隙）。
- 软件（Dev VM 最终态）：focused `internal_control` **11/11**（词表快照/envelope 错误码/replay+conflict/形状拒绝/switch 无平面 classification=rejected/503/查询面 actual-state 观察含 stop≠release/命令成功≠agent Ready 红线/并发恰一次 1+3/路由表/command_id 派生锚定）；default **332/332**；simulation **332/332**；mock **537/537**；ffmpeg-backend **367+1 ignored**；clippy×4 档、fmt、`check --all-targets`（含 mock,ffmpeg 交叉）、architecture lint、remove-adapters proof 全 PASS。
- **VM production smoke（真实 `--features ffmpeg-backend` binary + network-only 组合 + 0600 machine-pin binding）**：`internal runtime control listening 127.0.0.1:50051`；`agent.health`=`Ready devices:0`；`runtime.query` 全快照（Network Resource available·`program_switch:null` 诚实缺席）；`events.projection` 守门字段在位；未知 method `-32601` 带词表；`command.dispatch`（stop unknown session）= 裁决 executed + `classification:permanent` + detail 诚实（`command_id` v5 确定性派生实证）；**prototype `/api/v1/runtime` 与 `/api/v1/commands` 双双 503 契约保持**；自有 `/health` wire 逐字段不变；SIGTERM → drain → exit 0 → 50051 释放。VM 环境如实披露：8080/18080 被本机既有孤儿进程占用（含 check_docs.py 家族），health bind 按契约 error 继续，未杀未知归属进程。
- 如实登记（非阻塞）：① wire 缝隙——`runtime.query` session id 为显示形态 `session-<hex>`，`command.dispatch` 要求 canonical UUID，消费方自行映射（Product API 资源形状归 Fastify 阶段；语义页 §6 已登记）；② `CommandStatus::Accepted` 仍为保留态（dispatch 现路径不产出，0.7C 冻结原样）；③ `MEDIA_AGENT_RPC_BIND` 覆盖为 UDS 的支持面未实现（本包仅 TCP localhost）。
- 下一：**RCE-01B**（BMD 真机命令旅程——systemd service + internal 面 create/start/actual-state/stop/SIGTERM 活会话 drain + 边界）。

### 3.70 RCE-01B 收口（2026-09-20）— BMD 真机命令旅程；RUNTIME-CONTROL-ENTRY-01 全链 COMPLETE

Status: **COMPLETE / CI + BMD HARDWARE VERIFIED（真实命令旅程 12/12）**

- BMD exact `06bc01a`（修复版 installer 安装 `0.1.0-06bc01a`·provenance 六环：archive `0cdfa946…`→embedded SHA=manifest=GitHub SHA→binary `172f46ac…`→current）：service Ready + `/internal/v1/agent` JSON-RPC `127.0.0.1:50051`（media-agent 进程归属）；**命令旅程**：`start_session`（授权五元组）executed → 查询面 session `running`/resource `allocated` → **真实 ffmpeg listener 19351**（service 进程自身媒体旅程，非 gates 演示）→ replay 幂等；二次 start preflight 拒（Allocated+LeaseConflict·retryable 诚实）；显式 `stop_session` → released/available/listener 释放；释放后重启成功；Running 会话 `release_session` 诚实拒绝（防孤儿·permanent）；SIGTERM 带活会话 → `session stopped`→`drained count=1`→exit 0；边界全绿（device-2 PID 992634·`/opt/vbmf-dev`·零残留）。
- Evidence：`evidence/bmd-10.30.15.10/2026-09-20-rce01-internal-control-journey/`（7 文件）+ EVIDENCE-INDEX 行；报告：`docs/superpowers/reports/2026-09-20-rce01-internal-control-journey.md`。如实披露：session id wire 缝隙（显示形态 vs UUID，消费方映射，语义页 §6 登记）；journey2/3 编排引号缺陷（journey4 修正，产品代码零改动）；A/V 内容验证不宣称（属 gates/信号面）。
- **收口**：RUNTIME-CONTROL-ENTRY-01（planning §3.68 + RCE-01A §3.69 + RCE-01B）全链 COMPLETE——"真实 standalone `media-agent` 可被 canonical Runtime Control 创建 Session、启动、观察 actual state、停止、恢复，Runtime 唯一 truth" 已实机落地；frozen Contract 零修改。下一按依赖序评估 CONTROL-PLANE（Fastify Product `/api/v1/*` + RH-IDEM-01 外部解冻入口）→ VBMF-SDK → WEB-CONSOLE。

### 3.71 RCE-D3-BIND-RECONCILIATION 收口（2026-09-21）— bind 命名漂移修正 + exposure 政策显式化

Status: **COMPLETE / DOCS+COMMENTS-ONLY + STATIC VERIFIED（零行为变化·零 frozen Architecture 修改·无 stop condition）**

- 触发：用户复核发现 frozen RCE plan D3（`MEDIA_AGENT_CONTROL_BIND`/`127.0.0.1:8081`/RPC_BIND 保持 UNWIRED）与已验证实现 `06bc01a`（`MEDIA_AGENT_RPC_BIND`/`127.0.0.1:50051`/已接线，BMD 12/12）之间存在**未记录命名漂移**，且多处文档/注释用模糊 "localhost-only" 而代码只对 `0.0.0.0`/`::` 告警、full-stack 冻结拓扑（React→Fastify→JSON-RPC→Media Agent 跨容器）与严格 127.0.0.1-only 政策冲突。
- 四裁定（经只读核对 plan D3 / EXTERNAL_API_CONTRACT / TECHNOLOGY_STACK / DEPLOYMENT_AND_DEV_RUNTIME / STANDALONE_MEDIA_AGENT_OPERATIONS / config.rs / internal_control.rs / bin/media-agent.rs / RCE focused tests / RCE-01B evidence）：
  1. canonical 配置名 = **`MEDIA_AGENT_RPC_BIND`**（单一配置 Authority；`MEDIA_AGENT_CONTROL_BIND` 永不创建）；
  2. canonical default = **`127.0.0.1:50051`**（standalone 本机 control entry，BMD 实证）；
  3. standalone exposure = 四规则 R-a..R-d（默认回环 canonical / 显式私有 bind 允许且为运维责任（面无认证）/ 宿主 0.0.0.0/:: 禁止公网（现告警，fail-closed 升级 = CP 阶段 hardening 候选）/ 绝不直接公网不经 Nginx 非 Product API）；
  4. full-stack Fastify↔Agent = R-e/R-f（唯一通道 `/internal/v1/agent` over compose dedicated private service network；容器内 netns 绑定可达地址可接受；**host port publish 50051 禁止**（frozen compose 现状维持）；**Nginx 禁止新增 `/internal/*` 路由**（frozen 路由表维持）；跨主机明文禁止、须私网+mTLS（#110 形态），部署 Authority 属 CP 阶段）。Runtime 唯一 truth 不变（Fastify 只 command+observe）。
- 修正面：RCE plan 追加 **D3-R amendment**（原文保留为漂移记录）；语义页 §4.1 行 + §6 exposure 四规则细化；`bin/media-agent.rs` 两处 log 文案 + `internal_control.rs`/`config.rs` 注释去 "localhost-only" 模糊语（零行为变化）。clippy（mock 全目标）/check（ffmpeg）/architecture lint PASS。
- 如实登记：compose 未设 media-agent 容器的 RPC bind env（full-stack 容器接线 = CONTROL-PLANE 阶段实现项）；UDS bind 形态未实现（TCP-only，§3.69 缝隙维持）。

### 3.72 CONTROL-PLANE-ENTRY-01 planning 收口（2026-09-21）

Status: **PLAN FROZEN / CP-01A READY（planning packet 完成；零 frozen Architecture 修改·无 stop condition）**

- 交付：`docs/superpowers/plans/2026-09-21-control-plane-entry-01-planning.md`——Baseline B1–B10 live-tree audit + 冻结决策 **C1–C14**（Product/prototype 隔离；Fastify↔internal 单 adapter 边界；F1–F12 不变量；external command→durable idempotency→internal dispatch→actual state 全链；RH-IDEM-01 解冻点=CP-01B 外部边界 boundary-of-record；command_id/Idempotency-Key/fingerprint(+principal)/replay/conflict/单向状态机防 ABA/并发恰一次/Fastify 重启租约回收 + agent 重启诚实边界（不自动重发 start_session）；四类 API 责任；Operation 词表与 actual state 两平面；session UUID↔`session-<hex>` adapter 规范化（零 Rust 改动）；PostgreSQL 记录分类（commands/audit 是 CP 记录，session/resource/health 现状绝不入 DB truth）；Auth/RBAC/审计/限流归 Fastify；failure semantics C12；Web Console 只依赖 Product API 无本地 optimistic success；standalone first 维持）+ 时序契约 + failure matrix F1–F13 + owner map + 子包分解 **CP-01A→01B→(01C∥01D)→01E**（显式 deferred：BullMQ/Worker、Web Console、SDK、跨主机 mTLS、agent durable idem、agent UUID wire 增补）+ VM/CI/BMD 验证口径。
- 关键诚实裁定：跨 agent 重启不宣称执行级 exactly-once（进程内幂等表层）；`events.projection` 单消费者 drain ⇒ 多实例事件面禁用直至 outbox 包；CI 新 lane 暂非 required context（required 化随 CP-01A 收口按灰度纪律裁定）。

### 3.73 CP-01A 收口（2026-09-23）— Control Plane skeleton + AgentControlClient adapter

Status: **COMPLETE / SOFTWARE + CI + VM REAL-AGENT SMOKE VERIFIED（BMD 硬件验收 DEFERRED to CP-01E·用户 2026-09-23 指令）**

- 前置 working-tree ownership reconciliation（用户 2026-09-23 指令）：64 个 tracked 修改经全量 SHA256 比对证明 = `comet update`（@rpamis/comet 0.4.3 assets 逐字节一致·mtime 2026-09-22 22:12:16 单批）+ `.gitignore` EOF 换行（managed block 重写）+ `config.yaml` 模板注释删除（项目值全保留，358ba3e 注释 overlay 已恢复）——按仓库先例（358ba3e/54af3de）以独立 chore commit `d049341` 收敛（media-agent CI `35928554906` SUCCESS）；零产品代码混入。
- Implementation `4907147`（22 文件：`apps/api` 17 新文件 + workflow + gate 脚本 + `.gitignore` + compose + Dockerfile + planning 修正）：
  - **Fastify+TS skeleton**（Node 24 / fastify v5 / strict + erasableSyntaxOnly / verbatim；tsc typecheck 与 `rewriteRelativeImportExtensions` emit 双轨）：`buildApp` 组合根 + 统一错误处理器（EXTERNAL_API_CONTRACT §5 十二类封闭词表 envelope：code/message/details/request_id/retryable；诊断只进 server log）+ 404 envelope。
  - **`AgentControlClient`** = Fastify→agent 唯一 internal transport：`POST /internal/v1/agent` JSON-RPC 2.0 四方法（runtime.query/command.dispatch/events.projection/agent.health）；超时预算 query/projection/health ≤3s、dispatch ≤10s（C2 冻结值机检锚定）；失败分类映射——network（含 timeout）/http-status → 503 `DEPENDENCY_UNAVAILABLE` retryable=true；malformed-body/rpc-error/invalid-result → 500 `INTERNAL_ERROR` retryable=false；result 形状校验含新鲜度信封硬前提（generated_at_ms/observation_revision/observation_lineage）。
  - **Product 读 API v0**：`GET /api/v1/runtime` live 投影（零本地缓存·F8；`?session_id=` canonical UUID 过滤·合法不存在→404）；`/health/live` liveness（无依赖探测·compose healthcheck 契约·agent 停机不 flap）；`/healthz` api/runtime 分层（§7 不合并单 status）；不反代 Rust prototype `/api/v1/*`（C1·测试断言唯一出站 = /internal/v1/agent）。
  - **F13 责任归属修正（用户 2026-09-23 指令·已回写 planning §4）**：客户端输入非法 UUID → 400 `VALIDATION_ERROR`；agent 返回非法 `session-<hex32>` wire → 500 `INTERNAL_ERROR` retryable=false（不猜测/不伪 UUID/不当成"没有 session"/不泄漏内部细节）；`session-<hex32>`→canonical UUID 规范化 + label 保留显示串（C9）。
  - **compose 接线收敛**：fastify `MEDIA_AGENT_RPC_URL: http://media-agent:50051`（旧 `MEDIA_AGENT_RPC: …:8080` 占位删除）；media-agent `MEDIA_AGENT_RPC_BIND: 0.0.0.0:50051`（container 私网 bind·D3-R R-e 显式运维动作）+ expose 50051 + 8080 注释纠正为 health listener；**不新增第二张 Docker 网络**（默认 compose 私网已满足安全边界·用户 §四裁定）；`ops/Dockerfile.fastify` 落真实多阶段构建（node:24-alpine·npm ci --omit=dev·curl for healthcheck）。
  - **机检红线**：`scripts/check_control_plane_gate.py`——F11（四个 compose 文件无 50051 host publish/BASE 绑定与 env 断言/nginx 无 `/internal` 无 50051 引用）+ F12（Gate A 词法：apps/api 禁 child_process/spawn 族/ffmpeg/gst-launch//dev/blackmagic/DeckLink，注释剥离 + `(?<![.\w])` 防方法调用误报）。
  - **CI 新 lane** `.github/workflows/control-plane.yml`（job `control-plane`·gate+setup-node v7 SHA-pin+npm ci+typecheck+test+build；**未改 required contexts**）。RCA 记录：首跑失败 = workflow 内 checkout pin 抄写缺一位（39 位非法 SHA·runner fail-closed 正确）+ vbmf runner 无系统 Node——经 `289f69a`/`d1de9fc` 修正。
- 验证（Dev VM）：typecheck PASS；契约+路由测试 **25/25**（healthy query envelope/连接拒绝/超时/HTTP non-2xx/malformed JSON/RPC error envelope/missing-invalid shape×4/dispatch 预算分级/projection 守门/双向 F13/freshness 透传/health 分层/未知路由/唯一出站路径）；**VM 真实 agent smoke**（`--features ffmpeg-backend` network-only 组合 + 0600 machine-pin binding + 50051 回环）：runtime.query 全快照（Network Resource available·program_switch null 诚实）+ freshness 透传 + `?session_id` 400/404 live + agent SIGTERM→drain→exit0→50051 释放→Fastify 诚实 503 `DEPENDENCY_UNAVAILABLE` retryable + `/healthz` runtime:unreachable + `/health/live` 200 不 flap；docker build+run 容器冒烟（healthcheck curl 命令实证）；compose BASE/dev/acceptance/prod `config` 渲染核对（published 端口仅 nginx 443/80 + dev 3000/5173 + SRS 媒体口·50051 零 host publish）；gate 脚本 PASS。
- CI：`4907147` media-agent **7/7 required SUCCESS**（`35929942699`·零 Rust 改动·回归不受影响）；`d1de9fc` control-plane lane **SUCCESS**（`35930737413`：gate PASS + node v24.21.0 + npm ci 52 packages + 25/25 + build）。BMD hardware：CP-01A 不要求，**deferred to CP-01E**（用户 2026-09-23 §九.15）。
- 边界遵守：零 Rust 改动；DB-free；未触碰 RH-IDEM-01（解冻点维持 CP-01B）；未改 required contexts；standalone lane 实证不受影响（smoke 即 standalone 形态 agent 无 Fastify 运行）。
- 下一：**CP-01B — durable command entry**（解冻并清偿 RH-IDEM-01 外部 durable boundary-of-record；PostgreSQL/Drizzle + commands/audit + C4/C6 全语义 + F1–F8）。

### 3.74 CP-01B 收口（2026-09-23）— durable command entry；RH-IDEM-01 清偿

Status: **COMPLETE / SOFTWARE + CI + VM PG 注入 + VM 真实 agent E2E VERIFIED（BMD 硬件验收 DEFERRED to CP-01E）**

- Implementation `a1b612a`（CI：control-plane lane `35932488170` SUCCESS + media-agent **7/7 required SUCCESS** `35932488151`·零 Rust 改动）——**RH-IDEM-01 就此解冻并清偿**（外部 boundary-of-record 落地；agent 进程内幂等表层维持为传输重试守卫；分层非双 truth：Fastify 从不读 agent 幂等表，agent 从不读 Postgres·C5）。
  - **持久层**：PostgreSQL + Drizzle（node-postgres）——`commands`（command_id uuid PK·principal·canonical target·fingerprint·`command_state` 六态枚举 pending/completed/failed/timeout/conflict/rejected·verdict/classification/detail·首次终态 response_status+response_body·时间线）+ `audit_entries`（command_id 唯一·每命令恰一行·与终态同事务）；drizzle-kit 迁移 0000；`MIGRATE_ON_BOOT` 运行时应用（compose BASE fastify env 已接线；镜像含迁移）。表族命名 = planning §5（`audit_entries` 为 CP 专属 reconciliation，V0.2 §5 通用 `audit_logs` 家族不冲突——本行即为登记）。
  - **跨层 command_id 身份**：`commandIds.ts` 与 Rust `transport::command_id_from_string` 逐字节等价（合法 UUID 直用；否则 v5·namespace `62b79f8c-1a2e-4c3d-9f0b-5d6e7a8b9c0d`）；与 Rust uuid crate 三实测向量（含 UTF-8 键）一致；真实 agent 回显 command_id 与 PG 行一致（E2E 实证）。
  - **C4/C6 全语义**：恰一次 claim（`INSERT … ON CONFLICT DO NOTHING`）→ `AgentControlClient.dispatchCommand`（10s 预算）→ 四出口裁决映射（executed/replayed 无 classification→completed；classification=rejected→rejected；permanent/retryable/unknown→failed；conflict→409；不可辨识裁决→500 failed(unknown) 记录在案）→ 单向终态迁移（条件 `UPDATE … WHERE state='pending'` 防 ABA）+ 审计同事务；fingerprint=sha256(kind+canonical target+principal)（target 键序 canonical 化；同键异 payload/异主体→409 RESOURCE_CONFLICT 零执行）；replay=语义级重放首次终态响应（jsonb 键序规范化如实登记——jsonb 不保序，C6"逐字节重放首次响应体语义"措辞内）；in-flight 并发短窗口等待（COMMAND_REPLAY_WAIT_MS 默认 1.5s）后 pending；租约回收（boot 全量 + GET 惰性；COMMAND_LEASE_MS 默认 30s）超龄 pending→timeout(retryable) 绝不猜成功；**F2 红线**：依赖失败终态后同键重放绝不自动重发（dispatch 恰一次机检）。
  - **API**：`POST /api/v1/sessions`（start）+ `POST /api/v1/sessions/:id/stop` + `/:id/release`（Idempotency-Key header 优先于 body command_id·缺省服务端生成 canonical UUID）+ `GET /api/v1/commands/:id`（Operation 旅程 ≠ Runtime 现状两平面；GET 恒 200 记录视图，首响应语义重放只属 POST）；形状校验 4xx 不占幂等（intent object/version/non-empty devices；session path 参数 canonical UUID）；开发态鉴权桩 `x-dev-principal`（**显式 dev-stub·CP-01C 换 Better Auth+CASL**；principal 入 fingerprint）；DB 未配置 → command 面诚实 503 RESOURCE_UNAVAILABLE + `/healthz` db 层 not_configured（api/runtime/db 三层）。
- 验证（Dev VM）：typecheck PASS；套件 41 项（hermetic 28 pass + DB 13 项对 ephemeral `postgres:17-alpine` 运行 **12/12 PASS** + 1 项 skip 自证）；**F1–F8 注入**：agent 停机→503 retryable+PG timeout+审计同落 / 重放不重发（mock dispatch 计数恰一次）/ 终态重放同状态码同响应（deepEqual）/ 异 payload+异主体 409 且第二 payload 零 dispatch / 4 并发恰一次 claim 全收敛同响应 / 崩溃遗留 claim-only pending 超龄租约回收 timeout(retryable)+审计 / agent"重启"后新 command_id 正常旅程 / 命令响应零 Runtime 现状字段 / 裁决映射全表（rejected/permanent/unknown）/ 形状拒绝不占幂等（同键换合法 payload 可执行）；**真实 agent E2E**（network-only ffmpeg-backend binary + ephemeral PG + MIGRATE_ON_BOOT）：`stop unknown session` → 200 `failed(permanent)` 真实裁决完整入 PG（含 verdict 原文）+ 同键 replay 语义一致 + `GET /commands/{v5-derived-id}` 时间线 + `/healthz` 三层 up + commands↔audit_entries 15:15 同事务对应；docker 镜像含 drizzle 迁移（ls 实证）；compose BASE+dev config 渲染核对；gate PASS。
- 边界遵守：零 Rust 改动；未做真实 Auth（dev 桩显式标记）；未建事件面/Web Console/BullMQ；未改 required contexts（control-plane lane 维持非 required）；CI lane 保持 hermetic（DB 测试显式 skip 计数，绝不静默假绿——PG 并发/崩溃注入按 planning §8 由 Dev VM ephemeral 实例承担）。
- 下一：**CP-01C — Auth/RBAC/限流/审计硬化**（可与 CP-01D 并行）；CP-01E 全栈/BMD 集成验收承接 CP-01A/01B 的 BMD DEFERRED。

### 3.75 CP-01C 收口（2026-09-24）— Auth/RBAC/限流/审计硬化

Status: **COMPLETE / SOFTWARE + CI + VM PG 注入 + 容器级安全 smoke VERIFIED（BMD 硬件验收 DEFERRED to CP-01E）**

- Implementation `101ee98`（CI：control-plane lane `36035664842` + media-agent **7/7 required** `36035664857`·零 Rust 改动）——生产路径开发态鉴权桩删除，`/api/v1/*` 进入默认 authenticated/authorized/audited/rate-limited 模型（EXTERNAL_API_CONTRACT §6·planning C11）。
  - **AuthN（Better Auth 1.7.6 + 官方 @better-auth/api-key 1.7.6）**：生产凭证面 = `x-api-key` 唯一；`x-dev-principal` 桩删除（gate 机检红线：src 注释剥离后零引用）。key 官方 SHA-256 base64url 摘要持久化（43 字符无 padding 机检；明文只在 provisioning 瞬时输出一次）；revoke（enabled=false）与 expiry（expires_at）即时生效（DB 注入实证：401 + commands 零 claim；过期行由官方验证路径删除）。identity 表族 `auth_user/auth_session/auth_account/auth_verification` + `api_keys`（V0.2 §5 命名族对齐——本行即登记；drizzle-kit 迁移 0001/0002）；user `role` additional field。auth 层 fail-closed：缺 DB/secret → `/api/v1/*` 全部 503 DEPENDENCY_UNAVAILABLE（绝不匿名放行）；`/healthz` 增 auth 层。Better Auth 仅库形态（`auth.api.*`；不挂 HTTP handler——Fastify 保持 enforcement owner，不新增第二 crypto）。运维 provisioning 工具 `npm run provision`（官方 createApiKey 路径 + user 直插纯 identity 行 + apikey.create/revoke 审计）实跑 PASS。
  - **AuthZ（CASL @casl/ability 7.0.1）**：权限由 Product API action/resource 语义驱动（`ROUTE_PERMISSIONS` 五映射：runtime read / command read / session start/stop/release）；最小角色集 viewer/operator。默认 fail-closed：CASL 零规则即拒绝、未知角色→空 ability、未知 action/resource 无规则可放行；`/api/v1` 路由缺 security config → 运行时 500（fail-closed 配置缺陷机检 + rogue route 实测）。Fastify enforcement 链 = authn→authz→ratelimit→handler（preHandler 序）——C4"4xx 拒绝不占幂等"由结构保证。
  - **Rate limit（应用层·bounded）**：单实例内存滑动窗，principal × read/write bucket 区分（绝不全局单计数器；`RATE_LIMIT_*` env 默认 240/60 每分钟；内存有界 + 时钟可注入）；拒绝 = 429 RATE_LIMITED retryable + Retry-After 头。planning 未要求 distributed/PG-backed——维持 bounded packet；Nginx 粗限流互补关系零改动（Nginx 未动）。
  - **Audit 硬化**：`audit_entries` v2（迁移 0002）——who(principal/role)/what(action)/when(at)/command_id/verdict(state+classification)/decision(allowed|denied+reason) 全覆盖；命令审计与命令终态**同事务**不变量保持（CP-01B 原语义），新增机检：审计写入失败 → 终态迁移同事务回滚 → pending 保留 → 修复后租约回收 timeout（不存在"已终态无审计"路径）。拒绝路径审计：auth.reject（detail 含 keyStart = 官方 start 标识·非 secret）/ authz.deny / ratelimit.exceeded；verify 失败主体不可知诚实记 anonymous。detail 永不含 credential/secret（机检）。
  - **安全语义 failure-first 机检（用户 §2 清单逐项）**：unauthenticated/malformed/expired/revoked → 401 + **零 agent dispatch** + **零幂等 claim**（DB 行不存在断言，非仅 HTTP status）；authenticated but unauthorized → 403 + 零 dispatch + 零 claim；rate-limit exceeded → 429 + 零 dispatch + 零 claim（"限流拒绝不占 durable claim"红线）；auth backend/db 不可用 → 503 retryable + 零 dispatch；credential 不落日志（fastify redact 管道，`buildLoggerOptions` 唯一来源机检）且响应不回显提交的 key；`requested_by` 恒取认证主体 id（不再接受客户端自报）；principal A/B（真实身份对）同 Idempotency-Key → 409 conflict（fingerprint 含 principal 语义在真实 AuthN 下重验）。
- 验证（Dev VM；ephemeral `postgres:17-alpine`）：typecheck + build PASS；hermetic **49/49**（+24 DB-tier 显式 skip 计数）；DB 层 **22/22**（F1–F8 durable 语义真实身份回归不倒退 + Better Auth 生命周期 + 审计完整性 + 审计失败回滚 + provision 路径；`test:db` 串行 `--test-concurrency=1`）；provision create→revoke 全链实跑（审计行 + enabled=f + 摘要落库实证）；4 份 compose 组合 `config` 校验 VALID；fastify 生产镜像构建 PASS + 容器 smoke（`/healthz` auth 层 up、匿名 401 envelope、已撤销 key 401）；`check_control_plane_gate.py` 扩展（CP01C security：dev-principal 红线 + BASE compose `BETTER_AUTH_SECRET` 必配断言）PASS。
- 边界遵守：零 Rust 改动；事件面（CP-01D）/Web Console/BullMQ 未触碰；required contexts 未变更（control-plane lane 维持非 required）；Nginx 零改动（业务 authz 全在应用层·C11）；`/internal` 与 50051 exposure 红线不变（F11 gate 续 PASS）；Runtime truth 仍只来自 agent（Product Resource API live 读不变；DB 快照类数据零新增）。
- 下一：**CP-01D — Event plane**（drain→outbox→SSE·单实例约束）；CP-01E 全栈/BMD 集成验收承接 CP-01A/01B/01C 的 BMD DEFERRED。

### 3.76 CP-01D 收口（2026-09-24）— Event plane：internal drain → event_outbox → SSE + cursor

Status: **COMPLETE / SOFTWARE + CI + VM PG 注入 + 真实 HTTP SSE VERIFIED（BMD 硬件验收 DEFERRED to CP-01E）**

- Implementation `8160a53`（CI：control-plane lane + media-agent 7/7 required·零 Rust 改动）——Event API 落地（planning §7 CP-01D 行 + C7 + B9；EVENT_CONTRACT §1/§2 Projection 归属 Control Plane）。
  - **单消费者 drain（B9 fail-closed）**：`ProjectionDrainLoop` 以 PostgreSQL advisory lock（专用连接持有）保证全部署恰一个 `events.projection` 消费者；抢锁失败 → `locked_by_other_instance` 诚实降级（绝不并发 drain 互偷事件）；`EVENTS_POLL_MS=0` 显式禁用事件面（outbox/SSE 只读路径不受影响）。
  - **event_outbox（迁移 0003）**：每次 drain 的聚合投影快照原样落库（`total>0` 才写——空投影零污染）；RuntimeEvent 原文不出 agent（internal wire 只给聚合快照）——RuntimeEvent ≠ External Event 边界由 wire 形态结构性保持；outbox 是投递事实，绝不成为 Runtime truth。retention 清理（`EVENTS_RETENTION_MS` 默认 24h）。
  - **SSE + cursor**：`GET /events/v1/stream`（Nginx frozen `/events/` 路由对齐·Deployment SoT §11）；cursor 三态——缺省 = live tail（当前 max 之后）、`?cursor=`/`Last-Event-ID` = 重放该 sequence 之后（已见行绝不重发·严格大于语义）；投递 at-least-once，consumer 以 `id:`（outbox sequence）去重（F9 幂等键）；载荷显式 `weak_ordering: true`（F10：投影聚合以事件内容为准、无全局序，如实标注）；心跳保活；`retry: 3000` 重连提示。
  - **security 链扩展**：CP-01C fail-closed 钩子覆盖 `/events/*` 产品面前缀（`eventsRead` 权限 = read×events·viewer/operator；缺 security config 的 /events rogue route 实测 500）；401/403/429 在 SSE 劫持响应前生效。
  - **health 分层**：`/healthz` events 层如实区分 running / locked_by_other_instance / not_configured（多实例降级不冒充正常）。
  - **诚实边界（如实冻结，不冒充 exactly-once）**：agent drain 无 ack、drain 与 outbox 插入非跨进程原子——Fastify 崩溃窗口内的投影样本会丢失；agent 侧 durable 事件面属独立未来包；webhook 签名投递维持 planning 显式 deferred。
- 验证（Dev VM；ephemeral `postgres:17-alpine`）：typecheck + build PASS；hermetic 49/49；DB 层 29/29 新增事件面套件（drain 语义：total>0 写/total=0 零行/agent 故障下 tick 重试不崩溃；**B9 双实例抢锁 fail-closed**；cursor 严格大于 + latestOutboxSequence 相对断言；retention 超龄清理；**真实 HTTP SSE**——listen 真端口 + fetch 流读：帧形态 id/event/data、`retry`、weak_ordering、Last-Event-ID 已见行不重发、401/503 fail-closed）。
- 边界遵守：零 Rust 改动；Web Console/BullMQ/多实例事件分发/webhook 投递未触碰；required contexts 未变更；Nginx 零改动；Runtime truth 仍只来自 agent；Product 命令/读面零行为变化（CP-01A/01B/01C 回归 PASS）。
- 下一：**CP-01E — 全栈/BMD 集成验收**（compose prod overlay 全链 + failure drill 矩阵重放 + standalone 零回归 + BMD 真机一轮；承接 CP-01A/01B/01C/01D 的 BMD DEFERRED）。

### 3.77 CP-01E 收口（2026-09-25）— 全栈/BMD 集成验收；CONTROL-PLANE-ENTRY-01 全链 COMPLETE

Status: **COMPLETE / VM 全链 SOFTWARE + BMD 真机（DeckLink 采集旅程 × Product API）+ CI VERIFIED**

- Implementation `70ff46a`（CI：control-plane lane + media-agent **7/7 required** 双 lane SUCCESS·零 Rust 行为改动）——交付 = 真实 media-agent 容器镜像 + 双验收 overlay + VM/BMD 全链验收。
  - **ops/Dockerfile.media-agent**：占位模板 → 真实多阶段构建（rust:1.98.1-slim build + debian:trixie-slim runtime——GLIBC 对齐 RCA：bookworm 2.36 < 二进制要求 2.39；network-only ffmpeg-backend 面；静态 ffmpeg/ffprobe pin `mwader/static-ffmpeg:7.1`；**设备面边界明确**：bmd-provider（SDK+libclang）与 gstreamer-backend（系统 GStreamer）留在 BMD systemd lane，容器不假装设备能力）。
  - **ops/compose.software-acceptance.yml**（VM）与 **ops/compose.bmd-acceptance.yml**（BMD）：验收 overlay——agent 容器 NETWORK_BINDING 清单（0600+属主+机器 pin fail-closed 语义保留，`user: 1000` 匹配属主）、无设备直通（`!override devices`）、web 静态占位（console packet 未启动，仅满足 B8 冻结路由 upstream）、nginx/db 验收 host 端口、BMD fastify 经 bridge gateway 地址指向原生宿主 agent（D3-R 显式私有 bind 运维动作，事后 ufw 规则即撤）。
  - **ops/docker-compose.yml 修复**：build context `.` → `..`（compose 项目目录=ops/，原路径从不可构建——既有缺陷修复）；gate 扫描列表纳入两个新 overlay（F11 红线全数续 PASS）。
  - **诚实披露**：`rustfs/rustfs:2026.8.1` 与 `ossrs/srs:6.0.42` pinned tags 在 docker.io 已不存在（DEPLOY-BASELINE drift 发现，登记为后续 storage/SRS packet 前置问题）；本验收以显式服务清单 + `--no-deps` 序列覆盖控制面链（db/fastify/agent/nginx/web），不拉取失效镜像。
- **VM 全链验收**（compose 软件验收栈；本机 ephemeral PG + node:24 宿主 provisioning）：
  - 命令旅程（全链 nginx→fastify→internal→agent）：`start_session`（rtmp listen 源 + hls sink，真实容器 agent 实际 spawn ffmpeg `-rtmp_listen`）→ `completed`；live 读显示 session `running`（两平面：Operation 记录 ≠ Runtime 现状分开呈现）；`stop_session` → `completed` → Released；teardown 零 ffmpeg 孤儿。
  - 两平面诚实性：未知设备 intent → 真实 agent 裁决 `failed(retryable)`"设备未注册"（HTTP 200 ≠ Runtime success 实证）；agent `-32602 invalid_intent` → CP-01B 冻结保守语义 timeout(retryable)（不猜成功）。
  - 安全矩阵：401（无凭证）/403（viewer start）/429（write bucket 限流，55 过+6 限，Retry-After）/400（F13 客户端方向）；replay 同键同响应、异 target 409；F1 agent 停机 → 503 + PG `timeout|retryable` 终态 + 审计同事务；SSE 事件面 `?cursor=0` 重放出 journey 聚合投影帧（id/event/data、weak_ordering）；standalone 零回归探针（无 CP 依赖：internal RPC + 8080 health 独立应答）。
- **BMD 真机验收**（exact commit `70ff46a`，archive sha256 `c27f2c4495c2ad7e2a53a2f42a4c7f80a3730110eeecc10a0f15006ec5209c5a`；原生 bmd,gstreamer release build；`DECKLINK_SDK_INCLUDE` + `VBMF_MACHINE_ID=10.30.15.10` + `MEDIA_AGENT_DEVICE_BINDING=a2-8-02i-v5.manifest.json`；`MEDIA_AGENT_RPC_BIND=172.18.0.1:50051` bridge 网关）：
  - **命令旅程 × Product API（真机 DeckLink）**：live 读 = 3 台 DeckLink（2 输入 + Mini Monitor 4K）+ 2 input ports available；`start_session`（decklink 源，设备 `4fa33dcb-…`）→ `completed` → live 读 session `running`（handle 1、resource `allocated`）→ `stop_session` → `completed` → session `released` + resources `available`。
  - 安全矩阵：401/403/400；同键异 target → 409 RESOURCE_CONFLICT；同键同 target 重放 200；F1 native agent SIGTERM → 503 → PG `timeout|retryable` → 重启 → live 读 200（F7 恢复）。
  - SSE 事件面：真实 journey 聚合投影帧（lease_granted/session_created/identity_resolved/source_materialized/session_state_changed×4）。
  - **边界**：历史 device-number 2 输出进程 PID `992634` before/after 完全不变；`/opt/vbmf-dev/repo` 未触碰；验收后 agent 优雅停止、compose down -v、ufw 规则即撤、/tmp 清理（盒上零残留）。
  - BMD 侧 provisioning 经 `npm run provision`（VM node 24 → BMD db 15433 端口）复用同一官方路径。
- 边界遵守：零 Rust 行为改动（agent 源码零修改——镜像/overlay/compose 修复均为部署面）；Web Console 未实现（静态占位如实验记）；BullMQ/Worker/multi-instance event dispatch/webhook 签名投递维持 planning 显式 deferred；required contexts 未变更。
- **CONTROL-PLANE-ENTRY-01 全链收口**：CP-01A(§3.73) + CP-01B(§3.74·RH-IDEM-01 清偿) + CP-01C(§3.75) + CP-01D(§3.76) + CP-01E(本节) 全部 COMPLETE；frozen Architecture/Contract 零修改；Runtime owns truth 红线全程保持。
- 下一：无 READY packet——Task Queue 后续（Web Console、`vbmf-sdk`、BullMQ/Worker、跨主机 mTLS、agent UUID wire 增补、agent 侧 durable 事件面、storage/SRS image pin 修复）均需新 bounded packet 与用户裁决后入场。

## 3.78 PORT-COLLISION-01 closure（2026-09-25）—— 物理 jack 槽位忠实枚举 + PortId invariant guard

Status: **COMPLETE / VM 软件 + BMD 真机 + CI 7/7+control-plane VERIFIED**

### RCA（无 HARD BLOCKER，frozen Contract 充分）

BMD 真机证据（10.30.15.10, 2026-09-24 `VBMF_CONFIG_PROBE` on `06bc01a`/旧 binary）：
- "DeckLink SDI" ×2 sub-device 各 `cap_video_in=1` **且** `cap_video_out=1`、`cfg_video_in=1` **同时** `cfg_video_out=1`，无 profile/ConnectorMode 切换 → **固定全双工卡**（SDI-IN 与 SDI-OUT 是两个独立 BNC jack，非同一 jack 的双向视图）。
- 旧 `discover_ports` 按"每 connector 类型 × 每方向"伪造端口且序号恒 `Known(1)` → 同卡 `Input/Sdi/Known(1)` 与 `Output/Sdi/Known(1)` 共享 port_id（`se01b-device-smoke.log` L9/L10 实证 ×2）。
- frozen Contract（`CANONICAL_IDENTITY.md §5.1` Provider Port Ref 分层 + `§7` PortId 派生）**充分**表达正确身份：物理 jack = 设备内同 connector 类型的**物理槽位**（与运行时方向声明无关）；方向属性可漂移，不得入键。**HARD BLOCKER 未触发**——无需改 frozen Authority。

### Identity 决策

- PortId 键不变：`uuid5(PORT_NAMESPACE, "<device_id>:<connector>:<ordinal>")`；`ordinal` = "SDK 掩码按方向位序分配的物理槽位"；`direction` 与 `RuntimeBinding` 均为属性不入键。
- **槽位空间正交**：in-jack 占用 1..N（按 `video_input_connections` 位序），out-jack 占用 N+1..N+M（按 `video_output_connections` 位序）。两方向槽位空间不相交 → 同 connector 永远不会碰撞；完全派生自 SDK 掩码，跨进程/跨重启稳定。
- `Analog` 位折叠（Component 0x8 + Composite 0x10）按位序分槽为 `Analog/1 + Analog/2`，各占独立物理 jack（实证固定）。
- jack 级 capability 证据：in-jack 仅在 in-mask 含此 connector 时 `input=Supported`；out-jack 仅在 out-mask 含此 connector 时 `output=Supported`；设备级另一方向掩码**绝不**摊平到当前 jack（消除 Resource 别名根因）。
- Input jack 的 `output = Unsupported`，Output jack 的 `input = Unsupported`（方向语义决定该能力确定不支持，区别于 `Unknown`/未探测）。
- `warn_duplicate_discovery_port_ids` 升级为 **invariant guard**：test/debug panic、release log+continue——此前为已知缺口告警，现为真正 invariant violation 检测。
- manifest `PortBinding.ordinal` 表达 jack 槽位语义（in 1..N, out N+1..N+M）；现有 fixture `bmd-sdi-loopback.manifest.json`（Mini Monitor in_mask=0 → out jack slot=1）与现有 hw-ident manifest 无需变更；新形态下"双工卡"需额外声明 SDI-OUT-2（不在本包修复范围，Resolver 设备身份 dedup 仍以单 handle 为单位，本包修 PortId 槽位）。

### Software verification（VM）

- 9 个 failure-first `pc01_*` 测试（`port.rs`）+ 既有 35 个 port 测试 → **44/44 PASS**（547 lib + 21 integration 全绿，mock feature）。
- `cargo clippy --features mock --tests -- -D warnings` PASS；`cargo fmt --check` PASS；`connector_from_mask` 重构不破坏既有测试。
- `discovery 层 PortId 不变量` 五种 fixture（fixed-duplex、output-only、Analog、in-multi、full-mask）全不重复。
- jack capability 验证：in-jack `input=Supported(true) & output=Unsupported`、out-jack `output=Supported(true) & input=Unsupported`，设备级聚合按物理 jack 计数。

### CI（exact commit `a0d6fa9`）

- media-agent required 7/7 SUCCESS：hardware-test-compile（含 bindgen/FFI compile）、gstreamer-build（bmd+gstreamer feature 真编译）、rust-clippy（default + mock+ffmpeg-backend）、rust-format、rust-test-matrix、architecture-portability、session-lifecycle。
- control-plane CI SUCCESS（GitHub-hosted fastify lane）。
- Required contexts 无变化；frozen Authority/Contract 零修改。

### BMD 真机验收（exact commit `a0d6fa9`, binary sha256=`2c5c5ff16795e9c819467fdadece3977`, from artifact `media-agent-linux-hwtest-bin`）

- 复制到 BMD `/tmp/port-rca-bin/media-agent-gates`；manifest 临时 pin `/etc/machine-id`（与 SE-01B 同等语义）。
- **device-smoke RUN #1/RUN #2/RUN #3**：3 次重复 discovery → `device discovery complete count=3`、`lease acquired` 三个 device_id 跨重启完全一致（`4fa33dcb-…/6ede00d0-…/1afe2dcc-…`）→ **`authorized_devices=2, authorized_ports=2`** → **零 PortId 碰撞 warning**（旧 `se01b-device-smoke.log` L9/L10 两条 WARN 已消失）→ SIGTERM 优雅停机 exit 0。
- `VBMF_SESSION_LIFECYCLE=1 VBMF_SELFTEST=1` 设备模式成功起 ready（设备面 ready=2 ports=2）；无 SDI 信号源，故未触发真实采集会话（与 SE-01B 一致——v2 binary 接受 VBMF_REGISTRY_ONLY=1 链路零回归）。
- **device-2 边界**：全程 PID 992634 `gst-launch-1.0` 前后无变化；`/opt/vbmf-dev` 未触碰；ufw 规则未改（无新增）；`/tmp/port-rca-*` 验收后清理。

### Migration / 兼容性

- 现有持久 consumer：**无**。PortId 仅作资源命名空间 + ResourceId 派生 + preflight 寻址的输入；当前仓库**无** PortId 持久化（未入 PG、未入 Session 记录、未入 Event payload、未入 External API）。
- 现有 fixture `bmd-sdi-loopback.manifest.json`（Mini Monitor 4K out jack，in_mask=0 → slot=1）与 `a2-8-02i-v5.manifest.json`（双卡 SDI/1/input ×2，in_mask 各 1 位 → slot=1 各占独立 jack）无需变更——双工卡新增 out jack 表达超出本包修复范围（Resolver 设备身份 dedup 单 handle 形态需后续单独 bounded packet 决议）。
- SDK 掩码位序表 `CONNECTOR_MASK_TABLE` 与 BMD SDK 16.0 头文件 `BMDVideoConnection` 一致（低→高位），跨硬件/跨 SDK 升级稳定（待多设备复验，已登记后续 packet）。
- 全部 9 个 deferred BACKLOG 项仍维持原状（Web Console、SDK、storage/SRS image pin、跨主机 mTLS、agent UUID wire、agent-side durable event plane 等）。

### Remaining debt / Future packet 前置

- **双工卡 out jack 声明形态**：当前 Resolver `validate_manifest` 拒绝同 `bmd_device_handle` 多 entry（设备身份冲突 fail-closed）→ 双工卡新增 out jack 需要 Resolver 端口级 binding 演进（与 PORT-COLLISION-01 是不同维度，独立 packet）。
- **多设备多 jack 端到端回归**：仅在 10.30.15.10 盒上验证；多台不同型号 DeckLink 复验（特别是 AJA/混合拓扑）作为后续 HW-IDENT 类 packet 验收项。
- `rustfs/rustfs:2026.8.1` 与 `ossrs/srs:6.0.42` docker.io pinned tags 失效（§3.77 登记）继续生效，与本包无关。

### 推进

- 本包完成后无即时可推 READY packet——§4/§5 维持原"无 READY"状态。
- 下一项进入需按用户指令"PRODUCT-SURFACE-ENTRY-01"（SDK vs Web Console 实施顺序裁决）首肯；现 §5.1 Task Queue 中 PORT-COLLISION-01 行已从 BACKLOG 关闭。

## 3.79 PRODUCT-SURFACE-ENTRY-01 closure（2026-09-25）—— VBMF-SDK vs WEB-CONSOLE 实施顺序裁决

Status: **PLANNING COMPLETE / first bounded implementation packet marked READY**

### 决策（frozen, 不可越级）

**WEB-CONSOLE-ENTRY-01 先行**。SDK 仍属 deferred，待 Web Console 形成稳定 wire 语义后再启 `SDK-ENTRY-01`。

### 裁决依据（live API + frozen Contract + dependency evidence）

| 维度 | 证据 | 结论 |
|---|---|---|
| Web Console 真实存在 | `prototype-p1b-web-console` 已 live `services/media-agent/src/transport.rs`（INDEX_HTML + `/hls/*`），agent 原生服务；设计见 `docs/superpowers/specs/2026-09-02-prototype-p1b-web-console-design.md` | 既存 prototype 拓扑错位：① 绕过 Fastify authn/authz/rate-limit/audit；② 不符 PRD §60-67 UI Provider-neutral + C13 边界（UI 不得直连 agent）。**必须迁移到 Fastify 后** |
| Fastify 路由稳定度 | `apps/api/src/routes/` = `commands / events / health / runtime` 四文件，CP-01A→01E 全链 + BMD 真机 + CI 8/8 验证；JSON Schema 类型可通过 `fastify-type-provider-zod`/route schema 直接导出 | SDK 可后置生成：Fastify 路由定义已稳定，无需 SDK 先行 |
| PRD §61 SDK | "第一阶段**不强制**维护所有语言 SDK" | SDK 非硬前置 |
| PRD §174 SDK Generation | "第一阶段优先：TypeScript / Python 自动生成" | SDK 必然为 TS 首语言；可由 Web Console 真实消费证据驱动 schema |
| Web Console 真实 TS consumer 价值 | PRD §60-67 明确 UI 必须四状态分离 + Provider-neutral；既无现状实现 = 大量 unverified UX 假设 | Web Console 作为首个真实 TS consumer 可反向验证 Product API 消费者可用性 |
| SDK 反向价值 | 第三方集成由 PRD §61 推迟到后续阶段；当前无外部 consumer 触发 SDK 紧急需求 | SDK 可作为 Web Console 验证通过后的下一包 |
| Web Console 是否依赖 SDK | 否——直接 `fetch` + 类型定义（来自 Fastify JSON Schema）即可 | 解耦可独立实施 |

### 关键约束（WEB-CONSOLE-ENTRY-01 必须遵守）

1. **零直连 agent**（C13 边界显式）；仅消费 `/api/v1/*` + `/events/v1/stream`。
2. **零乐观假成功**——HTTP 4xx/5xx 必须如实显示；HTTP 200 ≠ Runtime success 必须保留（C2 判据：HTTP success ≠ Runtime success）。
3. **类型单一源**：TS 类型从 Fastify route JSON Schema 派生；不得发明 parallel schema（CP-01A 起已固化）。
4. **reconnect 按 Event Contract 弱序**：`weak_ordering=true` 必须重放；Cursor tri-state（undefined=tail / number=replay strictly after）严格遵守。
5. **四状态分离**：Desired ≠ Requested ≠ Executing ≠ Observed（PRD §1784）—— UI 显式 4-state machine 而非简化两态。
6. **frozen Authority/Contract 零修改**（EXTERNAL_API_CONTRACT / EVENT_CONTRACT / IMPLEMENTATION_BOUNDARIES / CANONICAL_IDENTITY）。

### SDK-ENTRY-01 后续计划

- Web Console 形成稳定 wire 语义（≥3 个命令旅程 PASS + SSE reconnect/replay 实证）后，启 SDK-ENTRY-01 作为 `vbmf-sdk` (TS) 包。
- SDK 必须复用 Web Console 已验证的 JSON Schema 派生类型，禁止重新发明类型源。
- SDK 第一语言 TS（PRD §174）；Python/Go 推后。

### 其他 deferred 项（不变）

`vbmf-sdk`（在 SDK-ENTRY-01 后）、BullMQ/Worker 异步面、跨主机 mTLS、agent UUID wire 增补、agent 侧 durable 事件面、Resource PUT/ChangeSet 流、webhook 签名投递、多实例事件分发、`rustfs/srs` docker.io pinned tags 修复。

## 3.80 WEB-CONSOLE-ENTRY-01 closure（2026-09-28）—— 首个真实 TS consumer 落地

Status: **COMPLETE / SOFTWARE VERIFIED / media-agent CI 7/7 VERIFIED / BMD RUNTIME = DEFERRED**（control-plane lane 绿色曾在本节被过度声明——exact-head `c02b118` control-plane CI 实为 FAILURE，已于 2026-09-29 经 WCE-01-CLOSURE-RECONCILIATION 修正，见本节末 Reconciliation 注记；VM 软件验证已完成；BMD 真机命令旅程将在后续验收窗口执行）

### 实现链路（5 commits on `main`，HEAD = `e65f001`）

1. `a3c5351` — WCE-01A Product API schema authority reconciliation
2. `bd967ca` — WCE-01B/01C/01D/01E web-console foundation + 4-state + journeys + SSE
3. `29a849d` — WCE-01F failure-first integration (real Fastify fixture)
4. `e65f001` — WCE-01 docker/ci/red-lines integration

### WCE-01A — Product API Schema Authority（`a3c5351`）

- `apps/api/src/routes/schemas.ts`：单一源 JSON Schema 表（ErrorCode 12 词表 / RuntimeSnapshot / ProductSession / CommandOperationBody / StartSessionBody / HealthLayers / SSE 帧 payload）。ROUTE_SCHEMAS manifest 按 METHOD+PATH 暴露请求 schema 与响应 shape 字典。
- 路由 schema 入口：`runtime.ts` / `health.ts` / `commands.ts` / `events.ts` 全部 attach `schema:`；server.ts error handler 把 `FST_ERR_VALIDATION*` 映射到 400 VALIDATION_ERROR（与 ApiError envelope 统一）。
- `apps/api/test/routes.schema.contract.test.ts`：Ajv-based contract test 校验真实 `app.inject` 响应 vs 声明 schema，覆盖 200/400/404/503 各状态路径 + 12-code ErrorCode 词汇漂移 guard。
- package.json：ajv ^8.20.0 dev dep。
- 既有 49 focused tests 全绿 + 7 新增 schema contract = **56/56 PASS**。frozen EXTERNAL_API_CONTRACT / EVENT_CONTRACT / IMPLEMENTATION_BOUNDARIES / CANONICAL_IDENTITY 零修改。

### WCE-01B — Web Console Foundation（`bd967ca`）

- 独立 TS app @ `apps/web-console/`（Vite 6 + React 19 + TS strict + native fetch，无 SDK）。
- `src/api/schemas.ts` re-exports from `apps/api/src/routes/schemas.ts` + 手工 mirror TS 类型（single-source 验证由 `test/schemas.authority.test.ts` 兜底）。
- `src/auth/credentials.ts`：in-memory closure-scoped api key；reload = 清空；`assertNoPersistentStorage()` 静态自检 localStorage/sessionStorage/credentials-module-state。
- `src/api/client.ts`：same-origin-only fetch wrapper（运行时拦截 `media-agent` / `:50051` / `/internal/` / 跨 host 字面量）；强类型 helpers `getRuntime` / `postStartSession` / `postStopSession` / `postReleaseSession` / `getCommand` / `getHealthz` / `getHealthLive`；ErrorEnvelope surface mapping。
- `src/api/sse.ts`：`fetch + ReadableStream + 自写 SSE frame parser`（`event:`/`id:`/`data:`/`retry:`/`:` heartbeat）；cursor tri-state（undefined=tail; number=strictly-after）；sequence dedupe（Set）；`weak_ordering=true` 透传；StreamHandle `{ close, lastSequence, retryHintMs }`。
- `src/state/fourStateMachine.ts`：pure reducer for Desired/Requested/Executing/Observed；divergence 检测。
- `pages/CredentialGate`：memory-only 凭证 bootstrap，UI 显式回到 credential-required on reload。
- `pages/HealthPage`：分层 health `/healthz`（api/runtime/db/auth/events）+ `/health/live`。
- `pages/RuntimePage`：live snapshot + freshness envelope（`generated_at_ms`/`observation_revision`/`observation_lineage`）+ sessions table + 选中详情。
- `pages/SessionsPage`：Start/Stop/Release 按钮 + idempotency-key + 4-state panel + command polling（GET `/api/v1/commands/:id` until terminal）。
- `pages/EventsPage`：SSE + reconnect backoff `[500/1000/2000/5000/10000]ms` + last sequence + weak_ordering 显示 + reload-first snapshot。
- **40/40 unit tests PASS**（schemas authority + SSE parser + 4-state reducer + error envelope + credentials bootstrap）；typecheck PASS；vite build PASS（210KB JS / 65KB gzipped）。

### WCE-01C/01D/01E — UI 集成（合并 `bd967ca`）

- 4-state reducer 覆盖 Desired → Requested → Executing → Observed 全链；divergence 由 snapshot.observed ≠ desired 触发 UI 提示。
- 命令旅程：Start/Stop/Release 全部接入 POST 端点；命令面板真实显示 `state ∈ {pending, completed, failed, timeout, conflict, rejected}` + classification + detail。
- SSE：reload 先 re-fetch canonical snapshot，再 connect SSE；reconnect 从 `lastSequence` strictly-after 重放；dedupe by `id:`。

### WCE-01F — Failure-first integration（`29a849d`）

- 真实 Fastify fixture（`buildAppHandle + FixtureAuthenticator + StubPlane`），Web Console client helpers 通过 `setTestFetchImpl` 桥接 `app.inject`。
- **12 integration tests PASS**（happy path Start→Stop→Release 3 完整命令旅程 + 401 invalid/expired + 403 role-denied + 429 rate-limit zero-dispatch + 503 agent-down + command plane 503 RESOURCE_UNAVAILABLE + 4-state DIVERGENT + getCommand 200 形状）。
- 总计 **52/52 web-console tests PASS**；typecheck clean；vite build clean。

### Compose/Docker + CI（`e65f001`）

- `ops/Dockerfile.web`：多阶段 `node:24-alpine build → nginx:1.27-alpine runtime`；Vite 产物 dist/ 由容器 nginx 5173 服务；healthcheck wget。
- `ops/nginx/web.conf`：容器内静态资源服务（SPA fallback + immutable cache + 安全 headers），与 compose nginx (`ops/nginx/default.conf`) 区分职责。
- `ops/docker-compose.yml`：web build context 修复（`.` → `..` 与 fastify 一致）；删除 `VITE_API_BASE/VITE_WS_BASE/VITE_EVENTS_BASE`（前端走相对路径，Nginx same-origin 反代）；healthcheck 改 wget。
- `ops/compose.dev.yml`：旧 `./web/src` 废弃（仓库无此路径）；改用独立 `web-dev` 服务（node:24-alpine + bind mount + Vite HMR，`profiles: ["dev"]`）。
- `scripts/check_web_console_red_lines.py`：13 类 production-source 静态红线 gate（`media-agent:50051` / `:50051` / `/internal/v1/agent` / `localStorage.setItem` / `sessionStorage.setItem` / `document.cookie` / `VITE_API_BASE` 等）。允许 `client.ts` 自身 FORBIDDEN_PATTERNS 运行时拦截器与 `test/` 下 `expect.toThrow(/red line/)` 自防回归。
- `.github/workflows/control-plane.yml`：扩展 lane（仍**非 required context**），timeout 15m→25m；新增 WCE-01 红线 gate → apps/api typecheck/test/build → apps/web-console typecheck/test/build。
- 媒体端 **7/7 required context 不动**。

### 关键红线验收

| 红线 | 状态 |
|---|---|
| 浏览器零直连 media-agent | PASS（client.ts 运行时拦截 + 红线 gate 静态拦截） |
| 浏览器零访问 `/internal/*` | PASS（同上） |
| 浏览器零访问 `:50051` | PASS（同上） |
| UI 不发明 Runtime 状态 | PASS（4-state machine Desired 来自 operator，Observed 来自 runtime snapshot） |
| HTTP 200 ≠ Runtime success | PASS（command.state/classification/detail 真实显示；status=200 + state=failed 显示 failed，不显示 success） |
| Desired/Requested/Executing/Observed 四态分离 | PASS（pure reducer + describe + divergence） |
| 4xx/5xx 真实显示 | PASS（ErrorEnvelope 透传 + integration tests 覆盖 401/403/429/503） |
| SSE cursor 三态 + replay strictly-after + dedupe | PASS（api.sse.test.ts 6/6 + EventsPage backoff） |
| `weak_ordering=true` 如实处理 | PASS（payload 透传到 UI + UI 显式标注"projection is content-based; no global order"） |
| reload 重新收敛 canonical Runtime truth | PASS（EventsPage 先 fetch `/api/v1/runtime`，SSE 仅是增量） |
| frozen Authority/Contract 零修改 | PASS（无 EXTERNAL_API_CONTRACT/EVENT_CONTRACT/IMPLEMENTATION_BOUNDARIES/CANONICAL_IDENTITY 修改） |
| `transport.rs::INDEX_HTML` 保留 D10/offline diagnostic | PASS（agent 源码未触碰） |

### 命令旅程覆盖

| 旅程 | 状态 |
|---|---|
| Start → completed (StubPlane + happy path) | PASS |
| Stop → completed | PASS |
| Release → completed | PASS |
| command plane 503 RESOURCE_UNAVAILABLE (DB-less) | PASS |
| agent-down 503 DEPENDENCY_UNAVAILABLE | PASS |
| 401 / 403 / 429 拒绝路径零 dispatch | PASS |
| expired credential → 401 with no specific reason leaked | PASS |

### Authority/Contract 状态

frozen Authority / Contract **零修改**：
- `EXTERNAL_API_CONTRACT`（§5 error envelope + §6 默认安全模型 + §7 health/liveness/readiness）保持冻结形态；Web Console 仅消费既有 endpoint + envelope。
- `EVENT_CONTRACT`（§1/§2 Projection 归属 Control Plane + §WeakOrdering + Cursor tri-state）保持冻结形态；SSE client 实现符合 cursor 语义。
- `IMPLEMENTATION_BOUNDARIES` / `CANONICAL_IDENTITY` 未触碰；Web Console 仅消费 wire 形态，不发明 contract。

### BMD Runtime acceptance

**BMD RUNTIME ACCEPTED（2026-09-29 · WEB-CONSOLE-BMD-ACCEPTANCE-01 §3.82，exact commit `dc780c8`）**：production Web Console（真实 Vite build, Dockerfile.web）→ Fastify → native media-agent（bmd,gstreamer）→ DeckLink 真机命令旅程 Start/Stop/Release + failure/recovery + SSE reconnect/replay + reload 收敛全 PASS；device-2 保护边界全程不变。此前 DEFERRED 状态由本验收清偿（历史保留见 Git history）。**非 24h soak——不写 stability verified**。

后续验收明细、发现的 7 个真 bug（BUG-A..G）与证据路径见 §3.82。

### Verification Level

- **Software + CI**: COMPLETE（56 API + 52 web-console tests PASS；apps/api + apps/web-console typecheck/build PASS；control-plane lane 红线 gate + F11/F12 gate PASS）。
- **BMD Runtime**: DEFERRED（明确登记；不写为 hardware verified）。
- **24h Stability**: 仍为独立 debt（与 WCE-01 无关）；按 §3.18 STAB-O4 既有结论维持。

### Reconciliation 注记（2026-09-29）—— WCE-01-CLOSURE-RECONCILIATION

本节原 Status 中 "control-plane lane VERIFIED" 属**过早声明**，按 exact-head CI 证据修正（历史记录保留，不删除）：

- **Exact-head CI 事实（重新查询 GitHub Actions）**：`c02b118` control-plane CI run `36517519963` = **FAILURE**（"Fastify typecheck" step）；且 WCE-01 实现链全部 5 个 commit 的 control-plane lane 均为 FAILURE（`a3c5351` run `36515471928` / `bd967ca` run `36516167126` / `29a849d` run `36517005600` / `e65f001` run `36517266067` / `c02b118` run `36517519963`）。WCE-01 收口时 "CI 全绿" 的声明只对 media-agent lane 成立。
- **media-agent lane**：`c02b118` run `36517519937` = SUCCESS，7 required checks 全部保持 PASS，不受影响。
- **RCA**：`apps/api` 为 ESM（`"type": "module"`）+ `module/moduleResolution: NodeNext` + `verbatimModuleSyntax: true`；ajv 8.20.0 为 CJS-only 包（无 `exports` 字段）。NodeNext 下 TypeScript 将 ESM 对 CJS 的 default import 按 Node 语义类型化为 `module.exports`（即 d.ts 整个模块命名空间，无构造签名）→ `test/routes.schema.contract.test.ts:32` `new Ajv(...)` 报 **TS2351**。运行时之所以不炸：ajv 的 CJS 构建执行 `module.exports = Ajv`（default import 运行时恰为 class），因此 `node --test` 通过而 `tsc --noEmit` 失败——CI 的 "Fastify typecheck" step 先于 test 失败。
- **最小正确修复**：`import Ajv from "ajv"` → `import { Ajv } from "ajv"`（命名导入）。类型层：ajv d.ts 有真实 named `export declare class Ajv`（可构造）；运行时层：`module.exports.Ajv` 实测存在（ESM 视角 `typeof m.Ajv === "function"`）。不修改 tsconfig、不关闭 verbatimModuleSyntax、不开 esModuleInterop、不 skip 测试、不用 any 掩盖。
- **本地全回归（Development VM，clean dependency state）**：apps/api `npm ci` + typecheck + `npm test` 56/56（32 skipped 为 DB lane）+ build 全 PASS；apps/web-console `npm ci` + typecheck + 52/52 tests + vite build 全 PASS；`scripts/check_control_plane_gate.py` PASS；`scripts/check_web_console_red_lines.py` PASS；`git diff --check` clean。
- **Status 修正后口径**：WEB-CONSOLE-ENTRY-01 = **COMPLETE / SOFTWARE + CI VERIFIED**（media-agent 7/7 required + control-plane lane 于修复 commit exact-head 双绿后确认）**/ BMD RUNTIME ACCEPTANCE DEFERRED**（不因 CI PASS 升级为 hardware verified）。
- **收尾确认（同日）**：修复 commit `e1435fa` exact-head CI 双绿——media-agent run `36518795888` SUCCESS；control-plane run `36518795854` 首跑失败于 web-console `npm ci` npm registry `ETIMEDOUT`（self-hosted runner 出网故障窗，§3.10/§3.11 risk 8 既有模式；Ajv 修复相关 apps/api typecheck/test/build step 首跑即全 PASS），rerun 后 SUCCESS。WCE-01-CLOSURE-RECONCILIATION 按验收条件 **COMPLETE**。
- **BMD Runtime acceptance（2026-09-29 更新）**：由 `WEB-CONSOLE-BMD-ACCEPTANCE-01`（§3.82）在 exact commit `dc780c8` 真机清偿 → **BMD RUNTIME ACCEPTED**（见本节 "BMD Runtime acceptance" 小节）。

## 3.81 REPO-MIGRATION-01 收口（2026-09-29）—— canonical repository transfer

Status: **COMPLETE（2026-09-29：transfer + 后置 reconciliation + closure commit `8d78ddf` 迁移后 exact-head CI 双绿，全部验收条件满足）**

- **迁移前审计（GitHub API 实查）**：`pwl1987-dev` = Organization，操作账号（pwl1987）对其有 admin + active membership；目标 `pwl1987-dev/vbmf` 不存在（404）；对 `pwl1987/VBMF` 有 admin。仓库 public、默认分支 main、远端仅 main 一个 head；open PR=0、open issue=0、release=0、tag=17（phase-0.6…v0.2.0）；secrets=0、variables=0、deploy keys=0、webhooks=0、environments=0、rulesets=0、Pages 无关、GHCR packages 与本仓库无关（3 个 user packages 均非 VBMF）。classic branch protection（strict、7 required contexts、required_linear_history、禁 force push/delete、enforce_admins off）；runners 为 repo 级注册 ×3（vbmf-ci-01/02：`{self-hosted,Linux,X64,vbmf,vbmf-general}`；vbmf-ci-media：`{self-hosted,Linux,X64,vbmf,vbmf-media}`）。
- **Transfer 方法**：GitHub 正式 Repository Transfer API `POST /repos/pwl1987/VBMF/transfer`（`new_owner=pwl1987-dev` + `new_name=vbmf`，owner/slug 一次完成）；未创建新空仓、未 mirror push、未复制 history、未删除原仓库、未造第二 Authority。org admin + active membership 下即时完成，无 pending acceptance。
- **迁移后 reconciliation（GitHub 实查）**：live `main` SHA 不变（`e1435fa7e32da29c121ccfc22e04325486f9d35d`）；commit history 未改变；17 tags 保留；4 workflows 全 active（media-agent/control-plane/ci-infra-probe/ci-runner-action-cache）；classic branch protection 完整保留（7 required contexts 逐字一致：rust-format / rust-test-matrix / rust-clippy / hardware-test-compile / architecture-portability / gstreamer-build / session-lifecycle）；PR 历史保留（#31…#42）；**三台 repo 级 runner 全部 online 且已挂在新 canonical 下**（transfer 保留 repo identity，注册未失效，无需重注册；无 org runner group 变更）。旧路径 `github.com/pwl1987/VBMF` 重定向生效，仅作兼容机制。
- **Development VM remote 更新**：`git remote set-url origin git@github.com:pwl1987-dev/vbmf.git`；fetch 后 local HEAD = origin/main = GitHub live main 三方一致（`e1435fa`）。本地 checkout 路径 `/home/ubuntu/dev/VBMF` 保持不变（不重命名，避免破坏脚本/runner/path 假设）。
- **产品名裁决执行**：产品、Architecture、Contract、UI 名称全部维持 **VBMF**；仅 GitHub owner（pwl1987 → pwl1987-dev）与 repository slug（VBMF → vbmf）变更。
- **仓内硬编码引用分类更新**（禁止全仓 search-replace，逐项裁决）：
  - 更新（canonical metadata / 面向用户的入口 / 活跃脚本与运维文件）：`README.md`（clone URL + Repository URL）、`CONTRIBUTING.md`（issues/discussions 链接文本）、`SECURITY.md`（security advisories 链接文本）、`scripts/ci/provision-runner.sh`（REPO_SLUG）、`scripts/ci/verify-runner.sh`（REPO 默认值）、`scripts/ci/actions-runner-vbmf@.service`（Documentation URL）、`docs/architecture/CI_RUNNER_STRATEGY.md` §4 scope slug + §runbook clone URL（附 org transfer 事实注记：runner 保持 repo 级、无 Runner Group、scope 契约不变）、`.project/STATE.md` §1/§10 canonical 指向。
  - 保留为历史事实（frozen historical evidence，不机械替换）：`evidence/**` 全部、`docs/comet/archive/**` 与 `docs/comet/specs/**`（历史 change/spec 记录）、`docs/superpowers/reports/**`（历史收口报告）、`docs/VBMF 下一阶段总架构升级方案 + PRD.md`（历史 PRD，raw.githubusercontent master 链接）、STATE 各节历史 run/commit 记录。
- **迁移后 exact-head CI（收尾确认·2026-09-29）**：closure commit `8d78ddf` push 到新 canonical 后双 lane 全绿——media-agent CI run `36519490264` SUCCESS（7/7 required jobs：rust-format / rust-test-matrix / rust-clippy / hardware-test-compile / architecture-portability / gstreamer-build / session-lifecycle 全 PASS，required context 名称不变）；control-plane CI run `36519490258` SUCCESS（双 app npm ci/typecheck/test/build + 双红线 gate 在迁移后 runner 上全过）。**REPO-MIGRATION-01 按 DoD COMPLETE。**
- **迁移后下一任务裁决（2026-09-29）**：BMD 可达性只读探针（lytv@10.30.15.10 SSH PASS、`/dev/blackmagic/dv0/dv1` 在位、无残留 media-agent/ffmpeg 进程）→ **BMD 可访问 ⇒ 下一任务 = `WEB-CONSOLE-BMD-ACCEPTANCE-01`**（真实 Web Console → Fastify → media-agent → DeckLink Start/acknowledged/executing/actual running/Stop/Release/failure/recovery/SSE reconnect/reload reconciliation 全旅程清偿 WEB-CONSOLE-ENTRY-01 的 DEFERRED 验收）；`SDK-ENTRY-01` 顺延其后，不作为 BMD verification 替代。
- **迁移债务（remaining debt）**：无功能性债务。登记非阻塞事项：runner `.runner` 配置内旧 repo URL 依赖 GitHub 重定向/服务端路由（当前实测可调度；如未来 GitHub 收紧重定向，重注册 runbook = `scripts/ci/provision-runner.sh` 已指向新 slug）；fork PR 路径未实测（与迁移前状态一致）。BMD Runtime acceptance for WEB-CONSOLE-ENTRY-01 仍 **DEFERRED**（不因迁移或 CI PASS 升级）。

## 3.82 WEB-CONSOLE-BMD-ACCEPTANCE-01 收口（2026-09-29）—— BMD 真机 Web Console 全旅程验收

Status: **COMPLETE / BMD HARDWARE VERIFIED（exact commit `dc780c8`; 非 24h soak，不写 stability verified）—— WEB-CONSOLE-ENTRY-01 BMD Runtime acceptance 由 DEFERRED 升级为 BMD RUNTIME ACCEPTED**

### Pre-acceptance 修复链（7 个真 bug，全部 failure-first → RCA → 最小修复 → focused/regression → commit → exact-head CI 双绿 → exact-archive 重部署 → 受影响旅程从头重验）

| Bug | 根因 | 修复 commit | CI runs（media / control） |
|---|---|---|---|
| BUG-A EventsPage 每事件重连 | stream effect deps `[cursor]`：每 payload `setCursor` → 重建连接；`sse.ts` EOF（`read() done=true`）静默退出不触发重连；malformed JSON 帧只 onError 不终止旧流（并行双 transport 风险） | `fad0072` | `36523254344` / `36523254380` |
| BUG-B SessionsPage 请求风暴 | runtime effect deps `[rows,four]` × `reduceFourState` 恒返回新对象 → OBSERVE dispatch 无限重建 interval（2s polling 退化为风暴；生命周期测试 5s 超时实证） | `fad0072` | 同上 |
| BUG-C BMD acceptance 仍是 placeholder Web | `compose.bmd-acceptance.yml`/`compose.software-acceptance.yml` 以 CP-01E placeholder nginx 覆盖 `web`；真实 Dockerfile.web 从未进入验收栈 | `fad0072`（双 overlay 去 override + 删 web-placeholder.conf + gate 扩展 WCE-BMD 断言） | 同上 |
| BUG-D web 容器 healthcheck 抖动 | busybox/musl `localhost` 解析间歇首选 `::1`，容器 nginx 仅听 IPv4 → healthcheck 永久 unhealthy（同命令 exec 探测时成时败实证） | `59324cc`（healthcheck 127.0.0.1 字面量 + web.conf 双栈 5173） | `36524528934` / `36524528956` |
| BUG-E `/healthz` 落 SPA | nginx B8 路由表只实现前缀 `/health/`；契约路径 `/healthz`（schema contract test 守护）无 exact match → Health 页收 HTML | `5b9cadb`（`location = /healthz` → fastify；nginx -t 验证） | `36525093958` / `36525093945` |
| BUG-F Start intent 缺 `pipeline` | Web Console 发最小 intent `{version, devices[{device_id, role}]}`；Rust `graph_intent.rs` 冻结 wire 要求 `devices[].pipeline={source,sink}` → 真实 agent `invalid_intent` 拒绝（WCE-01F StubPlane 掩盖；表现 503 + PG `timeout\|retryable`） | `ec12f2b`（`api/intent.ts` canonical builder + wire guard 测试；直接 RPC 复现 + 完整 intent 实测 executed 定形） | `36526449012` / `36526449029` |
| BUG-G Release 死路 | `pickSessionId` 仅认 running；真实 Runtime 语义 stop=released（对非 running 会话 stop=failed(permanent) 诚实拒绝、release=幂等 executed canonical removal，均真机实测）→ Stop 后 Release 恒 "no active session" | `dc780c8`（Release 目标 = running 优先 → 最近非 terminated；Runtime Contract 零修改） | `36527255975` / `36527256048` |

### BMD 真机验收（exact commit `dc780c8`，archive sha256 `acfce0ac…`，agent binary = CI artifact `media-agent-gstreamer-linux` sha256 `3426108d…` 以 `/proc/<pid>/exe` 实证位元一致）

- **拓扑**（CP-01E 形态复用）：Playwright Chromium（dev VM）→ BMD nginx :8081 → 真实 Vite production Web Console → Fastify → bridge gateway `172.18.0.1` → native media-agent :50051（bmd,gstreamer；`VBMF_MACHINE_ID=10.30.15.10` + v5 manifest）→ DeckLink。ufw 临时规则 3 条（bridge 50051 / devvm 8081+15433），before/after 记录，验收后即撤。
- **旅程（24 截图 + browser-journey.log）**：credential gate（memory-only）→ 分层 Health（api/runtime/db/auth/events up; agent Ready devices=3）→ Runtime 真实快照（devices=3/ports=2/resources=2）→ Start（canonical device `4fa33dcb…`）：Desired=Running → Requested=completed → Executing=completed → Observed=running（divergence=ok after convergence；PG/API/agent 三方一致）→ Stop → observed released（resources available）→ Release → completed（幂等 canonical removal）。
- **failure-first**：agent SIGTERM → UI 真实失败显示；故障窗 Start → 503 DEPENDENCY_UNAVAILABLE + PG `timeout|retryable|agent dispatch transport failure`（UI/PG 一致）；重启同 binary agent → API 200 + UI 重新收敛。
- **SSE**：事件 #10/#11 到达期间 stream 请求恒 1（正常事件零重连 = BUG-A 修复真机反证）；`docker restart fastify` 断流 → 重连请求全部 `?cursor=11` strictly-after → replay 零重复 → 新事件 #12/#13 live 恢复。
- **reload**：有 running session 时 reload → credential-required（设计）→ 重输 key → canonical runtime 先行 → observed=running 收敛；localStorage/sessionStorage/cookie/URL 零 key。
- **边界**：device-2 PID `992634`（decklinkvideosink device-number=2, 1080p25, Sep 4 启动）before/after 存活、从未被 acceptance acquire（agent 日志 device-2 探测 WARN=占用证据）；`/opt/vbmf-dev/repo`（7cc33dd + 历史本地改动）未触碰；`/opt/vbmf/current` 保持 `0.1.0-06bc01a`。
- **Teardown**：acceptance sessions 全 Stop/Release；agent SIGTERM 优雅退出；`compose down -v`（容器/卷/网络全清）；ufw 3 条临时规则删除（恢复仅 SSH）；API key 经官方 `npm run provision revoke` 撤销（明文 key 仅存在于运行期 0600 临时文件，双端已清）；BMD/dev VM /tmp 验收工作区清理；零 ffmpeg/gst 孤儿、零 :50051 listener、零容器。
- **证据**：`evidence/bmd-10.30.15.10/2026-09-29-web-console-bmd-acceptance/`（manifest + 24 screens + agent.log + compose-rendered + pg-commands + device2 + ufw + sha256sums + browser-journey.log；不含任何 key/secret）。

### Verification Level

- **BMD Hardware（Web Console 旅程面）**: VERIFIED（exact commit `dc780c8`）。
- **24h Stability**: 不在本包范围（不写 stability verified）；§3.18 结论维持。
- media-agent Rust 源在本链零改动（fad0072→dc780c8 五 commit 的 gst artifact 位元一致）；Rust 侧既有 BMD 验收（RCE/CP-01E 等）不受影响。

## 3.83 SDK-ENTRY-01 收口（2026-09-29）—— TypeScript SDK 全链（planning → 01A..01E + dogfood BMD regression）

Status: **COMPLETE / SOFTWARE + CI VERIFIED（含新 SDK lane）/ BMD BOUNDED REGRESSION VERIFIED（SDK-01D dogfood @ `144ea60`）/ frozen Architecture·Contract 零修改**

### 推进链（7 commits on `main`）

| Commit | 内容 | exact-head CI（media / control） |
|---|---|---|
| `375971f` | Planning 冻结：`docs/superpowers/plans/2026-09-29-sdk-entry-01-planning.md`（Reality Matrix 8 endpoints × 12 维、schema debt A-D、S1-S8 决策、SDK-01A..E 分解、验证/failure 矩阵） | `36533273842` / `36533273851` |
| `f98a120` | **SDK-01A**：Debt A 清偿（`graphRuntimeIntentSchema` = graph_intent.rs 冻结 wire 精确表达；source tagged union decklink/rtmp/self_test；sink enum appsink/hls/rtmp = pipeline.rs 词表快照；全层 additionalProperties:false）+ Fastify 全局 `removeAdditional:false`（未知字段 400 拒绝不静默剥离）+ failure-first 契约测试 9 项（missing pipeline → 400 + zero submit；BUG-F 类缺陷锁死于 route 层）+ Debt D 清偿（contract test 未声明 status = FAIL；SSE 帧对 `sseFramePayloadSchema` 机械验证）+ `packages/vbmf-sdk` 骨架（json-schema-to-typescript compile 物化生成 `src/generated/types.ts` + drift gate + red-line gate） | `36534836360` / `36534836391`（control-plane 首跑 FAIL：F12 gate 拦截 api 注释内 vendor 字面量 → `606a1d7` 修正；结构性中间态已记录） |
| `606a1d7` | **SDK-01B/01C**：`VbmfClient`（S3-S6：credential provider / VbmfApiError(status+envelope+request_id+retryable+Retry-After) / 显式 idempotency-key / 无自动 write retry / AbortSignal / 路径编码）+ `VbmfEventClient`（S7：BMD 验证 SSE 语义——帧解析/cursor tri-state/dedupe/weak_ordering/EOF→重连/malformed→终止旧流/单 transport/operator-close 不误报）+ hermetic 27 测试 + 真实 Fastify fixture 集成（含 missing-pipeline 端到端 400）；F12 字面量修正 | `36536452274` / 后续 commit 补验 |
| `40fca02` | gitignore SDK dist + parity 测试 import 修正 | `36535672639` / `36535672683`（同 f98a120 结构性红——web-console typecheck 缺 SDK 构建前置） |
| `aa7f1fa` | **SDK-01D dogfood**：Web Console transport/types/SSE 切换 `@vbmf/sdk`（file: symlink）；手工 TS mirror 删除（Debt C 清偿——净删 163 行）；UI/credential 流/4-state machine 零改动；`apiFetch` + same-origin 红线拦截器保留本地（gate 依赖）；Dockerfile.web 双阶段构建（SDK build:tsc 用 committed generated，容器构建不触 apps/api 源码）+ dist chmod 修复（setgid 目录 750 → nginx worker EACCES，本地容器 smoke 发现） | `36536452274` / `36536452414`（control-plane FAIL=结构性：lane 缺 SDK 构建前置，配套 workflow 在下一 commit） |
| `f926419` | **SDK-01E CI lane**：control-plane lane 增 SDK steps（drift gate/red-line gate/typecheck/29 tests/build/pack smoke；SDK 先于 Web Console 构建）；required contexts/branch protection 不动。本地 SDK-01E 验收：npm pack 19 文件自包含（零 app 源码）、fresh Node consumer（typed runtime + error envelope + Retry-After）、Vite ESM consumer bundle、d.ts 自包含 | `36536732586` / `36536732560` |
| `144ea60` | **BUG-H 修复**（BMD dogfood regression 发现）：SDK 默认 fetch 未 bind → 真浏览器 `Illegal invocation`（Node 注入路径掩盖）；transport+events 双处 bind + this 敏感 fetch 替身 regression | `36539013523` / `36539013617` |

### 软件验证终态

- apps/api **65/65**（+9 intent 契约；全 fixture 升级 canonical wire）、apps/web-console **69/69**（dogfood 后零退化——BUG-A..G 生命周期套件全绿于 SDK transport 上）、packages/vbmf-sdk **29/29**（hermetic + Fastify 集成 + fetch-binding + parity/drift）；三包 typecheck/build 全绿；control-plane/WCE/SDK 三重红线 gate PASS；`git diff --check` clean。
- 验收 commit `144ea60` exact-head 双绿（media-agent `36539013523` 7/7 required + control-plane `36539013617` 含新 SDK lane）。

### BMD bounded regression（SDK-01D 触发 · exact `144ea60`，archive `c09edf44…`，agent binary `/proc/<pid>/exe` 位元一致 `3426108d…`）

- 旅程全 PASS：credential/Health 分层/Runtime（devices=3）/Events（SDK SSE transport：事件驱动零重连）/Start→4-state 收敛 running/Stop→released/Release→completed 幂等/**failure visible**（agent 完全死亡 → UI 如实 DEPENDENCY_UNAVAILABLE）/重启恢复/**SSE 断流（docker restart fastify）→ 重连全 `?cursor=13` strictly-after → 零重复 → live 恢复**/reload→gate→canonical 收敛。
- 证据：`evidence/bmd-10.30.15.10/2026-09-29-sdk-01d-bmd-regression/`（manifest + screens + browser-journey.log；无 key/secret）。
- 边界：device-2 PID 992634 before/after 存活；teardown 零残留（key 官方 revoke / compose down -v / ufw 3 规则撤 / 双端 /tmp 清 / 零进程容器 listener）。

### 结构性中间态记录（诚实披露）

`f98a120`/`40fca02`/`aa7f1fa` 三个 commit 的 control-plane lane 在各自 exact-head 上 FAIL——原因全部为同一变更集内的**配套缺失**（F12 字面量修正与 SDK 构建前置 workflow 分别在后续 commit 才到位），非代码缺陷回归；变更集完整形态 `f926419` 起双绿。media-agent lane 全程绿（7/7 required 从未受影响）。

### Verification Level

- **Software + CI**: COMPLETE（三包测试/typecheck/build + 新 SDK lane CI）。
- **BMD bounded regression（SDK-01D dogfood）**: VERIFIED @ `144ea60`。
- **Rust/媒体面**: 零改动（dc780c8→144ea60 全链 apps/packages/ops-only；gst artifact 位元一致）。
- SDK npm public publish / Python SDK / V0.3 endpoint 扩张：维持 deferred（§3.79/planning 非目标不变）。

## 3.84 PRODUCTION-READINESS-ENTRY-01 planning 冻结（2026-09-29）—— Post-SDK Reality Review + Production Core Dependency Rule

Status: **PLAN FROZEN（planning/reconciliation complete；首个 bounded packet PR-01A READY；frozen Architecture/Contract 零修改）**

- Authority：用户 2026-09-29 指令（Reality Audit → 做减法 → Production Baseline 收敛 → BMD reconciliation → Alarm/Incident → stability → Redundancy planning）。plan = `docs/superpowers/plans/2026-09-29-production-readiness-entry-01-planning.md`。
- **Capability Reality Matrix**（12 Engine / H1-H5 / X1-X6，live `main` @ `7be3b88` 只读审计）：implemented = Source（SDI+RTMP）、Switcher（FRAME 真机；MASTER 仿真+证据门；PACKET fail-closed）、Output（HLS+RTMP）、H2 Resource Scheduler、X2 Preflight、X6 Capability Registry；partially = Signal Fabric、Normalize（switch-graph 域内）、H1/H3-watchdog/H4/X1/X4/X5；semantic-only = Composition、Audio、H5；not implemented = **Redundancy、QC、Playout、Recording、Replay、H3-Incident、X3**；blocked = SRT（RF-SRC-01 维持）。watchdog 自动 failover 为类型级刻意不可构造（`GroupAction` 封闭词表仅 `ReportInputFailure`；冻结 #10），故 **Redundancy ≠ COMPLETE、Hot Standby ≠ COMPLETE**——MASTER_SWITCH 真机 PASS 不构成 Redundancy 完成。
- **生产编排 audit**：`apps/api/src` 对 `redis|valkey|bullmq|rustfs|srs` 零命中、deps 无对应 client——Fastify 唯一外部依赖 = PostgreSQL；但 BASE compose 将 `cache/rustfs/srs` 列为 fastify `depends_on` 硬前置并注入六个死变量（REDIS_HOST/REDIS_PORT/RUSTFS_ENDPOINT/RUSTFS_ACCESS/RUSTFS_SECRET/SRS_API），`Dockerfile.worker` 为 8 行 placeholder（无 CMD，起来即退），`rustfs:2026.8.1`/`srs:6.0.42` 已知 tag drift 不可拉取——core 被无消费者/失效服务阻塞。
- **Production Core Dependency Rule（冻结）**：没有当前 consumer ≠ production core dependency。core（默认启动）= db + media-agent（按 lane）+ fastify + web + nginx；optional compose profiles：`storage`→rustfs、`gateway`→srs、`worker`→cache(Valkey)+worker。optional 不启动 core 必须正常；显式启用时对应 capability 自己 honest fail。禁止为 compose 绿灯临时实现 BullMQ Worker；未来能力入口保留（做减法 ≠ 删规划）。
- **真实完成度（六维，不写单一百分比）**：core vertical slice 高；production readiness 中低（本阶段修）；12-engine 覆盖 3 implemented + 2 partial；硬件覆盖限于已验面；stability NOT VERIFIED（24h FAIL 9/10 在档）；operator journey 无 Alarm/Incident。
- **Packet 链**：PR-01A（Production Core Compose Truth）→ PR-01B（current-main BMD deployment reconciliation）→ PR-STAB-01（2h→8h→24h 原 gate）→ HEALTH-INCIDENT-ENTRY-01 → REDUNDANCY-ENTRY-01（均先 planning/reconciliation，不直接编码）。明确不优先：Python SDK、npm publish、BullMQ/Worker 实现、Webhook、Recording、Replay、Mother adapters、Federation、V0.3 endpoint 扩张。
- 红线：`.claude/settings.local.json` 不动；BMD device-2（PID 992634）不 kill/stop/restart/acquire；`/opt/vbmf-dev/repo` 不修改；24h PASS 前不写 stability verified；Alarm/Incident 只观察/记录 canonical Runtime facts，不决定媒体生命周期。

## 3.85 PR-01A + PR-01B 收口（2026-09-29）—— Production Core Compose Truth + current-main BMD Deployment Reconciliation

Status: **BOTH COMPLETE / SOFTWARE + CI VERIFIED（exact `885b766` 双 lane 绿）+ BMD DEPLOYMENT RECONCILIATION VERIFIED（exact `885b766` 安装树 + 全栈旅程 + rollback/forward + device-2 红线 before/after）**

### PR-01A — Production Core Compose Truth（commit `885b766`）

- 实施：BASE compose optional profiles 化（`storage`→rustfs、`gateway`→srs、`worker`→cache+worker）；core（db/media-agent/fastify/web/nginx）默认启动、无 optional 依赖；fastify 清除 `depends_on cache/rustfs/srs` 与六个死变量（REDIS_HOST/REDIS_PORT/RUSTFS_ENDPOINT/RUSTFS_ACCESS/RUSTFS_SECRET/SRS_API——`apps/api/src` 零 consumer 实证）；rustfs/srs secret 降为 optional 默认（core config 不再强制 RUSTFS_SECRET）；`Dockerfile.worker` 修复两类从未暴露的 placeholder 缺陷（FROM 行内注释解析错误 + build context `.`→`..`）并显式 honest-fail 契约（无 CMD→起即退→healthcheck 真 FAIL）；`check_control_plane_gate.py` 增 PR01A 结构 gate（profiles 声明、core 无 profile、fastify 无 optional 依赖/env、worker healthcheck 契约保留）；ops/README/.env.example/compose.prod/software-acceptance 注释同步。
- VM 软件验收（全 PASS）：compose config（BASE + prod/dev/acceptance/software-acceptance + bmd-acceptance 带 RPC_HOST + profile 激活组合）全 valid；core 5 服务独立 healthy（不依赖 cache/rustfs/srs/worker）；nginx 全链 `/healthz` 分层 up + Web Console assets 200 + 无凭证 401；**SDK consumer 旅程 10/10**（getRuntime/health/error-envelope/startSession→running（真实 RTMP publisher + FFmpeg 拉流 + HLS sink）/SSE 投影帧/stop/release）；optional honest-fail 双证（worker placeholder exit-loop Restarting 而 cache healthy；`rustfs/rustfs:2026.8.1` docker.io 独立复证 not found——tag drift 不是 BMD 网络问题）；teardown `down -v` 零残留。
- 测试：apps/api 65/65、web-console 69/69、vbmf-sdk 29/29；Rust 面 diff=0（gstreamer artifact 位元一致 `3426108d…` 三 commit 连续）；fmt check PASS；gates F11/F12/CP01C/WCE-BMD/PR01A + WCE-01 PASS；`git diff --check` clean。
- exact-head CI：media-agent `36547932378`（7/7 required）+ control-plane `36547932562` 均 SUCCESS。
- 旅程 RCA 记录（非缺陷）：`self_test` source + appsink 不属于 FFmpeg network-only lane（startfailed 为诚实拒绝）；RTMP 五元组 admission 要求 canonical path 前导 `/`（`InvalidEndpoint`）；acceptance manifest 权限须 0600 且宿主 chmod 后需 recreate 容器。

### PR-01B — Current-main BMD Deployment Reconciliation（exact `885b766`）

- Provenance 六环链：live main SHA → git archive embedded SHA（`885b7661…`）→ archive sha256（`fa71dae3…`）→ install-manifest → release binary sha256（`564a6d95…`）→ current symlink；install.sh native release build（`bmd,ffmpeg-backend`，与 06bc01a 形态连续）staging 原子落成。
- 验收（详见 `evidence/bmd-10.30.15.10/2026-09-29-pr01b-bmd-reconciliation/manifest.md`）：安装树 `/health Ready devices:3` + machine-pin 负行为正确；Web Console 全栈（native gstreamer agent 绑 `172.18.0.1:50051` + compose 控制面）SDK 真机旅程 7/7（**DeckLink 输入 actual running** + SSE 全事件族 + stop/release/reload 收敛）；Browser 旅程 9/9（credential gate 真实认证 + 四表面 canonical + reload 收敛 + 零凭证持久化）；failure/recovery（kill agent→unreachable/503→重启收敛）；fastify restart 健康；**rollback/forward 双向 provenance verified**（06bc01a ↔ 885b766）；teardown 零残留（key revoke/down -v/UFW 撤/双端 /tmp 清/无 staging/0 容器）。
- 红线：device-2 PID 992634 before/after 存活（argv/owner 不变）；`/opt/vbmf-dev/repo`（7cc33dd）未触碰；旧版本目录全保留。
- **事后修正（PR-STAB-01 准备期发现）**：teardown 的 `pkill -x media-agent` 未终止改名 gstreamer agent（comm 截断 `media-agent-885` 精确匹配失败，PID 3868361 遗留占用 50051/8080 至次日发现）；已按 PID 显式 kill 并复核零进程/端口释放/device-2 完好；教训 = teardown 必须以启动时记录的 PID kill + `ps -p` 复核（evidence manifest 已补记）。无对外暴露面。
- 终态：`/opt/vbmf/current -> /opt/vbmf/0.1.0-885b766`；BMD service 维持 inactive/disabled（未 enable，由运维决定——与 SE-01B 收尾一致）。

## 3.86 HEALTH-INCIDENT-ENTRY-01 实施（2026-09-29）—— HI-01A..01D + VM 旅程（plan §D1-D7）

Status: **HI-01A/01B/01C/01D COMPLETE（SOFTWARE + CI VERIFIED）+ VM 全栈旅程 VERIFIED；HI-01E（BMD bounded）PENDING**

- **HI-01A**（`a55c671`，含 `309c3e1` + typecheck fix）：plan D1 修正（drain wire 只给聚合 → agent 侧 **additive** `FaultDigest` 投影块：`EventProjection.faults`（kind/device/pipeline/session/summary/retryable canonical 照抄）+ `ApiProjectionResponse.faults #[serde(default)]` 旧载荷兼容）；Fastify `alarms` 表（partial unique on active、severity/recovery enum、evidence jsonb、ack_* 三字段）+ `alarmProjection.ts` 纯派生 + `alarmStore.ts` 条件 UPDATE + drain 点接线（失败仅日志不破坏 outbox 主路径）。api 74/74 + ephemeral PG 5/5 + Rust mock 套件 + fmt/clippy。
- **HI-01B**（`af19563`）：`GET /api/v1/alarms`（keyset 分页 first_seen desc/id desc + active/severity 过滤）+ `GET /api/v1/alarms/:id` + `POST /api/v1/alarms/:id/ack`（幂等，只写 ack_* 三字段；**ack ≠ healthy 红线**：active/recovery 不因 ack 变化）；RBAC 增 alarm 资源（viewer 读 / operator ack）+ `alarm.ack` 审计；schema 单源 3 条 + 契约测试路由清单显式扩展；db 未配置诚实 503。hermetic 74/74 + routes 4/4（401/过滤/404/viewer-403 vs operator-ack 语义/幂等重 ack/审计行/limit 400）。
- **HI-01C**（`6444d8d`）：SDK `AlarmItem` 机械派生（drift gate）+ `VbmfClient.listAlarms/getAlarm/ackAlarm`（查询编码/401→VbmfApiError 不吞/POST note）+ index 导出；hermetic ×4，SDK 33 测试。
- **HI-01D**（`adfab99`）：Web Console 第五表面 **Alarms**（active 列表 severity/kind/domain/related/summary/recovery×复发/ACTIVE + cleared history 折叠 + 真实错误面；数据全部经 `/api/v1/alarms` canonical——**零本地伪造**）；Ack 按钮（tooltip 明示 awareness-only；**acked 行仍显示 ACTIVE——acknowledged ≠ healthy 页面测试机械断言**）；helpers 经 @vbmf/sdk dogfood。console 72/72 + gates。
- **VM 全栈旅程**（`534f51e` 收口，network-only agent + compose 控制面 + 真实推流者）：fault（RTMP 无推流者→SessionFailed）→ alarm 产生（outbox has_critical + session_failures 证据 + alarm 行 severity=error/domain=session/related session/evidence canonical）→ ack 后 alarm 仍 ACTIVE（红线实证）→ recovery（推流者 + 会话 running）→ **clear**（recovered + clear_reason=evidence 含恢复观察快照）→ fresh-client reload 收敛 canonical history。**旅程发现并修复真缺陷**：失败会话回滚后不再发状态事件 → 窄路径同-session 恢复不可观察 → 增 domain 宽路径（本 drain 无新 session_failed 且观察到任一恢复态会话 → 清全部 active session_failed；hardware/ambiguous/pipeline 保持 manual-required 不适用宽路径）。测试 10/10 + 5/5。
- **HI-01E PENDING（BMD bounded）**：真机正常 DeckLink 旅程 + Alarms 页 canonical 一致性（zero-alarm 亦为真值）+ health 面；**真机 RuntimeEvent fault 注入缝不存在**（gates 注入器只在 gates binary；agent 停止=依赖不可达不发事件）——如实登记为 D1 债务演进项，VM 旅程为 §16 fault 链的软件面证据。
- CI：`a55c671`/`af19563`/`6444d8d`/`adfab99`/`534f51e` 全部 exact-head 双 lane 绿。

## 3.87 PR-STAB-01 2h rung PASS + HI-01E BMD 收口（2026-09-29）

Status: **2h RUNG PASS 10/10（谓词 v2，exact `ec5fc68` binary）；HI-01E COMPLETE / BMD VERIFIED；8h rung IN PROGRESS（960 cycles 运行中，预计 ~2026-09-30 早晨完成）；HEALTH-INCIDENT-ENTRY-01 全链（HI-01A..01E）COMPLETE**

### PR-STAB-01 2h rung（`~/a2-8-02i-evidence/2026-09-29-pr-stab-01-2h`）

- **VERDICT PASS (10/10 predicates v2)**：threads spread=2 / fd 17→17 / **rss_bounded first_third=1238.1MB last_third=1239.7MB（+1.6MB，gate +50MB；历史 24h FAIL 为 +86.6MB）**、非单调 / sw_epoch 1→240 逐命令 +1 / switches 240/240 executed+preserved / observed==target 240/240 / frames v:25→206641 a:34→275479 递增 / drops=0 / watchdog ticks 343→691 递增 / events no critical（120 采样）。replays 48/48 replayed（数据行，不 gate）。
- 复刻方法：历史 `r64-stability-long.sh` 原样（谓词/采样逐字），仅两处环境适配（VBMF_MACHINE_ID·SE-01D 后必需；build 树路径）+ bin/manifest md5 钉扎（`ed2ef608…`/`7521d17e…`）。
- 8h rung 已启动（同 binary、同方法；CYCLES=960；tag `pr-stab-01-8h`）。**24h PASS 前不得写 stability verified；gate 不放宽。**

### HI-01E — BMD bounded acceptance（`evidence/bmd-10.30.15.10/2026-09-29-hi01e-bmd-acceptance/`）

- exact `fa837f1` compose 控制面（含 alarms 迁移）+ native agent @ `adfab99` artifact（sha256 `28cb30a7…`，Rust faults-wire 新位元）。
- 分层健康 up（Ready devices=3）；正常 DeckLink 旅程 actual RUNNING→stop→release 零残留；alarms canonical（zero-alarm 真值 + 健康会话零新 alarm）；**真实故障链**：R1 启动 60s bootstrap lease 窗口内 LeaseConflict 拒绝 → 如实 `session_failed` alarm（canonical preflight summary）→ R2 健康会话 running 恢复观察宽路径 clear（recovered + evidence）——真机完整 fault→alarm→recovery→clear。
- Browser 4/4（真实 Chromium）：credential 认证 / 第五表面 Alarms / canonical 状态渲染（No active + Cleared history + awareness-only 声明）/ reload 收敛。
- teardown 零残留（显式 PID kill + `down -v` + UFW 撤 + /tmp 清理 + 0 容器）；device-2 红线 before/after 完好（25d7h+ 连续）。
- 诚实边界登记：真机可控 RuntimeEvent fault 注入缝不存在（gates-only）；agent 停止=依赖不可达不发事件；bootstrap lease 60s 窗口语义已知非缺陷。

## 3.88 PR-STAB-01 BASELINE RECONCILIATION + STATE 控制面对齐（2026-09-29·用户指令）

Status: **RECONCILED（docs-only；历史证据全部保留）**

### exact-commit 事实（协调者独立确认 + 本轮冷启动复核一致）

- `git diff ec5fc68..9e68043 -- services/media-agent`：唯一变化在 `309c3e1`（HI-01A faults wire）——`api_boundary.rs` +6 / `event_projection.rs` +151（`EventProjection.faults` / `FaultDigest` / `ApiProjectionResponse.faults`，additive），合计 **+156/-1，并非 docs-only**；
- `git diff 309c3e1..9e68043 -- services/media-agent`：**空**（HI-01A 之后 media-agent 源码零推进；`a55c671` 仅 api test helper，TS 侧）；
- 因此 §3.87 的 2h/8h soak binary（ec5fc68 build tree）**不能证明 current main（9e68043）stability**——这是 Verification Authority 口径问题，不是 soak 无价值。

### 处置（裁决）

1. **在跑的 8h 不停止**：14:47Z 只读核验健康（driver `soak-run.sh` + agent PID 3908949 活、104/960 cycles、sw_epoch 逐 +1、frames_v/a 递增、dropped=0 clock_lost=0、watchdog tick 递增、events 全部 `critical=False`、switch executed+preserved、observed==target、device-2 PID 992634 完好）——按原十项谓词 v2 自然收口；
2. **verdict 口径**：ec5fc68 2h/8h 证据统一记为 **PRE-HI RUNTIME BASELINE**（regression/comparison evidence，保留不删）；8h PASS 只能写 "PRE-HI RUNTIME BASELINE 8h PASS"，不得写 current-main stability verified；
3. **ec5fc68 24h NOT RUN**：runtime source advanced at `309c3e1`，旧 baseline ladder 在 8h 后 STOP progression——"不跑旧 24h" 是 superseded baseline 结论，不是失败；
4. **current Runtime stability 正式 baseline 重立**：新 ladder 从最新 canonical HEAD（含 HI-01A Rust wire）重新 **2h→8h→24h 全跑**；启动前必须重新证明 `git diff 309c3e1..HEAD -- services/media-agent` 为空；从该 HEAD 生成 exact archive/artifact 并记录 git SHA / archive checksum / binary sha256 / manifest checksum / build features / BMD environment / DeckLink identities / device-2 PID·argv·owner；谓词 v2 十项与 `r64-stability-long.sh` 原样，gate 不放宽（禁 malloc_trim / 放宽 +50MB / 换采样 / 减 workload / 降 switch 频率）；
5. **Runtime freeze window**：自新 2h rung 启动至 24h closure 前，`services/media-agent/**`、影响 agent 的 `Cargo.toml`/`Cargo.lock`、media runtime scripts、BMD Runtime configuration semantics 原则冻结；仅 stability RCA 必需修复可改，改则当前 ladder 作废→记录 evidence→修复→focused regression→exact-head CI→受影响 rung 重跑；
6. **STABILITY VERIFIED 门槛**：新 ladder 2h+8h+24h 全 PASS 且绑定 exact commit/binary hash/BMD environment/hardware/scope 后才可写；此后仅 docs/control-plane 变化且 media-agent artifact 可证 bit-identical 时，可记 "Runtime stability evidence remains applicable to identical media-agent binary"，不得笼统写整 repository HEAD stability verified。

### 并行推进边界（soak/freeze 期间）

- 允许：RD-01A planning-only（细化 planning/reconciliation，不编码）、docs、read-only architecture/code audit、test-design、acceptance/failure matrix、STATE 一致性维护；
- 禁止（避免重改变 stability target）：RD-01A Runtime implementation、watchdog 行为改动、switch execution 改动、readiness Runtime state 写入、hysteresis implementation、Redundancy Group Runtime wiring、auto failover implementation。

### 优先级链（用户 2026-09-29 指令 §19）

STATE-CONTROL-PLANE-RECONCILIATION（本节）→ ec5fc68 8h 自然收口 → RD-01A planning only → current Runtime exact baseline 2h → 8h → 24h → STABILITY VERIFIED closure → RD-01A implementation。

### 8h rung 收口结果（2026-09-30 登记）

- **960 cycles 自然完成**（2026-09-29 21:38:55Z cycle 960）；driver 自身收尾：`stop_session` **executed**、teardown 完整（teardown-line=1）、agent 进程退出、零残留、无 listener、device-2 PID 992634 全程完好（before 25d7h / after 25d18h）。
- **VERDICT PASS 10/10（谓词 v2，`~/a2-8-02i-evidence/2026-09-29-pr-stab-01-8h/summary.txt`）**：threads spread=2（31→33）/ fd 17→17 / **rss_bounded first_third=1242.0MB last_third=1269.5MB（+27.5MB，gate +50MB 内；非单调）** / sw_epoch 1→960 连续 +1 / switches 960/960 executed+preserved / observed==target 960/960 / frames v:27→829044 a:36→1105297 递增 / drops=0 / watchdog ticks 1379→2763 递增 / events no critical（480 采样）；replays 192/192（数据行，不 gate）。
- **口径：PRE-HI RUNTIME BASELINE 8h PASS（binary = ec5fc68 build 树）——不证明 current main stability**。RSS 观察（如实登记，供新 ladder 对比）：8h +27.5MB 斜率显著大于 2h +1.6MB，但该 baseline 已 superseded、不作 RCA 对象；current-main ladder 的 8h/24h 若再现增长斜度则按 failure-first 立案。
- **ec5fc68 baseline 终账**：2h PASS 10/10 + 8h PASS 10/10 + **24h NOT RUN because runtime source advanced at `309c3e1`**（superseded stability baseline，保留作 regression/comparison evidence；"不跑旧 24h"不是失败）。

## 3.89 current-main stability ladder 2h rung 启动（2026-09-30）

Status: **2h RUNG LAUNCHED（exact HEAD = 本 STATE commit；启动证据见下）**

- **exact-commit 前置已证**：`git diff 309c3e1..<本commit> -- services/media-agent` 为空（HI-01A wire 之后 media-agent 源码零推进；本 commit 为 docs-only）。启动后以 header 钉扎补登记（bin_md5/manifest_md5/git SHA）。
- **方法 = PR-STAB-01 复刻原样**：BMD `/home/lytv/pr-stab-01-build` checkout 更新至本 commit → driver `soak-run.sh`（`r64-stability-long.sh` 派生，谓词 v2 十项逐字）自建 binary（`scripts/build-bmd.sh` 重建 + md5 钉扎先行，R62 纪律）；CYCLES=240 / DWELL=28 / REPLAY_EVERY=5 / TAG=`pr-stab-01-2h-current-main`；`VBMF_MACHINE_ID=10.30.15.10`（SE-01D machine-pin 必需）；evidence dir = `~/a2-8-02i-evidence/2026-09-29-pr-stab-01-2h-current-main`。
- **Runtime freeze window 自本 rung 启动生效**（§3.88 处置 5）：`services/media-agent/**`、影响 agent 的 Cargo.toml/lock、media runtime scripts、BMD Runtime configuration semantics 冻结；仅 stability RCA 必需修复可改（改则本 ladder 作废、受影响 rung 重跑）。
- gate 不放宽；禁 malloc_trim/放宽 +50MB/换采样/减 workload/降 switch 频率。PASS 后推进 8h（CYCLES=960）→ 24h；**新 ladder 24h PASS 前不得写 stability verified**。

## 3.90 current-main stability ladder：2h PASS + 8h rung 启动（2026-09-30）

Status: **current-main 2h RUNG PASS 10/10 @ exact Runtime commit `3c13b59`；8h RUNG IN PROGRESS（同 exact binary / 同 predicate v2）；24h PENDING；Runtime freeze window 继续生效**

- **2h exact evidence**：BMD evidence = `~/a2-8-02i-evidence/2026-09-30-pr-stab-01-2h-current-main/`；header `bin_md5=e5b2e73b4bf0fd2e881c05992dec64ec`、`manifest_md5=7521d17e7fd02e50eb2b0a84374a43dd`、CYCLES=240 / DWELL=28 / predicate=v2；该 binary 由 `3c13b59043bea934ca349836b792edbd9b9c29d6` source tree 重建，且启动前已证 `git diff 309c3e1..3c13b59 -- services/media-agent` 为空。
- **2h verdict = PASS 10/10**：threads spread=2（31..33）；fd first3=17.0 / last3=17.0；**RSS first_third=1245.8MB / last_third=1247.4MB（+1.6MB < +50MB gate，monotonic=False）**；switch_epoch 1→240 且逐命令 +1；switches 240/240 executed+preserved；observed==target 240/240；frames v:24→206656 / a:35→275507 递增；drops=0；watchdog mid=343 / end=691；events no critical（120 samples）；replays 48/48（非 gate）。
- **2h teardown**：stop_session=executed；teardown-line=1；agent/soak 进程与 :8080/:50051 listener 均无残留；受保护 device-2 PID 992634 / argv / owner 保持。
- **§3.89 路径事实修正**：历史 launch 记录中的 build/evidence 日期描述不精确；真实 current-main build tree = `/home/lytv/pr-stab-01-build-cm`（由 exact git archive 解包，不触碰旧 build tree），2h evidence 日期目录 = `2026-09-30-pr-stab-01-2h-current-main`。此修正不改变方法/predicate/gate。
- **8h 已启动**：沿用同一 `3c13b59` source tree 与同一 `e5b2e73b4bf0fd2e881c05992dec64ec` binary identity，TAG=`pr-stab-01-8h-current-main`、CYCLES=960、DWELL=28、REPLAY_EVERY=5；evidence = `~/a2-8-02i-evidence/2026-09-30-pr-stab-01-8h-current-main/`。首轮健康核验：driver + agent alive、header 钉扎一致、samples 正常推进、dropped=0、observed==target、state=Capturing、device-2 PID 992634 完好。
- **exact-commit 口径**：本节之后若仅产生 STATE/docs commit 且 `services/media-agent` / 影响 agent 的 Cargo/runtime scripts/config 证明零变化，则本 ladder 的 Runtime stability scope 仍绑定 exact Runtime binary `e5b2e73b…` / source commit `3c13b59`；不得把 docs-only repository HEAD 笼统称为新的 Runtime stability target。
- **下一门槛**：8h 必须按同一十项 predicate v2 自然收口；PASS 后才启动同一 Runtime binary 的 24h。24h PASS 前继续禁止写 `STABILITY VERIFIED`。

## 3.91 current-main stability ladder：8h PASS + 24h rung 启动（2026-10-02）

Status: **current-main 8h RUNG PASS 10/10 @ exact Runtime source commit `3c13b59` / binary `e5b2e73b…`；24h RUNG LAUNCHED / IN PROGRESS（同 exact binary / 同 predicate v2）；stability 仍 NOT VERIFIED；Runtime freeze window 继续生效**

### 8h exact evidence（BMD；协调者 2026-10-02 只读核验登记）

- evidence = `~/a2-8-02i-evidence/2026-09-30-pr-stab-01-8h-current-main/`；header：`bin_md5=e5b2e73b4bf0fd2e881c05992dec64ec`、`manifest_md5=7521d17e7fd02e50eb2b0a84374a43dd`、CYCLES=960 / DWELL=28 / REPLAY_EVERY=5、predicate=v2。
- **VERDICT PASS 10/10**：threads min31 / max33（spread=2）；fd first3_avg=17.0 / last3_avg=17.0；**rss_bounded first_third=1241.5MB / last_third=1269.1MB（+27.6MB < +50MB gate，monotonic=False）**；switch_epoch 1→960 连续 +1；switches 960/960 executed+preserved；observed==target 960/960；frames v:27→828961 / a:37→1105253 递增；drops=0；watchdog ticks 1379→2764 递增；events no critical（samples=480）；replays 192（数据行，非 gate）。
- teardown：teardown-line=1；`stop_session` status=executed；协调者复核 :8080/:50051 无残留 listener、soak/media-agent 无残留进程；受保护 device-2 PID 992634（gst-launch device-number=2）仍在。
- RSS 如实登记（供 24h 对比）：current-main 8h +27.6MB 与 PRE-HI baseline 8h +27.5MB（§3.88）同量级、高于本 ladder 2h 的 +1.6MB；未超 +50MB gate 故 PASS。24h rung 的 `rss_bounded` 是债务关闭的决定项；若 24h 超 gate 则按 failure-first 立案（evidence→RCA→最小正确修复→exact-head CI→受影响 rung 重跑），gate 不放宽。

### 24h rung 已启动（BMD 2026-10-02T20:45:31+08:00）

- build tree 仍为 `/home/lytv/pr-stab-01-build-cm`（对应 exact Runtime source commit `3c13b59`）；启动前独立重建 `target/debug/media-agent` MD5 仍为 `e5b2e73b4bf0fd2e881c05992dec64ec`；`services/media-agent` 非 target 源文件自 8h 启动后无修改。
- TAG=`pr-stab-01-24h-current-main`；CYCLES=2880 / DWELL=28 / REPLAY_EVERY=5；duration_approx=86400s；evidence = `~/a2-8-02i-evidence/2026-10-02-pr-stab-01-24h-current-main/`。
- 启动证据（仅启动时点，不构成结果）：driver PID=3666、media-agent PID=3692（后续 PID 变化不能据此单独判失败）；header 钉扎 exact `bin_md5=e5b2e73b…` / `manifest_md5=7521d17e…`；first sample：cycle1 rss=1220960KB / fd17 / threads33 / drops0 / clock_lost0 / sw_epoch1 / observed==target；health state=Capturing、active_pipelines=3、devices=3、dropped_bus_events=0、clock_lost_events=0；device-2 PID 992634 仍在。
- **口径：24h = LAUNCHED / IN PROGRESS——不得写 PASS，不得写 STABILITY VERIFIED**。按 duration_approx=86400s，自然收口约在 2026-10-03 20:45 (+08:00)；必须按同一十项 predicate v2 自然收口。

### exact-commit / freeze 口径（延续 §3.90）

- 本轮冷启动复核：`git diff 3c13b59..HEAD -- services/media-agent` 为空，影响 agent 的 Cargo/runtime scripts/config 亦零变化（`3c13b59..HEAD` 仅 STATE docs commit）；因此本 ladder stability scope 仍绑定 exact Runtime source commit `3c13b59` + exact binary `e5b2e73b…`，docs-only repository HEAD 不构成新 Runtime stability target。
- Runtime freeze window 继续生效至 24h closure（§3.88 处置 5 范围不变）；仅 stability RCA 必需修复可改，改则本 ladder 作废→记录 evidence→修复→focused regression→exact-head CI→受影响 rung 重跑。
- ladder 现态 = **2h PASS + 8h PASS + 24h IN PROGRESS**；stability 仍 **NOT VERIFIED**；仅当 24h PASS 且绑定 exact commit/binary/BMD environment/hardware/scope 后才做 STABILITY VERIFIED closure，然后进入 RD-01A implementation。

## 3.92 current-main stability ladder：24h FAIL 9/10；RSS RCA 重新激活（2026-10-04 reconciliation）

Status: **24h RUNG COMPLETE / VERDICT FAIL 9/10（唯一失败 = rss_bounded）；STABILITY NOT VERIFIED；Runtime freeze 继续生效；PR-STAB-01 转入 failure-first RCA**

- BMD exact evidence：`~/a2-8-02i-evidence/2026-10-02-pr-stab-01-24h-current-main/`；2880/2880 cycles 自然完成，summary 写出于 2026-10-03；source commit=`3c13b59`，binary MD5=`e5b2e73b4bf0fd2e881c05992dec64ec`，manifest MD5=`7521d17e7fd02e50eb2b0a84374a43dd`，与 current-main 2h/8h rung 同一 Runtime target。
- **PASS 9/10**：threads spread=2（31..33）；fd 17→17；switch_epoch 1→2880 consecutive +1；switches 2880/2880 executed+preserved；observed==target 2880/2880；frames v:31→2488961 / a:43→3318221 advancing；drops=0；watchdog ticks 4142→8290；events no critical（1440 samples）；replays 576（非 gate）。
- **FAIL 1/10 = `rss_bounded`**：first_third=1257.2MB，last_third=1343.8MB，**+86.6MB > +50MB gate**，monotonic=False。gate 不放宽，不用 malloc_trim/采样变更/减 workload/降 switch 频率造绿。
- teardown 正常：`stop_session=executed`、teardown-line=1、media-agent/soak 退出、:8080/:50051 无残留；受保护 device-2 PID 992634 保持原 gst-launch 进程。
- 历史 reconciliation：旧 `r64-stability-24h` 同样 **FAIL 9/10**，RSS first_third=1262.4MB → last_third=1349.0MB，亦为 **+86.6MB**；其余九项同型 PASS。该精确复现强化 §3.18 `STAB-O4/FIX` 的既有判断：问题仍落在 DeckLink ingest native allocation / allocator reservation 候选域，尚无 repo-side root cause 证据；不得把重复失败误判为最近 Rust 代码回归，也不得无证据修改 Runtime。
- 下一步：复用 §3.17–§3.18 已完成的排除链，先做 bounded read-only/diagnostic RCA，重点验证 allocation-path / allocator-behavior 与当前 BMD SDK/plugin/runtime 环境是否仍同构；只有出现 repo-side 可证根因才允许最小正确修复并重跑受影响 stability ladder。若仍为 NO-FIX-IN-REPO，必须形成新的生产可接受性/依赖升级裁决，不能伪造 STABILITY VERIFIED。

## 3.93 PR-STAB-01 RSS RCA：observer backpressure 修复实施（2026-10-04）

Status: **IMPLEMENTATION COMPLETE / DEVELOPMENT SOFTWARE VERIFIED / BMD GST+DECKLINK BUILD VERIFIED / RUNTIME STABILITY RE-VERIFICATION REQUIRED**

- RCA 新证据：current-main 24h 与历史 24h 的 RSS 归一化轨迹相关约 0.9989，且 current 24h 大量离散增量为约 5584–5628KiB；E4 稳态 DeckLink video buffer 固定 `5529600 bytes = 5400KiB`，双输入增量常近邻成对出现。结合 §3.17–§3.18 smaps 既有事实（ΔRSS=ΔVmData=ΔRssAnon、VmSize/[heap]/named mapping 平直、DeckLink-free selftest flat、single-input/no-switch 仍复现），分配链进一步收敛为 **DeckLink native whole-frame allocator high-water / anonymous reservation page residency**。
- 上游核验：BMD GStreamer=`1.28.2`；1.28.3 DeckLink 确有 allocator/input callback refcount lifecycle 修复，但 1.28.2→当前 allocator pool 算法仍为“free pool 空时整帧 `g_malloc`、ReleaseBuffer 回池、后续机会性缩池”。因此 1.28.3 生命周期 refcount 修复**不足以单独解释同一次 24h 内持续阶梯增长**，本轮不以升级依赖冒充修复。
- repo-side 可证机制：VBMF 健康/PTS appsink 是纯观察面，但此前形态=`tee → 默认 queue → appsink`，且 callback/watchdog 存在 `HEALTH_ARCS` 全局 HashMap mutex → per-pipeline mutex 的嵌套等待。观察者偶发抖动/锁竞争可反压 streaming thread，暂时抬高 DeckLink outstanding frame high-water；native allocator 因此新增整帧 buffer，释放后匿名 arena 页仍可保持 resident，与 5.4MiB RSS 台阶形态一致。
- 最小正确修复（本 commit）：①新增单一 `OBSERVER_QUEUE = queue max-size-buffers=1 max-size-bytes=0 max-size-time=0 leaky=downstream`，只用于健康/PTS appsink 观察分支；纯分析与带 output 的观察 branch 同步使用，encode/output/MediaTap/Program canonical media path 不改；②新增 `health_arc()`，clone per-handle Arc 后立即释放全局 registry mutex，再获取 per-handle mutex；controller callbacks/start/recover 与 watchdog 相关路径改用该 helper。Session/Resource/Lease/Switch/Watchdog decision semantics/frozen Contract 均不变。
- Development VM：新 observer-queue contract focused PASS；output-launch focused PASS；default **343/343 PASS**；mock **549/549 + integration 9/9 + 12/12 PASS**；`cargo fmt --check` PASS；default/mock clippy `-D warnings` PASS。Dev VM 缺 GStreamer system pkg-config dev files，故本机 gstreamer-feature test = ENVIRONMENT UNAVAILABLE，不冒充失败。
- BMD 临时 exact-source tree（base=`b216e99` + 本 diff，patch sha256=`5300532f3ce1fbef9f30ad2f755cab21a2f1073405f6be369b81e050f54a76b8`）：`scripts/build-bmd.sh` 在真实 GStreamer 1.28.2 + DeckLink SDK 环境 **PASS**；正式 `/opt/vbmf/current`、`/opt/vbmf-dev/repo`、device-number 2 均未修改。远端 focused cargo-test 命令受执行安全层阻断，登记为 deferred，不按 PASS 书写。
- 因本轮修改 `services/media-agent/**`，§3.88 Runtime freeze 的 RCA exception 已触发：旧 `3c13b59` 2h/8h/24h ladder 只保留为失败基线；**新 exact Runtime commit 必须重新 2h→8h→24h 同 binary 原 gate 验证**。+50MB gate、workload、switch frequency、predicate v2 均不放宽。

## 3.94 PR-STAB-01 observer-backpressure fix：exact-head CI + BMD 2h rebaseline 启动（2026-10-04）

Status: **FIX COMMITTED / EXACT-HEAD CI PASS / BMD EXACT BINARY 2h RUNG IN PROGRESS / STABILITY NOT VERIFIED**

- Runtime fix commit = `6fc1b1ad9519eabec7d2553faf69d8d1f0f5e271`（`fix(runtime): isolate health observation from ingest backpressure`）；local/origin/GitHub live main 推送时三方一致。
- exact-head CI：control-plane CI `37170303262` **SUCCESS**；media-agent CI `37170303263` **SUCCESS**。
- BMD exact source：`git archive 6fc1b1a` gzip sha256=`91bc12d408c39a5cf80638ff17a85b185d5ba8a456bc4e9c2a52724119cee860` → 独立 build tree `~/pr-stab-01-build-fix`；`scripts/build-bmd.sh` PASS；binary MD5=`3898ced3554c148150a60043cd167c19`；manifest MD5=`7521d17e7fd02e50eb2b0a84374a43dd`。正式 `/opt/vbmf/current` 与 `/opt/vbmf-dev/repo` 未修改。
- stability driver 复用 §3.90/§3.91 同一 `soak-run.sh` / predicate v2 / workload，仅 build-tree 路径从 `pr-stab-01-build-cm` 改为 `pr-stab-01-build-fix`；driver sha256=`5d822ff780a5ae6a954d48bbc376a56e57817d215f9c3029f0ecc93e9b064bbf`。
- 新 2h rung：TAG=`pr-stab-01-2h-observer-fix`，CYCLES=240 / DWELL=28 / REPLAY_EVERY=5；evidence=`~/a2-8-02i-evidence/2026-10-04-pr-stab-01-2h-observer-fix/`。header exact binary/manifest 已钉扎；首轮 health=`Capturing` / active_pipelines=3 / devices=3 / drops=0 / clock_lost=0；cycle 1–2 switch_epoch 连续且 observed==target；device-2 PID 992634 保持原 gst-launch。
- 本次 Runtime 修改使旧 `3c13b59` stability ladder 不可继承；新 ladder 必须以 `6fc1b1a` exact Runtime binary `3898ced3…` 完整 2h→8h→24h。当前只可写 **fix implementation complete + software/CI/BMD build verified + 2h in progress**，不得写 RSS bug closed / stability verified。

## 3.95 PR-STAB-01 observer-backpressure fix：2h PASS 10/10 + 8h 启动（2026-10-04）

Status: **2h PASS 10/10 / 8h IN PROGRESS / STABILITY NOT VERIFIED**

- BMD exact Runtime 仍为 `6fc1b1ad9519eabec7d2553faf69d8d1f0f5e271` / binary MD5=`3898ced3554c148150a60043cd167c19`；2h evidence=`~/a2-8-02i-evidence/2026-10-04-pr-stab-01-2h-observer-fix/`。
- 2h 自然完成 240/240 cycles，predicate v2 **PASS 10/10**：threads 31..33 spread=2；fd 17→17；RSS first_third=`1239.8MB` → last_third=`1245.1MB`，**+5.3MB < +50MB gate**；switch_epoch 1→240 consecutive +1；switches 240/240；observed==target 240/240；frames v 25→206617 / a 34→275519；drops=0；watchdog ticks 343→692；events 120 samples no critical；replays 48（非 gate）。
- teardown 正常：stop_session=`executed`，media-agent/soak 与 :8080/:50051 无残留；受保护 device-2 PID 992634 持续存活。
- 发现流程推进缺口：2h 于 12:10 已结束但 8h 未自动接续；该问题属于 orchestration gap，不是 Runtime failure。本轮已人工恢复连续推进。
- 新 8h rung 已于 20:28 启动：TAG=`pr-stab-01-8h-observer-fix`，CYCLES=960 / DWELL=28 / REPLAY_EVERY=5，predicate/workload/gate 不变；header 钉扎同 binary/manifest；首 cycle Capturing 路径正常，drops=0、clock_lost=0、observed==target。

## 4. Current Task

**PR-STAB-01 = observer-backpressure fix exact verification（§3.93–§3.95）：Runtime exact commit `6fc1b1a` / binary `3898ced3…`；Development + exact-head CI + BMD build PASS；BMD 2h PASS 10/10（RSS +5.3MB），8h IN PROGRESS，随后同 binary 24h；STABILITY NOT VERIFIED；RD-01A Runtime implementation 继续冻结**

1. **PR-01A COMPLETE**（§3.85·`885b766`）：Production Core Compose Truth——optional profiles + 死依赖清除 + honest-fail 双证 + SDK 旅程 10/10。
2. **PR-01B COMPLETE**（§3.85·`885b766` BMD 全旅程）：`/opt/vbmf/current -> 0.1.0-885b766`，provenance 六环链 + rollback/forward + teardown（含 §3.85 事后修正教训）。
3. **PR-STAB-01**：`3c13b59` ladder 2h+8h PASS、24h FAIL 9/10（唯一 `rss_bounded` +86.6MB）固定为 failure baseline；**§3.93 observer-backpressure 最小修复已实施**，Development default/mock/fmt/clippy PASS、BMD GStreamer+DeckLink native build PASS。因 Runtime source 已改变，新 exact commit 必须重新 2h→8h→24h；Runtime freeze 继续生效，**不得写 stability verified**。
4. **HEALTH-INCIDENT-ENTRY-01 COMPLETE**（§3.86+§3.87）：HI-01A..D 软件+CI、VM 全栈旅程、HI-01E BMD bounded（真机 fault→alarm→recovery→clear 真实链 + Browser canonical + teardown 零残留）。
5. **REDUNDANCY-ENTRY-01**：plan frozen（诚实基线：auto failover 类型级不可构造；readiness 轴/hysteresis/Hot-Standby policy/RG/failover_benchmarks 零实现）；**RD-01A planning-only 完成（2026-09-29·`docs/superpowers/plans/2026-09-29-rd-01a-readiness-rg-planning.md`：owner 九问 D1–D9 + 三轴语义（Readiness≠Health 防偷合并）+ RG identity/config 语义 + failure-first matrix 17 项 + RD-01A..E 分解 reconciliation（frozen §5 为准）；Runtime 写入面仍冻结（§3.88），实施 READY 待 stability ladder 收口后独立裁决）**；RD-01B..E 待 RD-01A 实施收口。

## 5. Next Task

**PR-STAB-01 FIX VERIFICATION ACTIVE（§3.93–§3.95）：exact Runtime `6fc1b1a` / binary `3898ced3…` 的 BMD 2h 已 PASS 10/10（RSS +5.3MB）→ 8h IN PROGRESS → 8h PASS 后同 binary 24h → 24h PASS 才可 STABILITY VERIFIED；predicate v2 / +50MB gate / workload 均不放宽。RD-01A Runtime implementation 继续 BLOCKED。**

P2 系列全部收口（§3.4–§3.16）。BMD 实机永走 hardware acceptance 人工线，不进入
普通 PR CI。

### 5.1 Task Queue / Agent Work Packets

> 本节是 `.project/STATE.md` 内的唯一动态任务队列。Agent 只能选择**当前 Phase 中第一个 `READY`** 项；`BLOCKED` / `BACKLOG` 不得越级实施。每个任务完成必须满足 Implementation + Required Verification + Evidence + STATE Update + GitHub Sync。执行者输出只代表 `DONE_NEEDS_REVIEW`，未经协调者 diff/verification 复核不得转 COMPLETE。

| ID | Status | Task / Scope | Depends on | Required acceptance |
|---|---|---|---|---|
| **P2-C1** | **COMPLETE（§3.6，2026-09-15）** | `vbmf-ci-01` current-SHA 正式收口：从 live `main` full SHA 生成 §15.9 bundle，host checksum，Rust 1.98.1 idempotent pin，修复版 V1–V4 verify，以 `vbmf-ci` 刷新 manifest；不得修改 runner sudo 权限 | current live main + §15.9 | exact SHA/bundle checksum；V1–V4 PASS；manifest；无 generic sudo；证据记录 |
| **P2-C2** | **COMPLETE（§3.7，2026-09-15）** | `vbmf-ci-02` 对称 system Rust 1.98.1 provision/verify/manifest；经 devbox/KVM 既有授权管理面执行，host-key 必须严格验证；以 `vbmf-ci` 调用 rust 工具时显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`（§3.6 RCA） | P2-C1 | 与 host1 同 exact toolchain/path；二次 pin 幂等；V1–V4 PASS；manifest |
| **P2-C3** | **COMPLETE（§3.8，2026-09-15）** | 双 runner read-only parity re-probe，必须实际命中 01 与 02；验证 Rust path/version、manifest、labels parity | P2-C1/C2 | 两机 evidence；`/usr/local/bin` exact 1.98.1 parity；runner identity 明确 |
| **P2-C4** | **COMPLETE（§3.9，2026-09-15）** | 只迁现有 `rust-format` job 到条件 `runs-on`；fork PR 留 GitHub-hosted，trusted main/same-repo PR 走 `vbmf-general`；其余 6 jobs 不动 | P2-C3 | context 名仍 `rust-format`；fork boundary 不变；7 required checks PASS；实际 self-hosted runner identity evidence |
| **P2-D** | **COMPLETE（§3.10，2026-09-15）** | 阶段1：pin/verify/collect/test 四脚本加 clippy 组件 + 双机 host-admin 幂等补装收口；阶段2：`rust-clippy` 条件 `runs-on` 迁移 | P2-C COMPLETE | V1–V5 双机 PASS；manifest 双证；7 checks PASS；runner identity；STATE |
| **P2-E1** | **COMPLETE（§3.11，2026-09-15）** | `session-lifecycle` grayscale + 双 runner 稳定性观察 | P2-D | required context 不变；调度/失败恢复 evidence |
| **P2-E2** | **COMPLETE（§3.12，2026-09-16）** | `architecture-portability` grayscale | P2-E1 | fork/trusted 双通道回归；7 checks PASS |
| **P2-E3** | **COMPLETE（§3.13，2026-09-16）** | `rust-test-matrix` 最后迁 general pool（含 rustdoc 暴录二阶段） | P2-E2 | matrix 完整 PASS；queue/concurrency 无未解释失败 |
| **P2-M0** | **COMPLETE（§3.14，2026-09-16）** | DeckLink SDK 注入模式裁决；host-local 与 secret injection 二选一，禁止混用 | P2-E3 | 决策落入 CI Strategy/ADR 职责文档；安全与可重复性评审 |
| **P2-M1** | **COMPLETE（§3.15，2026-09-17）** | `hardware-test-compile` migration（仅 capability build，不冒充硬件验证） | P2-M0 | CI PASS；BMD hardware 仍独立人工 acceptance |
| **P2-M2** | **COMPLETE（§3.16，2026-09-17）** | `gstreamer-build` migration（迁 vbmf-media，关闭 D1 空过窗口） | P2-M1 | CI PASS；general/media runner 边界无漂移 |
| **STAB-O3.1** | **COMPLETE（§3.17·2026-09-17·INCONCLUSIVE-at-allocation-path + 候选空间收敛）** | 24h RSS RCA causal discrimination；禁止把相关性写成 root cause | P2-M 全链完成 | observer-only evidence；owner 候选收敛或明确 INCONCLUSIVE |
| **STAB-O4/FIX** | **COMPLETE（§3.18·2026-09-17·E4-1 观测完成 + NO-FIX-IN-REPO）** | 首刀 = E4 型 allocation-path 观测（生产观测点·用户已授权）→ 最小正确修复（FIX 原则 A–D）→ focused/full regression → 2h/8h/24h ladder | STAB-O3.1 COMPLETE | 新 24h `10/10` 前不得标 stability verified；禁止降低 +50MB gate / `malloc_trim` 掩盖 |
| **RUNTIME-HARDEN** | **ACTIVE / DECOMPOSED（§3.19）** | umbrella；不可由 Agent 直接执行 | STAB-O4 COMPLETE | 只执行下列 bounded packet；按 dependency gate 清偿 |
| **RH-BUS-01** | **COMPLETE（§3.20·2026-09-17）** | 每 pipeline 独立 GLib MainContext + Bus-watch lifecycle；双并发 pipeline Bus delivery | §3.18 production defect | focused/full PASS；双 handle Bus evidence；stop/recover 无残留；BMD exact-commit 双输入；CI 7/7 |
| **RH-BUS-02** | **COMPLETE（§3.21·2026-09-18）** | Execution Group 每输入 drain Bus；Error/EOS/ClockLost canonical 归因→Supervisor；fatal overflow fallback per-handle 化 | RH-BUS-01 | focused 12/12 + full GStreamer 278/278；BMD dual-input 10/10 + live Bus 65/65；CI `35248227420` 7/7 |
| **RH-LC-01** | **COMPLETE（§3.22·2026-09-18）** | D1 LifecycleJournal / reverse rollback engine | RH-BUS closure | `CompletedStep[]` + 单一 rollback；mock 429/429 + default 246/246 + integration 9/9+12/12；CI `35279581145` 7/7；BMD smoke deferred |
| **RH-RES-01A** | **COMPLETE（§3.23·2026-09-18）** | D3 per-claim Reservation TTL + Renew/Expire/Abort lifecycle | RH-LC-01 | Resource 7/7 + Session 6/6；mock 432/432 + 9/9 + 12/12；default 248/248；CI `35293309933` 7/7；BMD not required |
| **RH-RES-01B** | **COMPLETE（§3.24·2026-09-18）** | D7 backend `OnceLock`→direct field | RH-RES-01A | one-file +5/-19；set_backend caller=0；mock 433/433 + 9/9+12/12；default 249/249；CI `35293860197` 7/7 |
| **RH-CLOCK-01** | **COMPLETE（§3.38·2026-09-18）** | D11 Clock observation timeline + D13 timecode release-build hardening | Clock/Timecode feature entry | Locked→Lost→Recovered；release fail-closed；software/CI verified；report=`docs/superpowers/reports/2026-09-18-rh-clock-01-verify.md` |
| **RH-FLOW-01** | **BACKLOG / DEFER-UNTIL-TOUCH** | D15 explicit media-flow cardinality | multi-flow Audio/Metadata entry | PortId≠flow；0/1/N flow contract/tests |
| **RH-IDEM-01** | **COMPLETE — 经 CP-01B 清偿（§3.74·2026-09-23）** | durable idempotency 外部 boundary-of-record（commands 表族 + C4/C6 全语义；agent 侧进程内幂等表层维持传输重试守卫） | CP-01B 落地（`a1b612a`） | F1–F8 注入 12/12 + 真实 agent E2E；Runtime remains truth |
| **RUNTIME-FEATURES** | **ACTIVE / DECOMPOSED（§3.25）** | Network Sources、PACKET/MASTER、Hot-Standby、Live FFmpeg、SRS/Output、Recording/Replay、Composition/Audio execution | immediate hardening gates complete | 只执行 bounded packet；先修 frozen Backend contract 的 RuntimeBinding 实现漂移 |
| **RF-ENTRY-01** | **COMPLETE（§3.25·2026-09-18）** | Runtime Features Authority/Reconciliation | RH-RES-01B | 旧 Source status 与 live code reconciliation；deferred hardening touch-gates；首 packet 裁决 |
| **RF-FF-01A** | **COMPLETE（§3.26·2026-09-18）** | Backend-neutral RuntimeBinding extraction（FFmpeg prerequisite） | RF-ENTRY-01 | mock 435/435 + 9/9+12/12；default 251/251；CI `35296461203` 7/7；BMD dual-input 10/10 exact commit |
| **RF-FF-01B** | **COMPLETE（§3.27·2026-09-18）** | FFmpegBackend process lifecycle / SelfTest | RF-FF-01A | focused 8/8 + ffmpeg full 261/261（real-binary smoke separate）；default 252/252；mock 436/436 + 9/9+12/12；CI `35313253516` 7/7；BMD real ffmpeg SelfTest 1/1；DeckLink not exercised |
| **RF-FF-01C** | **COMPLETE（§3.28·2026-09-18）** | FFmpeg Resolved RuntimeBinding mapping + single-input BMD parity | RF-FF-01B | focused 5/5；ffmpeg full 266 PASS + 1 ignored HW；default 252/252；mock 436/436 + 9/9+12/12；CI `35339165383` 7/7；BMD 50 frames/2s + lifecycle 1/1；output PID unchanged |
| **RF-FF-01D** | **COMPLETE（§3.29·2026-09-18）** | Backend-neutral Session Binding Authorization extraction | RF-FF-01C | focused 6/6；default 258/258；mock 436/436 + 9/9+12/12；ffmpeg 272 PASS + 1 ignored HW；CI `35342501850` 7/7；BMD dual-input 10/10 exact commit |
| **RF-FF-01E** | **COMPLETE（§3.30·2026-09-18）** | FFmpeg SessionManager / production composition-root single-input wiring | RF-FF-01D | final `96f8055`；focused 3/3；CI `35344678284` 7/7；BMD production no-auto-start + Session create/start/Running/stop/Released rc=0；Resource/Lease clean；no orphan |
| **RF-FF-01F** | **COMPLETE（§3.31·2026-09-18）** | Backend-neutral canonical event/recovery monitor extraction + FFmpeg failure-first recovery | RF-FF-01E | neutral monitor no GStreamer evidence；canonical observe→Supervisor→lease recheck→recover；cancellable lifecycle；CI `35356652348` 7/7；BMD kill/recover/new child + teardown/no orphan |
| **RF-FF-02** | **COMPLETE（§3.34·2026-09-18）** | FFmpeg 单输入 Egress / Output 生命周期（现有 Hls/Rtmp OutputPlan） | RF-FF-01F + §3.33 | focused 4/4；ffmpeg 282+1 ignored；default/simulation 261/261；mock 446+9/9+12/12；CI `35375536871` 7/7；BMD exact HLS/recovery/teardown；output device 2 untouched |
| **RF-FF-03** | **COMPLETE（§3.36·2026-09-18）** | FFmpeg 单输入 RTMP egress / loopback receiver recovery | RF-FF-02 + §3.35 | focused 4/4；ffmpeg 282+1 ignored；default/simulation 261/261；mock 446+9/9+12/12；CI `35379282990` 7/7；BMD sender/receiver h264+aac、recovery、teardown；output device 2 untouched |
| **RF-NORM-01** | **COMPLETE（§3.41·2026-09-18）** | 显式 Program RAW target + backend-neutral Normalize execution contract + bounded GStreamer per-plane chain/evidence；不启用 MASTER_SWITCH | RF-ENTRY-01 + current FrameSwitch/GStreamer path | Phase A 5/5；Phase B 269/269、CI `35393863201` 7/7、BMD exact dual-input 11/11；L2c exact V+A；warnings 已登记；output device 2 untouched |
| **RF-MASTER-01** | **COMPLETE（§3.43·2026-09-18）** | 消费 RF-NORM exact V+A evidence，在 normalized GStreamer Program graph 上启用 bounded MASTER_SWITCH；保持 PACKET/Network/Output 等边界 | RF-NORM-01 + A2-1 SwitchPolicy | default 269/269；mock 455/455；CI `35400579632` 7/7；BMD exact L2c + L4 MASTER_SWITCH + L5/recovery/teardown 11/11；warnings 已登记；output device 2 untouched |
| **RF-SRC-01** | **BLOCKED（§3.45·2026-09-18）** | SRT source boundary + FFmpeg runtime；BMD FFmpeg 无 SRT protocol，保持 blocker 记录，不替换协议冒充完成 | RF-FF-01A–01F + capability | 无代码；需有 SRT-capable runtime 才能继续；不以 RTMP 证据继承 |
| **RF-SRC-RTMP-01** | **COMPLETE（§3.49·2026-09-19；ffd8889）** | 单协议单输入 RTMP source boundary + FFmpeg runtime/lifecycle；typed ownership/session、CI 与 BMD source recovery/teardown 已验收 | RF-FF slices + §3.47 | DeckLink wire compatibility；typed ownership；BMD loopback A/V；recovery/teardown；security redaction；7/7 CI；不得扩展其他协议/Network umbrella |
| **RF-SRC-RTMP-01-IMPLEMENTATION** | **COMPLETE（§3.49·2026-09-19）** | typed source/resource/lease/session + materialize/preflight + FFmpeg RTMP argv + BMD source recovery/teardown 已完成 | RF-SRC-RTMP-01 design | exact commit `ffd8889`；software matrix PASS；BMD source evidence；CI `35407985671` 7/7；STATE/GitHub sync |
| **RF-SRC-RTMP-02-IMPLEMENTATION** | **COMPLETE（TG-0…TG-6 + CLOSURE-RECONCILIATION 全 PASS·§3.52–§3.58 + §3.60·2026-09-19）** | Production RTMP listener admission：strict endpoint/manifest/machine-pin/local-address validation、bind authority、D7/D8 recovery、D9 redaction、D10 network-only composition（production root 可达 + gate 先于 bootstrap dispatch）；`SourceIntent::Rtmp` wire 未变 | RF-SRC-RTMP-02 design | TG-0 探针①②③；TG-1+reconciliation（`a29da14`）；TG-2 组合/五元组（`ae8a93d`）；TG-3 listener/stderr（`131aa52`）；TG-4 D7/D8（`11af233`）；TG-5 redaction（`b605284`）；TG-6 历史 Tier 1 + Tier 2（`ee856d4`/`58fd33d`·事实保留）；closure reconciliation `d13f1fd`（CI 7/7 + BMD TG-6R 严格 D10 进程级重验·Tier1/Tier2 同 SHA·证据+EVIDENCE-INDEX·device-2 未触碰） |
| **RUNTIME-FEATURES-NEXT** | **SUPERSEDED BY RF-SRC-RTMP-02（§3.51·2026-09-19）** | 从 live evidence 重新冻结下一个 bounded Runtime Features packet | RF-SRC-RTMP-01 | 已由 RF-SRC-RTMP-02 design authority、scope、touch-gates、acceptance、verification 接替；不从 BACKLOG 越级 |
| **STANDALONE-ENTRY-01** | **COMPLETE — PLAN FROZEN（§3.61·2026-09-19；SE-01A READY）** | Standalone 定位收敛 planning：live-tree audit（缺口 A–E）+ Authority reconciliation（三层 SoT 不重开、全栈/standalone 双 lane 并存）+ 冻结设计 S1–S10 + 子包分解 SE-01A/C/D/B + acceptance matrix | RF-SRC-RTMP-02 closure 完成（§3.60） | `docs/superpowers/plans/2026-09-19-standalone-entry-01-planning.md`；保持 `compatible, not dependent` 与 `Runtime owns truth`；不建 Web Console/Fastify SoR/SDK/新 Runtime owner |
| **SE-01A** | **COMPLETE（§3.62·2026-09-19·`e3e7fe4` CI 7/7 + BMD smoke）** | Standalone graceful shutdown：SIGTERM/SIGINT 有序 drain（SessionManager 唯一 owner·created_at 降序）+ SIGHUP warn 无操作 + Starting→Ready + 二次信号逃生门 | STANDALONE-ENTRY-01 plan（S3/S4） | 真 signal 单测 + mock drain 套件 + 3 项 failure-first RCA；BMD 真实 binary smoke（/health Ready·SIGHUP 存活·SIGTERM exit 0·零残留·device-2 未触碰）；证据+EVIDENCE-INDEX |
| **SE-01C** | **COMPLETE（§3.63·2026-09-20·docs-only + CI）** | readiness/liveness 语义页 + 配置权威清单（env→语义→默认→fail 条件；gate envs 标注不进生产）+ 退出码契约（production 0/2 与 gates 0/1/2 分立）+ Deployment SoT §17 standalone lane；/health wire 零变化；S4 reconciliation：ready ⟺ Ready\|Capturing | SE-01A COMPLETE | docs review；无新 wire/无代码面扩大 |
| **SE-01D** | **COMPLETE（§3.64·2026-09-20·`6932d5e` CI 7/7 + BMD 重 pin 实证）** | machine identity 收敛：`VBMF_MACHINE_ID` > `/etc/machine-id` > 空串；HOSTNAME fallback 移除；6 项解析回归 + 两类 manifest pin 锚定；production binary network/device 正负 pin BMD 实证（正=Ready+exit 0·负=exit 2 mismatch） | SE-01C COMPLETE | focused/full/CI/BMD 独立验收（已满足） |
| **SE-01B** | **COMPLETE（§3.65 + §3.66→§3.67 reconciliation 收口·2026-09-20·`a238558` CI 7/7 + BMD 全项）** | 版本化目录 + `current` symlink + install-manifest.json（exact-SHA provenance）；`/etc/vbmf`（0600）/`/var/lib/vbmf`；`vbmf-media-agent.service`；外部推流/rollback/device 零回归 BMD 实证 | SE-01D COMPLETE | 3 closure defects 已由 SE-01B-FIX 清偿（§3.66→§3.67）；无遗留 |
| **SE-01B-FIX** | **COMPLETE（§3.67·2026-09-20·`a238558` CI `35541709917` 7/7 + BMD provenance 链/StartLimit 注入/原子性矩阵）** | fail-closed exact-SHA provenance + installer staging 原子性 + systemd StartLimit 修正 + S7 owner/mode 入 manifest + `.zcodeignore` 口径 | §3.66 登记 | §3.66 DoD 全项 PASS；VM matrix 37/37；六环链核验 |
| **RUNTIME-CONTROL-ENTRY-01** | **COMPLETE — PLAN FROZEN（§3.68·2026-09-20）** | 只读审计 + Authority reconciliation：`/api/v1/*`=prototype 裁定、internal=JSON-RPC@`/internal/v1/*`、CommandStatus 两平面映射、RH-IDEM 维持 DEFER、owner map；冻结 D1–D8 + F1–F10 + 子包 RCE-01A/B | SE-01B-FIX COMPLETE（§3.67） | planning 文档已冻结；frozen Contract 零修改（无 stop condition） |
| **RCE-01A** | **COMPLETE（§3.69·2026-09-20·`06bc01a` CI `35543068464` 7/7 + VM production smoke）** | internal Runtime Control surface：JSON-RPC `/internal/v1/agent` 四方法 + `MEDIA_AGENT_RPC_BIND`（127.0.0.1:50051·UNWIRED 债关闭）+ 三生产根接线 + prototype 503 契约保持 + 11 focused tests | RCE planning（§3.68） | 已满足（BMD = RCE-01B） |
| **RCE-01B** | **COMPLETE（§3.70·2026-09-20·`06bc01a` BMD 真实命令旅程 12/12）** | BMD 真机命令旅程（systemd service 经 internal 面 create/start/query actual state/stop/SIGTERM 活会话 drain + 边界） | RCE-01A COMPLETE（§3.69） | 已满足（含独占资源 preflight 拒绝 + lifecycle 守卫 + replay 幂等实证） |
| **RCE-D3-BIND-RECONCILIATION** | **COMPLETE（§3.71·2026-09-21·docs+comments-only）** | bind 命名漂移修正（canonical=`MEDIA_AGENT_RPC_BIND`/50051）+ standalone/full-stack exposure 政策显式化（R-a..R-f） | 用户 2026-09-21 指令 | 零 frozen 修改、零行为变化、静态检查绿；CI 随收口提交 |
| **CONTROL-PLANE-ENTRY-01** | **COMPLETE — PLAN FROZEN（§3.72·2026-09-21）** | Fastify Product `/api/v1/*` planning：C1–C14 冻结决策 + 时序/持久化/失败契约 + owner map + 子包分解 CP-01A..01E | RCE 全链 + §3.71 | 零 frozen 修改；planning 文档已冻结 |
| **CP-01A** | **COMPLETE — SOFTWARE + CI + VM SMOKE（§3.73·2026-09-23·BMD DEFERRED to CP-01E）** | Fastify 骨架 + AgentControlClient adapter + Product 读 API v0 + compose 接线收敛 + F11–F13 机检/测试 + 新 CI lane（非 required） | CP planning（§3.72） | VM 真实 agent smoke + 25/25 + gate PASS + CI 7/7 & 新 lane SUCCESS |
| **CP-01B** | **COMPLETE — SOFTWARE + CI + VM PG 注入 + 真实 agent E2E（§3.74·2026-09-23·BMD DEFERRED to CP-01E）** | durable command entry（commands/audit_entries·C4/C6 全语义·F1–F8 全 PASS）；**RH-IDEM-01 清偿** | CP-01A COMPLETE（§3.73） | ephemeral PG 12/12 + 真实 agent E2E + CI 双 lane SUCCESS |
| **CP-01C** | **COMPLETE — SOFTWARE + CI + VM PG 注入 + 容器级安全 smoke（§3.75·2026-09-24·BMD DEFERRED to CP-01E）** | Better Auth + CASL + 应用层 rate limit + 审计硬化（dev principal 桩删除；api_keys 家族对齐） | CP-01B COMPLETE（§3.74） | hermetic 49/49 + DB 层 22/22（F1–F8 真实身份回归）+ provision/revoke 实跑 + compose config ×4 + 容器 smoke + gate 扩展 PASS |
| **CP-01D** | **COMPLETE — SOFTWARE + CI + VM PG 注入 + 真实 HTTP SSE（§3.76·2026-09-24·BMD DEFERRED to CP-01E）** | Event plane：drain→outbox→SSE（单实例约束·B9）+ cursor | CP-01B（§3.74）+ CP-01C（§3.75） | hermetic 49/49 + DB 29/29（B9 双实例抢锁/cursor/retention/真实 HTTP SSE）+ CI 双 lane |
| **PORT-COLLISION-01** | **COMPLETE（§3.78，2026-09-25）** | PortId derive 键不含 direction/Analog 位折叠——BMD Device smoke 实证 Input/Sdi 与 Output/Sdi 同卡碰撞 ×2；专门 collision closure（port_id 稳定性 + registry fail-closed 语义复核）→ 物理 jack 槽位忠实枚举 + PortId invariant guard | 无 | 双工卡 out jack 表达需后续 Resolver 端口级 binding 演进（独立 packet） |
| **PRODUCT-SURFACE-ENTRY-01** | **COMPLETE（§3.79，2026-09-25）—— planning 裁决** | VBMF-SDK vs WEB-CONSOLE 实施顺序裁决：以 live API + frozen Contract + dependency evidence 为依据；结论 = **WEB-CONSOLE-ENTRY-01 先行**（首个真实 TS consumer；可反向验证 Product API 消费者可用性；为后续 SDK 生成提供 real consumer evidence）；SDK 仍属 planning deferred，待 Web Console 形成稳定 wire 语义后再启 SDK-ENTRY-01 | 无 | Web Console 与 SDK 都不改 frozen Contract；仅消费 Product API |
| **WEB-CONSOLE-ENTRY-01** | **COMPLETE（§3.80·2026-09-28 实施 + 2026-09-29 §3.80 Reconciliation 修正——原 control-plane lane "CI 全绿" 属过早声明；exact-head `c02b118` control-plane CI 实为 FAILURE，Ajv NodeNext 类型导入由 WCE-01-CLOSURE-RECONCILIATION 修复）** | 独立 TS Web Console app（Vite + React 19 + 原生 fetch + JSON Schema 派生类型），经 Fastify 反代消费 `/api/v1/*` + `/events/v1/stream`；零直连 media-agent；四状态分离（Desired/Requested/Executing/Observed）+ 命令旅程（Start/Stop/Release）+ SSE 实时 + failure/recovery 反映 + reconnect/reload 收敛；agent 原生 INDEX_HTML 路由（transport.rs）保留作 D10 离线诊断面，不删除 | §3.79（PRODUCT-SURFACE-ENTRY-01 裁决） | WCE-01A: schema 单一源（apps/api/src/routes/schemas.ts）+ contract test（ajv）；WCE-01B: apps/web-console foundation + Vite 6 + React 19 + in-memory 凭证 + same-origin 客户端红线拦截；WCE-01C/01D/01E: 4-state reducer + Start/Stop/Release 命令旅程 + SSE cursor tri-state/weak_ordering/reload-first snapshot；WCE-01F: 真实 Fastify fixture + 12 integration tests；Compose/CI: 多阶段 Dockerfile.web + ops/nginx/web.conf + 红线 gate（check_web_console_red_lines.py）+ control-plane lane 扩展。apps/api 56/56 tests + apps/web-console 52/52 tests PASS；typecheck/build/vite build/F11/F12/WCE-01 红线 gate 全绿；frozen EXTERNAL_API_CONTRACT/EVENT_CONTRACT/IMPLEMENTATION_BOUNDARIES/CANONICAL_IDENTITY 零修改。BMD Runtime acceptance = DEFERRED（VM 软件验证已闭环）。 |
| **WCE-01-CLOSURE-RECONCILIATION** | **COMPLETE（2026-09-29·§3.80 Reconciliation + §3.81 前记·`e1435fa` exact-head 双绿：media-agent `36518795888` SUCCESS + control-plane `36518795854` 出网窗 rerun 后 SUCCESS）** | Ajv TS2351 RCA + 最小修复（`import { Ajv } from "ajv"` 命名导入，零 tsconfig 妥协）+ STATE §3.80 过度声明修正 + 全软件回归（双 app npm ci/typecheck/test/build + 双红线 gate + diff-check） | WEB-CONSOLE-ENTRY-01（§3.80） | 已满足（exact-head 双 lane CI 绿，不以旧 commit 绿色替代） |
| **REPO-MIGRATION-01** | **COMPLETE（§3.81·2026-09-29·transfer + reconciliation + closure commit `8d78ddf` exact-head 双绿：media-agent `36519490264` 7/7 required + control-plane `36519490258`）** | GitHub repository transfer `pwl1987/VBMF` → `pwl1987-dev/vbmf`（正式 Transfer API；identity/history/issues/PR/settings 连续保留；未建新仓/mirror/history 复制）；产品名维持 VBMF；remote/硬编码引用分类更新 + runners/branch protection/Actions 复核 + 迁移后 exact-head CI | WCE-01-CLOSURE-RECONCILIATION | 已满足（live main SHA 不变 + history/PR/tags 保留 + runners online + 7 required contexts 不变 + 迁移后双 lane CI 绿） |
| **WEB-CONSOLE-BMD-ACCEPTANCE-01** | **COMPLETE（§3.82·2026-09-29·exact commit `dc780c8` BMD 真机全旅程 PASS；验收前修复 BUG-A..G 七个真 bug，每 commit exact-head 双 lane CI 绿）** | 清偿 WEB-CONSOLE-ENTRY-01 的 BMD Runtime acceptance：production Web Console → Fastify → media-agent → DeckLink 真实命令旅程 + failure/recovery/SSE/reload；device-2 现存输出不动 | REPO-MIGRATION-01 COMPLETE（§3.81） | 已满足（WEB-CONSOLE-ENTRY-01 已标 BMD RUNTIME ACCEPTED；证据 `evidence/bmd-10.30.15.10/2026-09-29-web-console-bmd-acceptance/`；teardown 零残留） |
| **SDK-ENTRY-01** | **COMPLETE（§3.83·2026-09-29·planning + SDK-01A..01E 全链 + dogfood BMD bounded regression @ `144ea60` 双绿）** | `@vbmf/sdk` TS consumer library：schema 单源机械派生类型（drift gate）+ VbmfClient/VbmfEventClient + Web Console dogfood（transport/SSE/types 单一实现）+ control-plane SDK CI lane + npm pack 自包含 | WEB-CONSOLE-BMD-ACCEPTANCE-01 COMPLETE（§3.82） | 已满足（Reality Matrix/debt A-D 清偿/29+69+65 测试/BMD bounded regression/teardown 零残留；plan=`docs/superpowers/plans/2026-09-29-sdk-entry-01-planning.md`） |
| **PRODUCTION-READINESS-ENTRY-01** | **COMPLETE — PLAN FROZEN（§3.84·2026-09-29）** | Post-SDK Reality Review：12-Engine/H/X Capability Reality Matrix + 生产编排 audit（Fastify 唯一外部依赖=PostgreSQL；六个死变量+placeholder worker+失效镜像阻塞 core）+ **Production Core Dependency Rule 冻结**（core=db/media-agent/fastify/web/nginx；storage/gateway/worker=optional profiles）+ packet 链 + 六维真实完成度矩阵 | 用户 2026-09-29 指令 | plan=`docs/superpowers/plans/2026-09-29-production-readiness-entry-01-planning.md`；frozen Contract 零修改 |
| **PR-01A** | **COMPLETE（§3.85·2026-09-29·exact `885b766` 双 lane CI 绿）** | Production Core Compose Truth：optional profiles 化 + fastify 死依赖/死变量清除 + PR01A 结构 gate + worker placeholder honest-fail 修复 + ops 文档同步 | PRODUCTION-READINESS-ENTRY-01 plan frozen | 已满足（config×N/core 独立 up/SDK 旅程 10/10/optional honest-fail 双证/65+69+29 测试/gates/Rust 零改动） |
| **PR-01B** | **COMPLETE（§3.85·2026-09-29·exact `885b766` BMD 全旅程 + rollback/forward + teardown 零残留）** | Current-main BMD Deployment Reconciliation：exact archive + versioned install + install-manifest + atomic current + rollback/forward；不动 `/opt/vbmf-dev/repo`；device-2 红线 before/after | PR-01A COMPLETE | 已满足（`/opt/vbmf/current -> 0.1.0-885b766`；evidence `evidence/bmd-10.30.15.10/2026-09-29-pr01b-bmd-reconciliation/`） |
| **PR-STAB-01** | **FIX VERIFICATION ACTIVE（§3.93–§3.94）——exact Runtime `6fc1b1a` / binary `3898ced3…`；新 2h rung IN PROGRESS** | observer appsink bounded/leaky non-backpressure + `HEALTH_ARCS` registry/per-handle 锁拆层；不改 canonical media/Switch/Session/Resource/Lease/Watchdog decision；重新 2h→8h→24h 原 gate | PR-01A COMPLETE | Development + exact-head CI + BMD exact build PASS；新 2h/8h/24h 同 binary 全 PASS 后方可 STABILITY VERIFIED |
| **HEALTH-INCIDENT-ENTRY-01** | **COMPLETE — 全链 HI-01A..01E（§3.86+§3.87·2026-09-29）** | Alarm/Incident 从 RuntimeEvent/Supervisor/Health projection **派生投影**（禁止第二 Runtime 状态机；恢复归 Runtime/Supervisor/canonical command）；alarm identity/severity/failure domain/first_seen/last_seen/active-cleared/retryable-manual-required/related/recovery status/evidence；operator ACK = awareness state only；Fastify Product API → SDK → Web Console Alarms 页；plan=`docs/superpowers/plans/2026-09-29-health-incident-entry-01-planning.md`（16-kind 映射表 + D1-D7 决策 + HI-01A..01E 子包 + §16 旅程验收锚） | 用户 2026-09-29 指令 §13–§16 | fault→alarm→actual degraded→recovery→cleared→reload canonical 收敛全旅程（非本地 React 状态）；frozen Contract 零修改（additive 资源按 V0.2 §5 incidents/X4 Authority + versioning 非破坏条款，ADR 登记） |
| **REDUNDANCY-ENTRY-01** | **PLAN FROZEN（2026-09-29·reconciliation complete）+ RD-01A PLANNING-ONLY COMPLETE（`bf15b62`；Runtime implementation blocked by stability freeze）** | 诚实基线：auto failover 类型级不可构造（watchdog 冻结 #10 不推翻）；readiness 轴（READY_TO_TAKE）/failover+failback hysteresis/Hot-Standby COLD-WARM-HOT policy/failover_benchmarks/Redundancy Group **零实现**；**Redundancy/Hot-Standby/Auto-Failover 均 ≠ COMPLETE**；实现原则链冻结（policy permits→READY_TO_TAKE→preflight→hysteresis→canonical command→observation→incident evidence）；plan=`docs/superpowers/plans/2026-09-29-redundancy-entry-01-planning.md`；RD-01A planning 范围 = 重读 ARCHITECTURE_V0.2 §3/§8 + live watchdog/switch/runtime_state 等 owner map、Readiness≠Health 三轴（Lifecycle/Readiness/Health）语义、failure-first matrix、RD-01B..E 分解核对；**禁止**（§3.88 并行边界）：Runtime 实现/watchdog 行为/switch execution/readiness 写入/hysteresis/RG wiring/auto failover | HEALTH-INCIDENT-ENTRY-01 边界稳定（已满足） | §3 原则链逐环可验收；禁止 watchdog/adapter/UI 自行倒换；RD-01A planning 产出须冻结后 RD-01B..E 才可逐包转 READY |
| **STANDALONE** | **FOUNDATION COMPLETE — SE-01A/C/D/B 全链（§3.62–§3.67）；剩余子能力已移交 Production Readiness 链** | 版本化安装+atomic current+rollback+readiness/shutdown 语义已 BMD 实证 @ `a238558`；production compose 真值化 → PR-01A；current-main BMD 对账 → PR-01B | — | umbrella 不再作为独立 READY 来源 |
| **CONTROL-PLANE** | **PRODUCT FOUNDATION COMPLETE — CP-01A..01E 全链（§3.73–§3.77）** | Product API/Auth/RBAC/限流/审计/Event plane（SSE+cursor）= COMPLETE（含 BMD 集成验收）；**Worker/BullMQ = DEFERRED**（无当前 consumer；Production Core Dependency Rule 裁决为 optional `worker` profile，禁止为绿灯临时实现） | — | Rust Runtime remains truth；Fastify 不拥有媒体生命周期 |
| **VBMF-SDK** | **PARTIAL — TypeScript COMPLETE（SDK-ENTRY-01·§3.83）；npm publish = DEFERRED；Python/Rust = BACKLOG** | TS `@vbmf/sdk`（schema 单源派生+client+SSE+Web Console dogfood+CI lane+npm pack 自包含）全链 COMPLETE | — | 不暴露 Rust/GStreamer/FFmpeg/vendor/DB internals |
| **WEB-CONSOLE** | **RUNTIME OPERATOR FOUNDATION COMPLETE — WEB-CONSOLE-ENTRY-01（§3.80）+ BMD 全旅程（§3.82）+ Alarm/Incident（HI-01D/01E·§3.86–§3.87）** | Health/Runtime/Sessions/Events/Alarms + Start/Stop/Release + failure/recovery + SSE/reload = BMD ACCEPTED；Alarm canonical projection + awareness-only ACK 已真机闭环；Routing/Switch/Redundancy actual-state 面 = PARTIAL/DEFERRED（→ REDUNDANCY-ENTRY-01）；长稳 = PR-STAB-01 IN PROGRESS；不做视觉大改版 | — | UI 不得本地假成功；完整 operator journey E2E |
| **MOTHER-ADAPTERS** | **BACKLOG** | `media-digital-*` compatible adapters / module integration | Standalone product works alone | 可拔除；VBMF 不依赖母平台启动/运行/恢复 |
| **FEDERATION/V0.3+** | **BACKLOG** | Multi-site、NDI/RIST/Zixi、PTP/Genlock、multi-node HA、WebRTC contribution | explicit V0.3+ authority | 必须走对应版本 Architecture/ADR，不改写 V0.2 frozen contract |

#### Work Packet minimum fields

任何交给 Pi / Claude Code / 其他 AI agent 的写任务，至少明确：`Task ID`、`Authority`、`allowed files/scope`、`forbidden scope`、`acceptance`、`verification environment`。Agent 不得自行从 BACKLOG 挑功能，不得把 executor exit 0 当 COMPLETE，不得自行改变 frozen Contract 或 `.project/STATE.md` 的 Authority 模型。任何 BACKLOG umbrella 在转 READY 前必须先拆成 bounded Work Packets。

## 6. Current Authority

优先级严格如下：

1. 用户最新明确指令 / Project Instructions；
2. 冻结 Architecture / Contract / ADR；
3. **本 `.project/STATE.md`**；
4. live canonical `main`；
5. 真实 code / tests / Runtime / hardware evidence；
6. `ROADMAP.md`、`PHASE_IMPLEMENTATION_MAP.md`、README、历史任务记录、旧聊天、Memory、历史分支 / PR。

Current Task 专项 Authority：用户 2026-09-20 指令（SE-01B-FIX bounded packet + RUNTIME-CONTROL-ENTRY-01 裁定）；`.project/STATE.md` §3.31–§3.67/§4–§5；A2-1 SwitchPolicy design/verify；RF-MASTER-01 plan/report；RF-NORM-01 spec、Phase A/Phase B report；RF-SRC-01 SRT blocker；RF-SRC-RTMP-01 两份 boundary plan；RF-SRC-RTMP-02 production boundary plan（含 §8 live-tree audit appendix + Implementation Invariants）+ closure reconciliation 报告；RUNTIME_RESOURCE_MODEL / RUNTIME_SESSION_MODEL / RUNTIME_BINDING_MODEL / MEDIA_BACKEND_CONTRACT §§1/1.1 P0-8/3/4；STANDALONE-ENTRY-01 planning（S1–S10 + 子包 + matrix）+ `STANDALONE_MEDIA_AGENT_OPERATIONS.md`（SE-01C 语义权威页·§4.3 已随 SE-01D 回改）+ SE 系列四份收口报告 + SE-01B-FIX reconciliation 报告。RH-CLOCK-01、RF-NORM-01、RF-MASTER-01、RF-SRC-RTMP-01、RF-SRC-RTMP-02（含 closure）已完成；**STANDALONE-ENTRY-01 全链 + RCE 全链（§3.68–§3.70）+ RCE-D3（§3.71）+ CONTROL-PLANE-ENTRY-01 planning（§3.72）+ CP-01A（§3.73）+ CP-01B（§3.74·RH-IDEM-01 已清偿）+ CP-01C（§3.75·Auth/RBAC/限流/审计硬化）+ CP-01D（§3.76·Event plane）+ CP-01E（§3.77·全栈/BMD 集成验收）均 COMPLETE——**CONTROL-PLANE-ENTRY-01 全链收口，无 READY packet**（deferred 项需新裁决）**；Product `/api/v1/*` 归 Fastify·经 internal `/internal/v1/agent`；不得擅自建设 Web Console/SDK/新 Runtime owner 或越过 §3.72 子包边界。

注意：该 Strategy 中形成于分支迁移前的 `master` baseline 描述属于历史证据；操作性命令中的 `--ref master` 等字面量已经因 Git Authority rename 产生迁移债务，P2-B 开工时必须先按 `main` reconciliation，不能把历史分支名重新解释成开发 Authority。

## 7. Verification Level

### Git / governance

- remote default branch `main`: **VERIFIED**
- remote `main` protected: **VERIFIED**
- 7 required contexts preserved: **VERIFIED**
- actual remote `master` ref absent: **VERIFIED**
- `main` migration preserved commit history: **VERIFIED at remote ref level**

### P2-A / P2-B infrastructure

- P2-A implementation: **COMPLETE**；runner parity / dual R Gate / dispatch evidence 已登记于 `db54d45…`。
- P2-B implementation: **COMPLETE / SOFTWARE VERIFIED** at `9d6df61c…`；GitHub Actions `34920528957` 7/7 required jobs PASS。
- P2-C historical preflight probes `34920607255` / `34920611254` / `34920615247` / `34920619055`：当时两台 runner 均被命中且 `rustc/cargo` 均 MISSING；该证据只描述 pin 前基线，当前状态以下列 host execution 证据为准。
- P2-C host-admin tooling：**IMPLEMENTATION COMPLETE / SOFTWARE VERIFIED** through `0f375c8…`；focused tests **41/41 PASS**；GitHub Actions `34934058858` / `34935730648` / `34947630667` / `34949135299` PASS。
- P2-C host route recovery：**VERIFIED**（encrypted probe + strict host-key match + BatchMode SSH + host-admin `sudo -n`）；原 missing-host-admin blocker 已解除。
- `vbmf-ci-01` system Rust 1.98.1：**HOST EXECUTED / FORMAL CURRENT-SHA CLOSURE VERIFIED（P2-C1 COMPLETE，§3.6）**——exact-SHA bundle checksum、幂等 pin 复跑、V1–V4 PASS、`vbmf-ci` manifest @2026-09-15T10:01:21Z、`verify-runner.sh` R1–R5+scope PASS；`vbmf-ci-02` system pin：**HOST EXECUTED / VERIFIED（P2-C2 COMPLETE，§3.7）**；双机 parity：**VERIFIED（P2-C3，§3.8；probe env 修正后两机逐字符 1.98.1 parity）**；`rust-format` self-hosted grayscale：**COMPLETE / CI VERIFIED（P2-C4，§3.9）**；`rust-clippy` self-hosted grayscale：**COMPLETE / HOST + CI VERIFIED（P2-D，§3.10；双机 V1–V5 含 clippy、run `35027740186` 7/7，`rust-clippy`→`vbmf-ci-02`）**；`session-lifecycle` self-hosted grayscale：**COMPLETE / CI VERIFIED（P2-E1，§3.11；run `35033319131` 7/7，`session-lifecycle`→`vbmf-ci-01`，50 passed/0 failed）**；`architecture-portability` self-hosted grayscale：**COMPLETE / CI VERIFIED（P2-E2，§3.12；run `35061944269` 7/7 首跑全绿，`architecture-portability`→`vbmf-ci-01`）**；`rust-test-matrix` self-hosted grayscale：**COMPLETE / HOST + CI VERIFIED（P2-E3，§3.13；双机 V1–V6 含 rustdoc、run 7/7 首跑全绿，`rust-test-matrix`→`vbmf-ci-01`，Doc-tests 0 failed）**；P2-M0：**ADJUDICATED（§3.14，裁决 B）**；`hardware-test-compile` media migration：**COMPLETE / CI VERIFIED（P2-M1，§3.15；run `35172539232` rerun 后 7/7，@vbmf-ci-media，SDK 16.0.0 host 预装）**；`gstreamer-build` media migration：**COMPLETE / CI VERIFIED（P2-M2，§3.16；run `35177980436` 7/7 首跑全绿，@vbmf-ci-media，artifact 12331677B，D1 窗口关闭）**。

### Software / Runtime

- RH-LC-01 Runtime implementation `c72ce5d…`：**IMPLEMENTATION COMPLETE / SOFTWARE VERIFIED / CI VERIFIED**。
- Development VM：`cargo fmt` PASS；mock lib **429/429** + integration **9/9 + 12/12**；default lib **246/246**；default/mock clippy `-D warnings` PASS。
- GitHub Actions `35279581145` @ `c72ce5d…`：**7/7 required jobs PASS**，含真实 `gstreamer-build --features bmd,gstreamer` 与 `hardware-test-compile`。
- 既有 RH-BUS hardware evidence 只证明其 exact commits；不得继承到 `c72ce5d`。
- RH-RES-01A `0718757…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；Resource 7/7、Session resource 6/6、mock 432/432 + integration 9/9+12/12、default 248/248、fmt/clippy PASS；Actions `35293309933` 7/7 PASS。
- RH-RES-01B `fb8bc81…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；mock 433/433 + integration 9/9+12/12、default 249/249、fmt/clippy PASS；Actions `35293860197` 7/7 PASS。
- RF-FF-01A `0dd37bc…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused src_props 7/7 + Persistent 2/2；mock 435/435 + integration 9/9+12/12；default 251/251；fmt/clippy PASS；Actions `35296461203` 7/7 PASS。Dev VM bmd,gstreamer local check 因 system pkg-config dev libs 缺失未完成，由 vbmf-media CI + BMD native build 补齐。
- RF-FF-01B exact `4ad8135…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused lifecycle 8/8 + 1 ignored real-binary smoke；ffmpeg-backend 261 pass + 1 ignored；default 252/252；mock 436/436 + integration 9/9+12/12；fmt + ffmpeg-feature clippy + diff-check PASS；Actions `35313253516` 7/7 PASS。
- RF-FF-01C exact `ffee3a0…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused ffmpeg_rt_02 5/5；ffmpeg-backend 266 pass + 1 ignored HW；default 252/252；mock 436/436 + integration 9/9+12/12；fmt/clippy/diff + architecture lint/remove-adapters PASS；Actions `35339165383` 7/7 PASS（含 media runner bmd-provider+ffmpeg-backend no-run compile）。
- RF-FF-01D exact `dd0eb8c…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused 6/6；Session focused mock 31/31；default 258/258；mock 436/436 + integration 9/9+12/12；ffmpeg-backend 272 pass + 1 ignored HW；fmt + default/mock/ffmpeg clippy + diff-check + architecture/remove-adapters PASS；Actions `35342501850` 7/7 PASS。
- RF-FF-01E final exact `96f8055…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused factory 3/3；parent implementation full regression ffmpeg 275+1 ignored HW / default 258 / mock 443 + 9/9+12/12，final fix focused+clippy/fmt/diff PASS；Actions `35344678284` 7/7 PASS（含 bmd-provider,ffmpeg-backend compile）。
- RF-FF-01F exact `f868420…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；default 261/261；simulation 261/261；mock 446/446 + integration 9/9+12/12；ffmpeg-backend 278 + 1 ignored；fmt/clippy/architecture/remove-adapters PASS；Actions `35356652348` 7/7 PASS。
- RF-FF-02 exact `a2715b3…`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused 4/4；ffmpeg-backend 282 + 1 ignored；default/simulation 261/261；mock 446/446 + integration 9/9+12/12；fmt、clippy、architecture/remove-adapters、diff-check PASS；Actions `35375536871` 7/7 PASS。
- RF-FF-03 exact `c03976d61a2166b6bcd4260c17801567a9f90354`：**IMPLEMENTATION COMPLETE / SOFTWARE + CI VERIFIED**；focused 4/4；ffmpeg-backend 282 + 1 ignored；default/simulation 261/261；mock 446/446 + integration 9/9+12/12；fmt、clippy、architecture/remove-adapters、diff-check PASS；Actions `35379282990` 7/7 PASS。

### Hardware

- RH-LC-01 exact `c72ce5d` 已生成并复制 BMD `/tmp` archive（sha256 `78de0709…50fdeb9`），manifest v5 MD5 `7521d17e…43dd` 已核对；现存 output device-number 2 未触碰。
- 当前远程 exact-commit build/runtime smoke 命令被工具安全层拦截，故 **RH-LC-01 BMD runtime/hardware smoke = DEFERRED**；不得写成 verified。
- RH-RES-01A 未修改 DeckLink/GStreamer adapter、Pipeline backend 或媒体数据面；**BMD runtime/hardware smoke = NOT REQUIRED**，也不得写成 hardware verified。
- RH-RES-01B 仅 constructor ownership representation；**BMD runtime/hardware smoke = NOT REQUIRED**。
- RF-FF-01A exact `0dd37bc…`：**BMD HARDWARE VERIFIED**；exact archive sha256 `d9ec96bd…514401`，manifest MD5 `7521d17e…43dd`，native bmd,gstreamer build PASS，Dual Input Gate 10/10 + rc=0；input 0/1 production binding 2/2；device 2 PID 992634 before/after 未变。
- RF-FF-01B exact `4ad8135…`：**BMD RUNTIME SMOKE VERIFIED / DECKLINK HARDWARE NOT EXERCISED**；archive sha256 `90c11f79…2eca0`；BMD real ffmpeg SelfTest 1/1 PASS；lavfi→null only；output device-number 2 PID 992634 before/after unchanged。
- RF-FF-01D exact `dd0eb8c…`：**BMD HARDWARE VERIFIED**；archive sha256 `e622f083…549875`，manifest MD5 `7521d17e…43dd`，native bmd,gstreamer build PASS，Dual Input Gate 10/10 + rc=0；L1–L5/recover/teardown PASS；output PID 992634 before/after unchanged，leftover NONE。
- RF-FF-01C exact `ffee3a0…`：**BMD HARDWARE VERIFIED**；archive sha256 `384d7987…22e7`；authorized input `46:00000000:002e4500` direct frame probe 50 frames/2.00s/25fps rc=0；VBMF real DeckLink lifecycle 1/1 PASS（start→recover→stop）；FFmpeg leftover NONE；output PID 992634 unchanged。
- RF-FF-01E exact `96f8055…`：**BMD HARDWARE VERIFIED**；archive sha256 `88040061…8561d`；production composition construction no-auto-start PASS；real SessionManager→FFmpeg create/Leased→start/Running/backend-alive/Resource Allocated→stop/Released/Resource Available/Lease NONE→close PASS，gate rc=0，FFmpeg leftover NONE；output PID 992634 unchanged。
- RF-FF-01F exact `f868420…`：**BMD HARDWARE VERIFIED**；archive sha256 `3ae7c8a…cf63e`；manifest MD5 `7521d17e…43dd`；target `46:00000000:002e4500`；real child SIGTERM→canonical failure→Supervisor Recovered→new child→stop/close teardown，Released/Available/Lease NONE/monitor exited/orphan NONE；output device-number 2 untouched；evidence `evidence/bmd-10.30.15.10/2026-09-18-rf-ff-01f-recovery/`。
- RF-FF-02 exact `a2715b3…`：**BMD HARDWARE VERIFIED**；archive sha256 `fd36c119…dab25`；manifest MD5 `7521d17e…43dd`；target `46:00000000:002e4500` / manifest device-number 0；HLS `index.m3u8` + `seg00000.ts` with h264/aac；old child `3400656` → new child `3400805`；Released/Available/Lease NONE/monitor exited/orphan NONE；output device-number 2 untouched；evidence `evidence/bmd-10.30.15.10/2026-09-18-rf-ff-02-ffmpeg-egress/`。
- RF-FF-03 exact `c03976d61a2166b6bcd4260c17801567a9f90354`：**BMD HARDWARE VERIFIED**；archive sha256 `24e4b5abc7000e4ab962e2e68ba0f54275c56c00da2cae01d339a24426073007`；binary sha256 `2b8beacb…c7ecaa`；manifest MD5 `7521d17e…43dd`；target `46:00000000:002e4500` / device-number 0；loopback sender/receiver initial + recovery h264/aac；PID `3403465→3403611`；Released/Available/Lease NONE/monitor exited/orphan NONE；output device-number 2 untouched；evidence `evidence/bmd-10.30.15.10/2026-09-18-rf-ff-03-ffmpeg-rtmp-egress/`。
- RF-SRC-RTMP-02 closure reconciliation exact `d13f1fd…`：**COMPLETE / SOFTWARE + CI + BMD HARDWARE VERIFIED（严格 D10 进程级·§3.60）**；focused mode 6/6 + closure 3/3 + tg2 4/4 + rf_ff_01e 3/3；default 324/324；simulation 324/324；mock 536/536；ffmpeg-backend 359+1 ignored；clippy×3/fmt/check/architecture/remove-adapters/diff-check PASS；CI `35487255383` 7/7。BMD：archive `7f242a25…`；binary `3d784e2a…`；4 次 gate 运行 device 行=0；loopback/Tier 1（`LISTEN 10.30.15.10:19350` 显式 LAN）/Tier 2（`ESTAB ← 172.17.0.2` 独立 netns）全 PASS，含 D10 startup/teardown 机械断言与 manifest 字节不变；device-2 PID 992634 全程存活；零残留；UFW 已回收。
- SE-01A exact `e3e7fe4…`（含 `eb49718` shutdown 实现）：**COMPLETE / SOFTWARE + CI + BMD RUNTIME SMOKE VERIFIED（无媒体会话·§3.62）**；CI `35489924796` 7/7；BMD 真实 production binary（archive `c715d373…`·binary `82abccb3…`·ffmpeg-backend）：零设备行为行、`/health state:Ready devices:0`、SIGHUP 存活+warn、SIGTERM exit 0+drain+complete、零残留、device-2 未触碰。附注：`9067989` CI `35487902795` rust-test-matrix FAIL（测试 env 泄漏 flake，`e3e7fe4` 修复——如实立档）；`eb49718` CI `35489769503` 7/7（该调度未复现泄漏）。
- SE-01C（docs-only）：**COMPLETE / CI VERIFIED（§3.63）**；零 Runtime 代码改动、/health wire 零变化；code-to-doc cross-check（env 枚举逐项对表）+ /health 既有测试回归（default 324/324·mock 536/536·ffmpeg-backend 361+1 ignored @ `777319f`）+ architecture lint + remove-adapters PASS；CI 行见本节 gates 加固行之后的提交链。如实披露：`scripts/check_docs.py` 本 VM 病态挂起（既有孤儿进程），未作门禁、不在 7 个 required context 内。
- SE-01D exact `6932d5e…`：**COMPLETE / SOFTWARE + CI + BMD RE-PIN VERIFIED（§3.64）**；6 项解析回归 + 两类 pin 锚定；default 332/332·simulation 332/332·mock 547/547·ffmpeg-backend 367；clippy×4/fmt/architecture/remove-adapters PASS；CI run `35492879328` **7/7 required PASS**。BMD：archive `4c79b0d5…`·binary `491942be…`/`30661ab3…`；全部 leg 无 `VBMF_MACHINE_ID`——network loopback gate rc=0（manifest 由 /etc/machine-id pin 且生产 loader 载入）+ production binary network/device 正 pin（/health Ready·SIGTERM exit 0）+ 负 pin exit 2 mismatch；device-2 未触碰、零残留。
- SE-01B exact `0228849…`（工件 `50a12fa…`）：**COMPLETE / CI + BMD DEPLOYMENT VERIFIED（§3.65·§6 矩阵 6/6）**；CI `35493350858`/`35493444527` 均 **7/7**。BMD：`/opt/vbmf` 双版本（release binary `fd2412d2…` 跨版本一致=确定性）+ 原子 `current` + digest fail-closed 切换；service start→`/health Ready devices:0`、SIGTERM→`ExecMainStatus=0`、重启再 ready；外部 netns 第三方推流经已安装树 gates binary（source/recovery 3498005→3498287/teardown/D10 `manifest_bytes_unchanged=true`）；device 模式 Ready·devices:3·exit 0；UFW 临时规则删除复核；device-2 PID 992634 全程存活；`/opt/vbmf-dev` 未触碰；终态 unit inactive 未 enable。
- RF-SRC-RTMP-02 gate 路径加固 exact `06e272c…`（Mimosa L2 停钩复查处置·§3.60 增补）：**COMPLETE / CI + BMD GATE RE-RUN VERIFIED**；CI run `35490384322` **7/7 required PASS**（media-runner `bmd-provider,ffmpeg-backend` no-run 编译 = 本模块 type-check 权威）；BMD native build + loopback gate leg rc=0（D10 startup/teardown + `manifest_bytes_unchanged=true` + 零残留）。
- RF-SRC-RTMP-02 gate fixture symlink 窗口关闭 exact `777319f…`（用户边界复查处置·§3.60 增补 2）：**COMPLETE / CI + BMD TEST+GATE RE-RUN VERIFIED**；CI run `35492035651` **7/7 required PASS**；BMD native build + focused path tests **7/7 PASS** + loopback gate leg rc=0（D10 startup/teardown + `manifest_bytes_unchanged=true` + 零残留 + device-2 未触碰）。
- 后续涉及 DeckLink/GStreamer/FFmpeg/SRT/switch/timing/failover 的 Runtime 变更仍必须按任务范围重新做 BMD exact-commit verification。

### Stability

**NOT VERIFIED / verification debt remains.**

PR-STAB-01 当前口径（§3.88 reconciliation + §3.90/§3.91 2h/8h PASS + §3.92 24h FAIL/RCA）：

- ec5fc68 **PRE-HI RUNTIME BASELINE**：2h PASS 10/10（§3.87）+ **8h PASS 10/10（§3.88 收口登记·2026-09-30·rss +27.5MB gate 内）**；24h NOT RUN（runtime source advanced at `309c3e1`）——保留作 regression/comparison evidence，**不证明 current main stability**；旧 baseline ladder 已终账关闭；
- `3c13b59` ladder：**2h PASS + 8h PASS + 24h FAIL 9/10**（§3.90–§3.92；唯一失败 `rss_bounded` +86.6MB）固定为 failure baseline；§3.93–§3.94 observer-backpressure fix exact Runtime=`6fc1b1a` / binary=`3898ced3…` 已开始新 ladder，**2h IN PROGRESS**，后续同 binary 8h→24h；当前 stability 仍 **NOT VERIFIED**。

已登记 Step 15 历史：

- 2h rung PASS；
- 首次 8h 因 S15-E01 evidence bookkeeping race FAIL；
- S15-E01 fix3 后 8h rerun PASS 10/10；
- fix3 后 24h rung **FAIL 9/10**，唯一失败 `rss_bounded`：首/末 1/3 均值约 `+86.6 MB`，超过 `+50 MB` 门槛；
- B1-DIAG 将增长分类为 `ANON_GROWTH`；后续 C1/C2/O1/O2/O3-0 + E2/E3A（2026-09-17
  恢复登记·§3.17）已继续缩小 RCA：双输入/program graph/切换/make_mut/selftest
  源族路径均排除为必要条件，DeckLink 源族配置为必要条件之一，候选空间收敛至
  「每输入 DeckLink 源族 ingest native 分配链 × allocator reservation/arena
  行为」；allocation-path/allocator-behavior 两环未证，root cause 未定。但 main
  上尚无经完整回归 + 新 24h rung 证明关闭该债务的最终结果。
- RH-BUS-01（2026-09-17·§3.20）：software focused 2/2 + full gstreamer 268/268 PASS；BMD exact `9b32004` 双输入 E4 同快照 handle1/2 `bus_msgs_total=65/65`，stop_session teardown 完整；CI `35214894696` 7/7 PASS。
- RH-BUS-02（2026-09-18·§3.21）：Runtime commit `92d6007`；focused 12/12 + full gstreamer 278/278 PASS；BMD dual-input 10/10 + production group-watchdog Bus `65/65` + stop/release 完整；current-tree CI `35248227420` 7/7 PASS。
- STAB-O4 E4-1（2026-09-17·§3.18）：pad 可见分配流全稳 + 批触不在 pad 面
  （两离散台阶 +5588/+5588kB·一台阶/输入·既有预留内 page-commit·第五次复现）
  ⇒ FIX 判定 NO-FIX-IN-REPO·ladder 不触发——该 FAIL 债务在现证据下无 repo 侧
  可修路径，维持立档直至外部变量（SDK/插件版本）变更后重开。

因此不得写成“24h stability verified”。

## 8. Risks / Blockers

### Active risks

1. **24h RSS stability debt + exact-commit 纪律**：历史 `rss_bounded` FAIL 尚未由新 24h rung 关闭；ec5fc68 2h/8h 仅属 PRE-HI baseline。**current-main 2h+8h 已 PASS 10/10 @ exact Runtime `3c13b59`（§3.90/§3.91·8h rss +27.6MB < +50MB gate）**，24h 正在同一 binary 上运行（2026-10-02 启动·IN PROGRESS）；Runtime freeze window 继续生效，24h PASS 前不得写 stability verified。
2. **P2-C toolchain prerequisite — CLOSED**：双机 exact 1.98.1 pin + current-SHA 收口 + parity re-probe 全部完成（§3.6/§3.7/§3.8）。P2-C4 迁 `rust-format.runs-on` 前置满足；self-hosted job env 必须带显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`（§3.6 RCA，probe 已实证不带则报错）。
3. **shared physical failure domain**：`vbmf-ci-01` 与 `vbmf-ci-02` 同 devbox 物理故障域，只提供维护冗余/并发/parity，不等价于物理 HA。
4. **BMD deployment divergence — RECONCILED（2026-09-29·PR-01B·§3.85）**：`/opt/vbmf/current -> 0.1.0-885b766`（live main @ PR-01A 收口），exact provenance 六环链 + 全栈旅程 + rollback/forward 验收完成；`/opt/vbmf-dev/repo`（7cc33dd 未提交 ops 改动）仍未触碰（保育，非 Authority）。后续 main 推进后仍须按 PR-01B 模式重新对账，hardware evidence 不跨 commit 继承。
5. **BMD device occupancy**：历史手工 `gst-launch ... decklinkvideosink device-number=2` 仍在运行；RH-BUS-01 已证明可在不扰动该输出的前提下只使用 manifest 输入 `0/1` 完成验收。后续若任务需要输出卡 2，仍须先归属确认/受控释放，禁止抢占。
6. **closed PR #31 / branch convergence**：PR #31 已随 2026-09-15 分支收敛关闭（head 分支已删）；它从来不是 canonical development Authority；未来若吸收 standalone product baseline，按 closed PR #31 做 main-relative scope audit/reconciliation，不恢复任何分支。
7. **historical local edit provenance**：旧 STATE 记录的另一 checkout 未提交 `DEPLOYMENT_AND_DEV_RUNTIME.md` 修改未出现在当前新 checkout；原工作区未重新取得前不可判定其去留。
8. **runner 出网抖动 / codeload — MITIGATED + VERIFIED（2026-09-18）**：历史故障窗与失败证据继续保留；RH-BUS-02 收口期再次确定性复现 `codeload.github.com` Action archive HttpClient 100s×3 timeout，证明“失败后 rerun”不足。已升级为两层缓解：git checkout/fetch 继续使用 host system git proxy；Action setup 主路径改用 GitHub Runner 官方 `ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE`，workflow external Actions 全 pin immutable SHA。三台 runner maintenance + probe 均通过：media `35247466755/35247550654`，general `vbmf-ci-01` probe `35248095276`、`vbmf-ci-02` probe `35248099277`（后者 direct mode 亦 cache 4/4 PASS）；current-tree required run `35248227420` **7/7 PASS**。loopback HTTP proxy 仅保留 cache maintenance/miss fallback；继续观察但不再是 Current Task blocker。
9. **RF-SRC-RTMP-02 closure gaps — CLOSED（2026-09-19·§3.60）**：production bin Network-only 模式选择 + gate 先于 common bootstrap dispatch 已落地（`d13f1fd`）；BMD TG-6R 以严格 D10 进程级证据（4 次 gate 运行 device 行=0 + gate 内机械断言）重验通过。
10. **SE-01B closure defects — CLOSED（2026-09-20·§3.67）**：StartLimit 移 `[Unit]`（BMD verify 零 warning + 3 次 exit 2 → start-limit 实证）；exact-SHA provenance 六环链核验；staging 原子性（VM matrix 37/37 + BMD 拒绝矩阵）。STANDALONE-ENTRY-01 恢复全链 COMPLETE。
11. **PortId derive 键碰撞（direction/Analog 位折叠缺失）— CLOSED（2026-09-25 关闭）**：BMD Device smoke 实证同卡 `Input/Sdi/Known(1)` 与 `Output/Sdi/Known(1)` 碰撞 ×2（`port.rs` warn；证据 `se01b-device-smoke.log` L9/L10）→ §3.78 closure：物理 jack 槽位忠实枚举（in 1..N, out N+1..N+M）+ jack 级 capability 证据 + PortId invariant guard（test/debug panic, release log+continue）；BMD 双重启验收零碰撞 warning，`authorized_ports=2` 唯一；CI 8/8 SUCCESS @ `a0d6fa9`。剩余：双工卡 out jack 显式声明需 Resolver 端口级 binding 演进（独立 packet）。

### Current blockers

- P2-B: **NONE / COMPLETE**.
- P2-C/P2-D/P2-E/P2-M0/P2-M1/P2-M2: **NONE / COMPLETE（§3.6–§3.16）**；**Phase 2 灰度阶梯全部走完**。`vbmf-ci` service account 继续无 generic sudo/root；禁止 job-local rolling `stable` 或绕过双机 parity。
- STAB-O3.1: **NONE / COMPLETE（§3.17）**。
- STAB-O4/FIX: **NONE / COMPLETE（§3.18）**。
- RH-BUS-01: **NONE / COMPLETE（§3.20）**。
- RH-BUS-02: **NONE / COMPLETE（§3.21）**。
- RH-LC-01: **NONE / COMPLETE（§3.22）**。
- RH-RES-01A: **NONE / COMPLETE（§3.23）**。
- RH-RES-01B: **NONE / COMPLETE（§3.24）**。
- RF-ENTRY-01: **NONE / COMPLETE（§3.25）**。
- RF-FF-01A: **NONE / COMPLETE（§3.26）**。
- RF-FF-01B: **NONE / COMPLETE（§3.27）**。
- RF-FF-01C: **NONE / COMPLETE（§3.28）**。
- RF-FF-01D: **NONE / COMPLETE（§3.29）**。
- RF-FF-01E: **NONE / COMPLETE（§3.30）**。
- RF-FF-01F: **NONE / COMPLETE（§3.31）**；post-01F adjudication **COMPLETE / single-input slice accepted（§3.32）**。
- RF-FF-02: **NONE / COMPLETE（§3.34）**；当前无 implementation blocker，下一步回到 bounded packet selection。
- RF-SRC-RTMP-02: **NONE / COMPLETE（含 closure reconciliation·§3.60）**。

## 9. Verification Debt

- 24h stability：旧 FAIL 不得被短跑或诊断 run 覆盖；`3c13b59` ladder 以 24h `rss_bounded` +86.6MB FAIL 固定为 failure baseline。§3.93 repo-side 最小修复已实施，**因 Runtime source 改变，必须以本修复 exact commit/binary 在 BMD 重新 2h→8h→24h 原 gate**；当前 STABILITY VERIFIED 仍 BLOCKED，需绑定 source commit / binary hash / BMD environment / hardware / scope。
- branch rename hygiene：**P2-B CLOSED**；workflow/runbook 操作性路径已统一 `main`，required context 名称未变。
- P2-C/P2-D/P2-E：全部收口（§3.6–§3.13）。fork `runs-on` 分支未 live 实测（无现成 fork PR），已在 §3.9 登记残余风险与核验口径。
- runner 出网稳定性：codeload 缓解已从 rerun 升级为 immutable Action archive cache，并已在 general×2 + media×1 probe 及 required CI `35248227420` 7/7 验证；残余仅为持续观察 archive cache miss/Action SHA 更新流程，不再是未实施 Verification Debt。
- Development agent：Pi/Claude Code 项目级 auth + real model smoke 已 PASS；Claude project trust PASS；后续长写任务优先用 `_shared` runner + tmux，不再登记 agent smoke debt。
- BMD：RH-BUS-01 exact `9b32004`（§3.20）与 RH-BUS-02 exact `92d6007`（§3.21）均已有独立 hardware evidence；RH-LC-01 exact `c72ce5d` archive/manifest 已准备但 runtime smoke 因当前工具通道限制 **DEFERRED**。实际 `/opt/vbmf-dev/repo` deployment 仍落后且带未提交 ops 改动，未做破坏性同步。RF-SRC-RTMP-01 已在 §3.49 完成 BMD source-side loopback/recovery/teardown 与 output safety evidence；仍不得触碰 output device-number 2。
- RF-FF-01B BMD runtime smoke 已在 exact `4ad8135` 真实 FFmpeg 上验证但未触碰 DeckLink；RF-FF-01C exact `ffee3a0` 已完成 adapter-level DeckLink parity；RF-FF-01D exact `dd0eb8c` 已完成 GStreamer dual-input 10/10 regression；RF-FF-01E exact `96f8055` 已完成 production SessionManager→FFmpeg lifecycle hardware acceptance；RF-FF-01F exact `f868420` 已独立完成 real child termination→canonical failure→Supervisor recovery→new child→teardown evidence。
- PR #31：已随分支收敛 CLOSED；若未来吸收 standalone product baseline，必须先按 closed PR #31 做 main-relative scope audit/reconciliation，不恢复 feature 分支 Authority。
- RF-SRC-RTMP-02 deferred ingress risks（2026-09-19 冻结时登记，plan §3；TG-0 探针观察已并入·§3.52）：RTMP 握手超时（空闲/恶意半连接可长期占用唯一 listener slot）——TG-0 实证 RTMP `-timeout`（等待来连上限）存在，但 post-accept 握手/空闲连接超时选项**未观察到**、非法 publisher 占用唯一 `(protocol, ip, port)` listener、高流速 FFmpeg stderr 排空成本、进程退出顺序（kill/wait/reader join/socket 释放不得泄漏）。BMD FFmpeg 若无法提供对应控制**不阻塞**实现包，但 BMD 验收报告必须逐项标注（含"未观察到限制"也要显式记录）并留档于本节；主机防火墙仅为部署建议，绝不替代 VBMF 内部授权、不得如此上报。
- RF-SRC-RTMP-02 D10 strict evidence — **CLOSED（2026-09-19·§3.60）**：`d13f1fd` 上 4 次 gate 运行进程级零设备行为（0 行 discovery/lease/adapter/SDK probe）+ gate 内 D10 机械断言 + BMD TG-6R Tier 1/Tier 2 同 SHA 重验全 PASS。
- `scripts/check_docs.py` 本 VM 病态挂起（Sep14/17 起即有孤儿进程；SE-01C/§3.63 起登记）：不作为门禁执行、不为绿灯杀未知归属进程、不冒充该门禁已运行；修复该脚本执行环境属独立 debt，非 SE-01B-FIX 范围。
- ~~WEB-CONSOLE-ENTRY-01 BMD Runtime acceptance DEFERRED~~ — **CLEARED（2026-09-29·§3.82）**：exact commit `dc780c8` 真机全旅程验收 PASS，升级 BMD RUNTIME ACCEPTED。
- WEB-CONSOLE-BMD-ACCEPTANCE-01 衍生登记（非阻塞）：Web Console 长稳（>本包单次旅程时长）、多 sink kind（当前 UI Start 固定 appsink 采集形态）、意图构造器对 rtmp/self_test source 的 UI 暴露——均属后续 UI/SDK packet 范围，不在本债内核。

## 10. Cold-Start Handoff

新 Chat / Work 必须按以下最小链恢复，不重新扫描整个仓库：

1. 读取 Project Instructions；
2. 确认仓库 `pwl1987-dev/vbmf`（2026-09-29 transfer 自 `pwl1987/VBMF`·§3.81；旧地址重定向非 Authority）、默认分支和 canonical branch 都是 `main`；
3. 读取 live `main` HEAD；
4. 读取本 `.project/STATE.md`；
5. 找到“包含当前 STATE 版本的 commit”，比较 live HEAD 是否有更新；若有，只 reconcile STATE 之后的新 commits；
6. 读取 **Current Task = PR-STAB-01 FIX VERIFICATION ACTIVE（§3.93–§3.94：observer-backpressure fix exact Runtime=`6fc1b1a` / binary=`3898ced3…`；Development + exact-head CI + BMD build PASS；新 2h rung IN PROGRESS）**——SDK-ENTRY-01、PR-01A/PR-01B、HEALTH-INCIDENT-ENTRY-01、RD-01A planning-only 均已 COMPLETE；当前链 = 新 2h→8h→24h → STABILITY VERIFIED 后才可 RD-01A implementation；Runtime freeze window 继续生效；
7. 核对 P2-C implementation chain through `0f375c8…`、maintenance failure `34921727757`、encrypted route probes 与最新 `media-agent CI`（P2-M2 后 `gstreamer-build` 应 @vbmf-media 且 artifact 非空）；
8. 读取 §5.1 Task Queue，只执行当前 Phase 第一个可执行项；既有 Runtime/Standalone/Control-Plane/Web/SDK/Health-Incident 完成项不得回退；RF-SRC-01 继续因 SRT capability 缺失 BLOCKED；**当前唯一执行链 = PR-STAB-01 24h FAIL 9/10 → failure-first RCA（§3.92）→ 可证修复后重跑受影响 stability ladder，或 NO-FIX-IN-REPO / dependency-upgrade / production-acceptability 裁决 → 只有 STABILITY VERIFIED 后才可 RD-01A implementation**。RD-01A planning-only 已完成但 Runtime 实施仍被 freeze window 阻止；PORT-COLLISION-01 等 BACKLOG 不越级；
9. 不回退到已经 COMPLETE 的 0.6 / 0.7 / A2-8 / P2-A；
10. 不从历史 feature/fix/实验 branch 恢复开发；所有验证通过的改动直接推进 `main`；
11. 完成独立任务后，同一轮更新本 STATE 的 Last Completed / Current Task / Next Task / verification / risks / debt / handoff；
12. 当前标准 Development VM checkout 应直接观察 working tree；只有执行环境确实失去该 checkout 可见性时才使用 `Local Working Tree: NOT OBSERVABLE`。

### Expected cold-start conclusion at this state

在 live `main` 没有比本 STATE 更新的实质提交时，正确恢复结果应是：

- Git Authority 已完成 `master → main`；
- state system 已初始化；
- P2-A 已完成；
- P2-B 已完成并经 Actions 7/7 PASS；
- **Phase 2 全链完成**：P2-C–P2-E、P2-M0–P2-M2 收口（§3.6–§3.16）；7 required job 全部 self-hosted 条件灰度（5 general + 2 media），GitHub-hosted 仅余 fork 回退；
- **STAB-O3.1 已收口**（E2/E3A 恢复登记 + INCONCLUSIVE-at-allocation-path + 候选空间收敛·§3.17）；
- **STAB-O4/FIX 已收口**（§3.18：E4-1 观测完成 + NO-FIX-IN-REPO·ladder 不触发·24h FAIL 立档）；
- **RUNTIME-HARDEN immediate gates 已完成（§3.20–§3.24）；Runtime Features entry review + RF-FF-01A/B/C/D/E/F、post-01F adjudication、RF-FF-02 HLS、RF-FF-03 RTMP 单输入 egress/recovery、RH-CLOCK-01、RF-NORM-01 Phase A/B、RF-MASTER-01、RF-SRC-RTMP-01 已完成（§3.25–§3.49）；RF-SRC-01 因 SRT capability 缺失 BLOCKED；**RF-SRC-RTMP-02 COMPLETE（TG-0…TG-6 + closure reconciliation 全 PASS·§3.52–§3.58 + §3.60·含严格 D10 进程级 BMD 重验 @ `d13f1fd`）**；STANDALONE-ENTRY-01 全链完成（含 SE-01B-FIX reconciliation·§3.66–§3.67）；**RUNTIME-CONTROL-ENTRY-01 全链完成 + RCE-D3 reconciliation（§3.71）+ CONTROL-PLANE-ENTRY-01 planning 冻结（§3.72）+ CP-01A/01B/01C/01D/01E 收口（§3.73–§3.77）——全链 COMPLETE，无 READY packet**；当前仍不能扩展 Network umbrella/Program multi-input/Output expansion 或 24h stability**；
- Runtime / Web 新业务功能当前不应越过 §5.1 queue 推进；Runtime 写入面在新 stability ladder 期间冻结（§3.88 并行边界）；
- PR-STAB-01：ec5fc68 旧 baseline 已终账（PRE-HI 2h+8h PASS，24h NOT RUN）；**current-main 2h+8h PASS、24h FAIL 9/10 @ exact Runtime `3c13b59` / binary `e5b2e73b…`（§3.90–§3.92；唯一失败 rss_bounded +86.6MB）**；
- 24h RSS stability 仍是明确 verification debt，不能宣称 stability verified——须 current-main 新 ladder 2h+8h+24h 全 PASS 并绑定 exact commit/binary/environment 后方可。
