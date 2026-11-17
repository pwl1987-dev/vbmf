# Tasks: Phase 0.6 C5 (0.6H+I)

## 1. ARCH-BACKEND-01

- [x] 断言 Mock 与 GStreamer 共享 `CanonicalPipelinePlan`，互可替换（Test C 延伸）
  - 证据: `pipeline.rs` 新增 `arch_backend_01_mock_backend_implements_media_backend` (mock 侧: `Box<dyn MediaBackend>` 从 `PipelinePlan::self_test()` 物化 + 全生命周期 + canonical 字段不回写) 与 `arch_backend_01_gstreamer_backend_implements_media_backend` (gstreamer-backend 侧: 同一 trait 对象 + 同一 canonical plan, `GStreamerPipelineController::prepare` 接受 self_test)。盒上 mock 111 / bmd,gstreamer 107 全过。

## 2. RESOURCE-01

- [x] materialize 前 `preflight` 校验 Resource 可用；不可用则拒，绝不静默回退
  - 证据: 复用 p06-de `resource.rs::preflight` + `main.rs` materialize 入口闸门 (已落地); 本 change 新增 `resource_01_faulted_resource_rejects_without_fallback` 断言 Faulted → `NotAcquirable` + Releasing 不抢占 (不盲开 device 0)。盒上 4 套 feature 测试全过。

## 3. HW-PORT-01

- [x] 端口级绑定闭环（`hw_port_01` 遍历 manifest，实际 rank < 声明 ⇒ 失败）
  - 证据: 复用 `hw_port_01::verify` + `signal::verify_fixtures` (已有 6 单测, 盒上全过); 真机闭环 (盒 10.30.15.10, loopback = MiniMon sink2 → Duo capture0): `VBMF_LOOPBACK=1` + `loopback-manifest-v2.json` → `LOOPBACK ALL PASS = true`, fixture BMD-SDI-LOOPBACK-01: state=locked, content=test_pattern, format_match=true, passed=true。

## 4. HW-IDENT-02

- [x] 身份优先级 PersistentId>DeviceHandle>TopologicalId；多重 HIGH→Ambiguous；device-number 绝不默认 0
  - 证据: `resolver.rs` 新增 4 个门禁测试: `hw_ident_02_persistent_id_wins_over_device_handle` (per-probe 优先级 PersistentIdExact > DeviceHandleExact) / `hw_ident_02_multiple_high_candidates_ambiguous` (多重 HIGH → Ambiguous, 不进生产绑定, resolve_strict 拒) / `hw_ident_02_unresolved_never_defaults_device_zero` (无候选 → Unresolved, 绝不回退 0) / `hw_ident_02_topological_guess_medium_not_production` (MEDIUM 仅诊断, 生产拒绝)。盒上 4 套 feature 全过。真机侧 (盒, v1 manifest): C1 Resolver Evidence 两设备 `ManifestVerified`/High (gst_device_number=1/0, probe open OK), 未入清单第三设备 `Unresolved` (runtime auto-resolution disabled by design) — 失败闭合, 无猜设备。

## 5. MEDIA-RT-01

- [x] `pts_monotonic` 只置 false；`PipelineHealth` Default=true；`MEDIA_AGENT_SELFTEST=1` 跑通 A+B+C

> [勘误 2026-08-29, p06-final-merge-hardening P0-6] 本行 "PipelineHealth Default=true" 为**旧口径草稿表述**。
> 实际实现 (P1-2, 本任务执行时已落地): `PtsMonotonicity` 三态 (Unknown/ValidMonotonic/NonMonotonic),
> `PipelineHealth::default()` = absence-of-evidence (PTS=Unknown, playing=false, acceptance 全 false,
> `pass()`/`first_frame_ok()` 恒 false —— 绝不默认假过); "pts_monotonic 只置 false" 语义 =
> 仅在观测到真实 PTS 回退时进入 NonMonotonic (sticky)。门禁断言见 `pipeline.rs::media_rt_01_*` 测试。
> 原文保留于此以存档; 以本注记与本仓库实现为准。

  - 证据: `pipeline.rs` 新增 4 个门禁测试: `media_rt_01_health_default_is_absence_not_pass` (Default = absence-of-evidence, 绝不默认假过, P1-2) / `media_rt_01_pts_only_false_on_real_regression` (Unknown ≠ NonMonotonic, 只在真实回退时 NonMonotonic sticky) / `media_rt_01_b_and_c_pass_semantics` (B 四项全真才过; C 测量窗口未达标即不过) / `media_rt_01_self_test_plan_is_canonical` (self_test canonical 字段 + device_number=0 自测哨兵注记)。真机侧 (盒, bmd+gstreamer 构建): `MEDIA_AGENT_SELFTEST=1` 45s 运行, watchdog 推导 A1-A4/B1-B4/C1-C4, 45s 内 72 次打印 "MEDIA-RT-01: A+B+C 全过 (canonical first-buffer 路径健康)" (C 窗口 10s 达标)。

## 6. 门禁接入 CI + 真机闭环

- [x] 门禁组列为 required gate（与 0.6G 并列）
  - 证据: `.github/workflows/media-agent.yml` test job 新增 `Test (mock feature)` 步骤 (ARCH-BACKEND-01 Mock 侧 + 门禁断言随 mock 矩阵执行) + p06-hi 门禁组 required-gate 标记注释 (与 0.6G ARCH-PORTABILITY-01 并列); MEDIA-RT-01 / HW-IDENT-02 / RESOURCE-01 断言随现有 default+simulation 测试步骤执行; 真机闭环由盒上 bmd+gstreamer 构建执行。YAML 语法校验通过。
- [x] 真机 `cargo build --features bmd,gstreamer` + loopback 双门全绿（基线 default+sim 84 / bmd 83）
  - 证据: 盒上最终代码重建 `cargo build --features bmd,gstreamer` EXIT=0; loopback `LOOPBACK ALL PASS = true`。基线更新 (p06-de 后 default+sim 98 → 本 change 后 **default+sim 107 / mock 111 / bmd+gstreamer 107**, 全过)。

## 7. 验证

- [x] `cargo clippy --all-targets -- -D warnings`（三套 feature）通过
  - 证据: 盒上 default / mock / gstreamer-only / bmd,gstreamer 四套 clippy `-D warnings` 全 EXIT=0 (含本 change 新增测试代码; 首轮 1 个 `field_reassign_with_default` lint 已按 struct-update 模式修复后全绿)。
- [x] `cargo test` default + simulation 通过
  - 证据: 盒上 default 107 passed / simulation 107 passed / mock 111 passed / bmd,gstreamer 107 passed, 0 failed。

## 收口确认 (2026-08-29)

- §1-§5 代码已完成 (本机无 cargo, 代码级核对通过); **编译/测试/clippy/真机闭环全部以盒上 (Linux box 10.30.15.10) 运行为准**, 结果: test 4 套全过 (107/107/111/107), clippy -D 4 套全过, build (gstreamer-only + bmd,gstreamer) 全过, 真机 SELFTEST A+B+C 72×全过 + LOOPBACK ALL PASS=true + HW-IDENT-02 证据 fail-closed。
- 本 change 以**断言现有不变量 + CI 接线 + 真机闭环**为主, 无新增 public API, 未改 SPI trait 签名。
