---
generated_from_state_version: 8
---

# 验证

## 当前结果

- 结果: **已归档**
- 验证情况: **已完成检查，验证结果已确认**
- 目标周期: 1
- 迭代: 1
- 验证器尝试次数: 1
- 完成时间: 2026-09-16T06:34:32.161Z
- 摘要: P2-E2 architecture-portability 条件 runs-on 迁移完成：结构不变量保持、CI 两 run 首跑 7/7 全绿、Lint/Proof env 契约证据齐、窗 #6 补记 + P2-E3 READY。独立只读 Verifier agent 逐项复核 A1–A4 全 pass；Runtime 机械检查 4/4 PASS。

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | Scenario: `architecture-portability` 迁条件 `runs-on` 后 push `main`：CI 7/7 required 全绿；job `runner_name` ∈ {`vbmf-ci-01`,`vbmf-ci-02`}；job log 显示 self-hosted 分支 Lint（宿主 python3）与 Proof（显式 Rust env 契约 + `target-arch`）两条门禁 PASS。 | run 35061944269（fe2e04a push）7/7 required 首跑全绿无 rerun；architecture-portability @vbmf-ci-01（labels self-hosted/Linux/X64/vbmf/vbmf-general）；log 实证 Lint（宿主 python3，PASS — 受保护层）+ Proof（RUNNER_ENV: self-hosted、四条 env 导出、remove-adapters 两条 feature cargo check、PROOF OK）均 success。STATE push run 35062407052 亦首跑全绿。 |
| A2 | passed | brief.md | Scenario: workflow diff 审计——仅 `architecture-portability` job 变化，其余 6 job byte-identical；job id/name 仍 `architecture-portability`；无 `pull_request_target`；fork 路径 dtolnay 保持无 pin 参数；`timeout-minutes: 20`、 concurrency、`permissions` 不变。 | diff 14e7ecb→fe2e04a 仅 architecture-portability job 两 hunk；header 与其余 6 job byte-identical；job id/name/顺序/timeout 不变；on={push,pull_request}，pull_request_target 仅出现在禁止性注释；fork 路径 dtolnay 无 with/pin 仅加 github-hosted 分流；Lint 步骤零改动（无 env fork）。902d249 只动 STATE。 |
| A3 | passed | brief.md | Scenario: STATE 更新——窗 #6 补记入 risk 8（当日 6 窗口径）；P2-E2 COMPLETE （run id、runner identity、观察数据）；P2-E3 变 READY。 | STATE §3.12 P2-E2 COMPLETE（run id、runner identity、Lint/Proof 证据）；risk 8 窗 #6 补记（23:26–23:33 UTC，当日共 6 窗）；§5.1 P2-E3 READY。 |
| A4 | passed | brief.md | Scenario: 稳定性观察继续——本 packet 验证期故障窗四元组记录（或 "0 故障窗"）。 | P2-E2 验证期 0 故障窗显式记录（§3.12 + risk 8 2026-09-16 条目）；两 run 均首跑全绿。 |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| workflow-diff-audit | -c import yaml,subprocess;d=yaml.safe_load(open('.github/workflows/media-agent.yml'));jobs=d['jobs'];assert list(jobs)==['rust-format','architecture-portability','rust-clippy','session-lifecycle','rust-test-matrix','hardware-test-compile','gstreamer-build'];ap=jobs['architecture-portability'];assert ap['name']=='architecture-portability' and ap['timeout-minutes']==20 and 'self-hosted' in ap['runs-on'] and 'ubuntu-latest' in ap['runs-on'];on=d.get(True) or d.get('on');assert set(on)=={'push','pull_request'};cur=open('.github/workflows/media-agent.yml').read();old=subprocess.run(['git','show','14e7ecb:.github/workflows/media-agent.yml'],capture_output=True,text=True).stdout def jb(t,j): l=t.splitlines();o=[];c=False for x in l: if x.startswith(' '+j+':'):c=True elif c and x.startswith(' ') and x[2]!=' ' and not x.startswith(' #'):break if c:o.append(x) return chr(10).join(o) diffs=[j for j in jobs if j!='architecture-portability' and jb(cur,j)!=jb(old,j)];assert diffs==[],diffs;lint=ap['steps'][3];assert lint['name'].startswith('Architecture Lint') and 'env' not in lint;proof=ap['steps'][4];assert proof['name'].startswith('Architecture Proof');print('PASS: only architecture-portability changed; lint step untouched (no env fork); on keys push+pull_request') | . | passed | 0 | 83 ms |
| ci-runs-green | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; for RID in 35061944269 35062407052; do C=$(G gh run view $RID --json conclusion --jq '.conclusion'); B=$(G gh run view $RID --json jobs --jq '[.jobs[]\|select(.conclusion!="success")]\|length'); [ "$C" = success ] && [ "$B" = 0 ] \|\| { echo "FAIL run $RID: $C bad=$B"; exit 1; }; done; RN=$(G gh api repos/pwl1987/VBMF/actions/runs/35061944269/jobs --jq '.jobs[]\|select(.name=="architecture-portability")\|.runner_name'); echo "$RN" \| grep -Eq 'vbmf-ci-0[12]' && echo "PASS: both runs 7/7 green; arch-portability on $RN" | . | passed | 0 | 10493 ms |
| lint-proof-log-evidence | -c G(){ for i in 1 2 3 4 5; do "$@" && return 0; sleep 8; done; return 1; }; F=/tmp/p2e2-job.log; : > $F; JID=$(G gh api repos/pwl1987/VBMF/actions/runs/35061944269/jobs --jq '.jobs[]\|select(.name=="architecture-portability")\|.id'); for i in 1 2 3 4 5; do if gh run view 35061944269 --log --job=$JID >> $F 2>/dev/null && [ -s $F ]; then break; fi; gh api repos/pwl1987/VBMF/actions/jobs/$JID/logs >> $F 2>/dev/null && [ -s $F ] && break; sleep 10; done; grep -q "Runner name: 'vbmf-ci" $F && grep -q 'PASS — 受保护层' $F && grep -q 'RUNNER_ENV: self-hosted' $F && grep -q 'export RUSTUP_HOME=/usr/local/rustup' $F && grep -q 'target-arch' $F && grep -q 'unset RUSTUP_TOOLCHAIN' $F && grep -q 'remove-adapters] cargo check --no-default-features --features simulation' $F && grep -q 'remove-adapters] cargo check --no-default-features --features mock' $F && echo 'PASS: runner identity + lint pass + proof env contract + both feature checks in log' | . | passed | 0 | 4085 ms |
| state-closure-assertions | -c grep -q '3.12 P2-E2' .project/STATE.md && grep -q 'fe2e04a' .project/STATE.md && grep -q '35061944269' .project/STATE.md && grep -q '35062407052' .project/STATE.md && grep -q '23:26–23:33' .project/STATE.md && grep -qE '\\| \*\*P2-E3\*\* \\| \*\*READY\*\*' .project/STATE.md && grep -q '当日共 \*\*6 次\*\*\\|共 6 次\\|共 \*\*6 次\*\*' .project/STATE.md; grep -q '6 次' .project/STATE.md && echo 'PASS: STATE §3.12 closure, window #6 backfill, P2-E3 READY' | . | passed | 0 | 12 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- workflow-structure-invariants: passed — python yaml 断言：7 job 顺序不变；仅 architecture-portability diff；on={push,pull_request}；timeout 20；Lint 步骤零改动
- ci-run-35061944269: passed — push fe2e04a 首跑 7/7 全绿（无 rerun）；architecture-portability @vbmf-ci-01
- ci-run-35062407052-head-green: passed — STATE 闭环 push 902d249 首跑 7/7 全绿
- state-update: passed — commit 902d249：§3.12 COMPLETE、窗 #6 补记 risk 8（当日 6 窗）、P2-E3 READY、§2/§4/§5/§8/§9/§10 联动
- 已知限制: fork runs-on 分支仍未 live 实测（沿用 §3.9 口径）
- 已知限制: 出网缓解未裁决（观察继续）
- 已知限制: Lint/Proof 脚本本 packet 未改动但脚本自身的测试覆盖不在本 packet 范围

## 阻塞项

_无。_

## 风险与跳过的工作

- fork runs-on 分支仍未 live 实测（无外部 fork PR，沿用 §3.9 残余风险口径）
- 出网缓解方案未裁决（2026-09-15 累计 6 窗，2026-09-16 至今 0 窗；P2-E3 观察继续）
- architecture-portability 仅 vbmf-ci-01 单机 live 证据（ci-02 依赖后续自然调度命中）

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 1 | 1 | pass | — | P2-E2 architecture-portability 条件 runs-on 迁移完成：结构不变量保持、CI 两 run 首跑 7/7 全绿、Lint/Proof env 契约证据齐、窗 #6 补记 + P2-E3 READY。独立只读 Verifier agent 逐项复核 A1–A4 全 pass；Runtime 机械检查 4/4 PASS。 | 2026-09-16T06:34:32.161Z |



## 结论

P2-E2 architecture-portability 条件 runs-on 迁移完成：结构不变量保持、CI 两 run 首跑 7/7 全绿、Lint/Proof env 契约证据齐、窗 #6 补记 + P2-E3 READY。独立只读 Verifier agent 逐项复核 A1–A4 全 pass；Runtime 机械检查 4/4 PASS。
