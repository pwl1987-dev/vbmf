# Proposal — a2-4-metadata-master

## Why

裁定链 A2-4（A2-1 SwitchPolicy @78a8319✅ / A2-2 Video Master @b68830c✅ /
A2-3 Audio Master @b378a0d✅）。V0.2 §3.7 Metadata Graph 是三独立 graph 之一
（决策 #29），但**用户裁定 A2-4 第一刀 = SoT Probe，非编码**：
Metadata Graph 拓扑（三路并列源 Timecode/Subtitle/SCTE-35 → [Metadata
Master Join] → Program-scope Master (METADATA)）与 Video/Audio（各 3 中间
处理节点的串行链）**形态根本不同**——禁止类推五阶段模型。探针须先证明
Metadata 是什么，再决定它长什么样。

## What Changes

- **A2-4-00 SoT Probe 报告**（本 change 唯一产物，零代码）:
  `docs/superpowers/reports/2026-09-02-a2-4-metadata-master-sot-probe.md`
  - 七项必答 + 一项强制证据检查（Q1 节点/Q2 Data Plane/Q3 Timecode 定位/
    Q4 Program-Input 边界/Q5 Option vs fail-closed/Q6 serde wire/Q7 阶段
    语义/Q8 既有占位扫描）逐项以 V0.2 节号/行号 + 代码实锚作答
  - Evidence → Open Questions（OQ-1..OQ-6）→ Proposed Decisions（PD-1..PD-4,
    全部待裁决）→ No-Build Gate
- **裁决输入就绪**: OQ-1（Timecode=Metadata 源[V0.2 原文] vs Join 属性[用户
  先前口头]证据冲突）、OQ-2（Subtitle vs CAPTION 词汇张力）、OQ-6（A2-4
  形态——无阶段链读法下的组合声明模型）等六问交用户裁决
- **A2-4-01+（词表冻结/domain object）在裁决后另立任务**，本 change 到
  design 阶段为止（phase=design, STOP）

## Non-Goals

- Rust domain code（MetadataMaster struct/stage enum/transition matrix/serde）
- VideoMaster/AudioMaster/Master Join 任何修改（含 deprecated/仅注释标记）
- canonical vocabulary 猜测性冻结
- Subtitle/SCTE-35 解析执行面（A2-7+）

## 验收场景

1. Probe 报告七问全部有 V0.2 节号级证据（无类推、无自创词表）
2. Q8 证据确认 VideoMaster/AudioMaster 零 metadata/timecode 占位
3. 全部 SoT 缺口/张力原样进 Open Questions（不自行补模型）
4. 本 change 零 .rs diff
