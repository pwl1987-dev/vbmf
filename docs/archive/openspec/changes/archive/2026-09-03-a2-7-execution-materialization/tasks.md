# Tasks — a2-7-execution-materialization

> 四栏纪律。Gate 链（用户裁定冻结）：00 SoT/Ownership Probe → 01 Fact 
> Shape/Ownership → 02 Custody → 03 Execution→Master→Join→Snapshot → 
> 04 Mock/Simulation 验证 → 05 真机前置 → A2-8 双输入真机切换。

- [x] 1. A2-7-00 SoT/Ownership Probe: **分账**（已有八项实锚禁重造:
  materialize L529-549/MediaBackend SPI 五方法/Session 冻结链 L11+L530/
  watchdog b1-b3+a4 闩锁/Bus 词表/PipelineHandle+Health/outputs 投影/
  Production 等 Intent; 缺失五项=Execution Fact boundary/Custody/三 
  Master writer/Metadata producer/JoinInput 装配全零）+ 9 候选七维裁表 +
  六问 A-F 证据（**关键披露: SWITCHED/PROGRAM_COMPOSED 执行事实不存在**
  ——管线无独立 Switcher/Composition 节点）+ 十项禁止清单 + OQ-1..5 交裁;
  报告=docs/superpowers/reports/2026-09-03-a2-7-execution-materialization-
  sot-probe.md
  `Contract: A2-6 终裁 Gate 链+分账要求+十项禁止` | `Implementation: 已` | 
  `Verification: 分账两侧全实锚·零 .rs diff` | `Gate: 无`
- [x] 2. 用户对 OQ-1..5 逐项裁决（2026-09-03 终裁落 probe §8: OQ-1=事实
  驱动+缺失则 Deferred·**否掉声明性推进**[Intent≠Execution Fact]·b1/b3
  禁自动命名 NormalizeComplete / OQ-2=无 producer 恒 UNKNOWN fail-closed·
  否掉 config/manifest / OQ-3=Custody attribution first·Join bool injection
  second·禁机械等价与 FailureDomain enum / OQ-4=复用双 PTS measurement·
  分类独立·不建 Engine / OQ-5=独立 Custody·SessionManager 协作不拥有·
  Supervisor 不介入; A2-7-00 CLOSED）
  `Contract: 用户裁定权` | `Implementation: 已` | `Verification: probe §8` | `Gate: 无`
- [x] 3. A2-7-01 Fact Shape/Ownership Probe（Probe+设计先行; **核心任务
  查死 NORMALIZED**）: **决定性发现——normalize 声明被 Materialization 
  静默忽略**（PipelinePlan.normalize 在 GStreamer controller 零消费;
  实际链 src→caps→appsink 无 normalize 元素, true/false 生成管线相同;
  唯一 videoconvert 在 output 编码分支=delivery 侧）→ b1/b3=RAW ingest 
  acceptance 非 normalize completion → SOURCE_RAW→NORMALIZED 从"✅ 可
  实现"再收紧为 **Deferred**（事实前提=Adapter 实插 Normalize 元素+可观测
  完成点, 属 02+ Execution Adapter 侧）; 附带发现: normalize=声明与执行
  缺口（intent 声明 V0.2 Normalize 能力未实现）; 四空白: ① Fact Shape 
  五域候选（禁万能 struct）/② attribution 底座已备（PipelineBusEvent
  {handle,source} element 粒度 + PipelineFault{pipeline}）/③ Metadata 
  source 全库零→维持 UNKNOWN fail-closed→当前唯一合法 ProgramMaster=
  join_result:None / ④ Custody lifecycle 形态建议（独立模块+三触发挂点
  候选+单向依赖禁反向接线）; OQ-6..9 交裁; 报告=docs/superpowers/reports/
  2026-09-03-a2-7-execution-materialization-01-fact-probe.md
  `Contract: 00 终裁 §8 四空白+核心任务` | `Implementation: 已（零 .rs diff）` | 
  `Verification: normalize 零消费 grep 实锚+四空白全证据` | `Gate: 无`
- [x] 4. 用户对 OQ-6..9 终裁（2026-09-03 落 01 报告 §5: OQ-6=normalize 缺口
  正式登记 Execution Adapter Gap·Custody 禁隐式吸收[Intent≠Execution Fact]/
  OQ-7=completion fact 归 Execution Adapter·**b1..b4 正式归类=Ingest 
  Observation/Acceptance Evidence**/OQ-8=最小可证事实模型·**fact absent 
  而非 fact=false**·排除万能 ExecutionFact/OQ-9=Metadata 生产权归 
  Control/Program orchestration·A4=candidate 非唯一 SoT; 全局修正: A2-7 
  不追求 ProgramMaster 一定形成——当前唯一合法=join_result:None; Custody 
  七不终裁; A2-7-02 顺序修正: 先 Fact boundary→再 Custody→最后接 join;
  A2-7-01 CLOSED）
  `Contract: 用户裁定权` | `Implementation: 已` | `Verification: 01 报告 §5` | `Gate: 无`
- [x] 5. A2-7-02 首刀（最小 Fact boundary + Custody）: `src/custody.rs` 
  新模块——`FailureObservation{source:FailureSource 封闭词表, path}` +
  `attribute_failures` 保守归因（管线粒度=设备级 video+audio 同 Handle,
  media path 标注缺失→双路 failed 保守记档, element 级演进 deferred）+
  `CustodyObservations{failures,avsync}`（零第二 SoT: 消费时装配参数包,
  与 MasterJoinInput 同律）+ `custody_snapshot` 最小闭环（consume→归因→
  **advance 零触发**[无 transition evidence, 三 Master 诚实停留初始态]→
  build JoinInput→join→compose）; 4 测试: attribution 保守/无 failure=
  None+初始态不虚推进/failure 穿透 readiness gate[单路→Degraded·双路→
  Failed·AVSync FAILED 不改]/确定性+C′ 不可达; normalize Gap 正式登记
  （PipelinePlan.normalize 字段 doc: Execution Adapter Gap·Custody 禁吸收）;
  **不碰 materialize/SessionManager/watchdog/transport**（终裁禁止清单）
  `Contract: 01 终裁 §5 Custody 七不+OQ-6..9` | `Implementation: 已` | 
  `Verification: 盒上 custody 4/4 + mock 303（299+4 恰）+ clippy 4-combo 
  PASS + fmt clean` | `Gate: 无`
- [x] 6. A2-7-02 复核终裁落实（CHANGES REQUIRED attribution-only → 修正版
  @待推）: `FailureObservation{source: FailureSource[首版单值 PipelineFault],
  scope: FailureScope[首版单值 SharedPipeline]}`——**输入=真实故障 scope 
  证据非调用方预归因 path 结论**（PipelineFault{pipeline:Uuid} 无 video/
  audio path, caller 无从得知; 旧 FailurePath plumbing test 删除）; 
  attribute_failures=**Custody 真归因**（SharedPipeline→双路 failed; scope
  无 VideoPath/AudioPath 变体=单路归因编译期不可构造）; 来源边界: 仅 
  PipelineFault 可接[SessionFailed/HardwareFault/HealthChanged/ClockLost 
  不机械映射——等 attribution contract]; 语义连锁记档: **Degraded[行 3 
  单路]首版不可达**（等 scope 演进）; 测试重写: SharedPipeline 一条→双路
  FAILED[穿透未 Ready]/空→双 false/AVSync FAILED 不改; **其余全维持**
  （Fact boundary/Custody/advance 零触发/Metadata Unknown/AVSync 
  passthrough/零扩张）
  `Contract: A2-7-02 复核终裁[01 报告 §6]` | `Implementation: 已` | 
  `Verification: 盒上 custody 4/4 + mock 303 + clippy 4-combo + fmt clean
  + FailurePath 零残留` | `Gate: 无`
- [x] 7. A2-7-02 二轮终裁落实（identity correlation, CHANGES REQUIRED →
  修正版 @待推）: `FailureObservation` 增 `pipeline_id: Uuid`（沿用 
  `RuntimeEvent::PipelineFault.pipeline` 真实身份; **禁**强行统一 
  PipelineHandle(u64)↔Uuid——两级身份映射留 A2-7-03 确认 SoT）+
  `attribute_failures(pipeline_id, observations)` 只消费 **pipeline_id 
  匹配 ∧ (PipelineFault, SharedPipeline) 联合证据**（matches! 联合匹配
  ——source+scope 是联合证据非 scope 单独定语义）+ `custody_snapshot` 增
  pipeline_id 参数; **跨实例污染回归测试**（custody_05: A 故障流 → 
  B snapshot=None 零污染 + 混合流各归各 + 反向不污染）; 语义连锁记档:
  Degraded 首版不可达; 二轮测试教训: helper 装配注意混合流身份构成
  `Contract: A2-7-02 二轮复核终裁[01 报告 §7]` | `Implementation: 已` | 
  `Verification: 盒上 custody 5/5（新增跨实例污染回归）+ mock 304（303+1 
  恰）+ clippy 4-combo PASS + fmt clean` | `Gate: 无`
- [x] 8. A2-7-03 复核终裁落实（ACCEPTED WITH REQUIRED FOLLOW-UP / NOT
  CLOSED——三段式: Identity Probe CLOSED/Bridge CLOSED/**Production 
  Connection DEFERRED TO 04**）: 03 报告 §0 修正（mapping 表表述收紧=
  No new mapping table/No second identity registry·Session 已存 
  SessionInput{device_id,handle} 关联非无关联; **PipelineFault.pipeline 
  标记 legacy/misnamed field**——SourceMaterialized.pipeline=Pipeline 
  identity 同名双语义=Event Contract ambiguity 债务, 类型级修正留 V0.3;
  FailureObservation.pipeline_id 标记 legacy event-field correlated 
  identity=DeviceId 勿误读; 三身份分层记档[Device/Handle/Session 禁一
  Uuid 兼任]; 桥尚无生产调用者[真实链现状: mapper nil 拒收+echo 再拒收=
  故障未经桥]）+ custody.rs doc 同步（字段 legacy 标记+桥接线状态）+
  **04 进入条件冻结**（§0' 全链 + 验收重点≠ACCEPTABLE 而是=真实故障→
  Device correlation→零污染→echo 不重计→恰一次→FAILED）
  `Contract: A2-7-03 复核终裁` | `Implementation: 已` | 
  `Verification: 03 报告 §0/§0'` | `Gate: 无`
- [x] 9. A2-7-04: mock lifecycle 全链闭环验证（终裁 §0'' 六裁决+八红线+
  冻结验收全执行）——`custody::lifecycle` 子模块（feature-gated mock, 与
  session.rs 同律）: **custody_08 六验收闭环**（1 create→start 真实走 
  SessionManager+MockBackend·IdentityResolved 链路证据 / 2 真实 SessionInput
  {device_id,handle}[NEXT_PIPELINE_ID 同源非 0 哨兵]零新 mapping / 3 故障
  经现有 FanoutSink 组件非旁路数组 / 4 桥恰提取 1 条目标 Device 真实 
  PipelineFault[echo=0·nil=0] / 5 A=FAILED·B=None·echo 零 observation / 6 
  双路注入→Failed 不依赖 readiness[三 Master 初始态]）+ **custody_09 A/B 
  双实例反证**（MockProviderB 双设备, A≠B·H1≠H2·**零额外 registry**——A 
  fault→Custody(A)=FAILED·Custody(B)=None; 反向 B fault 同理; 身份仅经
  各自 SessionInput, handle 不参与归因[编译期: attribute_failures 签名无
  Handle]）; 八红线全守（零新 Runtime/零 contract 修改/零 mapping registry/
  Custody 不进 watchdog/零 durable dedup/零 VideoPath 发明）
  `Contract: A2-7-04 终裁[03 报告 §0'']` | `Implementation: 已` | 
  `Verification: 盒上 custody 8/8[含 lifecycle 2] + mock 307（305+2 恰）+
  clippy 4-combo PASS + fmt clean` | `Gate: 无`
- [x] 10. A2-7-05 前置确认+收口（04 终裁: 封存名=Mock Closed-Loop Validation
  非生产闭环; **05 第一项前置确认=不具备**[mapper 兜底产 nil, 桥正确拒收]
  → A2-7 收尾 Custody 模型, 生产链三缺口[Backend attributed 事件/watchdog
  归属/常驻消费者]保留后续 Event Contract·Failure Attribution change）:
  盒上全矩阵 14 步 ALL_DONE（test 200/200/307/200 全 0 failed[mock 
  299→307 +8 恰]+clippy -D×4+build×3+remove-adapter PROOF 全 EXIT=0）+
  verify 报告（分层定位+债务清单五项）+ guards（record-check）+ archive
  + PR + CI 七 checks + merge + memory
  `Contract: A2-7-04 终裁+交付纪律` | `Implementation: 已` | 
  `Verification: 矩阵 14 步 + verify 报告 §2` | `Gate: CI/RELEASE`
