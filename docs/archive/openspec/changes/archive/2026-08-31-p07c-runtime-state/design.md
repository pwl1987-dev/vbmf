# Design: Phase 0.7C Foundation — p07c-runtime-state

## Context

Integration Audit 事实：Canonical/Runtime 不相交子图；SessionManager 已持有 devices/bindings/registry 字段（session.rs:233-245）可零构造改动聚合。D2/D4/D5 的最小侵入路径已探底：D2 落 preflight Stage3（不动 derive_claims 签名）；D4 镜像 materialize 冻结语义（pipeline.rs:485-523）；D5 抽共享 helper（现生产者 High-by-construction，行为保持）。

## Goals / Non-Goals

**Goals:** CanonicalRuntimeState 聚合（组合非展开）+ SessionManager::runtime_state 生产路径 + D2/D4/D5 关闭 + RUNTIME-STATE-RT-01 三层。
**Non-Goals:** D6/API/Command Contract/Event Projection/Idempotency/Audio Execution/Clock Policy/Timecode Parser/D11；不重构 derive_claims 签名；不改 SessionManager 构造函数。

## Decisions

- **D1 组合红线（终审加严）**：`media_semantics: Vec<PortMediaSemantics{port_id, descriptor: CanonicalMediaDescriptor}>` ——descriptor 整值组合；Runtime 结构（Device/Port/Resource/Session RuntimeState）只存运行事实。**测试锁定**：serde JSON 断言 descriptor 字段（width/role/presence 等）只出现在 `media_semantics[].descriptor` 命名空间内，绝不平铺到 state 顶层。
- **D2 三态 Resolution（preflight Stage3）**：per intent-device：`resources.iter().any(r.device_id==u && capability ends_with("-input"))`——Missing ⇒ FAIL("设备无派生 input 资源 (declared capability missing)")；有资源 ⇒ 现有 claim 逐项 preflight（不可满足 FAIL）；claims 空且资源存在（诊断路径）保持 WARN。registry=None 的 legacy WARN 分支保留但仅当资源表也空。
- **D4 端口级（preflight Stage2，镜像 materialize）**：`port_id:Some(pid)` → parse 失败或 `ports.find(identity.port_id==Some(u))` 无匹配 ⇒ FAIL；匹配但 direction ∉ {Input,Bidirectional} ⇒ FAIL（Capture intent 需输入端口）；`port_id:None` → 设备须有 ≥1 Input/Bidirectional 端口（升级 any-port）；registry=None ⇒ WARN。
- **D5 is_production_grade（resolver.rs）**：`pub fn is_production_grade(&self) -> bool { self.confidence == Confidence::High && matches!(self.match_kind, PersistentIdExact|SerialExact|DeviceHandleExact|ManifestVerified) }`；preflight Stage5 正分支改 `contains_key && is_production_grade()`（未达标条目列出）；session.rs:457-470 Binding verify 同步。
- **D6 聚合器**：`assemble()` 纯函数（无 IO/锁）；descriptor 装配复用 `RawInputDescription::from_port`+`normalize_input`（0.7B 资产）；binding 摘要 `BindingStatus{match_kind, confidence}` 仅 production_grade 才入 DeviceRuntimeState。
- **D7 生产路径**：`SessionManager::runtime_state()`（snapshot：devices.clone + bindings.clone + registry.clone + resources.with_inner(clone) + self.list() + leases.list_active 计数）——**不经 loopback 证据路径**；`VBMF_SESSION_LIFECYCLE` 在 create 前后各输出一次 state JSON（真机证据：资源 Reserved/Released 在 state 中的投影变化）。

## Risks / Trade-offs

- preflight test 1 更新（clean case 需派生资源）——预期内；session.rs 测试 fixture 天然满足新语义（探底确认）零破坏。
- D4 对 port_id=None 收紧为 Input-only：现有 fixture 全为 Input 端口；真机 manifest 端口也是 Input——零影响，且修复了"Output 端口混过 Capture"的漏洞。
- runtime_state() 每次全量 clone：规模为端口/会话数级（个位-十位数），无性能面；tick 高频调用不引入（仅按需/证据）。

## 实施顺序

runtime_state.rs 类型+assemble → D5 helper（resolver）→ preflight D2/D4/D5 + 测试更新 → session.rs runtime_state()+binding verify 换 helper → main.rs 挂点 → 盒上矩阵 + 真机 → 债务表/Phase Map 更新。
