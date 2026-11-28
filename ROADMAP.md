# 路线图

> V0.2 架构基线 LOCK FINAL（22 轮 review）。
> 本文档是 VBMF 项目路线图（三段式：历史架构 / 当前实施 / 未来产品）。
> **实时 Current Phase / Current Task / Next Task / Risks / verification debt / handoff 的唯一动态事实源是 [`.project/STATE.md`](.project/STATE.md)。** `docs/architecture/PHASE_IMPLEMENTATION_MAP.md` 只保留宏观/历史实施阶段地图，不承担实时 Current Task Authority；本文同样不承担动态任务调度职责。

## 状态总览

### A. Historical Architecture Roadmap（历史架构阶段 — LOCK FINAL，不再变更）

```
Phase 0    架构冻结                       ✅ V0.2 LOCK FINAL
Phase 0.5A 操作员语义与线框            ✅ LOCK FINAL（10 中英双语页面 + 4 链 + 20 项修复）
Phase 0.5B 产品 UI Surface             ✅ UX BASELINE LOCK FINAL（56 surfaces（55 wireframes + 1 Spec，SoT: SURFACE_REGISTRY.yaml）+ 5 P0 wireframe + 36 项收口）
Phase 0.5C 信息架构收口                 🟢 LOCK FINAL（目录归并 + 4 域导航 + Object Vocabulary）
Phase 0.5D P0 产品表面                  🟢 LOCK FINAL（6 新表面 + M-14 重画）
```

### B. Current Implementation Roadmap（宏观/历史实施阶段地图 — 动态状态见 `.project/STATE.md`）

```
Phase 0.6  Runtime Abstraction           ✅ COMPLETE（PR#1, tag phase-0.6-runtime-abstraction-baseline）
Phase 0.7A Session Runtime               ✅ COMPLETE（PR#2, 四轮 Merge Gate Hardening）
Phase 0.7B  Media Semantics              ✅ COMPLETE（Normalize/Clock/Audio/Timecode 四基础, PR#3-#6）
Phase 0.7C External Integration          📋 NEXT（前置: D2/D4/D5/D6 债务 + Canonical Runtime State）
Phase 0.7D Event Projection              📋
Phase 0.8  Federation / Multi-site       📋（P2）
```

> 阶段详情/基线 tag/门禁证据/0.7C 前置顺序：见 `docs/architecture/PHASE_IMPLEMENTATION_MAP.md`。实时进度与下一任务只看 `.project/STATE.md`。

### C. Future Product Roadmap（未来产品阶段）

```
Phase 1    Media Agent（Rust + 24h 稳定） 📋 0.7 系列验收后
Phase 2    后端基础                       📋
Phase 2.5  Graph Compiler / Preflight     📋
Phase 3    Auth & RBAC                    📋
Phase 3.5  UI 原型与验证                 📋
Phase 4    Web 控制台                     📋
Phase 5    Signal Fabric                  📋
Phase 5.5  Health Tree & Incident UI      📋
V0.3       架构扩展                       📋 任何架构级扩展必须开 V0.3
V0.4       广播级（PTP/SDI/HA）           📋
V0.5       WebRTC + 浏览器上行            📋
V1.0       完整 IP 播控                   📋
```

## Phase 0 — 架构冻结 ✅

**已交付**（22 轮 review）：

- 12 Engines + 5 横向系统 + 6 横切能力 + 架构原则（V0.2 §1 声明 22 条 · **当前成文 7 条**） + 57 决策
- V0.2 Runtime Semantics CLOSED
- implementation_ambiguity: NONE
- 9 Runtime 域 CLOSED + 3 Schema 焊死 + 2 Semantic Cleanup + 7 Health Invariants
- 文档：`docs/architecture/ARCHITECTURE_V0.2.md`（192KB / 4020 lines）

## Phase 0.5 — Operator Semantics + Product UI Surface ✅（0.5A/0.5B/0.5C/0.5D/0.5E/0.5F LOCK FINAL）

> 0.5C 起统一目录 `docs/phase-0.5/`（原 phase-0.5b/ 已归并），milestone 历史见 [`phase-0.5/MILESTONES.md`](docs/phase-0.5/MILESTONES.md)。

**Phase 0.5A（Operator Semantics，LOCK FINAL）已交付**：

- `docs/phase-0.5/OPERATOR_WORKFLOW.md` — 角色矩阵 + 三轴状态机 + 危险操作 3 层
- 10 Low-Fi HTML 线框（`operator/`，**中英双语**，Dark Mode 24/7）：Dashboard / Sources / Switcher / Composition / Audio / Output / Recording / Graph Designer / Health Tree + 10-states Validation Page
- 4 关键操作链：On-Air / Failure / Playout / Engineering
- 20 项 UI 语义修复（`ERRATA.md`：12 P0 + 8 P1）

**Phase 0.5B（Product UI Surface，UX BASELINE LOCK FINAL）已交付**：

- `SURFACE_SPEC.md` — V0.2 架构对象 → 56 surfaces（55 wireframes + 1 Spec，SoT: SURFACE_REGISTRY.yaml；0.5C 起 4 域组织）完整映射
- `DESIGN_SYSTEM.md` — token / 组件 / 状态模型 / 键盘规范
- `I18N_SPEC.md` — zh-CN + en-US 契约 + Canonical Vocabulary + enum 翻译表
- 5 张 P0 wireframe（`product/`）：M-11 Media Library / M-12 Asset Detail / M-14 Transcode Center / P-21 Encoding Profile / P-22 Output Profile
- 36 项语义收口（31 P0 + 5 P1；B.0 13 + Closure-1 10 + B.2 8+5）

**Phase 0.5C（Info Arch，LOCK FINAL）**：目录归并 + 4 域导航（BROADCAST/MEDIA/ENGINEERING/ADMIN）+ `OBJECT_VOCABULARY.md`（14 对象）+ `PRODUCT_OBJECT_MODEL.md` + `NAVIGATION.md` + 0.6 语义修复

**Phase 0.5D（LOCK FINAL）**：5 个新表面 wireframe（M-17 Realtime Session / M-18 Job Detail / P-20 Profile Center / P-28 Profile Bundle / E-38 Hardware）+ E-37 Clock 升级 + M-14 File Transcode 重画

## Phase 0.6 — Reference Implementation + Fault Injection ✅ **COMPLETE**

> **[注记 2026-08-30, p07b-consolidation]** Phase 0.6 已完成（Runtime Abstraction Baseline，merge `d1cfaa9`）——原「Reference + Fault Injection」规划由 0.6 系列实现（SPI 抽象/契约对齐/remove-adapter 证明/CI 七门禁）；本节原文保留以存档。实施现状见 [`PHASE_IMPLEMENTATION_MAP.md`](docs/architecture/PHASE_IMPLEMENTATION_MAP.md)。

> 前置条件：Phase 0.5 LOCK FINAL（0.5D 完成后）。本阶段不写架构，只做 **Executable Acceptance Specification**。

**计划交付**：

- **Reference A1**（PACKET_SWITCH 基础）：预对齐压缩源 A / B（同 codec/container/时间戳）
  - 验证：Capability Contract、GOP/IDR、PTS/DTS、timebase、SPS/PPS、audio continuity
- **Reference A2**（SDI 主备走 FRAME/MASTER）：SDI-A/B → Normalize → Encode → FRAME/MASTER → SRS → HLS
- **Reference B**（异构源 + 图文 + 多 Master）：SDI + SRT + Composition + Audio Mixer → MASTER_SWITCH → Program Master → SRS
- **10 Fault Injection / Failure-Domain Tests (FI-01A/B/02~09)**：
  - FI-01A：Primary SDI 冻结 5s → SOURCE → FAILOVER to Backup
  - FI-01B：Backup SDI 缺失/异常 → SOURCE → READY_TO_TAKE 门禁
  - FI-02：音频静音 8s → PIPELINE → RESTART audio node
  - FI-03：Primary FFmpeg 进程崩溃 → PIPELINE → RESTART
  - FI-04：Clock Drift +5ms/min → CLOCK → FALLBACK to TIMECODE
  - FI-05：HLS 切片失败 → OUTPUT → RESTART_ADAPTER → alternate
  - FI-06：Audio Master Join 失败 → MASTER → FILLER_OR_EMERGENCY (target: emergency asset; 不切源)
  - FI-07：录制盘满/故障 → RECORDING → BACKUP_DISK (target: alternate disk)
- **7 Health Invariants** → executable test cases
  - HA-01..HA-07 from `docs/phase-0.5/operator/09-health-tree.html`
- 端到端：在 10.30.15.10 服务器上跑通
- 24h stability（基础）

## Phase 1 — Media Agent（Rust + 24h 稳定性）📋

- [ ] Media Agent v0（Rust + JSON-RPC）
- [ ] Session Manager（Data Plane 标注 + Switch Mode + Hot-Standby）
- [ ] FFmpeg Command Builder（**不用 fluent-ffmpeg** — 锁定）
- [ ] FFmpeg `-progress pipe:1` 解析
- [ ] BMD 设备 Registry（Media Agent 启动时探测）
- [ ] Clock Domain 检测
- [ ] Edge Policy 引擎
- [ ] Latency Probes（7 Core + 2 Client E2E + 1 Optional CDN）
- [ ] AVSync Manager（measure / compensate / drift）
- [ ] Switcher 3 modes
- [ ] Hot-Standby 3 levels
- [ ] Local NVMe Recording（5 min/段）
- [ ] SRS 单实例
- [ ] 端到端：`SDI → ffmpeg → SRS → HLS`，24h 不掉

## Phase 2 — 后端基础 📋

- [ ] Fastify + Drizzle + Zod
- [ ] PostgreSQL schema V0.2.4 final
- [ ] Valkey + Event Bus
- [ ] BullMQ + 转码 worker
- [ ] Media Controller
- [ ] GraphSpec / GraphRuntime 数据模型

## Phase 2.5 — Graph Compiler / Preflight 📋

X1-X6 横切能力的实施：

- [ ] X1 Graph Compiler（Validator / Insert Missing / Clock Align / Latency Estimate / Resource Plan / Emit Runtime）
- [ ] X2 Preflight（Graph / Playout / Channel 三类）
- [ ] X3 Configuration Versioning（Draft / Validate / Preview / Apply / Rollback）
- [ ] X4 Incident Timeline（自动串接）
- [ ] X5 Health Tree（7 规则 + 7 Invariants）
- [ ] X6 Capability Registry（Signal Contract + Player Matrix）

## Phase 3 — Auth & RBAC 📋

- [ ] 用户 / 角色 / 权限
- [ ] 4 角色：Operator / Director / Engineer / Admin
- [ ] RBAC 与 V0.2 Operator Workflow 对齐

## Phase 3.5 — UI 原型与验证 📋

- [ ] 15 wireframe（10 operator + 5 product）+ 0.5D 新表面对应页面端到端验证
- [ ] Reference A1/A2/B 真实可跑
- [ ] 10 Fault Injection / Failure-Domain Tests (FI-01A/B/02~09) 全部覆盖

## Phase 4 — Web 控制台 📋

- [ ] 4 域 × 56 surfaces（55 wireframes + 1 Spec，SoT: SURFACE_REGISTRY.yaml；按 SURFACE_SPEC + DESIGN_SYSTEM + I18N_SPEC 实施；Phase 0.5 wireframe → 真实现）
- [ ] 4 关键操作链验证
- [ ] Dark Mode First 24/7
- [ ] i18n 落地（zh-CN 默认 + en-US，按 I18N_SPEC）

## Phase 5 — Signal Fabric 📋

- [ ] 多 Channel 管理
- [ ] Output Variant 多路分发
- [ ] Adaptive Bitrate

## Phase 5.5 — Health Tree & Incident Timeline UI 📋

- [ ] Health Tree 可视化
- [ ] Incident Timeline 串联
- [ ] 录像回溯
- [ ] 7 Health Invariants 实时展示

## V0.3 — 架构扩展 📋

> 任何 V0.2 之后想加的功能，必须开 V0.3 流程。

候选 V0.3 特性（仅占位，不在 V0.2 范围）：

- NDI / RIST / Zixi Source Adapter
- SDI Master Output（V0.2 已 RESERVED）
- PTP / Genlock 完整支持
- 多节点 HA
- WebRTC 上行 / 互动

## V0.4 / V0.5 / V1.0

参见 `docs/architecture/ARCHITECTURE_V0.2.md` 附录 B（版本演进表）。

## 风险 / 注意事项

| 风险 | 缓解 |
|---|---|
| Phase 0.6 真实部署发现 V0.2 漏 | 开 V0.3 流程，不私自改 V0.2 |
| 7 Health Invariants 实测未通过 | 调 SQL 实现或算法，不动 Schema |
| 10 Fault Injection / Failure-Domain Tests 恢复动作不符合 §8.9 | 修复实现，§8.9 是 SoT |
| Playwright 浏览器 E2E 不稳定 | 用直接 JSON-RPC 测试，浏览器只测渲染 |

## 与开源社区的协作

| 阶段 | 社区协作 |
|---|---|
| Phase 0.5 | 公开 55 wireframes + 1 Spec = 56 surfaces（SoT: SURFACE_REGISTRY.yaml）+ Design System + i18n 契约（中英双语），欢迎 UI / UX 反馈 |
| Phase 0.6 | 公开 Reference A1/A2/B + 10 Fault Injection (FI-01A/B/02~09) 配置，欢迎调参与建议 |
| Phase 1+ | 接受 Rust / TypeScript 贡献 |

---

**VBMF Contributors** · V0.2 LOCK FINAL · Apache 2.0
