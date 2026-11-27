# VBMF Standalone Lane — 部署工件（STANDALONE-ENTRY-01 / SE-01B + SE-01B-FIX）

> **Lane 边界**: 本目录是 standalone lane（单 `media-agent` + systemd + `/etc/vbmf` + `/health`）的部署工件。
> `ops/` 既有 compose/Dockerfile/nginx 为 V0.2 全栈形态占位，**本 lane 不修改、不依赖它们**（compatible, not dependent）。
> 语义权威: [`docs/architecture/STANDALONE_MEDIA_AGENT_OPERATIONS.md`](../../docs/architecture/STANDALONE_MEDIA_AGENT_OPERATIONS.md)；
> 部署 lane 增补: Deployment SoT §17。

## 工件

| 文件 | 作用 |
|---|---|
| `install.sh` | 版本化安装：fail-closed provenance（`git get-tar-commit-id` 读 archive embedded full SHA，tag short SHA 必须为其前缀）→ 同文件系统 staging 全流程（验证/extract/构建/bin/manifest/self-check）→ `mv -T` 原子落成 → 原子切 `current`；失败 trap 清理 staging，正式目录不出现 |
| `switch-current.sh` | 版本切换/回滚：fail-closed provenance 复核（manifest `version_tag` 一致 / `git_commit_sha` full 40-hex / tag 前缀一致 / binary digest 一致）后原子切 `current`；无 `git_commit_sha` 的 legacy manifest 拒绝 |
| `vbmf-media-agent.service` | systemd 单元；`StartLimitIntervalSec`/`StartLimitBurst` 在 `[Unit]`（systemd ≥230；放 `[Service]` 为 unknown key——BMD 259 实证）；`Restart=on-failure` 在 `[Service]` |
| `tests/install-failure-matrix.sh` | installer/switcher failure-injection 矩阵（Dev VM 运行；坏 archive / 前缀不符 / 构建失败 / 篡改 digest/SHA/legacy manifest / 重装拒绝 / current 不变） |

## 目录布局（frozen S6/S7 + SE-01B-FIX）

```
/opt/vbmf/<version>-<short-sha>/     # 版本目录（只增不改；禁止原地 mutation 升级）
  ├── services/media-agent/...        # 展开的 exact-commit 源（构建现场保留）
  ├── bin/media-agent                 # release binary（sha256 记录于 install-manifest）
  ├── bin/media-agent-gates           # acceptance root（真机验收入口）
  └── install-manifest.json           # 见下字段表
/opt/vbmf/.staging-<tag>-<pid>/       # 安装中 transient（失败自动清理；正常不应存在）
/opt/vbmf/current -> <版本目录>       # 原子 symlink（tmp + mv -T）；rollback = switch-current.sh 指旧版本
/etc/vbmf/media-agent.env             # EnvironmentFile（`-` 前缀 = 缺失容忍）
/etc/vbmf/network-binding.json        # NetworkSourceBinding（0600，machine-pin；SE-01D 起默认 pin /etc/machine-id）
/etc/vbmf/device-binding.json         # DeviceBindingManifest（0600，device lane 必需；语义见下节）
/var/lib/vbmf/                        # 预留（Runtime 当前无持久状态；owner/mode 记录于 manifest；
                                      #   未来 Runtime 写入必须另过 Authority，install 不赋多余权限）
```

### install-manifest.json 字段

| 字段 | 语义 |
|---|---|
| `version_tag` | `<version>-<short-sha>`（安装目录名） |
| `git_commit_sha` | archive embedded **full 40-hex commit SHA**（`git get-tar-commit-id` 读取；SE-01B-FIX 起 fail-closed 必有） |
| `archive_sha256` / `media_agent_sha256` / `media_agent_gates_sha256` | archive / 两个 binary 的 sha256 |
| `features` / `ci_run_id` | 构建 feature 集 / 来源 CI run |
| `var_lib_path` / `var_lib_owner_mode` | S7 预留目录属主记录（如 `root:root 755`） |
| `installed_at_utc` | 安装时间 |

### Provenance 证据链（可机械核验）

```
GitHub exact main SHA
  → git archive embedded SHA（gzip -dc a.tar.gz | git get-tar-commit-id）
  → archive sha256
  → install-manifest.git_commit_sha
  → binary sha256（install-manifest.media_agent_sha256）
  → current symlink
```

任一环节无法证明（非 git archive 产物、tag short SHA 非 embedded SHA 前缀、manifest 缺 `git_commit_sha`）→ 拒绝安装/切换；**绝不从 filename/tag 猜 SHA**。

- **禁止** floating ref 部署；**禁止**部署无 `install-manifest.json` 的目录。
- 旧 `/opt/vbmf-dev` 树与本 lane 并存、只读保留，升级/回滚均不触碰。

## 安装 / 升级 / 回滚

```bash
# 安装（exact commit git-archive 产物在本机；脚本一律经 bash 调用）
bash ops/standalone/install.sh /tmp/vbmf-<sha>.tar.gz 0.1.0-<shortsha> <ci-run-id>

# 升级 = 对新版本 tag 再跑 install.sh（旧版本目录原样保留；重装同 tag 拒绝）

# 回滚 = provenance 复核后切回旧版本
bash ops/standalone/switch-current.sh 0.1.0-<旧shortsha>

# systemd
sudo cp ops/standalone/vbmf-media-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/vbmf-media-agent.service   # 必须零 warning/零 unknown key
sudo systemctl start vbmf-media-agent        # 验收演练不 enable 常开，由运维决定
```

测试观测缝（生产**不设置**，行为不变）：`VBMF_INSTALL_ROOT`（默认 `/opt/vbmf`）、`VBMF_VAR_LIB_DIR`（默认 `/var/lib/vbmf`）供 failure matrix 指向 mktemp 目录。

## systemd 行为（SE-01B-FIX 修正）

- **rate limit**：`[Unit]` `StartLimitIntervalSec=30` + `StartLimitBurst=3` —— 30s 窗口最多 3 次启动尝试（**非指数 backoff**）；命中后 unit 进 `failed`，运维 `systemctl reset-failed vbmf-media-agent` 并修因后再 start。
- `Restart=on-failure` 只覆盖运行期崩溃；**exit 0（SIGTERM 优雅停止）绝不 restart**；exit 2 = fail-closed 构造拒绝（重试无意义直至 env/manifest 修复，但 rate limit 仍会限制无效重试风暴）。
- 重启间隔如需显式化用 `RestartSec=`（合法 `[Service]` 键）。

## 启动 lane 选择（network-only vs device，互斥）

由 `/etc/vbmf/media-agent.env` 两个**互斥** env 决定（同时设置 = fail-closed exit 2，`bootstrap.rs::select_startup_composition_mode`）：

- `MEDIA_AGENT_NETWORK_BINDING=/etc/vbmf/network-binding.json` → network-only 组合根（无设备发现、无 DeckLink、零媒体启动）。
- `MEDIA_AGENT_DEVICE_BINDING=/etc/vbmf/device-binding.json` → device lane（FFmpeg production 组合根**强制**要求该清单，缺清单 exit 2）。

### DeviceBindingManifest 字段与校验（语义权威 `services/media-agent/src/resolver.rs`）

字段（v2 schema）：`manifest_version`（须可解析为版本号，major≥2 强制每条带 `port`）、`machine_id`、`generated_by`/`generated_at`、`bindings[]`：`label` / `bmd_device_handle`（canonical 索引，绝不按枚举序号）/ `gst_device_number`（唯一）/ 可选版本软校验（`bmd_sdk_version` 等） / `port{connector,ordinal,direction,required}`。

fail-closed 校验链（任一不过 = exit 2）：

1. `validate_manifest`：版本可解析 + machine_id 非空 + handle/`gst_device_number` 唯一 + v2 端口级绑定。
2. `check_machine_identity`：清单 `machine_id` 必须等于 runtime 身份（`VBMF_MACHINE_ID` > `/etc/machine-id`，SE-01D）；旧 HOSTNAME 风格 pin（如 `10.30.15.10`）必须重 pin，误投他机直接拒绝。
3. `collect_authorizations_from_manifest`：每条 **input** 条目的 handle 必须命中真实 discovery 恰好一台（output 设备不进授权表）。
4. `validate_manifest_against_discovery`：handle + 端口三元组（connector/direction/ordinal）逐条匹配。

`bmd_device_handle`/`gst_device_number` 来源于现场核实（HW-IDENT-02 流程，`scripts/hw-ident-02.sh`）；DeviceHandle 非跨重启永久稳定，驱动升级或冷启动漂移后须复核回填清单。

## 运维要点

- **readiness**：轮询 `GET /health` 至 `state ∈ {Ready, Capturing}`（HTTP 200 本身不是 ready；语义页 §2）。
- **退出码**：`0` = 优雅停止；`2` = fail-closed 启动拒绝（修 env/manifest 前重启无意义）。
- **身份**：SE-01D 起默认 `/etc/machine-id`（`VBMF_MACHINE_ID` 显式覆盖）；旧 HOSTNAME 风格 pin 的清单必须重 pin。
- **失败恢复**：安装失败不留半安装正式目录（staging 自动清理）——重新安装即可，无需人工删除正式版本目录；`/opt/vbmf/` 下发现 `.staging-*` 残留即异常，先查明再清理。
- **日志**：stdout/stderr → journald（`journalctl -u vbmf-media-agent`）；`RUST_LOG` 经 env file 透传。
- **硬化建议（不阻塞 lane）**：专用服务用户 + 最小组替代 `User=lytv`（BMD 设备访问按现实经用户组/udev）；本验收按 BMD 现实以 lytv 运行并如实登记。
- **Runtime owns truth**：全部工件只做 启动/停止/传 env/指向 manifests；健康与状态判断只经 `/health` 与进程退出码，绝不旁路 SessionManager/LeaseManager。
