# Proposal — V0.3-1 D14 Runtime Snapshot Consistency

> 阶段定位：用户正式裁定（2026-09-01）"下一项 = V0.3-1 D14 Runtime Snapshot Consistency；Federation implementation 继续 BLOCKED"。
> 本 change 是 V0.3 架构演进链（V0.3-1 … V0.3-6）的第一环：先定义 **Local Runtime Observation ↓ Consistent Snapshot Contract**，Federation State Exchange（V0.3-4）才能定义 Observation Envelope。

## Why

**D14（登记债务，`PHASE_0_7A_POST_MERGE_DEBT.md` 0.7C 终审追加登记 L69）**：`runtime_state()` 是各源（devices/ports/resources/sessions）独立观测的拼合 snapshot，非事务一致；需定义 **source observation time / state version / 一致性语义**。关闭条件 = 独立 change + 三层测试（债务清单纪律，不允许"顺手修"）。

现状实码核查（Contract Probe，2026-09-01，基线 master@4d13265）：

1. `CanonicalRuntimeState` 只有**单一** `generated_at_ms: u64`（`runtime_state.rs:111`）——墙钟 `SystemTime::now()`（`now_ms()` L222-227），**非单调**（NTP 回拨/时区漂移下可倒退），且失败时 `unwrap_or(0)` 静默降级。
2. **无观察序列号**（任何 revision/sequence 语义）、**无进程谱系标识**、**无一致性声明**——消费者无法回答"这份 snapshot 比上一份新吗"、"重启后 revision 可比吗"。
3. `assemble()` 注释宣称"纯函数（无 IO/锁/全局; 同输入恒同输出）"，但体内调用 `now_ms()` 读墙钟（L185）——**纯度声明与实现矛盾**（对"时间输入"而言不纯）。
4. 每次查询（`RuntimeQuery` façade / `GET /api/v1/runtime`）都重新全量装配（`session.rs:769` 唯一生产装配点）——同一进程内连续两次读取之间**无任何可判定的新旧关系**。

**为什么现在**：D14 是唯一不依赖 Control Plane、不需要 Federation、不改变 Runtime ownership、不碰网络协议的基础能力，且是 Federation State Exchange 的直接前置——在版本语义未定义前做 Federation = 传播"没有版本语义的本地观察结果"。

## What Changes

全部为 **additive**（非破坏；EXTERNAL_API_CONTRACT §2 #126"非破坏字段增加不影响旧客户端"）：

1. **`CanonicalRuntimeState` 新增观察信封字段**（wire 与域内同步）：
   - `observation_revision: u64` —— 进程内**单调递增观察序列**：每次生产装配 +1，严格单调；**不是墙钟**，不受 NTP 影响；**重启重置为 0**（诚实谱系语义，与 D9 冻结边界 `RestartBreaksReplay` 同构）。
   - `observation_lineage: Uuid` —— **进程观察谱系**：进程启动时生成一次（UUIDv4），使 `(lineage, revision)` 构成**全序**——跨重启的 revision 不可比问题由 lineage 不同显式化，客户端可机器判定而非靠文档信任。
   - `generated_at_ms` **保留**，语义收窄为**freshness 参考**（装配时刻墙钟；用于新鲜度判断，不用于新旧排序）。
2. **`SessionManager` 成为观察序列唯一 owner**（已为唯一生产装配点，`session.rs:769`）：装配前在单一临界区递增计数器并取谱系值，作为**纯输入**传入 `assemble()`。`assemble()` 语义从"自读墙钟"改为"接收观察参数（revision/lineage/observed_at）"——**F4 纯度矛盾修复**：同输入恒同输出成为真实语义。
3. **`ApiQuerySnapshot` 同构 additive 投影**（`api_boundary.rs`）：`GET /api/v1/runtime` 响应新增同名字段；投影函数保持纯。
4. **一致性声明落契约**：`CanonicalRuntimeState` 的 D14 注释从"登记不实现"改写为关闭态声明——**一致性类 = swept non-transactional**（各源在装配点各自加锁观测，跨源无原子性保证；每源观察时刻 = 其加锁读取时刻 ≤ 装配完成时刻）；per-source observation time 的**粒度决策**（是否 per-source 时间戳）在 design 阶段裁定，默认**不加** per-source 字段（无消费方不建抽象——V0.2 纪律；未来 Federation Envelope 消费的是全局 revision）。
5. **三层测试**（D14 关闭条件）：
   - **Unit**：`assemble` 纯性（观察参数为输入）；`observation_revision` 单调递增；重启语义（新 lineage + revision 归零）；顶层键集合测试更新（additive 两字段）。
   - **Simulation**：`SessionManager` 连续两次 `runtime_state()` → revision 严格 +1、lineage 不变；并发装配单临界区无跳号/重复（击穿测试，D9-C 同构纪律）。
   - **Hardware**：真机 gate 实读 `GET /api/v1/runtime` 新增字段在场且单调（盒上 matrix 含此项）。
6. **D14 债务条目关闭**：`PHASE_0_7A_POST_MERGE_DEBT.md` D14 行标 CLOSED @ 本 change（含三层测试证据锚）。

**非目标（用户裁定边界，显式排除）**：不实现 Federation；不实现 SiteId；不实现 Membership；不实现 Authority/Fencing；不修改 `RuntimeEvent`；不修改 `DeviceId`；不实现 Control Plane；不改 `If-Match` 乐观并发语义（EXTERNAL_API_CONTRACT §4 已冻结，本 change 不消费也不修改它）；不实现 V0.2 §1.21 config-apply 的 "Runtime Revision N+1"（那是配置应用域，未实现）。

**术语区分（防三处 revision 词汇纠缠）**：
- D14 `observation_revision` = **本地观察序列**（本 change）。
- V0.2 §1.21 "Runtime Revision N+1" = **config-apply 事务切换**域（Control Plane 时代，未实现）。
- EXTERNAL_API_CONTRACT §4 `If-Match: "revision-N"` = **API 乐观并发**域（已冻结，未实现）。
三者命名自解释、互不替代；本 change 只定义第一种，后两种保持原状。

## Capabilities

（`skip_specs: true` —— SoT = `PHASE_0_7A_POST_MERGE_DEBT.md` D14 + `EXTERNAL_API_CONTRACT.md` §2/§4 + `ARCHITECTURE_V0.2.md` §1.21 + `PHASE_IMPLEMENTATION_MAP`；项目既有 17 个 change 均循此惯例，specs 目录为空。）

### New Capabilities
- `runtime-snapshot-observation`（行为契约落点，spec 级描述由 D14 债务条目 + 本 proposal/design 承担）：snapshot 观察信封（revision 单调性 / lineage 谱系 / 重启重置 / freshness 参考）+ 一致性类声明（swept non-transactional）。

### Modified Capabilities
- 无既有 spec 被修改（specs 目录为空）。

## Impact

- **代码**（`services/media-agent/src/`）：
  - `runtime_state.rs`：struct additive 两字段；`assemble` 签名接收观察参数（纯性修复）；`now_ms()` 处置（移入装配 owner 或保留为纯输入来源）；顶层键集合测试更新。
  - `session.rs`：`SessionManager` 新增观察序列 owner 字段（`AtomicU64` 或等价的单临界区封装）+ lineage 一次性生成；`runtime_state()` 装配前递增。
  - `api_boundary.rs`：`ApiQuerySnapshot` additive 两字段 + 投影透传。
  - `runtime_query.rs`：façade 的 D14 镜像注释同步更新。
  - `main.rs`：RUNTIME-STATE-RT-01 hardware gate 打印兼容（additive 字段可打印可断言）。
- **Wire**：`GET /api/v1/runtime` 响应 additive（非破坏 #126）；旧客户端忽略新字段。
- **消费方**：`RuntimeQuery` façade 语义不变（仍每次全量装配，现获得可判定的 revision 递进）；transport 投影纯函数扩展。
- **未来接口（仅预留，不实现）**：Federation Observation Envelope（V0.3-4）= `SiteId + AgentId + SnapshotRevision + ObservedAt + ProducerEpoch + Freshness + Snapshot`——其中 `SnapshotRevision`/`ObservedAt`/`Freshness` 的本地载体即本 change 的 `observation_revision`/`generated_at_ms`/单调性保证；`SiteId`/`AgentId`/`ProducerEpoch` 属 V0.3-2/V0.3-3，本 change 不引入。
- **构建矩阵**：五套 feature 组合不回退；新增字段 serde 双向（`Deserialize` 需对新字段给默认值策略还是拒绝旧 wire？→ design 阶段裁定，倾向 additive 必填 + 旧客户端本就不解析，agent 自身 wire 无持久化兼容负担）。
- **文档**：`PHASE_0_7A_POST_MERGE_DEBT.md` D14 关闭；`PHASE_IMPLEMENTATION_MAP` V0.3 段（如已建）补 V0.3-1 行——**PHASE_IMPLEMENTATION_MAP 为唯一 SoT，文档漂移 = P0**。
