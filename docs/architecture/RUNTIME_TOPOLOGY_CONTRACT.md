# RUNTIME_TOPOLOGY_CONTRACT — 媒体拓扑契约

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.6, P0.5）（**状态订正 2026-11-27 · 对账确认**）：gap matrix `Topology` 行 = IMPLEMENTATION `NOT_STARTED` / VERIFICATION `NOT_VERIFIED` ⇒ **与本行一致，无需订正**；GATE = `ARCH-TOPOLOGY-01` = `PENDING`。
> 来源：用户 Final Hardening 审查（2026-08-28）第 ⑥ 优先项（#二十四/#二十五：PhysicalConnection / LogicalRoute / Topology 缺失）。
> 关联：`CANONICAL_MEDIA_MODEL.md`、`RUNTIME_RESOURCE_MODEL.md`、`IMPLEMENTATION_ADDENDUM.md`、`CANONICAL_IDENTITY.md`

## 1. 定位

Topology 描述**设备/资源之间如何连接**。它是独立于 `Resource`（可消耗实体）与 `Binding`（Physical→Provider→Runtime 关联）的第三类关系模型。

- **不实现** Router Scheduler / 自动路由计算（留 P1/P2）。
- 仅冻结模型，使 External Routing / HW Loopback / Multi-device Graph 不再重新造拓扑模型。

## 2. 核心实体

```
TopologyNode       — 拓扑节点（Device / Port / Router / Matrix / Capture / Output / Normalizer）
TopologyEdge       — 节点间有向连接（含 Physical / Logical 两种）
PhysicalConnection — 物理接线（线真的接在哪里）
LogicalRoute       — 系统当前要求怎么走（业务意图）
```

## 3. PhysicalConnection vs LogicalRoute（必须区分）

| 概念 | 含义 | 示例 |
|---|---|---|
| `PhysicalConnection` | 线真的接在哪里 | SDI cable：Output-Port-1 → Input-Port-2 |
| `LogicalRoute` | 系统现在要求怎么走 | Program → Router Input 8 |

- 二者**不得**混成一个 Route。
- `PhysicalConnection` 的「事实来源」由 `TopologyEvidence`（`DECLARED`/`OBSERVED`/`INFERRED`/`VERIFIED`/`UNKNOWN`，见 §6.1）显式标注，**不得默认「观测」或「配置」**；`LogicalRoute` 是运行意图（由 Control Plane / Routing 决策产出）。
- 设备更换 → `PhysicalConnection` 变化；业务切播 → `LogicalRoute` 变化；两类变更独立建模。

## 4. 拓扑模型（只定义，不实现 Scheduler）

```
Topology
├── nodes:    Vec<TopologyNode>
├── physical: Vec<PhysicalConnection>   // 线接事实
└── routes:   Vec<LogicalRoute>          // 业务意图

TopologyNode
├── id:     NodeId
├── kind:   Device | Port | Router | Matrix | Capture | Output | Normalizer
└── refs:   Vec<CanonicalId>            // 指向 DeviceId / PortId / ResourceId

PhysicalConnection
├── from:   NodeId
├── to:     NodeId
└── medium: SDI | HDMI | OpticalSDI | Component | Composite | SVideo | IP | AES | MADI | Dante

LogicalRoute
├── from:      NodeId
├── to:        NodeId
├── intent:    Program | Preview | Clean | Backup
└── constraint: 互斥 / 优先级 / 回滚
```

示例：

```
Camera ──SDI──▶ SDI Router ──SDI──▶ Capture Card (Duo ChA)
Capture ──▶ Normalize ──▶ Router ──▶ Output Card (Duo ChB)
```

## 5. 与 Resource / Binding 关系

- `Resource` = 可消耗实体（Capacity / Availability / Allocation）。
- `Binding` = Physical→Provider→Runtime 关联。
- `Topology` = 连接关系（谁接到谁）。
- 三者正交：申请一个 Port Resource 占用 Capacity；Topology 描述该 Port 的物理来向；Binding 描述它如何映射到 Runtime。

## 6. Canonical 约束

- 拓扑表达**不得**泄露 vendor：用 `SDI`/`HDMI`/`OpticalSDI`/`IP`，**不**用 `/bmd`/`/gstreamer` 表示节点类型。
- 替换轴（Hardware Vendor / Backend）变化不改变 Topology 模型，仅改变 Node 的 `refs`（指向新的 `DeviceId`）。

## 6.1 TopologyEvidence（TD-08，可信来源）

`PhysicalConnection` 是「线真的接在哪里」，但软件如何知道线接哪？来源须显式标注：

```
DECLARED   — operator 声明 / Manifest
OBSERVED   — 硬件探针 / EDID / SDI signal correlation
INFERRED   — router telemetry / NMOS 推导
VERIFIED   — 多源交叉验证一致
UNKNOWN    — 无法确定
```

- `PhysicalConnection.evidence: TopologyEvidence` 必填；`UNKNOWN` 时禁止把 LogicalRoute 当成已验证 PhysicalConnection。
- 明确区分：**Physical topology 是「配置」还是「观测」由 `evidence` 字段回答，不得默认。**

## 6.2 时间维度（TD-09）

```
PhysicalConnection = 相对稳定事实（换卡/改线才变）
LogicalRoute       = 随时间变化的状态（08:00 Route A / 12:00 Route B）
```

- 数据模型**不得假设** `LogicalRoute` 永远静态；未来 Playout / Routing / Scheduling 会改变 `LogicalRoute`，但 `PhysicalConnection` 不变。
- 当前仅冻结模型，不做 Schedule（留 P1/P2）。

## 7. 验收

- `ARCH-TOPOLOGY-01`：**Contract = FROZEN**；**Implementation = NOT_STARTED / PARTIAL**；**Acceptance = PENDING**（状态词见 `DOCUMENT_STATUS_MODEL.md`）。Topology 模型独立于 Resource/Binding，PhysicalConnection 与 LogicalRoute 可分可合，不混为一物。
- External Routing（`EXT-ROUTING-01`）消费 `LogicalRoute`，不重建拓扑模型。
