# Proposal — a2-8-dual-input-switch

## Why

裁定链 A2-8（A2-0..A2-7 全 CLOSED @7745968）。用户终裁：**否决直接编码，
批准 A2-8-00 Dual-input Switch Execution SOT Probe**——A2-8 是 VBMF 首次进入
"Program Semantic → Execution Adapter → GStreamer Graph"实现层的关键节点；
当前具备"两个输入独立运行"（A1/A2-7 已证）但**不具备"输入间 Program-level
switch"执行基础**（无 Switch 节点/watchdog 单视角/switch_mode 是预留 intent）。

## What Changes

- **A2-8-00 Probe 报告**（零代码）:
  docs/superpowers/reports/2026-09-03-a2-8-dual-input-switch-sot-probe.md
  - 裁决事实断言复核（8 项全实锚确认：N-input 已备/first-pipeline 迁移
    边界/watchdog 单视角/无 Switch 节点/switch_mode 预留/单输出/双路独立
    输出≠切换/identity 三层）
  - 六问逐答（含盒上 GStreamer 元素实查：input-selector[active-pad/
    switch-mode]/inter 系/audiomixer 全在）
  - 12 红线 + PipelinePlan 禁塞 A/B 三案落盘；OQ-1..5 交裁
- **A2-8-01（最小、可验证、可监督的 Program-level FRAME_SWITCH Execution
  Group）经 Pre-Implementation Gate 后实现**——十项冻结 + T1-T12 验收矩阵 +
  Video/Audio 成对切换（方案 A）落 probe §7；PACKET/MASTER Switch 与
  auto-failover Deferred（终裁预裁）

## Non-Goals

12 红线全项（不改 V0.2/Event contract/不建 registry/SwitchPolicy 非执行器/
Switcher 不进 SessionManager/Supervisor 不切换/不虚构 Metadata/Normalize
非 Fact/不碰 V0.3/不做多输出/双路独立≠切换/无 continuity 证据不宣布完成）；
自动 failover（首版只做显式切换）。

## 验收场景

1. 六问全有实锚（代码/盒上 gst-inspect/既有 Gate 记录）
2. OQ-1..5 原样交裁不预裁决
3. 零 .rs diff
