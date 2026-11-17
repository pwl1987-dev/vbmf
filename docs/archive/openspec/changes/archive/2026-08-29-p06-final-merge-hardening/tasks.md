# Tasks: Phase 0.6 Final Merge Hardening — 合并前清债

## 1. P0-1 DeviceInfo 去 BMD identity 泄漏

- [x] 1.1 `BmdIdentity` 收敛进 `adapters/blackmagic`，`device.rs` 删除 `bmd_*` 三字段；discovery 侧经 Provider Identity Adapter 映射为 canonical `DeviceId`/`IdentityStrength`
  - 证据: `contracts/provider.rs` 新增 `ProviderIdentity{provider,persistent_id,device_handle,topological_id}` (SPI 层机制中立承载) + `DiscoveredDevice{device,identity}` 配对; `device.rs` DeviceInfo 仅余 canonical 字段; `blackmagic/device_manager.rs` 证据写入 ProviderIdentity, `enumerate()` Err → `ProviderError::SdkUnavailable`。盒上 4 套 feature 编译+测试全过。
- [x] 1.2 `resolver.rs` 匹配签名改消费 provider 侧身份证据（不再读 Domain 字段）；全部调用点/诊断输出更新
  - 证据: `best_kind_for/find_match/resolve/collect_bindings/resolve_strict/resolve_with_manifest/collect_bindings_from_manifest` 全部改 `&[DiscoveredDevice]`; 新增 `identity_handle()`; `ResolvedDeviceBinding` 增 `persistent_id` (供 PersistentIdCanonical 路径); port.rs 交叉核验经证据配对; **真机 HW-IDENT-02 回归**: 2×ManifestVerified/High + 未入清单设备 Unresolved fail-closed, 语义与重构前一致。

## 2. P0-2/P0-3 MediaBackend 契约对齐

- [x] 2.1 trait 更名 `prepare→instantiate`、`poll_bus→observe`、补 `stop`；GStreamer/Mock 两 impl + main.rs watchdog/supervisor 调用点同步
  - 证据: `contracts/backend.rs` = `instantiate/start/stop/recover/observe` (对齐冻结契约 §1); GStreamer `stop` = Bus watch 退出 + `set_state(Null)` + instances/HEALTH_ARCS 移除; main.rs selftest/canonical/watchdog 调用点全部更新; `MEDIA_BACKEND_CONTRACT.md` 对齐注记。盒上 bmd,gstreamer test 全过 + 真机 SELFTEST 71× A+B+C 全过。
- [x] 2.2 `contracts/backend.rs` trait 去 feature 门控（impl 保留门控）；default 构建验证"有契约无实现"可编译
  - 证据: trait `#[cfg(any(...))]` 已删; default `cargo test` (EXIT=0) 即"有契约无实现"编译证明。

## 3. P0-4 Registry fail-closed

- [x] 3.1 生产模式 mock+真实 feature 组合启动报错拒启；显式测试模式（env）放行；启动日志打印模式与生效 adapter
  - 证据: `registry.rs` `mock_real_conflict()`/`test_mode_allows_mock()` (MEDIA_AGENT_MODE=simulation|diagnostic ∨ VBMF_ALLOW_MOCK=1)/`ensure_adapter_selection_safe()`; `build_provider`/`build_media_backend` → `Result` (main exit(2) 拒启); `active_adapters()` 启动日志。新测试 `registry_fail_closed_gate_consistent_with_feature_set` 过。

## 4. P0-5 remove-adapter 编译验证

- [x] 4.1 `scripts/check_remove_adapters.py`（临时副本移除 adapters/blackmagic+gstreamer 后 cargo check simulation/mock）+ CI 接入；词法 lint 定位改为 Architecture Lint
  - 证据: 盒上 `PROOF_EXIT=0` (P0-5 Architecture Proof); CI media-agent.yml 新增 "Architecture proof gate (remove-adapter compile)" 步骤; `check_arch_portability.py` 定位注记 Architecture Lint。

## 5. P0-6 证据勘误

- [x] 5.1 p06-hi 归档 tasks/design 旧口径（Default=true 等）就地勘误注记
  - 证据: 归档 `tasks.md` §5 与 `design.md` MEDIA-RT-01 节追加 `[勘误 2026-08-29, p06-final-merge-hardening P0-6]` 注记 (三态 + absence-of-evidence), 原文保留可追溯。

## 6. P1 债务清偿

- [x] 6.1 P1-1 MockBackend 句柄走 `NEXT_PIPELINE_ID`（非零递增），测试断言更新
  - 证据: `mock.rs` instantiate 取 `pipeline::NEXT_PIPELINE_ID` (生产同源, 从 1 起); `mock_backend_lifecycle_ok` + `arch_backend_01_mock_*` 断言 `!= PipelineHandle(0)`; 盒上 mock 114 tests 全过。
- [x] 6.2 P1-2 `discover -> Result<Vec<DiscoveredDevice>, ProviderError>`（BREAKING）：新增 ProviderError、全 impl + registry 调用点更新、frozen 契约文档修正
  - 证据: `ProviderError{kind,detail}` + `ProviderErrorKind` 四分类; 6 个 discover impl (FS/Sim/MockA/MockB/BMD/registry 调用点) 全部 Result 化; main.rs discovery Err → exit(2) fail-closed; `HARDWARE_PROVIDER_CONTRACT.md` 修正注记。
- [x] 6.3 P1-3 RuntimeEvent severity 两级 + RuntimeEventLog Critical 不可挤出 + dropped 计数
  - 证据: `EventSeverity{Observation,Critical}` + `RuntimeEvent::severity()`; push 策略: Critical 强推/观测只腾同级/全 Critical 时丢观测; `dropped_observations()/dropped_criticals()` 计数; 新测试 `log_critical_never_evicted_by_observations_and_drops_counted` 过。
- [x] 6.4 P1-4 `ResourceRegistry` Mutex 化 + 原子 `acquire`（preflight+reserve）+ materialize 失败回滚；编排层债务记 0.7
  - 证据: `SharedResourceRegistry` + `acquire` (锁内 preflight+reserve, HRTB `with_inner`) + `release_reservations`; main.rs Preflight 闸门改走 acquire, materialize Err → 回滚 + warn 日志; 新测试 `resource_01_atomic_acquire_and_rollback` 过; 完整编排层已在 proposal 记 0.7 债务。

## 7. 验证与交付

- [x] 7.1 盒上全矩阵复跑：4 套 test / clippy -D / build 全绿 + 新增断言通过
  - 证据: 盒上 final code: **test 110 (default) / 110 (simulation) / 114 (mock) / 110 (bmd,gstreamer) 全过** (基线 107/107/111/107 → +3 新门禁测试); clippy -D warnings ×4 全 EXIT=0; build gstreamer-only + bmd,gstreamer 全 EXIT=0; remove-adapter PROOF EXIT=0。
- [x] 7.2 真机三闭环回归：SELFTEST A+B+C / loopback / HW-IDENT-02（ManifestVerified 仍 High、Unresolved 仍 fail-closed）
  - 证据: 盒 10.30.15.10: `MEDIA_AGENT_SELFTEST=1` 45s **71× "MEDIA-RT-01: A+B+C 全过"**; `VBMF_LOOPBACK=1` → **LOOPBACK ALL PASS = true** (fixture locked/test_pattern/format_match); HW-IDENT-02 C1 证据 2×ManifestVerified/High (gst 1/0) + 未入清单设备 Unresolved (fail-closed)。
- 7.3-7.5 (verify / archive+PR / branch protection+Baseline tag) 属 Comet workflow 后续阶段动作,
  非本 build 任务清单可勾项: verify 报告落 `docs/superpowers/reports/`, 归档交付以单一 PR
  `comet/p06-final-merge-hardening` → `master` + gh branch protection + `phase-0.6-runtime-abstraction-baseline`
  tag 完成, 证据分别落在 verify 报告 / 归档提交 / 远端交付记录。

## 收口确认 (2026-08-29)

- D1-D10 全部落地 (本机无 cargo, 代码级核对 + 盒上矩阵为准); 盒上最终矩阵全绿 (110/110/114/110, clippy×4 -D 零警告, build×2, remove-adapter PROOF PASS), 真机三闭环回归全过。
- 三处 BREAKING (P0-1/P0-2/P1-2) 一次付清; 后续 master 合入后即为 Phase 0.6 Runtime Abstraction Baseline。
