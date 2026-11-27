# VBMF 产品需求文档（PRD）· V1.0

> **状态**：🟡 **DRAFT — 待 owner 审阅签字**（2026-11-27 起草）
> **定位**：VBMF **唯一产品层顶层文档** —— 回答「这是什么产品、给谁用、要解决什么问题、做到什么算做完、还差多少、下一步做什么」。
> **不重复**：架构语义、契约条款、数据模型、UI 逐字段规范一律**引用**既有冻结文档，本文不复制、不改写、不覆盖它们。
> **读者**：项目团队 + Agent（内部技术对齐口径；保留契约名 / 门禁名 / 证据术语）。

| 维度 | 事实 | 来源 |
|---|---|---|
| 架构基线 | V0.2 LOCK FINAL · 12 Engines + 5 横向系统 + 6 横切能力 + 57 决策 | `docs/architecture/ARCHITECTURE_V0.2.md:10,258-296` |
| UX 基线 | Phase 0.5 UX BASELINE LOCK FINAL · 56 表面（32 LOCK + 24 SPEC） | `docs/phase-0.5/MILESTONES.md:132`、`docs/phase-0.5/SURFACE_REGISTRY.yaml:1-14` |
| 运行时 | media-agent 84 个 .rs / 55,752 行 · **STABILITY VERIFIED** | `services/media-agent/src/`、`AGENTS.md:7` |
| 控制面 | Fastify · 11 个 wire 端点 · 116 测试 75 pass / 41 skip | `apps/api/src/routes/schemas.ts:571-631` |
| 外部界面 | Web Console 7 页 · **已实现线框表面 2 / 32（6.3%）** | `apps/web-console/src/App.tsx:15,33-53` |
| 真实缺口 | **不是 56 份设计没做完，是 30 条业务纵切没建** | 见 §7.4 |

---

## §0 如何使用本文

### 0.1 本文回答什么 / 不回答什么

| 本文回答 | 本文不回答（去哪儿看） |
|---|---|
| 产品是什么、解决谁的什么问题 | 架构语义与状态机 → `ARCHITECTURE_V0.2.md` |
| 有哪些角色、各自能做什么 | 权限细则 → `SURFACE_SPEC.md:140-186` |
| 操作员日常怎么干活（4 条链） | 逐页面字段 → `SURFACE_SPEC.md` + `docs/phase-0.5/operator/` |
| 产品范围有多大、什么不做 | 表面计数 → `SURFACE_REGISTRY.yaml`（唯一 SoT） |
| 今天真实做到什么、还差多少 | 契约级完成度 → `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md` |
| 下一步做什么、按什么顺序 | 实时任务队列 → `.project/STATE.md` §4–§5 |
| 什么算做完了（验收判据） | 门禁脚本 → `scripts/check_*.py` |

> **反模式**：本文不复制 `ARCHITECTURE_V0.2.md` 的 4028 行正文。需要细节时按引用跳转，不要在本文里维护第二份语义真相。

### 0.2 权威位阶

既有三层 SoT 已由 `DEPLOYMENT_AND_DEV_RUNTIME.md:12-24` 确立，本 PRD **不改变**该层级，只在其上补一层产品层：

```
L0  产品层（本文）           —— 为什么做 / 给谁 / 做什么 / 做到什么程度
L1  Runtime 语义 SoT        —— ARCHITECTURE_V0.2.md
L2  Reconciliation SoT      —— TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md
L3  Deployment SoT          —— DEPLOYMENT_AND_DEV_RUNTIME.md
L4  UX / Workflow SoT       —— docs/phase-0.5/
L5  Acceptance SoT          —— docs/phase-0.6/
+   接口 SoT                —— docs/architecture/V0.3/API_MASTER_DESIGN.md
+   实时状态                —— .project/current-work.yaml + .project/STATE.md §4–§5
```

**裁决规则**（继承既有规则，本文只加一条）：

1. 与 V0.2 Runtime Semantic 冲突的旧表述 → **一律以 V0.2 为准**（`TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md:26`）
2. 与 Ownership SoT 的 F2/F4/F11 冲突 → **以 Ownership SoT 为准**（`DEPLOYMENT_AND_DEV_RUNTIME.md:22`）
3. **（新增）本文与任何架构/契约文档冲突 → 以架构/契约为准**；本文只承载「产品意图与优先级」，不承载「语义与条款」
4. 实时进度以 `.project/current-work.yaml` + STATE §4–§5 为准；本文 §7 的现状快照标注了采集日期，**会过期**

### 0.3 与既有 3 份 PRD 的关系

| 旧文档 | 行数 | 性质 | 处置 |
|---|---|---|---|
| `docs/VBMF 下一阶段总架构升级方案 + PRD.md` | 4770 | 201 条愿景+需求混合稿，**无版本头、无日期、无状态声明** | **已执行** → 条款由 17 份契约承接；文件头已加本文指引 banner，原文保留 |
| `docs/VBMF Runtime Abstraction & Portability PRD.md` | 3900 | Runtime 内层 P0/P0.5 需求 | **已执行** → 165 条经 `PRD_REVIEW_RUNTIME_ABSTRACTION.md` 裁决落 Phase 0.6；文件头已加 banner |
| `docs/VBMF External Integration & Device Interoperability API PRD.md` | 4197 | External 外层 P1/P2 需求 | **裁剪采纳** → `PRD_REVIEW_EXTERNAL_API.md:14-22` 明示「本 PRD 不全盘接受」，#1–#137 可作 P1 规划、#138–#170 外置；文件头已加 banner |
| `docs/architecture/PHASE_0_6_MASTER_PRD.md` | 227 | 前二者 + 评审 + 契约的整合权威 | **仍有效**，作为技术整合入口保留；本文在产品层与其互补（它讲「怎么缝」，本文讲「为什么、要什么」） |

**外置清单（不得回流）**：Multi-site / Federation / Agent Registration / Artifact 上传子系统 / Event 三套推送 / Recording-Playback —— 见 `PRD_REVIEW_EXTERNAL_API.md` §0.5 与 §3.5（I–Q）。理由：无消费方不建抽象。

### 0.4 术语约定

| 词 | 含义 |
|---|---|
| **SoT** | Single Source of Truth，唯一事实源；本文出现即指某份文件是该项的权威 |
| **表面（surface）** | UI 上一个可独立寻址的操作面。**表面 ≠ 页面**：56 表面里 24 个只有语义契约（SPEC），无线框 |
| **LOCK / SPEC** | 表面设计状态。LOCK = 线框已交付；SPEC = 语义契约锁定、Phase 4 才画线框（`SURFACE_REGISTRY.yaml:41-47`） |
| **Canonical** | 与厂商无关的产品对象命名（`VENDOR_NEUTRALITY_RULES.md:7-13`） |
| **纵切（vertical slice）** | 一个表面 + 其依赖的后端端点 + 其验收证据的完整组合。**本项目当前的主要缺口单位是纵切，不是页面** |
| **显式 N/A** | 该字段当前无数据源，在 UI 上**明确标注为 N/A**，而不是留空或伪造（红线：`client.ts` 明写「HTTP 4xx/5xx 必须真实展示」） |

---

## §1 产品定位与价值主张

### 1.1 一句话定位

**VBMF 是面向 24/7 广播机房的 IP 广播级媒体信号调度与虚拟播控平台**（`ARCHITECTURE_V0.2.md:3`）。

把 **SDI 摄录 → 编码 → RTMP / HLS / WebRTC 分发**，加上 **VOD 转码** 和 **Web 控制台**，用 12 个独立 Engine 干净组合实现。

### 1.2 要解决什么问题

V0.1 是一个 Web 视频编码器，升级到 VBMF 的根因是 8 个**架构级**问题（`README.md` V0.1→V0.2 对照表；`docs/V0.1_RETROSPECTIVE.md`）：

| # | V0.1 问题 | 严重度 | 产品级后果 | VBMF 的解法 | 状态 |
|---|---|---|---|---|---|
| 1 | 无主备切换（单点故障） | 🔴 致命 | 一个 SDI 抖动就断播 | Switch Mode 3 档 + Hot-Standby 3 级 | 契约冻结 · 运行时**零实现**（RD-01A 冻结中） |
| 2 | 无健康监控，故障后只能 SSH 查 log | 🔴 致命 | MTTR 以小时计 | Health Tree + 7 条 Health Invariants + 三轴状态 | 契约+运行时已落地；**UI 表面未实现** |
| 3 | SDI 被当成 COMPRESSED 域 | 🔴 正确性 | 资源预算错误、延迟模型错误 | 4 Layer × 7 Type，SDI = RAW | 已落地 |
| 4 | 无 Capability Contract | 🟠 高 | 切源时对齐失败 | §3.4 switch_mode_decision_tree + X6 Registry | 决策树冻结；Registry 已落地 |
| 5 | 无 Change Set / 回滚 | 🟠 高 | 事故后不知道跑的是哪一版 | X3 Configuration Versioning + Atomic Apply | 契约冻结；**UI 表面未实现** |
| 6 | 无 Program Master | 🟠 高 | 切换后画面跳变 | 三独立 graph（Video/Audio/Metadata Master） | 契约冻结 |
| 7 | 无 Failure Domain | 🟠 高 | 一个播放器缓存异常把源切了 | 7 Operational + 2 Diagnostic 分域 | 契约冻结 |
| 8 | 无 Clock / Latency Probe / Incident Timeline / AVSync | 🟡 中 | 延迟只能猜 | 分段 probe（capture→…→player）+ X4 | 契约冻结；部分实现 |

**产品级价值主张（可直接对客户讲）**：

1. **不显式声明 Data Plane，资源就算不准** —— 「系统会『看起来很便宜』但实际爆 CPU」（`ARCHITECTURE_V0.2.md:88`）。媒体资源必须按 RAW / COMPRESSED 分层计价。
2. **故障不误切源** —— 「节目源没故障时，**绝不能**因为 Output 故障而切源」（`:2151-2152`）。这是播出事故零容忍的底线。
3. **延迟必须可归因** —— 分段 probe，7 stage + 2 E2E + 1 CDN（`:119-137`）。「没有分段，出了问题只能猜是 FFmpeg 还是 SRS」。
4. **换品牌 / 换后端只动实现，不动语义** —— BMD→AJA 只换 Provider + Rebind，不改 Session/Graph/Health/Supervisor/UI（`IMPLEMENTATION_BOUNDARIES.md:76-81`）。不被任何硬件或中间件绑死。
5. **操作员级验收标准** —— 4 条关键操作链走通，才算经过「操作员级」验证（`:2337`）。这不是架构自证，是人证。
6. **稳定采集 > 容器隔离** —— runsc/gVisor 三变体实测全 FAIL（0 设备），Option A 永久关闭（`MEDIA_RUNTIME_SECURITY_MODEL.md:24-26`）。安全向可用性让步是显式产品判断。

### 1.3 产品边界

**做**（V0.2 锁定范围）：

- 单租户的广播机房媒体处理平台（决策 #6「单租户起步」）
- 12 Engine 的组合式媒体能力 + 5 横向系统 + 6 横切能力
- Web 控制台作为操作入口（同源，浏览器零直连运行时）
- 厂商中立 + 9 轴可移植
- standalone 优先（`AGENTS.md:25`）

**不做**（明确排除，避免范围蔓延）：

| 不做项 | 依据 |
|---|---|
| SDI Master Output | `RESERVED / V0.2 DISABLED / Target V0.4`（决策 #12/#49，`:1891,1928`） |
| 双机热备 | 「V0.2 不做」（决策 #13，`:1893`） |
| 边缘节点 | 「V0.2 单 Agent」（决策 #14，`:1894`） |
| 多租户 | 「单租户起步」（决策 #6，`:1885`） |
| RIST / Zixi / NDI 新协议 | 「V0.2 只抽象，V0.3 才加」（`:1891,3957`） |
| 动态 .so plugin 加载器 / 通用硬件库 / 信号 AI | 「无消费方不建抽象」（`TECHNOLOGY_PORTABILITY_MATRIX.md:23`） |
| Multi-site / Federation / Artifact 子系统 | 外置（`PRD_REVIEW_EXTERNAL_API.md` §0.5、§3.5 I–Q） |
| 广播级 SDI 基带监看 | V0.2 RESERVED，Target V0.4；当前用 HLS 近实时监看（工作包风险段：SDI 基带预览 = V0.2 RESERVED / Target V0.4） |

### 1.4 成功标准

| 层级 | 判据 | 现状 |
|---|---|---|
| **北极星** | 4 条关键操作链在**真实部署 + 真实故障注入**下端到端通过，且有可复核证据 | ⛔ 0 / 4（链 1 部分可跑通，但 Product API 缺 take/channel 端点） |
| 稳定性 | 24h 连续运行 RSS 终段斜率达标 + 零未分类增长 | ✅ **STABILITY VERIFIED**（绑定见 §6.5） |
| 架构中立 | BMD→AJA 换型只改 Provider，Session/Graph/Health/Supervisor/UI 零改动 | ⚠️ 契约+lint 已落地，**未做真实换型验收** |
| 外部界面 | 56 表面按域交付，操作员能在控制台完成日常播出 | ⛔ **2 / 32 LOCK**（6.3%） |
| 控制面质量 | TypeScript 车道纳入 required context，文档门禁进 CI | ⛔ 未达标（§7.6） |

---

## §2 用户与角色

### 2.1 权威角色矩阵（4 角色）

采用 `OPERATOR_WORKFLOW.md:9-14` + `SURFACE_SPEC.md:148-155` 的 4 角色版（LOCK）。**这是本文的裁决**：7 角色版（`NAVIGATION.md:194-204`）与 PIA 版（4 角色含 SRE、无 Admin）均视为 §11 待裁决项，本文暂不采用。

| 角色 | 核心职责 | 关键表面 | 权限 |
|---|---|---|---|
| **Operator 操作员**（导播 / 值班员） | 日常播出、应急切源、实时监控 | 01-dashboard · 03-switcher · 06-output · 07-recording · 09-health-tree | View + Take + Emergency Stop |
| **Director 节目总监** | 节目编排、Composition | 04-composition · Playout | View + Apply Change Set |
| **Engineer 系统工程师** | 图设计、调参、故障诊断 | 02-sources · 08-graph-designer · 09-health-tree · Configuration | View + Compile + Apply + Rollback |
| **Admin 系统管理员** | 账号、RBAC、审计 | 全表面 | Full（含 User / System） |

权限三档定义（R / W / A）见 `SURFACE_SPEC.md:140-146`；角色 × 工作域 × 权限全局矩阵见 `SURFACE_SPEC.md:173-186`。

**角色诉求（产品视角）**：

- **Operator** —— 「我现在播的是什么、要不要切、切完对不对」。绝大多数时间只需要 **Dashboard 一个表面**（`NAVIGATION.md:56-61`：BROADCAST 域主要用户 = Operator / Director）。
- **Director** —— 「这个时段播什么、能不能排进播出表」。
- **Engineer** —— 「这台机器现在是什么状态、图怎么改、改了会不会挂」。
- **Admin** —— 「谁能干这个、昨天谁干的」。

### 2.2 硬权限边界（不可协商）

| 约束 | 内容 | 来源 |
|---|---|---|
| Operator 不可编辑 Profile Definition | 只能选兼容 Revision 引用 / 建 ChangeSet / Preflight / Apply | `PRODUCT_OBJECT_MODEL.md:80-83` |
| Operator 的音频只有 Runtime Quick Control | 深度 Policy（Layout / Routing / Mix / Loudness）归 P-23 | `MILESTONES.md:155` |
| Bundle 不是第二个 Profile Builder | Bundle 只持引用，不持副本 | `PRODUCT_OBJECT_MODEL.md:83` |
| 单一创建入口 | Source 唯一入口 = E-40→E-42；Destination 唯一入口 = CD-01 Output / 06-output；Profile 禁在运行页改参数；ChangeSet 禁由 TAKE 生成 | `EXECUTION_MODEL.md:253-263` |
| Operator 只能改自己 channel 相关的 Profile | 改他人需 Engineer / Admin | `SURFACE_SPEC.md:184` |

### 2.3 危险操作分层

| 级别 | 判定 | 交互要求 | 例子 |
|---|---|---|---|
| **L1** | 可逆、影响单通道、秒级恢复 | 单次点击 + 立即反馈 | 停止一个转码 Job |
| **L2** | 影响在播内容、需确认 | **确认弹层 + 3s 倒计时**，不可「点完即生效」 | **TAKE**（链 1 第 5 步）、Schedule Apply |
| **L3** | 影响全局 / 不可逆 / 跨系统 | **二次确认 + Who / Why / 紧急 Override 逃生通道** + 审计 | Emergency Override、Profile Bundle 变更、Apply Change Set |

依据：TAKE 在链 1 中明确为 L2（`chains/chain-1-on-air.md:35-45`）；Emergency Override 的 L3 + Audit + Who/Why 逃生通道见 `CHANGELOG.md` Phase 0.5F.11 P0-1 条目；危险操作分层原始设计位于 `ARCHITECTURE_V0.2.md§10.1-10.10` —— **但该章为空壳占位**（见 §5.5），本文的分层是据链文档 + ChangeLog 重建的**产品侧意图**，其架构原文缺失，属 §11 待补债。

---

## §3 核心工作流（4 条关键操作链）

这 4 条链是 V0.2 对「操作员级验证」的定义（`ARCHITECTURE_V0.2.md:2337`）。**PRD 的功能范围以这 4 条链为验收单位**，而不是以 56 个页面为验收单位。

### 3.1 链 1 · On-Air 播出（Operator）

**起点**：Operator 登录 → Dashboard 01　→　**终点**：HLS .m3u8 200 浏览器播放（`chains/chain-1-on-air.md:5,10-28`）

| 步 | 动作 | 关键检查 | 失败兜底 |
|---|---|---|---|
| 1 | 登录（RBAC） | 角色 = Operator | 拒绝进入 |
| 2 | 选 Channel | Channel 须 RUNNING | 灰显 |
| 3 | 看 PVW | PVW 有画面 | 无信号 → 空态 |
| 4 | 选 NEXT | 源须 HEALTHY，否则灰显禁选 | 禁选 |
| 5 | **TAKE（L2，3s 倒计时）** | 确认 + 倒计时 | 可取消 |
| 6 | Switch Mode 决策 | PACKET / FRAME / MASTER（§3.4 决策树） | REJECT ≠ SwitchMode |
| 7 | Program Master 三独立 graph 同步 | Video / Audio / Metadata 任一失败 → DEGRADED | 降级不中断 |
| 8 | Variant Composition | RAW 域 | — |
| 9 | Encode | 重试 3 次 | 失败 → DEGRADED |
| 10 | HLS 分发 | 切片生成 | 失败 → Restart Adapter |
| 11 | 客户端播放 | 播放器可播 | — |

- **健康不变量**：H1、H5（切源后旧 Primary OFFLINE 必 PASS）、H6 不应触发、H7 必 PASS（`:49-52`）
- **验收判据 OnAir-01..05**（`:56-60`）：① 切后 Channel = HEALTHY；② **AV sync 漂移 < 80ms 且 3s 内恢复**；③ 切源后保持 HEALTHY；④ 同 Channel 连续 TAKE 3 次第三次仍正常；⑤ Variant Composition 切换无画面中断
- **当前实现度**：**部分**。Dashboard + HLS 监看窗 + 会话起停已落地（WCO-01B），但 **TAKE / NEXT 预监 / PVW / Channel 选择均无端点**（见 §3.5 映射表）
- **范围外**：故障切换 / 节目单 / 图设计（`:75-77`）

### 3.2 链 2 · Failure 故障（Operator + System）

**起点**：Source.A SDI 冻结 5s　→　**终点**：录像回溯 Chunk 14:25–14:30（`chains/chain-2-failure.md:5,10-33`）

13 步（`:40-52`）：物理故障 → QC black/freeze 5s 阈值 → Health Tree ACTIVE+FAILED → Aggregation Rule 1 → ECHS=FAILED → **Switch Decision Tree**（PACKET? No → FRAME? Yes → 执行 FRAME_SWITCH）→ Source.B STANDBY→ACTIVE → Filler 兜底（按 §8.9 Safety Policy，**不写固定阈值**）→ ALERT Push + Dashboard 红条 → Incident 自动建档 → 录像不中断 → Operator Acknowledge → 点击 Incident → Chunk。

**Failure Domain → 恢复动作矩阵**（`:56-68`）：

| Failure Domain | 恢复动作 |
|---|---|
| SOURCE | FAILOVER |
| PIPELINE | RESTART_NODE |
| MASTER | FILLER_OR_EMERGENCY |
| OUTPUT | RESTART_ADAPTER |
| RECORDING | BACKUP_DISK |
| CLOCK | FALLBACK_CLOCK |
| RESOURCE | DEGRADE_BG_JOBS |
| PLAYER（Diagnostic） | NOTIFY（fail-safe，**不切源**） |
| UNKNOWN（Diagnostic） | SAFE_DEGRADE + alert |

**验收 FI-01..FI-05**（`:79-85`）：SDI 冻结 / 音频静音 8s / FFmpeg 崩溃 / Clock Drift +5ms per min / HLS 切片失败 → 期望 DEGRADED → HEALTHY（或 CLOCK_DEGRADED 事件）。

**4 条禁忌**（`:109-112`）：① PLAYER 播放端缓存异常**绝不能切源**；② AV sync 异常必须先做 Failure Domain 分类；③ Master Join 失败 ≠ 切源；④ 同一切换不能在 100ms 内重试（避免 flapping）。

> **当前实现度**：⛔ **0**。Health Tree 运行时已落地、告警表已落地（AlarmsPage + /api/v1/alarms），但**自动 failover 零实现**（RD-01A 冻结中）、Incident Timeline 表面未实现、链 2 的核心（切源）无端点。

### 3.3 链 3 · Playout 节目单排播（Director）

**起点**：Director 登录 → Timeline　→　**终点**：30s 后自动切回原节目（`chains/chain-3-playout.md:5,10-36`）

12 步（`:43-54`）：打开 Timeline（空表 → 提示新建）→ 拖入 Asset（不在库则灰显）→ **Preflight 实时红框提示** → Save Draft(DRAFT) → Validate → Schedule Apply（**time > now + 5min**）→ APPLIED（snapshot + rollback）→ 自动到点（+5s 容差）→ 自动 TAKE → 持续 30s → 自动切回。

**X2 Preflight 7 项与阈值**（`:58-67`）：loudness −23 LUFS ±2 · rights valid_until > now+7d · duration 5s–7200s · codec H.264/H.265 + AAC/Opus · resolution 720p–4K · color_space BT.709/BT.2020 · audio_channels 2/6/8。

**Change Set 三层状态**（`:85-94`）：`DRAFT → VALIDATED → APPLIED → (ROLLED_BACK)`；phase `PREPARING → APPLYING → COMMITTED ↘ ABORTED`。

**验收 Playout-01..05**（`:110-114`）：① 30s ±0.5s 精确切回；② 响度不达标 Preflight 拒绝；③ 版权过期不能 Apply；④ 到点前 10s Dashboard 弹「即将切换」；⑤ Apply 后立即 Rollback 恢复 REV-001。

**4 条禁忌**（`:125-128`）：① 不能直接编辑 APPLIED 的 change_set；② 版权过期 Asset 不能 Apply；③ Schedule < now+5min 禁止；④ Composition 切 Variant 不能影响 Program Master。

> **当前实现度**：⛔ **0**。Asset / Asset Version / ChangeSet 对象在对象字典里已焊死，Profile 类有 8 kind，但**媒资域无任何端点**，Preflight UI 无表面。

### 3.4 链 4 · Engineering 工程（Engineer）

**起点**：Graph Designer 08　→　**终点**：Engineer 下钻 Health Tree → 修复 → 新 Change Set（`chains/chain-4-engineering.md:5,10-46`）

18 步（`:53-70`）：登录 → 拖节点（Palette = 11 Source + N Process + N Output）→ 连边声明 Data Plane / Clock / Latency / Capability → Save Spec(DRAFT) → **Compile X1**（Validator / Insert Missing / Clock Align / Latency / Resource）→ Resource Plan（9 维 + Device Token）→ **Preflight X2** → Dry Run → Apply Change Set → Logical Atomic Cutover → Runtime 上线（三轴）→ Health Tree H1-H7 → QC 持续监测 → 异常检测 → Incident 建档 → 下钻 → 修复。

**X2 Preflight 三类**（`:100-118`）：

| 类 | 检查项 |
|---|---|
| graph | cycle_check / data_plane_compatibility / clock_domain_resolvable / resource_vector_within_capacity / device_token_available |
| playout | loudness / rights / duration / codec |
| channel | capability_contract_pass / runtime_alignment_pass / hot_standby_level_consistent / health_tree_invariants_pass |

**业务层原子切换**（`:140-152`）：snapshot(rev-007) → prepare(rev-008：compile_runtime / allocate_resources / preflight_check) → success commit / failure rollback。**🔴 禁止 DB 事务层面的原子切换**。

**验收 Eng-01..07**（`:172-178`）：① 编译 OK + 0 critical + Apply 成功；② 含环拒绝；③ 资源不足提示扩资源或减 Session；④ Clock 不可解析拒绝；⑤ **Rollback 恢复 REV-007 < 5s**；⑥ 7 Health Invariants 全 PASS；⑦ QC 异常自动建 Incident 并通知 Engineer。

**7 条禁忌**（`:189-195`）：① 禁直接改 APPLIED 的 Graph；② 禁运行时改 Source Adapter 类型；③ 禁 Apply Dry Run 失败的 Graph；④ 禁 Logical Atomic Cutover 与普通 Apply 混用；⑤ 禁 `effective_switch_mode` 反写 `channel_routes.switch_mode`；⑥ 禁把 `current_host_snapshot` 写进 Architecture；⑦ 禁把 `pcie_*_mb_s` 当实测值。

> **当前实现度**：⛔ **0**。Preflight / Resource / Capability Registry 在**运行时已落地**（gap matrix：IMPLEMENTED + PASS），但**控制台无对应表面**，且缺 graph / profile / change_set 端点。

### 3.5 两条 UI 动作管线（顶层结构）

`EXECUTION_MODEL.md:275-303`：

```
A. 配置管线（改配置）
   Edit → Desired → Impact Preview(E-50) → Diff(E-51) → Preflight → ChangeSet(E-33) → Approve
         → Transactional Cutover → Compiled → Effective

B. 运行管线（动运行）
   Observe → Preflight/Readiness(B-13) → Operator Intent
         → TAKE / FAILOVER / RESTART / RETRY / OUTPUT RECOVERY → Runtime Event → Audit(A-54) → Incident Timeline
```

**TAKE / FAILOVER / RESTART / RETRY / OUTPUT RECOVERY 一律不进 ChangeSet**（`EXECUTION_MODEL.md:291-297,222`）。TAKE ≠ 配置变更（`:148-161`）。

> 这是本文对「配置面 vs 运行面」的产品级区分：**配置改动走可审计、可回滚的 ChangeSet；运行动作走四状态意图 + 事件流。** 任何新表面必须先归类到 A 或 B，否则会重演「TAKE 被做成 ChangeSet」的语义污染。

### 3.6 链 → 表面 → 后端端点 映射（缺口在这里显形）

| 链 | 必需表面 | 需要的后端能力 | 现有端点 | 缺口 |
|---|---|---|---|---|
| 链 1 On-Air | 01-dashboard · 03-switcher · 04-composition · 06-output · 09-health-tree | Channel 列表 / TAKE / PVW / NEXT / Program Master | `POST /api/v1/sessions`（起停 HLS 会话）· `GET /api/v1/runtime` | **缺 channel 资源、缺 take 端点、缺 program/pvw 状态** |
| 链 2 Failure | 09-health-tree · O-42/O-43 · 07-recording | 自动 failover / Health Tree 聚合 / Incident | `GET /api/v1/alarms` + ack · `GET /events/v1/stream` | **缺 failover 运行时（冻结）+ incident 资源 + health tree 端点** |
| 链 3 Playout | M-11 · M-12 · 07-recording · E-50/E-51 | Asset 库 / ChangeSet / Schedule / Preflight | 无 | **整条媒资纵切 0 端点** |
| 链 4 Engineering | 08-graph-designer · E-31 · E-37/E-38 · P-20 · D7 | Graph CRUD / Compile / Profile / Revision / Apply / Rollback | `GET /api/v1/runtime`（只读观测） | **整条工程纵切 0 端点**（除只读 runtime） |

**结论**：4 条链中，只有链 1 有部分端点支撑，且支撑的是「起停一个 HLS 会话」而非「切播」。**后端端点是当前的第一约束，不是 UI 工时。**

---

## §4 产品范围：56 表面

### 4.1 计数口径（唯一 SoT）

| 口径 | 值 | 含义 |
|---|---|---|
| 登记表面总数 | **56** | `SURFACE_REGISTRY.yaml`（唯一事实源） |
| LOCK | **32** | 线框已交付，设计契约完整 |
| SPEC | **24** | **仅语义契约锁定，连线框都没有**，Phase 4 才实施（`MILESTONES.md:149-166`） |
| BROADCAST | 13（13 LOCK / 0 SPEC） | 播出操作域 |
| MEDIA | 8（5 / 3） | 媒资与转码域 |
| ENGINEERING | 29（13 / 16） | 工程与运维域 |
| ADMIN | 5（0 / 5） | 管理后台域 |
| GLOBAL | 1（1 / 0） | 全局状态参考（非业务） |

⚠️ **两个必须避开的误读**：

1. **「56 表面」≠「56 个页面」**。24 个 SPEC 表面在 Phase 4 之前连线框都没有（`MILESTONES.md:132` 明写「LOCK FINAL ≠ 100% Wireframe Complete」，SPEC 不阻塞 Phase 0.6）。
2. **`SURFACE_SPEC.md:80-83` 内部仍写 39/44/48/52/55 等历史 as-of 计数，已自标废止**。读该文件时计数一律以 SURFACE_REGISTRY 为准。
3. **磁盘上 33 份 HTML 线框 ≠ 32 个 LOCK 表面**：`operator/09-health-tree.html` 对应的表面是 **O-41（SPEC）**，不是 LOCK。

### 4.2 表面总表

**BROADCAST（13，全部 LOCK）**

| id | 名称 | kind | 一句话职责 |
|---|---|---|---|
| 01-dashboard | 主控台 | DASHBOARD | 播出总览：NOW / NEXT / 状态条 / 通道状态 / 意图层 / 监看窗 |
| 02-sources | 源管理 | REGISTRY | 本地真设备 + 网络 / 内部源的注册、验证与占用 |
| 03-switcher | 切播器 | WORKFLOW | TAKE 5 状态机 + L2 确认 + 3 档 Switch Mode |
| 04-composition | 图文 | WORKFLOW | Timeline + Composition 双栏（RAW 域） |
| 05-audio | 音频 | WORKFLOW | 混音 / 响度 / 广播安全区 / AVSync |
| 06-output | 输出 | WORKFLOW | 3 视图输出管理 + Latency Probe |
| 07-recording | 录制 | WORKFLOW | 5 分钟分段录制 + Incident→Replay 工作流 |
| CH-01 | 通道列表 | REGISTRY | 通道总览与检索 |
| CH-02 | 创建通道 | WORKFLOW | 7 步创建向导（核心验收链） |
| CH-02B | 通道模板中心 | REGISTRY | 模板库 → 实例化 |
| CD-01-WS | 通道控制工作台 | WORKSPACE | Take Desk 7 块（Source/Switch/Health/PVW/PGM/NEXT/Audio/Output） |
| CD-01-Detail | 通道详情 | DETAIL | 8 Tab 深度配置与审计 |
| B-13 | Take 预检 | WORKFLOW | 9 项联合预检（切播前） |

**MEDIA（8）**

| id | 名称 | 状态 | 一句话职责 |
|---|---|---|---|
| M-11 | 媒体库 | LOCK | 媒资总览与检索 |
| M-12 | 资产详情 | LOCK | Asset 详情 + Version 谱系 |
| M-13 | 实时转码工作流 | SPEC | 实时编码的运营流 |
| M-14 | 文件转码 | LOCK | Asset → Output Version → Packaging → Job 全流程 |
| M-15 | 媒资辅助流 | SPEC | 媒资侧辅助操作 |
| M-16 | 媒资工作流 | SPEC | 媒资域工作流总览 |
| M-17 | 实时媒体会话 | LOCK | Realtime Session 工作区（Encoding Session · Runtime） |
| M-18 | 转码任务详情 | LOCK | 单 Job 详情与诊断 |

**ENGINEERING（29）**

| id | 名称 | 状态 | 一句话职责 |
|---|---|---|---|
| P-20 | Profile 中心 | LOCK | 8 类 Profile + Bundle 统一入口 |
| P-21 | 编码 Profile | LOCK | 编码参数档 |
| P-22 | 输出 Profile | LOCK | 输出参数档 |
| P-23 | 音频 Profile | SPEC（P0） | 深度音频 Policy（Layout/Routing/Mix/Loudness） |
| P-24 | 图形 Profile | SPEC | 图形叠加档 |
| P-25 | QC Profile | SPEC（P0） | 播出质量闸门 |
| P-26 | 版权 Profile | SPEC | 版权与合规 |
| P-27 | 边缘策略 Profile | SPEC | Output Egress 边缘策略 |
| P-28 | Profile Bundle | LOCK | 通道交付包（8 Profile 引用 + 继承链） |
| E-31 | 图形设计器 | LOCK | Signal Graph Designer（Scenario + 3 Tab） |
| E-32 | 预检中心 | SPEC | 变更前联合检查中心 |
| E-33 | 变更集 | SPEC | ChangeSet 集合与状态机 |
| E-34 | 能力注册表 | SPEC | Capability Registry |
| E-35 | 设备注册表 | SPEC | Device Registry |
| E-36 | 资源 / 容量 | SPEC | Resource & Capacity |
| E-37 | 时钟域工作台 | LOCK | Clock Reference / Quality 联动校验 |
| E-38 | 硬件清单 | LOCK | 硬件 inventory 与能力投影 |
| E-40 | 网络源创建向导 | LOCK | Network Source 5 分支创建 |
| E-41 | 网络路径检查器 | SPEC | 端到端路径逐层诊断 |
| E-42 | 源测试台 | LOCK | Source Test Bench（5 Kind × 真实验证步骤） |
| O-41 | 健康树 | SPEC | Health Tree Operator 视图（线框已在 09-health-tree.html） |
| O-42 | 事件中心 | SPEC | Incident Center |
| O-43 | 事件时间线 | SPEC | Incident Timeline |
| O-44 | 回放 | SPEC | Replay |
| O-45 | 基准测试 | SPEC | Benchmarks |
| D7 | 变更集审批 | LOCK | 配置审批独立面 |
| E-50 | 影响预览 | LOCK | 跨域影响 × 7 对象 × 4 维 × 4 级风险 |
| E-51 | 配置差异 | LOCK | 跨域配置差异 × 14 对象 × 3 视图 |
| E-52 | 命令面板 | LOCK | Ctrl+K 全局命令 / RBAC / L1-L3 |

**ADMIN（5，全部 SPEC · Phase 4 · P2 优先级）**：A-51 Users · A-52 Roles · A-53 Permissions · A-54 Audit Logs · A-55 System Settings。

**GLOBAL（1）**：10-states-validation — 全局状态参考页（32 状态 + 复用组件），非业务表面，**最后做**。

### 4.3 表面分期路线（与后端纵切绑定）

Phase 4 优先级已由 `MILESTONES.md:149-166` 裁决：**P0** = P-23 音频 Profile、P-25 QC Profile；**P1** = P-27 / P-24 / P-26 / E-32~36 / E-41 / O-41~45；**P2** = A-51~55 + M-13/M-15/M-16；P-20 "By Channel" Tab 归 Phase 4。

本文补充**按纵切可行性**的排序（因为多数 LOCK 表面无端点可接，见 §3.6）：

| 批次 | 表面 | 依赖端点 | 备注 |
|---|---|---|---|
| **B0** | 01-dashboard · 02-sources（已完成 2/2）+ i18n 层 + 4 项 UI 残留 | 现有 11 端点足够 | 见 §8.2 |
| **B1** | 03-switcher · B-13 · CH-01 · CD-01-WS | **需新增**：Channel 资源、TAKE 命令、PVW/NEXT 状态、Preflight 端点 | 链 1 的核心；价值最高 |
| **B2** | 09-health-tree（O-41）· E-38 · E-37 | **需新增**：Health Tree 端点；E-38 可部分复用 runtime 快照 | 链 2 / 链 4 的只读前置 |
| **B3** | E-31 图形设计器 · P-20/P-21/P-22/P-28 · D7 · E-50/E-51 | **需新增**：Graph / Profile / Revision / ChangeSet 端点 | 链 4；写操作密集 |
| **B4** | M-11 · M-12 · M-14 · M-17 · M-18 · 07-recording | **需新增**：Asset / Job / Recording 端点 | 链 3 |
| **B5** | E-50/E-51/E-52 已跨域可放 B3 后 | Impact / Diff / Command | 跨域能力层 |
| **B6** | 24 个 SPEC 表面 + A-51~55 | 各自契约 | Phase 4，**不进 Phase 0.6 验收范围**（`MILESTONES.md:166`） |

> **B1 是关键决策点**：做 B1 就必须扩 `apps/api` 的写端点族（channel / take / preflight），属**契约 additive 变更**。不做 B1，链 1 与链 2 永远停在「能起停一个 HLS 会话」。

### 4.4 明确不在产品范围内

见 §1.3 的「不做」表 + §0.3 的外置清单。补充三条：

- **广播级监看**（SDI 基带预览）：V0.2 RESERVED / Target V0.4；当前监看窗语义 = 「近实时 HLS（~6–10s 延迟）」，广播级仍靠 Mini Monitor。
- **E-42 Source Runtime Preview Stream**：尚未实现；MVP 播放器吃 HLS 会话产物而非 canonical 预览端点，接口留适配层（工作包风险段）。
- **像素级设计 / 国际化实现 / 移动端适配 / 权限系统实现细节**：Phase 0.5 明确划出（`OPERATOR_WORKFLOW.md:220-225`）。**注意：本仓库实际已先行实现 i18n 与响应式，超出该范围但是好事，不是越界**。

---

## §5 架构约束（继承，不重述）

> 本章只做**索引 + 诚实标注**。任何条款的正文在冻结文档里，本文不改写。

### 5.1 12 个 Engine（`ARCHITECTURE_V0.2.md:258-273`）

| # | Engine | 职责 | Data Plane |
|---|---|---|---|
| 1 | Source | 多协议信号接入（SDI/Raw · SRT · RTMP · HLS · FILE · INTERNAL · COMPOSITE） | 出 RAW_* / COMPRESSED_* / METADATA |
| 2 | Signal Fabric | 路由 / 矩阵 / 边策略 | — |
| 3 | Normalize | 格式归一（3 子能力，不改 codec） | RAW→RAW、COMPRESSED→COMPRESSED |
| 4 | Redundancy | 主备 / 切换（PACKET/FRAME/MASTER） | — |
| 5 | QC | 信号质量监测（**只读**） | 出 METADATA / EVENT |
| 6 | Playout | 虚拟播控 / 时间线 / 插播 | — |
| 7 | Switcher | 主备切换 | PACKET: COMPRESSED→COMPRESSED；FRAME/MASTER: RAW→RAW |
| 8 | Composition | 图文包装（Program 级 + Variant 级分层） | RAW 域；COMPRESSED 输入须先 Decode |
| 9 | Audio | 混音 / 响度 / 延迟 / 同步 | RAW_AUDIO→RAW_AUDIO |
| 10 | Output | 多路分发（含 SRS Gateway Adapter） | SRS: COMPRESSED→COMPRESSED；**SDI: RESERVED/V0.2 DISABLED** |
| 11 | Recording | 收录 / 分段 | 透传录制 |
| 12 | Replay | 延时 / 回放 | — |

**上限锁**：Engine 总数 = 12，不再加（决策 #40，`:1923`）。Master Join 是 Composition 子能力，**不是**独立 Engine（README 已记录该历史误修）。

### 5.2 5 横向系统（`:275-283`）与 6 横切能力（`:285-296`）

**横向系统**：H1 Safety（播出安全）· H2 Resource Scheduler（CPU/GPU/NIC/Disk + affinity）· H3 Watchdog & Incident · H4 Audit（不可抵赖 + 告警升级）· H5 Subtitle。

**横切能力**（**不是 Engine**，横切所有 Engine，`:287`）：X1 Graph Compiler/Validator · X2 Preflight · X3 Configuration Versioning · X4 Incident Timeline · X5 Health Tree · X6 Capability Registry。

### 5.3 依赖方向硬约束

```
Domain → Contract → Runtime → Adapter                    （Portability #2/#135）
External API → Control Plane → Runtime Contract → Rust   （API #135 ARCH-API-BOUNDARY-01）
```

- Provider 永远不能向 Domain 返回厂商类型（`总架构 PRD:306`）
- Adapter 只能 execute / observe / report，**不得**改 Graph / Channel / 决定 Failover（`MASTER_PRD:56`）
- 浏览器**零直连** media-agent（红线 `scripts/check_web_console_red_lines.py`）

### 5.4 9 条替换轴 + 厂商中立 7 守则

| # | 轴 | 当前 Reference | 阶段 |
|---|---|---|---|
| 1 | Hardware Vendor | BMD | P0 Provider SPI |
| 2 | Hardware SDK | DeckLink SDK | P0 Provider SPI |
| 3 | Media Backend | GStreamer | P0 Backend SPI |
| 4 | Encoder Backend | FFmpeg | P1 Contract |
| 5 | Stream Gateway | SRS | P1 Contract |
| 6 | Clock / Timecode Provider | BMD hw / GStreamer clock | P1 Contract |
| 7 | Acceleration Provider | CUDA/NVENC/NVDEC/VAAPI/QSV/AMF/CPU | P1 Contract |
| 8 | Infrastructure / Deployment | Docker / runc / Nginx | P2 Adapter |
| 9 | Audio Backend / Routing | Embedded SDI（隐含） | P1 Contract |

厂商中立 7 守则（`VENDOR_NEUTRALITY_RULES.md:7-13`）：Domain 不得 import vendor/backend 类型 · **禁止自动 Fallback**（须 Policy+Capability+Preflight+决策）· `GraphRuntimeIntent` 只含 Canonical DeviceId/PortId · 配置三态分离 · **删掉具体实现后上层仍能编译** · Resource ≠ Identity · Canonical Identity 不含 vendor handle。

### 5.5 架构原则：**只有 7 条有正文，15 条是占位**

这是本次全盘梳理中最需要 owner 知道的文档债。`ARCHITECTURE_V0.2.md:42` 声明「22 条核心架构原则」，实际：

| 原则 | 状态 | 行号 |
|---|---|---|
| 1.13 Signal Graph 显式声明 Data Plane 类型 | ✅ 有正文 | `:48-89` |
| 1.17 Switch Mode 必须显式（PACKET/FRAME/MASTER） | ✅ | `:93-104` |
| 1.18 Hot-Standby 三级（COLD 30s / WARM 1.5s / HOT 100ms 预算） | ✅ | `:105-118` |
| 1.19 Latency Probe 必须在每个阶段（7 stage + 2 E2E + 1 CDN） | ✅ | `:119-137` |
| 1.20 Program Master = Video + Audio + Metadata Master | ✅ | `:138-156` |
| 1.21 Configuration Versioning 可回滚 + Atomic Apply | ✅ | `:157-204` |
| 1.22 Preflight ≠ QC（static / resource / runtime_readiness 三层） | ✅ | `:205-251` |
| **1.1–1.12、1.14–1.16** | ⛔ **占位「同 V0.2 第 2 轮不变」，仓库内无正文副本** | `:46,91` |

同形态空壳章节：§0 项目重新定性（`:36-40`）· §9 部署拓扑（`:2259-2262`）· §10.1–10.10 视觉与危险操作分层（`:2299`）· §13 P2 预留（`:2464-2467`）· §8.1 / §8.4–8.8（`:1994,2096,2126,2128,2130,2132`）。

> **PRD 的处理方式**：本文只引用**有正文的 7 条**。15 条占位原则与 7 处空壳章节列为 §11 文档债 M0-1，**在补齐前不得在任何新文档中声称「遵循 22 条原则」**。
> 可靠可引用的部分：12/5/6 三张表 · 57 条决策表（`:1880-1936`）· §5 数据模型 · §3.x 语义 · 9 Runtime 域 · 附录 D 词表。

### 5.6 架构 13 实体 vs 产品 15 对象的映射（本文建立）

架构侧运行时实体 13 个（`IMPLEMENTATION_ADDENDUM.md:131-153`）；产品侧 Canonical Object 15 个（`OBJECT_VOCABULARY.md:23`、`OBJECT_NAVIGATION_MATRIX.md:18`）。**仓库中此前无映射表**，同一能力存在两个名字的风险真实存在。

| 架构实体 | 产品对象 | 关系 |
|---|---|---|
| Device / Port | **Source**（signal_contract + connector） | 1 Source → N Port；Device 是 Source 的物理承载 |
| Capability | （X6 Capability Registry 暴露为 能力投影） | 架构有，产品侧**尚无独立对象** ⇒ 缺口 |
| Resource | **Profile** / **Asset**（资源约束侧） | 语义重叠，命名不同源 |
| Session | **Media Session** | 同义不同名 |
| Binding | **Source**（source→device 绑定）/ **Route** | 架构 Binding ≈ 产品 Route |
| Signal / MediaFormat | **Source.signal_contract** / **Output Variant** | 同义不同名 |
| Clock / Timecode | （无产品对象，藏在 Profile 内） | 架构有，产品侧缺 ⇒ 缺口 |
| Error / Event | **Alarm** /（Incident 尚未有对象） | 只对上一半 |
| — | **Channel** · **Channel Template** · **Profile Bundle** · **Output Variant** · **ChangeSet** · **Job** · **Asset** · **Asset Version** · **Destination** · **Adapter** · **Revision** | **配置域对象，架构侧无运行时实体**（设计侧存在，运行侧未建模） |

> **影响**：M2 写操作面如果不做这张映射，会出现「UI 叫 Channel、Runtime 叫 Binding」的对不齐。**本文把该映射列为 B1 批次的准入项。**

### 5.7 9 大 Runtime 域（全部 CLOSED）

| 域 | 语义边界 |
|---|---|
| lifecycle | STOPPED / STARTING / RUNNING / STOPPING（进程生命周期） |
| readiness | NOT_READY / READY_TO_TAKE（**能否接管**） |
| health | HEALTHY / DEGRADED / FAILED / UNKNOWN（节点级事实） |
| switch_mode | PACKET / FRAME / MASTER；**判定逻辑唯一定义在 §3.4** |
| standby_semantics | HotStandbyLevel COLD/WARM/HOT 只描述**策略目标**，不含 state 字段 |
| failure_domains | 7 Operational + 2 Diagnostic（PLAYER / UNKNOWN 不触发 Failover） |
| health_tree | 通道 → 子系统 → 节点三层 + 7 条 Health Invariants |
| channel_status | EffectiveChannelStatus；**唯一入口 = `channel_health_view.effective_channel_status`**，UI 禁止直读 `media_session_runtime.health` |
| clock | Clock Reference / Clock Quality / CLOCK_DEGRADED / CLOCK_FAILED（Errata-14 补齐的第 9 域） |

---

## §6 交付形态与运行要求

### 6.1 三种部署形态

| 形态 | 内容 | 来源 |
|---|---|---|
| **full-stack lane** | 宿主仅保留 Linux kernel + BMD 驱动 + DeckLink 硬件 + Docker + SSH；PG / Valkey / RustFS / SRS / Fastify / Worker / Web / Media Agent **全部容器化** | `DEPLOYMENT_AND_DEV_RUNTIME.md:26-46` |
| **standalone lane** | 单一 media-agent 进程 + systemd + `/etc/vbmf` env + `/health`；两种生产启动模式互斥 fail-closed（Device / Network-only）；**compatible, not dependent** | `:417-435`、`STANDALONE_MEDIA_AGENT_OPERATIONS.md:3-6` |
| **环境剖面** | DEV（热更 + mock BMD，禁当生产）/ ACCEPTANCE（pinned commit + 真 BMD + evidence）/ PRODUCTION（immutable image，**禁 HMR**） | `:242-250` |

**6 个 compose 拓扑**：BASE（`ops/docker-compose.yml`，常驻 db / fastify / web / media-agent / nginx，**BASE 不发布任何宿主端口**，端口只由 overlay 开）+ dev / acceptance / prod / software-acceptance / bmd-acceptance。

**硬件所有权边界**：BMD Host = kernel + 驱动 + DeckLink 硬件 + Docker + Media Agent 容器。**禁止 Host 侧 ffmpeg 直接持有 DeckLink**，否则 Agent 失去 Owner 身份（`DEPLOYMENT_AND_DEV_RUNTIME.md:64`）。BullMQ Worker 在实时路径上明确 ❌（`TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md:102-110`）。

### 6.2 控制台形态与凭据

| 项 | 现状 | 缺口 |
|---|---|---|
| 容器化部署 | ✅ `ops/docker-compose.yml:199-222` 有 `web` 服务；`ops/Dockerfile.web`（node24 build → nginx:1.27 静态托管 dist/）；`ops/nginx/web.conf` | 本轮 3 个包**从未经该路径部署验收**（BMD 验收跑的是旧 5 页版） |
| 同源路由 | ✅ nginx `upstream web:5173`；`/` → web，`/api` `/events` `/health` → fastify；`location /hls/` 已在 | — |
| 凭据 | ✅ 生产凭据门不可绕过（生产 bundle 实测 `DEV:!1`）；x-api-key 只存内存 | ⛔ **无 SSO / RBAC 入口**，x-api-key 要在 SPA 内手输，刷新即失 |
| dev 免密钥 | ✅ 仅 `import.meta.env.DEV === true && VITE_DEV_NO_AUTH === "1"` | 绝不可当生产形态 |
| 浏览器零直连 | ✅ `scripts/check_web_console_red_lines.py` PASS | — |

### 6.3 容量与限流

| 项 | 值 | 来源 |
|---|---|---|
| 服务端读限流 | **240 次 / 60s / principal** | `apps/api/src/config.ts:83-85` |
| 服务端写限流 | 60 次 / 60s | 同上 |
| 限流键 | (bucket, principalId) | `apps/api/src/security/rateLimit.ts` |
| 前端轮询节奏 | **5s**（每台 12 次/分读 + 命令面） | `apps/web-console/src/api/poll.ts` |
| 页面不可见 | 跳过轮询 | 同上 |
| 429 行为 | 真实展示为错误（红线），并按 retry-after 冷却退避 | `src/api/rateLimit.ts` |
| 实测容量 | **10 台同看全 200 / 15 台击穿** | §3.125 实测 |

⇒ **上限约 10 台同看**。若要支持更多，需提高 `RATE_LIMIT_READ_MAX`（属生产配置，owner 决策）。

### 6.4 多设备同看（已解决，记录以防回退）

根因：读桶按 principal 计（所有标签页共用同一 operator key ⇒ 同桶）+ 原 2s 节奏每台 60 次/分 ⇒ 4 台打满。修复三条腿：**节奏 5s（每台 24 次/分）· 不可见停轮询 · 429 按 retry-after 冷却退避**。实测 5 分钟手机 Chromium：hidden=false 全程前台、速率精确 24/分、**video.currentTime +268s 不中断**、paused 恒 false、error 恒 null、错误横幅全程为空；服务端 653 请求全 200、429=0。

### 6.5 稳定性绑定（改动即失效）

**STABILITY VERIFIED** 绑定四元组 —— 任一项变更即须重走 2h 起步 ladder：

| 锚点 | 值 |
|---|---|
| Runtime commit | `8b68f7b4` |
| Runtime binary md5 | `c569aca7` |
| Desktop Video SDK | `16.5a1` |
| kernel | `7.0.0-44-generic` |

根因：闭源 Blackmagic Desktop Video SDK 每帧泄漏，升级 16.2a1 → 16.5a1 把 live 斜率 **+5.97 MB/h → +0.066 MB/h**（24h 终段）。阶梯三档（2h / 8h / 24h）全 PASS。

---

## §7 现状基线与差距

> **采集日期 2026-11-27。** 本章是快照，会过期；实时状态以 `.project/current-work.yaml` + STATE §4–§5 为准。
> 标注约定：**已实测** = 本轮或既往有可复核执行证据；**文档自述** = 仅文档声明，未独立验证。

### 7.1 已交付能力

| 子系统 | 能力 | 证据 |
|---|---|---|
| **控制面 API** | 11 个 wire 端点：`GET /api/v1/runtime` · `POST /api/v1/sessions` · `POST /sessions/:id/stop` · `POST /sessions/:id/release` · `GET /api/v1/commands/:id` · `GET /api/v1/alarms` · `GET /alarms/:id` · `POST /alarms/:id/ack` · `GET /health/live` · `GET /healthz` · `GET /events/v1/stream`(SSE) | `apps/api/src/routes/schemas.ts:571-631`、`server.ts:187-192` **已实测** |
| **控制面安全** | API Key 认证（better-auth）· CASL RBAC · 滑动窗口限流（读 240 / 写 60 / 60s）· 审计 · 日志 redact | `apps/api/src/security/` **已实测**（116 测试 75 pass / 41 skip，skip 全为需 PG 的 DB 集成） |
| **控制面命令面** | 3 命令（start / stop / release）+ fingerprint 幂等 + 四状态投影 + 错误信封 | `apps/api/src/command/` **已实测** |
| **Web 控制台** | 7 页（Dashboard / Sources / Health / Runtime / Sessions / Events / Alarms），src 1,839 行 | `apps/web-console/src/App.tsx:15,33-53` **已实测** |
| **控制台新增能力** | i18n（zh-CN 默认 + en-US）· hls.js 1.5.17 监看窗 · dev 免密钥 · 响应式断点 · 5s 轮询 + 不可见停 + 429 退避 | 提交 `51359bf` / `e026664` / `aadbf6d` / `140c6ec` **已实测** |
| **media-agent 运行时** | 84 个 .rs / 55,752 行；adapters{blackmagic, gstreamer, ffmpeg, mock}；session / resource / lease / preflight / registry / normalize / clock / audio / timecode / command / idempotency / error / event / api_boundary / transport / program 全套 | `services/media-agent/src/` **已实测** |
| **SDK** | 类型由 `apps/api/src/routes/schemas.ts` 机械生成 + drift gate + red-line gate | `packages/vbmf-sdk/` **已实测** |
| **部署** | 1 BASE + 5 overlay compose；nginx 单一外部入口；standalone systemd 安装脚本 | `ops/` **已实测** |
| **CI** | 3 条 push/PR 门禁 workflow + 2 条手动 dispatch | `.github/workflows/` **已实测** |

### 7.2 Contract 完成度对账

来源 `docs/architecture/PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`（SoT）+ `PHASE_0_6_ACCEPTANCE_MATRIX.md`。

| 能力项 | Implementation | VERIFICATION_STATUS | Verification（引用） | 完成度汇总（派生） |
|---|---|---|---|---|
| Hardware Provider SPI | IMPLEMENTED | `ACCEPTED` | HW-IDENT-02 真机 | PASS |
| Media Backend SPI | IMPLEMENTED | `ACCEPTED` | MEDIA-RT-01 | PASS |
| Session Model | IMPLEMENTED | `ACCEPTED` | SESSION-RT-01 / RESOURCE-RT-01 真机 | PASS |
| Resource Model | IMPLEMENTED | `ACCEPTED` | RESOURCE-RT-01 | PASS |
| Preflight | IMPLEMENTED | `ACCEPTED` | SESSION-RT-01 前置 | PASS |
| Provider Registry / Mock | IMPLEMENTED | `LAB_VERIFIED` | CI session-lifecycle | PASS |
| Architecture Lint + Proof | IMPLEMENTED | `LAB_VERIFIED` | CI architecture-portability | PASS |
| BMD / GStreamer Adapter 降级 | IMPLEMENTED | `LAB_VERIFIED` | CI | PASS |
| Canonical Identity | PARTIAL | `HARDWARE_VERIFIED` | HW-IDENT-02 | PARTIAL |
| Provider Identity Adapter | PARTIAL | `HARDWARE_VERIFIED` | HW-IDENT-02 | PARTIAL |
| Runtime Binding | PARTIAL | `LAB_VERIFIED` | Acceptance | PARTIAL |
| RuntimeEvent / RuntimeError | PARTIAL | `HARDWARE_VERIFIED` | MEDIA-RT-01 | PARTIAL |
| 消除 `device_number` 直接依赖 | IN_PROGRESS | `HARDWARE_VERIFIED` | HW-IDENT-02 | PARTIAL |
| Topology（`ARCH-TOPOLOGY-01`：PhysicalConnection / LogicalRoute） | NOT_STARTED | `NOT_VERIFIED` | — | **OPEN** |
| Portability Gate（ARCH-PORTABILITY-01 Test A） | IMPLEMENTED | `ACCEPTED` | **CI run `46011711764`**（Linux 自托管 `vbmf-ci-02`，remove-adapter 编译证明 **PROOF OK**） | **PASS** |
| Backend Gate（ARCH-BACKEND-01） | IMPLEMENTED | `ACCEPTED` | **CI run `46011711764`**（同上；Mock↔GStreamer 共享 PipelinePlan 三契约） | **PASS** |

> **两行 Gate 已于 2026-11-27 裁定 = PASS**（原 gap matrix 的 `NOT_PASSED / BLOCKED` 是 2026-08-30 的过期孤例快照）。裁定依据 = **Linux runner 上的编译级实证**，非间接证据：CI run `46011711764` / job `architecture-portability`（required context 之一）/ runner `vbmf-ci-02`（labels: self-hosted, Linux, X64）/ 2026-11-27T14:00:24Z → `cargo check --no-default-features --features simulation` + `--features mock` → **PROOF OK: Domain/Contracts/Runtime compile without concrete adapters**；run 7/7 job 全绿。
> **边界（不得扩大解读）**：该证明覆盖「删除 concrete adapter 后 Domain/Contracts/Runtime 的**指定构建路径**仍编译」，**不等于**「整个项目完全 vendor-independent」（脚本自述 + `media-agent.yml:71-72` 同一表述）；**真实换型 BMD→AJA 验收仍未做**。
> **口径提示（2026-11-27 · 随 SoT 对齐四轴）**：本表列名与 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md` 同步 —— ① 新增 **`VERIFICATION_STATUS`** 列 = canonical 验证级别（`NOT_VERIFIED` / `LAB_VERIFIED` / `HARDWARE_VERIFIED` / `ACCEPTED`），**2026-11-27 逐行判定**，判定规则与逐行依据见 SoT「状态词」块；② `Verification（引用）` 列存**验证/证据引用**（非状态值）；③ 末列 `完成度汇总`（派生自 `Implementation`）：其 `PASS` 意为「该行整体已落地」，**不是** `GATE_STATUS = PASS`，**勿读成「无缺口」**，且**与门禁判定无关**（同一 `Gate` 在不同行可有不同末列值）。**④ 本镜像表的 `VERIFICATION_STATUS` 列必须与 gap matrix SoT 同分布**（取值必须 ∈ `DOCUMENT_STATUS_MODEL.md` §2.3 的 canonical 集合；分布必须一致）—— 由 `scripts/check_docs.py` 的 `check_verification_status()` 机械强制（`python3 scripts/check_docs.py verification` 可单独跑）⇒ 若将来本表**有意**只列 SoT 的子集，须同步改守卫，否则门禁会红。**2026-11-27 起该守卫已进 main 的 required status checks**（`v3-harness-tooling` job 内新增 `python3 scripts/check_docs.py verification` 步骤，零依赖）⇒ **写坏即挡合并**，不再只是红 CI；全量文档门禁在 `doc-consistency.yml`（非 required）。四轴词表见 `DOCUMENT_STATUS_MODEL.md` §2.1–§2.4 与 SoT「状态词」块。

**⚠️ 四处对账漂移（PRD 必须知道，否则会照抄错状态）**：

1. ~~**SoT 自相矛盾**~~ ✅ **已裁定（2026-11-27）**：gap matrix 表格写 `NOT_PASSED / BLOCKED`（gap:31-32）、同文件「结论」段写「两个阻塞项…是当前 P0 的硬缺口」，而 Acceptance Matrix（acc:10,24）写 **PASS** —— **表格行与结论段两处都是 2026-08-30 的过期快照**，Acceptance Matrix 的 PASS 才是正确口径。已按 Linux CI 实跑（run `46011711764`）订正为 **PASS**（gap matrix 两行 + **结论段整段按矩阵实态订正** + 8 份关联文档的状态括注 + 2 份评审留档加指向）。**另**：结论段首句「Implementation 绝大多数 `OPEN`/`PARTIAL`」经与矩阵逐行对账（`git show HEAD:` 取 2026-08-30 原版对照）判定为**原文档失实**（当时 `IMPLEMENTED` 8 / 未完成 8，恰为一半），非本轮翻正所致 ⇒ 已一并订正。
2. **两张矩阵停在 2026-08-30**，而 0.7C-1~8、0.7D、WCO-01、PR-STAB-01 全部在其后落地 ⇒ acc:18-20 的「EXT-* P1 未实现」已被 `PHASE_IMPLEMENTATION_MAP.md:24-27` + Fastify 控制面实存推翻。
3. **债务文档同样自相矛盾**：D2 / D4 / D5 / D6 在主表仍标「未清偿」，但优先级分组段标「✅ CLOSED @ p07c-runtime-state」（`PHASE_0_7A_POST_MERGE_DEBT.md:13,20-22 vs :40-46`）。
4. ~~**契约文档首行状态头仍停在冻结时点**~~ ✅ **已核订（2026-11-27）**：**8 份**契约文档首行**曾**写 `VERIFICATION = NOT_VERIFIED`（原句按冻结纪律保留，**canonical 取值以同句订正括注给出**）—— 其中与本表 16 行直接对应的 3 份 = `CANONICAL_IDENTITY.md` · `RUNTIME_SESSION_MODEL.md` · `RUNTIME_BINDING_MODEL.md`，另 5 份无对应矩阵行、按 Acceptance Matrix 门禁取值 ⇒ **6 份订正 + 2 份确认一致**（`RUNTIME_TOPOLOGY_CONTRACT` · `DEVICE_INTEGRATION_CONTRACT` 原值即 canonical）⇒ 该漂移**已闭合**。**审计须知**：核对状态头须读**订正括注**，不可只 grep 原句（8 处原句仍在，属留痕）。**残余**：`PHASE_0_6_MASTER_PRD.md` 的 `IMPLEMENTATION = NOT_STARTED` 未订正（master PRD ≠ 契约文档状态头，不在本轮范围）。

### 7.3 表面实现度：**2 / 32（6.3%）**

| 表面 | 状态 | 说明 |
|---|---|---|
| 01-dashboard | ✅ 已实现 | WCO-01B：NOW/NEXT + 状态条（PGM 真状态 + 4 格显式 N/A + 告警计数）+ 通道状态真观测行 + 意图层真四状态 + DIVERGENT 判定 + hls.js 监看窗 + 起停走真实 Product API（`sink.kind=hls`） |
| 02-sources | ✅ 已实现 | WCO-01C：三段 tabs（Local 真设备 / Network·Internal 空态 = E-40 后续包）+ 真快照表 + **13 个显式 N/A 列** + Add Source 禁用（device-binding 清单 systemd/env 权威）+ Used By = `sessions.inputs` 真引用 |
| i18n 基础层 | ✅ 已实现 | WCO-01A：`t()` + zh/en 词典 + LocaleToggle + 默认 zh-CN 全站接入 |
| 其余 30 个 LOCK 表面 | ⛔ 未实现 | — |
| 24 个 SPEC 表面 | ⛔ 未实现（Phase 4） | — |

> **为何旧 5 页（Health / Runtime / Sessions / Events / Alarms）不计入表面完成率**：它们是 CP-01 / WCE-01 控制面**验收工程**的页面，**非 Phase 0.5 线框派生**；SURFACE_REGISTRY 里没有对应 surface id。它们提供会话生命周期 / 告警确认 / SSE 的功能底座，但**不能算作 56 表面中任何一项已交付**。

**已签字偏差**（owner 已逐包签字，非未决）：Dashboard 4 格显式 N/A（Backup / SRS / REC / Clock）· NEXT 无独立预监流 · 意图层真四状态 · 通道状态 = V0.2 观测行 · Sources 13 个 N/A 列 · Used By 用会话 id 代 channel 名 · Add Source 禁用 · Network/Internal 空态。

**4 项已知 UI 残留（未修）**：

| # | 残留 | 状态 |
|---|---|---|
| P2 | 窄屏运行时 / 告警表格横向溢出（636 / 661px） | 上次记录，**本轮未复验** |
| P3 | 手机端导航占 27% 视口高度 | 上次记录，**本轮未复验** |
| P4 | NEXT 空占位占满一屏 | 上次记录，**本轮未复验** |
| P5 | 原生 `<video controls>` 压住烧录字幕 | **本轮静态确认仍在**（`apps/web-console/src/components/HlsMonitor.tsx:36` 带 `controls`） |

### 7.4 端点缺口 —— **这是当前的第一约束**

完整 Product API 只有 11 个端点。对照 56 表面：

| 需要的端点族 | 覆盖的表面 | 现状 |
|---|---|---|
| Runtime 观测（只读） | 01 · 02 · E-38（部分） | ✅ 有 |
| Session 生命周期（start/stop/release） | M-17（部分） | ✅ 有 |
| 命令查询 / 四状态 | 01 · 会话面 | ✅ 有 |
| 告警列表 / 确认 | O-42（部分） | ✅ 有 |
| SSE 事件流 | 事件面 | ✅ 有 |
| **Channel CRUD** | CH-01 · CH-02 · CH-02B · CD-01-WS · CD-01-Detail | ⛔ 无 |
| **TAKE / 切播** | 03-switcher · B-13 · 链 1 | ⛔ 无 |
| **Health Tree 聚合** | 09-health-tree / O-41 · 链 2 | ⛔ 无 |
| **Graph / Profile / Revision** | E-31 · P-20~P-28 · D7 · 链 4 | ⛔ 无 |
| **ChangeSet / Impact / Diff** | E-33 · E-50 · E-51 | ⛔ 无 |
| **Asset / Job / Recording** | M-11 · M-12 · M-14 · M-18 · 07-recording · 链 3 | ⛔ 无 |
| **Preflight 查询** | B-13 · E-32 | ⛔ 无（运行时已有能力，无 API 暴露） |
| **Audit 查询** | A-54 | ⛔ 无 |

⇒ **除 01-dashboard 与 02-sources 外，没有任何表面有可接的端点。** 做 UI 之前必须先做端点；先做 UI 只会产出「13 个 N/A 列」的假表面（01C 已示范）。

### 7.5 文档漂移清单（本 PRD 附带的第一批债）

| # | 漂移 | 证据 | 影响 |
|---|---|---|---|
| D1 | **22 条架构原则只有 7 条有正文** | `ARCHITECTURE_V0.2.md:46,91` | README / ROADMAP / CONTRIBUTING / CHANGELOG 均称「22 原则」⇒ 对外失实 |
| D2 | ARCHITECTURE_V0.2 有 7 处空壳章节（§0 / §9 / §10.1-10.10 / §13 / §8.1 / §8.4-8.8） | 同上 | 危险操作分层、部署拓扑在架构层**无正文** |
| D3 | README 说 Media Agent = 「📋 Phase 1」、Web Console = 「📋 Phase 4」 | `README.md` 核心能力表 | 实际 media-agent 已 STABILITY VERIFIED、console 已 6% |
| D4 | README 部署快照（32 核 / 30GB / 546GB / Ubuntu 26.04）是 V0.2 §3.11 的 current_host_snapshot，非现状 | `README.md` 部署参考段 | 与真实 BMD 主机不符 |
| D5 | CHANGELOG「未发布」段最新条目仍是 0.5F.11（2026-08-25） | `CHANGELOG.md` | 0.6 / 0.7A / 0.7B / WCO-01 / PR-STAB-01 **全部未入 changelog** |
| D6 | ~~gap matrix 自相矛盾（BLOCKED vs PASS）~~ ✅ **已裁定 = 两行 Gate PASS** | gap matrix + 8 份关联文档已订正；证据 **Linux CI run `46011711764`**（remove-adapter 编译证明 = PROOF OK） | 完成度现可一键回答 |
| D7 | ~~两张矩阵停在 2026-08-30~~ ✅ **已刷新**（gap matrix 加 2026-11-27 对账说明 + Gate 裁定块；Acceptance Matrix 已是 PASS 口径） | 同上 | 0.7C/0.7D/WCO-01/PR-STAB-01 增量已列明 |
| D8 | debt 文档 D2/D4/D5/D6 主表与分组段矛盾 | debt:13,20-22 vs :40-46 | 债务状态不可信 |
| D9 | `current-work.yaml:20` 仍写 `stability_verified: false`，而 status 已是 STABILITY_VERIFIED；summary 停在 §3.105–§3.109 旧态 | `.project/current-work.yaml:14-24` | 冷启动会读到错状态 |
| D10 | AGENTS.md 顶部摘要仍列 3 项 owner 拍板（其中 2 项已关闭） | `AGENTS.md:7` | 冷启动会重复问已决事项 |
| D11 | SURFACE_SPEC 内部计数 39/44/48/52/55 过期 | `SURFACE_SPEC.md:80-83` | 文件自身已标废止，但检索时会误导 |
| D12 | 角色定义 3 套并存（4 角色 / 7 角色 / 4 角色含 SRE） | `OPERATOR_WORKFLOW.md:9-14` vs `NAVIGATION.md:194-204` vs `PIA.md:307-314` | 权限与导航无法单一解释（§11 已裁决本文采用 4 角色版） |
| D13 | `scripts/check_docs.py` 实跑 exit 1（27 个问题：MD-ANCHOR×1 + MD-LINK×4 + FI-COVERAGE×22），且**不进 CI** | 本轮实跑 | 文档链接与验收覆盖度无人守 |

### 7.5.1 闭合状态（2026-11-27 M0 已处理，详见 STATE §3.128）

| 漂移 | 处置 |
|---|---|
| D1 / D2 | ✅ 外部宣称点全部降级为「声明 22 条 / 当前成文 7 条」（README、docs/README.md）；**冻结的 `ARCHITECTURE_V0.2.md` 未动** |
| D3 / D4 | ✅ README 核心能力表 / 演进表 / English 段 / 部署快照全改实测口径 |
| D5 | ✅ CHANGELOG「未发布」段补 0.6 → PR-STAB-01 → M0 汇总条目 |
| D6 / D7 | ✅ **已裁定（2026-11-27）** —— 两行 Gate = **PASS**（Linux CI run `46011711764` 实跑 remove-adapter 编译证明 = PROOF OK）；gap matrix 与 8 份关联文档状态已订正，2 份评审留档按 provenance 原则只加指向不改原文 |
| D8 | ✅ debt 主表 D2/D4/D5/D6 与优先级分组段对齐 |
| D9 / D10 | ✅ current-work.yaml（stability_verified / runtime_commit / binary md5 / summary）+ AGENTS.md 摘要对齐实态 |
| D11 | ✅ 复核后**无需改动** —— SURFACE_SPEC 已自带「历史手写 22/39/44/52/53/54/55 一律废止」声明 |
| D12 | ⚠️ **已标注权威版（4 角色）与待收敛状态**，未擅改 NAVIGATION / PIA 的语义表 |
| D13 | ✅ 28 个门禁问题清零（exit 0）+ 文档门禁进 CI（v3-harness-tooling 新增 step） |

### 7.6 CI 与门禁实况

| workflow | 触发 | 内容 | required context |
|---|---|---|---|
| media-agent.yml | push/PR | 7 job：rust-format / architecture-portability / rust-clippy / session-lifecycle / rust-test-matrix / hardware-test-compile / gstreamer-build | **是（7 个）** `:9-12` |
| control-plane.yml | push/PR | F11/F12 边界门 → api typecheck/契约测试/build → SDK drift+red-line+测试+pack → console typecheck/vitest/build | **否**（文件自述「NOT a required context yet」`:10-12`） |
| v3-harness-tooling.yml | push/PR | analyzer 单测 + 门禁脚本回归测试 + decklink 守卫 + shellcheck | 否 |
| ci-infra-probe.yml / ci-runner-action-cache.yml | 仅 workflow_dispatch | runner 基建 | 否 |

**4 个本地 checker**：`check_web_console_red_lines.py` PASS · `check_control_plane_gate.py` PASS · `check_arch_portability.py` PASS · `check_remove_adapters.py` **在 macOS 无法执行**（该证明是 Linux-only：libc 声明在 linux-only 依赖里，43 处无条件使用 ⇒ 34×E0433 + 2×E0425）。**这是环境限制，不是仓库缺陷**，但意味着「删掉 adapter 仍能编译」这条 P0 门禁在开发机上不可验证。

> **最要紧的一条**：**整条 TypeScript 车道（Fastify + SDK + Web Console）不在 required context 内** —— 会跑但不阻塞合并。`current-work.yaml` 把 `control-plane` 列入 `ci_status.green` 易被误读为「受保护」。

---

## §8 路线图

原则：**先修账，再补面；先扩端点，再画页面。** 每个批次都有明确准出判据，不达不成不进入下一批。

### M0 · 账本与文档对账（低风险，可立即做）

| 项 | 内容 |
|---|---|
| 目标 | 让「文档说的」=「实际做的」 |
| 范围 | §7.5 的 D1–D13 全部 |
| 关键动作 | ① 补齐或降级声明 22 条原则（D1/D2）；② README 核心能力表改成实测状态（D3/D4）；③ CHANGELOG 补 0.6→PR-STAB-01 条目（D5）；④ 修 gap matrix 矛盾并刷新到当前（D6/D7）；⑤ 修 debt 文档矛盾（D8）；⑥ current-work.yaml 与 AGENTS.md 摘要对齐（D9/D10）；⑦ SURFACE_SPEC 计数标注（D11）；⑧ 角色定义收敛到 4 角色（D12）；⑨ `check_docs.py` 27 个问题清零 + 进 CI（D13） |
| 准出 | `scripts/check_docs.py` exit 0 且进 CI；README/CHANGELOG/gap/debt/yaml 五处状态互相一致 |
| 风险 | 极低（纯文档 + 一条 CI 接线）；**不改任何冻结语义** |
| 依赖 | 无 |
| 状态 | ✅ **已闭合 @ §3.128 + §3.129**（2026-11-27）—— 门禁 exit 0 + 已进 CI；**D6/D7 已由 Linux CI 实跑裁定 = PASS**；D12 为「已标注、待 owner 收敛角色」 |

### M1 · 操作台最小可用（把已做的 2 个表面做成真交付）

| 项 | 内容 |
|---|---|
| 目标 | 01-dashboard + 02-sources + i18n 从「dev 测试版」变成「可部署可交付」 |
| 范围 | ① 清 P2–P5 四项 UI 残留；② 经 `ops/Dockerfile.web` + nginx 生产路径在 BMD 跑一次完整验收（构建 → 容器 → 同源 → `/hls/` 出画面 → 非 dev 凭据门验证 → SSE 稳定）；③ 生产形态的凭据入口决策（见 §11 Q3） |
| 准出 | 生产 bundle 部署后：直播出画面 + 4xx/5xx 真实展示 + 多设备 5 分钟零 429 + 手机窄屏无溢出 + 四项残留归零 |
| 风险 | 低（不改契约）；**注意 STABILITY 绑定：不得触碰 Runtime source** |
| 依赖 | M0（状态文档先对齐，避免验收记录写进过期叙事） |

### M2 · 操作核心（切播 / 通道 / 预检）—— **需 owner 授权扩 API**

| 项 | 内容 |
|---|---|
| 目标 | 打通链 1 与链 2 的核心：Channel 资源 + TAKE + Health Tree |
| 范围 | ① apps/api 新增 additive 端点族（channel 资源 / take 命令 / preflight 查询 / health tree 聚合）；② 契约 additive（非破坏）+ 契约测试同步；③ 新表面 03-switcher · B-13 · CH-01 · CD-01-WS · 09-health-tree；④ §5.6 映射表落地为 UI 术语 |
| 准出 | 链 1 端到端通过 OnAir-01..05（含 TAKE L2 3s 倒计时、AV sync 漂移 < 80ms、连续 3 次 TAKE）；链 2 的 FI-01..05 在**手动触发**下可验（自动 failover 仍取决于 RD-01A 解冻） |
| 风险 | **高**：① 触碰 Product API 契约（additive 但要过契约评审）；② TAKE 是危险操作（L2），UI 语义错一次就是播出事故；③ 自动 failover 零实现 ⇒ 链 2 只能半自动验收；④ 端点扩展会进一步触发限流分桶问题（读桶按 principal） |
| 依赖 | **owner 拍板扩 API**（§11 Q1）+ 新 Work Packet（按 `AGENTS.md` 单 Work Packet 单 Writer）+ M1 完成 |
| 显式不做 | 自动 failover（RD-01A 冻结中，本批不触碰 Runtime source） |

### M3 · 工程面（图 / Profile / 变更集）

范围：E-31 · P-20/P-21/P-22/P-28 · D7 · E-50 · E-51 · E-52。准出 = 链 4 的 Eng-01..07（Rollback 恢复 REV-007 < 5s 是硬判据）。依赖：M2 的 Channel / Graph 端点族。

### M4 · 媒资面（Asset / 转码 / 录制）

范围：M-11 · M-12 · M-14 · M-17 · M-18 · 07-recording。准出 = 链 3 的 Playout-01..05。依赖：M3 的 Profile / ChangeSet 端点。

### M5 · 运维与 Admin 面

范围：O-41~O-45 · A-51~A-55 · 10-states。**24 个 SPEC 表面按 `MILESTONES.md§5.1` 归 Phase 4，不进 Phase 0.6 验收范围。** 优先级：P0 = P-23 / P-25；P1 = P-27 / P-24 / P-26 / E-32~36 / E-41 / O-41~45；P2 = A-51~55 + M-13/M-15/M-16。

### 8.1 批次依赖图

```
M0 账本对账
  └─→ M1 操作台最小可用（不扩 API）
        └─→ M2 操作核心（扩 API·需 owner 授权）
              └─→ M3 工程面（扩 API）
                    └─→ M4 媒资面（扩 API）
                          └─→ M5 运维/Admin（Phase 4）
```

---

## §9 验收标准与证据要求

### 9.1 功能验收

| 层级 | 判据 | 证据形态 |
|---|---|---|
| 表面级 | 该表面在 `SURFACE_SPEC` 的**必显字段**全部有真实数据源；无源的显式标 N/A 并登记 | 截图 + 端点对照表 |
| 链级 | 4 条链的 OnAir-01..05 / FI-01..05 / Playout-01..05 / Eng-01..07 全过 | BMD 真机执行记录 |
| 纵切级 | 表面 + 端点 + 错误态 + 权限 + 审计 五件齐 | 契约测试 + 集成测试 |

### 9.2 非功能判据

| 维度 | 判据 | 现状 |
|---|---|---|
| 性能 | 状态面板滞后 ≤ 轮询周期（5s）；直播画面不受轮询影响（HLS 独立通道） | ✅ |
| 稳定性 | 24h RSS 终段斜率达标（§6.5 绑定） | ✅ |
| 多设备 | ≤ 10 台同看零 429；> 10 台需提高 `RATE_LIMIT_READ_MAX` | ✅ / ⚠️ |
| 安全 | 浏览器零直连运行时；凭据不落 storage；生产凭据门不可绕过 | ✅（红线 gate PASS） |
| 危险操作 | L2 必须确认 + 倒计时；L3 必须 Who/Why + 审计 + 逃生通道 | ⛔ 未实现（无 TAKE 面） |
| 可访问性 | zh-CN 默认 + en-US fallback；canonical 词不翻译 | ✅ |
| 响应式 | 1280 单列；≤900 侧栏转横条；窄屏表格不横向溢出 | ⚠️ 表格溢出未修（P2） |

### 9.3 证据要求

| 类型 | 要求 | 门禁 |
|---|---|---|
| 代码 | typecheck + vitest + build 全绿 | control-plane lane |
| 架构 | 词法 lint + 删 adapter 编译证明 | architecture-portability（**Linux-only**） |
| 边界 | console 红线 + control-plane F11/F12 | `check_web_console_red_lines.py` / `check_control_plane_gate.py` |
| 硬件 | BMD 真机执行，绑定 exact commit / binary / SDK / kernel | 证据目录 + sha256 |
| 文档 | 链接可达 + 数字口径一致 + 验收覆盖度 | `check_docs.py`（**当前 exit 1 且未进 CI**） |

---

## §10 风险与待拍板

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | **契约扩展失控**：为做 UI 不断加端点，最终把 API 面推成「无消费方也建抽象」 | 重蹈 External API PRD #138-170 被裁剪的覆辙 | 每个新端点族必须有对应表面 + 消费者；走 §4.3 批次顺序，不跳跃 |
| R2 | **Phase 0.6 验收链回改 LOCK 面** | 先做的界面返工 | M2/M3 前先跑 AC-01~04 语义验证；0.5F.17 明确 SPEC 面不阻塞 0.6 |
| R3 | **危险操作 UI 语义错误** | 播出事故 | TAKE 必须 L2；先做「只读面 + 模拟 take」再开真端点；所有写动作走 §3.5 的 B 管线 |
| R4 | **自动 failover 零实现**（RD-01A 冻结） | 链 2 只能半自动验收 | 明确写进验收判据；**不在 M2 触碰 Runtime source**（否则 STABILITY 绑定失效） |
| R5 | **限流上限 10 台** | 多机位场景不够 | 提高 `RATE_LIMIT_READ_MAX` 属生产配置，owner 决策；前端已压到 24 次/分 |
| R6 | **文档漂移持续扩大** | 下一个人/Agent 基于错误状态开工 | M0 先行；`check_docs.py` 进 CI |
| R7 | **TypeScript 车道不受保护** | 控制面回归可静默合入 | 把 control-plane lane 加进 required context（灰度纪律，见 `control-plane.yml:10-12`） |
| R8 | **角色定义未收敛** | 权限与导航实现时各说各话 | 本文 §2.1 暂用 4 角色版；M0 同步订正 NAVIGATION / PIA |
| R9 | **STABILITY 绑定被误破** | 需重走 26h+ 阶梯 | 任何 Runtime source 变更前先确认与 `8b68f7b4` / `c569aca7` 的差异 |

---

## §11 未决问题（需 owner 拍板）

| # | 问题 | 选项 | 本文倾向 |
|---|---|---|---|
| **Q1** | 是否授权 M2 扩 Product API（Channel / TAKE / Preflight / Health Tree 端点族）？ | (a) 授权，开 additive 端点族 + 新 Work Packet；(b) 不扩，只做只读面；(c) 继续冻结，先做 M0/M1 | **(a)** —— 不扩 API 则 4 条链永远停在「起停一个 HLS 会话」 |
| **Q2** | 角色定义收敛为 4 角色（本文采用）还是 7 角色（NAVIGATION）？ | (a) 4 角色，订正 NAVIGATION / PIA；(b) 7 角色，订正 OPERATOR_WORKFLOW / SURFACE_SPEC | **(a)** —— 4 角色版有 LOCK 声明且与权限矩阵一致；7 角色版多出 SRE / Content Manager / Editor 三个无对应表面所有者的角色 |
| **Q3** | 生产形态的凭据入口怎么做？（当前 SPA 内手输 x-api-key，刷新即失） | (a) 保持现状（单租户 + 手工粘贴 key）；(b) 加反代会话（nginx auth_request / OIDC）；(c) 单租户长期 key + 首次登录存 sessionStorage | **(a) 现阶段足够** —— 单租户起步是决策 #6；(b) 留作 M5+ |
| **Q4** | `RATE_LIMIT_READ_MAX` 是否提高（当前 240/60s ⇒ 约 10 台同看）？ | (a) 不动；(b) 提高到 600；(c) 改成按「每 principal 多设备」建模 | **(a) 先不动** —— 前端已压到 24 次/分；真有多机位需求再按 (c) 设计 |
| **Q5** | 22 条占位架构原则怎么补？ | (a) 从 git 历史 / 原始 review 记录复原；(b) 承认只有 7 条，把 README 等处的「22 原则」全部改为「7 条已成文 + 15 条待补」；(c) 维持现状 | **(b) 最短路径**，但 (a) 若能找到原始素材则更优 —— **需 owner 提供是否存在仓外原稿** |
| **Q6** | RD-01A 解冻？（唯一遗留拍板项，冻结中） | (a) 解冻；(b) 继续冻结 | **本文不预设** —— 属 Runtime 写入面，解冻即需重走 ladder |

---

## §12 附录：证据索引

| 主题 | 证据 |
|---|---|
| 端点全量 | `apps/api/src/routes/schemas.ts:571-631`（`ROUTE_SCHEMAS`） |
| 控制台页面 | `apps/web-console/src/App.tsx:15,33-53` |
| 轮询与限流 | `apps/web-console/src/api/poll.ts`、`src/api/rateLimit.ts`、`apps/api/src/config.ts:83-85` |
| 表面计数 | `docs/phase-0.5/SURFACE_REGISTRY.yaml` |
| 4 条链 | `docs/phase-0.5/chains/chain-{1-on-air,2-failure,3-playout,4-engineering}.md` |
| 角色 | `docs/phase-0.5/OPERATOR_WORKFLOW.md:9-14`、`SURFACE_SPEC.md:140-186` |
| 15 对象 | `docs/phase-0.5/OBJECT_VOCABULARY.md:23`、`OBJECT_NAVIGATION_MATRIX.md:18` |
| 动作管线 | `docs/phase-0.5/EXECUTION_MODEL.md:275-303` |
| 架构骨架 | `docs/architecture/ARCHITECTURE_V0.2.md:258-296`（12/5/6）· `:1880-1936`（57 决策） |
| 部署与所有权 | `docs/architecture/DEPLOYMENT_AND_DEV_RUNTIME.md:26-66`、`TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md:54-118` |
| 完成度对账 | `docs/architecture/PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`、`PHASE_0_6_ACCEPTANCE_MATRIX.md` |
| 债务 | `docs/architecture/PHASE_0_7A_POST_MERGE_DEBT.md` |
| 稳定性证据 | `evidence/bmd-10.30.15.10/2026-11-25-pr-stab-01-v3-8h/` + STATE §3.113 |
| 429 修复 | STATE §3.125；提交 `140c6ec` |
| 手机复测 | STATE §3.126；`/tmp/phone-probe.log`（Android 17 模拟器 + Google Chrome 145） |
| 实时任务 | `.project/current-work.yaml`、`.project/STATE.md` §4–§5 |

---

**文档结束。** 本文为 DRAFT，待 owner 审阅签字后转 LOCK。签字前请重点看 §2.1（角色裁决）、§11（6 个待拍板项）与 §7.5（13 项文档债）。



