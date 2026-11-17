# Tasks: Phase 0.7D — p07d-event-integration

四栏纪律：`Contract: 已有(引用冻结文档节号) / Implementation / Verification / Gate`。

## 1. Health Reducer + 消费语义（design.md D1/D2/D3）
- [x] 1.1 D3 定稿：单日志多消费者 drain 语义（非破坏读 vs 分流 vs 游标），约束=transport 本体零改动 + 0.7C-6 四语义零偷改 + `/health` 字段不变；落 Design Doc
      Contract: 0.7C-6 design §4 deferred（Health Reducer/消费循环）+ EVENT_CONTRACT §2（投影不改 Runtime 行为）
      Implementation: docs（Design Doc 决策记录）
      Verification: Design Doc 含三候选对勘 + 约束核对表
      Gate: design 阶段 guard
- [x] 1.2 `health.rs`：`reduce(current, events) -> AgentState` 纯函数 + AgentState 8 态 × RuntimeEvent 映射表逐态定稿（不足态显式声明来源，不造新事件）；去 `#![allow(dead_code)]`（Gate 2.1 skeleton → 完整实现）
      Contract: MEDIA_AGENT_STATE_MACHINE.md 8 态词汇 + 0.7C-6 design §4
      Implementation: health.rs
      Verification: Unit 测试（纯函数同输入同输出 + 逐态映射）
      Gate: EVENT-INTEGRATION-RT-01 Unit 层
- [x] 1.3 `main.rs` 七处命令式散写收敛到 reducer 派生（Ready:499 / Capturing:537,1233 / Degraded:1253,1258 / Ready:1274 / ManualRequired:1467,1483）
      Contract: 0.7 红线 1（Observation≠Configuration——reducer 输出仅观测面）
      Implementation: main.rs 接线
      Verification: 新旧路径等价性测试（同场景同终态，Simulation 逐场景断言）
      Gate: EVENT-INTEGRATION-RT-01 Simulation 层
- [x] 1.4 Supervisor 事件驱动输入接线（故障类事件视图 → `report_failure` 语义等价）；`report_failure/begin_restart/report_recovered` 调用面与决策纯度零变更
      Contract: 0.7C-6 design §4（"Supervisor 回归纯决策引擎"保持）
      Implementation: main.rs watchdog 接线层
      Verification: 消费等价性测试（事件驱动 vs 轮询快照同决策）+ supervisor.rs 既有测试回归
      Gate: EVENT-INTEGRATION-RT-01 Simulation 层

## 2. 4 项零生产事件点亮（design.md D5）
- [x] 2.1 定位并接线：IdentityResolved→身份解析成功点 / SignalVerified→信号验证通过点 / LoopbackVerified→loopback 验证通过点 / ResourceReservationExpired→预留过期点；只加 emit，词表/平面零改动
      Contract: EVENT_CONTRACT TD-16（词表冻结）+ 0.7C-6 design §4（"零生产 4 项点亮——登记演进"）
      Implementation: 对应生产者模块（resolver/identity、signal、loopback、resource expiry 路径）
      Verification: Simulation 断言 `kind_counts` 增量精确（无噪声事件）
      Gate: EVENT-INTEGRATION-RT-01 Simulation 层

## 3. housekeeping（三项与语义变更同 change）
- [x] 3.1 `rpc.rs` 陈旧注释修正（工作区已就绪：指向 transport.rs 为当前 HTTP 边界、rpc.rs 为冻结 SoT §14 契约记录不在 wire 路径）
      Contract: 0.7C-8 终审裁定（rpc.rs 修正并入 0.7D）
      Implementation: rpc.rs（纯注释，0 行代码变化）
      Verification: diff 非注释行数=0
      Gate: PR review
- [x] 3.2 删除三个陈旧 change 目录（`p07c-error-model`/`p07c-event-projection`/`p07c-external-api`；删前 diff 复核归档件完整）
      Contract: 归档生命周期闭环（archive 目录为权威记录）
      Implementation: git rm 三目录
      Verification: 归档件 diff 零差异 + resume-probe 不再误判 multiple active
      Gate: PR review
- [x] 3.3 Phase Map 0.7D 行再锚定（去"EventSink 解耦 D8 与此同期"过时标签 → 事件内消费集成）+ 债表登记
      Contract: PHASE_IMPLEMENTATION_MAP=唯一实施 SoT（文档漂移=P0）
      Implementation: PHASE_IMPLEMENTATION_MAP.md + PHASE_0_7A_POST_MERGE_DEBT.md
      Verification: 行内容与实际工作面一致
      Gate: verify 阶段复核

## 4. 三层测试 + 真机 + 交付
- [x] 4.1 Unit：reducer 纯函数语义（同输入同输出 / 逐态映射 / 事件不足态显式来源）
      Contract: D1/D2
      Implementation: health.rs tests
      Verification: `cargo test -p media-agent --features mock` 新增全绿
      Gate: EVENT-INTEGRATION-RT-01 Unit 层
- [x] 4.2 Simulation：Mock 全链事件驱动派生 + Supervisor 消费等价 + 4 事件点亮精确计数 + 新旧等价性 + 0.7C-6 四语义回归（evt_proj_rt_01_* 不破）
      Contract: 0.7C-6 四语义零偷改
      Implementation: 集成测试
      Verification: 新增测试全绿 + 既有 evt_proj_rt_01_* 全绿
      Gate: EVENT-INTEGRATION-RT-01 Simulation 层
      NOTE (0.7D-4.2 收口): evt_int_rt_01 ×3 @ d77f158 — 等价性用真实 SessionManager
      事件流经 FanoutSink 断言 (非手工事件); 消费等价=谓词纯函数测试 + 单一调用点构造性
      等价 (fault_from_events 与轮询 OR 进同一 report_failure); IdentityResolved/
      ResourceReservationExpired 计数已锁; SignalVerified/LoopbackVerified 的 emit 站点
      在 main.rs cfg(bmd,gstreamer)/gate 路径 — 其计数验证归 4.3 真机层。
- [x] 4.3 Hardware：盒上真机 gate（生命周期事件流 → AgentState 派生实证 + TRANSPORT-RT-01/EVENT-PROJECTION-RT-01 回归——外送投影契约不因内消费破坏）
      Contract: D3 约束（transport 零改动 + 投影端点行为不变）
      Implementation: main.rs gate 段
      Verification: 盒上 VBMF_SESSION_LIFECYCLE=1 真机跑 + 全门禁回归
      Gate: EVENT-INTEGRATION-RT-01 Hardware 层
      NOTE (0.7D-4.3 收口): 盒上真机双入口 ALL PASS (2026-09-01, bmd,gstreamer dev 二进制):
      ① VBMF_SESSION_LIFECYCLE=1 (~/gate_evt_int_rt01.log, exit 0): E1
      identity_resolved=5/session_created=5; E2 derived_during_running=Capturing +
      E2_final_state=Degraded (reducer 派生, gate 段无旁路写入点); E3 signal_verified=1
      (生产 watchdog a4 双路首帧+PTS 单调翻真, 闩锁恰好一次, A+B+C 全过 236 帧实证);
      E5 resource_reservation_expired=1 + expired_phase=Terminated (生产 5s tick 驱动
      30s 预留窗口真实过期); E6 pipeline_fault=0 (回声不自激, 谓词排除 4.2 已证);
      E7 投影全量 60 条完整 + internal 残留 10 条干净 drain (双日志互不破坏); 回归
      SESSION/RESOURCE/COMMAND-CONTRACT/IDEMPOTENCY/ERROR-MODEL/EVENT-PROJECTION
      (dropped_obs=0/dropped_crit=0)/EXTERNAL-API 全 OK, ALL PASS。
      ② VBMF_LOOPBACK=1 (~/gate_loopback_e4.log, exit 0): E4 loopback_verified=1
      (期望 1), LOOPBACK ALL PASS=true (fixture BMD-SDI-LOOPBACK-01 双门通过)。
      TRANSPORT-RT-01 回归形态 = Simulation 层 loopback TCP 测试 (transport.rs:522,
      矩阵四 test 步覆盖) + transport.rs 零改动 (D3) + /health 契约锚 (EXTERNAL-API-RT-01)。
      本次改动后矩阵 14/14 exit 0, 零警告, 测试 155/155/215/155 全过。
- [x] 4.4 盒上全矩阵（fmt apply+check + test×4 feature + clippy -D×4 + build×3 + remove-adapter PROOF）+ CI 七 required checks
      Contract: 验收三层（BOX/CI/RELEASE）
      Implementation: ~/p07_verify.sh + gh CI
      Verification: 矩阵全绿 + 7/7 success（gh api 实查）
      Gate: Merge Gate
      NOTE (0.7D-4.4 收口): 盒上全矩阵 14/14 exit 0, 零警告, 测试 155/155/215/155
      (2026-09-01, 4.3 改动后复跑, 详见 4.3 NOTE); CI 七 required checks 于 PR
      建立后经 gh api 实证 7/7 (merge gate, 纪律: CI PASS≠Merge Gate PASS)。
- [x] 4.5 verify（0 CRIT/0 IMP 目标）→ archive → PR → merge → tag `phase-0.7D-event-integration` → 删分支 → memory 更新
      Contract: 归档后修复不开新 change 走原分支纪律
      Implementation: comet verify/archive + gh pr
      Verification: verify 报告 + archive 7/7 + merge commit
      Gate: 全生命周期闭环
