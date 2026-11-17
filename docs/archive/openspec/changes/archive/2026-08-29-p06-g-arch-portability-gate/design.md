---
title: "Phase 0.6 C4 (0.6G): ARCH-PORTABILITY-01 解耦门禁 — 技术设计"
change: p06-g-arch-portability-gate
change_id: p06-g-arch-portability-gate
comet_change: p06-g-arch-portability-gate
role: technical-design
spec: openspec
canonical_spec: openspec
links:
  - "[p06-g-arch-portability-gate](p06-g-arch-portability-gate)"
---

# Design: Phase 0.6 C4 — ARCH-PORTABILITY-01

## 门禁定义（来自 IMPLEMENTATION_ADDENDUM）

- Test A：删 BMD Provider 后 Domain/Graph/Session/Supervisor/Health 仍能编译 —— **当前不过，是 P0 缺口**；
- Test B：Mock Provider/Backend 与 GStreamer 实现共享同一 Graph/Session/Supervisor/Health；
- Test C：换 Mock B 实现不改变 Domain/Graph/控制面 UI。

## 实现方式

- 在 `services/media-agent/tests/` 或 `ci/` 增加架构门禁断言：`cargo build --no-default-features --features simulation` 必须成功编译上述模块；
- 通过 `cfg(feature)` + trait 边界确保 Domain 层不 `use bmd` / `gstreamer` crate 顶层；
- 复用 C3 的 `simulation` Mock 适配器作为「无真实硬件」编译基线。

## 与 C1 的关系

- C1 冻 SPI；C4 验证 SPI 是否真正解耦。若 C4 仍 FAIL，说明 C1 有残留耦合（如某 `use gstreamer::…` 漏改），本 change 负责最小化补完（不扩大范围）。

## 关键约束

- 门禁只验证「可编译 / 不耦合」，不改变运行时行为；
- canonical 管线语义、V0.2 核心定义不变；
- 防自动 Fallback 语义仍由 C2 Preflight 保证。

## 不做（本 change 边界）

- 不做 ARCH-BACKEND-01 / RESOURCE-01（0.6H/I）；
- 不做 HW-PORT-01 真机回路。
