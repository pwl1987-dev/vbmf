# 10.30.15.10 服务器现状 & 视频编码器 Web 项目方案

> **生成时间**: 2026-08-24 (Asia/Shanghai)
> **服务器**: `10.30.15.10` — Ubuntu 26.04 LTS
> **目标用户**: 风从平地起
> **会话**: mvs_6ba8f6b9e66e4ea3b89036e75f929fab

> **📌 SoT 分层声明 (2026-08-25 追加)**: VBMF 存在三套互相独立、互不冲突的 SoT, 审核时须区分:
> 1. **产品实施技术栈 SoT** = 本文档 (§2.2, V0.2 Technical Stack Baseline 冻结): Fastify + PostgreSQL + Drizzle + React 19 + Vite + shadcn/ui + Tailwind + Valkey + RustFS + BullMQ + **SRS** (主流媒体服务器/Streaming Gateway, 已锁定) + Better Auth/CASL。
> 2. **媒体运行时/架构 SoT** = `docs/architecture/ARCHITECTURE_V0.2.md`: Rust Media Agent / FFmpeg / GStreamer / BMD DeckLink / JSON-RPC / SDI·SRT·UDP / RTMP·HLS·WHEP。
> 3. **验收 Harness SoT** = `docs/phase-0.6/` (Python + YAML + Playwright)。
> 另: Phase 0.5 的 HTML/CSS/JS 是 **UX 原型** (验证 IA/Workflow/Surface/Design System), 其结论在 **Phase 4** 由本表 React 19 + shadcn/ui 真正落地; 当前仓库**尚无正式业务代码**, 故本次为一次性技术栈冻结, 后续变更须走 V0.2 Architecture Change Review。
> **📌 本文档身份 (2026-08-25 追加)**: **V0.1 初始系统 + 项目计划**（服务器基线 / 基础设施 / 实施路线）。当前 **implementation authority = `docs/architecture/ARCHITECTURE_V0.2.md`**；**运行时所有权契约 = `docs/architecture/TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md`**。本文件技术栈章节须与 V0.2 及该契约一致；冲突以 V0.2 为准。关键落点：GStreamer ingest / Live FFmpeg / Live Recording **归属 Rust Media Agent**；File FFmpeg / Post-processing **归属 BullMQ Node Worker**；SRS = Canonical Stream Gateway（**MediaMTX 不纳入**）；React UI = **shadcn/ui**（**非 Ant Design Pro**）。

---

## 目录

- [第 1 部分 — 当前服务器状态](#第-1-部分--当前服务器状态)
  - [1.1 基础信息](#11-基础信息)
  - [1.2 安全加固清单](#12-安全加固清单)
  - [1.3 APT 镜像源](#13-apt-镜像源)
  - [1.4 BMD 视频卡](#14-bmd-视频卡)
  - [1.5 FFmpeg 全 codec 版](#15-ffmpeg-全-codec-版)
  - [1.6 GStreamer 集成](#16-gstreamer-集成)
  - [1.7 常用工具集](#17-常用工具集)
- [第 2 部分 — Web 视频编码器项目方案](#第-2-部分--web-视频编码器项目方案)
  - [2.1 业务目标](#21-业务目标)
  - [2.2 选型栈（用户确认）](#22-选型栈用户确认--v02-technical-stack-baseline-冻结)
  - [2.3 必须补的组件](#23-必须补的组件)
  - [2.4 推荐新增（按优先级）](#24-推荐新增按优先级)
  - [2.5 架构图](#25-架构图)
  - [2.6 实施路线图](#26-实施路线图)
  - [2.7 待决策项](#27-待决策项)
- [第 3 部分 — 操作参考](#第-3-部分--操作参考)
  - [3.1 SSH 登录](#31-ssh-登录)
  - [3.2 重要路径速查](#32-重要路径速查)
  - [3.3 关键 FFmpeg 命令](#33-关键-ffmpeg-命令)
  - [3.4 BMD + Docker 模式](#34-bmd--docker-模式)
  - [3.5 监控与排错](#35-监控与排错)
- [第 4 部分 — 历史决策与坑](#第-4-部分--历史决策与坑)
- [第 5 部分 — 下一步建议](#第-5-部分--下一步建议)

---

## 第 1 部分 — 当前服务器状态

### 1.1 基础信息

| 项 | 值 |
|---|---|
| OS | Ubuntu 26.04 LTS (Resolute Raccoon) |
| 内核 | 7.0.0-30-generic |
| CPU | 32 核 |
| 内存 | 30 GB |
| 磁盘 | 546 GB（已用 ~14 GB） |
| IP | 10.30.15.10/16 (eno1) |
| 用户 | `lytv` (uid 1000, in groups: adm, sudo, lxd, ...) |
| sudo | **免密**（`/etc/sudoers.d/90-lytv-nopasswd`） |
| SSH | 端口 22, 密钥认证, AllowUsers=lytv, 0 密码登录 |
| 时区 | `Asia/Shanghai (CST +0800)` |
| NTP | chrony 已装（默认配置） |
| 主机名 | `lytv` |

### 1.2 安全加固清单

| 项 | 状态 | 文件 / 备注 |
|---|---|---|
| SSH 仅 key | ✅ | `/etc/ssh/sshd_config.d/00-hardening.conf` |
| 禁 root 登录 | ✅ | `PermitRootLogin no` |
| 禁密码登录 | ✅ | `PasswordAuthentication no` |
| 禁 X11 转发 | ✅ | `X11Forwarding no` |
| MaxAuthTries 3 | ✅ | |
| ClientAlive 5min/2 | ✅ | 空闲 10 分钟断 |
| AllowUsers lytv | ✅ | 白名单 |
| UFW active | ✅ | default deny incoming / allow outgoing |
| UFW 规则 | 22/tcp from 10.0.0.0/8 | 整个 RFC1918 内网 |
| fail2ban | ✅ | sshd jail, bantime 1h, maxretry 3 |
| AppArmor | ✅ | 182 profiles, 106 enforce mode |
| 自动安全更新 | ✅ | unattended-upgrades timers running |
| sysctl 加固 | ✅ | `/etc/sysctl.d/99-hardening.conf` |
|   └ rp_filter=1 | ✅ | strict |
|   └ redirects=0 | ✅ | ICMP/源路由重定向全关 |
|   └ ASLR=2 | ✅ | full |
|   └ kptr_restrict=2 | ✅ | 内核指针不暴露给非 root |
|   └ ptrace_scope=2 | ✅ | 只能 root ptrace |

**备份：**
- `/etc/ssh/sshd_config.bak.20260824-184048`
- `/etc/sysctl.d.bak.20260824-184232/`

### 1.3 APT 镜像源

- 切换到 **阿里云** `mirrors.aliyun.com`（国内 0.10s，原 `archive.ubuntu.com` 0.86s）
- 加了 `deb-src`（用来 build-dep / 编译）
- 备份：`/etc/apt/sources.list.d/ubuntu.sources.bak.20260824-184337`

```ini
# /etc/apt/sources.list.d/ubuntu.sources
Types: deb deb-src
URIs: http://mirrors.aliyun.com/ubuntu/
Suites: resolute resolute-updates resolute-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb deb-src
URIs: http://mirrors.aliyun.com/ubuntu/
Suites: resolute-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
```

### 1.4 BMD 视频卡

**PCI 设备清单：**

| Bus | 设备 | PCI ID | 类型 | 驱动 |
|---|---|---|---|---|
| 04:00.0 | DeckLink Mini Monitor 4K | bdbd:a144 | 输出 (HDMI/SDI) | blackmagic_io (新) |
| 44:00.0 | DeckLink SDI | bdbd:a11b | 输入+输出 (SDI) | blackmagic (legacy) |
| 45:00.0 | DeckLink SDI | bdbd:a11b | 输入+输出 (SDI) | blackmagic (legacy) |

> ⚠️ **44/45:00.0 是同一块卡**（DeckLink Duo）的两个 SDI 端口，PCI 表现为 2 个设备。
> DeckLink SDI/Duo/Quad 是 **legacy 产品**，必须用老 `blackmagic` 驱动（与 `blackmagic_io` 不互通）。

**驱动状态：**
- 版本：Desktop Video 16.2a1
- 来源：本地 `E:\Blackmagic_Desktop_Video_Linux_16.2.tar`（scp 推送）
- 安装：`dpkg -i desktopvideo_16.2a1_amd64.deb` + apt install -f
- DKMS：已注册，kernel 升级自动重编
- 服务：`DesktopVideoHelper` active + enabled
- 固件：全部 OK（dv0: 0x34, dv1: 0x34, io0: 0x11a）

**设备节点：**
```
/dev/blackmagic/dv0   # DeckLink SDI 端口 1
/dev/blackmagic/dv1   # DeckLink SDI 端口 2
/dev/blackmagic/io0   # DeckLink Mini Monitor 4K
```

**实测链路：**
```
gst-launch-1.0 decklinkvideosrc device-number=0 connection=sdi \
  ! videoconvert ! fakesink
→ 检测到 1920x1080 @ 25fps 真实 SDI 输入
```

**遗留：**
- `/tmp/bmd-desktopvideo-16.2.tar` 已删
- 临时解压目录已删
- UFW 只开了 10.0.0.0/8（可考虑收紧到精确子网）

### 1.5 FFmpeg 全 codec 版

**路径：** `/usr/local/bin/ffmpeg`（apt 版已卸载）

**版本：** `git-2026-08-23-1019f8f + allcodec-20260824`

**启用的外部 codec：**
```
--enable-libx264 (0.165.x)  --enable-libx265 (4.0+1)
--enable-libvpx (1.15.0)    --enable-libmp3lame (3.100)
--enable-libfdk-aac (2.0.3) --enable-libopus (1.5)
--enable-libvorbis (1.3.7)  --enable-libtheora (1.2.0)
--enable-libspeex (1.2.1)   --enable-decklink
--enable-gnutls  --enable-zlib  --enable-rpath
--enable-gpl  --enable-nonfree
```

**协议支持：**
```
rtmp rtmps rtmpt rtmpts  ← 不依赖 librtmp（用 ffmpeg 内置 stack）
srt tls dtls http https
```

**实测：**
| 测试 | 结果 |
|---|---|
| SDI 抓帧 → H.264 文件 | ✅ 5.5 Mbps @ 25fps |
| SDI 抓帧 → H.265 文件 | ✅ 1.95 Mbps @ 24.88fps |
| SDI 抓帧 → VP9/Opus webm | ✅ 8.85 Mbps @ 23fps |
| MP3 编码 | ✅ libmp3lame 121x 实时 |
| RTMP 推流 + 收流 | ✅ 端到端通 |

**重要路径：**
```
/usr/local/bin/ffmpeg
/usr/local/bin/x265                    # x265 CLI（顺带装）
/usr/local/lib/libav{device,format,codec,filter,util,swscale,swresample}.so.63
/usr/local/lib/lib{x264,x265,vpx,mp3lame,fdk-aac,opus,vorbis*,theora*,speex,ogg}*
/usr/local/include/{blackmagic,lame,opus,fdk-aac,speex,theora,vorbis,vpx,ogg,x264.h,x265.h}
/usr/local/lib/pkgconfig/*.pc
/usr/local/include/blackmagic/DeckLinkAPIDispatch.cpp   # 编译 decklink 时 include
```

**踩过的坑（已记录）：**
1. ffmpeg 8.0.1 与 DeckLink SDK 16.0 API 不匹配（`GetBytes` 等已移除）→ 用 master
2. ffmpeg 的 `--extra-cflags` 只给 C 编译，不传 CXX → 手工 `sed` 注入 CXXFLAGS
3. Ubuntu 26.04 dev 包大量缺失（`libx264-dev` 等）→ 全从 source 编
4. `lame.pc` 的 `Name` 字段得是 `mp3lame`（不是 `lame`），ffmpeg 才认
5. x265 4.0 + cmake 4.x 不兼容（`CMP0025/0054`）→ sed 删两段
6. github.com 频繁 GnuTLS (-110) 错误 → 改 tarball / 多镜像
7. ffmpeg 8.0.1 用 `disable-programs` 顺手关了二进制，要重开要 `--enable-ffmpeg`

### 1.6 GStreamer 集成

- 版本：**1.28.2**
- 已装 `gstreamer1.0-plugins-bad`（含 `libgstdecklink.so`）
- 元素：`decklinkvideosrc` / `decklinkvideosink` / `decklinkaudiosrc` / `decklinkaudiosink` / `decklinkdeviceprovider`
- 实测抓 1080p25 实时 ✅

### 1.7 常用工具集

| 类别 | 已装 |
|---|---|
| **编译/驱动** | build-essential, dkms, cmake, ninja-build, autoconf, automake, libtool, pkg-config, libssl-dev, libcurl4-openssl-dev, linux-headers-generic |
| **媒体** | ffmpeg 8.0.1（自带）→ 已替换为全 codec 版 / gstreamer 1.28.2 / libav*-dev / libv4l-dev / v4l-utils / mediainfo / sox / imagemagick / exiftool |
| **sysadmin** | jq, tree, ripgrep, fd-find, bat, btop, sysstat, iotop, iftop, nethogs, lsof, strace, psmisc, ncdu, tcpdump, mtr-tiny, nmap, screen, sshfs, fuse3, nfs-common, cifs-utils |
| **存储** | nvme-cli, smartmontools, lsscsi, hdparm |
| **Python** | python3-pip, python3-venv |
| **未装** | docker / podman / nginx / SRS（待补，按需） |

---

## 第 2 部分 — Web 视频编码器项目方案

### 2.1 业务目标

构建支持以下场景的视频处理 Web 平台：
1. **实时 SDI 采集** — 3 张 BMD 卡的 SDI 输入实时编码、推流、录制
2. **文件离线转码** — 上传视频文件 → 多码率 HLS 切片 → 浏览器播放
3. **Web 端管理** — 任务管理、推流控制、录制回放、用户/权限

### 2.2 选型栈（用户确认 · V0.2 Technical Stack Baseline 冻结）

> **冻结声明 (2026-08-25)**: 本节为 VBMF **产品实施技术栈 SoT**。当前仓库尚无正式业务代码, 本次一次性冻结, 后续变更须走 V0.2 Architecture Change Review。
> **分层关系**: 本表是「产品实施栈」; 媒体运行时/架构技术 (Rust Media Agent / FFmpeg / GStreamer / BMD DeckLink / **SRS** / JSON-RPC / SDI·SRT·UDP / RTMP·HLS·WHEP) 见 `docs/architecture/ARCHITECTURE_V0.2.md`; Phase 0.5 的 HTML/CSS/JS 是 **UX 原型** (验证 IA/Workflow/Surface/Design System), 其结论在 **Phase 4 由本表的 React 19 + shadcn/ui 真正落地**, 二者不冲突。Phase 0.6 验收 Harness (Python+YAML+Playwright) 见 `docs/phase-0.6/`。

#### Control Plane / Web Console

| 层 | 选型 | 角色 |
|---|---|---|
| 前端框架 | **React 19** | UI (已确认; 不切换 Vue) |
| 语言 | **TypeScript** | 全栈类型安全 |
| 构建 | **Vite** | dev server / 生产构建 (SPA, 不需 SSR/Next.js) |
| UI 库 | **shadcn/ui + Tailwind CSS** | ⚠️ 由 Ant Design Pro 改为 shadcn/ui — VBMF 是广播级媒体操作控制台, 需自建 Broadcast Design System, shadcn 的 Open Code + Composition 模型更适配 |
| 图标 | **Lucide** | 与 shadcn 同源 |
| Client State | **Zustand** | PGM/PVW、当前 Channel、Operator Mode、Runtime Status、Multiview 选择 (不塞 Context) |
| Server State | **TanStack Query** | API cache / polling / mutation / invalidation |
| 表单 | **React Hook Form** | Profile/Bundle/Source/Output/Channel/ChangeSet/Override |
| 校验 | **Zod + drizzle-zod** | 前后端共享 schema, 减少 Frontend≠Backend≠DB 漂移 |
| 图表 | **ECharts** | bitrate/FPS/latency/health trend 等 |
| 高频实时图形 | **Canvas / WebGL** | waveform / VU meter / spectrogram / timeline / multiview overlay |
| HLS 播放 | **hls.js** | Preview / Program / Output 播放 |
| 低延迟 | **WHEP** | 低延迟 preview / monitoring (≠ 完整 WebRTC Control Plane) |
| 高级浏览器视频 | **WebCodecs** | 仅 frame-level 处理/thumbnail/分析, 非默认 `<video>` 路径 |
| 实时通信 | **WebSocket + SSE** | 高频运行态用 WS; 任务进度优先 SSE |
| E2E 测试 | **Playwright** | 浏览器点击验收 (UI-E2E-01~04) |
| 单元测试 | **Vitest** | 前端/逻辑单测 |

#### Backend / Data / Media Gateway

| 层 | 选型 | 角色 |
|---|---|---|
| 后端 HTTP | **Fastify** | 高性能 Node 框架 (REST/WS/SSE/Auth/Job Orchestration) |
| 语言 | **TypeScript** | 与前端共享类型 |
| 数据库 | **PostgreSQL** | 主数据（用户/任务/录制元数据/权限/配置/审计） |
| ORM | **Drizzle** | TS 类型安全 + SQL 优先 |
| 缓存 | **Valkey** | Redis 兼容, runtime cache / session / locks / rate limit |
| 队列 | **BullMQ** | Valkey 驱动的任务队列 (转码/缩略图/打包/分析) |
| 对象存储 | **RustFS** | S3 兼容, 原片/Proxy/Thumbnail/HLS assets; **V0.2 canonical object storage, 不再保留 MinIO 分叉** (见 Deployment Contract) |
| 流媒体网关 / Streaming Gateway | **SRS** ⚠️ 已锁定 | 主流媒体服务器: RTMP/SRT/HLS/WebRTC(WHEP) 汇聚·分发·协议转换; FFmpeg/GStreamer → SRS → {RTMP, HLS, WHEP}; **不纳入 MediaMTX** (避免双 Gateway 增加运维/故障域/测试矩阵) |
| 鉴权 | **Better Auth** | 用户/会话 |
| 授权 | **CASL** | RBAC: User→Role→Permission→Capability→Action (TAKE/Override/Failover/Restart…) |
| 可观测 | **OpenTelemetry + Prometheus + Grafana + Sentry** | tracing / metrics / dashboard / error tracking |
| 包管理 | **pnpm** | workspace monorepo |

**优势：**
- 全部开源 + 真·自由协议（避 Redis/MinIO license 风险）
- 现代化但成熟（Fastify 4.x, Drizzle, React 19, shadcn/ui 均有生产案例）
- Drizzle + Fastify + Zod 共享 schema 减少代码重复
- **前端 UI 与媒体引擎解耦**: React 负责 Control/State/UI; FFmpeg/GStreamer/Rust 负责 Media Plane; `<video>`/MSE/WHEP/WebCodecs 经独立 Media Controller 管理, 不触发 React render 承担解码

### 2.3 必须补的组件

| 优先级 | 组件 | 用途 |
|---|---|---|
| 🔴 必须 | `bullmq` | Valkey 驱动的任务队列 |
| 🔴 必须 | 转码 worker (独立进程) | spawn ffmpeg 转码任务 (Fastify 不直接跑长时 ffmpeg) |
| 🔴 必须 | `SRS` (已锁定主流媒体服务器) | 流媒体服务器（ffmpeg 不能裸 RTMP 派发）；**MediaMTX 不纳入当前 V0.2** |
| 🔴 必须 | `hls.js` (前端) | 浏览器 HLS 播放 |
| 🔴 必须 | `@aws-sdk/client-s3` (Node) | RustFS SDK |
| 🔴 必须 | `better-auth` | 用户/会话 (2.2 已确认) |
| 🔴 必须 | `@casl/ability` | RBAC 权限 (2.2 已确认) |
| 🔴 必须 | `zustand` | 前端 Client/Runtime State (2.2 已确认) |
| 🔴 必须 | `@tanstack/react-query` | 前端 Server State (2.2 已确认) |
| 🔴 必须 | `react-hook-form` + `zod` + `drizzle-zod` | 表单 + 前后端共享 schema (2.2 已确认) |
| 🔴 必须 | `shadcn/ui` + `tailwindcss` + `lucide-react` | 前端 UI 基线 (2.2 已确认, 替代 AntD Pro) |
| 🟡 高 | `@fastify/sse` 或 `socket.io` | 编码进度推送 (任务进度优先 SSE) |
| 🟡 高 | `ws` / `@fastify/websocket` | 高频运行态 (Channel health / PGM-PVW / metrics) |
| 🟡 高 | `tus-js-client` + `@fastify/multipart` | 大文件断点续传 |
| 🟡 高 | `fluent-ffmpeg` | Node 调 ffmpeg 封装 |
| 🟡 高 | `@fastify/swagger` + `@fastify/swagger-ui` | API 文档 |
| 🟡 高 | `drizzle-kit` | migrations |
| 🟡 高 | `@fastify/cors` `@fastify/helmet` `@fastify/rate-limit` | 基础安全 |
| 🟡 高 | `echarts` / `echarts-for-react` | 图表 (2.2 已确认) |
| 🟡 高 | `whep` 客户端 (WebRTC/WHEP) | 低延迟预览 (2.2 已确认, ≠ 完整 WebRTC) |
| 🟡 高 | `webcodecs` (按需) | frame-level 处理/thumbnail/分析 |
| 🟢 中 | `biome` | 替代 ESLint+Prettier |
| 🟢 中 | `vitest` + `playwright` | 测试 (前端单测 + 浏览器 E2E; Phase 0.6 另有 Python+YAML Acceptance Harness) |
| 🟢 中 | `@sentry/node` + `@sentry/react` | 错误追踪 |
| 🟢 中 | OpenTelemetry | 链路追踪 |
| 🟢 中 | `prom-client` + Grafana | 监控指标 |
| 🔵 可选 | Temporal | 重型工作流（用不到） |
| 🔵 可选 | Keycloak | SSO（前期不需要） |

### 2.4 推荐新增（按优先级）

```
阶段 1 (骨架): docker-compose + Fastify + Vite + Valkey + RustFS
阶段 2 (转码): bullmq + worker + fluent-ffmpeg
阶段 3 (流): SRS + hls.js + flv.js
阶段 4 (用户): better-auth + casl
阶段 5 (生产): sentry + prometheus + grafana + opentelemetry
```

### 2.5 架构图

#### 实时 SDI 直播流

```
┌───────── 10.30.15.10 (本机) ─────────┐
│                                      │
│  ┌─[BMD SDI 1/2]                    │
│  │                                  │
│  │  /dev/blackmagic/{dv0,dv1,io0}   │
│  │         │                         │
│  │         ▼                         │
│  │  ┌── ingest 进程 ──┐              │
│  │  │ GStreamer pipeline │           │
│  │  │  - decklinkvideosrc           │
│  │  │  - 时间戳校准                 │
│  │  └────────┬─────────┘             │
│  │           │                        │
│  │           ▼                        │
│  │  ┌── ffmpeg 编码 ──┐              │
│  │  │ -c:v libx264    │              │
│  │  │ -c:a aac        │              │
│  │  │ -f flv          │              │
│  │  └────────┬─────────┘             │
│  │           │                        │
│  │           ▼                        │
│  │  ┌── SRS (1935) ──┐              │
│  │  │   收 RTMP           │         │
│  │  │   出 HLS / HTTP-FLV │         │
│  │  │   出 WebRTC (可选)  │         │
│  │  │   录制 .mp4 到盘   │         │
│  │  └────────┬─────────────┘         │
│  │           │                        │
│  └───────────┼────────────────────────┘
│              │
│              ▼
│       ┌─[Valkey]── 推送状态/进度 Pub-Sub
│       │
│       ▼
│  ┌─ Web 前端 (React 19 + Vite + shadcn/ui + Tailwind) ─┐
│  │  实时进度 (SSE)                                    │
│  │  播放器 (hls.js / WHEP)                            │
│  │  任务管理 / Broadcast Components (VBMF Design System) │
│  └─────────────────────────────────────────────────────┘
│
└──────────────────────────────────────────┘
```

#### 文件离线转码

```
Web 上传 .mp4 (tus 断点续传)
  ↓
Fastify → S3 预签 URL → 直传 RustFS
  ↓
DB 插入 job 记录
  ↓
BullMQ enqueue
  ↓
worker 从 Valkey 取任务
  ↓
spawn ffmpeg 多码率 HLS 切片
  ↓
分片上传 RustFS
  ↓
DB 标记完成，状态推 SSE
  ↓
前端任务列表看到 100%，点播放（hls.js）
```

### 2.6 实施路线图

**Phase 0: 立项 & 文档** （当前）
- ✅ 服务器现状盘点
- ✅ 选型确认
- ⏳ 本文档

**Phase 1: 单机最小可用**（~3 天）
- [ ] pnpm monorepo 初始化
- [ ] docker-compose.yml: api + web + valkey + rustfs + srs
- [ ] Fastify + Drizzle + PostgreSQL 骨架
- [ ] React 19 + Vite + shadcn/ui + Tailwind 骨架 (VBMF Design System 起步)
- [ ] 健康检查 + Swagger UI

**Phase 2: 转码核心**（~5 天）
- [ ] BullMQ 集成
- [ ] 转码 worker (spawn ffmpeg)
- [ ] RustFS S3 上传
- [ ] tus 断点续传
- [ ] 进度 SSE 推送
- [ ] 前端上传 + 任务列表 + 播放器

**Phase 3: 实时流**（~3 天）
- [ ] SRS 集成
- [ ] **SDI ingest 由 Rust Media Agent 拥有**：BMD DeckLink → GStreamer ingest → RAW → (Normalize) → FFmpeg Live Encode → SRS（Fastify/BullMQ 不得直接拥有实时媒体生命周期，见运行时所有权契约）
- [ ] HLS 播放
- [ ] 实时预览页
- [ ] Live Recording 归属 Media Agent（Post-processing 转码/剪辑归 BullMQ Worker）

**Phase 4: 用户 & 权限**（~2 天）
- [ ] better-auth 集成
- [ ] CASL RBAC
- [ ] 用户/角色管理 UI

**Phase 5: 生产化**（~5 天）
- [ ] Sentry 接入
- [ ] Prometheus + Grafana
- [ ] OpenTelemetry
- [ ] 反向代理 (Caddy) + HTTPS
- [ ] CI/CD (GitHub Actions)
- [ ] 备份策略

**Phase 6: 高级特性**（可选）
- [ ] 录制 + 回放
- [ ] 多租户
- [ ] AI 字幕 / 物体识别（用 ffmpeg + whisper）
- [ ] WebRTC 上行（浏览器推流）

### 2.7 待决策项

| # | 决策点 | 选项 | 推荐 |
|---|---|---|---|
| 1 | 鉴权方案 | better-auth / lucia-auth / @fastify/jwt | **better-auth**（现代 + 全栈 + TS-first） |
| 2 | 流媒体服务器 | SRS（已锁定） | **SRS**（项目已确认主流媒体服务器；RTMP/HLS/SRT/WebRTC-WHEP 全覆盖；**MediaMTX 不纳入**以避免双 Gateway 负担） |
| 3 | 对象存储 | RustFS / MinIO | **RustFS**（V0.2 canonical；MinIO 分叉已废弃，见 Deployment SoT） |
| 4 | 实时推送 | SSE / WebSocket | **SSE**（Fastify 内置、单向、够用） |
| 5 | 上传协议 | tus / 分片普通 | **tus**（断点续传 + 进度） |
| 6 | 部署 | docker-compose / K8s | 起步 **docker-compose**；规模化 K8s |
| 7 | 监控 | Sentry 云 / GlitchTip 自部署 | 起步 **Sentry 云**；合规上 **GlitchTip** |
| 8 | 反向代理 | Caddy / nginx + certbot | **Nginx**（V0.2 广播场景需精细 proxy policy：大上传/WS/SSE/媒体边界；以 `DEPLOYMENT_AND_DEV_RUNTIME.md` §8 Nginx Reverse Proxy Contract 为准；Caddy 不纳入） |
| 9 | Auth 用户模型 | 单租户 / 多租户 | 起步 **单租户**；SaaS 化时升级 |
| 10 | 浏览器支持 | 现代 only / 兼容旧版 | **现代 only**（Chrome/Edge/Safari/Firefox 最新版） |

---

## 第 3 部分 — 操作参考

### 3.1 SSH 登录

```powershell
# Windows PowerShell
ssh -i $env:USERPROFILE\.ssh\id_pwl -o BatchMode=yes lytv@10.30.15.10

# 单条命令
ssh -i $env:USERPROFILE\.ssh\id_pwl lytv@10.30.15.10 'your command here'

# 传文件
scp -i $env:USERPROFILE\.ssh\id_pwl local.txt lytv@10.30.15.10:/tmp/

# 文件名（当前 key）
C:\Users\p1357\.ssh\id_pwl     # ed25519, fingerprint SHA256:PHZOZlPurBLzqOGV4rAsR7LJASLyU0iSDD8aQfCUyMo
```

### 3.2 重要路径速查

| 类别 | 路径 |
|---|---|
| **ffmpeg** | `/usr/local/bin/ffmpeg`, `/usr/local/lib/libav*` |
| **BMD 驱动** | `/usr/lib/libDeckLinkAPI.so`, `/usr/local/include/blackmagic/` |
| **BMD 设备** | `/dev/blackmagic/{dv0,dv1,io0}` |
| **FFmpeg 库** | `/usr/local/lib/lib{x264,x265,vpx,mp3lame,fdk-aac,opus,vorbis*,theora*,speex,ogg}*` |
| **gstreamer** | `/usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstdecklink.so` |
| **安全配置** | `/etc/ssh/sshd_config.d/00-hardening.conf`, `/etc/sysctl.d/99-hardening.conf`, `/etc/ufw/`, `/etc/fail2ban/jail.local` |
| **APT** | `/etc/apt/sources.list.d/ubuntu.sources` (阿里云) |
| **sudoers** | `/etc/sudoers.d/90-lytv-nopasswd` |
| **备份** | `/etc/ssh/sshd_config.bak.*`, `/etc/sysctl.d.bak.*` |

### 3.3 关键 FFmpeg 命令

**SDI 抓帧测试：**
```bash
ffmpeg -f decklink -i "DeckLink SDI (1)" -t 5 -c:v copy -c:a copy test.mkv

# 列出设备
ffmpeg -f decklink -list_devices 1 -i dummy
# 列出格式
ffmpeg -f decklink -list_formats 1 -i "DeckLink SDI (1)"
```

**SDI → RTMP 推流：**
```bash
ffmpeg -f decklink -i "DeckLink SDI (1)" \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 4M -g 50 -bf 0 \
  -c:a aac -b:a 128k -ar 48000 \
  -f flv rtmp://server:1935/live/stream_key
```

**SDI → HLS（切片录制）：**
```bash
ffmpeg -f decklink -i "DeckLink SDI (1)" \
  -c:v libx264 -preset veryfast -crf 23 \
  -c:a aac \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename "/var/www/hls/seg_%03d.ts" \
  /var/www/hls/index.m3u8
```

**文件 → 多码率 HLS：**
```bash
ffmpeg -i input.mp4 \
  -map 0:v -c:v:0 libx264 -b:v:0 400k -s:v:0 640x360 \
  -map 0:v -c:v:1 libx264 -b:v:1 800k -s:v:1 1280x720 \
  -map 0:v -c:v:2 libx264 -b:v:2 2000k -s:v:2 1920x1080 \
  -map 0:a -c:a aac -b:a 128k \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename "v%v/seg_%03d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0" \
  index.m3u8
```

**RTMP 收流存为 FLV：**
```bash
ffmpeg -listen 1 -f flv -i rtmp://0.0.0.0:1935/live/test \
  -c copy -f flv record.flv
```

**查 decklink 实时状态：**
```bash
BlackmagicFirmwareUpdater status
lspci -k -s 04:00.0  # Mini Monitor
lspci -k -s 44:00.0  # DeckLink SDI 1
lsmod | grep -E "blackmagic|vfio"
```

### 3.4 BMD + Docker 模式

> ⚠️ **V0.2 唯一模式 = 设备透传（方式 A）**。理由：Runtime Ownership Contract（`docs/architecture/TECHNOLOGY_STACK_AND_RUNTIME_OWNERSHIP.md` §4 F2/F4/F11）已锁死 **Rust Media Agent 是 DeckLink / GStreamer / Live FFmpeg 的唯一 Runtime Owner**。任何把 DeckLink 留在 Host、由 Host ffmpeg 收 SDI 再转发进容器的方案，都会让 Media Agent 失去硬件媒体生命周期所有权，直接违反 F2/F4/F11，**不得采用**。

**方式 A：设备透传（V0.2 canonical — 开发/生产统一）**
```bash
# Host 上加载模块（宿主机专属：Linux kernel + BMD driver + DeckLink hardware）
sudo modprobe blackmagic blackmagic-io vfio-pci

# Media-Agent 容器直接持 DeckLink（设备透传，Agent 拥有生命周期）
docker run -it --rm \
  --device /dev/blackmagic \
  --device /dev/dv0 --device /dev/dv1 --device /dev/io0 \
  -v /usr/lib/libDeckLinkAPI.so:/usr/lib/libDeckLinkAPI.so:ro \
  --network host \
  your-bmd-image \
  # 容器内: Rust Media Agent 启动 GStreamer ingest + Live FFmpeg + DeckLink session
```

**方式 B：网络转发（降级为 Historical Compatibility / Diagnostic Workaround — 不再推荐生产）**
```bash
# 仅用于: 诊断/临时旁路/无透传权限的受限环境; 不得作为 V0.2 实施基线
# Host: ffmpeg 收 SDI → RTMP
ffmpeg -f decklink -i "DeckLink SDI (1)" \
  -c:v libx264 -preset ultrafast -f flv \
  rtmp://0.0.0.0:1935/live/sdi

# 容器里只消费网络流
ffmpeg -i rtmp://host.docker.internal:1935/live/sdi -c copy out.flv
```
> ⚠️ 此模式使 Host ffmpeg 持有 DeckLink，Media Agent 退化为网络流消费者，**与 F4/F11 冲突**；仅当设备透传不可行时作临时诊断手段。

**关键约束：**
- 内核模块必须 host 加载（容器共享 kernel）
- `IOMMU` (VT-d/AMD-Vi) 必开
- `/dev/dv*` 是字符设备，**不能多容器共享**
- librtmp 用 ffmpeg 内置 stack（不必装 librtmp）
- **全开发环境 Docker 化**：PostgreSQL / Valkey / RustFS / SRS / Fastify / Worker / Web / Media Agent 均跑容器，仅 Linux kernel + BMD driver + DeckLink 属宿主机；开发经 **SSH** 操作 BMD 服务器（SSH = Dev/Ops Transport，不进入 Runtime Control Plane）；热更新 / 自愈 / ENV Preflight 见 `docs/architecture/DEPLOYMENT_AND_DEV_RUNTIME.md`。

### 3.5 监控与排错

```bash
# 系统
htop
btop
free -h; df -h
iostat 1   # sysstat
iotop
iftop
nethogs

# 网络
ss -tlnp
ip -s link show eno1
mtr 1.1.1.1

# 设备
nvme smart-log /dev/nvme0n1
smartctl -a /dev/sda

# 进程
strace -p <pid> -f -e trace=network
lsof -p <pid>

# 日志
journalctl -u ssh -f
journalctl -u DesktopVideoHelper -f
journalctl -u fail2ban -f
journalctl -u ufw -f
tail -f /var/log/fail2ban.log

# 防火墙
sudo ufw status verbose
sudo iptables -S

# fail2ban
sudo fail2ban-client status
sudo fail2ban-client status sshd

# sysctl 验证
sysctl net.ipv4.conf.all.rp_filter
sysctl kernel.randomize_va_space
```

---

## 第 4 部分 — 历史决策与坑

| # | 决策 / 坑 | 原因 | 后果 |
|---|---|---|---|
| 1 | apt ffmpeg 卸载，自编译全 codec | 8.0.1 没 decklink，编 9 个 codec 库 | /usr/local/bin/ffmpeg = git+allcodec-20260824 |
| 2 | ffmpeg 8.0.1 vs master | 8.0.1 API 不匹配 SDK 16.0 | 用 master（git-2026-08-23） |
| 3 | ffmpeg CXXFLAGS 手工 sed | `--extra-cflags` 不传 C++ | 注入 `-I/usr/local/include/blackmagic` 到 CXXFLAGS |
| 4 | 全 codec 从 source 编 | Ubuntu 26.04 dev 包缺失 | 9 个 codec + ogg + decklink 全装到 /usr/local |
| 5 | x265 cmake patch | x265 4.0 + cmake 4.x CMP0025/0054 删了 | sed 删两段解决 |
| 6 | x265 用 bitbucket 4.1 tarball | github.com GnuTLS 抽风 | bitbucket 1.7MB 拉到 |
| 7 | libvpx 用 tarball 1.15.0 | 同上 | 5629622 字节 |
| 8 | lame/opus 手写 .pc | 自带 .pc 文件名不匹配 | Name 改成 mp3lame / opus |
| 9 | Ubuntu 26.04 dev 包大量缺失 | `libx264-dev` 等找不到 | 走 source 编译路线 |
| 10 | deb-src 加进 sources | build-dep 要 | 已加，备份在 .bak.debsrc |
| 11 | UFW 0.0.0.0/8 宽 | 早期先宽松 | 后续可收紧 |
| 12 | APT 切阿里云 | 国内访问 archive.ubuntu.com 慢 10x | 3.2 MB/s 实际 |
| 13 | PowerShell 管道 CR 问题 | .NET 偷偷加 \r\n 到原生 stdin | 远端 `tr -d '\r' \| bash -s` 解决 |
| 14 | 安全策略拦 rm -Item | 不可恢复删除 | 用随机字节覆盖代替 |
| 15 | 临时 askpass 密码注入 | 配 NOPASSWD sudo 前必须 | `SSH_ASKPASS` + `tr -d "\r" \| bash -s` 模式 |

---

## 第 5 部分 — 下一步建议

### 立即可做（无新依赖）

1. **拉 SRS** —— 跑个 RTMP 收流测试，验证 ffmpeg → SRS 链路
2. **写 systemd 服务** —— SDI 抓帧 → RTMP 推流的开机自启
3. **加固 UFW 源 IP** —— 22 端口只对 10.30.0.0/16 开（不再用 10.0.0.0/8）

### 项目起步

1. **Phase 1（最小可用）** —— 装 docker / 写 docker-compose / 拉 Fastify + Vite 骨架
2. **DB schema 设计** —— users / streams / recordings / jobs / permissions
3. **API 端点设计** —— RESTful + OpenAPI

### 长期规划

1. **监控告警** —— Prometheus + Grafana + Sentry
2. **CI/CD** —— GitHub Actions / Gitea Actions 自动测试 + 部署
3. **集群化** —— K8s / k3s（如果单台不够）

---

## 附录 A：服务器与本地通信

- **Server**: 10.30.15.10 (Linux)
- **Local**: 100.64.0.1, 10.128.0.161, 172.24.128.1 (Windows)
- **SSH 私钥**: `C:\Users\p1357\.ssh\id_pwl`
- **scp 传文件**: `scp -i C:\Users\p1357\.ssh\id_pwl <local> lytv@10.30.15.10:/tmp/`

## 附录 B：关键技术参数

| 项 | 值 |
|---|---|
| SDI 输入分辨率 | 1920x1080 @ 25fps, interlaced, v210, bt709 |
| 编码能力 | x264 ultrafast: 实时 / x265: 24.88 fps / VP9: 23 fps |
| RTMP 推流 | 内置 stack（不需 librtmp） |
| HTTPS/加密 | gnutls (TLS 1.3) |
| 对象存储 | 待选 (RustFS / MinIO) |
| 任务队列 | 待选 (BullMQ) |
| 流媒体服务器 | **SRS** (已锁定, 见 §2.2) |

## 附录 C：技术决策时间线

| 时间 | 决策 |
|---|---|
| T+0 | SSH 配置 / 装 id_pwl 公钥 |
| T+10 | 系统初始化 + 加固 (SSH/UFW/fail2ban/sysctl) |
| T+30 | 切阿里云 APT 源 |
| T+45 | 装常用工具 300+ 包 |
| T+60 | 装 BMD Desktop Video 16.2 + 验证 3 张卡 |
| T+90 | 编译全 codec 版 ffmpeg（包含 decklink） |
| T+120 | 测试 RTMP 推流（用 ffmpeg 自 listen） |
| T+150 | 讨论技术栈（Fastify + Drizzle + ...） |
| T+now | 写完本方案文档 |

---

**文档版本**: v1.0 (2026-08-24)
**下次更新**: 项目启动后
**维护人**: 风从平地起
