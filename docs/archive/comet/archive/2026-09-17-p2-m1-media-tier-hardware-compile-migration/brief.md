# 目标

P2-M1：`hardware-test-compile` 迁移到 `vbmf-media` self-hosted tier，落实 P2-M0
裁决 B（SDK host 预装 + 版本锁定 16.0.0，去 secret 化）。这是 P2 系列最后一个
media 层 packet 的前半（P2-M2 = gstreamer-build 随后）。

同时落盘 Strategy §15.11（出网 git 代理缓解文档化，P2-M0 欠账）。

# 范围

三段式（同 P2-E3 先例：repo 侧先行，host 侧带授权实施，workflow 最后切换）：

## 段 1：repo 侧脚本与文档

1. 新增 `scripts/ci/pin-decklink-sdk.sh`（root、幂等、fail-closed）：
   - 输入 `--tarball <path>` + `--version <x.y.z>`（只接受 exact，拒绝 floating）；
   - 校验 tarball 内含 `Linux/include/*.h`（至少 `DeckLinkAPI.h`）；
   - 安装头文件到 canonical 路径 `/usr/local/share/decklink-sdk/include/`，
     写 `/usr/local/share/decklink-sdk/VERSION`；
   - 不回显 tarball 内容、不打印 header 内容（专有资产零日志纪律）。
2. 新增 `scripts/ci/verify-decklink-sdk.sh`（非 root、零 mutation）：
   - V1 include 目录存在且非空；V2 VERSION == `--expect-version`；
   - V3 关键头存在（DeckLinkAPI.h / DeckLinkAPIConfiguration.h /
     DeckLinkAPIModes.h / DeckLinkAPIDispatch.h）；
   - V4 非 root 可读；非 canonical `--root` 输出 TEST-ONLY 标记
     （与 verify-system-rust.sh 同构）。
3. `scripts/ci/collect-toolchain.sh`：增加 SDK 段（version + header 计数），
   目录缺失时记 `absent`（general runner 上不失败）。
4. 新增 `scripts/ci/test-decklink-sdk-scripts.sh`（非 root、零网络、fixture
   树覆盖 pin 参数 fail-closed 与 verify 各失败模式 + happy path）。
5. Strategy 文档：
   - §15.3 义务 1 落地：`vbmf-media` tier 供给 runbook 扩展（系统库清单
     libclang / GStreamer dev / protobuf-compiler / pkg-config + Rust pin +
     SDK pin 同构流程）；
   - 新增 §15.11：出网 git 代理缓解文档化（host 级 git system config 指向
     devbox 8118；不触碰 systemd unit / runner .env / workflow env；残余面
     codeload action 下载维持 rerun 口径）；
   - `ci-infra-probe.yml` tier allowlist 增加 `vbmf-media`。

## 段 2：host 侧供给（逐项 host-admin 授权，实施时单独申请）

6. 新 KVM VM `vbmf-ci-media`（devbox libvirtd，规格对齐 ci-02：8C·16G·100G，
   池余量实施时实测为准）+ apt 系统库（bindgen/GStreamer dev/protobuf 面全装，
   为 P2-M2 预铺）。
7. Runner 供给：同 runbook（provision-runner.sh + systemd 模板），labels
   `vbmf,vbmf-media`；R1–R5 + probe（tier=vbmf-media）实测。
8. System Rust 1.98.1 pin（§15.9 同构：bundle、checksum、V1–V6、manifest）。
9. DeckLink SDK 16.0.0 pin：tarball 经 out-of-band 通道上机（来源见 D2），
   pin + verify + manifest。

## 段 3：workflow 迁移与 secrets 收口

10. `hardware-test-compile` job：
    - 条件 `runs-on`（冻结模式，标签换 `vbmf-media`）；
    - 删除 `DECKLINK_SDK_HEADERS_1/2` / `DECKLINK_SDK_VERSION` job env、
      unpack 步骤、`_private` 组装与 cleanup 步骤；
    - self-hosted 路径：fail-closed SDK 验证步（路径 + VERSION == 16.0.0，
      缺失即失败，不空过）+ §3.6 RCA Rust env 契约 + checkout 外
      `target-hwtest` + upload 前 staging 拷贝（P2-E3 D5 模式，`..`-free）；
    - github-hosted（fork）路径：checkout 后各步空过（语义与现状 fork 一致），
      dtolnay/apt 保留为 github-hosted-only；
    - required context 名不变：`hardware-test-compile`。
11. GitHub secrets 删除（收口时）：`DECKLINK_SDK_HEADERS_1` /
    `DECKLINK_SDK_HEADERS_2` / `DECKLINK_SDK_VERSION`，`gh secret list`
    留证。
12. STATE §3.15 收口记录 + §5.1 队列推进（P2-M1 COMPLETE、P2-M2 READY）+
    risk 8 持续观察。

# 非目标

- `gstreamer-build` 迁移（P2-M2；本 packet 不改其 yaml——secrets 删除后其
  `env.X != ''` 门自然为假，进入裁决既定的空过窗口，见 D1）；
- 任何 BMD 实机 / libDeckLinkAPI.so 链接 / 真硬件验证（GATE-C 人工线不变；
  capability build 不冒充硬件验证）；
- `vbmf-general` 池两机任何变更；
- SDK 版本升级（16.0.0 之外不碰；升级走独立 host-admin runbook 罕见事件）。

# 验收示例

- Scenario: repo 侧四件齐——`scripts/ci/pin-decklink-sdk.sh`、
  `verify-decklink-sdk.sh`、`test-decklink-sdk-scripts.sh` 存在且测试全 PASS
  （含各 fail-closed 路径）；`collect-toolchain.sh` 含 SDK 段且回归测试保持
  全 PASS。
- Scenario: `vbmf-ci-media` 上线——API 可见、online、labels exact
  {self-hosted,Linux,X64,vbmf,vbmf-media}；probe（tier=vbmf-media）PASS；
  Rust V1–V6 PASS（1.98.1）+ SDK V1–V4 PASS（16.0.0）+ manifest 双记录落盘。
- Scenario: workflow 迁移——条件 runs-on（vbmf-media）；`DECKLINK_SDK_HEADERS_1/2`
  /`DECKLINK_SDK_VERSION` env、unpack、`_private` cleanup 步全删；self-hosted
  fail-closed SDK 验证步存在；github-hosted（fork）路径空过语义不变。
- Scenario: GitHub secrets 三分片（`DECKLINK_SDK_HEADERS_1/2` +
  `DECKLINK_SDK_VERSION`）已删除，`gh secret list` 留证。
- Scenario: 最终 HEAD CI 7/7 全绿（允许出网窗 rerun）；hardware-test-compile
  实跑在 vbmf-ci-media——log 中 runner_name + `cargo build --features
  hardware-test` 退出 0 + `media-agent-linux` artifact 上传成功（非空过）。
- Scenario: Strategy §15.3 义务 1（media tier runbook）与 §15.11（出网缓解）
  落盘；STATE §3.15 收口 + P2-M2 转 READY；gstreamer-build 空过窗口按 D1
  裁决口径显式记录，required context 仍绿。

# 约束与不变量

- 红线全部沿用：LAN IP / SSH 凭据 / 账户名不入 repo 与 evidence；SDK 专有
  header 内容不入 repo/logs/evidence（只记版本 + 文件计数 + SHA256 可否？
  ——不可：SDK tarball 的 hash 也足以指纹专有资产，只记版本号与头文件名清单）；
- `vbmf-ci` 零 sudo/root 不变；verify 脚本零 mutation；宿主机零 git 仓库操作；
  probe 红线不变（proxy env 取证面零污染）；
- 单人单分支：直接 `main`，无分支无 PR；
- 7 required context 名称不变；fork PR 永留 GitHub-hosted；禁
  `pull_request_target`；
- 二选一禁混用：workflow 内 secrets 注入路径与 host 预装路径不得并存——
  M1 收口即删 secrets 分片，过渡序列按 P2-M0 裁决记录执行；
- host-admin 每项单独授权（STATE blocker 口径）；跨机脚本执行读自身退出码，
  禁 timeout+pipe 截断（P2-E3 RCA）。

# 决策

- **D1（用户裁决 2026-09-16：接受窗口，M2 紧随）** gstreamer-build 在 M1
  收口至 M2 完成之间的空过窗口：secrets 删除后其 build/upload 步 `env != ''`
  门为假，github-hosted 上空过（required context 仍绿，
  media-agent-gstreamer-linux artifact 暂不产出）。队列纪律：一次一个
  required job（§15.2 阶梯先例）；窗口在 STATE 显式记录，M2 紧随补上。
- **D2（用户确认 2026-09-16：可提供）** DeckLink SDK 16.0.0 tarball 来源：
  用户经 out-of-band 通道提供（当年制 secret 时的 SDK 副本，如
  Blackmagic_DeckLink_SDK_16.0.0.tar.gz）；段 2 实施时放到约定位置，从
  devbox 上机。
- D3 SDK canonical 路径 = `/usr/local/share/decklink-sdk/include/`（不带版本
  段）+ `VERSION` 文件锁版本：版本约束由 verify gate + manifest 承载，upgrade
  走 host-admin runbook 原地替换 + 重验证（workflow 不因升级改路径）。
- D4 media VM 规格对齐 ci-02（8C·16G·100G qcow2 overlay）；池余量实测不足时
  降规格重报，不 silently 改。
- D5 gstreamer-build yaml 本 packet 零改动（其 secrets 引用变为死引用但无害，
  M2 整体重写；避免 M1 内混入 P2-M2 范围）。

# 待解决问题

- 无（D1/D2 已裁决，见决策）。

# 验证预期

- `scripts/ci/test-decklink-sdk-scripts.sh` 全 PASS；
- `scripts/ci/test-system-rust-scripts.sh` 保持全 PASS（collect 扩展不回归）；
- media host V1–V6（Rust）+ V1–V4（SDK）+ probe 双证据；
- workflow yaml 语法过（actionlint 或 CI 自身）；
- 最终 HEAD 7/7 全绿 + AC6 实跑证据。
