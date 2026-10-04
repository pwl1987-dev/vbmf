#!/usr/bin/env bash
# PR-STAB-01 Long Stability Acceptance v3 runner.
# Keeps r64-stability-long.sh v2 semantics intact; adds true-duration cycle
# profiles + read-only sidecar + strict v3 post-analysis.
set -euo pipefail

RUNG="${1:-}"
case "$RUNG" in
  2h) TARGET_SECONDS=7200; CYCLES=256 ;;
  8h) TARGET_SECONDS=28800; CYCLES=1019 ;;
  24h) TARGET_SECONDS=86400; CYCLES=3055 ;;
  *) echo "usage: $0 {2h|8h|24h}" >&2; exit 2 ;;
esac

: "${SOURCE_COMMIT:?SOURCE_COMMIT is required}"
: "${MEDIA_AGENT_DIR:?MEDIA_AGENT_DIR is required}"
: "${MANIFEST_PATH:?MANIFEST_PATH is required}"
PROTECTED_PID="${PROTECTED_PID:-992634}"
DWELL="${DWELL:-28}"
REPLAY_EVERY="${REPLAY_EVERY:-5}"
TAG="${TAG:-pr-stab-01-v3-${RUNG}}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DRIVER="$ROOT/r64-probe/r64-stability-long.sh"
COLLECTOR="$ROOT/r64-probe/collect-long-v3.py"
ANALYZER="$ROOT/r64-probe/analyze-long-v3.py"
BINARY_PATH="$MEDIA_AGENT_DIR/target/debug/media-agent"
RUN_DATE="$(date +%Y-%m-%d)"
EV="$HOME/a2-8-02i-evidence/${RUN_DATE}-${TAG}"
TMP_DRIVER="/tmp/vbmf-${TAG}-soak.sh"

for f in "$BASE_DRIVER" "$COLLECTOR" "$ANALYZER" "$MANIFEST_PATH"; do
  test -f "$f" || { echo "required file missing: $f" >&2; exit 2; }
done
test -d "$MEDIA_AGENT_DIR" || { echo "MEDIA_AGENT_DIR missing: $MEDIA_AGENT_DIR" >&2; exit 2; }

# BMD preflight: a v3 rung must start from a clean control-plane surface and
# must never acquire/replace the protected device-2 output process.
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -Eq ':(8080|50051)([[:space:]]|$)'; then
  echo "preflight failed: 8080/50051 already listening" >&2
  exit 2
fi
test -r "/proc/$PROTECTED_PID/cmdline" || { echo "protected device pid missing: $PROTECTED_PID" >&2; exit 2; }
PROTECTED_CMD="$(tr '\0' ' ' < "/proc/$PROTECTED_PID/cmdline")"
case "$PROTECTED_CMD" in
  *decklinkvideosink*device-number=2*) ;;
  *) echo "protected pid identity mismatch: $PROTECTED_CMD" >&2; exit 2 ;;
esac

# Historical driver stays byte-unchanged in Git. A temporary copy only redirects
# its build-tree cd to the exact archive tree selected for this rung.
# The replacement text intentionally keeps variables literal for the temporary
# driver to expand at rung runtime, not while this wrapper prepares the copy.
# shellcheck disable=SC2016
sed \
  -e 's#cd "$HOME/media-agent-build/services/media-agent"#cd "$MEDIA_AGENT_DIR"#' \
  -e 's#EV="$HOME/a2-8-02i-evidence/$(date +%Y-%m-%d)-$TAG"#EV="$EVIDENCE_DIR_OVERRIDE"#' \
  "$BASE_DRIVER" > "$TMP_DRIVER"
chmod +x "$TMP_DRIVER"
export MEDIA_AGENT_DIR
export EVIDENCE_DIR_OVERRIDE="$EV"

rm -rf "$EV"
env CYCLES="$CYCLES" DWELL="$DWELL" REPLAY_EVERY="$REPLAY_EVERY" TAG="$TAG" \
  bash "$TMP_DRIVER" >"${EV}.driver.log" 2>&1 &
DRIVER_PID=$!
echo "$DRIVER_PID" >"${EV}.driver.pid"

for _ in $(seq 1 720); do
  test -f "$EV/pid" && break
  kill -0 "$DRIVER_PID" 2>/dev/null || break
  sleep 0.25
done
test -f "$EV/pid" || { wait "$DRIVER_PID" || true; echo "runtime pid file did not appear" >&2; exit 2; }

test -f "$BINARY_PATH" || { echo "binary missing after build: $BINARY_PATH" >&2; exit 2; }
python3 "$COLLECTOR" \
  --evidence-dir "$EV" \
  --pid-file "$EV/pid" \
  --target-seconds "$TARGET_SECONDS" \
  --source-commit "$SOURCE_COMMIT" \
  --binary-path "$BINARY_PATH" \
  --manifest-path "$MANIFEST_PATH" \
  --driver-path "$TMP_DRIVER" \
  --protected-pid "$PROTECTED_PID" \
  >"$EV/v3-sidecar.log" 2>&1 &
COLLECTOR_PID=$!

set +e
wait "$DRIVER_PID"
DRIVER_RC=$?
wait "$COLLECTOR_PID"
COLLECTOR_RC=$?
set -e

echo "driver_rc=$DRIVER_RC collector_rc=$COLLECTOR_RC" > "$EV/v3-runner-status.txt"
set +e
python3 "$ANALYZER" "$EV" \
  --target-seconds "$TARGET_SECONDS" \
  --expected-cycles "$CYCLES" \
  --replay-every "$REPLAY_EVERY" \
  --write-json
ANALYZER_RC=$?
set -e

if [ "$DRIVER_RC" -ne 0 ] || [ "$COLLECTOR_RC" -ne 0 ] || [ "$ANALYZER_RC" -ne 0 ]; then
  exit 2
fi
