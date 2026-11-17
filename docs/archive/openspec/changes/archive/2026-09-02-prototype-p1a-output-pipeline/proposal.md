# Proposal — prototype-p1a-output-pipeline

## Why

VBMF 已完成 0.6→0.7D→V0.3-1 的架构与 Runtime 地基（master=16a8136），但全部媒体管线是**纯分析型**：`controller.rs` 的双 branch 恒终止于 `appsink`（原始帧进 Rust 做信号分析），`GraphRuntimeIntent.sink.kind`（如 `"rtmp"`）只是语义词，后端完全忽略；`PipelinePlan` 连 sink 字段都没有。产品第一次"可见"的链路——真 SDI 输入变成编码后的 HLS/RTMP 输出——尚不存在（用户 2026-09-02 战略裁定：Prototype-1 Vertical Slice 为近期最高优先级，Federation 平行不阻塞）。

本 change 是 Prototype-1 路线的第一段（P1a）：把**「输出意图 → 输出物化」第一次真正打通**，让 `sink.kind` 从描述词变成被消费的契约。

## What Changes

- **SinkPlan 物化**（pipeline.rs）：`PipelinePlan` 增加输出段；`materialize()` 消费 `d.pipeline.sink.kind`（`appsink`=纯分析（现行为，默认）/ `hls` / `rtmp`），结合 `PrototypeOutputConfig` 物化为具体输出计划（编码参数/mux/sink target）。输出 launch 段构造与 `src_props` 同层（domain 侧物化，controller 保持纯执行——用户边界修正：不做硬编码 demo 管线）。
- **tee 双分支管线**（controller.rs）：`src ! raw ! tee` 一路保 `appsink` 分析分支（**零退化**：MEDIA-RT-01/E1-E8 全部照旧），另一路 `queue ! videoconvert ! x264enc tune=zerolatency ! h264parse`（视频）+ `audioconvert ! avenc_aac ! aacparse`（音频）→ `mpegtsmux ! hlssink2`（HLS 落盘）和/或 `flvmux ! rtmpsink`（RTMP 推流）。
- **PrototypeOutputConfig**（config.rs）：demo 层输出配置（env 驱动：码率/音频码率/HLS 目录/RTMP URL/输出开关）。**明确不进 Runtime Contract**——正式配置契约化留产品配置模型阶段（用户裁定）。
- **Runtime 输出可见性**：`SessionRuntimeState` 加法输出摘要（经 `CanonicalRuntimeState.sessions[]` 投影；顶层 8 键契约与 D14 测试锁定不动）。
- **main.rs 诊断接线**：既有主会话已声明 `sink.kind:"rtmp"`；输出目标经 env 注入（无输出 env 时行为与今天完全一致——向后兼容）。
- **真机 Gate P1a-01..06**（盒上，脚本不入库）：真 SDI 输入 → 分析链不退化 → 真实 HLS 分片（.m3u8+.ts）→ 真实 RTMP（ffmpeg listen 接收端持续收到音视频）→ 持续运行（无 EOS/ERROR、PTS 单调、分片持续、无 backpressure 死锁）→ 既有硬件回归零退化。

### Capabilities

（skip_specs:true——契约与验收锚定 Design Doc + 既有架构文档，不建 delta spec；与前例 v03-d14-runtime-snapshot-consistency 一致。）

## Non-Goals（明确不做）

- **P1b 最小 Web 页**（GET / 静态页 + /hls/* 文件服务 + 面板）——独立下一段
- Program Master / Switch / 多输入 / 混合（Alpha 阶段）
- 输出参数正式配置契约化（bitrate/GOP/profile/segment duration 进 Runtime Contract）
- transport.rs 五端点任何改动（A 方案静态文件面属 P1b）
- Federation / Control Plane（继续 BLOCKED）
- 硬件编码（盒上无 nvh264/vah264；x264 软编 1080p25 够用）

## 关键未知项（build 前 probe 收敛）

1. `rtmpsink` vs `rtmp2sink` 实际行为差异（盒上真机 probe 决定，用户已授权）
2. `hlssink2` 属性面（location/target-duration/max-files 支持实况）
3. x264 软编 1080p25 在盒上 CPU 余量（持续运行 gate 验证）
4. `SessionRuntimeState` 现 `Copy` derive 的影响面（加 Vec 字段需去 Copy；编译器全量核查）

## 验收场景（Gate P1a-01..06，用户 2026-09-02 逐条定义）

1. **P1a-01** 真实 BMD SDI 输入
2. **P1a-02** 原有分析链不退化（first-frame / PTS monotonic / signal state / runtime health）
3. **P1a-03** 真实 SDI→H.264+AAC→MPEG-TS/HLS→实际 .m3u8 + .ts 分片
4. **P1a-04** 真实 RTMP：VBMF→FLV→RTMP→ffmpeg listen receiver 持续收到音视频（非仅 pipeline PLAYING）
5. **P1a-05** 持续运行：无 EOS/ERROR、video/audio PTS 单调、分片持续产生、RTMP 持续收流、appsink 不被编码分支阻塞、无明显 backpressure
6. **P1a-06** 既有硬件回归（E1-E8 / MEDIA-RT-01 / 14 步矩阵）零退化

完成定义：**"真实 SDI 已经变成（编码后）可消费的媒体"**，而非"代码编译成功"。
