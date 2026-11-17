# Tasks: Phase 0.7C-7 — p07c-external-api

四栏纪律：`Contract: 已有(引用冻结文档节号) / Implementation / Verification / Gate`。

## 1. API Resource Model（design.md §1）
- [x] api_boundary.rs 五大独立 API 类型（ApiDevice/Port/Resource/Session/Capability）+ to_api_* 纯函数（Query 平面转换）
      Contract: 终审 0.7C-6 NOTE-3（独立定义，非 Runtime 投影）+ 0.7B 加严红线（禁万能 struct）
      Implementation: api_boundary.rs
      Verification: `api_rt_01_to_api_query_models`
      Gate: EXTERNAL-API-RT-01 Unit 层
- [x] Command API model（ApiCommandRequest/Response/Status/Target/ErrorClass）独立 enum 命名
      Contract: 终审 NOTE-2（不暴露 Rust serde tag 习惯）+ 0.7C-5 三平面分离
      Implementation: api_boundary.rs
      Verification: `api_rt_01_api_command_status_no_failed_state` + `api_rt_01_api_command_request_field_shape`
      Gate: EXTERNAL-API-RT-01 Unit 层

## 2. Event API model + Projection 红线守护（design.md §1.3）
- [x] ApiEventEnvelope + ApiProjectionResponse + ApiProjectionKind 守门
      Contract: 终审 NOTE-1（EventProjection 不得取代 CanonicalRuntimeState）
      Implementation: api_boundary.rs
      Verification: `api_rt_01_api_projection_kind_enforced`（序列化必含 snapshot_kind）
      Gate: EXTERNAL-API-RT-01 Unit 层

## 3. Idempotency 持久化边界契约（design.md §2）
- [x] ApiIdempotencyBoundary 公开契约 + 三选项对勘（ProcessLocal/DurableLogDeferred/ExternalKvDeferred + RestartBreaksReplay/RestartAllowsReplay）
      Contract: 终审 NOTE + probe Q3（CommandId 进程内）
      Implementation: api_boundary.rs（仅契约，无持久化逻辑）
      Verification: `api_rt_01_idempotency_boundary_contract`
      Gate: EXTERNAL-API-RT-01 Unit 层

## 4. 红线白盒（design.md §6）
- [x] serde 反向断言：api_boundary.rs 零 `ResourceState`/`SessionPhase`/`CommandStatus`/`IdempotentDispatch`/`EventSeverity` 内部 enum 字样
      Contract: 终审 NOTE-2 + 0.7C-6 NOTE-1
      Implementation: 测试
      Verification: `api_rt_01_api_models_decoupled_from_runtime_types`
      Gate: EXTERNAL-API-RT-01 Unit 层
- [x] **API-BOUNDARY-01 白盒门禁（终审批准）**：api_boundary.rs 不得 `use` `backend`/`gstreamer`/`decklink`/`ffmpeg`/`pipeline` 实现/`provider` 实现（src 静态扫描测试）
      Contract: 终审 0.7C-6 批准（API 是消费者不反向修改）
      Implementation: 源码白盒扫描
      Verification: `api_rt_01_boundary_no_vendor_imports`
      Gate: EXTERNAL-API-RT-01 Unit 层
- [x] **终审禁清单 11 项零偷渡**（搜源码确认无 HTTP listener/REST route/OpenAPI/axum/hyper 等；无持久化/SQLite/Redis/Kafka；无第二套 RuntimeState；无 ApiResponse<T> 万能包装）
      Contract: 终审 0.7C-6 批准（开工边界冻结）
      Implementation: 测试夹具 + 源码 grep 双层校验
      Verification: `api_rt_01_no_transport_no_persistence`
      Gate: EXTERNAL-API-RT-01 Unit 层

## 5. 真机与回归
- [x] gate 段追加 API 资源快照打印（resource 五件套 + projection snapshot_kind）+ 全门禁回归
      Contract: 0.7 全阶段最高红线（Observation≠Configuration）
      Implementation: main.rs gate 段
      Verification: 盒上 VBMF_SESSION_LIFECYCLE=1 真机跑
      Gate: EXTERNAL-API-RT-01 Hardware 层 + SESSION/RESOURCE/IDEMPOTENCY/ERROR-MODEL/EVENT-PROJECTION-RT-01 回归
- [x] 五套 feature 编译不回退 + 盒上全矩阵
      Contract: CI 七 checks 口径 + 0.7A std-only 纪律
      Verification: p07_verify.sh 全绿
      Gate: PR required checks

## 6. 文档与收尾
- [x] Phase Map 0.7C-7 行 COMPLETE；0.7C 下一项 = Transport 实现（std-only）；债表 Idempotency 持久化条目登记
      Contract: PHASE_IMPLEMENTATION_MAP=唯一 SoT
      Verification: 文档对账
      Gate: verify
- [x] verify（0 CRIT/0 IMP 目标）→ archive → PR → merge → tag phase-0.7C7-external-api → 删分支