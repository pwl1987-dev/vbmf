# 目标

P2-M2：把 `media-agent.yml` 的 `gstreamer-build` job 从 `ubuntu-latest` + secrets
注入迁移到 vbmf-media 条件 `runs-on`（冻结模式，与 P2-M1
hardware-test-compile 同构）。迁移后：

- trusted 路径（canonical `main` push / same-repo PR）恢复**真实构建**
  `cargo build --features bmd,gstreamer`（DeckLink SDK 头 host 预装 +
  GStreamer dev 系统库），`media-agent-gstreamer-linux` artifact 恢复非空产出；
- **D1 空过窗口关闭**（P2-M1 删 secrets 后该 job 在所有路径上 `env != ''` 门
  为假、空过绿；本迁移恢复语义正确的真实验证）；
- fork PR 路径语义不变：GitHub-hosted、无 SDK 源、构建步跳过、空过绿；
- P2-M 全链（P2-M0 裁决 → P2-M1 → P2-M2）收口，P2 Phase 2 灰度阶梯完成。

# 范围

单 workflow job 迁移 + 对应状态/文档收口；**无 host-admin 项**（media host
系统库 / Rust pin / SDK 16.0.0 已在 P2-M1 就绪，STATE §8 已登记 NO EXTERNAL
BLOCKER）。

1. `.github/workflows/media-agent.yml` — 仅改 `gstreamer-build` job：
   - `runs-on` 换为冻结条件表达式，tier 标签
     `["self-hosted","Linux","X64","vbmf","vbmf-media"]`（fork → `ubuntu-latest`）；
   - 删除 job env 中 `DECKLINK_SDK_INCLUDE`（workspace `_private` 路径）、
     `DECKLINK_SDK_HEADERS_1/2`、`DECKLINK_SDK_VERSION`（secrets 引用）、
     secret unpack 步骤、`if: always()` `_private` cleanup 步骤；新增
     `DECKLINK_SDK_INCLUDE_HOST: /usr/local/share/decklink-sdk/include`；
   - self-hosted 路径：fail-closed SDK 验证步（P2-M1 同款：目录 +
     `DeckLinkAPI.h` + VERSION=16.0.0）**扩展 pkg-config 门**
     （`pkg-config --exists gstreamer-1.0` 与
     `gstreamer-plugins-base-1.0`，缺即 fail-closed）；GITHUB_ENV Rust 契约
     （§3.6 RCA：`RUSTUP_HOME=/usr/local/rustup` + checkout 外
     `.cargo-home` + 独立 `target-gstbuild` + `DECKLINK_SDK_INCLUDE` 导出 +
     caller `RUSTUP_TOOLCHAIN` fail-closed）；构建步
     `cargo build --features bmd,gstreamer`；staging 拷贝 binary 入 workspace
     后 upload（upload-artifact v4 禁 `..` 路径，P2-E3 D5 模式）；
   - github-hosted（fork）路径：checkout + dtolnay + apt 安装系统依赖步保留
     （`runner.environment == 'github-hosted'` 门，fork 路径语义零变化），
     构建步 self-hosted-only；
   - `timeout-minutes: 30`、`CARGO_TERM_COLOR` 保持。
2. `docs/architecture/CI_RUNNER_STRATEGY.md` — 事实同步（非契约变更）：
   §15.1 表 `vbmf-ci-media` 行状态 🟡 规划 → ✅ 在役（两 media job 均已实跑）；
   `vbmf-ci-02` 行同步翻转（P2-A parity 后已在役，历史欠账）；
   §10 L218 说明列 "（secret 注入）" → host 预装口径（§15.3 裁决 B）。
3. `.project/STATE.md` — §3.16 P2-M2 收口记录；§2/§4/§5 推进到 P2-M 全链
   完成后的下一 READY（STAB-O3.1）；§5.1 P2-M2 COMPLETE；§8 blockers、
   §9/§10 相应更新。
4. CI 证据：push `main` 后 run 7/7 required 全绿（允许出网窗 rerun，risk 8
   口径），`gstreamer-build` 实跑 @ vbmf-media，artifact 非空。

# 非目标

- 不动其余 6 个 required job（byte-identical 断言）；
- 不新增/修改 pin/verify/collect/test 脚本（P2-M1 已冻结）；
- 无任何 host-admin / runner 注册 / SDK 变更；
- 不引入任何 GitHub secrets（混用禁令维持：host 预装是唯一 SDK 通道）；
- 不做 BMD 硬件验证（实机永走人工 acceptance 线）；
- 不改 required context 名称集合、不改 fork 安全边界、不建分支；
- 不处理 codeload 残余出网面（维持 rerun 口径，risk 8）。

# 验收示例

- Scenario: 结构迁移——`gstreamer-build` job 条件 `runs-on` 落地
  （vbmf-media tier 表达式与 P2-M1 逐字同构）；job id/`name:` 仍为
  `gstreamer-build`；job 内零 secrets 引用、零 `_private` 路径、零 unpack/
  cleanup 步；其余 6 个 job 与迁移前 byte-identical（本地 diff 断言）；
  workflow 无 `pull_request_target`、顶层 `permissions: contents: read`
  不变。
- Scenario: trusted 路径真实构建——push `main` 触发的 run 中
  `gstreamer-build` job 由 vbmf-media runner 执行（runner name/labels
  evidence）；log 显示 fail-closed SDK+GStreamer 验证步通过（打印 SDK
  版本，不打印头内容/hash）与真实 `cargo build --features bmd,gstreamer`
  编译；`media-agent-gstreamer-linux` artifact 存在且非空——D1 空过窗口
  关闭。
- Scenario: fork/GitHub-hosted 边界——结构审查：github-hosted 路径仅
  checkout + dtolnay + apt 系统依赖，构建/上传步全部
  `runner.environment == 'self-hosted'` 门控；fork PR 无 SDK 源（host 预装
  不在 GitHub-hosted 机上），空过绿语义与迁移前一致。
- Scenario: 7/7 required 全绿——迁移 commit 与最终 HEAD 的 CI run 全部
  required context PASS（允许出网窗 rerun）；7 个 context 名称与迁移前
  完全一致。
- Scenario: 状态/文档收口——STATE §3.16 完整记录（实现 commit、run id、
  runner identity、artifact 大小、出网窗计数如有）；Strategy §15.1/L218
  事实同步；§5.1 P2-M2 COMPLETE、P2-M 全链完成登记；Current Task 指向
  STAB-O3.1。

# 约束与不变量

- 红线（沿用全部既往约束）：repo public——LAN IP/SSH 指纹/账户/凭据不入
  repo/logs/evidence；SDK 专有头内容与 payload hash 不入 repo/logs/
  evidence（只记版本 + 计数）；单人单分支（main 唯一，不建分支）；fork PR
  永留 GitHub-hosted；禁 `pull_request_target`；7 required context 名称
  不变；SDK host 预装与 secrets 注入禁混用（secrets 通道已删，不得回引）。
- §3.6 RCA 调用契约：self-hosted 一切 rust 调用显式
  `RUSTUP_HOME=/usr/local/rustup`；`CARGO_HOME`/`CARGO_TARGET_DIR` 置于
  checkout 外持久目录；caller `RUSTUP_TOOLCHAIN` 存在即 fail-closed。
- upload-artifact v4 拒绝 `..` 路径 → staging 拷贝入 workspace。
- `target-gstbuild` 独立于 `target-hwtest`（feature 集不同，防缓存互踩，
  P2-E1 D3 模式）。
- verify 脚本零 mutation；`vbmf-ci` 零新增 sudo/root；宿主机零 git 操作。
- 本 packet 不改 pin/verify/collect/test 四脚本（P2-M1 冻结基线）。

# 决策

- D1（P2-M1 裁决遗留，用户已确认"接受窗口，M2 紧随"）：gstreamer-build
  空过窗口由本 packet 关闭；迁移前空过绿是已接受过渡态。
- D2（coordinator 裁定）：self-hosted 验证步在 SDK 门之外增加
  pkg-config `gstreamer-1.0` + `gstreamer-plugins-base-1.0` fail-closed 门
  （构建自然失败信息晦涩，显式门给出可读诊断；零成本）。
- D3（coordinator 裁定）：github-hosted 路径保留 apt 系统依赖安装步
  （fork 路径现状即执行该步；保留 = fork 语义零变化，符合冻结边界原则）。
- D4（coordinator 裁定）：Strategy §15.1 表 `vbmf-ci-02` 行一并翻转
  ✅ 在役（P2-A 后即为事实；历史欠账，一次性事实同步，非契约变更）。
- D5（coordinator 裁定）：host 侧零动作；若 CI 暴露 media host 库缺失/
  漂移，fail-closed 门会拦截，届时按 §15.10 runbook 单独走 host-admin
  授权，不混入本 packet。

# 待解决问题

（无——所有决定已裁决，无 `[blocking]` 项。）

# 验证预期

- 本地结构断言：其余 6 job byte-identical、job id/name 不变、`on:` 触发
  键与 workflow 顶层不变量不变、job 内无 secrets/`_private` 残留 grep 为零。
- 真实 CI：迁移 commit 的 run（7/7 required PASS，允许 rerun）+ 最终 HEAD
  run；`gh run view` / job log 取 runner identity（name + labels）与构建/
  验证步输出；artifact 列表取 `media-agent-gstreamer-linux` 非空证据。
- 独立只读 Verifier 全项验收 + Runtime 机械检查（结构断言脚本、gh CLI
  查询）；失败、阻塞、未执行、超时不算通过。
- STATE/Strategy 文档变更随实现 commit 入库。
