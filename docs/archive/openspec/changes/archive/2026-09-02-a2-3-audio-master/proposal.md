# Proposal — a2-3-audio-master

## Why

裁定链 A2-3（A2-1 SwitchPolicy @78a8319✅ / A2-2 Video Master @b68830c✅）。V0.2 §3.7
Audio Graph 是**独立 graph**（Source → Mixer → Loudness → **Delay(+80ms 补偿)**
→ Audio Master Join → Program-scope Master (RAW_AUDIO)），与 §1.20 锁定"故障域隔离 +
联合判定"——Audio Delay = Audio Graph 内部的事, 不是 Video Graph 的事。
A2-2 已立规（serde(default) 新生儿禁用 / 产物随代码同步 commit / advance_to 显式
目标矩阵 / 信任边界文档化），本 change 严格遵守。

## What Changes

- **`src/program/audio_master.rs`**（Program Domain 第三块, 与 video_master 同构）:
  - `AudioMasterStage` 封闭词表（`SOURCE_RAW → MIXED → LOUDNESS_NORMALIZED →
    DELAY_COMPENSATED → MASTER_JOINED`——§3.7 Audio Graph 节点逐一对应; serde 名锁）
  - `AudioMaster` { stage, data_plane, mix_layout, delay_ms, loudness_lufs }
    ——**Audio 路径特化字段（Video 无）**: `mix_layout`（mix 声道布局枚举; 与
    Normalize 同律, fail-closed 拒绝未声明布局）、`delay_ms`（延迟补偿; **A2-3
    不写死 +80**——V0.2 +80ms 是默认值; `Option<NonZeroU16>` 仅声明层"是否声明了 +
    多少"; 类型层带 `DEFAULT_DELAY_MS = 80` 常量）、`loudness_lufs`（响度归一化
    事实位; `Option<f32>` 默认 None=未做归一化——控制面设值）
  - `advance()` / `advance_to(target)` 白名单（无通配臂; A2-2 立规——所有 reject 由
    `ProgramDomainError::InvalidStageTransition` 携带真实 wire 词表名）
  - `data_plane` 仅 `AudioDataPlane::RawAudio`（Program-scope Master 一律 RAW——
    与 Video 同 Errata-3 纪律; 压缩域 Master 类型层不可表达）
  - `is_program_scope_master()` 终态判定（Audio 路视角）
- **Audio 独有测试**:
  - 5×5 advance_to 全组合矩阵（同 Video）
  - delay_ms/loudness/mix_layout 携带不变
  - DEFAULT_DELAY_MS 常量锁（== 80; 锁定 V0.2 §3.7 默认值）
  - mix_layout 词表快照（同 SwitchPolicy 纪律）+ 未知 fail-closed
- **serde(default) 禁用**（A2-2 立规: 新生儿类型无旧实例, 缺字段 fail-closed）
- 声明性 only: 零混合器/响度/延迟执行（属 Audio Engine, A2-7+）; 零行为变化

## Non-Goals

- 混合/响度/延迟执行; Loudness 算法; MixEngine; AV Sync 测量（Master Join 属性, A2-5）;
  Audio Master Join 实际逻辑; Variant Composition/Encode/Output Variant（delivery 侧）

## 验收场景

1. 阶段词表快照恰五词, serde 名锁定（§3.7 Audio Graph 节点对应）
2. advance_to 5×5 全组合矩阵（同 A2-2 纪律; `from/to` 载荷 wire 词表名）
3. data_plane 恒 RawAudio（Errata-3 纪律同 Video）
4. mix_layout 词表: STEREO/FIVE_ONE/STEREO_AND_SUB（声明面; 实际 mix 行为属 A2-7+;
   review Important#1 对账——FIVE_ONE 按 codebase SCREAMING_SNAKE_CASE 惯例, 非 5_1）
5. delay_ms `Option<NonZeroU16>`（None=未声明; Some=具体值; 默认 80 仅 const 锁）
6. loudness_lufs `Option<f32>`（None=未归一化; Some=目标 LUFS 值——控制面设值）
7. 全回归零退化（mock 265 基线 + Audio-specific 测试）
