# PRD 评审 — VBMF Runtime Abstraction & Portability PRD（165 条）

> 评审对象：`docs/VBMF Runtime Abstraction & Portability PRD.md`（Proposed Freeze Candidate，Phase 0.6）
> 评审日期：2026-08-28
> 对照基线：`ARCHITECTURE_V0.2.md`（LOCK FINAL）、`docs/architecture/IMPLEMENTATION_ADDENDUM.md`、已落盘 6+1 契约、`services/media-agent` 当前代码
> 符号：✅ 与已有裁决/Addendum/V0.2 一致（文档层已采纳）｜🟡 合理，但代码未落地（Phase 0.6 待实现缺口）｜🔧 合理，需补建文档（PRD #156 要求的缺失契约）｜⚠️ 有问题/需澄清/与裁决冲突

## 0. 事实基线（代码现状，决定"是否采纳"）
- 当前无 `HardwareProvider` / `MediaBackend` trait（Provider/Backend SPI 未建立）。
- 当前无统一 `RuntimeEvent` / `RuntimeError`（Domain error/event 类型不存在）。
- 当前无 Provider Registry、无 Mock Provider/Backend trait 抽象。
- 当前仍是扁平 `decklink.rs`（50KB），非 PRD #127 目标结构 `providers/blackmagic/`。
- 当前**无任何 preflight**（`preflight` 0 匹配）。
- 当前 **11 个文件直接使用 `device_number`**（graph_intent/resolver/signal/port/pipeline/main/decklink/hw_port_01 等），与 PRD #8/#99 冲突。
- 结论：**PRD 的 P0 条目几乎全部"合理且尚未在代码采纳"**，正是 Phase 0.6 的实现目标；文档层已由 Addendum + 6+1 契约覆盖大部分，但 PRD #156 要求的 5 份契约尚未建。

## 1. 架构原则 / 四层 / 依赖 / 迁移（#1–#6, #135, #136, #158, #159, #160, #161, #162, #129）
- #1 Canonical Model 冻结区域 ✅（与 Addendum §3 一致）
- #2 四层边界（Domain/Contract/Runtime/Adapter）✅（Addendum §0 四层）
- #3 禁止 Domain→Adapter 依赖 ✅
- #4 Session Ownership ✅（但仅"冻结/明确"，V0.2 现状见 ⚠️#159）
- #5 Binding 连接 Physical↔Provider↔Runtime ✅
- #6 Provider/Backend 是 Adapter，非 Domain ✅
- #135 Dependency Direction（Domain→Contracts→Runtime→Adapters）✅
- #136 依赖规则（Provider 只依赖 Contract，不依赖 UI/Control Plane）✅
- #158 不改变 V0.2 Graph/DataPlane/Switch/Health/Ownership ✅（但 Ownership 见 ⚠️#159）
- #159 Phase 0.5 LOCK FINAL，本 PRD 仅 additive ✅
- #160 Phase 0.6 子阶段 0.6A–0.6K ✅（与我裁决 0.6A~0.6J 基本一致，PRD 多了 0.6K Acceptance，可接受）
- #161 Priority P0/P0.5/P1/P2 ✅（与裁决一致；P2 连契约暂缓）
- #162 当前明确不要做 ⚠️→✅（与裁决"不做清单"一致，但 #162 缺"信号 AI 分类器已在 #54 单列"，OK）
- #129 Strangler Pattern 迁移 ✅（禁止一次性重写）

## 2. 硬件身份（#7–#14）
- #7 Stable Identity 结构 🟡（合理；当前 `device.rs` 用 device-number，未用 DeviceHandle，**代码未采纳**）
- #8 用 DeviceHandle，非 device-number 🟡（合理；**当前 11 处直接用 device_number，P0 缺口**）
- #9 Identity 可多源（PersistentId>DeviceHandle>TopologicalId>EnumOnly）✅（与 memory FFI 共识一致）
- #10 无 Identity 时拒绝，不自动 UUID 🟡
- #11 Identity ≠ Runtime Address（device-number 不默认 0）🟡（**核心 P0 缺口**）
- #12 Identity 与 Topology 分离 ✅
- #13 Discovery 出 Identity+Capability，不出 Runtime Address 🟡
- #14 PersistentId 用于长期绑定 🟡

## 3. Canonical / Session / Binding / Provider / Backend 细化（#15–#39）
- #15 Canonical Session Model 存在，Session 不含 real Pipeline ✅（memory #7：session.rs 是 Canonical，但不含 real pipeline）
- #16 Provider 禁言 impl，只允许声明契约 ⚠️**需澄清**：与"FFI/binding 必须在 Provider 内"冲突——Provider 必须含 vendor SDK 调用实现。建议改为"Provider 不得包含 vendor 之外的通用业务逻辑"。
- #17 Backend 通过 Contract 暴露，不暴露 GStreamer 类型 🟡（Backend SPI 未建）
- #18 Session 引用 Pipeline handle，非拥有 GStreamer 对象 🟡
- #19 Binding 含 Physical/Provider/Runtime Resource ✅（Addendum §6）
- #20 GraphRuntimeIntent 仅 Canonical 字段（无 GStreamer/BMD）🟡
- #21 Session 不可包含 real Pipeline，只能引用 ⚠️**与 #56 措辞矛盾**：#56"一个 Session 可以包含 Video/Audio/Metadata Graph"。需澄清：Session *逻辑包含* Graph 语义描述，但 *struct 内不含* real Pipeline 对象。建议统一措辞。
- #22–#39 各类字段/语义细化（Connection/Signal/Format/Lease/Health/Session lifecycle 等）🟡（合理，多数属 P0/P0.5 待实现；与 V0.2/Addendum 一致，无冲突）

## 4. Preflight / Explainability（#40, #41）
- #40 Preflight 联合 Source/Backend/Format/Clock/Resource/Session ✅（V0.2 §3.5 有 preflight 概念）
- #41 Explainability（为什么能/不能跑）🟡（**当前无 preflight 实现，P0 缺口**）

## 5. 资源模型（#42–#44, #120）
- #42 Resource Vector（CPU/GPU/MEMORY/.../DEVICE_SESSION/ENCODER_SESSION）🟡⚠️**需补充**：未声明与 V0.2 §3.11 九维 Resource Vector 对齐，避免另起一套语义（RUNTIME_RESOURCE_MODEL.md 已强调此点，PRD 应显式引用）。
- #43 Resource Capacity（Supported/Capacity/Available/Allocated 区分）🟡（合理；P0.5 缺口）
- #44 RuntimeEvent 统一结构（device/port/session/pipeline/timestamp/event）🟡（**当前无统一定义，P0 缺口**）
- #120 Resource Exhaustion 由 Preflight 提前拒绝 🟡

## 6. Runtime Event / Error / Supervisor（#45, #46）
- #45 Canonical Runtime Error 枚举（DeviceUnavailable…SessionConflict）🟡（**未定义，P0 缺口**）
- #46 Supervisor 只认 Canonical Event/Error，禁 BMD HRESULT/GStreamer Message 🟡（**当前 Supervisor 直接依赖 vendor 错误，P0 缺口**）

## 7. 配置三分法 / Health / Discovery / Probe（#47–#54）
- #47 Health Model（Channel↓Subsystem↓Node，Media Agent 只负责 Node Runtime Health）✅（与 V0.2 一致）
- #48 Configuration/Provisioning/Runtime/Observation/Evidence 严格分离 ✅（Addendum §3.2 三态分离，PRD 扩展为五态，合理）
- #49 Hardware Discovery 只答设备/Port/Capability，不启动 Pipeline ✅
- #50 Runtime Probe（能否打开/binding 有效）🟡
- #51 Signal Probe（有信号/锁定/格式/音频）🟡
- #52 Content Probe（Black/Active/Frozen/TestPattern/Unknown）✅（signal.rs 已有 content state machine）
- #53 NoSignal≠Black≠Frozen 严格区分 🟡（signal.rs 可能部分区分，需核对严格性）
- #54 黑场检测基于 Frame window/Luma statistics，不引入 AI ✅（与 #162 一致）

## 8. Audio/Video Graph / Session Graph（#55, #56）
- #55 Video/Audio/Metadata 独立 Graph，统一 Runtime container 不合并业务 Graph ✅（保持 V0.2）
- #56 一个 Session 可包含 Video/Audio/Metadata Graph，但 Session 不改 Graph semantics ⚠️**与 #21 措辞需统一**（见 #21）

## 9. 替换 / 容灾（#57–#67）
- #57 Hot Standby（Primary/Backup Port，甚至 BMD+AJA，Failover 由 Policy 决定，Provider 不得自切）✅
- #58 Hardware Replacement（DeviceRemoved→BindingStale→SessionDegraded，禁自动找新卡）✅（Addendum 失败闭合）
- #59 Hardware Addition（DISCOVERED→CAPABILITY_VERIFIED→PROVISIONED→AVAILABLE，不自动进 Production）✅
- #60 Runtime Resource Change（GStreamer #1→#3，DeviceId/PortId/GraphIntent 不变，仅 RuntimeBinding 更新）✅
- #61 Provider Replacement（BMD→AJA 只 Add/Rediscover/Provision/Verify，不改 Domain/Graph/Session/Supervisor/Health/UI）✅（替换矩阵核心）
- #62 Backend Replacement（GStreamer→FFmpeg 只换 MediaBackend，不改 GraphIntent/Device/Port/Session/Supervisor）✅
- #63 Audio Backend Replacement（Embedded→MADI/Dante/AES 只换 Audio Provider/Backend，Video Graph 不重构）✅（第 9 替换轴，关键）
- #64 GPU Replacement（NVIDIA/AMD/Intel/CPU 经 AccelerationProvider，现在只建 Contract）✅（P1）
- #65 Infrastructure Adapter（PostgreSQL/RustFS/Valkey 全属 Adapter）✅（P2）
- #66 有真实替换轴+近期消费方→现在建 Contract，否则暂缓 ✅（"无消费方不建抽象"精确化，与裁决一致）
- #67 Deployment Adapter（Docker/runc 属 Deployment/Security Plane，非 Domain）✅（P2）

## 10. 安全 / 供应链 / ABI / Registry / Feature / Sim（#68–#76）
- #68 Security Boundary（Provider/Backend 高权限，least privilege/cap drop/seccomp/AppArmor）🟡（P1 安全，合理）
- #69 Supply Chain（记录 version/ABI/SDK/build SHA/artifact SHA256）🟡（P1）
- #70 ABI Boundary（Vendor SDK 只在各自 Provider，不进 Domain）✅
- #71 Provider Registry（静态注册 BMD+Mock，未来 AJA，不做动态 .so Loader）🟡（**未建，P0 缺口**）
- #72 Feature Boundary（建议 `default`/`simulation`/`bmd`/`gstreamer`/`ffmpeg`/`hardware-test`，`bmd≠gstreamer` 不同轴）⚠️**命名与裁决不一致**：我们裁决用 `bmd-provider`/`gstreamer-backend` 以显式区分轴（避免扁平 `bmd`/`gstreamer` 让人误以为同轴）。建议 PRD 采纳我们的 feature 命名。
- #73 Simulation 必须 MockHardwareProvider/MockMediaBackend，而非 MockBMDDevice ✅（P0 缺口：当前无 Mock trait）
- #74 Simulation 必须支持 1/2/4/8 input、input-only/output-only/mixed、no signal/black/active/frozen/busy/removed/replaced/binding changed/backend failed/clock lost/lease conflict/resource exhausted 🟡（**当前 Mock 不支持此矩阵，P0 缺口**）
- #75 Provider Contract Test（enumeration/identity/port/capability/open/signal/format/error/recovery）🟡
- #76 Backend Contract Test（create/start/stop/recover/first buffer/PTS/Bus/failure/release）🟡

## 11. 门禁 / 边界测试 / Lint（#77–#80, #130–#134, #141）
- #77 ARCH-PORTABILITY-01（MockProvider A/B 共享 same Domain/GraphIntent/Session/Supervisor/Health/Acceptance）🟡（**当前编译不过——main/resolver/signal/pipeline 直接依赖 decklink/gstreamer，P0 门禁缺口**）
  > 📌 **评审留档，原文不改**；「当前编译不过」已被 2026-11-27 Linux CI 实跑推翻（run `46011711764` ⇒ `PROOF OK`）⇒ 现为 **PASS**（详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）。
- #78 ARCH-BACKEND-01（MockBackend vs GStreamerBackend 共享 CanonicalPipelinePlan）🟡
- #79 ARCH-RESOURCE-01（模拟 1/2 device、8 ports、limited GPU/encoder，证明 Resource 与 vendor 解耦）🟡（P0.5）
- #80 ARCH-AUDIO-01（Embedded SDI/AES/MADI/Mock Matrix，Video Graph 不变）🟡（P1）
- #130 边界测试：禁 BMD Provider → Domain/Graph/Session/Supervisor/Health 编译 🟡（**当前不过，P0 缺口**）
- #131 边界测试：禁 GStreamer Backend → Domain/Graph/Session/Supervisor 编译 🟡
- #132 边界测试：BMD→Mock Provider，Graph 无变化 🟡
- #133 边界测试：GStreamer→Mock Backend，Graph 无变化 🟡
- #134 Architecture Lint（`check-architecture-boundaries`：禁 Domain import BMD/GStreamer、禁 GraphIntent 含 device-number、禁 Supervisor 引 vendor error、禁 UI 暴露 vendor primary id）🔧（**需在 CI 落地，当前无此 lint**）
- #141 Acceptance Matrix（ARCH-PORTABILITY-01/BACKEND-01/RESOURCE-01/AUDIO-01/HW-PORT-01/HW-IDENT-02/MEDIA-RT-01）🟡

## 12. UI / API（#87–#99, #152, #153, #151, #94–#97）
- #87 UI 不显示 BMD device-number 作业务主身份 ✅（合理）
- #88–#93 Engineering UI 各 View（Hardware/Device/Port/Session/Resource/Signal）✅（P1 UI）
- #94 UI Explain Why（为什么不可用/谁占用/哪个 binding 失败…）✅
- #95 UI 不直接改 runtime resource（只能看，改走 Port→Rebind→Preflight→Diff→Apply）✅
- #96 UI 换卡流程（Detect→Inspect→Capabilities→Ports→Select→Binding→Preflight→Diff→Apply，禁自动替换生产）✅
- #97 UI 资源占用链（Capability/Binding/Reservation/Lease/Pipeline/Signal）✅
- #98 API Contract（Product API: DeviceId/PortId/Capability/Signal/Session；Diagnostics API 单独命名空间）✅
- #99 禁 Provider-specific API 污染 Product API（decklink_persistent_id/gst_device_number/bmd_mode 禁入 Canonical Product API）🟡（**当前 RPC 未区分 Product/Diagnostics 命名空间，P1 缺口**）
- #152 UI Provider Neutrality（BMD→AJA 前端不改 Canonical schema，只改 Provider Diagnostics）✅
- #153 UI Resource Ownership（能答"为什么端口不可用"）✅
- #151 UI Acceptance（Device/Port/Capability/Binding/Resource/Session/Signal 全部可解释）✅

## 13. 幂等 / 并发 / Stale / Crash / Upgrade / 兼容 / 版本（#100–#107）
- #100 Idempotency（discover/bind/reserve/lease/start/stop/recover 幂等）🟡
- #101 Concurrency（防双 Lease/双 Pipeline/设备竞争，Resource+Reservation+Lease 一致性链）🟡
- #102 Stale State（Runtime Binding 支持 CURRENT/STALE/CONFLICT/FAILED）🟡
- #103 Crash Recovery（persistent Session identity + reconciliation + lease/resource cleanup，跨重启 P1）🟡
- #104 Upgrade/Rollback（Provider/Backend 更新支持 version pinning/compat validation/rollback，不修改 Graph semantics）🟡
- #105 Compatibility Matrix（Provider/Backend/SDK/Driver/OS 版本矩阵）🟡
- #106 API Versioning（GraphRuntimeIntent/Manifest/RuntimeEvent/Acceptance schema 可版本化，禁破坏式修改）🟡
- #107 Schema Migration（Manifest v1→v2→v3 提供 migration 或拒绝原因）🟡

## 14. 资源审计 / Ownership / Audit / Observability / Metrics / Trace / FailureDomain / StateMachine / Drift（#108–#115）
- #108 Resource Ownership 审计（Reserved/Allocated/Released 可溯源 session/owner/timestamp/reason）🟡
- #109 Audit Event（Device added/Binding changed/Session created/Lease acquired/Pipeline started/Failover/Resource conflict/Provider changed/Backend changed）🟡
- #110 Observability（logs/metrics/events/traces/evidence 不混）✅
- #111 Metrics（devices_total/ports_total/…/backend_failures/provider_failures）🟡
- #112 Trace Correlation（request/session/pipeline/lease/resource/event 经 correlation_id 关联）🟡
- #113 Failure Domain（Provider≠Channel / Backend≠Device / Signal loss≠Device removed / Lease conflict≠Hardware failure）✅（保持 V0.2）
- #114 State Machine 防非法状态（RELEASED→RUNNING 必须拒绝）🟡
- #115 Configuration Drift（Manifest≠Hardware 必须 DRIFT，不自动改 Manifest）🟡

## 15. 替换/碰撞/耗尽/安全/密钥/网络/部署/OS（#116–#126）
- #116 Device Replacement（old→new DeviceHandle → DeviceId changed + Binding stale，不静默复用旧 Identity）🟡
- #117 Port Replacement（topology 变 → capability rediscovery + binding revalidation）🟡
- #118 Provider Identity Collision（duplicate stable identity → reject discovery，不自动随机 UUID 掩盖）🟡
- #119 Backend Resource Collision（两 Pipeline 争同 runtime resource → 一个赢、一个拒）🟡
- #120（见 #5 组）Resource Exhaustion Preflight 拒 ✅
- #121 Security Model（Provider/Backend least privilege，Vendor SDK 不得要求 Agent 全权限）🟡
- #122 Secrets（Manifest 不存 password/token/secret，只存 references）🟡
- #123 Credential Provider（未来 SecretStore/CredentialProvider，当前不实现）✅（明确暂缓）
- #124 Network Boundary（媒体/控制平面网络边界明确，不因 Provider SDK 放开 Agent 网络）🟡
- #125 Deployment Independence（Docker+runc 继续，Runtime Domain 不知 container ID/mount/cgroup）✅
- #126 OS Boundary（明确 Linux Runtime，不假装 Windows cross-platform，未来经 Runtime Adapter）✅

## 16. 当前实现 / 迁移 / BoundaryTest / Lint / Dependency / Testing / Fixture（#127–#140）
- #127 当前 BMD 实现目标结构 `providers/blackmagic/{ffi,discovery,input,output,errors}` ⚠️**标注为 Target 态**：当前代码仍是扁平 `decklink.rs`，非此结构。PRD 应注明这是 Strangler 迁移后的目标结构，避免误读为现状。
- #128 当前 GStreamer 实现仅 Reference Media Backend，非 Domain Runtime ✅（共识）
- #129（见 #1 组）Strangler ✅
- #130–#133（见 #11 组）边界测试 🟡
- #134（见 #11 组）Architecture Lint 🔧
- #135–#136（见 #1 组）依赖方向/规则 ✅
- #137 Testing Pyramid（Unit→Contract→Simulation→Provider real→E2E）✅
- #138 Real Hardware Fixture（SDI Loopback 正式定义 SDI-LOOPBACK-01，不带厂商名）✅（memory #9 已记录）
- #139 Fixture Model（yaml：source/sink/transport）✅
- #140 Fixture 禁止（first()/device-number guessing/fallback device 0）✅（与 memory #13 Canonical Ingest 边界一致）

## 17. Acceptance Matrix / 各类 Acceptance / Evidence（#141–#155）
- #141（见 #11）Acceptance Matrix 🟡
- #142 MEDIA-RT-01 Generic（INPUT→Backend Capture→RAW→first buffer→valid ts→PTS monotonic→stability，禁定义成 decklinkvideosrc first buffer）✅（Generic 定义，关键）
- #143 Provider Acceptance（BMD+GStreamer 真机证明 discovery/binding/backend/signal/RAW，但证据不代表所有 Provider）✅
- #144 Resource Acceptance（available/reserved/allocated/conflict/exhausted/released）🟡
- #145 Session Acceptance（create/start/stop/crash/recover/release/double-start/double-stop/lease conflict/resource conflict）🟡
- #146 Audio Acceptance（Embedded/Independent/No Audio/Audio Lost/Audio Reconnected）🟡
- #147 Clock Acceptance（Locked/Unlocked/Offset/Drift/Clock Lost/Clock Recovered）🟡（P1）
- #148 Timecode Acceptance（Present/Absent/Invalid/Discontinuous/Recovered）🟡（P1）
- #149 Device Replacement Acceptance（Provider A/Device A/Port A1 → B/B1，Graph/Session 不变，Binding 变）🟡
- #150 Backend Replacement Acceptance（GStreamer→Mock，Domain/Graph 不修改）🟡
- #151–#153（见 #12）UI Acceptance ✅
- #154 Evidence Acceptance（每个 Acceptance 可追溯 source SHA/env/provider/backend/fixture/command/result）✅
- #155 Evidence 不得升级为 Architecture Fact（current host topology/device-number/BMD model/GStreamer version 属 PROVIDER/HOST_SPECIFIC）✅（关键，memory 已记录 evidence 索引）

## 18. 文档（#156, #157）
- #156 文档要求（新增 docs/architecture/ 下 11 份，含 CANONICAL_MEDIA_MODEL/HARDWARE_PROVIDER_CONTRACT/MEDIA_BACKEND_CONTRACT/RUNTIME_RESOURCE_MODEL/RUNTIME_SESSION_MODEL/RUNTIME_BINDING_MODEL/AUDIO_ROUTING_CONTRACT/CLOCK_TIMECODE_CONTRACT/PORTABILITY_AND_ADAPTER_MODEL/TECHNOLOGY_PORTABILITY_MATRIX/VENDOR_NEUTRALITY_RULES）🔧**需协调**（见第四节）
- #157 文档职责（CANONICAL_MEDIA_MODEL=Domain 对象；HARDWARE_PROVIDER_CONTRACT=硬件；MEDIA_BACKEND_CONTRACT=GStreamer/FFmpeg/Native；RUNTIME_RESOURCE_MODEL=Capacity/Reservation/Lease/Allocation；RUNTIME_SESSION_MODEL=Session ownership）🔧

## 19. PRD 关系 / Phase / Priority / 不要做 / 未来 / 矩阵 / 成功标准（#158–#165）
- #158（见 #1）PRD 与 Architecture 关系 ✅
- #159（见 #1）Phase 0.5 LOCK FINAL ⚠️**与 Session Ownership 澄清潜在冲突**（见问题点 d）
- #160–#162（见 #1）✅
- #163 必须支持的未来变化（BMD→AJA→Deltacast、1→8 card、Embedded→MADI→Dante、GStreamer→FFmpeg→Native、NVIDIA→AMD→Intel→CPU、SRS→另 Gateway、PostgreSQL→另 DB、RustFS→S3、Valkey→另 Queue、Docker→Bare Metal）✅（架构允许，非现在实现）
- #164 更换矩阵（替换项→必须保持不变）✅（与 #61/#62/#63 一致，核心替换不变量）
- #165 最大成功标准（未读完末尾，但应为"换 BMD→AJA 上层零代码改动"类表述）✅

---

## 二、问题点（需澄清 / 修正 / 与裁决冲突）⚠️
- **(a) #16 Provider 禁言 impl 措辞冲突**：#16"Provider 不得包含 vendor 之外的实现逻辑"易被误解为"Provider 不能有实现"。但 vendor SDK 调用（FFI/binding）**必须**在 Provider 内。建议改为"Provider 不得包含 vendor 无关的通用业务逻辑；vendor SDK 适配实现必须在 Provider 内"。
- **(b) #21 vs #56 Session 含/不含 Pipeline/Graph 措辞矛盾**：#21"Session 不可包含 real Pipeline，只能引用" vs #56"一个 Session 可以包含 Video/Audio/Metadata Graph"。需统一：Session *逻辑持有* Graph 语义描述（Canonical），但 *struct 内不含* real Pipeline/GStreamer 对象。建议两处加互引用注解。
- **(c) #72 Feature 命名 `bmd`/`gstreamer` 与裁决不一致**：我们裁决用 `bmd-provider`/`gstreamer-backend`（不同轴显式区分）。PRD 说"bmd≠gstreamer 不同轴"语义对，但扁平 feature 名会误导。建议采纳 `bmd-provider`/`gstreamer-backend`/`ffmpeg-backend`/`aja-provider` 命名。
- **(d) #159 "不允许改变 V0.2 Ownership" 与"Phase 0.6 明确 Session Ownership"潜在冲突**：我们裁决 Session Ownership 在 Phase 0.6 要**明确边界**（之前 V0.2 的 Ownership 不够清晰）。若 PRD #159 严格禁止任何 Ownership 补充，会阻止我们澄清。建议 #159 改为"不改变 V0.2 已定义的 Ownership 语义；Phase 0.6 仅做 additive 的边界明确（不引入新业务语义）"。
- **(e) #156 文档清单与已落盘体系不一致**：我们已落盘 IMPLEMENTATION_ADDENDUM.md + 6+1 契约（IMPLEMENTATION_BOUNDARIES/HARDWARE_PROVIDER_CONTRACT/MEDIA_BACKEND_CONTRACT/RUNTIME_RESOURCE_MODEL/CANONICAL_MEDIA_MODEL/TECHNOLOGY_PORTABILITY_MATRIX/VENDOR_NEUTRALITY_RULES）。PRD #156 要求的 RUNTIME_SESSION_MODEL / RUNTIME_BINDING_MODEL / AUDIO_ROUTING_CONTRACT / CLOCK_TIMECODE_CONTRACT / PORTABILITY_AND_ADAPTER_MODEL 这 5 份**尚未建**，且 PRD 未引用我们已落的 Addendum/6+1。需协调，避免文档分裂（见第四节）。
- **(f) #42/#43 Resource Vector 未声明与 V0.2 §3.11 九维对齐**：PRD 的 Resource Vector 是新增，但必须显式声明"对齐 V0.2 §3.11 Resource Vector，不另起语义"，否则实现层可能重复定义。RUNTIME_RESOURCE_MODEL.md 已强调此点，PRD 应引用。
- **(g) #127 目标态 vs 现状未标注**：当前代码是 `decklink.rs`，非 `providers/blackmagic/`。PRD #127 应注明这是 Strangler 迁移**目标结构**，避免误读为现状。

## 三、合理且需采纳项（未落地）
### 代码层 P0/P0.5 缺口（Phase 0.6 实现目标，应纳入 0.6A–0.6J）
1. 建立 `HardwareProvider` / `MediaBackend` trait（SPI）— #2/#3/#16/#17
2. 统一 `RuntimeEvent` / `RuntimeError` 模型，Supervisor 只认 Canonical — #44/#45/#46
3. Provider Registry（静态 BMD+Mock，未来 AJA）— #71
4. Mock Provider/Backend trait，支持 #74 仿真矩阵 — #73/#74
5. 消除 11 处 `device_number` 直接依赖，改用 DeviceHandle — #8/#11/#99
6. Preflight + Explainability — #40/#41
7. ARCH-PORTABILITY-01 / ARCH-BACKEND-01 编译门禁（当前不过）— #77/#78/#130/#131
8. Architecture Lint `check-architecture-boundaries`（CI）— #134

### 文档层缺失契约（PRD #156 要求，建议补建）🔧
- RUNTIME_SESSION_MODEL.md（Session ownership）
- RUNTIME_BINDING_MODEL.md（Binding 字段/状态）
- AUDIO_ROUTING_CONTRACT.md（第 9 替换轴）
- CLOCK_TIMECODE_CONTRACT.md（P1）
- PORTABILITY_AND_ADAPTER_MODEL.md（替换矩阵/Adapter 模式）

### 文档协调（避免分裂）
- PRD #156 应引用已落盘的 IMPLEMENTATION_ADDENDUM.md 与 6+1 契约，仅将 5 份缺失契约列为待建。
- 或将 IMPLEMENTATION_ADDENDUM.md 定位为"综合载体"，6+1 为"门禁依据"，PRD #156 的 11 份与之映射（CANONICAL_MEDIA_MODEL↔CANONICAL_MEDIA_MODEL 已存在；HARDWARE_PROVIDER_CONTRACT↔已存在；…）。

## 四、与已有文档体系协调建议
| PRD #156 要求 | 当前状态 |
|---|---|
| CANONICAL_MEDIA_MODEL | ✅ 已建 |
| HARDWARE_PROVIDER_CONTRACT | ✅ 已建 |
| MEDIA_BACKEND_CONTRACT | ✅ 已建 |
| RUNTIME_RESOURCE_MODEL | ✅ 已建 |
| TECHNOLOGY_PORTABILITY_MATRIX | ✅ 已建 |
| VENDOR_NEUTRALITY_RULES | ✅ 已建 |
| RUNTIME_SESSION_MODEL | 🔧 待建 |
| RUNTIME_BINDING_MODEL | 🔧 待建 |
| AUDIO_ROUTING_CONTRACT | 🔧 待建 |
| CLOCK_TIMECODE_CONTRACT | 🔧 待建 |
| PORTABILITY_AND_ADAPTER_MODEL | 🔧 待建（可由 IMPLEMENTATION_BOUNDARIES + TECHNOLOGY_PORTABILITY_MATRIX 合并覆盖） |

## 五、建议下一步
1. **先修 PRD 问题点 (a)–(g)**：这是"有问题的"，需你确认措辞修正（尤其 c 的 feature 命名、d 的 Ownership 澄清、e 的文档协调）。
2. **补建 5 份缺失契约**（或确认由现有文档覆盖），使 PRD #156 与落盘体系一致。
3. **进入 Phase 0.6 实现**：优先消 P0 缺口（SPI / RuntimeEvent / Registry / Mock / 消除 device_number / ARCH-PORTABILITY-01 编译门禁 / Architecture Lint），这些决定"真正可替换"是否成立。
4. 评审报告已落盘，可作为 Phase 0.6 入口检查单。
