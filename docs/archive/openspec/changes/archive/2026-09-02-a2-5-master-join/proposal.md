# Proposal — a2-5-master-join

## Why

裁定链 A2-5（A2-1..A2-4 全 CLOSED：SwitchPolicy 78a8319 / Video b68830c /
Audio b378a0d / Metadata 1779429）。三 Master 齐，V0.2 §1.20 L155 联合判定
（任一路 failed → DEGRADED/FAILOVER）是 Program Domain 的最后一块拼图。
用户裁定七刀链（00 Probe → 01 Shape → 02 输入/输出模型 → 03 实现 →
04 ProgramMaster+AVSync → 05 Semantic Review → 06 收口），第一刀只探针；
十危险点（Unknown≠NotPresent ≠Failed / facts≠declaration / Join fail-closed
五条 / failed 唯一来源 Runtime / D14 不偷渡 / Timecode SoT / AVSync 归 Join /
MetadataMaster 禁八字段）全部证据锚定后方可进 01。

## What Changes

- **A2-5-00 SoT Probe 报告**（本 change 首产物，零代码）:
  `docs/superpowers/reports/2026-09-02-a2-5-master-join-sot-probe.md`
  - V0.2 Join 侧全景（§1.20 联合判定/§8.9 Master=7 故障域且切源+垫片/
    §8.10 AVSync 先分类后动作/§8.11 三轴 health 含 UNKNOWN/§3.8+§3.13
    Errata-9 识别决策分离/11 处 Master Join 出现点）
  - 十危险点 V0.2+代码双锚表；OQ-A..OQ-E 五问交裁（Join 输出与 §8.9
    Master 域关系 / ProgramMaster 形态 / AVSync 落地范围 / classify 归属 /
    三路不对称就绪输入）；PD-1..PD-4 提案
- **A2-5-01+ 在 OQ 裁决后另立**，本刀到 design guard + handoff 为止

## Non-Goals

- master_join.rs / program_master.rs / avsync 任何生产代码
- 三 Master / Runtime / Event / Health 任何修改
- 词表冻结（01/02 后）；D14 语义引用；GStreamer 执行面（A2-7+）

## 验收场景

1. 十危险点全有 V0.2 节号 + 代码实锚双证据
2. OQ-A..E 原样上报不预裁决
3. 本刀零 .rs diff
