# PHASE_0_6_IMPLEMENTATION_GAP_MATRIX — 实现缺口矩阵

> **[状态对账 2026-08-30, p07b-consolidation]** 本表 IMPLEMENTATION/Gate 列已与 master `c574238` 实态对齐（0.6 系列全部落地：SPI/Session/Resource/Preflight/Registry/Mint/RuntimeEvent；Canonical Media Semantics 四基础随 0.7B 落地，门禁见 Acceptance Matrix 0.7 节）。其余未提及行状态不变。
>
> **[Gate 裁定 2026-11-27]** 本表两行 Gate 的状态已在 **Linux CI 实跑**后订正为 `PASS`，证据见文末「Gate 裁定」块（CI run `46011711764`）。

> **唯一回答「文档要求 vs 代码实际完成度」的 SoT。** 状态词见 [`DOCUMENT_STATUS_MODEL.md`](./DOCUMENT_STATUS_MODEL.md)。本文件防止「文档存在 = 功能完成」的误读。
> 关联：各 Contract 文档、[`PHASE_0_6_ACCEPTANCE_MATRIX.md`](./PHASE_0_6_ACCEPTANCE_MATRIX.md)、`evidence/`。

## 状态词（四轴模型 · 2026-11-27 对齐 `DOCUMENT_STATUS_MODEL.md`）

| 状态轴 | canonical 取值（`DOCUMENT_STATUS_MODEL.md` §2） | 本表落在哪一列 |
|---|---|---|
| `CONTRACT_STATUS` | `PROPOSED` / `FROZEN` / `DEPRECATED` | **本表不表达**（逐契约冻结状态见各 Contract 文档与 `DOCUMENT_STATUS_MODEL.md:60`） |
| `IMPLEMENTATION_STATUS` | `NOT_STARTED` / `IN_PROGRESS` / `PARTIAL` / `IMPLEMENTED` | `Implementation` 列（取值逐字一致，无简写） |
| `VERIFICATION_STATUS` | `NOT_VERIFIED` / `LAB_VERIFIED` / `HARDWARE_VERIFIED` / `ACCEPTED` | **`VERIFICATION_STATUS` 列**（2026-11-27 **逐行判定**，取值逐字 canonical）—— 判定规则与逐行依据见下方；原 `Verification·单测` / `·仿真` / `·真机` 三列保留为 2026-08-30 快照的**验证手段与引用**（读法见映射表） |
| `GATE_STATUS` | `PENDING` / `PASS` / `FAIL` / `BLOCKED` | `Gate` 列（门禁 id）；门禁判定见 `PHASE_0_6_ACCEPTANCE_MATRIX.md` |

**本表内部简写 → canonical 读法**（原 8 列是 2026-08-30 快照，**取值未改**；新增 `VERIFICATION_STATUS` 列直接用 canonical 值，无简写）：

| 本表取值 | 所在列 | 读法 |
|---|---|---|
| `Complete` / `Partial` | `Verification·单测` / `Verification·仿真` | 该验证手段**已完成 / 部分完成**；canonical `VERIFICATION_STATUS` 以 `Evidence` 所指条目的结论为准 |
| `—` | Verification 三列 | 该**验证手段**未执行 ⇒ 该手段的验证级别为 `NOT_VERIFIED`（**不等于整行未验证**：16 行仿真列全为 `—`，其中 10 行真机已验） |
| `HW-IDENT-02` / `MEDIA-RT-01` / `SESSION-RT-01` / `RESOURCE-RT-01` / `CI` / `Acceptance` | `Verification·真机` / `Evidence` | **验证或证据的引用**（不是状态值）⇒ 状态须查被引条目 |
| `PASS` / `PARTIAL` / `OPEN` | `完成度汇总` | **派生列，不属四轴**：`PASS` = 该行已落地；`PARTIAL` = 部分完成；`OPEN` = 未启动；`BLOCKED` = 被门禁阻塞（2026-11-27 裁定后本表不再出现）。原词表里的 `DONE` **从未在本表出现**（本表实际用 `PASS` 书写），二者**不作等价** |

**逐行判定规则（2026-11-27 · 用于 `VERIFICATION_STATUS` 列）**：① 行内无任何验证记录 ⇒ `NOT_VERIFIED`；② 有验证记录但只到 CI / 编译 / 单测 / mock 级（**无真机执行**）⇒ `LAB_VERIFIED`；③ 有真机验证（真机报告或真机门禁通过）但该行实现未达 `IMPLEMENTED`、或所引证据在仓内不可查 ⇒ `HARDWARE_VERIFIED`；④ 该行对应验收门禁在 `PHASE_0_6_ACCEPTANCE_MATRIX.md` 记 PASS **且**证据在仓内可查（`evidence/` 目录 · `docs/superpowers/reports/` 报告 · 或本文件「Gate 裁定」块所记 CI run 号与步骤原文）**且**该行实现 = `IMPLEMENTED` ⇒ `ACCEPTED`。

**逐行结果与依据**（`ACCEPTED` 7 · `HARDWARE_VERIFIED` 4 · `LAB_VERIFIED` 4 · `NOT_VERIFIED` 1）：

| 值 | 能力项 | 依据 |
|---|---|---|
| `ACCEPTED` | Hardware Provider SPI · Media Backend SPI | HW-IDENT-02 / MEDIA-RT-01 在 Acceptance Matrix 记 PASS（已验证）且真机执行；证据在仓（`evidence/bmd-10.30.15.10/hw-ident-02/` 10 文件 · MEDIA-RT-01 报告 `docs/superpowers/reports/2026-08-29-p06-hi-backend-resource-gates-verify.md`） |
| `ACCEPTED` | Session Model · Resource Model · Preflight | SESSION-RT-01 / RESOURCE-RT-01 真机 ALL PASS（Acceptance Matrix 0.7 节）+ 报告 `docs/superpowers/reports/2026-08-29-p07-session-runtime-verify.md` 在仓 |
| `ACCEPTED` | Portability Gate · Backend Gate | CI run `46011711764` 7/7 绿（Acceptance Matrix Test A 的 Pass criteria = PASS）+ 本文件「Gate 裁定」块载 run 号与步骤原文 |
| `HARDWARE_VERIFIED` | Canonical Identity · Provider Identity Adapter · 消除 11× `device_number` | 真机门禁 HW-IDENT-02 已 PASS、证据在仓，但该行实现为 `PARTIAL` / `IN_PROGRESS` ⇒ 未达 `ACCEPTED` |
| `HARDWARE_VERIFIED` | RuntimeEvent / RuntimeError | 真机门禁 MEDIA-RT-01 已 PASS，但该行实现为 `PARTIAL` |
| `LAB_VERIFIED` | Runtime Binding | 仅单测 `Partial`（无真机执行）；所引 `evidence/.../acceptance` **在仓内不可解析** |
| `LAB_VERIFIED` | Provider Registry / Mock · Architecture Lint + Proof · BMD / GStreamer Reference Adapter | 仅 CI / 编译级证据（`session-lifecycle` job · `architecture-portability` job · remove-adapter proof），**无真机执行** |
| `NOT_VERIFIED` | Topology | 验证三列全 `—`；Acceptance Matrix 记 `ARCH-TOPOLOGY-01` 实现 = `NOT_STARTED` |

> **六条必须一起读的约束**：① **末列 `完成度汇总` 是 `Implementation` 列的确定性派生**（`IMPLEMENTED`→`PASS`、`PARTIAL`/`IN_PROGRESS`→`PARTIAL`、`NOT_STARTED`→`OPEN`；当前表与 2026-08-30 原版各 **16/16 行零例外**）⇒ **该列不含独立信息**，保留仅为快照完整与人工阅读；**与门禁判定无关**（同一 `Gate` 在不同行可有不同末列值，差异来自 `Implementation` 而非 `Gate`）。② **第一列已由 `Contract` 改名为 `能力项`**：其取值含契约、能力、以及 1 行迁移任务（`消除 11× device_number`），并非全是 Contract ⇒ **逐契约的 `CONTRACT_STATUS` 本表不表达**。③ **`VERIFICATION` 轴已补齐 canonical 列**：`VERIFICATION_STATUS` 列是 **2026-11-27 的逐行判定**（**不属 2026-08-30 快照内容**），取值只能是 §2.3 的四个 canonical 值；原三列仍是快照的验证手段与引用 ⇒ 两者并存不矛盾：前者答「验证到什么级别」，后者答「怎么验的、证据在哪」。**该列已有机械守卫**：`scripts/check_docs.py` 的 `check_verification_status()`（取值必须 ∈ §2.3 canonical 集合，**词表由该文件派生、不写死在脚本里**；且 SoT 表与产品层镜像表的取值分布必须一致）⇒ 改坏即门禁红，可单独跑 `python3 scripts/check_docs.py verification`。**2026-11-27 起该守卫已进 main 的 required status checks**（context `v3-harness-tooling` 内新增 `python3 scripts/check_docs.py verification` 步骤；**零依赖** —— yaml 只在 phase06 检查族局部导入）⇒ **改坏即挡合并**，不再只是红 CI；全量文档门禁（链接 + 锚点 + 数字 + Phase 0.6 FI 集合）在 `doc-consistency.yml`（**非 required** lane，可由 owner 升格）。④ **原「Gap 总括」轴与 `Gap` 表头（2026-08-30 定义）已于 2026-11-27 撤下** —— 四轴中无 Gap 轴对应 ⇒ 四轴之外只保留**显式标注「派生」**的列。⑤ **`GATE_STATUS` 轴本表不设列**：门禁状态是**门**的属性、不是行的属性，其唯一 SoT = `PHASE_0_6_ACCEPTANCE_MATRIX.md`（本表 `Gate` 列只给门禁 id；两行 Gate 的 PASS 裁定见「Gate 裁定」块）⇒ 刻意不在本表复制门禁判定，避免制造第二个 SoT。⑥ **与各 Contract 文档首行状态头冲突时以本表为准**（`DOCUMENT_STATUS_MODEL.md` §4 铁律：「真实代码进度唯一 SoT = 本表」）。**已知漂移（pre-existing，非本轮引入）**：**8 份**契约文档首行曾写 `VERIFICATION = NOT_VERIFIED`（另 `PHASE_0_6_MASTER_PRD.md` 写 `IMPLEMENTATION = NOT_STARTED`），其中与本表 16 行直接对应的 **3 份** = `CANONICAL_IDENTITY.md` · `RUNTIME_SESSION_MODEL.md` · `RUNTIME_BINDING_MODEL.md` ⇒ 与本表 Implementation 列（本轮之前即矛盾）及新增 VERIFICATION 列同时冲突；**已于 2026-11-27 逐份核订**（**6 份订正 + 2 份确认一致**：`RUNTIME_TOPOLOGY_CONTRACT` · `DEVICE_INTEGRATION_CONTRACT` 原值即 canonical；订正一律「同句追加括注、原句保留」，并写明覆盖范围与边界）⇒ 该漂移**已闭合**；`PHASE_0_6_MASTER_PRD.md` 的 `IMPLEMENTATION` 头属 master PRD，**不在本轮范围**（残余项）。**审计须知**：契约文档状态头的 canonical 值在**同句订正括注**内（原句按冻结纪律保留）⇒ 核对须读括注，**不可只 grep 原句**（`VERIFICATION = NOT_VERIFIED` 仍在 8 处出现，属留痕，不是漂移）。

## 矩阵

| 能力项 | Implementation | VERIFICATION_STATUS（2026-11-27 判定） | Verification·单测 | Verification·仿真 | Verification·真机 | Evidence | Gate | 完成度汇总（派生） |
|---|---|---|---|---|---|---|---|---|
| Canonical Identity（`DeviceId`/`PortId`/`SessionId` 类型 + `IdentityStrength`） | `PARTIAL` | `HARDWARE_VERIFIED` | Partial | — | HW-IDENT-02 | `evidence/.../HW-IDENT-02` | `ARCH-PORTABILITY-01` | `PARTIAL` |
| Provider Identity Adapter（BMD→`DeviceId` 收敛） | `PARTIAL` | `HARDWARE_VERIFIED` | Partial | — | HW-IDENT-02 | 同上 | `ARCH-PORTABILITY-01` | `PARTIAL` |
| Hardware Provider SPI（`HardwareProvider`: discover→Result + ProviderIdentity 配对） | `IMPLEMENTED` | `ACCEPTED` | Complete | — | HW-IDENT-02 | `evidence/.../HW-IDENT-02` | `ARCH-PORTABILITY-01` | `PASS` |
| Media Backend SPI（`MediaBackend`: instantiate/start/stop/recover/observe, 无条件编译） | `IMPLEMENTED` | `ACCEPTED` | Complete | — | MEDIA-RT-01 / ARCH-BACKEND-01 | `evidence/.../MEDIA-RT-01` | `ARCH-BACKEND-01` | `PASS` |
| Session Model（`SessionId`/两级状态机/SessionManager 唯一 owner） | `IMPLEMENTED` | `ACCEPTED` | Complete（0.7A, 四轮 Hardening） | — | SESSION-RT-01 / RESOURCE-RT-01 | 真机 ALL PASS（verify 报告 2026-08-29-p07-session-runtime） | `ARCH-PORTABILITY-01` | `PASS` |
| Resource Model（Reservation/Lease/Allocation/状态机/原子 acquire/回滚） | `IMPLEMENTED` | `ACCEPTED` | Complete（0.7A） | — | RESOURCE-RT-01 | 同上 | — | `PASS` |
| Runtime Binding（`BindingEntry`/Manifest 校验） | `PARTIAL` | `LAB_VERIFIED` | Partial | — | Acceptance | `evidence/.../acceptance` | `ARCH-PORTABILITY-01` | `PARTIAL` |
| Topology（`PhysicalConnection`/`LogicalRoute`） | `NOT_STARTED` | `NOT_VERIFIED` | — | — | — | — | `ARCH-TOPOLOGY-01` | `OPEN` |
| RuntimeEvent / RuntimeError（统一模型） | `PARTIAL` | `HARDWARE_VERIFIED` | Partial | — | MEDIA-RT-01 | `evidence/.../MEDIA-RT-01` | `ARCH-BACKEND-01` | `PARTIAL` |
| Preflight（分级判定: Graph/Port/Resource/Lease/Identity/Backend; judge-only FAIL 零预留） | `IMPLEMENTED` | `ACCEPTED` | Complete（0.7A） | — | SESSION-RT-01 前置 | verify 报告 p07-session-runtime | — | `PASS` |
| Provider Registry / Mock Provider+Backend | `IMPLEMENTED` | `LAB_VERIFIED` | Complete（fail-closed mock+真实冲突拒启） | — | ARCH-BACKEND-01 | CI session-lifecycle job | `ARCH-PORTABILITY-01`/`ARCH-BACKEND-01` | `PASS` |
| Architecture Lint + Proof（词法 Lint + remove-adapter 编译证明, CI required） | `IMPLEMENTED` | `LAB_VERIFIED` | Complete | — | CI | `architecture-portability` job | CI | `PASS` |
| 消除 11× `device_number` → Canonical `DeviceId` | `IN_PROGRESS` | `HARDWARE_VERIFIED` | Partial | — | HW-IDENT-02 | `evidence/.../HW-IDENT-02` | `ARCH-PORTABILITY-01` | `PARTIAL` |
| BMD / GStreamer Reference Adapter（降级为 Adapter） | `IMPLEMENTED` | `LAB_VERIFIED` | Complete（C6/C7 迁移 + hardening 收口: adapters/{blackmagic,gstreamer} + remove-adapter proof） | — | ARCH-PORTABILITY/BACKEND | CI | `ARCH-PORTABILITY-01`/`ARCH-BACKEND-01` | `PASS` |
| Portability Gate（`ARCH-PORTABILITY-01` Test A 编译通过） | `IMPLEMENTED` | `ACCEPTED` | Complete | — | CI（`architecture-portability` required job，Linux 自托管 runner `vbmf-ci-02`） | CI run `46011711764`（remove-adapter 编译证明 **PROOF OK**） | `ARCH-PORTABILITY-01` | `PASS` |
| Backend Gate（`ARCH-BACKEND-01` Mock↔GStreamer 共享 Plan） | `IMPLEMENTED` | `ACCEPTED` | Complete | — | CI（`architecture-portability` required job，Linux 自托管 runner `vbmf-ci-02`） | CI run `46011711764`（Mock↔GStreamer 共享 PipelinePlan 三契约一致） | `ARCH-BACKEND-01` | `PASS` |

> **⚠️ 2026-11-27 M0 对账说明（不修改上方矩阵行）**
>
> 1. **上方矩阵行 = 2026-08-30（p07b-consolidation）快照**，不是今日实态。其后落地但未反映在本表的增量：`0.7C-1~8`（External API Boundary / Transport / Runtime State / Runtime Query / Event Projection / Idempotency）· `0.7D`（Event Projection）· `WCO-01A/B/C`（Web Console i18n + 01-dashboard + 02-sources）· `PR-STAB-01`（24h 资格阶梯三档全 PASS ⇒ **STABILITY VERIFIED**）· 文档门禁复活（`scripts/check_docs.py` 终止性修复 + CI 接线）。
> 2. **两行 Gate 的状态已在 2026-11-27 裁定（见文末「Gate 裁定」块）**：矩阵行原写 `NOT_PASSED / BLOCKED`，而 `PHASE_0_6_ACCEPTANCE_MATRIX.md:10,24`（Test A 的 Pass criteria 列 + 说明段对账）早已写 **PASS** —— **矩阵行是 2026-08-30 的过期快照**（孤例）；**同文件「结论」段当时写的是「两个阻塞项…是当前 P0 的硬缺口」，同样属过期快照**（2026-11-27 已随矩阵实态订正，见文末「结论」段）。裁定依据 = **Linux runner 上的编译级实证**（`scripts/check_remove_adapters.py` 真删 blackmagic/gstreamer/ffmpeg adapter 后仍能编译），**不是**间接证据（词法 lint PASS）。macOS 本机无法执行该脚本（libc 声明在 linux-only 依赖内，43 处无条件使用 ⇒ 34×E0433 + 2×E0425），故须以 Linux CI 退出码为准。
> 3. **今日完整对账已移交给产品层 PRD**：`docs/VBMF_PRODUCT_PRD.md` §7.2（Contract 完成度，含三处漂移标注）。本文件继续作为 **Contract 级** SoT，其「表面实现度」不在本表范围。
> 4. **2026-11-27：本表列名与状态词表已对齐 `DOCUMENT_STATUS_MODEL.md` 四轴**（详见「状态词」块）：① 本条原写「Implementation / Verification / Gap 三列」—— 当时本表并无 `Verification` 列、末列表头 `Gap` 亦非四轴之一；② 现行表头 = `能力项` / `Implementation` / **`VERIFICATION_STATUS`（2026-11-27 逐行判定）** / `Verification·单测` / `Verification·仿真` / `Verification·真机` / `Evidence` / `Gate` / `完成度汇总（派生）`；③ **原 8 列的取值零改动**（仍是 2026-08-30 快照），行内旧简写按「状态词」块的「内部简写 → canonical 读法」表读；**新增的第 3 列是 2026-11-27 的逐行判定**，不属快照内容。

> ### Gate 裁定（2026-11-27 · Linux CI 实证）
>
> | 项 | 值 |
> |---|---|
> | CI run | `46011711764` · https://github.com/pwl1987-dev/vbmf/actions/runs/46011711764 |
> | headSha | `140c6ec4fe1d643667dfe927acd190183fb9c027`（= 本次裁定的代码基线） |
> | job | `architecture-portability`（job id `140548608507`，**required context** 之一） |
> | runner | `vbmf-ci-02` · labels `self-hosted, Linux, X64, vbmf, vbmf-general` · 2026-11-27T14:00:24Z |
> | 词法层 | `Architecture Lint (ARCH-PORTABILITY-01 lexical)` → **PASS** |
> | 编译级 | `Architecture Proof (remove-adapter compile, P0-5)` → `cargo check --no-default-features --features simulation` + `--features mock` → **PROOF OK: Domain/Contracts/Runtime compile without concrete adapters** |
> | job / run 结论 | `success` · run 7/7 job 全绿（rust-format / architecture-portability / rust-clippy / session-lifecycle / rust-test-matrix / hardware-test-compile / gstreamer-build） |
> | 裁定 | **`ARCH-PORTABILITY-01` = PASS · `ARCH-BACKEND-01` = PASS**；本矩阵两行 Gate 的 `NOT_PASSED / BLOCKED` 即为过期快照，已订正 |
>
> **边界（不得扩大解读）**：该证明覆盖的是「**删除 concrete adapter 后 Domain/Contracts/Runtime 的指定构建路径仍编译**」，**不等于**「整个项目完全 vendor-independent」（脚本自述 + `media-agent.yml:71-72` 同一表述）。真实换型（BMD→AJA）验收仍**未做**。

## 结论
> **口径说明（2026-11-27 订正）**：本段是上方矩阵的**派生结论**，必须与矩阵实态一致。上方矩阵行保持 2026-08-30 快照原样（仅两行 Gate 已按 2026-11-27 裁定翻正）；**本段此前与矩阵冲突，已按实态订正**，每条附原句以便回溯。

- **Architecture Contract 已全部 `FROZEN`**（该半句**不由本表证明**：表中无 Contract 状态列；出处 `DOCUMENT_STATUS_MODEL.md:60`）；**Implementation 侧不是「绝大多数 `OPEN`/`PARTIAL`」** —— 按上表实测：Implementation = `IMPLEMENTED` 10 / `PARTIAL` 4 / `IN_PROGRESS` 1 / `NOT_STARTED` 1（共 16 行）⇒ **多数行已落地，未完成集中在 6 行**；验证侧（`VERIFICATION_STATUS` 列）= `ACCEPTED` 7 / `HARDWARE_VERIFIED` 4 / `LAB_VERIFIED` 4 / `NOT_VERIFIED` 1；末列 `完成度汇总` 是 `Implementation` 的**确定性派生**（`IMPLEMENTED`→`PASS`、`PARTIAL`/`IN_PROGRESS`→`PARTIAL`、`NOT_STARTED`→`OPEN`，16/16 行无例外）⇒ **不含独立信息**，保留仅为快照完整。
  > 📌 原句（2026-08-30）：「…但 **Implementation 绝大多数 `OPEN`/`PARTIAL`**」—— 与**当时**矩阵即不符（当时 `IMPLEMENTED` 8 / 未完成 8，恰为一半）⇒ 属**原文档失实**，非 2026-11-27 翻正造成的新漂移。
- ~~两个阻塞项（`ARCH-PORTABILITY-01` / `ARCH-BACKEND-01`）是当前 P0 的硬缺口，须先于 Normalize 消除。~~ → **2026-11-27 裁定 = PASS**（Linux CI run `46011711764` ⇒ `PROOF OK`，见「Gate 裁定」块）⇒ **不再是 Normalize 前的阻塞项**。**边界**：该证明仅覆盖「删 concrete adapter 后 Domain/Contracts/Runtime 指定构建路径仍可编译」；真实换型（BMD→AJA）验收仍未做。
- **下一步仍是纯实现，不是继续设计**（0.6 各 Contract 已 FROZEN，待补的是实现与验证，不是抽象）；当前**未完成项**按上表 = `Canonical Identity` / `Provider Identity Adapter` / `Runtime Binding` / `RuntimeEvent·RuntimeError`（4 行 `PARTIAL`）＋ `消除 11× device_number`（`IN_PROGRESS`）＋ `Topology`（`NOT_STARTED`，`ARCH-TOPOLOGY-01`）。
