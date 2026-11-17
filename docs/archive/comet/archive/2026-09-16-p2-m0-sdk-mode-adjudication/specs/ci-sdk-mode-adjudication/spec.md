# ci-sdk-mode-adjudication spec

## Authority

- 用户裁决（2026-09-16）：B（media 主机预装 + 版本锁定，去 secret 化）；
- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.3 决策点段落（L388–391）、
  L218（hardware-test-compile/gstreamer-build → `vbmf-media` 归属）、§15.9
  （out-of-band host-admin runbook 既有治理面）；
- `.project/STATE.md` §3.13（rustdoc host-admin 先例）、risk 8（窗 #2/#3
  补记义务）。

## Strategy §15.3 修改（唯一文档改动）

将现有决策点段落：

```
**SDK 注入模式决策点（P2-M 前必须二选一，不得混用）**：

- **A. 维持 secrets 分片注入**（`DECKLINK_SDK_HEADERS_1/2`，现状）——CI 内组装；
- **B. media 主机预装 + 版本锁定**（Acceptance Manifest 式记录）——去 secret 化。
```

替换为裁决记录：已裁决 B（2026-09-16，P2-M0）+ 五条理由 + 三条隐含义务 +
A 未采纳原因（secret 面 / 分片 hack / 供给面重复）。措辞遵循本文档既有风格，
不新增章节编号。

## STATE 修改

1. risk 8：2026-09-16 补记窗 #2（10:09–10:22 UTC，ci-01，run `35083349130`，
   arch-portability×2 + session-lifecycle，2 rerun）与窗 #3（11:54–11:59 UTC，
   ci-02，run `35091905412`，arch-portability，1 rerun）——当日累计 3 窗；
2. 新 §3.14 P2-M0 COMPLETE（裁决 + 理由摘要 + 隐含义务）；
3. §5.1：P2-M0 COMPLETE 行、P2-M1 READY；§2/§4/§5/§10 联动。

## 验证

1. `git diff` 审计：Strategy 仅 §15.3 决策段落变化；STATE 变化限于上述三项。
2. STATE grep 断言：`10:09–10:22`、`11:54–11:59`、`P2-M0` COMPLETE、
   `P2-M1` READY、`已裁决 B`。
3. push `main` → CI 7/7 required 全绿（docs-only；出网窗 rerun 可接受，计数）。
