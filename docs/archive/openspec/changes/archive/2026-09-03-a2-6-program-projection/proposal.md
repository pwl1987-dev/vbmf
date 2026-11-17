# Proposal — a2-6-program-projection

## Why

裁定链 A2-6（A2-1..A2-5 全 CLOSED：SwitchPolicy 78a8319 / Video b68830c /
Audio b378a0d / Metadata 1779429 / Join+ProgramMaster 2166d25）。Program
Domain 六文件闭环后，第一个 Domain→Runtime→API 三层边界考验阶段。
**用户裁定：先 Ownership/SoT Probe 再 projection**——避免"为做 API
projection 在 Runtime 里复制/拼装 ProgramMaster"这一最危险错误。

## What Changes

- **A2-6-00 Ownership/SoT Probe 报告**（本 change 首产物，零代码）:
  `docs/superpowers/reports/2026-09-03-a2-6-program-projection-ownership-probe.md`
  - 八问逐项证据（Owner 零现状/生命周期零触发点/Snapshot 独立边界/
    API 命名不预设/None 投影禁坍缩/AVSync 透传禁 Health 化/failed 不暴露/
    inconsistency 默认不暴露）
  - **关键事实：`join()` 与三 Master writer 零生产调用者**——任何 projection
    设计在"三 Master 谁写"裁决前是空中楼阁（OQ-2 真前置）
  - OQ-1..5 交裁（Owner/写入时机/Snapshot 边界/API 命名/None 投影形态）
  - 禁止捷径红线落盘（禁从 RuntimeState 重建三 Master 再 compose）
- **A2-6-01+（Consumer/Shape/实现/Query/Transport/收口）在 OQ 裁决后按
  六刀链推进**，本刀到 design guard + handoff 为止

## Non-Goals

- API DTO / RuntimeState 修改 / RuntimeQuery 扩展 / transport 接线（六刀链
  顺序禁跳）；SessionManager 塞 ProgramMaster（禁）；从 Runtime facts 反推
  Program semantics（禁）；join() 生产 wiring（OQ-2 裁决后另立）

## 验收场景

1. 八问全有代码实锚（SessionManager 字段清点/assemble 唯一/allowlist 7 fn/
   api_boundary 禁令原文）
2. OQ-1..5 原样上报不预裁
3. 本刀零 .rs diff
