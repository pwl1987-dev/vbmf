# VBMF Phase 0.6+ Master PRD — Runtime Abstraction & External Integration

> 整合文档：缝合两份 PRD + 两份评审 + 已落盘契约 + 缺口与实现路径。
> 源 PRD：`VBMF Runtime Abstraction & Portability PRD.md`（165 条，P0/P0.5）、`VBMF External Integration & Device Interoperability API PRD.md`（170 条，P1/P2）
> ⚠️ **API PRD 不全盘接受**：#138–#170 的 Multi-site/Agent/Artifact/Recording 等 P2 条款与 Phase 0.6 冻结裁决（"P2 连契约都暂缓 / 无消费方不建抽象"）冲突，需外置；Event 三套推送、Artifact 上传子系统属过度设计。强制裁剪清单见 `PRD_REVIEW_EXTERNAL_API.md` §0.5 / §3.5（I–Q）。
> 评审：`PRD_REVIEW_RUNTIME_ABSTRACTION.md`、`PRD_REVIEW_EXTERNAL_API.md`
> 契约：`IMPLEMENTATION_ADDENDUM.md` + 6+1 + 本 Master 引用的各契约（均 CONTRACT = FROZEN）
> 与 V0.2 关系：**仅 additive**，不改变 Graph / DataPlane / Switch / Health / Ownership 语义（ARCH-PORTABILITY 门禁约束）

---

## 0. 范围与阶段

| 阶段 | 优先级 | 内容 | 来源 |
|---|---|---|---|
| **Phase 0.6** | P0 / P0.5 | Runtime Abstraction：四层、Provider/Backend SPI、Session/Binding/Resource、Preflight、架构边界（**Audio/Clock/Timecode 仅冻结 Contract，实现在 0.7**） | Portability PRD |
| **Phase 0.7** | P1 | External Integration Plane：External API、Event Projection、Device Adapter、Routing/Trigger、Webhook | API PRD |
| **Phase 0.8** | P2 | Multi-site / Federation / Agent / Advanced Adapter | API PRD（#140–#150） |

> 当前代码现状（评审基线）：`main/resolver/signal/pipeline` 直接依赖 `decklink`/`gstreamer`；无 Provider/Backend SPI、无统一 RuntimeEvent、无 Provider Registry、无 Mock Provider/Backend、11 处直接使用 `device_number`、`rpc.rs` 仅做 Node↔Rust 内部 RPC（明确 MUST NOT 实现 gateway/auth/WS）。**Portability 是重构现有 Runtime；API 是新增平面。**

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│  External Consumers (CMS / Scheduler / NMS / Router / Camera) │
└───────────────┬─────────────────────────────────────────────┘
                │  External API (Query/Command/Event/Webhook/SSE)
┌───────────────▼─────────────────────────────────────────────┐
│  Control Plane (Fastify Edge)                                │
│   - External API  · Event Projection · Integration Registry  │
│   - Routing/Trigger · Webhook Delivery · Diagnostics API      │
└───────────────┬─────────────────────────────────────────────┘
                │  Runtime Contract (Canonical, vendor-neutral)
┌───────────────▼─────────────────────────────────────────────┐
│  Runtime Layer (Rust Media Agent)                            │
│   Domain ── Contract ── Runtime ── Adapter                   │
│   - Canonical Media Model (Session/Binding/Resource/Audio)   │
│   - HardwareProvider SPI · MediaBackend SPI · RuntimeEvent    │
│   - Supervisor · Preflight · Provider Registry · Mock         │
└───────────────┬──────────────────┬──────────────────────────┘
                │                   │
        ┌───────▼──────┐     ┌──────▼───────┐
        │ Hardware     │     │ Media Backend │
        │ Provider:    │     │: GStreamer / │
        │ BMD / AJA    │     │  FFmpeg      │
        └──────────────┘     └──────────────┘
        (Device Adapter: ONVIF/SNMP/NMOS/GPIO — Control Plane 外层)
```

**依赖方向（硬约束）**：
- Domain → Contract → Runtime → Adapter（Portability #2/#135）
- External API → Control Plane → Runtime Contract → Rust（**禁止** External → Vendor SDK，API #135 `ARCH-API-BOUNDARY-01`）
- Adapter 只能 execute/observe/report，不得改 Graph/Channel/决定 Failover（API #101/#107）

---

## 2. 关键架构决策（摘要，详 `ARCHITECTURE_DECISION_LOG.md`）

- **R1 四层冻结**：Domain / Contract / Runtime / Adapter 边界不可越层依赖。
- **R2 Runtime Address ≠ Identity**：用 Canonical `DeviceId`（见 [`CANONICAL_IDENTITY.md`](./CANONICAL_IDENTITY.md)）。`DeviceHandle`/`PersistentId` 是 **Provider Identity**（vendor-specific），**不是** Canonical 身份；禁止 `device-number` 作业务主身份（Portability #8/#11）。
- **R3 Observation ≠ Configuration**：Health/Probe/Signal/Content 是观察，不写回 Graph（Portability #48）。
- **R4 Audio 独立建模**：Video/Audio/Metadata 独立 Graph，统一 Runtime container 不合并业务 Graph（Portability #55）。
- **R5 替换轴 9 条**：Hardware / Backend / Audio / GPU / Infra / Deploy / Security / Clock / Timecode，替换不变量见 Portability #61–#64、#164。
- **R6 配置三分/五分**：Configuration / Provisioning / Runtime / Observation / Evidence 严格分离（Portability #48）。
- **R7 厂商中立**：Provider/Backend/API 不得泄露 BMD/GStreamer/FFmpeg/Postgres 类型作 Canonical（API #136 + `VENDOR_NEUTRALITY_RULES.md`）。
- **R8 API 三平面**：Product(External) / Diagnostics / Internal(Agent) 不混用（API #150，术语对齐见 §7-G）。

---

## 3. 契约体系与实施状态（CONTRACT FROZEN / Implementation Status）

| 契约文档 | 状态（CONTRACT / IMPLEMENTATION） | 覆盖 PRD 段 |
|---|---|---|
| `IMPLEMENTATION_ADDENDUM.md` | CONTRACT = FROZEN / IN_PROGRESS | 综合载体（四层、决策） |
| `CANONICAL_MEDIA_MODEL.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #15, #20, #22–#39 |
| `HARDWARE_PROVIDER_CONTRACT.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #16, #17, #71, #127 |
| `MEDIA_BACKEND_CONTRACT.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #3, #18, #128 |
| `RUNTIME_RESOURCE_MODEL.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #42–#44, #120（须对齐 V0.2 §3.11，见 §7-F） |
| `TECHNOLOGY_PORTABILITY_MATRIX.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #61–#67, #163, #164 |
| `VENDOR_NEUTRALITY_RULES.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #136 / API #136 |
| `RUNTIME_SESSION_MODEL.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #15, #21, #56（澄清 #21 vs #56）｜P0 |
| `RUNTIME_BINDING_MODEL.md` | CONTRACT = FROZEN / IN_PROGRESS | Portability #19, #60, #102｜P0 |
| `AUDIO_ROUTING_CONTRACT.md` | CONTRACT = FROZEN / **PARTIAL**（0.7B-2B 已落地 canonical 音频语义层；Routing Runtime 属后续） | Portability #55, #63, #80｜P1 |
| `CLOCK_TIMECODE_CONTRACT.md` | CONTRACT = FROZEN / **PARTIAL**（0.7B-2A Clock 观测模型 + 0.7B-2C Timecode 基础已落地；策略/解析属后续） | Portability #57, #147, #148｜P1 |
| `EXTERNAL_API_CONTRACT.md` | CONTRACT = FROZEN / NOT_STARTED（**P1 暂不实施**） | API #1–#85, #108–#134, #151–#162 |
| `EVENT_CONTRACT.md` | CONTRACT = FROZEN / NOT_STARTED（**P1**） | API #11–#34, #78–#82, #102–#105, #155 |
| `DEVICE_INTEGRATION_CONTRACT.md` | CONTRACT = FROZEN / NOT_STARTED（**P1**；#140–#150 多站点/agent 属 P2 外置） | API #87–#107, #154 |
| `CANONICAL_IDENTITY.md` | CONTRACT = FROZEN / IN_PROGRESS（Final Hardening 补建，P0） | Portability #8/#11 + API #93/#94/#147（评审 §3.5-P） |
| `RUNTIME_TOPOLOGY_CONTRACT.md` | CONTRACT = FROZEN / IN_PROGRESS（Final Hardening 补建，P0.5） | 用户审查 #24/#25（PhysicalConnection/LogicalRoute/Topology） |

> **文档层缺口消除**：PRD #156 要求的契约体系完整；Final Hardening 额外补建 `CANONICAL_IDENTITY.md` / `RUNTIME_TOPOLOGY_CONTRACT.md`，使 Identity 与 Topology 不再散落各文档。

---

## 4. 缺口清单

### 4.1 文档层（已消除 ✅）
- Portability 侧 4 份（P0/P1）：`RUNTIME_SESSION_MODEL`(P0) / `RUNTIME_BINDING_MODEL`(P0) / `AUDIO_ROUTING_CONTRACT`(P1) / `CLOCK_TIMECODE_CONTRACT`(P1)
- API 侧 3 份（**P1；CONTRACT = FROZEN，IMPLEMENTATION = NOT_STARTED，暂不实施**）：`EXTERNAL_API_CONTRACT` / `EVENT_CONTRACT` / `DEVICE_INTEGRATION_CONTRACT`

### 4.2 代码层（实现路径消除，见 §5）
**P0（Phase 0.6，重构现有 Runtime）**
1. 建立 `HardwareProvider` trait（BMD FFI 在内）+ `MediaBackend` trait（GStreamer 在内）
2. 统一 `RuntimeEvent` / `RuntimeError`，Supervisor 只认 Canonical（禁 vendor HRESULT/GStreamer Message）
3. Provider Registry（静态 BMD + Mock，未来 AJA；不做动态 .so Loader）
4. Mock Provider/Backend trait，支持仿真矩阵（1/2/4/8 input、no signal/black/removed/backend failed/clock lost…）
5. 消除 11 处 `device_number` 直接依赖，改用 Canonical `DeviceId`（见 `CANONICAL_IDENTITY.md`；`DeviceHandle` 仅是 Provider Identity）
6. Preflight + Explainability（联合多能力，输出 Feasible/Rejected+Reason）
7. `ARCH-PORTABILITY-01` / `ARCH-BACKEND-01` 编译门禁（当前**编译不过**）（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
8. CI `check-architecture-boundaries` lint（禁 Domain import BMD/GStreamer、禁 GraphIntent 含 device-number、禁 Supervisor 引 vendor error、禁 UI 暴露 vendor primary id）

**P1（Phase 0.7，新增 External Integration Plane）**
9. External API 三平面（Query/Command/Event），含 Idempotency / Pagination / Error Model / Versioning
10. `RuntimeEvent → External Event` Projection 层（问题点 §7-B）
11. Device Adapter 框架（ONVIF/SNMP/NMOS/GPIO），Adapter 不可篡改 Canonical
12. Integration Registry + Routing/Trigger + Webhook 投递（Valkey 内部队列，Fastify dispatcher）

**P2（Phase 0.8）**
13. Multi-site / Site-aware Resource / Agent Registration / Federation

---

## 5. 实现路径

### Phase 0.6 — Runtime Abstraction（P0 / P0.5，不含 P1 实现）
- **0.6A** Canonical Domain & Session Model（落 `CANONICAL_IDENTITY.md`/`RUNTIME_SESSION_MODEL`/`RUNTIME_BINDING_MODEL`）
- **0.6B** Hardware Provider SPI（BMD）：抽 `decklink.rs` → `providers/blackmagic/`，FFI 在 Provider 内
- **0.6C** Media Backend SPI（GStreamer）：抽 pipeline → `backends/gstreamer/`
- **0.6D** RuntimeEvent / RuntimeError / Supervisor 改造
- **0.6E** Resource Model / Preflight（对齐 V0.2 §3.11）
- **0.6F** Provider Registry / Mock Provider+Backend / Simulation（消 #74 矩阵）
- **0.6G** Architecture Lint + Boundary Test（过 `ARCH-PORTABILITY-01` 编译）
- **0.6H** BMD/GStreamer Reference Adapter 收尾
- **0.6I** Acceptance Gate（P0/P0.5）：ARCH-PORTABILITY-01/BACKEND-01/RESOURCE-01 + HW-PORT-01/HW-IDENT-02/MEDIA-RT-01

### Phase 0.7 — P1（External Integration + Clock/Timecode/Audio/Capability/Encoder/Gateway Contract + Implementation）

> **[注记 2026-08-30, p07b-consolidation]** 本节 0.7A-G 为**规划期标签**，实施路线已由 [`PHASE_IMPLEMENTATION_MAP.md`](./PHASE_IMPLEMENTATION_MAP.md) 取代（实际实施：0.7A=Session Runtime、0.7B=Media Semantics(1/2A/2B/2C)、0.7C=External Integration、0.7D=Event Projection）。原文保留如下以存档。
> Audio/Clock/Timecode 从 0.6 移入 0.7：0.6 只冻结其 Contract 边界，实现在 0.7（与 External 同阶段，统称 P1）。
- **0.7A** External API 三平面 + `EXTERNAL_API_CONTRACT`
- **0.7B** Event Projection + `EVENT_CONTRACT`（RuntimeEvent→External）
- **0.7C** Device Adapter Framework + `DEVICE_INTEGRATION_CONTRACT`
- **0.7D** Integration Registry / Routing / Trigger / Webhook + EXT-* Acceptance
- **0.7E** Clock/Timecode Canonical（落 `CLOCK_TIMECODE_CONTRACT`）+ 实现
- **0.7F** Audio Routing 契约 + Audio Backend（落 `AUDIO_ROUTING_CONTRACT`）+ 实现
- **0.7G** Capability Negotiation / Encoder / Gateway Contract + 实现

### Phase 0.8 — Multi-site / Federation（P2）
- **0.8A** Site-aware Resource / Agent Registration
- **0.8B** Federation / Remote Operation

---

## 6. Acceptance Gate 汇总

| Gate | 类型 | 来源 | 阶段 |
|---|---|---|---|
| `ARCH-PORTABILITY-01` | 编译/等价 | MockProvider A/B 共享 same Domain/GraphIntent/Session/Supervisor/Health | P0 |
| `ARCH-BACKEND-01` | 编译/等价 | MockBackend vs GStreamerBackend 共享 CanonicalPipelinePlan | P0 |
| `ARCH-RESOURCE-01` | 仿真 | 模拟 1/2 device、8 ports、limited GPU/encoder，Resource 与 vendor 解耦 | P0.5 |
| `ARCH-AUDIO-01` | 仿真 | Embedded SDI/AES/MADI/Mock Matrix，Video Graph 不变 | P1 |
| `ARCH-API-BOUNDARY-01` | 边界 | External→Control→Runtime Contract→Rust，禁 External→Vendor SDK | P1 |
| `EXT-API-01` | 外部 API | Query/Command/Event/Authz/Audit/Idempotency/Versioning | P1 |
| `EXT-EVENT-01` | 事件 | delivery/retry/duplicate/signature/replay/ordering/consumer failure | P1 |
| `EXT-ROUTING-01` | 路由 | reserve/route/conflict/rollback/release | P1 |
| `EXT-FAIL-01` | 容错 | external down/timeout/auth fail/webhook unavailable/DNS fail/partition → 不波及其他 media runtime | P1 |
| `EXT-DEVICE-01` | 设备集成 | discovery/identity/capability/state/command/error/reconnect | P1 |
| `EXT-CONTROL-01` | 设备控制 | unauthorized/authorized/duplicate/timeout/partial/recovery | P1 |
| `HW-PORT-01` | 硬件 | SDI Loopback 端口能力 | P0 |
| `HW-IDENT-02` | 硬件 | 稳定身份（非 device-number） | P0 |
| `MEDIA-RT-01` | 媒体 | Generic INPUT→capture→RAW→first buffer→PTS monotonic（禁定义成 decklinkvideosrc） | P0 |

---

## 7. 两份 PRD 的问题点与澄清

### Portability（PRD 评审 a–g）
- **(a)** #16 "Provider 禁言 impl" 措辞冲突：应为"不得含 vendor 无关的通用业务逻辑；vendor SDK 适配实现必须在 Provider 内"。
- **(b)** #21 vs #56 措辞矛盾：Session 逻辑持有 Graph 语义、struct 内不含 real Pipeline 对象（两处加互引用）。
- **(c)** #72 feature 命名：采纳 `bmd-provider`/`gstreamer-backend`（非扁平 `bmd`/`gstreamer`）。
- **(d)** #159 "不允许改变 V0.2 Ownership" 与 Phase 0.6 明确 Session Ownership 潜在冲突：改为"不改已定义语义，仅 additive 边界明确"。
- **(e)** #156 文档清单与已落盘 6+1 未互引：本 Master §3 已统一映射。
- **(f)** #42/#43 Resource Vector 未声明对齐 V0.2 §3.11 九维：须显式引用，不另起语义。
- **(g)** #127 目标态 vs 现状未标：当前是 `decklink.rs`，`providers/blackmagic/` 是 Strangler 目标结构。

### API（PRD 评审 A–Q，**立场：不全盘接受**）
> ⚠️ API PRD 作为 P1/P2 规划基线，**不全盘接受**。#138–#170 的 Multi-site/Agent/Artifact/Recording 与 Phase 0.6 冻结裁决（"P2 连契约都暂缓 / 无消费方不建抽象"）冲突，必须外置；Event 三套推送、Artifact 上传子系统属过度设计。强制裁剪清单见 `PRD_REVIEW_EXTERNAL_API.md` §0.5 / §3.5。

- **(A)** 两份 PRD 互相未引用：本 Master §1 图已缝合。
- **(B)** RuntimeEvent→External Event 转换层缺失：补 `EVENT_CONTRACT.md` 定义 Projection 层（§4.2 P1-#10）。
- **(C)** Event Bus 选型：Runtime 内部事件总线 ≠ External 投递通道（Valkey 仅作 External Webhook 队列，不作 Runtime 事件源）。
- **(D)** PostgreSQL 用于 Integration Registry（#157）属 P2 外置：Integration 属 Control Plane，但 Domain Repository 抽象尚未建，此时定 PG 是层次倒置。
- **(E)** Multi-site/Agent（#140–#150）标 P2 外置（见 §0 阶段表 + 评审 §3.5-N）。
- **(F)** API #136 Vendor Neutrality 改引用 `VENDOR_NEUTRALITY_RULES.md`，不重复。
- **(G)** API 三平面术语对齐 Portability #98/#99：Product(External)/Diagnostics/Internal(Agent)。
- **(H)** #158/#159 Data Plane 边界 ✅，Master §1 显式引用。
- **(I) P1/P2 混写无阶段标记**：#138–#170 未分层（评审 §3.5-I）。
- **(J) 过度设计 — Event 三套推送**：Webhook/SSE/Subscription 并列，应只先 Webhook（评审 §3.5-J）。
- **(K) 过度设计 — Artifact 上传子系统无消费方**：#160–#167 完整上传系统但 Recording 消费方本身 P2（评审 §3.5-K）。
- **(L) 为不存在的 Control Plane 做详细设计（过早）**：#151–#157 定 Nginx/Fastify/Valkey/PG 形态，但该层不存在（评审 §3.5-L）。
- **(M) 鉴权悬空**：#108–#111 安全要求定义在未实现的 Fastify 应用层（评审 §3.5-M）。
- **(N) 与 Phase 0.6 冻结裁决冲突（最高优先级）**：#140–#150/#157/#160–#167 均 P2，PRD 未外置（评审 §3.5-N）。
- **(O) 大量验收无法在当前代码验证**：#78–#82/#102–#105/#131/#140–#150 需 Control Plane，未标 P1/P2（评审 §3.5-O）。
- **(P) 两份 PRD 各自定义"稳定身份"未共享**：#93/#94/#147 与 Portability #8/#11 应抽 `CANONICAL_IDENTITY` 契约（评审 §3.5-P）→ **已建 `CANONICAL_IDENTITY.md`**（见 §3 表），Provider Identity 与 Canonical `DeviceId` 的边界已冻结。
- **(Q) 范围过大未拆**：应拆 P1（API+Event+Device Adapter）与 P2（Multi-site/Agent/Artifact）（评审 §3.5-Q）。

---

## 8. 不做清单（与两份 PRD 一致）
- 动态 plugin / .so Provider Loader
- 全 AJA / 全 ONVIF 实现（仅建 Contract + Mock）
- AI 信号分类器（黑场检测只用 Frame/Luma statistics）
- universal DB / ORM 抽象
- multi-node scheduler / distributed lease
- 盲目引入 Kafka/NATS（第一阶段 Fastify dispatcher + Valkey）
- Runtime 内实现 API gateway / auth / RBAC / WebSocket aggregation（Rust MUST NOT）
- **P2 范围（API PRD #138–#170）本次不实施、连契约都暂缓**：Multi-site / Agent / Federation / Artifact 上传 / Recording-Playback 外部集成（无消费方不建抽象；详见 API 评审 §3.5）

---

## 9. 成功标准
- **P0**：删 BMD Provider 仍能编译（`ARCH-PORTABILITY-01` 过）；BMD→Mock Provider、GStreamer→Mock Backend，Domain/Graph/Session 零变化；`device_number` 从业务主身份消失。
- **P1**：换 BMD→AJA（硬件）、GStreamer→FFmpeg（后端）、Embedded→MADI（音频），上层 API/Graph 零代码改动；External API 不泄露 vendor 类型。
- **P2**：多 Site 互联经 API/Event/Adapter，不共享数据库。
