# 贡献指南 — VBMF

感谢你对 VBMF（IP Broadcast Media Fabric）贡献的兴趣！

> **🔴 V0.2 架构基线已 LOCK FINAL**。这是贡献前必须理解的最重要规则。

## ⚠️ 架构冻结说明

V0.2 已完成 22 轮 review，状态为 **LOCK FINAL**：

- ✅ 12 Engines + 5 横向系统 + 6 横切能力 + 22 原则 + 57 决策
- ✅ V0.2 Runtime Semantics = CLOSED
- ✅ implementation_ambiguity: NONE
- ❌ **不再开 V0.2.x 架构 review**（V0.2.5 FORBIDDEN）
- ❌ **任何架构级修改** 必须走 V0.3 流程

### 这对贡献意味着什么

| 类型 | 状态 | 流程 |
|---|---|---|
| **Bug 修复** 现有 Engines | ✅ 欢迎 | 开 PR → review → merge |
| **文档 typo / 线框修复** | ✅ 欢迎 | 开 PR |
| **Phase 0.6 Reference Implementation** | 📋 未来 | 单独 issue 协调 |
| **Phase 1 Media Agent (Rust)** | 📋 未来 | Phase 0.6 验收后 |
| **新 Engine（如 NDI/RIST/Zixi）** | ❌ 架构变更 | 必须 V0.3 流程 |
| **新增第 13 个 Engine** | ❌ 禁止 | V0.2 LOCK FINAL |
| **修改 Switch Mode 3 种** | ❌ 禁止 | 核心定义 |
| **修改 Data Plane 4 Layer** | ❌ 禁止 | 核心定义 |

## 🚀 怎么贡献

### 1. 报告 Bug

报告前请先检查：
- [architecture/ARCHITECTURE_V0.2.md](docs/architecture/ARCHITECTURE_V0.2.md) — bug 可能是已知限制
- [已有 issues](../../issues) — 可能已被跟踪

若是新问题，开 issue 并附上：
- **What** — 清晰描述
- **Where** — 哪个 Engine / 章节 / Wireframe
- **预期 vs 实际** — 你预期看到 vs 实际看到
- **复现步骤** — 最小步骤
- **环境** — V0.2 章节版本、OS、硬件

### 2. 提交 PR

#### PR 标题规范

```
[scope] 简短描述
```

示例：
- `[docs] 修正 §3.9 typo`
- `[wireframe] 09-health-tree: 增加 7 Health Invariants 图例`
- `[chain] chain-2-failure: 增加 FI-04 Clock Drift 场景`
- `[bug] channel_health_aggregation: 修复 Rule 4 UNKNOWN 吸收`（V0.2.4 Errata-14 issue）

#### PR 内容必须包括

- **What** — 改了什么
- **Why** — 解决什么问题
- **How** — 思路
- **测试** — 怎么验证
- **架构影响** — 无 / V0.2 范围内 / 需 V0.3（当前阶段必须为"无"）

#### Review 流程

1. 开 PR + 清晰描述
2. Maintainer review V0.2 对齐
3. 本地检查通过：`python scripts/check_docs.py`（链接可达 + 关键数字口径；markdownlint 可选；CI 配置后自动执行）
4. Approve → merge

### 3. 文档规范

- **风格**：V0.2 架构基线主要为中文；Phase 0.5 wireframe 中英双语。
- **Canonical Vocabulary**：TS / Rust / JSON Schema / PG enum 共享的术语**必须**严格使用（见 [docs/architecture/ARCHITECTURE_V0.2.md 附录 D](docs/architecture/ARCHITECTURE_V0.2.md)）
- **YAML 代码块**：使用 ```yaml fenced code blocks
- **章节引用**：V0.2 §X.Y / §A.B / Decision #NN 引用规范

### 4. 代码规范（待代码落地）

| 语言 | 规范 | Linter |
|---|---|---|
| TypeScript | ESLint + Prettier | `pnpm lint` |
| Rust | rustfmt + clippy | `cargo fmt && cargo clippy` |
| SQL | sqlfluff | `sqlfluff lint` |
| YAML | yamllint | `yamllint .` |
| Markdown | markdownlint | `markdownlint '**/*.md'` |

## 📋 当前贡献优先级

| 优先级 | 领域 | 说明 |
|---|---|---|
| 🔥 高 | Phase 0.5 wireframe 润色 | 打开 `docs/phase-0.5/operator/*.html`（10 张）与 `docs/phase-0.5/product/*.html`（5 张）改进 |
| 🔥 高 | Phase 0.6 Reference A1 | PACKET_SWITCH 基础能力，需实际部署验证 |
| 🔥 高 | Phase 0.6 Reference A2 | SDI 主备走 FRAME/MASTER |
| 🟡 中 | Phase 0.6 8 Fault Injection (FI-01A/B/02~07) | FI-01A SDI 冻结 / FI-01B Backup / FI-02 音频静音 / FI-03 FFmpeg 崩溃 / FI-04 Clock Drift / FI-05 HLS 切片失败 / FI-06 MASTER Join / FI-07 RECORDING |
| 🟡 中 | Phase 0.6 7 Health Invariants tests | 转为 executable test cases |
| 🟢 低 | 翻译（中 ↔ 英） | 文档 + wireframe label |
| 🟢 低 | docs/assets/ 中的图 | 架构图 |

## 🧪 测试策略

- **架构文档**：任何对 12 Engines / 5 横向系统 / 6 横切能力 / 22 原则 / 57 决策的修改必须走 V0.3 流程
- **Phase 0.5 wireframes**：视觉 review + click-through（operator 10 页互链 + product 5 页跨域链接）
- **Phase 0.6 References**：24h 稳定性 + 全部 8 Fault Injection (FI-01A/B/02~07) 通过
- **Phase 1 Media Agent**：24h SDI → HLS pipeline 稳定

## 📞 联系方式

- **GitHub Issues**：[github.com/pwl1987-dev/vbmf/issues](../../issues)
- **Discussions**：[github.com/pwl1987-dev/vbmf/discussions](../../discussions)
- **Security**：见 [SECURITY.md](SECURITY.md) 私下披露

## 📜 行为准则

互相尊重。我们都是为了构建一个出色的广播平台。（正式 Code of Conduct 文档待补；在此之前以 GitHub 社区准则为准。）

## 🙏 感谢

每个 PR、每个 issue、每个 review comment 都帮助 VBMF 成为可靠的广播开源平台。

---

**VBMF Contributors** · V0.2 LOCK FINAL · Apache 2.0
