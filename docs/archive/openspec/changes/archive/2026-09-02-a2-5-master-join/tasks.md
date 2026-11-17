# Tasks — a2-5-master-join

> 四栏纪律。七刀链（用户裁定）：00 Probe → 01 Shape → 02 输入/输出模型 →
> 03 实现 → 04 ProgramMaster+AVSync → 05 Semantic Review → 06 收口。

- [x] 1. A2-5-00 SoT Probe: V0.2 Join 侧全景（§1.20/§8.9/§8.10/§8.11/
  §3.8+§3.13/11 出现点）+ 代码现状复核（Join/ProgramMaster/AVSync 零代码
  未变）+ 十危险点双锚表 + OQ-A..E/PD-1..4 + 报告落
  docs/superpowers/reports/2026-09-02-a2-5-master-join-sot-probe.md
  `Contract: V0.2 §1.20 L155+§8.9-8.11+Errata-9+A2-4 Boundary Contract` | 
  `Implementation: 已` | `Verification: 十危险点全双锚·零 .rs diff` | `Gate: 无`
- [x] 2. 用户对 OQ-A..E 逐项裁决（2026-09-02 终裁落 probe 报告 §8: A Join 出
  判定声明/Runtime 消费 / B ProgramMaster=组合根禁展平 / C AVSync 声明面+
  DB≠SoT / D classification input 归 Join·action 归 Runtime / E 禁 
  all==MASTER_JOINED+禁 Participating→Ready; R-A..R-J 硬约束升级）
  `Contract: 用户裁定权` | `Implementation: 已` | `Verification: probe §8` | `Gate: 无`
- [x] 3. A2-5-01 Domain Shape Probe（16 项必查 D1-D16 全证据）: 三 Master 
  API 非对称无公共 trait / 零隐性 Join 类型·零 AVSync·零组合根·零投影·零
  wire 占名 / **三大新发现: offset/drift 已被 ClockObservationState 占用须
  消歧·SupervisorAction 已有家 Join 零 action 词·AgentState::Ready 占用故
  Join 端口禁 Ready 词** / D13 零合法时间类型 / D14 PTS 前体在 gate 观测域 /
  D16 五端点冻结 Join 零消费面; **零真契约冲突**; 报告=
  docs/superpowers/reports/2026-09-02-a2-5-master-join-shape-probe.md
  `Contract: 终裁 §九 16 项清单+R-A..R-J` | `Implementation: 已（零 .rs diff）` | 
  `Verification: 16 项全有代码实锚` | `Gate: 无`
- [x] 4. A2-5-02 输入/输出模型裁定（**用户终裁 CLOSED @462f74f**: 四项全
  APPROVED + 矩阵优先序修正——failure/C′ 不受 readiness gate, None=Option
  语义非第四值; 报告=docs/superpowers/reports/2026-09-02-a2-5-master-join-
  02-adjudication.md 含 12 条 03 实现红线; Design §1 已标 supersede）
  `Contract: 02-adjudication §1-§4` | `Implementation: 已（终裁报告+Design 同步）` | 
  `Verification: 矩阵五步/三件分离/消歧六锁死全落` | `Gate: 无`
- [x] 5. A2-5-03 首刀: `src/program/master_join.rs` 最小生产模型 + 纯函数
  矩阵测试——MasterJoinResult 三值（serde+快照+跨平面拒收 READY/NOT_READY/
  RESTART/UNKNOWN/NONE）/ AVSyncClassification 四值（Default=Unknown; 消歧
  三不 doc）/ MasterJoinInput 组合参数（avsync 非 Option; failed 事实参数
  注入; PartialEq-only 含 f32 同律）/ JoinEligibility（复用 is_program_
  scope_master; ready 合取 8 组合表驱动）/ JoinClassificationInput（avsync
  透传+inconsistency）/ `join()` 纯函数五步优先序（行 1/2 合并条件保短路
  序, clippy if_same_then_else）; 5 测试: 词表锁/eligibility 矩阵/Result
  优先序（红线 11/12: C′ 与 failed 均在非 Ready 场景实证）/ 红线 3（AVSync
  Failed 不改 Result）/ classification_input 联动; **不碰 ProgramMaster/
  transport/Runtime wiring**（按终裁 §5 边界）
  `Contract: 02-adjudication §2 真值表+§4 十二红线` | 
  `Implementation: 已` | `Verification: 盒上 program::master_join 5/5 + 
  mock 287（282+5 恰）+ clippy 4-combo PASS + fmt clean` | `Gate: 无`
- [x] 6. A2-5-04 Shape/Consumer Probe（零代码）: 组合先例实查
  （CanonicalRuntimeState 顶层组合根 + PortMediaSemantics"整值组合绝不
  平铺"终审红线; D14 serde(default)=additive 先例不适用新生儿）+ ProgramMaster
  域外零消费（A2-6 首个未来消费者）+ 形态提案（四字段整值组合/compose 
  唯一入口/Default/serde 零 default/键集恰四）+ AVSyncClassification 层级
  钉死（唯一家 master_join.rs·ProgramMaster 零持有·数据流单向）; 报告=
  docs/superpowers/reports/2026-09-02-a2-5-master-join-04-probe.md + Design §2'
  `Contract: A2-5-03 终裁（04 先 Probe）+OQ-B` | 
  `Implementation: 已（提案待裁）` | `Verification: 先例/消费面全实锚` | `Gate: 无`
- [x] 7. A2-5-04 实现（终裁 IMPLEMENTATION GO + 3 收紧执行）: 
  `src/program/program_master.rs`——ProgramMaster 四字段整值组合 + compose 
  纯组合唯一入口（行为证: "矛盾" join_result 原样保留=零重算）+ Default 
  收紧语义 doc（结构性零参便利, 非健康/就绪/故障宣称）+ 4 测试覆盖 
  PM-01..08（compose 纯度/键集**正反向**（正向四键必存在+反向 17 平铺
  污染键禁入）/三 Master 缺字段 fail-closed + join_result 缺失=Option 
  内建 absence（**实现级发现: serde Option 缺失→None 是内建语义, 恰=终裁
  §8 "Option 本身已表达 absence"**）/Result 三态携带往返）; mod.rs 挂载;
  零 from_join/channel_id/scope/serde(default)
  `Contract: 04 终裁 3 收紧+PM-01..08+禁入清单` | 
  `Implementation: 已` | `Verification: 盒上 program::program_master 4/4 +
  mock 291（287+4 恰）+ clippy 4-combo PASS + fmt clean` | `Gate: 无`
- [x] 8. A2-5-05 Semantic Review: **inconsistency 深化=维持 bool 零字段
  追加**（消费者反推三问取证: A2-6 投影先例=to_api_* 整对象映射非 predicate
  位/Runtime classify 零代码且先例输入=事实集合（fault_trigger_from_events
  形态）/Watchdog 与 Join 零既有接口经 A2-6 转接——reason/failure_domain
  candidate 无消费者请求+分类职责归 §8.9（红线 8）+加法路径畅通
  （Input/Output 无 wire 契约）+God Object 风险实锤）; C′→Runtime/Safety
  投影边界复核=维持 A2-4-04 §3; 全模型语义复核零越界 + 04 措辞修正
  （compose=唯一的显式语义组合入口, 与现有 Master 同一 pub-field/serde
  构造信任模型）; 报告=docs/superpowers/reports/2026-09-02-a2-5-master-
  join-05-semantic-review.md
  `Contract: 04 终裁（05 五项检查）+R-A..R-J` | 
  `Implementation: 已（.rs 仅措辞）` | `Verification: 盒上 program 域 39/39
  零行为差异` | `Gate: 无`
- [x] 9. A2-5-06 收口+交付链: 盒上全矩阵（14 步 ALL_DONE, test 194/194/291/194）+ verify 报告 + guards（record-check）
  + archive + PR + CI 七 checks + merge + memory
  `Contract: 交付纪律` | `Implementation: 待` | `Verification: 后续核` | `Gate: CI/RELEASE`
