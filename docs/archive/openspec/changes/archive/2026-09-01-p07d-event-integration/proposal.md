# p07d-event-integration — 0.7D 事件内消费集成（watchdog 演进）

## Why

RuntimeEvent 平台的生产边（SessionManager 直连 emit + Supervisor 决策事件经注入 sink，0.7C-6 D8 CLOSED）、存储边（组合根单表 `RuntimeEventLog`，两级丢弃不静默）与外送边（`GET /api/v1/events/projection` drain→project→`ApiProjectionResponse`，0.7C-8）已全部建成——但事件**只外送、不内耗**：runtime 自身的健康状态派生（AgentState）仍是 `main.rs` 七处命令式散写（Ready:499 / Capturing:537,1233 / Degraded:1253,1258 / Ready:1274 / ManualRequired:1467,1483），Supervisor 决策输入仍来自轮询快照的命令式调用（watch loop → `report_failure`），且 4 项事件词表（IdentityResolved / SignalVerified / LoopbackVerified / ResourceReservationExpired）至今**零生产站点**（实测 0 个非测试 emit）。这三项正是 0.7C-6 design §4 显式 deferred 的"watchdog 演进"，也是 Phase Map 0.7D 行（"Event Projection / Integration"）在 D8 提前关闭后真正剩余的工作面。

## What Changes

- **Health Reducer 完整实现**：`RuntimeEvent` 流 → `AgentState` 派生收敛为单一纯函数 reducer；`health.rs` 从 Gate 2.1 冻结 skeleton（`#![allow(dead_code)]` 未接线）转为完整实现；`main.rs` 七处命令式散写收敛到 reducer 派生路径。watchdog tick 语义不动（0.7C-6 冻结约束）。
- **Supervisor 事件驱动消费**：决策输入从 RuntimeEvent 流获得（消费循环在接线层，**Supervisor 决策调用面零变更**——保持 0.7C-6 design"Supervisor 回归纯决策引擎"的收口形态）。
- **4 项零生产事件点亮**：接到各自真实语义生产者（IdentityResolved→身份解析路径 / SignalVerified→信号验证路径 / LoopbackVerified→loopback 验证路径 / ResourceReservationExpired→预留过期路径）；不加新事件平面、不改事件词表（EVENT_CONTRACT TD-16 保持）。
- **红线继承**：EventProjection ≠ CanonicalRuntimeState；"不得因 Projection 改变 Runtime 行为"（EVENT_CONTRACT §2）——reducer 是消费侧只读派生，不写回 Graph/Backend 决策。
- **housekeeping（三项，与语义变更同 change，避免孤立噪声提交）**：
  1. `rpc.rs` 陈旧注释修正（0.7C-8 终审裁定并入本 change："No transport yet" → 指向 transport.rs 为当前 HTTP 边界、rpc.rs 为冻结 SoT §14 契约记录不在 wire 路径）。
  2. 清理 3 个已归档阶段的陈旧 change 目录（`p07c-error-model` / `p07c-event-projection` / `p07c-external-api`——归档件完整、tasks.md 差异仅为复选框状态，零信息损失；同时消除 comet resume-probe "multiple active changes" 误判源）。
  3. Phase Map 0.7D 行再锚定（现标签"EventSink 解耦 D8 与此同期"已过时——D8 已 @0.7C-6 关闭）。
- **门禁**：`EVENT-INTEGRATION-RT-01`（名称 design 阶段定稿）三层测试：Unit（reducer 纯函数语义）→ Simulation（Mock 全链事件驱动派生 + Supervisor 消费等价性）→ Hardware（真机生命周期事件流 → AgentState 派生实证）。

### 非目标（显式排除）

- **不重做 Projection API**（`event_projection::project` + 五字段投影 + 投影端点均已 0.7C-6/8 完成——本 change 只加内消费，不碰投影本身）。
- **不做 External Event 投递**（webhook/SSE/Valkey/签名/重试——SoT `EVENT_CONTRACT.md` §2 裁定 Projection 层归属 Control Plane/Fastify；本仓库无控制面服务）。
- **不做持久化/跨进程事件总线**（deferred，类比 D9 durable log 分阶段）。
- **不动 Transport 实现本体**（用户明令；`transport.rs` 零改动，`/health` 响应字段逐字段不变）。
- **不做 D10 多管线 / D14 快照一致性 / D15 流基数**（session/query 债，另行阶段）。
- **不改 Supervisor 决策调用面与 watchdog tick 语义**（0.7C-6 design 冻结）。

### 拆分裁定

不拆分：Health Reducer 与 Supervisor 事件消费共享同一 drain 语义、耦合于同一事件平面（内消费集成是单一 capability）；4 项事件点亮是该平面生产侧的小量补全（4 个 emit 站点接线）；拆开只会制造两个薄 change，违反"不做纯清债 change"纪律。housekeeping 三项无独立交付价值，按"避免孤立文档提交"裁定随本 change 走。

## Capabilities

（`skip_specs: true`——SoT 为 0.7C-6 归档 design §4 显式 deferral 清单（"Health Reducer 完整实现；Supervisor 改事件驱动决策（消费循环属 watchdog 演进）；零生产 4 项点亮"）+ `EVENT_CONTRACT.md` §1/§2 两层事件与投影不改行为约束 + `MEDIA_AGENT_STATE_MACHINE.md` 8 态词汇。与前序全部 change 的 specs 处理一致：specs 目录为空，行为契约锚定冻结架构文档，PHASE_IMPLEMENTATION_MAP 为唯一实施 SoT。）

### New Capabilities

无（见上）。

### Modified Capabilities

无（见上）。

## Impact

- **代码**：`services/media-agent/src/health.rs`（skeleton→完整实现）、`supervisor.rs`（消费接线，调用面不变）、`events.rs`（4 项事件 emit 生产点亮——若生产者锚点在 resolver/signal/loopback/resource 模块则对应接线）、`main.rs`（散写收敛 + 消费循环接线）。
- **测试**：新增三层门禁测试（Unit/Simulation/Hardware）；全部既有门禁回归（SESSION/RESOURCE/IDEMPOTENCY/ERROR/EVENT-PROJECTION/TRANSPORT 等）不破。
- **文档**：`PHASE_IMPLEMENTATION_MAP.md`（0.7D 行再锚定 + 完成态）、债表对应登记、verify 报告。
- **CI**：沿用七 required checks（不新增 context，不降既有）。
- **依赖**：零新 crate（std + 既有 serde_json/uuid）。
