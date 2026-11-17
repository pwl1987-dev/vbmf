# Design — a2-6-program-projection（A2-6-00 Ownership/SoT Probe）

## 1. 定位

探针 change 首刀：产物 = Ownership/SoT Probe 报告，零代码。核心问题 =
"ProgramMaster 由谁拥有、从哪里产生"先于 projection 形态。

## 2. 方法论（A2-4/A2-5 已验证纪律复用 + 本阶段特有）

1. 不预设：API 资源命名/None 投影形态/Query 接线全部等消费者证据；
2. 所有权先于形态：owner 与 join() 触发时机联合裁决（OQ-1+OQ-2）；
3. 禁止捷径：Runtime facts 反推 Program semantics = 边界反向，全程打回。

## 3. 证据源

session.rs（SessionManager/MediaSession 字段全清点）· runtime_state.rs
（assemble 唯一装配点 + D14 SnapshotObservation）· runtime_query.rs
（纯读 allowlist）· api_boundary.rs（资源族 + 内部 DTO 禁令原文）·
transport.rs（五端点冻结）· master_join.rs（join() 零生产调用者）·
program/mod.rs（Canonical/Adapter 边界纪律）。

## 4. 裁决面

OQ-1 Owner（A/B/C/D 候选）· OQ-2 join()/三 Master 写入时机（真前置）·
OQ-3 Snapshot 边界（独立 vs 并入 D14）· OQ-4 API 命名与语义 · OQ-5 None
投影形态。Q6/Q7/Q8 已有终裁（透传禁 Health 化/不暴露/默认不暴露）。

## 5. No-Build Gate

零 .rs diff；六刀链顺序禁跳（00→01→02→03→04→05→06）；02 前禁制造
第二个 ProgramMaster。

## 6. 后续（OQ 裁决后）

01 Consumer+Shape 裁定 → 02 Projection 实现 → 03 Query 接线 → 04 API
Projection → 05 Transport → 06 收口交付链。
