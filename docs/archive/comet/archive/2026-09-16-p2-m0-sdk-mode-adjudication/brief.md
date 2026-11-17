# 目标

P2-M0：DeckLink SDK 注入模式裁决——**用户已裁定 B（media 主机预装 + 版本锁定，
去 secret 化）**（2026-09-16）。本 packet 把裁决落入
`docs/architecture/CI_RUNNER_STRATEGY.md` 并解锁 P2-M1。

同时补记：2026-09-16 窗 #2（10:09–10:22 UTC，ci-01，run `35083349130`，2 次
rerun）与窗 #3（11:54–11:59 UTC，ci-02，run `35091905412`，1 次 rerun）入
STATE risk 8。

# 裁决内容（D1，用户 2026-09-16 选定）

- **B. media 主机预装 + 版本锁定**：DeckLink SDK 头文件经 §15.9 out-of-band
  通道预装到 media runner（版本锁定 + verify gate + manifest 记录，
  Acceptance Manifest 式）；CI workflow 不再持有/组装 SDK secrets。
- 裁决理由：
  1. 去 secret 化——public repo + self-hosted runner + secrets 是 GitHub 官方
     劝退组合；B 消除该面；
  2. 专有头文件彻底离开 GitHub 存储（license 风险面缩小）；
  3. 与已验证的系统 Rust pin 同构（§15.9 runbook + verify + manifest 治理面，
     可审计可重复）；
  4. 消除 30KB secret 分片 hack（GitHub secret 大小限制催生的补丁）；
  5. 系统依赖（libclang/GStreamer dev/protobuf）因 `vbmf-ci` 零 sudo 红线本就
     必须 host 预装——SDK 预装是同一供给面，非额外负担。
- 隐含义务（落 Strategy，P2-M1 前执行）：
  - media runner tier（`vbmf-media`，§15.3 L218 既定归属）供给 runbook 扩展：
    SDK 预装脚本（pin/verify/collect 同构，版本锁定 `16.0.0`）+ 系统库清单；
  - workflow 侧删除 `DECKLINK_SDK_HEADERS_1/2` 注入路径与 `_private` 组装/清理
    步骤，改为宿主路径存在性门控（fork/GitHub-hosted 路径维持现状空过语义）；
    GitHub secrets 中的 SDK 分片在 P2-M1 收口时删除；
  - SDK 升级走 host-admin runbook（罕见事件，SDK 16.0.0 稳定）。

# 范围

- `docs/architecture/CI_RUNNER_STRATEGY.md` §15.3 决策点段落（A/B 标注已裁决
  + 理由 + 隐含义务）；
- `.project/STATE.md`（窗 #2/#3 补记 risk 8、§3.14 P2-M0 COMPLETE、P2-M1 READY）；
- 本 change 的 Comet 正式产物。

# 非目标

- media runner 实际供给/注册（P2-M1 范围）；
- workflow `hardware-test-compile`/`gstreamer-build` 任何改动（P2-M1/M2 范围）；
- secrets 删除操作本身（P2-M1 收口时执行）；
- BMD 实机验收流程变更（永走人工线）。

# 验收示例

- Scenario: Strategy §15.3 决策点段落更新为"已裁决 B"（含日期、理由五条、
  隐含义务三条），A 选项标注未采纳及原因；其余章节除必要交叉引用外不变。
- Scenario: STATE 更新——risk 8 补记 2026-09-16 窗 #2/#3 四元组（当日累计 3 窗）；
  §3.14 P2-M0 COMPLETE（裁决记录）；§5.1 P2-M1 READY。
- Scenario: docs-only 变更，CI 7/7 required 保持全绿（无代码路径变化）。

# 约束与不变量

- 二选一、禁止混用：裁决后不得同时保留 secrets 注入与 host 预装双通道
  （过渡期：P2-M1 实施前 workflow 现状 secrets 注入仍为唯一活通道，Strategy
  记录迁移序列即可，不构成混用）。
- 本 repo public：SDK 内容/指纹/内部地址不入 repo/logs/evidence。
- 7 required context 名称不变；`vbmf-ci` 零新 sudo。

# 决策

- D1（用户，2026-09-16）：选 B（host 预装 + 版本锁定），理由与隐含义务见上。
- D2（coordinator）：裁决以 docs-only change 落盘（Strategy + STATE），供给与
  workflow 实施拆入 P2-M1/M2（bounded packets）。
- D3（coordinator）：窗 #2/#3 补记随本 packet STATE 更新（P2-E3 验收 risks
  顺延口径）。

# 待解决问题

（无——D1 已裁定。）

# 验证预期

- Strategy diff 审计：仅 §15.3 决策段落变化；
- STATE 断言：窗 #2/#3 四元组、P2-M0 COMPLETE、P2-M1 READY；
- push 后 CI 7/7 全绿（docs-only；出网窗 rerun 可接受）。
