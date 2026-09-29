# REDUNDANCY-ENTRY-01 — Planning / Reconciliation（2026-09-29 冻结）

> 性质：Redundancy / Hot-Standby 进入前的 frozen-V0.2-对照 reconciliation（PRODUCTION-
> READINESS-ENTRY-01 链第 6 环）。**只 planning，不编码**——实现子包待 HEALTH-INCIDENT-
> ENTRY-01 边界稳定后另裁决。

## 1. 诚实基线（不可跳过的现状承认）

当前已有（live `main` @ `ec5fc68`，全部有 exact-commit 证据）：

- dual-input 采集 + 显式 Normalize（switch-graph 域内，RF-NORM-01 BMD L2c）
- MASTER_SWITCH 执行路径（switch_graph bridged_with_normalize + NormalizeEvidence fail-closed，
  RF-MASTER-01 BMD L4 真机）——但 wire/命令面固定 FrameSwitch（R60 裁决②：
  Packet/Master 未真机验证不暴露）
- manual command switch（switch_dispatch_plane → ProgramExecutionRuntime，R63/R64 恢复矩阵）
- watchdog 同源 restart 恢复（Supervisor Restart/Escalate + backoff + 熔断 + recovery_monitor）

当前明确**没有**：

- **auto failover**：`watchdog.rs` GroupAction 封闭词表仅 `ReportInputFailure`（类型级
  不可构造，冻结 #10）；`switch_execution.rs` 冻结清单"不自动 failover（无任何隐式触发
  切换入口）"；回归锚 `switch_rt_01_no_auto_failover_path` 锁死。
- readiness 轴：V0.2 §8.11 三轴（lifecycle/readiness/health）中的 `READY_TO_TAKE` 在
  live code 零对应物（custody/master_join 的 "readiness gate" 是 MASTER_SWITCH 的
  normalize-evidence 门，语义不同）。
- hysteresis：`failover_hysteresis` / `failback_hysteresis` 零实现零数据面。
- Hot-Standby 级别策略（COLD/WARM/HOT target_failover_time_ms）零实现；
  `failover_benchmarks` 表零实现。
- Redundancy Group（V0.2 §3.9 Source Subsystem：Primary/Backup 共同构成 RG、required_node
  语义、H1-H7 聚合）零实现。

**结论（用户 §18 逐条落档）：Redundancy ≠ COMPLETE；Hot-Standby ≠ COMPLETE；
Auto-Failover ≠ COMPLETE。MASTER_SWITCH 真机 PASS 只证明切换执行原语，不构成
Redundancy 完成。**

## 2. Frozen V0.2 对照矩阵

| V0.2 概念 | 冻结语义 | live 现实 | gap 性质 |
|---|---|---|---|
| Switch Mode（§3.4 决策树） | PACKET/FRAME/MASTER + REJECT；eligibility ≠ decision | FRAME 真机+wire；MASTER 执行+仿真证据门；PACKET fail-closed 无实现 | MASTER wire 暴露需真机 gate；PACKET 需实现 |
| Hot-Standby Level（§3.5） | COLD/WARM/HOT=policy/target（无 state 字段） | 无 | 新策略面（纯 policy 声明，非运行态） |
| 三轴状态机（§8.11） | lifecycle × readiness × health；READY_TO_TAKE | lifecycle（session 状态机）+ health（AgentState 8 态）有；readiness 无 | readiness 轴需新增（backup 输入的就绪观测） |
| Health Tree（§3.9，7 不变量 H1-H7） | Channel→Subsystem→Node；required_node；STANDBY/ACTIVE 角色 | 单 agent 态 reducer；无树/无 subsystem/无 node_role | 最小投影版已在 HEALTH-INCIDENT plan §D 之外——**本 entry 内先做 RG 语义对齐** |
| failover 策略（§8.4） | policy 显式允许 + hysteresis + 决策树 + canonical command | watchdog 显式禁止；无策略面 | 核心新增面 |
| failover_benchmarks（§5 表） | p50/p95/p99 实测记录 | 无 | 实现后的测量面 |
| Failure Domain（§8.9） | 7 Operational + 2 Diagnostic；PLAYER/UNKNOWN 不触发 failover | 事件级 failure domain（HEALTH-INCIDENT D2 机械映射） | RG 级聚合需对齐 |

## 3. 实现原则（用户 §19 冻结，逐条可验收）

自动 failover 全链必须满足，缺一即 fail-closed 拒绝：

```
Policy explicitly permits (显式 Redundancy policy, per-session/per-channel)
→ backup READY_TO_TAKE (readiness 轴实证, 非 health 侧写)
→ compatibility/preflight PASS (Capability Contract/normalize evidence 满足 MASTER_SWITCH 语义)
→ health failure persists beyond failover_hysteresis (去抖, 复发计入)
→ failover decision (Supervisor/策略引擎——单一决策点)
→ canonical command/transition (经 switch_dispatch_plane 既有命令面, 复用幂等/审计)
→ actual observation (observed_active 实测翻转, 证据链与 R64 同构)
→ success/failure (三态落定, 禁猜测——R65 语义)
→ incident evidence (HEALTH-INCIDENT alarm/incident 关联)
```

禁止（红线）：设备坏了随便找下一张卡；watchdog 自行切源；adapter 自行决定 failover；
UI 自行倒换；failback 不经同一链路（failback_hysteresis 独立去抖）。

## 4. 与既有冻结的衔接裁决

- **watchdog 冻结 #10 不推翻**：`GroupAction` 词表仍无切换变体——failover 决策点在
  Supervisor/策略引擎层新增显式 decision 面（新类型，不改 watchdog fold 的封闭性）；
  watchdog 仍只 detect/report。
- **Runtime owns truth 不变**：failover 执行唯一经 canonical switch command
  （switch_dispatch_plane / ProgramExecutionRuntime），无旁路。
- **R60 裁决②演进路径**：MASTER_SWITCH wire 暴露以真机 MASTER gate（bridged 形态）
  先行，不因 Redundancy entry 提前放宽。
- **依赖顺序**：readiness 轴 + RG 语义 → policy 面 → hysteresis → 决策链 → benchmarks。
  HEALTH-INCIDENT 的 alarm/failure-domain 投影是 incident evidence 环的前置。

## 5. 子包草案（READY 前需再冻结细化，不自动进入）

| 包 | 范围 | 前置 |
|---|---|---|
| RD-01A | readiness 轴 + Redundancy Group 语义（V0.2 §3.9/§8.11 对齐；观测面先行） | HEALTH-INCIDENT 边界稳定 |
| RD-01B | Redundancy policy 面（COLD/WARM/HOT 声明 + per-session 允许位）+ preflight 扩展 | RD-01A |
| RD-01C | failover/failback hysteresis + Supervisor 显式决策链（§3 全链） | RD-01B |
| RD-01D | MASTER_SWITCH 真机 gate + wire 暴露（R60②演进） | RD-01C |
| RD-01E | failover_benchmarks 测量面 + BMD 验收（含 device-2 红线） | RD-01D |

## 6. 本 planning 的唯一即时产出

§1 诚实基线写入 STATE（纠正任何"Redundancy 接近完成"的误读）；RD 子包保持 PENDING，
不因本文档自动 READY。
