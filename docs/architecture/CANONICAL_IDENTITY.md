# CANONICAL_IDENTITY — Canonical 身份标识契约

> **[实现落地注记 2026-08-29, p06-final-merge-hardening]** §4 已在实现侧收口 (P0-1):
> `DeviceInfo` (Canonical Domain) 不再携带 `bmd_persistent_id`/`bmd_device_handle`/`bmd_topological_id`;
> 证据随 `DiscoveredDevice.identity` (`contracts::provider::ProviderIdentity`, SPI 层) 配对输出,
> 仅由 Provider Identity Adapter (`resolver`/绑定路径) 消费。
> 持久化证据文件 (DeviceBindingManifest / ResolverEvidence JSON) 的 `bmd_device_handle` **键名保留**
> —— 它们是宿主证据/诊断输出, 非 Domain schema。


> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.6, P0）（**状态订正 2026-11-27 · gap matrix `Canonical Identity` 行**）：IMPLEMENTATION = `PARTIAL`；VERIFICATION = **`HARDWARE_VERIFIED`**（依据 `HW-IDENT-02` 真机 PASS，证据 `evidence/bmd-10.30.15.10/hw-ident-02/`）；GATE 以 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 为准。**边界**：本节 `ARCH-PORTABILITY-01` 的 **BMD→AJA 真实换型**判据**仍未验收**（2026-11-27 的 PASS 只证明「删 concrete adapter 后 Domain/Contracts/Runtime 仍可编译」）。
> 来源：API PRD 评审 §3.5-P（#93/#94/#147 与 Portability #8/#11 应共享"稳定身份"定义）；用户 Final Hardening 审查（2026-08-28）第 ①/② 优先项。
> 关联：`CANONICAL_MEDIA_MODEL.md`、`HARDWARE_PROVIDER_CONTRACT.md`、`RUNTIME_SESSION_MODEL.md`、`DEVICE_INTEGRATION_CONTRACT.md`

## 1. 核心判据（用户审查第 ①/② 项）

> **Provider Identity ≠ Canonical Identity。**
>
> `DeviceHandle` / `PersistentId` / `TopologicalId` / `SDK GUID` 本质是 **Provider-specific identity mechanism**，不是 VBMF Canonical Identity。
> BMD 的 `DeviceHandle` 是当前硬件非常好的稳定身份，但**不能因此把 BMD 的身份机制升级成 VBMF 的 Canonical Identity**——否则 AJA 的 serial/UUID 来了又得改 Canonical Domain。

正确模型：

```
Provider Identity (vendor-specific)
        ↓  Provider Identity Adapter
Canonical DeviceId
        ↓
Domain 只知道 DeviceId + IdentityStrength
```

## 2. Canonical ID Vocabulary（统一命名）

| Canonical ID | 类型形态 | 说明 |
|---|---|---|
| `DeviceId` | `struct DeviceId(String)` | 设备稳定身份（经 Provider Adapter 映射，非 vendor handle） |
| `PortId` | `struct PortId(String)` | 端口稳定身份 |
| `SessionId` | `struct SessionId(Uuid)` | 会话身份，**独立**于硬件 PersistentId |
| `ResourceId` | `struct ResourceId(String)` | 逻辑资源身份 |
| `BindingId` | `struct BindingId(String)` | Runtime Binding 身份 |
| `LeaseId` | `struct LeaseId(String)` | Lease 身份 |
| `PipelineId` | `struct PipelineId(String)` | Pipeline 身份（opaque handle） |
| `IntegrationId` | `struct IntegrationId(String)` | 外部集成身份 |
| `AgentId` | `struct AgentId(String)` | 外部 Agent 身份（非 PID/container/IP） |
| `EndpointId` | `struct EndpointId(String)` | 集成端点身份 |
| `CommandId` | `struct CommandId(Uuid)` | 幂等命令身份 |

- 所有 Canonical ID **必须**用新类型包裹（`struct XxxId(...)`），禁止裸 `String`/整数作主身份（防止 device-number / PID / IP 泄漏成业务主身份）。
- `SessionId` 用 `Uuid`，**绝不使用**硬件 `PersistentId` 作 Session 身份（见 `RUNTIME_SESSION_MODEL.md`）。

## 3. Identity 属性（统一维度）

| 属性 | 取值 | 说明 |
|---|---|---|
| `IdentityStrength` | `Declared` / `Topological` / `Persistent` / `Verified` | 身份置信度（与 `VerificationLevel` 对应，不混淆） |
| `IdentitySource` | `ProviderAdapter` / `Manifest` / `Discovery` / `Enumeration` | 身份来自哪一层 |
| `IdentityScope` | `Device` / `Port` / `Resource` / `Session` / `Integration` | 身份作用域 |
| `IdentityStability` | `Ephemeral` / `Session` / `Persistent` / `Permanent` | 跨重启/跨进程稳定性 |

## 4. Provider Identity（vendor-specific，非 Canonical）

Provider 内部可使用任意厂商机制，**但必须经由 Provider Identity Adapter 映射为 Canonical `DeviceId`**：

| Provider | Provider Identity 机制 | 映射 |
|---|---|---|
| BMD (Blackmagic) | `DeviceHandle`（经 `IDeckLinkProfileAttributes::GetString(BMDDeckLinkDeviceHandle)`） | → `DeviceId` + `IdentityStrength` |
| AJA | `Serial` / `UUID` / SDK GUID | → `DeviceId` |
| Vendor X | PCIe persistent ID | → `DeviceId` |

- Canonical Domain **只知道** `DeviceId` + `IdentityStrength` + `IdentitySource`。
- `PersistentId` / `TopologicalId` / `DeviceHandle` 是 Provider 层概念，可在 evidence / provider-host 层出现，**不得**出现在 Canonical Domain / Graph / UI schema。
- **Provider-local Identity Precedence（非 Global）**：每个 Provider **自行定义**其内部身份证据优先级（如 BMD 可能为 `DeviceHandle > PersistentId > TopologicalId > EnumerationOnly`；AJA 可能为 `Serial > UUID`；某厂商可能仅 `Slot`）。**不存在跨 Provider 的统一「全球优先级」**——所有 Provider 只负责把自身证据收敛为 `(provider, provider_identity)` 二元组，交由统一的 `Provider Identity Adapter` 生成 Canonical `DeviceId`。这避免「`PersistentId` 全球优先」在 AJA 无 `PersistentId` 时失效。

## 5. 失败闭合

- Identity / Capability / Binding 冲突必须拒绝；绝不盲开 device 0 / 自动换卡。
- `device-number` 仅是运行时地址，**绝不**作为业务主身份，绝不默认 0。
- 多重 HIGH 身份 → `Ambiguous`（拒）；Unresolved → `IdentityUnresolved`。

## 5.1 Port 身份层级（TD-06）

`PortId` 稳定身份来源须分层，且 **`Unknown` 时禁止伪造稳定 `PortId`**：

```
Provider Port Ref        — Provider 暴露的原始端口引用（如 BMD `SDLINK_PCIe#0/ChA`、GStreamer `device-number+ordinal`）
        ↓
Stable Hardware Port Identity  — Provider 内部稳定端口标识（同一物理口长期不变）
        ↓
Provisioned Port Identity     — 配置/Manifest 显式声明的端口（operator 命名）
        ↓
Derived Port Identity         — 由 Device+ordinal 推导（回退用，置信度低）
        ↓
Unknown                        — 无法确定 → 禁止分配 PortId，fail-closed
```

- 对 Router / Matrix / 多功能 I/O 卡，`connector + ordinal` 不一定稳定，必须以上述链路推导，不得假设。
- `Unknown` 端口宁可拒绝建 Session，也不得编造 `PortId`（否则破坏 Canonical 稳定性）。

## 7. Canonical DeviceId / PortId 生成规则（TD-04，冻结）

- **namespace**：固定 UUIDv5 namespace（`VBMF_DEVICE`），所有 Provider 共用；Provider 差异由输入字符串体现，不靠 namespace 区分。
- **normalization**：Provider identity 字符串先 `trim` + `lowercase`（如 BMD `d182cb5` 归一为 `d182cb5`）；大小写不同视为同一设备，防 `D182CB5` ≠ `d182cb5` 误判新设备。
- **canonicalization**：`DeviceId = uuid5(namespace, "<provider>:<provider_identity>")`；**显式带 `<provider>` 前缀**，使 BMD `X` 与 AJA `X` 不产生同 ID。
- **collision handling**：相同 `(provider, provider_identity)` 必产相同 `DeviceId`；不同者必不同（UUIDv5 性质保证）。若两 Provider 报相同 canonical 字符串（异常），以 `IdentitySource` + `IdentityStrength` 仲裁，**拒绝**自动合并。
- **migration / replacement**：物理换卡（同 slot 换卡）→ 若 Provider identity 不变则 `DeviceId` 不变（平滑替换）；若 Provider identity 改变（如换 AJA）→ 新 `DeviceId`，旧 `DeviceId` 进入 `DEPRECATED`/`REPLACED_BY` 关联，由 Control Plane 做 resource rebind，**不静默复用**。
- **PortId**：同理 `uuid5(namespace, "<provider>:<device_provider_identity>:<port_ref>")`；`port_ref` 取 Provider Port Ref。

## 6. 验收

- `HW-IDENT-02`：稳定身份（非 device-number）在 Canonical 层以 `DeviceId` 表达。
- `ARCH-API-BOUNDARY-01`：External API 暴露 `DeviceId`/`PortId`，**不**暴露 `DeviceHandle`/`PersistentId`/vendor handle。
- `ARCH-PORTABILITY-01`：换 BMD→AJA，Domain 仅见 `DeviceId`，零变化。
