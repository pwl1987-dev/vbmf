# DOCUMENT_STATUS_MODEL — 文档状态统一模型

> Phase 0.6 全局规则（状态词 SoT）。所有 `docs/architecture` 文档/契约统一使用本模型的**四类正交状态**，消除「✅ 已建 / LOCK / Frozen / Planning Frozen / Acceptance / Implemented / Verified」混用导致的误解。
> 关联：[`PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`](./PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md)（真实代码进度）、[`PHASE_0_6_ACCEPTANCE_MATRIX.md`](./PHASE_0_6_ACCEPTANCE_MATRIX.md)（门禁）。

## 1. 为什么需要

过去不同文档混用「已建」「LOCK」「Frozen」「Planning Frozen」「Implemented」「Verified」等词，但无统一定义。最关键误解：

> **「已建」表示文档存在（`CONTRACT_STATUS = FROZEN`），不等于代码已实现（`IMPLEMENTATION_STATUS = IMPLEMENTED`）。**

## 2. 四类正交状态

### 2.1 CONTRACT_STATUS — 契约是否冻结
| 值 | 含义 |
|---|---|
| `PROPOSED` | 草案，未冻结 |
| `FROZEN` | 已冻结；后续实现以此为准，不得「边写边发现抽象」 |
| `DEPRECATED` | 已废弃（保留历史追溯） |

### 2.2 IMPLEMENTATION_STATUS — 代码是否落地
| 值 | 含义 |
|---|---|
| `NOT_STARTED` | 未开始 |
| `IN_PROGRESS` | 进行中 |
| `PARTIAL` | 部分落地（核心路径可用，边界未全覆盖） |
| `IMPLEMENTED` | 已实现 |

### 2.3 VERIFICATION_STATUS — 验证级别
| 值 | 含义 |
|---|---|
| `NOT_VERIFIED` | 未验证 |
| `LAB_VERIFIED` | 仅 lab / 模拟验证 |
| `HARDWARE_VERIFIED` | 真机验证 |
| `ACCEPTED` | 已验收（含证据） |

### 2.4 GATE_STATUS — 门禁（Acceptance）
| 值 | 含义 |
|---|---|
| `PENDING` | 待评 |
| `PASS` | 通过 |
| `FAIL` | 未通过 |
| `BLOCKED` | 阻塞（依赖未满足） |

## 3. 旧词 → 新模型映射
| 旧词 | 新含义 |
|---|---|
| 「已建」「✅ 已建」 | `CONTRACT_STATUS = FROZEN`（**不是** IMPLEMENTED） |
| 「LOCK」「LOCK FINAL」 | V0.2 专用，等同 `CONTRACT_STATUS = FROZEN` 且不可改 |
| 「Planning Frozen」 | `CONTRACT_STATUS = FROZEN`（仅 Contract；实现留待后续阶段） |
| 「Implemented」 | `IMPLEMENTATION_STATUS = IMPLEMENTED` |
| 「Verified」 | `VERIFICATION_STATUS` 之一 |

## 4. 铁律

> **文档存在 ≠ 代码实现。** 任何「已建」契约，其 `IMPLEMENTATION_STATUS` 可能仍是 `NOT_STARTED`。真实代码进度唯一 SoT： [`PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`](./PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md)。

## 5. Phase 0.6 当前总体状态

- **Architecture Contract**：`FROZEN`（`CONTRACT_STATUS = FROZEN`）。
- **Implementation Gate**：`NOT PASSED`（`ARCH-PORTABILITY-01` / `ARCH-BACKEND-01` 当前编译不过）。（**状态订正 2026-11-27**：Linux CI 实跑 remove-adapter 编译证明 = `PROOF OK` ⇒ 本项 **PASS**，证据 CI run `46011711764` / job `architecture-portability` / runner `vbmf-ci-02`（self-hosted Linux）；详见 `PHASE_0_6_IMPLEMENTATION_GAP_MATRIX.md`「Gate 裁定」块）
- **含义**：契约关系已锁定（后续实现不得再发明新抽象）；但代码实现仍须过两门禁后才算 P0 完成。
- 这正是 `ARCHITECTURE_FREEZE ≠ IMPLEMENTATION_FREEZE`：架构冻结 ≠ 实现完成。
