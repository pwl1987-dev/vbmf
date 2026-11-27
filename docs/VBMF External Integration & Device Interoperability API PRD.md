# VBMF External Integration & Device Interoperability API PRD

## API / External Integration / Device Control / Event Federation

> 📜 **状态：裁剪采纳 —— 本 PRD 不全盘接受。**
> - **#1–#137** → 可作 P1 规划基线（多数已在 0.7C / 0.7D 落地，见新 PRD §7.1）
> - **#138–#170** → **外置，不得回流**（Multi-site / Federation / Agent Registration / Artifact 上传子系统 / Event 三套推送 / Recording-Playback）；依据 `PRD_REVIEW_EXTERNAL_API.md` §0.5 与 §3.5（I–Q），理由：**无消费方不建抽象**
> **产品层唯一入口改看：** [`VBMF_PRODUCT_PRD.md`](./VBMF_PRODUCT_PRD.md)（V1.0 DRAFT，2026-11-27）；外置清单见新 PRD §0.3 与 §1.3。
> **处置**：原文保留作审计留痕，不删改。

**项目：** VBMF  
**阶段：** Runtime Abstraction 后续配套架构  
**文档类型：** 独立 PRD + API Architecture Contract  
**定位：** External Integration Plane  
**状态：** Proposed Baseline

---

# 0. 核心目标

VBMF 必须能够：

1. 被其他业务系统调用；
2. 调用其他系统；
3. 与第三方媒体设备联动；
4. 接收第三方设备状态；
5. 将 VBMF Runtime 状态实时通知给外部系统；
6. 通过标准 API 控制允许暴露的 Runtime 能力；
7. 支持同步 API、异步任务、Webhook、WebSocket/SSE、事件总线等不同交互模式；
8. 不因为某个厂商/第三方系统而污染 VBMF Canonical Domain；
9. 能够长期演进 API，而不导致外部集成整体崩溃。

---

# 1. 架构定位

本 PRD 新增：

# External Integration Plane

它与：

```text
Control Plane
Media Runtime
Hardware Provider
Media Backend
Infrastructure
```

并列作为接口边界。

总体：

```text
                       External Systems
                              │
                   ┌──────────┴──────────┐
                   │ External Integration │
                   │        Plane         │
                   └──────────┬──────────┘
                              │
                         API / Events
                              │
                     Canonical Contracts
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
     Control Plane                           Media Runtime
          │                                       │
      Fastify                                Rust Agent
          │                                       │
          └────────────── Runtime Contract ───────┘
```

---

# 2. 最重要原则

必须永久区分：

```text
Internal API
External API
Device Protocol
Vendor API
Runtime API
Business API
```

不能全部混为：

```text REST / JSON endpoint
```

---

# 3. External Integration 不等于 REST

必须支持：

```text
Synchronous API
Asynchronous Command
Event Subscription
Webhook
WebSocket
SSE
Polling
Device Protocol Adapter
```

具体采用哪一种，由交互语义决定。

---

# 4. 外部接口分成六类

```text
A. Query API
B. Command API
C. Event API
D. Resource API
E. Device Integration API
F. Administration API
```

---

# 5. A. Query API

用于：

> 获取当前状态。

例如：

```text
GET /api/v1/devices
GET /api/v1/devices/{device_id}
GET /api/v1/ports
GET /api/v1/ports/{port_id}
GET /api/v1/sessions
GET /api/v1/sessions/{session_id}
GET /api/v1/resources
GET /api/v1/streams
GET /api/v1/health
```

---

# 6. Query API 禁止返回 Vendor 主语义

例如禁止：

```json
{
  "device_number": 1,
  "decklink_persistent_id": 123
}
```

作为核心业务字段。

允许：

```json
{
  "device_id": "...",
  "port_id": "...",
  "direction": "INPUT"
}
```

Vendor diagnostics 放：

```json
{
  "diagnostics": {
    "provider": "...",
    "provider_resource_ref": "..."
  }
}
```

---

# 7. Query API 必须明确状态来源

每一个状态都应该能够区分：

```text
configured
provisioned
observed
runtime
historical
```

不能让外部系统误以为：

> 配置值 = 当前硬件事实。

---

# 8. B. Command API

Command API 用于：

> 请求系统执行动作。

例如：

```text
POST /api/v1/sessions
POST /api/v1/sessions/{id}/start
POST /api/v1/sessions/{id}/stop
POST /api/v1/sessions/{id}/recover
POST /api/v1/bindings/{id}/verify
POST /api/v1/devices/{id}/rediscover
```

---

# 9. Command 不应该立即假定成功

API 返回：

```json
{
  "command_id": "...",
  "accepted": true,
  "status": "ACCEPTED"
}
```

而不是：

```json
{
  "success": true
}
```

因为：

```text
Accepted
≠
Completed
```

---

# 10. Command 生命周期

统一：

```text
ACCEPTED
QUEUED
RUNNING
SUCCEEDED
FAILED
CANCELLED
EXPIRED
REJECTED
```

---

# 11. Command Idempotency

所有可能重复调用的写操作必须支持：

```http
Idempotency-Key: <uuid>
```

例如：

```text
start session
stop session
apply binding
switch source
```

不能因为网络重试产生两个动作。

---

# 12. Command Resource

Command 对象：

```json
{
  "command_id": "...",
  "command_type": "SESSION_START",
  "target": {
    "session_id": "..."
  },
  "requested_by": "...",
  "created_at": "...",
  "status": "RUNNING"
}
```

---

# 13. Command Result

必须能够追溯：

```text
command
session
resource
runtime event
```

---

# 14. C. Event API

用于：

> VBMF 主动告诉外部系统发生了什么。

事件类型：

```text
DEVICE_CHANGED
PORT_CHANGED
CAPABILITY_CHANGED
BINDING_CHANGED
SIGNAL_CHANGED
CONTENT_CHANGED
SESSION_CHANGED
PIPELINE_CHANGED
RESOURCE_CHANGED
HEALTH_CHANGED
LEASE_CHANGED
STREAM_CHANGED
COMMAND_CHANGED
```

---

# 15. Event Schema

统一：

```json
{
  "event_id": "...",
  "event_type": "...",
  "event_version": 1,
  "occurred_at": "...",
  "source": "vbmf",
  "correlation_id": "...",
  "causation_id": "...",
  "data": {}
}
```

---

# 16. Event 必须支持关联链

必须支持：

```text
correlation_id
causation_id
request_id
session_id
pipeline_id
device_id
port_id
```

这样可以回答：

> 谁导致了这个状态变化？

---

# 17. Event Delivery

第一阶段至少支持：

```text Webhook
WebSocket
SSE
```

以后可以增加：

```text Message Broker
Kafka/NATS/etc.
```

但不能现在为了事件系统引入新的 MQ。

---

# 18. Webhook

外部系统可以：

```text POST /api/v1/event-subscriptions
```

注册：

```json
{
  "url": "https://example/system/vbmf/events",
  "events": [
    "SIGNAL_CHANGED",
    "SESSION_CHANGED"
  ]
}
```

---

# 19. Webhook 安全

Webhook 必须：

```text HTTPS
签名
timestamp
nonce
replay protection
secret rotation
```

例如：

```http
X-VBMF-Signature
X-VBMF-Timestamp
X-VBMF-Event-Id
```

---

# 20. Webhook Retry

必须定义：

```text retry policy
backoff
max attempts
dead-letter state
```

失败不能影响 Media Runtime。

---

# 21. Webhook 必须异步

严禁：

```text Media Runtime
  ↓
等待 HTTP webhook 返回
```

正确：

```text Runtime Event
  ↓
Event Dispatcher
  ↓
Webhook
```

Webhook 故障不得阻塞：

```text Pipeline
Supervisor
Signal
```

---

# 22. WebSocket

适用于：

```text live status
signal state
pipeline status
session state
resource state
```

例如：

```text WS /api/v1/events
```

---

# 23. WebSocket 不作为 Command 主通道

Command 仍走：

```text REST/Command API
```

WebSocket：

> 事件与实时状态。

---

# 24. SSE

适合：

```text dashboard
monitoring
event stream
```

例如：

```text GET /api/v1/events/stream
```

---

# 25. Event Ordering

必须定义：

```text event_id
sequence
occurred_at
```

并允许：

> 网络层无序到达。

消费者不得假设：

```text HTTP arrival order = event order
```

---

# 26. Event Replay

第一阶段可以不实现完整事件存储。

但 Event API 必须预留：

```text cursor
sequence
since
```

未来可以：

```text reconnect
→ resume from cursor
```

---

# 27. D. Resource API

External System 可以查询：

```text Device
Port
Resource
Session
Lease
```

但：

> 外部系统不直接操作内部 Lease Manager。

---

# 28. Resource Ownership

外部系统请求：

```text resource reservation
```

通过：

```text API Command
```

不能直接修改数据库：

```text PostgreSQL
```

---

# 29. Resource Reservation API

例如：

```text POST /api/v1/resource-reservations
```

请求：

```json
{
  "resources": [
    {
      "port_id": "..."
    }
  ],
  "purpose": "external_test",
  "ttl_seconds": 120
}
```

---

# 30. Lease API

Lease 查询可以公开：

```text GET /api/v1/leases/{lease_id}
```

但 Lease 获取必须通过：

```text Session / Resource command
```

不能由外部系统伪造 owner。

---

# 31. E. Device Integration API

这一层专门处理：

> 外部设备。

必须区分：

```text VBMF-managed device
External device
Observed device
Integrated device
```

---

# 32. 外部设备不一定支持 VBMF Agent

例如：

```text PTZ Camera
Audio Mixer
SDI Router
GPIO controller
Tally controller
NMS
Time server
```

VBMF 不应该要求它们运行 Rust Agent。

---

# 33. Device Adapter Model

建立：

```text ExternalDeviceAdapter
```

例如：

```text ONVIF Adapter
SNMP Adapter
NMOS Adapter
REST Adapter
SOAP Adapter
Serial Adapter
TCP Adapter
UDP Adapter
GPIO Adapter
```

---

# 34. Device Adapter 与 Hardware Provider 的区别

非常重要：

### Hardware Provider

表示：

> VBMF 本机直接管理的媒体硬件。

### External Device Adapter

表示：

> VBMF 外部联动的设备/系统。

不能合并。

---

# 35. Device Adapter Contract

```rust
trait ExternalDeviceAdapter {
    fn adapter_id(&self) -> AdapterId;

    fn discover(&self) -> Result<Vec<ExternalDevice>>;

    fn get_state(
        &self,
        device: &ExternalDevice,
    ) -> Result<ExternalDeviceState>;

    fn execute(
        &self,
        command: ExternalDeviceCommand,
    ) -> Result<ExternalCommandResult>;
}
```

---

# 36. External Device 不进入 Canonical Hardware Registry

External Device：

```text id="device_ext_*"
```

属于：

```text External Integration Registry
```

而不是：

```text Local Hardware Registry
```

除非它已经被正式纳入 VBMF Physical Resource。

---

# 37. 外部设备模型

```json
{
  "external_device_id": "...",
  "adapter": "onvif",
  "type": "PTZ_CAMERA",
  "identity": {},
  "capabilities": {},
  "state": {}
}
```

---

# 38. 外部系统集成

支持：

```text REST
Webhook
SOAP
SNMP
SFTP
MQTT
WebSocket
TCP
UDP
```

但：

> 协议必须作为 Adapter，不允许进入业务模型。

---

# 39. 不要为所有协议写一套通用万能接口

例如不要：

```text
UniversalDeviceApi
```

内部塞几十种：

```text
SNMP
HTTP
ONVIF
GPIO
Serial
```

应该：

```text Protocol Adapter
```

统一输出 Canonical Integration Event/Command。

---

# 40. ONVIF Integration

用于：

```text PTZ
Camera
Discovery
Profile
Stream
```

但 ONVIF 类型只能存在于：

```text ONVIF Adapter
```

---

# 41. SNMP Integration

用于：

```text health
temperature
fan
power
link
device state
```

SNMP OID 不得进入 Domain。

例如：

```text 1.3.6....
```

只存在：

```text SNMP Adapter
```

---

# 42. NMOS Integration

未来广播设备/IP Media 环境非常重要。

应预留：

```text IS-04
IS-05
```

用途：

```text Device Discovery
Connection Management
Source/Sink
Flow
```

但：

> NMOS Resource 需要映射到 Canonical Device/Port/Flow。

不要直接把 NMOS object 当 VBMF Domain object。

---

# 43. Router Integration

应支持未来：

```text SDI Router
IP Router
Audio Matrix
Video Matrix
```

定义：

```text RoutingAdapter
```

例如：

```text POST /api/v1/routing-connections
```

---

# 44. Routing Model

```text SourcePort
    ↓
Routing Fabric
    ↓
DestinationPort
```

不要强制认为：

```text Source → direct Cable
```

未来可能：

```text Source
→ Router
→ Converter
→ Destination
```

---

# 45. Routing Session

Routing 本身可以是 Resource：

```text RouteResource
```

需要：

```text reservation
lease
state
health
```

---

# 46. GPIO/GPI/O

必须预留：

```text GpioInput
GpioOutput
Gpi
Gpo
```

用途：

```text Tally
Trigger
Alarm
External automation
```

但：

> GPIO 是设备能力，不应成为 Graph semantic。

---

# 47. Tally API

未来可以：

```text POST /api/v1/tally
```

例如：

```json
{
  "target": {
    "device_id": "...",
    "port_id": "..."
  },
  "state": "PROGRAM"
}
```

---

# 48. Tally 不能直接绑定 UI

UI 显示只是：

```text observed state
```

真正 Tally：

```text Control Plane
→ Tally Adapter
```

---

# 49. GPI Trigger

支持：

```text External Trigger
→ Command
```

例如：

```text GPI rising edge
→ start recording
```

但触发必须进入：

```text Command
Event
Policy
```

而不是直接：

```text GPIO ISR → pipeline start
```

---

# 50. 第三方系统调用 VBMF

外部系统可能请求：

```text Start Channel
Stop Channel
Switch Source
Start Recording
Stop Recording
Get Signal
Get Health
```

这些都必须：

```text External API
→ Control Plane
→ Preflight
→ ChangeSet
→ Runtime
```

而不能：

```text External API
→ Rust Media Agent directly
```

---

# 51. 外部系统禁止越过 Control Plane 修改业务状态

例如禁止：

```text External System
    ↓
Rust Agent
    ↓
Pipeline mutation
```

生产路径：

```text External System
    ↓
Fastify API
    ↓
Authorization
    ↓
Preflight
    ↓
ChangeSet
    ↓
Runtime Command
    ↓
Rust
```

---

# 52. 诊断 API 可以直接查询 Media Agent

为了运维：

```text /internal/agent/*
```

可以存在。

但必须：

```text authentication
network restriction
read-only default
```

---

# 53. Production API 与 Internal API 必须分离

建议：

```text /api/v1/*
```

Production External API。

```text /internal/v1/*
```

Internal Integration/Agent API。

```text /diagnostics/v1/*
```

Engineering diagnostics。

三套 Contract 不混合。

---

# 54. Rust Media Agent 外部接口

当前 Node/Rust 边界保持：

```text External
  ↓
Fastify
  ↓
Rust Agent
```

不要让外部系统直接调用 Rust HTTP API。

除非：

> 明确属于 Internal Agent API。

---

# 55. Node ↔ Rust

Node → Rust：

```text Command
```

Rust → Node：

```text Runtime Event
```

建议保持双向：

```text id="node_rust"
Command
Event
Query
```

而不是：

```text REST everywhere
```

---

# 56. Node/Rust API Envelope

统一：

```json
{
  "request_id": "...",
  "api_version": "1",
  "command": "...",
  "payload": {}
}
```

---

# 57. API Versioning

必须从第一天支持：

```text /api/v1/
```

以后：

```text /api/v2/
```

不允许：

```text destructive JSON change
```

---

# 58. Compatibility Policy

规则：

```text Additive field
= backward compatible

Rename/delete field
= breaking

Semantic change
= breaking
```

---

# 59. JSON Schema

所有 External API 必须有：

```text JSON Schema
OpenAPI
```

不能只维护：

```text TypeScript interface
```

---

# 60. OpenAPI

最终生成：

```text openapi.yaml
```

必须成为：

> External API Contract Source。

---

# 61. SDK

第一阶段不强制维护所有语言 SDK。

但 API 必须可以生成：

```text TypeScript
Python
Go
```

客户端。

---

# 62. Authentication

External API 至少支持：

```text API Key
OAuth2/OIDC
mTLS
```

其中：

> 内部环境也不得默认“无认证”。

---

# 63. Authorization

不能只做：

```text admin / user
```

需要按：

```text resource
action
scope
```

授权。

例如：

```text device.read
device.control
session.read
session.start
session.stop
binding.write
diagnostics.read
```

---

# 64. Device Control 权限

非常敏感：

```text power cycle
reset
reboot
route
switch
```

默认不得给：

```text read-only
operator
```

---

# 65. Scope

API Token 可以：

```text scope=device.read
scope=signal.read
scope=session.start
```

而不是：

```text full_admin
```

---

# 66. Audit

任何外部 Command 必须记录：

```text who
what
when
source
target
before
after
result
correlation_id
```

---

# 67. External Request Trace

外部：

```text X-Request-ID
```

进入：

```text Fastify
→ Rust
→ Runtime Event
→ Webhook
```

必须保持 correlation。

---

# 68. Rate Limiting

External API：

```text query
command
diagnostic
event subscription
```

必须有不同限流策略。

特别是：

```text /health
/discovery
/device scan
```

避免被外部监控系统打爆。

---

# 69. Backpressure

Event/Webhook：

```text consumer slow
```

不能阻塞：

```text Runtime
```

必须：

```text buffer
drop policy
retry
dead-letter
```

---

# 70. API Timeout

外部同步 API：

> 不得等待一个几十秒甚至几分钟的 Pipeline 操作。

长操作统一：

```text 202 Accepted
command_id
```

然后：

```text event/websocket
```

通知最终状态。

---

# 71. Cancellation

Command 应支持：

```text POST /commands/{id}/cancel
```

但取消规则由具体 Command 定义。

已经进入：

```text device operation
```

可能不可取消。

---

# 72. Transaction Boundary

不能提供：

```text gigantic transaction
```

跨：

```text PostgreSQL
Rust
Device
External System
```

全部两阶段提交。

应该使用：

```text command
event
compensation
```

---

# 73. External Integration 必须采用最终一致性

例如：

```text VBMF state
→ webhook
→ external system
```

外部系统允许稍后同步。

不能让：

> 外部系统数据库可用性

影响：

> 本地媒体 pipeline。

---

# 74. External System Down

如果：

```text CMS down
NMS down
Webhook target down
```

VBMF：

> Media Runtime 继续工作。

---

# 75. External Device Down

如果：

```text PTZ down
router down
audio mixer down
```

必须产生：

```text ExternalDeviceUnavailable
```

但不得污染：

```text unrelated media session
```

---

# 76. Integration Failure Domain

必须单独定义：

```text External Integration Failure
```

例如：

```text API unavailable
Webhook unavailable
External Device unavailable
Authentication unavailable
```

不能直接认为：

```text Media Pipeline failed
```

---

# 77. External Command Safety

所有危险操作都需要：

```text Preflight
```

例如：

```text change router route
switch program source
stop recording
change live output
```

必须返回：

```text impact
affected resources
current state
expected result
```

---

# 78. External Event Semantics

事件表达：

> “发生了什么”。

Command 表达：

> “请求做什么”。

不能：

```text Event = Command result only
```

---

# 79. Desired State / Observed State

外部系统可能提交：

```text desired state
```

例如：

```json
{
  "desired": {
    "signal": "LOCKED"
  }
}
```

但：

> Signal 本身通常不是用户可以“设置”的业务状态。

因此 API 必须区分：

```text desired state
configuration
command
observation
```

---

# 80. External Configuration Sync

如果外部系统是配置源：

```text Source of Truth
```

必须显式声明：

```text external authoritative
VBMF authoritative
shared authoritative
```

不能两个系统同时认为自己是 SoT。

---

# 81. Configuration Federation

支持：

```text GET /api/v1/configuration
POST /api/v1/change-sets
```

但生产修改必须：

```text ChangeSet
Preflight
Impact
Approval
Apply
Audit
```

---

# 82. Change Notification

配置变化必须发：

```text CONFIG_CHANGED
BINDING_CHANGED
ROUTING_CHANGED
```

而不是靠外部不停 polling。

---

# 83. API Discovery

外部系统需要知道：

```text API version
capabilities
feature support
```

提供：

```text GET /api
GET /api/capabilities
```

---

# 84. Capability Discovery API

例如：

```text GET /api/v1/capabilities
```

返回：

```json
{
  "api": {},
  "media": {},
  "devices": {},
  "routing": {},
  "recording": {},
  "events": {}
}
```

---

# 85. 不要通过 API 路径硬编码 Feature Availability

不要：

```text /bmd/*
/gstreamer/*
```

作为生产业务 API。

应该：

```text /devices
/ports
/sessions
/routing
```

---

# 86. Vendor Extension

如果确实需要厂商专有能力：

```json
{
  "extensions": {
    "blackmagic": {}
  }
}
```

必须隔离。

不能污染 Canonical Schema。

---

# 87. External Integration Registry

新增：

```text Integration
IntegrationEndpoint
ExternalDevice
ExternalSystem
Adapter
Subscription
CredentialReference
```

---

# 88. Integration Object

```json
{
  "integration_id": "...",
  "type": "SNMP",
  "adapter": "snmp",
  "status": "CONNECTED"
}
```

---

# 89. Integration Lifecycle

```text
DRAFT
CONFIGURED
VALIDATING
CONNECTED
DEGRADED
DISCONNECTED
DISABLED
```

---

# 90. Integration Health

Integration health 独立于：

```text Media health
```

例如：

```text SRS = healthy
BMD input = healthy
CMS integration = degraded
```

三者不得合并成一个 Status。

---

# 91. External Device Discovery

Discovery 可以：

```text scheduled
manual
event-driven
```

但 Discovery 不自动改变生产 Graph。

---

# 92. External Device Provisioning

新设备：

```text discovered
→ inspected
→ approved
→ provisioned
→ available
```

---

# 93. External Device Identity

不得只依赖：

```text IP address
hostname
MAC
```

必须尽可能采用：

```text stable device identity
```

并记录 identity strength。

---

# 94. External Device Port

同样支持：

```text external_port_id
```

不得把：

```text TCP port number
UDP port
HTTP endpoint
```

直接当 Canonical PortId。

---

# 95. External Routing

所有：

```text SDI router
Audio matrix
IP routing
```

都进入：

```text Routing Adapter
```

---

# 96. Routing API

例如：

```text POST /api/v1/routes
```

请求：

```json
{
  "source_port_id": "...",
  "destination_port_id": "...",
  "mode": "MAKE"
}
```

---

# 97. Route Lifecycle

```text REQUESTED
VALIDATING
RESERVED
APPLYING
ACTIVE
FAILED
ROLLING_BACK
RELEASED
```

---

# 98. Route Conflict

必须明确：

```text conflict detection
```

不能两个系统同时：

```text route same destination
```

然后互相覆盖。

---

# 99. External Device Command

例如：

```text PTZ move
router route
mixer mute
tally
GPIO
camera preset
```

统一：

```text ExternalCommand
```

但具体参数由 Adapter schema 定义。

---

# 100. Adapter Command Contract

```json
{
  "adapter": "onvif",
  "device_id": "...",
  "operation": "PTZ_GOTO_PRESET",
  "parameters": {}
}
```

Adapter 自己 validate。

---

# 101. Adapter 不可篡改 Canonical State

Adapter 只能：

```text execute
observe
report
```

不能：

```text 修改 Graph
修改 Channel
决定 Failover
```

---

# 102. External Trigger

支持：

```text webhook in
GPIO
SNMP trap
MQTT
HTTP callback
```

统一转换：

```text ExternalTrigger
```

然后：

```text Policy Engine
→ Command
```

---

# 103. Trigger 安全

禁止：

```text arbitrary URL
```

触发：

```text shell
ffmpeg
media-agent restart
```

所有 Trigger 必须绑定：

```text allowed action
scope
credential
rate limit
```

---

# 104. Webhook Inbound

建议：

```text POST /api/v1/triggers/webhook/{integration_id}
```

验证：

```text signature
timestamp
nonce
schema
```

再进入：

```text Trigger Pipeline
```

---

# 105. Trigger 与 Command 分离

```text Trigger
= 外部发生了什么

Command
= VBMF 要做什么
```

这样多个 Trigger 可以产生同一种 Command。

---

# 106. Automation Policy

未来支持：

```text signal lost
→ start filler

GPI trigger
→ start recording

device failure
→ notify operator
```

但这是：

> Policy 层。

不应该写进：

```text Adapter
```

---

# 107. 不要让外部设备 Adapter 实现业务策略

禁止：

```text SNMP Adapter
→ signal lost
→ switch source
```

正确：

```text SNMP Adapter
→ event
→ Policy
→ Command
```

---

# 108. API Security Boundary

External API 默认：

```text authenticated
authorized
audited
rate-limited
```

---

# 109. Network Segmentation

建议：

```text Management Network
Media Network
Device Network
```

逻辑隔离。

---

# 110. mTLS

Device/Infrastructure Adapter 可以使用：

```text mTLS
```

尤其：

```text NMS
Router
IP Media
Gateway
```

---

# 111. Secret Management

API credentials：

> 只保存 Secret Reference。

不把：

```text password
token
private key
```

写入：

```text Manifest
Graph
Evidence
Git
```

---

# 112. API Audit Retention

Audit 需要：

```text timestamp
actor
action
result
resource
```

保存周期由治理规则决定。

---

# 113. API Observability

至少：

```text requests_total
request_latency
command_success
command_failed
webhook_success
webhook_failed
event_delivery_lag
external_device_state
```

---

# 114. Integration Metrics

至少：

```text integration_up
integration_down
integration_error
event_queue_depth
webhook_retry_count
adapter_command_latency
```

---

# 115. API Health

不能只返回：

```json
{
  "status": "UP"
}
```

需要：

```text API
Integration
Runtime
Dependency
```

分层。

---

# 116. Readiness

区分：

```text liveness
readiness
dependency health
```

---

# 117. API Pagination

所有可能增长的：

```text devices
ports
sessions
events
commands
audit
integrations
```

必须分页。

---

# 118. Filtering

支持：

```text status
provider
type
health
updated_at
```

但过滤字段应保持 Canonical。

---

# 119. Sorting

要求稳定排序：

```text updated_at
created_at
id
```

不能依赖数据库自然顺序。

---

# 120. Optimistic Concurrency

配置/Binding 更新需要：

```text version
etag
revision
```

防止：

```text user A
user B
```

覆盖。

---

# 121. Example

```http
If-Match: "revision-12"
```

如果当前是：

```text revision-13
```

返回：

```text 409 Conflict
```

---

# 122. External API Error Model

统一：

```json
{
  "error": {
    "code": "BINDING_CONFLICT",
    "message": "...",
    "details": {},
    "request_id": "...",
    "retryable": false
  }
}
```

---

# 123. Error Categories

至少：

```text AUTHENTICATION_FAILED
AUTHORIZATION_DENIED
VALIDATION_ERROR
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
RESOURCE_UNAVAILABLE
CAPABILITY_UNSUPPORTED
COMMAND_REJECTED
COMMAND_FAILED
DEPENDENCY_UNAVAILABLE
RATE_LIMITED
INTERNAL_ERROR
```

---

# 124. Retryable

每一个 API error 必须明确：

```text retryable=true/false
```

否则外部系统很容易疯狂重试。

---

# 125. Retry-After

需要时：

```http
Retry-After
```

---

# 126. API Contract Compatibility

必须测试：

```text old client
new server
```

至少保证：

> 非破坏字段增加不影响旧客户端。

---

# 127. Contract Test

所有 External APIs 必须有：

```text schema test
serialization test
backward compatibility test
authorization test
idempotency test
retry test
```

---

# 128. Integration Contract Test

每个 Adapter：

```text mock external device
mock external API
failure
timeout
retry
reconnect
```

---

# 129. Device Integration Acceptance

新增：

# `EXT-DEVICE-01`

至少验证：

```text discovery
identity
capability
state
command
error
reconnect
```

---

# 130. External API Acceptance

新增：

# `EXT-API-01`

验证：

```text Query
Command
Event
Authentication
Authorization
Audit
Idempotency
Versioning
```

---

# 131. Webhook Acceptance

新增：

# `EXT-EVENT-01`

验证：

```text delivery
retry
duplicate
signature
replay prevention
ordering/cursor
consumer failure
```

---

# 132. Routing Acceptance

新增：

# `EXT-ROUTING-01`

验证：

```text reserve
route
conflict
rollback
release
```

---

# 133. Integration Failure Acceptance

新增：

# `EXT-FAIL-01`

模拟：

```text external system down
device timeout
authentication failure
webhook unavailable
DNS failure
network partition
```

要求：

> 不得导致 unrelated media runtime failure。

---

# 134. Device Control Acceptance

新增：

# `EXT-CONTROL-01`

验证：

```text unauthorized
authorized
duplicate command
timeout
partial failure
recovery
```

---

# 135. API / Runtime Boundary Gate

新增：

# `ARCH-API-BOUNDARY-01`

要求：

```text External API
      ↓
Control Plane
      ↓
Runtime Contract
      ↓
Rust Media Agent
```

不能：

```text External API
      ↓
Vendor SDK
```

---

# 136. Vendor Neutrality Gate

External API 不得出现：

```text BMD type
GStreamer type
FFmpeg type
PostgreSQL type
Valkey type
```

作为 Canonical Contract。

---

# 137. Provider Extension Boundary

允许：

```json
{
  "extensions": {
    "blackmagic": {}
  }
}
```

但：

> extensions 不得成为主 Graph Schema。

---

# 138. API Capability Negotiation

外部系统可查询：

```text GET /api/v1/capabilities
```

得到：

```text API capabilities
device capabilities
routing capabilities
media capabilities
event capabilities
```

---

# 139. Feature Discovery

不要让外部系统假设：

```text all installations have all features
```

必须支持：

```text FEATURE_UNAVAILABLE
```

---

# 140. External System Federation

如果两个 VBMF 实例互联：

```text VBMF-A
   ↕
 VBMF-B
```

不能直接共享数据库。

应该：

```text API
Events
Integration Adapter
```

---

# 141. Multi-site

未来：

```text Site A
Site B
Site C
```

需要：

```text site_id
```

但不要把：

```text IP address
hostname
```

当 Site Identity。

---

# 142. Site-aware Resource

资源最终可能：

```text Site
 └── Device
      └── Port
```

方便跨机房。

---

# 143. Remote Operation

远程系统可以：

```text query
control
monitor
audit
```

但权限必须按：

```text site
resource
action
```

进行。

---

# 144. Remote BMD/Hardware Management

未来可能出现：

```text Control Plane
  ↓
Remote Media Agent
  ↓
BMD/AJA hardware
```

这种场景。

因此 API 不应该把：

```text localhost
```

作为架构假设。

---

# 145. Agent Registration

未来 Media Agent：

```text REGISTERING
REGISTERED
HEALTHY
DEGRADED
OFFLINE
```

---

# 146. Agent API

内部支持：

```text POST /internal/v1/agents/register
GET /internal/v1/agents
```

但属于：

> Internal API。

---

# 147. Agent Identity

每个 Agent：

```text agent_id
```

必须稳定。

不能使用：

```text PID
container ID
IP
```

作为 canonical identity。

---

# 148. Agent Capability

Agent 需要声明：

```text hardware providers
media backends
encoders
GPU
features
versions
```

例如：

```json
{
  "agent_id": "...",
  "providers": ["blackmagic"],
  "backends": ["gstreamer"],
  "encoders": ["ffmpeg"]
}
```

---

# 149. Agent Capability 不得成为 Graph Semantic

这是 Runtime/Infrastructure capability。

Graph 只消费：

```text Canonical Capabilities
```

---

# 150. External API 与 Agent API 不同

```text External API
= 产品 API

Internal Agent API
= Runtime Control API

Diagnostics API
= Engineering API
```

三者不能混用。

---

# 151. API Gateway

继续保持：

```text Nginx
 ↓
Fastify
```

作为 Edge。

---

# 152. Nginx 不负责业务授权

Nginx 可以：

```text TLS
routing
rate limiting
IP filtering
```

但：

> 最终 authorization 在应用层。

---

# 153. API Gateway 不直接连接设备

正确：

```text Nginx
→ Fastify
→ Adapter
```

不允许：

```text Nginx
→ Vendor API
```

---

# 154. External Device Protocol Isolation

例如：

```text ONVIF
SNMP
NMOS
GPI
HTTP
```

均不能进入：

```text Domain
Graph
Supervisor
```

---

# 155. Event Bus 不等同于 Message Queue

不要因为需要 Event API 就立即增加：

```text Kafka
NATS
RabbitMQ
```

第一阶段：

```text Fastify event dispatcher
```

即可。

---

# 156. Webhook Delivery Queue

可以使用已有：

```text Valkey
```

作为内部异步基础设施。

不得因为 Webhook 再增加新的 MQ。

---

# 157. External Integration Registry Storage

当前可采用：

```text PostgreSQL
```

存：

```text Integration
Endpoint
Subscription
Audit
External Device
```

但 Domain Repository 仍然保持抽象。

---

# 158. API Data Plane / Control Plane

External API 默认只操作：

```text Control Plane
```

实时媒体数据：

```text RAW_VIDEO
RAW_AUDIO
Encoded Stream
```

不能通过 REST API 传。

---

# 159. Media Data Transport

真正媒体使用：

```text GStreamer
FFmpeg
SRT
RIST
RTP
RTMP
WebRTC
```

等 Media Transport。

API 只交换：

```text metadata
control
state
configuration
```

---

# 160. Large File / Artifact API

不能通过 JSON API 上传大视频。

应该：

```text presigned URL
object storage
```

当前 RustFS/S3-compatible storage。

---

# 161. Artifact API

例如：

```text POST /api/v1/artifacts/upload-session
```

返回：

```text presigned URL
```

---

# 162. Chunk Upload

大文件支持：

```text resumable upload
chunk
checksum
resume
```

---

# 163. Artifact Identity

使用：

```text artifact_id
```

不要用：

```text object path
filename
```

作为业务 Identity。

---

# 164. External Recording Integration

外部系统请求：

```text Start Recording
```

必须：

```text Command
→ Session
→ Runtime
```

Recording Artifact 通过：

```text Event
```

通知外部系统。

---

# 165. External Playback Integration

外部系统可以查询：

```text asset
playback endpoint
```

但不要把：

```text RustFS path
```

暴露成业务 URI。

---

# 166. API URI Stability

用户/外部系统看到：

```text /api/v1/assets/{artifact_id}
```

而不是：

```text /rustfs/bucket/path
```

---

# 167. Event Schema Stability

事件必须可以：

```text schema_version
```

演进。

---

# 168. Event Consumer Compatibility

新字段默认：

> additive。

删除字段需要：

> major version。

---

# 169. External API Documentation

必须生成：

```text OpenAPI
JSON Schema
Event Schema
Command Catalog
Adapter Catalog
```

---

# 170. API Explorer

工程环境允许：

```text Swagger UI
ReDoc
```

生产环境默认关闭或需要认证。

---

# 171. API Sandbox

未来可以提供：

```text simulation environment
```

外部开发者可以：

```text create simulated device
simulate signal
start session
receive event
```

不需要真实 BMD。

---

# 172. Developer Experience

外部开发团队应能：

```text obtain API schema
create token
discover capabilities
execute sample command
subscribe event
```

---

# 173. Integration Test Environment

提供：

```text Mock External System
Mock Device
Mock Webhook Receiver
```

---

# 174. API SDK Generation

第一阶段优先：

```text TypeScript
Python
```

自动生成。

---

# 175. Integration Certification

未来第三方 Adapter 必须有：

```text contract suite
certification version
```

---

# 176. Adapter Versioning

每个 Adapter：

```text adapter_id
version
protocol_version
capability_version
```

---

# 177. Device Firmware

External Device evidence 应记录：

```text firmware_version
hardware_revision
protocol_version
```

---

# 178. Compatibility Matrix

维护：

```text Adapter
Device
Firmware
Protocol
VBMF version
```

兼容关系。

---

# 179. Integration Upgrade

更新 Adapter：

```text old
→ new
```

不能直接改变：

```text Domain semantics
```

---

# 180. Security Event

External API 必须生成：

```text AUTH_FAILED
AUTHZ_DENIED
TOKEN_REVOKED
WEBHOOK_SIGNATURE_FAILED
ADAPTER_AUTH_FAILED
```

---

# 181. Security Audit

安全事件和普通 Runtime Event 分开：

```text SecurityEvent
RuntimeEvent
AuditEvent
```

---

# 182. External Event Filtering

消费者可以订阅：

```text event_type
device_id
port_id
session_id
site_id
```

避免全部事件广播。

---

# 183. Privacy / Data Minimization

External API：

> 默认最少暴露内部实现。

例如：

```text vendor diagnostics
raw logs
```

默认不返回。

---

# 184. Diagnostics Scope

Diagnostics 必须有：

```text engineering scope
permission
audit
```

---

# 185. Raw Device API

只有 Engineering/Diagnostics：

```text GET /diagnostics/v1/devices/{id}/raw
```

允许。

普通 Operator API 禁止。

---

# 186. External API 与 UI API 可以共享 Contract

但：

> UI Backend-for-Frontend 可以有自己的 API。

不要强迫 UI 与第三方系统共享完全相同的 payload。

---

# 187. BFF

推荐：

```text External API
Canonical Product API

UI BFF
Operator UI optimized API
```

二者分离。

---

# 188. UI 不应该调用 Provider Adapter

UI：

```text API
```

Provider：

```text backend
```

永不直接连接。

---

# 189. External Integration 不修改 Phase 0.5 Core UX

Phase 0.5 继续：

```text Operator workflow
Explain Why
Impact Preview
ChangeSet
Audit
```

External API 只是另一种操作入口。

---

# 190. API Command 必须经过相同 ChangeSet/Preflight

如果操作等价于 UI 操作：

> API 与 UI 必须执行同一业务规则。

不能：

```text UI → Preflight
API → direct DB
```

---

# 191. Source-of-Truth

必须明确：

```text Graph SoT
Hardware Discovery SoT
Provisioning SoT
Runtime SoT
External Integration SoT
Audit SoT
```

第三方系统的数据不能自动成为 VBMF SoT。

---

# 192. External Integration Architecture

最终：

```text
                        External Systems
                              │
              ┌───────────────┼───────────────┐
              │               │               │
           REST/API         Events          Devices
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                  External Integration Plane
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          API Gateway     Event Dispatcher   Adapters
              │               │               │
              ▼               ▼               ▼
          Fastify       Webhook/SSE/WS     ONVIF/SNMP/
              │                             NMOS/GPIO/
              │                             REST...
              ▼
        Canonical Control Contract
              │
       ┌──────┴───────┐
       │              │
   Control Plane   Runtime
                       │
                     Rust
```

---

# 193. API 层次

必须形成：

```text
External Product API
        ↓
Internal Control API
        ↓
Runtime Command/Event
        ↓
Provider/Backend
```

---

# 194. API 不能成为第二套 Domain

API schema：

> 映射 Domain。

不是：

> 再定义一套自己的 Device/Port/Session 模型。

---

# 195. Canonical API Objects

至少：

```text Device
Port
Capability
Resource
Session
Binding
Signal
Content
Stream
Artifact
Command
Event
Integration
ExternalDevice
Route
```

---

# 196. 最重要的“不要做”

严格禁止：

```text External API
   ↓
BMD SDK

External API
   ↓
GStreamer

External API
   ↓
FFmpeg CLI

External API
   ↓
PostgreSQL

External API
   ↓
Valkey

External API
   ↓
Docker
```

---

# 197. 外部系统不能直接控制进程

禁止：

```text API → kill process
API → spawn ffmpeg
API → docker restart
```

正确：

```text Command
→ Runtime Policy
→ Supervisor
```

---

# 198. 外部系统不能直接控制 Supervisor

External：

```text recover session
```

而不是：

```text restart process
trip breaker
reset backoff
```

这样保持职责边界。

---

# 199. External API 与 Supervisor

正确：

```text API
→ Session Command
→ Runtime
→ Failure/Recovery policy
```

Supervisor 自己决定：

```text Restart
Backoff
Escalate
ManualRequired
```

---

# 200. 最终 API PRD 验收标准

## EXT-API-01

第三方系统可以：

```text query
create command
track command
receive event
```

---

## EXT-DEVICE-01

第三方设备可以：

```text discover
observe
command
recover
```

---

## EXT-ROUTING-01

外部 Router/Matrix 可以：

```text discover
route
verify
rollback
```

---

## EXT-EVENT-01

Webhook：

```text retry
signature
duplicate
ordering
consumer failure
```

全部正确。

---

## EXT-SEC-01

验证：

```text authentication
authorization
audit
rate limit
replay prevention
```

---

## ARCH-API-BOUNDARY-01

验证：

```text API
≠
Vendor SDK
≠
Runtime implementation
```

---

# 201. 最终 Definition of Done

本 PRD 完成后必须做到：

### DOD-01

外部系统可以通过稳定 Canonical API 控制 VBMF。

### DOD-02

外部系统不需要知道 BMD/AJA/GStreamer/FFmpeg。

### DOD-03

外部事件不会阻塞 Media Runtime。

### DOD-04

外部设备故障不会直接污染无关 Media Session。

### DOD-05

所有 External Commands 支持幂等/审计/权限。

### DOD-06

所有 Event 可关联、可版本化。

### DOD-07

所有 Provider/Protocol 实现位于 Adapter。

### DOD-08

Graph/Session/Resource/Device/Port 使用 Canonical ID。

### DOD-09

API 与 UI 执行相同的 Preflight/ChangeSet 规则。

### DOD-10

第三方新增 Adapter 不需要修改 Canonical Domain。

---

# 202. 推荐第一批 API

第一阶段不必一次做全部，建议先实现：

```text
GET  /api/v1/capabilities

GET  /api/v1/devices
GET  /api/v1/devices/{id}

GET  /api/v1/ports
GET  /api/v1/ports/{id}

GET  /api/v1/sessions
GET  /api/v1/sessions/{id}

POST /api/v1/sessions

POST /api/v1/sessions/{id}/start
POST /api/v1/sessions/{id}/stop
POST /api/v1/sessions/{id}/recover

GET  /api/v1/commands/{id}

GET  /api/v1/events/stream

POST /api/v1/event-subscriptions
GET  /api/v1/event-subscriptions

GET  /api/v1/integrations
GET  /api/v1/external-devices
```

---

# 203. 第二批 API

进入 Routing/Recording 后：

```text
GET/POST /api/v1/routes
GET/POST /api/v1/resource-reservations

POST /api/v1/recordings
GET  /api/v1/recordings/{id}

GET /api/v1/artifacts/{id}
POST /api/v1/artifacts/upload-session
```

---

# 204. 第三批 API

成熟后：

```text
PTZ
Tally
GPIO
SNMP
NMOS
Remote Agent
Multi-site
Cross-VBMF federation
```

---

# 205. API 技术栈

继续保持当前技术栈：

```text Nginx
   ↓
Fastify
   ↓
Zod / JSON Schema
   ↓
Rust Runtime
```

不要因为 API 需求重新引入：

```text GraphQL
gRPC everywhere
Kafka
NATS
RabbitMQ
```

除非真实需求证明必要。

---

# 206. REST vs RPC

原则：

### REST

用于：

```text Query
Resource
Configuration
Inventory
```

### Command RPC

用于：

```text Start
Stop
Recover
Route
Verify
```

### Event

用于：

```text State changes
Notifications
Runtime observations
```

不要试图用一种协议解决所有问题。

---

# 207. API Gateway / External Security

生产：

```text Internet/External Network
        ↓
Firewall
        ↓
Nginx
        ↓
Auth
        ↓
Fastify
```

Media Agent 不暴露到公网。

---

# 208. Internal Agent API

```text Fastify
  ↓
Private network
  ↓
Rust Media Agent
```

必须：

```text mTLS / authenticated channel
```

最终落地方式可按当前环境确定。

---

# 209. API Availability

External API 不应直接依赖：

```text GStreamer availability
```

查询设备失败时：

> API 自身仍应返回结构化状态。

---

# 210. 最终 External Integration 模型

```text
                  ┌──────────────────────────────┐
                  │      External Systems        │
                  │                              │
                  │ CMS / NMS / Router / PTZ    │
                  │ Automation / Broadcast      │
                  └──────────────┬───────────────┘
                                 │
                         API / Event / Protocol
                                 │
                  ┌──────────────▼───────────────┐
                  │ External Integration Plane   │
                  │                              │
                  │ API Gateway                  │
                  │ Command Manager              │
                  │ Event Dispatcher             │
                  │ Integration Registry         │
                  │ Adapter Registry              │
                  └──────────────┬───────────────┘
                                 │
                         Canonical Contracts
                                 │
                  ┌──────────────▼───────────────┐
                  │        Control Plane         │
                  │                              │
                  │ Auth / RBAC / Preflight     │
                  │ ChangeSet / Compiler        │
                  └──────────────┬───────────────┘
                                 │
                         Runtime Contract
                                 │
                  ┌──────────────▼───────────────┐
                  │        Media Runtime         │
                  │                              │
                  │ Session / Resource / Lease  │
                  │ Pipeline / Health / Events  │
                  └──────────────┬───────────────┘
                                 │
                      Provider / Backend SPI
```

---

# 211. 最终架构原则

永久坚持：

```text
API
≠
Domain
≠
Runtime
≠
Provider
≠
Backend
≠
External Protocol
```

以及：

```text
External System
≠
Source of Truth
```

除非通过明确的 Federation / Configuration Ownership Policy 授权。

---

# 212. 最终战略目标

VBMF 最终应该做到：

```text
任何系统
      ↓
Canonical API
      ↓
VBMF Control Plane
      ↓
Canonical Runtime
      ↓
任意兼容 Provider / Backend / Device
```

而不是：

```text
CMS → BMD API
NMS → GStreamer
Router → Rust internals
PTZ → Fastify private code
```

---

# 213. 最终一句话

**VBMF 的对外接口必须是“媒体资源与运行语义 API”，而不是“设备厂商 API 的代理层”。**

---

# 214. 本阶段建议优先级

## P0

```text External Product API
Command Model
Event Model
API Versioning
Authentication
Authorization
Audit
Idempotency
Canonical Error
OpenAPI
```

## P0.5

```text Integration Registry
Webhook
WebSocket/SSE
External Device Adapter Contract
Remote Agent Contract
```

## P1

```text Routing Adapter
NMOS
ONVIF
SNMP
GPIO/Tally
Resource Reservation API
Recording/Artifact API
```

## P2

```text Multi-site
Cross-VBMF federation
Advanced event replay
Generated SDK distribution
External workflow marketplace
```

---

# 215. 与当前 Runtime Abstraction PRD 的关系

两份 PRD 必须一起成立：

```text Runtime Abstraction PRD
        ↓
内部“怎么实现”

External Integration API PRD
        ↓
外部“怎么使用”
```

两者之间唯一正式边界：

```text Canonical Contracts
```

**External API 不得绕过 Runtime Abstraction，也不得了解 Provider/Backend 实现。**

---

# 216. 最终实施要求

请将本 PRD 作为独立工作流，不与 BMD Provider、GStreamer Backend、HW-PORT-01A 实现混写。

实现顺序：

```text
1. Canonical API Object Contract
2. Command Contract
3. Event Contract
4. Error Contract
5. Auth/RBAC
6. Idempotency
7. Audit
8. OpenAPI
9. Mock External Client
10. External Device Adapter SPI
11. Webhook/Event Delivery
12. Internal Node↔Rust integration
13. API Boundary Gate
14. External Integration Acceptance
```

完成后，第三方系统应当能够在**完全不知道 BMD、AJA、GStreamer、FFmpeg、PostgreSQL、Valkey、Docker 内部实现细节**的情况下使用 VBMF。

同时，任何新增外部协议或设备品牌，都只能增加：

```text Adapter
Contract
Capability Mapping
Evidence
```

不能反向污染：

```text Canonical Domain
GraphRuntimeIntent
Session
Resource
Supervisor
Health
UI Semantic Model
```

这份 PRD 与前面的 Runtime Abstraction PRD 配合后，VBMF 的边界才算真正完整：**内部解决“可替换”，外部解决“可集成”，中间通过 Canonical Contract 严格隔离。**