# VBMF 实现层架构补充（Implementation Addendum）

> **定位**：本文档是 [`ARCHITECTURE_V0.2.md`](./ARCHITECTURE_V0.2.md) 的**实现层（Implementation Architecture）补充**，不修改 V0.2 任何语义定义。V0.2 锁定（LOCK FINAL）不变；任何架构级改动仍须经 **V0.3 流程**拍板。本文档定位于 **Phase 0.6 — Runtime Abstraction & Portability Hardening**。
>
> **声明**：当前 `services/media-agent` 应正式定义为 **Canonical Media Runtime**；`BMD Provider` + `GStreamer Backend` 仅是**当前 Reference Implementation**，不是 VBMF 系统本身。所有 vendor/backend 都应是"实现资源"，而非业务身份。

---

## 0. 背景与决策

### 0.1 当前状态（审计结论）
硬件发现层已闭环（Device / Port / Capability / Signal / Content / Binding 已实现并通过真机验收 STEP 12 / HW-IDENT-02 / MEDIA-RT-01）：

- ✅ `CapabilityValue<T>` 四态（Supported/Unsupported/Unknown/ProbeFailed）
- ✅ `PortOrdinal { Known, Unknown }`（禁止 0 表示未知）
- ✅ `IdentityStrength` + Canonical `DeviceId` 独立于 GStreamer device-number（`DeviceHandle` 等是 Provider Identity，见 `CANONICAL_IDENTITY.md`）
- ✅ `VerificationLevel` 四档 + fail-closed 校验
- ✅ vendor-neutral `GraphRuntimeIntent`（仅 DeviceId + PortId + Media Semantics）
- ✅ Bus → PipelineHealth → AgentState → Supervisor 链

**未达 Canonical Domain 完整度**（V0.2 已定义语义，Rust 实现层未落地）：

- ❌ `Resource` / `Capacity` / `Availability` / `Allocation`
- ❌ `Session` 作为一等公民（谁拥有一次真实媒体运行实例）
- ❌ `Clock Domain` / `Timecode` Contract
- ❌ `Audio` 独立 Backend/Routing（当前 audio 隐含内嵌 SDI）
- ❌ `Provider` / `Backend` SPI 分层（`pipeline.rs`/`signal.rs` 业务层直接 `use gstreamer::*`）

### 0.2 核心裁决
> **先做一次 Runtime Abstraction Architecture Freeze，把关系一次定清楚；然后做 `ARCH-PORTABILITY-01` + `ARCH-BACKEND-01` 两个门禁。通过之后，BMD Provider + GStreamer Backend 才正式降级为 Reference Adapter。此步完成后，再进入 Normalize（Phase 0.7）。**
>
> **现在不要**直接继续 HW-PORT-01A 的 BMD-specific 开发，也**不要**直接进入 Normalize。

### 0.3 四层架构（取代单纯 Domain→Adapter 两层）

```
┌──────────────────────────────────────────┐
│  1. Canonical Domain                       │
│  Device Port Capability Media Signal       │
│  Clock Timecode Resource Format Event      │
└─────────────────┬──────────────────────────┘
                  │
┌─────────────────▼──────────────────────────┐
│  2. Runtime Contracts / SPI                │
│  HardwareProvider  MediaBackend            │
│  EncoderBackend   Gateway                  │
│  Acceleration     Clock/Timecode           │
│  Audio Backend                           │
└─────────────────┬──────────────────────────┘
                  │
┌─────────────────▼──────────────────────────┐
│  3. Runtime Orchestration                 │
│  Session / Pipeline / Lease               │
│  Supervisor / Health                       │
│  Binding / Scheduler / Preflight           │
└─────────────────┬──────────────────────────┘
                  │
┌─────────────────▼──────────────────────────┐
│  4. Concrete Adapters                     │
│  BMD / GStreamer / FFmpeg / SRS            │
│  PostgreSQL / Valkey / RustFS / ...        │
└──────────────────────────────────────────┘
```

关键：第 2 层 `Binding Resolver` 负责 **Physical Resource ↔ Provider Resource ↔ Runtime Resource** 的解耦，使 `AJA+GStreamer` / `BMD+GStreamer` / `BMD+FFmpeg` 自然成立。

---

## 1. 替换轴（优先级）

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
| 9 | **Audio Backend / Routing** | Embedded SDI（隐含） | P1 Contract |

> 第 9 轴是此前模型遗漏的真实缺口：当前 `decklinkaudiosrc` 隐含"audio 内嵌 SDI"，但未来 AES / Audio Matrix / MADI / Dante / IP Audio 使 Video Resource 与 Audio Resource 不再一一对应。

---

## 2. P0 / P0.5 / P1 / P2 优先级清单（冻结）

### P0（现在必须做）
```
Canonical Domain Boundary
Hardware Provider SPI
Media Backend SPI
Runtime Binding Model
Canonical Error / Event
Session Ownership Model   （只冻结边界，不实现调度）
Architecture Portability Gate
```

### P0.5（先于 Clock/Timecode 冻结）
```
Resource Model
Resource Ownership
Capacity / Availability
Allocation / Reservation
```

### P1（只定 Contract，不实现）
```
Clock Contract
Timecode Contract
Audio Backend / Routing Contract
Capability Negotiation
Encoder Backend Contract
Gateway Contract
```

### P2（以后做，连 Contract 暂缓）
```
DB Adapter
Queue Adapter
ObjectStore Adapter
Auth Adapter
Deployment Adapter
```

---

## 3. Canonical Domain 冻结模型

### 3.1 核心实体与关系
```
                  VBMF Canonical Domain
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
      Device             Media              Resource
        │                  │                  │
      Port              Session          Capacity/State
   Capability          Pipeline        Capability
        │              Signal/Format      Lease/Clock
        │
```

- **Device** — 物理身份/容器（Physical identity/container）；含 Canonical `DeviceId`（Domain 只见此）+ Provider Identity（`persistent_id`/`DeviceHandle`，见 `CANONICAL_IDENTITY.md`）。
- **Port** — 物理资源（Physical resource）；是 Session 引用的对象，不是 Session 本身。
- **Capability** — "能不能做"（静态能力）。
- **Resource** — "逻辑可消耗资源"（Logical consumable resource），见 §5。
- **Session** — 一次使用物理/逻辑资源的运行实例（Runtime instance），见 §4。
- **Binding** — Physical → Provider → Runtime Resource 的关联，见 §6。
- **Signal / MediaFormat** — 运行时观测（Observed），不解释回 Capability/方向。
- **Clock / Timecode** — 参见 P1 Contract（§7）。
- **Error / Event** — 参见 P0 统一模型（§8）。

### 3.2 Configuration vs Runtime State vs Observed State（三者严格分离）
```
Configuration  = 用户希望它是什么   （Manifest / Intent）
Runtime State   = 它现在是什么       （Lease / Session / Allocation）
Observed State  = 刚刚实际观测到什么 （Signal / Format / Content）
```
示例：
```
Manifest:    SDI-IN-1
Runtime:     GStreamer #1
Observed:    LOCKED / 1080i50
```
三者不得混用；任何模块不得"顺便改一点状态"而无明确 owner（见 §9）。

---

## 4. Session Ownership Model（P0 只冻结）

### 4.1 拥有关系树
```
MediaSession
├── Source Ports
├── Output Ports
├── Hardware Resources
├── Backend Resources
├── Lease
├── Pipeline
├── Clock Domain
└── Health
```

### 4.2 关键边界（写死）
```
Session ≠ Device
Session ≠ Port
Session ≠ Pipeline
Session ≠ Lease
```
关系：
```
Device  └── Port
MediaSession  ├── references Port
              ├── owns Pipeline lifecycle
              ├── acquires Lease
              ├── references Hardware Resource
              ├── references Backend Resource
              ├── belongs to Clock Domain
              └── aggregates Health
```
> **Port 是物理资源；Session 是一次使用这些资源的运行实例。**
> 于是：`一个 Device ── Port A → Session 1 / Port B → Session 2 / Port C → Available` 自然成立。

### 4.3 生命周期状态机（P0 只定义，不实现复杂流程）
```
Requested → Provisioning → Binding → Leased → Starting → Running → Stopping → Released
失败态：
  ProvisioningFailed / BindingFailed / StartFailed / Degraded / Recovery / Terminated
```
- P0 只定义状态机 + ownership。
- **不实现**：Scheduler / Placement / Multi-card balancing / 4·8·16 pipeline allocation / Global resource arbitration（全部留 P1/P2）。

---

## 5. Resource Model（P0.5，优先级高于 Clock/Timecode）

### 5.1 必须回答的 4 个问题
```
Capability    = 能不能做
Capacity      = 最多能做多少
Availability   = 现在还有多少
Allocation     = 当前谁占用了多少
```
示例（`Media Device`，厂商无关）：
```
Media Device
  Capability:   N INPUT ports
  Capacity:     N concurrent input sessions
  Availability: M
  Allocation:   Session-A → Port-X
                Session-B → Port-Y
```
> 具体厂商数值（如 BMD 4 SDI Input）只放 PROVIDER/HOST evidence，不进 Canonical 示例（vendor 中立，见 `CANONICAL_IDENTITY.md`）。

### 5.2 Resource ≠ Device
Resource 是**逻辑可消耗资源**；Device 是**物理身份/容器**。
```
Device ── Port resource
       ── DMA resource
       ── Input session capacity
       └── Output session capacity

GPU    ── decode session resource
       ── encode session resource
       └── memory resource
```

### 5.3 Resource 状态（不止 Available/Allocated）
```
Available → Reserved → Allocated → Releasing → Faulted
```
- `Reservation` = 计划占用（Preflight 阶段："我准备用这个资源，但 Pipeline 还没启动"）。
- `Allocation` = 当前实际资源消耗。
- `Reservation ≠ Lease ≠ Allocation`：
```
Preflight → Reserve Port → Create Session → Acquire Lease → Start Pipeline → Allocated
```

### 5.4 Resource 树（只定义模型，不实现 Scheduler）
```
Resource
├── resource_id: ResourceId
├── parent_resource_id: Option<ResourceId>   // 允许嵌套：Device → Port / DMA / Session-capacity
├── resource_type: Device | Port | Backend | Encoder | GPU | Network | Storage | Clock
├── DeviceResource ── PortResource A / PortResource B / DMA / Session Capacity
├── EncoderResource / GPUResource / NetworkResource
├── StorageResource / ClockResource
```
- 申请一个 `PortResource` 不会自动占用整个 `DeviceResource`；占用由 `parent_resource_id` + Allocation 显式表达（详见 `RUNTIME_RESOURCE_MODEL.md` §4/§4.1）。
> **必须与 V0.2 §3.11 九维 Resource Vector 对齐，不得另起一套语义。** Resource / Vector / Constraint / Token 四概念严格区分（见 `RUNTIME_RESOURCE_MODEL.md` §4.1）。

---

## 6. Runtime Binding Model（P0）

三态分离，由 Binding Resolver 关联：
```
Physical Resource
        ↓
Provider Resource
        ↓
Runtime Resource
```
- `RuntimeBindingManifest`（取代围绕 `BMD device handle` 的 `DeviceBindingManifest`）建立此关联；不围绕厂商 handle 定义。
- `Runtime Resource` 绝不等同于 `Identity`（device-number 仅是运行时地址）。
- 失败闭合：Identity/Capability/Binding 冲突必须拒绝；绝不盲开 device 0 / 自动换卡。

---

## 7. Audio Backend / Routing Contract（P1）

### 7.1 不当 VideoPort 的附属字段
```
VideoSource  ──bind──  AudioSource
            ──independent──
```
```
Session
├── Video Source ── SDI Port
└── Audio Source ── AES Port        （或 SDI Embedded Audio / MADI / Dante / IP）
```

### 7.2 Canonical 模型（现在支持，未来不返工）
```
AudioSource
AudioPort
AudioRoute
AudioChannel
AudioFormat
AudioClock
```
语义：`Embedded / De-embedded / Independent / Mixed / External`。
> 这样 Normalize 阶段不会再发现"原来 Audio 默认绑定 Video"。

---

## 8. Canonical Error / Event（P0）

### 8.1 统一模型
```
RuntimeEvent
RuntimeError
```
Provider / Backend / Session / Lease / Clock **都产生统一事件**，来源包括：
```
BMD HRESULT
GStreamer Bus Message
FFmpeg exit code
AJA SDK error
Audio Matrix error
Clock error
Device removal
```

### 8.2 Supervisor 稳定化
```
RuntimeEvent → Health / Policy Reducer → Supervisor Decision
```
> 而非 `GStreamer Error → Supervisor`。所有 vendor/backend 错误进入同一模型。

---

### 8.3 四类事件分层（TD-16，冻结边界）

> 未来 External Event 需要与 RuntimeEvent 完全分层；四者不共用「万能 Event」。

```
RuntimeEvent    = 内部事实（Provider/Backend/Session/Lease/Clock 产生，进 Health/Policy Reducer → Supervisor）
ExternalEvent   = 对 Control Plane / 外部的投影（由 RuntimeEvent 派生，带 event_id / correlation_id / causation_id）
AuditEvent      = 审计事实（谁、何时、对什么做了什么）
SecurityEvent   = 安全事实（authz 失败 / 越权尝试）
```

- `RuntimeEvent` 是源头；`ExternalEvent`/`AuditEvent`/`SecurityEvent` 是不同投影，各自有独立 schema，不得互相混用字段。
- 详见 `EVENT_CONTRACT.md`（P1）。

## 9. Ownership 模型（最终明确）

> 现在最大风险之一："每个模块都能改一点状态，但没有一个明确的状态 owner。"

```
Control Plane         owns Intent
Runtime Session Manager creates / destroys Session   （唯一 owner，Provider/Backend/Supervisor 不创建 Session）
Session               owns Runtime Lifecycle
Lease                 owns Exclusive Runtime Claim
Resource Registry     owns Resource State
Hardware Provider     owns Vendor Resource Translation
Media Backend         owns Backend Runtime
Supervisor            owns Recovery Decision
Health                owns Health State
Scheduler             owns Placement Decision   （P1/P2）
```

---

## 10. Architecture Portability Gate（P0 验收门禁）

### 10.1 `ARCH-PORTABILITY-01`（架构门，非功能门）
**Test A — 删除/禁用 BMD Provider，要求编译通过**
```
Domain      PASS
Graph       PASS
Session     PASS
Supervisor  PASS
Health      PASS
Acceptance  PASS
```
> ⚠️ **当前状态：编译不过**（main/resolver/signal/pipeline 直接依赖 decklink/gstreamer 模块）。这正是 P0 要消除的缺口，本条列为门禁目标。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）

**Test B — 使用 Mock Provider，要求**
```
same GraphRuntimeIntent
same Session
same Supervisor
same Health
```

**Test C — 换 Mock Provider B，要求**
```
不得修改 Domain
不得修改 Graph
不得修改 UI semantic schema
```

### 10.2 `ARCH-BACKEND-01`
比较 `MockBackend` vs `GStreamerBackend`，必须共享：
```
CanonicalPipelinePlan
CanonicalMediaFormat
CanonicalRuntimeEvent
```

### 10.3 CI 门禁
```
cargo build --no-default-features --features simulation
cargo build --features mock-only        # BMD feature absent + GStreamer feature absent
```
要求：Domain / Runtime Contract / Simulation **仍能编译**。
> 这是"真正可替换"的严格判据：**删除具体实现后，上层还能编译**——不仅是"设计上可以换"。

---

### 10.4 Architecture Freeze ≠ Implementation Freeze（P0-3，关键）

> **架构冻结 ≠ 实现完成。**

- **Architecture Contract = FROZEN**：本文档及配套契约关系已锁定，后续实现不得再「边写边发现抽象」。
- **Implementation Gate = NOT PASSED**：`ARCH-PORTABILITY-01` / `ARCH-BACKEND-01` 当前**编译不过**，是 P0 硬缺口；过门禁前，P0 实现不算完成。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- 二者独立陈述，禁止把「Contract FROZEN」解读为「P0 已实现」。真实进度见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`。

## 11. 设备更换流程（Fail Closed）

```
Hardware Discovery → Observed Device → Capability → Provisioning → Binding → Session → Runtime
```
换卡：
```
Old Device → Removed → Binding Stale → Session Degraded
```
> **绝不**自动寻找下一张卡，除非 Failover Policy 明确允许。

---

## 12. Phase 0.6 子阶段

```
0.6A  Canonical Domain & Session (CANONICAL_IDENTITY + RUNTIME_SESSION_MODEL)
0.6B  Provider SPI (BMD)
0.6C  Backend SPI (GStreamer)
0.6D  Runtime Binding
0.6E  Resource Model
0.6F  Architecture Lint + Reference Adapter
0.6G  Acceptance (P0/P0.5)
        ↓
0.7   P1: Audio/Clock/Timecode/Capability/Encoder/Gateway + External Integration
        ↓
0.8   Multi-site / Federation
```

---

## 13. 验收目标（换品牌/换后端时只发生的事）

| 变更 | 只发生 | 不发生 |
|---|---|---|
| BMD → AJA | Remove BMD Provider / Add AJA Provider / Rediscover / Rebind | 修改 Session / Graph / Health / Supervisor / UI |
| GStreamer → FFmpeg | Backend replaced / RuntimeBinding changed | 改变 CanonicalPipelinePlan |
| Embedded SDI → MADI | 修改 Audio Provider / Audio Backend | 重新定义 Video Graph / MASTER_SWITCH / Session |

---

## 14. VENDOR_NEUTRALITY_RULES（CI 防回归要点）

1. Domain 不得 `import` 任何具体 vendor / backend 类型（BMD / GStreamer / FFmpeg / AJA / SRS）。
2. 禁止自动 Fallback：Provider / Backend 失败必须 `Policy + Capability + Preflight + 决策` 才能切换。
3. `GraphRuntimeIntent` 仅允许 Canonical DeviceId + PortId + Media Semantics，不得出现 GStreamer/BMD 字段。
4. Configuration / Runtime State / Observed State 严格三分离。
5. 删除具体实现后，上层（Domain/Graph/Supervisor/Health）仍能编译。
6. `Runtime Resource` 绝不等同于 `Identity`；device-number 仅是运行时地址。
7. V0.2 `DeviceToken: BMD_INPUT_PORT | BMD_OUTPUT_PORT` 属 V0.2 LOCK FINAL 历史术语；Phase 0.6 **不将其扩展为新的 Vendor Identity**，改用 vendor-neutral `PortId` / `ConnectorType`（见 `V0_2_TO_PHASE_0_6_CROSSWALK.md` ADR-001，不修改 V0.2）。

---

*本文档为 **Phase 0.6 Architecture Contract FROZEN** 载体。
- **Architecture Contract = FROZEN**（`CONTRACT_STATUS = FROZEN`）：所有实体（Device / Port / Capability / Resource / Session / Binding / Signal / MediaFormat / Clock / Timecode / RuntimeError / RuntimeEvent / AudioRouting）关系以此为准，后续实现不得再「边写边发现抽象」。
- **Implementation Gate = NOT PASSED**：`ARCH-PORTABILITY-01` / `ARCH-BACKEND-01` 当前编译不过，是 P0 硬缺口；过门禁前 P0 实现不算完成（见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`）。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- 即 **Architecture Freeze ≠ Implementation Freeze**：契约冻结不表示代码已实现。*
