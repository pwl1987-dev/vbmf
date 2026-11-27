# BMD 服务器本地编译环境搭建清单 (media-agent)

> 适用范围：BMD 真机 `10.30.15.10`（`lytv`，Ubuntu 26.04 resolute）。
> 目标：让服务器具备**完全独立的本地编译能力**，`cargo build --features bmd,gstreamer` 不再依赖 CI。
> 已于 2026-08-27 在真机验证通过（**独立本地编译环境**已具备 + C1 探针**可执行** + **DeviceBindingManifest 权威路径已验证**）；当前 `hw-serial-number == SDK DeviceHandle` 已实测成立，`ManifestVerified` 真实通过。但 **MEDIA-RT-01 canonical 真实采集（真机 SDI 首帧 + PTS 单调）尚未完成**，详见 §9。

---

## 1. 前置条件

- `sudo` 可用（`lytv` 免密）。
- 磁盘预留 ≥ 2GB（`~/.cargo/registry` 缓存 + `target/` 构建产物）。
- 网络可访问 `archive.ubuntu.com` / aliyun 镜像（apt）与 `crates.io`（cargo，走 `~/.cargo/registry` 全局缓存）。
- Rust 工具链已通过 `rustup` 安装（默认在 `~/.cargo/bin`）。
- Blackmagic DeckLink SDK 16.0 头文件已就位：
  `/home/lytv/Blackmagic_DeckLink_SDK_16.0/Blackmagic DeckLink SDK 16.0/Linux/include`
  （路径含空格，编译期需软链到无空格路径，见 §4）。

---

## 1.1 ⚠️ 硬性前置：Desktop Video runtime ≥ 16.5a1（2026-11-25 新增，泄漏修复）

**为什么是硬性前置**：Desktop Video **16.2a1 及更早**的 `libDeckLinkAPI.so` 在视频输入路径上
**每交付 1 帧泄漏约 16.3 字节**（69129 次/1380s = 50.1 次/秒 = 2 路输入 × 25fps；闭源 SDK，无法在
本仓修复）。后果：常驻 RSS 以约 4–6MB/h 持续增长，PR-STAB-01 的 `v3_rss_terminal_plateau`
门禁（终段斜率 ≤1.0MB/h）在 **16.2a1 上恒定 FAIL**（实测 7.613MB/h）⇒ STABILITY 阶梯卡在 rung 1。
升级到 **16.5a1** 后实测终段斜率 **0.123MB/h（门禁 PASS）**、live 字节斜率 5.97 → 0.12MB/h。

**验证当前机器版本**（必须 ≥ 16.5a1）：
```bash
cat /sys/module/blackmagic/version   # 期望 16.5a1
dpkg -l desktopvideo | tail -1
# 或直接跑仓库守卫（地板 16.5，16.2a1/16.4 会被拒绝）
bash scripts/ci/verify-decklink-runtime.sh --min-version 16.5
```

**守卫是 fail-closed 的（2026-11-26 修正）**：`scripts/build-bmd.sh` 在每次 BMD 本地构建前调用该守卫；**守卫脚本缺失或不可执行 ⇒ 直接 `exit 1` 并打印修复指引，不会静默跳过**（早期写法是 `if [ -x ... ]` ⇒ 守卫缺失会静默放行，等于把这个守卫本要防的「静默回归」重新放回来）。若你手工删过 `scripts/ci/verify-decklink-runtime.sh`，构建会这样失败，属预期：
```
ERROR: 降级守卫缺失或不可执行: .../scripts/ci/verify-decklink-runtime.sh
```
**覆盖面边界**：runtime 版本校验只能在 BMD 侧做 —— CI 的五条 workflow 均**不调用**本守卫（CI 无 DeckLink runtime，只验 SDK headers→bindgen→Rust 编译）；真实 link/open 与枚举由 BMD 负责。

**版本探测链（2026-11-26 补强·修一个真实放行缺口）**：守卫按「先命中先用」顺序探测 ① `--dpkg-version` 显式覆盖 → ② `/sys/module/blackmagic/version`（**模块已加载**时的 sysfs）→ ③ `modinfo blackmagic` 的 `version:` 行（**模块已安装但未加载**时的已安装 .ko）→ ④ `dpkg-query -W desktopvideo`（已安装包版本）→ ⑤ 全部探测不到 ⇒ WARN + `exit 0`（该机根本没装 Desktop Video，允许构建）。**为什么必须补 ③④**：模块已安装但未加载时 sysfs 根本不存在，只查 sysfs 会把一台装着 16.2 的验收机**放行** —— 那正是本守卫要防的静默回归（BMD 上包名是 `desktopvideo`，不是 `blackmagic-desktop-video`）。行为测试已覆盖这四条分支（守卫测试 16 → **20 项**，VM80 Linux 权威跑 20/20）。

**升级步骤**（官方包 → deb → dkms → 重启）：
1. 官方 Linux 包 `Blackmagic_Desktop_Video_Linux_16.5.tar`（2.09GB，含 `deb/x86_64/desktopvideo_16.5a1_amd64.deb`）
   —— 官网直链全部 404，只能走支持页弹窗的 **"Download Only"**（免填表）通道，
   它会 POST `/api/register/<country>/download/<downloadId>` 拿到文件直链。
2. `sudo dpkg -i desktopvideo_16.5a1_amd64.deb`（dkms 会为**已安装的所有内核**构建模块）
3. ⚠️ **重启后默认内核可能已切到更新的版本**（例如 7.0.0-30 → 7.0.0-44），新内核的 dkms 仍是旧版本
   ⇒ 必查 `dkms status` + `modinfo blackmagic | grep version`，必要时
   `sudo dkms autoinstall -k $(uname -r)` + `sudo update-initramfs -u` 后**再重启一次**
4. 重启后校验 `/sys/module/blackmagic/version == 16.5a1`，并确认受保护的 device-2 输出进程已用
   **完全相同的命令行**重建（升级会中断设备占用）

**头文件与 runtime 的版本关系**：bindgen 仍用 SDK 头文件（`~/decklink-sdk-include`，16.0 系），
runtime 升到 16.5a1 两者可共存——DeckLink 是 COM 风格稳定 ABI，2026-11-25 实测
（devices=3 设备发现 + 真实采集 + 2h soak 全 gate PASS）成立。若将来换头文件版本，需重跑
PR-STAB-01 阶梯复核。

**不要做的事**：不要用 `MALLOC_ARENA_MAX` / `MALLOC_MMAP_THRESHOLD_` 之类 env 去"修"这个增长
（PR-STAB-01 §3.103 已用 2h A/B 实测否证：两臂 6.541 / 6.217MB/h，均高于未缓解基线，且把
"偶发台阶"变成"持续爬升"）；也不要在 rung 运行期并行编译/heapprofile（会扰动 cycle 时序）。

## 2. ⚠️ 关键坑：apt `ubuntu.sources` 的 `Types` 重复行

**症状**：`apt-get install libgstreamer1.0-dev` 等全部报 `Unable to locate package`，
但 `curl` 证明镜像的 `binary-amd64/Packages.gz` 里明明有该包。

**根因**：`/etc/apt/sources.list.d/ubuntu.sources` 把 `Types: deb` 和 `Types: deb-src` 写成**两行**。
deb822 解析时后者覆盖前者，apt 只拉取 `deb-src`（源码）索引、**完全跳过二进制 `deb` 索引**，
导致所有 `-dev` 二进制包在本地索引中不可见（aliyun 与官方 `archive.ubuntu.com` 都会中招，非镜像问题）。

**判定法**：若以下计数为 0，即中招：
```bash
ls /var/lib/apt/lists/ | grep -c binary-amd64_Packages
```

**一键修复**（合并为单行 `Types: deb deb-src`）：
```bash
sudo sed -i '/^Types: deb-src$/d; s/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources
sudo apt-get update
```

---

## 3. 需安装的编译器 / 构建工具 / 依赖（含版本）

| 类别 | 包 / 工具 | 版本（安装后实测） | 用途 |
|---|---|---|---|
| 编译器 | `build-essential`（gcc/g++/make） | gcc/g++ 15.2.0 | C 构建工具链 |
| 构建工具 | `pkg-config` | 2.5.1 | 定位 gstreamer 编译期 `.pc` |
| Rust | `rustup` stable + `rustfmt` + `clippy` | rustc/cargo **1.98.0**（盒上 rustup 镜像最新 stable） | Rust 工具链 |
| bindgen | `libclang-dev` + `clang` | clang / libclang 21（`/usr/lib/llvm-21/lib/libclang.so`） | `bmd` 特性 FFI 头生成 |
| GStreamer 编译期 | `libgstreamer1.0-dev` | **1.28.2** | 链接 `gstreamer-1.0` |
| GStreamer 编译期 | `libgstreamer-plugins-base1.0-dev` | 1.28.2 | 链接 `gstreamer-app-1.0`（appsink 等） |
| GStreamer 编译期 | `libgstreamer-plugins-bad1.0-dev` | 1.28.2 | 完整性（decklink 插件运行期加载，编译期非必需） |
| GStreamer 运行期 | `gstreamer1.0-plugins-bad` | 1.28.2 | `decklinkvideosrc`/`decklinkaudiosrc` 插件 `.so` |
| GStreamer 工具 | `gstreamer1.0-tools` | 1.28.2 | `gst-launch-1.0` / `gst-inspect-1.0` 验证用 |

> 注：版本 1.28.2 与盒上既有 GStreamer 运行期**完全一致**，安装 `-dev` 头包不会扰动生产采集。
> CI 还装了 `protobuf-compiler`，但当前 `services/media-agent/Cargo.toml` 无 protobuf 依赖，可省。

**安装命令**：
```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential pkg-config \
  libclang-dev clang \
  libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev \
  gstreamer1.0-plugins-bad gstreamer1.0-tools

# Rust 工具链升级到最新 stable 并补齐组件
~/.cargo/bin/rustup update stable
~/.cargo/bin/rustup component add rustfmt clippy
```

---

## 4. 编译期环境变量（必设）

DeckLink SDK 头路径含空格，软链到无空格路径，并设 `LIBCLANG_PATH` 供 bindgen 定位 libclang：

```bash
# DeckLink SDK include（去空格）
ln -sfn "/home/lytv/Blackmagic_DeckLink_SDK_16.0/Blackmagic DeckLink SDK 16.0/Linux/include" \
      /home/lytv/decklink-sdk-include

export DECKLINK_SDK_INCLUDE=/home/lytv/decklink-sdk-include   # bmd 特性 bindgen 输入
export LIBCLANG_PATH=/usr/lib/llvm-21/lib                     # bindgen 定位 libclang
```

> 以上两行已持久化进 `~/.bashrc`，交互 / 登录 shell 自动生效。
> ⚠️ 真机 shell 的 `PATH` 极简，**不要** `export PATH=...` 覆盖（会清空 PATH）；调用 cargo 用绝对路径 `~/.cargo/bin/cargo`。

---

## 5. 编译

推荐使用仓库内一键脚本（固化特性与 env 默认值）：

```bash
cd ~/media-agent-build            # 源码目录（见 §6 同步方式）
./scripts/build-bmd.sh                 # 默认 bmd,gstreamer (debug)
./scripts/build-bmd.sh --release       # release 构建
```

脚本位于 `services/media-agent/scripts/build-bmd.sh`，会自动校验 `DECKLINK_SDK_INCLUDE` 指向有效，并设好 `LIBCLANG_PATH`。
也可手动编译：

```bash
cd ~/media-agent-build
export DECKLINK_SDK_INCLUDE=/home/lytv/decklink-sdk-include
export LIBCLANG_PATH=/usr/lib/llvm-21/lib

cargo build --features bmd,gstreamer
# 预期：Finished `dev` profile [unoptimized + debuginfo]，二进制 target/debug/media-agent（约 32MB，仅警告）
```

（可选）仅编译 SDK 路径：`cargo build --features bmd`；默认无特性构建：`cargo build`。

### 支持的特性组合（编译期矩阵，已在盒上实测）

`src/main.rs:21` 在编译期强制 **`gstreamer` 与 `hardware-test` 互斥**（同时启用会 `compile_error!` 拦截）：
> hardware-test SDK 诊断探针与 canonical GStreamer 运行时不得同时启用，避免双采/争用同一块 DeckLink。

| 组合 | 用途 | 盒上本地编译 |
|---|---|---|
| (默认, 无特性) | 最小可编译运行（文件系统发现, 无 SDK/GStreamer） | ✅ |
| `simulation` | 模拟设备, CI/单测, 无硬件无 SDK | ✅ |
| `bmd` | 真实 DeckLink FFI（bindgen, 需 SDK+libclang） | ✅ |
| `gstreamer` | GStreamer 编译/链接验证（canonical 采集路径仍需 `bmd` 发现设备；纯 `gstreamer` 仅验证 GStreamer 依赖可编译，运行期不启采集） | ✅ |
| `bmd,gstreamer` | **BMD 真机 canonical 构建（推荐）** | ✅ |
| `hardware-test` | `bmd` + 冗余设备注册表探针（SDK 诊断, 不含 GStreamer） | ✅ |
| `bmd,gstreamer,hardware-test` | ⛔ 编译期被拒（互斥 guard, by design） | ❌ 设计内 |
| `simulation,bmd,gstreamer` | 全特性含模拟 | ✅ |

> **离线编译**：`cargo build --offline --features bmd,gstreamer` 在盒上成功（依赖复用 `~/.cargo/registry` 全局缓存）→ 本地编译**完全不依赖网络/CI**。
> **测试编译**：`cargo test --no-run --features bmd,gstreamer` 通过（测试目标可编译）。
> 所有组合**零 warning**：未用导入/trait/函数均已用 `#[cfg(all(feature = "bmd", feature = "gstreamer"))]` 等精确门控消歧（无 `unused import` / `dead_code` / `unused variable`），无编译错误。

---

## 6. 同步最新源码到盒上

盒上**无 GitHub SSH 密钥**，`git@github.com` 克隆会被拒（`Permission denied (publickey)`），
且 `~/media-agent-src` 不是 git 仓库。改用本地打包 scp：

```powershell
# 本地（Windows PowerShell）
cd e:/code/live/services/media-agent
tar --exclude=target -czf media-agent-src.tar.gz .
scp -i ~/.ssh/id_pwl media-agent-src.tar.gz lytv@10.30.15.10:~/media-agent-src.tar.gz
```

```bash
# 盒上
mkdir -p ~/media-agent-build
tar -xzf ~/media-agent-src.tar.gz -C ~/media-agent-build
# 依赖复用全局 ~/.cargo/registry 缓存，无需重下 crates
```

---

## 7. 如何验证编译环境可用

```bash
# 1. 工具链
~/.cargo/bin/rustc --version && ~/.cargo/bin/cargo --version      # 1.98.0
# 2. GStreamer 编译期头文件可达（关键判据）
pkg-config --modversion gstreamer-1.0 gstreamer-app-1.0          # 1.28.2
# 3. bindgen 就绪
ls /usr/lib/llvm-21/lib/libclang.so                             # 存在
# 4. DeckLink SDK 头可达
ls /home/lytv/decklink-sdk-include/DeckLinkAPI.h                # 存在
# 5. 真·编译验证（决定性）
cd ~/media-agent-build && cargo build --features bmd,gstreamer   # Finished
# 6. 端到端真机验证（C1 解析探针）
VBMF_RESOLVER=1 LD_LIBRARY_PATH=/usr/lib ./target/debug/media-agent
#    预期 RC=0，枚举 3 台 SDK 设备并正确判定 Unresolved（生产拒绝、绝不回退 device 0）
```

---

## 8. 部署运行（二进制下发工艺）

CI 产物下发（盒上无需编译时）：
```bash
gh run download <run_id> --name media-agent-linux
scp -i ~/.ssh/id_pwl media-agent lytv@10.30.15.10:~/media-agent   # 前 pkill -f "[/]media-agent" 防 ETXTBSY
# 运行
LD_LIBRARY_PATH=/usr/lib ./media-agent
```

---

## 9. 已知限制

1. **盒上无法 `git clone` GitHub**：无 SSH 密钥，源码走 §6 本地 tar+scp 同步。
2. **"最新稳定版本"边界**：Rust 为盒上 rustup 镜像提供的最新 stable（1.98.0）；GStreamer 为 Ubuntu 26.04 仓库最新（1.28.2，与运行期一致，未扰动生产）。若要更新的 Rust stable，须调整 rustup 镜像源。
3. **C1 / DeviceBindingManifest 结论**：`hw-serial-number == SDK DeviceHandle` 已在当前 GStreamer 1.28.2/DeckLink 环境实测成立，`ManifestVerified` 真实通过（权威路径 verified）；**MEDIA-RT-01** canonical 真实采集（真机 SDI 首帧 + PTS 单调）**仍待 HW-IDENT-02 占设备跑通**（canonical gate 仍 BLOCKED）。建议多轮冷启动/重启复核 `hw-serial-number` 可复现性。
