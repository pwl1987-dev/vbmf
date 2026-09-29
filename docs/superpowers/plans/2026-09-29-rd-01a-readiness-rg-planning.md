# RD-01A — Readiness Axis + Redundancy Group Semantics Planning（2026-09-29）

> 性质：REDUNDANCY-ENTRY-01 首子包 **planning-only**（用户 2026-09-29 指令 §9–§14；只 planning
> 不编码；Runtime 写入面在 stability ladder 期间冻结——STATE §3.88 并行边界）。
> Authority：`docs/architecture/ARCHITECTURE_V0.2.md` §3.4/§3.5/§3.9/§5/§8.4/§8.9/§8.11（frozen）；
> `docs/superpowers/plans/2026-09-29-redundancy-entry-01-planning.md`（frozen entry plan）；
> live `main` @ `9e68043` code facts（本文 §2 全部可复核）。

## 1. 范围与红线

**做（将来实施包的内容边界）**：readiness representation、redundancy-group identity/config
semantics、observation、query/projection、preflight eligibility 语义登记。

**不做（红线，本 planning 同样不放宽）**：

- auto failover 任何形态：`watchdog.rs` `GroupAction` 封闭词表仅 `ReportInputFailure`（冻结
  #10 不推翻）；回归锚 `switch_rt_01_no_auto_failover_path` 锁死；
- "watchdog detects fault → switch backup"（属 RD-01C 显式决策链，独立 bounded packet）；
- hysteresis 实现、Redundancy Group Runtime wiring、auto failover implementation
  （STATE §3.88 禁止清单——这些会重改变 stability target）；
- 偷合并 readiness/health 为单布尔；用 `AgentState` 侧写 readiness；
- Fastify/Web Console/SDK 建立第二 Runtime truth（readiness/node_role/RG observed 只由
  Runtime 写；消费面只读投影——HI-01A 同构）。

## 2. Live code 现状 owner map（@ `9e68043`，全部 exact 可复核）

| 关注点 | 现有 owner（文件/类型） | 现状事实 |
|---|---|---|
| Session lifecycle | `session.rs` `SessionManager`/`MediaSession` | `SessionState`（Reserved/Running/Paused/Releasing/Released）+ `SessionPhase` 微相位白名单迁移 |
| Agent 进程健康 | `health.rs` `AgentState` + `reduce(HealthFold, &[RuntimeEvent])` | 8 态优先级折叠格（单 agent 态，**非树**） |
| 进程恢复决策 | `supervisor.rs` `Supervisor` | 纯决策引擎：`SupervisorAction` = Restart/Escalate；消费 `classify_failure_domain`（Input/Bridge/Program/None）+ custody `attribute_failures`；**决策零分支消费域证据**（域→恢复策略属 03-02 Recovery Contract） |
| 组观测 | `watchdog.rs` `spawn_execution_group_watchdog` → `execution_group_observe_fold` | tick → `GroupObservation`；`InputHealthFold` 事实位（observed/advancing/pts_monotonic/stalled——**事实位非结论位**）；`GroupAction` 仅 `ReportInputFailure` |
| switch desired/epoch | `switch_execution.rs` `ExecutionGroup` | 组内**唯一持有** `SwitchDesired`（ActiveInput/Switching/RecoveryRequired）+ `switch_epoch`；与 Session 协作不合并（T9：ACTIVE A→B 不改 Session RUNNING）；首版恰双输入 |
| switch 执行 | `program_execution.rs` `ProgramExecutionRuntime`（组合根装配后 program 资源唯一 owner） | `plan_switch` fail-closed → `SwitchExecutionPlan` → adapter 执行；`TimelineAuthority` 独立拥有 program_epoch/segment（**不是第二个 switch state machine**） |
| switch 命令/查询面 | `switch_dispatch_plane.rs` | `SwitchDispatchPlane::switch`（命令动词）+ `SwitchReadbackPlane::observe`（`program_switch` 投影块唯一数据源，R60③；命令动词禁入查询面） |
| runtime 投影 | `runtime_state.rs` `CanonicalRuntimeState`（D14 swept non-transactional, start-ordered）经 `runtime_query.rs` | devices/ports/resources/sessions/media_semantics + observation revision/lineage；`SessionRuntimeState` 有 state/phase/claims/inputs/outputs——**无 readiness/RG/node_role 字段** |
| preflight | `preflight.rs`（8 阶段→Verdict Pass/Warn/Fail）+ `resource.rs` acquisition preflight | Graph/PortAvailability/ResourceCapacity/LeaseConflict/IdentityBinding/BackendCapability(WARN)/Topology(report)/Risk(report) |
| additive wire 先例 | `api_boundary.rs` `ApiProjectionResponse.faults`（HI-01A） | `#[serde(default)]` 非破坏扩展——RD-01A 投影沿用此模式 |
| Fastify 表族 | `apps/api/drizzle/`（0000–0004） | auth/identity、audit、event_outbox、alarms——**无** channel_routes/health_trees/media_session_runtime（V0.2 §5 为逻辑模型，未落地） |
| readiness 轴 / RG / hysteresis / Hot-Standby policy / failover_benchmarks | —— | **零实现**（entry plan §1 诚实基线不变） |

**术语澄清（防混用）**：custody/master_join 现有 "readiness gate" 是 MASTER_SWITCH 的
normalize-evidence 门（执行前置证据），与 §8.11 Readiness 轴（能否接管）**语义不同**；
RD-01A 文档与实施中不得复用该词指代 readiness 轴。

## 3. Owner 九问（设计裁决 D1–D9）

| # | 问题 | 裁决 | 依据 |
|---|---|---|---|
| D1 | 谁拥有 Readiness truth？ | **Runtime（media-agent 进程内）**：readiness 判定输入折叠（`InputHealthFold` 同族的观测折叠，新增 readiness 事实/结论位）+ Runtime state 写入；Fastify/Web/SDK/watchdog 均不写 | Runtime owns truth；HI-01A 同构 |
| D2 | 谁拥有 RG configuration？ | **Configuration Intent（声明面）**：`redundancy_group_id` 声明哪些 source 构成候选组（§5：同 RG = 一个冗余组；NULL = 无冗余单节点；OFFLINE 切换必须保持同 RG 不丢组）。首版落地形态 = session intent 的 additive 声明 + agent 内 RG 登记表（见 D8） | §3.9/§5 Errata-14；ExecutionGroup 保持执行边界不动 |
| D3 | 谁拥有 observed readiness？ | **Runtime**：per-input（RG 成员）readiness 观测（输入侧证据：observed/advancing/pts_monotonic/stalled + normalize/capability 证据聚合）；session 级 readiness 为投影聚合 | §8.11 `media_session_runtime.readiness` 是 Runtime 写入 |
| D4 | 谁拥有 failover eligibility？ | **Runtime eligibility 观测面**（eligibility ≠ decision，§3.4 Errata-7 模式）：capability contract（静态）+ runtime alignment（观测）+ readiness（本包）三输入的**可查询 eligibility 快照**；最终 `SwitchDecisionResult` 只能由 decision tree 产生（RD-01C） | §3.4 `packet_switch_eligibility` + 决策树锁死 |
| D5 | 谁拥有 failover decision？ | **Supervisor/策略引擎——单一决策点**（显式 decision 面，新类型，不改 watchdog fold 封闭性）；**RD-01A 只登记不实现** | entry plan §4；冻结 #10 |
| D6 | 谁拥有 switch execution？ | **既有 canonical switch command 面**（switch_dispatch_plane → ProgramExecutionRuntime），无旁路；failover 与 manual switch 同面同幂等/审计 | entry plan §4 |
| D7 | 谁记录 benchmark？ | **`failover_benchmarks` 测量面**（p50/p95/p99 实测；Architecture Definition 不含 benchmark 字段）——RD-01E | §3.5 Errata-4 |
| D8 | 谁投影给 API/Alarm/Web？ | **Runtime canonical state additive 投影块**（serde default 兼容）→ Fastify Product API → SDK → Web Console 派生只读；Alarm 侧经 HEALTH-INCIDENT 既有 RuntimeEvent→alarm 派生链（readiness 丢失 = standby failed → 失去 failover 候选属 health tree 聚合语义，不新造第二 alarm 状态机）。V0.2 §5 表族（health_trees 等）**不在 RD-01A 落 PG**——Runtime 内存真值 + canonical 投影先行，DB 持久化形态独立裁决（Fastify 现无该表族，不为此扩面） | §3.9 Errata-12/13/14；HI-01A/D1 模式 |
| D9 | node_role/required_node 归属？ | **node_role（ACTIVE/STANDBY/OFFLINE）= Runtime Fact，仅 Runtime 写**；required_node = derived（ACTIVE→TRUE；STANDBY/OFFLINE→FALSE），禁止 Runtime 独立写 required_node 与 node_role 矛盾；invariant = CHECK/应用层双层（live 实施等价物：投影装配处机械断言） | §5 Errata-13/14 锁死 |

**禁止的第二 truth 清单**（红线重申）：Fastify redundancy truth、Web Console redundancy
truth、Watchdog orchestration truth、SDK 本地判定——全部不存在；消费面只读投影。

## 4. Readiness ≠ Health——三轴语义（防偷合并）

采用 §8.11 三轴分离（Cleanup-2 修正），live 映射与新增面：

| 轴 | 词表 | live 对应物 | RD-01A 动作 |
|---|---|---|---|
| lifecycle | STOPPED/STARTING/RUNNING/STOPPING | SessionState/SessionPhase（现有；进程级 AgentState Starting/Ready/… 亦存在——投影时声明映射，不新造） | 投影聚合声明 |
| readiness | NOT_READY/READY_TO_TAKE | **无**（custody "readiness gate" 语义不同，不得复用） | **新增轴**（观测折叠 + 投影字段） |
| health | HEALTHY/DEGRADED/FAILED/UNKNOWN | AgentState 8 态（agent 级）+ 事件级 failure domain（HEALTH-INCIDENT D2）；树级 = §3.9 聚合（未落地） | 只读引用，不并入 readiness |

典型组合（§8.11 原表，实施测试必须覆盖至少全部六行）：

| 角色 | lifecycle | readiness | health | 含义 |
|---|---|---|---|---|
| Primary 健康 | RUNNING | READY_TO_TAKE | HEALTHY | 正常播出 |
| Primary 故障中 | RUNNING | NOT_READY | DEGRADED | 异常降级 |
| Backup 完全就绪 | RUNNING | READY_TO_TAKE | HEALTHY | 真 Hot Standby |
| Backup 启动中 | STARTING | NOT_READY | UNKNOWN | 未到接管条件 |
| Backup 编码不稳 | RUNNING | NOT_READY | DEGRADED | **不应触发接管**（readiness 门独立于 health 门） |
| 已停止 | STOPPED | NOT_READY | UNKNOWN | Cold Standby |

- `isHotStandbyReady = lifecycle==RUNNING && readiness==READY_TO_TAKE && health==HEALTHY`
  ——三项合取，**任何单轴不可替代**；failover 允许/拒绝必须按此展开裁决（entry plan §3
  链的 `backup READY_TO_TAKE` 环 = readiness 轴实证，非 health 侧写）。
- "RUNNING + NOT_READY + HEALTHY" 与 "RUNNING + READY_TO_TAKE + DEGRADED" 都是**合法
  可观测态**——实施不得用非法组合 panic 隐藏，也不得把 NOT_READY 折叠进 DEGRADED。

### Readiness 判定输入（观测面设计骨架，RD-01A 实施包细化冻结）

`READY_TO_TAKE` 是**结论位**，由 Runtime 折叠以下**事实位**输入（对齐 §3.5 HOT 语义
"完整 pipeline 运行可接管"）：

1. input 观测事实（复用 `InputHealthFold`：observed/advancing/pts_monotonic/stalled）；
2. 所在 pipeline 物化并运行（handle 存活、program graph 内非 active 候选通路可用）；
3. normalize/capability 证据（MASTER_SWITCH 语义下 backup normalize evidence 完备——
   与 custody 门同源不同用途：custody 门 = 本次切换前置；readiness = 持续观测位）；
4. resource/lease 持续有效（backup 资源被夺取 ⇒ 立即 NOT_READY——见 §6 矩阵第 5 行）。

**去抖注意**：readiness 翻转本身**不加** hysteresis（那是 failover/failback decision 的
RD-01C 面）；readiness 是即时观测结论位，历史/持续时长证据供 decision 层消费。

## 5. RG identity/config 语义（D2 细化）

- `redundancy_group_id: UUID`；同 RG 的 Source 输入构成一个候选组（Primary+Backup 同组）；
  NULL = 无冗余单节点（Master/HLS 等语义）。
- RG 是**配置/候选关系语义层**，叠加在既有 `ExecutionGroup`（执行边界）之上：执行组
  保持"恰双输入 + initial active"不动；RG 声明这两个输入的候选关系与 `node_role`
  观测位。**不推翻、不合并 ExecutionGroup/Session（T9）**。
- `node_role` 初值由配置（initial active ⇒ ACTIVE；其余 ⇒ STANDBY）；运行中由 Runtime
  随 observed active 翻转更新（手动切换后 ACTIVE/STANDBY 对调；OFFLINE = 候选离组，
  RG id 不丢）。**failover 未实现前，role 翻转唯一入口 = canonical switch command**
  （手动），自动翻转属 RD-01C/D。
- 首版形态：intent additive 声明 `redundancy_group`（组 id + 成员 device 引用 +
  initial active）→ agent 内 RG 登记表（Runtime 内存真值）→ canonical state 投影
  `input_readiness`/`node_role`/`redundancy_group_id` 块（serde default additive）。
  未声明 RG 的既有会话 = 行为零变化（缺省 NOT_READY? **否**——缺省 = 无 readiness 块/
  `null`，**诚实缺席 ≠ NOT_READY**，防旧会话被误标未就绪）。

## 6. Failure-first matrix（设计骨架；注入验证属 RD-01C/01E）

符号：d=detect（谁观测）｜c=classify（failure domain/归因）｜dec=decision（owner+时机）｜
cmd=command 通路｜obs=actual observation｜alm=Alarm/Incident｜rec=recovery/failback｜
truth=final canonical truth。

| # | 故障 | d | c | dec | cmd | obs | alm | rec | truth |
|---|---|---|---|---|---|---|---|---|---|
| 1 | primary signal loss | watchdog 输入观测（InputHealthFold stalled/not-advancing） | Source 域 | RD-01C（hysteresis 后策略引擎） | canonical switch command | SwitchReadbackPlane observed 翻转 | source 域 alarm（HI 链） | min_hold + failback_hysteresis | observed_active + node_role 对调 |
| 2 | primary process crash | 进程/watchdog+Supervisor | Pipeline 域 | Supervisor Restart 优先；跨域切源须策略面 | 同上 | 同上 | pipeline 域 alarm | Restart/Escalate 既有链 | Session 生命周期与 RG role 分轴表达 |
| 3 | backup not READY_TO_TAKE（failover 时刻） | readiness 观测折叠 | Source 域 | failover 拒绝（fail-closed，无 fallback 到坏 backup） | 无切换（拒绝即结论） | desired 不变 | readiness 丢失 alarm（standby failed ⇒ DEGRADED 聚合） | backup 恢复 READY 另起 | 保留 primary active + backup NOT_READY 实况 |
| 4 | backup degraded（但仍 READY） | health 面 | Source 域 | 策略裁决（HEALTHY 非必需——三轴独立） | 若执行则同 1 | 同上 | degraded alarm | 视策略 | 三轴如实（READY+DEGRADED 可切换是显式裁决非默认） |
| 5 | backup resource/lease lost | resource/lease 观测 | Resource 域 | readiness 即翻 NOT_READY（即时，非 hysteresis 面） | 阻止在途 failover（preflight/eligibility FAIL） | resource 域事实 | resource alarm | 重新获取后恢复 READY | resource 状态 + readiness 联动实证 |
| 6 | format mismatch（主备能力不齐） | capability/静态契约 + runtime alignment | 兼容性（非故障域） | decision tree 降级链（§3.4）——eligibility FAIL ⇒ REJECT 不切 | REJECT 结果记录 | 无翻转 | REJECT 证据事件 | 修复能力面后重评 | SwitchDecisionResult=REJECT 落档 |
| 7 | AV mismatch（双平面分离） | SwitchFold.av_paired=false 观测 | Switch/Master 域 | 阻止 MASTER 语义裁决；观测域归因 | 不执行 | av_paired 实况 | switch 域 alarm | 对齐恢复 | av_paired=false 如实投影 |
| 8 | clock lost | Clock 观测（RH-CLOCK 链） | Clock 域 | **不切源**（§8.9：Clock 域不切源） | 无 | clock 状态 | clock alarm | fallback clock | CLOCK_DEGRADED 实况 |
| 9 | switch timeout | switch 执行面超时 | Switch 域 | RecoveryRequired 终态（R63-A 契约） | reconcile_switch | observed unknown（absence≠false） | switch alarm | 会话级 teardown/人工 | RecoveryRequired 落档 |
| 10 | switch actual ≠ requested | readback 不一致 | Switch 域 | 同 9 语义族 | —— | observed≠desired 如实 | 同上 | 同上 | observed 是 truth，desired 是意图 |
| 11 | partial recovery（主源半恢复） | 输入观测部分事实位翻转 | Source 域 | 不满足 failback 判据则不回切 | 无 | 事实位部分翻转实况 | 视程度 | 继续观测 | 三轴/事实位不猜测 |
| 12 | primary recovery during failover（在途） | 观测与命令并发 | 并发裁决 | 在途切换**不中止**（幂等/epoch 既有）；恢复另走 failback 判据 | epoch 防冲突（既有） | epoch 单调实况 | —— | min_hold 后评 failback | switch_epoch + observed 落定 |
| 13 | failback hysteresis（早回切抖动） | 恢复持续时间观测 | Source 域 | failback 需 > failback_hysteresis_ms（独立于 failover 去抖） | canonical 命令同面 | 同 1 | —— | 同 1 | 同 1 |
| 14 | repeated flap（反复震荡） | 去抖窗口内多次翻转计数 | Source 域 | hysteresis/min_hold 吸收；超限 escalate | 视策略 | 翻转历史 | flap alarm | 人工/策略 | 翻转历史如实 |
| 15 | both primary and backup failed | 双输入观测 | Source 域 | Source RG 全候选不可用 ⇒ Channel FAILED（§3.9 规则 3） | 无可切 | 全 FAILED | critical alarm | 垫片/紧急预案（后续） | FAILED 聚合实况 |
| 16 | operator manual switch concurrent（与策略并发） | 命令面 | 并发裁决 | manual 经同一 canonical 命令面 = 事实入口；策略面若并行触发必须经同面幂等裁决（RD-01C） | 同面 | epoch/observed 落定 | 审计 | —— | 单一命令面落定 |
| 17 | reload/reconnect during transition | 消费面重连 | —— | 投影面：reload-first snapshot 收敛（WCE 既有语义），readiness/RG 块同规则 | —— | SSE/reload 收敛 | —— | —— | canonical state 单源收敛 |

## 7. RD 分解 reconciliation（frozen 为准）

Frozen entry plan §5 分解**保持不变**（用户 2026-09-29 §13 建议与 frozen 语义同构，按
Authority 顺序取 frozen）：

- **RD-01A** readiness 轴 + RG 语义（观测面先行）——本文档；
- **RD-01B** policy 面（COLD/WARM/HOT 声明 + per-session 允许位）+ preflight 扩展
  （⊇ 用户建议的 eligibility/compatibility/preflight 实施面；RD-01A §4 判定输入 +
  §6 行 6 为其语义前置）；
- **RD-01C** failover/failback hysteresis + Supervisor 显式决策链（entry plan §3 全链；
  §6 矩阵的 decision 列在此落地）；
- **RD-01D** MASTER_SWITCH 真机 gate + wire 暴露（R60②演进；与用户建议"canonical
  failover command → switch execution → observation convergence"为同一环两侧——
  执行证据链复用 R63/R64/R65 既有契约）；
- **RD-01E** failover_benchmarks 测量面 + BMD 验收（含 device-2 红线 + §6 矩阵注入
  验证 + Alarm/Web journey）。

## 8. RD-01A 实施包验收（将来转 READY 时的 DoD 骨架）

1. readiness 观测折叠 + RG 登记表（agent 内存真值）；watchdog `GroupAction` 词表零变化
   （编译级证明：enum 无新变体）；
2. canonical state additive 投影块（serde default；未声明 RG 会话零行为变化——回归：
   既有 mock/default/ffmpeg 套件全绿 + `switch_rt_01_no_auto_failover_path` 锚不动）；
3. 三轴投影六典型组合测试（§4 表全覆盖，含 READY+DEGRADED 与 RUNNING+NOT_READY+HEALTHY
   非法折叠防御断言）；
4. node_role/required_node invariant 机械断言（D9）；
5. Fastify/SDK/Web 只读投影（若本包含消费面）——零本地判定，drift gate 同 HI 模式；
6. BMD：观测面只读旅程（readiness 块实况 + reload 收敛）；**无任何切换行为新增**；
7. exact-head 双 lane CI + evidence 落档 + STATE 更新。

## 9. 本 planning 的即时产出

本文档 = RD-01A 语义冻结候选（owner 九问 D1–D9 + 三轴语义 + RG 语义 + failure-first
matrix + 分解 reconciliation）；RD-01A 实施 READY 仍需独立裁决（entry plan §5 纪律），
且须在 current-main stability ladder 收口后（§3.88 freeze window）。
