# Design: Phase 0.7C-3 — p07c-command-contract

## Context

Query（0.7C-2，Pure Read）已立；Command 是"改变状态的正式入口"。终审设计原则：`Query = What is true now? Command = What do I request to change?`——Command 描述请求≠执行计划；不可执行性为第一红线；不做万能 Executor。

## Goals / Non-Goals

**Goals:** Command vocabulary/envelope/target/outcome/validation（纯函数）+ 三命令薄映射 boundary + 三重不可执行性守护 + COMMAND-CONTRACT-RT-01 三层。
**Non-Goals:** 见 proposal 不做清单。

## Decisions

- **D1 词表封闭**：`CommandKind` 三变体；serde tag `kind` snake_case；词表快照测试（同 AudioRole/TimecodePresence 先例）。新命令 = 架构评审事件（改测试显式更新）。
- **D2 envelope 形状**：`command_id: CommandId(Uuid)`（幂等键占位——携带不实现，D9 幂等语义属下一 change）；`requested_by: String`（opaque 请求方标签，非身份模型）；`issued_at_ms: u64`。**零执行字段**。
- **D3 target 两形**：`Session{intent}`（Start 用——canonical GraphRuntimeIntent，复用 0.6 冻结 intent 类型而非新造参数模型——终审"参数模型"以 canonical intent 为准，不发明 CommandArgs 大杂烩）/ `SessionById{session_id}`（Stop/Release）。target 携带 port_id/device_id canonical 键，绝不带 runtime 地址。
- **D4 CommandStatus 四态**：Accepted（验证过，未执行）/Rejected（验证拒绝）/Executed（映射完成）/Failed（执行期错误）——命令生命周期语义，非 Runtime 状态投影。
- **D5 validation 纯函数**：`validate(&CommandEnvelope, &RuntimeQuery?) -> ...`——**不接 Query**（保持 command 模块不依赖 runtime_query——分离白盒）；在场性校验交给 dispatch 执行期（Rejected by runtime fact）。validation 只做形状校验：kind/target 形状匹配（Start⇒Session、Stop/Release⇒SessionById）、intent 非空、session_id 非 nil、requested_by 非空。返回 `CommandRejection { code, detail }`。
- **D6 薄映射 boundary**：`dispatch(mgr: &SessionManager, env) -> CommandOutcome`——match kind 三臂各调 SessionManager 公共 API；无循环/插件/注册机制。执行前 validate（Rejected 不触 runtime）；执行错误映射 Failed。
- **D7 三重不可执行性守护**：①类型层（字段仅 canonical 类型）；②serde 反向断言（banned: gst/pipeline/device_number/backend/handle/ffmpeg/alsa/kafka）；③公开面 allowlist `[validate, dispatch, CommandId::new...]` + denylist 动词（execute_pipeline/configure_backend/run_backend/build_gst 等）。
- **D8 Query/Command 分离白盒**：两模块互不 import（编译结构保证 + 测试断言源文件无相互引用——以 serde JSON 不含对方类型字样为代理断言 + 源码 grep 级单测不可行，取模块级 allowlist 已覆盖）。

## Risks / Trade-offs

- `dispatch(&SessionManager, ...)` 直接引用 SessionManager：非"包装换名"的关键在——envelope/validation 是独立契约层 + dispatch 是 match 三臂薄映射（无业务逻辑）；终审允许"Command → Runtime lifecycle boundary"。
- Start = create+start 两步：失败中间态由 SessionManager 既有回滚保证（0.7A hardening）；command 层只报告 Failed。
- 三命令不够用（未来 Pause/Route）：词表封闭是刻意约束——扩展走新 change + 架构评审。

## 实施顺序

command.rs 类型+validation → dispatch → 白盒/serde 测试 → Simulation 全生命周期 → main.rs SESSION_LIFECYCLE command 段 → 盒上矩阵+真机 → Phase Map。
