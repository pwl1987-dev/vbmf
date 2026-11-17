# Tasks: Phase 0.7C-5 — p07c-error-model

四栏纪律：`Contract: 已有(引用冻结文档节号) / Implementation / Verification / Gate`。

## 1. 分类平面（design.md §1/§2）
- [x] ErrorClassification 封闭词表五项 + 不纳入项理由（InProgress/AlreadyApplied/Duplicate）
      Contract: 终审 0.7C-4 Gate（第一道红线三平面分离；维度示例）+ 0.7C-3 Gate §10
      Implementation: `error_model.rs` 词表 + design.md §2
      Verification: `err_model_rt_01_vocabulary_snapshot`
      Gate: ERROR-MODEL-RT-01 Unit 层
- [x] 三平面正交结构：零字段单元变体 / 禁 From 互转 / CommandStatus+IdempotentDispatch 词表零改动回归
      Contract: 终审 0.7C-4 Gate（禁万能 CommandResult）
      Implementation: 词表定义 + 白盒断言
      Verification: `err_model_rt_01_three_plane_separation`
      Gate: ERROR-MODEL-RT-01 Unit 层

## 2. 封闭映射（design.md §4）
- [x] classify_session_error 九臂→五类封闭映射（match 无通配臂，编译级防漏）
      Contract: 接线纪律（新增变体强制评审）+ D6 Unknown 先例
      Implementation: 纯函数逐臂映射
      Verification: `err_model_rt_01_classify_matrix_closed_mapping`（10 case）
      Gate: ERROR-MODEL-RT-01 Unit 层

## 3. outcome 接线（design.md §3/§5）
- [x] CommandOutcome 增 classification: Option<ErrorClassification>（错误边界处产生；决策 D-1）
      Contract: 终审 0.7C-3 Gate §10（Idempotency+Error Model 联合设计结果形态）
      Implementation: command.rs dispatch Err 分支 + idempotency.rs panic 兜底(Unknown)
      Verification: `err_model_rt_01_outcome_invariant`（三不变量）
      Gate: ERROR-MODEL-RT-01 Unit 层
- [x] Simulation：dispatch 失败路径分类正确 + replay 重放含原 classification
      Contract: D9-D 逐字节重放语义延续
      Implementation: 测试
      Verification: `err_model_rt_01_dispatch_failure_classification`
      Gate: ERROR-MODEL-RT-01 Simulation 层

## 4. 真机（design.md §6）
- [x] main.rs gate 段 classification 输出 + ghost 探针步（PermanentFailure 实证）+ 回归
      Contract: PHASE_IMPLEMENTATION_MAP §3（Error Model 项）
      Implementation: SESSION_LIFECYCLE 段升级
      Verification: 盒上 VBMF_SESSION_LIFECYCLE=1 真机跑
      Gate: ERROR-MODEL-RT-01 Hardware 层 + SESSION/RESOURCE/IDEMPOTENCY-RT-01 回归
- [x] 五套 feature 编译不回退 + 盒上全矩阵
      Contract: CI 七 checks 口径
      Verification: p07_verify.sh 全绿
      Gate: PR required checks

## 5. 文档与收尾
- [x] 债表 D9 措辞收紧：Foundation CLOSED（进程内）/ External·持久化语义 deferred
      Contract: 终审 0.7C-4 Gate §11
      Verification: PHASE_0_7A_POST_MERGE_DEBT.md 对账
      Gate: verify
- [x] Phase Map：0.7C-5 行 COMPLETE；0.7C 下一项 = Event Projection → External API
      Contract: PHASE_IMPLEMENTATION_MAP=唯一 SoT
      Verification: 文档对账
      Gate: verify
- [x] verify（0 CRIT/0 IMP 目标）→ archive → PR → merge → tag phase-0.7C5-error-model → 删分支
