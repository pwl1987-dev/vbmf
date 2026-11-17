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
- 完成时间: 2026-09-15T11:19:23.229Z
- 摘要: All 6 acceptance items independently verified pass; bundle byte-identity to P2-C1 proven by hash recompute; symmetric pin evidence complete.

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | Scenario: coordinator 确认 SHA 的 bundle 在 Development VM 生成成功，`BUNDLE_SOURCE_SHA` 与 `SHA256SUMS` 完整记录为 evidence。 | BUNDLE_SOURCE_SHA=9e47721 recorded; three script hashes independently recomputed at 9e47721/b0f5df3/HEAD, exact match to §3.6 values |
| A2 | passed | brief.md | Scenario: `vbmf-ci-02` guest 上 `sha256sum -c SHA256SUMS` 全 PASS；首次 `pin-system-rust.sh --version 1.98.1` 输出 `PINNED_RUST_VERSION=1.98.1`，第二次原样重跑 0 退出且版本不变。 | guest checksum 3/3 OK; two consecutive pin runs exit 0, PINNED_RUST_VERSION=1.98.1; 'unchanged' nuance disclosed and consistent |
| A3 | passed | brief.md | Scenario: 正式 `verify-system-rust.sh --expect-version 1.98.1` 输出 `RESULT: PASS`（V1–V4 全 PASS）。 | V1-V4 RESULT: PASS with versions exactly symmetric to host1 §3.6 |
| A4 | passed | brief.md | Scenario: 以 `vbmf-ci` 身份（显式 `RUSTUP_HOME`/`CARGO_HOME`）刷新 `/data/actions-runners/vbmf/manifests/vbmf-ci-02/`，记录 rustc/cargo 1.98.1 与 `/usr/local` 路径。 | manifest as vbmf-ci with explicit env @2026-09-15T11:14:31Z, rustc/cargo 1.98.1 at /usr/local/bin |
| A5 | passed | brief.md | Scenario: 管理机 `verify-runner.sh --name vbmf-ci-02` 输出 `RESULT: PASS`（R1–R5 + scope），且 `.project/STATE.md` 登记全部证据并置 P2-C2 COMPLETE / P2-C3 READY。 | verify-runner-host2 log R1-R5+R5b+scope PASS; STATE §3.7 + §5.1 P2-C2 COMPLETE / P2-C3 READY in 05d130d |
| A6 | passed | brief.md | Scenario: 单分支保持：全程无新建分支/worktree，收尾时本地与远端分支仅存 `main`。 | remote heads main only; single local branch/worktree; commit on main |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| script-focal-tests-41 | — | . | passed | 0 | 968 ms |
| bundle-determinism-9e47721 | -c D=$(mktemp -d) && scripts/ci/prepare-system-rust-bundle.sh --repo . --sha 9e47721eb30355ffe23cea12592445e8f0575c6a --out "$D" \| grep -q 'BUNDLE_SOURCE_SHA=9e47721eb30355ffe23cea12592445e8f0575c6a' && grep -q '46056167848a2e1a71350650650ed7fcd2073aa504474ffafe0e2e6f31d995b1' "$D/SHA256SUMS" && grep -q 'd0ae04fc424824951fabb9154da5e0bb766bdaa54d72f182d7d5fa61c03d57db' "$D/SHA256SUMS" && rm -rf "$D" | . | passed | 0 | 58 ms |
| verify-runner-host2 | --name vbmf-ci-02 | . | passed | 0 | 2824 ms |
| remote-branch-convergence | -c test "$(git ls-remote --heads origin \| awk '{print $2}' \| tr '\n' ' ')" = 'refs/heads/main ' | . | passed | 0 | 3123 ms |
| git-clean-check | diff --check | . | passed | 0 | 8 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- bundle-prep-exact-sha: passed — BUNDLE_SOURCE_SHA=9e47721eb30355ffe23cea12592445e8f0575c6a; local sha256sum -c 3/3 OK; SHA256SUMS identical to P2-C1 bundle
- guest-bundle-checksum: passed — sha256sum -c SHA256SUMS 3/3 OK on vbmf-ci-02
- guest-first-pin-and-idempotence: passed — two consecutive sudo pin runs exit 0, PINNED_RUST_VERSION=1.98.1 unchanged
- guest-verifier-v1-v4: passed — RESULT: PASS; rustc 1.98.1 (48a229cea), cargo 1.98.1 (797e8a9bc), rustfmt 1.9.0-stable; rustup default exact, no rolling stable
- guest-manifest-refresh: passed — sudo -u vbmf-ci env RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo bash collect-toolchain.sh; manifest @2026-09-15T11:14:31Z
- admin-verify-runner-host2: passed — verify-runner.sh --name vbmf-ci-02: R1-R5 + scope RESULT: PASS
- git-diff-check: passed — clean; commit 05d130d touches .project/STATE.md only
- rust-script-tests-41: not-run — no scripts/ci changes; 41/41 PASS stands from CI run 34961151910 on 9e47721
- push-origin-main: not-run — deferred to Archive pending user authorization
- 已知限制: guest host-key verification relied on devbox single-path keyscan + user console confirmation (qemu-guest-agent exec unavailable on this virsh); no second automated path exists for NAT guest
- 已知限制: first pin run printed 'unchanged' for toolchain components (components pre-seeded during earlier provisioning); default/symlink completion done this round; idempotence proven by two consecutive exit-0 runs
- 已知限制: commit 05d130d local main only; push deferred to Archive

## 阻塞项

_无。_

## 风险与跳过的工作

- three check logs 0-byte (capture gap) compensated by independent hash recompute / ls-remote / git status
- guest host-key verification = single-path keyscan + user console confirmation, disclosed

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 1 | 1 | pass | — | All 6 acceptance items independently verified pass; bundle byte-identity to P2-C1 proven by hash recompute; symmetric pin evidence complete. | 2026-09-15T11:19:23.229Z |



## 结论

All 6 acceptance items independently verified pass; bundle byte-identity to P2-C1 proven by hash recompute; symmetric pin evidence complete.
