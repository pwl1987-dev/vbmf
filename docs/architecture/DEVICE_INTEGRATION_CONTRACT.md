# DEVICE_INTEGRATION_CONTRACT（设备集成契约）

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.7/P1，部分 P2）（**状态订正 2026-11-27 · 对账确认**）：Acceptance Matrix `EXT-DEVICE-01` = **P1（未实现）** ⇒ **VERIFICATION = `NOT_VERIFIED` 与本行一致，无需订正**。
> 来源：API PRD #87–#107, #140–#150, #154；问题点 (D)(E)
> 关联：`EXTERNAL_API_CONTRACT.md`、`EVENT_CONTRACT.md`、`VENDOR_NEUTRALITY_RULES.md`

## 1. Integration 对象（#87）
Integration / IntegrationEndpoint / ExternalDevice / ExternalSystem / Adapter / Subscription / CredentialReference
> 归属：**Control Plane**，非 Runtime Domain（问题点 D：PG 存 Integration 不违反 Domain Repository 抽象）

## 2. Integration 生命周期（#89）
`DRAFT → CONFIGURED → VALIDATING → CONNECTED → DEGRADED → DISCONNECTED → DISABLED`

## 3. Integration Health（#90）
独立于 Media Health；SRS=BMD input=CMS integration 三者不得合并成单 Status。

## 4. Adapter 边界（#101/#107）
- Adapter 只 execute/observe/report，**不得**改 Graph / Channel / 决定 Failover
- 业务策略在 Policy 层，不在 Adapter（#106/#107）
- SNMP Adapter→event→Policy→Command（非直接 switch source）

## 5. Device Identity / Port（#93/#94）
- 不依赖 IP / hostname / MAC；用 stable device identity + 记录 identity strength
- `external_port_id` ≠ TCP/UDP port / HTTP endpoint

## 5.1 External System / Endpoint Identity（#26/#87）
- 外部系统用 `external_system_id` / `integration_id` / `endpoint_id`，**禁止用 URL / IP / hostname 作主身份**（与 `CANONICAL_IDENTITY.md` 一致）。
- CMS / NMS / Router / 另一个 VBMF 都是 ExternalSystem，各持稳定 `external_system_id`。

## 5.2 Integration Direction（#27）
- `direction`：`INBOUND`（外部→VBMF，如 CMS 下发）/ `OUTBOUND`（VBMF→外部，如 NMS 上报）/ `BIDIRECTIONAL`（如 Router 双向）。
- 每条 Integration 显式声明 direction；双向需双向 health/conflict 处理。

## 5.3 Device Capability / Permission 层级（#29/#30）
- **Device Capability**：`Observe`（仅观测）/ `Control`（可控）/ `Configure`（可配）。Capture Card 可能只 Observe；Router 可 Observe+Control；Camera 可 Observe+Control+PTZ。
- **Permission**（API 层，实现留 P1）：`Device Read` / `Device Observe` / `Device Control` / `Routing Control` / `Session Control` / `Diagnostics`。只读信号者不得获 Switch 权限。

## 6. Routing（#95–#98）
- SDI router / Audio matrix / IP routing 统一进 Routing Adapter
- Route 生命周期：`REQUESTED → VALIDATING → RESERVED → APPLYING → ACTIVE → FAILED → ROLLING_BACK → RELEASED`
- 冲突检测：两系统不得同时 route same destination 互相覆盖（#98）

## 7. Protocol Isolation（#154）
- ONVIF / SNMP / NMOS / GPI / HTTP 不得进入 Domain / Graph / Supervisor

## 8. Multi-site / Agent（#140–#150，P2）
- 两 VBMF 互联经 API / Event / Adapter，**不共享数据库**（#140）
- Site Identity 用 `site_id`，非 IP / hostname（#141/#142）
- Agent：`REGISTERING → REGISTERED → HEALTHY → DEGRADED → OFFLINE`；`agent_id` 稳定，非 PID/container/IP（#145–#147）
- External API / Internal Agent API / Diagnostics API 三平面不混（#150）

## 9. Acceptance
- `EXT-DEVICE-01`（discovery/identity/capability/state/command/error/reconnect）
- `EXT-CONTROL-01`（unauthorized/authorized/duplicate/timeout/partial/recovery）
- `EXT-ROUTING-01`（reserve/route/conflict/rollback/release）
