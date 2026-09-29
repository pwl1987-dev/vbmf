# HEALTH-INCIDENT-ENTRY-01 — Planning / Reconciliation（2026-09-29 冻结）

> 性质：Alarm / Incident 最小专业闭环的 entry planning（PRODUCTION-READINESS-ENTRY-01 链第 5 环）。
> 用户 2026-09-29 指令 §13–§16 为 Authority。本文档不改 frozen V0.2（V0.2 §5 `incidents` 表 +
> X4 Incident Timeline 本就是架构内模型）；不改 Runtime 决策语义。

## 1. 红线（先于一切设计）

1. **Runtime owns truth**：Alarm/Incident 只能观察和记录 canonical Runtime facts。禁止第二
   Runtime 状态机；禁止 alarm 引擎决定媒体生命周期。Recovery 仍归 Runtime / Supervisor /
   canonical command。
2. **ACK = operator awareness state only**。ACK 绝不解释为 Runtime healthy / 故障消失 /
   恢复完成；UI 必须把 acked-alarm 与 active-fault 的 Runtime 真实状态并列展示。
3. 派生链唯一方向：`RuntimeEvent / Supervisor decision / Health projection /
   Command-Audit-Event evidence → Alarm/Incident projection → Fastify Product API → SDK →
   Web Console`。反向禁止。
4. 不做视觉大改版；Alarms/Incidents 是 Web Console 新增专业页，不是 UI 重写。

## 2. Reality Review（live `main` @ `ec5fc68`）

### 2.1 Runtime 侧（事件源——已充分，无需 Runtime 改动）

`services/media-agent/src/events.rs` RuntimeEvent 16 kinds，两级 severity
（Observation / Critical，Critical 不可被日志挤出），三源（Upstream/Supervisor/Operator）：

| 类别 | Kind | Alarm 派生语义 |
|---|---|---|
| Critical | `PipelineFault{pipeline, summary, retryable}` | retryable=true → warning + auto-recovery 轨道；false → error |
| Critical | `HardwareFault{device_id, summary}` | error + manual_required |
| Critical | `AmbiguousIdentity{device_id, candidates}` | error + manual_required（fail-closed 拒识） |
| Critical | `SessionFailed{session_id, reason}` | error + related session |
| Observation | `HealthChanged{from,to}` | 投影（clear 判定输入，不直接成 alarm） |
| Observation | `SessionStateChanged{from,to}` / `SessionCreated` | related session 时间线与 clear 判定输入 |
| Observation | `ResourceReservationExpired` | warning（预留过期自动回收） |
| 其余观测 | IdentityResolved/SourceMaterialized/SignalVerified/LoopbackVerified/LeaseGranted/ResourceAllocated | evidence/时间线素材 |

- Supervisor 决策（Restart/Escalate + backoff + 熔断）与 watchdog（单输入 acceptance
  A1-C4 折叠 / 组 watchdog `ReportInputFailure`）已把故障归一为上述事件；`watchdog.rs`
  组动作封闭词表无切换变体（auto failover 类型级不可构造——Redundancy 域，不在本 entry）。
- **诚实边界**：Supervisor 的恢复成功/失败结论目前主要以 HealthChanged + SessionState
  变化 + 后续 PipelineFault（复发）呈现，无显式 `RecoverySucceeded/Failed` 事件。最小闭环
  **不新增 Runtime 事件 kind**（避免为投影改 Runtime）；recovery_status 由投影层从
  事件序列推断（fault 后 N 秒内无复发 + 状态回稳 ⇒ recovered；复发 ⇒ escalating），
  推断规则全部落在 Fastify 投影层并可从 alarms.evidence 审计。若后续证明推断不诚实，
  再立独立 Runtime packet 增补显式恢复事件（登记为 D1 债务，不是本 entry 范围）。

### 2.2 Fastify 侧（投影宿主——CP-01D 事件面已在位）

- `events/eventPlane.ts`：PostgreSQL advisory lock 单消费者 drain（B9）→ 每次 drain 的
  逐事件列表经 `project()` 折叠为 `AgentProjectionWire` 聚合快照写入 `event_outbox`
  （sequence = SSE cursor）；**drain 时刻逐 RuntimeEvent 可得**——alarm 派生点唯一且
  不需要新 agent 通道。
- `commands` / `audit_entries` 表族（CP-01B/C）已持久化命令与审计——alarm 的
  related command 证据可 join，不需要复制。
- 现有面：`/api/v1/runtime`、`/api/v1/commands`、`/events/v1/stream`（SSE）；
  **无 alarms/incidents 资源，无 Web Console Alarms 页**。

### 2.3 SDK / Web Console

- `@vbmf/sdk`：类型单源派生（apps/api JSON Schema → drift-gated codegen）+ client/SSE；
  新资源照抄此模式（SDK 不手写 mirror）。
- Web Console：Health/Runtime/Sessions/Events 四页（React state 切页）；无 Alarms 页。
  failure 旅程已验证 UI 如实反映 DEPENDENCY_UNAVAILABLE（§3.82/§3.83）。

## 3. 冻结决策

- **D1 载体**：Alarm/Incident = **Fastify 投影层派生**（drain 消费点），持久化于 PG 新表
  `alarms`；不新增 Runtime 代码、不新增 agent 事件 kind、不改 frozen V0.2。
- **D2 模型（最小字段，全部可从事件流/命令面取得）**：
  `alarm_id` / `fingerprint`（kind+failure_domain+related 主键去重键）/ `severity`
  （warning|error）/ `kind`（触发事件 kind）/ `failure_domain`
  （source|pipeline|hardware|identity|session|resource，从事件字段机械映射）/
  `related_session_id` / `related_device_id` / `related_pipeline_id`（可空）/
  `summary`（事件 summary/reason 原文——canonical，不翻译）/ `retryable`
  （PipelineFault 携带；其余 kind 按语义）/ `recovery_status`
  （active|recovered|escalating——§2.1 推断规则）/ `first_seen` / `last_seen` /
  `event_count`（同 fingerprint 复发计数）/ `active`（bool）/ `cleared_at` / `clear_reason` /
  `evidence`（jsonb：触发事件 + 判定输入快照）/ `ack_at` / `ack_by` / `ack_note`
  （nullable——operator awareness only，§1 红线 2）。
- **D3 派生规则（机械、可审计）**：Critical 事件开 alarm（同 fingerprint 重触发 →
  last_seen/event_count 更新，不重复开）；`SessionStateChanged→running` 或
  `HealthChanged→Ready|Capturing` 且窗口内无同 fingerprint 复发 ⇒ clear（recovered）；
  同 fingerprint 在 backoff 窗口内复发 ⇒ recovery_status=escalating（仍 active）。
  Manual-required 类（HardwareFault/AmbiguousIdentity/retryable=false）只能由
  恢复事件 clear，绝不自动超时消失。
- **D4 API（additive，非破坏）**：`GET /api/v1/alarms`（分页 + active/severity 过滤，
  沿用既有分页约定）、`GET /api/v1/alarms/{id}`、`POST /api/v1/alarms/{id}/ack`
  （幂等 command 面 + 审计；仅写 ack_* 三字段）。Incident Timeline（多 alarm 串接）
  **不在本 entry**——alarm 列表已含时间与关联，X4 完整串接留独立 packet（登记 D2 债务）。
  - 契约依据：V0.2 §5 `incidents` 表 + X4 是架构 Authority；EXTERNAL_API_CONTRACT §2
    P1 路径清单为最小面，本次新增资源为 V0.2 既定模型的 additive 实现，非破坏
    versioning（§2 条款）原则内；在 ARCHITECTURE_DECISION_LOG 登记 ADR（实现层登记，
    不改 frozen 契约正文）。
- **D5 SDK**：schemas.ts 单源增 alarm schema → codegen 派生类型 + client
  `listAlarms/getAlarm/ackAlarm`；SSE 投影帧增加 alarms 变更通知走既有 outbox 序列
  （不建第二推送通道）。
- **D6 Web Console**：新增 **Alarms** 页（active 列表 / severity / related session 链接 /
  ack 操作（带"仅知悉"语义提示）/ history）；Health 页保持 Runtime 真值；不重写既有页。
- **D7 旅程验收（用户 §16 旅程为 acceptance 锚）**：注入 fault（agent 停止/管线失败）→
  alarm 出现（severity/related 正确）→ Runtime 实际 degraded（health 层如实）→
  recovery 开始（重启/重试事件）→ recovered（clear 事件驱动）→ alarm cleared/resolved →
  browser reload → 同一 canonical 状态（PG 持久，非本地 React 状态）。全程禁用本地
  React 状态伪造 alarm。

## 4. 子包分解

| 包 | 范围 | 验证环境 |
|---|---|---|
| HI-01A | PG `alarms` 表 + 迁移 + drain 点派生引擎（D2/D3）+ 单元/注入测试（hermetic + ephemeral PG） | VM |
| HI-01B | Product API 三端点 + authz/限流/审计接线 + schema 单源 + 契约测试 | VM |
| HI-01C | SDK 类型派生 + client 方法 + 测试；SSE alarm 通知 | VM |
| HI-01D | Web Console Alarms 页 + 全旅程 E2E（VM 软件面：network-only agent 全栈） | VM |
| HI-01E | BMD 真机 bounded 验收（DeckLink 输入 fault 注入 → §16 全旅程 + reload 收敛 + teardown 按显式 PID） | BMD |

依赖：HI-01A→B→C→D→E。REDUNDANCY-ENTRY-01 planning 可并行（其实现等本 entry 边界稳定）。

## 5. 验收矩阵（DoD）

- 派生正确性：16 kinds 逐条注入 → alarm 开/更新/clear 断言（含复发 escalating、
  manual-required 不自动消失、ack 不影响 active/Runtime 状态）。
- 红线机检：gate 脚本增 alarm 红线（ack 面 3 字段-only；无 Runtime 写路径；UI 无本地
  alarm 伪造）。
- 三包全量测试 + exact-head CI 双 lane 绿；BMD bounded regression（HI-01E）+
  device-2 红线 + teardown 按显式 PID（§3.85 教训）。
