# PR-STAB-01 — allocation-path 归因复核与根因收敛（2026-11-18）

Status: **RECONCILIATION + ROOT-CAUSE ANALYSIS / NO BMD EVIDENCE THIS SESSION / STABILITY NOT VERIFIED / LADDER BLOCKED AT RUNG 1**

本报告只做**对账 + 机制推导 + 下一刀设计**。不启动任何 rung、不改冻结 gate、不改 Runtime binary、不宣称实机已验证。

---

## 0. 本轮证据边界（先声明，后推理）

| 类别 | 状态 |
| --- | --- |
| 本地可复算（repo 内已提交历史证据） | **已独立复算**，见 §4 |
| 工具链（analyzer / runner / 单测） | **已独立复跑**，见 §4 |
| 冻结 contract（v3 plan / 阈值 / rung 顺序） | **已核验未被改动**，见 §4 |
| BMD 真机 2026-10-22 rung / 2026-10-23 diag / A-B 臂原始样本 | **不可复验**（SSH publickey 对全部本地身份被拒；repo 内无 `2026-10-2x` 证据目录）⇒ §3.100/§3.101/§3.103 的数字按"已记录、未独立验证"对待 |
| 本轮硬件验证等级 | **NOT RUN**（无 BMD 访问） |

---

## 1. 机制复核：glibc 动态 mmap 阈值棘轮（由已记录 syscall 证据定量确认）

glibc（x86-64）相关语义：

- `nb = request2size(req) = ALIGN_UP(req + 8, 16)`
- mmap 路径：分配大小 `size = ALIGN_UP(nb + 8, 4096)`；`free` 时 `munmap` 归还 OS。
- arena 路径：由 per-thread arena 的 top chunk 供给；top 不够时 `grow_heap()` 把 64 MiB PROT_NONE 预留中更多部分 `mprotect` 成 `rw-p`，新可写页随后被写入 ⇒ **立即全驻留**。
- `_int_free` 对 mmapped chunk 的动态阈值调整：

  ```c
  if (!mp_.no_dyn_threshold
      && chunksize_nomask (p) > mp_.mmap_threshold
      && chunksize_nomask (p) <= DEFAULT_MMAP_THRESHOLD_MAX /* 32 MiB */)
    { mp_.mmap_threshold = chunksize (p);
      mp_.trim_threshold  = 2 * mp_.mmap_threshold; }
  ```

代入 §3.101 已记录的 `munmap(len=5763072)` ×63（main tid）：

1. 被释放的 mmapped chunk 大小 = **5,763,072 B = 0x580000** ⇒ 棘轮后
   `mp_.mmap_threshold = 5,763,072`、`mp_.trim_threshold = 11,526,144`（11 MiB）。
2. SDK 周期性大块请求满足 `nb ≈ 5,760,008 < 5,763,072` ⇒ **恰好翻转为 arena 路径**。
   阈值落在该 size class 的**正上方**一个 mmap 对齐步长内 —— 这解释了为什么只有这一个尺寸类翻转、而其它尺寸不受影响。
3. arena 路径分配后 `free` 只把 chunk 放回 arena 的 bin；OS 回收仅由 `heap_trim`/`systrim` 触发，且**只在 top free chunk 超过 `trim_threshold` 时**发生。棘轮把 `trim_threshold` 抬到 11 MiB，而 SDK 每次只释放 ~5.76 MB ⇒ 保留机制被结构性放大。

**由记录数字反推请求大小**：`ALIGN_UP(nb + 8, 4096) = 5,763,072` ⇒ `nb ∈ (5,758,648, 5,763,064]` ⇒ `req ∈ (5,758,632, 5,763,056]`。

⇒ **recurring block ≈ 5.76 MB**（≈5.5 MiB）。

### 1.1 尺寸归属线索（本轮新增·可测假设，非结论）

- UYVY 8-bit 4:2:2 的 1080p25 单帧 = 1920×1080×2 = **4,147,200 B**；10-bit 4:2:2 单帧 = **8,294,400 B**。
- 两者**都不落在** (5,758,632, 5,763,056] 窗口内 ⇒ **该 ~5.76 MB 块不是视频帧**。
- `5,760,000 B` 落在窗口内，且可分解为 `48,000 × 120` = 48 kHz × 2 ch × 3 B（24-bit）× 20 s（等价 48 kHz × 2 ch × 60 B × 1 s）。
- DeckLink 音频为 48 kHz ⇒ 该块**与音频速率缓冲一致**，与视频帧尺寸不一致。
- 已记录现象：发生扩边的线程 comm = `decklinkvideosr`（decklinkvideosrc 线程）。⇒ 若该假设成立，含义是 **DeckLink SDK 在 input 对象线程上分配其音频缓冲池**，而非视频帧池。
- ⚠️ **这是假设**：必须由 §3 的 uprobe / `malloc_info` 实测确认，禁止写成 root cause 结论。

---

## 2. 为什么两条 env 缓解都被否证（且其中一条在结构上更差）

### 2.1 `MALLOC_ARENA_MAX=1`（§3.103 v3 臂）

- 只改变"用哪个 arena"，**不改变** `no_dyn_threshold` / `trim_threshold` ⇒ 棘轮照样把 `trim_threshold` 抬到 11 MiB。
- 主 arena 用 `brk`，回收门槛同样被抬到 11 MiB ⇒ 5.76 MB 粒度的 free 永远够不到 trim 触发线；且同样的周期性 churn 会碎片化主 arena。
- 实测吻合：保留型增长**转移**到主 arena `[heap]`（3.4 → 17.4 MB），总量同量级 ⇒ 机制没被消除，只是换了落点。

### 2.2 `MALLOC_MMAP_THRESHOLD_=131072`（§3.103 v3 臂）

- 显式设置 ⇒ `no_dyn_threshold = 1` ⇒ 棘轮被禁用。**但**：每个 ~5.76 MB 请求现在**强制走 mmap**，而 mmap chunk **永不参与复用** —— 每次分配都是全新零页，RSS 变成"未释放块数量"的函数，而不是"碎片化程度"的函数。
- 这正好解释了实测形态差异：从"偶发大台阶"变成"**连续上漂 + 伴随回落**"，且 full-run 平均速率 6.704 MB/h 比未缓解基线 2.237 MB/h **更差**。
- ⇒ **棘轮虽是缺陷，却是唯一让该周期性大块留在 arena（因而原则上可复用）的机制；把 mmap_threshold 压低恰好删掉了这条复用路径。**

### 2.3 结论

**真实缺陷不在 malloc 参数，而在分配纪律**：一个长期存活的 streaming 线程周期性申请一个尺寸会漂移的 ~5.76 MB 大块；在任何基于 arena 的分配器里，只要它不能保持为稳定 size class 且连续，就只能碎片化或常驻。

⇒ 因此：
- env-only 路线（任何取值组合）都**结构上**不可能修好它 —— 已被 v3/v4 两臂实测否证，且本报告解释了**为什么**会否证。
- 真正的修复点必须在**分配来源**（消除 / 复用 / 稳定化该块的 size class），而不是调 allocator。
- 约束：§3.18 明确禁止用 `malloc_trim` 掩盖；冻结 v3 plan §4 规定任何 Runtime binary 改动 ⇒ 阶梯从 2h 重来。

---

## 3. 下一刀设计（只读观测，不是 env 重试）

三个未归因项，各配一个**决定性且非侵入**的测量。三者都不改变被测行为（不同于 strace 级别的 syscall 放大）。

| 未归因项 | 决定性测量 | 结果如何分流 |
| --- | --- | --- |
| ① ~5.76 MB 块的 **SDK 内部来源** | BMD 上 `perf probe -x malloc`（glibc malloc uprobe），过滤 size ≥ 4 MiB，采调用栈 | 直接给出调用点 ⇒ 命名修复位置（BMD 有 perf，无 gdb/valgrind） |
| ② 保留的是**活内存**还是**空闲但不可回收** | `LD_PRELOAD` 轻 shim，在 `SIGUSR1` 时调用 `mallinfo2()` / `malloc_info(0, fd)`（**不改 Runtime binary**） | `uordblks` 增长 ⇒ **真泄漏**（块未释放）⇒ 修释放路径；`uordblks` 平 + `fordblks`/`hblkhd` 增长 ⇒ **保留/碎片化** ⇒ 修分配纪律 |
| ③ 台阶**触发条件**（为何落在 rel ≈6600–7150 s） | 同一 run 内把台阶时刻与逐 cycle 事件（switch / replay / lease 续约 / buffer-pool 扩容）对齐 | 定位触发源（当前**无 Runtime 源码内的 2h 级定时器**，已在 `services/media-agent/src` 全量检索 `7200 / 3600 / from_secs(>=4 位)` ⇒ 0 命中 ⇒ 触发器不在 VBMF Rust 侧） |

⚠️ 以上全部需要 BMD 访问。**当前 BMD publickey 认证失败 ⇒ 本轮无法执行。**

---

## 4. 本轮本地独立验证（可复算，已复跑）

| 项目 | 结果 |
| --- | --- |
| `python3 r64-probe/test_analyze_long_v3.py` | **20/20 PASS** —— 对 `939faf7` 的 `r64-probe/` 四个文件（`test_analyze_long_v3.py` / `analyze-long-v3.py` / `run-long-v3.sh` / `collect-long-v3.py` / `r64-stability-long.sh`）做**隔离副本**后复跑，结果与工作区一致（工作区版本亦 20/20，但其断言已被 §3.102 的 env 缓解污染，见 §6） |
| `r64-probe/` 树 `d1f5e14`（2h rung head）→ `939faf7`（main HEAD） | **无任何提交改动** ⇒ BMD 用的 analyzer 与 main 里的是同一份 |
| 冻结 plan `docs/superpowers/plans/2026-10-04-pr-stab-01-long-stability-v3.md` | 自创建提交 `d81ac61` 起**从未修改** ⇒ **contract 有效**（gate `terminal_half_rss_slope <= +1.0MB/h` 未动） |
| `analyze-long-v3.py` 回放 repo 内历史证据 | 见下表 —— **三个 STATE 引用数字全部精确复现** |

| 证据目录 | v2 判定 | v3 terminal-half slope | STATE 记载 | 一致 |
| --- | --- | --- | --- | --- |
| `r64-stability-2h` | PASS 10/10（Δ+1.1 MB） | **0.053 MB/h** | §3.96/§3.97 "+0.05MB/h" | ✅ |
| `r64-stability-8h-rerun` | PASS 10/10（Δ+27.4 MB） | **4.893 MB/h** | §3.97/§3.100 "+4.893MB/h" | ✅ |
| `r64-stability-24h` | FAIL `v2_rss_bounded`（Δ+86.6 MB） | **5.582 MB/h** | §3.92/§3.96 "+5.582MB/h" | ✅ |

⇒ §3.97 冻结阈值的**校准基线中的"已知坏样本"侧可独立复现**。
⇒ 同时复现 §3.100 的关键否证：2h 样本 `sample_span=6884 s`，**早于**首台阶（rel ≈6931 s）⇒ "好样本 ≈0.05MB/h" 实为"未触达触发器"，长时程 plateau 基线仍无支撑（**不改判、不放松阈值**）。

---

## 6. 隔离区：两处**已被实测否证**的 env 缓解改写（未提交 · 未销毁）

本轮**没有**提交、**没有**还原、**没有**删除任何一处 env 改写（避免销毁他人工作），但必须显式登记：仓库工作区中同时存在**两个**已实测 FAIL 的缓解配置，且**都不在 `main` HEAD**。

| 位置 | 改写内容 | 对应实测 | 判定 |
| --- | --- | --- | --- |
| **Development VM 工作区**（`/home/ubuntu/dev/VBMF`，未提交） | `r64-probe/run-long-v3.sh` 给 driver 前缀 `MALLOC_ARENA_MAX=1 MALLOC_MMAP_THRESHOLD_=131072`；`r64-probe/test_analyze_long_v3.py` **新增两条断言锁定该 env 存在** | §3.103 **v3 臂** = `arena1+mmap128k` → **6.541MB/h FAIL** | **已否证**，且 CI 断言会把它固化 |
| **delivery worktree**（`/home/ubuntu/orca/workspaces/VBMF/vbmf-delivery`，未提交） | `r64-probe/run-long-v3.sh` 导出 `MALLOC_MMAP_THRESHOLD_=1048576`（+ 向 `v3-runner-status.txt` 写 `alloc_mitigation=` 标记）；`ops/compose.prod.yml` 给**生产** `media-agent` 加同一 env；`ops/standalone/README.md` 写成 `/etc/vbmf/media-agent.env` 的**生产必含项** | §3.103 **v4 臂** = `mmap1M` → **6.217MB/h FAIL** | **已否证**；且生产化**超出 §3.102 明示范围**（"仅 qualification process tree、非生产部署默认"） |

### 6.1 两处共同风险：证据完整性

1. **证据可能被误标**。Development VM 工作区那处改动**没有**写 `alloc_mitigation=` 标记（delivery worktree 那处写了）⇒ 从工作区 launcher 跑出的 run **不会自证**跑在缓解配置下，而 §3.103 已证明缓解配置下同一 gate 仍 FAIL ⇒ 若被当成 rung，会产出一条"无标记、无缓解语义、且已知必 FAIL"的证据。
2. **CI 断言会固化否证结论**。工作区 `test_analyze_long_v3.py` 新增的两条 `assertIn('MALLOC_ARENA_MAX=1 MALLOC_MMAP_THRESHOLD_=131072', text)` 会让 `v3-harness-tooling` lane **要求** launcher 携带该缓解 ⇒ 只提交 launcher 或只提交测试都会造成自相矛盾；两者都提交则把已被否证的配置写进资格工具链。

### 6.2 `main` HEAD 状态

`main` HEAD（含本轮两个提交 `b52319f` / `bc4475e`）的 `r64-probe/run-long-v3.sh` **不含任何 `MALLOC` env**，且与 2h rung head `d1f5e14` **字节一致**；HEAD 的 `test_analyze_long_v3.py` **不含** `MALLOC` 断言（隔离复跑 **20/20 PASS**）⇒ **`main` 侧无污染**。

### 6.3 待 owner 裁决（不由 executor 决定）

按 §3.103 与本报告 §2，env 路线**结构上**无法修复该缺陷 ⇒ 两处改写**不应**以"缓解"名义落地；但"是否回退 / 是否仅作一次正式 FAIL rung 记录 / 是否另定"仍属 owner 级裁决（§3.103 明示）。本轮的处置仅为：**登记 + 隔离 + 不提交 + 不部署**，并在 §3.104 同步。

---

## 5. 明确不作的声称

- 本轮**无任何 BMD 实机验证**（SSH publickey 对全部本地身份被拒）⇒ 不产生 hardware evidence、不启动 rung、不重判 gate。
- §3.100 / §3.101 / §3.103 的 BMD 原始样本本轮**未独立复验**（不在 repo 内且不可达）⇒ 按"已记录、未独立验证"对待。
- **STABILITY NOT VERIFIED**；阶梯 **BLOCKED AT RUNG 1**；8h/24h **NOT STARTED**；阈值与 gate 语义**未动**；Runtime binary `3898ced3…` / manifest `7521d17e…` / protected device-2 PID `992634` 未动；RD-01A Runtime implementation 继续冻结。
