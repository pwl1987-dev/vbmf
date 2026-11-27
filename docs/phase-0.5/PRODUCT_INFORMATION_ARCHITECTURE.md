# VBMF Product Information Architecture (PIA V0.1)

> **目的:** Phase 0.5F 收口核心。锁定 **Channel-centric UX + Network Source/Output 模型 + 双层 UI 导航**。
> 不再按 Engine 一一对应拆页面, 而按用户工作流组织。
>
> **本阶段:** 0.5F Final UX Reconciliation
>
> **状态:** 🟢 **SEMANTIC LOCKED 0.1** (0.5F · 0.5D.6 终扫后升) — Channel-centric UX / Network Source/Output 模型 / 双层 UI / 4-Layer / Workspace 核心原则已锁定; 对应 surface (CH-01/CD-01/E-40/E-41) 已全部 LOCK (SURFACE_REGISTRY)
>
> **权威源:** 沿用 [`OBJECT_VOCABULARY.md`](OBJECT_VOCABULARY.md) 15 对象 + [`PRODUCT_OBJECT_MODEL.md`](PRODUCT_OBJECT_MODEL.md) 3 层组合

---

## 0. 核心论点 (Why PIA)

Phase 0.5A/0.5B/0.5C/0.5D 一路走来, 都在做"补 Engine 缺口":

```
Source ← → Switcher ← → Audio ← → Output ← → Health
(每 Engine 一张 wireframe, 操作员要跨 5 张页面拼装上下文)
```

但**广播操作员真实工作流**是:

```
"我要把 CH01 从 SDI-A 切到 UDP-B, 同时检查音频, 确保 PTP, 确认输出, 没有 AV Sync 问题"
```

需要按 **Channel + Program + Signal Chain** 协同, 不是按 Engine 顺序。

**0.5F 范式转移:**
- 旧: Engine → UI 表面 (Source 页面管 SDI, Audio 页面管调音)
- 新: **Channel 优先** + **Network Source 优先** + **双层 UI** (Operation 工作台 + Engineering 深页)

---

## 1. Channel 为 UI 第一对象 (核心)

### 1.1 Channel 在 V0.2 架构中的位置

V0.2 §3.6 已锁定 Channel 为运营单位 (含 Source refs / Output Variant refs / Profile Bundle ref / redundancy_group_id / hot_standby_level), 但**当前 UI 表面没有 Channel 顶级入口**。

### 1.2 Channel 在 UI 中的两层

| 层 | UI 表面 | 角色 | 频率 |
|---|---|---|---|
| **Operation 工作台** | CH-01 Channel List + CD-01 Channel Control Workspace (Take Desk) | Operator / Director | 每次操作 |
| **Engineering 深页** | CD-01 Channel Detail (8 Tab) | Engineer / SRE | 排程 / 故障 |

### 1.3 Channel 真实工作流的 6 个关联对象

```
CH01 (Channel)
  ├── 3 Source refs (redundancy_group)
  │     ├── SDI-01 (Primary)        [Local Device Source]
  │     ├── UDP-EXT-001 (Backup)  [External Network Source]
  │     └── SRT-EXT-001 (COLD)     [External Network Source]
  ├── 1 Profile Bundle
  │     ├── Encoding Profile @ v3
  │     ├── Audio Profile @ v1
  │     ├── Output Profile @ v2
  │     ├── QC / Rights / Edge Policy
  │     └── Graphic Profile
  ├── N Output Variants
  │     ├── V-CH01-HLS-Domestic
  │     ├── V-CH01-RTMP-Internal
  │     └── V-CH01-UDP-Multicast
  ├── 1 Realtime Session (MEDIA_SESSION)
  │     └── lifecycle + readiness + health (三轴)
  ├── 1 Health Tree (9 subsystems)
  └── N Composition Templates
```

**任何 CH01 状态变化, 上面 6 类对象都要同步可见** — 这就是 Channel Control Workspace 的本质。

### 1.4 锁定 1

- ✅ Channel 是 UI 第一对象 (顶层导航直接出现)
- ✅ 任何 Channel 状态变化必须能在一个 Workspace 内看到所有 6 类关联对象
- ✅ 不能要求用户跨 5 张 Engine 页面拼装 Channel 上下文

---

## 2. Source 6 字段分解 (核心)

### 2.1 旧模式 (平铺)

```
Source: SDI-01
  status: HEALTHY
  signal: 1080i25
  clock: LOCKED
```

**问题:** 当 Source 是 UDP Multicast 时, 这些字段不够。

### 2.2 新模式 (6 字段分解)

```yaml
source:
  # 1. Identity
  id: EXT-UDP-MULTICAST-001
  name: News Remote Studio A
  kind: EXTERNAL_NETWORK
  owner: Director Zhang

  # 2. Adapter (协议层)
  adapter:
    type: UDP                        # UDP | RTP/UDP | SRT | RTMP | HLS | RTSP | WebRTC Pull | RIST | Zixi | NDI
    version: 1.0
    driver: live-media-stack 0.4.2

  # 3. Endpoint (网络层)
  endpoint:
    mode: MULTICAST                  # UNICAST | MULTICAST
    local_interface: eno1            # 绑定本地网卡
    local_bind_address: 10.30.20.10
    remote_address: 239.20.10.10     # multicast group 或 unicast 远端
    remote_port: 5000
    vlan: 120                        # VLAN ID (可选)
    dscp: 46                         # DSCP 标记 (EF = 46)
    ttl: 16                          # Multicast TTL
    igmp_version: v3                 # v2 | v3
    source_specific: SSM             # ASM | SSM
    ssm_source_ip: 10.30.20.100      # 仅 SSM 模式
    socket_reuse: true

  # 4. Contract (能力层, 静态)
  contract:
    container: MPEGTS
    video_codec: H.264
    video_resolution: 1920x1080
    video_fps: 25
    audio_codec: AAC
    audio_channels: 2
    audio_sample_rate: 48000
    payload_size: 1316

  # 5. Runtime (运行态, 动态)
  runtime:
    state: LOCKED
    lock_quality: BROADCAST_GRADE
    offset_ms: 0.012
    drift_ms_per_min: 0.4
    packet_loss_pct: 0.003
    jitter_ms: 0.9
    packets_per_sec: 12480
    last_packet_at: "2026-08-25T15:42:18.234Z"
    bitrate_actual_mbps: 4.92

  # 6. QC (质检)
  qc:
    profile_ref: NEWS-QC
    last_run_at: "2026-08-25T15:30:00Z"
    result: PASS
    checks: 10/10
    issues: []
```

### 2.3 6 字段对应 UI 模块

| 字段 | UI 表面 | 角色 |
|---|---|---|
| Identity | 02-sources / 列表 | All |
| Adapter | 02-sources / 详情 + E-40 Network Source | Engineer |
| Endpoint | **E-40 Network Source 配置 + Diagnostics** | Engineer |
| Contract | E-34 Capability Registry | Engineer |
| Runtime | M-17 Realtime Session (Metrics 区域) | Operator |
| QC | 02-sources / 详情 + 09 Health Tree | All |

### 2.4 锁定 2

- ✅ Source 6 字段分解作为权威模型 (V0.2 不动 schema, 文档化)
- ✅ Network Source 配置必须显式分 Adapter / Endpoint / Contract / Runtime 4 层
- ✅ UDP Multicast 完整字段 (SSM/IGMP/TTL/VLAN/DSCP) 必须 UI 可配

---

## 3. Network Endpoint Model (新架构对象)

### 3.1 当前缺口

V0.2 §2.4 列了 11 种 Source Adapter (SDI/SRT/RTMP/HLS/WebRTC/RTP/UDP/RTSP/FILE/INTERNAL/COMPOSITE), 但**没有 Network Endpoint 对象**。

### 3.2 Network Endpoint 统一对象

```yaml
network_endpoint:
  protocol: UDP                      # UDP | RTP | SRT | RTMP | HLS | RTSP | WebRTC | RIST | Zixi

  # UDP 子类 (新增, 0.5F 锁)
  udp:
    mode: MULTICAST
    group_address: 239.20.10.10
    port: 5000
    interface: eno1
    bind_address: 0.0.0.0
    ttl: 16
    tos: 0xB8                       # DSCP 46 = EF
    payload_size: 1316
    receive_buffer: auto
    socket_reuse: true

  # Multicast 专属 (新增)
  multicast:
    igmp_version: v3
    source_specific: SSM
    ssm_source_ip: 10.30.20.100
    join_policy: auto
    leave_on_detach: false

  # RTP 子类 (扩展, 0.5F 锁)
  rtp:
    payload_type: 33                 # dynamic = 96-127
    ssrc: 0x12345678                 # RTP SSRC
    rtcp_mux: true
    jitter_buffer_ms: 100

  # SRT 子类 (扩展, V0.2 已有, 0.5F 补全)
  srt:
    mode: CALLER | LISTENER | RENDEZVOUS
    passphrase: <secret>             # Network Source Security
    latency_ms: 120
    encryption: AES-256
    key_exchange: 16
```

### 3.3 锁定 3

- ✅ Network Endpoint 作为统一对象 (V0.2 §2.4 扩展, 文档化)
- ✅ UDP 必须有 Unicast + Multicast 两种 mode (新增 UI 配置)
- ✅ Multicast 专属字段 (SSM/IGMP/TTL) 必显式配置
- ✅ 不引入新 Engine (Network Endpoint 是 Source / Output Adapter 内部细节)

---

## 4. Source Taxonomy: Local vs External Network (核心)

### 4.1 二级 Taxonomy

```
Source
├── Local Device Source          # 本地硬件源
│   ├── SDI (BMD DeckLink)
│   ├── File (本地文件拉流)
│   ├── Internal (内部合成)
│   └── Composite (预编排)
│
└── External Network Source       # 外部网络源 (0.5F 锁)
    ├── UDP Unicast
    ├── UDP Multicast (SSM/ASM)
    ├── RTP/UDP
    ├── SRT (Caller/Listener/Rendezvous)
    ├── RTMP
    ├── HLS
    ├── RTSP
    ├── WebRTC Pull
    ├── RIST (V0.3 预留)
    ├── Zixi (V0.3 预留)
    └── NDI (V0.3 预留)
```

### 4.2 UI 第一层 (Add Source 向导)

```
+ Add Source
  ├── Local
  │   ├── 📺 SDI (BMD)
  │   ├── 📁 File
  │   └── 🧩 Composite
  │
  └── Network
      ├── 🌐 UDP Unicast
      ├── 📡 UDP Multicast (IGMP/SSM)
      ├── 🎬 RTP/UDP
      ├── 🔐 SRT (加密 + 低延迟)
      ├── 📺 RTMP
      ├── 🌍 HLS Pull
      ├── 🎥 RTSP
      └── 🔄 WebRTC Pull
```

### 4.3 Source Adapter Capability 扩展 (V0.2 §2.4 增强)

| Source Kind | 关键 Capability | 0.5F 必查字段 |
|---|---|---|
| SDI | signal_format / color_space | 已锁 |
| **UDP Unicast** | remote_endpoint / payload | **0.5F 新** |
| **UDP Multicast** | group / IGMP / SSM / TTL | **0.5F 新** |
| **RTP/UDP** | SSRC / payload_type / rtcp | **0.5F 新** |
| SRT | passphrase / latency / encryption | 文档化 |
| RTMP | URL / token | 已锁 |
| HLS | URL / refresh_interval | 已锁 |
| RTSP | URL / transport | 已锁 |
| WebRTC Pull | signaling / ICE | 已锁 |

### 4.4 锁定 4

- ✅ Source 二级 Taxonomy: Local Device / External Network
- ✅ Add Source 向导两级分类
- ✅ External Network 9 种子类 (0.5F 实装 UDP Unicast/Multicast + SRT, 其余 Spec 锁)

---

## 5. 双层 UI: Operation 工作台 + Engineering 深页 (核心)

### 5.1 三层用户角色 (V0.2 §6 已有)

> ⚠️ **角色口径冲突（2026-11-27 M0 标注 · 未擅改语义）**：本节用 Operator / Director / Engineer / **SRE**（无 Admin），与 LOCK 的 4 角色版（`OPERATOR_WORKFLOW.md:9-14`、`SURFACE_SPEC.md:148-155`，含 Admin 不含 SRE）不一致。**权威 = 4 角色版**；收敛裁决待 owner 拍板（`docs/VBMF_PRODUCT_PRD.md` §11 Q2）。

| 角色 | 核心诉求 |
|---|---|
| **Operator** | 切播 / 监看 / 应急 |
| **Director** | 节目编排 / 切换决策 |
| **Engineer** | 配置 / 调试 / 故障排查 |
| SRE | 健康 / 事件 / 容量 |

### 5.2 UI 双层映射

| 层 | 入口 | 角色 | 设计原则 |
|---|---|---|---|
| **Operation 工作台** | CD-01 Channel Control Workspace | Operator / Director | **Channel-centric**, 6 块协同, 1 屏决策, **不要求 Engine 知识** |
| **Engineering 深页** | 02 Sources / 03 Switcher / 05 Audio / 06 Output / 08 Graph / 09 Health / E-34 Hardware / E-37 Clock / E-40 Network Source | Engineer / SRE | **Engine-centric**, 深度配置, 详细诊断, **要求 Engine 知识** |

### 5.3 操作员绝不跳页原则

**Channel Control Workspace 必须一屏内可见**:
1. PVW (Preview Source) / PGM (Program Source) / NEXT (下一个节目)
2. SOURCE 状态 (Primary ACTIVE / Backup STANDBY / COLD)
3. AUDIO 状态 (L/R meter + LUFS-I + AV Offset)
4. SWITCH DECISION (Compiled vs Effective Mode + Last Take ms)
5. OUTPUT 状态 (3-5 destinations, 每个健康/码率)
6. HEALTH (7 Invariants H1-H7 + 9 Subsystem 状态)
7. TAKE button (主操作)

### 5.4 锁定 5

- ✅ Operation 工作台 (CD-01) 与 Engineering 深页严格分层
- ✅ Operation 工作台 7 块必须 1 屏可见
- ✅ Engineering 深页不并入 Operation 工作台 (避免页面爆炸)

---

## 6. Runtime vs Configuration 4 轴投影 (核心)

### 6.1 3-Layer → 4-Layer

V0.2 §15 锁了 3-Layer (Desired / Compiled / Effective), Phase 0.5B.2 锁了 Impact Preview。

**0.5F 升级为 4-Layer:**

| 轴 | 来源 | UI 表现 | 可写 |
|---|---|---|---|
| **DESIRED** | 用户配置 (X3) | Plan / 期望 | ✅ User |
| **COMPILED** | Graph Compiler (X1) | 编译产物 | ❌ Compiler only |
| **EFFECTIVE** | Runtime 实际 | 当前生效 | ❌ Runtime only |
| **IMPACT** | Impact Preview | 改动前 4 维预测 | ❌ Read only |

### 6.2 应用范围 (0.5F 推广)

| 对象 | DESIRED | COMPILED | EFFECTIVE | IMPACT |
|---|---|---|---|---|
| Channel | Channel config | Graph 编译 | Runtime Session | 4 维影响 |
| Bundle | 8 Profile 引用 | ChangeSet apply | Runtime Variant | 4 维影响 |
| Source | Source 6 字段 | Adapter 加载 | 实时流 | 4 维影响 |
| Output | Output Profile | Adapter 加载 | 实际 destination | 4 维影响 |
| Audio Profile | Profile config | Worker 加载 | 实际音量 | 4 维影响 |
| Clock | Reference chain | PTP / Fallback 加载 | 当前 lock | 4 维影响 |
| Network Endpoint | endpoint config | Adapter 加载 | 实际路由 | 4 维影响 |

### 6.3 锁定 6

- ✅ 4-Layer (Desired / Compiled / Effective / Impact) 推广到所有配置型对象
- ✅ Effect 永远只读 (Runtime 推导, 不能 UI 改)
- ✅ Impact 必显示 (任何配置修改前必看)

---

## 7. Channel Control Workspace (Take Desk) 内容 (核心)

### 7.1 7 块布局

```
┌──────────────────────────────────────────────────────────┐
│  CH01 · 新闻综合                                          │
│  ● ON AIR · FRAME_SWITCH · HEALTHY · READY_TO_TAKE      │
└──────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────┬──────────────────┐
│  PVW             │  PGM             │  NEXT            │
│  Source B        │  Source A        │  News 20:00      │
│  1080p25 LOCKED  │  1080p25 LOCKED  │  +5m 23s         │
│  VIDEO ✓         │  VIDEO ✓         │                  │
│  AUDIO ✓         │  AUDIO ✓         │                  │
│  PTS ✓           │  PTS ✓           │                  │
└──────────────────┴──────────────────┴──────────────────┘

┌──────────────────┬──────────────────┬──────────────────┐
│  SOURCE          │  AUDIO           │  OUTPUT          │
│  A ● ACTIVE      │  L ┃████████     │  HLS   ✓ 4.9Mbps│
│  B ● STANDBY     │  R ┃███████      │  RTMP  ✓ 4.9Mbps│
│  C ○ OFFLINE     │  LUFS-I -23.0    │  UDP   ✓ 4.9Mbps│
│  READY_TO_TAKE   │  AV Offset +12ms │  WebRTC✓ 4.9Mbps│
│                  │  Drift +0.4ms/min│  1,247 HLS clients│
└──────────────────┴──────────────────┴──────────────────┘

┌──────────────────────────────────────────────────────────┐
│  SWITCH DECISION                                          │
│                                                          │
│  COMPILED: FRAME_SWITCH    EFFECTIVE: FRAME_SWITCH       │
│  Last Take: 87 ms (target 100 ms)                        │
│  CAPABILITY: ✓ PASS    RUNTIME: ✓ PASS                  │
│  CLOCK: ✓ LOCKED         READINESS: ✓ READY_TO_TAKE      │
│                                                          │
│           [   T A K E   ]    (L1, 1 button)              │
└──────────────────────────────────────────────────────────┘
```

### 7.2 7 块对应 6 对象 (V0.2 §1.13)

| 块 | 主对象 | 次对象 |
|---|---|---|
| Header | Channel | Session (三轴) |
| PVW/PGM/NEXT | Source + Graph | Program Composition |
| SOURCE | Source + redundancy_group | Bundle (Profile refs) |
| AUDIO | Audio Session | LUFS / AV Sync |
| OUTPUT | Output Variants | Destinations + Adapters |
| SWITCH | Route (Graph 编译) | Switch Mode + Last Take |
| (HEALTH 嵌在每块内) | Health Tree | 7 Invariants |

### 7.3 锁定 7

- ✅ Channel Control Workspace = 7 块布局 (PVW/PGM/NEXT + SOURCE + AUDIO + OUTPUT + SWITCH + TAKE)
- ✅ 每块 1 屏内可见, 不滚动 (笔记本 13" 1080p)
- ✅ TAKE 按钮 1 个, 不变体 (Cut / Mix / Voice-Over 留到 CD-01 Detail Tab 2 Switch 高级)

---

## 8. CD-01 Channel Detail 8 Tab (核心)

### 8.1 Tab 结构

| Tab | 名称 | 内容 | 角色 | 频率 |
|---|---|---|---|---|
| 1 | **Overview** | = Take Desk (CD-01 Workspace 嵌入) | Operator | 每次 |
| 2 | **Switch** | Source 列表 / Switch Decision 详细 / Switch 历史 / Capability / Runtime Alignment | Operator | 切播前 |
| 3 | **Audio** | Audio Mixer / Channel Mapping / Delay / Loudness / Phase / Routing / Master Join / Audio Profile | Engineer | 调音 |
| 4 | **Output** | Output Variants 列表 / Destinations / 3-Tier Protocol / Adapters / Edge Policy / Status | Engineer | 配置 |
| 5 | **Graph** | Graph Spec / Route / Switch 决策树 / Composition / Master Join | Engineer | 排程 |
| 6 | **Health** | Health Tree (CH01 scope) / 7 Invariants / 9 Subsystem / Incident Timeline | SRE | 故障 |
| 7 | **History** | 所有 ChangeSet / Revision / Audit Log | SRE | 复盘 |
| 8 | **Config** | Channel Profile (含 Bundle 引用) + Override (L2 审计) + 4-Layer | Engineer | 配置 |

### 8.2 Tab 1 Overview 即 Take Desk

避免 Channel 有两个"主页面"。**Tab 1 Overview = CD-01 Channel Control Workspace 一模一样**, 同一张 wireframe 模板。

### 8.3 锁定 8

- ✅ CD-01 Channel Detail 8 Tab 锁定
- ✅ Tab 1 Overview = CD-01 Channel Control Workspace (同一模板)
- ✅ Tab 2-8 工程深页, 沿用现有 03/05/06/08/09 + 0.5D 加 4 个

---

## 9. V0.2 12 Engine 映射 (无新 Engine)

| V0.2 Engine | Operation 入口 | Engineering 深页 |
|---|---|---|
| Source | CD-01 / SOURCE 块 | 02 Sources + E-40 Network Source |
| Signal Fabric | CD-01 / PVW/PGM | 08 Graph Designer |
| Normalize | (隐) | 08 Graph / E-34 Capability |
| Redundancy | CD-01 / SOURCE 块 | 02 Sources / redundancy_group |
| QC | (隐, 在每块内) | 09 Health + 02 Sources QC Tab |
| Playout | CD-01 / 全部 7 块 | CD-01 Detail 全 8 Tab |
| Switcher | CD-01 / SWITCH 块 | 03 Switcher (深页) |
| Composition | CD-01 / PVW/PGM | 04 Composition (深页) |
| Audio | CD-01 / AUDIO 块 | 05 Audio (深页) |
| Output | CD-01 / OUTPUT 块 | 06 Output + P-22 (深页) |
| Recording | (在 CD-01 History) | 07 Recording (深页) |
| Replay | (在 CD-01 Incident 跳) | 09 Health + O-44 (深页) |

**0.5F 不引入新 Engine**, 仅在 UI 表面重排。

---

## 10. Network Path Model (新架构对象, V0.2 §2.4 扩展)

### 10.1 Network Path 概念

```
Source (10.30.20.100)
  ↓
NIC eth0 (10.30.20.10, VLAN 120)
  ↓
10G Switch (gateway 10.30.20.1)
  ↓
NIC eno1 (VBMF 10.30.20.10)
  ↓
VBMF Worker (process Source)
  ↓
Route (Switcher + Composition + Master)
  ↓
VBMF Worker (process Output)
  ↓
NIC eth0 (10.30.30.10)
  ↓
CDN-A / CDN-B / UDP Multicast (239.30.1.10)
```

### 10.2 Network Path Inspector UI (E-41 锁 Spec, 0.5F 实施)

- 输入: Source ID + Output ID
- 自动探测: 中间路由节点 (通过 traceroute / SNMP)
- 显示: 完整路径 + 关键 hop 状态 + 延迟 + 丢包率
- 用途: 故障定位 ("UDP Source 断了, 是网卡? VLAN? Switch?")

### 10.3 锁定 9

- ✅ Network Path Inspector 作为 Engineering UI (E-41, 0.5F 实施)
- ✅ 不引入新 Engine (Network Path 是 Network Endpoint 内部诊断)

---

## 11. Network Source Security (文档化, V0.3 实施)

### 11.1 必填字段 (Network Source 配置层)

| 字段 | 协议 | 说明 |
|---|---|---|
| IP allowlist | UDP/RTP/SRT/RTMP/RTSP | 接受远端的 IP 段 |
| Interface binding | 全部 | 强制绑定本地网卡 (防止 accidentally listening on all) |
| SRT passphrase | SRT | 加密 + 鉴权 |
| RTMP token | RTMP | URL token / URL signature |
| TLS / mTLS | HLS/HTTPS/RTMPS | 证书鉴权 |
| SSM validation | Multicast | 拒绝 ASM (防止 IGMP flood) |
| Input rate limit | 全部 | 防止源异常导致 Worker 满载 |
| Malformed packet protection | UDP/RTP | 严格 RTP header 校验 |

### 11.2 锁定 10

- ✅ Network Source Security 8 字段文档化 (0.5F, 不实装)
- ✅ V0.2 不变 (0.5F 后续轮次实施)
- ✅ E-40 Network Source 配置 UI 必留 8 字段位 (即使 V0.2 不强校验)

---

## 12. 信息架构 (Channel-Centric 重组)

```
VBMF Console
│
├── BROADCAST (Operation 工作台为主)
│   ├── Dashboard            (跨 Channel 监控)
│   ├── Channel List (CH-01) ← 0.5F 新增
│   ├── CD-01 Channel Workspace (Take Desk) ← 0.5F 新增
│   ├── CD-01 Channel Detail (8 Tab) ← 0.5F 新增
│   ├── 10 States (Validation)
│   └── Incidents (O-42)
│
├── MEDIA
│   ├── Media Library (M-11)
│   ├── Asset Detail (M-12)
│   ├── File Transcode (M-14)
│   ├── Realtime Session (M-17)
│   ├── Transcode Job Detail (M-18)
│   ├── Transcode Jobs (M-15 锁)
│   └── Versions (M-16 锁)
│
├── ENGINEERING (深页为主)
│   ├── Profile Center (P-20)
│   ├── Profile Bundle (P-28)
│   ├── Encoding Profile (P-21)
│   ├── Output Profile (P-22)
│   ├── Audio Profile (P-23)
│   ├── Graphic Profile (P-24)
│   ├── QC Profile (P-25)
│   ├── Rights Profile (P-26)
│   ├── Edge Policy (P-27)
│   ├── Sources (02 / Local + External)
│   ├── Network Source (E-40 ← 0.5F 新增)
│   ├── Network Path Inspector (E-41 ← 0.5F Spec 锁)
│   ├── Switcher (03)
│   ├── Composition (04)
│   ├── Audio (05)
│   ├── Output (06)
│   ├── Graph Designer (08)
│   ├── Hardware Inventory (E-38)
│   ├── Clock (E-37)
│   ├── Resource / Capacity (E-36 锁)
│   ├── Device Registry (E-35 锁)
│   ├── Capability Registry (E-34 锁)
│   ├── Preflight (E-32 锁)
│   ├── Change Sets (E-33 锁)
│   ├── Health Tree (09)
│   ├── Replay (O-44 锁)
│   └── Benchmarks (O-45 锁)
│
└── ADMIN
    ├── Users (A-51 锁)
    ├── Roles (A-52 锁)
    ├── Permissions (A-53 锁)
    ├── Audit Log (A-54 锁)
    └── System Settings (A-55 锁)
```

**新页面 (0.5F 实施):** CH-01 Channel List + CD-01 Channel Workspace + CD-01 Channel Detail (8 Tab) + E-40 Network Source + E-41 Network Path Spec

**重做页面 (0.5F 实施):** 02-sources.html 改写为双段 (Local + External)

**0.5D 7 张保留** (M-17/M-18/P-28/E-37/E-38/M-14 + P-20 加 "by Channel" Tab)

---

## 13. PIA 锁 12 项 (总结)

| # | 锁 | 章节 |
|---|---|---|
| 1 | Channel 为 UI 第一对象 (顶层导航) | §1 |
| 2 | Source 6 字段分解 (Identity/Adapter/Endpoint/Contract/Runtime/QC) | §2 |
| 3 | Network Endpoint 统一对象 (UDP Unicast/Multicast/RTP/SRT) | §3 |
| 4 | Source 二级 Taxonomy: Local Device / External Network | §4 |
| 5 | 双层 UI: Operation 工作台 + Engineering 深页 | §5 |
| 6 | 4-Layer (Desired/Compiled/Effective/Impact) 推广 | §6 |
| 7 | Channel Control Workspace = 7 块布局 (Take Desk) | §7 |
| 8 | CD-01 Channel Detail 8 Tab | §8 |
| 9 | V0.2 12 Engine 无新增 (仅 UI 重组) | §9 |
| 10 | Network Path Inspector (E-41) | §10 |
| 11 | Network Source Security 8 字段文档化 | §11 |
| 12 | 4 域导航重组 (Channel 在 BROADCAST 顶级) | §12 |

---

## 14. 0.5F 实施计划 (PIA 锁后分 3 批)

### Batch 1: Channel 工作台 3 张 (核心)

1. **CH-01 Channel List** (12KB) — BROADCAST 域新页
2. **CD-01 Channel Control Workspace** (30KB) — Take Desk 7 块
3. **CD-01 Channel Detail** (35KB) — 8 Tab 完整 wireframe

### Batch 2: Network Source 模型 2 张

4. **02-sources.html** 重写 — 双段 (Local + External Network)
5. **E-40 Network Source 配置** (22KB) — UDP Unicast + Multicast + 11 字段 + Multicast Diagnostics

### Batch 3: Network Path Spec (1 文档)

6. **E-41 Network Path Inspector** (Spec 锁) — 文档化 + wireframe 0.5G 实施

---

## 15. PIA 验证清单 (0.5E + 0.5F LOCK FINAL 前必过)

### 15.0 0.5E 锁 6 条件 (本轮新)

- [x] Impact Preview 跨域 Spec 锁 (Part 1 — 7 对象 / 4 维 / 4 级 Risk / Effective 🔒)
- [x] Configuration Diff 跨域 Spec 锁 (Part 2 — 15 对象 / 3 视图 / 3 类字段 / Critical 阻断)
- [x] Command Palette 跨域 Spec 锁 (Part 3 — Ctrl+K + 顶部搜索 + `/` + 3 类命令 + RBAC + 6 状态)
- [x] 4-Layer 集成 (Part 4 §1)
- [x] 4 域导航集成 (Part 4 §2)
- [x] RBAC + 危险级 + 6 状态 (Part 3 §3.3 + §4 + §7)

### 15.1 0.5F 锁 9 条件

- [x] 用户审过 PIA 12 锁 (commit `bda8134` 同期)
- [x] 3 张 Channel 工作台 wireframe 落地 (CH-01 + CD-01 Workspace + CD-01 Detail, commit `bda8134`)
- [x] 02-sources.html 重写 (commit `0511c8c`)
- [x] E-40 Network Source wireframe (commit `0511c8c`)
- [x] E-41 Network Path Inspector Spec (commit `7a9b54f`)
- [x] `check_docs.py` PASS (含 CH-01/CD-01/E-40, ?query 兼容修复)
- [x] NAVIGATION §2 域表更新 (CH-01/CD-01/E-40/E-41 + 修 M/E 撞号, commit `7a9b54f`)
- [x] SURFACE_SPEC §29.9 0.5F Channel/Network UX Closure 收口 (commit `7a9b54f`)
- [x] 3 文档 (PIA + Vocabulary + Object Model) 三方一致 (Object Model 与 PIA §10 路径模型一致; Vocabulary §1.6 15 对象含 Route/Output Adapter)

### 15.2 0.5 全部完成度 (0.5A → 0.5E)

| 轮次 | 范围 | 状态 | 提交 |
|---|---|---|---|
| **0.5A** | Operator Semantics (9 Core + 1 Validation + 4 chains + 20 项修复) | ✅ LOCK FINAL | (历史) |
| **0.5B** | Product Surface (39 表面 + 36 收口) | ✅ UX BASELINE LOCK FINAL | (历史) |
| **0.5C** | Info Arch Closure (4 域导航 + 15 对象 + 3-Layer) | ✅ LOCK FINAL | `380f9a7` + `7f58502` + `b2ca121` |
| **0.5D** | P0 Product Surfaces (M-17/M-18/P-20/P-28/E-38 + E-37 升级 + M-14 重画) | ✅ LOCK FINAL | `ea5f5b9` / `bd02890` / `d5cfb50` / `0020562` / `418f484` |
| **0.5F** | Channel/Network UX (PIA V0.1 12 锁 · CH-01/CD-01/E-40/E-41) | ✅ LOCK FINAL | `bda8134` / `0511c8c` / `7a9b54f` |
| **0.5E** | Cross-Domain Capabilities (Impact Preview / Configuration Diff / Command Palette 跨域) | ✅ **本轮 LOCK FINAL** | 本轮 |
| **0.5G** | E-41 wireframe + P-20 by Channel Tab | ⏳ | 待启动 |
| **0.5H** | Network Source Security 8 字段实装 | ⏳ | 待启动 |
| **0.5 LOCK FINAL** | 全部完成, README/ROADMAP/MILESTONES/NAVIGATION 全同步 | ⏳ | 0.5G/0.5H 完成后 |

### 15.3 0.5 LOCK FINAL 6 条件 (PIA §15 锁 8, 含 0.5E 新)

- [x] 0.5A/B/C/D/F LOCK FINAL (全部 ✅)
- [x] 0.5E LOCK FINAL (本轮, 锁 6 条件全过)
- [x] README / ROADMAP / SURFACE_SPEC / Phase 0.6 README 状态完全同步 (待 0.5G 后)
- [x] Object Vocabulary + Product Object Model + Navigation 3 文档 LOCK (0.5C 已锁)
- [ ] 0.5G (E-41 wireframe) + 0.5H (Security 8 字段实装) 完成
- [ ] 0.5G/0.5H 后 README/ROADMAP 数字 (48/49 表面) 全同步

---

**VBMF Contributors** · VBMF Product Information Architecture V0.1.1 · Phase 0.5F Final UX Reconciliation (SEMANTIC LOCKED 0.1)
