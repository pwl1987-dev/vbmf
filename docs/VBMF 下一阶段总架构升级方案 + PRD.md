# VBMF 下一阶段总架构升级方案 + PRD
# Vendor-Neutral / Backend-Neutral / Infrastructure-Decoupled Architecture

> 📜 **状态：已执行 —— 条款已由 17 份冻结契约承接。本文不再是活的需求源。**
> **产品层唯一入口改看：** [`VBMF_PRODUCT_PRD.md`](./VBMF_PRODUCT_PRD.md)（V1.0 DRAFT，2026-11-27）。
> **处置**：原文保留作审计留痕，不删除、不改写条款。执行结果与当前差距见新 PRD §7；「接下来做什么」见新 PRD §8。
> **已知债**：本文件**无版本头、无日期、无状态声明**（201 条扁平 H1），且**未引用**同期的另两份 PRD —— 详见新 PRD §0.3 与 §7.5。

---

# 0. 任务等级

**优先级：P0 / Architecture Hardening**

**目标：**

在不推翻 V0.2、不中断当前 BMD + GStreamer 真机成果、不重新选择 Node/Rust/SRS 等已冻结技术栈的前提下，将当前实现从：

```text
BMD-specific Runtime
+
GStreamer-specific Runtime
```

升级为：

```text
Vendor-Neutral Canonical Media Domain
+
Hardware Provider SPI
+
Media Backend SPI
+
Encoder SPI
+
Gateway SPI
+
Infrastructure Adapter
```

最终达到：

> 更换 BMD → AJA / Deltacast / Magewell / 其他厂商，不修改 Graph Semantics、Control Plane、Supervisor、Health、Acceptance、UI Canonical Object Model。

以及：

> GStreamer → FFmpeg / Native Backend，不修改上层 Graph Intent 与业务语义。

以及：

> PostgreSQL / Valkey / RustFS / SRS / Docker / Nginx 发生替换，不污染 Domain Model。

---

# 1. 架构背景

当前 VBMF 已经完成：

- V0.2 Runtime Architecture LOCK FINAL；
- Phase 0.5 UX BASELINE LOCK FINAL；
- Rust Media Agent；
- GStreamer canonical ingest；
- DeviceHandle canonical identity；
- DeviceBindingManifest；
- Device / Port / Capability / Signal 模型；
- GStreamer Bus → Supervisor；
- PTS 三态；
- HW-IDENT-02 当前主机验证；
- MEDIA-RT-01 当前 BMD 真机验证。

V0.2 已明确：

- SDI 是 `RAW_VIDEO + RAW_AUDIO`；
- Graph Compiler 产出 Runtime Intent，而不是具体 GStreamer/FFmpeg 命令；
- Media Agent 拥有真实媒体 Runtime 生命周期；
- X6 Capability Registry 负责 Signal Contract / Player Capability Matrix；
- SRS 是 Gateway Adapter，而不是 Output Engine 全部职责；
- Video / Audio / Metadata 是三个独立 Graph；
- Clock Domain、Latency、AVSync、Failure Domain 是独立语义。  
这些边界必须继续保持。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

---

# 2. 本次架构原则

## 2.1 核心原则

```text
Vendor is implementation.
Backend is implementation.
Infrastructure is implementation.
Domain is not implementation.
```

中文：

> **厂商是实现，媒体框架是实现，基础设施是实现；业务语义不是实现。**

---

# 3. 必须解决的根本问题

当前已经出现了以下事实：

```text
BMD PersistentID 不一定存在
BMD DeviceHandle 才可能是稳定身份
GStreamer device-number 是 Runtime Address
GStreamer property 并不总是完整
不同设备的端口数量不同
同一物理设备可能被多个 Runtime device 表示
同一设备可能同时 INPUT / OUTPUT
不同媒体后端使用完全不同的寻址方式
```

因此：

```text
Device
Port
Capability
Identity
Runtime Address
Signal
Content
Backend
Provider
```

必须彻底解耦。

---

# 4. 最终逻辑架构

```text
                          ┌──────────────────────────┐
                          │       WEB / API          │
                          │ React + Fastify + Zod    │
                          └────────────┬─────────────┘
                                       │
                                Canonical Intent
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │      DOMAIN MODEL        │
                          │                          │
                          │ Device / Port / Source   │
                          │ Capability / Format      │
                          │ Signal / Clock / Error   │
                          │ Graph / Session          │
                          └────────────┬─────────────┘
                                       │
                                Runtime Contract
                                       │
                     ┌─────────────────┼─────────────────┐
                     │                 │                 │
                     ▼                 ▼                 ▼
              Hardware SPI       Media Backend SPI   Infra SPI
                     │                 │                 │
          ┌──────────┼──────────┐  ┌───┼────┐       ┌────┼────┐
          │          │          │  │   │    │       │    │    │
         BMD        AJA       Other Gst FFmpeg Native PG  Queue ObjectStore
          │          │          │                         │
       Vendor SDK  Vendor SDK  Vendor SDK               S3/...
```

---

# 5. 三层抽象模型

不要建立一个巨大 `HardwareHAL`。

必须分成三个可组合层。

---

## 5.1 Layer A：Canonical Domain

这一层绝不出现：

```text
BMD
AJA
DeckLink
GStreamer
FFmpeg
SRS
Postgres
Valkey
Docker
```

只允许：

```text
DeviceId
PortId
Source
Sink
Capability
Format
Signal
Clock
Timecode
Pipeline
Session
RuntimeEvent
RuntimeError
```

---

## 5.2 Layer B：Provider / Backend SPI

### Hardware Provider

负责：

```text
发现设备
发现端口
发现能力
打开输入
打开输出
读取信号
读取硬件时钟/Timecode
映射厂商错误
```

### Media Backend

负责：

```text
建立媒体 Pipeline
连接 Source / Sink
应用 Format
读取 Buffer
Bus/Event
状态管理
Runtime metrics
```

---

## 5.3 Layer C：Concrete Adapter

当前第一组实现：

```text
BlackmagicProvider
GStreamerBackend
```

未来：

```text
AjaProvider
DeltacastProvider
MagewellProvider
OtherProvider

FFmpegBackend
NativeBackend
OtherBackend
```

---

# 6. Hardware Provider Contract

定义：

```rust
pub trait MediaHardwareProvider: Send + Sync {
    fn provider_id(&self) -> ProviderId;
    fn provider_version(&self) -> ProviderVersion;

    fn discover_devices(
        &self,
    ) -> Result<Vec<ProviderDevice>, ProviderError>;

    fn discover_ports(
        &self,
        device: &ProviderDevice,
    ) -> Result<Vec<ProviderPort>, ProviderError>;

    fn discover_capabilities(
        &self,
        device: &ProviderDevice,
        port: &ProviderPort,
    ) -> Result<ProviderPortCapabilities, ProviderError>;

    fn open_input(
        &self,
        port: &ProviderPort,
        config: &CaptureConfig,
    ) -> Result<ProviderInputSession, ProviderError>;

    fn open_output(
        &self,
        port: &ProviderPort,
        config: &OutputConfig,
    ) -> Result<ProviderOutputSession, ProviderError>;
}
```

---

# 7. Provider 永远不能向 Domain 返回厂商类型

错误：

```rust
fn discover_devices() -> Vec<IDeckLink>;
```

禁止。

正确：

```rust
fn discover_devices() -> Vec<ProviderDevice>;
```

Provider 内部：

```text
BMD SDK object
       ↓
BlackmagicProvider
       ↓
ProviderDevice
       ↓
Canonical Device
```

---

# 8. ProviderDevice

建议：

```rust
pub struct ProviderDevice {
    pub provider_id: ProviderId,

    pub provider_device_ref: String,

    pub identity: ProviderIdentity,

    pub capabilities: DeviceCapabilities,

    pub ports: Vec<ProviderPort>,
}
```

其中：

```text
provider_device_ref
```

必须是：

> opaque identifier

Domain 不解析。

---

# 9. Provider Port

```rust
pub struct ProviderPort {
    pub provider_port_ref: String,

    pub connector: ConnectorType,

    pub direction: PortDirection,

    pub ordinal: Option<u32>,

    pub capabilities: PortCapabilities,
}
```

支持：

```text
INPUT
OUTPUT
BIDIRECTIONAL
UNKNOWN
```

---

# 10. Canonical Device Model

```rust
pub struct CanonicalDevice {
    pub device_id: DeviceId,

    pub provider: ProviderRef,

    pub identity: DeviceIdentity,

    pub capabilities: DeviceCapabilities,

    pub ports: Vec<CanonicalPort>,
}
```

---

# 11. Canonical Identity

不要使用：

```text
serial
device-number
PCI slot
enumeration index
```

作为绝对 canonical identity。

优先级：

```text
Stable Vendor Identity
    ↓
Provider Stable Identity
    ↓
Provisioned Identity
    ↓
Stable Derived Identity
    ↓
Unresolved
```

必须把“身份强度”记录出来。

```rust
enum IdentityStrength {
    HardwareStable,
    ProviderStable,
    ProvisionedStable,
    DerivedStable,
    SessionOnly,
    Unknown,
}
```

---

# 12. DeviceId 必须独立于 Provider

例如：

```text
BMD:
provider_ref = 46:...

AJA:
provider_ref = AJA-123

Deltacast:
provider_ref = ...
```

最终：

```text
device_id = canonical UUID
```

Domain 永远只使用：

```text
device_id
```

---

# 13. Port Identity

```rust
pub struct PortId(Uuid);
```

生成逻辑：

```text
DeviceId
+
stable provider port identity
```

优先：

```text
provider_port_ref
```

如果仅有：

```text connector + ordinal
```

且 ordinal 稳定，也可以派生。

如果 ordinal 不稳定/未知：

> 不得生成假稳定 PortId。

---

# 14. PortOrdinal

禁止：

```rust
ordinal: u32 // 0 = unknown
```

必须：

```rust
enum PortOrdinal {
    Known(u32),
    Unknown,
}
```

或者：

```rust
ordinal: Option<u32>
```

---

# 15. Capability 模型

统一：

```rust
enum CapabilityValue<T> {
    Supported(T),
    Unsupported,
    Unknown,
    ProbeFailed,
}
```

不要用：

```text
0
false
null
```

混合表示不同语义。

---

# 16. Direction

```rust
enum PortDirection {
    Input,
    Output,
    Bidirectional,
    Unknown,
}
```

来源优先级：

```text
Hardware capability
    >
Provisioned declaration
    >
Unknown
```

禁止：

```text signal=true → Input
signal=false → Output
binding_ok → Input
device-number → Input
```

---

# 17. Connector

```rust
enum ConnectorType {
    SDI,
    HDMI,
    DisplayPort,
    Optical,
    Analog,
    IP,
    Unknown,
}
```

禁止：

```text
SDI1
SDI2
```

成为类型。

---

# 18. Signal 模型

Signal 与 Capability 必须独立。

```rust
enum SignalState {
    Unknown,
    NoSignal,
    Detected,
    Locked,
    Unstable,
    Unsupported,
    ProbeFailed,
}
```

---

# 19. Content 模型

```rust
enum VideoContentState {
    Unknown,
    Black,
    Active,
    Frozen,
    TestPattern,
}
```

明确：

```text
NoSignal ≠ Black
Black ≠ Frozen
Signal ≠ ActiveContent
```

---

# 20. Format Model

禁止向上层传：

```text BMD mode enum
GStreamer Caps string
FFmpeg AVPixelFormat
```

统一：

```rust
struct VideoFormat {
    width: u32,
    height: u32,
    frame_rate: Rational,
    interlaced: bool,
    pixel_format: PixelFormat,
    colorimetry: Colorimetry,
    bit_depth: BitDepth,
    range: VideoRange,
}
```

音频：

```rust
struct AudioFormat {
    sample_rate: u32,
    channels: u32,
    sample_format: AudioSampleFormat,
    layout: ChannelLayout,
}
```

---

# 21. Timecode 抽象

增加：

```rust
enum TimecodeSource {
    Embedded,
    External,
    PtpDerived,
    Generated,
    None,
    Unknown,
}
```

上层绝不认识：

```text BMDTimecodeFormat
RP188 SDK enum
GStreamer timecode meta
```

---

# 22. Clock 抽象

V0.2 已明确 PTP / Genlock 抽象。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

定义：

```rust
struct ClockDomainId(Uuid);

enum ClockSource {
    Hardware,
    System,
    Ptp,
    Genlock,
    Generated,
    Unknown,
}
```

以及：

```rust
struct ClockQuality {
    locked: bool,
    offset_ns: Option<i64>,
    drift_ppm: Option<f64>,
}
```

---

# 23. Media Backend SPI

定义：

```rust
pub trait MediaBackend: Send + Sync {
    fn backend_id(&self) -> BackendId;

    fn capabilities(&self) -> BackendCapabilities;

    fn create_pipeline(
        &self,
        plan: &CanonicalPipelinePlan,
    ) -> Result<BackendPipeline, BackendError>;
}
```

---

# 24. GStreamer 必须下沉

当前：

```text
gst::Pipeline
gst::Element
gst::Bus
decklinkvideosrc
appsink
```

全部归：

```text
backends/gstreamer/
```

业务层不得直接引用。

---

# 25. GStreamer Backend

内部才允许：

```text
decklinkvideosrc
decklinkaudiosrc
decklinkvideosink
device-number
persistent-id
hw-serial-number
caps
GstPipeline
GstBus
GstClock
GstBuffer
```

---

# 26. FFmpeg Backend

业务层不能出现：

```text
ffmpeg CLI
-filter_complex
-map
-c:v
-c:a
hevc_nvenc
libx264
```

定义：

```rust
trait EncoderBackend {
    fn capabilities(&self) -> EncoderCapabilities;

    fn prepare(
        &self,
        request: EncoderRequest,
    ) -> Result<EncoderPlan, EncoderError>;
}
```

FFmpeg 实现放：

```text
backends/ffmpeg/
```

---

# 27. Hardware Provider 与 Media Backend 必须二维组合

禁止：

```text
BmdGstreamerProvider
AjaGstreamerProvider
BmdFfmpegProvider
```

这种组合爆炸。

正确：

```text
Hardware Provider
    ×
Media Backend
```

例如：

```text
BMD + GStreamer
AJA + GStreamer
BMD + FFmpeg
AJA + FFmpeg
```

各自独立。

---

# 28. Runtime Binding Model

重新定义：

```text
Physical Resource
        ↓
Provider Resource
        ↓
Runtime Backend Resource
```

即：

```text
Canonical Device/Port
        ↓
Provider Port Ref
        ↓
GStreamer device-number
```

或：

```text
Canonical Device/Port
        ↓
Provider Port Ref
        ↓
FFmpeg input URL / hwaccel resource
```

Runtime address 永远不是 identity。

---

# 29. RuntimeBinding

```rust
pub struct RuntimeBinding {
    pub device_id: DeviceId,
    pub port_id: PortId,

    pub provider: ProviderRef,

    pub backend: BackendRef,

    pub resource_ref: String,

    pub verified_at: DateTime<Utc>,

    pub verification_level: VerificationLevel,
}
```

---

# 30. VerificationLevel

```rust
enum VerificationLevel {
    Declared,
    CapabilityVerified,
    RuntimeOpened,
    SignalVerified,
    LoopbackVerified,
}
```

不要所有状态都叫：

```text ManifestVerified
```

---

# 31. Binding Manifest 更名

当前 `DeviceBindingManifest` 逐渐承载：

> Device + Port + Provider + Runtime。

建议最终改名：

# `RuntimeBindingManifest`

旧 v1 保留兼容。

---

# 32. RuntimeBindingManifest v2

```yaml
manifest_version: "2"

machine:
  id: "..."

devices:

  - device_id: "..."

    provider:
      id: "blackmagic"
      device_ref: "opaque-provider-ref"

    identity:
      strength: "HardwareStable"

    ports:

      - port_id: "..."

        connector: SDI
        direction: INPUT
        ordinal: 1

        provider:
          port_ref: "opaque"

        runtime:
          backend: gstreamer
          resource_ref: "opaque-runtime-resource"

        expected:
          model: null
          serial: null
          profile: null
          connection: sdi
```

---

# 33. GraphRuntimeIntent

必须保持 Vendor-neutral：

```json
{
  "source": {
    "device_id": "...",
    "port_id": "..."
  }
}
```

禁止：

```json
{
  "device_number": 1,
  "persistent_id": 123,
  "connection": "sdi"
}
```

---

# 34. Capability Negotiation

Graph Compiler/X6 最终应该问：

```text
这个 Port 能提供什么？
```

而不是：

```text
这是 BMD 还是 AJA？
```

例如：

```text
RAW_VIDEO
1920x1080
50fps
interlaced
8bit/10bit
SDI
audio 48kHz
```

再由：

```text
Capability Registry
```

选择可行 Runtime。

V0.2 已经把 X6 Capability Registry 定义为 Signal Contract / Player Capability Matrix，这是该抽象的正式落点。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

---

# 35. Simulator 必须升级

当前 Simulation 不应该模拟：

```text BMD
```

而应该模拟：

```text CanonicalMediaHardwareProvider
```

提供：

```text 1 input
2 input
4 input
8 input
input-only
output-only
mixed
unknown direction
signal loss
black
active
frozen
busy
device removed
device replaced
mapping changed
```

---

# 36. Provider Contract Test

为所有 Provider 建统一 Contract Test：

```text discover devices
discover ports
discover capability
identity
open input
open output
signal probe
format probe
errors
recovery
```

以后：

```text BMD Provider
AJA Provider
Mock Provider
```

都必须通过同一套测试。

---

# 37. Backend Contract Test

统一：

```text create pipeline
start
stop
recover
first frame
PTS
bus event
error
resource release
```

GStreamer 是第一实现。

---

# 38. Acceptance 也必须 Vendor-neutral

错误：

```text MEDIA-RT-01 = decklinkvideosrc first buffer
```

正确：

```text MEDIA-RT-01 =
Canonical INPUT Port
→ backend capture
→ RAW_VIDEO / RAW_AUDIO
→ first buffer
→ PTS validity
→ stability
```

当前 BMD + GStreamer 只是第一套 Acceptance Fixture。

---

# 39. FI-08 也 Vendor-neutral

错误：

```text kill GStreamer
```

作为唯一语义。

正确：

```text Media Backend Failure
```

当前 GStreamer 实现可以：

```text GStreamer process/pipeline failure
```

但 Acceptance 语义应该是：

```text Runtime Media Backend failure
→ detection
→ restart
→ source session recovered
→ downstream recovered
```

这样以后 FFmpeg Backend 也能做同一个 Gate。

---

# 40. Supervisor 不得了解厂商错误码

禁止：

```rust
if hr == 0x80000009
```

Supervisor 只认识：

```rust
RuntimeError::Busy
RuntimeError::DeviceRemoved
RuntimeError::SignalLost
RuntimeError::BackendFailure
RuntimeError::ClockLost
RuntimeError::IoFailure
```

Provider 负责：

```text VendorError
→ Canonical RuntimeError
```

---

# 41. Output 同样走 Provider + Backend

Output 不是：

```text BMD output
```

而是：

```text Canonical Output Port
        ↓
Provider
        ↓
Backend
        ↓
Runtime Output
```

---

# 42. SDI Output Loopback

当前真实 Fixture：

```text
Output-capable Port
    ↓
SDI cable
    ↓
Input-capable Port
```

定义为：

# `BMD-SDI-LOOPBACK-01`

但 Fixture 本身必须 Vendor-neutral：

```yaml
fixture_id: SDI-LOOPBACK-01

source:
  device_id: "..."
  port_id: "..."

sink:
  device_id: "..."
  port_id: "..."

transport:
  type: SDI
```

---

# 43. Fixture 绝对禁止 `.first()`

正式 Fixture：

```text
source PortRef
sink PortRef
```

必须精确匹配。

禁止：

```text
first input
first output
first locked
device-number=0
```

---

# 44. Stream Gateway 抽象

虽然 V0.2 已锁定 SRS，SRS 仍然是 Gateway Adapter，而不是整个 Output Engine。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

定义：

```rust
trait StreamGateway {
    fn capabilities(&self) -> GatewayCapabilities;

    fn publish(
        &self,
        stream: &ProgramStream,
        endpoint: &Endpoint,
    ) -> Result<PublishHandle, GatewayError>;
}
```

---

# 45. SRS 作为 Adapter

```text
adapters/gateway/srs/
```

业务层不出现：

```text SRS API
SRS-specific URL
SRS-specific state
```

只出现：

```text StreamEndpoint
PublishState
StreamHealth
```

---

# 46. Storage 抽象

定义：

```rust
trait ObjectStore {
    put(...)
    get(...)
    delete(...)
    presign(...)
}
```

当前：

```text RustFS / S3 compatible
```

以后可以：

```text S3
Ceph
MinIO if ever required
```

而不改 Asset Domain。

---

# 47. Database 抽象

Domain：

```text Repository
```

Adapter：

```text PostgreSQL / Drizzle
```

不要让 Domain 使用 SQL。

---

# 48. Queue 抽象

定义：

```rust / TypeScript
JobQueue
```

实现：

```text BullMQ + Valkey
```

不要让业务直接依赖 BullMQ job payload。

---

# 49. Cache/Lock 抽象

当前：

```text Valkey
```

定义：

```text DistributedLock
Cache
SessionStore
RateLimiter
```

这样未来可以替换 Redis-compatible backend。

---

# 50. Authentication/Authorization 抽象

当前：

```text Better Auth
CASL
```

业务只理解：

```text User
Role
Permission
Capability
Action
```

Security provider 在外层。

---

# 51. GPU/Acceleration Provider

这是必须提前设计、但不要现在实现的大项。

未来支持：

```text NVIDIA
AMD
Intel
CPU only
```

定义：

```rust
trait AccelerationProvider {
    fn capabilities(...) -> AccelerationCapabilities;
}
```

包括：

```text decode
encode
memory interop
scaling
colorspace conversion
```

不要把：

```text CUDA
NVDEC
NVENC
ROCm
VAAPI
QSV
```

暴露到 Domain。

---

# 52. OS/Deployment 也必须隔离

当前 Docker/runc + BMD device passthrough 继续保持。

但是 Domain 不允许出现：

```text Docker
runc
container id
bind mount
device cgroup
```

Deployment Adapter 负责：

```text Docker
Podman
systemd
Kubernetes
Bare Metal
```

---

# 53. Nginx 作为 Edge Adapter

业务层不认识：

```text nginx.conf
proxy_pass
location
```

业务只认识：

```text HTTP
WebSocket
SSE
TLS
```

---

# 54. Node/Rust 边界保持不变

保持：

```text Fastify:
  API
  Auth
  Graph Compile
  Preflight
  Configuration
  Orchestration

Rust:
  Hardware
  Media Runtime
  GStreamer
  Live FFmpeg
  Clock
  Runtime Health
  Supervisor
```

当前 Runtime Ownership Contract 已明确 Fastify 不直接持有 DeckLink、不直接监督 Live FFmpeg，GStreamer 生命周期由 Media Agent 持有。([TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md))

---

# 55. Recording 必须继续双平面

保持：

```text Live Recording
→ Rust Media Agent

Post-processing
→ Node Worker / BullMQ
```

Runtime Artifact → Async Job 必须走正式事件契约，不允许目录轮询。([TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md))

---

# 56. Clock / Timecode / Latency 统一纳入 Canonical Model

最终：

```text Capture Timestamp
Decode Timestamp
Normalize Timestamp
Switch Timestamp
Compose Timestamp
Encode Timestamp
Publish Timestamp
```

不允许上层携带：

```text GstClockTime
AVRational
BMDTimecode
FFmpeg AVFrame timestamp type
```

---

# 57. Error Boundary

统一：

```rust
enum RuntimeError {
    DeviceUnavailable,
    PortUnavailable,
    IdentityMismatch,
    BindingMismatch,
    CapabilityUnsupported,
    SignalLost,
    FormatMismatch,
    BackendFailure,
    EncoderFailure,
    GatewayFailure,
    ClockFailure,
    LeaseConflict,
}
```

每个 Provider/Backend 映射到这里。

---

# 58. Configuration Boundary

业务配置：

```text Channel
Source
Port
Format
SwitchMode
HotStandby
Output
```

Provider-specific 配置：

```text provider_options
```

Backend-specific 配置：

```text backend_options
```

必须：

```text schema opaque
```

但必须由对应 Adapter 自行 validate。

---

# 59. 不要把所有配置都放进一个 JSON

推荐：

```text Domain Configuration
Provider Configuration
Backend Configuration
Deployment Configuration
```

分层。

---

# 60. UI Object Model 升级

Phase 0.5 不重开。

现有 15 个 Canonical Product Objects 保持不变。([OBJECT_VOCABULARY.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/phase-0.5/OBJECT_VOCABULARY.md))

增加 Engineering Runtime object：

```text Hardware Device
Hardware Port
Capability
Runtime Binding
Signal State
```

这些属于：

> Runtime/Engineering view

不是替代现有 Product Object。

---

# 61. UI Provider-neutral

主界面显示：

```text Device
Port
Direction
Capability
Signal
Format
Binding
Health
```

而不是：

```text BMD
DeckLink
device-number
GStreamer
```

Provider 信息只出现在：

# Engineering → Diagnostics

---

# 62. Hardware 页面

建议：

```text
ENGINEERING
 └── Hardware
      ├── Devices
      ├── Ports
      ├── Bindings
      ├── Signal
      └── Diagnostics
```

---

# 63. Device 页面

显示：

```text
Device Name
Provider
Identity
Identity Strength
Capability Summary
Port Count
Runtime Health
```

---

# 64. Port 页面

显示：

```text
Port
Device
Connector
Direction
Capability
Binding
Signal
Format
Content
```

---

# 65. UI 必须分开 4 个状态

绝对不要一个大 Status。

分别：

```text
Capability
Binding
Signal
Content
```

例：

```text
Capability
✓ INPUT

Binding
✓ VERIFIED

Signal
✓ LOCKED

Content
● BLACK
```

---

# 66. UI Explain Why

例如：

```text
Binding: VERIFIED

Why:
✓ Device identity matched
✓ Port identity matched
✓ Provider resource matched
✓ Backend resource matched
✓ Manifest revision matched
✓ Verification succeeded
```

---

# 67. UI “重验证”动作

允许：

```text
Re-verify Binding
```

但：

```text
Re-verify
≠
Modify Manifest
```

修改必须：

```text Edit
→ Validate
→ Diff
→ Impact Preview
→ Confirm
→ Apply
→ Audit
```

符合 Phase 0.5 的 Change Set / Explain Why / Configuration Versioning 原则。

---

# 68. Graph Designer

Graph Designer 不允许选择：

```text GStreamer device-number
BMD PersistentID
PCI slot
```

应该选择：

```text Physical Source
→ Device
→ Port
```

后台再：

```text Port
→ Runtime Binding
→ Backend resource
```

---

# 69. Provider Capability Matrix

X6 最终显示：

```text
Source
Capability
Provider-independent canonical capabilities
```

例如：

```text
SDI Input
RAW_VIDEO
1920x1080
50fps
10-bit
Audio 48kHz
```

然后附：

```text Provider = Blackmagic
```

作为实现信息，而非语义。

---

# 70. Acceptance Model

Acceptance 分三层：

```text Generic Contract Acceptance
Provider Acceptance
Deployment Acceptance
```

例如：

```text MEDIA-RT-01
Generic

BMD-MEDIA-RT-01
BMD implementation evidence

HOST-10.30.15.10
Deployment evidence
```

---

# 71. Evidence Scope

统一：

```yaml
scope:
  GENERIC
  PROVIDER
  HOST_SPECIFIC
```

以及：

```yaml
status:
  HISTORICAL
  CURRENT
  ACCEPTANCE
  SUPERSEDED
```

---

# 72. 当前 BMD evidence 改造

所有：

```text
BMD specific facts
```

必须标：

```text PROVIDER + HOST_SPECIFIC
```

当前机器：

```text 端口数量
device-number mapping
Desktop Video version
GStreamer version
```

全部不能进入 Generic Architecture Evidence。

---

# 73. Hardware Discovery Snapshot

标准输出：

```json
{
  "provider": "blackmagic",
  "host": "...",
  "timestamp": "...",
  "devices": [
    {
      "device_id": "...",
      "provider_ref": "...",
      "capabilities": {},
      "ports": []
    }
  ]
}
```

---

# 74. Binding Snapshot

标准输出：

```json
{
  "device_id": "...",
  "port_id": "...",
  "provider": "blackmagic",
  "backend": "gstreamer",
  "resource_ref": "...",
  "verification_level": "SignalVerified"
}
```

---

# 75. Signal Snapshot

标准输出：

```json
{
  "port_id": "...",
  "signal": {
    "state": "LOCKED",
    "format": {},
    "audio": {},
    "content": "BLACK"
  }
}
```

---

# 76. Architecture Portability Tests

必须增加：

# `ARCH-PORTABILITY-01`

证明：

```text Mock Provider A
Mock Provider B
```

都可以驱动：

```text same Domain Model
same GraphRuntimeIntent
same Supervisor
same Health
same Acceptance
```

---

# 77. Backend Portability Test

增加：

# `BACKEND-PORTABILITY-01`

证明：

```text GStreamer Backend
Mock Backend
```

共享同一个：

```text CanonicalPipelinePlan
```

---

# 78. Provider Replacement Scenario

测试：

```text
Provider A
Device A
Port A1
```

替换成：

```text
Provider B
Device B
Port B1
```

要求：

```text Graph unchanged
UI semantic unchanged
Supervisor unchanged
Acceptance unchanged
```

只有：

```text Discovery
Binding
```

发生变化。

---

# 79. Hardware Replacement Scenario

测试：

```text
2-port device
```

换成：

```text
8-port device
```

要求：

> 无任何业务代码改动。

---

# 80. Runtime Address Change Scenario

测试：

```text
Port X
runtime resource #1
```

变为：

```text
Port X
runtime resource #3
```

要求：

```text PortId unchanged
DeviceId unchanged
GraphRuntimeIntent unchanged
```

只更新 RuntimeBinding。

---

# 81. Provider Failure Scenario

模拟：

```text Provider available
Device missing
```

必须：

```text DeviceUnavailable
```

不能：

```text create fallback device
```

---

# 82. Binding Failure Scenario

模拟：

```text Provider identity = A
Manifest identity = B
```

结果：

```text FAIL CLOSED
```

---

# 83. Port Direction Failure

```text Manifest = INPUT
Hardware = OUTPUT
```

结果：

```text REJECT
```

---

# 84. Connector Failure

```text Manifest = SDI
Hardware = HDMI
```

结果：

```text REJECT
```

---

# 85. Backend Failure

```text GStreamer backend unavailable
```

不应该：

```text 修改 Graph
```

而应该：

```text BackendUnavailable
```

如果允许替代 backend，由 Capability Negotiation 决定。

---

# 86. 不允许“偷偷自动换 Backend”

例如：

```text GStreamer failed
→ 自动改 FFmpeg
```

禁止，除非 Graph/Runtime Policy 明确声明：

```text backend_fallback_policy
```

并由 Preflight/Capability Registry 判定兼容性。

---

# 87. Capability Negotiation 结果必须可解释

例如：

```text Requested:
1080i50 + RAW_AUDIO + SDI

Selected:
Provider=AJA
Backend=GStreamer

Reason:
✓ Input
✓ SDI
✓ 1080i50
✓ Audio 48kHz
✓ Hardware acceleration
```

---

# 88. 未来的主备也必须跨厂商可用

目标：

```text
Primary
BMD Input

Backup
AJA Input
```

两边：

```text Normalize
→ common RAW contract
→ MASTER_SWITCH
```

V0.2 已规定 COMMON_RAW_CONTRACT 的来源是 X6 Capability Registry，并要求继续进行 clock/timebase compatibility 检查，不允许猜。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

---

# 89. 这样 PACKET/FRAME/MASTER 才能真正跨厂商

例如：

```text BMD + GStreamer
```

与：

```text AJA + GStreamer
```

只要：

```text Common Raw Contract
+
Runtime Alignment
```

成立，就能进入：

```text FRAME_SWITCH
```

而不是因为 Provider 不同就天然不能切。

---

# 90. Encoder 也必须可替换

目标：

```text x264
x265
NVENC
VAAPI
QSV
AMF
```

都只是：

```text EncoderBackend
```

业务只要求：

```text H264
H265
bitrate
fps
profile
level
```

---

# 91. Gateway 也必须可替换

当前：

```text SRS
```

继续作为第一实现。

未来：

```text Other Gateway
```

不应该要求 Graph 改语义。

---

# 92. Storage/Queue/DB 同样解耦

领域层只看到：

```text Repository
JobQueue
ObjectStore
Cache
Lock
```

具体实现：

```text PostgreSQL
Valkey
RustFS
BullMQ
```

由 infrastructure adapter 实现。

---

# 93. 需要新增一份 SoT

新建：

# `docs/architecture/PORTABILITY_AND_ADAPTER_MODEL.md`

职责：

```text
Hardware Provider
Media Backend
Encoder Backend
Gateway Adapter
Infrastructure Adapter
Deployment Adapter
```

不修改 V0.2 Core Semantics。

---

# 94. 新建技术替换矩阵

新建：

# `docs/architecture/TECHNOLOGY_PORTABILITY_MATRIX.md`

内容：

| 替换轴 | 当前实现 | 是否必须解耦 | 当前阶段 |
|---|---|---:|---|
| Hardware Vendor | BMD | 是 | P0 |
| Capture SDK | BMD SDK | 是 | P0 |
| Media Backend | GStreamer | 是 | P0 |
| Encoder | FFmpeg | 是 | P1 |
| Gateway | SRS | 是 | P1 |
| GPU | NVIDIA/CPU | 是 | P1 |
| Clock | GStreamer/BMD/PTP | 是 | P1 |
| Timecode | Embedded/External | 是 | P1 |
| Storage | RustFS | 是 | P2 |
| Queue | Valkey/BullMQ | 是 | P2 |
| Database | PostgreSQL | 是 | P2 |
| Deployment | Docker/runc | 是 | P2 |
| Edge | Nginx | 是 | P2 |
| Auth | Better Auth | 是 | P2 |

---

# 95. 新建 Vendor Neutrality Contract

新建：

# `docs/architecture/VENDOR_NEUTRALITY_RULES.md`

硬规则：

## Domain 禁止：

```text
BMD SDK type
AJA SDK type
GStreamer type
FFmpeg type
SRS-specific type
PostgreSQL-specific type
BullMQ-specific type
Docker-specific type
```

## Domain 允许：

```text Canonical IDs
Canonical Format
Canonical Signal
Canonical Clock
Canonical Error
Canonical Capability
Canonical Runtime State
```

---

# 96. 建立代码目录边界

目标：

```text
services/media-agent/src/

domain/
    device.rs
    port.rs
    capability.rs
    media.rs
    signal.rs
    clock.rs
    timecode.rs
    error.rs

hardware/
    provider.rs
    registry.rs

providers/
    blackmagic/
        ffi.rs
        discovery.rs
        input.rs
        output.rs
        errors.rs

backends/
    gstreamer/
        pipeline.rs
        bus.rs
        input.rs
        output.rs

    ffmpeg/
        encoder.rs

runtime/
    session.rs
    supervisor.rs
    health.rs
    lease.rs

binding/
    manifest.rs
    resolver.rs
    verifier.rs

acceptance/
    ...
```

不要求一次性机械移动全部文件。

---

# 97. 迁移策略

必须采用：

# Strangler Migration

先：

```text Existing BMD implementation
        ↓
BmdProvider
        ↓
Canonical Model
```

再：

```text Existing GStreamer pipeline
        ↓
GStreamerBackend
```

最后：

```text Existing main.rs
        ↓
Runtime Coordinator
```

不能一次性重写整个 Media Agent。

---

# 98. 当前代码迁移原则

现有：

```text decklink.rs
resolver.rs
pipeline.rs
```

不要删除。

先改为：

```text Provider implementation
Backend implementation
Binding implementation
```

等新 Contract 全部通过测试后，再清理兼容层。

---

# 99. 不修改 V0.2 的条件

只允许新增：

```text Implementation Addendum
Provider SPI
Backend SPI
Portability Model
```

如果不改变：

```text Graph semantics
Data Plane semantics
Switch decision tree
Health semantics
Failure domain semantics
Runtime ownership
```

就不允许重新打开 V0.2。

---

# 100. 必须保持 V0.2 的内容

不能改变：

```text
12 Engines
5 Horizontal Systems
6 Cross-cutting Capabilities
3 independent graphs
PACKET / FRAME / MASTER
COLD / WARM / HOT
Health Tree
Capability Registry
Clock abstraction
Latency
SRS canonical gateway
Rust Media Agent ownership
```

这些仍然是 Architecture SoT。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

---

# 101. Phase 0.5 处理方式

Phase 0.5：

# 不重开。

只做：

```text Engineering Hardware
Engineering Port
Runtime Binding
Signal
Diagnostics
```

的 additive refinement。

当前 56 surfaces 仍是 Surface Registry SoT。([README](https://github.com/pwl1987/VBMF)；[SURFACE_REGISTRY.yaml](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/phase-0.5/SURFACE_REGISTRY.yaml))

---

# 102. UI Prototype 增量范围

必须补：

```text E-HW-01 Hardware Overview
E-HW-02 Device Detail
E-HW-03 Port Detail
E-HW-04 Runtime Binding
E-HW-05 Signal Diagnostics
```

如果现有 Surface Registry 不允许直接增加数量，则：

> 将这些作为已有 Engineering surface 的子视图/Tab/Drawer，不擅自扩展 top-level surface count。

---

# 103. UI Hardware Overview

显示：

```text Provider
Device
Identity Strength
Input Count
Output Count
Health
```

---

# 104. UI Port Detail

显示：

```text Device
Port
Connector
Direction
Capability
Runtime Binding
Signal
Format
Content
Verification Level
```

---

# 105. UI Diagnostics

显示厂商信息：

```text Provider
Provider Version
Vendor SDK
Driver
Backend
Runtime Resource
Raw Error
```

并明确：

> Diagnostics 信息 != Product Object。

---

# 106. UI 不允许直接编辑 Runtime Resource

例如：

```text GStreamer #1
```

只能：

> 查看。

修改必须：

```text Physical Port
→ Rebind
→ Verify
→ Apply
```

---

# 107. UI “换卡”流程

```text Detect new device
        ↓
Show New Hardware
        ↓
Inspect ports
        ↓
Select intended port
        ↓
Capability verification
        ↓
Binding proposal
        ↓
Diff
        ↓
Apply
```

不能：

```text new card detected
→ automatically replace current primary source
```

---

# 108. UI “失去设备”流程

必须：

```text Device Removed
→ Binding Stale
→ Source Degraded
→ Show Impact
```

不能：

```text Device Removed
→ silently select next device
```

除非编译后的 Failover Policy 明确允许。

---

# 109. Runtime Binding 状态

建议：

```text
DISCOVERED
DECLARED
VERIFYING
VERIFIED
STALE
CONFLICT
FAILED
```

---

# 110. Capability 状态

建议：

```text
SUPPORTED
UNSUPPORTED
UNKNOWN
PROBE_FAILED
```

---

# 111. Signal 状态

建议：

```text
NO_SIGNAL
DETECTED
LOCKED
UNSTABLE
PROBE_FAILED
UNKNOWN
```

---

# 112. Content 状态

建议：

```text
BLACK
ACTIVE
FROZEN
TEST_PATTERN
UNKNOWN
```

---

# 113. 这些状态禁止混用

例如：

```text Binding FAILED
```

不能显示为：

```text Device FAILED
```

因为：

```text Device Healthy
Port Healthy
Binding Failed
```

完全可能同时成立。

---

# 114. Health Tree 关系

V0.2 的 Health Tree 仍是：

```text Channel
  ↓
Subsystem
  ↓
Node
```

Media Agent 提供：

```text Node Runtime Health
```

Fastify 负责：

```text Channel/SubSystem aggregation
```

不能让 Hardware Provider 自己改变 Channel Health。

---

# 115. Runtime State Reducer

最终建议：

```text RuntimeEvent
    ├── DeviceEvent
    ├── PortEvent
    ├── SignalEvent
    ├── BusEvent
    ├── FrameEvent
    ├── LeaseEvent
    └── BackendEvent
          ↓
 Health Reducer
          ↓
 PipelineHealth
          ↓
 Supervisor
```

不要继续让：

```text Bus
appsink
Lease
Signal
```

分别成为独立“真相源”。

---

# 116. Event 模型

```rust
enum RuntimeEvent {
    DeviceChanged(...),
    PortChanged(...),
    SignalChanged(...),
    PipelineStateChanged(...),
    FrameObserved(...),
    BackendError(...),
    ClockChanged(...),
    LeaseChanged(...),
}
```

---

# 117. Runtime Event 必须携带 Scope

例如：

```rust
struct RuntimeEventMeta {
    device_id: Option<DeviceId>,
    port_id: Option<PortId>,
    pipeline_id: Option<PipelineId>,
    timestamp: MonotonicTimestamp,
}
```

避免：

```text Error("xxx")
```

这种无上下文事件。

---

# 118. Bus Overflow

继续保留：

```text bounded channel
dropped counter
sticky fatal
```

但是最终：

```text dropped critical event
→ health degraded
```

必须进入 Health Reducer。

---

# 119. Port Discovery 与 Runtime Probe 分离

严格：

```text Discovery
= “有什么”

Binding
= “应该映射到哪里”

Runtime Probe
= “现在是否工作”

Signal
= “现在有没有信号”

Content
= “信号内容是什么”
```

---

# 120. 不要在 Discovery 阶段打开完整媒体 pipeline

Discovery 尽量：

```text metadata/capability
```

Runtime Probe 才：

```text open
```

Signal Probe 才：

```text running/observed
```

减少抢设备。

---

# 121. SDI Loopback 的用途

当前 loopback 定义成：

```text Hardware Fixture
```

可以用于：

```text HW-PORT-01D
MEDIA-RT-01
Output Acceptance
Future Switch Acceptance
Future Encode Acceptance
Future FI
```

但不作为 Domain Model。

---

# 122. 当前 BMD Provider 的第一版验收

至少验证：

```text device identity
port enumeration
input/output capability
port mapping
runtime binding
signal
format
audio
```

---

# 123. Provider 的多厂商可替换验收

不用一开始真的买 AJA。

使用：

```text MockProviderA
MockProviderB
```

验证：

> 同一个 Domain 不关心 provider。

以后真正加入 AJA 时：

> 只是增加 Provider Adapter。

---

# 124. Backend 的多后端可替换验收

不用一开始真的实现 FFmpeg backend。

先：

```text GStreamerBackend
MockMediaBackend
```

证明：

```text CanonicalPipelinePlan
```

不包含：

```text gst::
```

---

# 125. Capability Contract

定义：

```text MediaSourceCapability
MediaSinkCapability
EncoderCapability
GatewayCapability
```

允许组合：

```text source capability
∩
normalize capability
∩
switch capability
∩
encode capability
∩
gateway capability
```

最后形成：

```text Feasible Runtime Plan
```

---

# 126. Preflight

Graph Compiler 不能等运行时才发现：

> 这个厂商设备/后端不支持。

X2 Preflight 应在：

```text Apply
```

之前检查：

```text Hardware capability
Backend capability
Format compatibility
Clock compatibility
Resource budget
```

V0.2 已将 X2 Preflight 锁为变更前静态检查。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

---

# 127. Resource Model

未来必须避免：

```text “支持 1080p”
```

这种过于粗糙的 Capability。

加入：

```text CPU cost
GPU cost
DMA
Memory bandwidth
PCIe bandwidth
Device sessions
Encoder sessions
```

否则换卡/换 GPU 后，Graph 可能“能力上支持，资源上跑不动”。

---

# 128. Resource Vector

与 V0.2 Resource Vector 对齐：

```text
CPU
GPU
MEMORY
PCIe
I/O
DEVICE_SESSION
NETWORK
STORAGE
```

Capability 与 Resource 必须分开。

---

# 129. 这一点是当前设计一个更深的缺口

需要区分：

```text Capability
“能不能”

Capacity
“最多多少”

Availability
“现在还有多少”

Allocation
“当前占了多少”
```

例如：

```text NVIDIA Encoder:
Capability = H265
Capacity = 3 sessions
Availability = 1
Allocation = 2
```

以后 BMD/AJA 多卡同样如此。

---

# 130. Hardware Scheduler

未来 Resource Scheduler/X6 应该知道：

```text device capacity
port availability
backend availability
GPU sessions
network budget
```

但它不需要认识具体厂商 API。

---

# 131. Lease 模型也要 vendor-neutral

现在：

```text DeckLink Lease
```

最终应是：

```text MediaResourceLease
```

可保护：

```text physical device
physical port
runtime session
encoder session
gateway stream
```

---

# 132. 当前不要立即替换 InMemory Lease

先保持当前 Gate：

```text single-agent correctness
```

以后：

```text distributed lease
```

再接 Valkey/PostgreSQL。

不要现在同时做两个架构升级。

---

# 133. 安全模型

Vendor-neutral 不等于无限自动化。

禁止：

```text Device discovered
→ automatically trusted
```

必须：

```text discovered
→ capability known
→ binding proposed
→ validated
→ approved
```

---

# 134. Supply Chain

Provider/Backend 都需要：

```text version
checksum
build metadata
SDK version
ABI version
```

Evidence 中记录。

---

# 135. ABI Boundary

特别是 Vendor SDK：

```text BMD SDK
AJA SDK
```

只能存在于：

```text Provider Adapter
```

禁止出现在：

```text domain
runtime orchestration
RPC schema
UI schema
```

---

# 136. Plugin Model

第一阶段不做动态加载 `.so`。

建议使用：

```text compile-time provider registry
```

后续需要真正插件化时，再定义：

```text dynamic provider ABI
```

避免过早引入复杂 ABI。

---

# 137. 当前不建议做动态 Provider Plugin Loader

原因：

```text ABI
security
versioning
signing
supply chain
```

复杂度非常高。

当前：

```text Rust trait + static registration
```

已经足够。

---

# 138. Provider Registration

```rust
ProviderRegistry::register(
    Arc::new(BlackmagicProvider::new(...))
);
```

未来：

```rust
register(AjaProvider)
register(DeltacastProvider)
```

---

# 139. Feature flags

不要：

```text default = bmd
```

建议：

```text default
simulation
bmd
gstreamer
ffmpeg
hardware-test
```

其中：

```text bmd
```

只影响 Provider。

```text gstreamer
```

只影响 Backend。

不要让：

```text bmd
```

暗示：

> 一定使用 GStreamer。

---

# 140. 目标 feature 组合

允许：

```text bmd + gstreamer
bmd + ffmpeg
aja + gstreamer
simulation + mock-backend
```

禁止组合由能力矩阵决定，而不是编译器硬编码。

---

# 141. CI

增加矩阵：

```text
default
simulation
bmd
bmd,gstreamer
simulation,mock-backend
```

以后：

```text contract tests
```

至少每次运行。

---

# 142. Code Boundary CI

增加检查：

```text Domain → no vendor import
Domain → no gst import
Domain → no ffmpeg import
Domain → no SRS import
```

使用：

```text cargo dependency check
rust AST check
grep fallback
```

而不是只依赖人工 code review。

---

# 143. Architecture Lint

建立：

# `scripts/check-architecture-boundaries`

检查：

```text forbidden imports
forbidden strings
forbidden crate dependencies
forbidden schema fields
```

例如：

```text domain/
  不允许 grep:
  BMD
  DeckLink
  gstreamer
  ffmpeg
  SRS
```

---

# 144. Runtime Contract Test

必须检查：

```text GraphRuntimeIntent
```

序列化 JSON：

> 不含任何 vendor-specific field。

---

# 145. UI Contract Test

UI API schema：

> 不直接返回 `gst_device_number` 作为主 identity。

Runtime diagnostics 可以返回，但必须在：

```text diagnostics.*
```

命名空间。

---

# 146. API Schema

推荐：

```json
{
  "device": {
    "id": "...",
    "provider": {
      "id": "blackmagic",
      "display_name": "Blackmagic Design"
    }
  },
  "port": {
    "id": "...",
    "direction": "INPUT",
    "connector": "SDI"
  }
}
```

diagnostic：

```json
{
  "diagnostics": {
    "provider_ref": "...",
    "runtime_backend": "gstreamer",
    "runtime_resource_ref": "..."
  }
}
```

---

# 147. API 禁止把 Provider implementation 当 Product Object

例如：

```json
{
  "decklink_persistent_id": ...
}
```

禁止进入 Product API。

---

# 148. Audit

每次：

```text binding change
provider change
backend change
port assignment
```

都必须形成 Audit Event：

```text who
when
old
new
reason
preflight
result
```

---

# 149. Change Set

Binding 修改也必须遵守：

```text Draft
Validate
Preview
Apply
Rollback
```

与 V0.2 X3 保持一致。

---

# 150. Runtime Apply

任何 Binding 变更：

```text current session
```

如果正在播出：

> 不允许 silently hot mutate。

必须由 Session/ChangeSet Policy 决定：

```text live-safe
restart required
take required
maintenance only
```

---

# 151. 热插拔/设备增加

发现新设备：

```text DISCOVERED
```

不是：

```text AUTO_ACTIVE
```

必须：

```text DISCOVERED
→ CAPABILITY_VERIFIED
→ PROVISIONED
→ AVAILABLE
```

---

# 152. 设备移除

```text DeviceRemoved
→ PortUnavailable
→ BindingStale
→ Source Degraded
```

如果存在 Hot Standby：

```text Failover Policy
```

再决定是否切换。

---

# 153. 不能由 Hardware Provider 决定 Failover

Provider 只能告诉：

```text device removed
signal lost
busy
```

Supervisor/Safety/Failover Policy 才决定：

```text restart
degrade
switch
filler
```

V0.2 的 Failure Domain 要求仍然如此。([ARCHITECTURE_V0.2.md](https://raw.githubusercontent.com/pwl1987/VBMF/master/docs/architecture/ARCHITECTURE_V0.2.md))

---

# 154. 当前媒体链路最终形态

```text
Canonical Source Port
        ↓
Capability Negotiation
        ↓
Runtime Binding
        ↓
Hardware Provider
        ↓
Media Backend
        ↓
RAW
        ↓
Normalize
        ↓
FRAME / MASTER SWITCH
        ↓
Program Master
        ↓
Encoder Backend
        ↓
Stream Gateway
```

---

# 155. 最终具体实现映射

当前：

```text
Canonical Hardware
    ↓
BlackmagicProvider
    ↓
CanonicalPort
    ↓
RuntimeBinding
    ↓
GStreamerBackend
    ↓
DeckLink GStreamer element
```

未来：

```text
Canonical Hardware
    ↓
AjaProvider
    ↓
CanonicalPort
    ↓
RuntimeBinding
    ↓
GStreamerBackend
```

完全复用。

---

# 156. BMD → AJA 的变更范围

理论上只需要增加：

```text
providers/aja/
```

以及：

```text provider registration
capability mapping
provider tests
```

不允许修改：

```text GraphRuntimeIntent
Supervisor
Health
MEDIA-RT-01 semantics
UI canonical object
```

---

# 157. GStreamer → FFmpeg 的变更范围

理论上：

```text backends/ffmpeg/
```

不应该修改：

```text GraphRuntimeIntent
Device/Port
Signal model
Supervisor
```

---

# 158. SRS → 其他 Gateway

只替换：

```text GatewayAdapter
```

不改：

```text Output Graph
Program Master
StreamEndpoint
```

---

# 159. PostgreSQL → 其他 DB

只替换：

```text Repository Adapter
```

不改：

```text Product Object
Graph
Runtime
```

---

# 160. Docker → Bare Metal

只替换：

```text Deployment Adapter
```

不改：

```text Media Domain
Graph
Provider
```

---

# 161. OS 更换

Rust Media Agent 当前依赖 Linux 是事实。

不能假装完全跨 OS。

应该明确：

```text
Canonical Runtime
        ↓
OS Runtime Adapter
```

当前：

```text Linux
```

未来再考虑：

```text Windows
```

没有需求就不要实现。

---

# 162. “全部解耦”不代表“全部做成 Trait”

不要为了理论上的替换：

```text Vec
String
Clock
Filesystem
Network
```

全部包一层。

只在真实替换轴上抽象。

---

# 163. 当前真实替换轴

必须解耦：

```text Hardware Vendor
Hardware SDK
Media Backend
Encoder Backend
Stream Gateway
GPU/Acceleration
Clock Source
Timecode Source
Storage
Queue
Database
Deployment
Edge
Auth
```

---

# 164. 当前无需抽象

暂时无需：

```text basic collections
UUID implementation
Serde implementation
Rust async runtime
```

除非真实需求出现。

---

# 165. 新增 SoT 文档清单

必须新增：

```text
docs/architecture/PORTABILITY_AND_ADAPTER_MODEL.md
docs/architecture/TECHNOLOGY_PORTABILITY_MATRIX.md
docs/architecture/VENDOR_NEUTRALITY_RULES.md
docs/architecture/RUNTIME_BINDING_MODEL.md
docs/architecture/MEDIA_PROVIDER_CONTRACT.md
docs/architecture/MEDIA_BACKEND_CONTRACT.md
```

---

# 166. Phase 0.6 新增 Acceptance

增加：

```text
ARCH-PORTABILITY-01
BACKEND-PORTABILITY-01
HW-PORT-01
```

---

# 167. Acceptance 依赖关系

```text
ARCH-PORTABILITY-01
        ↓
HW-PORT-01A
        ↓
HW-PORT-01B
        ↓
HW-PORT-01C
        ↓
HW-PORT-01D
        ↓
HW-IDENT-02
        ↓
MEDIA-RT-01
```

---

# 168. 注意：不需要重新做已完成 Gate

现有：

```text HW-IDENT-02
MEDIA-RT-01 当前 BMD 真机结果
```

不删除。

只升级其：

```text scope
provider
host
acceptance semantics
```

---

# 169. 当前 BMD 真机结果定位

应记录：

```yaml
provider: blackmagic
backend: gstreamer
scope: HOST_SPECIFIC
fixture: SDI-LOOPBACK-01
```

它证明：

> BMD Provider + GStreamer Backend 的一套真实实现正确。

它不证明：

> 所有硬件厂商实现正确。

---

# 170. 当前 MEDIA-RT-01

应保留为：

```text
Generic Acceptance:
MEDIA-RT-01

Implementation:
BMD + GStreamer

Environment:
10.30.15.10
```

---

# 171. 当前 loopback 不是业务配置

不要让：

```text SDI Loopback
```

变成 Channel Production Profile。

它是：

```text Acceptance Fixture
```

---

# 172. Production 与 Diagnostics

生产：

```text Manifest authoritative
no heuristic
no auto-select
```

诊断：

```text provider discovery
probe
raw properties
```

明确隔离。

---

# 173. Discovery 输出允许展示 raw vendor data

Diagnostics 页面允许：

```text BMD DeviceHandle
GStreamer device-number
Vendor error code
```

但是必须放在：

```text Raw / Diagnostics
```

而非：

```text Canonical Identity
```

---

# 174. Provider-specific Config

允许：

```yaml
provider_options:
  blackmagic:
    ...
```

但上层：

```text Domain Graph
```

不能依赖。

---

# 175. Backend-specific Config

允许：

```yaml
backend_options:
  gstreamer:
    ...
```

但只能由：

```text GStreamerBackend
```

解释。

---

# 176. Unknown Provider

UI 必须支持：

```text Provider = Unknown
```

不能要求前端 enum 必须提前知道所有厂商。

---

# 177. Unknown Backend

同理：

```text Backend = Unknown
```

只能：

```text unavailable
```

不能 silently fallback。

---

# 178. Unknown Capability

应显示：

```text Unknown
```

而不是：

```text Unsupported
```

---

# 179. Security Boundary

Provider Adapter 是高权限边界。

必须：

```text least privilege
```

不能因为某个厂商 SDK 就放宽整个 Agent 的：

```text capability
device access
filesystem
network
```

---

# 180. Runtime Security

继续保持：

```text runc
device allowlist
cap drop
seccomp
AppArmor
ipc
```

这些属于 Deployment Security Plane。

---

# 181. Vendor SDK Isolation

Vendor SDK 只在：

```text provider crate
```

链接。

如果 SDK 有：

```text .so
header
FFI
```

不能污染其他 crate。

---

# 182. 依赖树要求

理想：

```text domain
   ↓
runtime contracts
   ↓
provider/backend adapters
```

而不是：

```text domain
   ↓
gstreamer
   ↓
bmd ffi
```

---

# 183. Cargo Workspace 建议

最终可考虑：

```text
media-domain
media-runtime-contract
hardware-provider
media-backend
media-agent
provider-blackmagic
backend-gstreamer
backend-ffmpeg
```

但不要一次性全部 workspace 拆包。

先通过 module boundary 验证。

---

# 184. 第一阶段最小实现

当前只要求：

```text Canonical Domain
Hardware Provider SPI
Media Backend SPI
Mock Provider
Mock Backend
Blackmagic Provider
GStreamer Backend
```

不实现：

```text AJA
Deltacast
FFmpeg Backend full
```

只需证明架构支持它们。

---

# 185. 第一阶段代码迁移顺序

```text
STEP 1
Domain Model extraction

STEP 2
Hardware Provider trait

STEP 3
Media Backend trait

STEP 4
Mock implementations

STEP 5
Move BMD into Provider

STEP 6
Move GStreamer into Backend

STEP 7
Binding Manifest v2

STEP 8
Canonical GraphRuntimeIntent

STEP 9
Contract tests

STEP 10
Current BMD acceptance rerun
```

---

# 186. 第二阶段

```text
Capability Negotiation
+
Preflight
+
Resource Model
```

---

# 187. 第三阶段

```text
Encoder SPI
+
Gateway SPI
+
Clock SPI
+
Timecode SPI
```

---

# 188. 第四阶段

```text Infrastructure SPI
Repository
JobQueue
ObjectStore
DistributedLock
```

---

# 189. 第五阶段

```text ARCH-PORTABILITY-01
BACKEND-PORTABILITY-01
HW-PORT-01
MEDIA-RT-01
```

重新按 Generic/Provider/Host 三层 evidence 记录。

---

# 190. 当前不要做

严格禁止：

```text
❌ 重开 V0.2
❌ 重做 Phase 0.5
❌ 更换 React/shadcn
❌ 更换 Node/Rust
❌ 更换 SRS
❌ 更换 GStreamer
❌ 更换 Docker
❌ 实现 AJA 真机
❌ 实现全部 Provider
❌ 实现动态插件加载
❌ 全量 workspace 重构
❌ 重写 Media Agent
```

---

# 191. Definition of Done

必须满足：

### DOD-01

Domain crate 无：

```text BMD
AJA
GStreamer
FFmpeg
SRS
```

依赖。

### DOD-02

GraphRuntimeIntent 不出现：

```text device-number
persistent-id
vendor SDK enum
```

### DOD-03

Hardware Provider Contract 可由 Mock Provider 实现。

### DOD-04

Media Backend Contract 可由 Mock Backend 实现。

### DOD-05

BMD + GStreamer 能通过现有真实 MEDIA-RT-01。

### DOD-06

更换 Mock Provider 不修改 Domain。

### DOD-07

更换 Mock Backend 不修改 Domain。

### DOD-08

Port / Capability / Signal / Content 分离。

### DOD-09

Manifest 不负责创造 Hardware Capability，只负责 Provisioned Binding。

### DOD-10

当前机器硬件信息全部标为 HOST_SPECIFIC Evidence。

---

# 192. 关键禁止条件

以下任何一项出现，都不得宣布本阶段完成：

```text
Domain import BMD SDK
Domain import GStreamer
GraphRuntimeIntent contains device-number
GraphRuntimeIntent contains persistent-id
PortDirection derived from signal
Capability derived from signal
Manifest invents physical port
Fixture uses first()
Provider exposes vendor type
Supervisor handles vendor error code
Production silently falls back
UI uses device-number as identity
Acceptance hardcodes decklinkvideosrc
```

---

# 193. 最终目标

最终希望：

```text
                   CANONICAL MEDIA DOMAIN
                           │
                 device_id + port_id
                           │
                 capability negotiation
                           │
                 runtime binding
                           │
            ┌──────────────┴──────────────┐
            │                             │
       Hardware Provider              Media Backend
            │                             │
       BMD / AJA / ...             Gst / FFmpeg / ...
            │                             │
            └──────────────┬──────────────┘
                           │
                        Runtime
                           │
                      Supervisor
                           │
                      Health Tree
```

---

# 194. 产品级换卡验收目标

以后更换：

```text BMD → AJA
```

开发团队只允许：

```text 增加 AjaProvider
重新 Provision
重新 Acceptance
```

不允许修改：

```text Graph
Session
Switch
Supervisor
Health
UI semantic model
```

---

# 195. 产品级加卡验收目标

增加：

```text 第 2 张
第 3 张
第 N 张
```

不修改：

```text source schema
port schema
graph schema
```

只增加：

```text discovery result
provisioning
resource allocation
```

---

# 196. 产品级换媒体后端

```text GStreamer
→ FFmpeg
```

只替换：

```text MediaBackend
```

GraphRuntimeIntent 不改。

---

# 197. 产品级换 Gateway

```text SRS
→ Future Gateway
```

只替换：

```text GatewayAdapter
```

Program Master 不改。

---

# 198. 产品级换存储

```text RustFS
→ S3
```

只替换：

```text ObjectStoreAdapter
```

Asset model 不改。

---

# 199. 产品级换部署

```text Docker
→ Bare Metal
```

只替换：

```text Deployment config
```

Media Runtime 不改。

---

# 200. 本阶段最终结论

**不要再把 VBMF 设计成“BMD + GStreamer 系统”。**

必须把它正式提升成：

# “Vendor-Neutral Media Fabric”

当前：

```text BMD
+
GStreamer
+
SRS
+
RustFS
+
PostgreSQL
+
Valkey
+
Docker
```

全部只是：

> **当前默认实现。**

而不是：

> **VBMF 的业务语义。**

---

# 201. 给开发 AI 的最终执行命令

**请严格执行以下任务：**

1. 不修改 V0.2 LOCK FINAL 的核心语义。
2. 不修改 Phase 0.5 LOCK FINAL 的核心 Workflow / Surface / Object Model。
3. 将当前 BMD-specific 与 GStreamer-specific 实现下沉为 Adapter。
4. 建立 Canonical Domain Model。
5. 建立 Hardware Provider SPI。
6. 建立 Media Backend SPI。
7. 建立 Runtime Binding Model。
8. 将 DeviceBindingManifest 演化为 RuntimeBindingManifest v2。
9. 将 Device/Port/Capability/Signal/Content 完全解耦。
10. GraphRuntimeIntent 仅允许 Canonical DeviceId + PortId + Media Semantics，不得出现 GStreamer/BMD 字段。
11. Provider-specific / Backend-specific 信息只能位于 Adapter 或 Diagnostics。
12. 引入 Mock Provider + Mock Backend Contract Tests。
13. 引入 Vendor Neutrality architecture lint。
14. 当前 BMD + GStreamer 实现必须继续工作，不能破坏已有真实 MEDIA-RT-01。
15. 当前 BMD 真机 Evidence 必须保持 HOST_SPECIFIC / PROVIDER scope。
16. 新增 `ARCH-PORTABILITY-01` 与 `BACKEND-PORTABILITY-01`。
17. 增加 Port/Capability/Signal/Content/UI 的 Engineering 数据模型。
18. 不实现动态插件加载，不一次性重写整个 Media Agent。
19. 不提前实现 AJA/Deltacast 真机 Adapter。
20. 不提前实现 Normalize / Switch / Encode / SRS 新功能。
21. 不提前做 FI-08 / FI-09。
22. 所有代码必须保持：
    ```text
    cargo fmt --all
    cargo test
    cargo test --features simulation
    cargo clippy --all-targets -- -D warnings
    cargo clippy --features simulation -- -D warnings
    ```
23. BMD 构建必须继续：
    ```text
    cargo build --features bmd,gstreamer
    cargo test --features bmd,gstreamer
    cargo clippy --all-targets --features bmd,gstreamer -- -D warnings
    ```
24. 所有新增真实 BMD 证据写入：
    ```text
    evidence/bmd-10.30.15.10/
    ```
    并明确：
    ```text
    scope = HOST_SPECIFIC
    provider = blackmagic
    backend = gstreamer
    ```
25. 完成后输出：
    - Architecture Impact Assessment
    - Adapter Boundary Matrix
    - File Change List
    - API/Schema Change List
    - Migration Plan
    - Test Matrix
    - Evidence Plan
    - Remaining Technical Debt
    - Explicit confirmation that V0.2/Phase 0.5 semantics remain unchanged.

**特别要求：不要因为“为了未来可换厂商”而制造过度抽象。只在真实替换轴上建立 Adapter/SPI。**

**本阶段真正的成功标准不是“支持 AJA”，而是证明：即使把 BMD Provider 和 GStreamer Backend 换成两个 Mock 实现，VBMF 的 Domain、GraphRuntimeIntent、Supervisor、Health、Acceptance 和 UI Canonical Model 仍然完全不需要修改。**