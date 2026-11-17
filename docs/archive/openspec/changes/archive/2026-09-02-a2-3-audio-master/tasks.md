# Tasks — a2-3-audio-master

> 四栏纪律。TDD; cargo 经盒; 基线 mock 265。立规（A2-2 立）: serde(default) 新生儿禁用 / 产物随代码同步 commit / advance_to 显式目标矩阵 / 信任边界文档化。

- [x] 1. RED+GREEN: `audio_master.rs`（阶段词表快照/serde 名锁/advance_to 5×5 矩阵/RawAudio 类型层锁/mix_layout 词表+拒绝/DEFAULT_DELAY_MS 常量锁=80/advance 携带 delay+loudness/mix_layout 不变/结构级 serde+缺字段 fail-closed/is_program_scope_master 终态判定）+ mod.rs 声明 `Contract: V0.2 §3.7+§1.20+A2-2 立规` | `Implementation: 已` | `Verification: Unit + mock 265 零回退` | `Gate: 无`
- [x] 2. 全回归（矩阵/clippy 四组合）+ review + verify + 双 guard + archive + PR + CI + merge + memory `Contract: 交付纪律` | `Implementation: 已` | `Verification: PR merged` | `Gate: CI/RELEASE`
