---
generated_from_state_version: 18
---

# 验证

## 当前结果

- 结果: **已归档**
- 验证情况: **已完成检查，验证结果已确认**
- 目标周期: 1
- 迭代: 2
- 验证器尝试次数: 4
- 完成时间: 2026-09-16T04:36:46.421Z
- 摘要: P2-E1 session-lifecycle 条件 runs-on 迁移完成：结构不变量保持、CI 7/7 全绿（经故障窗 rerun）、双机 runner identity + env 契约 + 50/0 门禁测试证据齐、观察窗数据入 STATE。独立只读 Verifier agent 对 A1–A4 逐项独立复核全部 pass。

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | Scenario: `session-lifecycle` job 迁条件 `runs-on` 后 push `main`：CI 7/7 required 全绿；`session-lifecycle` job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}； job log 显示 self-hosted 分支零 install、显式 Rust env 契约、四条 `cargo test --features mock`（session/resource/lease/preflight）全 PASS。 | run 35033319131 (810b60c) 7/7 required 全绿（经 2 rerun 穿故障窗 #4）；session-lifecycle @vbmf-ci-01；log 实证 Runner name/RUNNER_ENV self-hosted/env 契约（RUSTUP_HOME=/usr/local/rustup、.cargo-home、target-session、unset RUSTUP_TOOLCHAIN）/四条 cargo test --features mock 全 PASS（50 passed/0 failed，无 FAILED 行）；dtolnay 与 cache 步骤 skipped=零 install。独立核验 agent 逐项复核一致。 |
| A2 | passed | brief.md | Scenario: workflow diff 审计——仅 `session-lifecycle` job 变化，其余 6 job byte-identical；job id/name 仍 `session-lifecycle`；无 `pull_request_target`； fork 路径保持 dtolnay 现状（本 job 原本无 toolchain pin 参数——GitHub-hosted 路径不改 dtolnay 步骤语义，见 D2）；`timeout-minutes: 20`、concurrency、 `permissions` 不变。 | diff 9fe1045→810b60c 仅 session-lifecycle 块（26+/1-，两 hunk 均在 job 内）；其余 6 job byte-identical；on={push,pull_request} 无 pull_request_target；fork 路径 dtolnay 无 pin 参数（D2）；timeout 20/concurrency/permissions 不变。 |
| A3 | passed | brief.md | Scenario: 稳定性观察登记——验证期内每次出网故障窗记录（时间窗、命中 runner、 失败步骤、rerun 收口）；无故障窗则明确记 "0 故障窗"；数据入 STATE risk 8。 | STATE risk 8 + §3.11 记录 P2-E1 验证期窗 #4（22:55–23:05，双机，4 失败，2 rerun）与窗 #5（23:14–23:19，双机 ci-01×2+ci-02×1，3 失败，1 rerun）完整四元组（时间/runner/步骤/rerun），当日累计 5 窗。附注：窗 #6（23:26–23:33，双机，3 失败，bookkeeping push ff2dcd9 的 run 35035748405，1 rerun 后 7/7 全绿）发生于候选提交之后，待下一 Build 阶段 STATE 触碰时补记（见 risks）。 |
| A4 | passed | brief.md | Scenario: `.project/STATE.md` 更新：P2-E1 COMPLETE（run id、runner identity、 观察数据）、P2-E2 变 READY。 | STATE §3.11 P2-E1 COMPLETE（run id 35033319131/35034627908、runner identity vbmf-ci-01+vbmf-ci-02、观察数据）；§5.1 P2-E1 COMPLETE 行 + P2-E2 READY 行；§10 handoff 指向 P2-E2。 |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| workflow-diff-audit | -c import yaml,subprocess;d=yaml.safe_load(open('.github/workflows/media-agent.yml'));jobs=d['jobs'];assert list(jobs)==['rust-format','architecture-portability','rust-clippy','session-lifecycle','rust-test-matrix','hardware-test-compile','gstreamer-build'];sl=jobs['session-lifecycle'];assert sl['name']=='session-lifecycle' and sl['timeout-minutes']==20 and 'self-hosted' in sl['runs-on'] and 'ubuntu-latest' in sl['runs-on'];on=d.get(True) or d.get('on');assert set(on)=={'push','pull_request'};cur=open('.github/workflows/media-agent.yml').read();old=subprocess.run(['git','show','9fe1045:.github/workflows/media-agent.yml'],capture_output=True,text=True).stdout def jb(t,j): l=t.splitlines();o=[];c=False for x in l: if x.startswith(' '+j+':'):c=True elif c and x.startswith(' ') and x[2]!=' ' and not x.startswith(' #'):break if c:o.append(x) return chr(10).join(o) diffs=[j for j in jobs if j!='session-lifecycle' and jb(cur,j)!=jb(old,j)];assert diffs==[],diffs;print('PASS: only session-lifecycle changed; 6 jobs byte-identical vs 9fe1045; on keys push+pull_request; name/timeout preserved') | . | passed | 0 | 83 ms |
| ci-run-35033319131-green | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; C=$(G gh run view 35033319131 --json conclusion --jq '.conclusion'); B=$(G gh run view 35033319131 --json jobs --jq '[.jobs[]\|select(.conclusion!="success")]\|length'); RN=$(G gh api repos/pwl1987/VBMF/actions/runs/35033319131/jobs --jq '.jobs[]\|select(.name=="session-lifecycle")\|.runner_name'); [ "$C" = success ] && [ "$B" = 0 ] && echo "$RN" \| grep -Eq 'vbmf-ci-0[12]' && echo "PASS: 35033319131 success 7/7, session-lifecycle on $RN" | . | passed | 0 | 5759 ms |
| self-hosted-env-and-tests-log | -c F=/tmp/p2e1-chk6-job.log; : > $F; JID=$(G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; gh api repos/pwl1987/VBMF/actions/runs/35033319131/jobs --jq '.jobs[]\|select(.name=="session-lifecycle")\|.id'); for i in 1 2 3 4 5; do if gh run view 35033319131 --log --job=$JID >> $F 2>/dev/null && [ -s $F ]; then break; fi; gh api repos/pwl1987/VBMF/actions/jobs/$JID/logs >> $F 2>/dev/null && [ -s $F ] && break; sleep 10; done; grep -q "Runner name: 'vbmf-ci" $F && grep -q 'RUNNER_ENV: self-hosted' $F && grep -q 'export RUSTUP_HOME=/usr/local/rustup' $F && grep -q 'target-session' $F && grep -q 'unset RUSTUP_TOOLCHAIN' $F && grep -q 'cargo test --features mock session::' $F && grep -q 'cargo test --features mock resource::' $F && grep -q 'cargo test --features mock lease::' $F && grep -q 'cargo test --features mock preflight::' $F && ! grep -q 'test result: FAILED' $F && echo 'PASS: env contract + 4 mock gate suites, zero FAILED' | . | passed | 0 | 7114 ms |
| head-run-green-and-dual-runner | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; R=$(G gh run view 35034627908 --json conclusion,headSha,jobs --jq '{c:.conclusion,bad:[.jobs[]\|select(.conclusion!="success")]\|length}'); echo "$R" \| grep -q '"c":"success"' && RN=$(G gh api repos/pwl1987/VBMF/actions/runs/35034627908/jobs --jq '.jobs[]\|select(.name=="session-lifecycle")\|.runner_name'); echo "$RN" \| grep -q 'vbmf-ci-02' && git rev-parse HEAD \| grep -q ff2dcd9 && echo "PASS: head run 35034627908 success; session-lifecycle on $RN; local HEAD ff2dcd9" | . | passed | 0 | 4227 ms |
| state-closure-assertions | -c grep -q '3.11 P2-E1' .project/STATE.md && grep -q '810b60c8e333a48a26055bcdaf655c6fd5b022f7' .project/STATE.md && grep -q '35033319131' .project/STATE.md && grep -q '35034627908' .project/STATE.md && grep -q '22:55–23:05' .project/STATE.md && grep -q '23:14–23:19' .project/STATE.md && grep -qE '\\| \*\*P2-E2\*\* \\| \*\*READY\*\*' .project/STATE.md && echo 'PASS: STATE closure incl. fault windows 4+5 and P2-E2 READY' | . | passed | 0 | 15 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- workflow-structure-invariants: passed — python yaml 断言：7 job id 顺序不变；仅 session-lifecycle 块 diff（其余 6 job byte-identical）；on={push,pull_request}；timeout 20
- ci-run-35033319131: passed — push 810b60c 首跑命中故障窗 #4；rerun×2 后 7/7 required 全绿；session-lifecycle @vbmf-ci-01
- ci-run-35034627908-head-green: passed — STATE 闭环 push run 经 rerun×1 后 7/7 全绿；session-lifecycle @vbmf-ci-02（双机 live 证据齐）
- state-update: passed — commit 0294450+ff2dcd9：§3.11 COMPLETE、P2-E2 READY、risk 8 记 5 窗（P2-E1 期 2 窗含时间/runner/步骤/rerun 四元组）
- 已知限制: fork runs-on 分支仍未 live 实测（残余风险沿用 §3.9 口径）
- 已知限制: 出网缓解方案未裁决（红线冲突，数据继续累计）

## 阻塞项

_无。_

## 风险与跳过的工作

- 窗 #6（23:26–23:33 UTC，双机，run 35035748405 经 1 rerun 收口）未及写入候选内 STATE——Verify 阶段禁实现写入；P2-E2 Build 阶段 STATE 更新时补记（数据已在本地记录，不丢失）
- 出网恶化趋势：当日 6 窗，22:55 后近乎连续（22:55/23:14/23:26），rerun 收口模式承压；缓解裁决（job 级 git 代理 vs probe workflow-env 红线）应在 P2-E2 前或伴随进行
- fork runs-on 分支仍未 live 实测（无外部 fork PR，沿用 §3.9 残余风险口径）
- session-lifecycle 双机 live 证据齐（ci-01 run 35033319131 + ci-02 run 35034627908），但均为单次；长期调度均衡未观察

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 1 | 1 | recovery | — | Observed implementation write before .project/STATE.md | 2026-09-15T23:27:19.413Z |
| 1 | 2 | 1 | execution-error | — | Native Verifier response was invalid: Native verification cannot pass before every required check succeeds | 2026-09-15T23:48:25.227Z |
| 1 | 2 | 2 | execution-error | — | Native Verifier response was invalid: Native verification cannot pass before every required check succeeds | 2026-09-15T23:53:34.088Z |
| 1 | 2 | 3 | execution-error | — | Native Verifier response was invalid: Native verification cannot pass before every required check succeeds | 2026-09-16T00:53:34.485Z |
| 1 | 2 | 4 | pass | — | P2-E1 session-lifecycle 条件 runs-on 迁移完成：结构不变量保持、CI 7/7 全绿（经故障窗 rerun）、双机 runner identity + env 契约 + 50/0 门禁测试证据齐、观察窗数据入 STATE。独立只读 Verifier agent 对 A1–A4 逐项独立复核全部 pass。 | 2026-09-16T04:36:46.421Z |



## 结论

P2-E1 session-lifecycle 条件 runs-on 迁移完成：结构不变量保持、CI 7/7 全绿（经故障窗 rerun）、双机 runner identity + env 契约 + 50/0 门禁测试证据齐、观察窗数据入 STATE。独立只读 Verifier agent 对 A1–A4 逐项独立复核全部 pass。
