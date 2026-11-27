#!/usr/bin/env bash
# BMD 真机 (10.30.15.10, lytv) 本地编译脚本 —— 复用已装工具链/GStreamer dev/libclang, 不依赖 CI.
#
# 用法:
#   ./scripts/build-bmd.sh                 # 默认 --features bmd,gstreamer (debug)
#   ./scripts/build-bmd.sh --release       # release 构建
#   MEDIA_AGENT_SELFTEST=1 ./scripts/build-bmd.sh   # 构建后由调用方以 selftest 运行
#
# env (有默认值, 可被外部环境变量覆盖):
#   DECKLINK_SDK_INCLUDE  DeckLink SDK Linux/include 路径 (已软链去空格)
#   LIBCLANG_PATH         libclang 所在目录 (bindgen 需要)
set -euo pipefail

# Resolve this script's directory ONCE, as an absolute path, before any cd:
# the guard path below is computed relative to it, so it must not depend on the
# caller's cwd or on how deep $0 was given (relative vs absolute).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

DECKLINK_SDK_INCLUDE="${DECKLINK_SDK_INCLUDE:-/home/lytv/decklink-sdk-include}"
LIBCLANG_PATH="${LIBCLANG_PATH:-/usr/lib/llvm-21/lib}"

# Runtime driver version floor: Desktop Video <= 16.2 leaks ~16.3 B per delivered video
# frame inside libDeckLinkAPI.so (per-frame leak), which grows the Runtime RSS ~4-6 MB/h
# and fails the PR-STAB-01 v3_rss_terminal_plateau gate. 16.5a1 no longer leaks. Upstream
# does not disclose the fix, so a downgraded host would regress silently — fail fast here
# instead of wasting a 24 h acceptance rung. See docs/phase-0.6/BMD-LOCAL-BUILD.md §1.1.
RUNTIME_VERIFY="${RUNTIME_VERIFY:-$SCRIPT_DIR/../../../scripts/ci/verify-decklink-runtime.sh}"
# Fail CLOSED when the guard is absent: this guard exists precisely to prevent a
# silent regression (upstream never disclosed the 16.5 fix), so skipping it
# silently would recreate the exact failure mode it prevents.
if [ ! -x "$RUNTIME_VERIFY" ]; then
  echo "ERROR: 降级守卫缺失或不可执行: $RUNTIME_VERIFY" >&2
  echo "       该守卫用于在 Desktop Video runtime < 16.5 的主机上 fail fast（防静默回归），不得跳过。" >&2
  echo "       请检查仓库是否完整 checkout：scripts/ci/verify-decklink-runtime.sh" >&2
  exit 1
fi
"$RUNTIME_VERIFY" --min-version 16.5
if [ ! -f "${DECKLINK_SDK_INCLUDE}/DeckLinkAPI.h" ]; then
  echo "ERROR: DECKLINK_SDK_INCLUDE 指向无 DeckLinkAPI.h: ${DECKLINK_SDK_INCLUDE}" >&2
  echo "       请先软链 SDK include 到无空格路径, 见 docs/phase-0.6/BMD-LOCAL-BUILD.md §4" >&2
  exit 1
fi

export DECKLINK_SDK_INCLUDE
export LIBCLANG_PATH

echo "== BMD local build: features=bmd,gstreamer =="
echo "   DECKLINK_SDK_INCLUDE=${DECKLINK_SDK_INCLUDE}"
echo "   LIBCLANG_PATH=${LIBCLANG_PATH}"
cargo build --features bmd,gstreamer "$@"
