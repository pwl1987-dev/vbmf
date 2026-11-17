# Design — prototype-p1a-output-pipeline（高层框架）

> 深度技术设计在 design 阶段 Design Doc（`docs/superpowers/specs/`）细化；本文为高层决策。

## D1 分层：输出物化在 domain，controller 纯执行（用户边界修正）

```
GraphRuntimeIntent.sink.kind ──┐
PrototypeOutputConfig (env) ───┤→ pipeline.rs materialize() → PipelinePlan{source, outputs}
                               │      (输出 launch 段构造: 与 src_props 同层)
                               ▼
controller.rs build_pipeline(): 串接 src_props + tee + 分析分支(appsink 原样) + outputs 段
```

- **不做**：把 `tee ! x264enc ! ...` 硬编码进 `build_pipeline()`（demo 捷径，用户明确否决）。
- `PipelinePlan` 是唯一计划载体：`GstInstance` 已持久存 plan，`recover()` 从存档重建 → **输出分支自动随 Supervisor 恢复重建**，不需要突破 Supervisor 边界（probe 实证 controller.rs `instances: HashMap<Handle, GstInstance{plan,..}>`）。

## D2 sink.kind 词表（本 change 起成为被消费的契约词）

| kind | 物化结果 | 语义 |
|------|----------|------|
| `appsink` | 无输出分支（现行为） | 纯分析（默认；E5 过期测试路径保持） |
| `hls` | tee 编码分支 → mpegtsmux → hlssink2 落盘 | HLS 产出 |
| `rtmp` | tee 编码分支 → flvmux → rtmpsink/rtmp2sink 推流 | RTMP 推流 |

未知 kind：生产 fail-closed（沿用 materialize 既有拒绝风格），Diagnostic 拒绝（不静默回退 appsink——词表第一次有牙齿）。

## D3 tee 双分支——分析零退化红线

```
decklinkvideosrc ! video/x-raw ! tee name=v
  v. ! queue ! appsink name=videosink async=false        ← 原样（分析）
  v. ! queue ! videoconvert ! x264enc tune=zerolatency ! h264parse ! ┐
decklinkaudiosrc ! audio/x-raw ! tee name=a                             │ mux
  a. ! queue ! appsink name=audiosink async=false        ← 原样（分析）  │
  a. ! queue ! audioconvert ! avenc_aac ! aacparse ! ───────────────────┘
```

- 分析分支 element 串**逐字符不动**（`async=false` 等细节承载真机实证语义）。
- 编码分支各配独立 `queue`（解耦背压——P1a-05 的 appsink 不阻塞断言由此结构性保证）。

## D4 PrototypeOutputConfig——demo 层，不进 Runtime Contract

env 驱动（`VBMF_OUTPUT_*`）：enable / kind 细化 / video bitrate(默认 6Mbps) / audio bitrate(128k) / HLS 目录 / RTMP URL。无输出 env ⇒ 物化为无输出分支（行为与今天逐字节一致——向后兼容承诺）。参数正式契约化显式留后续（proposal Non-Goals）。

## D5 Runtime 可见性——加法且不碰 8 键契约

`SessionRuntimeState`（sessions[] 内投影）加法输出摘要（如 `outputs: Vec<String>` 物化 kind 列表）；`CanonicalRuntimeState` **顶层不加键**（D14 八键测试锁定不动）。Copy derive 影响面由编译器全量核查后处理。

## D6 默认参数（用户裁定，probe 可微调实现细节不语义）

1080p25 / x264 `tune=zerolatency` / ~6Mbps / AAC 128k / `hlssink2`；RTMP 用 `rtmpsink` 或 `rtmp2sink` 由盒上真机 probe 决定（用户已授权 build 前 probe）。

## D7 验证与 Gate

- Unit/Simulation：物化单测（kind→输出段/未知 kind 拒绝/无 env 向后兼容）+ mock 全绿不回退
- Hardware（盒上，脚本不入库）：Gate P1a-01..06（proposal 逐条）；RTMP 接收端=盒内 ffmpeg `-listen 1`（自包含）
- 回归：14 步矩阵 + E1-E8 + MEDIA-RT-01 零退化
