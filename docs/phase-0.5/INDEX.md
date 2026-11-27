# Phase 0.5 — 操作员工作流与 Low-Fi 线框

> V0.2 Architecture Baseline LOCK FINAL（22 轮 review）之后的第一阶段。
> 本阶段不修改架构，只做"操作员级"验证。
>
> **阶段划分:**
> - **0.5A** (LOCK FINAL) — Operator 播控 UI 语义 (9 Core + 1 Validation)
> - **0.5B** (当前) — V0.2 架构所有对象 → UI 表面 (见 [`SURFACE_SPEC.md`](SURFACE_SPEC.md))
>
> **Phase 0.5.1** — Stateful Operator UX Closure（12 + 8 = 20 项 UI 语义修复）已完成，详见 [`ERRATA.md`](ERRATA.md)
>
> **Phase 0.5.1 Final** — 8 项收口（4 P0 + 3 P1 + 1 文档统一），0.5A → **LOCK FINAL**

## 范围（按 V0.2 §10 / §11 锁定）

1. **9 Core Operational Pages** — 正式产品工作域
2. **+ 1 Validation / State Reference Page** (`10-states.html`) — Phase 0.5 验收辅助
3. = **10 HTML artifacts** 总计
4. **中英双语**；Dark Mode First；24/7 广播机房
5. **4 关键操作链** — 文档级可走通的流程规范
6. **Phase 0.5.1 修复** — 12 + 8 项 UI 语义收口 (见 `ERRATA.md`)

## 目录

```
phase-0.5/
├── README.md                       # 本目录说明（中英标签）
├── INDEX.md                        # 本文件
├── OPERATOR_WORKFLOW.md            # 操作员工作流（角色 / 流程 / 危险操作分层 / 状态机）
├── ERRATA.md                       # Phase 0.5.1 变更归档（12 + 8 项 UI 语义修复）
├── wireframes/                     # 10 HTML 线框（中英双语，Dark Mode）
│   ├── 01-09: 9 Core Operational Pages  (正式产品工作域)
│   │   ├── 01-dashboard.html        # 主控台 (P0-2 + P2-1)
│   │   ├── 02-sources.html          # 源管理 (P1-6 Clock Reference)
│   │   ├── 03-switcher.html         # 切播器 / Take (P0-3 5 状态机 + L2)
│   │   ├── 04-composition.html      # 图文 + 24h Timeline (P0-4)
│   │   ├── 05-audio.html            # 音频混音 (P1-3 广播安全区)
│   │   ├── 06-output.html           # 输出 (P1-4 3 视图 + Latency Probe)
│   │   ├── 07-recording.html        # 录制 / Replay (P1-5 Incident→Replay)
│   │   ├── 08-graph-designer.html   # Signal Graph Designer (P0-1 Scenario + 3 Tab)
│   │   └── 09-health-tree.html      # Health Tree (P0-5 + P1-2 3 视图)
│   └── 10-states.html               # 1 Validation Page (State Reference · 不在 9 Core 计数)
└── chains/                          # 4 关键操作链
    ├── chain-1-on-air.md            # 链 1：播出（Operator）
    ├── chain-2-failure.md           # 链 2：故障（Operator + System）
    ├── chain-3-playout.md           # 链 3：节目单（Director）
    └── chain-4-engineering.md       # 链 4：工程（Engineer）
```

## 9 Core Operational Pages + 1 Validation Page 清单

| # | 页面 | 主要角色 | 关键 Engines | Phase 0.5.1 修复 |
|---|---|---|---|---|
| 1 | Dashboard 主控台 | Operator | Channel / Switcher / Program Master | P0-2 + P2-1（System State Bar + Operator Intent） |
| 2 | Sources 源管理 | Engineer | Source Adapter (11 types) | P1-6（Clock Reference 完整呈现） |
| 3 | Switcher 切播器 | Operator | Switcher (3 modes) / Hot-Standby | P0-3（TAKE 5 状态机 + L2 确认） |
| 4 | Composition 图文 | Director | Composition (RAW 域) | P0-4（Timeline + Composition 双栏） |
| 5 | Audio 音频 | Operator | Audio Mixer / Loudness | P1-3（广播安全区 + AVSync） |
| 6 | Output 输出 | Operator | Output (SRS Adapter) | P1-4（3 视图 + Latency Probe） |
| 7 | Recording 录制 | Operator | Recording (5 min chunk) | P1-5（Incident → Replay 工作流） |
| 8 | Graph Designer 图设计 | Engineer | X1 Graph Compiler / X2 Preflight | P0-1（Scenario + 3 Tab + Edge Inspector） |
| 9 | Health Tree 健康树 | 全员 | X5 Health Tree / §3.9 Aggregation | P0-5（CSS 修复）+ P1-2（3 视图 + 9 Subsystem 对齐） |
| 10 | **10 States Validation** | 全员 | 三轴 Runtime State | P2-2（10 状态样例 · 验收辅助 · **不在 9 Core 计数**） |

## 4 关键操作链（V0.2 §10.11）

| # | 链 | 角色 | 端到端流程 |
|---|---|---|---|
| 1 | On-Air 播出 | Operator | Dashboard → PVW/PGM → Take → Master → Output → 播放 |
| 2 | Failure 故障 | Operator + System | 故障检测 → ALERT → Switch 决策 → Auto Failover → Filler → Incident |
| 3 | Playout 节目单 | Director | Timeline → Asset → Preflight → Apply → 自动到点 → 切 |
| 4 | Engineering 工程 | Engineer | Graph Designer → Compile → Preflight → Apply → Health Tree → QC |

## 与 V0.2 的关联

- §3.9 Health Tree Aggregation（7 Health Invariants）→ wireframe 09
- §3.4 Switch Mode 决策树 → chain-2
- §3.7 Program Master 三独立 graph → wireframe 03
- §8.9 Failure Domain Matrix → chain-2
- §10.11 4 关键操作链 → chains/

## 验收标准

- [x] 9 wireframe 都有 HTML 文件可打开（中英双语，Dark Mode 24/7）
- [x] 4 操作链都从主控台出发，能走到目标终点
- [x] 所有危险操作（Take / Apply / Failover）都有二次确认
- [x] Health Tree (9 Core Page) 能展示 7 Health Invariants
- [x] OPERATOR_WORKFLOW.md 包含：角色矩阵、状态机、危险操作分层、4 链 + 9 Core Page 映射 + 1 Validation Page

## 下一步

Phase 0.6：Reference A1/A2/B + 10 Fault Injection (FI-01A/B/02~09) + 7 Health Invariants = Executable Acceptance Specification。

## 补充 Spec 文档（0.5F 后变更登记）

> 0.5F LOCK FINAL 后产出的 3 份 Spec（仅 Spec，wireframe 待 0.5G），与上方 9 Core 线框互补，已登记进 `NAVIGATION.md` / `SURFACE_SPEC.md` §29.9.3b Batch 4。

| 文档 | 挂接表面 | 关键交付 |
|---|---|---|
| `ENCODE_MODEL_SPEC.md` | P-21 Encoding Profile | Encoding Profile 双语义模型 `FILE_PROFILE` / `REALTIME_PROFILE` + Realtime 专属属性（Latency Class / Failover / Warm-up / Hot Standby / Resource Reservation） |
| `E-42-source-test-bench.md` | 02-sources / E-40 | Source 入网验证台（7 层: Network / Transport / Container / Video / Audio / Clock / QC） |
| `B-13-take-preflight.md` | CD-01 Take | TAKE 前置联合检查 9 项（Source / Video / Audio / Clock / Switcher / Backup / Master / Output / Latency） |
