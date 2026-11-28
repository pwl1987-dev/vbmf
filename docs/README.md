# VBMF 文档

> VBMF (IP Broadcast Media Fabric) 全部文档入口。
> V0.2 架构基线 LOCK FINAL（22 轮 review）。

## 目录

| 路径 | 内容 | 状态 |
|---|---|---|
| [`architecture/ARCHITECTURE_V0.2.md`](architecture/ARCHITECTURE_V0.2.md) | **V0.2 架构基线**（22 轮 review LOCK FINAL，192KB） | ✅ |
| [`architecture/README.md`](architecture/README.md) | V0.2 架构快速参考 + 关键定义速查 | ✅ |
| [`architecture/CI_RUNNER_STRATEGY.md`](architecture/CI_RUNNER_STRATEGY.md) | 自托管 CI Runner 基础设施契约（Phase 1 v1.2：Runner / No-Regression 双 Gate；先建 Runner，现有 CI 零改动） | ✅ |
| [`SYSTEM_AND_PROJECT_PLAN.md`](SYSTEM_AND_PROJECT_PLAN.md) | 初始系统 + 项目计划（V0.1 阶段） | ✅ |
| [`phase-0.5/`](phase-0.5/) | Phase 0.5 统一入口：0.5A Operator（10 页 + 4 链）+ 0.5B Product Surface（38 表面 + 5 P0 wireframe + Design System + i18n）+ 0.5C Info Arch（4 域导航 + Object Vocabulary） | ✅ 0.5A/0.5B · 🟡 0.5C |
| [`phase-0.6/`](phase-0.6/) | Executable Acceptance Specification 计划（前置: Phase 0.5 LOCK FINAL） | 📋 |
| `assets/` | 图 / Diagram（空目录，待补） | 📋 |

## 阅读顺序（推荐）

1. **[../../README.md](../README.md)** — 项目门面
2. **[architecture/ARCHITECTURE_V0.2.md](architecture/ARCHITECTURE_V0.2.md)** — V0.2 架构基线（1-2 小时通读）
3. **[phase-0.5/README.md](phase-0.5/README.md)** — Phase 0.5 总览（4 域导航）
4. **[phase-0.5/operator/](phase-0.5/operator/)** — 10 张 Operator 线框（中英双语，任意浏览器打开）
5. **[phase-0.5/product/](phase-0.5/product/)** — 5 张 Product P0 线框 + **[SURFACE_SPEC.md](phase-0.5/SURFACE_SPEC.md)**（38 表面映射）+ [DESIGN_SYSTEM.md](phase-0.5/DESIGN_SYSTEM.md) + [I18N_SPEC.md](phase-0.5/I18N_SPEC.md)
6. **[phase-0.5/chains/](phase-0.5/chains/)** — 4 关键操作链
7. 等待 Phase 0.6

## V0.2 关键状态

```yaml
v0_2_runtime_semantics:
  status: CLOSED
  implementation_authority: THIS_DOCUMENT
  consistency_check: PASS
  implementation_ambiguity: NONE

  architecture:
    engines: 12
    cross_systems: 5
    cross_capabilities: 6
    principles: 22
    decisions: 57
    review_passes: 22
    patches: [V0.2.3 patch 1, V0.2.4 patch 2, Cleanup-1/2/3, Errata-1/2/3/4/5/6/7/8/9/10/11/12/13/14]

  runtime:                  # 9 大 Runtime 域（V0.2.4 Errata-14 凑齐）
    lifecycle:              CLOSED
    readiness:              CLOSED
    health:                 CLOSED
    switch_mode:            CLOSED
    standby_semantics:      CLOSED
    failure_domains:        CLOSED
    health_tree:            CLOSED
    channel_status:         CLOSED
    clock:                  CLOSED

  schema:                   # 3 Schema + 2 Semantic Cleanup
    health_tree_role:       CLOSED
    aggregation_sql:        CLOSED
    effective_channel_status: CLOSED
    descriptive_resource_class: CLOSED
    channel_status_source:  CLOSED

  health_invariants:        # 7 条（C.26 Errata-14 锁）
    - H1: ACTIVE+FAILED → FAILED
    - H2: ACTIVE+DEGRADED → DEGRADED
    - H3: STANDBY+FAILED → DEGRADED
    - H4: STANDBY+DEGRADED → DEGRADED
    - H5: OFFLINE+FAILED → 系统已吸收
    - H6: Source RG 全部候选不可用 → FAILED
    - H7: effective_channel_status MUST be read from channel_health_view

  architecture_changes_after_this: FORBIDDEN
  next_phase: [Phase 0.5, Phase 0.6]
  v0_2_5: FORBIDDEN
```

## 文档结构对应 V0.2 章节

| V0.2 章节 | 内容 | 关联 |
|---|---|---|
| §1 架构原则 | 声明 22 条，**当前成文 7 条**（1.13 与 1.17–1.22）；其余 15 条为占位「同 V0.2 第 2 轮不变」，仓内无正文副本 —— 缺口说明见 [`VBMF_PRODUCT_PRD.md`](VBMF_PRODUCT_PRD.md) §5.5 | [`architecture/ARCHITECTURE_V0.2.md`](architecture/ARCHITECTURE_V0.2.md) |
| §2 12 Engines | Engines 总览 | 同上 |
| §3.x 核心算法 | Switch / Hot-Standby / Program Master / Health Tree | 同上 |
| §4 决策 | 57 决策 | 同上 |
| §5 Schema | PostgreSQL Schema | 同上 |
| §6 部署 | 部署拓扑 | 同上 |
| §7 Latency Probes | 10 探针 | 同上 |
| §8 故障恢复 | Failure Domain Matrix | 同上 |
| §8.11 三轴状态机 | 状态机 | 同上 |
| §9 部署 | Host + Docker 边界 | 同上 |
| §10 UX | 9 页面 + 4 链 | [`phase-0.5/`](phase-0.5/) |
| §11 路线图 | Phase 0/0.5/0.6/1/... | [`../../ROADMAP.md`](../ROADMAP.md) |
| 附录 A 术语表 | Canonical Vocabulary | [`architecture/ARCHITECTURE_V0.2.md`](architecture/ARCHITECTURE_V0.2.md) |
| 附录 C 审查记录 | C.1 - C.26 | 同上 |
| 附录 D 终态 | LOCK FINAL 状态 | 同上 |
