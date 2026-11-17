# Design — a2-5-master-join（A2-5-00 SoT Probe）

## 1. 定位

探针 change 首刀：产物 = SoT Probe 报告，零代码。设计 = 探针方法论
（A2-4 已验证纪律的复用）+ A2-4 Boundary Contract 作为既有输入。

## 2. 方法论（同 A2-4-00 三原则 + Join 特有边界）

1. 不类推：Join 语义只从 V0.2 散布锚点（§1.20/§3.7/§3.8/§3.13/§8.9-8.11）
   汇总，禁"三 Master 这样所以 Join 也这样"；
2. 不自创词：V0.2 无 MasterJoin 独立词表——需新词表处全部进 OQ 待裁；
3. 缺口原样上报：ProgramMaster 形态/Join 输出落点/classify 归属等缺口
   不为"完整"补模型。

## 3. 证据源

V0.2 §1.20 L155（联合判定唯一权威句）/§8.9（Master 故障域）/§8.10（AVSync
决策链）/§8.11（三轴 UNKNOWN）/§3.8+§3.13（Errata-9）+ 代码 @1779429
（A2-4-04 探针结论复核未变）+ A2-4 归档契约（Design §1.5a-1.5b）。

## 4. 裁决面

OQ-A Join 输出×§8.9 Master 域 · OQ-B ProgramMaster 形态 · OQ-C AVSync
范围 · OQ-D classify 归属 · OQ-E 三路不对称就绪输入。

## 5. No-Build Gate

零 .rs diff；不动三 Master/Runtime/Event/Health；不冻结词表。

## 6. 后续（OQ 裁决后）

01 Domain Shape Probe → 02 输入/输出模型裁定 → 03 实现 → 04 ProgramMaster
聚合+AVSync 边界 → 05 Semantic Review → 06 Verification & Delivery Closure。
