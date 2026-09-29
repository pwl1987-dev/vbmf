# CI Runner Strategy（自托管 GitHub Actions Runner 基础设施契约）

> **文档身份**: VBMF 自托管 CI Runner **基础设施 SoT**（Phase 1 v1.2 冻结版）。
> **生成**: 2026-09-11，基线 master `ff2c481`（`media-agent.yml` blob `5bf1c0e`）。
> **与既有 SoT 关系**: 本文件只管「Runner 基础设施层」；部署/验收分层仍以
> [`DEPLOYMENT_AND_DEV_RUNTIME.md`](DEPLOYMENT_AND_DEV_RUNTIME.md) §9（两级验收）为准。
> 本文件**不改变任何现有 CI 门禁**。
> **裁决历史**: v1.0（外部方案）→ v1.1 → v1.2 冻结（两轮评审共 17 条收紧全部并入；不再迭代 v1.3）。

---

## 0. Phase 1 定位

> 一句话：建立一台**可重复部署、可审计、可回滚、权限边界清晰**的 self-hosted Runner，
> 并证明现有 GitHub-hosted CI 完全未受影响。

**不是把现有 CI 搬到 self-hosted。** Phase 1 完成后才有资格讨论 Phase 2（General CI Migration）。

### 0.1 Phase 1 绝对不做（红线）

- ❌ 任何 job 的 `runs-on` 改造
- ❌ 7 个 CI job 重构 / 改名 / 聚合 / 删除；branch protection required contexts 不动
- ❌ BMD 盒（10.30.15.10）装 runner（Deployment §9 红线 + NET-01 出网受限）
- ❌ Runner Group 重构 / organization 级注册
- ❌ CI 测试逻辑修改；不顺手做任何「CI 优化」

---

## 1. A Baseline（2026-09-11 只读取证，冻结）

| # | 项 | 实测值 |
|---|---|---|
| A1 | master HEAD | `ff2c4816e8dfe02b23907e12092cbec691d101b9` |
| A2 | `.github/workflows/media-agent.yml` blob SHA | `5bf1c0e321bbca9bd9ba9f80596b828f2927d0e5` |
| A3 | required contexts（7，与 job `name` 严格一致） | `rust-format` / `rust-test-matrix` / `rust-clippy` / `hardware-test-compile` / `architecture-portability` / `gstreamer-build` / `session-lifecycle` |
| A4 | branch protection | strict=true（须含最新 master）；enforce_admins=false；无 PR review 强制；无 restrictions；禁 force-push / 禁删除 |
| A5 | repo self-hosted runners | total=**0**；owner_type=**User**（个人账户仓库：无 org runner-groups API → 「默认 group 实际名称」= **N/A，无 API 面**，repo 级 `actions/runner-groups` 端点实测 **HTTP 500**（2026-09-11，3 次确定性复现）；仓库级注册构造性限定于本仓库） |
| A6 | 与 PR #31 文件交集 | PR #31（head `feat/v03-standalone-product-baseline`，14 文件 = `ROADMAP.md` + `docs/architecture/V0.3/**`）与本 Phase 文件集 **零交集** |
| — | 内网代理连通（管理机实测） | HTTP CONNECT `http://10.30.5.73:8118` → api.github.com 200（1.8s）；SOCKS5 `10.30.5.73:1080` → 200（1.2s）。runner 宿主机待 B0 预检 |

> 归因纪律：此后任何 CI 变化，按本表回答「Runner Phase 1 引入还是仓库原存」，不靠记忆判断。

---

## 2. 三层 CI 架构（目标态）

```
                         VBMF CI
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          GATE-A          GATE-B        GATE-C
        Software CI       Media CI     Hardware
             │              │        (Acceptance Line)
        rust-format      hardware-    DeckLink / BMD
        rust-clippy      test-compile  真实 SDI / 设备租约
        rust-test-       gstreamer-
        matrix ...       build ...
             │              │              │
        vbmf-general    vbmf-media    不进普通 PR CI
```

- **GATE-C 是 Acceptance Line，不是普通 PR Line**（与 Deployment §9 一致：实机验收走
  Remote BMD 人工 SSH + pinned SHA + evidence；不建议 CI 直接驱动硬件验收）。
- Phase 1 只建 `vbmf-ci-01`（General）。`vbmf-ci-02` / `vbmf-ci-media` 复用同一 runbook。

| Runner | 标签（exact set） | 职责 |
|---|---|---|
| `vbmf-ci-01` | `self-hosted, Linux, X64, vbmf, vbmf-general` | Rust format/clippy/test、architecture tests、docs/contract |
| `vbmf-ci-02`（未来） | 同上 | 并发 PR / 回归 / 长测试 |
| `vbmf-ci-media`（未来） | `self-hosted, Linux, X64, vbmf, vbmf-media` | FFmpeg/GStreamer/libclang/protobuf/SDK 头编译链 |

标签命名纪律：用**能力**（`vbmf-general`），不用机器名（`server01`）。
（Phase 2 上线阶梯与终态拓扑见 §15。）

---

## 3. Runner Identity & Label Contract（CI-RUNNER-LABEL-01）

- `config.sh --labels` 只追加**自定义**标签（如 `vbmf,vbmf-general`）；`self-hosted / Linux / X64`
  由注册过程产生——**只验证、不假设**（平台标签服务端规范大小写为首字母大写，
  C 阶段 2026-09-11 实测；`runs-on` 匹配大小写不敏感，workflow 中仍用小写）。
- 验收用**集合精确相等**（排序后逐字符比较），禁止 contains 式检查：

```text
expected(vbmf-ci-01) = { self-hosted, Linux, X64, vbmf, vbmf-general }
```

- 实现：`scripts/ci/verify-runner.sh`（R2/R5）。

## 4. Repository Scope Contract（CI-RUNNER-SCOPE-01）

- 只注册为 **`pwl1987-dev/vbmf` 仓库级** runner；不做 organization-wide。
- A5 实测：owner_type=User → 无 org runner 概念，scope=本仓库（构造性保证 + API 回读双证）；
  未来若迁移到 org，必须另立 Runner Group 契约评审。
- （2026-09-29 REPO-MIGRATION-01 事实登记：仓库已正式 transfer 至 org `pwl1987-dev/vbmf`；
  transfer 保留 repo identity，三台 runner 保持 repo 级注册且未引入 org-wide/Runner Group，
  本 scope 契约不变，API 回读已复核。）
- **公共仓安全边界表述（CI-RUNNER-SEC-02）**：Phase 1 **不授予不可信 fork PR 调度
  self-hosted runner 的路径**——本阶段不修改任何 PR/push workflow 的 `runs-on`；唯一引用
  新标签的 workflow 为 `ci-infra-probe.yml`，仅 `workflow_dispatch`（fork PR 无法触发）。
  不写「天然不可达」——只声明明确建立的控制边界，不依赖 GitHub 行为推导安全。
  Phase 2 迁移前必须另行裁决双通道（fork PR 留 GitHub-hosted）。

## 5. 网络与代理契约（CI-RUNNER-NET-01）

环境事实（内网代理，2026-09-11 管理机实测，见 §1）：

```text
HTTP CONNECT 代理: http://10.30.5.73:8118   # Actions Runner 唯一可用的代理类型
SOCKS5 代理:      10.30.5.73:1080          # 仅 ssh 等工具用；Runner 不支持 SOCKS
```

规则：

1. **B0 连通性预检**：在 runner 宿主机先测直连 `https://api.github.com/` 与
   `https://codeload.github.com/`；单次直连成功不足以推翻已复现的故障窗。
2. **codeload 主缓解（CI-RUNNER-SEC-01 v2）**：所有 self-hosted runner 必须配置
   `ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE`，缓存目录由 runner 用户独占（0700），archive
   按 GitHub Runner 官方键 `<owner_repo>/<resolved_sha>.tar.gz` 存放；workflow 中外部
   Action 必须 pin immutable SHA，使 cache key 可审计、可预热、不会因 tag 漂移失效。
3. **代理只作 fallback**：允许应用目录 `.env` 使用 credential-free loopback HTTP proxy，
   仅可指向 `127.0.0.1:<port>` / `localhost:<port>`；禁止 LAN 地址、凭据或公网代理直接
   写入 `.env`，禁止 workflow env 注入代理。KVM guest 若需 fallback，先 host-local
   forward；systemd unit 仍不写 proxy `Environment=`。
4. provisioning 下载（runner tarball / rustup /任何直连 GitHub 的 curl）可经
   `VBMF_CI_PROXY` env 按命令传入；**脚本不硬编码代理地址**。
5. probe 必须验证 action archive cache 路径与固定 SHA archives；proxy 允许 ABSENT 或
   严格 loopback managed 模式，任何非 loopback、带凭据、`all_proxy` 或大小写值漂移
   均 fail-closed。

## 6. 目录布局（冻结）

```
/data/actions-runners/vbmf/
├── packages/            # runner 安装包 + .sha256 记录（可复用，跨 runner 实例共享）
├── runners/
│   └── vbmf-ci-01/      # 实例（config.sh 装于此；_work/ _tool/ 由 runner 自建）
└── manifests/
    └── vbmf-ci-01/      # toolchain.yaml / toolchain.txt（环境证据，零 secret）
```

manifest 不放 `_work` 内；`packages` 与 `runners` 分离（同一包可配多实例）。

## 7. systemd 生命周期契约（CI-RUNNER-SYSTEMD-01）

- 进程生命周期**唯一归属**：`actions-runner-vbmf@<name>.service` 模板
  （本仓库 `scripts/ci/actions-runner-vbmf@.service`）。
- **`provision-runner.sh` 不执行 `svc.sh install`**——避免「自建模板」与「svc.sh 生成
  service」两套生命周期语义并存。
- 模板冻结参数：`Restart=always` / `RestartSec=5` / `KillMode=process` /
  `KillSignal=SIGINT` / `TimeoutStopSec=10min` / 固定 `HOME`·`LANG`·`WorkingDirectory` /
  `RUNNER_MANUALLY_TRAP_SIG=1`（优雅停机必需，见单元内注释；F 演习实测缺它会
  死锁到 SIGKILL）/ **无任何 proxy 环境变量**。
- 安装 service 文件前必须 `diff`，不静默覆盖已修改的配置。

## 8. Provision 契约（CI-RUNNER-PROV-01）

- **fail-closed**：目标目录已存在 `.runner` → 明确 FAIL（默认非幂等、非破坏性）。
- **`--reinstall` 防误删链**（缺一不可）：
  1. 显式 `--name`；目标目录必须在 `/data/actions-runners/vbmf/runners/<name>` 下；
  2. 本地 `.runner` 的 `agentName` 与目标名匹配（本地归属证明）；
  3. `RUNNER_TOKEN` 非空；
  4. 停止对应 systemd instance；
  5. `config.sh remove`——repo 级 registration token 本身即服务端归属/删除证明；
  6. （宿主机有 gh 且已 auth 则 API 确认 absent；否则由管理机 `verify-runner.sh` 事后确认）；
  7. 以上全过 → 才删目录并重新 provision。
  **绝不「删目录然后重装」。**
- Token 纪律：只读环境变量 `RUNNER_TOKEN`；脚本拒绝回显；绝不写入仓库/文档/日志。
  历史上在聊天中出现过的 registration token 一律视为已烧毁（约 1h 有效期）。

## 9. 验收：双 Gate + A→F

### Runner Gate（R）

| # | 检查 | 实现 |
|---|---|---|
| R1 | 注册成功（API 可见） | `verify-runner.sh` |
| R2 | identity exact（name 逐字符） | 同上 |
| R3 | status=online | 同上 |
| R4 | busy=false | 同上 |
| R5 | labels 集合精确相等 | 同上 |
| R6 | probe PASS | `ci-infra-probe.yml` |

### No-Regression Gate（N)

Phase 1 初建时 N1/N3 以 A2 workflow blob 不变证明“未迁 `runs-on`”。P2-B 已按计划**有意修改** workflow，
因此从 Phase 2 起 `verify-runner.sh --no-regression` 改为验证不会随合法 workflow 演进失效的安全不变量：

| # | 检查 | 实现 |
|---|---|---|
| N1 | repository canonical/default branch = `main` | `verify-runner.sh --no-regression` |
| N2 | 7 required contexts exact set 不变 | 同上 |
| N3 | `main` protection: strict=true / force-push=false / deletion=false | 同上 |
| N4 | 当前 exact HEAD required checks 全绿 | `gh run` / `gh pr checks` |

Phase 1 的 A2 blob SHA 仍保留为历史 baseline evidence，不再作为 Phase 2 的可变 workflow gate。

```text
**RUNNER READY + SAFETY NO-REGRESSION = PHASE-2 MIGRATION READY**
```

### Gate 链（A→F）

```
A Baseline（已完成，§1）
 ↓
B Runner Build（宿主机：apt 基线 + rustup + 包下载 sha256 + config + systemd enable）
 ↓
C Runner Identity（verify-runner.sh：R1-R5 + scope）
 ↓
D Infrastructure Probe（ci-infra-probe.yml：R6，只读）
 ↓
E No Regression（N1-N4）
 ↓
F Rollback Drill（双次独立部署证据，见 §12）
 ↓
VBMF CI RUNNER PHASE-1 READY
```

## 10. job→runner 映射与迁移风险（Phase 2/3 输入，本阶段仅记录不执行）

| Job（required context） | 目标层 | 说明 |
|---|---|---|
| rust-format / rust-clippy / rust-test-matrix / session-lifecycle / architecture-portability | `vbmf-general` | 纯 Rust+Python3 |
| hardware-test-compile / gstreamer-build | `vbmf-media` | 需 libclang / GStreamer dev / protobuf / DeckLink SDK 头（host 预装，§15.3 裁决 B） |

迁移风险清单（Phase 2 评审输入）：

1. **SDK 残留**：`.github/_private` 仅靠 `if: always()` 末步 `rm -rf` 清理；持久 runner 上
   被杀 job 可能遗留头文件 → 迁移时需 pre-run 清理或 workspace 隔离策略。
2. **sudo apt**：两 job 每次安装系统包 → media 机预装后可去 sudo 依赖。
3. **无 timeout-minutes**：任何 job 都没有；单 runner 上挂死 job 会无限占机 → 迁移前必加。
4. **队列串行**：7 job 现在并行跑在 GitHub-hosted；单 runner 会串行化（且 push+PR 双触发
   无 concurrency 组）→ 需 ≥2 台或 concurrency 配置。
5. **target/ 共享**：持久 workspace 下多 job 共写 `services/media-agent/target`，cache
   restore/savechurn + 未缓存 job 同目录 → 磁盘与锁竞争，需 hygiene 方案。
6. **fork PR secrets**：现 `env.X != ''` 门控已优雅跳过 SDK 步骤；行为可平移，但公共仓
   双通道必须先裁决（§4）。
7. **toolchain 漂移**：`dtolnay/rust-toolchain@stable` 是滚动 stable（已发生过 CI rustfmt
   与盒上 1.9.0 版本差事件）→ 迁移时决定 pin 策略。
8. **工具链对 job 的可见性**：B0 的 rustup 装在 root `HOME`；Phase 1 job env 为
   `HOME=runners/<name>` + 最小 PATH，probe 中 `rustc/cargo` MISSING 属**预期**而非缺陷。
   工具链对 job 的 PATH/HOME 契约（系统级 `/usr/local` vs unit PATH vs runner 用户
   rustup）在 Phase 2 迁移评审中裁决。

## 11. 只读探针红线（CI-RUNNER-PROBE-01）

`ci-infra-probe.yml` **硬红线**：

```text
不安装软件 · 不修改系统 · 不访问 secrets · 不写仓库 · 不上传 artifact · 不执行 sudo
```

仅允许输出：identity / filesystem / workspace / TMPDIR / CPU-OS-arch / 工具路径与版本
（+ job env 代理变量取证）。目的：防止 probe 将来演化成「隐藏的 provisioning workflow」。

## 12. Rollback 契约（CI-RUNNER-ROLLBACK-01）

```bash
sudo systemctl stop actions-runner-vbmf@vbmf-ci-01
cd /data/actions-runners/vbmf/runners/vbmf-ci-01
sudo -u vbmf-ci env RUNNER_TOKEN="$RUNNER_TOKEN" ./config.sh remove --token "$RUNNER_TOKEN"
unset RUNNER_TOKEN
sudo rm -rf /data/actions-runners/vbmf/runners/vbmf-ci-01
```

- token 经 env 展开，字面量不进 shell history。
- 删除是否成功以 **API 服务端 absent** 为准（管理机 `verify-runner.sh`），非本地目录删除。
- GitHub-hosted CI 全程保留：**CI 基础设施失败不阻塞 VBMF 软件开发**。

### F Gate = 双次独立部署证据

> 第一次部署成功 + 完整卸载成功（remove → API absent）+ **第二次独立部署成功**
> （重新下载/sha256 校验/config/systemd/online/labels exact/probe 复跑）。

证明的是「runbook 可重复部署」，不是「这台机器偶然配置成功」。

## 13. Runbook（B→F，宿主机执行；命令逐条贴、输出回贴管理机核对）

### B0 前置预检（root）

```bash
# 网络预检：先直连，通则全程零代理
curl -sS -m 10 -o /dev/null -w 'direct=%{http_code}\n' https://api.github.com/ || true
# 直连不通才设（仅本 shell 会话，用于下载；runner 代理见 B4）
# export VBMF_CI_PROXY=http://10.30.5.73:8118
# curl -sS -m 10 --proxy "$VBMF_CI_PROXY" -o /dev/null -w 'proxy=%{http_code}\n' https://api.github.com/

# apt 基线（内网源或直连；缺啥补啥）
sudo apt-get update
sudo apt-get install -y git curl jq python3 build-essential pkg-config libclang-dev unzip tar

# rustup stable（General CI 基线；直连不通则前置 https_proxy="$VBMF_CI_PROXY"）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
source "$HOME/.cargo/env" && rustc --version && cargo --version
```

### B1-B3 Provision + systemd（root，仓库脚本）

```bash
git clone https://github.com/pwl1987-dev/vbmf /tmp/vbmf-repo && cd /tmp/vbmf-repo/scripts/ci

# 生成 fresh registration token 后（GitHub → Settings → Actions → Runners → New self-hosted runner）
export RUNNER_TOKEN=<fresh-token>          # 只经 env，不进任何文件

sudo --preserve-env=RUNNER_TOKEN ./provision-runner.sh --name vbmf-ci-01 --labels vbmf,vbmf-general
#   （B0 实测：本宿主机 sudo 忽略 -E；--preserve-env=RUNNER_TOKEN 为唯一可用传递方式，token 纯经 env、不进 argv）
#   直连不通时追加: --runner-proxy http://10.30.5.73:8118   （瞬态 env → runner 自持久化）

# systemd（先 diff 再安装，不静默覆盖）
diff /etc/systemd/system/actions-runner-vbmf@.service ./actions-runner-vbmf@.service || true
sudo cp ./actions-runner-vbmf@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now actions-runner-vbmf@vbmf-ci-01

sudo -u vbmf-ci ./collect-toolchain.sh --name vbmf-ci-01   # manifests 落盘
unset RUNNER_TOKEN
```

### C/D/E 验证（管理机，只读）

```bash
scripts/ci/verify-runner.sh --name vbmf-ci-01                       # R1-R5 + scope
gh workflow run ci-infra-probe.yml --ref main                       # R6（dispatch-only；canonical branch = main）
gh pr checks <PR#>                                                  # N4
scripts/ci/verify-runner.sh --name vbmf-ci-01 --no-regression       # N1/N2/N3
```

### F Rollback Drill（宿主机 + 管理机）

按 §12 执行完整卸载 → `verify-runner.sh` 确认 absent → **清除 packages 缓存（落实 F Gate「重新下载」）** → 重跑 B1-B3 + C/D（第二次独立部署）：

```bash
# 必须让 root 展开 glob：BASE_DIR 750 root:vbmf-ci，管理员 shell 无法穿越，
# 直接 sudo rm -f '<字面量>*' 会静默 no-op（F 演习实测踩坑）
sudo bash -c 'rm -f /data/actions-runners/vbmf/packages/actions-runner-linux-x64-*.tar.gz /data/actions-runners/vbmf/packages/actions-runner-linux-x64-*.tar.gz.sha256'
```

---

## 14. 交付物清单（本 Phase）

| 文件 | 角色 |
|---|---|
| `docs/architecture/CI_RUNNER_STRATEGY.md` | 本文件（SoT） |
| `scripts/ci/provision-runner.sh` | fail-closed provision + 安全 `--reinstall`（CI-RUNNER-PROV-01） |
| `scripts/ci/verify-runner.sh` | R1-R5 + scope + `--no-regression`（N1/N2） |
| `scripts/ci/actions-runner-vbmf@.service` | systemd 模板（CI-RUNNER-SYSTEMD-01） |
| `scripts/ci/collect-toolchain.sh` | manifests YAML+TXT（零 secret） |
| `.github/workflows/ci-infra-probe.yml` | 只读探针（CI-RUNNER-PROBE-01） |

---

## 15. Phase 2 规划输入（2026-09-11 裁决；实施前仍须开工评审）

> 本节冻结 Phase 2 的**拓扑、阶梯与门槛设计**。任何 `runs-on`/workflow 改动仍受
> §0.1 红线约束，并按本节阶梯逐级评审放行（每级一 PR、全绿才下一级）。

### 15.1 终态拓扑（3 台；BMD 实机不入 CI）

| Runner | 标签（exact set） | 职责 | 状态 |
|---|---|---|---|
| `vbmf-ci-01` | `self-hosted,Linux,X64,vbmf,vbmf-general` | General CI | ✅ 在役（Phase 1） |
| `vbmf-ci-02` | 同上（parity 通过并轨后） | General 并发 / 维护冗余 / A-B parity / 滚动升级 | ✅ 在役（P2-A 并轨） |
| `vbmf-ci-media` | `self-hosted,Linux,X64,vbmf,vbmf-media` | hardware-test-compile / gstreamer-build（目标载体） | ✅ 在役（P2-M1/P2-M2 两 job 实跑） |
| BMD 实机 | `hardware-acceptance`（永不写入任何 workflow） | 真硬件验收 | 🔴 永走 §9 人工线（GATE-C） |

- 命名沿用 §2 冻结表（tier 语义归标签，机器名不承载路由）。
- 上线顺序：`vbmf-ci-02`（先 parity）→ 并轨 `vbmf-general` → `vbmf-ci-media`
  （先 capability build，**不接现有 CI**）→ Phase 2 尾段才迁移 media 两 job。

### 15.2 灰度阶梯

```text
P2-A 双机 parity     vbmf-ci-02 以临时标签 vbmf-parity-b 上线；
                     manifest 与 01 逐项对比；工具链 pin 策略裁决（§10 #7）；
                     并轨 vbmf-general 前 parity 差异必须为零或已裁决
P2-B 安全/调度边界   fork PR 双通道裁决（§4 SEC-02 强制：fork 留 GitHub-hosted）；
                     concurrency 组（§10 #4）；timeout-minutes 补齐（§10 #3）
P2-C rust-format     单 job 灰度（最便宜最先）
P2-D/P2-E           clippy → session-lifecycle → 双机稳定性观察
                     → architecture-portability → rust-test-matrix（最重最后）
P2-M media 迁移      hardware-test-compile + gstreamer-build（前置：SDK 模式裁决）
```

- 双机同标签后 GitHub 派发**非确定**——parity 对比期必须用区分标签定向验证。
- 并轨纪律：两台工具链未 parity 前，禁挂同一调度标签（防「01 过 02 挂」间歇失败）。

### 15.3 media 主机能力规格（capability spec，非安装清单）

Ubuntu x64 · GStreamer 1.22+ · FFmpeg · libclang · protobuf-compiler ·
DeckLink SDK（模式待裁决）·（仅实机验收场景：BMD Desktop Video +
`/dev/blackmagic`，不进本 CI 面）。

**SDK 注入模式裁决（P2-M0，2026-09-16，已裁决 B——二选一，禁止混用）**：

- **已裁决：B. media 主机预装 + 版本锁定**（Acceptance Manifest 式记录）——
  去 secret 化。DeckLink SDK 头文件经 §15.9 out-of-band 通道预装到 media
  runner，版本锁定（`16.0.0`）+ verify gate + manifest 记录，与系统 Rust pin
  同构。
- 裁决理由：
  1. 去 secret 化——public repo + self-hosted runner + secrets 是 GitHub 官方
     劝退组合，B 消除该面；
  2. 专有头文件彻底离开 GitHub 存储，license 风险面缩小；
  3. 与已验证的 §15.9 runbook + verify + manifest 治理面同构，可审计可重复；
  4. 消除 30KB secret 分片 hack（GitHub secret 大小限制催生的补丁）；
  5. 系统依赖（libclang / GStreamer dev / protobuf）因 `vbmf-ci` 零 sudo 红线
     本就必须 host 预装——SDK 预装属同一供给面，非额外负担。
- 隐含义务（P2-M1 前执行）：
  1. `vbmf-media` tier 供给 runbook 扩展：SDK pin/verify/collect 同构脚本 +
     系统库清单（已落 §15.10）；
  2. workflow 删除 `DECKLINK_SDK_HEADERS_1/2` 注入与 `_private` 组装/清理
     步骤，改宿主路径存在性门控（fork/GitHub-hosted 路径维持现状空过语义）；
     GitHub secrets 中 SDK 分片在 P2-M1 收口时删除；
  3. SDK 升级走 host-admin runbook（罕见事件）。
- A（维持 secrets 分片注入）未采纳：保留 public repo + self-hosted + secrets
  组合的安全面；分片 hack 长期背负；与 host 预装供给面重复。
- 过渡期口径：P2-M1 实施前，workflow 现状 secrets 注入仍为唯一活通道；本裁决
  记录迁移序列，不构成混用。

### 15.4 供给与 inventory 纪律

- 供给复用本 runbook（`--name/--labels` 任意扩展）；**media 基线脚本须在实机
  存在时编写并实测后才可入 runbook**（Phase 1 教训 #37/#38：未经实机检验的
  步骤必然腐烂）。
- 任何新 runner 并入调度标签前：collect-toolchain manifest 落盘 + probe 实测 +
  双 Gate（R/N）复跑通过。
- **部署形态**（2026-09-11 实测裁决）：`vbmf-ci-02` / `vbmf-ci-media` 以 devbox
  KVM VM 落地（libvirtd active / 32C·92G·168G 余量充足，由 CI 侧自助供给，
  不触碰宿主机既有 VM）。**同宿主机故障域**：满足维护冗余/滚动升级/并发/parity
  四项诉求；物理级故障冗余留待真机替换时重评。

### 15.5 P2-A 执行记录（2026-09-11，已完成并轨）

- **`vbmf-ci-02` 上线**：KVM VM（Ubuntu 26.04 LTS / 8C·16G·100G qcow2 overlay，
  `virsh autostart` 已开），同 runbook 供给；probe 定向实测（PR #40 的 tier
  choice 白名单输入）先后验证 `vbmf-parity-b` 与并轨后 `vbmf-general`。
- **parity 结论**：被测 6 工具（git 2.53.0 / python3 3.14.4 / pkg-config 2.5.1 /
  curl 8.18.0 / rustc=null / cargo=null）**逐字符一致**；差异 4 项全数裁决：
  hostname（机器身份）、OS 点版本字符串（26.04.1 vs 26.04，包版本已证同）、
  内核小版本（-27 vs -30，Rust CI 无内核依赖）、CPU 呈现（QEMU 透传同物理 CPU）。
- **工具链 pin 决议（P2-C 前必须执行）**：两台当前 rustc/cargo 均不在 job PATH
  （§10 #8 预期）。P2-C 灰度前两台**对称**做系统级 pin 安装
  （`RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo`，pin 具体版本，
  symlink `/usr/local/bin`），禁止只改一台。
- **个人账户 API 面缺失 +2（实测）**：`PATCH /actions/runners/{id}` 改标签 404 →
  **改标签的正路 = remove + 重注册**（02 并轨即此法，包缓存按设计复用）；
  此前已知 repo 级 runner-groups 端点 500（§1 A5）。
- **VM 网络事实（运维口径）**：runner 协议 GitHub **直连可用**（runtime 零代理）；
  大文件（云镜像/rustup/大仓 clone）直连吞吐差或不稳 → 下载走 `VBMF_CI_PROXY`
  （8118），apt 用 `mirrors.aliyun.com`（与宿主机一致），大仓 clone 走宿主
  `git bundle` → scp LAN 通道。
- **当前双机状态**：`vbmf-ci-01`（宿主机）+ `vbmf-ci-02`（VM）同标签集
  `{self-hosted,Linux,X64,vbmf,vbmf-general}`，R 门双 PASS，dispatch 随机派发正常。
  **下一步 = P2-B**（fork 双通道/concurrency/timeout 裁决），任何 `runs-on` 改造
  仍须其放行。

### 15.6 P2-B 安全 / 调度边界（2026-09-15）

P2-B 冻结以下规则；本级**不修改任何 job 的 `runs-on`**，第一次 self-hosted 灰度仍归 P2-C：

- **fork PR 双通道**：来自 fork 的 `pull_request` 代码永远留在 GitHub-hosted；禁止用
  `pull_request_target` checkout/执行 PR 代码。P2-C 起，只有 canonical `main` push 与同仓 PR
  才可逐 job 进入 `vbmf-general`。迁移时保持原 job id/name，required context 不改名。
- **concurrency**：`media-agent-${{ github.event.pull_request.number || github.ref }}`，
  `cancel-in-progress: true`；同一 PR / 同一 ref 的旧 run 可取消，避免过期队列占用 runner。
- **timeout**：按 2026-09-11～14 最近成功 run（各 job 约 5～96s）留足冷缓存/网络余量：
  `rust-format=10m`；`architecture-portability/rust-clippy/session-lifecycle=20m`；
  `rust-test-matrix/hardware-test-compile/gstreamer-build=30m`。超时必须显式失败，不无限占用 runner。
- **token 权限**：workflow 顶层 `permissions: contents: read`；当前 jobs 无写仓库需求。
- **branch authority**：push 仅 `main`；Phase 1 历史 baseline 中的 `master` 文字保留为历史证据，
  操作性 runbook 已统一 `--ref main`。
- **required-check identity**：继续固定 7 个名称：`rust-format`、`rust-test-matrix`、
  `rust-clippy`、`hardware-test-compile`、`architecture-portability`、`gstreamer-build`、
  `session-lifecycle`。P2-C/P2-D/P2-E/P2-M 迁移不得通过新增替代 job 改变这些 context。

### 15.7 P2-C system Rust pin maintenance contract

P2-C 在迁 `rust-format` 前，先把两台 `vbmf-general` runner 的 Rust 从“job 不可见 + rolling stable”
收敛为同一 system-level exact pin。当前 pin = **Rust 1.98.1**（与 P2-B GitHub-hosted
`rust-format` run `34920528957` 的实际 stable 版本一致）。

- 实现：`scripts/ci/pin-system-rust.sh`；root-only、幂等、只接受 `x.y.z` exact version；
  固定 `RUSTUP_HOME=/usr/local/rustup`、`CARGO_HOME=/usr/local/cargo`，并只把
  `rustup/rustc/cargo/rustfmt` 暴露到 `/usr/local/bin`。
- 执行入口裁决（2026-09-15，由 §15.8 覆盖）：原拟的 GitHub Actions maintenance
  workflow（`.github/workflows/ci-runner-rust-pin.yml`）经真实 runner 验证后**已撤回，
  不存在也不再是执行入口**。CI-root 维护路径被明确否决：`vbmf-ci` 保持无 sudo/root。
  唯一现行执行平面是 §15.9 的 out-of-band host-admin runbook（管理员以 root 在宿主机
  直接执行 `scripts/ci/pin-system-rust.sh`）。
- provisioning 下载可按 §5 以 `VBMF_CI_PROXY` 形式按命令传给 pin 脚本；不设置
  runner runtime proxy，不把 proxy 写入 systemd / runner `.env`。
- 完成后必须重新跑 `ci-infra-probe.yml`，两机均证明 `/usr/local/bin` 下 exact Rust parity，
  再允许修改 `media-agent.yml` 的 `rust-format.runs-on`。

### 15.8 P2-C provisioning plane reconciliation（2026-09-15）

§15.7 的 GitHub Actions maintenance 入口经真实 runner 验证后撤回；本节**覆盖其“workflow 作为执行入口”的表述**，system Rust pin 的版本/路径契约仍保留。

Evidence：maintenance run `34921727757` 同时命中 `vbmf-ci-01` / `vbmf-ci-02`；两机 exact-SHA 小脚本下载和 identity 均 PASS，但 `sudo -n true` 均 fail，且 `Pin system Rust 1.98.1` step 均 skipped。因此没有发生任何 system mutation。

裁决：

- `vbmf-ci` service account 保持无通用 sudo/root 权限；**禁止**为了 P2-C 给 CI runner 放开通用 sudo。
- `.github/workflows/ci-runner-rust-pin.yml` 从 canonical `main` 撤回；临时 repository variable `VBMF_CI_PROXY` 同步删除。
- `scripts/ci/pin-system-rust.sh` 保留为宿主机管理员工具；由现有 out-of-band host-admin/runbook 通道在两台 runner 主机上以 root 执行 exact `1.98.1` pin。
- 执行后必须刷新 manifest，并用只读 `ci-infra-probe.yml` 分别命中两机证明 `/usr/local/bin` 的 Rust parity；在此之前 P2-C 不得迁 `rust-format.runs-on`。

### 15.9 P2-C out-of-band host-admin pin runbook（2026-09-15）

本节是 §15.8 裁决的执行细则：管理员如何在两台 general runner 宿主机上对称完成
exact Rust `1.98.1` system pin，并在不授予 `vbmf-ci` 任何 sudo/root 的前提下留下
可审计证据。所有宿主机步骤经既有 out-of-band host-admin 通道执行（不写 SSH 主机
地址/凭据；代理按 §5 经 `VBMF_CI_PROXY` 引用，值由管理员自持）。

**证据安全前提：runner 宿主机不假设存在任何可用 Git checkout。** 脚本不从宿主机
workspace 做 git fetch/checkout/worktree；三份所需脚本（`pin-system-rust.sh`、
`verify-system-rust.sh`、`collect-toolchain.sh`）改为在 Development VM / 控制机上
从 coordinator 核准的 exact canonical `main` SHA 打成隔离 bundle，经既有 out-of-band
host-admin 通道传输，宿主机只使用 bundle 内容。

**步骤 A —— Development VM / 控制机上准备 bundle（一次性）：**

```bash
# 0) SHA 必须先由 coordinator 确认为 canonical main 的当前 tip；不得自行取 tip
git -C /path/to/VBMF fetch origin main
PIN_SHA="<coordinator-confirmed-exact-sha>"          # 记录进 evidence
BUNDLE_DIR="$(mktemp -d /tmp/vbmf-pin-bundle.XXXXXX)"   # 安全创建的空目录，直接交给 helper
/path/to/VBMF/scripts/ci/prepare-system-rust-bundle.sh \
  --repo /path/to/VBMF --sha "$PIN_SHA" --out "$BUNDLE_DIR"
# helper（scripts/ci/prepare-system-rust-bundle.sh）只接受 full 40-hex exact SHA
# （拒绝 HEAD/main/前缀等 floating ref），校验 SHA 在本仓库解析为 commit 且三份
# 脚本在该 commit 均存在，导出 byte-exact 脚本 + 确定性 SHA256SUMS，并打印
# BUNDLE_SOURCE_SHA / BUNDLE_DIR；自身零网络、无 sudo、不 fetch。
# 把打印出的 BUNDLE_SOURCE_SHA 与 SHA256SUMS 内容一并记录为 evidence；bundle
# 随后经 out-of-band host-admin 通道传到两台 runner 宿主机的隔离目录
# （如 /tmp/vbmf-pin-bundle/）
```

**步骤 B —— 对每台 runner 宿主机（`vbmf-ci-01` 与 `vbmf-ci-02` 各一次，顺序不限）执行：**

```bash
# 1) 只使用已传输的 bundle；不在宿主机执行任何 git/fetch/checkout/worktree，
#    不触碰任何未知 host workspace
BUNDLE_DIR=/tmp/vbmf-pin-bundle
(cd "$BUNDLE_DIR" && sha256sum -c SHA256SUMS)   # 任一 mismatch 立即停止
PIN_DIR="$BUNDLE_DIR"                           # evidence 关联步骤 A 的 $PIN_SHA

# 2) pin 前只读基线（非 root；当前应为 FAIL：rustc/cargo MISSING）
"$PIN_DIR/verify-system-rust.sh" --expect-version 1.98.1

# 3) root pin（不用 sudo -i / 登录 root shell；proxy 若需要只经 sudo env 按命令传给
#    pin 脚本，绝不 export 进 root 会话、不写入 systemd / runner env；见 §5）
sudo "$PIN_DIR/pin-system-rust.sh" --version 1.98.1
# 宿主机直连不通时改用（把值替换为管理员自持的代理地址）：
# sudo env VBMF_CI_PROXY=http://<proxy> "$PIN_DIR/pin-system-rust.sh" --version 1.98.1
# 期望尾行: PINNED_RUST_VERSION=1.98.1 ；任何 mismatch 脚本自身 fail-closed 非零退出
# 幂等复核：原样重跑一次同一命令，仍必须以 0 退出且版本不变

# 4) pin 后独立验证（非 root、零 mutation；V1-V4 gate 全 PASS 才算数）
"$PIN_DIR/verify-system-rust.sh" --expect-version 1.98.1
# 期望: RESULT: PASS 与 PINNED_RUST_VERSION=1.98.1（canonical /usr/local 语义）
# V2 同时证明 rustup default = 1.98.1-<target>（不存在 rolling stable）
# V2/V3/V4 均以显式 RUSTUP_HOME=/usr/local/rustup、CARGO_HOME=/usr/local/cargo
# 执行（并清除调用方 RUSTUP_TOOLCHAIN）：/usr/local/bin 下是 rustup proxy，
# 不得让调用方/用户级 rustup 状态冒充 system pin 证据

# 5) 刷新 manifest（以 runner 服务账号身份，不用 root）
sudo -u vbmf-ci "$BUNDLE_DIR/collect-toolchain.sh" --name vbmf-ci-01   # 02 主机改 --name

# 6) 清理（只删本次传输的 bundle 临时目录，不动宿主机上任何其他路径）
rm -rf "$BUNDLE_DIR"
```

**两台都完成后，管理机收口证据（只读）：**

```bash
scripts/ci/verify-runner.sh --name vbmf-ci-01          # R1-R5 + scope，期望 RESULT: PASS
scripts/ci/verify-runner.sh --name vbmf-ci-02
```

- 再 dispatch 只读 `ci-infra-probe.yml`（tier=`vbmf-general`，单 job 无 matrix），
  重复 dispatch 直至 logs 中**两台 runner.name 各出现至少一次**，且每次报告中
  `rustc` / `cargo` 均为 `/usr/local/bin/...` + `1.98.1`（parity 双证）。
- 上述证据齐备前，P2-C 不得进入 `rust-format.runs-on` 迁移（§15.8 末条不变）。
- 红线复述：本 runbook 不给 `vbmf-ci` 加任何 sudo；pin/verify 脚本不以 GitHub
  Actions workflow 为执行入口；`verify-system-rust.sh` 永不 install/write/link。

**回归测试（Development VM，非 root、零网络）：**
`scripts/ci/test-system-rust-scripts.sh` —— 覆盖两脚本语法、pin 参数 fail-closed
（拒绝 rolling `stable`/非 `x.y.z`/未知参数）、verify V1-V4 各失败模式（版本漂移、
missing rustfmt、非 symlink 暴露、rolling default、未设 default）与 happy path；
并断言非 canonical `--root` 的成功输出带显式 TEST-ONLY / 非 acceptance evidence 标记
（canonical `/usr/local` 验证保持普通 acceptance PASS 语义）；并覆盖步骤 A 的
`prepare-system-rust-bundle.sh`（exact-SHA 导出 + SHA256SUMS，happy path 与
floating ref / 短 SHA / 未知 SHA / 无脚本 commit / 非空目标目录等 fail-closed 路径，
bundle 内容跨 run 确定性）。

### 15.10 P2-M media tier 供给 runbook（2026-09-16，§15.3 裁决 B 义务 1）

`vbmf-ci-media`（KVM VM，devbox libvirtd，规格对齐 ci-02）供给面，与 §15.9
同构（out-of-band host-admin、逐项授权、bundle 传输、verify gate、manifest）：

1. **系统库清单**（media 主机一次性预装，`vbmf-ci` 零 sudo 红线不变）：
   `git curl jq python3 build-essential pkg-config unzip tar` +
   `libclang-dev`（bindgen 运行时依赖）+
   `libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev`（P2-M2 预铺）+
   `protobuf-compiler`（P2-M2 预铺）。apt 走内网源（§15.5 运维口径）。
2. **Rust pin**：`pin-system-rust.sh --version 1.98.1`（§15.9 步骤 A bundle
   流程原样复用）；verify V1–V6 + manifest。
3. **DeckLink SDK pin（裁决 B 核心）**：
   - SDK 16.0.0 tarball（或解包目录）由管理员经 out-of-band 通道上机
     （public repo 证据纪律：版本 + header 计数可记录，tarball hash 与
     header 内容不得入 repo/logs/evidence）；
   - `pin-decklink-sdk.sh --tarball <path> --version 16.0.0`（root、幂等、
     fail-closed：tarball 内必须恰好一个 `*/Linux/include/DeckLinkAPI.h`，
     四个必需 header 齐全才动 canonical 路径）；
   - canonical 路径 `/usr/local/share/decklink-sdk/include/`（不带版本段；
     版本锁由 `VERSION` 文件 + verify gate + manifest 承载）；
   - `verify-decklink-sdk.sh --expect-version 16.0.0`（非 root、零 mutation，
     V1 目录非空 / V2 VERSION exact / V3 四 header 在位 / V4 非 root 可读）；
   - `collect-toolchain.sh` 记 `decklink_sdk` 段（version + header_count；
     general 机自动记 absent）。
   - SDK 升级 = 罕见 host-admin 事件：原路径重跑 pin + verify + manifest。
4. **回归测试**（Development VM，非 root、零网络）：
   `scripts/ci/test-decklink-sdk-scripts.sh`（pin 参数 fail-closed、verify
   V1–V4 各失败模式、TEST-ONLY 标记、collect SDK 段）。
5. **runner 注册**：`provision-runner.sh --name vbmf-ci-media --labels vbmf,vbmf-media`
   + systemd 模板 + R1–R6（`verify-runner.sh` + probe tier=vbmf-media，
   allowlist 已加）。
6. **workflow 门控契约**（P2-M1 迁移形态）：self-hosted 路径 fail-closed——
   SDK 路径/VERSION 缺失即 job 失败，不空过；github-hosted（fork）路径维持
   空过语义。required context 名 `hardware-test-compile` 不变。

### 15.11 出网缓解记录（2026-09-16，随 P2-M1 落盘）

risk 8 出网故障窗（2026-09-15 六窗 / 2026-09-16 四窗，STATE risk 8 全账）的
已授权缓解，红线兼容口径：

- **git 面**：宿主机继续使用 system Git proxy 消除 checkout/fetch 故障窗；具体
  LAN 地址不入 repo/public log。
- **codeload 面（2026-09-17 用户授权后升级）**：多次 required job 在 `Set up job`
  阶段确定性复现 `codeload.github.com` Action archive 100s×3 超时；单纯 rerun 不再视为
  充分缓解。官方 Runner 源码确认 `ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE` 会按
  `<owner_repo>/<resolved_sha>.tar.gz` 命中本地 archive 并跳过网络下载，因此将其定为
  **主缓解**；loopback HTTP proxy 保留为 cache miss / maintenance fallback。
- **immutable inputs**：`media-agent.yml` 的 checkout/rust-toolchain/cache/upload-artifact
  均 pin resolved SHA；dispatch-only `ci-runner-action-cache.yml` 零 external action，负责
  固定 SHA 下载、tar 校验、SHA256 清单、`.env` cache path 与受控 runner restart。
- **probe**：验证 archive cache 目录与 4 个固定 SHA tarball，proxy 仅允许 direct 或
  credential-free loopback HTTP；公开日志不打印 proxy URL / LAN route。
- 维护：Action SHA 更新必须同步 workflow pin + cache maintenance 清单 + probe 清单；
  required contexts 与业务测试语义保持不变。
