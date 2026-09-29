#!/usr/bin/env python3
"""WEB-CONSOLE-ENTRY-01 same-origin client red-line gate.

Machine-checked enforcement of the §3.79 + §6 frozen constraints on the
Web Console client source (apps/web-console/). Fails CI if any forbidden
pattern appears in committed source:

  - Direct agent host references: media-agent, 127.0.0.1:<agent-port>,
    :50051, /internal/, agent:50051, fastify host/port outside same-origin.
  - Credential persistence: localStorage / sessionStorage / document.cookie
    / cookie string usage that could carry the api key.
  - VITE_API_BASE / VITE_WS_BASE / VITE_EVENTS_BASE: production code must
    use relative paths; these envs would let developers accidentally
    bypass Nginx same-origin routing.

Exit codes: 0 = pass, 1 = violations found.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WEB_CONSOLE = REPO / "apps" / "web-console"

# Forbidden substrings in any TS/TSX source under apps/web-console/.
# Comments are stripped first to avoid false positives on documentation
# that explicitly mentions the red line (e.g. tests asserting the gate).
FORBIDDEN_SUBSTRINGS = [
    "media-agent:50051",
    ":50051",
    "/internal/v1/agent",
    "localhost:50051",
    "127.0.0.1:50051",
    "VITE_API_BASE",
    "VITE_WS_BASE",
    "VITE_EVENTS_BASE",
    "localStorage.setItem",
    "localStorage.getItem",
    "sessionStorage.setItem",
    "sessionStorage.getItem",
    "document.cookie",
]

# Vite bundle output & node_modules / dist / coverage excluded.
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".cjs"}
EXCLUDE_DIRS = {"node_modules", "dist", "coverage", ".vite"}


def strip_js_comments(text: str) -> str:
    """Heuristic JS/TS comment stripper — good enough for a lexical gate that
    must not flag documentation-only mentions."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"//[^\n]*", "", text)
    return text


def walk_files() -> list[Path]:
    out: list[Path] = []
    if not WEB_CONSOLE.is_dir():
        return out
    for path in sorted(WEB_CONSOLE.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix not in SOURCE_SUFFIXES:
            continue
        if any(excluded in path.parts for excluded in EXCLUDE_DIRS):
            continue
        out.append(path)
    return out


def main() -> int:
    violations: list[str] = []
    for path in walk_files():
        rel = path.relative_to(REPO)
        text = path.read_text(encoding="utf-8", errors="replace")
        stripped = strip_js_comments(text)
        for needle in FORBIDDEN_SUBSTRINGS:
            if needle not in stripped:
                continue
            # Allow tests that explicitly assert the gate catches the pattern
            # (these are self-defending regressions). Tests may live under
            # apps/web-console/test/ and use `await expect(...).rejects.toThrow(/red line/)`
            # which is a positive assertion, not production source.
            if "test/" in str(rel):
                for line in text.splitlines():
                    if needle in line and ("rejects" in line or "test(" in line or "it(" in line or "expect" in line):
                        break
                else:
                    violations.append(f"{rel}: forbidden substring {needle!r}")
                continue
            # Allow client.ts static FORBIDDEN_PATTERNS array used to REJECT
            # the patterns at runtime — this is self-defending source.
            if rel.name == "client.ts":
                # Look for the FORBIDDEN_PATTERNS array context (sentinel).
                if "FORBIDDEN_PATTERNS" in text and needle in text.split("FORBIDDEN_PATTERNS")[1].split("];")[0]:
                    continue
            violations.append(f"{rel}: forbidden substring {needle!r}")
    if violations:
        print("WCE-01 same-origin client red-line gate FAILED:")
        for v in violations:
            print(f"  - {v}")
        return 1
    print("WCE-01 same-origin client red-line gate PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
