# Tasks: Phase 0.7A — p07-session-runtime

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。Contract=已有（引用冻结文档节号）；Implementation=Not Started/Partial/Complete；Verification=Test/Simulation/Hardware；Gate=Pending/Pass/Blocked。

## 1. Resource Orchestration 补全

- [x] 1.1 `allocate_for` / `release_allocation` / `expire_reservations`
  - Contract: RUNTIME_RESOURCE_MODEL §3/§4.2（Reservation≠Lease≠Allocation; Available→Reserved→Allocated→Releasing→Available）| Implementation: **Complete**（resource.rs：allocate_for 校验预留持有者防越权；release_allocation 对接会话 stop 路径；expire_reservations_of 供 tick）| Verification: Test（`resource_01_allocate_for_requires_matching_holder_and_release` / `resource_01_expire_reservations_of_scoped_to_holder` + 盒上 4 套全过）| Gate: **Pass**
- [x] 1.2 `LeaseManager::renew` + Config 旋钮接线（default_lease_ttl/lease_renew_window）
  - Contract: RUNTIME_RESOURCE_MODEL §4.1（Renew op; 他人 renew=AlreadyLeased 绝不抢占）| Implementation: **Complete**（trait 增补 `renew` + `Send+Sync` supertrait；SessionTuning 接线；tick 驱动续期并回写会话副本）| Verification: Test（`renew_extends_holder_lease_and_rejects_other_owner` / `resource_rt_01_renew_window_tick_extends_lease`）| Gate: **Pass**

## 2. Preflight 分级判定（新 preflight.rs）

- [x] 2.1 六 stage 实装 + Topology/Risk report-only + PASS/WARN/FAIL 裁决（judge-only，FAIL 零预留）
  - Contract: V0.2 §1.2（三层 Preflight; FAIL 禁 Apply）、RUNTIME_LIFECYCLE_SEQUENCE §1 | Implementation: **Complete**（Graph/PortAvailability/ResourceCapacity/LeaseConflict/IdentityBinding 判定级 + BackendCapability WARN + Topology/Risk 占位）| Verification: Test（preflight.rs 2 测试：干净输入 Warn 放行 / 未知设备+租约冲突 Fail）+ 真机实证（bootstrap 租约冲突被 Preflight FAIL 正确拒绝——fail-closed 首证）| Gate: **Pass**

## 3. Session 模型 + SessionManager（新 session.rs）

- [x] 3.1 `MediaSession`（语义持有/物理引用）+ 两级状态机白名单
  - Contract: RUNTIME_SESSION_MODEL §2-3（§114）、Addendum §4.3 | Implementation: **Complete**（粗态 5 + 微相位 14 + 白名单；ResourceClaim/SessionHealthSnapshot）| Verification: Test（`session_rt_01_state_machine_rejects_released_to_running`）| Gate: **Pass**
- [x] 3.2 `SessionManager` create/start/stop/close/status/list + 冻结顺序生命周期引擎 + 精确逆序回滚
  - Contract: RUNTIME_SESSION_MODEL §4.1（唯一 owner）、RUNTIME_LIFECYCLE_SEQUENCE §1-2、MEDIA_BACKEND_CONTRACT §1.1（P0-8）| Implementation: **Complete**（create=Preflight→Reserve→建档→Lease→Binding；start=materialize→instantiate→Allocate→start；stop=stop→release allocation→lease→reservation 精确逆序；instantiate/start 失败均逆序回滚）| Verification: Test+Simulation（`session_rt_01_full_lifecycle_*` / `rollback_on_instantiate_failure` / `rollback_on_start_failure_stops_handle` / double-start/stop 拒绝；FailingBackend 桩断言零孤儿）| Gate: **Pass**
- [x] 3.3 事件补线（Session* additive + 点亮 LeaseGranted/ResourceAllocated/ResourceReservationExpired/IdentityResolved/SourceMaterialized）
  - Contract: EVENT_CONTRACT §2、Addendum §8（无新事件平面）| Implementation: **Complete**（SessionCreated/SessionStateChanged/SessionFailed(Critical)；LeaseGranted/ResourceAllocated/IdentityResolved/SourceMaterialized 在生命周期内发射）| Verification: Test（events roundtrip + severity 测试）| Gate: **Pass**
- [x] 3.4 Manager.tick（lease 过期扫描/预留 TTL/健康快照）+ Config 接线
  - Contract: RUNTIME_RESOURCE_MODEL §4.2（TTL 强制 + crash cleanup）| Implementation: **Complete**（tick：续期回写会话副本 / Reserved 超时→预留过期+租约回收+Terminated / leases.health() 清扫；无后台线程）| Verification: Test（`resource_rt_01_tick_expires_stale_reserved_session` / `resource_rt_01_renew_window_tick_extends_lease`）| Gate: **Pass**

## 4. main.rs 接线

- [x] 4.1 diagnostic auto-start 改走 SessionManager；Production Ready 不变；selftest 不动
  - Contract: RUNTIME_LIFECYCLE_SEQUENCE §1 | Implementation: **Complete**（bootstrap 占位租约让位→SessionManager create+start；watchdog 不变量保留）| Verification: Simulation+Hardware（真机门禁全链经同一代码路径）| Gate: **Pass**
- [x] 4.2 `VBMF_SESSION_LIFECYCLE=1` 真机门禁入口（全链逐步 verdict）
  - Contract: RUNTIME_LIFECYCLE_SEQUENCE §1 | Implementation: **Complete** | Verification: **Hardware（见 5.3）** | Gate: **Pass**

## 5. 门禁 SESSION-RT-01 / RESOURCE-RT-01（三层）

- [x] 5.1 SESSION-RT-01 Unit/Simulation（全链+回滚+double-start/stop 拒绝，FailingBackend 桩）
  - Contract: RUNTIME_SESSION_MODEL §5（#145 全场景）| Implementation: **Complete** | Verification: Test+Simulation（盒上 mock 集 127 tests 全过）| Gate: **Pass**
- [x] 5.2 RESOURCE-RT-01 Unit/Simulation（并发争抢/容量/冲突/release/expiry/crash cleanup）
  - Contract: RUNTIME_RESOURCE_MODEL §4.1-4.2、V0.2 §3.11 DEVICE_EXCLUSIVITY | Implementation: **Complete** | Verification: Test+Simulation（盒上全过）| Gate: **Pass**
- [x] 5.3 两门禁真机层（盒上 lifecycle 全链 + 双会话拒绝）
  - Contract: 同上 | Implementation: **Complete** | Verification: **Hardware**（盒 10.30.15.10：`VBMF_SESSION_LIFECYCLE=1` → create/start/observe 10s/stop 全 OK + 第二会话冲突拒绝 OK，`ALL PASS`，exit 0）| Gate: **Pass**

## 6. CI + 交付

- [x] 6.1 CI 新增 `session-lifecycle` required job（mock feature session+resource 门禁测试）+ protection 七 context
  - Contract: 用户 §十七 | Implementation: **Complete**（workflow job + protection 更新为七 context）| Verification: CI（PR #2 checks 实跑）| Gate: **Pass**
- [x] 6.2 盒上全矩阵（含 fmt check + hardware-test build）全绿
  - Contract: 教训口径（盒上绿≠CI绿）| Implementation: **Complete** | Verification: **Box**（最终矩阵：fmt apply/check 0 · test **115/115/127/115** · clippy -D ×4 零警告 · build ×3（含 hardware-test）· remove-adapter PROOF PASS）| Gate: **Pass**
- [x] 6.3 verify（full，四栏纪律表）→ archive → PR → merge → 删分支
  - Contract: 新分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass（verify 报告 `docs/superpowers/reports/2026-08-29-p07-session-runtime-verify.md`；交付见归档提交与远端记录）

## 收口确认

- 编号说明：0.7A=Runtime Ownership（新分段，替代 MASTER_PRD §5 旧 0.7A-G 标签；PRD 不改）；本 change 完成 0.6A/0.6E 冻结契约（RUNTIME_SESSION_MODEL/RUNTIME_RESOURCE_MODEL/RUNTIME_LIFECYCLE_SEQUENCE）实现债务。
- 真机证据：**首次在真实 BMD+GStreamer 硬件上跑通完整会话生命周期**（含 `MediaBackend::stop` 首次真实调用）；bootstrap 租约冲突被 Preflight fail-closed 正确拒绝（门禁反向实证）。

## Merge Gate Hardening 附录 (2026-08-29, commit 8a14ff1)

Merge Gate 复审裁决 5 项 P0（多设备租约泄漏 / 状态机未强制 / close Running 孤儿 pipeline /
Preflight 副作用 / 测试未击穿多设备场景）已全部在同分支修复并验证：
test 115/115/**131**/115 + 真机 SESSION-RT-01/RESOURCE-RT-01 回归 ALL PASS + CI 七 checks 全绿。
详见 verify 报告 §7。P1 遗留已记 0.7 backlog（derive_claims FAIL 化 / PortAvailability 精确化 /
IdentityBinding 实查 / EventSink 解耦 / LifecycleJournal / OnceLock 简化 / per-claim TTL /
BACKEND-CAPABILITY-01 / create 幂等键）。

## Merge Gate Hardening Round 2 附录 (2026-08-29, commit 286706a)

二次复审 2 项异常路径 P0（多资源部分 Allocation 孤儿 / stop 失败截断释放链）已修复并验证：
test 115/115/**134**/115 + 真机回归 ALL PASS + CI 七 checks 全绿。Lifecycle Failure Matrix 已覆盖
Allocate(partial)×multi 与 Stop(fail)×single/multi。详见 verify 报告 §8。

## Merge Gate Hardening Round 3 附录 (2026-08-29, commit fda8741)

三轮复核 1 项新 P0（materialize 失败遗留 Starting+lease/reservation）已修复：失败逆序回滚 +
StartFailed 终态 + SessionFailed 事件（空计划分支同修）；FailingBackend stop 注入改用
PipelineError::StopFailed。验证：test 115/115/**135**/115 + 真机回归 ALL PASS + CI 七 checks 全绿。
详见 verify 报告 §9。Failure Matrix v2 已覆盖 materialize×single。
