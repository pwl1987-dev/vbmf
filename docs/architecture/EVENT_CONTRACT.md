# EVENT_CONTRACT（事件契约）

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.7/P1）（**状态订正 2026-11-27 · gap matrix `RuntimeEvent / RuntimeError` 行**）：IMPLEMENTATION = `PARTIAL`；VERIFICATION = **`HARDWARE_VERIFIED`**（`MEDIA-RT-01` 真机 PASS，报告 `docs/superpowers/reports/2026-08-29-p06-hi-backend-resource-gates-verify.md`）——**仅覆盖 RuntimeEvent 部分**；External Event / Projection 属 0.7C-1~8·0.7D，gap matrix 无对应行、无门禁证据 ⇒ 未计入；GATE 以 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 为准。
> 来源：API PRD #11–#34, #78–#82, #102–#105, #131, #155；问题点 (B)(C)
> 关联：`EXTERNAL_API_CONTRACT.md`、`IMPLEMENTATION_ADDENDUM.md`（RuntimeEvent）

## 1. 两层事件（关键：RuntimeEvent ≠ External Event）
- **RuntimeEvent**（Portability #44）：Runtime 内部统一事件，结构 `{device/port/session/pipeline/timestamp/event}`，**禁 vendor HRESULT / GStreamer Message**，Supervisor 只认此。
- **External Event**：对外投递事件，由 **Projection 层** 从 RuntimeEvent 翻译/过滤/投影生成。
- 边界：Runtime 内部事件总线 **≠** External 投递通道；Valkey 仅作 External Webhook 队列，**不作 Runtime 事件源**（问题点 C）。

## 2. Projection 层（问题点 B，补此缺口）
- 归属：**Control Plane（Fastify）**，非 Runtime Domain
- 职责：订阅 RuntimeEvent → 过滤/投影 → 发 External Event（Webhook/SSE/Subscription）
- 不得因 Projection 改变 Runtime 行为

## 3. External Event 语义（#78）
- Event = "发生了什么"；Command = "请求做什么"
- Event ≠ Command result only

## 4. Desired / Configuration / Command / Observation 分离（#79/#80）
- Signal 通常不是用户可"设置"的状态；API 必须区分 desired/configuration/command/observation
- 配置同步：ChangeSet→Preflight→Impact→Approval→Apply→Audit（#81/#82）
- 配置变化发 `CONFIG_CHANGED`/`BINDING_CHANGED`/`ROUTING_CHANGED`，不靠 polling（#82）

## 5. 投递与可靠性（#131）
- Webhook：signature/timestamp/nonce/schema 验证（#104）
- 保证：delivery / retry / duplicate / signature / replay prevention / ordering or cursor / consumer failure
- Event Bus 第一阶段 Fastify dispatcher + Valkey（#155/#156），不引入 Kafka/NATS

## 6. Trigger（#102–#105）
- 外部触发（webhook in / GPIO / SNMP trap / MQTT / HTTP callback）统一转 `ExternalTrigger` → Policy Engine → Command
- Trigger ≠ Command：多 Trigger 可产生同 Command
- Trigger 安全：禁 arbitrary URL 触发 shell/ffmpeg/restart；绑定 allowed action / scope / credential / rate limit（#103）

## 7. Acceptance
- `EXT-EVENT-01`（delivery/retry/duplicate/signature/replay/ordering/consumer failure）
- `EXT-FAIL-01`（external down / timeout / auth fail / webhook unavailable / DNS fail / network partition → 不波及其他 media runtime）
