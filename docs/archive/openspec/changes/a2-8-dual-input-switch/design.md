# Design — a2-8-dual-input-switch（A2-8-00 SOT Probe）

## 1. 定位

探针首刀：回答"双输入 Program-level switch 的执行基础"六问；A2-8 转折 =
从 Domain 模型线转入 Execution Adapter 实现线。

## 2. 方法论

事实断言先复核（8 项全锚）；GStreamer 能力盒上实查（非文档推测）；缺口
如实披露（watchdog 单视角=Precondition Gate；AVSync 升级 A2-8 硬前置）。

## 3. 裁决面（已终裁，2026-09-03 两轮）

OQ-1 inter 系=**候选 Materialization 非架构合同**（topology=实现细节）·
OQ-2 独立 Switch Execution Adapter（不塞 Backend 五方法）· OQ-3
ExecutionGroup 级 MultiInputWatchdog 单实例（概念正式冻结）· OQ-4 六路
PTS 观测 only（无 Engine/无 threshold）· OQ-5 Program pipeline 归 Program
Execution/Switch 层。全部终裁与十项冻结落 probe §7。

## 4. No-Build Gate

零 .rs diff；12 红线；禁 PipelinePlan 硬塞 A/B。

## 5. A2-8-01 范围（Gate 后；第三轮终裁后状态见 §6）

目标=**最小、可验证、可监督的 Program-level FRAME_SWITCH Execution
Group**（非"input-selector+双 Pipeline"）。T1-T12 验收矩阵；Video/Audio
成对切换（方案 A）；Desired≠Execution≠Observed 三分离；Event Identity
Debt 不修；完成标准=真实 Execution Graph+真实 A/B 切换+MultiInputWatchdog
落地（不停在设计完成）。

## 6. 第三轮终裁后状态（probe §8）

01 = IMPLEMENTATION COMPLETE / APPROVED（T5 拆分=观测 PASS·连续性
NOT YET PASS）。02 = Real Dual-Input Program Execution Verification
（**02 Design Gate 先行**: materialization 注入面——不批准 pipeline.rs/
build_pipeline 感知 Program/inter 语义, Program Execution 层组合执行
资源, Pipeline 不感知 A/B/Program; Program Output=一级 Observation
对象; Program Timeline Continuity / Timestamp Normalization=02 明确
观察项·四方案未裁）→ 03 failure/supervision → 04 Program Timeline /
AV continuity → 05 archive+CI+merge；**A2-8 NOT CLOSED until 05**。
