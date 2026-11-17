# 目标

完成 STATE §5.1 READY Work Packet **P2-C3**：双 runner read-only parity re-probe —— `ci-infra-probe.yml` 先补显式 Rust env（§3.6 RCA），再重复 dispatch 直到 `vbmf-ci-01` 与 `vbmf-ci-02` 各被至少命中一次，两份报告中 `rustc`/`cargo` 均为 `/usr/local/bin/...` + `1.98.1`、labels exact、runner identity 明确；evidence 登记 STATE，P2-C3 → COMPLETE、P2-C4 → READY。

# 范围

1. `.github/workflows/ci-infra-probe.yml` "Host capability contract" step 增加显式 `RUSTUP_HOME=/usr/local/rustup`、`CARGO_HOME=/usr/local/cargo` 并清除调用方 `RUSTUP_TOOLCHAIN`（与 verify-system-rust.sh V2/V3/V4 同语义），保证 rustup proxy 在 `vbmf-ci` 身份下可解析 system pin；只动该 step 的 env，不改其他步骤、不加网络/写操作。
2. workflow 编辑聚焦校验：`actionlint`（或等效 YAML lint）+ 现有 workflow 结构不变断言（job/step 名、只读红线注释不变）。
3. push `main` 后 dispatch `ci-infra-probe`（tier=`vbmf-general`，单 job 无 matrix），重复 dispatch 直至两台 `runner.name` 各出现至少一次；记录每次 run 的 runner identity 与 `rustc/cargo` 行。
4. Parity 判定：两机 `rustc`/`cargo` = `/usr/local/bin/... (…1.98.1…)`、`rustfmt` 路径在 `/usr/local/bin`、labels exact `{self-hosted,Linux,X64,vbmf,vbmf-general}`、manifest 已由 P2-C1/C2 刷新（引用 §3.6/§3.7，不重跑）。
5. Evidence + STATE：登记 probe run IDs、两机命中证据、parity 对照；P2-C3 COMPLETE、P2-C4 READY；`main` 提交。

## Source coverage

| 来源条目与位置 | 读取状态 | 需要保留的内容 | Spec 位置 | 验收 ID | 覆盖状态 | 理由 |
| --- | --- | --- | --- | --- | --- | --- |
| STATE §5.1 P2-C3 行 | complete | 双机命中 + parity + identity + labels | spec §2–§4 | A2–A4 | covered | 本 change 主体 |
| STATE §3.6 RCA（vbmf-ci 需显式 Rust env） | complete | probe step env 补丁依据 | spec §1 | A1 | covered | 前置约束落地 |
| STATE §3.6/§3.7 manifest 证据 | complete | 引用不重跑 | spec §4 | A4 | covered | 已完成事实 |
| Strategy §15.7 末条 / §15.9 收尾段 | complete | “重复 dispatch 至两台各命中一次 + /usr/local parity 双证” | spec §3 | A2 | covered | Authority |
| ci-infra-probe.yml 第 77–83 行现状 | complete | plain `"$t" --version` 在 vbmf-ci 下必失败的事实 | spec §1 | A1 | covered | 事实依据 |

# 非目标

- 不执行 P2-C4（`rust-format.runs-on` 迁移）。
- 不改 `media-agent.yml`；不加 probe 的网络/写/sudo 步骤；不改 runner 宿主机与账户权限。
- 不重跑 pin/manifest；不新建分支。

# 验收示例

- Scenario: `ci-infra-probe.yml` capability step 带显式 `RUSTUP_HOME=/usr/local/rustup`、`CARGO_HOME=/usr/local/cargo` 且 unset `RUSTUP_TOOLCHAIN`，提交在 `main` 且 CI 全绿。
- Scenario: `ci-infra-probe` 实际 dispatch 后，logs 中 `runner.name=vbmf-ci-01` 与 `runner.name=vbmf-ci-02` 各出现至少一次（可跨多次 run）。
- Scenario: 每份命中报告中 `rustc: /usr/local/bin/rustc (rustc 1.98.1 …)` 与 `cargo: /usr/local/bin/cargo (cargo 1.98.1 …)`（无 MISSING、无 rustup 报错）。
- Scenario: 两机报告 labels exact `{self-hosted,Linux,X64,vbmf,vbmf-general}`，且 runner identity（name/hostname/workspace）与登记的 devbox/guest 拓扑一致。
- Scenario: `.project/STATE.md` 登记 probe run IDs、两机命中与 parity 对照，置 P2-C3 COMPLETE / P2-C4 READY。

# 约束与不变量

- Authority：STATE §5.1 P2-C3 + CI_RUNNER_STRATEGY §15.7/§15.9 + ci-infra-probe 只读红线（不 install、不 mutation、不 secrets、不 artifacts、不 sudo）。
- probe 保持 workflow_dispatch only、单 job、无 matrix；不改 tier allowlist。
- env 补丁只影响 capability step 的探测语义，等价于 verifier V2–V4 的调用契约。
- 单分支 `main`；probe dispatch 属读操作；push 授权随归档。

# 决策

- 工作区：`current`（单分支政策）。
- clarification_mode = batch。
- 无未决用户问题：env 补丁是 §3.6 RCA 的直接落地，无分叉。

# 待解决问题

（无）

# 验证预期

- workflow lint PASS；结构 diff 仅 capability step env。
- dispatch 后两机各命中 ≥1 次；两份报告 rustc/cargo 均 `/usr/local/bin` + 1.98.1。
- STATE 闭环；远端 heads 仅 `main`。
