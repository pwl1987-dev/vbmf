# Design: Phase 0.7B-2C — p07b-timecode-foundation（Timecode Foundation）

## Context

冻结契约 `CLOCK_TIMECODE_CONTRACT.md` §2（#148）：Timecode 状态 `Present/Absent/Invalid/Discontinuous/Recovered`；§3 替换不变量（Clock/Timecode 源替换 GraphIntent 不变）。Gap Matrix 无 Timecode 实现项（纯新落地）。终审红线：Timecode 只描述"时间标签"——禁止 clock selection/master clock/drift correction/sync decision/resampling/timestamp correction/pipeline 引用；**不实现 parser**（Provider observation → Timecode observation → CanonicalTimecode 到此结束）；2C 合并后先 Consolidation Review 再 0.7C。

## Goals / Non-Goals

**Goals:** `CanonicalTimecode` + `TimecodePresence`（#148 词表+Unknown）+ `TimecodeFormat`（标签不解析）+ `TimecodeValue`（仅真实观测携带）+ 证据；TIMECODE-SEMANTICS-RT-01 三层；descriptor 四基础齐备。
**Non-Goals:** parser（LTC/VITC/ATC/SMPTE）；帧号计算/PTS 推导/Clock 校正；格式族扩充；Session/五文件触碰。

## Decisions

- **D1 presence 词表**：#148 五态 + `Unknown`（无观测源前置态，真机合法——与 0.7B-2A Clock 的 Unknown 同构处理；词表快照测试防静默增删）。
- **D2 格式族最小化**：`TimecodeFormat { Ltc, Vitc, Embedded, Unknown }`——终审建议的最小集，**只作 canonical 标签**；ATC/SMPTE 等格式族扩充留后续（不做擅自扩充）。
- **D3 value 防臆造**：`value: Option<TimecodeValue>`——仅 presence=Present 且有真实观测时 Some；`unknown()/absent()` 恒 None。**绝不**在无观测时生成 00:00:00:00（测试锁定）。
- **D4 Invalid 保证据**：`observe_invalid(code, detail)` → presence=Invalid + evidence——解析/观测异常**不得**悄悄转成合法 Timecode。
- **D5 Discontinuous/Recovered 是观察事实**：仅作为 presence 值存在（构造自观测），类型层无"修正/恢复动作"方法（Recovered ≠ 修复操作）。
- **D6 frame_rate 语义隔离**：`frame_rate: Option<(u32,u32)>` = 标签所属媒体的帧率（如 30000/1001 drop-frame 场景需要），**语义上 ≠ Clock 的 rate**——文档锁定 + 字段注释 + 隔离测试（Timecode 类型与 CanonicalClockDomain 零引用路径，serde 互不含对方字段）。
- **D7 零决策红线（白盒）**：公开面 allowlist 硬编码清单（构造器除外），防 clock/sync/resample/correct 类 API 静默进入——同 0.7B-2A 先例。
- **D8 normalize 联动**：`CanonicalMediaDescriptor` 增 `timecode: CanonicalTimecode` 平级字段（四基础齐备：video/audio/clock/timecode）；`normalize_input` 恒 `CanonicalTimecode::unknown()` + 既有诊断不变；0.7B-1/2A/2B 既有测试构造点同步（编译级小改）。

## Risks / Trade-offs

- descriptor 增字段 → 0.7B 系列既有测试构造点需同步（机械小改，风险低）。
- `TimecodeValue` 裸 u32 四元组无越界校验（23:59:59:xx 上界）：0.7B-2C 无解析器即无校验依据；校验属 parser 阶段（登记不必要——parser 本身就是后续阶段的显式范围）。
- Hardware 层只证明"能观察/描述"——READY 态无 timecode 观测 → Unknown 输出（与 0.7B-2A/2B 同边界）。
