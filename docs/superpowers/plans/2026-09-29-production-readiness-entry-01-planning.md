# PRODUCTION-READINESS-ENTRY-01 — Planning / Reality Review（2026-09-29 冻结）

> 性质：Production Readiness 阶段的 entry planning 与 Post-SDK Reality Review。
> 用户 2026-09-29 指令为 Authority：Reality Audit → 做减法 → Production Baseline 收敛 →
> current-main BMD deployment reconciliation → Alarm/Incident 最小专业闭环 → current-main
> stability ladder → Redundancy / Hot-Standby entry planning。
> 本文档不改任何 frozen Architecture / Contract（V0.2 LOCK FINAL 维持）；所有判定基于
> live `main` @ `7be3b886295ac64016d2ba3589c717183dc2f984` 的 code/tests/evidence。

## 1. Capability Reality Matrix（12 Engine，V0.2 §2.1 对照 live code）

审计对象：`services/media-agent/src`（47 .rs + 5 子目录 ≈ 34.8k 行）+ `apps/*` + `packages/vbmf-sdk`。
判定词表严格六档：`implemented` / `partially implemented` / `semantic/foundation only` /
`not implemented` / `blocked` / `deferred`。有 struct / 有 Contract / 有 test fixture /
有历史 prototype **不算** implemented。

| # | Engine | 状态 | Live code 证据 | BMD 硬件验证 | 生产可部署 | Web Console 可操作 | 主要缺口 | 建议阶段 |
|---|---|---|---|---|---|---|---|---|
| 1 | Source | implemented（DeckLink SDI + RTMP；SRT blocked） | `adapters/blackmagic/`（SDK provider/device_manager）、`network_binding.rs`（RTMP 唯一授权入口 fail-closed）、`resolver.rs` 32 tests | DeckLink 输入 0/1 多轮 exact-commit gate；RTMP loopback TG-6 | 是 | Start 输入 0/1 旅程已验 | SRT 无 runtime（§RF-SRC-01 BLOCKED）；HLS/FILE/COMPOSITE 未实现 | SRT-CAPABILITY-RECONCILIATION（后置） |
| 2 | Signal Fabric | partially implemented | `signal.rs` 黑场/活动分类纯函数（25 tests）接入 watchdog acceptance | 黑场判定回环 gate | 部分 | Health 页只读反映 | 无持续信号分析平面/矩阵路由 | V0.3 扩展域 |
| 3 | Normalize | partially implemented（switch-graph 域内 implemented） | `normalize.rs`+`normalize_execution.rs`+`switch_graph.rs` 真实 videoconvert/videoscale/videorate/deinterlace+capsfilter 链，caps 证据折叠 `NormalizeEvidence` | RF-NORM-01 BMD L2c exact V+A 11/11 | 域内可 | 经 Switch 旅程间接 | 仅 I420/S16le；非独立逐输入引擎；stream-domain REMUX 等未实现 | 随 Redundancy 需要扩展 |
| 4 | Redundancy | **not implemented**（语义层无、执行层无） | 无模块；watchdog `GroupAction` 类型级不可构造自动 failover；设计冻结 #10 | N/A | 否 | 否 | 主备源编排、redundancy group、auto failover 全缺 | **REDUNDANCY-ENTRY-01**（本阶段 planning） |
| 5 | QC | not implemented | `preflight.rs` 头注明明"与运行期 QC 解耦"；无运行期 QC 节点 | N/A | 否 | 否 | 运行期质量监测整面缺失 | Alarm/Incident 之后 |
| 6 | Playout | not implemented | grep `playout` 零命中 | N/A | 否 | 否 | 虚拟播控/时间线/插播整面缺失 | V0.3+ |
| 7 | Switcher | implemented（FRAME 真机；MASTER 仿真+证据门；PACKET fail-closed） | `switch_execution.rs`/`switch_dispatch_plane.rs`/`program_execution.rs`/`switch_graph.rs`（4408 行 input-selector 真图） | RF-MASTER-01 BMD L4 + recovery 11/11；R63/R64 闭环恢复 gate | FRAME 可（wire 面固定 FrameSwitch，R60 裁决②） | Switch 旅程（manual command）已验 | MASTER_SWITCH 未真机 gate/wire 未暴露；PACKET 未实现 | REDUNDANCY-ENTRY-01 内推进 |
| 8 | Composition | semantic/foundation only | `program/video_master.rs` `VideoMasterStage::ProgramComposed` 词表；`custody.rs` 明示"无执行节点" | N/A | 否 | 否 | 无 Logo/烧录渲染执行 | V0.3+ |
| 9 | Audio | semantic/foundation only | `audio.rs` canonical 语义（头注"无 AudioMixer/Gain/DelayCompensation"）；`program/audio_master.rs` 阶段词表 | N/A | 否 | 否 | 混音/响度/延迟零执行 | V0.3+ |
| 10 | Output | implemented（HLS + RTMP egress） | `pipeline.rs` OutputPlan（hlssink2+openh264enc / flvmux+rtmp2sink）+ `adapters/ffmpeg.rs` 子进程 argv/stderr 分类 | RF-FF-02/03 BMD exact HLS/RTMP + recovery + teardown | 是 | 经 Session 旅程 | SRS Gateway Adapter 未接（SRS 镜像不可拉）；Output (SDI) 冻结为 V0.4 | storage/gateway capability packet（后置） |
| 11 | Recording | not implemented | 无文件；grep 命中全为注释 | N/A | 否 | 否 | 收录/分段整面缺失 | 明确后置（用户裁决） |
| 12 | Replay | not implemented | 无文件；命中全为幂等 replay 语义 | N/A | 否 | 否 | 延时/回放整面缺失 | 明确后置（用户裁决） |

## 2. H1-H5 / X1-X6 Reality Matrix

| 项 | 状态 | 证据 | 缺口 → 归属 packet |
|---|---|---|---|
| H1 Safety | partially（分散落地） | preflight 闸门"防自动 Fallback"、身份歧义拒识、registry 冲突 fail-closed、rpc_bind 暴露告警 | 无统一 Safety 引擎/策略面 → V0.3 域 |
| H2 Resource Scheduler | implemented | `resource.rs` 状态机 + `lease.rs` TTL/排他 + `preflight.rs` 七级判定；15+6+10 tests | 多维 Resource Vector（§3.11 9 维）未做 → V0.3 |
| H3 Watchdog | implemented（同源 restart 恢复） | `watchdog.rs` bus 监控+acceptance 折叠、`supervisor.rs` Restart/Escalate+backoff+熔断、`recovery_monitor.rs` 恢复循环 | **无 automatic failover（类型级刻意不可构造，冻结 #10）**；Incident 半面缺失 → REDUNDANCY-ENTRY-01 / HEALTH-INCIDENT-ENTRY-01 |
| H3 Incident | not implemented | 无 incident 实体/记录模块 | → **HEALTH-INCIDENT-ENTRY-01**（本阶段第二优先） |
| H4 Audit | partially | RuntimeEvent canonical + event_intake drain + 投影 + Fastify audit_entries（CP-01B/C） | 持久化审计查询面/告警升级未做 → HEALTH-INCIDENT 内收敛 |
| H5 Subtitle | semantic only | `metadata_master.rs` CAPTION 词表 | → V0.3+ |
| X1 Graph Compiler | partially | `graph_intent.rs` 契约 + pipeline/switch_graph 内散布物化 | 无独立编译/校验引擎 → V0.3 |
| X2 Preflight | implemented | 七级判定，create 第一步真实消费，10 tests | — |
| X3 Config Versioning | not implemented | manifest 均 startup-only；仅 observation_revision 快照谱系 | → V0.3 |
| X4 Incident Timeline | partially | 有界事件日志 + lineage/revision 全序 + Fastify events/SSE | 无 incident 聚合/时间线实体 → **HEALTH-INCIDENT-ENTRY-01** |
| X5 Health Tree | partially（单 agent 态 implemented，树无） | `health.rs` 8 态 reducer；`master_join.rs` 自认"Health Tree 独立聚合未建" | Channel/Subsystem/Node 层级树、§3.9 七不变量 → **HEALTH-INCIDENT-ENTRY-01**（最小投影版） |
| X6 Capability Registry | implemented（设备/端口/资源域） | `port.rs` 五层+PortRegistry 28 tests、resource/adapter registry | 服务发现式注册表 → V0.3 |

## 3. 生产编排 Reality Audit（ops/）

基于 live 文件逐项核对（exact `7be3b88`）：

1. **Fastify 实际依赖 = PostgreSQL（唯一）**。`grep -rniE "redis|valkey|bullmq|rustfs|srs" apps/api/src` 零命中；`apps/api/package.json` deps = better-auth/@better-auth/api-key/@casl/ability/ajv/drizzle-orm/fastify/pg/pino——**无任何 Redis/S3/SRS client**。
2. BASE `ops/docker-compose.yml` 的 `fastify` 却 `depends_on: {cache, rustfs, srs}` 全 healthy 才能启动，并注入 `REDIS_HOST/RUSTFS_ENDPOINT/SRS_API` 等六个死变量——**无消费者被硬编为 core 启动前置**，违反"无消费者不建抽象 / Standalone First"。
3. `rustfs/rustfs:2026.8.1`、`ossrs/srs:6.0.42` 已知 BMD 侧 tag drift / 不可拉取（STATE §5 候选清单在案）。core 启动被失效镜像阻塞。
4. `ops/Dockerfile.worker` 为 8 行 TODO placeholder（无 COPY/CMD），`worker` 服务起来即退出 → healthcheck 必失败；但 base 里 `worker` 与 core 同级无条件定义。
5. nginx 只路由 fastify/web（`ops/nginx/default.conf`），无 srs 上游耦合；media-agent internal RPC 红线（50051）由 `scripts/check_control_plane_gate.py` F11 机检。
6. overlays：`compose.bmd-acceptance.yml` 仅用 db/fastify/web/nginx（恰为 core 集合）；`compose.software-acceptance.yml` usage 行显式列 cache/rustfs/srs（改 profile 后显式服务名仍激活，兼容）。

## 4. 冻结裁决：Production Core Dependency Rule

**原则：没有当前 consumer ≠ production core dependency。**

- Production Core（默认启动，无 profile）= `db`（PostgreSQL）+ `media-agent`（按 deployment lane：VM software-acceptance network-only / BMD native）+ `fastify` + `web` + `nginx`。
- Optional capability（compose profiles，显式启用才启动；不启动时 core 完全正常；显式启用时对应 capability 自己 honest fail）：
  - `profiles: ["storage"]` → `rustfs`
  - `profiles: ["gateway"]` → `srs`
  - `profiles: ["worker"]` → `cache`（Valkey）+ `worker`（BullMQ placeholder）
- 禁止为了让 Compose 绿灯而临时实现 BullMQ Worker；Valkey/RustFS/SRS/Worker 保留为未来 Architecture 的清晰入口（做减法 ≠ 删规划）。profile 命名属实施层裁决，不改 frozen Architecture。
- RustFS/SRS image 维持 pin（DEPLOY-BASELINE-01），tag drift 不以 `latest` 回避——启用 profile 时拉取失败 = honest fail，修复属独立 `rustfs/srs image pin` packet。
- 依据：用户 2026-09-29 指令 §5；EVENT_CONTRACT（Valkey 仅作 External Webhook 队列/Event Bus 一阶段，非 Runtime 事件源）；standalone-first 定位。

## 5. 真实完成度矩阵（不写单一百分比）

| 维度 | 现实 | 依据 |
|---|---|---|
| Core vertical slice maturity | **高**：DeckLink 采集→normalize→FRAME switch→HLS/RTMP egress + 命令/事件/恢复全链 | RF/SE/RCE/CP/WCE/SDK 各 exact-commit gate 与 BMD 验收 |
| Production readiness | **中低**：compose core 被无消费者服务阻塞（本 packet 修）；BMD deployment 落后 live main；无版本化安装的 current-main 对账 | §3 audit；STATE §8 risk 4 |
| 12-engine V0.2 coverage | implemented 3（Source/Switcher-FRAME/Output）+ partial 2（Signal Fabric/Normalize）；其余 7 = semantic 或无 | §1 矩阵 |
| Hardware verification coverage | 已验面（输入 0/1 生命周期、切换、恢复、egress、Web Console 旅程、SDK regression）均 exact-commit 有效；Redundancy/QC/Recording/Replay 零硬件覆盖 | STATE §7 Hardware 节 |
| Stability verification | **NOT VERIFIED**：24h FAIL 9/10（rss_bounded ≈ +86.6MB > +50MB gate）在档，不得宣称 verified | STATE §7 Stability 节 |
| Operator journey coverage | Health/Runtime/Sessions/Events + Start/Stop/Release + failure/recovery + SSE/reload 已验；**无 Alarm/Incident 旅程** | §3.82/§3.83 |

## 6. Packet 链（Current → Next，写入 STATE §5.1）

```
PRODUCTION-READINESS-ENTRY-01（本 planning，冻结）
↓
PR-01A Production Core Compose Truth（READY）
↓
PR-01B Current-main BMD Deployment Reconciliation
↓
PR-STAB-01 Current Main Stability Rebaseline（2h→8h→24h，原 gate 不放宽）
↓
HEALTH-INCIDENT-ENTRY-01（Alarm/Incident planning → bounded packets）
↓
REDUNDANCY-ENTRY-01（COLD/WARM/HOT + PACKET/FRAME/MASTER + hysteresis 对照 planning）
```

顺序依据：compose 真相是所有后续 VM/BMD 验收的编排基线（最先）；BMD deployment 对账把
安装面拉回 current main（其次）；stability ladder 长跑期间可并行推进 Alarm/Incident 与
Redundancy 的 planning（不空等）；Redundancy 依赖 Alarm 的 Health 投影语义（X4/X5 先行）。

## 7. PR-01A scope（首个 bounded packet，本 planning 后立即进入）

- **Task ID**: PR-01A — Production Core Compose Truth。
- **Authority**: 用户 2026-09-29 指令 §5–§8；本文档 §4 冻结规则；DEPLOYMENT_AND_DEV_RUNTIME SoT（§13 image pin 不变）；EVENT_CONTRACT（Valkey 定位）。
- **Allowed files**: `ops/docker-compose.yml`、`ops/README.md`、`ops/compose.prod.yml`（注释级）、`ops/compose.software-acceptance.yml`（usage 注释）、`ops/.env.example`（分组注释）、`scripts/check_control_plane_gate.py`（新增 PR01A 结构 gate）、`.project/STATE.md`（状态 transition，随本 packet）。
- **Forbidden**: frozen Architecture/Contract；`services/media-agent` Rust 面；`apps/*`、`packages/*` 源码；删除 RustFS/SRS/Worker 规划入口；实现 BullMQ Worker；放宽任何既有 gate。
- **Acceptance**: core `up` 不依赖 worker/失效镜像/未使用服务；optional 不启动 core 仍健康；显式 profile 启动时 honest fail（不假绿）；`docker compose config`（BASE+各 overlay）valid；F11/F12/CP01C/WCE-BMD/PR01A gates PASS；API/SDK/browser smoke 经 nginx 全链 PASS；三包全量测试 + Rust 面零改动证明（fmt/clippy/gate）。
- **Verification environment**: Development VM（docker 29.1.3 / compose 2.40.3）；BMD 不在本 packet（PR-01B 专属）。

## 8. 明确不优先（维持 BACKLOG/DEFERRED）

Python SDK、npm public publish、BullMQ/Worker 实现、Webhook、multi-instance event
distribution、Recording、Replay、Mother adapters、Federation、V0.3 endpoint 扩张——除非
本 Reality Matrix 证明其为当前 core 硬依赖（未证明）。`RF-SRC-01`（SRT）维持 BLOCKED，
后续以 SRT-CAPABILITY-RECONCILIATION 专门解决 runtime/toolchain，禁止 RTMP 证据冒充。

## 9. 红线（全链有效）

- `.claude/settings.local.json` 不改不删不 add 不 stash。
- BMD device-2（PID 992634 gst-launch decklinkvideosink device-number=2）不 kill/stop/restart/acquire；PR-01B 前后核 PID/argv/owner。
- `/opt/vbmf-dev/repo` 不修改（历史未提交 ops 工作保育）；BMD 部署走 exact archive + versioned install + manifest + atomic symlink + rollback。
- 24h PASS 前不写 stability verified；不放宽 +50MB gate；不用 malloc_trim/采样变更造绿。
- Alarm/Incident 只能观察/记录 canonical Runtime facts，不得决定媒体生命周期（恢复归 Runtime/Supervisor/canonical command）；ACK 只是 operator awareness state。
