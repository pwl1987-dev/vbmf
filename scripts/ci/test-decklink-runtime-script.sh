#!/usr/bin/env bash
# Focused non-root tests for the Desktop Video RUNTIME version floor verifier.
#
# Contract: docs/phase-0.6/BMD-LOCAL-BUILD.md §1.1 and
# docs/superpowers/reports/2026-11-25-pr-stab-01-sdk-leak-attribution.md §5.1b.
# Runs entirely on the Development VM: no root, no host mutation, no network;
# runtime versions are faked with plain-text fixtures and PATH stubs.
#
# Covers:
#   - syntax of verify-decklink-runtime.sh and of this file
#   - argument validation (fail-closed before any read)
#   - version floor: 16.2a1 / 16.4 rejected, 16.5a1 / 16.5 / 16.6 accepted
#   - detection fallbacks: module NOT loaded but installed module file / installed package
#     still catch a 16.2 install (sysfs alone would miss it)
#   - nothing detected => WARN + exit 0 (host without the driver may still build)
#   - unparsable version => exit 1
#   - build-bmd.sh invokes the verifier (so every rung fails fast on a downgrade)
#   - build-bmd.sh fails CLOSED when the guard itself is missing
#
# Usage: scripts/ci/test-decklink-runtime-script.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
VERIFY="$HERE/verify-decklink-runtime.sh"
BUILD_BMD="$HERE/../../services/media-agent/scripts/build-bmd.sh"

PASS_N=0
FAIL_N=0
ok()   { printf 'ok %d - %s\n' "$((++PASS_N))" "$1"; }
notok(){ printf 'not ok %d - %s\n' "$((++FAIL_N))" "$1"; }
check() { # check <desc> <expected-status> <cmd...>
  local desc="$1" want="$2" st; shift 2
  "$@" >/dev/null 2>&1 && st=0 || st=$?
  if [ "$st" = "$want" ]; then
    ok "$desc"
  else
    notok "$desc (want exit $want, got $st)"
  fi
}

FIX="$(mktemp -d)"
# cleanup must never flip the test result (some hosts forbid rm -rf)
trap 'rm -rf "$FIX" >/dev/null 2>&1 || true' EXIT
mkfix() { # mkfix <name> <version>
  local d="$FIX/$1"; mkdir -p "$d"; printf '%s\n' "$2" > "$d/version"; printf '%s' "$d";
}

# --- syntax ---
check "bash -n verify-decklink-runtime.sh" 0 bash -n "$VERIFY"
check "bash -n self" 0 bash -n "$0"

# --- argument validation (fail-closed before any read) ---
check "invalid --min-version rejected" 2 "$VERIFY" --min-version abc
check "unknown argument rejected" 2 "$VERIFY" --nope

# --- version floor (loaded module, sysfs) ---
V162="$(mkfix v162 16.2a1)"
V164="$(mkfix v164 16.4)"
V165A="$(mkfix v165a 16.5a1)"
V165="$(mkfix v165 16.5)"
V166="$(mkfix v166 16.6)"
VBAD="$(mkfix vbad notaversion)"
check "16.2a1 rejected (leaky SDK)" 1 "$VERIFY" --sysfs-root "$V162"
check "16.4 rejected (leaky SDK)" 1 "$VERIFY" --sysfs-root "$V164"
check "16.5a1 accepted" 0 "$VERIFY" --sysfs-root "$V165A"
check "16.5 accepted" 0 "$VERIFY" --sysfs-root "$V165"
check "16.6 accepted" 0 "$VERIFY" --sysfs-root "$V166"
check "unparsable version rejected" 1 "$VERIFY" --sysfs-root "$VBAD"
check "dpkg override honoured" 0 "$VERIFY" --dpkg-version 16.5a1
check "dpkg override below floor rejected" 1 "$VERIFY" --dpkg-version 16.2a1

# --- detection fallbacks: module installed but NOT loaded (sysfs absent) ---
STUB_MOD="$FIX/stub-mod"; mkdir -p "$STUB_MOD"
printf '#!/usr/bin/env bash\nprintf "version: %%s\\n" "16.2a1"\n' > "$STUB_MOD/modinfo"
chmod +x "$STUB_MOD/modinfo"
STUB_PKG="$FIX/stub-pkg"; mkdir -p "$STUB_PKG"
printf '#!/usr/bin/env bash\necho "desktopvideo 16.2a1"\n' > "$STUB_PKG/dpkg-query"
chmod +x "$STUB_PKG/dpkg-query"
check "installed module 16.2a1 rejected even when the module is not loaded" 1 \
  env PATH="$STUB_MOD:$PATH" "$VERIFY" --sysfs-root "$FIX/absent" --module-name blackmagic --pkg-name vbmf-no-such-package
check "installed package 16.2a1 rejected when only the package reports the version" 1 \
  env PATH="$STUB_PKG:$PATH" "$VERIFY" --sysfs-root "$FIX/absent" --module-name vbmf-no-such-module --pkg-name desktopvideo
STUB_MOD_OK="$FIX/stub-mod-ok"; mkdir -p "$STUB_MOD_OK"
printf '#!/usr/bin/env bash\nprintf "version: %%s\\n" "16.5a1"\n' > "$STUB_MOD_OK/modinfo"
chmod +x "$STUB_MOD_OK/modinfo"
check "installed module 16.5a1 accepted when the module is not loaded" 0 \
  env PATH="$STUB_MOD_OK:$PATH" "$VERIFY" --sysfs-root "$FIX/absent" --module-name blackmagic --pkg-name vbmf-no-such-package
STUB_PKG_OK="$FIX/stub-pkg-ok"; mkdir -p "$STUB_PKG_OK"
printf '#!/usr/bin/env bash\necho "desktopvideo 16.5a1"\n' > "$STUB_PKG_OK/dpkg-query"
chmod +x "$STUB_PKG_OK/dpkg-query"
check "installed package 16.5a1 accepted when only the package reports the version" 0 \
  env PATH="$STUB_PKG_OK:$PATH" "$VERIFY" --sysfs-root "$FIX/absent" --module-name vbmf-no-such-module --pkg-name desktopvideo
check "nothing detected warns and exits 0 (modinfo/dpkg-query 'not found' must not abort under set -euo pipefail)" 0 \
  "$VERIFY" --sysfs-root "$FIX/absent" --module-name vbmf-no-such-module --pkg-name vbmf-no-such-package

# --- wiring: build-bmd.sh invokes the verifier ---
if grep -q 'verify-decklink-runtime.sh' "$BUILD_BMD" 2>/dev/null; then
  ok "build-bmd.sh invokes verify-decklink-runtime.sh"
else
  notok "build-bmd.sh does not invoke verify-decklink-runtime.sh"
fi

# --- fail-closed wiring: a missing guard must ABORT the build, not be skipped ---
# (behavioural, not a grep: build-bmd.sh runs for real with a stubbed cargo)
STUB="$FIX/stub"; mkdir -p "$STUB"
printf '#!/usr/bin/env bash\nexit 0\n' > "$STUB/cargo"; chmod +x "$STUB/cargo"
SDK="$FIX/sdk"; mkdir -p "$SDK"; : > "$SDK/DeckLinkAPI.h"
check "build-bmd.sh fails closed when the guard is missing" 1 \
  env RUNTIME_VERIFY="$FIX/absent-guard" DECKLINK_SDK_INCLUDE="$SDK" PATH="$STUB:$PATH" bash "$BUILD_BMD"
check "build-bmd.sh proceeds when the guard is present" 0 \
  env RUNTIME_VERIFY="$VERIFY" DECKLINK_SDK_INCLUDE="$SDK" PATH="$STUB:$PATH" bash "$BUILD_BMD"

printf '1..%d\n' "$((PASS_N + FAIL_N))"
[ "$FAIL_N" -eq 0 ] || exit 1
exit 0
