---
generated_from_state_version: 10
---

# 验证

## 当前结果

- 结果: **已归档**
- 验证情况: **已完成检查，验证结果已确认**
- 目标周期: 2
- 迭代: 1
- 验证器尝试次数: 1
- 完成时间: 2026-09-17T02:36:04.026Z
- 摘要: 6/6 验收独立核验通过；Runtime 6 项机械检查全过（含测试套件实跑 29/29+48/48，补齐 Verifier 只读约束下无法执行的缺口）。证据链：repo diff 审计 + GitHub API（runner/probe/secrets/runs/artifacts/branch protection）+ Runtime 实跑。

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | Scenario: repo 侧四件齐——`scripts/ci/pin-decklink-sdk.sh`、 `verify-decklink-sdk.sh`、`test-decklink-sdk-scripts.sh` 存在且测试全 PASS （含各 fail-closed 路径）；`collect-toolchain.sh` 含 SDK 段且回归测试保持 全 PASS。 | 四脚本在位；独立 Verifier 静态核验 fail-closed 逻辑与检查计数；Runtime 实跑 test-decklink-sdk-scripts.sh RESULT: PASS (29) + test-system-rust-scripts.sh RESULT: PASS (48) |
| A2 | passed | brief.md | Scenario: `vbmf-ci-media` 上线——API 可见、online、labels exact {self-hosted,Linux,X64,vbmf,vbmf-media}；probe（tier=vbmf-media）PASS； Rust V1–V6 PASS（1.98.1）+ SDK V1–V4 PASS（16.0.0）+ manifest 双记录落盘。 | API 证据 vbmf-ci-media online + labels exact {self-hosted,Linux,X64,vbmf,vbmf-media}；probe run 35171303939 success @ vbmf-ci-media；host V 门与 manifest 记录见 STATE §3.15 并由 A5 生产 CI 实跑佐证；Runtime check m1x-runner-v2=online |
| A3 | passed | brief.md | Scenario: workflow 迁移——条件 runs-on（vbmf-media）；`DECKLINK_SDK_HEADERS_1/2` /`DECKLINK_SDK_VERSION` env、unpack、`_private` cleanup 步全删；self-hosted fail-closed SDK 验证步存在；github-hosted（fork）路径空过语义不变。 | git diff 4f07914..5007096 单 hunk 限于 hardware-test-compile：条件 runs-on vbmf-media 新增；secrets env/unpack/_private cleanup 全删；fail-closed SDK 步在位；gstreamer-build job 体未动 |
| A4 | passed | brief.md | Scenario: GitHub secrets 三分片（`DECKLINK_SDK_HEADERS_1/2` + `DECKLINK_SDK_VERSION`）已删除，`gh secret list` 留证。 | gh secret list 空 + API total_count=0；三分片 DECKLINK_SDK_HEADERS_1/2 + DECKLINK_SDK_VERSION 删除；Runtime check m1x-secrets-v2=0 |
| A5 | passed | brief.md | Scenario: 最终 HEAD CI 7/7 全绿（允许出网窗 rerun）；hardware-test-compile 实跑在 vbmf-ci-media——log 中 runner_name + `cargo build --features hardware-test` 退出 0 + `media-agent-linux` artifact 上传成功（非空过）。 | run 35173987951 (HEAD 5007096) 7/7 全绿且 job 名与 branch protection required contexts 精确一致；run 35172539232 hardware-test-compile runner=vbmf-ci-media 实跑：log 'DeckLink SDK: 16.0.0 (host-preprovisioned)' + media-agent-linux 6495056B + decklink-bindings-debug 15872B 非空过；Runtime check m1x-ci-v2=success |
| A6 | passed | brief.md | Scenario: Strategy §15.3 义务 1（media tier runbook）与 §15.11（出网缓解） 落盘；STATE §3.15 收口 + P2-M2 转 READY；gstreamer-build 空过窗口按 D1 裁决口径显式记录，required context 仍绿。 | Strategy §15.10/§15.11 在位；STATE §3.15 COMPLETE + §5.1 P2-M1 COMPLETE/P2-M2 READY；gstreamer-build 空过窗口显式记录且实证（35172539232 有 gstreamer artifact 11683790B、最终 run 无而 context 仍绿）；Runtime check m1x-state-v2=MARKERS_OK |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| decklink script tests | scripts/ci/test-decklink-sdk-scripts.sh | . | passed | 0 | 391 ms |
| system rust script regression | scripts/ci/test-system-rust-scripts.sh | . | passed | 0 | 1727 ms |
| vbmf-ci-media online | -c gh api repos/pwl1987/VBMF/actions/runners --jq '.runners[] \| select(.name=="vbmf-ci-media") \| .status' | . | passed | 0 | 1063 ms |
| final HEAD CI conclusion | -c gh run view 35173987951 --json conclusion --jq .conclusion | . | passed | 0 | 1507 ms |
| SDK secrets total_count | -c gh api repos/pwl1987/VBMF/actions/secrets --jq .total_count | . | passed | 0 | 1091 ms |
| STATE closure markers | -c grep -c 'COMPLETE（§3.15' .project/STATE.md; grep -c '15.10' docs/architecture/CI_RUNNER_STRATEGY.md | . | passed | 0 | 7 ms |
| decklink script tests | scripts/ci/test-decklink-sdk-scripts.sh | . | passed | 0 | 383 ms |
| system rust script regression | scripts/ci/test-system-rust-scripts.sh | . | passed | 0 | 1751 ms |
| vbmf-ci-media online | -c gh api repos/pwl1987/VBMF/actions/runners --jq '.runners[] \| select(.name=="vbmf-ci-media") \| .status' | . | passed | 0 | 1027 ms |
| final HEAD CI conclusion | -c gh run view 35173987951 --json conclusion --jq .conclusion | . | passed | 0 | 1507 ms |
| SDK secrets total_count | -c gh api repos/pwl1987/VBMF/actions/secrets --jq .total_count | . | passed | 0 | 1138 ms |
| STATE closure markers | -c grep -q 'COMPLETE（§3.15' .project/STATE.md && grep -q '### 15.10' docs/architecture/CI_RUNNER_STRATEGY.md && grep -q '### 15.11' docs/architecture/CI_RUNNER_STRATEGY.md && echo MARKERS_OK | . | passed | 0 | 9 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- test-decklink-sdk-scripts.sh: passed — 29/29 PASS 本地 Development VM
- test-system-rust-scripts.sh: passed — 48/48 PASS 回归无破坏
- verify-runner.sh --name vbmf-ci-media: passed — R1-R5 PASS，labels exact {self-hosted,Linux,X64,vbmf,vbmf-media}
- ci-infra-probe tier=vbmf-media: passed — run 35171303939 success runner=vbmf-ci-media，rustc /usr/local/bin 1.98.1
- verify-system-rust.sh on media host: passed — V1-V6 全 PASS，幂等双 pin
- verify-decklink-sdk.sh on media host: passed — V1-V4 全 PASS，42 头，VERSION 16.0.0；manifest decklink_sdk 段落盘
- CI run 35172539232: passed — 7/7（一次出网窗 checkout GnuTLS rerun 后全绿）；hardware-test-compile @ vbmf-ci-media 实跑：log 'DeckLink SDK: 16.0.0 (host-preproperly preprovisioned)'、media-agent-linux 6495056B、decklink-bindings-debug 15872B
- CI run 35173987951: passed — 最终 HEAD 5007096 7/7 首跑全绿；gstreamer-build secrets 删除后空过绿（D1 裁决口径）
- gh secret list: passed — 空——DECKLINK_SDK_HEADERS_1/2 + DECKLINK_SDK_VERSION 已删
- 已知限制: gstreamer-build 空过窗口开启至 P2-M2（用户裁决 D1）
- 已知限制: media VM 与双 general 机同 devbox 物理故障域（risk 3 既有口径）

## 阻塞项

_无。_

## 风险与跳过的工作

- gstreamer-build 空过窗口开启至 P2-M2（用户裁决 D1）；media VM 与双 general 机同 devbox 物理故障域（risk 3 既有）

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 0 | 0 | recovery | — | Native Shape artifacts changed | 2026-09-17T00:32:16.920Z |
| 2 | 1 | 1 | pass | — | 6/6 验收独立核验通过；Runtime 6 项机械检查全过（含测试套件实跑 29/29+48/48，补齐 Verifier 只读约束下无法执行的缺口）。证据链：repo diff 审计 + GitHub API（runner/probe/secrets/runs/artifacts/branch protection）+ Runtime 实跑。 | 2026-09-17T02:36:04.026Z |



## 结论

6/6 验收独立核验通过；Runtime 6 项机械检查全过（含测试套件实跑 29/29+48/48，补齐 Verifier 只读约束下无法执行的缺口）。证据链：repo diff 审计 + GitHub API（runner/probe/secrets/runs/artifacts/branch protection）+ Runtime 实跑。
