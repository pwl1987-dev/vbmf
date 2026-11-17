# Design — a2-3-audio-master（高层框架）

## D1 AudioMaster 形态（与 VideoMaster 对称 + Audio 独有字段）

```
AudioMasterStage（封闭词表, §3.7 Audio Graph 节点对应, serde SCREAMING_SNAKE_CASE）
  SourceRaw → Mixed → LoudnessNormalized → DelayCompensated → MasterJoined
AudioMaster {
  stage: AudioMasterStage,
  data_plane: AudioDataPlane::RawAudio,  // 唯一变体（Errata-3 纪律）
  mix_layout: MixLayout,                   // Audio 独有（混合声道布局）
  delay_ms: Option<NonZeroU16>,             // Audio 独有（None=未声明）
  loudness_lufs: Option<f32>,              // Audio 独有（None=未归一化）
}
AudioDataPlane = RawAudio（仅 — 压缩域禁止类型层）
MixLayout: Stereo / FiveOne / StereoAndSub（封闭词表; 未知 fail-closed）
DEFAULT_DELAY_MS = 80u16  // V0.2 §3.7 锁定常量
```

## D2 立规遵循（A2-2 立规）

- `#[serde(default)]` 禁用（新生儿类型无旧实例）
- `advance()` / `advance_to(target)`: 白名单无通配臂; 终态拒绝; `{from,to}` 载荷 wire 词表名
- 信任边界文档化（pub + serde = 声明性对象有意设计; 消费者须重审）
- 产物随代码 commit 同步提交

## D3 测试

词表快照 / serde 名锁 / 5×5 advance_to 全组合矩阵 / RawAudio 类型层锁 /
mix_layout 受纳+拒绝（含大小写敏感）/ DEFAULT_DELAY_MS 常量锁 == 80 /
delay/loudness 携带不变 / 结构级 serde 往返 + 缺字段 fail-closed。
全回归: mock 265 基线零退化 + 矩阵 + clippy 四组合。

## D4 冻结点

- 阶段词表 LOCK（§3.7 节点逐一对应, serde 名 = wire 契约锚）
- data_plane RAW 唯一（Errata-3 纪律同 Video）
- delay_ms 默认值仅 const 锁（**不**通过 serde default 引入——A2-2 立规）
- 声明性 only: 无 mix/loudness/delay 执行（A2-7+）/无 Join（A2-5）
