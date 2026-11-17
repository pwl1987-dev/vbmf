# Proposal — a2-7-execution-materialization

## Why

裁定链 A2-7（A2-1..A2-6 全 CLOSED @caab630）。**分账探针定调**：
Materialization 不是 A2-7 的空白（materialize/MediaBackend SPI/Session
冻结链/watchdog 观测链全已存在，禁重造）；**真正的空白 = Program Semantic
Lifecycle**——Execution Fact boundary（零）+ Program Runtime Custody（零）
+ 三 Master writer（零）+ Metadata declaration producer（零）+ JoinInput
装配（零）。核心问题 = "什么运行时事实、什么时刻、以什么 ownership/SoT/
语义等级，允许推动 Program Domain 状态前进"。

## What Changes

- **A2-7-00 SoT/Ownership Probe 报告**（本 change 首产物，零代码）:
  `docs/superpowers/reports/2026-09-03-a2-7-execution-materialization-sot-probe.md`
  - 分账表：已有八项能力实锚（禁重造）vs 缺失五项（真空白）
  - Execution Fact 候选七维裁表（9 候选逐一：来源/durable/observation/
    可推 stage/仅 Join input）
  - 六问 A-F 证据（**关键披露：SWITCHED/PROGRAM_COMPOSED 的执行事实当前
    不存在**——管线无独立 Switcher/Composition 节点，推进方式须裁）
  - OQ-1..5 交裁（stage 事实映射/Metadata producer/failed 转换边界/
    AVSync 上游/Custody 挂载层）
  - 十项禁止清单落盘（禁万能 ExecutionFact 巨型 struct 等）
- **A2-7-01+（Fact Shape/Custody/链路/mock 验证/真机前置）在 OQ 裁决后
  按 Gate 链推进**，本刀到 design guard + handoff 为止

## Non-Goals

- 重写 materialize/SessionManager/MediaBackend/GStreamer abstraction
- Watchdog/Supervisor 改造为 Program owner；新建 AVSync Engine
- Query/Transport API；双输入真机切换（A2-8）；万能 ExecutionFact

## 验收场景

1. 分账两侧全有代码实锚（已有八项 + 缺失五项）
2. 九候选七维逐个定位；六问全有证据锚
3. 本刀零 .rs diff
