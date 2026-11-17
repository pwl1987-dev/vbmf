# Tasks — a2-8-dual-input-switch

> 四栏纪律。Gate 链（用户两轮终裁冻结）：00 Probe（CLOSED）→ OQ 终裁 +
> Pre-Implementation 十项冻结 → 01 FRAME_SWITCH Execution Group MVP（T1-T12）
> → 02 真机 → 03 failure/supervision → 04 AV continuity → 05 archive+CI+merge。
> **A2-8 NOT CLOSED until 05。**

- [x] 1. A2-8-00 SOT Probe: 裁决事实断言复核（8 项全锚）+ 六问逐答
  （Q1 双 Pipeline 真机=A1 已证 inputs=2·Q2 三候选形态[inter 系倾向]·
  Q3 input-selector frame-boundary 原生·Q4 独立 trait 倾向·Q5 
  MultiInputWatchdog=Precondition Gate·Q6 观测点=selector active-pad+双
  PTS+首版只显式切换）+ 盒上元素实查（input-selector/inter 系/
  audiomixer 全在）+ 12 红线+禁塞 A/B 落盘 + OQ-1..5 交裁; 报告=
  docs/superpowers/reports/2026-09-03-a2-8-dual-input-switch-sot-probe.md
  `Contract: A2-8 终裁[12 红线+六问+否决直接编码]` | `Implementation: 已` | 
  `Verification: 六问全实锚·零 .rs diff` | `Gate: 无`
- [x] 2. 用户两轮终裁落盘（2026-09-03）: 第一轮 OQ-1..5 批准 + 01 批准;
  第二轮修正=**不批准直接编码，批准 Pre-Implementation Gate**——十项冻结
  [ExecutionGroup=Program execution boundary/Switch≠Backend SPI/
  SessionManager≠graph builder/Supervisor≠switch executor/topology=实现
  细节/FRAME first/**Video+Audio 成对切换=方案 A**/AV continuity mandatory/
  MASTER Deferred/failover Deferred] + OQ-1 降格[inter 系=候选
  Materialization 非架构合同] + T1-T12 验收矩阵（替代 T1-T5） +
  Desired≠Execution≠Observed 三分离 + 禁 Session.active_input/
  SessionInput.is_active + Event Identity Debt 不修[PipelineFault.pipeline
  兼容层维持，新增代码不扩大歧义] + watchdog 四观测非 God Object +
  01 完成标准=真实 Execution Graph+真实 A/B 切换+MultiInputWatchdog 落地
  （不停在设计完成）; A2-8-00 正式 CLOSED; 落 probe §7
  `Contract: 用户裁定权` | `Implementation: 已` | `Verification: probe §7` | `Gate: 无`
- [x] 3. A2-8-01 最小 FRAME_SWITCH Execution Group MVP（"最小、可验证、
  可监督的 Program-level FRAME_SWITCH Execution Group"，非"input-selector+
  双 Pipeline"）: SwitchIntent→SwitchExecutionPlan→SwitchExecutionAdapter
  链（独立执行面）+ ExecutionGroup 概念（inputs/switch/program output/
  supervision；SessionInput 原样）+ Program graph 构建（topology=实现细节，
  归 Program Execution/Switch 层）+ **Video/Audio 成对显式切换** + 六路 PTS
  观测点（A/B/Program×video/audio）+ MultiInputWatchdog（修正 bin L403+
  gates L165 首 handle 用法为 ExecutionGroup 四视角单实例，禁 for 循环双
  spawn）+ T1-T12 落地（mock 层先行，盒上 cargo 验证）; 12 红线全程
  `Contract: 00 终裁+Gate 十项冻结（probe §7）` | `Implementation: 已
  （五提交 0ee8ae2/4a07ca6/585ac23/72d9aa0/337a6b6: switch_execution 纯
  模型·contracts/switch SPI+Mock·GStreamerSwitchAdapter 真实物化·
  execution_group_observe_fold+薄壳·bin 双输入接线; gates L165 单输入
  gate 保持原样——单输入路径不动）` | `Verification: 盒上矩阵全绿
  [default 200·sim 200·mock 330(307+23)·bmd+gstreamer 202 含真实双测
  2/2]·clippy 四组合 -D warnings 全 exit 0·fmt clean·边界门禁[冻结面
  backend/session/events/supervisor/program/pipeline 零 diff·契约面签名
  零拓扑耦合]; **T5 边界实证（第三轮终裁拆分记录）**: 回切 selector 原生
  透传源时间戳可现 <1 帧 PTS 后跳，三态机如实检出 NonMonotonic——
  **T5 = 观测能力 PASS / 连续时间线 NOT YET PASS**（01 状态=FRAME_SWITCH
  execution PASS; Program timeline continuity DEFERRED/FAIL-PENDING-
  CORRECTION——架构级事实: source switching ≠ Program Timeline
  continuity, 真实 GStreamer 实证）` | `Gate: T1-T12 mock 层全落地+
  真实 GStreamer 切换实证; **A2-8-01 = IMPLEMENTATION COMPLETE +
  APPROVED（第三轮终裁, probe §8）**; **A2-8 NOT CLOSED**`
- [ ] 4. A2-8-02 Real Dual-Input Program Execution **Integration**（第五轮
  终裁重定义, probe §10）: 三件事一个完整集成——**MediaTap + Program
  Graph Lifecycle + Recover Reattachment**; 五层验收 **L1 Input**[
  DeckLink A/B 真实 RAW+PTS+health+bus]·**L2 Execution**[A/B 真实进入
  Program Graph]·**L3 Output**[Program output 真 frames+PTS]·**L4
  Timing**[A/B/Program 三列 PTS·切换前后 monotonic/continuous]·**L5
  Supervision**[A fail→B alive·B fail→A alive·Program fail 不误判 A·
  echo 不成第二物理 fact]; **G1 升级必修 Gate**（Session.stop 只停
  SessionInput 句柄 session.rs:726-763·stop_program 零接线=Program
  orphan 实证）; **C1 修正裁定**: 否决强制 HLS/RTMP output 获得 tee
  （内部 tap≠业务 OutputPlan）; 方向 A>C>B（Generic MediaTap 构造期能
  力>intervideo 桥>动态手术）; **C2 必修**: MediaTapAttachment 簿记
  （execution resource bookkeeping 非新 Device Identity Registry）+
  recover 重放 attach; 停止序 Program Stop→Tap Detach→Inputs Stop→
  Release; **模拟边界**: 01 videotestsrc=仅 GStreamer switch execution
  证明; FrameAligned≠TimelineContinuous 冻结; 执行序 **02-A Controller/
  Session 生命周期接线→02-B Generic MediaTap contract→02-C MediaTap
  materialization→02-D recover re-attach→02-E Program Graph 入 Session
  生命周期→02-F intervideo A/B 真机桥接→02-G Program Output
  observation→02-H Timing/PTS measurement→02-I 真机双 DeckLink 验证**
  `Contract: 第四轮五层+第五轮 Integration 重定义（probe §9.3+§10）` | 
  `Implementation: 02-A..02-H 已（十六刀提交链至 19326e8: E-1..E-6
  SessionStopHook+ProgramExecutionRuntime[creator=destroyer·close-path
  E-6]→F-01 唯一构造 bundle 三 trait view[backend/media_tap/bridge_
  observation 同一 Arc controller]→F-02 组合根接线+双输入回滚→F-03/
  F-04 Bridged inter 真机桥接+十项证据链→F-05 多切换+TargetAlready
  Active 真纵深修复→G/H BridgeObservation 一等事实+三列 PTS+recover
  降级+故障域[probe §19]→G/H-1 liveness 观察时钟窗口语义+tap_channel
  唯一来源收尾[probe §20]）; 第十六轮 02-I 代码前置三刀+serial 档+日期修正
  （P0-1 生产组合根 PortRegistry/P0-2 Capability SDK 位掩码证据/P1-1 双平面
  补偿 degraded/P1-2 IdentityStrength::Serial, probe §21）; 第十七轮两刀
  （①PersistentId 证据门+src_props Result belt——persistent-id=0 盲开
  路径封死·②PortId 碰撞双层防线=证据面告警+registry 装配层 fail-closed,
  probe §22; **实证: 盒上两张 DeckLink SDI 双工卡 in/out 同 port_id
  （e43d8f5a/f0f53b80）——十八轮终裁: collision closure=P1 架构债务非
  02-I 阻塞（Manifest 只声明 Input 时 registry 无别名可继续）**; 新遗漏
  实锤: derive_claims() 不消费 port_id 只取首个 "-input" resource=
  P1/N×M debt; **登记独立后续 change PORT-IDENTITY-AND-RESOURCE-
  ADDRESSING**: direction+connector+ordinal+PortId 迁移+Manifest+
  PortRegistry.get()+derive_claims()+Resource addressing 一次闭合,
  禁只修 UUID 不修 claims; 第十八轮: **VBMF_A2_8_DUAL_INPUT 正式 Gate
  入口落地**（gates/dual_input.rs——L0 形态 fail-closed/L1 三列分记/
  L2 双输入 Session+ProgramRuntime+Tap 桥/L3 帧增长非 PLAYING/L4 三列
  PTS 只测量+切换全序/L5 隔离+recover 复流+故障域不越域/Teardown 停止
  链; 盒上入口 smoke=真实 discovery→形态拒绝实证, probe §23）; 第十九轮
  **A2-8 Gate Hardening H1-H4+P1**（probe §24: H1 全链 fail-stop——L1a/
  b/c/d 任一 FAIL 即终裁不进 L2·L2b/L3 失败走完整 Teardown 后不进下一
  层·L4 FAIL 跳 L5; H2 L1d Port↔Resource closure——每设备恰一 Input
  Resource 且 ID==manifest port 规范派生[input_resource_id_for_port
  单源, derive_from_discovery 同源调用零行为变化], 4 纯函数测试, 零改
  SessionManager/derive_claims; H3 intent 携带已验证 port_id——实锚
  materialize 精确消费该字段[Some→registry 精确 connector 定位/无匹配
  生产 fail-closed], 原 None 回退路径弃用; H4 每端口一行一一对应证据
  [handle/port_id/conn/ordinal/cap/signal/dn 同行]; P1 删 6 处
  agent_state 直写——Gate verdict≠生产 health state）; 02-I 真机 Gate
  待用户双 SDI 窗口` | 
  `Verification: mock 356·bmd+gstreamer 230（含真实跨管线桥接/多切换
  一致性/G/H 三列证据/liveness 降级锁死/persistent-id=0 拒绝/碰撞防线
  测试/十九轮 L1d closure 四测试）·clippy 双组合 -D warnings clean·fmt
  clean; resolver gate 真机
  复跑双工卡碰撞告警×2 落盘; 真机五层矩阵=02-I 执行（VBMF_A2_8_DUAL_
  INPUT+现场 v4 双 Input port 声明 manifest）` | `Gate: 02-A..02-H
  全 CLOSED（probe §19-20）·02-I OPEN[**代码前置 CLOSED——第十九轮
  终裁 APPROVED（probe §25）: fe71b7c 冻结为 A2-8 验收候选基线;
  子项 Gate automation/H1 fail-stop/H2 Port↔Resource/H3 Intent↔Port/
  H4 evidence/Health-state isolation 全 CLOSED; SessionManager/
  derive_claims/PortIdentity/PTS normalization/N-input/Supervisor/
  recover SPI 零越界**; 仅剩 Real hardware=双 DeckLink+双 SDI
  L0→L5+Teardown; 硬件形态边界=两块独立单输入卡（collision closure/
  derive_claims/serial binding/audio 独立性/UUID namespace 统一=
  独立 change 不混入, 十八轮 §十二/§十三+十九轮 §11 定级）;
  **第二十轮 APPROVED/FROZEN/GO（probe §26）: fe71b7c=实现冻结基线·
  019f89e=裁决账本基线·禁再动 A2-8 代码·§9 验收矩阵已逐项映射
  Gate 实锚·首跑 FAIL 先留证按 A/B/C 分类（硬件/证据/代码）禁为
  跑绿改码·v4 manifest 由真实 Discovery 据实生成不手工美化;
  **02-I 真机首跑已执行（2026-09-04, probe §27 零代码）: v4 manifest
  已据实生成; fe71b7c bin 下 L0/H4/L1b/L1d PASS（H2 闭环真机成立）
  + L1a/L1c FAIL → H1 fail-stop 精确触发零会话创建; §11 裁决=B 类
  Real Hardware / Runtime Environment Preconditions（SDI-IN-1 无信号·
  SDI-IN-2 gst 输入稳态不可开[仅 device 0/1 可开, 08-27 时代 device 2
  可开]; 二十一轮精度修正: 根因未证明, 候选 B1..B8）; run1 陈旧
  cb78adc bin 对照=十九轮
  §3 P0 真机活体演示（教训: gates 真机复跑前必须 cargo build bin）;
  证据归档盒 ~/a2-8-02i-evidence/**
  ]——**硬件前置细化: ①双 SDI 信号源接入两卡输入 ②SDI-IN-2 gst 输入
  可开性恢复（候选 B1..B8 未定, 用户侧排查）; 恢复后无需修改代码,
  但必须以当日 Discovery 核验 runtime binding, device_number 变化
  则据实更新 v4（device-number=Runtime instance address 非 Device
  Identity）再复跑**; **第二十一轮 APPROVED/FROZEN/GO 维持
  （probe §28, 零代码）: 02-I≠"代码失败"而是 B 类前置条件未满足
  ——A 类 NONE FOUND, C 类十项 OPEN 禁为 02-I 临时修; d0ffff9 记
  2026-09-04/仓库 2026-09-03=evidence host clock/timezone mismatch
  （不影响技术裁决, 影响时间线审计）——复跑证据须同录 date -u/date/
  timedatectl/git rev-parse HEAD; 复跑执行序①-⑧=probe §28.3（⑥显式
  cargo build --bin media-agent-gates 必须）; **第二十二轮 APPROVED/
  FROZEN/GO 维持（probe §29, 零代码）: 主线切换"02-I 真机条件恢复
  与证据验收"——无新代码裁决无新架构决策; 环境证据包纪律（§29.2）:
  证据头五件套[date/date -u/timedatectl/git rev-parse HEAD/
  git status --short]·build 后 HEAD 复核=实际执行确为冻结版源·
  六问 Evidence Package[何时/时区/commit/是否冻结 bin/两卡 Discovery
  状态/A-B-C 归类]——比增加 Gate 断言更有价值**; **第二十三轮
  APPROVED/FROZEN/GO 维持（probe §30, 零代码）: 02-I 阻塞点重定义=
  Runtime Address/Provisioning Identity 闭环——现场推断 gst 序
  [dn0≈SDI(1),dn1≈SDI(2),dn2≈Mini]=correlation evidence 非 canonical
  proof[resolver.rs:903/:939-985/:528-535/:1022 独立复核:
  ManifestVerified=dn 可开+可选 serial/model 校验, hw-serial NULL+同
  model 下不证 Handle↔dn 同一硬件——语义边界登记不修, identity closure
  冻结]; Gate 无写死 dn[dual_input.rs:198/:232-249]; B4 占用降级为
  观察事实[dn2=Mini output-only 被 ball sink 用→自然开不了 input];
  旧 v4 正式作废; 两路输入=A 类已证[ffmpeg 1080i25/1080p25 双拉流];
  下一步=身份闭环核验[Discovery→Handle↔物理 BNC↔SDI(1)/(2)↔runtime
  probe→人工/物理/官方工具交叉确认→新 v4[Provisioning 意义]→frozen
  build→L0→L5], 禁猜 dn 写 v4**; **第二十四轮执行（probe §31, 零代码,
  02-I Provisioning Identity Closure Step 0/1/2 已跑）: Step 0 环境
  证据+sha256 68/68 盒==本地 8fea7ea(=fe71b7c 冻结)·Step 1 当日
  Discovery[dn0/dn1 PropertyMissing 可开无身份·dn2-7 StateFailed·
  legacy 全 Unresolved fail-closed——与首跑形态一致=常态非新故障]·
  Step 2 视觉指纹[dn0=电视临沂频道 1080i25→BNC#2·dn1=ball 1080p25→
  BNC#4]+杀源差分[**BNC#4 ball 源独立于 PID 577061/Mini 输出——
  'BNC#4←4K 卡'证伪, 对端设备现场待核**; 电视分钟级抖动三证]+复原
  [PID 992634 原命令行]; 映射 PROVEN=dn↔内容↔ffmpeg 名, CORRELATION
  ONLY=handle↔(1)/(2) iterator 序[待用户裁决/照片/官方侧证];
  "人工/物理/官方工具交叉确认"=Provisioning/Evidence 层非 Runtime
  前提; 候选 v4[SDI-IN-1→gst0·SDI-IN-2→gst1]待裁决不写死**;
  **第二十五轮执行（probe §32, 零代码）: canonical closure 零代码
  闭合[碰撞告警 port_id↔display_name × H4 handle↔port_id（VBMF
  确定性联结）×内核 PCI canonical[dv0=44:00.0/dv1=45:00.0·Mini
  芯片序列交叉验证]×内容指纹 ⇒ 4fa33dcb=SDI(1)=dn0=BNC#2=电视·
  6ede00d0=SDI(2)=dn1=BNC#4=ball; 实证 SDK 序≠dv 序≠PCI 序——旧
  v4=错绑作废正确]; v5 据实生成+02-I 第二次验收: L0/L1a[2/2
  production_grade 首次]/L1b/L1d PASS+L1c FAIL 双卡 signal=false→
  H1 fail-stop 零会话; **L1c 根因=Gate probe 采样窗口[resolver.rs:
  230-232 set_state 后仅 300ms 即读 signal·检测器锁定需 1-3s=
  结构性假阴性; ffmpeg 同分钟双输入出帧+gst 12s 手动双卡 false→
  true 翻转——A 类证据自动化候选, 冻结未修, probe 不修 L1c 确定性
  false=02-I 唯一代码级阻塞待裁决]**;
  **第二十六轮（probe §33, **A2-8-C1 授权落地**——APPROVED/FROZEN/
  CHANGE REQUIRED）: C1=Resolver signal 观察窗最小修[仅 resolver.rs
  +86/−3, commit 1c3032b: PROBE_SIGNAL_WINDOW=3000ms 自 PLAYING 起算/
  INTERVAL=100ms 重采样/锁定提前结束/超时 Some(false) fail-closed;
  Option<bool> 契约零变更·错误分类与生产绑定语义原样·gate 零改动=
  单一设备打开者; 3 单测=transient false×2→true 锁定/全窗 false
  fail-closed 重采样≥2/首采 true 恰 1 次]; 盒矩阵: sha256 68/68 盒源
  ==HEAD·fmt OK·mock 211→214·bmd+gst 233 全过·clippy ×2 -D warnings
  OK; **第三次 02-I 验收（v5, 15:59:24 CST, 五件套+bin sha 入 log）:
  L0/L1a 2/2/L1b/L1c PASS[dn0/dn1 signal=true——C1 真机成立]/L1d/
  L2a[双输入 session·H3 精确]/L2b[双 tap 83 帧]/L3[120→210·
  ValidMonotonic] PASS·**L4 FAIL**·L5 FAIL[H1 设计性跳过非独立失败]·
  Teardown PASS——8/10 verdicts EXIT=2 全链首次完成**; **L4 FAIL=
  确定性签名复跑 2 逐项复现[判据锚 dual_input.rs:644-648 唯一失败项
  =prog pts NonMonotonic; 切换机制 completed/observed=B/epoch=1 全对;
  A/B in 列互差 8-10ms·in/bridge 各列 ValidMonotonic 仅 prog 翻转·
  alive=false=复合字段推论 program_execution.rs:111-112]=A2-8-01
  第三轮已裁架构硬事实[switching≠Program Timeline continuity·
  Timestamp Normalization 四方案未裁]的真机表达——初步 §11 归 C 类
  候选待终裁; 工件: converter interlace 断言两跑各 9 条未定性]`;
  v4=INVALID/ARCHIVED·v5 保留**`
  ; **第二十六轮终裁（probe §34, 落账零代码）: C1=PASS/CLOSED·
  02-I 整体=FAIL-PENDING-CORRECTION[L0-L3 PASS·L4 双维记账:
  L4-SWITCH=PASS·L4-TIMELINE=FAIL-PENDING-CORRECTION·L4 overall
  同·L5=SKIPPED BY H1 不计独立失败·Teardown PASS·v5 VALID/v4
  INVALID/ARCHIVED·Identity CLOSED·Port collision 不再阻塞]——
  精确语义=基础设施完成真实双输入切换执行闭环但 Program Timeline
  Continuity 未实现, 非基础设施失败; C-TIMELINE-01 正式登记[Program
  Timeline Continuity Gap=Architecture/Execution Adapter Gap 真机
  首证·排除 C1/identity/PortRegistry/SwitchAdapter/Supervisor/硬件
  不稳定·设计十问[authority/PTS 映射/epoch 共享/discontinuity/
  settle/offset/双 clock/encoder/recover/observation 证明]未冻结禁
  写码·开工门=Program Timeline Authority+A→B 切换 Video/Audio PTS
  连续映射]; 四不批准[①禁直接实现 Normalize——PipelinePlan.normalize
  声明未消费·三层禁再耦合 ②禁 H1 例外——evidence purity ③禁降 L4
  判据 ④禁 SwitchGraph/ExecutionGroup 内做 Normalize]; L4 证据原则+
  H1+Gate 表面全不动[L4 子项拆分=验收记账模型非代码授权——现行单
  bool 输出 FAIL 与 overall 口径零改码一致]; 保留边界[sampled_at_ms
  wall-clock 禁修 PTS media-clock·Bridge liveness 观察时钟分层];
  下一刀=独立 Timeline/PTS Normalization change 设计裁决（十问未裁
  不开工）; 边界披露: 1c3032b 用户侧未独立核验源码[分支已推送·C1
  CLOSED 依真机证据非报告自证]**
  ; **第二十六轮终裁补正（probe §35, 落账零代码——维持+两处账面修正）:
  用户独立核验升级[直接核 470f1a0/1c3032b/d123b45+八源文件+两次真实
  compare: 470f1a0→d123b45 仅两账面文件零夹带·fe71b7c→1c3032b 运行时
  代码仅 resolver.rs——§34.7 边界披露解除]; 补正一=C1 变更范围表述限定
  ["运行时代码变更只有 resolver.rs, 架构/账面文档同步另计"]; 补正二=
  **C1-P1 登记**[signal polling window 内异步 Bus Error 未二次 drain——
  resolver.rs:243-245 恰一次 drain_bus_error[fn :149]后轮询闭包仅采样
  signal :268-272 零 bus 交互, 晚到 Error 表现为 Some(false) 而非
  StateFailed 分类; 非 blocker·不重开 C1·不阻塞 C-TIMELINE-01; 未来修=
  poll 内可选 bus check 禁重新设计 Resolver]; **C-TIMELINE-01=
  CONFIRMED**[三代码证据: switch_graph.rs 全文件零 timeline 层+零
  clock/base_time 设置·Bridged capsfilter None :231·L4=真实 appsink
  buffer PTS 非簿记]; 新增维度=A/B 异构 1080i25↔1080p25 video format
  continuity 未定义须进设计; 设计十问 v2[Authority/PTS mapping/epoch
  共享/异构策略/settle/discontinuity-segment/recover timeline/
  Execution Fact/Observation 证明/落点禁令]+反假修复红线[禁
  max(last+dur, incoming) 假闭合·第一问=Authority 结构非 element 选择];
  影响矩阵 19 行照录[SwitchGraph=Gap 边界⚠️·PipelinePlan.normalize=
  核心入口之一⚠️·Resolver/ExecutionGroup/Supervisor/MediaBackend/H1
  全❌]; 最终状态机+**A2-8 Switch Execution 基础能力=PASS 与 02-I=
  FAIL-PENDING-CORRECTION 并立**; 执行令: d123b45 保持·下一轮直接进入
  A2-8-C-TIMELINE-01: Program Timeline Authority & PTS Continuity
  Design（十项冻结前禁写实现）; **设计 SoT 探针已开（2026-09-04-
  c-timeline-01-program-timeline-authority-design-probe.md, 零代码）:
  代码/真机/V0.2 spec 三面证据+十问逐问选项空间+四方案 A-D 对照+OQ
  待裁清单**
  ; **第二十八轮=C-TIMELINE-01 十问终裁（设计探针 §11 落账+主账 §36
  跨账引用, 零代码）: OQ-1..12 全裁——架构方向冻结=Program Timeline
  Authority + Clock-Segment Timeline + Source Segment Mapping[B 为主+
  A 执行机制·C"出口再生成"正式废止·D 不采用]; OQ-1 Authority=
  Program Execution 层 TimelineAuthority[禁 ExecutionGroup/Supervisor/
  MediaBackend/单 pipeline/出口 muxer·不做大型独立 Engine·Domain
  拥有语义/Adapter 拥有执行·ProgramExecutionRuntime 四组件结构];
  OQ-2 PTS=Source Segment Offset Mapping[SourceSegment{source_id,
  program_epoch,source_start_pts,program_start_pts,offset}·mapping_B=
  Program anchor−Source B anchor·max(last+dur,incoming) 永久禁止];
  OQ-3 V/A 共享 Program Epoch 不共享数值序列·switch_epoch≠
  program_epoch[一次成功切换→timeline epoch+1·recover 可独立变];
  OQ-4 Timeline 与格式归一化解耦[当前=Switch Boundary Adaptation+
  Format Contract 显式声明不保证无缝 format continuity·格式策略=
  独立 Program Media Format Policy]; OQ-5 settle=状态语义[Stable→
  SwitchRequested→SwitchExecuted→TimelineTransition→Stable·settle
  期间 PTS 必须已属新 timeline·≠gap≠freeze]; OQ-6 Discontinuity
  Domain+Gst Segment/Event 双层+PtsState 四态[+DiscontinuityDeclared
  ·declared≠unexpected backward]; OQ-7 Recover 本轮不实现语义冻结
  [Soft/Hard 两类·Supervisor 只决定 recover 不拥有 Timeline·接口留
  A2-8-03]; OQ-8 TimelineMapped 结构化 Fact[≠TimelineHealthy];
  OQ-9 TimelineObservation 专门证据面[observed_at=wall clock 禁入
  program_pts·"真的完成"七条·pts>prev 永远不足]; OQ-10 删裸 bool
  normalize→TimelinePolicy[本轮零代码]; OQ-12 三时钟职权切开
  [Timeline Authority/AVSync Manager/Channel Reference Clock 互不
  越权]; 八红线 R1-R8[wall-clock 禁修 PTS/max 假闭合禁/Authority
  不进 ExecutionGroup·Supervisor·MediaBackend/Gst Segment=Adapter
  机制非 Authority/格式转换不偷做/Fact≠Healthy]; 不触碰=已 PASS
  各层+SwitchExecution/SessionManager/Resolver/PortRegistry/
  ResourceRegistry/Supervisor·只解 L4-TIMELINE·02-I 状态不变[设计
  ≠Gate PASS]; **Design Freeze 15 项已形成**[2026-09-04-c-timeline-
  01-design-freeze.md: TimelineAuthority Contract/ProgramTimeline/
  ProgramEpoch/SourceSegment/TimelineMapping/Discontinuity/
  TimelineMapped Fact/TimelineEvidence/V-A 双平面/状态转移/GStreamer
  Adapter contract/1080i-p 边界/Recover 接口/L4 复证/不变量+失败
  条件]; 下一动作=开 implementation change（冻结后）; C1-P1/
  converter interlace/PORT-IDENTITY/canonical UUID namespace 四独立
  债隔离禁顺手修**
  ; **第二十九轮=Design Freeze 复核通过+Implementation Change 正式
  开启（设计探针 §12+主账 §37, 零代码, commit f3158a0 复核有效）:
  用户实核 Freeze 核心内容与十问终裁一致——ProgramExecutionRuntime
  现有组合根增设 TimelineAuthority 零新 Engine 层/三时钟职权分离/
  epoch 拆分/映射语义+双禁/Fact≠Healthy/evidence 独立/四方案=B 核心+
  A 机制 C-D 淘汰; 工程状态表冻结[C1 CLOSED·C1-P1 隔离·L0-L3+
  L4-SWITCH PASS·L4-TIMELINE FAIL-PENDING-CORRECTION·L5 SKIPPED
  BY H1·02-I FAIL-PENDING-CORRECTION·Design FROZEN·Implementation
  =下一阶段·converter interlace+PortIdentity/UUID=独立队列]; 纪律=
  先实现前拓扑探针/Impact Map→最小变更面冻结→再写代码·十项落点
  钉死[4/5/6 项须真实 Rust/GStreamer API 实证不凭架构图猜]; **
  Implementation Impact Map 已交付**[2026-09-04-c-timeline-01-
  implementation-impact-map.md: As-Is 拓扑实锚=组合根两生产构造点
  [bin:464+gate:480]/Plan 面 8 构造点 2 生产[self_test+materialize]
  零消费/切换全序[plan_switch→begin→switcher.switch[set_active 成对
  +P1-1 回滚]→settle→observe→complete_switch·watchdog 只观测不驱动]/
  观测链[appsink→HEALTH_ARCS→PipelineHealth·桥=tap probe=全 adapter
  层唯一 probe]/GStreamer 高层 API 全仓零存量; 盒上 GStreamer 1.28.2
  实证=input-selector 零时间戳改写[drop-backwards=丢帧藏证禁入方案·
  sync-streams/sync-mode 行为面·pad 级 running-time 可读]/intersrc
  do-timestamp=false 原始终戳透传=双时钟域直通机制根源/**identity
  single-segment 真实存在**[eat segments appear as one segment=方案
  B 现成 primitive·精确数学留 sim 实验锚定]; gstreamer-0.23.7 crate
  实证=event::Segment::new+SegmentBuilder[crate event.rs:778/:2493]/
  Pad::send_event[pad.rs:369]/Element::send_event[element.rs:138]/
  PadProbeInfo::buffer_mut[pad.rs:68=in-probe PTS 重写可行]/
  EVENT_DOWNSTREAM probe; 十项逐项现状锚+候选+**OQ-IMP-1..7 待裁**
  [1 normalize 删 vs Policy+wire/2 timeline 入 adapter 路径/3 执行点
  组合须 sim 实验裁/4 evidence 读出面/5 adapter 微观序实验裁/6 失败
  三结局谓词/7 L4 新谓词]; 最小变更面候选 9 行[新 program_timeline.rs
  纯 Domain+contracts/switch 契约扩展+program_execution 挂点+
  switch_graph 执行面+pipeline.rs 字段处置+dual_input L4 谓词+bin
  接线+tests·controller MediaTap/watchdog/supervisor/resolver 零触碰];
  执行序=裁纯设计项+授权 sim 实验刀→Domain→契约+Mock→Adapter→Gate
  升级→真机复跑 §29.2]——待用户裁 OQ-IMP 后冻结最小变更面进实现**
  ; **第三十轮=OQ-IMP-1..7 裁决+SIM-01 实验刀完成（设计探针 §13+主账
  §38+SIM-01 报告, 落账零生产代码）: 5 ADOPT——IMP-1 normalize→
  TimelinePolicy[SourceNative/ProgramTimelineMapped·删 normalize 语义·
  禁含糊 bool]/IMP-2 走现有 Plan/materialization 链[禁新 Timeline
  trait/Port/SPI·ProgramEpoch authority 永在 ProgramExecutionRuntime/
  TimelineAuthority]/IMP-4 TimelineEvidence=Adapter 装配+Runtime 独立
  读取[禁塞 PipelineHealth·evidence 非 authority 禁自动接受]/IMP-6
  失败三结局 Preserve/NewEpoch/FailClosed[continuity 不可证→epoch++·
  禁硬接 PTS=R2 绝对禁区·禁第四种猜测成功]/IMP-7 L4-TIMELINE=Timeline
  Mapping Evidence 七合取[TimelineTransitionEvidence 结构·'B 是否按
  声明 SourceSegment 映射合法进入同一 Program Timeline 且 V/A 双连续
  成立']; IMP-3/IMP-5 授权 sim 实验; **SIM-01 已执行**[2026-09-04-
  c-timeline-01-sim-01-experiment.md·9 变体 2583 行·盒 ~/ct-sim-01
  sha256 归档·工程不入库]: F1 inter 桥按接收墙钟重定基=200ms 生产者
  基差跨桥后仅剩 0.1-0.3ms 相位差[真机 8-10ms 同源·NonMonotonic=相位
  回退]/F2 翻 active-pad 自然转发 stream-start(B)→caps→segment(B) 到
  appsink=免费边界标记/**F3 identity single-segment 只吃段不修 PTS
  [appsink 单 segment 但 PTS 回退 −0.155ms]=吞段假阳性实证 禁作机制
  或证明面**/**F4 控制线程 Pad::send_event(Segment) 两序均被拒**/
  **F5 selector 后 per-plane BUFFER probe+Domain 声明映射[anchor−
  B_anchor offset]=完整可行[vd-pre backward=0·B 首帧精确落 anchor=
  A 末帧+40ms·121/121 节拍规整·aud-map 162/162=V/A 双平面独立]**/
  F6 微观序 pre-flip 安装结构性无竞态[规范序候选]·post-flip ~1ms 赢
  竞态[窗口真实窄]+**附带发现 set_property 后立即 readback=旧值
  sink_0 9/9 而流已切→'已执行'证明禁立即 readback 生效边界=下一
  缓冲**/F7 基线复现生产 L4 签名[实验有效性锚]; 顺带发现 gstreamer-rs
  0.23 无公开 parse_launch[auto/functions crate-private·生产程序化构链
  不受影响]; IMP-3/IMP-5 候选结论待终裁[执行点=selector 后 per-plane
  probe 声明映射+F2 自然段边界·序=取锚→声明映射→pre-flip 安装→翻
  pad→生效边界=下一缓冲→Observed 走帧/事件序列]→冻结最小变更面→正式
  实现批次; 实验禁改清单全守[normalize/PipelineHealth/L4/SwitchGraph
  正式逻辑/Production graph 零触碰]**
  ; **第三十一轮=IMP-3/IMP-5 终裁+IMP-2 实现层纠偏+最小实现批次开工（设计
  探针 §14+主账 §39, 终裁落账零代码 commit 先行）: IMP 最终表=IMP-1 ADOPT
  [normalize 删·TimelinePolicy 取代]/IMP-2 ADOPT WITH CORRECTION[
  PipelinePlan=ingest 只承载声明·Program Timeline 走 ProgramExecution
  Runtime→TimelineAuthority→ProgramTimelinePlan→Adapter·实锚
  build_program_pipeline 不消费 PipelinePlan]/IMP-3 ADOPT[selector 后
  per-plane EVENT+BUFFER probe·selector 前不能证 Program 侧事实·identity
  =吞段假阳性禁 proof·F4 精确表述=控制线程外部注入 sent=false 非主注入
  机制]/IMP-4 ADOPT[ProgramExecutionObservation{program,timeline}=observe
  () 单一 observation surface 最小演进]/IMP-5 ADOPT[①-⑩ 微观序冻结·
  生效边界='事件确认+下一 Buffer'·active-pad readback 只能辅助·
  SwitchExecuted≠TimelineTransition complete]/IMP-6 ADOPT[Preserve=epoch
  N 保持·NewEpoch=N→N+1·FailClosed=failed 不得当 Stable]/IMP-7 ADOPT[
  L4=九项合取 TimelineTransition proof 非 PTS monotonicity test];
  PtsMonotonicity 升级四态+DiscontinuityDeclared[禁洗状态]; recover 本
  change 不碰[A2-8-03]; SwitchGraph 侧=adapter TimelineExecutionState 每
  plane 独立+共享 program_epoch[非 Authority]; source identity=声明+
  Event+Buffer 三件闭合禁瞬时 readback; V/A 双 mapping 独立共享 epoch;
  排除清单照录[SessionManager/Resolver/PortRegistry/ResourceRegistry/
  Supervisor/MediaBackend::recover/MediaTap/C1/switch correctness/
  1080i-1080p]; **SIM-01 足够无需二轮实验·Batch 1 Domain+contract+Mock
  开工→Batch 2 GStreamer Adapter+L4→真机复跑**; 实现纪律=Authority 声明
  +downstream Event/Buffer 证据+Runtime 闭合 TimelineMapped; 披露三项[
  observe() 契约演进机械波及 watchdog/registry/dual_input .program 路径
  ·epoch 口径按 §十一 实现[Preserve 保持·与 Freeze §3 字面差异已披露]
  ·install 路径=既有 trait 最小方法默认 fail-closed[GStreamer 实装=
  Batch 2]]**; **第三十一轮 Batch 1 已落地（设计探针 §15, 生产代码 commit）:
  program_timeline.rs 纯 Domain 全量[SourceSegment declare=anchor−anchor·
  TimelineAuthority ①-⑩ 状态机·三结局 Preserve=epoch 不变/NewEpoch=rebase
  不改 PTS/FailClosed 终态·四态·§8 恰十键 wire 锁·timeline_rt_01 ×12]+
  pipeline.rs[TimelinePolicy 取代 normalize 8 构造位·PtsMonotonicity
  +DiscontinuityDeclared 四态+declared 观测·既有 observe 语义零变化]+
  contracts/switch.rs[ProgramExecutionObservation{program,timeline}=observe
  () 单一组合面+install_timeline_transition 默认 fail-closed]+switch_mock
  [双模式出口 legacy 逐字节保持+映射后源流 F5 同构+边界 tick 无缓冲 F6
  同构+pre-flip 安装联动+switch_rt_02 ×3 含 Authority 全链 Preserve 闭环]+
  机械适配[watchdog 1/registry 2/dual_input 恰 7 绑定行 L4 判据零变化/
  switch_graph tests .program]+switch_graph observe=timeline no_evidence
  诚实边界[Batch 2 probe 前不伪造]; 盒矩阵 fmt OK·default **217**·mock
  **377**[+18 新测]·bmd+gst **236** 全过·clippy ×2 -D warnings PASS;
  Batch 2[switch_graph EVENT+BUFFER probe+TimelineExecutionState+GStreamer
  install+Runtime 挂 Authority+L4 九项合取+真机复跑]未动零越界**
  ; **第三十二轮=Batch 1 复核终裁 APPROVED+两前置+Batch 2 开工令（设计探针
  §16+主账 §40, 终裁落账零代码 commit 先行）: 四项成立[Domain/GStreamer
  分层·ExecutionGroup 零污染·observe 机械波及无隐藏语义扩散·GStreamer
  诚实缺席]+PipelinePlan 边界正式关闭不回头+SwitchExecution 链零污染
  [on_switch_executed 禁成第二 switch state machine·两状态机经 plan/
  executed 关联各自拥有]; install=只做 Plan→TimelineExecutionState 安装
  禁'install 完=TimelineMapped'; offset 只能源于 Authority 声明 AnchorPair
  禁 probe 重算覆盖; V/A 双 selector 各挂一套 state/probes 禁 audio=video;
  PtsMonotonicity≠PlaneContinuity 不合并; video 单行载体仅限 wire/evidence
  serialization 禁 audio 降格; Mock≠GStreamer 证明[Batch 2=风险高峰];
  **两前置直接处理: ①BLOCKER-DOC Freeze §3 epoch 文本统一[Preserve=同
  世代不变·NewEpoch/Hard Recover=+1·switch_epoch=执行事件/segment_id=
  段世代/program_epoch=不连续时间线世代三职权分离——否则 ProgramEpoch
  退化成另一 switch counter] ②BLOCKER-IMPL no_evidence 消除虚假 epoch=0
  [携带当前已知 epoch·十键形状不改 Option]**; 三风险[P2 i64 差值算法·P1
  no_evidence·P1 段历史累积不覆盖 Batch 2 锁测试]; Batch 2 十四步顺序
  锁定[1 docs epoch 统一/2 no_evidence/3 TimelineExecutionState/4-5 V+A
  EVENT probe/6-7 V+A BUFFER mapping probe/8 GStreamer install/9 Runtime
  挂 Authority/10 orchestration ①-⑩/11 timeline 真证据装配/12 L4 九项
  合取/13 双轨回归/14 真机复跑仅矩阵绿后]; 禁做照录[Authority 不入
  SwitchGraph/set_active 不产 epoch/readback 不判生效/identity 不用/
  send_event 主路径不用/recover·Supervisor 不碰]; 02-I 保持
  FAIL-PENDING-CORRECTION**; **第三十二轮 Batch 2 已落地（设计探针 §17,
  十四步全执行）: ①Freeze §3 统一 59aec43[docs-only·三计数器职权分离]
  ②no_evidence(epoch) 修正+段历史只增不改锁测试 ③⑧switch_graph
  TimelineExecutionState+install 实装[pre-flip 联动+V/A 一致性·只安装]
  +switch 联动拒收/成功仅置 executed 不产 epoch ④-⑦attach_plane_probes
  [EVENT_DOWNSTREAM Segment 声明驱动身份+BUFFER 施加声明冻结 offset
  make_mut set_pts·无声明透传零改写 legacy 保持]+sink pad 分支观察探针
  [锚证据] ①契约 sample_switch_anchors[纯观测 fail-closed]+timeline_
  execution_facts[同一 trait 两证据方法默认 fail-closed/None] ⑨⑩Inner.
  timeline TimelineAuthority+switch_program ①-⑩[基准+锚→declare 唯一
  offset 点→install→begin/switch 失败 abort→轮询 facts→Authority 校验
  闭合·超时 EvidenceInsufficient FailClosed→settle 3 轮·停滞超时归故障
  面→confirm+complete_switch Observed 驱动·非第二 switch state machine]
  ⑪observe_execution[program=adapter 平面+timeline=Authority snapshot
  Domain SoT·adapter 行=执行侧原始证据双行分工] ⑫L4=rt.switch_program+
  九项合取[L4-SWITCH 语义保持∧Preserve∧declared==observed∧V/A
  Continuous∧无未声明回退∧epoch 一致∧mapped>pre∧出口≥边界帧]; 盒矩阵
  fmt/default 217/mock 381[+4]/bmd+gst **237[+1 含真实 GStreamer 全链
  timeline 测试=Simulation 形态真实探针 Runtime ①-⑩ 2.18s Preserve——
  SIM-01 F2/F5/F6 在生产 switch_graph 实证]**/clippy×2 全绿; gstreamer-rs
  实锚 make_mut 返回 &mut BufferRef 非 Result; 披露[三 trait 证据方法·
  双 timeline 行分工（NewEpoch 后 adapter 行滞后 Domain 真值→裁决面恒
  Domain]·锚公式 F5 同构·settle 停滞不 FailClosed]; ⑭真机复跑=§18;
  **⑭ 已执行（2026-09-04 22:15 CST, 设计探针 §18+主账 §41）: HEAD=3ff66ad
  已 push·bin 31e294f4·68/68 源 sha==HEAD·v5 当日复核 2/2 production_grade
  ·双卡 signal=true·证据=盒 ~/a2-8-02i-evidence/2026-09-04-2230-batch2-
  ctimeline（run.log sha 5758c42d）; **L1a-d/L2a/L2b/L3/Teardown 8/10
  PASS——L4=switch_ok true ∧ outcome=Preserved[真 DeckLink 双输入全链:
  offset 118799ns 相位级·Segment(B) 观测·首枚映射缓冲过证据校验·V/A
  双平面 Continuous·无未声明回退·epoch 保持 0·post-switch prog
  ValidMonotonic=A2-8-01 确定性 NonMonotonic 签名消失]**; L4 overall
  FAIL 单点=九项合取转写 `mapped>pre` 严格大于 vs 真机零隙拼接精确相等
  [冻结语义=非回退 ≥·锚公式结构性保证 mapped∈[pv,pv+delta] 恒不回退]
  =**B 类 Gate 判据转写·未改码待用户裁决（单字符 >→>=）→复跑预期 L4
  PASS+L5 首次真机注入**; ffmpeg decklink 打不开=观察事实非 gate 依赖;
  interlace 断言/pad_unlink 工件同历跑（隔离队列）; 02-I 仍
  FAIL-PENDING-CORRECTION（8/10）——性质迁移=架构缺口→验收判据单点
  转写**; **第三十三轮终裁（设计探针 §19+主账 §42, 断言实物核验后落账）:
  Batch 2 ✅ APPROVED[14 项关闭——三职权分立/①-⑩/SIM-01 一致/声明→冻结
  →buffer 三段闭合/F6/真机 Preserve=核心问题实际解决/双面分工/消费面/
  Teardown-Recover 零污染]; L4 `>`→`>=` 正式批准[B 类 Gate-only 单字符·
  禁趁机重写其余八项·冻结语义非回退=≥·零隙拼接 equal≠backward]; **NewEpoch
  rebase 缺陷登记 P1[program_timeline.rs:682-688 rebase 沿用旧 plan
  offset 未按新 boundary 重算——不变量 new_segment.offset==
  program_start_pts−source_start_pts·回归四条=Preserve/NewEpoch/A→B→A
  history/append-only·不阻断本轮·C-TIMELINE-01 Final Close 前必修·不混入
  本次小修]+on_mapped_buffer 先行 DiscontinuityDeclared[616 先于连续性
  判定]=NewEpoch 修复时锁回归**; 令=修正后立即真机复跑·H1 开 L5 完整
  真实证据必拿[A fail→B alive/recover A→bridge real flow/B fail→A alive/
  failure-domain classification]; L5 全绿→02-I 具备正式收口评审条件**;
  **第三十三轮执行（设计探针 §20+主账 §43, commits b856a04+ d5059e2 fmt
  残留）: 盒矩阵 fmt/default 217/mock 381/bmd+gst 237/clippy×2 全绿·
  69/69 源 sha==HEAD·bin c0efdfad·v5 当日复核·证据=盒
  ~/a2-8-02i-evidence/2026-09-04-2340-l4fix-l5run（run.log sha 4616d680）;
  **L4 Timing/switch+timeline(A→B) 首次真机正式 PASS[九项合取全绿:
  Preserved epoch 0·映射闭合 6937849283+33301642==6971150925 逐 ns·V/A
  Continuous·declared==observed==SegmentId(1)·无未声明回退·mapped==pre_v
  再次精确相等（零隙拼接复现→>= 修正被真机证实必要且充分）·post prog≥
  mapped]**; **L5 首次真机执行（历史两跑均被 H1 跳过）FAIL=C 类候选留证
  未改码: L5.1 A-fail→B-alive=true 真机成立; L5.2 单一根因=stop/recover
  契约结构性冲突[MediaBackend::stop=终态注销（P0-2 防句柄泄漏·
  controller.rs:314-331）vs recover 第一步 instances.get 取 plan
  （controller.rs:220-227）——stop→recover 生产必败]; Mock stop/recover 均
  no-op Ok+L5 序列仅真机 gate 执行=Mock≠GStreamer 预警在 recover 契约面
  成真; L5.3/L5.4/Teardown session_stop=false 全为级联（Teardown 本体无
  独立缺陷）; 候选方向三选一待裁[L5 注入面改造/Session 层
  recover-from-plan/recover 语义归属 A2-8-03 supervision 面]; 红线=
  MediaBackend::recover 不改+stop 注销语义不可反转; 新工件=Bus watch
  MainContext already-acquired WARN（隔离队列）; 02-I 仍
  FAIL-PENDING-CORRECTION（8/10; 失败集迁移 {L4,L5-skip}→{L5,
  Teardown-级联}）**; **第三十四轮终裁（主账 §44+设计探针 §21 跨账,
  断言实物核验后落账——五断言全证实[watchdog.rs:212-233 生产恢复链/
  session.rs:193 SessionInput 恰两字段/controller.rs:217-299 同 handle
  原 plan 重建/mock.rs:129-134+228 no-op+bridge_stall 钩子/registry.rs
  :162-199 bundle 三 view 单构造]）: **方案 1 正式批准——A2-8-02-I —
  Diagnostic Runtime Fault Injection**[注入'运行故障'非'生命周期终止':
  真实执行面停流·handle+HEALTH_ARCS 保持登记·recover=生产行为同 handle
  原 plan 重建; 被证伪的是注入方式非生产恢复链]; 落点=GStreamerPipeline
  Controller **第四 trait view**（F-01 同源原则·禁入冻结 SPI·禁 Session/
  Supervisor 侧）; 方案 2 暂不批准[Session 无 plan 持久引用, 真做=Session
  重构修 Gate 错误]; 方案 3 不作替代[生产恢复链实存, 推迟=伪装未来功能];
  定性: recover 本体无阻断·stop→recover=非法组合·Teardown 本体 PASS=
  L5 注入级联不单独开缺陷; 红线七条[recover/stop 不改·Session 不换
  handle·Supervisor 不注入·SPI 不加·recover 不推 03·Timeline 不混修];
  第一版禁 Bus Error 合成事件[Observation Fact≠Synthetic Event]须作用
  实际执行面; Mock 禁假装真实 registry[bundle mock 分支 diagnostic=None];
  02-I 收口条件=13 项全 PASS→Final Close Review**; **第三十四轮执行
  （主账 §45+设计探针 §22 跨账, commits 374f5c0 账+bb1360c 实现）:
  交付=contracts/diagnostic.rs 新契约面[DiagnosticFaultInjection 单方法
  inject_runtime_stall·仅诊断·禁入冻结 SPI]+controller 第四 view
  [gstreamer-backend cfg·set_state(Paused) 真实执行面停流·instances/
  HEALTH_ARCS 登记保持·不合成 Bus Error]+MediaAdapterBundle 第四字段
  [同源第四 clone·mock 分支=None 诚实缺席]+gate L5 5.1/5.3 stop→
  inject_stall[观察仍唯一裁判·注入失败只打证据行]; diagnostic_rt×3
  [结构: 注入后 instances 保持+recover Ok/行为: self_test 真元素帧冻结
  →recover 复流/fail-closed: stop 后注入拒收]; 矩阵 fmt/default 217/
  mock 381/bmd+gst 240[+3]/clippy×2 全绿·70/70 sha==HEAD·bin 7e665e3b;
  **真机复跑（09-05 00:19 CST, 证据盒 ~/a2-8-02i-evidence/2026-09-05-
  0020-r34-diag-inject, run.log sha 83017553）: 9/10 历史最高——
  L4 PASS 连续第三次[Preserve·映射逐 ns 闭合·offset 452126ns·V/A
  Continuous·epoch 0]; **L5.1 PASS[注入=真实运行故障: inputA 停·
  bridgeB 活·program 走]+L5.2 PASS 首次真机[recovered=true·bridgeA
  复活·degraded=false·recover tap 簿记重放成功 handle=1——33 轮 C 类
  stop→recover 结构性缺口经方案 1 真机闭环】+L5.3 PASS[bridgeB 死·
  bridgeA 活]+Teardown PASS[session_stop=true·handle 全程在册=级联
  彻底消失】; 唯 L5.4 FAIL=B 类候选留证未改码[A行=None 期望 Program·
  B行=Input✓——根因=下游集料排空 runway（默认 queue≈200 buffers≈8s@
  25fps+inter 缓冲）与采样窗[B 注入后 8-11s]物理重叠·program 帧计数
  仍在增长→classify(true,true,true)=None 全健康臂=语义正确; 候选待裁:
  ①drain-wait 加长/采样推后 ≥12-15s ②相对注入时刻锚定 ③queue 水位
  读取=不推荐过度工程]**; 02-I 收口清单 14 项中 13 PASS 唯 L5.4 待裁;
  工件: interlace 断言同历跑·pad_unlink ×4 间歇复现·MainContext WARN
  同 recover 新管线建立（隔离队列）**; **第三十五轮（主账 §46+设计探针
  §23 跨账）: L5.4 终裁=方案②「相对故障注入时刻锚定」正式批准**
  [Fault t0→Drain Grace→q1→固定 GAP→q2 时序语义冻结·grace 成 Gate
  显式观测窗口参数 L5_PROGRAM_DRAIN_GRACE·wait_until 锚定非流水 sleep;
  方案① 12-15s 机械加长=不采纳为正式方案·方案③ queue 水位=不批准
  （FailureDomain 封闭四词表不扩）; classify (true,true,true)→None 语义
  冻结禁改; 裁决五项代码主张全实锚证实[classify 优先序 :186-199/L5.4
  现流 :785-808/双 queue 默认容量 :397·441/appsink sync·async=false
  :399-400·443-444/session hook 先于 Input Stop 且失败不截断 :782-798];
  执行边界=只改 gates/dual_input.rs·禁改九面[program_execution/
  diagnostic/controller/switch_graph/session/backend/program_timeline/
  Supervisor/SPI]; 后续序=修改→fmt→矩阵→bin rebuild→真机→核对 14/14→
  NewEpoch P1 独立刀→Final Close→A2-8-05 archive; grace 初值 15s=实测
  下界 t0+11s 仍推进+余量·不足则证据回裁; 隔离队列维持[pad_unlink ×4/
  MainContext WARN 不顺手修]]**; **执行（主账 §47+设计探针 §24）:
  3c0b2af 单文件 +18 行**[L5_PROGRAM_DRAIN_GRACE 15s 常量+5.3 t0 锚点+
  5.4 q1 前 wait_until 剩余等待·q1/GAP/q2/classify 判据零变化·禁改九面
  零触碰]; 盒矩阵 fmt 绿/default 217/mock 381/bmd+gst 240/clippy×2 绿·
  bin baf5f895·sha 80/81 唯 DIFF=Cargo.lock[盒 cargo v4 重写·Cargo.toml==
  HEAD·历史清单不含 lock·非本轮引入·披露]; **真机复跑（09-05 00:47 CST,
  证据盒 2026-09-05-0047-r35-l54-anchor, run.log sha 23a5f860）: 9/10
  复现——L4 PASS 连续第四次[Preserve·epoch 0·offset 130924ns 逐 ns
  6969781703+130924==6969912627·V/A Continuous·无未声明回退]; L5.1/5.2/
  5.3 PASS[recover(A) handle=1 tap 重放成功]; Teardown PASS; **唯 L5.4
  FAIL: runway 新下界 >18s**[t0+15..18 仍推进·时间线闭合 q1=t0+15.0/
  q2=t0+18.0/recover(B) handle=2 重放成功 00:48:01.147/Teardown 00:48:
  04.149——锚定机制精确执行; 机制实锚=inter sink 在输入管线内 tee 挂接
  controller.rs:645-666·B Paused 冻结属实·余流=inter shm 积压·容量由
  inter 插件内部语义决定仓库代码不可见; 与固定大积压或"积压≈冻结前
  B 生产窗（本跑 ~25.5s）"两假设均相容; 候选待裁 ①grace 15→30s
  ②①+q1/q2 帧计数 print（观测性一行·推荐）③eventually-stalled-deadline
  语义升级]**; 14 项中 13 PASS 维持; 工件 converter×6 间歇/pad_unlink×4/
  MainContext×2 隔离队列]**; **第三十六轮（主账 §48+设计探针 §25
  跨账）: L5.4 终裁=方案③「有界 eventual-stall」正式批准——三阶段
  观测器冻结**[Phase A 输入故障确认（现有 5.3 不变）→Phase B 最小排空
  grace（t0 锚定保留·第三十六轮真机时间线闭合已证精确）→Phase C 连续
  N=L5_PROGRAM_STALL_CONFIRM_ROUNDS 窗无增长=StalledConfirmed·t0+
  L5_PROGRAM_STALL_DEADLINE 仍未确认=StillAdvancingAtDeadline=FAIL/
  TIMEOUT·帧计数簿记回退=ObservationInvalid——结束原因三词表进
  evidence 禁静默超时; ①grace 15→30s ❌ 禁盲调（>11/>18s 只是下界
  非定值·经验 tuning≠failure-domain verification）②grace+帧计数
  print ❌ 已不足; classify (true,true,true)→None 与 FailureDomain
  封闭四词表冻结·Bridge liveness 与 Program 推进证据模型分离维持·
  queue 水位维持 ❌; 裁决六项代码主张全实锚[现行锚定链 dual_input.rs:
  793-827/Program Graph 拓扑 switch_graph.rs:397·399-400·441·443-444
  （3ff66ad 后未变）/classify program_execution.rs:186-200/session
  teardown :782-798（efc1b2a 后未变）/bridge liveness 分层 :131-143/
  诊断注入 controller 第四 view（bb1360c 后未变）]; 执行=只改 gates/
  dual_input.rs·三常量[GRACE 15s 维持不调参·ROUNDS=3 配 SAMPLE_GAP=3
  ⇒ 9s 确认窗·DEADLINE=60s=验证期限非通过常数]+循环+evidence·判据
  表达式零变化·禁改九面维持[program_execution/diagnostic/controller/
  switch_graph/session/backend/program_timeline/Supervisor/SPI];
  后续序=修改→fmt→矩阵→bin rebuild→真机→核对 14/14→NewEpoch P1
  独立刀→Final Close→A2-8-05 archive; 隔离队列维持[pad_unlink×4/
  MainContext WARN/interlace 断言]]**; **执行（主账 §49+设计探针 §26）:
  d7d4fc6 单文件 +68/−16**[三常量 GRACE 15s 维持/ROUNDS=3/DEADLINE=60s+
  三词表 outcome enum+Phase C 循环+evidence·判据表达式零变化·禁改九面
  零触碰]; 盒矩阵 fmt/default 217/mock 381/bmd+gst 240/clippy×2 绿·bin
  release 596a8bcc·sha 80/81 唯 Cargo.lock 既有; **真机两跑: run1
  （05:38, 1f0ea619）8/10=L4 首次 NewEpoch FAIL**[视频 mapped 6970509011<
  last 6970509012 1ns 级连续性竞态 :618-622/:658-679 触发→epoch 1·
  DeclaredDiscontinuity·无 undeclared jump·L5 H1 级联·C 类回裁三问
  (Preserve 声明保证 mapped≥last?/L4 接受良构 NewEpoch?/P1 排期)];
  **run2（05:40, ba2f1783）9/10=L5.4 观测器首执行 StillAdvancingAt
  Deadline @t0+60.0**[L4 Preserve 第五次·15/15 窗全速 30fps·停滞从未
  发生·**排空假设被定量否定**（B 预冻结生产窗 ~27s≪60s·shm 积压秒级
  撑不住）→领先假设=活跃输入死后程序仍被另一活输入全速 feeding=隔离
  前提待裁·R34>11s/R35>18s runway 解释追溯否定·回裁四选（推荐①观测
  归因探针:L5.4 期间 program PTS 与 A/B 源 PTS 对齐）]; 14/14 未达·
  02-I 维持 FAIL-PENDING-CORRECTION[run2 13/14 唯 L5.4+L4 NewEpoch
  间歇 1/5 并列未决]·零后续改码·双证归档**]**; **第三十七轮后即时诊断
  （用户拍板"截图比对", 主账 §50+设计探针 §27, 零仓库代码）:
  intervideosrc 断粮自造帧=插件级实锤**[E1 跨进程占位帧 320×240 暴露
  合成+inter=进程内通道实证/E2 无写入器 1080p 24 帧全同 md5/E3 真流
  6s→断流 23+s 恒 md5 连续不停/E4 Gate 同款 Paused 25s 全程每帧全同
  →恢复即真帧]; **L5.4 前提"活跃输入死⇒program 停"在 inter 拓扑
  结构性不可满足=待裁三选[①去 inter 化②活性信号换面（bridge
  liveness 已证诚实·与"不合并"旧裁构成再裁）③语义重定义]+L4
  NewEpoch 1ns 竞态并列**; R34/R35 runway 解释终修为合成非排空·
  §49.3"A 喂出口"假设证伪; 证据=盒 ~/vbmfp-r36+本地三截图]**]**; **第三
  十七轮（主账 §51+设计探针 §28, 双段裁决）: L5.4 正式重定义「故障域
  归因完整性」+R36 观测器撤销**[第一段@6759443: ①归因探针最高优先/
  deadline 非严格有界发现[sleep 越界+stall 先于 deadline·随撤销 moot]/
  L4 Preserve-only 冻结❌Preserve∨NewEpoch/P1-A 根因确认=连续性基准用
  动态 last_program_pts"用未来观测值判当前边界"/P1-B 代码直证/依赖图
  无 ownership 冲突; 第二段@6400639 终裁: **选③重定义**——①去 inter
  现在不批准[inter=带 starvation fallback 语义的桥≠错误架构·未来开
  PROGRAM-BRIDGE-TRANSPORT-SEMANTICS]②bridge_liveness 与 program_
  progress 合并维持 ❌[三事实分层不变]③L5.4=B input 不推进∧B bridge
  死∧A input 推进∧A bridge 活∧Program 输出非权威证据⇒A 行=None∧
  B 行=Input⇒PASS; 真 Program 域故障归 A2-8-03[注入在 03 设计禁塞
  DiagnosticFaultInjection]; **删除 grace/deadline/eventual-stall
  全套**; d7d4fc6=R36 实验实现保留历史·R37=semantic correction];
  裁决五项代码主张全实锚[Phase C 循环序/ProgramObservation :57-73/
  on_program_pts :768 动态基准/L4 match 单臂 :685-686/intervideosrc
  官方 timeout 1s 黑帧]; 执行=只改 gates/dual_input.rs[撤销观测器+
  5.4 归因完整性重写+5.3 陈旧注释修正]·classify/四词表/L4 判据/
  5.1-5.3/Diagnostic 契约全冻结; 后续序=修改→fmt→矩阵→bin→真机→
  14/14[10/10 亦不触发 Final Close——两 P1 未闭·A2-8-05 暂缓];
  **P1-A[冻结 transition boundary 替代动态 last_program_pts]+P1-B
  [rebase offset 不变量]=下一独立刀 program_timeline.rs 不混 commit·
  修后 L4 真机目标稳定 Preserve]**]**; **执行（主账 §52+设计探针 §29）:
  0d59ddb 单文件 +37/−82**[观测器撤销 grep 零残留+5.4 归因完整性重写+
  5.3 注释修正·classify/四词表/L4 判据/5.1-5.3/Diagnostic 契约零触碰];
  盒矩阵 fmt/217/381/240/clippy×2 绿·bin release 6e02ba57·sha 80/81
  唯 Cargo.lock 既有; **真机 09-05 06:38（证据盒 0638-r37-l54-
  attribution, run.log sha c1c296a6, EXIT=0, ~46s）: 10/10 ALL PASS
  02-I 历史首次**——L4 Preserve 连续第六次[epoch 0·offset 174161ns·
  6970673376+174161==6970847537 逐 ns·V/A Continuous]; **L5.4 新语义
  首跑 PASS**[A行=None B行=Input·Program 输出 advancing=true[合成帧]
  如实记录为非权威证据 v 1053->1143 a 1405->1525]; Teardown PASS;
  **14/14 达成但 Final Close 不触发**[两 P1 未闭·C-TIMELINE Final
  Close 暂缓·A2-8-05 暂缓]; 下一刀=P1-A[冻结 transition boundary 替代
  动态 last_program_pts]+P1-B[rebase offset 不变量]独立修→L4 复跑
  目标稳定 Preserve[当前 6 跑 5P+1NE]; 工件 interlace×6/pad_unlink×4/
  MainContext×2 隔离队列]**]**; **第三十八轮（主账 §53+设计探针 §30,
  核验+测试增强·生产代码零改动）: P1-B 正式撤销核验成立+P1-A 批准但
  实现期偏离回裁**[P1-B: on_mapped_buffer :597-606 映射校验先证
  boundary.1−boundary.0==seg.offset ⇒ NewEpoch rebase :682-691 沿用
  offset 不变量自动成立——R33 登记表述修正"测试不足非代码缺陷";
  P1-A 真问题维持（:618-622 动态基准+on_program_pts :768）; **偏离
  发现: sample_switch_anchors :852-867 双锚各加独立测量节拍 ⇒ 四跑
  program_start−mapped≡33,333,333ns 恒一帧 ⇒ 字面谓词 mapped≥
  program_start 将使一切健康 Preserve 跑翻 NewEpoch; ±1ns 竞态根源=
  双节拍测量差非 last_program_pts 推进; 方案 α=锚去节拍[switch_graph
  ·需扩授权·推荐·mapped==boundary 精确相等世界]/β=Domain 冻结基准+
  slack 魔数——待裁**; 交付=timeline_rt_01_new_epoch_rebase_offset_
  invariant[双平面 offset==program_start−source_start+NewEpoch 平面
  DiscontinuityDeclared 不洗·offset=i64 跨域可负·mock 车道 cfg]; 矩阵
  default 217 不变/mock 382/bmd+gst 240 不变/clippy×3; 真机无
  生产变更不复跑]**]**; **第三十九轮（主账 §54+设计探针 §31, 裁决
  落账零代码）: P1-A=方案 α「边界帧锚修正」批准·β 否决**[α:
  sample_switch_anchors 双锚去 saturating_add(节拍)——program_anchor=
  pv·source_anchor=target_v 原值（audio 同构）; 修改面=switch_graph.rs
  单函数+回归测试+注释+program_timeline.rs AnchorPair 注释语义统一
  （注释级）; 健康切换 mapped==program_start 精确相等+±1ns 竞态结构性
  根除; β=slack 魔数吸收非消除+吞真实 discontinuity 否决; P1-A 重定义
  =「已观测边界帧做未来一节拍外推致 program_start 与首枚 target buffer
  不在同一离散帧边界」; P1-B 维持撤销+不变量测试保留; last_delta 解耦=
  observation fact（allow(dead_code) 保留禁删）≠ declaration input;
  R39 回归项 1-4 被 α 取代（Domain 零改）/项 5 已交付/项 6-7 既有
  覆盖; 新回归锁=last_delta 不得改变声明 anchor（裁决例值）; 披露=
  switch_mock.rs:297-306 同 +STEP 外推——Mock 同构面同步与否独立待裁
  不阻塞; on_mapped_buffer/close_transition/declare/Runtime 编排链
  零改; 真机七项验收重点见主账 §54.2]**]**; **同轮实现+真机（5d61b97,
  主账 §55+设计探针 §32）: α 落地——锚=原值+rt_03 回归锁+AnchorPair
  注释统一; 矩阵 default 217/mock 382/bmd+gst 241(+1)/clippy×3/sha
  80/80/bin 83b9b695; 真机 ×2 EXIT=0 10/10——L4 Preserve epoch 0·
  **mapped==program_start 首次精确相等**（run1 6,973,081,228/offset
  14,415ns·run2 6,969,530,558/offset 53,969ns·历跑恒差一帧消失）·
  V/A Continuous·±1ns 条件性 NewEpoch 根除实证（5P+1NE→双 P）·L5.4
  归因 PASS·Teardown PASS; 证据 ~/a2-8-02i-evidence/2026-09-05-r40-
  anchor-fix/{run.log a67ef58a·run2.log be80906f}; **P1-A CLOSED**;
  02-I=10/10 第二次; Final Close/A2-8-05 待裁]**]**; **第四十一轮
  （主账 §56+设计探针 §33, 终裁落账零代码）: R40 复核 PASS·
  **C-TIMELINE-01/P1-A Final Close=APPROVED/CLOSED**[措辞限定: 专项
  Close≠A2-8 CLOSED——P1-B=REVOKED/CLOSED-AS-NON-ISSUE 不变量保留·
  Evidence/Hardware=PASS×2·R1-R8 未触碰·偏离回裁链闭合]; A2-8 总体
  OPEN·顺序 03→04→05 维持·A2-8-05 仅准备不可收口; **Mock +STEP 分叉
  正式立项 MOCK-ANCHOR-SEMANTIC-ALIGNMENT**[switch_mock.rs:299-306 vs
  观测原值 adapter·不回溯不阻塞·修复待独立裁决]; 下一刀=A2-8-03
  failure/supervision[探针先行·开工前须 SoT Probe/裁决授权·本轮
  未启动]**
- [ ] 5. A2-8-03 failure/supervision 验证: watchdog 四视角观测穿
  RuntimeEvent→Custody 无跨设备污染 + Supervisor 边界（recovery only）
  `Contract: 02` | `Implementation: 待` | `Verification: 待` | `Gate: 待`
  **[第四十二轮（主账 §57, 裁决落账零代码）: A2-8-03 批准开工·第一步
  =SoT Probe 仅探针零代码——不重造 watchdog/liveness/FailureDomain
  （代码现实已在册: watchdog 三件套+Bridge liveness+progress_since+
  FailureDomain+SupervisorAction 封闭）; 硬红线=Supervisor 禁 switch()/
  begin_switch(); 核验扩面发现=契约注释漂移两处[contracts/switch.rs:
  91-92+switch_mock.rs:271-273 同源"位置+步长"]正式登记 CONTRACT-
  ANCHOR-DOC-SYNC 下一次文档/契约同步轮处理禁留归档]**;
  **同轮 Probe 交付（A2-8-03-00 SoT Probe=
  2026-09-05-a2-8-03-00-failure-supervision-sot-probe.md 十二问全锚+
  红线核验[Supervisor 禁 switch/begin_switch 零存在·四层证据]+缺口
  G-1 事件→Custody 生产链未闭合[custody.rs:119-123 零生产调用者]/
  G-2 分类器三列观测 gate-only 无 runtime 常驻消费/G-3 Program 域故障
  无恢复 lifecycle[dual_input.rs:821-822 显式预留·受 Freeze'Recover
  语义冻结'约束]/G-4 Mock recover 契约面; 不新造清单在册; 下一刀=
  03-01 待用户对 Probe 裁决后授权]**
  **[第四十三轮（主账 §58, 裁决落账零代码）: R42=PASS 收紧表述[Probe/
  ledger round·no runtime implementation authorized or introduced];
  **实施序正式冻结=G-1→G-2→Failure Attribution→Recovery Contract→
  G-3→G-4 依赖 DAG 禁并列开工**; 授权 03-01 第一阶段=G-1 Identity/
  Custody+G-2 Runtime Consumption 设计/实现探针（已交付
  2026-09-05-a2-8-03-01-g1-g2-custody-consumption-design-probe.md:
  internal 平面多消费者竞争 drain 新事实[watchdog.rs:192/:537 共享
  world.internal_log 破坏性 drain——单一 drain 点假设不成立]+身份
  丢失机制根因[ingest→mapper 边界归零]+custody 双零生产调用+组
  watchdog 无 MediaTapPort 依赖+OQ-G1-1..7/OQ-G2-1..6 十三问待裁];
  G-3 暂不授权; CONTRACT-ANCHOR-DOC-SYNC+Mock A/B 合并同一同步轮一次
  统一[用户倾向 B 非现在改·禁半同步中间态]; 五误区禁令落账[禁
  'Supervisor 已有⇒03 完成'等五句]; Mimosa 后置维持; 本轮零代码零
  矩阵——R40 runtime 证据继续 baseline; 本项保持未勾]**
  **[第四十四轮（主账 §59+03-01 探针 §8/§9, 裁决+实现落地）: R43=PASS
  [Probe/架构裁决轮]; R44 裁定=P0 两问直接裁[OQ-G1-1 身份语义=形式化
  设备身份承载·字段名不动·类型级修正留 V0.3/OQ-G1-2 拓扑=禁 custody
  第三 drain·「单一事实消费点+非破坏性 fan-out」新解]; 实施序收紧
  03-01-A..G→03-02→03-03→03-04; 授权=A/B/C+矩阵+binary gate; 新红线=
  [G-2 禁改 ProgramExecutionRuntime 切换逻辑/归因禁放宽 nil→NO
  ATTRIBUTION/EventLog 契约 FIFO·两级丢弃·计数·fail-closed 禁绕开/
  watchdog 重接线为周期驱动器]; **A/B/C 已落地 9 文件**: A=Supervisor.
  ingest 签名扩展携带设备身份[watchdog.rs:177 生产唯一调用点]+mapper
  携身份入口 map_upstream_for_device[词面零变化·trait 面 nil=未归属
  维持]/B=event_intake.rs InternalEventIntake 唯一生产 drain 实现
  [生产 internal 平面 drain 全仓普查仅一处·生产 watchdog 不再持
  internal log 类型级排他·bootstrap 共享单实例 BS-01]/C=consume 边界内
  observations_from_events 全量恰一次累积[A2-7 桥规则原样·零新增
  消费者·零 advance·快照调用点不加=OQ-G1-5 留 D/E/F]; +6 测试全绿;
  盒矩阵 fmt/default 223[217+6]/mock 388[382+6]/bmd+gst 247[241+6]/
  clippy×2/bin 全绿·盒源 9/9 sha8==本地; 行为变化披露两处[生产故障
  事件 nil→真实设备身份·fault_trigger 收敛为只触归属设备(nil 保守
  匹配维持)/watchdog 本地 fold 分区语义不变]; custody「双零生产调用」
  闭合其一, 归因/快照生产消费仍零[03-01-D/E/F 待授权]; 本项保持未勾
  ——A/B/C≠03-01 完成]**
  **[第四十五轮（主账 §60, 03-01 探针 §10, R44 复核裁决+G-2 stage-1 实现）:
  R44=PASS[A/B/C 实现轮]; 两措辞降级采信[①A=运行时身份修复≠类型语义锁死
  (PipelineFault.pipeline 双语义留 V0.3) ②B="类型级排他"→"组合根接线级唯一
  drain ownership"[internal_log 仍 pub, 注释已纠偏, 强类型封锁留治理轮]];
  **E 前提纠偏: FailureDomain 并非不存在**[program_execution.rs:179
  {None,Input,Bridge,Program}+classify_failure_domain 三列进度观测既有,
  消费=dual_input L5d gate-only=恰 03-00 G-2 缺口原文; §8.10 消费面
  master_join/api_boundary 预留]——依用户红线复用现有 contract 生产化,
  禁新造第二同名类型[SharedPipeline scope 与 FailureDomain 两族证据禁融合];
  授权 R45 全序 G-2-00→D→E→F→G 已执行: G-2-00 预检[report_failure 生产
  调用者恰 2/桥 liveness=bundle 第三 view 现成/bin composition 扩 4 元透传];
  D=assemble_decision_input 纯函数装配[attribute_failures 首个生产调用者,
  ingest/group 两 tick 同临界区; 空 custody→None=absence≠evidence];
  E=组 tick 三列生产喂入[fold advancing+桥 liveness view(窗口 3000 与 gate
  同值同义常量)+program_progress_since 两采样; 三列齐备才分类, 缺席不分类
  ≠gate L5d 缺席→false 口径差异披露]; F=report_failure(+domain,+attributed)
  决策输入面[Status 逐决策替换记录+只读访问器; **决策判定逻辑零变化**
  (无分支消费, 域→恢复策略选择=03-02); Custody→Supervisor→switch 禁式
  不可构造维持; 四红线全守]; 测试+5[证据记录/替换/读取 fail-closed/装配
  规则三列齐备缺席不分类空 custody 不归因]; 盒矩阵 fmt/default 224/mck
  390/bmd+gst 248/clippy×2/盒源 7/7 sha8 全绿[hw 门控闭包作用域 bug 盒上
  抓到修复=default/mock 不编译该段的分层实证]; **真机双 gate: session_
  lifecycle ALL PASS EXIT=0[ingest tick D/F 接线活体]+dual_input ALL PASS
  10/10 EXIT=0 零回归[L4 Preserved epoch0·L5d 归因完整; 基线校准: R36/R37
  已闭环 L5.4, R40 起 10/10]**; 证据盒 2026-09-05-r45-g2-decision-input/;
  披露: 组 watchdog tick 生产活体证据缺[唯一 spawn=bin:479, 编译级+分类器
  同源 L5d 真机复核, 活体留 A2-8-04 bin 轮]·G-2 PASS 不自宣待用户复核;
  本项保持未勾——D/E/F 落地≠03-01 完成[G-2 终审+组 tick 活体+03-02 待裁]]**
  **[第四十六轮（主账 §61, 03-01 探针 §11+03-02 新探针, R45 复核裁决
  G-2 Stage-1 PASS/G-2 Final OPEN + G-2-G 真机活体 + 03-02 设计提案零
  实现）: 开发线纪律=comet/a2-8-dual-input-switch@ff864d2 恒定
  [master=7745968 旧头禁混]; 单故障优先序分类器语义锁死重申; group
  custody batch group-wide+逐 action device-scoped attribution 双防线
  边界 03-02 沿用; **组 watchdog 真机活体已获得**: 活体观测行使能披露
  [健康路径原静默→两处仅诊断输出零决策逻辑观测行·矩阵 224/390/248 计数
  零变化]+生产 bin 双输入诊断会话 9.5min[fail-soft 纯分析零外推·bin
  ab361801·v5 manifest]——**线程连续 tick 0→1120（57 行）+双设备三列
  实时全健康+分类器真机活体 tick0=None→tick≥20=Some(None)**[证据盒
  2026-09-05-r46-g2g-group-watchdog-live]; 仍缺如实记档: 故障动作路径
  决策输入活体指纹=0[窗口零自然故障·ball 源勿杀·生产注入面 gate-only
  红线]——OQ-R4 待裁[证据组合关闭 G-2-G vs 自然故障长窗复跑]; 03-02
  Recovery Contract 设计冻结提案已交付[六面 F-1..F-6+OQ-R1..R5 待裁;
  提案默认=不新造 Strategy 词表+消费点=执行域读 last_decision_*+
  Supervisor 判定/词表零变化+OQ-R1 全维持现状零代码收口候选]; 本项
  保持未勾——G-2 Final/03-02 冻结/A2-8-04 专项均待裁待做]**
  **[第四十七轮（主账 §62, 03-01 探针 §12, R46 复核裁决+OQ-R4 关闭+
  G-2 Final CLOSE+03-02 命名纠偏; 零运行时代码零矩阵）: R46=PASS
  G-2-G LIVE EVIDENCE[12 行复核: 1-6/8-9/11-12 PASS·7 有条件[LIVE
  PASS/E2E 未触发]·10=DESIGN DELIVERED/FREEZE NOT YET COMPLETE];
  **OQ-R4=组合证据关闭**[Layer1 生产线程活体+Layer2 生产线程分类器活体
  +Layer3 gate L5d 真机注入分类; 长窗复跑=概率性证据非确定性软件证据;
  **Gate 分层记账: G-2-G-LIVE=PASS·G-2-G-CLASSIFY=PASS·G-2-G-FAULT=NOT
  OBSERVED 不阻塞·G-2-G-E2E=属 03-02/A2-8-04·LIVE 与 E2E 禁混**];
  **G-2 Final=CLOSED（R47）**·03-01-A..G 全 COMPLETE·03-01-G 收口注记
  [观测行=诊断零决策语义·E2E 触发证据随 03-02/A2-8-04 补齐]; **03-02
  命名纠偏: 设计探针/冻结提案[Design Probe / Freeze Proposal]·DESIGN
  DELIVERED/FREEZE NOT YET COMPLETE·禁称已冻结 Contract·文档标题/状态
  行已就地修正+§7 修正记录**; hygiene defer: "五面"→六面[F-1..F-6]于
  03-02 冻结时顺手修不单独提交; **纪律重申: 禁先写 Recovery 代码——先
  OQ-R1..R5 用户裁决→Contract Freeze→最小实现→matrix+真机→A2-8-04**;
  本项保持未勾——03-02/03-03[G-3]/03-04[G-4] 未做]**
  **[第四十八轮（主账 §63, 03-02 doc §8, R47 复核裁决登记+状态语言规则
  永久锁+OQ-R1..R5 冻结包; 零运行时代码零矩阵）: R47=PASS 无运行时代码
  越界[用户四层复核: 用户报告→GitHub 实际提交→当前分支状态→语义一致性;
  13 项全过除 F-1..F-6 六面计数 🟡 DEFER 维持+memory sync 🟡=自证项
  GitHub 不可独立验证（接受登记非阻塞）]; **状态语言规则（永久锁）**:
  G-2 Final=CLOSED 语义=G-2 自身 consumption/evidence/attribution/
  decision-input 闭环·**G-2-G-E2E 永久不入 G-2 Final**（属 03-02/A2-8-04
  未验证）·四层 Gate LIVE/CLASSIFY/FAULT 不阻塞/E2E 边界永久保持·禁说
  'G-2-G E2E=PASS'/'Recovery E2E=COMPLETE'/'03-02=FROZEN'（直至 OQ 裁决）;
  **§十五: 不再跑 R46/R47 活体——本轮彻底结束·唯一待裁=03-02
  OQ-R1..R5·用户维持推荐 OQ-R1=全维持现状**[FailureDomain 只作 evidence/
  attribution 不驱动新 Recovery Strategy 分支→03-02=零运行时代码 Contract
  close-out→直进 A2-8-04 Program Timeline/AV continuity]; 裁决完成前继续
  保持零 Recovery runtime code; 03-01 探针本轮不新增（R48 无 03-01 域
  新裁定·止于 §12——披露）; 本项保持未勾——03-02 冻结待 OQ 终裁/
  03-03[G-3]/03-04[G-4] 未做]**
  **[第四十九轮（主账 §64, 03-02 doc §9, OQ-R1..R5 终裁+03-02 Contract
  Freeze+六面统一; 零运行时代码零矩阵）: R48 复核=PASS 登记[远端 a6af188·
  master 7745968·无偷冻结无架构偷改]; **OQ-R1=案 A 全维持现状**[域=
  evidence/attribution/decision-input≠新 Strategy selector/restart 语义/
  escalation 词表·不新增 Recovery runtime code·"不是少做而是更严格保持
  边界"]+OQ-R2/R3/R5 接受+OQ-R4 已闭不重开; **03-02=CONTRACT FROZEN
  （R49）**[六面 F-1..F-6 冻结=既有行为+边界+"不新增语义"约束·零代码
  收口·无独立实现轮·F-5 消费点契约潜伏·Recovery code 状态语=NOT NEEDED];
  五面→六面一次性统一[非引用恰三处: 03-02 §3 标题/主账 §61 行/本文件
  R46 段·引用纠错原文保留]; "03-02=FROZEN" 表述解锁·E2E 两句仍禁;
  A2-8-04 SoT 探针同轮开启（独立第二单元）; 本项保持未勾——03-02 已
  冻结收口但 03-03[G-3 暂不授权]/03-04[G-4·Mock A/B DEFERRED] 未做]**
  **[第五十轮（主账 §65, 03-02 doc §10, R49 二层代码真相审计+OQ-R3
  措辞校准; 零运行时代码零矩阵）: R49 账面=PASS[R49 final=639b0f3·
  pre-flight a6af188 时间状态消歧]; **OQ-R1 案 A 代码证明级坐实**
  [report_failure 体 supervisor.rs:229-270 零 domain 条件分支·
  should_retry :93 无 FailureDomain 参·docstring :226-228"本轮无分支
  消费"]+OQ-R2/R4/R5 维持; **OQ-R3 措辞校准=预留消费边界非既存策略
  消费**[当前唯一消费=Supervisor 记录 decision evidence·读取面
  :203-210 零调用者=潜伏·domain→strategy=NOT USED/NOT NEEDED·禁表述
  "watchdog 已消费 FailureDomain 选择恢复策略"]; 03-02=CONTRACT
  FROZEN 状态不变; 本项保持未勾——03-03[G-3]/03-04[G-4] 未做]**
- [x] 6. A2-8-04 Program Timeline / AV continuity 验证（第三轮终裁更名）:
  六路 PTS before/after switch 无 rollback/discontinuity/divergence/
  starvation; Program Timeline Continuity / Timestamp Normalization 方案
  裁决与验证（observation only，无 Engine——方案设计裁决属 02/04）
  `Contract: 03` | `Implementation: 完成` | `Verification: 完成（R56 FAIL→R58 Step 11 冻结谓词重算·2026-09-06）` | `Gate: PASS / CLOSED（R59 验收终裁 2026-09-06·三 blocking cells Satisfied·终裁登记 R57 §23）`
  **[第四十九轮开启（A2-8-04 SoT 探针已交付:
  2026-09-05-a2-8-04-program-timeline-av-continuity-sot-probe.md, 零代码;
  R49 用户终裁"直接开 A2-8-04"授权）: 形态发现——"六路 PTS"=TimelineSample
  六 PTS 流[input/bridge/program×video/audio, program_execution.rs:66-77]
  ·六路已在 gate L4 同采只测量·现判据仅 L4-SWITCH+L4-TIMELINE（program
  video 主导九项合取）其余五路未判; 四失败模式映射——rollback=六路
  PtsMonotonicity 四态已在·discontinuity=DiscontinuityDeclared+program
  双平面 PlaneContinuity 已在·divergence 两语义未消歧[pad 分离=av_paired
  已检出 watchdog.rs:460/PTS 时序漂移=零观测面]·starvation=stalled+
  progress_since+alive_in_window 已在验收判据未定义; **OQ-T1..T6 待裁——
  裁决前零实现**[判据落点=提案默认新增独立验收节不触 L4 冻结判据/
  divergence 漂移首版只测量+分布取证/starvation 复用 progress_since/
  input-bridge 平面 continuity 必要性/合成谓词形状/与 C-TIMELINE-01
  冻结关系确认不重开]; observation only 无 Engine; 本项未勾]**
  **[第五十轮终裁（A2-8-04 探针 §7, 主账 §65.5; OQ-T1..T6 修订后
  冻结）: T1/T2/T6 接受[独立验收面·L4 冻结表面零改动/D1 pad 分离与
  D2 PTS 漂移分账·ns 可比性≠阈值授权/不重开四方案+新增实现↔Freeze
  一致性验证职责]; **T3/T4 拒原案修订后接受**[progress_since=聚合
  A/V"或"[program_execution.rs:160-174]不能证六路逐平面+生产 stalled
  恒 false[switch_graph.rs:936]→逐平面证据+观测先行·禁发明阈值禁立即
  实现; adapter 行 mapped→DiscontinuityDeclared+continuity 硬编码
  [switch_graph.rs:969-984]语义过宽=correctness 缺口登记→C-TIMELINE
  correctness change·**PtsMonotonicity 实为四态**[pipeline.rs:263-276,
  用户"三态"表述与代码不符如实登记]]; **T5 修订后冻结=六路×四模式
  证据矩阵**[PathEvidence×FailureMode·每格=证据 E 非布尔·absence≠
  false·禁预设合成大布尔]; **C-TIMELINE 状态校准**[design-freeze 文档
  §19 附录: 代码已存在 Batch 1/2+真机三连 PASS vs 冻结期"不进入实现"=
  时点状态·不回滚不重设计]; **缺口四项登记**[A 文档vs代码=已校准/B
  DiscontinuityDeclared 过宽=correctness 队列/C 六路 starvation 无逐
  平面生产证据/D 六路×四模式=数据结构非验收证明→A2-8-04 完成];
  Recovery 与 Timeline 两链正交性确认; **执行序=探针冻结→六路证据采集
  （observation only·最小观测面单独落地）→gaps→C-TIMELINE correctness
  change→A2-8-04 Gate·禁回头重复 R46-R49 旧活体验证**; 本项未勾]**
  **[第五十一轮（主账 §66, 04-探针 §8; R51 用户裁决=R50 PASS+OQ-R/T 全
  冻结确认+四态纠正[PtsMonotonicity 实为四态 pipeline.rs:263-276·真问题=
  adapter 生产使用语义过宽]+"直接开 Observation Unit 1·不做纯账面轮"）:
  **六路取证面落地 4d95ec6**[SixPathEvidence/PathEvidence/EvidencePhase+
  assemble_six_path_evidence 纯 join·逐路独立·absence≠false[advanced 三值]
  ·av_delta 只测量(T2)·帧计数原料全已在故契约零改; gate L4 判据输入捕获后
  PRE/SPAN/POST 观测节零判据零阈值·L4/Supervisor/contracts/watchdog/
  switch_graph 零触碰; +3 纯函数测试]; 盒矩阵全绿[fmt/default 227/mock
  393/bmd+gst 251/clippy×2; rt_01 flaky 中间跑留证复跑绿=既有债; gates bin
  重建须带 hardware features]; **真机 gate 全链 10/10 按账本首次全绿**
  [v5 当日核验 L1a 2/2+L1c 双 signal; Preserve offset=78120ns; L5 观测窗
  B 类候选不因单次 PASS 复案]; **六路首采**[PRE/SPAN/POST×{A,B} 全六路
  advanced=Some(true)+ValidMonotonic·SPAN 含被切离 A 路持续推进=跨切换
  starvation 未观测（单次）·**av_delta 7.15ms(pre)→15.48ms(post) 切换后
  翻倍=首个 D2 漂移实测点（只测量不设阈值）**·program 列整图共享];
  T6 一致性=adapter 行 Declared 过宽原样（Gap B 队列）vs L4 裁决消费
  Authority snapshot（正确）; 工件全为既有隔离债零新增; 证据盒
  2026-09-05-r51-a204-sixpath-observation; 本项未勾——T5 证据矩阵待多场景
  填充+验收谓词未定义+多场景采集继续]**
  **[第五十二轮执行（R52 多场景采集已落地, e843eba; 主账 §67+04 探针 §9）:
  新第七真机 env VBMF_A2_8_04_OBS（gates/a204_obs.rs）——N/DWELL 参数化
  交替 A↔B 多场景（dwell=0 连续切换/N 调大长窗）, 每切换 PRE 对/SPAN/POST
  对复用 R51 六路投影**零 Domain API 扩张·无判据无阈值·exit=采集完整性**;
  S5 format 行（caps=None 缺席如实）; 汇总=纯数据（pts_state 计数+adv 定位+
  av_delta 三相位序列）; 3 纯函数测试入硬件矩阵; dual_input/switch_graph/
  Supervisor/契约零触碰, Gap B 未修（R53）; 盒矩阵 fmt/227/393/254(+3)/
  clippy×2 全绿, sha 盒==HEAD; **真机四跑全 EXIT=0: 20 切换（6/10/4×
  dwell 5s/1s/0s）全 Preserved·av_epoch 1..N·ProgramEpoch(0) 全程保持=
  Preserve 多切换连续性真机首证; run2 pr_v NonMonotonic=16/60 闩锁首证
  （#8 B→A 边界 per-buffer 单次回退→无复位闩锁; pts 递增+帧推进+Authority
  Continuous 并存=R53 correctness 直接输入证据; pr_a 0/60; 20 样本 1 次
  概率性如实）; D2 av_delta 方向振荡（B 活跃 15.0-40.1ms/A 活跃 1.7-26.7ms
  无单调漂移, 候选=源内在 skew, 登记非裁决不设阈值）; run4 dual_input 回归
  10/10（判据面零扰动）**; T5 矩阵大面积正证据+pr_v 负格首证; 工件全为
  既有隔离债零新增; 证据盒 2026-09-05-r52-a204-multi-scenario; 本项未勾——
  R53 correctness 未做+验收谓词未定义]**
  **[第五十三轮执行（R53 Unit B 已落地, d1a4fc6; 主账 §68+04 探针 §10）:
  裁决=R52 PASS 直接落码, 范围严格仅 switch_graph.rs+测试（R53-1 修
  mapped→DiscontinuityDeclared 过宽 / R53-2 定义 NonMonotonic 生命周期 /
  R53-3 四锁+第五锁 / R53-4 全矩阵 / R53-5 真机; 禁 Supervisor/L4/Contract/
  Observation 反向入控制）; 两层缺陷分层确认[Gap B=行装配·零生产消费方;
  run2 闩锁=HEALTH_ARCS PipelineHealth·pipeline.rs 禁动——observe_*_
  pts_declared 预留 API 首个生产调用者]; 交付=MappedContinuation 段作用域
  状态机+plane_row_state 四态派生[mapped+续流=VM/Continuous 非 Declared·
  防御退化=Unknown/Unproven·边界帧=DD+DeclaredDiscontinuity·段内回退=NM+
  Violated·V/A 对称删硬编码]+note_declared_boundary 生命周期[干净边界
  段基准重开=上一段 NM 解除·闩锁不跨声明边界·违例边界 NM 传播不洗·段内
  普通帧不自动恢复]+apply_declared_mapping 可测抽出[passthrough 逐字节
  同语义·legacy 零变化]+五锁测试[rt_04×4+rt_05 生命周期五断言]; 盒矩阵
  fmt/227/393/**259**(+5)/clippy×2 全绿·sha 盒==HEAD; **真机四跑: obs 三
  场景 EXIT=0**[20 切换全 Preserved·ProgramEpoch(0) 保持·**pr_v/pr_a=
  DiscontinuityDeclared+VM2 边界事实首次显形**（此前被 VM 掩盖）·
  NonMonotonic=0·闩锁事件未复现如实记样本（解除路径 rt_05 单测锁定）]+
  **dual_input 10/10 第二轮**[L4 分层签名同帧: 程序面 DD+Authority
  Preserved/Continuous·九项合取零影响·L3 切前 VM=legacy 不变]; 登记:
  switch_mock 行为分歧留 mock-sync 轮+stalled:false 非本轮+S5 caps=None
  诚实保持; 证据盒 2026-09-05-r53-ctimeline-correctness; 本项未勾——T5
  矩阵续填+验收谓词定义+A2-8-04 Gate 待]**
  **[第五十四轮执行（R54 T5 矩阵续填+正式化已落地, 零代码; 主账 §69+04
  探针 §11）: 裁决=R53 Unit B PASS（用户终裁+独立复核 13 项全过——复核
  边界如实: 记录级交叉一致非重执行）, R54 范围=真机增量采集+矩阵正式化+
  交接验收层, 无新 OQ 无判据变化无阈值; 零代码确认=72/72 源 sha 本地↔盒
  全等+gates bin 重建 md5 与 R53 逐字节一致; 真机四跑（2026-09-05
  15:15-15:26 CST, 证据盒 2026-09-05-r54-a204-t5-matrix 五件套+四日志
  md5）: run1 N=30 dwell1000 EXIT=0[30/30 全 Preserved·pr DD=178+VM2·NM=0
  ·adv=0]+run2 burst N=30 EXIT=0[同签名]+run3 dual_input 首跑 EXIT=2[
  L1c B 类瞬态 ball signal=false→H1 fail-stop·首跑留证禁改判据]+run4
  重试 ALL PASS 10/10 EXIT=0[判据面零扰动第三轮·L4 两 face 同构 DD+
  Preserved/Continuous/epoch0·L5+Teardown 全绿]; 累计 R53 语义后 80 切换
  NM=0 闩锁未复现（解除格=rt_05 单测证明+真机待样本, 不阻塞）; **D2 新
  测量事实: av_delta 会话包络增长**（两跑同形态 2-7ms→101-127ms, R52 短
  窗未暴露, 候选=源 skew 时间漂移, 登记非裁决阈值仍禁）; 工件与 R53 逐
  项相等零新增[就地校准: 主账 §68.4 "MainContext WARN 0/4" 与原始日志不
  符→实测 OBS 域 1/跑·dual_input 域 2/跑, 技术结论不变]; T5 显式六路×
  四模式矩阵落账（04 探针 §11.2: 样本基数 101 切换·正证据/首证/单测
  锁定/absence 缺口四类格齐备·缺口各有独立归属[stalled 硬编码/S5 caps=
  None/switch_mock 分歧]）; **T5 矩阵=已填充至可交接验收层状态**; 本项
  未勾——验收谓词由验收层定义（禁发明 PTS delta 阈值·禁合成大布尔）→
  A2-8-04 Gate → A2-8-05 待]**
  **[第五十五轮执行（R55 验收谓词提案已交付, 零代码 docs-only; 主账 §70+
  04 探针 §12+提案文档 2026-09-05-a2-8-04-acceptance-predicate-proposal.md）:
  用户 R54 收口边界确认后进入验收层裁决准备——逐格起草 P1-P9 谓词
  （rollback 六路独立计数·pr_v 双层不混/discontinuity declared-vs-
  unexpected 三段/D1 分离计数/D2 无阈值形状/starvation 六路逐路 Some
  (false)==0·聚合 OR 显式排除/闩锁解除 UnitProven+FieldPending/
  dual_input 回归/证据完整性/Gap 披露）+ Gate 层固定合取（禁大布尔·格
  verdict 独立保留可审计）; 证据粒度全部锚定实码（non_advancing 四元
  定位 :189-207/Authority 九项合取/rt_04×4+rt_05/av_paired fold+R46
  活体）; **状态=PROPOSAL 待终裁: OQ-P1 D2 形状[默认案 a 测量完备性·
  阈值外排专项分布轮]/OQ-P2 FieldPending 阻塞[默认 non-blocking]/
  OQ-P3 证据窗[默认案 b Gate 日新鲜确认集+累计背景]/OQ-P4 B 类重试
  政策[仅 signal 类·全日志归档]/OQ-P5 工件漂移[零新增 blocking·漂移
  停查]/OQ-P6 Gap 阻塞化[默认披露性]/OQ-P7 组合规则[Gate 层固定合取]**;
  终裁前 Gate 不执行·A2-8-05 不提前; 本项未勾——OQ-P1..P7 终裁→
  谓词冻结→A2-8-04 Gate 执行→A2-8-05 待]**
  **[第五十五轮修订（R55.1 终裁纠偏+冻结已落地, 零代码 docs-only; 主账
  §71+04 探针 §13+谓词文档 FROZEN 段）: 验收层终裁 R55=ACCEPT WITH
  CORRECTIONS——四项必改并入: ①P1/P5 最低观测完整性前置[每路 PRE≥1∧
  POST≥1 非 Unknown·未达=Unproven 不转 PASS·观测违例=Failed]②P2 重写
  为 outcome↔continuity 一致性[Preserved⇔双 Continuous·NewEpoch 合法
  不伪装·Violated/TransitionFailed=Failed·原 P2d 永远 Continuous 弃用]
  ③P2c 弃用 undeclared_backward_jump==None[核验: 唯一构造点
  program_timeline.rs:658 硬编码 None·BackwardJumpFact 未实例化→改
  三支合取: UndeclaredBackwardJump 事件==0(on_program_pts :754-763 真
  检出链)∧程序面 NM==0(交叉引用 P1)∧Violated==0]④P6 FieldPending=
  Pending(non-blocking)Gate 报告永不写 Satisfied; 终裁前只读核验全部
  属实+两处结构性披露不修[死字段→dual_input.rs:789 恒真合取项/
  on_mapped_buffer :621-624 首帧边界回退吸收 Unproven→NewEpoch=P2c
  语义边界]+引用订正[SixPathEvidence/advanced=program_execution.rs:
  204-247·av_paired=watchdog.rs:456]; OQ-P1..P7 全关[R55 终裁五项+
  R55.1 补裁三项: OQ-P3=案 b Gate 日新鲜确认集/OQ-P4=仅 signal 类
  重试全归档/完整性下限=PRE≥1∧POST≥1]; verdict 词表 v2 七值·blocking
  格 Failed 或 Unproven 均阻断 PASS; 四层组合冻结[Evidence Integrity
  (P8)/Semantic Correctness(P1,P2,P3,P5,P6a)/Regression Safety(P7 不
  替代 Timeline Gate)]; 谓词文档状态 FROZEN(基线 89e2863); 本项未勾
  ——A2-8-04 Final Gate 按冻结谓词+案 b 证据窗执行→A2-8-05 待]**
  **[第五十五轮修订二（R55.2 终裁补正+最终冻结已落地, 零代码 docs-only;
  主账 §72+04 探针 §14+谓词文档 §8）: 验收层按远端真实状态复裁[远端
  HEAD=2f30d16·本地 R54/R55/R55.1/R55.2 未推送·推送延后至 Gate 后]——
  裁决=ACCEPT WITH ONE REQUIRED CORRECTION: R55.1 四项必改全确认, 唯一
  必改=P2c "UndeclaredBackwardJump 事件计数==0" 亦 vacuous[路径真实
  存在 on_program_pts :754-763→fail_closed :776-786 但无生产证据
  sink·失败经 timeline_fail_closed→SwitchError :751 走错误面·无事件
  生产≠无事件]→拆双通道: P2c-1 可观测通道 blocking[程序面 NM==0 交叉
  引用 P1 ∧ Violated==0·读出面=OBS 逐切换 outcome :537-545+dual_
  input L4]/P2c-2=Unproven·Structural Gap 披露[owner=后续 Domain/
  Observation change·禁 0 事件=Satisfied]; 两澄清入稿[sufficiency
  minimum≠continuity completeness proof·DD=declaration-bearing 非
  异常禁 DD>0→FAIL]; P2 Failed 收紧[Violated∨TransitionFailed∨任何
  TransitionFailure 终态]; 谓词文档 FROZEN-FINAL(R55.2); 下一步=直接
  进入 A2-8-04 Final Gate 新鲜证据窗执行→Gate 层 AND→A2-8-05 待]**
  **[第五十六轮执行（R56 A2-8-04 Final Gate 已执行, 零代码; 主账 §73+
  04 探针 §15; 证据盒 2026-09-05-r56-a204-final-gate）: 按冻结谓词+案 b
  新鲜窗执行——身份链全过[bin 7a0ed95c·72/72 sha·manifest 7521d17e·
  工件零新增 4/2/3/0 与 4/2/6/0 同模式==R54]; 新鲜三件全 EXIT=0[OBS
  N=30 dwell1000 30/30 全 Preserved·dual_input 首跑 10/10·hw 259/259];
  **逐格裁决: P1 四 in/br 路+pr_a/P2 核心 outcome↔continuity/P2a/P3/
  P4/P5 六路/P6a/P7/P8 全 Satisfied; P6b 真机首证落地[#8 NM→#9 干净
  边界→reset 全链=FieldPending 样本]; 但 switch #8 B→A pr_v
  NonMonotonic=6 行（R53 语义后首现·111 切换唯一事件·帧流全程健康·
  R53 状态机如实标显并自解除）→ P1-pr_v/P2b-pr_v/P2c-1 三 blocking
  格 Failed → **Gate 层固定合取 = A2-8-04 Final Gate = FAIL**（首败
  留证·判据零改动）**; 交接验收层两读法待裁: (a) 维持=rollback 违例
  (b) R52→R53 先例边界 rebase 语义裁决轮; 本项未勾——Gate FAIL 后续
  路径待验收层裁决; A2-8-05 不进入]**
  **[第五十七轮执行（R57 边界回退语义裁决支持已交付, 只读零代码;
  主账 §74+04 探针 §16+R57 独立文档+谓词文档 §10）: 用户 R56 终裁=
  (b) 严格版——A2-8-04 = FAIL/HOLD FOR BOUNDARY-REBASE SEMANTICS
  ADJUDICATION·三 blocking 不撤销不豁免不修改·FAIL 定性="Semantic
  adjudication required" 非"R53 已证伪"·P6a→Satisfied·P6b→FieldProven
  （词汇 v2.1 增补·生命周期证据域·不改 blocking）; 只读重建四答:
  A=六行 NM 唯一来源 PipelineHealth 程序面健康弧（appsink 逐缓冲
  plain+段首帧 declared 两写点）·Authority 从未收到违例值（喂入=①a
  一次+50ms 轮询·单缓冲瞬态采样不可见·反证 #9~#30 正常执行）→观察面
  逐缓冲 vs 控制面采样=接缝实锚; B=#8 锚 74137405051×74037405049·
  offset=差值精确·边界帧零间隙落旧段末值·切换行 mapped 非锚（settle
  推进·R56 "+26.67ms 前跳"读法就地修正）; C=六行=3 窗×双设备克隆同一
  程序观测的闩锁读数·底层事件 ≥1 最简恰 1·行数≠事件数（事件计数判据
  需证据面扩展=Domain/Observation change·登记不自行改）; D=无跨源
  rebase/排水/事件计数 Domain 概念·D2 不能裁决边界合法性; 机制排查
  M1 唯一存活[M2 未映射 raw 穿越被干净边界 DD 释放洗除→排除; M1=
  锚采样→install 微秒窗一枚出发段映射帧穿越→基线+1 帧(40ms)→A 边界
  帧(=锚)成违例边界→NM"声明不豁免回退"·概率 0.1-0.6%/切换与 1/~170
  相容·#8 同索引复现=同节拍同相位候选 n=2 未证]; **skew 框架消解**
  （锚构造两锚同瞬·offset=差·skew 相消·日志双证到 ns——#8 非 skew
  驱动）; 锐化裁决问题交验收层: (i) 连续性违例→adapter 边界原子性
  修复→回归→Gate 复跑（谓词不动）vs (ii) 合法排水语义→Domain 变更+
  事件计数（与"禁以声明洗回退"冻结纪律冲突）; 执行层分析（非裁决）
  =证据支持 (i); 诚实边界=违例帧未被直接观测（M1=排除法推理）; 本项
  未勾——(i)/(ii) 择一待验收层下轮裁定; A2-8-05 不进入（Gate 仍
  FAIL/HOLD）]**
  **[第五十七轮终裁复核（R57-terminal, 只读零代码; R57 文档 §10+
  谓词文档 §10 终裁复核段+04 探针 §16.1+主账 §75）: 验收层终裁=
  实体全部成立（FAIL/HOLD 维持·三 blocking 维持·修复否决三项·
  R57-A/B/C/D 维持·R58 边界原子性实现轮获批 11 步序——冻结证据/
  不改谓词/先设计/先补确定性测试/改执行边界/双侧回归/真机复现/
  NM 消失/生命周期立/全回归/新鲜 Gate）; 机制替换案 M1′（raw 帧
  推进基准）被源码+现场双重反驳——[锚采样→install] 窗内槽为 #7
  状态 executed=true（:891 替换式 install·运行期无清槽点）→出发源
  帧仍被旧段映射·raw 无映射窗实为 [③→④] 且 offset#7=+100131607>0
  ⇒ raw 路线被 #8 边界 clean→DD 覆写与"跨 #9 解除"签名矛盾——M1
  （旧段映射帧穿越）维持唯一双相容机制（裁决自身算术 P→P+40ms→A=P
  即映射帧签名）; 接受锐化: §六 clean 相对序=条件排除（offset_prev>0,
  #8 成立）+§十七 mock 缺口加强（observe→tick_once+pts_state 硬编码
  ValidMonotonic·结构上不可复现竞态）; R58 输入修正: 修复不变量按
  健康弧观测序表述·确定性测试主缝=[①c→③] 映射帧注入·次缝=[③→④]
  raw 符号面; 本项未勾——R58 实现+回归+Gate 复跑待执行; A2-8-05
  不进入（Gate 仍 FAIL/HOLD）]**
  **[第五十八轮 R58-Design 复核+步骤4（R58 unit 1, 测试先行零生产
  代码; R57 文档 §11+谓词 §10 段+04 探针 §16.2+主账 §76）: 验收层
  接受 R57-terminal 复核——M1′ 正式撤销, M1 恢复唯一双相容机制;
  R58-Design 终裁 12 条逐项复核全相容（槽 :891 唯一写点无清槽·锚
  :946-949·appsink 链 :422-446·拓扑 selector→queue→appsink
  :508/:630-634·mock :396/:406-415·远端 2972fb8 实测）; 主方案=
  selector-output BUFFER Cutover Fence（V+A 双面·只拦 BUFFER 不拦
  EVENT·fence-confirmed 须覆盖 queue 在途·pre-flip 拦截缓冲 DROP）+
  第二层 fail-closed 重采样; 实现层不变量登记（锚采样后 cutover
  生效前旧执行态不得推程序基线——不触碰 Domain predicate）; §7
  草图顺序校正=锚采样先于窜帧（窜帧先行锚=P+40ms 不可复现）; 步骤
  4 执行: switch_graph.rs 测试模块两测——M1 确定性复现（数值=R56
  #8 实测锚 74137405051×74037405049·offset#7=+100131607: S7→P→锚
  P→窜帧 P+40ms Continuing→install #8→首枚映射 P→NM 断言→#9 干净
  边界 DD 断言）+无窜帧差分对照（干净 DD）; 盒=编译+clippy×2
  -D warnings 全绿·default/sim 227·gst 261=259+2（run-A 瞬态 1 失败
  未捕获名·零改动重跑全绿——R51 flaky 同型）; 本项未勾——步骤
  5-11（fence 实现/双侧回归/真机 #8 复现 NM 消失/生命周期仍立/全
  回归/新鲜 Gate）待执行; A2-8-05 不进入（Gate 仍 FAIL/HOLD）]**
  **[第五十八轮补·独立远端裁决复核（docs-only 零代码; R57 文档 §12+
  04 探针 §16.3+主账 §77+谓词 §10 注）: 验收层基于 GitHub 真实状态
  独立裁决 13 节逐条复核全相容——远端事实独立实测一致（ls-remote=
  2972fb8·branch -r --contains d1f1e58=空·R58 测试不在任何远端分支）;
  口径纪律冻结=本地/远端分述·本地提交永不称远端落地·推送仅按明确
  指示; M1=源码闭环证实非推测（50ms 采样 :739 两时间尺度⇒NM×
  Preserved 并存·fail-closed 链 :746/:755-763/:776 无声明豁免）;
  HOLD 维持=设计方向无错·生产修复未进远端·完成至「根因确定+测试
  先行」层级; fence 不变量升格冻结: INV-F1 queue-in-flight 入
  confirmed（原条件 a 升格）·INV-F2 旧世代拦截帧不可复放（三段模型
  排空→barrier→重开·原条件 b 升格）·INV-F3 V+A Both-Confirmed 握手
  （switch() :822/:824/:828 video 先 audio 后+回滚）; 步骤 5 边界树
  登记（fence→confirmed→anchor→declare→install→switch→不可复放→
  executed→release+二线 stale-baseline resample 非主机制）; 本项未
  勾——步骤 5-11 待执行; A2-8-04 不得宣布恢复 PASS; A2-8-05 不进入]**
  **[第五十八轮步骤 5（R58 unit 2, 代码轮, 本地未推送; R57 文档 §13+
  04 探针 §16.4+主账 §78+谓词 §10 注）: Cutover Fence 生产实现——
  INV-F1/F2/F3 编码进 Adapter 执行契约（端口 arm/release 无默认实现·
  4 实现方编译期表态; switch graph 两层门=selector src BUFFER 探针
  drop-first 先于映射+appsink 消费门 V/A 对称——INV-F1 构造性覆盖
  queue 在途帧无时间等待·INV-F2 Drop 无 flush/复放丢弃计数交回·
  INV-F3 V+A FencePair 成对单字段+编排序 ⓪arm→①c 锚→②③④→executed
  落点 Release+守卫 Drop 兜底错误路径必解除不吞错误）; Open=legacy
  逐字节保持; Mock=staging（真实交错模型=步骤 6）; 契约测+fence
  闭合 M1 测（窜帧被处置→基线不推进→干净 DD——对照红测 NonMonotonic
  在案）; 盒复跑全绿 default 227/sim 227/gst 263=259+2+2/clippy×2
  -D warnings（首跑 2 编译错闭包借期+参数 8/7→FencePair 重构修复
  如实登记）; Domain/谓词/Gate/阈值零字节·三 blocking 维持 Failed;
  本项未勾——步骤 6（Mock 交错模型）/7（真机 #8 复现 NM 消失+生命周期
  仍立）/10（全回归）/11（新鲜 Gate）待执行; A2-8-04 仍 FAIL/HOLD;
  A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 5 终裁复核+步骤 5.1（R58 unit 3, 代码轮）:
  验收层对 0abde4d 反向审查=IMPLEMENTATION PARTIAL/HOLD——消费门仅
  Armed 窗口有效·Release 不等 queue 排空=INV-F1/F2 未闭合（穿透路径
  T0-T3 成立·我方"构造性覆盖"注册撤回）+FencePair 两把独立 Mutex 非
  原子; 步骤 5.1 落地=①原子 FencePairState 单锁{双面 fence+ready+
  Seqnum 世代序号+generation}②下游 Segment 确认（selector EVENT 探针
  捕获 gstreamer::Seqnum+appsink sink pad 纯观测确认探针不阻塞
  EVENT——queue 保序=排空事实锚·timeout 5s 仅异常界）③确认式
  Release（release_cutover_fence 阻塞等 Both-confirmed 同临界区原子
  Open+force_release 兜底强释仅失败路径——T-F3 成功路径强制; 守卫
  defuse→confirm_and_release 于 Domain executed 标记后——终裁 §9 序;
  端口无默认实现 4 实现方表态延续·Mock auto-confirm 建模如实披露）+
  T-F1/F2/F3 三确定性测+既有契约/fence-M1 测升级; 盒最终全量矩阵全绿
  fmt/default 227/sim 227/mock 393/**gst 266=259+2+2+3**/clippy×3
  （逐轮如实: bmd 误配 SDK env+fmt 尘含 R53/R56 遗留清偿+Seqnum
  E0308+needless_borrow×2 修复）; Domain/谓词/Gate/阈值零字节·三
  blocking 维持 Failed; **步骤 6 ⏸️/7 ⏸️（终裁: 先 Fence 修正确定性
  验证）**/10/11 待执行; A2-8-04 仍 FAIL/HOLD; A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 5.1 终审+CLOSED（R58 unit 4, docs-only 零代码）:
  验收层独立复核确认 ffdb9ce=真实远端基线·实质性正确修复非账本包装
  （queue 穿透与双 Mutex 两核心问题被正面解决·无需回滚）; 三边界源码级
  终审 A ✅（capture first-wins+Armed 门·世代序号三元组匹配·伪 Segment
  超时 fail-closed 安全方向·BUFFER/EVENT 探针类型分离）/B ✅（Ok→
  armed=false·Err→Drop 强释·force_release 类型面无法构造 DrainEvidence
  ·生产调用点仅守卫 Drop·Open 翻转仅 both_ready 同临界区·:662 ? 如实
  传播·调用链终序 ⓪→①→②→③→④switch→④executed→confirm_and_release
  无隐藏序）/C ✅（四接线点共用 FencePair·T-F 驱动生产方法零复刻·旧
  buffer 消费门先于 Segment 确认=单流线程 FIFO+sync=false 内联渲染
  ——披露: 依赖 GStreamer basesink 标准行为, 真机 Step 7 NM 消失为
  端到端反证）→ **Step 5.1 正式 CLOSED**; 后续序=Step 6 Mock 交错模型
  →Step 7 真机 #8→Step 10 全回归→Step 11 新鲜 Gate; A2-8-04 仍
  FAIL/HOLD·三 blocking 维持 Failed; A2-8-05 不进入]**
- [ ] 6.x **[Step 5.1 终审级措辞修正（docs-only）: C 项排空顺序保证
  归因修正=serialized SEGMENT 数据流顺序+AppSink new_sample 回调在
  streaming thread 执行（sync=false/async=false 非主要来源——前者为
  时钟同步等待关闭后者为 BaseSink 状态转换语义）; 结论不变 Step 5.1
  维持 CLOSED 不回滚; 端到端正确性由 Step 7 真机 #8 验证; 正式进入
  Step 6（七事件交错词汇 AnchorSampled/OldStraggler/FenceConfirmed/
  InstallNew/SwitchNew/OldBufferDropped/FirstNewMapped·双模式证明
  无 Fence→M1 FAIL/有 Fence→M1 PASS·Mock 须模拟控制/数据线程交错
  非孤立测试 FencePair）]**
- [ ] 6.x **[第五十八轮步骤 6（R58 unit 5, 代码轮）: Mock 交错模型
  落地——程序面真实单调状态机（plain/declared 双写点·R57-terminal
  硬编码 VM 缺口闭合）+消费门施加于 tick 交付（EVENT 不拦·设备 PTS
  照推）+竞态窗窜帧注入（deliver 协议级/stage Runtime 级 ①c 读毕
  投递=[锚采样→install] µs 窗模型）+七事件交错日志（arm 清空·生产
  序·终裁列举序按词汇理解映射登记）+诚实 per-plane 丢弃计数与
  generation; 三测全绿=无 Fence→M1 FAIL（窜帧 plain 写弧推进基线→
  首枚映射违例边界 NM sticky·日志五事件无确认）/有 Fence→M1 PASS
  （窜帧被门处置基线冻结→干净 DD·计数 4 如实·日志恰七事件）/
  Runtime 级（全链×2 切换 staged 窜帧→Preserved+程序面 DD+七事件
  ——生产编排序端到端证明）; 盒 mock 396/396（393 既有零破坏）·
  最终矩阵 fmt/227/227/396/gst 266 不变/clippy×3 全绿（E0252·rig
  complete_switch 两错如实登记修复）; 披露: mock 锚=+步长外推
  （真实=last PTS·超出本轮范围登记不改）·M1 以窜帧恒领先边界一帧
  同构表达·queue 保序不在 mock 范围（T-F1/F2/F3 在案）; Domain/
  谓词/Gate/真适配器/契约端口零字节·三 blocking 维持 Failed; 下一步
  =Step 7 真机 #8 复现（NM 消失+#9 生命周期仍立）→10→11; A2-8-04
  仍 FAIL/HOLD; A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 6 独立复核终裁: IMPLEMENTATION PASS /
  TEST MODEL HOLD-1——核心成果成立（三证明方向/非孤立测/真实计数/
  七事件在案）, 但 tick_once timeline 分支先置 first_mapped 再查
  fence_armed: Armed 丢弃缓冲占用首映射槽位（三测调用序恰好避开
  post-switch Armed 在途窗口——恰是 Step 5.1 要防的边界）; 修复=
  终裁处方"Fence Drop 必须先于任何 first_mapped/timeline evidence
  状态推进"（segment_seen EVENT 不拦→消费门丢弃+计数+OldBufferDropped
  入日志[同根证据面缺口顺带闭合: tick 门处置原先不可见]→状态推进;
  门不分辨世代只认 Armed）; 新增回归 switch_rt_03_m1_armed_gate_
  precedes_first_mapped_evidence_state（install→switch→Armed→缓冲
  到达→Drop→first_mapped 仍 false·PTS 冻结·帧数不进→release v/a
  各 1→下一枚放行=FirstNewMapped+DD·窗口四事件; 旧序必红判别性在案）
  ; 两项登记口径修正=stage_window_straggler 为 Runtime 调用链
  cut-point 注入（确定性非 OS 线程竞态·真实并发归 Step 7）+04c3dd1
  无 GitHub combined status（396/396=盒上本地验证口径非 CI 结论）;
  盒 mock 397/397（396 零破坏+新增一次过）·矩阵 fmt/227/227/397/
  gst 266 不变/clippy×3 全绿·T-M1-PASS/T-RUNTIME 事件数 7→8 如实
  （词汇仍七）; Domain/谓词/Gate/真适配器/契约端口零字节·三 blocking
  维持 Failed; Step 6 最终 CLOSED 裁决权在验收层（处方测试已通过）
  ·Step 7 不先于该裁决启动; A2-8-04 仍 FAIL/HOLD; A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 6 终裁+步骤 7 执行: Step 6=实质 CLOSED
  （HOLD-1 解除·cfb0943 修复按处方落地+回归测试击中 post-switch
  Armed 在途窗口+cut-point 注入/盒上验证两项口径修正）; Step 7 真机
  #8 复现（零代码轮·2026-09-06）: cfb0943 tar 部署源 SHA 四文件盒==
  HEAD·gates bin md5 d05be28f·manifest v5 不变·证据盒 2026-09-06-
  r58-step7-fence-replay; 四跑=run1 #8 精确形态（N=10 dwell1s）EXIT=0
  全 Preserved·epoch(0)×10·pr_v/pr_a 对称 DD58+VM2·NM=0·adv=0·#8
  执行行 disc=DD v/a=Continuous·#9 生命周期仍立/run2 N=30 dwell1000
  同签名/run3 burst N=30 dwell0 同签名/run4 dual_input ALL PASS 10/10
  （L4 fence 在链 timeline_ok=true Preserved+程序面 DD 两 face 分层）;
  C 项真链反证闭合=71 fence 周期 Both-confirmed 零超时·零 cutover 错误
  串·NM=0（serialized SEGMENT+streaming-thread 回调在真实 BMD/
  GStreamer 链兑现——序破坏两后果确认超时/NM 重现均未发生）; 工件=
  既有隔离债零新增; 诚实口径=NM 消失必要非充分（历史概率性 0.1-0.6%
  /切换·确定性击杀在 mock 双模式+真适配器红绿测）·真机贡献=71/71
  fence 可运行+无反例+R53 基线签名逐字保持; Step 7 验收判定归验收层
  →后续 Step 10 全回归→Step 11 新鲜 Final Gate（仅届时 A2-8-04
  verdict 可变）; A2-8-04 仍 FAIL/HOLD; A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 7 终裁+步骤 10 全回归: Step 7=✅ PASS/
  CLOSED（五关键点全过: #8 位点 Preserved+DD+V/A Continuous+PE(0)+
  NM=0 击中 R52/R56 闩锁位点·#9 生命周期保持无 NM 传播·V/A 对称
  含 L4 fence 在链·71 fence 周期 Both-confirmed 零超时零 cutover
  错误·SPAN 1.28-34.6ms）; C 项升级 CONFIRMED/REAL-HARDWARE-
  VALIDATED（措辞红线保留: NM=0 必要非充分·确定性证明在 mock 双
  模式+真适配器红绿测·真机=协议落实+无反例）; A2-8-04 不因连续
  通过自动转绿（三 blocking cells 冻结门禁）; Step 10 放行→执行
  （零代码轮 2026-09-06）: 远端=本地=6ab24a3 双侧核验·源 SHA 四
  文件盒==HEAD 全等·gates bin md5 440c761b（源同源新构建指纹）·
  manifest v5 不变·证据盒 2026-09-06-r58-step10-regression; 盒
  矩阵 fmt/227/227/397/266/clippy×3 基线齐平零回归; 真机四跑=
  dual_input ALL PASS 10/10（L4 epoch=1·observed=B·completed·
  timeline_ok·Preserved{PE(0)}·程序面 DD·v/a Continuous——
  Authority/Desired/active/epoch/连续性 Gate 级一行齐·fence 在链·
  L5 四 verdict·Teardown 绿）+obs 三场景（#8 形态/N30/burst）全
  EXIT=0·全 Preserved·PE(0) 保持·NM=0·adv=0·R53 签名逐字（in/br
  VM=60/180×4·pr DD=58/178+VM2 对称）·#8/#9 位点干净·SPAN 毫秒
  量级（1.56-31.8ms）无 5s 逼近; 错误面零新类（pad_unlink×4/跑·
  interlace 3-6 同量级·ERROR=0·cutover 字串=0）·71 fence 周期全
  确认式 Release; 澄清=adv 初判 1 例系 grep 命中定位行字面量实为
  0; 结论=六路/Authority/Desired/observed active/epoch/V-A/
  teardown 全局无回归; Step 11 新鲜 Final Gate（冻结谓词）待验收
  层对 Step 10 裁决后另启——届时才允许改判; A2-8-04 仍 FAIL/
  HOLD; A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 10 终裁: ✅ PASS / CLOSED（验收层全盘裁决
  e09ed97）——regression 轮四条件同时成立（生产源码未改·编译/API/测试
  零回归基线齐平·控制面→Fence→数据面状态链零回归·真机无反例）; adv
  误报澄清获认可（grep 命中 locator 行字面量·证据行=0）; 既有 artifact
  不重开为 A2-8 缺陷（已知债务保留）; Mimosa 口径="功能编译、测试、
  真机回归通过; AST 扫描能力不完整, 不构成全项目静态安全保证"（不阻塞
  ·不宣称安全）; Step 10≠Final Gate——5.1/6/7/10 连续 PASS 不推导
  A2-8-04 PASS; 无足够证据要求继续改生产代码（禁为 Final Gate 变绿预改
  predicate/NM 定义/ProgramEpoch 判据/Desired-Observed 判据/threshold/
  artifact 分类）; 🚦放行 Step 11 新鲜 Final Gate（冻结谓词+案 b 新鲜
  窗重算 P1-pr_v/P2b-pr_v/P2c-1·不修改 predicate·不降低 threshold·
  不新增 exemption·双出口预定义）; A2-8-04 仍 FAIL/HOLD 至 Step 11
  重算; A2-8-05 不进入]**
- [ ] 6.x **[第五十八轮步骤 11: 新鲜 Final Gate 执行+冻结谓词重算（零
  代码轮 2026-09-06·13:48-13:57 CST）——git archive e09ed97 上盒·源
  sha 864/864 盒==archive==HEAD 全等·**冻结 bin md5 440c761b 复用==
  Step 10 登记值（案 b 逐字节口径·未重建）**·manifest 7521d17e 不变;
  案 b 三件: run1 OBS N=30 dwell1000（**R56 失败窗同形**）EXIT=0·30/30
  全 Preserved·PE(0)×30·**六路 NM 行独立计数全 0**·adv=0·P2b 签名
  逐字（VM 恰首切前 PRE 对 2 行+其后 DD178）·**#8 位点 Preserved+
  PE(0)+V/A Continuous+DD**·#9 生命周期仍立·av_delta 2.037-118.704ms
  （案 a 登记性无阈值）; run2 dual_input ALL PASS 10/10 首跑（L4 一行
  齐·Authority outcome=Preserved）; run3 hw 矩阵 266/266（冻结字面
  259+R58 步骤 5/5.1 批准增量 7·差量如实登记非谓词改动）; run3b=窗口
  外 P3 能力补证（group_fold_rt_01_av_divergence_detected ok·**口径
  修正: cfg(test,mock) 门控∈mock 397 套件——R56 "∈259" 引用不准**）;
  逐格重算（冻结谓词·词表 v2.1·明细=R57 §22.3 表）= **三 blocking
  cells P1-pr_v/P2b-pr_v/P2c-1 Failed→Satisfied**·其余 blocking 维持
  ·P2c-2/P9 Gap 披露维持·P6b FieldProven 维持 → **Gate 层固定合取 =
  A2-8-04 Final Gate = PASS（冻结合取机械产出·判据零改动零豁免·无
  重试·首跑留证未触发）——验收终裁归验收层·非提前宣布**; A2-8-05 =
  解锁待令·不进入; 工件零新类（pad_unlink 4/collision 2/interlace
  3/MainContext 1——vs R56 OBS 仅 MainContext 0→1 已知类内漂移·与
  Step 10 run3 同形·OQ-P5 登记）; 证据盒 2026-09-06-r58-step11-
  final-gate（五件套+四跑 log md5+NM 抽取件[0 行]+av_delta 全序列
  n=180+stats）+**入库审计副本** evidence/bmd-10.30.15.10/a2-8-04-
  r58-step11-final-gate/（md5sum -c 全过·盒上原件=origin·本地验证
  口径非 CI·同轮入库 Step 10 四跑副本+索引更新）]**
- [ ] 7. A2-8-05 archive+CI+merge（A2-8 收口唯一入口; 01-04 任一完成不宣布
  CLOSED）
  `Contract: 04` | `Implementation: 进行中（R59 开启）` | `Verification: CI+归档` | `Gate: 待`
  **[R59 解锁注（2026-09-06）: 验收层终裁 A2-8-04 = PASS / CLOSED（R57
  §23）——**A2-8-05 解锁·R59 开启**; 收口时序用户裁决 = 开 PR 跑 CI·
  链末收口（本轮开 PR 仅求 GitHub CI 真实信号·不 merge; archive+
  merge+tag 推至 Step 13-17 正常使用形态阶梯完成后）; Step 12 基线
  冻结 = R57 §24; Step 13a 启动入口审计 + 零代码 v0.1 测试包本轮落地
  （切换面缺口如实标注 v0.2 控制面扩面·待裁决）]**
  **[R59 执行段（2026-09-06·零生产源码）: ①身份链——services/ 零差
  +核心四文件 SHA 盒==本地全等+服务 bin md5 6a0fa224（build-bmd 口径）
  +manifest 7521d17e; ②Step 13a 审计 = 2026-09-06-a2-8-05-normal-use-
  startup-entry-audit.md（八缺口表：switch 触发入口/回读端点/
  Production 503/无信号处理/program 物化未合流/无版本行/无 runbook/
  日志 stdout·v0.2 控制面扩面提案待裁决）; ③v0.1 测试包 =
  preview/a2-8-05-v0.1/ + 盒上冒烟两跑（run1 留证: stop_session 400=
  打包脚本 UUID 展示形缺陷; run2 全绿: Capturing·双输入两路
  advancing·events 15·stop_session executed·teardown 链 Program Stop→
  Tap Detach+watchdog 停止旗·进程死亡·工件既有已知类）+证据盒入库
  （md5sum -c 全过·盒=origin·EVIDENCE-INDEX Current）; ④**PR #30 开出
  ·GitHub CI 7/7 首跑全绿**（run 34018242258·hardware-test-compile
  secrets 在位 bindgen+FFI 过·本分支 114+ 提交首次 CI 实测·不
  merge）; ⑤commit 64769b0 推送 remote==local; 主账 §88 执行记录段]**
  **[R60 探针段（2026-09-06·零代码）: v0.2 Control Plane Expansion SoT
  探针交付 = 2026-09-06-a2-8-05-v02-control-plane-expansion-probe.md
  ——现状链证据全复核（command 词表三枚举+dispatch 只收
  SessionManager; idempotency 包 dispatch·executor 单一; transport
  自declared 五端点零触碰红线=扩面即显式契约修订轮; runtime_query
  allowlist 命令动词禁入; switch_program/observe_execution/
  SwitchIntent{target,FrameSwitch} 签名即用; bin :513 runtime Arc
  move 进 hook 注册表不留句柄）; 设计提案 A（推荐·最小）=
  CommandKind::SwitchProgram + SwitchDispatchPlane trait（无默认
  实现·mock/真实双实现）+ idempotency switch_plane 字段（None→503
  契约维持）+ runtime 顶层 program_switch 可选投影块
  （observe_execution 数据源）+ bin clone Arc 接线·单会话语义如实;
  备选 B（注册表+事件+rpc 归 Step 16）/C（旁路端点·不推荐）; 7 文件
  面零核心四; 测试面 6 组 + Step 14 盒上验收线预演; **待裁六点**
  （命令面归属/payload 面/回读形状/多会话/events 面/Production
  语义·各带推荐）——实现轮待裁决后另启; 用户 R60 令"不能偷偷塞进
  v0.1·先只读裁决再定最小边界"已按此履行]**
  **[R61 实现段（2026-09-06·代码轮）: 六点裁决全部按推荐冻结（R60 探针
  §9.1 回执）+ v0.2 实现——新模块 switch_dispatch_plane（命令/查询双
  trait 类型级隔离·classify·outcome Failed 如实 Failed）+ command 词表
  四命令/validate/dispatch 扩展 + idempotency switch_plane+replay/conflict
  同表 + api_boundary 投影 DTO + transport 显式契约修订注记/vocab 四词/
  投影合并 + bin Arc 化 clone 双通道装配 + 强制调用点 2 文件（error_model
  测试×3+gates/session_lifecycle×3 补 None·零语义·如实登记）; **核心四
  git diff = 0 实证**; 盒矩阵 fmt/229/229/405（397+8）/268（266+2）/
  clippy×3 全绿·新服务 bin md5 90186bb9; **Step 14 闭环全过**（真实服务
  进程内: 投影块首次兑现→API A→B executed preserved→回读 observed=B/
  seg=1/DD 冻结签名→API B→A→回读→错误路径 permanent 分类→幂等重放
  逐字节→冲突→stop_session→teardown 链→进程死亡·非 gates 替代）+ 证据盒
  r61-v02-step14 入库 md5 全过——R60 探针 §9.2/§9.3 + 主账 §90]**

  **[R62 探针段（2026-09-06·只读探针轮）: Control Plane Safety Probe——
  用户裁决逐条复核（A 组 R61 实现 10/10 落实 ✓·含核心四零 diff 实测;
  B 组两风险属实+精细化: watchdog:612 条件落定只救组平面/declare
  Stable-only+TransitionFailed 终态/inner 锁双层阻塞/超时全编译期常量
  无旋钮）; 新增 mock 级全链故障注入集成测试 **6/6**（F0 pre-begin 完全
  可恢复·F1 组闩锁 NotActiveSource 永久·F2/F3（真实 5s）/F4 时间线闩锁
  declare InvalidPhase·全类 readback 活+teardown 可用·生产源码零改动）;
  真机: 正常切换 0.152s（R53 签名）·停滞读者冻结管理面 10.175s（单
  accept 铁证）·在途查询排队 61ms·并发 replay 逐字节·双反向串行化
  epoch 恰一次·stop_session 1.23s teardown; 16-0C=风险 2 情况 B/风险 1
  情况 C·修复面建议 R62-A（a timeline reconcile+b 组 abort 最小完整 /
  c 契约声明化）+R62-B（std-only 并发·禁 async）两 change 分开待二轮
  裁决; 矩阵全绿 fmt/229/229/405+6/268/clippy×3; 证据盒
  r62-cp-safety-probe 入库 md5 全过——报告=2026-09-06-a2-8-05-r62-
  control-plane-safety-probe.md + 主账 §91]**

  **[R63-A0 恢复契约段（2026-09-06·契约先行·本 commit 先于代码 commit）:
  用户 R63 裁决=修复架构轮开启——两个实证问题各开独立 change·先 A（域
  状态机恢复）再 B（Transport 并发·std-only·禁 async 框架）·R64 全矩阵→
  Step 15 长稳→Step 17 RC 顺序冻结; **恢复 SoT: Observed 优先, Desired 由
  reconciliation 推进; observation ≠ intent; absence ≠ false（observed=None
  不猜 A/B）**; 三类落定: ①翻转未生效失败→Desired 回 Active(from)+Timeline
  回 Stable{from}（abort 语义·epoch/世代不变）; ②已执行但证据/落定失败→
  命令 outcome 保持 Failed（不伪装成功）+两平面 reconcile 落 Active(observed)
  +Stable{observed}·ProgramEpoch+1·新段以 observed 恒等锚重开·
  DiscontinuityDeclared·PTS 基线清空（不伪造连续性）; ③observed=None/组外
  →新词表 SwitchDesired::RecoveryRequired{from,to} 终态（不猜）·下次切换
  Permanent 拒收·自动恢复不在本轮（恢复=会话级 teardown）; replay: 同
  command_id 重放≡原始 outcome 逐字节（恢复只动状态平面·不改写已记录
  应答）; 红线: complete_switch（observed==to 才落定）/force_release 语义
  禁改·watchdog 不改（新变体→consistent=false 如实上报不动作·单测钉住）·
  R53 闩锁纪律不破坏（reconcile=显式恢复转移·干净边界重开段基准·违例
  历史入 immutable 段史不洗）; switch_epoch 在 begin 已消费·reconcile 不再
  变更——契约全文=2026-09-06-a2-8-05-r63-a-switch-failure-recovery.md §2
  （随用户计划批准即锁）]**

  **[R63-A 实现段（2026-09-06·代码轮·commit 2）: A1 最小恢复机制 + A2
  异常矩阵落地——9 文件 +853/−194（contracts/transport/api_boundary/
  command/idempotency/bin 零触碰实证）; 新词表 2 项（SwitchDesired::
  RecoveryRequired{from,to} 终态 + SwitchError::RecoveryRequired→classify
  Permanent+快照更新）; 新方法 2 个（ExecutionGroup::reconcile_switch
  三路落定[Some(to)/Some(from)/None→降级] + TimelineAuthority::
  reconcile_executed_failure[四相位→Stable{observed}+ProgramEpoch+1+恒等
  重开+DiscontinuityDeclared+基线清空+段史 append·None 诚实停留·复用
  abort_transition 处未翻转]）; switch_program 抽 locked+外层统一
  recover_after_failed_switch（再观测经 adapter observe 与 watchdog 同
  通路·不取 inner 锁·恢复失败只记录不吞原始错误）; **新鲜度谓词修正
  （执行中发现并闭合的第二缺口）**: 两 adapter plan.epoch!=av_epoch+1
  精确锁步 → <=av_epoch 重放判据（begin 后失败留下合法 epoch 间隙——
  组已消费/adapter 未执行——R62 前被组闩锁掩盖, 修复后 R1/R7 重试被
  StalePlanEpoch 永久拒绝; 防重放锚保留·未来 epoch 新鲜度归组平面·
  干净运行数值不变[hw 268 零改动全过]; 两纵深测试改重放锚）; **A2 矩阵
  mock 全链 9/9**（ctrl/F0 同形 + R1+R7 回旧源再 A→B Preserved + R2+R8
  fence 确认失败落 B·epoch+1+DD 再 B→A + R3+R6 证据超时[真实 5s]不伪装
  成功落 B + R4[R5 类] settle 矛盾落 B + degraded observed=None→
  RecoveryRequired 终态·下次 Permanent·teardown 恢复 + 0a ①a 稳态 PTS
  闩锁[R63 新登记位点]解除 + replay 同 command_id 逐字节[恢复后]）;
  盒矩阵 fmt CLEAN/229/229/**411+9=420**/268/clippy×3 全绿; 真机正常
  路径回归（bin 重建 md5 f6e6303b 先行核验→A→B executed preserved
  av_epoch=1→回读 R53 冻结签名逐字→B→A av_epoch=2→回读→stop→
  teardown 完成行+watchdog 退出行验证·服务常驻为设计语义）; 核心四
  开启面逐处登记（program_execution 主体 + switch_mock/switch_graph
  各 1 强制臂+2 谓词位+1 测试更新——R53 correctness 面零触碰）+ gates/
  a204_obs 1 强制臂 + watchdog 零行为改动（折叠钉子单测）; 证据盒
  r63a-recovery 入库 md5 盒=origin 全等（12 件含 mock-recovery-matrix
  矩阵行日志）——报告=2026-09-06-a2-8-05-r63-a-switch-failure-recovery.md
  §3-§6 + 主账 §92; **R63-B Transport 并发（std-only）下一轮另开**]**

  **[R63-B0 并发契约+inner ownership 审计段（2026-09-06·契约先行·本 commit
  先于实现 commit）: 用户 R63-B 裁决=B1 连接并发/B2 切换串行边界/B3 查询
  快照解耦三层拆分·两 commit 分离架构与实现·真机并发验证（B-T1..T7+慢
  读者+恢复后连续切换）后才能进 R64/Step 15; **并发契约冻结**: ①HTTP
  concurrency ≠ switch concurrency——GET /health·/runtime·/events 可并发,
  同一 Program 的切换经 runtime.inner 串行（现有锁=串行边界·**不新造全局
  锁**; idempotency[同 id exactly-once/replay/conflict] 与 inner[Program
  execution 互斥]职责不同不合并）; ②std-only——无 tokio/axum/hyper/
  tower, Connection: close 协议模型不变; ③Query 快照模型——**快照 SoT=
  既有 ProgramExecutionObservation**（Clone 派生已在·contracts 零触碰）,
  runtime 增 derived published 缓存（非第二 Runtime State）, observe_execution
  改 try_lock 短锁+回退最近已提交事实快照, 发布点=create 初始/switch_program
  出口（成败与恢复后）/自由读, teardown 清空（投影块诚实缺席契约保持）;
  ④慢读者隔离=per-connection std thread（10s read timeout 只约束自身连接）;
  ⑤残留如实: 无连接数上限（诊断 127.0.0.1 回环前提·正式化归反向代理层）·
  during-switch 查询=上一次已提交事实（observed_at_ms 在载荷=诚实时间戳）·
  adapter observe 并发安全沿 watchdog 真机先例（R62: 切换期 tick 720→780
  无中断）; **inner ownership 审计**: group=Arc<Mutex<ExecutionGroup>>
  独立可锁/timeline=TimelineAuthority 纯 snapshot 派生读/switcher+graph=
  adapter observe 通路（watchdog 先例并发安全）/taps·tap_port·watchdog_stop
  =teardown 专用/inner Mutex<Option<Inner>>=切换编排串行边界（保持）;
  触碰面=transport+bin+program_execution（B3 审计证明必须: observe_execution
  即阻塞点·最小开启: published 字段/create 发布/switch_program 出口发布/
  teardown 清空+observe try_lock）·switch_graph/switch_execution/
  program_timeline/contracts/switch_mock/command/idempotency/api_boundary
  续冻——契约全文=2026-09-06-a2-8-05-r63-b-transport-concurrency.md §2-§3
  （随用户计划批准即锁）]**

  **[R63-B1 实现段（2026-09-06·代码轮·commit 2）: B1+B2+B3 落地——3 文件
  +89/−28 + 新并发测试文件（核心域文件续冻零触碰实证）; transport 新
  serve_forever（accept→超时→clone→std::thread·std-only·Connection: close
  不变·无连接上限=残留如实）+bin 一行化; program_execution 最小四处开启
  （B0 审计证明必须: published 快照字段[Inner 外·derived 非第二状态]/
  create 发布/switch_program 出口发布[成败与 R63-A 恢复后]/teardown 清空
  [投影块诚实缺席契约保持]+observe_execution try_lock 短锁+快照回退·锁序
  恒 inner→published 零死锁）; B2=零新锁（inner 既有串行边界·idempotency
  不合并未动）; **B4 mock 并发矩阵 8/8**（真实 socket+serve_forever 本体+
  真实 5s 证据窗: b3 窗内 worst_query=19.9µs 快照回退·t1 840µs·t2 816µs
  快照语义可见·t3 653µs·t4 replay 逐字节+等待 4.99s·**t5 双反向串行双
  消费 epoch+2 终态唯一 Active=恢复后连续切换 B6 锚**·**t6 慢读者 718µs
  [R62 同形=10.175s 冻结]**·t7 n=16 worst 1.43ms）; R63-A 矩阵 9/9 零回归;
  盒矩阵 fmt CLEAN/229/229/**428（411+9+8）**/268/clippy×3 exit0; **真机
  B5/B6**（bin 1326be28 重建先行）: 切换窗内并发查询全 200 ~1ms·慢读者挂
  8s 期间 962µs–1.08ms 三时点·replay executed+replayed identical·N=8 并发
  680µs–1.04ms·A→B/B→A 双 preserved+R53 签名+teardown 行+watchdog 退出行;
  证据盒 r63b-concurrency 14 件 md5 盒=origin; 披露: 真机脚本首版裸 wait
  挂起+手工收尾两笔误——规范证据以修复脚本完整重跑为准——报告 §4-§7 +
  主账 §93; **R64（全矩阵+真机故障恢复+并发查询+30min 基线）→Step 15→
  Step 17→链末收口待令**]**

  **[R64 段（2026-09-06·综合验收轮·用户 R64-0..6 十一节裁决）: 真服务恢复
  矩阵+并发综合+快照真值+六平面审计全绿交付·三条发现停裁（未在线修·生产
  零触碰——源内仅 gate 新文件+mod.rs 一行+bin/gates.rs 派发与 env 清单+mock
  测试加 r64_storm 1 测试）; 载体=新 gate `r64_control_plane`（env
  VBMF_A2_8_R64_CP·两阶段）: 真 BMD 双输入+真 GStreamerSwitchAdapter::bridged()
  包私有 FaultControlWrapper（11 方法全委托·R53 face 零触碰·四旋钮场景前置
  位）+真 transport/idempotency/api_boundary **全程 HTTP 闭环**·watchdog 不
  接线（a204 先例·披露）; epoch 记账真机钉死（group=begin 尝试数/
  ProgramObservation=已委托 plan epoch 绝对值可跳号）; **阶段一 attempt5 规范
  跑 exit0·failures=0**（C0 R53 签名/C1 observed=from 落 Active(from)+
  replay 原样+再切成功/C2 observed=to 硬件真翻转+真 5.02s 证据超时=R62 场景
  恢复闭环·NewEpoch(1)+DD+identity 段+反向再切 preserved@1/STORM 真切换窗
  0.87s 四路并发 200<2s+replay 原样+异 id 串行+快照真值窗内=旧已提交无未来
  时间戳/C3 observed=None 接缝注入落 RecoveryRequired 终态拒绝猜测→拒收→
  teardown 全缺席; 13 静息六平面检查点全 OK——六平面=命令/幂等/组 group_arc
  直读零 API 扩张/程序观测/时间线/API 投影·纯函数 checker+5 单测入 hw 腿）;
  **阶段二 C2b（release Err=真机 5s 确认超时同型）四跑三态 KNOWN-FINDING**:
  L1 observed=Some(from)→Active(from)+强释迟到翻转→静息分歧+死锁（唯一出口
  teardown）/L2 None→RecoveryRequired 诚实终态/L3 Some(to)→Active(to) 自洽
  （from-探针合法切换成功）; 规范跑 findings=12 不 gate exit（观察≠判据）;
  **发现三条**: ①[P1] 真机物理 cutover 在 release（force_open 只开屏障不回拨
  selector）非 switch(); release 失败恢复观测读于屏障拆除窗→迟到翻转→L1
  死锁（真实超时同后果·mock F2 掩盖）②[P2] 恢复观测非确定（三跑三态）③
  [P2] C3 类 fence 周期留 PTS 基线伪影→下一切换 ①a FailClosed（3/3 复现）
  遮蔽 RecoveryRequired 拒收形态（unknown 非 permanent·状态机未破坏·恢复
  rebase tl+1 在案）——修复建议=恢复落定后移至 guard Drop 强释之后（核心域
  文件·另裁）; 盒矩阵终态代码 fmt0/clippy×3=0/229/229/**429（含 r64_storm）**/
  **273（268+5 checker）**/gates bin 31a00197 exit0; 证据盒 r64-recovery 9 件
  （canonical+attempt1-4 全档+mock-storm-matrix）md5 盒=origin; R64-0 基线
  审计=HEAD faa9b8d 干净·PR#30 OPEN 未 merge·R63-A 五文件中 R63-B 仅开
  program_execution 四处边界确认; R64-6 30min 基线脚本已上盒启动（九项显式
  谓词经计划批准）——补章归下一 commit; 报告=docs/superpowers/reports/
  2026-09-06-a2-8-05-r64-control-plane-recovery-acceptance.md + 主账 §94;
  **发现①②③裁决→（修复轮若裁）→R64-6 完成→Step 15（2h/8h/24h）→Step 17
  Preview RC→链末收口——待用户指令**]**

  **[R64-6 补章（2026-09-06·commit 2）: 30min 稳定基线结果（bin e08978e1
  重建钉扎·VERDICT FAIL 5/9 按原样交付——未改谓词未重跑刷绿）: 实质数据
  全绿=60/60 切换 executed+preserved（tl 恒 0·R53 签名逐周期）·replay 12/12
  原样·854 并发查询全 200 ~1ms（max 1.26ms）·fd 14→14 零漂移·RSS +12MB 无
  爬升·零丢弃零 critical·frames 全程推进; 四项 FAIL 定性=threads 29-31
  有界振荡（per-connection 模型本性·无增长趋势·"恒定"字面语义归裁）+
  plus60/tracks 两项谓词实现取样伪影（绝对纪元 0→60 恰+60·readbacks 60/60
  observed==target=数据满足批准语义）+watchdog_ticks 测量缺口（warn 日志级
  遮蔽 info 级 tick 与 teardown 行·非 watchdog 失败·下轮 info 级重测）——
  无一项指向系统缺陷·是否重测归裁决; 证据盒 r64-stability-30m 19 件 md5
  盒=origin; 报告 §9 + 主账 §94 补行]**

  **[R65-A0 契约段（2026-09-07·commit 1·docs-only·基线 7e16fcc）: 用户
  R65 裁决=三发现全 BLOCKING 开修复轮（P1 迟翻死锁+P2 恢复观测非确定必修·
  P2 C3 遮蔽后置 B）·梯子 A0→A1→A2→B→R64-6'→（裁）Step15。契约=
  2026-09-07-a2-8-05-r65-physical-cutover-recovery.md §2/§3 冻结:
  ①机制更正——守卫 Drop 强释在源码层**已先于**恢复（:627-630 注释与 R64
  登记措辞失准·真缺口=force_open 即返后物理翻转迟落窗内 :829 **单发**
  observe 三跑三态）·修复=force_open 后 reconcile 前插**期望感知稳定
  再观测协议**（复用 50ms/3 轮/5s 三常量零新时间语义·只读 observed_active
  不喂时间线）; ②协议规则——executed=true 只接受连续 3 次==Some(to)·
  稳定 from 不可信（迟翻伪稳定）·None 不可信·界尽→RecoveryRequired 诚实
  终态; executed=false 普通稳定（from→abort·稳定 None→终态）·标志经
  Inner 私有 bool（chain 顶复位+:690 Ok 后置真）; ③三态落定表——分叉态
  Desired=A/Observed=A/Physical=B **从此不可构造**; ④生产触碰收敛
  program_execution.rs 单文件（比授权面窄·落定两函数+complete_switch/
  force_release/force_open/watchdog 全零改动）; ⑤R65-B 落点裁决记录=
  **入口早卫兵**（⓪ 前 RecoveryRequired 直接 Permanent 拒收·PTS/时间线
  零触碰·重基因 None 须选源违 absence≠false 登记为残留）——问答未获
  答复按推荐冻结·计划批准即裁决; ⑥谓词 v2 四条冻结（threads 有界 ≤4/
  逐命令 epoch+1/逐命令 observed==target/info 级 watchdog）=单独登记的
  验收谓词修订非静默改脚本; ⑦Step15/17 本轮不启动·PR#30 不 merge]**

  **[R65-A1+A2 实现与真机段（2026-09-07·commit 2）: A0 契约全量兑现——生产
  触碰收敛 program_execution.rs 单文件（settle 协议三件+Inner executed 标志+
  纯单测×3+失准注释更正; reconcile 两函数/complete_switch/force_release/
  force_open/watchdog 语义零改动）; mock 侧 P1 迟翻**首次可表达**（force_
  release 后前 6 次 observe 滞报旧源——无期望规则必落 Active(from)=L1 死锁
  形态·有则必落 Active(to)·确定性回归）+界尽诚实终态测试（振荡→5s 界→
  RecoveryRequired+Permanent 确定性两次同）; gate 阶段二重写=三变体容忍→
  **F2×10 确定性**+F4 行（regress_pts_from 阈值制锚定本轮 switch 委托后）;
  盒矩阵终态全绿: fmt0（回传 md5 双侧一致）/232/232/**434**（414+9+11）/
  **276**（273+3）/gates bin 1e4f0372/clippy×3 全 0; **真机 attempt2 规范
  exit0 failures=0**: F2×10 **10/10 确定性落 Active(to)——R64 四跑三态零
  复现**（av=2i/tl=i 逐轮精确·六平面全 OK·replay 原样·失败切换全程
  100-152ms）+F4 ⑨ 回注→确定性落 to+NewEpoch(11)+反向 preserved+teardown+
  阶段一 C0/C1/C2=F3（真 5.12s 超时闭环）/STORM/C3（c3-next 本次=permanent
  recovery-required 干净形态）全绿; attempt1 如实归档=F4 首版布尔旋钮在 ①a
  提前点火成 0a pre-begin 形态（gate 场景设计错误·产品零改动·阈值制修复）;
  工程坑: clippy manual_is_multiple_of+**R62 坑复发**（mock 测试腿在 hw bin
  构建后重建 debug bin 致 gates bin mock 化——hw bin 必须最后一次构建）;
  证据 r65-cutover-recovery 4 件 md5 盒=origin; **下一步 R65-B 早卫兵
  （A0 §3.5 已裁）→R64-6' 30min（谓词 v2）→停等 Step15 裁决**]**

  **[R65-B 早卫兵+恢复触发面收口段（2026-09-07·commit 3）: 早卫兵=
  switch_program_locked ⓪ 前 group.desired==RecoveryRequired 直接
  Err(RecoveryRequired)（Permanent）——①a PTS 喂入不再执行, R64 发现③
  遮蔽形态从根不可达·不猜源·时间线零触碰; **回归测试暴露的真实语义缺口
  一并收口**: 终态拒收后外层 result.is_err() 仍触发恢复→组不 Switching 下
  普通稳定观测会把时间线"治愈"成 Stable{observed}+epoch+1 而组仍终态=
  跨平面分歧（mock 测试 r65b_recovery_required_rejected_before_1a_pts_feed
  首跑即抓到 tl_epoch 0→1·缺口 R63-A 起潜伏）——修正=RecoveryRequired
  拒收不触发恢复+executed 标志复位先于卫兵; 盒矩阵: fmt0（回传 md5 一致）/
  232/232/**435**（434+1）/276/clippy×3 全 0/gates bin f7f7db7d（hw 构建
  最后一次）; 真机 gate-run-b exit0 failures=0——**c3-next=确定性
  permanent+recovery required（①a 遮蔽真机同样消失）**·c3-after-reject
  六平面 OK（tl 诚实停留未治愈）·F2×10 仍 10/10 确定性+F4 OK=R65-A
  零回归; 证据 r65-cutover-recovery 增至 6 件 md5 盒=origin; 下一步=
  R64-6' 30min 重跑（谓词 v2 四条·R65 后服务 bin 重建钉扎先行）→停等
  Step15（2h/8h/24h）裁决]**

  **[R64-6' 30min 重跑段（2026-09-07·commit 4·谓词 v2·VERDICT PASS
  10/10）: 入口门禁满足（R65-A/B 真机 exit0+全矩阵·用户 §十三）; bin
  2b5aa760 重建钉扎先行; 60 周期 A↔B + replay 12/12 原样 + 855 并发查询
  全 200 + /events 30 采样零 critical + teardown 完成行; 谓词 v2 全过=
  threads 有界 spread=2（29-31）·fd 14→14·RSS +2.8MB 无爬升·**epoch 逐
  命令恰 +1（1→60 连续）**·**60/60 executed+preserved**·**observed 逐
  命令==target 60/60**·frames v 31→51035/a 42→68032 推进·零丢弃·
  **watchdog tick 84→173（RUST_LOG=info 可测——v1 warn 级测量缺口消除）**;
  如实登记: 首跑 summary 9/10=v2 解析器 bug（detail 误当 status 内嵌字段
  →0/60 假 FAIL·词表实为顶层 status.status+顶层 detail/classification）
  ——原始证据零改动, 修正解析器对同一份产物重析=10/10 PASS, 首跑保留
  summary-parserbug.txt, 脚本+独立重析工具 r64-probe/reanalyze-v2.py
  修正入库; 证据 r64-stability-30m-v2 22 件 md5 盒=origin; **R65 全链
  完成（A0→A1→A2→B→R64-6'·四 commit 82834fd/b5a54b0/4250e79/本提交）
  ——停, 等用户裁 Step 15（2h→8h→24h）→Step 17→链末收口]**

  **[Step15 段·part 1（2026-09-07·Step15-0 782e290+2h rung）: 用户终裁进入
  Step 15（R65/R65-CI CLOSED·CI 7/7·PR #30 OPEN·生产九文件冻结）——探针
  参数化推广（r64-stability-long.sh + reanalyze-long.py·十谓词 v2 阈值逐字
  不放宽·30m 工件字节不动）+ 盒源码 md5=26e6cde 同态核验 + 真机 smoke
  CYCLES=6 = PASS 10/10（内嵌/独立解析器交叉复核一致）+ CI success；
  **2h rung VERDICT PASS 10/10**（240 周期: epoch 1→240 逐命令恰 +1·
  240/240 executed+preserved·observed==target 240/240·RSS +1.1MB 无爬升·
  watchdog 343→691·replay 48/48 原样·3415 查询零非-200·teardown 完成）+
  开场 gate exit0 failures=0（「错误后恢复切换」R62 用户令·F2×10 10/10·
  gates bin f7f7db7d 强制重编同哈希）；证据 r64-stability-2h（21 件）+
  r64-stability-2h-gate（3 件）md5 盒=origin；登记主账 §96+EVIDENCE-INDEX
  两行；PASS 自动续步 → 8h rung（960 周期）启动]**

  **[Step15 段·part 2（2026-09-07·8h rung）: 开场 gate exit0 failures=0
  （「错误后恢复切换」·F2×10 10/10）; **8h soak VERDICT FAIL（9/10）按原样
  交付——唯一 FAIL=switches_all_executed_preserved 959/960**: cycle 908
  （运行 7h34m 处）视频面 PTS 证据窗**自发**超时→响应诚实 executed+unknown
  「timeline 证据超时 FailClosed (pending planes:[Video])」→svc.log 单行
  WARN=**R63-A 恢复路径真实自发执行（Observed 优先落定 to·NewEpoch(1)+
  SourceSegment(to)）**→tl_ep 0→1+seg 909+DD 诚实再基准→后续 52 周期全
  executed+preserved·零死锁零发散·teardown 干净; 其余九项全过（epoch 1→960
  逐命令恰 +1·observed==target 960/960·RSS +27.8MB 无爬升·watchdog
  1379→2764·replay 192/192 原样·13659 查询零非-200）**——全程序首次自发
  （非注入）证据超时（1320 次稳定基线切换唯一一例≈0.1%）·R64 gate C2 注入
  形态的自发对应·系统行为符合 R65/R63-A 设计·定性归用户裁决; 证据
  r64-stability-8h（21 件）+r64-stability-8h-gate（3 件）md5 盒=origin·独立
  解析器同 verdict; 登记主账 §96+EVIDENCE-INDEX 两行; **按停点规则整梯
  停止: 24h rung 未启动——Step 15 = 2h PASS + 8h FAIL 停等用户裁决]**

  **[Step15 段·part 3（2026-09-07·S15-E01 RCA·只读）: 用户裁决=维持 8h
  FAIL（不可改 PASS）·24h 不启动·生产+阈值双冻结·cycle 908 升格独立事件
  S15-E01（spontaneous recovery event）·指令只读 RCA; **RCA 结论（报告
  2026-09-07-s15-e01-video-evidence-timeout-rca.md）: 不是 Video PTS 迟到
  ——⑤ segment_observed 旗门控读-竞争窗错过已到达事件**（fence 无条件
  捕获+下游 seqnum 确认成功 vs 同探针 executed 门控旗未置=同一事件双消费者
  分裂铁锚; 事件命中于 adapter switch() 的 video 翻转→executed=true 窗口;
  pending=[Video] 与 video 先翻暴露窗最长精确吻合; 工件层六面全正常; mock
  零复现=证据推进轮询驱动天然后置）; 定性=簿记层真实微观竞争（非媒体/
  硬件/deadline 层·1/1320·FailClosed→恢复→NewEpoch 完整吸收）; 修复三
  候选登记未实施（另裁）]**

  **[Step15 段·part 4（2026-09-08·S15-E01 fix3 实施+定向回归）: 用户裁决
  修复候选=③「seqnum 暂存+回放」; 实施 commit d5bc130（解冻面=switch graph
  单生产文件+gates 测试侧·R65 其余冻结文件零触碰）: EVENT 探针抽具名生产
  函数·executed 前先到 Segment 首个 seqnum 暂存 per-plane·switch() 提交点
  同临界区回放（世代归属以 fence 捕获锚为准·无锚/不匹配丢弃
  fail-closed·EvidenceInsufficient 保持）+ 四锁（计入/世代不匹配丢弃/无锚
  丢弃/install 重置——盒 hw 矩阵 276→280·default 232/mock 435 基线不变·
  clippy×3 -D warnings 0）; **真机强制竞争窗场景 VBMF_A2_8_S15E01_RACE
  （wrapper 委托前一次性注入=确定性强制非概率轰击·seam 同生产函数+同
  seqnum 配对下游确认零媒体扰动）: 11/11 preserved·~152-158ms/轮·
  program_epoch 保持 0 无 rebase·segment_id 1→11·DD·六平面检查点全 OK·
  run2 EXIT=0（run1 断言口径修正如实登记——核心判据 run1 即全绿）**;
  既有 R64 CP gate（F2×10 10/10）+dual_input（10/10）复跑全绿; 证据
  s15e01-race/s15e01-fix-r64cp-gate/s15e01-fix-dual-input-gate md5 盒=origin;
  登记 主账 §96+RCA §8+EVIDENCE-INDEX 三行]**

  **[Step15 段·part 5（2026-09-08·8h 重跑 rung·fix3 后）: **VERDICT PASS
  （10/10）——首轮 8h FAIL 唯一败项 switches_all_executed_preserved 在修复后
  全量通过（960/960·cycle 908 竞争窗零复发·tl_ep=0 全程保持无 rebase）**;
  开场 gate exit0; 其余九项全过（epoch 1→960 恰+1·observed==target
  960/960·RSS +27.4MB 无爬升·watchdog 1379→2764·replay 192/192·teardown
  干净）; 独立 reanalyze-long.py（expected_cycles=960）同 verdict; 证据
  r64-stability-8h-rerun（21 件）+rerun-gate（2 件）md5 盒=origin; **旧 8h
  FAIL 证据原样保留（新 rung 不覆盖）**; **24h 四条件核验全部成立（①定向
  测试②真机 gate③8h 10/10④RCA 闭环登记）→ 按裁决启动 24h rung
  （CYCLES=2880）]**]**

  **[Step15 段·part 6（2026-09-09·24h rung·fix3 后）: **VERDICT FAIL
  （9/10）——唯一败项=rss_bounded（首/末 1/3 均值 +86.6MB·阈值 +50MB）,
  按停点规则整梯停止等裁决**; 切换面全绿: switches 2880/2880
  executed+preserved（S15-E01 修复 24h 零复发·修复后累计 4080 次切换零
  事件）·epoch 1→2880 恰+1·observed==target 2880/2880·tl_ep=0 全程保持·
  frames 严格递增·drops 0·watchdog 4143→8291·events 1440 采样 critical=0·
  threads spread=2·fd 14→14·replay 576/576·teardown 干净; RSS 形态（只读
  报告用）: 十分位近似线性缓增 ~5MB/h 无平台化（末 5h 仍 +25.3MB·峰值
  1368.9MB@cycle 2868）·与 8h rerun 同斜率（8h 未越界 24h 越界·2h 显著
  平）·归因未做归裁决; 独立 reanalyze（expected_cycles=2880）同 verdict;
  证据 r64-stability-24h（21 件）+24h-gate（2 件）md5 盒=origin; 登记主账
  §96+EVIDENCE-INDEX 两行; **Step 15 = 2h PASS + 8h FAIL→fix3→8h rerun
  PASS + 24h FAIL——停等用户裁决]**]**

  **[Step15 段·part 7（2026-09-09/10·24h FAIL 后 RSS RCA B0+B1-DIAG·用户
  三刀框架逐刀指挥）: B0 只读审计=已有证据无任何内存构成维度（runner 仅采
  VmRSS/fd/Threads·B1 前置成立）·Evidence-01 关闭（+86.6MB=数据事实）;
  B1-DIAG 4h 外部只读构成诊断（非 rung·无 verdict）——b1-observer.sh 入库
  667e9ff（生命周期状态机/domain T0 冻结/topology 三次全量快照/procfs-only
  红线·本地两场景模拟过）·真机 workload Step15 同构（CYCLES=480·bin 重建
  f52b0161==24h 同一二进制）·observer COMPLETE/exit 0（children=0·覆盖
  95%·零错误）; **classification=ANON_GROWTH**: +11.2MB 全落 RssAnon
  （Private_Dirty/Anonymous 同量）·**离散周期事件模式（4h 仅一次 +11.0MB
  跳变@03:18 盒钟·两个 5.5MB 子步相隔 10s·其余精确平台）·与切换次数无线性
  （R²=0.04）**·topology: [heap] 3.4→4.0MB 不动·增量全在 anon rw-p 私有
  映射·mid→end 零变化; ~2h 周期×11MB/事件与 24h 斜率 5.626MB/h 精确吻合
  （24h +86.6MB≈同类事件累积）; 措辞冻结: 解释性证据·不改判 rss_bounded
  FAIL·不重评 S15-E01; 证据 b1-diag-4h（21）+-observer（11）+analysis
  （四图+表）md5 盒=origin; 登记主账 §96+EVIDENCE-INDEX 三行]**

  **[Step15 段·part 8（2026-09-09/10·RSS RCA C 线两刀·stdout-only 只读·
  用户逐刀指挥·零新实验零代码改动零落盘）: C1 业务时间对齐（C1-F1 复合/
  六收紧/C1-F1..F4/最小指纹/否证三情况/七表纪律全落地）FINAL=**NO UNIQUE
  BUSINESS ATTRIBUTION**——29 strong 事件/10 簇（剔双缺口均值 7092.8s
  σ226s CV0.032）·量子八值 5544-5628KB（4KB 页差）·全 run 仅 8 负步集中
  C07（偶发释放形态）·三时钟退化 INSUFFICIENT·首事件 7142s(24h)/7132s(B1)
  跨 run ±10s·29 事件窗+3 对照窗八业务流逐字段不可区分（最小共同业务指纹=∅·
  完整性 29/29 COMPLETE）→ Q1 YES/Q2 NO/Q3 NO=C1-F4 匿名/native 二阶段方向;
  C2 静态审计（Path E→A→B→C→D·仓库只读）: 第一方无 7100s 定时器（唯一
  600-7500s 常量=main park 3600s 醒后零动作）/无显式 5.5MB 分配点（[5.0M,
  6.1M] 常量 0 命中·无大块分配原语）/无界容器四项合计 ≤120B/s 差观测 13-77×/
  GStreamer 零显式池配置·周期为涌现非计数; **B1 拓扑逐字节复核=形态反转**:
  双连跳非新映射（VmSize 恒 2,888,904kB·[5.4M,5.7M] 新映射=0·[heap] 2h 仅
  +676kB）→既有预留区内新触页=唯一自洽形态（64MB 对齐降辅助线索·逐映射归属
  OPEN）; 裁决冻结: 两线纪律+Gate 序列 C2-O1→O2→O3→O4→FIX→回归→24h+修复
  优先级 P0-P4+绝不采用清单（禁放宽谓词/定期重启/人工压 RSS/首修复即
  malloc_trim/改 watchdog 频率）; 登记主账 §96 C 线段]**

  **[Step15 段·part 9（2026-09-10·C2-O1 mapping-closure 定点诊断刀·2.5h·v2.1 裁决
  逐字执行·非 rung）: observer COMPLETE/exit0（双时间轴 RUN_REL_S 主轴·累计制触发器·
  PRE→TRIG→POST·capture_reason 七类·identity 四元组·红线 procfs-only·本地 fixtures
  含阶梯三场景 A=DIRECT/B=REFUTED/C=PARTIAL 预验证+两真缺陷修复）; bin f52b0161==
  24h 同一; **E01/E02 准点复现**（run_rel 7150/7204·+5796/+5632kB·跨 run 首事件
  7132/7142/7150 ±18s）; **M1/M2 定位完成**=两个不同 64MiB 对齐预留（0x713004000000/
  0x713010000000）rw 头 mprotect(PROT_NONE→rw) 扩展+5584/+5588kB 且立即全触; ΣΔAnon==
  ΔRssAnon 逐 kB 零缺口·VmSize/[heap] 平直·VmData==Σ头扩展精确·两预留热身后精确休眠
  7023s 再同步扩展; 判定=**MORPHOLOGY-REFINED**（非 DIRECT: VMA 末端移动; 非 REFUTED:
  无新地址/VmSize/heap·归因主导制; =§五 MORPHOLOGY-REOPEN 分支精化成立·page-commit
  方向成立）; O1 只证 mapping 不证 arena——M 是否 arena/哪个线程=**C2-O2 待裁**; 两子步
  落两不同预留 ⇒ 两线程各一次 ~5.5MB 级分配（O2 直接输入）; 不改判 rss_bounded FAIL;
  证据 c2o1-2p5h（21）+-observer（101）+analysis 镜像 122 件 md5 盒=origin; 登记主账
  §96 C2-O1 段+EVIDENCE-INDEX 三行]**

  **[Step15 段·part 10（2026-09-10·C2-O1 模型修订+C2-O2 设计注册·用户 v3.1 终裁
  PASS/FREEZE+PASS/REGISTER·O2 执行 NOT AUTHORIZED·零新采集对 122 件既有证据机判
  重析）: 两级身份 address_extent≠reservation_envelope（四证共认·adjacency 不单独
  决定身份——R2 处 832MiB 连续链 over-merge 由 64MiB 窗口四证化解·resolved 86/87
  全 True）; 状态机新增 RESERVATION-EXTENSION（·BOUNDARY-MIGRATION/·ENVELOPE-
  INTRODUCTION≠arena creation）后即冻结; **O1 FINAL 升格链**: ANON_GROWTH→NO
  UNIQUE BUSINESS ATTRIBUTION→STATIC→MORPHOLOGY-REFINED（裁决事件非终态）→
  **RESERVATION-EXTENSION·BOUNDARY-MIGRATION**; c2rules 四句总原则+实验纪律永久句
  冻结; fixtures A/B/C/D 全绿（D=重划反回归·不得 REFUTED）; **E01/E02 机判均=
  BOUNDARY-MIGRATION**（E→R 双层归因 R1/R2·conservation +0·ΣΔAnon==ΔRssAnon==
  VmData(win) 三方逐kB全等簇 11216）; 轨迹精确定位: 恒定平台 run38→7081（7043s）·
  前奏 +40 落 (7081,7141]/+44 落 (7165,7201] 各早于大扩展 ≤60s/≤36s; pend 5796/
  5632 vs win 5584/5588 口径差披露; trigger_latency 区间登记; 已证明/未证明+
  Evidence class 表+O2 裁决矩阵控制表注册; **C2-O2 设计注册**: O2-A=ALLOCATOR-
  STRUCTURALLY-COMPATIBLE 语义（非 runtime arena identification·解释纪律禁
  "this is glibc arena X"）+Entry=existing O1 evidence satisfied no execution
  implied; O2-B=activity-correlated TID set（不答 ownership·2s 不加快·state 辅助·
  红线扩围清单待批 task/<tid> stat+ldd --version）; O2-A/B STOP 条件; O3 因果链
  硬门+O4 三态五问注册; 分析器文件化被 Mimosa 三拦→B1 先例会话内联分段执行·机器表
  （c2o1-envelope-tables+reservation-closure·v1 superseded-by）入库; 冻结维持
  rss_bounded FAIL/阈值/生产/PR #30; 登记主账 §96 新段+EVIDENCE-INDEX 行更新]**

  **[Step15 段·part 11（2026-09-10·C2-O2 执行·用户「授权」含红线扩围批复·O2-A 零新增采集→
  O2-B 真机·非 rung）: **O2-A=ALLOCATOR-STRUCTURALLY-COMPATIBLE**（40 保留形态窗口四普查点
  恒定+832MiB 链 13/13+[heap] 事件零相关+glibc 上下文·表述纪律禁 arena X·counts 仅 sanity）;
  **O2-B 真机**: observer COMPLETE/exit 0（per-tid {comm,stat} 2s 不加快·tid_stat_err 0·
  born/gone 0·**libc 钉扎 glibc 2.43**）·bin f52b0161==冻结·fixtures 四轮绿两真缺陷修复于
  部署前（task 路径段+尾空格 flap）·镜像 120 件 md5 盒=origin; **E1@7149/E2@7200 准点复现**
  （win==VmData==+5588 逐kB·机判均 BOUNDARY-MIGRATION·ASLR 全新基址 0x732284000000/
  0x732280000000 相邻 64MiB·census=40 复现·跨 run 家族 range 18s）; **visibility E1/E2=
  AMBIGUOUS**（decklinkvideosr×2 恒忙面 ev==base_max 无事件独特激活·触页 CPU 低于 10ms 地板·
  线程集 29/29/29 零漂移·STOP 纪律执行未加速）; active≠causal·ownership/因果未答=O3 职责;
  **O2 闭合→停等 O3 裁决**（O3 替代证据设计·六环硬门维持）; 冻结维持 rss_bounded FAIL/阈值/
  生产/PR #30; 登记主账 §96 新段+EVIDENCE-INDEX 三行+commit ①8631dc7②]**



  **[Step15 段·part 12（2026-09-10·C2-O3-0 静态 candidate inventory+O3 设计注册·
  用户三轮裁决 v2/v3 冻结·零盒操作零新采集零生产代码改动）: 判定 **COMPLETE
  （=inventory 完成·非 root cause complete）**——三轴清点（周期/量级/对称·file:line
  重核 12 处全一致）+三层候选分层: A Rust 显式 retention=**量级证伪**（V3: 24h 唯一
  命令 2304·容器上界 ≤1.59MB vs ≥86.6MB 差两数量级）/ B Rust→native allocation
  pressure=有 morphology-compatible 路径未证（make_mut=allocator-behavior candidate /
  ring3-compatible candidate·后三段待 O3-1 验证·永不 root cause）/ C GStreamer/native
  内部状态=仅待验证假设（三行式逐字）; **V1 recover 候选 EXCLUDED**（四 run svc.log
  11,703 行 fault/recover 零命中+O2-B born=0 双轴反证）; **V2 首事件四 run 全锁
  cycle 249**（计数坐标稳定→类加权·已注册计数候选成员级全证伪: fresh≈199≠128/256
  幂次·簇距 246±9 恒定非几何→候选空间转向非显式计数/状态累积·不跳机制层）; 附带:
  四 run cycle 3 同量级 +5.46MB 温启量子·24h 簇质量时变; 无 Rust 干净周期/量级候选
  （~7100s 触发器静态不可见·"静态清点边界"披露）; O3 设计注册执行停等独立授权:
  六环硬门逐字+c2rules+解释纪律+**E2 判读四行表冻结**（分叉证据非因果·消失≠
  "双输入路径导致泄漏"·异常=INCONCLUSIVE）+E2 单一问题句+VBMF_DIAG_INPUTS=1
  config-only 形态（单输入路径逐字节保持·program graph 不构建·bin/runner/十谓词/
  +50MB 全不变·2.5h·不因结果不漂亮延长）+FIX 原则 A 复用>B 上限>C 真释放>D pool
  回收（malloc_trim 永不入产）+验收预冻结 smoke→2h→8h→24h·阈值不变·RCA 诊断字段
  diagnostic-only; 状态链 O1 PASS→O2-A COMPATIBLE→O2-B AMBIGUOUS→O3-0 COMPLETE→
  registered→**STOP 停等 O3-1/E2 独立裁决**; 证据 c2o3-analysis 两件本地生成; 登记
  主账 §96 新段+EVIDENCE-INDEX 一行]**
