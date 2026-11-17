---
generated_from_state_version: 13
---

# 验证

## 当前结果

- 结果: **已归档**
- 验证情况: **已完成检查，验证结果已确认**
- 目标周期: 2
- 迭代: 1
- 验证器尝试次数: 2
- 完成时间: 2026-09-16T11:39:51.598Z
- 摘要: P2-E3 二阶段收口：rustdoc 暴录（四脚本 48/48 + 双机 V1–V6）+ rust-test-matrix 条件 runs-on（GITHUB_ENV prep + staging upload RCA 修复）；最终 run 7/7 首跑全绿（Doc-tests 0 failed）；P2-E 整体收口、P2-M0 READY。独立只读 Verifier A1–A6 全 pass；Runtime 机械检查全 PASS。

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | Scenario: 阶段 1 脚本扩展合入 `main` 且 focused tests（shellcheck + `test-system-rust-scripts.sh`）全 PASS，CI 全绿。 | 阶段1 脚本（43b665e）focused tests 实跑 48/48 PASS + shellcheck 5 脚本零 warning；该 push run 35079837269 的 6 个 cargo 步骤全过、唯一失败为 upload-artifact '..' 路径（已登记 RCA）；a975036 run 35082538667 首跑 7/7 success。 |
| A2 | passed | brief.md | Scenario: 双机经 out-of-band 通道以新 bundle 幂等复跑：`sha256sum -c SHA256SUMS` OK；pin 复跑 exit 0（无新组件下载，仅 symlink 收口）；扩展 verify V1–V6 全 PASS（V6 = rustdoc 经 proxy 可执行且版本可读）；双机 manifest 含 rustdoc 行。 | 双机 host-admin：bundle 43b665e checksum 3/3、pin 幂等 exit 0（零工具链下载）、verify V1–V6 全 PASS（V6 rustdoc 1.98.1）、manifest host1@09:38:10Z/host2@09:55:59Z 含 rustdoc 行——coordinator 经 SSH 收集并记入 STATE §3.13；脚本内容 verifier 在 main 逐项核验（--component rust-docs、双 symlink 循环、V6 gate、TOOLS、48 检查）。host 证据非第三方可复现为固有口径（§15.9 out-of-band）。 |
| A3 | passed | brief.md | Scenario: `rust-test-matrix` 迁条件 `runs-on` 后 push `main`：CI 7/7 required 全绿（rust-test-matrix 含 doctest 阶段全 PASS）；job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；job log 显示 prep 步骤写入 `GITHUB_ENV` 的 Rust env 契约、6 条 cargo 命令全 PASS、artifact 上传成功且来源路径为 self-hosted 分支路径。 | run 35082538667（a975036）7/7 首跑全绿，rust-test-matrix @vbmf-ci-01；log 实证 prep 步骤 GITHUB_ENV 三行写入、6 cargo 步骤 success、Doc-tests 三轮 0 failed、artifact 上传成功（6429313 bytes，ID 10441001887）。 |
| A4 | passed | brief.md | Scenario: workflow diff 审计——仅 `rust-test-matrix` job 变化，其余 6 job byte-identical；job id/name 仍 `rust-test-matrix`；无 `pull_request_target`； fork 路径 dtolnay 保持无 pin；`timeout-minutes: 30`、concurrency、 `permissions` 不变；6 条 cargo 命令逐字不变。 | job 块 byte 对比 53a01b8→a975036：仅 rust-test-matrix 变化，其余 6 job 完全一致；diff 零 cargo 命令行改动（6 条逐字保持）；job id/name/timeout 30/on 键/fork dtolnay 无 pin 全部不变。 |
| A5 | passed | brief.md | Scenario: STATE 更新——2026-09-16 窗（07:04–07:05）补记 risk 8；P2-E3 COMPLETE（run id、runner identity、观察数据）；P2-E 收口、P2-M0 变 READY。 | STATE（457f0c4）：risk 8 补记 09-16 窗 #1 四元组（07:04–07:05，ci-01，35066419711，1 rerun）；§3.13 P2-E3 COMPLETE + P2-E 整体收口（5 job 列全）；§5.1 P2-M0 READY。 |
| A6 | passed | brief.md | Scenario: 稳定性观察继续——本 packet 验证期故障窗四元组记录（或 "0 故障窗"）。 | P2-E3 验证期三 push（35075935539/35079837269/35082538667）均 attempt 1，无出网失败（35075935539 失败为 rustdoc 真实缺陷）；窗 #1 已落盘。 |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| workflow-diff-audit | -c import yaml,subprocess;d=yaml.safe_load(open('.github/workflows/media-agent.yml'));jobs=d['jobs'];assert list(jobs)==['rust-format','architecture-portability','rust-clippy','session-lifecycle','rust-test-matrix','hardware-test-compile','gstreamer-build'];tm=jobs['rust-test-matrix'];assert tm['name']=='rust-test-matrix' and tm['timeout-minutes']==30 and 'self-hosted' in tm['runs-on'] and 'ubuntu-latest' in tm['runs-on'];on=d.get(True) or d.get('on');assert set(on)=={'push','pull_request'};cur=open('.github/workflows/media-agent.yml').read();old=subprocess.run(['git','show','53a01b8:.github/workflows/media-agent.yml'],capture_output=True,text=True).stdout def jb(t,j): l=t.splitlines();o=[];c=False for x in l: if x.startswith(' '+j+':'):c=True elif c and x.startswith(' ') and x[2]!=' ' and not x.startswith(' #'):break if c:o.append(x) return chr(10).join(o) diffs=[j for j in jobs if j!='rust-test-matrix' and jb(cur,j)!=jb(old,j)];assert diffs==[],diffs;[assert_cmd in cur for assert_cmd in ['run: cargo build\n','run: cargo test\n']];names=[s.get('name') for s in tm['steps']];assert 'Rust env (self-hosted)' in names and 'Stage binary for upload (self-hosted)' in names;print('PASS: only rust-test-matrix changed; 6 other jobs byte-identical; prep+stage steps present') | . | passed | 0 | 86 ms |
| rustdoc-pin-scripts | -c bash scripts/ci/test-system-rust-scripts.sh 2>&1 \| tail -1 \| grep -q 'RESULT: PASS (48)' && grep -q -- '--component rust-docs' scripts/ci/pin-system-rust.sh && grep -q 'V6: rustdoc' scripts/ci/verify-system-rust.sh && echo 'PASS: 48/48 tests; rust-docs component + V6 gate in scripts' | . | passed | 0 | 1760 ms |
| ci-run-a975036-green | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; C=$(G gh run view 35082538667 --json conclusion --jq '.conclusion'); B=$(G gh run view 35082538667 --json jobs --jq '[.jobs[]\|select(.conclusion!="success")]\|length'); [ "$C" = success ] && [ "$B" = 0 ] && echo 'PASS: a975036 run 35082538667 7/7 green' | . | passed | 0 | 5021 ms |
| test-matrix-log-evidence | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; F=/tmp/p2e3-job3.log; : > $F; JID=$(G gh api repos/pwl1987/VBMF/actions/runs/35082538667/jobs --jq '.jobs[]\|select(.name=="rust-test-matrix")\|.id'); for i in 1 2 3 4 5; do if gh run view 35082538667 --log --job=$JID >> $F 2>/dev/null && [ -s $F ]; then break; fi; gh api repos/pwl1987/VBMF/actions/jobs/$JID/logs >> $F 2>/dev/null && [ -s $F ] && break; sleep 10; done; grep -q "Runner name: 'vbmf-ci" $F && grep -q 'RUSTUP_HOME=/usr/local/rustup' $F && grep -q 'target-testmatrix' $F && grep -q 'Doc-tests media_agent' $F && grep -q '232 passed; 0 failed' $F && ! grep -q 'test result: FAILED' $F && grep -q 'media-agent-linux-default' $F && echo 'PASS: runner + GITHUB_ENV contract + Doc-tests + 232/0 + artifact' | . | passed | 0 | 3731 ms |
| head-push-green | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; C=$(G gh run view 35082538667+HEAD 2>/dev/null --json conclusion --jq '.conclusion' 2>/dev/null \|\| true); RID=$(G gh run list --branch main --limit 3 --json headSha,conclusion,databaseId --jq '.[]\|select(.headSha\|startswith("457f0c4"))\|.databaseId' \| head -1); CC=$(G gh run view $RID --json conclusion --jq '.conclusion'); [ "$CC" = success ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && echo "PASS: HEAD=origin/main=457f0c4, its CI run $RID green" | . | passed | 0 | 49075 ms |
| state-closure-assertions | -c grep -q '3.13 P2-E3' .project/STATE.md && grep -q '43b665e' .project/STATE.md && grep -q 'a975036' .project/STATE.md && grep -q 'rustdoc 暴录\\|rustdoc 暴露' .project/STATE.md && grep -q '07:04–07:05' .project/STATE.md && grep -qE '\\| \*\*P2-M0\*\* \\| \*\*READY\*\*' .project/STATE.md && grep -q 'P2-E 整体收口' .project/STATE.md && echo 'PASS: STATE §3.13 closure + P2-E complete + P2-M0 READY + window backfill' | . | passed | 0 | 15 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- focused-tests: passed — test-system-rust-scripts.sh 48/48 PASS（+3 rustdoc case）；shellcheck 四脚本零 warning
- host-admin-both-hosts: passed — bundle 43b665e checksum 3/3；双机 pin 幂等 exit 0；verify V1-V6 全 PASS（V6 rustdoc 1.98.1）；manifest host1@09:38:10Z host2@09:55:59Z 含 rustdoc 行；API 双机 online+exact labels；临时目录清理
- ci-run-a975036-line: passed — 43b665e run 35079837269 仅败 upload '..' 路径（6 cargo 步骤已全过）；a975036 run 7/7 首跑全绿，rust-test-matrix @vbmf-ci-01，Doc-tests 0 FAILED
- ci-run-head-457f0c4: passed — STATE push run 经 2026-09-16 窗 #2（10:10-10:22 UTC ci-01）2 次 rerun 后 7/7 全绿
- structure-invariants: passed — 仅 rust-test-matrix job diff（+staging 步骤）；其余 6 job byte-identical；6 条 cargo 命令逐字不变；on={push,pull_request}
- state-closure: passed — §3.13 P2-E3 COMPLETE + P2-E 整体收口；risk 8 补记 09-16 窗 #1（07:04-07:05）；P2-M0 READY；§2/§4/§5/§8/§9/§10 联动
- 已知限制: rust-test-matrix 仅 vbmf-ci-01 live 证据（ci-02 首跑 35075935539 因当时 rustdoc 缺口失败，修复后未再命中 ci-02）
- 已知限制: fork runs-on 分支未 live 实测（沿用 §3.9 口径）
- 已知限制: 2026-09-16 窗 #2（10:10-10:22）发生于 STATE 闭环 push，待 P2-M0 阶段 STATE 触碰补记

## 阻塞项

_无。_

## 风险与跳过的工作

- 2026-09-16 窗 #2（~10:09–10:22 UTC，ci-01，STATE 闭环 push 457f0c4 的 run 35083349130，arch-portability×2 + session-lifecycle 失败，2 次 rerun 收口）发生于 STATE 内容冻结之后，risk 8 '1 次' 计数已过期——P2-M0 阶段 STATE 触碰时必须补记四元组
- 43b665e run 的 rust-test-matrix 内有 2 次 in-step GnuTLS fetch 瞬断（09:35–09:37 UTC，checkout 自动重试成功，无 job 失败）——按 job 级计数口径不计窗，但显示抖动持续低强度存在
- host 执行证据（pin/verify/manifest）为 coordinator 收集、仅存在于 STATE §3.13 叙述，第三方不可复现（§15.9 out-of-band 固有口径）
- rust-test-matrix 仅 vbmf-ci-01 修复后 live 证据（ci-02 首跑因当时 rustdoc 缺口失败，未再自然命中）

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 1 | 0 | recovery | — | Formal requirement write requested for brief.md | 2026-09-16T09:28:16.801Z |
| 2 | 1 | 1 | execution-error | — | Native Verifier response was invalid: Native verification cannot pass before every required check succeeds | 2026-09-16T11:28:30.089Z |
| 2 | 1 | 2 | pass | — | P2-E3 二阶段收口：rustdoc 暴录（四脚本 48/48 + 双机 V1–V6）+ rust-test-matrix 条件 runs-on（GITHUB_ENV prep + staging upload RCA 修复）；最终 run 7/7 首跑全绿（Doc-tests 0 failed）；P2-E 整体收口、P2-M0 READY。独立只读 Verifier A1–A6 全 pass；Runtime 机械检查全 PASS。 | 2026-09-16T11:39:51.598Z |



## 结论

P2-E3 二阶段收口：rustdoc 暴录（四脚本 48/48 + 双机 V1–V6）+ rust-test-matrix 条件 runs-on（GITHUB_ENV prep + staging upload RCA 修复）；最终 run 7/7 首跑全绿（Doc-tests 0 failed）；P2-E 整体收口、P2-M0 READY。独立只读 Verifier A1–A6 全 pass；Runtime 机械检查全 PASS。
