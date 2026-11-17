# Change: Phase 0.6 C4 — ARCH-PORTABILITY-01 解耦门禁 (0.6G)

## Why

- 裁决顺序要求「先冻契约 → 过两道门禁 → 降级 BMD/GStreamer 为 Reference Adapter」。ARCH-PORTABILITY-01 是第一道门禁：验证删去 BMD Provider 后 Domain/Graph/Session/Supervisor/Health 仍能编译。
- 当前 Test A 编译不过（P0 缺口），证明 `media-agent` 仍耦合 vendor crate；不先过此门禁，0.6B+C 的 SPI 降级无法被验证。
- 这道门禁是 0.6H/I 多门禁的前提，也对应「无消费方不建抽象」之外的硬隔离验证。

## What is Changing

- 新增架构门禁测试 `ARCH-PORTABILITY-01`：在 `--no-default-features --features simulation`（或 mock-only）下断言 `domain` / `graph` / `session` / `supervisor` / `health` 模块可独立编译，不引用 `bmd` / `gstreamer` 适配器。
- 若 C1 的 SPI 抽取已落地，此测试应 PASS；若仍耦合，则本 change 负责补完解耦（必要时回补 C1 遗漏的调用点）。
- 门禁接入 CI（与 clippy `-D warnings` 两套 feature 同列为 required gate）。

## Impact

- 编译：`default` / `simulation` / `bmd-provider,gstreamer-backend` 三套均须保持可编译；
- 受影响：若发现残留耦合点，需在本 change 内补 `use` / 依赖调整（与 C1 同范围，不引入新能力）；
- 后续铺垫：0.6H/I 的 ARCH-BACKEND-01 / RESOURCE-01 等门禁。
