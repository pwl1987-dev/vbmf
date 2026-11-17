# Tasks — a2-4-metadata-master

> 四栏纪律。本 change = A2-4-00 SoT Probe（零代码）。执行纪律（用户裁定冻结）:
> comet-open → probe 报告 → design guard → handoff → STOP 等裁决。

- [x] 1. A2-4-00 SoT Probe: 七项必答+Q8 强制检查全证据落袋（V0.2 §3.7 拓扑原文/
  §3.1 METADATA+metadata_type 五值/Timecode 三重证据交叉/边界锚点/词表现状/
  阶段语义独立推导/VideoMaster+AudioMaster 零占位确认）+ 报告落
  `docs/superpowers/reports/2026-09-02-a2-4-metadata-master-sot-probe.md`
  （Evidence/Open Questions/Proposed Decisions/No-Build Gate 全节）
  `Contract: V0.2 §3.7+§3.1+§1.20+决策#29/#43+CLOCK_TIMECODE #148` | 
  `Implementation: 已` | `Verification: 报告七问全有节号级证据` | `Gate: 无`
- [x] 2. 用户对 OQ-1..OQ-6 逐项裁决（2026-09-02 终裁落 probe 报告 §7:
  OQ-1 Timecode=observation+AVSync=Join property / OQ-2 CAPTION / OQ-3 deferred
  X5 / OQ-4 五值 taxonomy+三源 topology / OQ-5 三层边界 / OQ-6 NO STAGE;
  附加红线四条 + 实施链 01→05 冻结; 批准进入 A2-4-01）
  `Contract: 用户裁定权` | `Implementation: 已` | `Verification: probe 报告 §7` | `Gate: 无`
- [x] 3. A2-4-01 词表冻结: `MetadataType` 五值（wire TIMECODE/CAPTION/SCTE35/
  KLV/SYSTEM 逐字 V0.2 §3.1+§1.13）+ `MetadataDataPlane` 单值 METADATA +
  Subtitle↔CAPTION 层级 doc + 词表快照 METADATA_TYPES + fail-closed（拒 
  SUBTITLE/SCTE_35/未知串, 测试锁定）+ 红线注释（三域差异/Timecode ownership
  四行/taxonomy≠topology）; **未写 MetadataMaster**（属 02）
  `Contract: V0.2 §3.1 L394-399+§1.13 L69+决策#43+终裁 §7` | 
  `Implementation: 已` | `Verification: 盒上 program 域 25/25（21+4 恰）+
  mock 277（基线 273+4 零回退）+ clippy 4-combo 零警告 + fmt 对齐` | `Gate: 无`
- [x] 4. A2-4-02-00 Domain Shape Probe（用户终裁: APPROVED TO PROBE, NOT TO CODE;
  12 条 NO-CODE 清单冻结）: 10 项必查全证据落袋（P01 零 payload 类型/P02 
  CanonicalSourceRef 已成熟·不新建 MetadataSourceId/P03 零 program identity/
  P04 scope=结构归属/P05 events 时间字段计数 0/P06 组合非复制/P07 零容器/
  P08 data_plane 两案/P09 enum+Option 复合惯例/P10 A2-5 零预留）+ Candidate 
  A/B/C 对比（B 基座⊃C source 维度, A 被 P01 否决）+ SQ-1..SQ-5 字段级待裁;
  报告=docs/superpowers/reports/2026-09-02-a2-4-metadata-master-shape-probe.md
  `Contract: 用户 §一-§二十终裁` | `Implementation: 已` | 
  `Verification: 零 .rs diff·清单完好·十项全有代码实锚` | `Gate: 无`
- [x] 5. A2-4-02 编码（SQ-1..SQ-5 终裁 + scope 补裁 + 16 行字段表冻结后）:
  Design Doc §1.5 词表先锁（编码前置纪律）——MetadataPresence 三态
  （PRESENT/NOT_PRESENT/UNKNOWN; 拒 Timecode 域 INVALID/DISCONTINUOUS/
  RECOVERED）/ MetadataJoinDeclaration 三态（PARTICIPATING/NOT_PRESENT/
  UNKNOWN + JOIN_DECLARATIONS 快照; 拒 READY/JOINED/CONSUMED/NOT_APPLICABLE/
  bool）/ MetadataFact{kind,source,presence}（无 payload/timecode/timestamp/
  scope; source=CanonicalSourceRef 复用; PartialEq+Eq only 不为对称补 Hash）
  / MetadataMaster{data_plane,facts,join_declaration}（SQ-3 入字段; Default+
  new(); 零字段级 serde(default)）; 测试 05-09（词表红线拒收/fact+master 
  JSON 键集恰三锁字段蔓延/SQ-4 正交组合断言/缺字段 fail-closed）
  `Contract: SQ 终裁+Design §1.5+16 行字段表` | `Implementation: 已` | 
  `Verification: 盒上 program 域 30/30（25+5 恰）+ mock 282（277+5 零回退）+
  clippy 4-combo PASS + fmt clean` | `Gate: 无`
- [x] 6. A2-4-03 Semantic Deep Review（零代码, 用户批准四问范围）: 六组合
  语义矩阵逐一解释（5 组合自洽 + 组合5b 矛盾上报 TQ-1 不靠测试合法化）+
  四问审查（三态自洽含 Participating+[] 快照语义收束/正交禁推导清单两条/
  fact 非隐形容器/serde 与 A2-5 消费边界兼容+两条前瞻约束 Unknown≠failed·
  Participating+空不阻断）; Design §1.5a 语义精化 D1-D4 落盘; 报告=
  docs/superpowers/reports/2026-09-02-a2-4-metadata-master-semantic-review.md
  `Contract: A2-4-02 终裁§2/§3/下一刀四问` | `Implementation: 已（零 .rs diff）` | 
  `Verification: 7342cdd diff 边界实查（禁入词 10 处全为禁令注释）` | `Gate: 无`
- [x] 7. TQ-1 终裁 C′ 落盘（NotPresent 收紧定义/Join fail-closed/不加
  is_consistent/producer-bug 定性撤销/5a 降级/三层规则）+ 4 处旧表述清除
  （Design L64+代码注释×2+测试消息——快照语义统一, 盒上 9/9+fmt 验证）+
  semantic-review 报告 §7 终裁记录（修正版六组合矩阵）; TQ-1 CLOSED,
  A2-4-03 CLOSED
  `Contract: A2-4-03 终裁 §一-§十` | `Implementation: 已` | 
  `Verification: 4 处表述 grep 清零 + 盒上 9/9` | `Gate: 无`
- [x] 8. A2-4-04 Join Boundary Review（前置九项全盘代码探针 J1-J9: Join/
  ProgramMaster/AVSync/FAILOVER/READY_TO_TAKE 全零代码; failed/health 全在
  Runtime 平面; absence≠evidence 先例=CapabilityFlag::Unknown 同构）+
  Join 判定输入矩阵 + 五态混淆防护红线 R-1..R-5 + C′ 的 Join 侧消费规则
  五条 + Gap 清单 G-1..G-4; 报告=docs/superpowers/reports/2026-09-02-a2-4-
  metadata-master-join-boundary-review.md
  `Contract: A2-4-03 终裁 §十一九项清单+V0.2 §1.20/§1.18/§3.8` | 
  `Implementation: 已（零代码）` | `Verification: 九项全有代码实锚` | `Gate: 无`
- [x] 9. A2-4-05 全回归（盒上矩阵 14 步 ALL_DONE: fmt apply+check / test×4
  =185/185/282/185 全 0 failed / clippy -D×4 EXIT=0 / build×3 EXIT=0 /
  remove-adapter PROOF OK; mock 基线 277→282 +5 恰）+ 六架构不变量 G-A..G-F
  逐项实证全 PASS（grep/结构实查, 见 verify 报告 §2）+ verify 报告 +
  交付链（guards/archive/PR/CI/merge/memory）
  `Contract: A2-4-04 终裁 G-A..G-F + 交付纪律` | `Implementation: 已` | 
  `Verification: 矩阵 14 步 + 不变量六 PASS + verify 报告` | `Gate: CI/RELEASE`
