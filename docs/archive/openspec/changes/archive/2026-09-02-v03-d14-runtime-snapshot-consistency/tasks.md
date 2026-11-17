# Tasks — V0.3-1 D14 Runtime Snapshot Consistency

> 四栏纪律：每项标注 `Contract`（引用冻结文档节号）/ `Implementation` / `Verification` / `Gate` 状态。
> 深度设计在 /comet-design 阶段 Design Doc 细化后，本清单可增补任务组（编号连续），不得重排既有编号。

## 1. 观察信封（SnapshotObservation + struct additive）

- [x] 1.1 在 `runtime_state.rs` 新增 `SnapshotObservation { revision: u64, lineage: Uuid, observed_at_ms: u64 }` 参数 struct（模块内，不发明新模块——design D5/Open Q2） `Contract: proposal §What-1 / design D5` | `Implementation: 已 @ f52d882` | `Verification: 五套 feature 组合编译通过（cargo check 矩阵）——盒上矩阵 TEST_DEF/TEST_SIM/TEST_MOCK/TEST_BMD + BUILD_GSONLY/BUILD_BMD/BUILD_HWTEST 全 exit 0` | `Gate: 无`
- [x] 1.2 `CanonicalRuntimeState` 新增 additive 字段 `observation_revision: u64` + `observation_lineage: Uuid`，均带 `#[serde(default)]`（revision→0, lineage→nil） `Contract: EXTERNAL_API_CONTRACT §2 #126（additive 非破坏）` | `Implementation: 已 @ f52d882` | `Verification: Unit 测试 `runtime_state_rt_01_observation_envelope_serde_roundtrip`（serde 往返）+ `runtime_state_rt_01_legacy_six_key_json_deserializes_with_defaults`（真实旧 6 键 JSON blob→0/nil）双 PASS` | `Gate: 无`
- [x] 1.3 `assemble` 签名改为接收 `obs: &SnapshotObservation`，`now_ms()` 移出 `assemble`（纯度修复：同输入恒同输出） `Contract: design D5 / proposal §Why-3` | `Implementation: 已 @ f52d882（now_ms 整体删除, 纯度 grep gate: runtime_state.rs 无 now_ms/SystemTime）` | `Verification: Unit 测试 `runtime_state_rt_01_assemble_pure_same_obs_same_output`（同 5 源 + 同 obs 两次 assemble 逐字段相等含 generated_at_ms）PASS` | `Gate: 无`

## 2. 装配 owner（SessionManager 观察序列）

- [x] 2.1 `SessionManager` 新增观察序列 owner：`AtomicU64`（`fetch_add(SeqCst)`）+ 构造时一次性 `Uuid::new_v4()` lineage `Contract: design D1/D3` | `Implementation: 已 @ f52d882（**ordering 裁定: Relaxed 非 SeqCst**——plan §0.3 终裁: fetch_add 原子 RMW 任何 ordering 下不重号不空洞, 无数据经计数器发布, Relaxed 充分; tasks.md 原文 SeqCst 为 design 前稿）` | `Verification: Simulation 测试 `session_rt_01_observation_revision_starts_at_1_and_increments`（首快照 revision=1 起点而非 0——design 终裁计数起点 1; 连续严格 +1; lineage 恒同非 nil）PASS` | `Gate: 无`
- [x] 2.2 `session.rs:769 runtime_state()` 装配前"递增 → 取值 → 构造 `SnapshotObservation` → 传入 assemble" `Contract: proposal §What-2` | `Implementation: 已 @ f52d882（fetch_add **先于**源采集——start-ordered 锚点; new() 10 参签名零改动, 10 调用点未触碰）` | `Verification: 五套 feature 矩阵编译（矩阵全 exit 0）+ 既有 session/runtime_state 测试零回退（mock 215→221 仅 +6 新测试）` | `Gate: 无`

## 3. Wire 面（ApiQuerySnapshot additive）

- [x] 3.1 `ApiQuerySnapshot` 新增 additive 同名字段 + `to_api_query_snapshot` 投影透传（保持纯函数） `Contract: EXTERNAL_API_CONTRACT §2 #126` | `Implementation: 已 @ f52d882` | `Verification: Unit 测试 `api_rt_01_to_api_query_models` 扩展（投影透传 revision=42 + lineage 逐字节相等）PASS; Hardware 实跑 `GET /api/v1/runtime` 响应含两新字段且 D14-1/2/3 断言 PASS（见 verify 报告）` | `Gate: 无`
- [x] 3.2 `runtime_query.rs` 头部 D14 镜像注释同步为关闭态（引用 D14 CLOSED + 本 change） `Contract: runtime_query.rs L13-15 既有注释` | `Implementation: 已 @ f52d882` | `Verification: 人工复核 + grep 确认两处 D14 注释（runtime_state.rs / runtime_query.rs）语义一致——均 CLOSED @ v03-d14-runtime-snapshot-consistency 2026-09-02, swept non-transactional 口径逐句一致` | `Gate: 无`

## 4. 契约关闭（注释 + 债务账本 + 键集合测试）

- [x] 4.1 `CanonicalRuntimeState` 的 D14 注释改写为关闭态声明：一致性类 = swept non-transactional（各源加锁读取时刻 ≤ 装配完成时刻，跨源无原子性）+ revision 单调/唯一/不承诺无空洞 + 重启归零新 lineage `Contract: design D7/D3 / proposal §What-4` | `Implementation: 已 @ f52d882（**重启语义按 design 终裁: 归 1 非"归零"**——0 永久保留 = absent/serde default; 另含三 revision 消歧段 §4.3）` | `Verification: 注释与 proposal/design 声明逐句一致（人工复核 PASS; review gate 亦核）` | `Gate: 无`
- [x] 4.2 `PHASE_0_7A_POST_MERGE_DEBT.md` D14 行标 CLOSED @ v03-d14-runtime-snapshot-consistency（含三层测试证据锚 + 关闭日期） `Contract: 债务清单纪律 L6（独立 change + 三层测试）` | `Implementation: 已 @ f52d882` | `Verification: 账本行含 change 名、日期（2026-09-02）、证据链接（→ verify 报告 `docs/superpowers/reports/2026-09-02-v03-d14-runtime-snapshot-consistency-verify.md`, 本 change 交付时落档——review gate Important#1 处置: verify 报告随本 change 提交, 合并前在库）` | `Gate: 无`
- [x] 4.3 `runtime_state_rt_01_composition_descriptor_not_flattened` 顶层键集合断言 6 键 → 8 键（additive 两字段） `Contract: design D8` | `Implementation: 已 @ f52d882（TEST_OBS 共享常量 + 4 处既有 assemble 调用点 5→6 参同步）` | `Verification: cargo test 该测试通过（mock 全绿 221 内含）` | `Gate: 无`

## 5. 三层测试（D14 关闭条件）

- [x] 5.1 **Unit 层**：assemble 纯性（观察参数为输入）/ `observation_revision` 单调语义 / 重启语义（新 lineage + revision 归零，以构造新 owner 模拟） `Contract: D14 关闭条件（三层测试）` | `Implementation: 已 @ f52d882（重启测试断言 revision 归 1——0 保留 absent, 同 4.1 裁定注）` | `Verification: cargo test --features mock 全绿 **221 passed**（基线 215 + 6 新测试, 零回退零漂移）` | `Gate: 无`
- [x] 5.2 **Simulation 层**：连续读取 revision 严格递增；8 线程并发 `runtime_state()` 击穿——revision 唯一 + 连续覆盖（无跳号无重复，D9-C 同构纪律） `Contract: design D1/D6 / D9-C 先例` | `Implementation: 已 @ f52d882（Barrier 同步起跑; sort+dedup+集合相等断言——鸽笼原理同时抓重号与空洞）` | `Verification: cargo test --features mock 通过; **release 真跑** `session_rt_01_observation_revision_8x1000_concurrency_pierce --release -- --nocapture` PASS——8000 份 revision 集合恰为 {1..8000}, lineage 8000 份恒同` | `Gate: 无`
- [x] 5.3 **Hardware 层**：盒上 matrix 新增——`GET /api/v1/runtime` 两新字段在场 + 连续读取 revision 单调断言（验证脚本不入库） `Contract: D14 关闭条件（三层测试）` | `Implementation: 已（盒上 `~/transport_hw_gate.sh` D14 加法断言块——D14-1 revision≥1 / D14-2 lineage UUID 格式 / D14-3 同 lineage 严格 +1; 不改既有 16 探针, 脚本按裁定不入库）` | `Verification: 盒上（lytv@10.30.15.10, bmd,gstreamer 真机 loopback）实跑 PASS——rev1=2 rev2=3（rev1 为 [C]-3 既有探针消费, 语义自洽）, lin 双查一致 UUIDv4; 证据入 verify 报告` | `Gate: 盒上 matrix 含此项`

## 6. 验证与交付

- [x] 6.1 盒上全矩阵（含 fmt check + hardware-test build + 既有 mock 基线 215 不回退） `Contract: 验收口径（BOX/CI/RELEASE 三层）` | `Implementation: 已（p07_verify.sh 2026-09-02 实跑）` | `Verification: 14 步全 exit 0（FMT_APPLY/FMT_CHECK/TEST_DEF 155/TEST_SIM 155/TEST_MOCK **221**/TEST_BMD 155/CLIPPY×4/BUILD×3/PROOF）; mock 215→221 恰 +6 新测试; fmt apply 后 check 仍 clean（本地树与盒零漂移）; 日志证据入 verify 报告` | `Gate: BOX`
- [x] 6.2 CI 全绿（现有 checks 粒度化核验，非自报） `Contract: 验收口径（CI PASS ≠ Merge Gate PASS，独立核 CI 实跑）` | `Implementation: 待 PR 后 gh pr checks 实查` | `Verification: gh api 实查 required checks 全 green（七 context: rust-format/rust-test-matrix/rust-clippy/session-lifecycle/hardware-test-compile/architecture-portability/gstreamer-build）` | `Gate: CI`
- [x] 6.3 verify 报告（Contract/Implementation/Verification/Gate 四栏纪律表 + D14 关闭证据）→ archive → PR → merge → 删分支 `Contract: 项目交付纪律` | `Implementation: verify 报告落 `docs/superpowers/reports/2026-09-02-v03-d14-runtime-snapshot-consistency-verify.md` → comet guard build→verify→archive → PR → merge → 删分支` | `Verification: verify 报告落 docs 归档目录；PR merged` | `Gate: RELEASE`
