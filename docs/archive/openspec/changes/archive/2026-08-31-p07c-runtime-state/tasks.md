# Tasks: Phase 0.7C Foundation — p07c-runtime-state

> 纪律（§十五）：每项标注 `Contract / Implementation / Verification / Gate`。

## 1. CanonicalRuntimeState 聚合（runtime_state.rs 新）

- [x] 1.1 Device/Port/Resource/Session RuntimeState + PortMediaSemantics(descriptor 整值组合) + assemble() 纯装配 + serde
  - Contract: 终审加严红线 (Canonical≠Runtime State; 组合非展开) | Implementation: Complete | Verification: Test(组合性断言) | Gate: Pass
- [x] 1.2 SessionManager::runtime_state() 生产路径 (第一条 Canonical→Runtime 真实边)
  - Contract: PHASE_IMPLEMENTATION_MAP §3 首项 | Implementation: Complete | Verification: Simulation+Hardware | Gate: Pass

## 2. D2/D4/D5 关闭

- [x] 2.1 D2: preflight Stage3 三态 Resolution (设备无派生 input 资源 ⇒ FAIL)
  - Contract: RESOURCE-RESOLUTION-01 (终审 §八) | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 2.2 D4: preflight Stage2 端口级 (port_id Some 精确匹配+方向; None ⇒ ≥1 Input 端口; registry=None WARN)
  - Contract: Port Availability Contract (镜像 materialize 冻结语义) | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 2.3 D5: ResolvedDeviceBinding::is_production_grade() + preflight Stage5/session create 步 5 实查
  - Contract: IDENTITY-BINDING-01 | Implementation: Complete | Verification: Test | Gate: Pass

## 3. 门禁 RUNTIME-STATE-RT-01（三层）

- [x] 3.1 Unit: D2/D4/D5 三态各 FAIL 路径 + 聚合组合性 (descriptor 不平铺)
  - Contract: 本 change 门禁 | Implementation: Complete | Verification: Test | Gate: Pass
- [x] 3.2 Simulation: mock 世界 create→runtime_state 投影 (claims/资源状态可见)
  - Contract: 同上 | Implementation: Complete | Verification: Simulation | Gate: Pass
- [x] 3.3 Hardware: VBMF_SESSION_LIFECYCLE 输出 CanonicalRuntimeState JSON (create 前后状态变化)
  - Contract: 同上 | Implementation: Complete | Verification: Hardware | Gate: Pass

## 4. 交付

- [x] 4.1 盒上全矩阵 (fmt/test×4/clippy×4/build×3/PROOF) + CI 七 checks + 真机 SESSION/RESOURCE-RT-01 回归不退
  - Contract: 盒上绿≠CI绿 | Implementation: Complete | Verification: Box+CI | Gate: Pass
- [x] 4.2 债务表 D2/D4/D5 → CLOSED + Phase Map 0.7C 行更新 + verify → archive → PR#8 → merge → tag phase-0.7C1-* → 删分支
  - Contract: 分支纪律 | Implementation: Complete | Verification: CI+Review | Gate: Pass

## 收口确认

- 不做清单: D6 / REST / Command Contract / Event Projection / Idempotency / Audio Execution / Clock Policy / Timecode Parser / D11。

## 收口证据 (2026-08-31)

- 盒上最终矩阵: fmt 0 · test **138/138/161/138** · clippy -D ×4 零警告 · build ×3 · PROOF PASS; SESSION/RESOURCE-RT-01 真机回归 ALL PASS。
- RUNTIME-STATE-RT-01 三层: Unit (D2/D4/D5 FAIL 路径 + 0.7A R1 side-effect 补测) / Simulation (create→runtime_state 资源 Reserved→Allocated→Available 投影) / Hardware (真机 SESSION_LIFECYCLE 两点输出: binding ManifestVerified/High 投影 + media_semantics 组合在场 + 资源 available 回落)。
- 发现并修正: 0.7A R1 的 preflight_is_side_effect_free 测试当时因补丁脚本中断未落盘 (0.7A verify 报告存在虚报) — 本次补齐并如实记录。
- 迭代: RS2 (E0515 生命周期 + E0599 trait import) → RS3 (fixture device_id + 键序) → RS4 (redundant closure) → RS5 全绿。
