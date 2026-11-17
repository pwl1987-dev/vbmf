#!/usr/bin/env bash
# 按章节提取 .project/STATE.md，避免冷启动通读整份（361KB / 2089 行，§3 为历史 ledger）。
#
# 用法:
#   scripts/agent/state-scope.sh            # 默认 4-5（Current Task + Next Task）
#   scripts/agent/state-scope.sh 1-2        # Repository Authority + Current Phase
#   scripts/agent/state-scope.sh 7          # 单节
#   scripts/agent/state-scope.sh all        # 逃生舱：整份（仅在 Work Packet 明确要求时）
#
# 语义与直读 STATE.md 完全一致；仅裁掉范围外章节。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="$ROOT/.project/STATE.md"
scope="${1:-4-5}"

if [[ ! -f "$STATE" ]]; then
  echo "state-scope: missing $STATE" >&2
  exit 2
fi

# 只输出 STATE 内实际存在的章节；缺失即报错，不静默返回空。
existing_sections() {
  awk '/^## [0-9]+\./ { s=$2; sub(/\..*$/, "", s); print s }' "$STATE"
}

emit() {
  awk -v lo="$1" -v hi="$2" '
    /^## [0-9]+\./ {
      s=$2; sub(/\..*$/, "", s); s=s+0
      keep = (s >= lo && s <= hi)
    }
    keep { print }
  ' "$STATE"
}

if [[ "$scope" == "all" ]]; then
  cat "$STATE"
  exit 0
fi

if [[ "$scope" =~ ^([0-9]+)-([0-9]+)$ ]]; then
  lo="${BASH_REMATCH[1]}"; hi="${BASH_REMATCH[2]}"
elif [[ "$scope" =~ ^[0-9]+$ ]]; then
  lo="$scope"; hi="$scope"
else
  echo "state-scope: bad scope '$scope' (use N | N-M | all)" >&2
  exit 2
fi

available="$(existing_sections | sort -n -u | tr '\n' ' ')"
for s in $(seq "$lo" "$hi"); do
  if ! existing_sections | grep -qx "$s"; then
    echo "state-scope: section §$s not found (available: $available)" >&2
    exit 3
  fi
done

out="$(emit "$lo" "$hi")"
printf '%s\n' "$out"
printf '[state-scope] §%s-%s | %s bytes | %s lines | source: .project/STATE.md (%s bytes total)\n' \
  "$lo" "$hi" "${#out}" "$(printf '%s\n' "$out" | wc -l)" "$(wc -c <"$STATE" | tr -d ' ')" >&2
