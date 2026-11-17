# p07d-event-integration — Design（高层框架）

> 深度技术设计（含映射表逐项定稿）在 design 阶段 Design Doc 细化；本文只锁方向性决策与红线。

## Context

见 `proposal.md` Why。当前事件链：生产（SessionManager emit 直连 + Supervisor 决策事件）→ 存储（组合根单表 `RuntimeEventLog`，1024 cap 两级丢弃）→ 外送（transport `GET /api/v1/events/projection` drain→project）。缺口=内消费：AgentState 派生散写在 `main.rs` 七处、Supervisor 输入来自轮询、4 项事件零生产。约束：0.7C-6 四语义（顺序 FIFO / 丢失两级丢弃 / 重复容忍 / failure 隔离）零偷改；transport 本体零改动；`/health` 字段逐字段不变；无新后台线程（沿用既有模式）。

## Goals / Non-Goals

**Goals:**
- AgentState 派生收敛为单一纯函数 reducer（事件切片 → 状态），`health.rs` 转完整实现。
- Supervisor 决策输入接入事件视图（调用面零变更，保持纯决策引擎形态）。
- 4 项零生产事件接到真实语义生产者。
- housekeeping 三项（rpc.rs 注释 / 陈旧目录清理 / Phase Map 再锚定）。

**Non-Goals:**
- 不改 Projection API/投影语义；不做 External Event 投递（归 Fastify）；不做持久化/总线；不动 Transport 本体；不做 D10/D14/D15；不改事件词表与 Supervisor 调用面。

## Decisions

- **D1 Reducer=纯函数**：`reduce(current, events) -> AgentState`，同输入同输出、消费侧只读、不写回 Graph/Backend/Command 路径。备选（拒绝）：每事件回调即时改态（副作用、乱序敏感、难测）；仅文档化散写（不解决缺口）。
- **D2 消费点=watchdog tick 接线层**：沿用既有 tick 驱动模式（无新线程）；reducer 在接线层被调用，`health.rs` 只持纯语义。
- **D3 单日志多消费者 drain 语义（design 阶段定稿，本 change 最关键设计点）**：内消费（reducer）与外送投影端点共享同一 `RuntimeEventLog`，而 `drain()` 是破坏性排空——两消费者直接竞争会互相掏空。候选：非破坏性读取（内消费读视图、外送 drain 不变）／单一消费点分流／内消费持游标。硬约束：transport 本体零改动 + 0.7C-6 四语义零偷改 + `EventProjection ≠ CanonicalRuntimeState`。
- **D4 Supervisor 事件驱动=输入侧演进**：决策输入从事件视图获得（如故障类事件 → `report_failure` 语义等价）；`report_failure/begin_restart/report_recovered` 调用面与决策纯度不变（0.7C-6 收口形态保持）。
- **D5 4 事件点亮锚定真实语义路径**：IdentityResolved→身份解析成功点 / SignalVerified→信号验证通过点 / LoopbackVerified→loopback 验证通过点 / ResourceReservationExpired→预留过期点；只加 emit，不加词表、不加平面。
- **D6 红线守护**：reducer 输出仅观测面（`/health` + watchdog 观测），禁止进入 Command/配置路径（Observation→Configuration 红线）；静态扫描/白名单测试守护。

## Risks / Trade-offs

- [drain 竞争破坏外送投影契约] → D3 在 design 阶段以证据定稿；TRANSPORT-RT-01 与 EVENT-PROJECTION-RT-01 全量回归不破。
- [reducer 派生态与命令式旧路径不一致（状态翻转差异）] → 等价性测试：同场景新旧路径同终态（Simulation 层逐场景断言）。
- [事件不足以派生全部 8 态（如 Backoff 需 Supervisor 决策配合）] → 映射表在 design 阶段逐态定稿；不足态显式声明来源（Supervisor 决策事件已存在）而非造新事件。
- [4 事件点亮发错位置制造噪声] → 每事件锚定语义真实触发点，Simulation 断言 `kind_counts` 增量精确。
- [housekeeping 删目录误删未归档内容] → 已核验：三目录归档件完整、差异仅复选框状态、零信息损失；删除前再跑一次 diff 确认。

## Migration Plan

全部 additive + 行为收敛（散写删除由等价性测试兜底）；单 change revert 即回滚。CI 沿用七 checks 不新增不降。

## Open Questions

- D3 具体形态（非破坏读 vs 分流 vs 游标）——design 阶段以四语义与 transport 零改动约束定稿。
- AgentState 8 态 × RuntimeEvent 词表的完备映射表——design 阶段逐态定稿并测试锁定。
