# Design: Phase 0.7C-8 — p07c8-transport（Transport 实现）

## 0. 终审裁定 + probe 引用落点

| 裁定/probe 结论 | 设计落点 |
|---|---|
| std-only 纪律（禁 axum/hyper/tower/grpc） | transport.rs 仅 std + serde_json + uuid（Cargo 零新依赖） |
| API Boundary Model 已冻结（0.7C-7） | 复用 `api_boundary.rs` 全部类型 + `to_api_*` 纯函数；**零改动** api_boundary.rs |
| 扩展既有 health listener，/health 行为不变 | 同 `cfg.health_bind` 单端口单 accept 循环；/health body 形状回归锚点 |
| mgr 仅诊断路径+gst → 生产 503 契约诚实 | `TransportContext.query/idem: Option<...>`；None→503 |
| 诊断路径 Arc 化 mgr | `let mgr = Arc::new(SessionManager::new(...))` + `api_mgr: Option<Arc<SessionManager>>` 提升 |
| command_id 字符串→UUID | 合法 parse；非法 `Uuid::new_v5(&NS, bytes)` 确定性派生 |
| 形状错=400 vs 语义拒绝=200+Rejected | map_command_request Err→400；dispatch Rejected→200+ApiCommandStatus::Rejected |
| 四出口不暴露 Failed | map_dispatch 穷举四出口 |
| 无持久连接/单请求/1MiB 限长 | parse_request + serve_connection |

## 1. transport.rs 结构

```rust
pub struct TransportContext {
    pub events: Arc<crate::events::RuntimeEventLog>,
    pub agent_state: Arc<std::sync::Mutex<crate::health::AgentState>>,
    pub device_count: usize,
    pub query: Option<Arc<crate::runtime_query::RuntimeQuery>>,
    pub idem: Option<Arc<crate::idempotency::CommandIdempotency>>,
}

/// 请求行解析结果。
pub struct ParsedRequest { pub method: String, pub path: String, pub body: Vec<u8> }

/// 纯函数: 从原始字节解析 HTTP 请求 (请求行 + Content-Length + body 限长 1 MiB)。
/// 畸形/超限 → None (serve_connection 回 400)。
pub fn parse_request(buf: &[u8]) -> Option<ParsedRequest>;

/// 固定命名空间: 非 UUID 字符串 command_id → 确定性 v5 派生 (幂等键稳定)。
pub const COMMAND_ID_NAMESPACE: uuid::Uuid = uuid::Uuid::from_u128(0x62b79f8c_1a2e_4c3d_9f0b_5d6e7a8b9c0d);

/// 纯函数: ApiCommandRequest → CommandEnvelope (形状校验; Err=400 detail)。
pub fn map_command_request(req: &crate::api_boundary::ApiCommandRequest) -> Result<crate::command::CommandEnvelope, String>;

/// 纯函数: IdempotentDispatch → ApiCommandResponse (四出口封闭, 不暴露 Failed)。
pub fn map_dispatch(d: &crate::idempotency::IdempotentDispatch) -> crate::api_boundary::ApiCommandResponse;

/// 路由 + 响应 (纯逻辑, 可注入 ctx 测试)。返回 (status, json_body)。
pub fn route(method: &str, path: &str, body: &[u8], ctx: &TransportContext) -> (u16, String);

/// 连接处理: 读→解析→路由→写 (无持久连接, 处理完关闭)。
pub fn serve_connection(mut stream: std::net::TcpStream, ctx: &TransportContext);
```

**路由表（route() 内）**：
| method+path | 处理 | 状态 |
|---|---|---|
| GET /health | 既有 body {state,devices,active_pipelines,dropped_bus_events,clock_lost_events} | 200 |
| GET /api/v1/runtime | `ctx.query`→`get_runtime_state()`→`to_api_query_snapshot`；None→503 | 200/503 |
| POST /api/v1/commands | body→`ApiCommandRequest`（serde）→`map_command_request`→`ctx.idem.dispatch`→`map_dispatch`；解析/映射 Err→400；None→503 | 200/400/503 |
| GET /api/v1/events/projection | `events.drain()`→`project`→`ApiProjectionResponse` | 200 |
| GET /api/v1/idempotency/boundary | `default_idempotency_boundary()` | 200 |
| 已知 path 错误 method | 405 {error} | 405 |
| 未知 path | 404 {error} | 404 |
| 解析失败 | 400 {error} | 400 |

**/health body 不变性**：`route` 的 /health 分支与 main.rs 原逻辑逐字段一致（state 经 `agent_state` 序列化、active_pipelines 经 `pipeline_events::HEALTH_ARCS`、dropped/clock 经 `pipeline::` 计数）——回归锚点。

## 2. main.rs 接线（最小 diff）

```rust
// if auto_start 外:
let api_mgr: Option<Arc<crate::session::SessionManager>> = None;
if auto_start {
    #[cfg(feature = "gstreamer-backend")]
    {
        let mgr = Arc::new(crate::session::SessionManager::new(...));  // Arc 包装 (原 move 进 tick 线程, 共享须 Arc)
        let api_mgr_for_ctx = Some(mgr.clone());
        ... // 既有 create/start/watchdog/tick 零语义变化 (Arc 透传)
        // 块末: *api_mgr_slot = api_mgr_for_ctx;  — 用 FnOnce 闭包或 Cell 传递 (见实现)
    }
}
// health 线程:
let ctx = crate::transport::TransportContext {
    events: event_log.clone(),
    agent_state: agent_state.clone(),
    device_count,
    query: api_mgr.as_ref().map(|m| Arc::new(crate::runtime_query::RuntimeQuery::new(m.clone()))),
    idem: api_mgr.as_ref().map(|m| Arc::new(crate::idempotency::CommandIdempotency::new(m.clone()))),
};
for s in listener.incoming().flatten() {
    crate::transport::serve_connection(s, &ctx);
}
```

> `api_mgr` 在 cfg 块内赋值（块外声明）：用 `let mut api_mgr: Option<...> = None;` + 块内 `api_mgr = Some(mgr.clone());`（`if auto_start` 与 cfg 块同函数作用域内可直接捕获可变绑定）。

## 3. 测试矩阵（transport_rt_01_*）

| 层 | 测试 | 覆盖 |
|---|---|---|
| Unit | `transport_rt_01_parse_request_shapes` | 合法 GET/POST+body / 无 Content-Length 空 body / 超限 400 / 畸形请求行 None |
| Unit | `transport_rt_01_route_table` | 404 未知 / 405 方法错 / 503 无 mgr / 200 /health 形状不变 |
| Unit | `transport_rt_01_map_command_request` | kind 三词表+未知 400 / UUID 合法直用+非法 v5 派生（确定性: 同串同值）/ SessionById UUID 非法 400 / intent 反序列化失败 400 |
| Unit | `transport_rt_01_map_dispatch_four_exits` | Executed/Replayed/Conflict/Rejected 四出口 + classification 映射 + 不暴露 failed |
| Simulation (mock) | `transport_rt_01_loopback_http` | std TcpListener 真 loopback 端口: GET /api/v1/runtime 200 含 devices / POST /api/v1/commands 200 含 status / GET /health 200 / 404 / 405 / 无 mgr 503 |
| Hardware | gate 段 TRANSPORT-RT-01 | 真机 curl: /api/v1/runtime 200 + /api/v1/commands POST + /health 回归 + 全门禁回归 |

## 4. 红线延续

- 0.7 全阶段最高红线：Observation≠Configuration / Semantic Intent≠Execution Plan / Canonical 不绑回 Vendor
- 0.7C-3 不可执行性：map_command_request 零执行字段（形状映射）；dispatch 薄映射
- 0.7C-5 三平面分离：map_dispatch 不聚合万能 Result（status+classification 独立字段）
- 0.7C-6/7 NOTE：snapshot_kind 守门（projection 端点）/ API 模型独立 / 不暴露 Rust serde tag
- std-only：Cargo.toml 零新依赖（transport.rs 仅 std + serde_json + uuid，均既有）

## 5. 触碰面

`transport.rs`（新）/ `main.rs`（mod + 诊断路径 Arc 化 + health 线程接线）。**零触碰**：api_boundary.rs / command.rs / idempotency.rs / runtime_query.rs / event_projection.rs / rpc.rs / 其余模块。