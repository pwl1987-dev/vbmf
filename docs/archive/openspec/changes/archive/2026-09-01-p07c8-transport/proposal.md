# Change: Phase 0.7C-8 — p07c8-transport（Transport 实现：API Boundary Model → wire 的序列化边界）

## Why

0.7C-7 Merge Gate PASS（master=`70d3ed1`）。0.7C-7 终审裁定 + 本阶段 Contract Probe（`docs/superpowers/reports/2026-09-01-p07c8-transport-contract-probe.md` 只读四问）：

- **顺序**：API Boundary Model（0.7C-7 ✅）→ **Transport 实现**（本 change）——只做模型到 wire 的序列化边界，不发明新端点、不改内部契约。
- **std-only 纪律**（0.7A）：禁 axum/hyper/tower/grpc。既有唯一 wire 面 = main.rs health（std TcpListener 单线程无解析）。
- **关键约束（probe Q3/Q4）**：`mgr` 仅诊断路径+gstreamer-backend 存在；生产路径无 mgr → runtime/commands 端点返回 503（契约诚实，能力边界暴露非隐藏）；/health、events/projection、idempotency/boundary 全路径可用。
- **PR 规模判定**：生产代码 diff 按文件白名单审核（transport.rs 新 + main.rs 接线），不按 PR 总行数。

## What Changes

- **`src/transport.rs`（新）**——std-only HTTP 序列化边界（零新依赖，仅 std + serde_json + uuid）：
  - **`TransportContext`**：`{ events: Arc<RuntimeEventLog>, agent_state: Arc<Mutex<AgentState>>, device_count: usize, query: Option<Arc<RuntimeQuery>>, idem: Option<Arc<CommandIdempotency>> }`——Query/Command 持 Option（生产路径 None→503），Event/agent_state/device_count 全路径。
  - **HTTP 解析（纯函数）**：`parse_request(buf) -> Option<(method, path, body)>`——请求行 `METHOD SP path SP HTTP/1.1` + 头部（仅取 Content-Length）+ body（**限长 1 MiB** 防内存放大）；无持久连接（每连接一请求后关闭，与 /health 既有模型一致）。
  - **路由（五端点，不发明）**：`GET /health`（行为不变，回归锚点）/ `GET /api/v1/runtime` / `POST /api/v1/commands` / `GET /api/v1/events/projection` / `GET /api/v1/idempotency/boundary`；未知 404 / 方法错 405 / 无 mgr 503（JSON body）。
  - **映射（纯函数，Unit 可测）**：
    - `map_command_request(&ApiCommandRequest) -> Result<CommandEnvelope, String>`——command_id 字符串：合法 UUID→`Uuid::parse_str`，否则→`Uuid::new_v5(&固定命名空间, bytes)` 确定性派生；kind 三词表封闭（start/stop/release_session，未知→Err=400）；`SessionById{session_id}`→UUID parse（失败 Err）；`Session{intent: Value}`→`from_value::<GraphRuntimeIntent>`（失败 Err）。**形状错=400（未触 Runtime）；形状对但语义拒绝=200+ApiCommandStatus::Rejected**（0.7C-3 不可执行性红线）。
    - `map_dispatch(&IdempotentDispatch) -> ApiCommandResponse`——Executed→Executed / Replayed→Replayed / Conflict→Conflict / Rejected→Rejected（**4 态不暴露 Failed**，NOTE-2；outcome Failed 经 classification=Some 传达）。
  - **`serve_connection(stream, ctx)`**：读请求→路由→写 `HTTP/1.1 {code} {reason}\r\nContent-Type: application/json\r\nContent-Length: N\r\n\r\n{body}`；单 accept 循环既有并发模型（不偷升级线程池/async）。
- **`main.rs` 接线**：
  - 诊断路径：`let api_mgr: Option<Arc<SessionManager>> = None;` 提升到 `if auto_start` 外；cfg(gstreamer-backend) 块内 `let mgr = Arc::new(SessionManager::new(...))`（**Arc 包装**——原 mgr 被 tick 线程 move，共享须 Arc；既有 `mgr.xxx()` 经 Arc 透传零语义变化）+ `api_mgr = Some(mgr.clone())`。
  - health 线程 spawn 点：构造 `TransportContext`（query/idem 由 api_mgr map 出 Option）+ `for s in listener.incoming().flatten() { transport::serve_connection(s, &ctx) }` 替换原"无解析一律回 health"（/health 响应体不变）。
- **门禁 TRANSPORT-RT-01（三层）**：
  - **Unit**（纯函数级，feature 无关）：parse_request 合法/畸形/超长按/无 Content-Length；路由表 404/405/503 语义；map_command_request 封闭词表（kind 三值+未知、UUID 合法/非法→v5 派生、target 二选一、intent 反序列化失败）；map_dispatch 四出口映射；/health body 形状不变。
  - **Simulation**（feature=mock）：std TcpListener 起**真实 loopback 端口**打真实 HTTP 请求断言响应（runtime 200 含 devices / commands POST 200 含 status / 404 / 405 / 无 mgr 503）——std-only 无依赖。
  - **Hardware**（真机）：gate 段以 curl 打真机端点，断言 /api/v1/runtime 200 + /api/v1/commands POST 200 + /health 回归 + 全门禁回归。
- **CI**：测试并入现有矩阵（mock 组含 loopback 集成测试）。

## Capabilities

（`skip_specs: true`——SoT 为 0.7C-7 终审裁定 + Transport Contract Probe + PHASE_IMPLEMENTATION_MAP §3。）

## Impact

- 编译：五套 feature 不回退；transport.rs 零 vendor/零 transport 依赖（仅 std + serde_json + uuid）。
- 受影响：新 `transport.rs`；`main.rs`（mod + 诊断路径 Arc 化 mgr + health 线程接线）；Phase Map（0.7C-8 行）；债表（无新增，Transport 收口 0.7C 顺序）。
- **明确不做**：新 transport 依赖（axum/hyper/tower/tonic）；持久连接/keep-alive、TLS、认证/RBAC（Fastify 反代层职责）；并发模型升级（线程池/async）；修改 rpc.rs 冻结接口；修改 Command/Query/Event 内部契约；新端点发明（仅五端点）；EventProjection 暴露为权威态（snapshot_kind 守门已冻结）。