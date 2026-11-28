# VBMF Runtime Abstraction & Portability PRD
## Vendor-Neutral / Backend-Neutral / Resource-Aware / Session-Owned Media Runtime

**文档类型：** PRD + Architecture Contract Baseline  
**适用项目：** VBMF  
**目标阶段：** Phase 0.6 Runtime Abstraction & Portability Hardening  
**状态：** Proposed Freeze Candidate  
**核心原则：** 在不破坏 V0.2 LOCK FINAL / Phase 0.5 LOCK FINAL 的前提下，补齐实现层长期可替换性与 Runtime ownership 缺口。

> 📜 **状态：已执行 —— 165 条经 `PRD_REVIEW_RUNTIME_ABSTRACTION.md`（2026-08-28）逐条裁决，落 Phase 0.6，实现状态见新 PRD §7.1–§7.2。**
> **产品层唯一入口改看：** [`VBMF_PRODUCT_PRD.md`](./VBMF_PRODUCT_PRD.md)（V1.0 DRAFT，2026-11-27）。
> **处置**：原文保留作审计留痕。未决项见新 PRD §11。
> ⚠️ **勿直接引用本文的「评审基线事实」**（无 Provider/Backend trait、11 处 device_number 等）—— 那是 2026-08-28 评审时点的快照，已被后续实现推翻；当前实测基线见新 PRD §7.1。

---

# 1. 文档目的

本 PRD 不是要求立即实现全部功能。

本 PRD 的第一目标是回答：

> **VBMF 到底抽象什么、不抽象什么；哪些信息属于业务语义，哪些属于具体厂商/媒体框架/基础设施实现。**

第二目标是回答：

> **更换硬件厂商、媒体后端、编码器、GPU、Gateway、数据库或部署方式时，哪些代码和契约必须保持不变。**

第三目标是回答：

> **Device、Port、Capability、Resource、Session、Binding、Pipeline、Signal、Clock、Timecode、Audio 等对象到底由谁拥有、谁创建、谁销毁、谁改变状态。**

第四目标是：

> 为后续 Normalize → Switch → Program Master → Encode → SRS 提供稳定的 Runtime Contract，避免进入媒体主链后再次进行大规模架构返工。

---

# 2. 非目标

本阶段明确不做：

- 重开 V0.2 Core Architecture；
- 重开 Phase 0.5 UX Freeze；
- 更换 Node/Rust；
- 更换 GStreamer；
- 更换 SRS；
- 完整实现 AJA/Deltacast/Magewell 等所有 Provider；
- 动态 `.so` Plugin Marketplace；
- 全量 Scheduler；
- 多机全局资源调度；
- Normalize；
- MASTER_SWITCH；
- Program Master；
- Encoder 全功能；
- SRS 全链路；
- FI-08/FI-09 完整故障注入；
- 24h/7×24 稳定性验收。

本阶段核心是：

> **把“可替换边界”定清楚并让当前 BMD + GStreamer 实现成为第一个 Reference Adapter。**

---

# 3. 冻结的架构原则

## 3.1 Vendor is implementation

BMD、AJA、Deltacast、Magewell、NVIDIA、AMD 等都是实现。

不属于：

- Domain；
- Graph semantics；
- Product Object；
- Acceptance semantics。

---

## 3.2 Backend is implementation

GStreamer、FFmpeg、Native SDK 等是媒体执行后端。

不属于：

- Graph semantic；
- Source semantic；
- Switch semantic；
- Supervisor policy。

---

## 3.3 Infrastructure is implementation

PostgreSQL、Valkey、RustFS、Nginx、Docker 等为基础设施实现。

Domain 不直接依赖其具体类型或 API。

---

## 3.4 Runtime Address is not Identity

任何：

- GStreamer `device-number`
- FFmpeg input index
- PCI enumeration index
- process PID
- container ID

均不能成为 Canonical Device/Port Identity。

---

## 3.5 Observation is not Configuration

必须严格区分：

```text
Configuration
= 用户/系统期望

Provisioning
= 已批准的绑定

Observed State
= 当前实际观测

Runtime State
= 当前运行状态

Historical Evidence
= 历史事实
```

---

# 4. 总体目标架构

```text
                         ┌────────────────────┐
                         │   Control Plane    │
                         │ React + Fastify    │
                         └─────────┬──────────┘
                                   │
                         Canonical Intent
                                   │
                                   ▼
                    ┌────────────────────────────┐
                    │     Canonical Domain       │
                    │                            │
                    │ Device                     │
                    │ Port                       │
                    │ Capability                 │
                    │ Media Format               │
                    │ Signal                     │
                    │ Clock                      │
                    │ Timecode                   │
                    │ Resource                   │
                    │ Session                    │
                    │ Runtime Event/Error        │
                    └──────────────┬─────────────┘
                                   │
                         Runtime Contracts
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
 Hardware Provider          Media Backend             Infrastructure
 SPI                        SPI                       Adapter
          │                        │                        │
   ┌──────┼──────┐          ┌──────┼──────┐        ┌──────┼──────┐
   │      │      │          │      │      │        │      │      │
  BMD    AJA   Other       Gst   FFmpeg Native    PG   Valkey RustFS
```

---

# 5. 四层边界模型

## Layer 1：Canonical Domain

只定义业务与媒体语义。

---

## Layer 2：Runtime Contracts / SPI

定义：

- Hardware Provider；
- Media Backend；
- Encoder Backend；
- Gateway；
- Clock Provider；
- Timecode Provider；
- Audio Provider；
- Acceleration Provider。

---

## Layer 3：Runtime Orchestration

负责：

- Session；
- Pipeline；
- Lease；
- Reservation；
- Resource Allocation；
- Supervisor；
- Health；
- Binding；
- Preflight。

---

## Layer 4：Concrete Adapter

例如：

- Blackmagic Provider；
- GStreamer Backend；
- FFmpeg Encoder；
- SRS Gateway；
- PostgreSQL Repository；
- Valkey Queue；
- RustFS ObjectStore。

---

# 6. 核心领域对象

必须正式定义：

```text
Device
Port
Capability
Resource
Reservation
Lease
Session
Binding
MediaFormat
Signal
Content
Clock
Timecode
RuntimeEvent
RuntimeError
Pipeline
```

---

# 7. Device Model

## 7.1 定义

Device 是：

> 物理或逻辑媒体设备的稳定身份容器。

不等于：

- Pipeline；
- Session；
- Runtime resource；
- GStreamer element。

---

## 7.2 Device Identity

Canonical：

```text
DeviceId
```

Identity strength：

```text
HardwareStable
ProviderStable
ProvisionedStable
DerivedStable
SessionOnly
Unknown
```

Provider-specific identity 作为 opaque field。

---

# 8. Port Model

## 8.1 原则

真正的媒体 endpoint 是：

> Port。

不是 Device。

---

## 8.2 Port

至少包含：

```text
PortId
DeviceId
ConnectorType
Direction
Ordinal
Capability
```

---

## 8.3 Direction

```text
INPUT
OUTPUT
BIDIRECTIONAL
UNKNOWN
```

不得由 Signal 推导。

---

## 8.4 ConnectorType

至少：

```text
SDI
HDMI
DisplayPort
Optical
Analog
IP
Unknown
```

---

# 9. Audio 必须独立建模

这是本阶段新增的重要架构要求。

不能假定：

```text
Audio = Video 的附属物
```

必须支持：

```text
Embedded Audio
De-embedded Audio
Independent Audio
External Audio
Audio Matrix
IP Audio
```

例如：

```text
Session
├── VideoSource
│   └── SDI Port
└── AudioSource
    └── MADI Port
```

或者：

```text
Session
├── VideoSource
│   └── SDI Port
└── AudioSource
    └── Embedded SDI Audio
```

---

# 10. Audio Routing Contract

定义：

```text
AudioSource
AudioPort
AudioRoute
AudioChannel
AudioFormat
AudioClock
```

Audio Routing 不得依赖 BMD/GStreamer 特定行为。

---

# 11. Capability Model

统一：

```text
Supported
Unsupported
Unknown
ProbeFailed
```

Capabilities 描述：

> 能不能。

---

# 12. Capability 与 Capacity 分离

必须区分：

```text
Capability
= 能不能

Capacity
= 最多多少

Availability
= 现在还有多少

Allocation
= 当前用了多少
```

---

# 13. Resource Model

Resource 是：

> 可被 Session 使用和消耗的资源。

类型至少包括：

```text
DeviceResource
PortResource
BackendResource
EncoderResource
GPUResource
MemoryResource
NetworkResource
StorageResource
ClockResource
```

---

# 14. Resource State

至少：

```text
AVAILABLE
RESERVED
ALLOCATED
RELEASING
FAULTED
UNKNOWN
```

---

# 15. Reservation 与 Lease 分离

必须明确：

```text
Reservation
= 计划占用

Lease
= 当前独占权

Allocation
= 实际资源消耗
```

典型：

```text
Preflight
 ↓
Reserve
 ↓
Session Create
 ↓
Acquire Lease
 ↓
Start
 ↓
Allocate
```

---

# 16. Session Model

## 16.1 Session 是 P0 一等公民概念

但本阶段只冻结：

- ownership；
- lifecycle；
- references；
- cleanup contract。

不实现复杂 Scheduler。

---

## 16.2 Session Ownership Tree

```text
MediaSession
├── Source Ports
├── Output Ports
├── Hardware Resources
├── Backend Resources
├── Reservation
├── Lease
├── Pipeline
├── Clock Domain
├── Timecode Domain
├── Audio Routes
└── Health
```

---

# 17. Session Ownership Rules

Session：

- 拥有本次 Runtime Lifecycle；
- 不拥有物理 Device；
- 不改变 Device Identity；
- 不直接实现 Provider；
- 不直接解析 Vendor SDK。

---

# 18. Session Lifecycle

```text
REQUESTED
  ↓
PROVISIONING
  ↓
BINDING
  ↓
RESERVED
  ↓
LEASED
  ↓
STARTING
  ↓
RUNNING
  ↓
DEGRADED
  ↓
STOPPING
  ↓
RELEASED
```

失败状态：

```text
PROVISIONING_FAILED
BINDING_FAILED
START_FAILED
RECOVERY
TERMINATED
```

---

# 19. Scheduler Boundary

本阶段：

> 只冻结接口。

不实现：

- 全局 placement；
- 多机 scheduling；
- 负载均衡；
- 自动跨卡迁移。

---

# 20. Runtime Binding

Binding 表达：

```text
Canonical Physical Resource
        ↓
Provider Resource
        ↓
Runtime Backend Resource
```

---

# 21. Binding 三层

例如：

```text
PortId
 ↓
BMD Provider Port Ref
 ↓
GStreamer device/resource ref
```

不得把三者合并。

---

# 22. Binding Verification

定义：

```text
DECLARED
CAPABILITY_VERIFIED
RUNTIME_OPENED
SIGNAL_VERIFIED
LOOPBACK_VERIFIED
```

---

# 23. Manifest

Manifest 是：

> Provisioned Binding。

Manifest 不负责创造：

- Device；
- Port；
- Capability。

---

# 24. Manifest v2

核心：

```yaml
machine:
  id: ...

devices:
  - device_id: ...

    provider:
      id: ...
      device_ref: ...

    ports:
      - port_id: ...

        direction: INPUT
        connector: SDI

        provider:
          port_ref: ...

        runtime:
          backend: gstreamer
          resource_ref: ...

        expected:
          model: ...
          serial: ...
```

---

# 25. GraphRuntimeIntent

生产 Source 至少需要：

```text
device_id
port_id
media semantics
```

不得出现：

```text
gst device-number
bmd persistent-id
vendor enum
```

---

# 26. DeckLink 特例不得污染 Intent

禁止：

```json
{
  "kind": "decklink",
  "device_number": 1,
  "connection": "sdi"
}
```

允许：

```json
{
  "source": {
    "device_id": "...",
    "port_id": "..."
  }
}
```

---

# 27. Provider SPI

```rust
trait MediaHardwareProvider {
    fn provider_id(&self) -> ProviderId;
    fn discover(&self) -> Result<HardwareSnapshot, ProviderError>;
    fn open_input(...);
    fn open_output(...);
}
```

Provider 必须输出 Canonical/Provider-neutral data。

---

# 28. Provider 禁止事项

Provider 不允许：

- 控制 Supervisor；
- 控制 Failover；
- 修改 Graph；
- 修改 Session Policy；
- 直接修改 UI；
- 直接修改 Channel State。

---

# 29. Media Backend SPI

```rust
trait MediaBackend {
    fn backend_id(&self) -> BackendId;
    fn capabilities(&self) -> BackendCapabilities;
    fn create_pipeline(...);
}
```

---

# 30. GStreamer Adapter

GStreamer 专有内容只允许存在于：

```text
backends/gstreamer/
```

例如：

- GstPipeline；
- GstBus；
- GstBuffer；
- appsink；
- decklinkvideosrc；
- device-number；
- caps；
- GStreamer property。

---

# 31. FFmpeg Adapter

业务层禁止出现：

- ffmpeg CLI；
- filter_complex；
- `-map`；
- encoder-specific flags。

业务层只认识：

```text
EncoderRequest
EncoderCapability
EncoderSession
```

---

# 32. Encoder Backend

定义：

```text
EncoderBackend
```

支持：

```text
H264
H265
AV1
```

以后具体实现：

```text
x264
x265
NVENC
VAAPI
QSV
AMF
```

---

# 33. Gateway Adapter

定义：

```text
StreamGateway
```

当前：

```text
SRS
```

为 Reference Implementation。

业务层不能出现：

```text
SRS-specific state
SRS API
SRS-specific URL semantics
```

---

# 34. Clock Model

必须建立：

```text
ClockDomainId
ClockSource
ClockQuality
```

支持语义：

```text
Hardware
System
PTP
Genlock
Generated
Unknown
```

---

# 35. Clock Contract

至少：

```text locked
offset
drift
quality
source
```

GStreamer `GstClock` 只是 Adapter implementation。

---

# 36. Timecode Model

```text
Embedded
External
PTP Derived
Generated
None
Unknown
```

禁止把 BMD/GStreamer timecode 类型泄漏到 Domain。

---

# 37. Media Timestamp

统一：

```text
Capture
Decode
Normalize
Switch
Compose
Encode
Publish
```

使用 Canonical Timestamp。

---

# 38. Format Model

当前只需冻结 Contract：

```text
VideoFormat
AudioFormat
FrameRate
PixelFormat
Colorimetry
BitDepth
Range
Timebase
```

具体实现可以逐步完善。

---

# 39. Capability Negotiation

Graph Compiler/Preflight 不能问：

> “是不是 BMD？”

应该问：

> “这个 Port 是否能够提供所要求的媒体能力？”

例如：

```text
RAW_VIDEO
1920x1080
1080i50
50fps
SDI
48kHz Audio
```

---

# 40. Preflight

Preflight 必须联合：

```text Source Capability
+
Backend Capability
+
Format compatibility
+
Clock compatibility
+
Resource availability
+
Session constraints
```

输出：

```text Feasible
or
Rejected with Reason
```

---

# 41. Explainability

Preflight 必须说明：

```text
为什么能跑？
为什么不能跑？
缺什么？
冲突在哪里？
需要什么资源？
```

---

# 42. Resource Vector

至少考虑：

```text CPU
GPU
MEMORY
PCIe
I/O
NETWORK
STORAGE
DEVICE_SESSION
ENCODER_SESSION
```

---

# 43. Resource Capacity

例如：

```text Device:
4 input ports

Encoder:
3 H.265 sessions

GPU:
2 decode sessions
4 encode sessions
```

必须区分：

```text Supported
Capacity
Available
Allocated
```

---

# 44. Runtime Event

统一：

```rust
RuntimeEvent {
    device_id,
    port_id,
    session_id,
    pipeline_id,
    timestamp,
    event,
}
```

事件包括：

```text
DeviceChanged
PortChanged
SignalChanged
PipelineChanged
FrameObserved
BackendError
ClockChanged
LeaseChanged
```

---

# 45. Canonical Runtime Error

统一：

```text
DeviceUnavailable
PortUnavailable
IdentityMismatch
BindingMismatch
CapabilityUnsupported
SignalLost
FormatMismatch
BackendFailure
EncoderFailure
GatewayFailure
ClockFailure
LeaseConflict
ResourceUnavailable
SessionConflict
```

Vendor-specific Error 在 Adapter 内映射。

---

# 46. Supervisor

Supervisor 只认识 Canonical Runtime Event/Error。

禁止：

```text
BMD HRESULT
GStreamer Message enum
FFmpeg exit code
```

直接进入 Supervisor Policy。

---

# 47. Health Model

保持：

```text
Channel
 ↓
Subsystem
 ↓
Node
```

Media Agent 只负责：

```text Node Runtime Health
```

Fastify 聚合：

```text Channel/SubSystem Health
```

---

# 48. Configuration / Provisioning / Runtime 三分法

## Configuration

用户意图。

## Provisioning

已批准的资源绑定。

## Runtime

当前运行态。

## Observation

实际检测结果。

## Evidence

历史可信证据。

必须严格禁止混用。

---

# 49. Hardware Discovery

Discovery 只回答：

```text
有什么设备？
有哪些 Port？
有哪些 Capability？
```

不启动完整 Pipeline。

---

# 50. Runtime Probe

Probe 回答：

```text
现在是否可以打开？
Runtime binding 是否有效？
```

---

# 51. Signal Probe

Signal Probe 回答：

```text
当前是否有信号？
是否锁定？
格式？
音频？
```

---

# 52. Content Probe

Content Probe 回答：

```text
Black
Active
Frozen
TestPattern
Unknown
```

---

# 53. No Signal 与 Black

必须严格：

```text
NoSignal ≠ Black
Black ≠ Frozen
SignalDetected ≠ ActiveContent
```

---

# 54. 黑场检测

第一阶段基于：

```text
Frame window
Luma statistics
Color/range aware thresholds
```

不要引入 AI。

---

# 55. Audio / Video 独立 Graph

保持 V0.2：

```text
Video Graph
Audio Graph
Metadata Graph
```

统一 Runtime container 不代表业务 Graph 合并。

---

# 56. Session 与 Graph

一个 Session 可以包含：

```text
Video Graph
Audio Graph
Metadata Graph
```

但 Session 不改变 Graph semantics。

---

# 57. Hot Standby

未来允许：

```text
Primary Port
Backup Port
```

甚至：

```text
BMD Input
+
AJA Input
```

但 Failover Policy 必须由 Control Plane/Runtime Policy 决定。

Provider 不得自行切换。

---

# 58. Hardware Replacement

设备消失：

```text
DeviceRemoved
→ BindingStale
→ SessionDegraded
```

不允许：

```text
自动寻找第一张新卡
```

除非显式 Failover Policy 允许。

---

# 59. Hardware Addition

新设备：

```text
DISCOVERED
→ CAPABILITY_VERIFIED
→ PROVISIONED
→ AVAILABLE
```

不得自动进入 Production。

---

# 60. Runtime Resource Change

如果：

```text
GStreamer resource #1
→ #3
```

则：

```text
DeviceId 不变
PortId 不变
GraphIntent 不变
RuntimeBinding 更新
```

---

# 61. Provider Replacement

BMD → AJA：

只允许：

```text
Add AjaProvider
Rediscover
Provision
Verify
```

不修改：

- Domain；
- Graph；
- Session；
- Supervisor；
- Health；
- UI Semantic Model。

---

# 62. Backend Replacement

GStreamer → FFmpeg：

只替换：

```text MediaBackend
```

不修改：

- Graph Intent；
- Device；
- Port；
- Session；
- Supervisor。

---

# 63. Audio Backend Replacement

Embedded Audio → MADI/Dante/AES：

只替换：

```text Audio Provider / Audio Backend
```

Video Graph 不应重构。

---

# 64. GPU Replacement

未来：

```text NVIDIA
AMD
Intel
CPU
```

通过：

```text AccelerationProvider
```

表达能力。

现在只建立 Contract。

---

# 65. Infrastructure Adapter

以后需要：

```text Repository
ObjectStore
JobQueue
Cache
DistributedLock
```

当前实现：

```text PostgreSQL
RustFS
Valkey
```

全部属于 Adapter。

---

# 66. 为什么本阶段不立刻抽 Infrastructure SPI

因为当前 Node/Control Plane 尚未消费这些边界。

规则：

> **有真实替换轴 + 有近期消费方 → 现在建立 Contract。**

否则：

> 暂不建立。

---

# 67. Deployment Adapter

Docker/runc 继续保持。

但属于：

```text Deployment/Security Plane
```

不是 Domain。

---

# 68. Security Boundary

Provider/Backend 是高权限边界。

必须：

```text least privilege
device allowlist
cap drop
seccomp
AppArmor
filesystem restriction
network restriction
```

---

# 69. Supply Chain

所有 Provider/Backend 必须记录：

```text version
ABI version
SDK version
build SHA
artifact SHA256
build environment
```

---

# 70. ABI Boundary

Vendor SDK：

```text BMD SDK
AJA SDK
```

只存在于各自 Provider。

不得进入 Domain。

---

# 71. Provider Registry

第一阶段使用静态注册：

```text
BMD Provider
Mock Provider
```

未来增加：

```text
AJA Provider
```

不做动态 `.so` Loader。

---

# 72. Feature Boundary

建议：

```text
default
simulation
bmd
gstreamer
ffmpeg
hardware-test
```

并保持：

```text
bmd ≠ gstreamer
```

两者代表不同轴。

---

# 73. Simulation

Simulation 必须模拟：

```text
MockHardwareProvider
MockMediaBackend
```

而不是：

```text MockBMDDevice
```

---

# 74. Simulation 必须支持

至少：

```text
1 input
2 input
4 input
8 input
input-only
output-only
mixed
unknown direction
no signal
black
active
frozen
busy
device removed
device replaced
binding changed
backend failed
clock lost
lease conflict
resource exhausted
```

---

# 75. Contract Test

所有 Provider 必须通过：

```text
enumeration
identity
port discovery
capability
open input
open output
signal
format
error
recovery
```

Contract Test。

---

# 76. Backend Contract Test

统一测试：

```text
create
start
stop
recover
first buffer
PTS
Bus/Event
failure
release
```

---

# 77. Portability Gate

新增：

# `ARCH-PORTABILITY-01`

要求：

```text
MockProvider A
MockProvider B
```

共享：

```text
same Domain
same GraphIntent
same Session
same Supervisor
same Health
same Acceptance
```

---

# 78. Backend Portability Gate

新增：

# `ARCH-BACKEND-01`

比较：

```text
MockBackend
GStreamerBackend
```

两者共享：

```text CanonicalPipelinePlan
```

---

# 79. Resource Portability Gate

新增：

# `ARCH-RESOURCE-01`

模拟：

```text 1 device
2 devices
8 ports
limited GPU
limited encoder
```

证明：

> Resource state 与 Hardware vendor 解耦。

---

# 80. Audio Portability Gate

新增：

# `ARCH-AUDIO-01`

模拟：

```text Embedded SDI Audio
Independent AES
MADI
Mock Audio Matrix
```

要求：

> Video Graph 不改变。

---

# 81. Acceptance 分层

必须区分：

```text Generic Contract Acceptance
Provider Acceptance
Host Acceptance
```

例如：

```text MEDIA-RT-01
```

是 Generic。

```text BMD-MEDIA-RT-01
```

是 Provider。

```text HOST-10.30.15.10
```

是 Host evidence。

---

# 82. 当前 BMD/GStreamer 真机结果

当前测试机的：

```text BMD Provider
+
GStreamer Backend
```

是 Reference Adapter。

不是 Architecture Fact。

---

# 83. Evidence Scope

必须有：

```text GENERIC
PROVIDER
HOST_SPECIFIC
```

---

# 84. Evidence Status

统一：

```text CURRENT
ACCEPTANCE
HISTORICAL
SUPERSEDED
```

---

# 85. Evidence Provenance

每份真实证据至少记录：

```text repository SHA
host
timestamp
provider version
backend version
SDK version
driver version
test command
fixture
```

---

# 86. Hardware Inventory

至少：

```text device inventory
port inventory
capability inventory
runtime binding
signal snapshot
resource snapshot
```

---

# 87. UI 总原则

UI 不能显示：

```text BMD device-number
```

作为业务主身份。

---

# 88. Engineering UI

建议：

```text
Hardware
├── Devices
├── Ports
├── Bindings
├── Sessions
├── Resources
├── Signals
└── Diagnostics
```

---

# 89. Device View

显示：

```text Device
Provider
Identity
Identity Strength
Capability Summary
Port Count
Health
```

---

# 90. Port View

显示：

```text Device
Port
Connector
Direction
Capability
Binding
Signal
Format
Content
Verification
```

---

# 91. Session View

显示：

```text Session
Source
Output
Lease
Resources
Pipeline
Clock
Health
```

---

# 92. Resource View

显示：

```text Resource
Capability
Capacity
Availability
Reservation
Lease
Allocation
Owner
```

---

# 93. Signal View

显示：

```text Capability
Binding
Signal
Content
```

四层不能合成一个 Status。

---

# 94. UI Explain Why

任何异常要回答：

```text
为什么不可用？
谁占用了？
哪个绑定失败？
哪个 capability 不满足？
哪个资源不足？
哪个设备被替换？
```

---

# 95. UI 不允许直接修改 runtime resource

例如：

```text GStreamer #3
```

只能查看。

修改：

```text Port
→ Rebind
→ Preflight
→ Diff
→ Apply
```

---

# 96. UI 换卡流程

```text New Device Detected
        ↓
Inspect
        ↓
Capabilities
        ↓
Ports
        ↓
Select Port
        ↓
Binding Proposal
        ↓
Preflight
        ↓
Diff
        ↓
Apply
```

不得自动替换生产设备。

---

# 97. UI 资源占用链

例如：

```text
SDI-IN-1
 ├── Capability: INPUT ✓
 ├── Binding: VERIFIED ✓
 ├── Reservation: RESERVED
 ├── Lease: session-17
 ├── Pipeline: running
 └── Signal: LOCKED
```

---

# 98. API Contract

Product API：

```text DeviceId
PortId
Capability
Signal
Session
```

Diagnostics API：

```text provider_ref
runtime_resource_ref
vendor version
raw error
backend
```

Diagnostics 必须单独命名空间。

---

# 99. 不允许 Provider-specific API 污染 Product API

禁止：

```json
decklink_persistent_id
gst_device_number
bmd_mode
```

进入 Canonical Product API。

---

# 100. Idempotency

所有：

```text discover
bind
reserve
lease
start
stop
recover
```

必须定义幂等语义。

例如：

```text start(session-X)
start(session-X)
```

不能产生两个 Pipeline。

---

# 101. Concurrency

必须防止：

```text 两个控制请求
同时占同一个 Port
```

导致：

```text 双 Lease
双 Pipeline
设备竞争
```

Resource + Reservation + Lease 必须形成一致性链。

---

# 102. Stale State

Runtime Binding 必须支持：

```text CURRENT
STALE
CONFLICT
FAILED
```

不能让旧 Binding 永远有效。

---

# 103. Crash Recovery

Session 恢复必须具备：

```text persistent Session identity
runtime reconciliation
lease cleanup
resource reconciliation
```

但完整跨重启 Recovery 可在 P1 实现。

---

# 104. Upgrade / Rollback

未来 Provider/Backend 更新必须支持：

```text version pinning
compatibility validation
rollback
```

不能因为升级：

```text BMD SDK
GStreamer
```

就直接修改 Graph semantics。

---

# 105. Compatibility Matrix

建立：

```text Provider version
Backend version
SDK version
Driver version
OS version
```

兼容矩阵。

---

# 106. API Versioning

所有：

```text GraphRuntimeIntent
Manifest
Runtime Event
Acceptance schema
```

必须可版本化。

禁止直接破坏式修改。

---

# 107. Schema Migration

例如：

```text Manifest v1
→ v2
→ v3
```

必须提供 migration 或拒绝原因。

---

# 108. Resource Ownership 审计

任何资源状态：

```text Reserved
Allocated
Released
```

都应能追溯：

```text session
owner
timestamp
reason
```

---

# 109. Audit Event

至少：

```text Device added
Binding changed
Session created
Lease acquired
Pipeline started
Failover
Resource conflict
Provider changed
Backend changed
```

都进入 Audit。

---

# 110. Observability

必须统一：

```text logs
metrics
events
traces
evidence
```

四类信息不能混为一谈。

---

# 111. Metrics

建议：

```text devices_total
ports_total
bindings_verified
bindings_failed
sessions_running
sessions_degraded
resource_allocated
resource_available
signal_locked
signal_lost
bus_events_dropped
backend_failures
provider_failures
```

---

# 112. Trace Correlation

每个：

```text request
session
pipeline
lease
resource
event
```

应能够通过：

```text correlation_id
```

关联。

---

# 113. Failure Domain

继续保持 V0.2。

Provider failure：

> 不等于 Channel failure。

Backend failure：

> 不等于 Device failure。

Signal loss：

> 不等于 Device removed。

Lease conflict：

> 不等于 Hardware failure。

---

# 114. State Machine 防止非法状态

例如：

```text RELEASED
→ RUNNING
```

必须拒绝。

必须定义合法 transition。

---

# 115. Configuration Drift

如果：

```text Manifest
≠
Hardware
```

必须：

```text DRIFT
```

而不是：

```text 自动修改 Manifest
```

---

# 116. Device Replacement

如果：

```text old DeviceHandle
→ new DeviceHandle
```

则：

```text DeviceId changed
Binding stale
```

不能静默复用旧 Identity。

---

# 117. Port Replacement

如果：

```text Port topology changed
```

必须：

```text capability rediscovery
binding revalidation
```

---

# 118. Provider Identity Collision

如果 Provider 报：

```text duplicate stable identity
```

必须：

```text reject discovery
```

不得自动加随机 UUID 掩盖问题。

---

# 119. Backend Resource Collision

两个 Pipeline 要求相同：

```text runtime resource
```

必须：

```text one wins through Lease/Reservation
other rejected
```

---

# 120. Resource Exhaustion

如果 GPU/encoder/PCIe/network capacity 不够：

> Preflight 应该提前拒绝。

不能启动 Pipeline 后才发现。

---

# 121. Security Model

Provider/Backend 都要遵守：

```text least privilege
```

Vendor SDK 不得要求整个 Agent 全权限。

---

# 122. Secrets

Manifest 不保存：

```text password
token
API secret
```

只保存 references。

---

# 123. Credential Provider

未来：

```text SecretStore
CredentialProvider
```

当前暂不实现。

---

# 124. Network Boundary

媒体平面与控制平面网络边界必须明确。

不要因为：

```text Provider SDK
```

给整个 Media Agent 放开任意网络访问。

---

# 125. Deployment Independence

当前：

```text Docker + runc
```

继续。

但 Runtime Domain 不知道：

```text container ID
mount
cgroup
```

---

# 126. OS Boundary

当前明确：

```text Linux Runtime
```

不假装 Windows cross-platform。

如果未来要支持其他 OS：

> 通过 Runtime Adapter。

---

# 127. Current BMD implementation

最终：

```text providers/blackmagic/
    ffi
    discovery
    input
    output
    errors
```

而：

```text backends/gstreamer/
    input
    output
    bus
    pipeline
```

---

# 128. Current GStreamer implementation

它只是：

> Reference Media Backend。

不是 Domain Runtime。

---

# 129. Migration Strategy

采用：

# Strangler Pattern

顺序：

```text Existing BMD implementation
        ↓
BmdProvider
        ↓
Canonical Model
        ↓
GStreamerBackend
        ↓
Runtime Contracts
        ↓
Legacy cleanup
```

禁止一次性重写。

---

# 130. 当前最重要的 Boundary Test

必须实现：

```text disable BMD provider
```

结果：

```text Domain compile
Graph compile
Session compile
Supervisor compile
Health compile
```

---

# 131. 第二个 Boundary Test

```text disable GStreamer backend
```

结果：

```text Domain compile
Graph compile
Session compile
Supervisor compile
```

---

# 132. 第三个 Boundary Test

```text replace BMD with Mock Provider
```

结果：

> Graph 无变化。

---

# 133. 第四个 Boundary Test

```text replace GStreamer with Mock Backend
```

结果：

> Graph 无变化。

---

# 134. Architecture Lint

增加：

```text check-architecture-boundaries
```

检查：

- 禁止 Domain import BMD；
- 禁止 Domain import GStreamer；
- 禁止 GraphRuntimeIntent 出现 `device-number`；
- 禁止 Supervisor 引用 Vendor error；
- 禁止 UI Product API 暴露 vendor-specific primary identifiers。

---

# 135. Dependency Direction

必须：

```text Domain
 ↓
Contracts
 ↓
Runtime
 ↓
Adapters
```

不能：

```text Domain
 ↑
Adapter
```

---

# 136. Dependency Rule

Provider 可以依赖：

```text Contract
```

不能依赖：

```text UI
Control Plane
```

Backend 同理。

---

# 137. Testing Pyramid

```text Unit
 ↓
Contract
 ↓
Simulation
 ↓
Provider real hardware
 ↓
End-to-end
```

不能所有问题都靠真机解决。

---

# 138. Real Hardware Fixture

当前 SDI Loopback：

```text
output-capable port
 ↓
SDI cable
 ↓
input-capable port
```

正式定义为：

```text SDI-LOOPBACK-01
```

不带厂商名称。

---

# 139. Fixture Model

```yaml
fixture_id: SDI-LOOPBACK-01

source:
  device_id:
  port_id:

sink:
  device_id:
  port_id:

transport:
  type: SDI
```

---

# 140. Fixture 禁止

正式 Fixture 禁止：

```text first()
device-number guessing
first input
first output
fallback device 0
```

Provisioning candidate discovery 可以 heuristic，但正式 Fixture 必须落成明确 PortId。

---

# 141. Acceptance Matrix

至少：

```text ARCH-PORTABILITY-01
ARCH-BACKEND-01
ARCH-RESOURCE-01
ARCH-AUDIO-01
HW-PORT-01
HW-IDENT-02
MEDIA-RT-01
```

---

# 142. MEDIA-RT-01 Generic Definition

```text
INPUT Port
→ Backend Capture
→ RAW_VIDEO / RAW_AUDIO
→ first buffer
→ valid timestamp
→ PTS monotonic
→ stability window
```

不能定义成：

```text decklinkvideosrc first buffer
```

---

# 143. Provider Acceptance

例如：

```text BMD + GStreamer
```

必须证明：

```text Provider discovery
Port binding
Backend
Signal
RAW
```

但该证据：

> 不代表所有 Provider。

---

# 144. Resource Acceptance

至少模拟：

```text available
reserved
allocated
conflict
exhausted
released
```

---

# 145. Session Acceptance

至少测试：

```text create
start
stop
crash
recover
release
double-start
double-stop
lease conflict
resource conflict
```

---

# 146. Audio Acceptance

至少：

```text Embedded
Independent
No Audio
Audio Lost
Audio Reconnected
```

---

# 147. Clock Acceptance

至少：

```text Locked
Unlocked
Offset
Drift
Clock Lost
Clock Recovered
```

---

# 148. Timecode Acceptance

至少：

```text Present
Absent
Invalid
Discontinuous
Recovered
```

---

# 149. Device Replacement Acceptance

场景：

```text Provider A
Device A
Port A1
```

替换：

```text Device B
Port B1
```

要求：

```text Graph unchanged
Session semantics unchanged
Binding changes
```

---

# 150. Backend Replacement Acceptance

场景：

```text GStreamer
```

替换：

```text Mock backend
```

要求：

> Domain/Graph 不修改。

---

# 151. UI Acceptance

Engineering UI 必须：

```text Device
Port
Capability
Binding
Resource
Session
Signal
```

全部可解释。

---

# 152. UI Provider Neutrality

切换：

```text BMD → AJA
```

前端不需要改 Canonical schema。

只能改变：

```text Provider Diagnostics
```

---

# 153. UI Resource Ownership

至少能回答：

> 为什么这个端口不能使用？

展示：

```text reservation
lease
session
owner
```

---

# 154. Evidence Acceptance

每个 Acceptance 必须能追溯：

```text source code SHA
environment
provider
backend
fixture
command
result
```

---

# 155. Evidence 不得升级为 Architecture Fact

尤其：

```text current host topology
device-number
BMD model
GStreamer version
```

全部属于：

```text PROVIDER/HOST_SPECIFIC
```

除非正式架构文档明确冻结。

---

# 156. 文档要求

新增：

```text docs/architecture/
    CANONICAL_MEDIA_MODEL.md
    HARDWARE_PROVIDER_CONTRACT.md
    MEDIA_BACKEND_CONTRACT.md
    RUNTIME_RESOURCE_MODEL.md
    RUNTIME_SESSION_MODEL.md
    RUNTIME_BINDING_MODEL.md
    AUDIO_ROUTING_CONTRACT.md
    CLOCK_TIMECODE_CONTRACT.md
    PORTABILITY_AND_ADAPTER_MODEL.md
    TECHNOLOGY_PORTABILITY_MATRIX.md
    VENDOR_NEUTRALITY_RULES.md
```

---

# 157. 文档职责

## CANONICAL_MEDIA_MODEL

定义：

> Domain 对象。

## HARDWARE_PROVIDER_CONTRACT

定义：

> 硬件 Provider。

## MEDIA_BACKEND_CONTRACT

定义：

> GStreamer/FFmpeg/Native。

## RUNTIME_RESOURCE_MODEL

定义：

> Capacity/Reservation/Lease/Allocation。

## RUNTIME_SESSION_MODEL

定义：

> Session ownership。

---

# 158. PRD 与 Architecture 的关系

V0.2：

> 定义系统语义与总体架构。

本 PRD：

> 定义 Implementation Boundary。

不允许借此改变：

```text V0.2 Graph semantics
V0.2 Data Plane
V0.2 Switch
V0.2 Health
V0.2 Ownership
```

---

# 159. Phase 0.5

保持 LOCK FINAL。

本 PRD 只允许 additive：

```text Engineering Hardware
Engineering Port
Resource
Session
Diagnostics
```

---

# 160. Phase 0.6

正式扩展为：

```text 0.6A Canonical Model
0.6B Provider SPI
0.6C Backend SPI
0.6D Resource
0.6E Session
0.6F Binding
0.6G Audio
0.6H Clock/Timecode
0.6I Portability
0.6J Reference Adapter
0.6K Acceptance
```

---

# 161. Priority

## P0

必须现在：

```text Domain boundary
Provider SPI
Backend SPI
Binding
Session ownership
Canonical Error/Event
Architecture portability gate
```

---

## P0.5

必须在进入 Normalize 前：

```text Resource
Capacity
Availability
Reservation
Allocation
Ownership
```

---

## P1

Contract Now / Implementation Later：

```text Clock
Timecode
Audio Routing
Capability Negotiation
Encoder
Gateway
GPU
```

---

## P2

以后：

```text DB
Queue
ObjectStore
Auth
Deployment abstraction
```

---

# 162. 当前明确不要做

```text Dynamic plugin loader
Full AJA provider
Full Deltacast provider
Universal hardware database
Universal AI signal classifier
Full multi-node scheduler
Full distributed lease
```

---

# 163. 必须支持的未来变化

系统必须从架构上允许：

```text BMD → AJA
AJA → Deltacast

1 card → 8 cards
2 ports → 8 ports

Input only
Output only
Mixed
Bidirectional

Embedded audio
→ MADI
→ Dante
→ AES

GStreamer
→ FFmpeg
→ Native

NVIDIA
→ AMD
→ Intel
→ CPU

SRS
→ another Gateway

PostgreSQL
→ another DB

RustFS
→ S3

Valkey
→ another Queue

Docker
→ Bare Metal
```

---

# 164. 更换矩阵

| 替换项 | 必须保持不变 |
|---|---|
| Hardware Provider | Domain / Graph / Session |
| Media Backend | Domain / Graph / Session |
| Encoder | Graph semantic |
| Gateway | Program Stream semantic |
| Audio backend | Video semantic |
| Clock provider | Graph semantic |
| GPU | Graph semantic |
| Database | Domain object |
| Queue | Job semantics |
| Object store | Asset semantics |
| Deployment | Runtime semantics |

---

# 165. 最大成功标准

不是：

> “有多少 Adapter。”

而是：

> **替换 Adapter 后，上层无需修改。**

---

# 166. DOD-01 Domain Isolation

Domain：

```text
不 import BMD
不 import GStreamer
不 import FFmpeg
不 import SRS
```

---

# 167. DOD-02 Intent Isolation

GraphRuntimeIntent：

```text
不出现 device-number
不出现 persistent-id
不出现 vendor enum
```

---

# 168. DOD-03 Provider Contract

Mock Provider 可以完整实现 Contract。

---

# 169. DOD-04 Backend Contract

Mock Backend 可以完整实现 Contract。

---

# 170. DOD-05 Reference Provider

BMD Provider 通过当前真实设备验收。

---

# 171. DOD-06 Reference Backend

GStreamer Backend 通过当前真实 MEDIA-RT-01。

---

# 172. DOD-07 Resource

Simulation 可以证明：

```text reservation
lease
allocation
conflict
```

---

# 173. DOD-08 Session

Simulation 可以证明：

```text create/start/stop/recover/release
```

---

# 174. DOD-09 Audio

Mock Audio Provider 能表达：

```text embedded
independent
unavailable
```

---

# 175. DOD-10 Portability

Mock Provider A → B：

> Graph 不修改。

---

# 176. DOD-11 Backend Portability

Mock Backend → GStreamer：

> Graph 不修改。

---

# 177. DOD-12 Runtime Address

改变 Runtime resource：

> DeviceId/PortId 不变。

---

# 178. DOD-13 Fail Closed

所有：

```text identity mismatch
port mismatch
capability mismatch
resource conflict
provider failure
```

默认拒绝。

---

# 179. DOD-14 Explainability

所有拒绝必须给出：

```text reason
source
observed
expected
impact
```

---

# 180. DOD-15 Evidence

真实 Acceptance 可重现且可追溯。

---

# 181. CI

必须保持：

```text cargo fmt --all
cargo test
cargo test --features simulation
cargo clippy --all-targets -- -D warnings
cargo clippy --features simulation -- -D warnings
```

以及：

```text bmd
bmd,gstreamer
```

真机构建。

---

# 182. Architecture Lint CI

必须增加：

```text vendor leakage check
backend leakage check
GraphIntent leakage check
fallback detection
```

---

# 183. Provider Contract CI

至少：

```text MockProvider
MockBackend
```

每次 CI 验证。

---

# 184. Failure Injection

本阶段不完成 FI-08/FI-09。

但 API 必须留：

```text RuntimeEvent
RuntimeError
Session state
Recovery decision
```

供下一阶段。

---

# 185. 当前真实 BMD 证据重新定位

所有当前：

```text BMD + GStreamer
```

证据统一视为：

```text PROVIDER
+
BACKEND
+
HOST_SPECIFIC
```

---

# 186. 当前 SDI Loopback

正式：

```text SDI-LOOPBACK-01
```

作为：

```text Reference Fixture
```

不是业务生产配置。

---

# 187. 当前 MEDIA-RT-01

保留：

```text Generic Acceptance
```

其真实实现：

```text BMD Provider
+
GStreamer Backend
+
SDI Fixture
```

---

# 188. 最终架构树

```text
                         VBMF
                          │
                 Canonical Domain
                          │
      ┌─────────────┬─────┴─────┬──────────────┐
      │             │           │              │
   Device/Port   Session     Resource       Media
      │             │           │              │
 Capability       Lease      Capacity        Format
 Signal           Pipeline   Allocation      Clock
 Content          Health     Reservation     Timecode
      │
      └────────────────────────────────────────┐
                                               │
                                      Runtime Contracts
                                               │
                    ┌──────────────────────────┼────────────────────────┐
                    │                          │                        │
              Hardware Provider          Media Backend            Infrastructure
                    │                          │                        │
            BMD / AJA / ...             Gst / FFmpeg / ...       PG/Valkey/RustFS
```

---

# 189. 最终原则

必须永久坚持：

```text
Device
≠ Port
≠ Capability
≠ Resource
≠ Reservation
≠ Lease
≠ Session
≠ Pipeline
≠ Runtime Address
≠ Signal
≠ Content
≠ Configuration
≠ Observation
```

---

# 190. 最终决策

本项目不是：

> BMD Media Agent。

本项目是：

# **Vendor-Neutral Media Runtime / Media Resource Fabric**

当前：

```text
BMD
GStreamer
FFmpeg
SRS
PostgreSQL
Valkey
RustFS
Docker
Nginx
```

全部只是：

> Reference Implementation。

---

# 191. 下一阶段开发顺序

严格执行：

```text
STEP 0
收敛现有未提交代码
        ↓
STEP 1
Canonical Domain Contract
        ↓
STEP 2
Hardware Provider SPI
        ↓
STEP 3
Media Backend SPI
        ↓
STEP 4
Runtime Binding
        ↓
STEP 5
Session Ownership
        ↓
STEP 6
Resource / Reservation / Lease boundary
        ↓
STEP 7
Audio Contract
        ↓
STEP 8
Clock / Timecode Contract
        ↓
STEP 9
Mock Provider / Backend
        ↓
STEP 10
Architecture Portability Gates
        ↓
STEP 11
BMD Provider migration
        ↓
STEP 12
GStreamer Backend migration
        ↓
STEP 13
Current BMD/GStreamer acceptance rerun
        ↓
STEP 14
Freeze implementation boundary
        ↓
STEP 15
进入 Normalize
```

---

# 192. 最终禁止事项

任何开发者不得：

```text
硬编码当前 BMD 数量
硬编码 device-number
硬编码 first device
硬编码 first port
signal 推 direction
model 推 port count
provider error 进入 Supervisor
GStreamer property 进入 Domain
Vendor type 进入 Graph
Manifest 创造 capability
Session 自动修改 Graph
Resource 自动 failover
Backend 自动 fallback
Device replacement 自动切换
UI 直接编辑 runtime resource
Evidence 把 host fact 升级成 architecture fact
```

---

# 193. 最终验收标准

当本阶段结束时，应可以回答：

> 如果明天把 BMD 全部换成 AJA，VBMF 哪些代码不需要修改？

答案必须是：

```text
Domain
Graph
Session
Resource
Supervisor
Health
Acceptance semantics
UI Canonical Model
```

均不需要修改。

如果答案做不到：

> 抽象边界尚未完成。

---

# 194. 最重要的架构验收

最终真正要求：

```text Remove BMD Provider
        ↓
Domain still compiles
Graph still compiles
Session still compiles
Resource still compiles
Supervisor still compiles
Health still compiles
Acceptance contracts still compile
```

以及：

```text Remove GStreamer Backend
        ↓
Domain still compiles
Graph still compiles
Session still compiles
```

---

# 195. 产品级目标

最终用户看到的是：

```text
Hardware Device
Port
Capability
Signal
Session
Resource
Health
```

而不是：

```text
BMD
GStreamer
device-number
FFmpeg CLI
SRS API
Docker container
```

---

# 196. 最终判断

本阶段完成后，VBMF 的扩展方式应变成：

```text
增加硬件厂商
= 新 Provider

增加媒体后端
= 新 Backend

增加编码器
= 新 Encoder Backend

增加音频系统
= 新 Audio Provider/Backend

增加 GPU
= 新 Acceleration Provider

增加 Gateway
= 新 Gateway Adapter
```

而不是：

```text
修改整个 VBMF
```

---

# 197. 版本冻结建议

完成：

```text
Canonical Domain
Provider SPI
Backend SPI
Session Ownership
Resource Boundary
Binding Model
Error/Event
```

并通过：

```text
ARCH-PORTABILITY-01
ARCH-BACKEND-01
ARCH-RESOURCE-01
ARCH-AUDIO-01
```

后，将本阶段标记：

# `PHASE-0.6-RUNTIME-ABSTRACTION-FROZEN`

随后：

# `PHASE-0.7-NORMALIZE`

---

# 198. 开发原则总结

不要追求：

> 抽象最多。

而追求：

> **替换成本最低，同时不过度抽象。**

只针对真实替换轴建立 Contract。

---

# 199. 当前最高优先级

当前最重要的不是再增加更多 BMD 功能。

而是：

```text
Canonical Model
+
Provider Boundary
+
Backend Boundary
+
Session Ownership
+
Resource Boundary
```

这五件事。

---

# 200. 最终开发指令

请以本 PRD 为下一阶段实施基线。

实施时：

1. 不修改 V0.2 LOCK FINAL 核心语义。
2. 不重开 Phase 0.5。
3. 不更换现有技术栈。
4. 不删除现有 BMD/GStreamer 真实实现。
5. 使用 Strangler Pattern 渐进迁移。
6. 先冻结 Contract，再迁移实现。
7. 先建立 Mock Provider/Backend，再迁移 BMD/GStreamer。
8. Session 只冻结 ownership/lifecycle，不实现 Scheduler。
9. Resource 只冻结 capability/capacity/availability/reservation/allocation，不实现全局调度。
10. Audio/Clock/Timecode 先冻结 Contract。
11. 当前 BMD/GStreamer 作为 Reference Adapter。
12. 所有真实测试必须继续产生 HOST_SPECIFIC / PROVIDER Evidence。
13. 所有新增代码保持 vendor-neutral boundary。
14. 任何违反 Vendor Neutrality、Runtime Address、Fail Closed、Session Ownership、Resource Ownership 的代码，不得进入 master。
15. 完成本 PRD 后，先进行 Architecture Portability Gate，再进入 Normalize。

**最终判断标准只有一句话：**

> **未来换硬件、换媒体后端、换音频系统、换 GPU、换编码器、换 Gateway、换基础设施时，应该是在替换 Adapter，而不是重写 VBMF。**