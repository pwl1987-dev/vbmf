# PR-STAB-01 — RSS 增长根因归因与 SDK 升级试验（2026-11-25）

Status: **ROOT CAUSE ATTRIBUTED / SDK 升级 16.5a1 修掉 plateau（terminal_half_slope 7.613 → 0.122 MB/h，gate PASS）/ 资格 rung 1 (2h) PASS + rung 2 (8h) PASS + rung 3 (24h) PASS（三关全 PASS）/ STABILITY VERIFIED（owner 2026-11-27 授权代笔·STATE §3.113）**

本报告记录 2026-11-24 21:00 → 2026-11-26 的完整归因链、SDK 升级与资格阶梯。所有数字均为实测，证据路径逐条标注。

---

## 0. 证据边界

| 类别 | 状态 |
| --- | --- |
| BMD 10.30.15.10 SSH | **已恢复可用**（`ssh 10.30.15.10`，lytv@，id_pwl，Tailscale 子网路由直连）；§3.104 与 current-work.yaml 的 "publickey denied" 条目为**过期状态** |
| main @ 8b68f7b 的 2h 诊断 soak | **已独立复跑**（704 张 smaps 快照，官方 analyze-long-v3.py 判定） |
| 堆级归因（heaptrack） | **已实测**（35min vs 12min diff，BMD 上真实 .heaptrack 轨迹） |
| SDK 升级 16.2a1 → 16.5a1 | **已安装并验证**（内核模块版本 16.5a1、devices=3、state=Capturing） |
| 16.5 上决定性 plateau 判定 | **已完成 PASS**（2h 诊断 soak，arm=reverify-16.5a1：plateau 0.123MB/h；live 字节 0.12MB/h） |
| 资格 rung | 2h PASS / 8h PASS / 24h PASS（§7，三关全 PASS）；诊断产物（§1–§6）一律 DIAGNOSTIC |
| **第三方独立复核** | **已完成**：不采信本 Agent 叙述的只读 verifier 独立复算 2h/8h ⇒ **6 项全 CONFIRMED**（判定 PASS、归一 `limit=` 后与归档 `gate-run.log` **逐行一致**、归档 `v3-summary.json` 原始斜率 **0.12197370 / 0.14760290** 互证、文件数 30/7json/23 可入库且 `git ls-files`=0 ⇒ 未 commit、表格零错位） |
| **冻结偏差** | **NONE**：ladder 实跑 analyzer md5 `713292b0…` 与冻结副本**字节一致**；BMD 二进制 md5 `c569aca7…` 全程未变；冻结 clone `~/main-20261124` **HEAD 仍 8b68f7b4·analyzer md5 仍 713292b0·binary md5 仍 c569aca7**（阶梯锚点零漂移）；**clone 工作树现 dirty 2 项 = WCO-01B 实机验收的 ops 运行配置**（`ops/compose.bmd-acceptance.yml` HLS ro 挂载 + `ops/nginx/default.conf` `location /hls/`），二者与仓库 main 已入库版本（`51359bf`）**sha256 逐位相同**（`a1fc31a4…`/`675c0a97…`）⇒ **非未知漂移**，判据 9「阶梯期间 Runtime source/binary 未变更」**仍成立**（收官后产生、不涉 Runtime/analyzer）；**处置 = 保留不还原**——`ops/nginx/default.conf` 是运行中 nginx 容器的 **bind mount（ro）**，原地还原会改写容器内文件、使下次 reload/recreate 丢失 `/hls/` 分发 ⇒ 破坏 WCO-01B 验收环境（STATE §3.121）；仓库内 analyzer 已参数化并提交（md5 `ec3d179e…`，默认门限 1.0 ⇒ 与冻结副本行为一致），但**不入本次证据链**（实跑仍用 BMD 冻结副本 `713292b0…`） |
| **防回归守卫** | **已落地并真机复验**：`scripts/ci/verify-decklink-runtime.sh`（地板 16.5）+ `build-bmd.sh` 接入；**fail-closed**（守卫缺失 ⇒ `exit 1`，不静默跳过）+ 绝对 `SCRIPT_DIR` 路径；VM80 **20/20**（含「模块已安装但未加载」的两级回退探测：`modinfo` / `dpkg-query`，避免只查 sysfs 把装着 16.2 的验收机放行）、真机 BMD 双分支（缺失⇒rc=1 / 存在+16.5a1⇒rc=0，**此为升级前版本的真机复验；新版（补 modinfo/dpkg-query 回退）待 24h 收官后在 BMD 上重跑**）。**CI 不覆盖 runtime**（CI 无 DeckLink runtime，真实 link/open 由 BMD 负责） |
| **提交前 CI 绿性** | **已实证**（非推断）：在 **clean-HEAD 基线**（BMD 冻结克隆 `~/main-20261124`，HEAD=8b68f7b、git 树干净）上实跑 `python3 scripts/check_arch_portability.py` ⇒ **PASS（rc=0）** ⇒ **A 组单独提交不会让 CI 变红**；同批复验 `r64-probe/test_analyze_long_v3.py` **22/22**、`py_compile`/`bash -n` 通过、`shellcheck -S warning` 对新增 `scripts/ci/*decklink-runtime*.sh` 与 `build-bmd.sh` **零告警**。**该 PASS 与 B 组源码改动无关**（HEAD 的 `Config::from_env()` 在 `bin/media-agent.rs:435/770/875/897`，全部落在该门禁块注释剥离盲区内 ⇒ 该门禁今日 PASS 与 B 组源码改动无关；盲区本身**未擅修**（修好会使 CI 因既有问题变红 ⇒ 待 owner 决策），记录在 **STATE §3.109 / §3.110**） |
| **附带修复的既有门禁死循环** | `scripts/check_docs.py` 的 Phase 0.6 **G-DOC-READY 自落地起从未跑完**（前缀剥离循环终止条件写成「t 回到原 tid」⇒ 无限循环；CI 不调用该脚本 ⇒ 长期潜伏）。已最小修复 + 新增 `scripts/test_check_docs.py` 回归测试（**5 项**，其中终止性断言走抽取出的 `collect_covered_ids()` 直接喂合成 id ⇒ **不依赖 PyYAML**，CI runner 没有 PyYAML 也不会空转）+ `v3-harness-tooling` 新增 CI 步骤；复活后暴露 **22 条既有 Phase 0.6 phase06 债**（README「8 FI」实为 10、FI-08/FI-09 无 Test Case），**逐条核对零条指向本次改动文件** ⇒ 本次文档改动不引入新门禁问题；这些既有债**未擅改**（清单与核对结论见 **STATE §3.110**） |

---

## 1. 复现：当前 main 上 RSS 台阶精确重现

证据：`~/a2-8-02i-evidence/2026-11-24-pr-stab-01-reverify-main-8b68f7b-20261124T213328/`
（704 张 smaps，binary md5=`c569aca7…`，manifest md5=`7521d17e…`）

官方判定（`--target-seconds 7200 --expected-cycles 256 --replay-every 5 --allow-missing-v3`）：

- `V2_COMPAT PASS`（10/10）
- `V3_VERDICT FAIL (fail=1 missing=3)` — 唯一 FAIL：`v3_rss_terminal_plateau terminal_half_slope=7.613MB/h steps>=4MB=4`（门限 ≤1.0MB/h）
- 其余 14 项 v3 gate PASS（HTTP p99 2.033ms / max 10.938ms、replay 51/51、watchdog max_gap 10.008s、anatomy 25.00/s、teardown 等）

台阶形态（逐段 diff，历史同脚本同口径）：

| | 历史 allocpath-v2（10-23） | 本次 reverify（11-24） |
| --- | --- | --- |
| 快照数 | 229 | 704 |
| 台阶 1 | rel 6597→6607 +5624kB | rel 6773→6784 **+5588kB** |
| 台阶 2 | rel 6910→6920 +5548kB | rel 6931→6941 **+5588kB** |
| 增长段 | 709430000000（22580→28204kB） | 7563e0000000（22580→28168kB） |
| 第二段 | 70943c000000（22580→28128kB） | 7563dc000000（22540→28128kB） |

---

## 2. 两层分解：保留（可修） vs live 增长（真泄漏）

### 2.1 保留层：glibc free 列表不归还 —— `malloc_trim` 可解（**16.2 时代测量；16.5 下收益前提已被推翻，见文末注**）

2h trim 臂（`LD_PRELOAD` 调 `malloc_trim(0)` 每 10s，DIAGNOSTIC）：

| 指标 | 基线 | trim 臂 |
| --- | --- | --- |
| RSS 平台 | ~1240–1263MB | **~800–818MB（−35%）** |
| HTTP p99 | 2.033ms | **1.910ms（无延迟代价）** |
| v3 plateau | FAIL 7.613MB/h | **仍 FAIL 6.380MB/h** |

⇒ 保留层可解，但**不是 gate 的病根**。

### 2.2 live 层：真正的慢速泄漏（mallinfo2 归因）

trim 臂稳定期（rel≥300s，1201 点采样）：

- `uordblks`（live）**+5.97MB/h**
- `fordblks`（free）**−5.97MB/h**（同步供氧）
- `arena` 预留恒定 1231MB

⇒ RSS 的残余增长 = **live 字节本身在增长**，任何分配器级手段（trim / `MALLOC_ARENA_MAX` / `MALLOC_MMAP_THRESHOLD_`）都治不了。这也解释了 §3.103 的 env 缓解为什么被否证。

---

## 3. 堆级归因：泄漏属主 = 闭源 `libDeckLinkAPI.so`

BMD 上安装 `heaptrack` 后，35min vs 12min 两次真实轨迹做 diff（`heaptrack_print -f long -d short`）：

**PEAK MEMORY CONSUMERS (diff) 榜首：**

```
1.11M peak memory consumed over 69129 calls from
operator new(unsigned long, std::nothrow_t const&)
  in /usr/lib/x86_64-linux-gnu/libstdc++.so.6
1.11M consumed over 69129 calls from:
    0x…735a5  in /lib/libDeckLinkAPI.so
    0x…84659  in /lib/libDeckLinkAPI.so
    0x…40c8b  in /lib/libDeckLinkAPI.so
    0x…a3db9  in /usr/lib/x86_64-linux-gnu/libc.so.6
```

- 69129 次 / 1380s = **50.1 次/秒** = 2 路输入 × 25fps ⇒ **每交付 1 帧泄漏 1 次**，均值 ≈16.3B/帧
- 全部栈帧在 **Blackmagic 闭源 SDK 内部**（Rust agent 与 GStreamer 插件均不在栈上）
- `libgstdecklink.so` 那条 92.16MB/6950 次的条目是**帧池抖动**（diff 中同时出现等量负项；35min 单跑峰值 489.61MB 属有界工作集），非泄漏

**Rust 侧已排除**：clock observation timeline 有界 fail-closed、事件环两级丢弃、无自定义全局分配器。

---

## 4. 隔离实验：泄漏与 VBMF 无关

纯 `gst-launch-1.0 decklinkvideosrc device-number=0/1 ! fakesink`（无 media-agent、无 Rust）：

| 版本 | 窗口 | RSS 变化 | 速率 |
| --- | --- | --- | --- |
| 16.2a1 | 1171s | +2032kB | **+6.1MB/h** |
| 16.5a1 | 1471s | +5628kB | +13.8MB/h（长平台 + 末端单次 +5624kB 台阶） |

⇒ 泄漏在 **DeckLink SDK/插件 ingest 路径**，与 agent 代码无关。

---

## 5. SDK 升级 16.2a1 → 16.5a1（已生效）

### 5.1 获取官方包（可复现路径）

BMD 官网直链全部 404/JS 渲染，最终可行路径：

1. `support-bundle.js` 里 `postSupportDownloadRequest(downloadId, formData)` → `POST /api/register/<country>/download/<downloadId>`，返回 `{url}` → `location.assign(url)`
2. 下载页（`/support/download/<readmeId>/Linux`）是 AngularJS **modal**，底部有 **"Download Only"**（免填表）
3. 浏览器点击 → `POST /api/register/us/download/010c6a33d6d54705914513986e480db8` → 下载 **`Blackmagic_Desktop_Video_Linux_16.5.tar`（2.09GB）**
4. 内含 `deb/x86_64/desktopvideo_16.5a1_amd64.deb`（263MB）

### 5.1b 上游并未披露这个修复（运维含义）

官方 readme（`/support/content/readme/972ce0d08c984008bc3b68b128ec1a62`）中 16.5 的 *What's new* **只有一行**：
`Add support for UltraStudio Express HD.`；16.3/16.4 的说明里也**没有任何内存泄漏修复字样**（16.4 = IP HD 机型 + NMOS + Cintel 修复）。

⇒ **该泄漏修复未被上游披露**。运维含义：不能依赖「装最新版就自动修好」——若某台机器装的是 16.4 或更早的 16.x，
每帧泄漏会静默回归、plateau 门禁重演失败。因此：① 必须**显式钉** Desktop Video runtime ≥ 16.5a1（§1.1）；
② 已在仓库落地守卫：`scripts/ci/verify-decklink-runtime.sh`（只读、地板 16.5）由 `services/media-agent/scripts/build-bmd.sh` 调用 ⇒ **每档 rung 开跑前先验版本**，降级主机秒失败（配套测试 **20/20** 通过·VM80 真 Linux·含 2 项行为级 fail-closed 用例与 4 项「模块已装未加载」回退探测用例；**真机 BMD 复验**：守卫缺失 ⇒ exit 1、守卫存在+真机 runtime 16.5a1 ⇒ 放行至构建）；③ 升级后必须复跑本阶梯确认，
不能只看版本号。
### 5.2 安装与验证（BMD）

- `dpkg -i desktopvideo_16.5a1_amd64.deb` → dkms 为 7.0.0-30 与 7.0.0-44 两个内核构建
- **注意**：重启后默认内核切到 **7.0.0-44-generic**，其 dkms 仍是旧 16.2a1 ⇒ 需 `dkms autoinstall -k $(uname -r)` + `update-initramfs -u` 后二次重启
- 旧模块引用计数由模块内部持有（无用户态进程），`rmmod` 不可用 ⇒ 二次重启是唯一干净路径
- 最终：`/sys/module/blackmagic/version = 16.5a1`，`dpkg -l desktopvideo = 16.5a1`，kernel 7.0.0-44-generic
- 功能验证：受保护 sink（device-2 精确命令行）恢复 PLAYING；media-agent `/health` = `devices:3, active_pipelines:3, state:Capturing`
- 运维扰动（如实记录）：受保护进程 992634 在升级窗口停止并以**完全相同命令行**重建；机器重启两次；`/tmp` 为 tmpfs，重启后清空（含本次证据临时文件，报告已归档到 `~/a2-8-02i-evidence/`）

### 5.3 16.5 泄漏表现（25min 隔离，含 mallinfo2 采样）

- RSS：**707.5MB 长平台**，全程仅 1 次 +5624kB 台阶（t=1485s）
- live：3.34 → 8.84 → 14.33MB，**离散台阶 +5.5MB/次**（t≈540s、1020s），其后停止
- arena 与 live 同步增长、free 基本不变 ⇒ live 增长未被释放
- 与 16.2 相比：泄漏**仍存在**，形态从"连续 16B/帧"变为"批量 5.5MB"；因窗口/采样方式不同，速率不可直接横比 ⇒ 以 2h soak 的官方 plateau 判定为准

---

## 6. 决定性验证结果：16.5a1 上 plateau 门禁 PASS

### 6.1 2h 诊断 soak（704 张 smaps·与 16.2 基线同数量同规格）

官方 `analyze-long-v3.py --target-seconds 7200 --expected-cycles 256 --replay-every 5 --allow-missing-v3`：

| 指标 | 16.2a1 基线 | **16.5a1** |
| --- | --- | --- |
| `v3_rss_terminal_plateau` | **FAIL** 7.613MB/h（steps 4） | **PASS 0.123MB/h（steps 3）** |
| v2 十项 | PASS | PASS |
| HTTP p99 / max | 2.033 / 10.938ms | 1.997 / 25.286ms |
| V3_VERDICT | FAIL (fail=1) | INCOMPLETE (fail=0, missing=3=诊断形态无 collector 的 sidecar 产物) |

### 6.2 live 字节独立复核（mallinfo2·agent 进程·5695s 稳定窗口）

| | 16.2a1 | **16.5a1** |
| --- | --- | --- |
| uordblks（live）斜率 | **+5.97MB/h** | **+0.12MB/h** |
| fordblks（free）斜率 | −5.97MB/h | −0.12MB/h |
| RSS | 平台 1240–1263MB + 台阶 | **恒定 1247.3→1247.4MB** |

⇒ **两套独立仪表（/proc RSS 与 glibc live 计数）都证明每帧泄漏在 16.5a1 上消失**，不是形状变化而是真增长消失。仍保留 469MB free 未归还 ⇒ 有界 trim 仍是可取的卫生措施（但不再是修复 plateau 的前提）。

### 6.3 25 分钟隔离测试的复核（前一轮结论已被本轮推翻）

隔离 run 的 live 3.34→14.33MB（离散 +5.5MB 台阶）**不是每帧泄漏，而是管线预热**（帧池 + caps 协商到达稳态）；25 分钟窗口无法区分预热与泄漏，2 小时窗口给出结论。

### 6.4 rung 工具链 smoke（120s/6-cycle）

`V3_VERDICT SMOKE_PASS_NOT_QUALIFICATION`：全部 v3 gate PASS（含 `v3_sidecar_*(coverage/http_200/topology/drop_clock_zero)`、`v3_identity_pinned source=8b68f7b binary=c569aca7…`、`v3_runtime_residue process_absent=True`、`v3_protected_device_unchanged`）；唯一容忍项为设计内的短跑 `v2_rss_bounded` 启动诊断。

### 6.5 2h 资格 rung（PASS，13:55 收官）

- EV：`~/a2-8-02i-evidence/2026-11-25-pr-stab-01-v3-2h/`
- 钉扎：`source=8b68f7b…`、binary md5 `c569aca7…`、manifest md5 `7521d17e…`、`VBMF_MACHINE_ID=10.30.15.10`
- 环境：Desktop Video **16.5a1**、kernel 7.0.0-44-generic、protected device-2 sink pid 5725（同一命令行重建）
- 推进：256 cycles × 28s ≈ 7680s，13:55 收官 ⇒ 官方判定 **V3_VERDICT PASS (fail=0 missing=0)**（明细见 §7）
- **阶梯推进**：2h PASS → 8h PASS → 24h PASS（§7，三关全 PASS）⇒ **STABILITY VERIFIED**（owner 2026-11-27 授权 Agent 代笔·STATE §3.113；commit 待 owner）

## 7. 资格阶梯结果

| 档 | 判定 | plateau 斜率 | wallclock | HTTP p99 | sidecar | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 2h | **PASS**（fail=0 missing=0） | **0.122MB/h**（≤1.0） | 7345s ≥ 7200 | 2.104ms / max 21.931ms / 3642 rows / non200=0 | 245 采样(active)·覆盖 7321s ≥ 7140s（present 246 含 warmup） | driver_rc=0 collector_rc=0；identity_pinned source=8b68f7b binary=c569aca7；runtime_residue process_absent；protected_device_unchanged |
| 8h | **PASS**（fail=0 missing=0） | **0.148MB/h** | 29321s >= 28800 | 2.056ms / max 27.052ms / 14499 rows / non200=0 | 978 采样(active)·覆盖 29315s >= 28740s（present 979 含 warmup） | driver_rc=0 collector_rc=0；identity_pinned / runtime_residue / protected_device_unchanged / teardown 全 PASS；证据已入仓 evidence/bmd-10.30.15.10/2026-11-25-pr-stab-01-v3-8h/（30 文件·7.6MB·含 gate-run.log；其中 7 个 `.json` 被 `.gitignore` 的 `evidence/**/*.json` 排除 ⇒ 实际入库 23 文件；**工作树状态 = 尚未 commit**） |
| 24h | **PASS**（fail=0 missing=0） | **0.066MB/h** | 87969s ≥ 86400s | 2.020ms / max 26.249ms / 43469 rows / non200=0 | 2932 采样(active)·覆盖 87945s ≥ 86340s（present 2933 含 warmup） | driver_rc=0 collector_rc=0；identity source=8b68f7b4·binary=c569aca7；证据 30 文件（md5s 25 条）；（收官·逐文件 sha256 零差异） |

**分析性加固（为何判定可信，而不只是一组 PASS 数字）**

1. **晚发作漂移检查**（对已入仓 8h 证据做四分窗 + 末 10% 窗口，独立重算）：
   - 8h：Q1 启动瞬态（1172→1241MB·3 台阶）→ Q2/Q3/Q4 = +0.076 / +0.156 / +0.137 MB/h 且 **≥4MB 台阶全为 0**，**末 10% 窗口斜率 +0.000MB/h**；2h 同形态（末 10% +0.035MB/h）。
   - 对照 16.2 时代：台阶在 rel **6913s / 7143s** 才冒出来（晚发作型·实测于 16.2a1 失败基线）⇒ **16.5 跑满 8h 仍零台阶、末段完全平**，泄漏未复发。
2. **wallclock 余量提前投影**（避免跑完才发现参数性失败）：实测 28.81s/cycle（与已完成的 2h 28.80 / 8h 28.80 逐位一致）⇒ 投影 24h span **87,982s vs 目标 86,400s = +1.8%**，与前两关 +2.0%/+1.8% 同比例。
3. **仓库侧可复现性**（无 BMD 访问权也能复算）：仅用仓库内分析器 + 已入仓证据目录复算 2h/8h ⇒ 判定与 BMD 侧**逐位一致**（0.122 / 0.148 MB/h，fail=0 missing=0），同时反证本地 analyzer 参数化默认行为零变化。
**冻结偏差声明**：ladder 实跑所用 analyzer 与冻结副本**字节一致**（md5 `713292b041ac6223bdc0eda21b222463`，BMD clone 与 `~/vbmf-v3` 冻结副本相同）⇒ 8h/24h 的 gate 语义与冻结计划完全一致；仓库里被参数化的 analyzer（md5 `ec3d179e…`）已提交入库，但**不进入本次阶梯证据链**——实跑仍用 BMD 冻结副本 `713292b0…`（字节未变）⇒ 本次 2h/8h/24h 判定与 STABILITY VERIFIED 绑定均不受影响。
**RSS 平台 vs 斜率的分离（跨版本对照，实测）**：把 16.2a1 失败基线（BMD `~/a2-8-02i-evidence/2026-10-22-pr-stab-01-v3-2h-20261022T232657/samples.csv`）与已入库 16.5 证据逐点对比 ⇒ **平台高度几乎相同**：16.2a1 2h 末半均值 **1241.6MB**（终半斜率 **+5.457MB/h**）；16.5a1 2h 末半 **1240.3MB**（**+0.122**）；16.5a1 8h 末半 **1241.5MB**（**+0.148**）。⇒ **泄漏贡献「持续爬升」而非「平台高度」**；约 1241MB 平台来自 SDK 帧池/工作集，与泄漏无关。**因此**：§5 中「440MB 保留可由 malloc_trim 回收（RSS 1240→800MB）」是 **16.2 时代带泄漏平台**上的测量，**在 16.5（泄漏已消除）下该可回收量是否存在属未知** ⇒ trim 候选的收益数字**不得沿用**，须重新实测。

**2h 证据分窗稳健性复核（对已入库 samples.csv 独立重算）**：四分窗切片显示唯一增长是**启动瞬态**（Q1 前 30 分钟 1131.4→1240.1MB·斜率 +22.478MB/h·3 个台阶），此后**稳态全平**（Q2 +0.078 / Q3 +0.024 / Q4 +0.247 MB/h，**≥4MB 台阶均为 0**，RSS 恒定 1240.3±0.1MB）⇒ plateau PASS 不是单一窗口的巧合；官方门禁量的是终段半窗，天然排除启动瞬态 ⇒ **8h/24h 档的余量只会更大**。16.2 时代的 rel 6773/6931 两个 +5.5MB 台阶在 16.5 上完全消失。

**证据归档**：2h rung 证据已入仓 `evidence/bmd-10.30.15.10/2026-11-25-pr-stab-01-v3-2h/`（30 个文件·2.0MB·
含 `gate-run.log`= 分析器完整文本判定，惯例同 `r64-stability-8h-rerun-gate`）；BMD 侧原件在
`~/a2-8-02i-evidence/2026-11-25-pr-stab-01-v3-2h/`。注意 `.gitignore` 的 `evidence/**/*.json` 会排除
`v3-summary.json`/`v3-identity.json`（既有规则，判定可由仓库内 analyzer 从已入库样本确定性复算；
若希望把判定 JSON 本身纳入版本库，需 owner 批准一条窄例外）。

### 7.1 24h 中途复核（rung 进行中·主动加固·历史留痕；收官后最终判定见 §7 表格）

**24h 中途复核（2026-11-26 12:13，rung 进行中·约 14.2h / 1774 cycles / 58%）**：这是收官前的**主动**加固，不是被动等待。

- **官方分析器中期判定**：以冻结 analyzer（md5 `713292b0…`）+ `--expected-cycles 3055 --allow-missing-v3` 对**运行中**的证据目录复算 ⇒ 实质门禁**全 PASS**（`v3_rss_terminal_plateau` terminal_half_slope=`**-0.616MB/h**`、`v3_http_continuity_latency` p99=2.015ms/non200=0、`v3_identity_pinned`、`v3_topology_constant`、`v3_socket_bounded`、`v3_fd_highwater`、`v3_watchdog_cadence` max_gap=10.064s、`v3_anatomy_*` 全过）。
- **10 个 FAIL 逐条归类为「尚未跑完」**，无一为实质失败：`v3_evidence_complete`(rows=1774 < 3055)、`v3_wallclock_duration`(51070s < 86400s)、`v3_replay_exact`(354/354，期望 611)、`v3_sidecar_coverage`(51039s < 86340s)、`v2_switch_*`/`v2_observed_tracks_per_command`(1774/1774，期望 3055)、`v2_watchdog_ticks_advancing`(**`ticks.txt` 由 driver 在 teardown 阶段才写**，中途必然为 0/0)、`v3_stop_session_executed`/`v3_teardown_marker`(收尾产物)。
- **分窗漂移复核（对中途 samples.csv 独立重算）**：Q1 rel 0–12733s = 启动瞬态（1162.7→1247.6MB·3 个台阶）→ Q2 +0.048 / Q3 +0.726 / Q4 **+0.028 MB/h**、**末 10% 窗口 +0.035MB/h**、ramp 后（rel>33000s）627 采样净 **-5460kB** ⇒ 与 8h 同形态，**无晚发作漂移**。
- **全程台阶谱**（n=1867·span 53749s 实测）：ramp 期（rel 29/58/87s）**+73.8/+5.3/+5.4MB**；ramp 后**仅 1 次** rel 28661s **+5.5MB**（1248.0→1253.5），并在 rel 36725s **归还 −5.5MB**（→1248.0）⇒ 成对出现后回到原位，非 16.2 时代那种只涨不回的晚发作复发模式。
- **收尾路径已预先核实**：`/tmp/vbmf-pr-stab-01-v3-24h-soak.sh` teardown 段（第 188–192 行）依次写 `stop-response.json`/`teardown-line.txt`/`ticks.txt`（`MIDPOINT=1527` 已过点），wrapper `run-long-v3.sh` 收尾再跑分析器并写 `v3-summary.json` ⇒ 上述「未跑完」FAIL 在收官时自动满足。
- **ladder 期间完整性审计**：BMD 二进制 md5 仍为 `c569aca7179b6b2638ccb5c95349a1f9`、冻结 clone `~/main-20261124` git 树干净（HEAD=8b68f7b、analyzer md5 一致）⇒ 期间无编译/改动污染证据链。
- **收官流水线已固化并演练**：`/tmp/finalize-rung.sh <rung> <target_s> <cycles>`（本地）+ `/tmp/finalize-24h-remote.sh`（BMD 侧）＝ 7 步：runner rc 校验 → 冻结 analyzer 严格判定 + `gate-run.log` → provenance 校验 → 证据归档 → **逐文件 sha256 零差异** → 三关总表 → 仓库侧复算。用**已完成的 8h 证据做等价整链演练**：产出 `gate-run.log` 与已归档版本**字节一致**（md5 `37f332322e21cacc98855e5de0eabb4f`）⇒ 24h 收官可一键执行且产物与 2h/8h 惯例同源。

**⚠️ 对 §2.1（保留层 / `malloc_trim`）的时效限定（2026-11-26 补）**：本节的「440MB 保留可由 `malloc_trim(0)` 回收（RSS 1240→800MB）」是在 **16.2a1 带泄漏的平台**上测得的。跨版本实测显示：**16.2a1 与 16.5a1 的 RSS 平台高度几乎相同**（末半均值 1241.6MB vs 1240.3MB(2h) / 1241.5MB(8h)），差别只在**斜率**（+5.457MB/h vs +0.122/+0.148MB/h）⇒ **泄漏贡献的是「持续爬升」，不是「平台高度」**；约 1241MB 的平台来自 SDK 自身帧池/工作集，与泄漏无关。⇒ **在 16.5（泄漏已消除）下，§2.1 那 440MB 可回收保留量是否存在属未知**，「trim 可把 1247 降到 800」这一收益数字**不得沿用**，须重新实测（且 trim 只是常驻内存优化，不是稳定性修复）。

阶梯环境恒定：Desktop Video **16.5a1** + kernel 7.0.0-44-generic + protected device-2 sink（同一命令行）+ manifest md5 `7521d17e…` + source `8b68f7b…` + binary md5 `c569aca7…`（每档由 driver 重跑 `build-bmd.sh` 重建后 md5 一致）。

## 8. 引用

- 报告目录：`docs/superpowers/reports/`；BMD 证据：`~/a2-8-02i-evidence/2026-11-2{4,5}-*`
- 工具：heaptrack 1.5（apt）、`r64-probe/analyze-long-v3.py`（ladder 实跑副本 md5 713292b0…，与冻结副本字节一致）、`r64-probe/test_analyze_long_v3.py`（本地 22/22 单测通过）
- **证据路径（逐档·BMD 侧）**：`~/a2-8-02i-evidence/2026-11-25-pr-stab-01-v3-{2h,8h,24h}/`；**仓库副本（工作树·尚未 commit）**：`evidence/bmd-10.30.15.10/2026-11-25-pr-stab-01-v3-{2h,8h,24h}/`（各 30 文件·7 个 .json 被 `.gitignore` 排除 ⇒ 实际可入库 23）；归因期原始轨迹：`~/a2-8-02i-evidence/2026-11-24-pr-stab-01-reverify-main-8b68f7b-20261124T213328/`、`~/a2-8-02i-evidence/2026-11-25-pr-stab-01-reverify-16.5a1-20261125T094135/`。
- **判定冻结机制（BMD 侧守夜器 v3·一次性产物·不入库）**：`/home/lytv/post-24h-recorder3.sh`（脱管运行·md5 `7d701d97…`）在 24h driver 退出后，**等 `v3-runner-status.txt` 出现（wrapper 只在 collector 退出后才写）且 `v3-summary.json` 的 mtime 更新于它（wrapper 自己的 analyzer 已重写 summary）** ⇒ 中途快照无法骗它提前抢跑；随后用冻结 analyzer（md5 713292b0·strict 口径·**脚本内硬校验，不符即 abort 且不冻结任何判定**）写 `$EV/gate-run.log`，并把判定摘要写入 `~/dv-upgrade/verdict-24h.txt` ⇒ **权威判定在跑完那一刻冻结在 BMD，不依赖控制端 Mac 是否醒着**；日志 `~/dv-upgrade/post-24h-recorder.log`。等价演练（用已完成的 8h 证据）产出 `gate-run.log` 与已归档版本字节一致（md5 `37f3323…`），且确认只读（8h `v3-summary.json` md5 未变）。收官脚本 `/tmp/finalize-rung.sh`（本地）+ `/tmp/finalize-24h-remote.sh`（BMD 侧）。
- **上游版本依据**：Blackmagic Desktop Video 官方 readme `https://www.blackmagicdesign.com/support/content/readme/972ce0d08c984008bc3b68b128ec1a62` —— 16.5 的 What is new 仅一行（Add support for UltraStudio Express HD），**未披露任何内存泄漏修复** ⇒ 故必须显式钉 runtime ≥ 16.5。

---

## 9. STABILITY VERIFIED 判据（**事前声明**·2026-11-26 13:05，早于 24h 判定）

冻结计划明写「**no post-hoc gate relaxation**」⇒ 判据必须在判定出来之前钉好。以下逐条取自权威源：`docs/superpowers/plans/2026-10-04-pr-stab-01-long-stability-v3.md` §3「Rung semantics」与「only all layers PASS → STABILITY VERIFIED」，以及 `.project/STATE.md` 的门槛条款（「2h+8h+24h 全 PASS **且绑定 exact commit/binary hash/BMD environment/hardware/scope** 后才可写」）。

| # | 判据 | 权威出处 | 就绪状态（13:05） |
| --- | --- | --- | --- |
| 1 | 2h v3 全层 PASS | plan §3 / §4-步4 | **READY**（V3_VERDICT PASS·fail=0 missing=0·plateau 0.122MB/h） |
| 2 | 8h v3 全层 PASS | plan §3 / §4-步5 | **READY**（V3_VERDICT PASS·fail=0 missing=0·plateau 0.148MB/h） |
| 3 | 24h v3 全层 PASS（最终生产稳定性证书） | plan §3「final production stability certificate」 | **READY**（V3_VERDICT PASS·fail=0 missing=0·plateau 0.066MB/h） |
| 4 | 三档绑定**同一** exact commit | plan §4「keep Runtime binary unchanged」 | **READY**（三档 source 一致 8b68f7b4） |
| 5 | 三档绑定**同一** binary hash | plan §4 | **READY**（三档 binary 一致 c569aca7） |
| 6 | 绑定 BMD environment（SDK/kernel/受保护 sink） | STATE 门槛条款 | **READY**（三档 SDK 16.5a1 + kernel 7.0.0-44-generic 一致） |
| 7 | 绑定 hardware / scope（machine + 双入 1080p25 形态） | STATE 门槛条款 / plan Layer D | **READY**（machine 10.30.15.10·受保护 sink pid 5725·devices 3·pipelines 3 三档恒定） |
| 8 | 三档工具同源（分析器未被事后改动） | plan「no post-hoc gate relaxation」 | **READY**（冻结 analyzer md5 713292b0 一致·收官实际使用副本 713292b0 一致） |
| 9 | 阶梯期间 Runtime source/binary 未变更 | plan §4 末段 | **READY（复核·11-27）**（11-26 22:34 B apply 时 porcelain=0 ⇒ 阶梯期间零变更；13:05 初判 NOT VERIFIED 的脏 2 项 = 收官后 11-27 `ops/` 验收配置·STATE §3.112 留痕；HEAD 仍 8b68f7b4…；**19:45 再核：clone dirty 2 项与仓库 main 已入库版本 sha256 逐位相同 ⇒ 等价可审计；HEAD/analyzer/binary 三锚点未动**） |
| 10 | 由 owner 落笔（Agent 不自写 STABILITY VERIFIED） | 项目纪律 | **VERIFIED**（owner 授权 Agent 代笔 2026-11-27·STATE §3.113） |

**⇒ 就绪度（收官后机械生成）**：见上表第 4 列逐行状态。若 24h 出现**任何**实质门禁 FAIL，则按本表判据 STABILITY 维持 NOT VERIFIED，且**不得**以「plateau 已过」单项推断整体通过（plan §2：`PASS 10/10 predicates v2` alone is never sufficient）。


