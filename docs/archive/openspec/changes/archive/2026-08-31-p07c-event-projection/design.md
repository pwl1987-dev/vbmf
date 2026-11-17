# Design: Phase 0.7C-6 — p07c-event-projection

## 0. 终审裁定落点 + probe 结论引用

| 终审/probe 裁定 | 设计落点 |
|---|---|
| 0.7C-6 = 建立 `Runtime Event → Sink → Log → Projection` 生产边（非加事件类型） | §1 sink trait + §3 投影 Foundation |
| D8 是核心工作（Supervisor 决策者兼事件表持有者=职责倒置） | §2 Supervisor 收窄（probe Q2 三重职责→纯决策） |
| **Event Projection（内部边界）≠ External API（外部边界），不合并** | §4 明确不做清单首位 |
| 四语义零偷改（probe Q4 基线） | §3.2 测试矩阵逐项 |
| probe：drain_events/record 零生产消费者/调用者（除 supervisor 测试） | §2 API 收窄安全性论证 |

## 1. `RuntimeEventSink`（events.rs 增量）

```rust
/// 事件出口抽象 (D8) — 生产者只依赖本 trait, 不依赖 Supervisor。
/// 契约 (probe Q4): emit 永不阻塞、永不失败 (满则按两级丢弃策略+计数)。
pub trait RuntimeEventSink: Send + Sync {
    fn emit(&self, ev: RuntimeEvent);
}

impl RuntimeEventSink for RuntimeEventLog {
    fn emit(&self, ev: RuntimeEvent) { self.push(ev) }   // push 语义零改动
}
```

## 2. D8 解耦（单表双生产者）

**组合根（main.rs）**：

```rust
let event_log = Arc::new(RuntimeEventLog::new());          // 唯一实例
let supervisor = Supervisor::new(RestartPolicy::default(), Arc::clone(&event_log) as Arc<dyn RuntimeEventSink>);
let mgr = SessionManager::new(..., Arc::new(Mutex::new(supervisor)), event_log, ...);
```

- **SessionManager**：新字段 `events: Arc<dyn RuntimeEventSink>`（构造参数）；`emit()` 改 `self.events.emit(ev)`——**删除 `sup.lock().record()` 穿越路径**（session.rs:279）。`sup` 字段只剩 `report_failure` 等决策调用（watchdog tick 既有路径零变更）。
- **Supervisor**：删 `events: RuntimeEventLog` 字段 + `record`/`drain_events`/`pending_events` 三 API（probe Q3 证实零生产调用者——唯一调用在 supervisor 自己的测试）；`new(policy, sink: Arc<dyn RuntimeEventSink>)`；`report_failure`/`report_recovered`/`escalate`/`ingest` 内部 `self.events.push(...)` → `self.sink.emit(...)`。**决策逻辑/状态机/退避零改动**。
- **事件不丢失核对**：解耦前 session emit 与 supervisor 决策事件都进同一张 supervisor 内表；解耦后两者进同一张组合根表——**事件集合不变，仅出口归属变化**。顺序保持：两生产者经 `RuntimeEventLog` 同一把 Mutex 串行（全局 FIFO 维持）。
- **gate/测试夹具波及**（机械性）：`world()` 构造点 ×3（command/idempotency/error_model 测试）+ session 测试 + main.rs ×2——补传 log 参数；session 测试中经 `mgr.events()` 查询断言的（若有）改从组合根 log drain。SessionManager 是否暴露 `event_log()` 访问器：**提供**（`pub fn event_log(&self) -> Arc<RuntimeEventLog>`？——不，SessionManager 持的是 `Arc<dyn RuntimeEventSink>`（trait 对象，无 drain）。测试/gate 需要 drain——**另存一份 Arc<RuntimeEventLog> 于调用侧**（构造时同源克隆），SessionManager 不提供 drain 面eria（保持生产者角色纯净）。夹具模式：`let log = Arc::new(RuntimeEventLog::new()); let mgr = ...((log.clone() as Arc<dyn _>)); let supervisor = ...(log.clone())`。

## 3. Event Projection Foundation（`src/event_projection.rs` 新）

### 3.1 投影类型与纯函数

```rust
/// 事件流只读投影 — 仅由消费语义需要的字段组成 (组合非展开, 禁万能 struct)。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventProjection {
    /// 事件总数 (投影输入长度)。
    pub total: usize,
    /// 各 kind 计数 (canonical kind 字符串 → 次数; BTreeMap 稳定序)。
    pub kind_counts: BTreeMap<String, usize>,
    /// 每 session 最新状态 (session_id → 最后一条 SessionStateChanged.to)。
    pub session_states: BTreeMap<String, String>,
    /// SessionFailed 计数 (每 session)。
    pub session_failures: BTreeMap<String, usize>,
    /// 存在过 Critical 事件 (is_fault())。
    pub has_critical: bool,
}

/// 纯函数: 只读切片 → 投影。不改事件流、无副作用、确定性 (同输入同输出)。
pub fn project(events: &[RuntimeEvent]) -> EventProjection;
```

字段依据：四语义测试需要（total/kind_counts 验证顺序与完整性；session_states 验证最新态投影；session_failures 验证失败汇聚；has_critical 验证故障可见）——无多余字段。`RuntimeEvent` 需提取 session id 的事件仅 Session* 变体（其余无 session 维度）。

### 3.2 四语义测试矩阵（evt-proj-rt-01_*）

| 测试 | 语义 | 断言 |
|---|---|---|
| `vocabulary_snapshot` | 词表 | 14 变体 kind() 快照零改动回归（解耦不碰词表） |
| `project_is_pure_and_fifo` | 顺序+纯度 | 同输入两次投影相等；投影序=输入序（kind_counts 与 session_states 演进序）；入参切片不被修改（借用语义） |
| `loss_semantics_visible` | 丢失 | log 满时两级丢弃行为不变（Observation 挤出/Critical 保护/drop 计数）——**events.rs 既有测试回归 + 投影内 drop 计数不进入**（drop 计数在 log 上，投影输入是 drained 事件——丢失由计数器暴露，非投影伪造） |
| `duplicate_tolerant` | 重复 | 同事件双发投影两次计数——投影状态一致不崩（重复容忍锁定） |
| `decoupled_single_table` | D8 | Simulation：SessionManager 生命周期（create→start→stop 失败注入→close）+ supervisor report_failure 交替调用 → 组合根 log drain 全量含两类事件、**发射序**保持；Supervisor 自身无事件残留 API（编译级：record/drain_events 不存在） |
| `projection_failure_isolation` | failure | 投影函数消费 &[RuntimeEvent]——零副作用（drain 后投影，事件流已空不受影响；投影失败不存在路径——纯函数无 panic 点，expect 零使用） |
| 真机 EVENT-PROJECTION-RT-01 | Hardware | SESSION_LIFECYCLE 生命周期完成后：`event_log.drain()` → `project()` → 打印 `EVENT-PROJECTION-RT-01 total=? session_states=? failures=? critical=?`（消费接线实证）+ 回归全部门禁 |

## 4. 不做（终审分离裁定 + probe 演进项）

External API/REST/RPC transport；Health Reducer 完整实现（watchdog tick 语义不动——Supervisor 决策调用方零变更）；Supervisor 改事件驱动决策（消费循环属 watchdog 演进）；事件词表变更/零生产 4 项点亮（IdentityResolved/SignalVerified/LoopbackVerified/ResourceReservationExpired——登记演进）；持久化/跨进程总线；adapter 专属 mapper 接线；PreflightFailure 粒度 P1（deferred）。

## 5. 红线延续

- 事件词表 14 变体封闭零改动（快照回归）。
- Supervisor 0.6 HARD RULE（只决策不执行）解耦后**更纯**（无事件表职责）。
- 投影=Observation（只读快照），绝不写回 Runtime（Observation≠Configuration 红线）。
- 单表单锁：不加新锁、不拆表、不加 channel/总线。
