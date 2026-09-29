#!/usr/bin/env bash
# VBMF self-hosted runner verification (admin machine, read-only)
#
# Contract: docs/architecture/CI_RUNNER_STRATEGY.md §3/§4/§9
#   R1 registered  R2 identity exact  R3 online  R4 idle  R5 labels exact set
#   + repository scope report (CI-RUNNER-SCOPE-01)
#   --no-regression adds Phase-2-safe invariants after the intentional P2-B
#   workflow change: canonical main, exact required contexts, and branch
#   protection strict/force-push/delete boundaries.
#
# Requires: gh, authenticated with read access to the repository.
# The default group name is NOT hardcoded: A5 established owner_type=User
# (personal repo) so no runner-groups API surface exists; scope is proven by
# querying the repository endpoint itself + owner type readback.
#
# Usage:
#   verify-runner.sh --name vbmf-ci-01
#   verify-runner.sh --name vbmf-ci-01 --no-regression
#   verify-runner.sh --list                       # A5 baseline capture
set -euo pipefail

REPO="${VBMF_REPO:-pwl1987-dev/vbmf}"
EXPECT_LABELS="${VBMF_EXPECT_LABELS:-self-hosted,Linux,X64,vbmf,vbmf-general}"
EXPECT_CONTEXTS="${VBMF_EXPECT_CONTEXTS:-rust-format,rust-test-matrix,rust-clippy,hardware-test-compile,architecture-portability,gstreamer-build,session-lifecycle}"

NAME=""
LIST=0
NOREG=0
while [ $# -gt 0 ]; do
  case "$1" in
    --name)         NAME="${2:-}"; shift 2 ;;
    --list)         LIST=1; shift ;;
    --no-regression) NOREG=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null 2>&1 || { echo "FAIL: gh CLI required" >&2; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "FAIL: gh not authenticated" >&2; exit 2; }

# LC_ALL=C: byte-order sort to match jq's codepoint sort — locale collation
# (case folding) would order mixed-case sets like {Linux, X64, self-hosted}
# differently on the two sides and break exact-string comparison.
sort_csv() { printf '%s' "$1" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | LC_ALL=C sort | paste -sd, -; }
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILED=1; }
FAILED=0

if [ "$LIST" -eq 1 ]; then
  echo "repo=$REPO"
  gh api "repos/$REPO" --jq '"owner_type=" + .owner.type + " private=" + (.private|tostring)'
  gh api "repos/$REPO/actions/runners" \
    --jq '"total=" + (.total_count|tostring), (.runners[] | [.id, .name, .os, .status, (.busy|tostring), ([.labels[].name]|join("+"))] | @tsv)'
  exit 0
fi

[ -n "$NAME" ] || { echo "--name is required (or use --list)" >&2; exit 2; }

echo "== Runner Gate (repo=$REPO, name=$NAME) =="

ROW="$(gh api "repos/$REPO/actions/runners" \
  --jq ".runners[] | select(.name == \"${NAME}\") | [.status, (.busy|tostring), .os, ([.labels[].name] | sort | join(\",\"))] | @tsv" || true)"
if [ -z "$ROW" ]; then
  fail "R1/R2: runner '$NAME' not found in repos/$REPO/actions/runners"
  exit 1
fi
pass "R1: registered (visible via repository endpoint)"

IFS=$'\t' read -r STATUS BUSY OSNAME LABELS_SORTED <<< "$ROW"

pass "R2: identity exact (name='$NAME' matched literally)"
if [ "$STATUS" = "online" ]; then pass "R3: status=online"; else fail "R3: status=$STATUS (want online)"; fi
if [ "$BUSY" = "false" ]; then pass "R4: busy=false (idle)"; else fail "R4: busy=$BUSY (want false)"; fi
EXPECT_SORTED="$(sort_csv "$EXPECT_LABELS")"
if [ "$LABELS_SORTED" = "$EXPECT_SORTED" ]; then
  pass "R5: labels exact set {$LABELS_SORTED}"
else
  fail "R5: labels set mismatch: got {$LABELS_SORTED} want {$EXPECT_SORTED} (exact set, contains-style match is not accepted)"
fi
if [ "$OSNAME" = "Linux" ]; then pass "R5b: os=Linux"; else fail "R5b: os=$OSNAME (want Linux)"; fi

echo "== Scope Contract (CI-RUNNER-SCOPE-01) =="
OWNER_TYPE="$(gh api "repos/$REPO" --jq .owner.type)"
echo "scope source: repository endpoint repos/$REPO/actions/runners (runner is repo-scoped by construction)"
echo "owner_type=$OWNER_TYPE (A5 baseline: User; no org runner-groups API surface => group name: N/A)"
if [ "$OWNER_TYPE" = "User" ]; then pass "scope: personal-account repo, no org-wide registration possible"; else
  echo "INFO: owner is an Organization — verify runner group membership before Phase 2"; fi

if [ "$NOREG" -eq 1 ]; then
  echo "== No-Regression Gate (Phase 2 safety invariants) =="
  DEFAULT_BRANCH="$(gh api "repos/$REPO" --jq .default_branch)"
  if [ "$DEFAULT_BRANCH" = "main" ]; then pass "N1: canonical/default branch=main"; else fail "N1: default branch=$DEFAULT_BRANCH (want main)"; fi

  PROTECTION_API="repos/$REPO/branches/main/protection"
  CTX="$(gh api -H "Accept: application/vnd.github+json" "$PROTECTION_API" --jq '.required_status_checks.contexts | sort | join(",")')"
  EXPECT_CTX_SORTED="$(sort_csv "$EXPECT_CONTEXTS")"
  if [ "$CTX" = "$EXPECT_CTX_SORTED" ]; then pass "N2: 7 required contexts unchanged"; else fail "N2: required contexts changed: got {$CTX} want {$EXPECT_CTX_SORTED}"; fi

  STRICT="$(gh api -H "Accept: application/vnd.github+json" "$PROTECTION_API" --jq '.required_status_checks.strict')"
  FORCE="$(gh api -H "Accept: application/vnd.github+json" "$PROTECTION_API" --jq '.allow_force_pushes.enabled')"
  DELETE="$(gh api -H "Accept: application/vnd.github+json" "$PROTECTION_API" --jq '.allow_deletions.enabled')"
  if [ "$STRICT" = "true" ] && [ "$FORCE" = "false" ] && [ "$DELETE" = "false" ]; then
    pass "N3: main protection strict=true, force-push=false, deletion=false"
  else
    fail "N3: main protection drift: strict=$STRICT force-push=$FORCE deletion=$DELETE"
  fi
fi

echo "=="
if [ "$FAILED" -eq 0 ]; then echo "RESULT: PASS"; else echo "RESULT: FAIL"; exit 1; fi
