# Tasks — prototype-p1a-output-pipeline

> 四栏纪律：每项标注 `Contract` / `Implementation` / `Verification` / `Gate` 状态。

## 1. 输出物化（domain 层）

- [x] 1.1 `pipeline.rs`：`SinkPlan`/输出段类型 + `materialize()` 消费 `sink.kind`（appsink/hls/rtmp 词表；未知 kind 拒绝） + `PrototypeOutputConfig` 注入点（无输出 env ⇒ 无输出分支, 向后兼容） `Contract: design D1/D2/D4` | `Implementation: 待` | `Verification: Unit——kind→物化/未知拒绝/无 env 兼容三测试` | `Gate: 无`
- [x] 1.2 `config.rs`：`PrototypeOutputConfig`（env `VBMF_OUTPUT_*`, 默认 1080p25/x264 zerolatency 6Mbps/AAC 128k）——显式不进 Runtime Contract `Contract: design D4 / 用户裁定` | `Implementation: 待` | `Verification: Unit——默认值/env 解析` | `Gate: 无`

## 2. 管线执行（adapter 层, 纯执行）

- [x] 2.1 `controller.rs`：build_pipeline 串接 `src_props + tee + 分析分支(逐字符不动) + outputs 段`（输出段由 plan 提供, controller 不硬编码 element 名） `Contract: design D1/D3` | `Implementation: 待` | `Verification: Simulation——mock 计划驱动; 真机属 Gate` | `Gate: 无`
- [x] 2.2 盒上 build 前 probe：`rtmpsink` vs `rtmp2sink` 行为 + `hlssink2` 属性面（location/target-duration/max-files）实证并冻结选择 `Contract: design D6（用户授权 probe 决定）` | `Implementation: 待` | `Verification: probe 输出记入 Design Doc` | `Gate: 无`

## 3. Runtime 可见性 + 接线

- [x] 3.1 `runtime_state.rs`：`SessionRuntimeState` 加法输出摘要; 顶层 8 键契约与 D14 测试不动 `Contract: design D5` | `Implementation: 待` | `Verification: Unit——sessions[] 投影含输出摘要; 8 键测试原样绿` | `Gate: 无`
- [x] 3.2 `main.rs`：诊断主会话输出目标 env 注入（无 env 行为不变）; E5 路径保持 appsink `Contract: proposal / probe 实证` | `Implementation: 待` | `Verification: 既有诊断输出 diff 仅增量` | `Gate: 无`

## 4. 三层测试

- [x] 4.1 Unit/Simulation 全绿（基线 mock 221 零回退 + 新增） `Contract: D14 后基线` | `Implementation: 待` | `Verification: cargo test --features mock (盒)` | `Gate: 无`
- [x] 4.2 Hardware Gate P1a-01..06（盒上真机; 脚本不入库; RTMP 接收端=ffmpeg -listen） `Contract: proposal 验收场景` | `Implementation: 待` | `Verification: 盒上实跑全 PASS, 输出入 verify 报告` | `Gate: P1a-01..06`
- [x] 4.3 既有硬件回归零退化（E1-E8 / MEDIA-RT-01 / 14 步矩阵） `Contract: 验收口径` | `Implementation: 待` | `Verification: 盒上矩阵全 exit 0` | `Gate: BOX`

## 5. 交付

- [x] 5.1 CI 七 required checks 实查全绿 → verify 报告 → archive → PR → merge → 删分支 `Contract: 项目交付纪律` | `Implementation: 待` | `Verification: gh pr checks 实查; PR merged` | `Gate: CI/RELEASE`
