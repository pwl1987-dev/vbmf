# Phase 0.6 — Executable Acceptance Specification 可执行验收规范

> **状态**：📋 计划中 (前置: Phase 0.5 = UX BASELINE LOCK FINAL)
> **范围**：Reference A1/A2/B + 10 Fault Injection / Failure-Domain Tests (FI-01A/B/02~09) + 7 Health Invariants tests
> **目的**：在 V0.2 架构基线上做**真实部署 / 真实故障注入**，把 22 轮 review 锁定的 7 Health Invariants / 10 FI (FI-01A/B/02~09) / 3 Switch Mode 全部转成可执行测试。

## 0. V0.2 语义对齐 (Phase 0.5C 锁定)

Phase 0.6 的 latency 验收**不写**协议式保证 (e.g. "< 100ms"), 而是:

```yaml
target:
  source: hot_standby_levels.target_failover_time_ms   # V0.2 锁定, Policy 字段

acceptance:
  measured:
    source: failover_benchmarks                        # V0.2 独立 runtime 实测
    metrics: [p50, p95, p99]
    required:
      p95_lte_target: true
```

**禁止:** 任何验收项写 `切换时延 < Xms` 形式。**正确写法** 总是 `target + measured p50/p95/p99` 形式。WARN 与 PASS 严格分离, PASS 必须实测值。

## 目标

```
V0.2 Architecture   ──┐
Phase 0.5 Workflow   ──┤
                      ├──→ Executable Acceptance Spec ──→ V0.2 Architecture ACCEPTED
Phase 0.6 References ─┘

## Gate 流程 (G-DOC → G-DOC-READY → G-RUNTIME → G-UIUX)

  G-DOC
    ├─ tests/  (Test Case YAML, schema = SCHEMA.md)
    ├─ fixtures/  (Fixture YAML)
    ├─ env/  (Environment Prereq YAML)
    ├─ runners/  (可执行 runner 脚本)
    └─ evidence/  (证据落地)
        ↓  scripts/check_docs.py phase06  (三子门禁: STRUCTURE + COVERAGE + EXECUTOR)
  G-DOC-READY   ← [STRUCTURE]✓ [COVERAGE]✓ [EXECUTOR]✓ 三者全绿 (仅表示 "规范已完整建模且骨架可连通")
        ↓  注意: G-DOC-READY ≠ "Runtime 真实执行 PASS" (runner 当前为 HARNESS_READY 三态)
  G-RUNTIME  (A1 → A2 → B → FI-01A/B/02~07 → HA-01~07, 先 Runtime 再 UI)
        ↓
  G-UIUX  (UI-E2E-01~04 + TAKE revision 验证)
        ↓
  PHASE 0.6 ACCEPTED   (任意 Gate FAIL = NOT ACCEPTED)

> **G-DOC-READY 原则 (FLOW-01)**: 不能出现 "测试跑了 20 次才发现 Evidence/Test ID/Fixture ID/Pass Rule 不统一"。
> 先把 Harness 结构 + 引用闭环 + 规范全覆盖冻结 (check_docs.py phase06 全绿), 再开始实体测试。
> **G-DOC-READY 三子门禁 (FLOW-02)**: STRUCTURE=引用文件存在; COVERAGE=规范条目族全落地 (HA-01~07/UI-E2E-01~04/AC-03B+AC-03B-2+AC-03B-2-6/A1/A2/B/FI-01A/B/02~07);
> EXECUTOR=runner 真实化 (evaluate_pass_rule + HARNESS_READY/PASS 三态, 不再 "文件存在即 PASS")。

## Harness Layout (G-DOC 落地, GDOC-02)

```text
docs/phase-0.6/
├── README.md
├── SCHEMA.md            # Test Case YAML SoT
├── ACCEPTANCE_REPORT.md # Gate 结果 + 覆盖矩阵
├── tests/               # 24 Test Cases: AC-01-001 / A2-001 / B-001 / AC-03B-001 / AC-03B-2-001 / AC-03B-2-6-001
│                        #   FI-01A/B-001, FI-02~07-001 / HA-01~07-001 / UI-E2E-01~04-001
├── fixtures/            # F-A1-PASS / F-FI-01A-SDI-FREEZE / F-FI-06-MASTER-JOIN / F-FI-07-RECORDING / F-AC03B2-* / F-HA-0X-* / F-UI-* ...
├── env/                 # ENV-LAB-01.yaml (真实地址 <LAB_HOST> 占位, 私有 manifest)
├── runners/             # run_reference_a1.py / run_fi_matrix.py / run_ui_e2e.py
└── evidence/            # {test_id}_{run_ts}_{pass|fail}.json
```

闭环: **Test Case → Fixture → Environment → Runner → Evidence → Pass Rule** (machine-decidable)。
Runtime 层 (AC-*) 可由 JSON-RPC/CLI 旁路; **UI 行为 (UI-E2E-*) 不可旁路 UI** (Playwright 不稳定时仍可渲染校验, 但 click 路径须保留 — UX-02)。


## 0.5 · 验收闭合度治理 (0.5F.19 补, 关闭 EXEC-01 / UX-01 / DOC 缺口)

### P1-3 · Surface → E2E Chain → Acceptance 覆盖矩阵
Registry 已区分 **Surface Contract Count (56) / Implemented Wireframe Count / Spec-only Count**, 但 Phase 0.6 不能只用 3 条 E2E 链 (UI-E2E-01/02/03) 反推 "全部 32 LOCK Surface 导航闭环"。必须显式声明覆盖关系:

| E2E Chain | 覆盖 Surface 域 | Acceptance ID | LOCK 覆盖 | 说明 |
|---|---|---|---|---|
| UI-E2E-01 Profile→Bundle→Channel→Apply→Runtime→Output | ENGINEERING (P-21/22/23...) + BROADCAST (CD-01) | AC-01/AC-02/AC-03 | Partial | 主配置闭环, 非全 LOCK |
| UI-E2E-02 Asset→Transcode→Asset Version→QC | MEDIA (M-11/12/13/15/16) | AC-02 | Partial | File 转码闭环 |
| UI-E2E-03 Channel→Session→Output→Health | BROADCAST (CD-01) + M-17 Realtime Session | AC-03B/HA-01~07 | Partial | Runtime 闭环 |
| **Navigation Closure (新增 Reference)** | 全部 32 LOCK Surface | **UI-E2E-04 Nav Closure** | **Full (claim)** | 必须在 Acceptance Report 逐 Surface 声明 Covered/NotCovered, 不得用 3 链通过 ≡ 56 导航通过 |

> 规则: **"E2E 三条链通过" ≠ "所有 LOCK Surface 导航闭环通过"**。UI-E2E-04 须在报告中以 `Surface ID → Covered(Y/N) → Evidence` 逐条列出。

### P1-9 · Executable Harness 字段规范 (从 Markdown checklist 推进一层)
每条 Test Case 必须含以下机器可读字段 (0.5F.19 起, 关闭 "Phase 0.6 已可执行" 误判):

```yaml
test_case:
  id: AC-01-001              # 唯一 Test ID
  fixture_id: F-A1-PASS      # 关联夹具 (见 Switch Test Matrix)
  env_prereq_id: ENV-LAB-01  # 环境前置 (见部署环境)
  runner: <command/script>   # 执行命令或 harness 入口
  expected: <machine_result> # 确定性期望 (含 p50/p95/p99 阈值)
  evidence_path: <artifact>  # 证据路径 (log/screenshot/metric dump)
  pass_rule: <bool expr>     # 判定式
  retry_rule: max=1, backoff=30s
  abort_rule: consecutive_fail>=3 → HALT Gate
  artifact_naming: "{test_id}_{run_ts}_{pass|fail}.json"
```

> 当前 `docs/phase-0.6/README.md` 为 **Acceptance Specification** (已成型); 升级为 **Executable Acceptance Harness** 须补上述字段 + 统一 runner, 列为 Phase 0.6 启动首务 (不阻塞 0.5 冻结)。

## 交付物

### Reference A1 — PACKET_SWITCH 基础能力

**输入**：预对齐压缩源 A / B（同 codec / container / 时间戳 / GOP）

**目的**：验证 Capability Contract / Runtime Alignment / Mandatory Attributes 全部通过

**架构链路 (PACKET_SWITCH: COMPRESSED → Switch → COMPRESSED，V0.2 §3.4 锁死；此路径不插入 Encode)**：
```
Source.A (COMPRESSED) ─┐
                        ├── PACKET_SWITCH ──→ SRS ──→ HLS
Source.B (COMPRESSED) ─┘
```
> Encode 仅在 `RAW → Encode → COMPRESSED` 时出现（见 Reference B / Program Master delivery boundary），**不在 PACKET_SWITCH 路径内**——否则等于把已压缩数据重新编码一次，破坏 PACKET_SWITCH 的验证目标。

**验证项**：

- [ ] Capability Contract: **Mandatory Compatibility Attributes = ALL PASS**（V0.2 §3.4 Canonical；不写固定数字，未来可继续追加 attribute）
- [ ] Runtime Alignment: **Required attributes = ALL PASS**（GOP/IDR/PTS/DTS/timebase/SPS/PPS/audio continuity）
- [ ] WARN ≠ PASS（PACKET 严格要求 PASS）
- [ ] Switch decision tree 选 PACKET_SWITCH
- [ ] `target_failover_time_ms` 来自 `hot_standby_levels`（V0.2 锁定，**非协议保证**），由 `failover_benchmarks` 独立实测 p50/p95/p99
- [ ] 反复切换 100 次，零异常
- [ ] 24h 持续运行无崩溃

### Reference A2 — 真实 SDI 主备

**架构链路 (FRAME_SWITCH = RAW → Switch → RAW；MASTER_SWITCH = RAW → Normalize → Master-level Switch → RAW；Encode 是 Program-scope Master 的 delivery boundary，位于 Switcher 之后，不在切换输入侧)**：

FRAME_SWITCH（含真实 SDI ingest 层）：
```
BMD DeckLink SDI-A ─→ GStreamer ingest ─→ RAW ─→ Normalize ─→ RAW ┐
                                                                     ├── FRAME_SWITCH ──→ RAW
BMD DeckLink SDI-B ─→ GStreamer ingest ─→ RAW ─→ Normalize ─→ RAW ┘
                                                                     ↓
                                                           Program Master
                                                                     ↓
                                                                   Encode
                                                                     ↓
                                                                     SRS
                                                                     ↓
                                                                     HLS
```
> **SDI ingest 落点**：`BMD DeckLink → GStreamer → RAW` 由 **Rust Media Agent** 拥有生命周期（见 `docs/architecture/TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md` GSTR-01 / F4）。GStreamer 是 Media Pipeline Execution Technology，非独立服务。Fixture（真实硬件）须覆盖 `DeckLink → GStreamer → RAW` 全链路，文件级 fixture 与真实硬件 fixture 不得出现两套 SDI 语义。

MASTER_SWITCH（含真实 SDI ingest 层）：
```
BMD DeckLink SDI-A ─→ GStreamer ingest ─→ RAW ─→ Normalize ─┐
                                                             ├─→ MASTER_SWITCH
BMD DeckLink SDI-B ─→ GStreamer ingest ─→ RAW ─→ Normalize ─┘
                                                             ↓
                                                   Program Master
                                                             ↓
                                                           Encode
                                                             ↓
                                                            SRS
```

**关键点**：
- 独立 FFmpeg 编码器**天然不具备 PACKET switch 所需的精确对齐**
- 真实 SDI 主备默认走 **FRAME / MASTER 切换**
- 除非已做外部对齐

**验证项**：

- [ ] SDI 输入识别（BMD DeckLink dv0 / dv1）
- [ ] Normalize 后 Master 统一（Program-scope Master）
- [ ] FRAME_SWITCH 触发条件（codec/format/color space 异源）
- [ ] MASTER_SWITCH 触发条件（异构主备 / 不同色域）
- [ ] AV sync 测量（Master Join 处）
- [ ] `target_failover_time_ms` 来自 `hot_standby_levels`（V0.2 锁定，**非协议保证**），由 `failover_benchmarks` 独立实测 p50/p95/p99
- [ ] 24h 稳定

### Network Source Acceptance (UDP UNI / ASM / SSM)

UDP 网络源必须按三种模式各自独立验收（**不能**合并成单一 "Multicast Address" 字段）：

| Fixture | 必填字段 | 验收点 |
|---|---|---|
| **UDP-UNI** | Remote IP / Remote Port / Interface | 单播可达；Interface 绑定正确 |
| **UDP-ASM** | Group / Port / Interface / IGMP Join | IGMPv2 加入组；多接收者 |
| **UDP-SSM** | **Source IP** / Group / Port / Interface / IGMPv3 | **Source IP 不可丢**（SSM = (S,G)）；IGMPv3 仅收指定源 |

**验证项**：

- [ ] E-40 Source Wizard 按 Source Kind = Network 动态渲染上述三套 schema（非单一 Multicast 字段）
- [ ] SSM 校验 **Source IP 必填**，缺省拒绝（否则 ASM/SSM 混淆）
- [ ] IGMP 版本随模式切换（ASM → IGMPv2 / SSM → IGMPv3）
- [ ] 三模式各自独立 Fixture，实测可达后进入 A2/B 切换链

### Reference B — 异构源 + 图文 + 多 Master

**架构链路**：
```
SDI  ─┐
      ├─ Normalize ─→ MASTER_SWITCH ─┐
SRT  ─┘                                ├─ Program Master
                                      │   (Video / Audio / Metadata)
Composition ───────────────────────┤
Audio Mixer / Loudness / Delay ─────┘
                                      │
                                      ▼
                                     SRS
```

**覆盖**：
- RAW + COMPRESSED 异构
- MASTER_SWITCH 决策
- Composition（Program + Variant 双层）
- Audio Mixer / Loudness / Delay
- Program Master 三独立 graph

**验证项**：

- [ ] 异构源 Normalize 成功
- [ ] MASTER_SWITCH 选型
- [ ] Program Composition + Variant Composition 渲染（RAW 域）
- [ ] Encode = delivery boundary
- [ ] Audio 三独立 graph 同步
- [ ] 多路 Output Variant 同步
- [ ] 多路 Output Variant 故障隔离：Program Master HEALTHY + {HLS HEALTHY, RTMP HEALTHY, **WHEP DEGRADED**} → Channel = **DEGRADED**（WHEP=Required）或 **HEALTHY**（WHEP=Optional）
- [ ] Variant failure ≠ Program Master failure（Failure Domain = OUTPUT，按 variant 独立判定；Required/Optional 影响 Channel 总判定）
- [ ] Program Scope Composition 跨所有 Variant 共享（e.g. 全台 Logo 出现在每一个 Variant）
- [ ] Variant Scope Composition 仅作用于目标 Variant（e.g. 平台水印只出现在 Variant A、区域版权贴片只出现在 Variant B）
- [ ] Acceptance: 共享 Logo 在所有 Variant 一致；平台水印仅目标 Variant 出现（**禁止**把 Composition 全部提前到 Program Master）

### 10 Fault Injection 故障注入 (FI-01A/B/02~09, 0.5F.19 补 FI-06 MASTER / FI-07 RECORDING; 0.6 启动前 Doc Patch 统一 5→7→8; 2026-11-27 M0 对账补 FI-08 INGEST-CRASH / FI-09 AGENT-RESTART ⇒ canonical 10 / 10 FI canonicalization)

| # | 故障 | Failure Domain | 期望恢复 | 期望 Channel Health |
|---|---|---|---|---|
| **FI-01A** | Primary SDI 冻结 5s + Backup READY | SOURCE 源 | FAILOVER → Backup ACTIVE | HEALTHY (after failover) |
| **FI-01B** | Primary SDI 冻结 5s + Backup NOT_READY | SOURCE 源 | FAILOVER attempted → FILLER | DEGRADED / SAFE (Filler；非 HEALTHY) |
| **FI-02** | 音频静音 8s（injection_point: Audio Mixer / PIPELINE）| PIPELINE 管道 | RESTART audio node | DEGRADED → HEALTHY |
| **FI-03** | Primary FFmpeg 进程崩溃 | PIPELINE 管道 | RESTART + RESUME | DEGRADED → HEALTHY |
| **FI-04** | Clock Drift +5ms/min | CLOCK 时钟 | FALLBACK to TIMECODE | DEGRADED (CLOCK_DEGRADED event) |
| **FI-05** | HLS 切片失败 | OUTPUT 输出 | RESTART_ADAPTER → alternate | DEGRADED → HEALTHY |
| **FI-08** | GStreamer ingest 进程崩溃（SDI-A） | SOURCE 源 / PIPELINE | Agent detects → restart GStreamer pipeline → DeckLink session recover | DEGRADED → HEALTHY |
| **FI-09** | Media Agent 主动重启（kill -TERM） | MEDIA RUNTIME | GStreamer pipeline + DeckLink session + downstream state 全量 recover | DEGRADED → HEALTHY |

#### FI-01A · Primary SDI 冻结 + Backup READY（SOURCE 源）
- **injection**：Primary SDI 输入冻结 ≥5s（injection_point: SDI Input / SOURCE）
- **期望恢复**：FAILOVER → Backup ACTIVE
- **期望 Channel Health**：HEALTHY (after failover)
- **deterministic**：冻结 detection ≥5s → 触发 FAILOVER；Backup READY 前提下切换成功；退出 DEGRADED = Channel Health = HEALTHY 且稳定 ≥30s

#### FI-01B · Primary SDI 冻结 + Backup NOT_READY（SOURCE 源）
- **injection**：Primary SDI 输入冻结 ≥5s（injection_point: SDI Input / SOURCE）+ Backup NOT_READY
- **期望恢复**：FAILOVER attempted → FILLER（emergency asset）
- **期望 Channel Health**：DEGRADED / SAFE（Filler；非 HEALTHY）
- **deterministic**：冻结 detection ≥5s → 尝试 FAILOVER；Backup NOT_READY 时不得切源、须落 FILLER；TAKE/B-13 门禁保持 BLOCKED

#### FI-02 · 音频静音（PIPELINE 管道）
- **injection**：Audio Mixer 输出静音 ≥8s（injection_point: Audio Mixer / PIPELINE）
- **期望恢复**：RESTART audio node
- **期望 Channel Health**：DEGRADED → HEALTHY
- **deterministic**：静音 detection ≥8s → RESTART audio node；退出 DEGRADED = Audio Health = HEALTHY 且持续 ≥30s

#### FI-03 · Primary FFmpeg 进程崩溃（PIPELINE 管道）
- **injection**：Primary FFmpeg 进程 SIGKILL（injection_point: FFmpeg / PIPELINE）
- **期望恢复**：RESTART + RESUME
- **期望 Channel Health**：DEGRADED → HEALTHY
- **deterministic**：进程丢失 detection ≤5s → RESTART；RESUME 后无 PTS discontinuity；退出 DEGRADED = Pipeline Health = HEALTHY 且持续 ≥30s

#### FI-04 · Clock Drift（CLOCK 时钟）
- **injection**：Clock Drift +5ms/min，注入 ≥10min 累积 +50ms（injection_point: PTP/系统时钟 / CLOCK）
- **期望恢复**：FALLBACK to TIMECODE
- **期望 Channel Health**：DEGRADED（CLOCK_DEGRADED event）
- **deterministic**：drift > 50ms → FALLBACK to TIMECODE event；退出 DEGRADED = Clock Domain = LOCKED 且 drift < 10ms 持续 ≥60s

#### FI-05 · HLS 切片失败（OUTPUT 输出）
- **injection**：HLS 切片连续失败 ≥3 次（injection_point: HLS Adapter / OUTPUT）
- **期望恢复**：RESTART_ADAPTER → alternate destination
- **期望 Channel Health**：DEGRADED → HEALTHY
- **deterministic**：连续 3 次 segment gen 失败 → RESTART_ADAPTER；alternate 接管且首片成功；退出 DEGRADED = OUTPUT Health = HEALTHY 且连续 ≥5 切片成功

#### FI-06 · Audio Master Join 失败（MASTER 主母版）
- **injection**：Audio Master Join 失败（injection_point: Master Join / MASTER）
- **期望恢复**：FILLER_OR_EMERGENCY（target: emergency asset）
- **期望 Channel Health**：DEGRADED（**不得切源**）
- **deterministic**：Join failure event → 落 FILLER；不得触发 SOURCE/OUTPUT FAILOVER；退出 DEGRADED = Master Join 恢复且无 black frame ≥30s

#### FI-07 · 录制盘故障（RECORDING 录制）
- **injection**：录制盘满/不可写（injection_point: Recorder / RECORDING）
- **期望恢复**：BACKUP_DISK（target: alternate disk）
- **期望 Channel Health**：unaffected（录制独立域）
- **deterministic**：写入失败 event → BACKUP_DISK 接管；Output/Source 不受影响；退出 = Recorder Health = HEALTHY 且连续 ≥5 段写入成功

#### FI-08 · GStreamer ingest 进程崩溃（SOURCE/PIPELINE）
- **injection**：kill GStreamer ingest 进程（injection_point: GStreamer pipeline / SOURCE，device=DeckLink SDI-A）
- **前置约束**：归属 `Rust Media Agent` 生命周期（见 `TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md` §3/§4 F4）
- **期望恢复**：Agent 检测到 GStreamer 进程丢失 → 重启 pipeline → DeckLink session 重建 → 下游 Normalize/Encode/Output state recover
- **期望 Channel Health**：DEGRADED（pipeline 重建期间）→ HEALTHY（recover 完成）
- **deterministic**：进程丢失 detection ≤5s → restart；recover 后无 AV sync discontinuity；退出 DEGRADED = Pipeline Health = HEALTHY 且持续 ≥30s

#### FI-09 · Media Agent 主动重启（MEDIA RUNTIME）
- **injection**：kill -TERM Media Agent 进程（injection_point: Media Agent / MEDIA RUNTIME），由 supervisor/Orchestrator 重新拉起
- **前置约束**：Media Agent = Media Runtime Owner（GSTR-01/§4 F4）；重启须保持 DeckLink Exclusive Lease 不丢（§4 F11）
- **期望恢复**：Agent 重启 → GStreamer pipeline + DeckLink session + runtime graph + downstream state 全量 recover；active_source_id 不丢
- **期望 Channel Health**：DEGRADED（Agent 重启窗口）→ HEALTHY（recover 完成）
- **deterministic**：Agent 重启 ≤30s → 全量 recover；退出 DEGRADED = Channel Health = HEALTHY 且稳定 ≥30s；期间不得有第二进程抢占 DeckLink（F11）

> **FI 注入点锁定（P1）**：每条 FI 必须写明 `injection_point: {node, domain}`，否则 Phase 0.6 实测时两人会做出不同恢复动作。当前已锁定：FI-02 = Audio Mixer / PIPELINE。以下为**不同 Failure Domain**，须各自独立 FI，不得并入 FI-02：Source embedded_audio（SOURCE）、Loudness node（PIPELINE）、Audio Master Join（MASTER）。

#### P1-4 · Failure Domain → FI/Reference 归属映射 (0.5F.19 补, 关闭 "6 域矩阵但只测 4 域" 缺口)
Failure Domain Matrix 定义 6+ 域, 但 FI Suite 当前只显式覆盖 SOURCE/PIPELINE/CLOCK/OUTPUT。**MASTER 与 RECORDING 必须有明确验收归属, 否则 0.6 会出现"架构写 6 域, 验收只测 4 域"**:
| Failure Domain | 独立 FI / Reference | 覆盖说明 |
|---|---|---|
| SOURCE 源 | FI-01A / FI-01B | Primary SDI 冻结 + Backup 状态分支 |
| PIPELINE 管道 | FI-02 / FI-03 | 音频静音 / FFmpeg 崩溃 |
| MASTER 主母版 | **FI-06 (新增 Reference)** | Audio Master Join 失败 → FILLER_OR_EMERGENCY (target: emergency asset); 不得并入 FI-02, 不得切源 |
| OUTPUT 输出 | FI-05 | HLS 切片失败 → RESTART_ADAPTER → alternate |
| RECORDING 录制 | **FI-07 (新增 Reference)** | 录制盘满/故障 → BACKUP_DISK (target: alternate disk); 独立于 OUTPUT |
| CLOCK 时钟 | FI-04 | Clock Drift → FALLBACK_CLOCK |

> 注: FI-06/FI-07 为 **Reference 级验收** (非独立注入脚本), 可由 HA Matrix + Failure Domain Matrix 推导; 若实测资源有限, 至少须在 Acceptance Report 显式声明 MASTER/RECORDING 由哪个 HA/Reference 覆盖, 不得留白。

#### P1-5 · FI 确定性验收标准 (0.5F.19 补, 关闭 "注入→检测→恢复" 不够机械化)
每条 FI 必须补充 deterministic 字段, 否则两工程师无法做出相同测试:
| FI | 注入持续 | 检测阈值/触发 | 恢复判定 | 退出 DEGRADED 条件 |
|---|---|---|---|---|
| FI-02 音频静音 8s | 持续 ≥8s, 随后恢复音频 | 静音 detection ≥ 阈值 (默认 8s) → 触发 RESTART audio node | 节点重启且音频流恢复 | Audio Health = HEALTHY 且持续 ≥30s |
| FI-04 Clock Drift +5ms/min | 注入 ≥10min 累积 +50ms | drift > 50ms → FALLBACK to TIMECODE event | CLOCK_DEGRADED event 产生且 PTP/系统时钟回稳 | Clock Domain = LOCKED 且 drift < 10ms 持续 ≥60s |
| FI-05 HLS 切片失败 | 持续至切片连续失败 ≥3 次 | 连续 3 次 segment gen 失败 → RESTART_ADAPTER | alternate destination 接管且首片成功 | OUTPUT Health = HEALTHY 且连续 ≥5 切片成功 |
| FI-01A/B, FI-03, FI-06, FI-07 | 见各自 Reference | 见 Failure Domain Matrix `action` 触发条件 | 见 Matrix `action` | 见 Matrix 期望 Channel Health 达成并稳定 ≥ 判定窗口 |

**关键禁忌**：

- ❌ PLAYER 播放端缓存异常绝不能切源
- ❌ AV sync 异常必须先 Failure Domain Classification
- ❌ Master Join 失败 ≠ 切源
- ❌ 同一切换不能在 100ms 内重试

### 7 Health Invariants → Executable Tests

来自 `docs/phase-0.5/wireframes/09-health-tree.html`：

| # | Health Tree 状态 | 期望 Channel |
|---|---|---|
| **HA-01** | Primary=OFFLINE+FAILED, Backup=ACTIVE+HEALTHY | **HEALTHY** (Rule 5) |
| **HA-02** | Primary=OFFLINE+FAILED, Backup=STANDBY+HEALTHY | **DEGRADED** (Rule 4: pending takeover) |
| **HA-03** | Primary=OFFLINE+FAILED, Backup=OFFLINE+FAILED | **FAILED** (Rule 3: Source RG all unavailable) |
| **HA-04** | ACTIVE=DEGRADED, STANDBY=OFFLINE+FAILED | **DEGRADED** (Rule: ACTIVE DEGRADED + STANDBY(FAILED\|OFFLINE) → DEGRADED；与 HA-03 全不可用区分) |
| **HA-05** | ACTIVE=UNKNOWN, STANDBY=HEALTHY | **UNKNOWN** (Rule 6 拒收，fall to UNKNOWN) |
| **HA-06** | ACTIVE=HEALTHY, STANDBY=FAILED | **DEGRADED** (Rule 5: STANDBY+(DEGRADED\|FAILED)) |
| **HA-07** | ACTIVE=HEALTHY, OFFLINE+FAILED | **HEALTHY** (H5: 系统已吸收) |

### Failure Domain Matrix 故障域验证

```yaml
SOURCE 源:      { action: FAILOVER,            target: §3.4 }
PIPELINE 管道:    { action: RESTART_NODE,        target: offending node }
MASTER 主母版:    { action: FILLER_OR_EMERGENCY, target: emergency asset }
OUTPUT 输出:      { action: RESTART_ADAPTER,     target: alternate destination }
RECORDING 录制:   { action: BACKUP_DISK,         target: alternate disk }
CLOCK 时钟:       { action: FALLBACK_CLOCK,      target: clock_domain_mappings }
RESOURCE 资源:    { action: DEGRADE_BG_JOBS,     target: lower-priority workers }
PLAYER 播放端:     { action: NOTIFY,              fail_safe: true }    # DiagnosticFailureClass
UNKNOWN 未知:     { action: SAFE_DEGRADE,        alert: true }        # DiagnosticFailureClass
```

### Switch Test Matrix & Negative / Recovery Fixtures

每个 Reference 必须同时具备正向与负向夹具，**不能只验证 happy path**：

| Fixture | Capability | Alignment | 期望决策 |
|---|---|---|---|
| A1-PASS | PASS | PASS | PACKET_SWITCH |
| A1-WARN | WARN | PASS | 不进 PACKET，继续 Decision Tree |
| A1-FAIL | FAIL | — | 不进 PACKET → FRAME / MASTER / REJECT |
| A1-RUNTIME-MISALIGN | PASS | GOP mismatch | PACKET invalid |
| A2-PASS | PASS (RAW) | PASS | FRAME / MASTER_SWITCH |
| B-PASS | PASS | PASS | MASTER_SWITCH + Composition |

**切换压力矩阵**（不能只测 100 次人工/脚本切换；必须组合）：

- 维度：Cold / Warm / Hot × PACKET / FRAME / MASTER
- 故障组合：Forward failover · Failback · Repeated flapping · Source loss during switch · Output loss during switch · Clock degradation during switch
- 稳定性约束：`min_hold` / `hysteresis` 生效（同一切换 100ms 内禁止重试，见关键禁忌）
- Recovery 夹具：Failover → Filler / FRAME_SWITCH → DEGRADED → HEALTHY(after failover)；Failback 须满足 `min_hold` 后才回切

**TAKE 语义锁定（Acceptance Assertion）**：TAKE = Operator Intent → TakePreflightResult → Switch Command → Media Session Runtime → `active_source_id` 更新；`effective_switch_mode` 由 Decision Tree 决定。**TAKE 不是 Configuration Apply，也不是 ChangeSet Apply。**

### Profile Responsibility Boundary (Acceptance Assertion)

P-20 Profile Center / P-21 Encoding Profile 的责任边界必须锁死，防止 Packaging 职责偷偷渗入 Encoding Profile：

- **Encoding Profile**：仅 `codec / resolution / framerate / bitrate / GOP / rate-control(CRF|CBR|VBR) / 2-pass`。
- **Packaging Profile**：`container(MP4|TS) / segment(HLS|DASH) / segment-duration / playlist / manifest / DRM`。
- 两者为**独立 Profile 类型**，共享引用但运行时对象 / 状态机 / 失败恢复 / UI 分离（与 M-14 File Transcode / M-17 Realtime Session 的 Encoding↔Packaging 分离一致）。
- **禁止**：P-21 Encoding Profile 承担 container / segment / manifest / DRM；DRM 属 Packaging / Distribution 边界。
- **Packaging Profile = 第 8 个 canonical Profile kind**（OBJECT_VOCABULARY §1.3 / PRODUCT_OBJECT_MODEL §1.1）：与 Encoding / Output 三者独立（`ENCODING_PROFILE` / `PACKAGING_PROFILE` / `OUTPUT_PROFILE`）；P-20 Profile Center 新增 Packaging Tab 承载其 Registry，Output Profile (P-22) 只负责 Destination / Protocol / Distribution，不接管 container / segment / manifest / DRM。

### Encoding × Packaging × Output × Player Compatibility Preflight

Encoding Profile 与 Packaging Profile 各自合法，但组合后未必合法。Phase 0.6 Preflight 必须验证四者兼容性（不仅是单 Profile 内部校验）：

- **Encoding × Packaging**：codec / profile / level / framerate 必须与 container / segment-format / mux 兼容（e.g. H.264 + HLS + CMAF 合法；H.264 + 裸 MPEG-TS 直推 DASH 不合法）。
- **Packaging × Output**：segment / manifest 必须与 Destination Protocol 兼容（HLS→HLS Destination；DASH→DASH Destination；UDP-TS 不需要 manifest）。
- **Output × Player Capability**：目标播放端能力（Codec / DRM / Container）必须覆盖 Packaging 产出。
- **Latency Policy**：Packaging segment-duration 与 Encoding GOP / `latency_class` 一致（Ultra-Low 不可用长 segment）。

**验收项**：
- [ ] Preflight 拒绝"各自合法但组合非法"的 Bundle（e.g. H.264 + DASH-CMAF 但 Output 只声明 UDP-TS）
- [ ] Preflight 校验 Player Capability ∩ Packaging 产出 ≠ ∅
- [ ] 兼容性矩阵由 Encoding / Packaging / Output Profile 共同派生，不手写

### E2E Acceptance: Profile → Bundle → ChangeSet → Runtime → Output

完整配置生命周期必须在 Phase 0.6 以真实案例跑通一次（不是 happy path，而是 Preflight + Transactional Cutover）：

```
P-21 v3 (Encoding Profile)
  ↓ Create v4
CD-01 Channel Detail → Bundle v2 → v3 (引用新 Profile)
  ↓ Impact Preview
CH01 / CH03 / CH08 affected
  ↓ select CH01 only (不强制全量)
Bundle v2 → v3
  ↓ Preflight (Capability / Runtime Alignment ALL PASS)
ChangeSet: APPLYING → APPLIED (Logical Atomic / Transactional Cutover)
  ↓
Runtime Revision N+1 (session.apply_revision)
  ↓
Effective config changed
Output still HEALTHY (Variant 全同步: HLS / RTMP / WHEP)
```

**验收项**：

- [ ] Impact Preview 准确列出受影响 Channel（CH01 / CH03 / CH08）
- [ ] 选择性 Apply（仅 CH01）不污染 CH03 / CH08
- [ ] Preflight 失败则 ChangeSet 不进入 APPLYING（WARN ≠ PASS）
- [ ] Apply 后 Runtime Revision 单调 +1，旧 Revision 可回滚
- [ ] Apply 期间 Output 持续 HEALTHY，且 Cutover Acceptance 6 项全 PASS（见上）
- [ ] 回滚路径：Rollback → 上一 Runtime Revision

### Cutover Acceptance (Transactional Cutover 硬验收)

`Output still HEALTHY` 不等于"零可见中断"。Logical Atomic / Transactional Cutover 的真正验收必须同时满足以下连续性指标（`health == HEALTHY` 只是必要非充分条件）：

- [ ] **No visible black frame**（零黑场）
- [ ] **No audio mute**（零静音）
- [ ] **No PTS discontinuity**（PTS 连续，无跳变）
- [ ] **No unexpected frame gap / drop**（无异常丢帧）
- [ ] **No Output session interruption / restart**（Output Session 不重启）
- [ ] **AV sync within threshold**（AV 同步在预算内，通常 < ±½ frame）
- [ ] Health = HEALTHY **且** 上述 6 项全 PASS，才判定 Cutover 成功

### UI-E2E-01: Profile Revision → Selective Apply → Runtime Verification (真实 UI 点击路径)

E2E Acceptance 必须经由 **真实 UI 点击** 走通（不是测试人员直接调 API），证明 56 个 surface 之间的跳转闭环成立：

```
P-21 Encoding Profile (FILE_PROFILE / REALTIME_PROFILE)
  ↓ "Used By" / Impact
P-28 Profile Bundle
  ↓ 引用新 Profile
CD-01 Channel Control Workspace (CD-01-WS / CD-01-Detail)
  ↓ 受影响 Channel
E-50 Impact Preview (跨域能力)
  ↓ 选择性 Channel
D7 ChangeSet Review (独立审批 surface)
  ↓ Apply (Operator 真实点击)
M-17 Realtime Session (Runtime)
  ↓ session.apply_revision
06 Output (Output Runtime Link → 对应 Variant / Destination / Adapter)
```

**验收项**：

- [ ] 上述每一跳都是 UI 内真实点击，入口可达、上下文 (profile_rev / bundle_rev / channel_id / variant_id / runtime_revision) 全程保留
- [ ] "Used By / Impact" 从 P-21 真实跳到 E-50，而非手动查表
- [ ] D7 ChangeSet Review 为独立审批 surface，Apply 动作有 Operator 明确确认
- [ ] M-17 → 06 Output 经 `[Open Output]` 携带对象上下文（非泛化 Output 首页）
- [ ] Apply 后 Runtime Revision +1，Output 全程 HEALTHY（与 §E2E 系统级验证互为佐证）

### UI-E2E-02: Asset → File Transcode → Asset Version → QC (真实 UI 点击路径, 媒体域闭环)

媒体域必须经由真实 UI 点击走通，证明 Asset / Asset Version / Job / QC 的跳转闭环成立（OBJECT_NAVIGATION_MATRIX §1.1）：

```
M-11 Media Library
  ↓ Create Asset Version
M-12 Asset Detail (Tab ②)
  ↓ File Transcode
M-14 File Transcode (FILE_PROFILE)
  ↓ 选 Encoding Profile (P-21) + Packaging Profile (P-20 Packaging Tab) + Output Profile (P-22)
  ↓ Preview / Test Encode
M-18 Job Detail (Job = FILE_TRANSCODE, job_id)
  ↓ COMPLETED
新 Asset Version (asset_version_id)
  ↓ QC
M-18 Job Detail (QC) / QC Profile (P-25)
  ↓ Used By
CD-01 Channel / Playout
```

**验收项**：
- [ ] 每一跳都是 UI 内真实点击，上下文 (asset_id / asset_version_id / job_id) 全程保留
- [ ] 转码产出（新 Asset Version）从 M-18 真实跳回 M-12，不丢上下文
- [ ] QC 结果回写 Asset Version，Used By 能跳到引用它的 Channel
- [ ] Packaging Profile 与 Encoding Profile 在 M-14 中作为独立选择，不可合并

### UI-E2E-03: Channel → Realtime Session → Output → Health (真实 UI 点击路径, 实时域闭环)

```
CD-01 Channel Control Workspace (CD-01-WS)
  ↓ 配置 Realtime Session
M-17 Realtime Session (REALTIME_PROFILE)
  ↓ Provision / Reservation
  ↓ STARTING → READY_TO_TAKE → RUNNING
06 Output (Output Variant)
  ↓ Open Runtime
09 Health Tree
```

**验收项**：
- [ ] 每一跳 UI 真实点击，上下文 (channel_id / session_id / variant_id) 全程保留
- [ ] Realtime Session 经 `[Open Output]` 携带对象上下文跳 06 Output（非泛化 Output 首页）
- [ ] 06 Output → 09 Health Tree 经 `[Open Health]` 闭环
- [ ] FILE_TRANSCODE（UI-E2E-02）与 REALTIME_ENCODE（本链）完全分离，不共用同一 UI 入口

### AC-03B: Emergency Runtime Override → Expire → Auto Restore (临时覆盖验收, 0.5F.16 P1-8 新增)

AC-03 验证的是 **Permanent Configuration Change** (ChangeSet→Cutover)。广播系统还必须验证 **Emergency Runtime Override** (不进 ChangeSet, 运行态临时覆盖, 到期自动回滚)：

```
Current Effective (Runtime Revision N)
  ↓ Temporary Override
Who (Operator L3) / Why (Incident ref) / Until (TTL)
  ↓ Immediate Apply
Runtime Changed (Override active, 标红, 审计留痕)
  ↓ ... 持续 ...
Until 到期 (或 Manual Clear)
  ↓ Auto Rollback
Original Effective Restored (Runtime Revision N 不变, 无 ChangeSet)
```

**验收项**：

- [ ] Override 走独立 Runtime Action 通道, **不**生成 ChangeSet / 不 bump Runtime Revision
- [ ] Override 必须带 Who / Why / Until, 三者缺一则拒绝 (POM Temporary Override 约束)
- [ ] Override 活跃期 UI 显式标红 + Audit 事件留痕 (operator / timestamp / reason)
- [ ] Until 到期触发 Auto Rollback, Original Effective 自动恢复, 无人工介入
- [ ] Rollback 后 Runtime Revision 编号不变 (证明是临时覆盖而非新配置)
- [ ] Override 与 ChangeSet 在 E-50 Impact Preview / D7 ChangeSet Review 中互不污染

### AC-03B-2: Override + Runtime Restart (临时覆盖跨重启语义, 0.5F.18 P1-6 新增)

AC-03B 验证的是"自然 TTL 到期回滚"。但广播现场必须验证 **Override 活跃期间发生 Media Agent / Session / Controller 重启** 的语义, 否则运维会在事故中踩雷：

```
Override active (Runtime Revision N, Until = wall-clock TTL)
  ↓ Restart Session / Media Agent / Controller
expected:
  - Override state PERSIST (不丢), 重启后重新 apply 到 Runtime Revision N
  - TTL 以 wall-clock 剩余时间计 (monotonic 或 wall-clock 须明确, 不得因重启重置为 full TTL)
  - Restart 后 Runtime 仍为 Override 值 (非 Original Effective), 直到 TTL 到期
  - Controller 重启不清除 Override (Override owner = Runtime, 非 Controller 内存)
  ↓ TTL 到期 (wall-clock)
Auto Rollback → Original Effective Restored (Runtime Revision N 不变)
```

**验收项**：

- [ ] Override 状态持久化 (DB / Runtime store), **不**仅存于 Agent 内存 — 重启后可重建
- [ ] Session / Media Agent 重启后自动 re-apply Override 值 (不回退 Original Effective)
- [ ] Controller 重启不清除 Override (Override 生命周期归属 Runtime, 非 Controller)
- [ ] TTL 语义明确: wall-clock 剩余时间 (重启不重置为 full TTL); 若用 monotonic 须文档化
- [ ] Restart 期间 Override 活跃标记 + Audit 事件 (restart + re-apply) 留痕
- [ ] TTL 到期后仍正确 Auto Rollback, Runtime Revision 编号不变

#### AC-03B-2-6: Clock adjustment during Override (时钟校正对 TTL 的影响, 0.5F.18 P1-9 新增)
广播环境 Clock Domain 已是架构级对象 (PTP/系统时钟), NTP correction / Clock rollback 在事故中常见:
- [ ] **TTL 不意外延长**: Clock rollback (时间回退) 不导致 Override 永不过期或 TTL 被重置为 full
- [ ] **过期确定性**: Override 过期时刻由单调/权威时钟决定, 不因 NTP step 漂移; 若用 wall-clock, 须明确"拒绝负跳变"或"以 monotonic 辅助"
- [ ] **Audit 记录时钟校正**: NTP correction / manual clock set 期间若 Override 活跃, Audit 事件记录 correction 量 + 校正后 TTL 剩余
- [ ] Clock Domain 对象 (PTP lock 状态) 与 Override TTL 解析解耦 — PTP 失锁不自动清除 Override

## 部署环境

- 服务器：10.30.15.10（Ubuntu 26.04，32 核 / 30 GB / 546 GB / 3 张 BMD DeckLink）
- BMD 驱动：Desktop Video 16.2a1（已安装）
- FFmpeg：git-2026-08-23 + allcodec（已编译）
- ffmpeg 路径：`/usr/local/bin/ffmpeg`
- 9 编解码库：`/usr/local/{bin,lib,include}`（x264 / x265 / libvpx / lame / fdk-aac / opus / vorbis / theora / speex）

## 启动时间表

- **Phase 0.6 启动**：V0.2 架构冻结后即可
- **Reference A1**：1 周（PACKET 基础，无硬件依赖）
- **Reference A2**：1 周（需 BMD 硬件）
- **Reference B**：2 周（复杂链路）
- **10 Fault Injection / Failure-Domain Tests (FI-01A/B/02~09)**：1 周
- **24h 稳定性**：1 周

## 验收产出

- 24h 稳定运行的 Reference A1/A2/B
- 10 Fault Injection / Failure-Domain Tests (FI-01A/B/02~09) 全部通过
- 7 Health Invariants test 全部通过
- 报告：`docs/phase-0.6/ACCEPTANCE_REPORT.md`
- 视频 / 截图证据：`docs/phase-0.6/evidence/`

## 不在本阶段范围

- V0.2 架构修改（FORBIDDEN）
- 实际生产部署
- 多节点 HA（V0.4）
- RIST / Zixi / NDI（V0.3）— 完整功能开发不在 0.6
- **WebRTC 全功能开发（V0.3/V0.5）不在范围**；但 **WHEP 作为 Output Variant / Browser Playback 的 Acceptance 验证 = IN SCOPE**（实现深度：SRS Adapter 路径校验，见 Reference B / UDP·SSM fixture / 06-output）。「WebRTC 全功能开发」≠「WHEP 输出路径 Acceptance」。
