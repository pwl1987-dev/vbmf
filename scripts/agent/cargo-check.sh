#!/usr/bin/env bash
# 输出过滤版 Rust 门禁：保留失败详情与摘要，丢弃 'test ... ok' 噪声行。
# 原始命令仍是 SoR（见 docs/agent-toolchain.md）；本脚本只改变**输出**，不改变判定。
# exit code 透传：与直接跑 cargo test / cargo clippy 的判定完全一致。
#
# 用法:
#   scripts/agent/cargo-check.sh test      # 等价 cargo test
#   scripts/agent/cargo-check.sh clippy    # 等价 cargo clippy -- -D warnings
#   scripts/agent/cargo-check.sh fmt       # 等价 cargo fmt --all --check
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mode="${1:-test}"

case "$mode" in
  test)   cmd=(cargo test) ;;
  clippy) cmd=(cargo clippy -- -D warnings) ;;
  fmt)    cmd=(cargo fmt --all --check) ;;
  *) echo "usage: $0 [test|clippy|fmt]" >&2; exit 2 ;;
esac

cd "$ROOT/services/media-agent" || { echo "cargo-check: no services/media-agent" >&2; exit 2; }

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
"${cmd[@]}" >"$tmp" 2>&1
rc=$?

raw_bytes=$(wc -c <"$tmp" | tr -d ' ')

filter() {
  awk '
    /^test .* \.\.\. ok$/            { next }
    /^   Compiling /                 { next }
    /^    Checking /                 { next }
    /^    Blocking /                 { next }
    /^    Finished /                 { next }
    /^  Downloaded /                 { next }
    { print }
  ' "$tmp"
}

dropped=$(grep -cE '^(test .* \.\.\. ok|   Compiling |    Checking |    Blocking |    Finished |  Downloaded )' "$tmp" || true)

out="$(filter)"
printf '%s\n' "$out"
kept_bytes=${#out}
printf '\n[cargo-check] cmd="%s" exit=%s | raw=%s bytes -> kept=%s bytes | dropped_noise_lines=%s\n' \
  "${cmd[*]}" "$rc" "$raw_bytes" "$kept_bytes" "$dropped"

exit "$rc"
