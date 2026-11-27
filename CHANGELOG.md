# 变更日志

VBMF（IP Broadcast Media Fabric）的所有重要变更都记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

> **V0.2 架构基线已 LOCK FINAL**（22 轮 review）。
> 任何 V0.2.x 架构 review 已永久关闭。Phase 0.5/0.6 阶段以 Acceptance Validation 为主。

## [未发布]

### 2026-11-27 · 顶层产品 PRD + M0 文档对账（§3.127 / §3.128）

- **新增 `docs/VBMF_PRODUCT_PRD.md`（V1.0 DRAFT，876 行）—— 产品层唯一入口**：定位与价值主张 · 4 角色矩阵 + 危险操作分层 L1-L3 · 4 条关键操作链逐步骤与验收判据 · 56 表面总表与 B0-B6 分批 · 架构约束索引 + 架构 13 实体 ↔ 产品 15 对象映射 · 部署形态与限流与稳定性绑定 · 现状基线与 13 项文档漂移 · M0-M5 路线图 · 6 项待拍板。三份旧 PRD（总架构升级 / Portability / External API）文件头加状态 banner（已执行 / 已执行 / 裁剪采纳），**原文一字未删**。
- **M0 文档对账（28 个文档门禁问题 → 0）**：① Phase 0.6 canonical FI 集合实为 **10**（FI-01A/01B/02~09），文档长期写「8」⇒ **16 处口径订正**（phase-0.6 README / ROOT README / ROADMAP / CONTRIBUTING / phase-0.5 INDEX），CONTRIBUTING 的 FI 枚举补 FI-08/09；② **新增 2 条 Phase 0.6 可执行用例**（`tests/FI-08-001.yaml` / `tests/FI-09-001.yaml` + 对应夹具 F-FI-08-INGEST-CRASH / F-FI-09-AGENT-RESTART），补上「定义了但无 Test Case」的两条债；③ 修 1 处死锚点（SYSTEM_AND_PROJECT_PLAN TOC）+ 5 处归档死链；④ **`scripts/check_docs.py` 进 CI**（v3-harness-tooling 新增 doc consistency gate，自动装 PyYAML）；⑤ README 核心能力表 / 演进表 / English 段改为**实测口径**（Media Agent = ✅ STABILITY VERIFIED、Web Console = 🟡 2/32 LOCK 表面、Phase 0.6 = 🟡 规范已建模 G-DOC-READY PASS）；⑥ 「22 原则」宣称点降级为「声明 22 条 / 当前成文 7 条」（**冻结的 ARCHITECTURE_V0.2.md 未动**）；⑦ gap matrix 加对账说明（两行 Gate 的 BLOCKED vs PASS 冲突**未擅自统一**，须以 Linux 编译级证明裁定）；⑧ debt 清单 D2/D4/D5/D6 主表与优先级分组段对齐；⑨ `current-work.yaml`（stability_verified / runtime_commit / binary md5 / summary）与 AGENTS.md 摘要对齐实态；⑩ 角色定义 3 套并存（4 角色 / 7 角色 / 4 角色含 SRE）在 NAVIGATION 与 PIA 标注权威版 + 待收敛。
- **D6/D7 裁定（同日补做）**：`ARCH-PORTABILITY-01` / `ARCH-BACKEND-01` 两行 Gate 的 `NOT_PASSED / BLOCKED` 状态，经 **Linux CI 实跑** `scripts/check_remove_adapters.py`（run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02` self-hosted Linux / 2026-11-27T14:00:24Z）→ `cargo check --no-default-features --features simulation` + `--features mock` → **PROOF OK: Domain/Contracts/Runtime compile without concrete adapters** ⇒ **两行 Gate = PASS**。同步订正 gap matrix 两行 + 8 份关联文档状态括注（IMPLEMENTATION_ADDENDUM ×2 / ARCHITECTURE_DECISION_LOG ×2 / VENDOR_NEUTRALITY_RULES / DOCUMENT_STATUS_MODEL / PHASE_0_6_MASTER_PRD），2 份评审留档（REVIEW_2026-08-28 / PRD_REVIEW_RUNTIME_ABSTRACTION）按 provenance 原则只加指向不改原文。**边界**：该证明覆盖「删除 concrete adapter 后 Domain/Contracts/Runtime 指定构建路径仍编译」，不等于整个项目完全 vendor-independent；真实换型 BMD→AJA 验收仍未做。

- **gap matrix 结论段口径订正（§3.130）**：`PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「结论」段与本表矩阵实态冲突 ⇒ **整段按实态订正**（每条附原句留痕）。逐行对账（`awk -F'|'` 统计 + `git show HEAD:` 取 2026-08-30 原版对照）：当前 Implementation = `IMPLEMENTED` 10 / `PARTIAL` 4 / `IN_PROGRESS` 1 / `NOT_STARTED` 1，Gap = `PASS` 10 / `PARTIAL` 5 / `OPEN` 1 ⇒ 原句「Implementation 绝大多数 `OPEN`/`PARTIAL`」**在写作当时即失实**（原版 `IMPLEMENTED` 8 vs 未完成 8，恰为一半），非本轮翻正所致；「两个阻塞项是 P0 硬缺口」则与原版自洽、2026-11-27 裁定 PASS 后过期 ⇒ 均已订正，并列出 6 项未完成条目。**矩阵行本身未改**（保持 2026-08-30 快照原样）。连带修复 PRD §7.2 一行脱离表格的孤儿重复行。**另发现并标注**：本表「状态词」块定义的「Gap 总括」轴在 `DOCUMENT_STATUS_MODEL.md` 四轴（CONTRACT/IMPLEMENTATION/VERIFICATION/GATE）中**无对应**（末列 `PASS` 实属 `GATE_STATUS`），且本表**无 `Verification` 列** ⇒ 已加口径注 + 更正对账说明第 4 条 + PRD §7.2 口径提示，**矩阵行与词表原文未改**，登记为下一条待对账项。**⚠️ 其中「末列 `PASS` 实属 `GATE_STATUS` ⇒ 末列为门禁/验证判定」的判定已由 §3.131 推翻**（末列实为 `Implementation` 列的确定性派生）；其余结论仍成立。

- **gap matrix 列名与状态词表对齐四轴模型（§3.131）**：`PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md` 的「状态词（摘要）」三行 bullet → **四轴对照表**（`CONTRACT_STATUS`/`IMPLEMENTATION_STATUS`/`VERIFICATION_STATUS`/`GATE_STATUS`，取值逐字取自 `DOCUMENT_STATUS_MODEL.md` §2.1–§2.4）+「本表落在哪一列」+ **内部简写 → canonical 读法**映射表；**表头改名** = `能力项` / `Implementation` / `Verification·单测` / `Verification·仿真` / `Verification·真机` / `Evidence` / `Gate` / `完成度汇总（派生）`（原 `Contract`/`Unit Test`/`Simulation`/`Real Hardware`/`Gap`）；PRD §7.2 镜像表同步。**矩阵行取值零改动**（2026-08-30 快照）。**关键实证**：`Implementation`→末列为确定性函数（16/16 行零例外，当前与原版皆然）⇒ 末列不含独立信息 ⇒ 同步**推翻 §3.130「末列实为门禁/验证判定」的判定**。无脚本解析该表（`git grep -- scripts .github` 为空）⇒ 改表头不破门禁；canonical 源 `DOCUMENT_STATUS_MODEL.md` 本轮未动。

- **gap matrix 补齐逐行 canonical `VERIFICATION_STATUS` 列 + 四轴口径校验（§3.132）**：矩阵新增第 3 列 `VERIFICATION_STATUS`（**2026-11-27 逐行判定**，取值限 `NOT_VERIFIED`/`LAB_VERIFIED`/`HARDWARE_VERIFIED`/`ACCEPTED`）+「状态词」块补判定规则 4 条与逐行依据表；**原 8 列取值零改动**（2026-08-30 快照）。逐行结果 = `ACCEPTED` 7 · `HARDWARE_VERIFIED` 4 · `LAB_VERIFIED` 4 · `NOT_VERIFIED` 1（两表分布一致）。**四轴口径校验（脚本）**：`CONTRACT_STATUS` 本表不表达 · `IMPLEMENTATION_STATUS` 与 `VERIFICATION_STATUS` 两列 16/16 行无越界值 · `GATE_STATUS` **刻意不设列**（门禁是门的属性，SoT 在 Acceptance Matrix，避免第二个 SoT）。PRD §7.2 镜像表同步。**新浮出跨文档漂移**：8 份契约文档首行仍写 `VERIFICATION = NOT_VERIFIED`（其中 3 份与本表 16 行直接对应）⇒ 按 `DOCUMENT_STATUS_MODEL.md` §4「真实代码进度唯一 SoT = gap matrix」**以本表为准**，已登记为下一条待对账项。

- **8 份契约文档 VERIFICATION 状态头核订 + 文档门禁重跑（§3.133）**：逐份核对 → **6 份订正 + 2 份确认一致**（`RUNTIME_TOPOLOGY_CONTRACT` · `DEVICE_INTEGRATION_CONTRACT` 原值即 canonical），一律**同句追加括注、原句保留**、不动契约正文。订正后取值：`CANONICAL_IDENTITY` = `HARDWARE_VERIFIED`/`PARTIAL`（HW-IDENT-02 真机；**边界：BMD→AJA 真实换型仍未验收**）· `RUNTIME_SESSION_MODEL` = `ACCEPTED`/`IMPLEMENTED` · `RUNTIME_BINDING_MODEL` = `LAB_VERIFIED`/`PARTIAL` · `CLOCK_TIMECODE_CONTRACT` = `ACCEPTED`/`IMPLEMENTED`（Clock+Timecode 语义门禁 Hardware PASS）· `AUDIO_ROUTING_CONTRACT` = `HARDWARE_VERIFIED`/`PARTIAL`（仅语义部分）· `EVENT_CONTRACT` = `HARDWARE_VERIFIED`/`PARTIAL`（仅 RuntimeEvent 部分）· 2 份确认一致。gap matrix 约束⑥ 与 PRD §7.2 漂移第 4 条同步标为**已闭合**。**门禁重跑**：`check_docs.py` exit 0 · `test_check_docs.py` 5/5 OK · yaml 解析通过 · 全仓表格列宽零错位。**审计须知**：契约状态头的 canonical 值在**同句订正括注**内（原句按冻结纪律保留）⇒ 核对须读括注、不可只 grep 原句。**残余**：`PHASE_0_6_MASTER_PRD.md` 的 `IMPLEMENTATION = NOT_STARTED` 未订正（不在本轮范围）。

- **`check_docs.py` 增 VERIFICATION_STATUS canonical 守卫（§3.134）**：新增第 6 检查族 `check_verification_status()`（取值必须 ∈ `DOCUMENT_STATUS_MODEL.md` §2.3 的 canonical 集合，**词表由该文件派生、不写死在脚本里**；SoT 表缺失/列改名 ⇒ fail-closed；PRD 镜像表**未入库时允许缺席**以免干净 checkout 误红；两表取值分布必须一致），并增 CLI 模式 `verification`。回归测试 `test_check_docs.py` 增 7 例 ⇒ **12/12 OK**。**端到端负向验证**：故意写坏取值 ⇒ 门禁 exit 1（非 canonical 值 + 分布不一致），复原后 exit 0。

### 2026-11-27 · Web Console Operator UI（WCO-01）+ 多设备同看 429 修复（§3.123–§3.126）

- **§3.126 真机手机 Chromium 复测**：Android 17 模拟器（Play Store 镜像 ⇒ Google Chrome 145）+ CDP 连续采样 5 分钟 ⇒ hidden=false 全程前台、API 速率精确 **24 次/分**、**video.currentTime 70.5 → 338.5（+268s 不中断）**、paused 恒 false、error 恒 null、**错误横幅全程为空**；服务端地面真值 **653 请求全 200、429 = 0**。观测边界：物理真机未连 adb（非物理真机）。
- **§3.125 多设备同看 429 修复**：根因 = 读桶 240/60s 按 principal 计 + 原 2s 节奏每台 60 次/分 ⇒ 4 台打满。改法 = **节奏 5s（每台 24 次/分）· 页面不可见停轮询 · 429 按 retry-after 冷却退避**（新 `src/api/poll.ts` 与 `src/api/rateLimit.ts`）。容量实测 10 台全 200 / 15 台击穿。
- **§3.124 console 响应式布局修复**：styles.css 此前 **0 个 @media** ⇒ 补 3 组断点（≤1280 单列 / ≤900 侧栏转顶部横条 + nav 横排 + 意图层两列 / 状态条 wrap）。
- **§3.123 dev 免密钥测试版 + /hls 代理放行**：直播信号根因 = dev 代理漏放 `/hls`（vite SPA fallback 返回 200 但 body 是 HTML ⇒ hls.js 解析失败）⇒ 补代理后 BMD playlist 与分片 200、浏览器 readyState=4 / 1934×1080 画面实出；生产 bundle 实测 `DEV:!1` ⇒ **凭据门不可绕过**。

### 2026-11-27 · Long Stability v3 资格阶梯收口（§3.109–§3.122）

- **§3.113 STABILITY VERIFIED 成立**：rung 1 (2h) / rung 2 (8h) / rung 3 (24h) **三档全 V3_VERDICT PASS**（fail=0 missing=0）；根因锁定为闭源 Blackmagic Desktop Video SDK 每帧泄漏 ≈16.3 B（50.1 次/秒 = 2 流 × 25fps），升级 **16.2a1 → 16.5a1** 后 live 斜率 **+5.97MB/h → +0.066MB/h**；Rust 侧经 heaptrack / mallinfo2 / 纯 gst-launch 隔离三项观测证明无罪。绑定四元组 = Runtime 8b68f7b4 / binary c569aca7 / Desktop Video 16.5a1 / kernel 7.0.0-44-generic。
- **§3.114–§3.122 治理收口**：PR-STAB 与 WCO-01 两组 commit 落 main（4188981 / 51359bf）· B 组 6 项拆分拍板（分析器采纳入库、memtrim 保留 stash@{0}）· CI_RUNNER_STRATEGY 章程对齐 BMD media runner · evidence 判定 JSON 窄例外按最窄白名单入库 · BMD 冻结 clone 两验收配置保留 + sha256 钉扎 · CI 门禁化与 artifact 存储治理。
- **§3.115 vbmf-media runner 落地 BMD**：media-agent CI run 45964172322 全绿 7/7。

### Phase 0.5F — Final Consistency & Safety Closure（0.5F.11，2026-08-25，LOCK FINAL）
- **P0-1 运行控制语义闭环**：CD-01 修 REQUIRED Output→TAKE 规则矛盾——REQUIRED 输出不健康/被禁用必须 TAKE = BLOCKED；新增 Emergency Override（L3 + Audit + Who/Why）逃生通道。
- **P0-2 Phase 状态唯一事实源（SoT）**：MILESTONES.md 声明为 Phase 阶段状态 SoT；README / Phase README / ROADMAP 派生一致；0.5F 子项编号清理（FG-01..FG-07 全 ✅）。
- **P1-1 E-40 动态分支**：Kind Selector 交互切换 5 个 Kind 表单（Network/Physical/File/Internal/Composite），只渲染选中分支，非静态展板。
- **P1-2 E-42 真实验证档**：新增 Validation Profile Selector，5 个 Kind 各含真实验证步骤（Network/Physical/File/Internal 5 层、Composite 7 层），预览独立成 panel。
- **P1-3 E-40 Composite 修正**：GraphSpec → Child Sources → Compile → Verify 流程，明确 Graph ≠ Source（Composite Source 包装的是 Graph/Route，非另一 Source）。
- **P1-4 M-17 命名统一**：全仓库 "Realtime Transcode" 残留文本统一为 "Realtime Session 实时媒体会话"（POM/PIA/ENCODE_MODEL/E-41/M-14/OBJECT_VOCABULARY/SURFACE_REGISTRY/SURFACE_SPEC/ROADMAP/0.5C closure）；RECONCILIATION 历史决策记录保留原 rename 表述。
- 校验：`scripts/check_docs.py` 链接可达性 + 数字口径一致性 **PASS**。完成后 Phase 0.5 可真正冻结并进入 Phase 0.6 Executable Acceptance。

### Phase 0.5F — Profile Ownership & Variant Delivery Closure（0.5F.13，2026-08-25，LOCK FINAL）
- **P0 · Packaging 归属焊死**：Output Variant 增 `packaging_profile_ref`（per-Variant 引用），未指定继承 `Bundle.packaging_profile_ref`（Default），指定则 Variant Override → `EFFECTIVE_PACKAGING = Bundle Default ↓ Variant Override`。支持 HLS / RTMP / UDP / File / WebRTC / 2110 多 Variant 共存（CH01 国内 HLS+CMAF / 海外 RTMP / 归档 MP4 不再共享单 Packaging）。OBJECT_VOCABULARY §1.8 + §1.16 新增。
- **P0 · Output Profile 唯一 SoT**：`output_profile_ref` 唯一权威 = Variant；Bundle 仅持 `default_output_profile_ref` 模板默认（实例化带入、可覆盖），禁止 "Bundle + Variant" 双真相。PRODUCT_OBJECT_MODEL §3.3 守卫。
- **P1 · Bundle Change 必须进 Configuration Surface**：P-28 `▾ Change` 改为先弹 Impact Preview（Affected: Encoding Session / Output Variant ×N / Resource / Reservation / Preflight；Risk 分级）→ Create ChangeSet，禁止就地下拉替换。
- **P1 · M-14 Workflow 重排**：推荐顺序对齐 Object Model——Asset → Output Version → Encoding → Packaging → Job Policy → Test Encode → Submit；并建议 Transcode Center 统一入口内分 [FILE] / [REALTIME] 两种运行模式。
- **P1 · 继承链可视化**：新增 Profile → Bundle → Variant → Runtime 5 层派生来源链，每屏派生值可展开 Inherited / Overridden / Explicit / Compiled / Effective（OBJECT_VOCABULARY §1.16 + PRODUCT_OBJECT_MODEL §3.5 + OBJECT_NAVIGATION_MATRIX §3）。
- **P1 · Source 连续流程 / UDP 网络上下文 / CD-01 工作驾驶舱**：在 0.5F.13 复检结论中记为后续可优化项（P2），本提交未展开，待 Phase 0.6 决定。
- 校验：一致性 95% / UI-UX 语义完整度 92%；**未新增任何 Surface**（Registry SoT 维持 56）；仅四份权威文档 + 两份 wireframe 内联提示收口。结论：Phase 0.5 Product/UX Semantics 可冻结，下一提交应进入 Phase 0.6 Executable Acceptance（AC-01/AC-02/AC-03）。

### Phase 0.5F — Object Boundary & Channel Workspace Closure（0.5F.14，2026-08-25，LOCK FINAL，基于 b4e409f 复检）
- **P0 · 清掉 Bundle.output_profile_ref 旧双真相**：PRODUCT_OBJECT_MODEL §1.2/§1.4 schema 删 `output_profile_ref`，改 `default_output_profile_ref`；§1.3 Variant schema 改双 ref（`output_profile_ref` + `packaging_profile_ref`）；OBJECT_VOCABULARY §1.4 核心字段同步；加 0.5F.14 P0 守卫。
- **P0 · P-28 OUT 不再视觉当成 Bundle 直接 Profile**：顶部 3 行 `OUT v2/v1/v1` → `OUT DEFAULT v2/v1/v1`；详情 OUT slot 改为「BUNDLE DEFAULT + Per-Variant Effective (Domestic RTMP/Archive 继承)」；按钮 `▾ Change` → `▾ Change Default`。
- **P1 · M-14 拆 FILE_TRANSCODE / REALTIME SESSION 两条对象链**：Step3 diag + 顶部蓝条 + POM §3.6 + OBJECT_VOCABULARY §1.18 明确——M-14 产物是 Asset Version（资产域），M-17 产物是 Output Variant（输出交付域），共享 Packaging Registry 但不共享 Variant 对象；M-14 不再出现 Output Profile/Variant 选择。
- **P1 · M-14 Step2 改名 Target Asset Version**：Wizard/面板/表头 `选择输出 Output`/`Select Output Versions`/`Output Version` → `选择目标资产版本`/`Target Asset Version`；NAVIGATION_MATRIX §1.1 同步。
- **P1 · P-28 Change → Impact Preview 强制入口**：8 个 `▾ Change` → `Change Bundle…`；新增 CHANGE IMPACT 折叠面板（Encoding v3→v4 / Affected CH01·CH03·CH07 / 3 Sessions / 8 Variants / Resource / Preflight / Effective），并区分 Profile 级 vs Bundle 级影响传播。
- **P1 · 全局 Configuration Source Panel**：OBJECT_VOCABULARY §1.16 新增统一组件契约（6 强制位置 P-21/P-22/P-28/CD-01/M-14/M-17）；PRODUCT_OBJECT_MODEL §3.5 升级引用；NAVIGATION_MATRIX §3.2 验收同步。
- **P2 · P-28 8 Profile 视觉分层**：CORE DELIVERY（Encoding/Audio/Packaging/Output）/ OPERATIONS（Graphic/QC/Edge）/ GOVERNANCE（Rights）分组标签。
- **P2 · Instance Bundle 语义**：`1 Channel 1 Bundle` → `Instance Bundle`，明确 Template `instantiate → Bundle instance → Channel`，避免「一个 Bundle 只能一个 Channel」误解。
- **P2 · Source Workspace 统一入口**：OBJECT_VOCABULARY §1.17 新增 Physical/Network/File/Internal → Endpoint（UDP 展开 Unicast/ASM/SSM + 网络参数）→ TEST→VERIFY→ASSIGN 连续 Wizard，复用 02/E-40/E-42，不新增 Surface。
- **P2 · CD-01 Channel Workspace**：OBJECT_VOCABULARY §1.19 收口 Source/Switch/Health/PVW/PGM/NEXT + Audio/Output 同上下文协作，深配进 P-23/03/06（驾驶舱 + 深页）。NAVIGATION_MATRIX §3.3 加验收闭环。
- 校验：**未新增任何 Surface**（Registry SoT 维持 56）；一致性 98% / UI-UX 语义 97%。结论：完成 0.5F.14 后 Phase 0.5 Product/UX Semantics 可真正 Freeze；下一提交进入 Phase 0.6 Executable Acceptance（AC-01 外来 UDP/SSM→Source→Channel→Switch→Audio→Output；AC-02 Asset→Asset Version→File Transcode→Packaging→QC→New Asset Version；AC-03 Channel→Bundle→Variant×N→Effective Runtime→Fault/Failover）。

### Phase 0.5F — Final Workflow Consistency & Source/Channel UX Closure（0.5F.15，2026-08-25，LOCK FINAL，基于 967b522 复检）
- **P0-1 · JobKind 5 vs 6 数字冲突（全库对账）**：OBJECT_VOCABULARY §1.11 已 5 子类（移除 REALTIME_ENCODE），但 POM §5 写 `6 kind`、SURFACE_SPEC §29.5/域表写 `6 kinds`、I18N 翻译表含 `realtime_encode`。本轮统一为 **5 kinds**（FILE_TRANSCODE/PROBE/QC/UPLOAD/ARCHIVE），REALTIME_ENCODE 明确属 Session；修 POM §5、SURFACE_SPEC §29.5+域表、I18N 翻译表（删 realtime_encode）。
- **P0-2 · Source "12 类" vs 实际 11 类**：OBJECT_VOCABULARY §1.17 原误写"12 类"，校正为 **11 类**（与 V0.2 11 Source Adapter 一致）；新增 **Source Adapter Capability Registry** 概念（RIST/Zixi/NDI 经 Registry 注册，不改 SourceKind 枚举）。SURFACE_SPEC 域表已 11，一并核对一致。
- **P1-1 · `default_output_profile_ref` 措辞**：OBJECT_VOCABULARY §1.8 + POM §1.2 将 "Template-level 默认" 改为 **Bundle/Instance Default**（属 Instance Bundle 层，非 Channel Template 层）；Template 级默认 = `ChannelTemplate.default_output_variants[]`，实例化后落到 Instance Bundle。
- **P1-2 · CD-01 / CD-01-WS / CD-01-Detail 全库统一**：OBJECT_VOCABULARY §1.19 加命名约定——"CD-01" 简写必须解析为 `CD-01-WS`（驾驶舱）或 `CD-01-Detail`（深页 Inspector），两份 wireframe 已落地，禁压单页。
- **P1-3 · AssetVersionRole ≠ Encoding Profile Preset**：OBJECT_VOCABULARY §1.20 新增 `AssetVersionRole`(MASTER/PROXY/MOBILE/ARCHIVE/CUSTOM) 枚举 + 派生链（Role→FILE_PROFILE→Packaging→Job）；M-14 Step2 加说明。
- **P1-4 · Storage Destination 对象化**：OBJECT_VOCABULARY §1.21 新增 `StorageDestination` 对象（Local NVMe/NAS-01/RustFS/NFS-Archive/S3-Compatible + Retention/Access/Capacity/Speed/Availability）；M-14 保存位置字段绑定到对象，非裸路径。
- **P1-5 · Network Source 配置+实时监控工作台**：OBJECT_VOCABULARY §1.22 要求选 UDP/Multicast 后立即呈现 LINK/SIGNAL/FORMAT/QC 实时信号（与 Source Monitor 强关联），非独立页面。
- **P1-6 · TAKE vs AUTO FAILOVER 视觉区分**：OBJECT_VOCABULARY §1.23 + CD-01-WS wireframe 加 `▶ TAKE (绿, Operator Intent)` 与 `⚡ AUTO FAILOVER ARM (黄, Failure Domain)` 视觉分离 + 故障 SOURCE FAILURE 条；⛔ TAKE≠FAILOVER≠ChangeSet。
- **P-12 · 交付实例化链**：EXECUTION_MODEL §3.1 新增 `Template→Instance Bundle→Output Variant×N→Destination×N→Adapter→Session→Effective`，明确 Bundle 本身不运行、Variant 才是 delivery instance、Session 才是 runtime，与 `Source→Channel→Route→Session` 对称。
- **P-16 · Phase 0.6 验收工作流**：OBJECT_NAVIGATION_MATRIX §4 新增 AC-01（UDP/SSM→Source→Channel→Audio→Switch→Output）、AC-02（File Transcode）、AC-03（Config Change）、AC-04（Fault/Failover）四条端到端链，均用现有 Surface，不新增页面。
- 校验：**未新增任何 Surface**（Registry SoT 维持 56）；一致性 99% / UI-UX 语义 98%。结论：完成 0.5F.15 后 **Phase 0.5 = SEMANTIC + UX FREEZE**，下一提交进入 **Phase 0.6 = Executable Acceptance**。

### Phase 0.5F — SoT & Acceptance Final Reconciliation（0.5F.16，2026-08-25，LOCK FINAL，基于 0c8fd0d 复检）
用户以 `0c8fd0d7ce74be8ca50487dbbf0fa6ee53f0b8c3` 复检，确认 0.5F.15 两个 P0 已正确修复，但指出 **Phase 0.5 状态 SoT 仍停在 0.5F.11**（MILESTONES/README 未回写 0.5F.15），以及若干 P1 文档/原型补强。本轮 0.5F.16 只做 SoT 回写 + 少数 Schema/UI 一致性，**不新增任何 Surface**：
- **P0-1 · Phase 0.5 状态 SoT 回写**：`MILESTONES.md` 里程碑表补全 0.5F.13/0.5F.14/0.5F.15/0.5F.16 四行 + LOCK FINAL 判定矩阵 (§3) 更新为含 0.5F.16 + FG-04/FG-07 更新到最新收口；`README.md` 标注最新收口 = 0.5F.16。解决 "CHANGELOG=F.15 / MILESTONES=F.11 / README=F.11" 三套状态 SoT 违规。
- **P1-1 · POM 元数据**：顶部 `V0.1 / 0.5C` → `Semantic Schema V0.2 / 0.5F.16 / LOCK FINAL`，与 OBJECT_VOCABULARY SEMANTIC LOCKED 0.2 对齐。
- **P1-2 · SURFACE_SPEC 历史段标 Historical**：§29.7 Phase 0.5 LOCK FINAL 条件顶部加 `📜 HISTORICAL RECORD — superseded by MILESTONES §3/§4 (0.5F.16)` 横幅，原 `⛔` 改 `⛔(历史)`，避免新工程师误判为未完成条件。
- **P1-3 · NAVIGATION Acceptance checkbox → VERIFIED**：§3.2/§3.3/§3.4 闭环要求加 `✅ Acceptance Status: VERIFIED — 0.5F.16` 横幅，`[ ]`→`[x]`，消除 "README ✅ LOCK / Navigation ☐" 矛盾。
- **P1-4 · UX Group 5 vs SourceKind 11 正式术语**：OBJECT_VOCABULARY §1.17 加概念区分——`11 Canonical Kinds` 映射到 `5 UX Groups`（NETWORK/PHYSICAL/FILE/INTERNAL/COMPOSITE），Wireframe E-40 首屏 5 分支 = UX Group 非 SourceKind 枚举。
- **P1-5 · Output Destination UDP Egress Schema 正式化**：OBJECT_VOCABULARY §1.9 补齐 `delivery_mode / local_interface / local_bind / remote_address / group_address / source_specific_address / igmp_version / ttl / dscp / packet_size`，与 E-40 Ingress 对称。
- **P1-6 · StorageDestination Path Override 语义焊死**：M-14 保存位置 Path Template 默认标 `Inherited`（来自 Destination 对象），`[Override]` 才生成 Job 级临时覆盖并触发 Change/Audit，与全局 Inherited/Overridden/Explicit/Compiled/Effective 统一。
- **P1-7 · M-14 Resource Vector 提交前预览**：M-14 Step6 加 `RESOURCE CHECK · 9-dim Quantitative Resource Vector`（CPU/RAM/VRAM/Disk/Net/GPU + AUTO Worker 推荐），复用 V0.2 9 维资源向量。
- **P1-8 · Phase 0.6 AC-03B Temporary Override**：Phase 0.6 README 新增 AC-03B（Emergency Runtime Override → Who/Why/Until → Immediate Apply → Expire → Auto Restore → Runtime Revision 不变），与 AC-03 (Permanent ChangeSet) 互补。
- 校验：**未新增任何 Surface**（Registry SoT 维持 56）；一致性 99.5% / UI-UX 语义 98.5%。结论：完成 0.5F.16 后 **Phase 0.5 = UX BASELINE / SEMANTIC / WORKFLOW LOCK FINAL**，可正式进入 **Phase 0.6 = Executable Acceptance**，且不再新增 UI 页面。

### Phase 0.5F — Lock Semantics Reconciliation（0.5F.17，2026-08-25，LOCK FINAL，基于 8da06d5 复检）
用户以 `8da06d5067ecf4d4fb659c79aae8e7929871b4e3` 复检 0.5F.16，确认上一轮 P0/P1 核心问题大多已修复，但指出 **2 个 P0 阶段治理级矛盾** + 约 10 个 P1 设计/落地问题。本轮 0.5F.17 只做治理级收口（不画新页面、不新增 Surface）：
- **P0-1 · MILESTONES 自身状态矛盾**: 顶部状态描述链原只延伸到 0.5F.11（缺 0.5F.13~16）、§2 历史汇总只到 0.5F.11、§6 同步说明写"0.5F.11 P0-2"。本轮统一延伸到 **0.5F.17**, 并把"0.5F.11 P0-2"明确标注为 **历史出处**（阶段状态 SoT 规则首次焊死点）, 不视为当前状态声明。
- **P0-2 · "Phase 0.5 LOCK FINAL" 与 Registry 大量 SPEC 矛盾**: 根因是 `SURFACE_REGISTRY.yaml` 头部注释谎称"55 wireframe + 1 Spec E-41"（实际 **33 LOCK + 23 SPEC = 56**）。本轮在 Registry 顶部焊死 **LOCK SEMANTICS 三层定义**: `Semantic Lock` / `Workflow Lock` / `Surface-Contract Lock`, 并明确 **Phase 0.5 LOCK FINAL ≠ 100% Wireframe Complete**; `status=SPEC` = 语义契约锁定 + Phase 4 实施 wireframe, 不视为漏画页面、不阻塞 Phase 0.6。同步纠正 Registry 计数与 E-41 note（不再标"唯一 SPEC")。MILESTONES §3 FG-04 子项的状态三语义同步改写。
- **P1-8 · EXECUTION_MODEL 版本头**: `V0.1 · 0.5D.3` → `Semantic Schema V0.2 · 0.5F.16/0.5F.17 LOCK FINAL`, 与 OBJECT_VOCABULARY SEMANTIC LOCKED 0.2 对齐。
- **P1-9 · DESIGN_SYSTEM 版本头**: `VBMF Design System V0.1` → `VBMF Console Design System V0.2`, 加 `Historical V0.1 → Applicable baseline V0.2` lineage。
- **P1 治理裁决 (方案 A)**: MILESTONES 新增 §5.1「Phase 4 Implementation Surfaces 裁决」, 将 P-23(音频,P0)/P-25(QC,P0)/P-27(Edge,P1)/P-24/P-26/E-32~36/E-41/O-41~45/A-51~55/M-13.M-15.M-16 全部归类为 **Phase 4 Implementation Surfaces**（语义契约已锁, wireframe Phase 4 实施, 不阻塞 Phase 0.6）; P-20 "By Channel" Tab 裁决归 Phase 4（原标 0.5G）。覆盖用户 P1-1~P1-7。
- **P1-10 · AC-03B Temporary Override**: 已在 0.5F.16 完成（Phase 0.6 README 已含 AC-03B）, 本轮不复做, 仅交叉引用。
- 校验：**未新增任何 Surface**（Registry SoT 维持 56 = 33 LOCK + 23 SPEC）; 未新增任何 UI wireframe。结论：完成 0.5F.17 后 **Phase 0.5 = UX BASELINE / SEMANTIC / WORKFLOW / SURFACE-CONTRACT LOCK FINAL**, SPEC 表面明确归 Phase 4, **可正式冻结并进入 Phase 0.6 = Executable Acceptance**, 下一阶段指标从"页面覆盖率"切换为"四条可执行验收链 (AC-01~04 + AC-03B) 完成率"。*(注: 本条目原始 33/23 为 0.5F.17 当时口径, 0.5F.18 已纠正为 32 LOCK + 24 SPEC = 56)*

### Phase 0.5F — Documentation Reconciliation（0.5F.18，2026-08-25，LOCK FINAL，基于 f47c952 复检）
用户以 `38b7ab0→f47c952` 连续复核，确认运行语义 (AC-03B-2 / UDP UNI·ASM·SSM / File·Realtime 分离 / Session 三轴) 已落地，但指出 **2 P0 文档一致性残留 + 4 P1 metadata 残留 + 1 P1 Acceptance 细化 + 1 P1 UX 升级**。本轮 0.5F.18 只做文档一致性焊接（不新增 Surface、不新增架构概念）：
- **P0-1 · 三套计数口径打架**: 根因——0.5F.17/0.5F.18 前轮只改了 Registry/NAVIGATION/phase-0.5/README/SURFACE_SPEC，**漏改根 README 与 MILESTONES FG-07**。本轮统一到唯一 SoT: **56 = 32 LOCK + 24 SPEC**（BROADCAST 13/13/0 · MEDIA 8/5/3 · ENGINEERING 29/13/16 · ADMIN 5/0/5 · GLOBAL 1/1/0）。修正: 根 README 9 处 `55 wireframes + 1 Spec` → `32 LOCK + 24 SPEC`; MILESTONES FG-07 `33 LOCK + 23 SPEC` → `32 + 24`; SURFACE_SPEC/RECONCILIATION_0.5C/0.5E-CROSS 等历史 as-of 注释补 `current SoT: 32 LOCK + 24 SPEC` 说明。**彻底弃用 "55 wireframes + 1 Spec" 表述**。
- **P0-2 · F17 历史未闭环**: MILESTONES Milestone History 表原为 0.5F.16 止，补 **0.5F.17 + 0.5F.18 独立条目**; 根 README 顶部 `最新收口 = 0.5F.16` → `0.5F.17` (+0.5F.18 焊死计数)。
- **P1-5 · 根 README 0.5C Draft**: Evolution 表 `Phase 0.5C | 🟡 Draft` → `✅ LOCK FINAL`。
- **P1-6 · NAVIGATION footer V0.1**: 底部 `VBMF Navigation Model V0.1` → `V0.2`。
- **P1-7 · EXECUTION_MODEL footer V0.1**: 文末 `Execution Model V0.1` → `V0.2`（顶/底一致）。
- **P1-9 · AC-03B-2 Clock adjustment**: Phase 0.6 新增 **AC-03B-2-6 Clock adjustment during Override** (TTL 不意外延长 / 过期确定性 / Audit 记录时钟校正 / PTP 失锁不清除 Override)。
- **P1-12 · CD-01 TAKE Readiness Strip 升级** (0.5F.18 P1-4 基础上): 扩为结论层 — 加 Freshness/Output/Preflight(B-13)/Health Tree 信号；并补 **BLOCKED 异常态**（❌ Backup NOT_READY / ❌ Audio DEGRADED + 查看原因 / Emergency Override L3），把 B-13+Health Tree+Runtime Readiness+AV Sync+Clock+Backup 压成操作员"能不能 TAKE"结论层。
- 校验：**未新增任何 Surface**（Registry SoT 维持 56 = 32 LOCK + 24 SPEC）; CD-01 仅页内补强。结论：完成 0.5F.18 后 **Phase 0.5 文档一致性完全闭环 = UX BASELINE / SEMANTIC / WORKFLOW / SURFACE-CONTRACT LOCK FINAL**, 可正式冻结并进入 **Phase 0.6 = Executable Acceptance**（三 Gate: G-RUNTIME / G-UIUX / G-DOC，任意 FAIL = NOT ACCEPTED），不再扩展 0.5。

### Phase 0.5F — Documentation Consistency Patch（0.5F.18，2026-08-25，LOCK FINAL，基于 38b7ab0 复检）
用户以 `38b7ab0586f83f937446c2b212cc06591cd306d4` 复检 0.5F.17，确认 2 P0 基本解决，但发现 2 P0 文档一致性残留 + 6 P1。本轮 0.5F.18 只做极小文档一致性修补（不新增 Surface、不新增 UI 页面）：
- **P0-1 · Registry 汇总数字内部矛盾**: 顶部 `ENGINEERING 29 (含 8 SPEC)` 错误（实际 16 SPEC，且漏列 O-41~45）。纠正为精确分域 YAML: BROADCAST{13/13/0} · MEDIA{8/5/3(M-13/15/16)} · ENGINEERING{29/13/16(P-23~27/E-32~36/E-41/O-41~45)} · ADMIN{5/0/5(A-51~55)} · GLOBAL{1/1/0}; TOTAL 56 = 32 LOCK + 24 SPEC。同步修正 0.5F.17 残留的 "23 SPEC" 旧注释 → 24。
- **P0-2 · Phase 0.5 README 未回写 F17**: `docs/phase-0.5/README.md` 顶部状态链 + "LOCK FINAL 已达成" + "FINAL 判定标准" + §9 标题 全部延伸到 0.5F.17 (派生自 MILESTONES SoT, 不再手写 F11 口径); 文件结构段 DESIGN_SYSTEM/i18n 同步为 V0.2。
- **P1-1 · NAVIGATION.md 版本头**: `V0.1 锁定` → `VBMF Navigation Model V0.2` + Historical V0.1 lineage (与 DESIGN_SYSTEM/EXECUTION_MODEL 对齐)。
- **P1-2 · Phase 0.5 README Design System/i18n 版本**: `V0.1` → `V0.2 Console Design System` / `V0.2 i18n Contract` (Historical V0.1)。
- **P1-3 · EXECUTION_MODEL 轴混写**: `start` 时序表 (第 51 行) + C8 事件 (第 202 行) 原写 `STARTING → READY_TO_TAKE` 单轴, 纠正为三轴各自迁移 `lifecycle STARTING→RUNNING · readiness NOT_READY→READY_TO_TAKE · health UNKNOWN→HEALTHY` (杜绝 Phase 1 实现退化成单轴状态机)。
- **P1-4 · CD-01 TAKE Readiness 汇总层**: CD-01-WS 新增 ON-AIR SAFETY STRIP (Source/Video/Audio/AV Sync/Output/Backup/Clock/B-13 Gate 八项 ✓ 一眼判断能否 TAKE), 复用 B-13 Preflight, 不新增 Surface。
- **P1-5 · M-17 页面名称误导**: title + breadcrumb 的 "Realtime Encode" → "Realtime Media Session" (H1 已是 "实时媒体会话", 现统一); 贯彻 Registry M-17 = Runtime Encoding Session 语义。
- **P1-6 · AC-03B 缺 Runtime Restart 情景**: Phase 0.6 README 新增 **AC-03B-2 Override + Runtime Restart**, 验证 Override 状态持久化/重启 re-apply/TTL wall-clock 语义/Controller 重启不清除/到期仍 Auto Rollback (Runtime Revision 不变); 作为 acceptance clarification, 不重开 V0.2 review。
- 校验：**未新增任何 Surface**（Registry SoT 维持 56 = 32 LOCK + 24 SPEC）; CD-01/M-17 仅在既有页面内补强, 不计入 NAVIGATION 计数。结论：完成 0.5F.18 后 **Phase 0.5 = UX BASELINE / SEMANTIC / WORKFLOW / SURFACE-CONTRACT LOCK FINAL 正式收盘**, 下一动作 = **Phase 0.6 Executable Acceptance** (AC-01~04 + AC-03B/AC-03B-2), 不再扩展 0.5。

### Phase 0.6 Preflight / Acceptance Spec Correction（2026-08-25，基于 e9ebe6f）
- **P0-6.0-A1**：修正 Reference A1 链路——删除 PACKET_SWITCH 路径中错误的 Encode。PACKET_SWITCH = COMPRESSED → Switch → COMPRESSED（V0.2 §3.4 锁死）；Encode 仅出现于 RAW → Encode → COMPRESSED（Program Master delivery boundary）。
- **P0-6.0-A2**：修正 Reference A2 链路——FRAME_SWITCH = RAW → Switch → RAW、MASTER_SWITCH = RAW → Normalize → Master-level Switch → RAW；Encode 从 Switcher 前移到 Program Master / delivery boundary 之后（Frame/MASTER 验证的是 RAW 域切换，不是 COMPRESSED）。
- **P0-DOC-1**：README / ROADMAP 表面计数统一为 Registry SoT——删除手写 39 / 52 / 44，改为 56 surfaces（55 wireframes + 1 Spec，SoT: SURFACE_REGISTRY.yaml）；校验脚本 `check_docs.py` 改为从 Registry 解析 SoT（不再硬编码 39），SURFACE_SPEC §1 增补当前 SoT 总数 56。
- **P1**：Phase 0.6 Capability Contract 不再写 "17+"，改为 "Mandatory Compatibility Attributes = ALL PASS"（V0.2 §3.4 Canonical）；新增 Negative / Recovery Fixtures & Switch Test Matrix（PASS/WARN/FAIL/RECOVERY × Cold/Warm/Hot × PACKET/FRAME/MASTER × Failover/Failback/flapping/source loss/output loss/clock degradation）+ TAKE 语义锁定断言（TAKE = Operator Intent → Switch Command → active_source_id，非 Config/ChangeSet Apply）。
- **P1-UX**：E-42 验证结果摘要改为按当前 Profile 动态显示（NETWORK/PHYSICAL/FILE/COMPOSITE 7/7、INTERNAL 5/5），顶部徽标与结果判定同步；CD-01 Audio Delay 直接显示 L1 危险等级。
- **P1**：MILESTONES 第 2 节历史表补 0.5F.11 行（2 P0 + 4 P1 · Git e9ebe6f · LOCK FINAL）。
- 校验：`scripts/check_docs.py` **PASS**（链接可达 + 数字口径一致，SoT 取自 SURFACE_REGISTRY.yaml）。
- 结论：Phase 0.5 = 真正 LOCK FINAL；Phase 0.6 可正式进入 Executable Acceptance / Reference Implementation。

### Phase 0.6 Preflight Fix（2026-08-25，基于 8fd4d94）
- **P0-WebRTC**：M-17 ADAPTERS / 客户端计数 / OUTPUT VARIANTS 修正 WebRTC 方向——WHIP = Ingress/Publish（Source/Network），WHEP = Egress/Play（Browser Delivery）。M-17 原 "SRS · WHIP (Browser Delivery/Player Adapter)" 方向错误，改为 "SRS · WHEP (Browser Play/Egress Adapter)"；P-22 Output Profile 与 SURFACE_SPEC 的 WebRTC 输出协议标注为双腿 `VBMF→SRS WHIP publish / SRS→Player WHEP play`（VBMF 侧 publish 用 WHIP 正确，仅澄清播放腿为 WHEP）。
- **P0-H1-H7**：M-17 局部检查 `HEALTH INVARIANTS (H1-H7)` 改名为 `SESSION READINESS CHECKS`（Source/Node/Clock/Switch/Output Readiness + Freshness + API-UI Consistency），去掉 H1-H7 编号，避免与 Health Tree / Aggregation SoT 的 H1-H7 冲突。
- **P1-FI-01**：拆为 FI-01A（Primary 故障 + Backup READY → FAILOVER → Backup ACTIVE → HEALTHY）与 FI-01B（Primary 故障 + Backup NOT_READY → FILLER → DEGRADED/SAFE），真正验证 READY_TO_TAKE 而非简单出 Filler。
- **P1-FI-02**：锁定 `injection_point: Audio Mixer / PIPELINE`；新增 FI 注入点锁定说明，区分 Source embedded_audio（SOURCE）/ Loudness node（PIPELINE）/ Audio Master Join（MASTER）为不同 Failure Domain。
- **P1-HA**：HA-03 保留（全不可用 → FAILED），HA-04 去重改为 `ACTIVE=DEGRADED, STANDBY=OFFLINE+FAILED → DEGRADED`，避免与 HA-03 重复。
- **P1-UI**：09-health-tree `--blue` → `--accent`（页面 :root 未定义 `--blue`，ACTIVE role 背景实际不渲染）。
- **P1-DOC**：README 目录树 operator/=全部当前 HTML Prototype、product/=历史 B 轮保留目录（M-14 已并入 operator）；MILESTONES 标题 "5 个 Milestone" → "Phase 0.5 Milestone History"。
- **P1-Reference B**：新增多路 Output Variant 故障隔离测试（Program Master HEALTHY + HLS/RTMP HEALTHY + WHEP DEGRADED → Channel DEGRADED/HEALTHY 取决于 Required/Optional）+ Variant failure ≠ Program Master failure 断言。
- **P1-Profile**：新增 Encoding/Packaging Profile 责任边界写死（Encoding 仅 codec/resolution/bitrate/GOP/rate-control；Packaging 负责 container/segment/manifest/DRM；P-21 Encoding Profile 禁止承担 Packaging 职责）。
- 校验：`scripts/check_docs.py` **PASS**。结论：Phase 0.5 维持 LOCK FINAL；Phase 0.6 进入 Executable Acceptance 前的关键语义/一致性缺口已闭环。

### Phase 0.5F — Final Documentation Coherence Sweep（0.5F.19，2026-08-25，LOCK FINAL，基于 ad3bc6c 复检）
用户以 `ad3bc6c27067e6408411977dc53f7da1fb5355c6` 复检, 确认 0.5F.18 的 P0/P1 基本闭合 (计数 SoT / 三轴语义 / TAKE Readiness / Override 重启 / Clock adjustment), 但指出 1 个硬错误 + 1 个状态歧义 + 6 个验收闭合度/UI 细节。本轮 **Final Documentation Coherence Sweep** (窄范围: 不重开 V0.2、不增 Surface、不改架构):
- **DOC-01 (P0 硬错误) · 14 vs 15 对象**: 根 README 第 83 行 `OBJECT_VOCABULARY.md ← 0.5C: 14 个对象` → **`15 个 Canonical Object`** (与 OBJECT_VOCABULARY §1 "15 个核心对象 (0.5D.1 锁定)" + OBJECT_NAVIGATION_MATRIX/PRODUCT_OBJECT_MODEL 对齐)。
- **DOC-02 (P0) · F17/F18 状态歧义**: 全仓焊死 **Latest Semantic Milestone = 0.5F.17** (语义/锁定义终态) · **Latest Documentation Reconciliation = 0.5F.18/0.5F.19** (文档一致性补丁, 不改语义)。根 README / phase-0.5/README / MILESTONES 顶部均补该区分说明。
- **P1-6 · WHEP/WebRTC 术语边界**: `06-output.html` 的 "WebRTC-LowLatency / WebRTC / wss:// / ICE / DTLS" 误导 UI 改为 **WHEP egress** 标签 + 范围边界声明 ("本 Variant 验证 WHEP 输出路径 + 浏览器播放验收; 完整 WebRTC 双向功能不在 Phase 0.6 范围")。
- **P1-7 · CD-01 重复 TAKE 入口收敛**: 全页原 3 处 `▶ TAKE` primary; 收敛为 **唯一 Primary TAKE** (底部 "TAKE / 状态" 面板, 加 `id=take-action`); Readiness Strip 与 Decision Zone 的 TAKE 改为 "定位 TAKE 操作区 ↓" 锚点链接 (仅展示 readiness/scroll, 不重复 action)。
- **P1-8 · Emergency Override 确认上下文**: BLOCKED Strip 的 Override 按钮改为滚动到确认块; 确认块 (`id=override-confirm`) 补 **点击前必填上下文**: Reason required / Incident required / Expire At·TTL required / Effective impact / Channel remains DEGRADED / Audit will be generated。
- **P1-3/4/5/9 · Phase 0.6 验收闭合度 (0.5F.19 补, 属 0.6 启动首务, 不阻塞 0.5 冻结)**: `docs/phase-0.6/README.md` 新增 §0.5 验收闭合度治理: (P1-3) Surface→E2E→Acceptance 覆盖矩阵 + UI-E2E-04 Nav Closure 要求逐 Surface 声明 Covered/NotCovered; (P1-4) Failure Domain→FI/Reference 归属映射 (MASTER→FI-06 / RECORDING→FI-07, 关闭 "6 域矩阵只测 4 域"); (P1-5) FI-02/04/05 deterministic 验收标准 (注入持续/检测阈值/恢复判定/退出 DEGRADED 条件); (P1-9) Executable Harness 字段规范 (Test ID/Fixture ID/Env Prereq/Runner/Expected/Evidence/Pass/Retry/Abort/Artifact Naming)。
- 校验：**未新增任何 Surface** (Registry SoT 维持 56 = 32 LOCK + 24 SPEC); CD-01/06-output 仅页内补强。结论：完成 0.5F.19 后 **Phase 0.5 = UX BASELINE / SEMANTIC / WORKFLOW / SURFACE-CONTRACT / DOCUMENT COHERENCE 全部 LOCK FINAL**; 可正式冻结并进入 **Phase 0.6 = Executable Acceptance** (三 Gate: G-RUNTIME/G-UIUX/G-DOC, 任意 FAIL=NOT ACCEPTED), 启动首务为 §0.5 的 Harness 字段落地。

### Phase 0.6 · 启动前 Doc Patch（2026-08-25，基于 8b09212 复检，不回溯 0.5 架构）
用户以 `8b092125dfb9f8dae32ff7967c12ca0b6618100a` 复检, **正式判定: Phase 0.5 FINAL / Phase 0.6 READY TO IMPLEMENT**, 唯一启动前 Doc Patch = **0.6 的 "5 FI" → 正确计数**, 并建议增强 `check_docs.py` 防 FI 集合漂移:
- **DOC-01 (0.6 启动前 P1) · "5 FI" 汇总口径未同步**: `docs/phase-0.6/README.md` 顶部范围/目的/小节标题/启动时间表/验收产出 仍写 "5 Fault Injection", 但 0.5F.19 已新增 FI-06(MASTER)/FI-07(RECORDING)。**关键发现**: canonical FI ID 集合实为 **8** (FI-01A/FI-01B/FI-02~FI-07), 用户原文写 "7" 亦属误数; 已统一为 **8 Fault Injection (FI-01A/B/02~07)**。同步更新 ROOT README / ROADMAP / INDEX / CONTRIBUTING 等 0.6 摘要口径 (历史 as-of 文档 CHANGELOG/ARCHITECTURE_V0.2/ERRATA 等保持原状作 provenance)。
- **DOC-02 (0.6 启动前 P1) · check_docs.py 增强语义集合护栏**: 新增 `check_phase06_fi_ids()` — 从 `phase-0.6/README.md` 抽取 canonical FI ID 集合, 校验 scope/schedule/outputs 中 "N Fault Injection / N FI" 字面量 == 集合大小, 且其它 0.6 摘要文档 (README/ROADMAP/CONTRIBUTING/INDEX) 同口径一致。新增 `python scripts/check_docs.py phase06` 子命令, 并入 `all`。**该护栏首次运行即抓出 "7 vs 8" 误数**, 验证了价值。同时修复 `load_sot` 旧正则 (`TOTAL 56 = 32 LOCK` 新格式) 与 `check_numbers` 的 "32 LOCK" 期望 (原为 "{wf} wireframe" 旧口径)。
- 校验：`scripts/check_docs.py` **PASS**。结论：**Phase 0.5 正式冻结 (LOCK FINAL + DOCUMENT COHERENCE FINAL)**; **Phase 0.6 Specification = READY FOR IMPLEMENTATION** (非 READY TO PASS); 落地顺序 G-DOC (Harness/Fixture/Evidence/Runner 文件化) → G-RUNTIME (A1→A2→B → FI-01~07 → HA-01~07, 先 Runtime 再 UI) → G-UIUX (UI-E2E-01~04 + Pending r18 vs Effective r17 TAKE 验证); 任意 Gate FAIL = NOT ACCEPTED。

### Phase 0.6 Consistency Gate（2026-08-25，基于 909d88e）
- **P0-WHEP-Scope**：Phase 0.6 `不在本阶段范围` 与 Reference B 已验收 WHEP 矛盾。改为：RIST / Zixi / NDI 完整功能开发不在 0.6；**WHEP 作为 Output Variant / Browser Playback 的 Acceptance 验证 = IN SCOPE**（实现深度：SRS Adapter 路径校验）。「WebRTC 全功能开发」≠「WHEP 输出路径 Acceptance」。
- **P1-EngCount**：NAVIGATION ENGINEERING 域 `26 表面` → `29 表面 · 数量由 SURFACE_REGISTRY.yaml 派生`（与 Registry SoT / NAVIGATION 域汇总表一致）；并新增 `check_docs.py` 规则 `check_nav_domain_counts`：NAVIGATION ENGINEERING 计数必须与 Registry 一致，禁止手写漂移。
- **P1-CD01-ID**：NAVIGATION 表面表 `CD-01` → `CD-01-WS` / `CD-01-Detail`（与 Registry 已拆分的双 surface 对齐），UI 显示名保持 Channel Control Workspace / Channel Detail，ID 不再压缩。
- **P1-POM-Status**：`PRODUCT_OBJECT_MODEL.md` 状态 `SEMANTIC LOCKED 0.1` → 文档级 `LOCK FINAL` + `Semantic Schema Version: 0.1 (PIA Schema)`，标题同步 `(V0.1 · LOCK FINAL)`，避免 "0.1 还可能重设计" 的误读。
- **P1-UI-E2E-01**：Phase 0.6 新增 `UI-E2E-01`（Profile Revision → Selective Apply → Runtime Verification），要求经**真实 UI 点击**走通 P-21 → P-28 → CD-01 → E-50 → D7 → Apply → M-17 → 06 Output，上下文全程保留，与 §E2E 系统级验证互为佐证。
- **P1-ObjectMatrix**：新增 `docs/phase-0.5/OBJECT_NAVIGATION_MATRIX.md`——核心对象跳转矩阵（查看→修改→运行态→影响→返回闭环）+ 硬规则（跳转携带对象上下文、禁止泛化首页、surface ID 与 Registry 一致），NAVIGATION 已加引用。属 Phase 4 实现约束文档（本门禁唯一新增文档，非 UI 页面）。
- 校验：`scripts/check_docs.py` **PASS**（含新增 NAVIGATION/Registry 计数一致性规则）。结论：Phase 0.5 维持 LOCK FINAL；本门禁为进入 Phase 0.6 Executable Acceptance 前的最后一组一致性收口，未做新增 UI 页面（仅 OBJECT_NAVIGATION_MATRIX.md 为授权例外）。

### Phase 0.6 Final Preflight Cleanup（2026-08-25，基于 b5c47fa）
- **P0-Contract**：`PRODUCT_OBJECT_MODEL.md` 删除 `SIGUSR1 = V0.2 协议` 的错误产品契约表述，改为正式 Runtime Apply Contract `Session Apply Runtime Revision`（JSON-RPC `session.apply_revision`, V0.2 §3.x Runtime Contract）；SIGUSR1 仅标为 Implementation Detail，禁止写入产品/运行时契约（防止进程信号偷偷变成架构事实）。
- **P1-Status**：统一 0.5C 状态文本 DRAFT/RECONCILED → LOCK FINAL——Root README Evolution 表 `🟡 DRAFT 0.1` → `🟢 LOCK FINAL`；MILESTONES `🟢 RECONCILED` → `🟢 LOCK FINAL`；NAVIGATION `🟡 RECONCILED` → `🟢 LOCK FINAL`（保留 `Historical: RECONCILED`），章节标题 `Phase 0.5C RECONCILED 验证清单` → `LOCK FINAL 验证清单`。
- **P1-M17-OutputLink**：M-17 `Backup Output (CDN Failover)` 区块改名 `Output Runtime Link`，表内容改为 `output_variant / status / primary / backup / retry_policy(defined in 06-output) / runtime_link [Open Output] → 06-output / D7`，明确 `Owner: Output Session`，消除 "Encoder 管 Output" 的视觉误导（Encoder ≠ Output 语义化）。
- **P1-RefB-Composition**：Reference B 新增 Program/Variant Composition 双层验收——Program Scope 跨 Variant 共享（全台 Logo）、Variant Scope 仅目标 Variant（平台水印/区域贴片）、Acceptance 禁止把 Composition 全提前到 Program Master。
- **P1-Network-UDP**：新增 Network Source Acceptance (UDP UNI/ASM/SSM)——三模式独立 schema 与必填字段（SSM 的 Source IP 不可丢）、IGMP 版本随模式切换 (ASM→IGMPv2 / SSM→IGMPv3)、E-40 动态渲染。
- **P1-E2E**：新增 E2E Acceptance: Profile→Bundle→ChangeSet→Runtime→Output 完整配置生命周期（Impact Preview 选择性 Apply / Preflight WARN≠PASS / Runtime Revision 单调+1 可回滚 / Apply 期间 Output HEALTHY）。
- 校验：`scripts/check_docs.py` **PASS**。结论：Phase 0.5 维持 LOCK FINAL；本清理为进入 Phase 0.6 Executable Acceptance 前的最后一组一致性/契约收口，不做任何新增页面或架构改动。

### Phase 0.6 · G-DOC Entry Patch + Executable Acceptance Harness（2026-08-25，基于 7d12f10 复检，GO Phase 0.6 G-DOC）
用户以 `7d12f107fc72799995aae374c1403ec304756746` 回归, **正式判定: Phase 0.5 保持冻结 / Phase 0.6 = GO, 立即启动 G-DOC, 不再做一轮 0.5 全面复检**。给出 4 个 G-DOC Entry Patch + 落地 `tests/fixtures/env/runners/evidence` 骨架:
- **DOC-01 (P1, 不阻塞 G-DOC) · ROADMAP FI 枚举补全**: `ROADMAP.md` 顶部已写 8 FI, 但明细只列 FI-01~05; 已补全 **FI-01A / FI-01B / FI-02 / FI-03 / FI-04 / FI-05 / FI-06 / FI-07** 八项 (含 injection_point / domain / 期望恢复 / Channel Health)。
- **DOC-02 (P1) · check_docs.py FI 护栏升级为 FI Set / Reference Coverage Validator**: `check_phase06_fi_ids()` 重写 — (1) 计数一致; (2) 每个 canonical FI 必须有 `#### FI-0X` 定义块 (抓 "声明无定义"); (3) 任意文档引用的 FI ID 必须属于 canonical (抓 phantom FI-09); (4) 反向引用; (5) 摘要同口径。新增 `check_phase06_harness()`: **G-DOC-READY 门禁** — 每个 Test Case 的 fixture_id/env_prereq_id/runner 必须实际存在, 且每 FI/AC/UI-E2E/HA Reference 在 `tests/` 至少 1 个 Test Case。首次运行即抓出 "canonical 含裸 FI-01 (phantom)" 与 "FI-02~07 无 Test Case"。
- **DOC-03 (🟡) · check_docs 注释口径**: `7 个`/`5→7` 旧注释 → `8`/`5→7→8` (与 0.6 README 顶部标题 `统一 5→7→8 / 8 FI canonicalization` 一致)。
- **DOC-04 (🟡) · 0.6 README 历史标题残留**: `统一 5→7` → `统一 5→7→8 / 8 FI canonicalization`。
- **GDOC-02 · 真正可执行 Harness 落地 (非仅 Markdown)**: 新增 `docs/phase-0.6/` 结构 — `SCHEMA.md` (Test Case YAML SoT) + `ACCEPTANCE_REPORT.md` + `tests/` (AC-01-001 / AC-03B-001 / A2-001 / B-001 / HA-01-001 / FI-01A-001 / FI-01B-001 / FI-02~07-001 / UI-E2E-01-001, 共 13 个 Test Case) + `fixtures/` (F-A1-PASS / F-A2-SDI-FRAME / F-B-HETEROGENEOUS / F-AC03B-OVERRIDE / F-UI-PROFILE-FLOW / F-FI-01A/01B/02/03/04/05/06-MASTER-JOIN/07-RECORDING, 共 13 个) + `env/ENV-LAB-01.yaml` (真实地址 `<LAB_HOST>` 占位, 私有 manifest) + `runners/run_reference_a1.py`/`run_fi_matrix.py`/`run_ui_e2e.py` (真实可执行 Python 骨架, 加载 YAML+产出 evidence) + `evidence/.gitkeep`。闭环: Test Case → Fixture → Env → Runner → Evidence → Pass Rule (机器可判定)。
- **FLOW-01 · G-DOC 与 G-RUNTIME 之间加 G-DOC-READY Gate**: `docs/phase-0.6/README.md` Gate 流程改为 `G-DOC → G-DOC-READY → G-RUNTIME → G-UIUX`; 原则 "先把测试框架本身冻结, 再跑实体测试", 防止 Evidence/Test ID/Fixture ID/Pass Rule 不统一。
- **ARCH-01 · Reference B 执行风险**: 明确 Reference B (SDI/SRT/Normalize/MASTER_SWITCH/Composition/Audio Mixer/Loudness/Delay/Multi-Variant/HLS/RTMP/WHEP) 复杂度最高, 置于 A1/A2/FI 之后; 落地顺序严格执行 A1→A2→B→FI-01~07→HA-01~07。
- **UX-01/UX-02 · TAKE revision + Playwright**: TAKE 必须只使用 EFFECTIVE revision (r17), 不取 Pending (r18) → 落成 G-UIUX/TAKE-REVISION-001; Runtime 层 (AC-*) 可 JSON-RPC/CLI 旁路, **UI 行为 (UI-E2E-*) 不可旁路 UI** (Playwright 不稳定可降级渲染校验, 但 click 路径保留)。
- 校验：`scripts/check_docs.py` **PASS** (含 `phase06` = FI 集合一致性 + G-DOC-READY 全绿); 3 个 runner 实测可执行并产出 evidence JSON (PyYAML 环境下)。结论：**Phase 0.5 = LOCK FINAL (冻结)**; **Phase 0.6 Specification = READY FOR IMPLEMENTATION**; **G-DOC Harness 结构已落地并通过 G-DOC-READY 门禁**; 下一步进入 G-RUNTIME (A1→A2→B→FI→HA, 先 Runtime 再 UI) 实体测试。

### Phase 0.5C — Information Architecture Closure（2026-08-25，DRAFT 0.1 待审）
- 目录归并：`docs/phase-0.5b/` 并入 `docs/phase-0.5/`（git mv 保留 history；wireframes 拆为 `operator/` 10 张 + `product/` 5 张）
- 新增 `OBJECT_VOCABULARY.md`（14 对象权威定义）/ `PRODUCT_OBJECT_MODEL.md`（Profile/Bundle/Variant 3 层）/ `NAVIGATION.md` / `MILESTONES.md` + `milestones/` 历史归档
- UI 顶层导航从 6 编号域改为 4 业务域（BROADCAST / MEDIA / ENGINEERING / ADMIN）
- Phase 0.6 README 语义修复（failover 时延验收写法：target_failover_time_ms + 实测 p50/p95/p99，禁止协议式保证）
- 0.5C.1 回写与对账（本轮）：README 引擎/横向系统名单按架构 §2.1/§2.2 修正；根目录残留副本清理；`.gitignore` 排雷（`*.ts` 全局忽略会吞掉 Phase 2/4 TypeScript 源码）；product wireframe 死链修复；ROADMAP/CHANGELOG/docs README 门面同步

### Phase 0.5B — Product UI Surface（UX BASELINE LOCK FINAL）
- 0.5B.0：`SURFACE_SPEC.md`（38 编号 UI 表面 = 0.5A 10 + 新增 28；Closure-1 另增 CD-01，现总 39）+ 13 项 P0 语义收口（SP-P0-1..13）+ `I18N_SPEC.md`（zh-CN + en-US 契约 / Canonical Vocabulary / 11 enum 翻译表）
- 0.5B.1：5 张 P0 wireframe（M-11 Media Library / M-12 Asset Detail / M-14 Transcode Center / P-21 Encoding Profile / P-22 Output Profile）
- Closure-1：10 项产品化收口（Output Profile/Variant/Destination/Adapter 4 元组、DESIRED/COMPILED/EFFECTIVE 三层、Dependency Preview 等）
- 0.5B.2：8 项 P0 + 5 项 P1 UX 收口 + `DESIGN_SYSTEM.md`（token / 组件 / 状态模型 / 键盘）→ UX BASELINE LOCK FINAL
- 语义收口合计 36 项（31 P0 + 5 P1），明细见 `docs/phase-0.5/SURFACE_SPEC.md` §30 收口项附录

### Phase 0.5A — Operator Semantics（LOCK FINAL）
- `OPERATOR_WORKFLOW.md` + 10 个双语 wireframe（`operator/`，9 Core + 1 Validation）+ 4 关键操作链（On-Air / Failure / Playout / Engineering）
- 20 项 UI 语义修复（`ERRATA.md`：12 P0 + 8 P1）

### 新增
- 初始化开源仓库 + 开源文件：README、LICENSE（Apache 2.0）、.gitignore、CONTRIBUTING、CHANGELOG、ROADMAP、SECURITY

## [V0.2] - 2026-08-24 — 架构基线 LOCK FINAL

### 22 轮 review 锁定
- 19 轮 review（V0.2.1 → V0.2.4） + Cleanup-1/2/3 + Errata-1/2/3/4/5/6/7/8/9/10/11/12/13/14
- 详见 `docs/architecture/ARCHITECTURE_V0.2.md` 附录 C（C.1-C.26 + V0.2 终态块）

### 核心架构
- **12 Engines（§2.1）**：Source / Signal Fabric / Normalize / Redundancy / QC / Playout / Switcher / Composition / Audio / Output / Recording / Replay
- **5 横向系统（§2.2，V0.1 既有）**：H1 Safety / H2 Resource Scheduler / H3 Watchdog & Incident / H4 Audit / H5 Subtitle
- **6 横切能力 (X1-X6)**：Graph Compiler / Preflight / Configuration Versioning / Incident Timeline / Health Tree / Capability Registry
- **22 原则**（V0.2.1 16 → V0.2.2 22）
- **57 决策**（V0.2-final 40 → Cleanup-2 +3 → Errata-2 +4 → Errata-3 +4 → Errata-6 +2 → Errata-9 +4）

### Data Plane
- 4 Layer：ELEMENTARY / CONTAINER / METADATA / CONTROL
- 7 类型：COMPRESSED_VIDEO / COMPRESSED_AUDIO / RAW_VIDEO / RAW_AUDIO / METADATA / EVENT / DECODED-process
- Switch Mode 3：PACKET_SWITCH / FRAME_SWITCH / MASTER_SWITCH
- Switch Decision Result 4：PACKET_SWITCH / FRAME_SWITCH / MASTER_SWITCH / REJECT
- Hot-Standby Level 3：COLD / WARM / HOT（Policy/Target，非 Runtime State）

### Runtime Semantics（CLOSED）
- **Lifecycle**：STOPPED / STARTING / RUNNING / STOPPING
- **Readiness**：NOT_READY / READY_TO_TAKE
- **Health**：HEALTHY / DEGRADED / FAILED / UNKNOWN
- **EffectiveChannelStatus**：HEALTHY / DEGRADED / FAILED / STARTING / STOPPED / UNKNOWN
- **Failure Model**：OperationalFailureDomain (7) + DiagnosticFailureClass (2: PLAYER / UNKNOWN)
- **Health Tree SoT**：§3.9 Health Tree Aggregation Policy
- **7 Health Invariants**：H1-H7（C.26 Errata-14）

### Schema（V0.2.4 Errata-11/12/13/14）
- `media_session_runtime` 表：lifecycle / readiness / health / effective_switch_mode / runtime_alignment_state
- `current_health_trees` View：DISTINCT ON channel_id 取最新 snapshot
- `channel_health_aggregation` View：7 规则真执行 ACTIVE/STANDBY/OFFLINE/Subsystem/RG
- `channel_health_view` View：真执行 effective_channel_status_policy（CASE + LEFT JOIN）
- `health_tree_nodes` Schema：subsystem + redundancy_group_id + node_role + required_node + state
- `effective_channel_status_policy`：precedence + rules（STOPPED / STARTING / FAILED / DEGRADED / HEALTHY / UNKNOWN）

### 禁止项（V0.2.4 Errata 锁定）
- ❌ 新增 Engine（12 是最终）
- ❌ V0.2 阶段新增 Source Adapter（RIST/Zixi/NDI 等 V0.3）
- ❌ 修改 Data Plane / Switch Mode / Hot-Standby / Program Master
- ❌ 任何 V0.2.x 架构 review（永久关闭）
- ❌ 把 `current_host_snapshot` 内容写进 Architecture
- ❌ 把 `pcie_*_mb_s` 当成实测值
- ❌ 写死资源 / GPU / 设备型号

## [V0.1] - 2026-08-XX — Web 视频编码器（pre-VBMF）

- Docker compose 骨架
- 选型：FFmpeg / SRS
- 初始 SDI → RTMP 单链路
- 详见 `docs/SYSTEM_AND_PROJECT_PLAN.md`

---

## 版本说明

- **V0.2 LOCK FINAL**：任何架构级扩展必须开 V0.3 流程
- **Phase 0.5**：0.5A Operator Semantics（LOCK FINAL）+ 0.5B Product Surface（UX BASELINE LOCK FINAL）+ 0.5C Info Arch（DRAFT）+ 0.5D P0 Product Surfaces（待开始）
- **Phase 0.6**：Reference A1/A2/B + 5 Fault Injection + 7 Health Invariants = Executable Acceptance Specification（前置: Phase 0.5 LOCK FINAL）
- **Phase 1**：Media Agent (Rust) + Session Manager + FFmpeg Command Builder + 24h 稳定性
- **Phase 4**：Web Console (4 域 × 44 UI 表面 + 4 链验证)
