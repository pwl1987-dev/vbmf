# VBMF — IP 广播媒体信号处理平台

> **V0.2 架构基线 LOCK FINAL · 22 轮 review · 12 Engines + 5 横向系统 + 6 横切能力 + 22 原则 + 57 决策**
>
> **V0.2 Runtime Semantics CLOSED · implementation_ambiguity: NONE · 不再开 V0.2.5**
>
> **Phase 0.5A UI Semantics ✅ LOCK FINAL · 9 Core + 1 Validation Pages + 4 操作链 + 20 项 UI 语义修复**
>
> **Phase 0.5B Product UI Surface ✅ UX BASELINE LOCK FINAL · 56 surfaces（32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施)，SoT: SURFACE_REGISTRY.yaml）+ 5 P0 wireframes + 8 横切能力 + 36 项语义收口（31 P0 + 5 P1）**
>
> **Phase 0.5 = 🟢 LOCK FINAL (2026-08-25)** · 权威阶段状态 (SoT) 见 [`docs/phase-0.5/MILESTONES.md`](docs/phase-0.5/MILESTONES.md) · 子模块 0.5A/0.5B/0.5C/0.5D/0.5E/0.5F 全部收口 · **Latest Semantic Milestone = 0.5F.17 Lock Semantics Reconciliation** · **Latest Documentation Reconciliation = 0.5F.18 / 0.5F.19 (计数 32/24 + 15 对象焊死)** (0.5F.19 DOC-01 纠错 14→15 对象)
>
> **⚠️ 历史分组 ≠ 当前 surface 计数**: 上方 "9 Core + 1 Validation" / "5 P0 wireframes" 等是 **Phase 0.5A/0.5B 历史文档分组**, 不是总数; 当前权威 surface 计数 = **56 (32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施), 归并 4 域)**, 唯一事实源 (SoT) 是 [`docs/phase-0.5/SURFACE_REGISTRY.yaml`](docs/phase-0.5/SURFACE_REGISTRY.yaml) + [`docs/phase-0.5/NAVIGATION.md`](docs/phase-0.5/NAVIGATION.md)。请勿用历史分组相加 (如 10 + 5) 反推总数。

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![V0.2 Lock](https://img.shields.io/badge/V0.2-架构_LOCK_FINAL-green.svg)](docs/architecture/ARCHITECTURE_V0.2.md)
[![Runtime Semantics](https://img.shields.io/badge/Runtime_Semantics-CLOSED-green.svg)](docs/architecture/ARCHITECTURE_V0.2.md)
[![Phase 0.5.1](https://img.shields.io/badge/Phase_0.5.1-LOCK_FINAL-green.svg)](docs/phase-0.5/ERRATA.md)
[![Review Passes](https://img.shields.io/badge/review_passes-22-blueviolet.svg)](docs/architecture/ARCHITECTURE_V0.2.md)

[English Summary](#english-summary) · [中文详情](#项目详情)

---

## 项目详情

**VBMF（IP Broadcast Media Fabric）** 是一个面向 **24/7 广播机房** 的生产级 IP 媒体信号处理平台。

把 **SDI 摄录 → 编码 → RTMP / HLS / WebRTC 分发**，加上 **VOD 转码** 和 **Web 控制台**，全部用 **12 个核心 Engines + 5 横向系统 + 6 横切能力** 干净组合起来。

> 主备切换支持 **3 种 Switch Mode**（PACKET / FRAME / MASTER）+ **3 级 Hot-Standby**（COLD / WARM / HOT）；
> 健康监控采用 **Health Tree + 7 条 Health Invariants**，从通道 → 子系统 → 节点三层展开。

### 🎯 适合谁

- **广播 / 流媒体工程师** 想自建 SDI 摄录 + IP 分发一体化平台
- **OTT / 直播团队** 需要 PACKET / FRAME / MASTER 三档主备切换
- **架构 / 平台团队** 想参考"如何把 12 个独立 Engine 干净拼装"的最佳实践

### ✨ 核心能力

| 维度 | 状态 | 备注 |
|---|---|---|
| **架构** | ✅ V0.2 LOCK FINAL | 22 轮 review，57 决策，完整可唯一实现 |
| **Runtime Semantics** | ✅ CLOSED | 9 大 Runtime 域 + 3 Schema + 2 Semantic Cleanup + 7 Health Invariants |
| **Phase 0.5A Operator Semantics** | ✅ LOCK FINAL | 9 Core + 1 Validation（中英双语） + 4 关键操作链 + 20 项 UI 语义修复 |
| **Phase 0.5B Product Surface** | ✅ UX BASELINE LOCK FINAL | 56 surfaces（32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施)，SoT: SURFACE_REGISTRY.yaml）+ 5 P0 wireframes + 36 项语义收口（31 P0 + 5 P1）+ Design System + i18n |
| **Phase 0.5C Info Arch** | 🟢 LOCK FINAL | 目录归并 + Object Vocabulary + Navigation 4 域 + Product Object Model + 0.6 语义修复 (派生自 MILESTONES.md SoT) |
| **Phase 0.5D P0 Product Surfaces** | 🟢 LOCK FINAL | D1-D7 原型已建 + 0.5D.1 Semantic Closure (6 项) |
| **Reference Implementation** | 📋 Phase 0.6 (前置: 0.5 LOCK FINAL) | Reference A1/A2/B + 8 Fault Injection (FI-01A/B/02~07) = Executable Acceptance Spec |
| **Media Agent (Rust)** | 📋 Phase 1 | JSON-RPC + Session Manager + FfmpegCommandBuilder + 24h 稳定性 |
| **Web Console** | 📋 Phase 4 | 4 域 × 32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施) = 56 surfaces (权威: `docs/phase-0.5/SURFACE_REGISTRY.yaml`) |

### 🏗️ 12 Engines + 5 横向系统 + 6 横切能力

```
12 Engines (V0.2 §2.1 权威, LOCK FINAL):
  Source (11 types) · Signal Fabric · Normalize · Redundancy · QC · Playout
  Switcher (3 modes) · Composition · Audio · Output · Recording · Replay
  (Master Join = Composition 子能力, 非独立 Engine)

+ 5 横向系统 (V0.1 既有, V0.2 §2.2 权威):
  H1 Safety · H2 Resource Scheduler · H3 Watchdog & Incident · H4 Audit · H5 Subtitle

+ 6 横切能力 (X1-X6):
  X1 Graph Compiler    X2 Preflight    X3 Configuration Versioning
  X4 Incident Timeline X5 Health Tree  X6 Capability Registry
```

> ⛔ 历史错误修复 (Phase 0.5C): 早期 README 把 Master Join 误列为 Engine, Switcher/Composition/Audio 各出现两次,
> 且横向系统误用 V0.1 适配器名单 (Source Adapter / Stream Gateway 等 — 它们是 Output/Source Engine 的 Adapter, 不是横向系统)。
> 权威列表见 [`docs/architecture/ARCHITECTURE_V0.2.md`](docs/architecture/ARCHITECTURE_V0.2.md) §2.1 / §2.2。

### 📚 文档结构

```
docs/
├── architecture/
│   ├── README.md                       ← V0.2 快速参考
│   └── ARCHITECTURE_V0.2.md            ← 22 轮 review LOCK FINAL 架构基线 (192KB)
├── phase-0.5/                          ← Phase 0.5 顶层入口 (0.5A + 0.5B + 0.5C 统一目录)
│   ├── README.md                       ← Phase 0.5 总览 + 4 域导航
│   ├── OBJECT_VOCABULARY.md            ← 0.5C: 15 个 Canonical Object 权威定义 (0.5F.19 DOC-01 纠错 14→15)
│   ├── PRODUCT_OBJECT_MODEL.md         ← 0.5C: 3 层组合关系 (Profile / Bundle / Variant)
│   ├── NAVIGATION.md                   ← 0.5C: 4 顶层域 (BROADCAST/MEDIA/ENGINEERING/ADMIN)
│   ├── MILESTONES.md                   ← 0.5C: 历史 milestone 归档 (0.5A/0.5B/0.5B.1/0.5B.2/0.5C)
│   ├── SURFACE_SPEC.md                 ← V0.2 架构对象 → UI 表面完整映射 (计数由 SURFACE_REGISTRY.yaml 派生)
│   ├── DESIGN_SYSTEM.md                ← V0.1 Design System (Color / Component / 4 State Models / Keyboard)
│   ├── I18N_SPEC.md                    ← V0.1 i18n Contract (zh-CN + en-US / Canonical Vocabulary / enum 翻译表)
│   ├── OPERATOR_WORKFLOW.md            ← 9 Core 操作流
│   ├── ERRATA.md                       ← Phase 0.5A 变更归档（20 项 UI 语义修复）
│   ├── INDEX.md
│   ├── milestones/                     (5 历史 milestone 文档)
│   ├── operator/                       (全部当前 HTML Prototype / Surface · 中英双语 · Dark Mode 24/7 · 含 0.5A 9 Core+1 Validation 与 0.5D/0.5F 页面)
│   ├── product/                        (历史 B 轮 Product Wireframe 保留目录 · M-11 / M-12 / P-21 / P-22 · M-14 已并入 operator)
│   └── chains/                         (4 链：On-Air / Failure / Playout / Engineering)
├── phase-0.6/                          ← Executable Acceptance Specification 计划 (前置: Phase 0.5 LOCK FINAL)
│   └── README.md
├── assets/                             ← 图 / Diagram（待补）
├── SYSTEM_AND_PROJECT_PLAN.md          ← 初始系统 + 项目计划
└── V0.1_RETROSPECTIVE.md               ← V0.1 起步回顾（已冻结）
```

### 📜 演进历史 / Evolution History

VBMF 是从 **V0.1 Web 视频编码器** 演进而来的，**V0.1 的所有基础设施资产（服务器 / 驱动 / FFmpeg / 安全加固）完整继承到 V0.2**。

| 版本 | 状态 | 关键产物 |
|---|---|---|
| **V0.1** Web 视频编码器 | 🟡 已冻结 | 服务器初始化 + FFmpeg git-2026-08-23 + 9 codec lib + 3 张 BMD DeckLink + Docker Compose 骨架 |
| **V0.2** VBMF | ✅ LOCK FINAL | 12 Engines + 5 横向系统 + 6 横切能力 + 22 轮 review + 57 决策 |
| **Phase 0.5A** Operator Semantics | ✅ **LOCK FINAL** | 9 Core + 1 Validation（中英双语） + 4 关键操作链 + 20 项 UI 语义修复 — [ERRATA](docs/phase-0.5/ERRATA.md) |
| **Phase 0.5B** Product Surface + 0.5B.1 P0 Wireframes + 0.5B.2 Product UX Closure | ✅ **UX BASELINE LOCK FINAL** | 56 surfaces（32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施)，SoT: SURFACE_REGISTRY.yaml；0.5C 起归并为 4 域）+ 5 P0 wireframes + 36 项语义收口（31 P0 + 5 P1）+ Design System + i18n — [SURFACE_SPEC](docs/phase-0.5/SURFACE_SPEC.md) + [DESIGN_SYSTEM](docs/phase-0.5/DESIGN_SYSTEM.md) + [I18N_SPEC](docs/phase-0.5/I18N_SPEC.md) + [MILESTONES](docs/phase-0.5/MILESTONES.md) |
| **Phase 0.5C** Info Arch Closure | 🟢 **LOCK FINAL** | 目录归并 + Object Vocabulary + Navigation 4 域 + Product Object Model + 0.6 语义修复 |
| **Phase 0.5D** P0 Product Surfaces | ✅ 已完成 (LOCK FINAL) | M-17 Realtime Session / E-38 Hardware / E-37 Clock 升级 / P-20 Profile Center / P-28 Bundle / M-18 Job Detail / M-14 重画 |
| **Phase 0.6** Reference + FI | 📋 (前置: Phase 0.5 LOCK FINAL) | Reference A1/A2/B + 8 Fault Injection (FI-01A/B/02~07) = Executable Acceptance Spec |
| **Phase 1** Media Agent (Rust) | 📋 | JSON-RPC + Session Manager + FfmpegCommandBuilder + 24h 稳定性 |
| **Phase 4** Web Console | 📋 | 4 域 × 32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施) = 56 surfaces + 4 链验证 + VBMF Web UI |

**V0.1 → V0.2 为什么必须升级（架构级问题不能局部修）：**

| V0.1 问题 | 严重度 | V0.2 修复 |
|---|---|---|
| 无主备切换（单点故障） | 🔴 致命 | Switch Mode 3（PACKET/FRAME/MASTER）+ Hot-Standby 3 |
| 无健康监控（故障后只能 SSH 查 log） | 🔴 致命 | Health Tree + 7 Health Invariants + 3 轴状态 |
| SDI 当 COMPRESSED 域（错误抽象） | 🔴 正确性 | 4 Layer × 7 Type；SDI = RAW_VIDEO / RAW_AUDIO |
| 无 Capability Contract（切换时无对齐） | 🟠 高 | §3.4 switch_mode_decision_tree + X6 |
| 无 Change Set / 回滚 | 🟠 高 | §1.21 Atomic Apply + X3 |
| 无 Program Master（切换后画面跳变） | 🟠 高 | §3.7 三独立 graph |
| 无 Failure Domain | 🟠 高 | §8.9（7 Operational + 2 Diagnostic） |
| 无 Clock / Latency Probe / Incident Timeline / AVSync Manager | 🟡 中 | 全部新增 |

📖 **完整 V0.1 回顾 + 6 个关键决策 + 7 条经验教训：** [`docs/V0.1_RETROSPECTIVE.md`](docs/V0.1_RETROSPECTIVE.md)

### 🚀 快速开始

> ⚠️ V0.2 仍处于 **架构冻结 + Phase 0.5 完成** 阶段，**代码实现从 Phase 1 启动**。

#### 阅读顺序（推荐）

1. **[架构基线](docs/architecture/ARCHITECTURE_V0.2.md)**（~1-2 小时通读）
2. **[架构快速参考](docs/architecture/README.md)**（关键定义速查）
3. **[Phase 0.5 操作员工作流](docs/phase-0.5/INDEX.md)**（~30 分钟浏览 9 页面 + 4 链）
4. **[初始项目计划](docs/SYSTEM_AND_PROJECT_PLAN.md)**（理解服务器 / 编译环境基线）
5. 等待 Phase 0.6 / Phase 1

#### 部署参考（V0.2 §3.11 current_host_snapshot，非 Architecture Fact）

| 资源 | 数量 | 备注 |
|---|---|---|
| CPU | 32 核 | Runtime Discovery |
| RAM | 30 GB | Runtime Discovery |
| Disk | 546 GB | Runtime Discovery |
| BMD DeckLink | 3 张 (2× SDI legacy + 1× Mini Monitor 4K) | Runtime Discovery |
| OS | Ubuntu 26.04 | Runtime Discovery |

> 任何硬件增配 / 替换 **不需要修改 V0.2 架构**。

### 🛠️ 开发

```bash
# 克隆
git clone https://github.com/pwl1987-dev/vbmf.git
cd VBMF

# 浏览架构
cat docs/architecture/ARCHITECTURE_V0.2.md | less

# 打开 Phase 0.5 线框（任意浏览器，中英双语）
start docs/phase-0.5/operator/01-dashboard.html
start docs/phase-0.5/product/M-11-media-library.html
```

### 🤝 贡献

欢迎提交 PR。但请先阅读：
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [架构冻结说明](docs/architecture/ARCHITECTURE_V0.2.md)（见文末「附录 D：Architecture Baseline LOCK FINAL 状态」）
- **V0.2 已 LOCK FINAL**：任何架构级修改需开 V0.3 流程；Phase 0.5/0.6 是 Acceptance Validation，不修改架构

### 📜 许可证

[Apache 2.0](LICENSE) — 商用友好，需保留版权。

### 🙏 致谢

- **架构贡献**：22 轮 review 的所有发现 + 修复
- **SRS** ([ossrs/srs](https://github.com/ossrs/srs)) — Stream Gateway Adapter
- **FFmpeg** — Media Pipeline 引擎
- **BMD Desktop Video SDK** — SDI 摄录

---

## English Summary

**VBMF (IP Broadcast Media Fabric)** is a production-grade IP media signal processing platform for 24/7 broadcast rooms.

- **V0.2 Architecture**: LOCK FINAL (22 review rounds, 57 decisions)
- **Stack**: 12 Engines + 5 cross-cutting systems + 6 horizontal capabilities
- **3 Switch Modes**: PACKET / FRAME / MASTER
- **3 Hot-Standby Levels**: COLD / WARM / HOT
- **Health Tree**: Channel → Subsystem → Node with 7 Health Invariants
- **License**: Apache 2.0

### Quick start

1. Read [`docs/architecture/README.md`](docs/architecture/README.md) — V0.2 quick reference
2. Read [`docs/architecture/ARCHITECTURE_V0.2.md`](docs/architecture/ARCHITECTURE_V0.2.md) — Full architecture (192KB)
3. Browse [`docs/phase-0.5/operator/`](docs/phase-0.5/operator/) + [`docs/phase-0.5/product/`](docs/phase-0.5/product/) — 32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施) = 56 surfaces (计数见 [`docs/phase-0.5/SURFACE_REGISTRY.yaml`](docs/phase-0.5/SURFACE_REGISTRY.yaml), bilingual)
4. Read [`docs/phase-0.5/chains/`](docs/phase-0.5/chains/) — 4 critical operation chains

### Repository

- **URL**: https://github.com/pwl1987-dev/vbmf
- **License**: Apache 2.0
- **Visibility**: Public

### Evolution

| Version | Status | Key Deliverables |
|---|---|---|
| V0.1 Web Video Encoder | 🟡 Archived | Server init + FFmpeg full codec + BMD driver + Docker Compose skeleton |
| V0.2 VBMF | ✅ LOCK FINAL | 12 Engines + 22 review rounds + 57 decisions + 7 Health Invariants |
| Phase 0.5A Operator Semantics | ✅ Complete | 10 wireframes (bilingual) + 4 chains + 20 UI semantic fixes ([ERRATA](docs/phase-0.5/ERRATA.md)) |
| Phase 0.5B Product Surface | ✅ UX Baseline Lock | 56 surfaces (32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施), SoT: SURFACE_REGISTRY.yaml) + 5 P0 wireframes + Design System + i18n ([SURFACE_SPEC](docs/phase-0.5/SURFACE_SPEC.md)) |
| Phase 0.5C Info Arch Closure | ✅ LOCK FINAL | Directory consolidation + 4-domain navigation + object vocabulary + Product Object Model + 0.6 语义修复 (0.5F.18 P1-5 纠错 Draft→LOCK FINAL) |
| Phase 0.6 Reference + FI | 📋 Next | A1/A2/B + 8 Fault Injection (FI-01A/B/02~07) = Executable Acceptance Spec |
| Phase 1 Media Agent (Rust) | 📋 | JSON-RPC + FFmpeg Command Builder + 24h stability |

**V0.1 → V0.2 critical fixes (architectural, not patchable):**
- 🔴 No failover (single point) → Switch Mode 3 + Hot-Standby 3
- 🔴 No health monitoring → Health Tree + 7 Invariants + 3-axis state
- 🔴 SDI wrongly treated as COMPRESSED → 4 Layer × 7 Type; SDI = RAW
- 🟠 Missing Capability Contract / Change Set / Program Master / Failure Domain → all added

📖 Full V0.1 retrospective: [`docs/V0.1_RETROSPECTIVE.md`](docs/V0.1_RETROSPECTIVE.md)

### Current phase

| Phase | Status |
|---|---|
| Phase 0 (Architecture Freeze) | ✅ V0.2 LOCK FINAL |
| Phase 0.5A (Operator Semantics) | ✅ **LOCK FINAL** (9 Core + 1 Validation + 4 chains + 20 UI semantic fixes) |
| Phase 0.5B (Product Surface) | ✅ **UX BASELINE LOCK FINAL** (56 surfaces (32 LOCK + 24 SPEC (语义契约锁定, Phase 4 实施), SoT: SURFACE_REGISTRY.yaml) + 5 P0 wireframes + Design System + i18n) |
| Phase 0.5C (Info Arch) | 🟢 LOCK FINAL (directory consolidation + 4-domain navigation + object vocabulary) |
| Phase 0.5D (P0 Product Surfaces) | 🟢 LOCK FINAL (6 new surfaces + M-14 redraw) |
| Phase 0.6 (Reference + FI) | 📋 Next (after Phase 0.5 LOCK FINAL) |
| Phase 1 (Media Agent Rust) | 📋 After 0.6 |
| Phase 2-4 (Backend / Console) | 📋 |

For full details, see [`ROADMAP.md`](ROADMAP.md).

---

**VBMF Contributors** · V0.2 LOCK FINAL · Apache 2.0
