# 目标

完成 STATE §5.1 Task Queue 第一个 READY Work Packet **P2-C2**：`vbmf-ci-02`（devbox KVM guest）对称完成 system Rust `1.98.1` exact pin 正式收口 —— 与 host1 相同的 §15.9 bundle 流程（checksum、pin、幂等复核、V1–V4 verify、`vbmf-ci` manifest），管理机只读收口，evidence 登记入 `.project/STATE.md`，P2-C2 置 COMPLETE、P2-C3 置 READY。

# 范围

1. 步骤 A（Development VM）：`prepare-system-rust-bundle.sh --repo <repo> --sha <coordinator 确认的 full 40-hex SHA> --out <安全空目录>`，记录 `BUNDLE_SOURCE_SHA` 与 `SHA256SUMS` 为 evidence。
2. 步骤 B（`vbmf-ci-02` guest，经 devbox 跳板 SSH，§15.9 顺序）：
   - `sha256sum -c SHA256SUMS` 全 PASS；
   - 首次 system pin：`sudo pin-system-rust.sh --version 1.98.1`（首次执行，期望 `PINNED_RUST_VERSION=1.98.1`）+ 第二次原样重跑证明幂等（0 退出、版本不变）；
   - 正式 verifier：`verify-system-rust.sh --expect-version 1.98.1` V1–V4 全 PASS（RESULT: PASS）；
   - manifest：`sudo -u vbmf-ci env RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo bash collect-toolchain.sh --name vbmf-ci-02`（按 §3.6 RCA 显式传 env）；
   - 清理 bundle 临时目录。
3. 管理机只读收口：`verify-runner.sh --name vbmf-ci-02`（R1–R5 + scope，期望 RESULT: PASS）。
4. Evidence + STATE 更新：全部证据登记 `.project/STATE.md`（P2-C2 → COMPLETE，P2-C3 → READY），在 `main` 直接提交。

## Source coverage

来源：STATE §5.1 P2-C2 行 + §3.6（host1 证据与 RCA）+ Strategy §15.9 + 用户 2026-09-15 会话指令（SI）。逐条：

| 来源条目与位置 | 读取状态 | 需要保留的内容 | Spec 位置 | 验收 ID | 覆盖状态 | 理由或替代关系 |
| --- | --- | --- | --- | --- | --- | --- |
| STATE §5.1 P2-C2 行（scope + acceptance） | complete | 对称 pin/verify/manifest，host-key 严格验证，§3.6 RCA env 前置 | spec §1–§4 | A1–A5 | covered | 本 change 主体 |
| STATE §3.6（host1 证据链 + 运维 RCA） | complete | 复用同 SHA 脚本语义与显式 env 约束 | spec 前提 + §2 | A2–A4 | covered | 前置事实 |
| Strategy §15.7/§15.8/§15.9 | complete | 红线与步骤序列 | spec 红线节 | A1–A5 | covered | Authority |
| SI-1 单分支政策（2026-09-15） | complete | 全程 `main`，无新分支/worktree | spec 约束 | A6 | covered | 沿用 |
| SI-2 强模型指挥/Pi 执行契约 | complete | 本 change 由 coordinator（Claude）亲自执行 host 步骤（凭据+root mutation 不下放） | spec 约束 | — | background | AGENTS.md 已固化 |
| 已归档 p2-c1 change | complete | 不重做 host1 | — | — | non-goal | P2-C1 COMPLETE |

# 非目标

- 不执行 P2-C3（双机 parity re-probe）、P2-C4（runs-on 迁移）。
- 不修改任何 runner 账户 sudo/权限；不设置 runner runtime proxy。
- 不重做 host1；不改 `scripts/ci/*`（如需改动即越出范围，回 Shape）。
- 不新建分支/worktree。

# 验收示例

- Scenario: coordinator 确认 SHA 的 bundle 在 Development VM 生成成功，`BUNDLE_SOURCE_SHA` 与 `SHA256SUMS` 完整记录为 evidence。
- Scenario: `vbmf-ci-02` guest 上 `sha256sum -c SHA256SUMS` 全 PASS；首次 `pin-system-rust.sh --version 1.98.1` 输出 `PINNED_RUST_VERSION=1.98.1`，第二次原样重跑 0 退出且版本不变。
- Scenario: 正式 `verify-system-rust.sh --expect-version 1.98.1` 输出 `RESULT: PASS`（V1–V4 全 PASS）。
- Scenario: 以 `vbmf-ci` 身份（显式 `RUSTUP_HOME`/`CARGO_HOME`）刷新 `/data/actions-runners/vbmf/manifests/vbmf-ci-02/`，记录 rustc/cargo 1.98.1 与 `/usr/local` 路径。
- Scenario: 管理机 `verify-runner.sh --name vbmf-ci-02` 输出 `RESULT: PASS`（R1–R5 + scope），且 `.project/STATE.md` 登记全部证据并置 P2-C2 COMPLETE / P2-C3 READY。
- Scenario: 单分支保持：全程无新建分支/worktree，收尾时本地与远端分支仅存 `main`。

# 约束与不变量

- Authority：STATE §5.1 P2-C2 + CI_RUNNER_STRATEGY §15.7/§15.8/§15.9。
- §15.9 红线：guest 零 git 操作；只用 bundle；verifier 零 mutation；不给 `vbmf-ci` 加 sudo；不以 workflow 为执行入口。
- host2 host-key 必须严格验证后才写入信任；guest 地址/凭据不落盘（public repo 红线）。
- 与 host1 对称：exact 1.98.1、`/usr/local/{rustup,cargo,bin}` 路径、同 bundle 脚本。
- `vbmf-ci` 调 rust 工具必须显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`（§3.6 RCA）。
- 单分支 `main`；executor 结果 = `DONE_NEEDS_REVIEW`，验收走独立 Verifier。

# 决策

- 工作区隔离：`current`（单分支政策，2026-09-15）。
- clarification_mode = batch。
- 能力关联：拒绝 host1 capability 复用建议，建独立 capability `ci-runner-rust-pin-host2`（不同 runner 宿主机生命周期）。
- 通道：Development VM → devbox（已严格验证）→ 跳板 SSH `ubuntu@guest`（BatchMode 实测 PASS，guest `sudo -n` PASS，runner active，`rustc` MISSING = pin 前基线）。
- Q1 已裁决：bundle 源 SHA = `9e47721eb30355ffe23cea12592445e8f0575c6a`（live main tip；三脚本与 `b0f5df3` byte-identical）。coordinator 已确认。
- Q2 已裁决：guest host-key 用控制台核验 —— 用户在 guest 控制台（`virsh console vbmf-ci-02`）运行 `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`，比对 devbox 单路径 keyscan 所得 `SHA256:pyp5izuxT+rYePafO6iAypuJAOUOUUX/Uc9wkJACmbs`；一致后写入信任并执行步骤 B。核验结果为 Build 步骤 2 前置输入，不匹配即停。

# 待解决问题

（无——控制台核验结果属 Build 执行输入，见 Decisions Q2。）

# 验证预期

- `prepare-system-rust-bundle.sh` 成功且 `BUNDLE_SOURCE_SHA` = coordinator 确认 SHA。
- guest：checksum 全 PASS；首次 pin + 幂等复跑 0 退出；V1–V4 `RESULT: PASS`；manifest 1.98.1 @ `/usr/local`。
- 管理机：`verify-runner.sh --name vbmf-ci-02` `RESULT: PASS`。
- repo：仅 STATE 与 Comet 产物变更；远端 heads 仅 `main`；push 在归档授权后执行。
