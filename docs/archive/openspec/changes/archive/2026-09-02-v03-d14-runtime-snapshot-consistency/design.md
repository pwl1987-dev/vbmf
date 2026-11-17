# Design — V0.3-1 D14 Runtime Snapshot Consistency（open 阶段高层框架）

> 深度技术设计（字段级/测试级/门禁级）在 **/comet-design 阶段** 的 Design Doc 细化；本文锁定方案选型与关键决策，build 阶段不得偏离此处选定的方案。

## Context

- `CanonicalRuntimeState`（`runtime_state.rs`）= 5 个 Vec + 单一 `generated_at_ms`（墙钟 `SystemTime`，非单调，`unwrap_or(0)`）。
- **唯一生产装配点** = `SessionManager::runtime_state()`（`session.rs:769`）；`RuntimeQuery` façade（`runtime_query.rs`）与 `GET /api/v1/runtime`（`transport.rs:209`）全部经此路径（本轮实码复核确认：façade 持 `Arc<SessionManager>`，所有 getter → `mgr.runtime_state()`）。
- `assemble()` 现签名接收 5 个源引用并自读 `now_ms()`——"纯函数"注释与墙钟副作用矛盾。
- 冻结契约锚点：EXTERNAL_API_CONTRACT §2 #126（additive 非破坏）、§4 `If-Match: "revision-N"`（乐观并发域，不消费不修改）；ARCHITECTURE_V0.2 §1.21 "Runtime Revision N+1"（config-apply 域，不消费不修改）；D9 先例（`RestartBreaksReplay` 谱系边界 + 单临界区击穿测试纪律）。
- 深度设计前必须保持的契约：`assemble` 纯性（观察参数全部外置为输入）、`SessionManager` 唯一 owner、wire additive、五套 feature 矩阵不回退。

## Goals / Non-Goals

**Goals:**
- 为 snapshot 定义可机器判定的**新旧关系**（单调 revision + 谱系 lineage）与**一致性声明**（swept non-transactional）。
- 修复 `assemble` 纯度矛盾（时间/序列全部成为显式输入）。
- 三层测试关闭 D14（Unit 纯性/单调/重启语义 + Simulation 连续读取/并发击穿 + Hardware 真机字段在场）。

**Non-Goals:**
- 不实现 Federation / SiteId / Membership / Authority / Fencing；不修改 `RuntimeEvent` / `DeviceId`；不实现 Control Plane。
- 不加 per-source observation time 字段（无消费方；swept 声明已充分）。
- 不改 `RuntimeQuery` 公开面（不新增 accessor——无消费方不建 API）；不改 `If-Match` 乐观并发与 config-apply revision 语义。

## Decisions

| # | 决策 | 选定方案 | 备选与否决理由 |
|---|------|---------|----------------|
| D1 | 观察序列 owner | `SessionManager` 内 `AtomicU64`（`fetch_add(SeqCst)` 天然唯一、无跳号、无重复、无锁）+ 构造时一次性 `Uuid::new_v4()` lineage | (a) 全局 static/OnceLock 计数器——否决：全局状态破坏可测性，且装配点唯一（owner 天然存在）；(b) 独立 `ObservationClock` 服务注入——否决：单一装配点，无第二消费方，过度抽象 |
| D2 | 单调性来源 | 进程内计数（构造即单调）；墙钟仅保留为 `generated_at_ms` freshness 参考 | (a) `Instant` 单调时钟——否决：不可序列化、不表达"第 N 次观察"；(b) 墙钟序列——否决：NTP 回拨非单调（Probe F5） |
| D3 | 重启语义 | revision 归零 + **新 lineage**；`(lineage, revision)` 全序，跨重启不可比由 lineage 不同显式化（客户端可机器判定） | (a) 持久化 revision（文件/SQLite）——否决：越界（D9 先例：durable 延后）；(b) 无 lineage 仅文档声明"进程内有效"——否决：文档不可机器校验，重启后比较是客户端陷阱 |
| D4 | 字段命名 | `observation_revision: u64` + `observation_lineage: Uuid`（serde 序列化为 canonical string） | 命名自解释且避开 V0.2 §1.21 "Runtime Revision"（config-apply 域）与 API §4 "revision-N"（乐观并发域）三处词汇纠缠；与未来 Federation Envelope 的映射：`SnapshotRevision ← observation_revision`、`ObservedAt ← generated_at_ms`、`Freshness ← 单调性保证`（映射注记留 design 阶段，字段本 change 不引入） |
| D5 | `assemble` 纯性修复 | 新签名 `assemble(..., obs: &SnapshotObservation)`，`SnapshotObservation { revision: u64, lineage: Uuid, observed_at_ms: u64 }` 为小参数 struct——同输入恒同输出成为真实语义；`now_ms()` 移出 `assemble`，由 `SessionManager::runtime_state()` 在装配前取值 | 备选：保留 `assemble` 签名 + `with_observation()` builder——否决：双构造器诱发误用，单一构造器 + 显式输入更诚实 |
| D6 | wire 兼容 | `ApiQuerySnapshot` additive 同名字段；`CanonicalRuntimeState` 新字段带 `#[serde(default)]`（revision→0, lineage→nil UUID）——双向非破坏：旧客户端不解析新字段（#126），旧序列化 blob 仍可解析 | 备选：新字段必填（无 default）——否决：`Deserialize` 派生已存在，无 default 会使旧 blob 解析失败，非真正非破坏 |
| D7 | 一致性类声明 | **swept non-transactional**：各源在装配点各自加锁观测，跨源无原子性；每源观察时刻 = 其加锁读取时刻 ≤ 装配完成时刻；声明落 `CanonicalRuntimeState` 文档注释（替换现"登记不实现"注释）+ D14 债务条目关闭 | 备选：per-source `observed_at_ms` 字段——否决（无消费方）；Federation 需要时 additive 补 |
| D8 | 键集合测试 | `runtime_state_rt_01_composition_descriptor_not_flattened` 顶层键集合断言更新为 8 键（additive 两字段）——测试随契约同 change 更新（Probe F13） | — |

## Risks / Trade-offs

- **[revision 空洞（crash/重启后序列不连续）]** → 契约只承诺**单调 + 唯一**，不承诺无空洞；文档显式声明（D3）。
- **[三处 "revision" 词汇混淆（本 change / config-apply / 乐观并发）]** → D4 命名自解释 + design 阶段术语映射表；三域互不替代。
- **[wire additive 被误读为 BREAKING]** → `#[serde(default)]` 双向非破坏 + 键集合/序列化测试锁定；EXTERNAL_API_CONTRACT #126 引用入 design 阶段验收场景。
- **[并发装配竞态]** → `AtomicU64::fetch_add` 无锁原子（D1），Simulation 层 8 线程击穿测试（D9-C 同构纪律）锁定唯一性 + 连续覆盖。
- **[纯度修复改变 `assemble` 调用面]** → 调用点唯一（`session.rs:769`）+ 测试内调用同步更新；五套 feature 矩阵编译即验证。

## Migration Plan

- 单 change 单分支交付；无数据迁移（纯内存状态）；无持久化兼容负担（wire 无落盘消费方，`#[serde(default)]` 已兜底）。
- 回滚 = revert commit：字段 additive，未解析新字段的消费者零感知。
- 盒上 matrix 新增：`GET /api/v1/runtime` 字段在场 + 连续读取 revision 单调断言（Hardware 层）。

## Open Questions

（以下均不改变方案/任务分解，可在 design 阶段裁定）
1. Hardware gate 打印面是否同步增加两新字段（倾向：是——字段在场 + 单调断言，随 tasks 落项）。
2. `SnapshotObservation` 参数 struct 的模块归属（`runtime_state.rs` 内 vs 独立小模块——倾向 `runtime_state.rs`，不发明新模块）。
