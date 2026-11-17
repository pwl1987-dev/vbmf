# Tasks: Phase 0.7C-8 — p07c8-transport

四栏纪律：`Contract: 已有(引用冻结文档节号) / Implementation / Verification / Gate`。

## 1. HTTP 解析 + 路由（design.md §1）
- [x] transport.rs：`ParsedRequest` + `parse_request`（请求行/Content-Length/1MiB 限长）+ `TransportContext` + `route()` 五端点路由表（404/405/503/200）
      Contract: probe Q1（扩展既有 listener）+ Q4-7（五端点不发明）+ /health 行为不变
      Implementation: transport.rs
      Verification: `transport_rt_01_parse_request_shapes` + `transport_rt_01_route_table`
      Gate: TRANSPORT-RT-01 Unit 层
- [x] `serve_connection`（读→解析→路由→写, 无持久连接）
      Contract: probe Q1（单 accept 循环既有并发模型）
      Implementation: transport.rs
      Verification: `transport_rt_01_loopback_http`（Simulation）
      Gate: TRANSPORT-RT-01 Simulation 层

## 2. 三平面映射（design.md §1）
- [x] `map_command_request`（command_id UUID 直用/v5 派生 + kind 三词表 + target 二选一 + intent 反序列化）
      Contract: 0.7C-7 design §1.2（ApiCommandRequest 模型）+ probe Q4-3/Q4-4
      Implementation: transport.rs
      Verification: `transport_rt_01_map_command_request`
      Gate: TRANSPORT-RT-01 Unit 层
- [x] `map_dispatch`（四出口封闭, 不暴露 Failed, classification 映射）
      Contract: 0.7C-7 NOTE-2（Status/Error 独立性）+ 0.7C-5 三平面分离
      Implementation: transport.rs
      Verification: `transport_rt_01_map_dispatch_four_exits`
      Gate: TRANSPORT-RT-01 Unit 层

## 3. main.rs 接线（design.md §2）
- [x] 诊断路径 Arc 化 mgr + `api_mgr: Option<Arc<SessionManager>>` 提升 + TransportContext 构造 + health 线程接线
      Contract: probe Q3/Q4-1/Q4-2（生产 503 契约诚实 / Arc 透传零语义变化）
      Implementation: main.rs
      Verification: 五套 feature 编译不回退 + 盒上矩阵
      Gate: TRANSPORT-RT-01 Hardware 层 + PR required checks

## 4. 真机与回归
- [x] gate 段 TRANSPORT-RT-01（真机 curl 打 /api/v1/runtime + /api/v1/commands + /health 回归 + 全门禁回归）
      Contract: 0.7 全阶段最高红线（Observation≠Configuration）
      Implementation: main.rs gate 段
      Verification: 盒上 VBMF_SESSION_LIFECYCLE=1 真机跑
      Gate: TRANSPORT-RT-01 Hardware 层 + SESSION/RESOURCE/IDEMPOTENCY/ERROR-MODEL/EVENT-PROJECTION/EXTERNAL-API-RT-01 回归
- [x] 五套 feature 编译不回退 + 盒上全矩阵（mock 组含 loopback 集成测试）
      Contract: CI 七 checks 口径 + 0.7A std-only 纪律（Cargo 零新依赖）
      Verification: p07_verify.sh 全绿
      Gate: PR required checks

## 5. 文档与收尾
- [x] Phase Map 0.7C-8 行 COMPLETE；0.7C §3 Transport 完成（**0.7C 全段收口**）；债表对账
      Contract: PHASE_IMPLEMENTATION_MAP=唯一 SoT
      Verification: 文档对账
      Gate: verify
- [x] verify（0 CRIT/0 IMP 目标）→ archive → PR → merge → tag phase-0.7C8-transport → 删分支