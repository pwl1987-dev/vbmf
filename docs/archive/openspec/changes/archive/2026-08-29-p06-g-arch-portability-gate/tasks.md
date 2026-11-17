# Tasks: Phase 0.6 C4 (0.6G) — ARCH-PORTABILITY-01 解耦门禁

## 1. 门禁测试 (Test A) — 编译门禁

- [x] 新增 `cargo build --no-default-features --features simulation` 架构断言：Domain/Graph/Session/Supervisor/Health 可独立编译
- [x] 新增 `cargo build --no-default-features --features mock` 架构断言：纯 Rust Mock Provider/Backend 下上层可独立编译（解锁 Test B/C 的 Mock 侧）
- [x] 确认不引用 `bmd` / `gstreamer` crate 顶层（词法门禁 `scripts/check_arch_portability.py` 覆盖）

## 2. 补完解耦（结果：无需补完）

- [x] C6 (BMD 诊断探针收敛) + C7 (GStreamer 解耦) 已完成; 词法门禁当前 **0 违规** PASS,
      编译门禁 (`simulation` / `mock`) 当前均 **OK (0 error)** PASS → 无残留耦合点需补完
- [x] 三套 feature 均可编译: default / simulation / `bmd-provider,gstreamer-backend` (C6/C7 盒上验证)

## 3. 门禁接入 CI

- [x] `scripts/check_arch_portability.py` (ARCH-PORTABILITY-01 词法 lint) 接入 `media-agent.yml` `test` job
      —— 禁止 domain/contracts/runtime 层出现 `decklink`/`gstreamer`/`ffmpeg`/`srs`/`aja` 的 crate 路径引用
      (跳过注释/字符串/cfg 门控区; 经 `crate::adapters::{gstreamer,blackmagic}` 收敛门面访问允许)
- [x] 两个编译门禁 (`--no-default-features --features simulation` / `--features mock`) 接入 `test` job 为 required gate
- [x] Test B / Test C: Mock 侧已由 `mock` feature 的 `cargo build` + `cargo test --features mock` (87 passed) 覆盖;
      Mock vs 真实共享 Graph/Session/Supervisor/Health 已通过 `HARDWARE_PROVIDER_CONTRACT` / `MEDIA_BACKEND_CONTRACT` 定型

## 4. 验证

- [x] `cargo clippy --all-targets -- -D warnings` (default / simulation / mock + gstreamer-backend + bmd,gstreamer
      + bmd-provider,gstreamer-backend + bmd-provider,gstreamer-backend,mock + hardware-test) 全 0 error
- [x] `cargo test` default (84) + simulation (84) + mock (87) passed
- [x] ARCH-PORTABILITY-01 Test A PASS (删 BMD/GStreamer Provider 后仍可编译: `simulation` / `mock` 构建 OK)
- [x] 词法门禁反向自测: 注入未门控 `use gstreamer::prelude::*;` 被正确捕获; 字段名 `gstreamer:` 正确放过

## 5. 提交修复 (2026-08-28)

- [x] 初版 `46c9a11` 因 CRLF 归一化命令 bug (`open(p,'w').write(open(p).read())` 先截断后读空)
      将三文件以 **0 字节** 提交, 导致 CI 门禁假绿 (空脚本静默 exit 0)。
- [x] 修复: 三文件以**真实内容 + LF** 重新提交 (先读后写), 门禁实跑 PASS、YAML 校验合法。
