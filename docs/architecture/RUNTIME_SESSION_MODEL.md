# RUNTIME_SESSION_MODEL（Canonical Session 模型契约）

> 状态：CONTRACT = FROZEN；IMPLEMENTATION = NOT_STARTED；VERIFICATION = NOT_VERIFIED；GATE = PENDING（Phase 0.6, P0）（**状态订正 2026-11-27 · gap matrix `Session Model` 行**）：IMPLEMENTATION = `IMPLEMENTED`；VERIFICATION = **`ACCEPTED`**（`SESSION-RT-01` / `RESOURCE-RT-01` 真机 ALL PASS，报告 `docs/superpowers/reports/2026-08-29-p07-session-runtime-verify.md`）；GATE 以 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 为准。
> 来源：Portability PRD #15, #21, #56；澄清问题点 (b)(d)
> 关联：`CANONICAL_MEDIA_MODEL.md`、`RUNTIME_BINDING_MODEL.md`、`IMPLEMENTATION_ADDENDUM.md`

## 1. 定位
Session 是 Canonical 运行时组合单位，持有 Video/Audio/Metadata Graph 的**语义描述**（Canonical），但 **struct 内不含 real Pipeline / GStreamer 对象**。

## 2. 与 Graph/Pipeline 的关系（澄清 #21 vs #56）
- #56 "Session 可包含 Video/Audio/Metadata Graph" = **逻辑包含**（语义描述层）。
- #21 "Session 不可包含 real Pipeline" = **struct 内不含** GStreamer Pipeline 对象；Session 通过 handle/ref 引用由 Backend 实现的 real Pipeline。
- 两处表述互补，本契约统一：逻辑持有、物理引用。

## 3. 字段（Canonical，无 vendor 类型）
- `session_id: SessionId(Uuid)`（**独立**于硬件 `PersistentId`；见 [`CANONICAL_IDENTITY.md`](./CANONICAL_IDENTITY.md)。禁 device-number 作主身份，#8/#11）
- `graphs: [CanonicalGraph]`（Video/Audio/Metadata 各自独立，不合并业务 Graph，#55）
- `bindings: [RuntimeBindingRef]`
- `lease: LeaseRef`
- `state: RELEASED → RESERVED → RUNNING → PAUSED → RELEASING`（防非法：RELEASED→RUNNING 必须拒绝，#114）
- `ownership`：仅明确边界（V0.2 已定义语义不变；Phase 0.6 仅 additive 明确，**不引入新业务语义**，澄清 #159 d）

### 4.1 Session Ownership（Creator / Owner / Terminator）
> 用户 Final Hardening 审查（2026-08-28）第 ④ 项：明确"谁创建/销毁"最后一步，防止 Provider/Backend 自行开 Session。
```
Control Plane          → requests Session（不创建）
Runtime Session Manager → creates / destroys Session（唯一 owner）
Session                → owns Runtime lifecycle（Pipeline/Lease/Binding 生命周期）
Provider               → does NOT create Session（仅 open/close resource）
Backend                → does NOT create Session（仅 instantiate/start/stop Pipeline）
Supervisor             → does NOT create Session（仅 observe/decide）
```
- Session **owns lifecycle**：`Requested → Provisioning → Binding → Leased → Starting → Running → Stopping → Released`。
- Backend **owns implementation object**：real Pipeline 由 Backend 实例化，`PipelineHandle`（opaque Runtime reference）链接 Session 与 real Pipeline。
- 规则：**Session owns lifecycle / Backend owns object / Handle links the two**——不出现"Session owns Pipeline"与"Backend owns Pipeline"互相冲突。

## 4. 替换不变量
- BMD→AJA / GStreamer→FFmpeg / Embedded→MADI：Session 与 GraphIntent 不变（#61/#62/#63）。
- Session DEGRADED 当 Binding STALE（硬件移除），禁自动找新卡顶替（#58）。

## 5. 验收
- `ARCH-PORTABILITY-01`（MockProvider A/B 共享 same Session）
- #145 Session Acceptance（create/start/stop/crash/recover/release/double-start/double-stop/lease conflict/resource conflict）
