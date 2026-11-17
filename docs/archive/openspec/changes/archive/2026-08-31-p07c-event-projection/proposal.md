# Change: Phase 0.7C-6 — p07c-event-projection（Event Projection Foundation + D8 EventSink Decoupling：Runtime→Event→Projection 第一条生产边）

## Why

0.7C-5 Merge Gate PASS（master=`a6c5925`）。终审裁定：**0.7C-6 不是"增加几个事件类型"，而是第一次真正建立 `Runtime Event → RuntimeEventSink → RuntimeEventLog → Projection` 这条生产边**——与 0.7C-1 的 `Canonical → Runtime State` 边合起来才构成完整 Runtime Architecture。D8（Supervisor 既是决策者又是事件表持有者的职责倒置）是本阶段核心工作。**Event Projection（内部架构边界）与 External API（外部契约边界）严格分离，绝不合并**。开工前置：只读 Architecture Probe 已完成（`docs/superpowers/reports/2026-08-31-p07c6-architecture-probe.md`，四问：14 变体词表/生产点全景、Supervisor 三重职责病灶、**零生产消费者**、四语义基线）。

## What Changes

- **D8 解耦（supervisor.rs / session.rs / main.rs 组合根）**：
  - **`RuntimeEventSink` trait（events.rs）**：`fn emit(&self, ev: RuntimeEvent)`——事件出口的抽象；`RuntimeEventLog` 实现之（现有 push 语义原样）。
  - **组合根唯一 log 实例**：main.rs 构造 `Arc<RuntimeEventLog>`，同时注入 SessionManager（新参数）与 Supervisor（构造注入）——**单表单锁**，事件不分流。
  - **SessionManager**：`emit()` 改走注入的 sink（**不再穿 Supervisor**——`sup.lock().record()` 路径删除）；`sup` 字段只剩决策职责。
  - **Supervisor 收窄**：删自有 `events` 字段与 `record`/`drain_events`/`pending_events` API（**probe 证实零生产调用者，收窄安全**）；决策事件（report_failure/report_recovered/escalate）与 `ingest` 归一化改经注入 sink 发射；测试同步更新。Supervisor 回归纯决策引擎（0.6 HARD RULE 更纯）。
- **Event Projection Foundation（`src/event_projection.rs` 新）**：
  - **`project(events: &[RuntimeEvent]) -> EventProjection` 纯函数**——从事件流构建只读快照：per-session 最新状态与 failed 计数、fault/critical 存在性、事件总数（含 kind 分布）。**零字段万能 struct 禁令延续**：投影字段仅由四语义测试需要驱动，组合非展开。
  - **四语义测试锁定（probe Q4 为基线，零偷改）**：顺序（FIFO 投影序=发射序）；丢失（cap 溢出两级丢弃语义不变 + drop 计数可见；重复发射不破坏投影）；重复（同事件双发投影容忍）；projection failure（纯函数，不改事件流、无副作用——drain 后投影是消费侧行为）。
- **门禁 EVENT-PROJECTION-RT-01（三层）**：Unit（词表快照 14 变体零改动回归/投影纯函数/四语义）；Simulation（解耦后 SessionManager+Supervisor 双生产者单表汇聚：事件按发射序全量落表、Supervisor 无自有残留）；Hardware（真机 SESSION_LIFECYCLE gate 段追加投影输出：生命周期事件 drain→project→打印快照——消费接线实证）。
- **CI**：测试并入现有矩阵。

## Capabilities

（`skip_specs: true`——SoT 为终审 0.7C-5 Gate（Event Projection=Runtime→Event→Projection 生产边；与 External API 分离）+ 债表 D8 + probe 报告 Q4 四语义基线。）

## Impact

- 编译：五套 feature 不回退；event_projection.rs 零 vendor 依赖。
- 受影响：`events.rs`（+sink trait+impl）、`supervisor.rs`（删表+构造注入+测试）、`session.rs`（emit 接线+构造签名）、`main.rs`（组合根+gate 段）、新 `event_projection.rs`；Phase Map（0.7C-6 行）；债表（**D8 → CLOSED**）。既有事件发射点（session 14 处）**零语义变更**——只换出口。
- **明确不做**：External API/REST/RPC transport；Health Reducer 完整实现（watchdog tick 语义不动）；Supervisor 改事件驱动决策（watchdog 演进）；事件词表变更/零生产 4 项点亮（登记演进）；事件持久化/跨进程总线（Kafka/NATS 禁令延续）；PreflightFailure 粒度 P1（终审裁定 deferred，不顺手改）；adapter 专属 RuntimeEventMapper 接线。
