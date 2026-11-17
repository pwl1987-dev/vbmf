# 目标

完成 STATE §5.1 Task Queue 第一个 READY Work Packet **P2-C1**：`vbmf-ci-01` current-SHA 正式收口（coordinator 确认 SHA `b0f5df3b215c536b598aed7938079572edf87395` 的 §15.9 bundle，经既有 out-of-band host-admin 通道完成 checksum、幂等 pin 复核、V1–V4 正式 verify、`vbmf-ci` manifest 刷新，管理机只读收口验证），并把 agent 分工契约（强模型指挥 / Pi 执行）落盘进 `AGENTS.md`；全部证据登记 `.project/STATE.md`，P2-C1 置 COMPLETE、P2-C2 置 READY。

# 范围

1. 步骤 A（Development VM / 本 checkout）：`scripts/ci/prepare-system-rust-bundle.sh --repo <repo> --sha b0f5df3b215c536b598aed7938079572edf87395 --out <安全空目录>` 导出 byte-exact 三脚本 + `SHA256SUMS`，记录 `BUNDLE_SOURCE_SHA` 与 checksums 为 evidence。
2. 步骤 B（`vbmf-ci-01` 宿主机，经既有 out-of-band host-admin 通道，§15.9 顺序）：
   - `sha256sum -c SHA256SUMS` 全 PASS；
   - 幂等复核：正式 bundle 中 `pin-system-rust.sh --version 1.98.1` 原样重跑，0 退出、版本不变；
   - 正式 verifier：bundle 中 `verify-system-rust.sh --expect-version 1.98.1` V1–V4 全 PASS（RESULT: PASS）；
   - manifest：`sudo -u vbmf-ci "$BUNDLE_DIR/collect-toolchain.sh" --name vbmf-ci-01`；
   - 清理 bundle 临时目录。
3. 管理机只读收口：`scripts/ci/verify-runner.sh --name vbmf-ci-01`（R1–R5 + scope，期望 RESULT: PASS）。
4. 分工契约落盘 `AGENTS.md`：在 "Agent execution" 节新增 coordination tiering 三条（强模型 = coordinator：dispatch/packet 设计/review/verify/STATE 转正；Pi = 默认 executor，覆盖 bounded 机械与大部分模式化编码；executor 不写自己的调度契约，STATE/evidence 只能以显式 packet 出草稿、coordinator 复核转正）。措辞随 Build 落地时与文件现有英文风格一致；只加不改既有行。
5. Evidence + STATE 更新：bundle SHA/checksums、host1 各步结果、manifest 摘要、verify-runner 结果、分工契约落盘结果登记入 `.project/STATE.md`（P2-C1 → COMPLETE，P2-C2 → READY），随本 change 在 `main` 直接提交。

## Source coverage

来源：用户 2026-09-15 `/comet` 完整进度梳理与任务队列落盘报告（SR）+ 后续追加指令（SI）。逐条覆盖：

| 来源条目与位置 | 读取状态 | 需要保留的内容 | Spec 位置 | 验收 ID | 覆盖状态 | 理由或替代关系 |
| --- | --- | --- | --- | --- | --- | --- |
| SR-0 当前基线（live main `b0f5df3`、CI `34949135299` SUCCESS、P2-C 进行中、STATE 漂移已修正） | complete | 基线事实作为前提 | specs/ci-runner-rust-pin-host1/spec.md 前提节 | — | background | 环境事实，非交付物 |
| SR-三 P2-C-1 `vbmf-ci-01` 正式收口（5 项待办） | complete | 5 项待办全部实施 | spec §1–§4 | A1–A5 | covered | 本 change 主体 |
| SR-三 P2-C-0 STATE reconciliation | complete | 不做 | — | — | superseded | 已由 `b0f5df3` 完成 |
| SR-三 P2-C-2/3/4 | complete | 不做 | — | — | non-goal | 后续 Work Packet |
| SR-四 P2-D/P2-E/P2-M；SR-五 STAB-1 | complete | 不做 | — | — | non-goal | 后续队列/独立债务线 |
| SR-一/二 能力层总览与已完成清单 | complete | 不重做 | — | — | non-goal | 完成态登记，防倒退 |
| SR-六~十七 Runtime/Backend/Web/SDK 缺口清单 | complete | 不做 | — | — | non-goal | BACKLOG umbrella |
| SR-十八 执行顺序（0→15） | complete | 本 change = 第 1 步 | spec 目标节 | A1–A5 | covered | 顺序权威已被 STATE §5.1 吸收 |
| SR-末段 治理落盘报告（Task Queue、AGENTS.md 契约、并发进程/working tree 注意事项、下一 Work Packet = P2-C1） | complete | 执行约束：不动并发 agent 未提交文件 | spec 约束节 | — | background | 环境约束 |
| SI-1（2026-09-15 追加）"能力强的模型干指挥工作，落盘" | complete | coordination tiering 落盘 AGENTS.md | spec §5 | A6 | covered | 用户明确指令 |
| SI-2（2026-09-15 追加）"落盘工作是否分配给 pi" | complete | 不分配 | spec §5 | — | background | 已裁决：契约由 coordinator 写（循环授权 + 判断性工作），`_shared/README.md` 已先行更新（commit `93a6451`） |
| SI-3（2026-09-15 追加）"单人开发，不要分支，开发分支就是主分支，全部收敛分支" | complete | change 隔离改 `current`，全部工作直接在 `main`；已拆除 comet worktree/分支 | spec 约束节 | A7 | covered | 分支收敛：本地/远端现仅存 `main` |

# 非目标

- 不执行 P2-C2（`vbmf-ci-02`）、P2-C3（双机 parity re-probe）、P2-C4（`rust-format.runs-on` 迁移）。
- 不修改 runner 账户权限：`vbmf-ci` 保持无 generic sudo/root；不给任何账户新增 sudo。
- 不创建任何 git 分支/worktree；本 change 全程在 `main`。
- 不触碰并发 agent/tool 的未提交文件（`.comet/config.yaml`、`.gitignore`、`AGENTS.md` 的并发未提交改动、`.agents/`、`.claude/`、`.codex/`、`.pi/`）；`AGENTS.md` 落盘遇并发未提交改动时先等其落定或由用户裁决，不混合提交。
- 不设置 runner runtime proxy；proxy 只在需要时按命令经 `VBMF_CI_PROXY` 传给 pin 脚本。
- 不重跑/宣称 24h stability；不推进任何 Runtime/Web 业务功能。

# 验收示例

- Scenario: coordinator 确认的 exact SHA bundle 在 Development VM 上生成成功，`prepare-system-rust-bundle.sh` 打印 `BUNDLE_SOURCE_SHA=b0f5df3b215c536b598aed7938079572edf87395` 且 `SHA256SUMS` 三脚本条目完整记录为 evidence。
- Scenario: `vbmf-ci-01` 宿主机上 `sha256sum -c SHA256SUMS` 全部 PASS；随后以正式 bundle 复跑 `pin-system-rust.sh --version 1.98.1` 幂等（0 退出、`PINNED_RUST_VERSION=1.98.1` 不变）。
- Scenario: 正式 bundle 的 `verify-system-rust.sh --expect-version 1.98.1` 输出 `RESULT: PASS`（V1–V4 全 PASS），且调用方用户态 rustup 污染不复现。
- Scenario: 以 `vbmf-ci` 身份执行 `collect-toolchain.sh --name vbmf-ci-01` 成功生成/刷新 manifest（`/data/actions-runners/vbmf/manifests/vbmf-ci-01/`），记录 rustc/cargo 1.98.1 与 `/usr/local` 路径。
- Scenario: 管理机 `verify-runner.sh --name vbmf-ci-01` 输出 `RESULT: PASS`（R1–R5 + scope），且 `.project/STATE.md` 已登记全部证据并置 P2-C1 COMPLETE / P2-C2 READY。
- Scenario: `AGENTS.md` "Agent execution" 节新增 coordination tiering 条款（强模型 = coordinator；Pi = 默认 executor；executor 不写调度契约/不转正 STATE），提交在 `main` 且不包含并发 agent 的未提交改动。
- Scenario: 分支收敛保持：本 change 全程无新建分支/worktree，收尾时本地与远端分支仅存 `main`。

# 约束与不变量

- Authority：STATE §5.1 P2-C1 行 + `docs/architecture/CI_RUNNER_STRATEGY.md` §15.7/§15.8/§15.9。
- §15.9 红线：宿主机不做任何 git fetch/checkout/worktree；只用 bundle 内容；`verify-system-rust.sh` 永不 install/write/link；不给 `vbmf-ci` 加 sudo；pin/verify 不以 GitHub Actions workflow 为执行入口。
- bundle 只接受 full 40-hex exact SHA。
- 本仓库 public：LAN IP、SSH fingerprint、账户名、凭据不得写入 repo/logs/evidence；host 通道细节不落盘。
- 单分支策略：所有提交直接进 `main`（单人开发，Git Authority = `main`）。
- host1 SSH 目标与（如需）`VBMF_CI_PROXY` 值为 Build 阶段执行输入，由用户在步骤 2 开始时提供、只存在于会话/进程环境；不可得时按 Runtime blocked 处理，不缩小验收范围。
- executor exit 0 只算 `DONE_NEEDS_REVIEW`；COMPLETE 需按 STATE 规则完成 Evidence + STATE Update + GitHub Sync。

# 决策

- 工作区隔离：`current`（2026-09-15 用户裁定单分支策略，废弃先前 worktree 选择；comet worktree 与分支已拆除）。
- clarification_mode = batch。
- 幂等 pin 复核纳入范围：STATE P2-C1 明确 "Rust 1.98.1 idempotent pin"，§15.9 步骤 3 要求原样重跑。
- Q1 已裁决：bundle 源 SHA = `b0f5df3b215c536b598aed7938079572edf87395`（live canonical main tip；与 `0f375c8` 仅差 docs，三脚本 byte-identical）。coordinator 已确认。
- Q2 已裁决：host1 步骤由 agent 在会话内直接经 SSH 执行 §15.9 步骤 B 全流程并采集输出；通道细节不落盘。
- 落盘执行者已裁决：AGENTS.md / `_shared` 契约落盘由 coordinator（Claude Code）亲自写，不派 Pi（被定义者不写定义）。
- `_shared/README.md` coordination tiering 已先行落盘（dev-agent-kit main `93a6451`），VBMF `AGENTS.md` 对应条款随本 change Build 落地（验收 A6）。

# 待解决问题

（无——host1 SSH 目标属 Build 执行输入，见约束与不变量倒数第二条。）

# 验证预期

- `prepare-system-rust-bundle.sh` 成功且 `BUNDLE_SOURCE_SHA` = `b0f5df3b215c536b598aed7938079572edf87395`。
- host1：`SHA256SUMS` 全 PASS；幂等 pin 复跑 0 退出；V1–V4 `RESULT: PASS`；manifest 刷新成功。
- 管理机：`verify-runner.sh --name vbmf-ci-01` `RESULT: PASS`。
- repo：本 change 只新增/修改 evidence、STATE、AGENTS.md（tiering 条款）与 Comet 正式产物；不改 `scripts/ci/*`（如需改动即越出 P2-C1 范围，必须回到 Shape）。
- 分支：全程仅 `main`；提交后 local/origin/GitHub live `main` 一致。
- GitHub：push 到 `main` 的授权在用户接受验收结果后随 Archive 收尾给出（current 隔离无 merge/PR 选项）。
