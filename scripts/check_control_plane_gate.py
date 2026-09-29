#!/usr/bin/env python3
"""Control-plane boundary gate (CONTROL-PLANE-ENTRY-01 / CP-01A).

Machine-checked red lines that back the frozen planning matrix:

  F12 (Gate A lexical, TECHNOLOGY_STACK F9 + Deployment SoT):
      apps/api (Fastify Control Plane) must never import/require
      child_process, call spawn/exec-style process launchers, or reference
      ffmpeg / gst-launch / DeckLink / /dev/blackmagic. Media process
      lifecycle belongs to the Rust media-agent alone; the control plane
      only commands + observes.

  F11 (deployment wiring, RCE-D3 R-a..R-f):
      - no compose file (BASE or any overlay) publishes host port 50051;
      - BASE compose wires media-agent with MEDIA_AGENT_RPC_BIND on the
        container-private network and exposes 50051 alongside the 8080
        health listener;
      - the fastify service points at the internal JSON-RPC control plane
        (media-agent:50051), never at the 8080 health listener;
      - Nginx never routes /internal and never references 50051.

Exit codes: 0 = pass, 1 = violations found. Output is plain text with
file:line anchors, safe for CI annotations.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

COMPOSE_FILES = [
    "ops/docker-compose.yml",
    "ops/compose.dev.yml",
    "ops/compose.acceptance.yml",
    "ops/compose.prod.yml",
    "ops/compose.software-acceptance.yml",
    "ops/compose.bmd-acceptance.yml",
]
BASE_COMPOSE = "ops/docker-compose.yml"
BMD_OVERLAY = "ops/compose.bmd-acceptance.yml"
SOFTWARE_OVERLAY = "ops/compose.software-acceptance.yml"
NGINX_DIR = "ops/nginx"
CONTROL_PLANE_DIR = "apps/api"

# F12: lexical red lines for the Fastify control plane.
FORBIDDEN_SUBSTRINGS = [
    "child_process",
    "ffmpeg",
    "gst-launch",
    "/dev/blackmagic",
    "DeckLink",
]
# F12: lexical red lines for the Fastify control plane. `(?<![.\w])` keeps
# legitimate method calls (e.g. RegExp.prototype.exec) out of scope.
FORBIDDEN_CALLS = re.compile(r"(?<![.\w])(spawn|spawnSync|execSync|execFile|exec)\s*\(")

SOURCE_SUFFIXES = {".ts", ".js", ".mjs", ".cjs"}


def strip_js_comments(text: str) -> str:
    """Remove // line comments and /* */ blocks (heuristic, good enough
    for a lexical gate that must not flag documentation-only mentions)."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def gate_f12(violations: list[str]) -> None:
    root = REPO / CONTROL_PLANE_DIR
    if not root.is_dir():
        violations.append(f"F12: {CONTROL_PLANE_DIR}/ does not exist")
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
            continue
        rel = path.relative_to(REPO)
        if "node_modules" in path.parts or "dist" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for needle in FORBIDDEN_SUBSTRINGS:
            if needle in text:
                violations.append(f"F12: {rel}: forbidden token {needle!r}")
        code = strip_js_comments(text)
        m = FORBIDDEN_CALLS.search(code)
        if m:
            violations.append(f"F12: {rel}: forbidden process-launch call {m.group(1)}(")


def iter_ports_entries(text: str, rel: str, violations: list[str]):
    """Yield (lineno, port_entry) for every compose short/long ports item."""
    in_ports = False
    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if re.match(r"^ports:\s*$", stripped):
            in_ports = True
            continue
        if in_ports:
            if stripped.startswith("-"):
                entry = stripped.lstrip("- ").strip().strip('"').strip("'")
                yield i, entry
            elif stripped and not stripped.startswith("#"):
                in_ports = False


def gate_f11_compose(violations: list[str]) -> None:
    for name in COMPOSE_FILES:
        path = REPO / name
        if not path.is_file():
            violations.append(f"F11: {name}: expected compose file missing")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, entry in iter_ports_entries(text, name, violations):
            if "50051" in entry:
                violations.append(
                    f"F11: {name}:{lineno}: host publish of 50051 is forbidden ({entry})"
                )

    base = REPO / BASE_COMPOSE
    text = base.read_text(encoding="utf-8", errors="replace")
    if "MEDIA_AGENT_RPC_BIND: 0.0.0.0:50051" not in text:
        violations.append(
            "F11: ops/docker-compose.yml: media-agent must set "
            "MEDIA_AGENT_RPC_BIND: 0.0.0.0:50051 (container-private network)"
        )
    if "MEDIA_AGENT_RPC_URL: http://media-agent:50051" not in text:
        violations.append(
            "F11: ops/docker-compose.yml: fastify must set "
            "MEDIA_AGENT_RPC_URL: http://media-agent:50051"
        )
    if "MEDIA_AGENT_RPC:" in text:
        violations.append(
            "F11: ops/docker-compose.yml: stale MEDIA_AGENT_RPC placeholder "
            "(8080 health listener was never the control plane)"
        )
    m = re.search(r"MEDIA_AGENT_RPC_URL:\s*(\S+)", text)
    if m and ":8080" in m.group(1):
        violations.append(
            "F11: ops/docker-compose.yml: MEDIA_AGENT_RPC_URL must not target "
            "the 8080 health listener"
        )


def gate_cp01c_security(violations: list[str]) -> None:
    """CP-01C security red lines (planning C11):

    - the CP-01B dev principal stub header must not exist anywhere in
      apps/api/src code (comments stripped, same heuristic as F12) — the
      production path is Better Auth API-key authn only, no dev bypass;
    - the base compose fastify service must require BETTER_AUTH_SECRET
      (fail-closed: the auth layer cannot silently boot unconfigured).
    """
    root = REPO / CONTROL_PLANE_DIR / "src"
    if not root.is_dir():
        violations.append(f"CP01C: {CONTROL_PLANE_DIR}/src/ does not exist")
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
            continue
        if "node_modules" in path.parts or "dist" in path.parts:
            continue
        rel = path.relative_to(REPO)
        text = path.read_text(encoding="utf-8", errors="replace")
        code = strip_js_comments(text)
        if "x-dev-principal" in code:
            violations.append(
                f"CP01C: {rel}: dev principal stub header must not appear in "
                "production source (CP-01C removed the dev bypass)"
            )
    base = REPO / BASE_COMPOSE
    text = base.read_text(encoding="utf-8", errors="replace")
    fastify_block = text.split("fastify:", 1)
    if len(fastify_block) == 1 or "BETTER_AUTH_SECRET" not in fastify_block[-1]:
        violations.append(
            "CP01C: ops/docker-compose.yml: fastify service must require "
            "BETTER_AUTH_SECRET (fail-closed auth layer)"
        )


def gate_f11_nginx(violations: list[str]) -> None:
    root = REPO / NGINX_DIR
    if not root.is_dir():
        violations.append(f"F11: {NGINX_DIR}/ does not exist")
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(REPO)
        text = path.read_text(encoding="utf-8", errors="replace")
        for i, line in enumerate(text.splitlines(), start=1):
            if re.search(r"location[^{]*\b/internal", line):
                violations.append(f"F11: {rel}:{i}: Nginx must never route /internal")
            if "50051" in line:
                violations.append(f"F11: {rel}:{i}: Nginx must never reference 50051")


def gate_wce_bmd_web_console(violations: list[str]) -> None:
    """WEB-CONSOLE-BMD-ACCEPTANCE-01 red lines.

    BMD acceptance must exercise the REAL production Web Console, not the
    CP-01E-era placeholder (kept only as Git history at 70ff46a):

    - no acceptance overlay may override the base `web` service (the
      placeholder pattern was `image: nginx` + web-placeholder.conf mount);
    - ops/acceptance/web-placeholder.conf must not exist in the live tree;
    - the BASE web service builds ops/Dockerfile.web and serves 5173;
    - Nginx routes `/` to the web upstream (web:5173);
    - the BMD overlay fastify keeps targeting the native host agent bridge
      (${MEDIA_AGENT_RPC_HOST}:50051), never the compose media-agent service.
    """
    for name in (BMD_OVERLAY, SOFTWARE_OVERLAY):
        path = REPO / name
        if not path.is_file():
            violations.append(f"WCE-BMD: {name}: expected compose file missing")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if "./acceptance/web-placeholder.conf" in text:
            violations.append(
                f"WCE-BMD: {name}: placeholder web console mount is forbidden "
                "(real Web Console required since WEB-CONSOLE-ENTRY-01)"
            )
        for i, line in enumerate(text.splitlines(), start=1):
            if re.match(r"^  web:\s*$", line):
                violations.append(
                    f"WCE-BMD: {name}:{i}: overlay must not override the base "
                    "web service (acceptance uses ops/Dockerfile.web)"
                )
    if (REPO / "ops/acceptance/web-placeholder.conf").exists():
        violations.append(
            "WCE-BMD: ops/acceptance/web-placeholder.conf must not exist in "
            "the live tree (CP-01E placeholder is Git history only)"
        )

    base_text = (REPO / BASE_COMPOSE).read_text(encoding="utf-8", errors="replace")
    if "dockerfile: ops/Dockerfile.web" not in base_text:
        violations.append(
            "WCE-BMD: ops/docker-compose.yml: web must build ops/Dockerfile.web "
            "(production Vite Web Console)"
        )
    if '"5173"' not in base_text:
        violations.append(
            "WCE-BMD: ops/docker-compose.yml: web must expose 5173 (nginx upstream)"
        )

    nginx_path = REPO / NGINX_DIR / "default.conf"
    nginx = nginx_path.read_text(encoding="utf-8", errors="replace")
    if "server web:5173;" not in nginx:
        violations.append("WCE-BMD: ops/nginx/default.conf: upstream web must be web:5173")
    if re.search(r"location / \{[\s\S]*?proxy_pass http://web/;", nginx) is None:
        violations.append(
            "WCE-BMD: ops/nginx/default.conf: location / must proxy to the web upstream"
        )

    bmd = (REPO / BMD_OVERLAY).read_text(encoding="utf-8", errors="replace")
    if "MEDIA_AGENT_RPC_HOST" not in bmd or ":50051" not in bmd:
        violations.append(
            "WCE-BMD: compose.bmd-acceptance.yml: fastify must target the native "
            "host agent bridge (${MEDIA_AGENT_RPC_HOST}:50051)"
        )
    if "http://media-agent:50051" in bmd:
        violations.append(
            "WCE-BMD: compose.bmd-acceptance.yml: must not target the compose "
            "media-agent service (native BMD systemd lane owns the device truth)"
        )


def gate_pr01a_core_dependency_rule(violations: list[str]) -> None:
    """PR-01A Production Core Dependency Rule (planning §4, 2026-09-29 frozen).

    "no current consumer != production core dependency" — machine-checked
    structure so the compose truth cannot silently regress:

      - the four optional services carry profiles: rustfs=storage,
        srs=gateway, cache/worker=worker;
      - the core services (db/fastify/web/media-agent/nginx) carry NO
        profiles (started by default);
      - the fastify service must NOT depend on cache/rustfs/srs (apps/api
        has zero consumers for them) and must not carry their env wiring;
      - the worker healthcheck contract line stays (honest placeholder
        fail, no fake green).
    """
    base = REPO / BASE_COMPOSE
    text = base.read_text(encoding="utf-8", errors="replace")

    def service_block(name: str) -> str | None:
        m = re.search(rf"^  {re.escape(name)}:\s*$", text, flags=re.M)
        if m is None:
            return None
        rest = text[m.end():]
        nxt = re.search(r"^  [A-Za-z0-9_.-]+:\s*$", rest, flags=re.M)
        return rest[: nxt.start()] if nxt else rest

    expected_profiles = {
        "rustfs": "storage",
        "srs": "gateway",
        "cache": "worker",
        "worker": "worker",
    }
    core_services = ["db", "fastify", "web", "media-agent", "nginx"]
    for name, profile in expected_profiles.items():
        block = service_block(name)
        if block is None:
            violations.append(f"PR01A: {BASE_COMPOSE}: service {name} missing")
            continue
        m = re.search(r'profiles:\s*\[?"([a-z]+)"\]?', block)
        if not m or m.group(1) != profile:
            violations.append(
                f"PR01A: {BASE_COMPOSE}: {name} must declare "
                f'profiles: ["{profile}"] (optional capability service)'
            )
    for name in core_services:
        block = service_block(name)
        if block is None:
            violations.append(f"PR01A: {BASE_COMPOSE}: core service {name} missing")
            continue
        if re.search(r"^\s+profiles:", block, flags=re.M):
            violations.append(
                f"PR01A: {BASE_COMPOSE}: core service {name} must have NO "
                "profiles (core starts by default)"
            )

    fastify = service_block("fastify") or ""
    for dep in ("cache", "rustfs", "srs"):
        if re.search(rf"^\s+- {re.escape(dep)}:\s*$", fastify, flags=re.M):
            violations.append(
                f"PR01A: {BASE_COMPOSE}: fastify must not depend_on {dep} "
                "(no current consumer — Production Core Dependency Rule)"
            )
    for env in ("REDIS_HOST", "REDIS_PORT", "RUSTFS_ENDPOINT", "RUSTFS_ACCESS",
                "RUSTFS_SECRET", "SRS_API"):
        if re.search(rf"^\s+{env}:", fastify, flags=re.M):
            violations.append(
                f"PR01A: {BASE_COMPOSE}: fastify must not wire {env} "
                "(dead variable — apps/api has zero consumers)"
            )

    worker = service_block("worker") or ""
    if "/health/worker" not in worker:
        violations.append(
            f"PR01A: {BASE_COMPOSE}: worker must keep its /health/worker "
            "healthcheck contract (honest placeholder failure)"
        )


def main() -> int:
    violations: list[str] = []
    gate_f12(violations)
    gate_f11_compose(violations)
    gate_f11_nginx(violations)
    gate_cp01c_security(violations)
    gate_wce_bmd_web_console(violations)
    gate_pr01a_core_dependency_rule(violations)
    if violations:
        print("control-plane gate: FAIL")
        for v in violations:
            print(f"  - {v}")
        return 1
    print(
        "control-plane gate: PASS (F11 deployment wiring + F12 Gate A lexical + "
        "CP01C security + WCE-BMD real-web-console + PR01A core dependency rule)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
