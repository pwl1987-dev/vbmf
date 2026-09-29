#!/usr/bin/env bash
# VBMF self-hosted GitHub Actions runner provision script (Phase 1, v1.2)
#
# Contract: docs/architecture/CI_RUNNER_STRATEGY.md
#   - CI-RUNNER-PROV-01: fail-closed by default (existing .runner => FAIL);
#     --reinstall runs the full safety chain (never "delete dir and reinstall").
#   - CI-RUNNER-SYSTEMD-01: this script does NOT call `svc.sh install`.
#     Lifecycle belongs solely to actions-runner-vbmf@<name>.service.
#   - CI-RUNNER-SEC-01: RUNNER_TOKEN is read from the environment only,
#     never echoed, never written to any file. Proxy vars are never persisted
#     by this script into systemd units / .env; --runner-proxy only supplies
#     transient env to config.sh (the runner persists its own config).
#   - CI-RUNNER-NET-01: downloads honor VBMF_CI_PROXY (per-command), the
#     proxy address is never hardcoded here.
#
# Usage (root):
#   RUNNER_TOKEN=<fresh-token> ./provision-runner.sh --name vbmf-ci-01 [--labels vbmf,vbmf-general]
#   RUNNER_TOKEN=<fresh-token> ./provision-runner.sh --name vbmf-ci-01 --reinstall
#
set -euo pipefail

REPO_SLUG="pwl1987-dev/vbmf"
REPO_URL="https://github.com/${REPO_SLUG}"
BASE_DIR="/data/actions-runners/vbmf"
RUNNER_USER="vbmf-ci"
RUNNER_SHELL="/usr/sbin/nologin"
API_LATEST="https://api.github.com/repos/actions/runner/releases/latest"
# Contract §3 exact set: {self-hosted, linux, x64, vbmf, vbmf-general} — the
# three platform labels are added by registration; we must supply vbmf + tier.
LABEL_DEFAULT="vbmf,vbmf-general"

NAME=""
LABELS="$LABEL_DEFAULT"
REINSTALL=0
RUNNER_VERSION=""
RUNNER_PROXY=""

log()  { printf '[provision] %s\n' "$*"; }
fail() { printf '[provision] FAIL: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: provision-runner.sh --name <runner-name> [options]

Options:
  --name <name>          runner name, e.g. vbmf-ci-01 (required; [a-z0-9-]+)
  --labels <labels>      comma-separated CUSTOM labels only (default: vbmf,vbmf-general).
                         self-hosted/linux/x64 are added by registration and
                         verified server-side; do not pass them here.
  --reinstall            full safety chain: stop unit -> config.sh remove ->
                         (API absent if gh available) -> wipe -> re-provision.
  --runner-version <ver> pin runner version (default: latest via GitHub API)
  --runner-proxy <url>   Managed HTTP proxy for runner runtime. Must be a
                         credential-free loopback URL (127.0.0.1/localhost);
                         KVM guests need a host-local forward first. Written
                         to runner .env (0600). SOCKS is not supported.

Env:
  RUNNER_TOKEN     registration token (required; never echoed)
  VBMF_CI_PROXY    HTTP proxy for downloads in this script only (optional)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --name)           NAME="${2:-}"; shift 2 ;;
    --labels)         LABELS="${2:-}"; shift 2 ;;
    --reinstall)      REINSTALL=1; shift ;;
    --runner-version) RUNNER_VERSION="${2:-}"; shift 2 ;;
    --runner-proxy)   RUNNER_PROXY="${2:-}"; shift 2 ;;
    -h|--help)        usage; exit 0 ;;
    *)                usage; fail "unknown argument: $1" ;;
  esac
done

[ -n "$NAME" ] || { usage; fail "--name is required"; }
printf '%s' "$NAME" | grep -Eq '^[a-z0-9][a-z0-9-]*$' \
  || fail "invalid runner name '$NAME' (allowed: [a-z0-9-])"
[ "$(id -u)" -eq 0 ] || fail "must run as root (creates user/dirs, drops to $RUNNER_USER for config.sh)"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
command -v runuser >/dev/null 2>&1 || fail "runuser is required"
[ -n "${RUNNER_TOKEN:-}" ] || fail "RUNNER_TOKEN env is required (fresh token; never logged by this script)"

# proxy guards (CI-RUNNER-NET-01)
CURL_OPTS=()
if [ -n "${VBMF_CI_PROXY:-}" ]; then
  CURL_OPTS+=(--proxy "$VBMF_CI_PROXY")
fi
if [ -n "$RUNNER_PROXY" ]; then
  printf '%s' "$RUNNER_PROXY" | grep -Eq '^http://(127\.0\.0\.1|localhost):[0-9]{1,5}/?$' \
    || fail "--runner-proxy must be credential-free loopback HTTP (127.0.0.1/localhost + port)"
  _proxy_port="${RUNNER_PROXY%/}"
  _proxy_port="${_proxy_port##*:}"
  [ "$_proxy_port" -ge 1 ] && [ "$_proxy_port" -le 65535 ] \
    || fail "--runner-proxy port out of range"
fi

RUNNER_DIR="${BASE_DIR}/runners/${NAME}"
case "$RUNNER_DIR" in
  "${BASE_DIR}/runners/"*) : ;;
  *) fail "internal error: runner dir escaped base path" ;;
esac

# ── fail-closed / --reinstall safety chain (CI-RUNNER-PROV-01) ────────────────
UNIT="actions-runner-vbmf@${NAME}.service"

if [ "$REINSTALL" -eq 1 ]; then
  [ -f "$RUNNER_DIR/.runner" ] || fail "--reinstall: no existing install at $RUNNER_DIR (nothing to reinstall)"
  # local ownership proof: .runner agentName must match the target name
  grep -q "\"agentName\"[[:space:]]*:[[:space:]]*\"${NAME}\"" "$RUNNER_DIR/.runner" \
    || fail "--reinstall: .runner agentName does not match '$NAME'; refusing to touch this directory"
  log "--reinstall chain for $RUNNER_DIR (repo $REPO_SLUG)"
  # pre-remove server-side scope proof (frozen chain step: API must confirm the
  # runner is registered under THIS repository before anything is touched)
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    gh api "repos/${REPO_SLUG}/actions/runners" --jq ".runners[] | select(.name == \"${NAME}\")" | grep -q . \
      || fail "--reinstall: '$NAME' not listed under repos/${REPO_SLUG}/actions/runners; refusing (repository scope unproven server-side; directory NOT deleted)"
    log "pre-remove API check: '$NAME' registered under repos/${REPO_SLUG}"
  else
    log "WARN: gh not available/authed; pre-remove API scope check skipped (config.sh remove stays the authoritative ownership proof)"
  fi
  systemctl stop "$UNIT" 2>/dev/null || log "unit $UNIT not active (continuing)"
  # config.sh remove with a repo-scoped registration token is the authoritative
  # server-side removal + repository-ownership proof; it fails on bad token/runner.
  ( cd "$RUNNER_DIR" && runuser -u "$RUNNER_USER" -- env HOME="$RUNNER_DIR" \
      RUNNER_TOKEN="$RUNNER_TOKEN" ./config.sh remove --token "$RUNNER_TOKEN" ) \
    || fail "config.sh remove failed (token invalid or runner not owned by $REPO_SLUG); directory NOT deleted"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh api "repos/${REPO_SLUG}/actions/runners" --jq ".runners[] | select(.name == \"${NAME}\")" | grep -q .; then
      fail "API still lists '$NAME' after remove; directory NOT deleted"
    fi
    log "API confirms '$NAME' absent (host-side gh)"
  else
    log "WARN: gh not available/authed on host; server-side absence must be confirmed from the admin machine (verify-runner.sh)"
  fi
  rm -rf --one-file-system "$RUNNER_DIR"
  log "removed $RUNNER_DIR"
elif [ -e "$RUNNER_DIR/.runner" ]; then
  fail "$RUNNER_DIR already configured (.runner exists). Default is fail-closed; pass --reinstall for the safety chain"
fi

# ── user + directory layout ───────────────────────────────────────────────────
if ! id -u "$RUNNER_USER" >/dev/null 2>&1; then
  # --user-group: Debian/Ubuntu useradd --system alone puts the account in
  # 'nogroup' and creates no vbmf-ci group, which the chown below requires.
  useradd --system --user-group --home-dir "$BASE_DIR" --shell "$RUNNER_SHELL" "$RUNNER_USER"
  log "created system user $RUNNER_USER (shell $RUNNER_SHELL)"
fi
# guard for pre-existing accounts without a matching group (e.g. host drift)
getent group "$RUNNER_USER" >/dev/null 2>&1 || groupadd --system "$RUNNER_USER"
mkdir -p "$BASE_DIR/packages" "$BASE_DIR/runners" "$BASE_DIR/manifests/$NAME"
# vbmf-ci must be able to traverse BASE_DIR to reach runners/<name> (systemd
# WorkingDirectory resolves as that user); root keeps ownership, group grants
# traversal — packages/ itself stays root-owned (tamper guard).
chown "root:${RUNNER_USER}" "$BASE_DIR"
chmod 750 "$BASE_DIR"

# ── resolve + download runner package (record sha256; verify when published) ──
if [ -n "$RUNNER_VERSION" ]; then
  VER="$RUNNER_VERSION"
else
  log "resolving latest actions/runner release"
  RELEASE_JSON="$(curl -sS -m 30 "${CURL_OPTS[@]}" "$API_LATEST")" \
    || fail "cannot reach $API_LATEST (set VBMF_CI_PROXY if egress needs the LAN proxy)"
  VER="$(printf '%s' "$RELEASE_JSON" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"v[^"]*"' \
    | head -1 | sed 's/.*"v\([0-9.]*\)"/\1/')"
  [ -n "$VER" ] || fail "cannot parse latest runner version from API response"
fi
PKG="actions-runner-linux-x64-${VER}.tar.gz"
PKG_PATH="$BASE_DIR/packages/$PKG"
PKG_SHA256_FILE="${PKG_PATH}.sha256"

download_pkg() {
  local url="https://github.com/actions/runner/releases/download/v${VER}/${PKG}"
  log "downloading $url"
  curl -fL --retry 3 -m 600 "${CURL_OPTS[@]}" -o "$PKG_PATH" "$url" \
    || fail "download failed (set VBMF_CI_PROXY if egress needs the LAN proxy)"
}

if [ -s "$PKG_PATH" ] && [ -s "$PKG_SHA256_FILE" ]; then
  log "reusing cached package $PKG"
  ( cd "$BASE_DIR/packages" && sha256sum -c "$PKG.sha256" ) || { log "cached package checksum mismatch; re-downloading"; download_pkg; }
else
  download_pkg
fi
ACTUAL_SHA="$(sha256sum "$PKG_PATH" | awk '{print $1}')"
PUBLISHED_SHA="$(printf '%s' "${RELEASE_JSON:-}" | grep -o "${PKG}[ ,|]*[0-9a-f]\{64\}" | grep -o '[0-9a-f]\{64\}' | head -1 || true)"
if [ -n "$PUBLISHED_SHA" ]; then
  [ "$ACTUAL_SHA" = "$PUBLISHED_SHA" ] || fail "sha256 mismatch vs published checksum: got $ACTUAL_SHA want $PUBLISHED_SHA"
  log "sha256 verified against release checksum: $ACTUAL_SHA"
else
  log "sha256 recorded (no published checksum parsed for $PKG): $ACTUAL_SHA"
fi
printf '%s  %s\n' "$ACTUAL_SHA" "$PKG" > "$PKG_SHA256_FILE"

# ── extract + configure ───────────────────────────────────────────────────────
mkdir -p "$RUNNER_DIR"
tar xzf "$PKG_PATH" -C "$RUNNER_DIR"
chown -R "$RUNNER_USER:$RUNNER_USER" "$BASE_DIR/runners" "$BASE_DIR/manifests"

log "running config.sh as $RUNNER_USER (labels: $LABELS; runtime proxy: ${RUNNER_PROXY:-none})"
CONFIG_ENV=(env HOME="$RUNNER_DIR" RUNNER_TOKEN="$RUNNER_TOKEN")
if [ -n "$RUNNER_PROXY" ]; then
  # Registration also uses the same managed loopback route. Runtime ownership
  # is the application-directory .env below; systemd/workflow env stay clean.
  CONFIG_ENV+=(
    http_proxy="$RUNNER_PROXY" https_proxy="$RUNNER_PROXY"
    no_proxy="localhost,127.0.0.1"
  )
fi
( cd "$RUNNER_DIR" && runuser -u "$RUNNER_USER" -- "${CONFIG_ENV[@]}" \
    ./config.sh --unattended --url "$REPO_URL" --token "$RUNNER_TOKEN" \
      --name "$NAME" --labels "$LABELS" ) \
  || fail "config.sh failed (token expired/used? generate a fresh one)"

ACTION_CACHE_DIR="$RUNNER_DIR/.action-archive-cache"
install -d -m 700 -o "$RUNNER_USER" -g "$RUNNER_USER" "$ACTION_CACHE_DIR"
ENV_FILE="$RUNNER_DIR/.env"
ENV_TMP="$RUNNER_DIR/.env.vbmf.$$"
if [ -f "$ENV_FILE" ]; then
  grep -Ev '^(ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE|http_proxy|https_proxy|HTTP_PROXY|HTTPS_PROXY|no_proxy|NO_PROXY)=' "$ENV_FILE" > "$ENV_TMP" || true
else
  : > "$ENV_TMP"
fi
printf 'ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE=%s\n' "$ACTION_CACHE_DIR" >> "$ENV_TMP"
if [ -n "$RUNNER_PROXY" ]; then
  printf 'https_proxy=%s\nhttp_proxy=%s\nno_proxy=localhost,127.0.0.1\n' \
    "$RUNNER_PROXY" "$RUNNER_PROXY" >> "$ENV_TMP"
fi
chown "$RUNNER_USER:$RUNNER_USER" "$ENV_TMP"
chmod 600 "$ENV_TMP"
mv "$ENV_TMP" "$ENV_FILE"
log "immutable action archive cache configured; optional proxy value remains redacted"

# ── next steps (NOT executed here; CI-RUNNER-SYSTEMD-01) ──────────────────────
trap 'unset RUNNER_TOKEN' EXIT
cat <<EOF

[provision] DONE: runner '$NAME' configured under $RUNNER_DIR

Next steps (run manually; this script intentionally does NOT install services):
  diff /etc/systemd/system/actions-runner-vbmf@.service ./actions-runner-vbmf@.service || true
  cp ./actions-runner-vbmf@.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now actions-runner-vbmf@${NAME}.service
  sudo -u $RUNNER_USER ./collect-toolchain.sh --name $NAME
Then from the ADMIN machine: scripts/ci/verify-runner.sh --name $NAME
EOF
