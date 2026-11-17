# Change: Phase 0.6 C5 — 后端/资源/真机验收门禁 (0.6H+I)

## Why

- 裁决顺序在过 ARCH-PORTABILITY-01（0.6G）后，需再过第二批门禁，才允许「降级 BMD/GStreamer 为 Reference Adapter」并进入 Normalize(0.7)。
- 缺这批门禁，无法证明：Mock 与真实后端共享同一 CanonicalPipelinePlan（ARCH-BACKEND-01）、Resource 可用性闸门（RESOURCE-01）、端口级绑定闭环（HW-PORT-01）、身份解析正确（HW-IDENT-02）、实时性契约（MEDIA-RT-01）。

## What is Changing

- 新增门禁组（CI required gate，与 0.6G 并列）：
  - ARCH-BACKEND-01：Mock vs GStreamer 实现共享同一 `CanonicalPipelinePlan`，互可替换；
  - RESOURCE-01：materialize 前 Resource 可用性闸门（复用 C2 Resource + C4 门禁框架）；
  - HW-PORT-01：端口级绑定闭环验收（loopback 验证，复用 `hw_port_01` / `signal` 亮度黑场检测）；
  - HW-IDENT-02：身份解析正确性（PersistentId > DeviceHandle > TopologicalId 优先级，多重 HIGH → Ambiguous）；
  - MEDIA-RT-01：实时性契约（`pts_monotonic` 只置 false；`PipelineHealth` Default=true；`MEDIA_AGENT_SELFTEST=1` 跑通即 A+B+C）。
- 门禁以「真机 + Mock 双轨」形式落地，复用 C3 的 Mock 适配器与 C4 的架构断言框架。

## Impact

- 编译：`default` / `simulation` / `bmd-provider,gstreamer-backend` 三套均须保持可编译且单测通过；
- 受影响：验收模式（`diagnostic` / `VBMF_RESOLVER=1` / `MEDIA_AGENT_SELFTEST=1`）的断言须对齐上述门禁；
- 后续：门禁全绿后，BMD/GStreamer 正式降级为 Reference Adapter，方可进 Normalize(0.7)。
