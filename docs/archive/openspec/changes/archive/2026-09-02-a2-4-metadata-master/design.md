# Design — a2-4-metadata-master（A2-4-00 SoT Probe）

## 1. 定位

本 change 是**探针 change**：产物 = SoT Probe 报告一份，零代码。
设计 = 探针方法论本身（用户裁定冻结的执行纪律）：

```
comet-open → A2-4-00 SoT Probe → reports/2026-09-02-a2-4-metadata-master-sot-probe.md
→ design guard → handoff → STOP（等用户逐项裁决）
```

## 2. 探针方法论（防伪需求三原则）

1. **不类推**：Metadata Graph 节点/语义只从 V0.2 §3.7 原文推导，禁止"Video/Audio
   这样所以 Metadata 也这样"——探针已证实三 graph 拓扑不同（Metadata 零中间
   处理节点）。
2. **不自创词**：Data Plane/类型词表只认 V0.2 §3.1（决策 #43 唯一定义规范）+
   metadata_type 五值；`RawMetadata`/`CanonicalMetadata` 等词不存在即禁用。
3. **缺口原样上报**：V0.2 未定义处（Program/Input 边界、字段级 fail-closed
   粒度、Health Tree 缺 Metadata Master Join 节点、Subtitle vs CAPTION）进
   Open Questions，不为"代码完整"人为补齐。

## 3. 证据源与采集范围

| 源 | 采集点 |
|---|---|
| ARCHITECTURE_V0.2.md（LOCK FINAL） | §1.13 L69 / §1.20 L138-155 / §2.4 L302-323 / §3.1 L331-404 / §3.7 L759-872 / §3.8 / §3.9 L901-933 / 决策 #5/#24/#29/#37/#43 |
| CLOCK_TIMECODE_CONTRACT.md（FROZEN） | §1 #147 Clock / §2 #148 Timecode / §3 替换不变量 |
| 代码（master b378a0d） | timecode.rs / normalize.rs / runtime_state.rs L106 / program/{video,audio}_master.rs 结构体 / 全库 metadata grep |

## 4. 裁决面（报告 §3，六问）

OQ-1 Timecode 归属（源 vs Join 属性，证据冲突）· OQ-2 Subtitle vs CAPTION ·
OQ-3 Health Tree 缺节点 · OQ-4 KLV/SYSTEM 未入图 · OQ-5 Program/Input 边界 ·
OQ-6 A2-4 形态（无阶段链读法下的组合声明模型）。

## 5. No-Build Gate

零 .rs diff；不冻结词表；不改已 CLOSED 的 A2-2/A2-3 类型；报告入 reports/
（不建 probes/ 目录——用户裁定）。

## 6. 用户终裁（2026-09-02, probe 报告 §7 全文）与后续实施链

六 OQ 全裁：OQ-1 Timecode=Input-local observation / AV Sync=Join property（timecode.rs
不动不搬）；OQ-2 CAPTION=canonical wire（禁 MetadataType::Subtitle）；OQ-3 Health
Tree 张力 deferred→A2-6/X5；OQ-4 五值 taxonomy 冻结 + Graph 只三源（不凭 taxonomy
造节点）；OQ-5 三层边界（L1 observation/L2 canonical fact/L3 program-scope;
extraction 不属 A2-4）；OQ-6 **NO Stage/NO advance/NO matrix**（facts+join
readiness）。红线：三域差异表 / Timecode ownership 四行 / Video+Audio 零 diff /
A2-5 用 readiness 非 all==MASTER_JOINED。

实施链冻结：A2-4-01 词表（METADATA+五值+Subtitle↔CAPTION 层级; 不写
MetadataMaster）→ 02 shape → 03 字段+serde → 04 Join boundary review → 05
回归+guard → A2-5。**已批准进入 A2-4-01。**
