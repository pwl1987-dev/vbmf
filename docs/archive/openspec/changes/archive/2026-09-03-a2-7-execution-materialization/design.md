# Design — a2-7-execution-materialization（A2-7-00 SoT/Ownership Probe）

## 1. 定位

探针 change 首刀：产物 = SoT/Ownership Probe 报告，零代码。A2-7 核心 ≠
"怎么启动 GStreamer"（已存在），= Execution Fact → Custody → advance →
join → ProgramMaster snapshot 的 Semantic Lifecycle 闭环。

## 2. 方法论

1. 分账先行：已有能力禁重造（八项实锚），缺失侧五项才是交付面；
2. 事实候选不预设：9 候选七维逐个裁，红线 = Session Running≠stage、
   Clock≠AVSync、pipeline 级≠节点级；
3. 缺口如实披露：SWITCHED/PROGRAM_COMPOSED 执行事实当前不存在——推进
   方式（deferred vs 声明性推进）交裁，不为闭环伪造事实。

## 3. 裁决面

OQ-1 stage 事实映射逐阶段 · OQ-2 Metadata producer · OQ-3 failed 转换
边界 · OQ-4 AVSync 上游 · OQ-5 Custody 挂载层与 SessionManager 协作。

## 4. No-Build Gate

零 .rs diff；十项禁止清单；01 前不定义 ExecutionFact 形态。

## 5. 后续（OQ 裁决后）

01 Execution Fact Shape/Ownership → 02 Program Runtime Custody →
03 Execution→Master→Join→Snapshot → 04 Mock/Simulation lifecycle 验证 →
05 真机前置验证 → A2-8 双输入真机切换。
