#!/usr/bin/env bash
# VBMF Desktop Video RUNTIME version floor verification (read-only, non-mutating, no root).
#
# Why: the DeckLink Linux SDK leaks ~16.3 bytes per delivered video frame in
# Desktop Video <= 16.2a1 (operator new(nothrow) inside libDeckLinkAPI.so), which
# grows the Runtime RSS ~4-6 MB/h and fails the PR-STAB-01 v3_rss_terminal_plateau
# gate (terminal-half slope > 1.0 MB/h). 16.5a1 no longer leaks (measured: 0.12 MB/h).
# Upstream does NOT disclose this fix (16.5 readme lists only UltraStudio Express HD),
# so a machine provisioned with 16.4 would silently regress. This gate makes a
# downgraded acceptance host fail in seconds instead of wasting a 24 h rung.
#
# Contract: docs/phase-0.6/BMD-LOCAL-BUILD.md §1.1 (runtime floor) and
# docs/superpowers/reports/2026-11-25-pr-stab-01-sdk-leak-attribution.md §5.1b.
#
# Version detection order (first hit wins):
#   1. --dpkg-version <V>            (explicit override)
#   2. $SYSFS_ROOT/version           (loaded kernel module; absent when the module is unloaded)
#   3. modinfo <module> version:     (installed module FILE; works while the module is unloaded)
#   4. dpkg-query -W <pkg>           (installed package version; works even without the .ko)
#   5. none detected                 => WARN + exit 0 (host without the driver may still build)
# Steps 3-4 matter: on an acceptance host the module can be installed but not loaded, and
# then sysfs is absent — checking sysfs alone would let an old 16.2 install pass.
#
# Prints version strings only — never proprietary payload hashes.
#
# Usage:
#   verify-decklink-runtime.sh
#   verify-decklink-runtime.sh --min-version 16.5
#   verify-decklink-runtime.sh --sysfs-root /fixture/sys --dpkg-version 16.5a1
#   verify-decklink-runtime.sh --module-name blackmagic --pkg-name desktopvideo
set -euo pipefail

MIN_VERSION="16.5"
SYSFS_ROOT="/sys/module/blackmagic"
DPKG_VERSION=""
MODULE_NAME="blackmagic"
PKG_NAME="desktopvideo"
while [ $# -gt 0 ]; do
  case "$1" in
    --min-version)   MIN_VERSION="${2:-}"; shift 2 ;;
    --sysfs-root)    SYSFS_ROOT="${2:-}"; shift 2 ;;
    --dpkg-version)  DPKG_VERSION="${2:-}"; shift 2 ;;
    --module-name)   MODULE_NAME="${2:-}"; shift 2 ;;
    --pkg-name)      PKG_NAME="${2:-}"; shift 2 ;;
    -h|--help)
      echo "usage: $0 [--min-version X.Y] [--sysfs-root DIR] [--dpkg-version V] [--module-name M] [--pkg-name P]"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

printf '%s' "$MIN_VERSION" | grep -Eq '^[0-9]+\.[0-9]+$' \
  || { echo "invalid min version: $MIN_VERSION" >&2; exit 2; }

# numeric major.minor compare (a build suffix such as a1 is not ordered: BMD
# ships 16.2a1 / 16.5a1, and a plain 16.5 is the stable of the same series).
num_ge() { # num_ge <a> <b>  -> 0 if a >= b
  local a_major a_minor b_major b_minor
  a_major="${1%%.*}"; a_minor="${1#*.}"; a_minor="${a_minor%%[!0-9]*}"; a_minor="${a_minor:-0}"
  b_major="${2%%.*}"; b_minor="${2#*.}"; b_minor="${b_minor%%[!0-9]*}"; b_minor="${b_minor:-0}"
  [ "$a_major" -gt "$b_major" ] && return 0
  [ "$a_major" -lt "$b_major" ] && return 1
  [ "$a_minor" -ge "$b_minor" ]
}

runtime_version=""
runtime_source=""
if [ -n "$DPKG_VERSION" ]; then
  runtime_version="$DPKG_VERSION"
  runtime_source="--dpkg-version override"
elif [ -r "$SYSFS_ROOT/version" ]; then
  runtime_version="$(cat "$SYSFS_ROOT/version")"
  runtime_source="sysfs $SYSFS_ROOT/version"
else
  # module not loaded (or no sysfs): fall back to the INSTALLED module file, then the
  # installed package version. Both are read-only and require nothing to be loaded.
  if command -v modinfo >/dev/null 2>&1; then
    runtime_version="$(modinfo "$MODULE_NAME" 2>/dev/null | sed -n 's/^version:[[:space:]]*//p' | head -1 || true)"
    [ -n "$runtime_version" ] && runtime_source="modinfo $MODULE_NAME"
  fi
  if [ -z "$runtime_version" ] && command -v dpkg-query >/dev/null 2>&1; then
    runtime_version="$(dpkg-query -W "$PKG_NAME" 2>/dev/null | awk '{print $2}' | head -1 || true)"
    [ -n "$runtime_version" ] && runtime_source="dpkg package $PKG_NAME"
  fi
  if [ -z "$runtime_version" ]; then
    echo "WARN: Desktop Video runtime not detected (no $SYSFS_ROOT/version, no modinfo $MODULE_NAME, no package $PKG_NAME)" >&2
    echo "WARN: Desktop Video >= $MIN_VERSION is required for acceptance runs (per-frame leak <= 16.2)" >&2
    exit 0
  fi
fi

runtime_numeric="${runtime_version%%[!0-9.]*}"
runtime_numeric="${runtime_numeric%.}"
if [ -z "$runtime_numeric" ]; then
  echo "FAIL: unparsable Desktop Video runtime version: $runtime_version" >&2
  exit 1
fi

if ! num_ge "$runtime_numeric" "$MIN_VERSION"; then
  echo "FAIL: Desktop Video runtime $runtime_version < $MIN_VERSION (source: $runtime_source)" >&2
  echo "FAIL: Desktop Video <= 16.2 leaks ~16.3 B per delivered video frame; the Runtime RSS" >&2
  echo "FAIL: then grows ~4-6 MB/h and the PR-STAB-01 plateau gate cannot pass on this host." >&2
  exit 1
fi

echo "Desktop Video runtime $runtime_version >= $MIN_VERSION (ok, source: $runtime_source)"
exit 0
