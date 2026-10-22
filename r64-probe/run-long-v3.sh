#!/usr/bin/env bash
# PR-STAB-01 Long Stability Acceptance v3 runner.
# Keeps r64-stability-long.sh v2 semantics intact; adds true-duration cycle
# profiles + read-only sidecar + strict v3 post-analysis.
set -euo pipefail

RUNG="${1:-}"
SMOKE_FLAG=""
DEFAULT_TAG="pr-stab-01-v3-${RUNG}"
case "$RUNG" in
  2h) TARGET_SECONDS=7200; CYCLES=256 ;;
  8h) TARGET_SECONDS=28800; CYCLES=1019 ;;
  24h) TARGET_SECONDS=86400; CYCLES=3055 ;;
  smoke)
    # harness-smoke-only: fixed 120s/6-cycle run of the full base soak ->
    # collector -> analyzer -> teardown chain. Never a qualification rung.
    TARGET_SECONDS=120; CYCLES=6; SMOKE_FLAG="--smoke"
    DEFAULT_TAG="pr-stab-01-v3-smoke-$(date +%H%M%S)" ;;
  *)
    echo "usage: $0 {2h|8h|24h|smoke}" >&2
    echo "  smoke = 120s/6-cycle harness toolchain check only, NOT a qualification rung" >&2
    exit 2 ;;
esac

: "${SOURCE_COMMIT:?SOURCE_COMMIT is required}"
: "${MEDIA_AGENT_DIR:?MEDIA_AGENT_DIR is required}"
: "${MANIFEST_PATH:?MANIFEST_PATH is required}"
# Host identity pin: Runtime resolves machine identity as VBMF_MACHINE_ID >
# /etc/machine-id (se01d policy). The BMD v5 manifest pins the legacy
# "10.30.15.10" form, so the harness must assert the identity explicitly; with
# no env the Runtime falls back to /etc/machine-id, rejects the manifest
# (ManifestEnvironmentMismatch) and degrades to a single-input session.
: "${VBMF_MACHINE_ID:?VBMF_MACHINE_ID is required (explicit host identity pin; must equal the manifest machine_id)}"
export VBMF_MACHINE_ID
PROTECTED_PID="${PROTECTED_PID:-992634}"
DWELL="${DWELL:-28}"
REPLAY_EVERY="${REPLAY_EVERY:-5}"
if [ -n "$SMOKE_FLAG" ]; then
  [ "$DWELL" = 28 ] || { echo "smoke profile is fixed: DWELL must stay 28" >&2; exit 2; }
  [ "$REPLAY_EVERY" = 5 ] || { echo "smoke profile is fixed: REPLAY_EVERY must stay 5" >&2; exit 2; }
fi
TAG="${TAG:-$DEFAULT_TAG}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DRIVER="$ROOT/r64-probe/r64-stability-long.sh"
COLLECTOR="$ROOT/r64-probe/collect-long-v3.py"
ANALYZER="$ROOT/r64-probe/analyze-long-v3.py"
BINARY_PATH="$MEDIA_AGENT_DIR/target/debug/media-agent"
RUN_DATE="$(date +%Y-%m-%d)"
EV="$HOME/a2-8-02i-evidence/${RUN_DATE}-${TAG}"
TMP_DRIVER="/tmp/vbmf-${TAG}-soak.sh"

if [ -e "$EV" ] || [ -e "${EV}.driver.log" ] || [ -e "${EV}.driver.pid" ]; then
  echo "evidence destination exists; refusing to overwrite: $EV" >&2
  exit 2
fi

for f in "$BASE_DRIVER" "$COLLECTOR" "$ANALYZER" "$MANIFEST_PATH"; do
  test -f "$f" || { echo "required file missing: $f" >&2; exit 2; }
done
test -d "$MEDIA_AGENT_DIR" || { echo "MEDIA_AGENT_DIR missing: $MEDIA_AGENT_DIR" >&2; exit 2; }
# Fail fast (before the driver starts Runtime) when the asserted identity does
# not match the manifest pin.
MANIFEST_MACHINE_ID=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("machine_id",""))' "$MANIFEST_PATH")
[ "$MANIFEST_MACHINE_ID" = "$VBMF_MACHINE_ID" ] || {
  echo "identity mismatch: manifest machine_id='$MANIFEST_MACHINE_ID' vs VBMF_MACHINE_ID='$VBMF_MACHINE_ID'" >&2
  exit 2
}

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
# Preserve the compatibility driver's historical bytes while making the
# temporary v3 copy refuse an existing evidence destination.
python3 - "$TMP_DRIVER" <<'PYDRIVER'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
old = 'rm -rf "$EV"; mkdir -p "$EV"'
new = 'if [ -e "$EV" ]; then echo "evidence destination exists; refusing to overwrite: $EV" >&2; exit 2; fi\nmkdir -p "$EV"'
if text.count(old) != 1:
    raise SystemExit("expected unique legacy evidence-directory initializer")
text = text.replace(old, new)
# v3 stop marker: the temporary driver touches it strictly BEFORE the
# stop_session POST (the queries.stop touch immediately precedes that POST),
# so the sidecar collector ends active-window sampling there and only records
# postrun residue after the runtime process exits.
anchor = 'touch "$EV/queries.stop"'
marker = anchor + '\n# v3: explicit stop marker for the sidecar collector (before stop_session POST)\ntouch "$EV/v3-stop.marker"'
if text.count(anchor) != 1:
    raise SystemExit("expected unique legacy queries.stop touch")
path.write_text(text.replace(anchor, marker))
PYDRIVER
chmod +x "$TMP_DRIVER"
export MEDIA_AGENT_DIR
export EVIDENCE_DIR_OVERRIDE="$EV"

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
  --stop-marker "$EV/v3-stop.marker" \
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
# shellcheck disable=SC2086  # SMOKE_FLAG is empty or the literal --smoke
python3 "$ANALYZER" "$EV" \
  --target-seconds "$TARGET_SECONDS" \
  --expected-cycles "$CYCLES" \
  --replay-every "$REPLAY_EVERY" \
  $SMOKE_FLAG \
  --write-json
ANALYZER_RC=$?
set -e

if [ "$DRIVER_RC" -ne 0 ] || [ "$COLLECTOR_RC" -ne 0 ] || [ "$ANALYZER_RC" -ne 0 ]; then
  # Smoke-only acceptance, never applied to 2h/8h/24h rungs: a fixed 120s/6-cycle
  # run cannot constitute RSS qualification evidence, so the legacy driver may
  # exit 2 with the startup-ramp rss_bounded predicate as its ONLY failure.
  # Success requires: driver_rc=2 caused solely by that RSS gate, collector_rc=0,
  # and the analyzer JSON independently confirming SMOKE_PASS_NOT_QUALIFICATION.
  SMOKE_ACCEPTED=0
  if [ -n "$SMOKE_FLAG" ] && [ "$DRIVER_RC" -eq 2 ] && [ "$COLLECTOR_RC" -eq 0 ] && [ "$ANALYZER_RC" -eq 0 ]; then
    driver_fails=$(grep -c '^FAIL ' "$EV/summary.txt" 2>/dev/null || true)
    driver_rss_fails=$(grep -c '^FAIL rss_bounded ' "$EV/summary.txt" 2>/dev/null || true)
    analyzer_verdict=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('v3_verdict',''))" "$EV/v3-summary.json" 2>/dev/null || true)
    if [ "$driver_fails" = "1" ] && [ "$driver_rss_fails" = "1" ] && [ "$analyzer_verdict" = "SMOKE_PASS_NOT_QUALIFICATION" ]; then
      SMOKE_ACCEPTED=1
      echo "smoke_accepted=1 sole_driver_failure=rss_bounded analyzer=SMOKE_PASS_NOT_QUALIFICATION" >> "$EV/v3-runner-status.txt"
      echo "harness-smoke accepted: sole driver failure is the short-run rss_bounded startup diagnostic; NOT a qualification rung"
    fi
  fi
  if [ "$SMOKE_ACCEPTED" -ne 1 ]; then
    exit 2
  fi
fi
