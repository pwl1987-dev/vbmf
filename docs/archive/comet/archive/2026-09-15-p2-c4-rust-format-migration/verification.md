---
generated_from_state_version: 10
---

# 验证

## 当前结果

- 结果: **已归档**
- 验证情况: **已完成检查，验证结果已确认**
- 目标周期: 1
- 迭代: 1
- 验证器尝试次数: 2
- 完成时间: 2026-09-15T12:50:42.942Z
- 摘要: All 5 acceptance items pass on independently gathered evidence: run 34969039593 7/7 green with rust-format on vbmf-ci-02 under vbmf-general labels and the full 3.6 RCA env contract in-log with no install step; diff confined to rust-format job (other 6 deep-equal, required contexts unchanged); fork branch resolves to ubuntu-latest by GHA &&/|| semantics; 4 v2 runtime checks passed; STATE f37e5de closes P2-C4/P2-C and sets P2-D READY. Residual: un-live-tested fork branch (accepted), dtolnay pre-fetch coupling, ~6.7m vs 10m timeout headroom.

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | Scenario: push canonical `main` 触发 CI，`rust-format` job 由 `vbmf-general` 池中一台 self-hosted runner（`vbmf-ci-01` 或 `vbmf-ci-02`）执行；使用系统 pin Rust（`/usr/local/bin` + 显式 `RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo` + `unset RUSTUP_TOOLCHAIN`，STATE §3.6 RCA）， `cargo fmt --all -- --check` PASS；本次 run 7/7 required checks 全绿； Actions API 中该 job 的 `runner_name` 为两机之一（runner identity evidence）。 | run 34969039593 push/main 41400e1 7/7 success; rust-format job 104380476820 runner_name=vbmf-ci-02 labels [self-hosted,Linux,X64,vbmf,vbmf-general]; log shows RUNNER_ENV: self-hosted, export RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo + unset RUSTUP_TOOLCHAIN, cargo fmt --all -- --check pass, no install step ran |
| A2 | passed | brief.md | Scenario: workflow diff 审计——仅 `rust-format` job 变化，其余 6 个 job byte-identical；job id/name 仍为 `rust-format`（required context 不变）； 未引入 `pull_request_target`。 | git diff bc1d084..41400e1 single hunk confined to rust-format job; other 6 jobs PyYAML deep-equal; triggers/concurrency/defaults/permissions identical; job id/name rust-format, timeout 10m; no pull_request_target trigger; branch protection required contexts exactly the unchanged 7 names |
| A3 | passed | brief.md | Scenario: fork PR 路径结构保持——`runs-on` 表达式对 fork `pull_request` 解析为 `ubuntu-latest`；toolchain 安装步骤只在 `runner.environment == 'github-hosted'` 执行；self-hosted 路径零 install 步骤（直接用系统 pin）。 | expression verified: fork PR falsifies left disjunction so \|\| yields ubuntu-latest; fromJSON array never falsy so trusted path cannot fall through; toolchain step gated runner.environment == 'github-hosted' with toolchain 1.98.1; self-hosted log proves zero install executed |
| A4 | passed | brief.md | Scenario: 本地静态验证（YAML 解析 + workflow 结构检查）在提交前 PASS； push 后 GitHub 接受 workflow（无语法拒绝）。 | GitHub accepted workflow (run 34969039593 on 41400e1, all jobs green); 4 v2 runtime checks passed with receipts in logs/checks (STRUCTURE_OK, vbmf-ci-02); verifier independently reproduced structure validation |
| A5 | passed | brief.md | Scenario: `.project/STATE.md` 更新：P2-C4 COMPLETE（含 run id、runner identity、commit SHA evidence），P2-C 整体收口，P2-D 变为 READY。 | git show f37e5de --stat STATE.md-only; adds 3.9 P2-C4 COMPLETE with 41400e1/run 34969039593/runner vbmf-ci-02 evidence; P2-C closed; 5.1 P2-C4 COMPLETE + P2-D READY |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| ci-green-41400e1-v2 | -c gh run view 34969039593 --repo pwl1987/VBMF --json conclusion,headSha --jq '.conclusion+" "+.headSha' \| grep -qx 'success 41400e1b36e67a36cbd9a9395d4f42efb42c76ad' | . | passed | 0 | 1582 ms |
| selfhosted-identity-v2 | -c gh api repos/pwl1987/VBMF/actions/runs/34969039593/jobs --jq '.jobs[] \| select(.name=="rust-format") \| .runner_name' \| grep -Ex 'vbmf-ci-0[12]' | . | passed | 0 | 1371 ms |
| workflow-diff-scope-v2 | -c import subprocess,yaml;d=yaml.safe_load(open('.github/workflows/media-agent.yml'));old=yaml.safe_load(subprocess.run(['git','show','bc1d084:.github/workflows/media-agent.yml'],capture_output=True,text=True).stdout);exp=['rust-format','rust-test-matrix','rust-clippy','hardware-test-compile','architecture-portability','gstreamer-build','session-lifecycle'];assert sorted(d['jobs'])==sorted(exp);assert all(d['jobs'][k]==old['jobs'][k] for k in exp if k!='rust-format');assert d['jobs']['rust-format']['name']=='rust-format';assert 'vbmf-general' in d['jobs']['rust-format']['runs-on'] and 'ubuntu-latest' in d['jobs']['rust-format']['runs-on'];print('STRUCTURE_OK') | . | passed | 0 | 89 ms |
| git-clean-except-comet-v2 | -c git status --porcelain \| grep -v 'docs/comet/changes/p2-c4-rust-format-migration' && exit 1 \|\| true | . | passed | 0 | 12 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- local-structure-checks: passed — python yaml parse + assertions: 7 job ids/names unchanged, runs-on expression carries ubuntu-latest and vbmf-general, dtolnay step if-gated github-hosted with toolchain 1.98.1, fmt step env contract, 6 other jobs deep-equal vs origin/main, no pull_request_target trigger, permissions contents:read, timeout 10m
- ci-push-main-34969039593: passed — gh run watch exit 0; 7/7 required jobs success; rust-format on runner vbmf-ci-02 labels [self-hosted,Linux,X64,vbmf,vbmf-general]; log shows RUNNER_ENV: self-hosted and cargo fmt --check pass
- 已知限制: fork runs-on branch not live-tested (no fork PR available); D4 fallback recorded in STATE 3.9

## 阻塞项

_无。_

## 风险与跳过的工作

- fork runs-on branch has no live fork-PR test (accepted D4 limitation recorded in brief D4 and STATE 3.9/9); first external fork PR must be checked via job runner_name
- runner pre-fetches dtolnay action tarball even when step skipped on self-hosted; dtolnay outage could fail self-hosted job (availability coupling only)
- rust-format on vbmf-ci-02 took ~6.7 min wall clock (git fetch ~6 min) vs timeout 10m; monitor headroom in P2-C stability observation

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 1 | 1 | execution-error | — | Native Verifier response was invalid: Native Verifier check ID ci-green-41400e1 conflicts with a Runtime check | 2026-09-15T12:42:23.536Z |
| 1 | 1 | 2 | pass | — | All 5 acceptance items pass on independently gathered evidence: run 34969039593 7/7 green with rust-format on vbmf-ci-02 under vbmf-general labels and the full 3.6 RCA env contract in-log with no install step; diff confined to rust-format job (other 6 deep-equal, required contexts unchanged); fork branch resolves to ubuntu-latest by GHA &&/\|\| semantics; 4 v2 runtime checks passed; STATE f37e5de closes P2-C4/P2-C and sets P2-D READY. Residual: un-live-tested fork branch (accepted), dtolnay pre-fetch coupling, ~6.7m vs 10m timeout headroom. | 2026-09-15T12:50:42.942Z |



## 结论

All 5 acceptance items pass on independently gathered evidence: run 34969039593 7/7 green with rust-format on vbmf-ci-02 under vbmf-general labels and the full 3.6 RCA env contract in-log with no install step; diff confined to rust-format job (other 6 deep-equal, required contexts unchanged); fork branch resolves to ubuntu-latest by GHA &&/|| semantics; 4 v2 runtime checks passed; STATE f37e5de closes P2-C4/P2-C and sets P2-D READY. Residual: un-live-tested fork branch (accepted), dtolnay pre-fetch coupling, ~6.7m vs 10m timeout headroom.
