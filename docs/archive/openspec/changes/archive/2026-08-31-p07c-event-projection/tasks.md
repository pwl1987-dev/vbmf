# Tasks: Phase 0.7C-6 — p07c-event-projection

四栏纪律：`Contract: 已有(引用冻结文档节号) / Implementation / Verification / Gate`。

## 1. D8 解耦（design.md §1/§2）
- [x] RuntimeEventSink trait + RuntimeEventLog impl（push 语义零改动）
      Contract: 终审 0.7C-5 Gate（D8 核心工作；目标形态图）+ 债表 D8
      Implementation: events.rs 增量
      Verification: `evt_proj_rt_01_vocabulary_snapshot`（词表零改动回归）+ 既有 log 语义测试回归
      Gate: EVENT-PROJECTION-RT-01 Unit 层
- [x] 组合根单表：main.rs 唯一 Arc<RuntimeEventLog> 注入 SessionManager 与 Supervisor
      Contract: probe Q4 顺序语义（单表单锁全局 FIFO）
      Implementation: main.rs 组合根
      Verification: `evt_proj_rt_01_decoupled_single_table`
      Gate: EVENT-PROJECTION-RT-01 Simulation 层
- [x] SessionManager emit 直连 sink（删除 sup.lock().record 穿越）+ Supervisor 收窄（删 events 字段与 record/drain_events/pending_events；决策事件经注入 sink）
      Contract: D8 职责倒置病灶（probe Q2）；收窄安全性=probe Q3 零生产调用者
      Implementation: session.rs + supervisor.rs（决策逻辑零改动）
      Verification: 同上 Simulation 测试 + supervisor 既有决策测试全绿（更新构造）
      Gate: EVENT-PROJECTION-RT-01 Simulation 层

## 2. Event Projection Foundation（design.md §3）
- [x] project(events) 纯函数 + EventProjection 组合式字段（禁万能 struct）
      Contract: 0.7 红线（Observation≠Configuration——投影只读快照绝不写回）
      Implementation: event_projection.rs
      Verification: `evt_proj_rt_01_project_is_pure_and_fifo` + `evt_proj_rt_01_projection_failure_isolation`
      Gate: EVENT-PROJECTION-RT-01 Unit 层
- [x] 四语义锁定：顺序/丢失（既有两级丢弃回归）/重复容忍/failure 隔离
      Contract: probe Q4 基线（终审裁定"零偷改"）
      Implementation: 测试矩阵
      Verification: `evt_proj_rt_01_{loss_semantics_visible, duplicate_tolerant}`
      Gate: EVENT-PROJECTION-RT-01 Unit/Simulation 层

## 3. 真机与回归
- [x] gate 段投影输出（生命周期后 drain→project→打印）+ 全门禁回归
      Contract: PHASE_IMPLEMENTATION_MAP §3（Event Projection 项）
      Implementation: main.rs gate 段
      Verification: 盒上 VBMF_SESSION_LIFECYCLE=1 真机跑
      Gate: EVENT-PROJECTION-RT-01 Hardware 层 + SESSION/RESOURCE/IDEMPOTENCY/ERROR-MODEL-RT-01 回归
- [x] 五套 feature 编译不回退 + 盒上全矩阵
      Contract: CI 七 checks 口径
      Verification: p07_verify.sh 全绿
      Gate: PR required checks

## 4. 文档与收尾
- [x] 债表 D8 → CLOSED（引解耦证据）；Phase Map 0.7C-6 行 COMPLETE；0.7C 下一项 = External API
      Contract: PHASE_IMPLEMENTATION_MAP=唯一 SoT；债务 closure≠forever
      Verification: 文档对账
      Gate: verify
- [x] verify（0 CRIT/0 IMP 目标）→ archive → PR → merge → tag phase-0.7C6-event-projection → 删分支
