#!/usr/bin/env python3
"""PR-STAB-01 v3 read-only sidecar collector.

Does not command Runtime. Samples process/topology/socket facts every 30s and
records post-run residue/protected-device evidence for the v3 acceptance layer.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request


def md5(path: str | None) -> str | None:
    if not path:
        return None
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256(path: str | None) -> str | None:
    if not path:
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def proc_status(pid: int) -> dict[str, int]:
    out: dict[str, int] = {}
    for line in Path(f"/proc/{pid}/status").read_text().splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        parts = v.strip().split()
        if parts and parts[0].isdigit():
            out[k] = int(parts[0])
    return out


def fd_counts(pid: int) -> tuple[int, int]:
    root = Path(f"/proc/{pid}/fd")
    total = sockets = 0
    for entry in root.iterdir():
        total += 1
        try:
            if os.readlink(entry).startswith("socket:"):
                sockets += 1
        except OSError:
            pass
    return total, sockets


def cmdline(pid: int) -> str | None:
    try:
        return Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").decode().strip()
    except OSError:
        return None


def listeners() -> dict[str, bool]:
    wanted = {8080: False, 50051: False}
    for proc in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            lines = Path(proc).read_text().splitlines()[1:]
        except OSError:
            continue
        for line in lines:
            cols = line.split()
            if len(cols) < 4 or cols[3] != "0A":
                continue
            port = int(cols[1].split(":")[1], 16)
            if port in wanted:
                wanted[port] = True
    return {str(k): v for k, v in wanted.items()}


def get_json(url: str) -> tuple[int, float, dict]:
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            body = resp.read()
            status = resp.status
        return status, (time.monotonic() - start) * 1000.0, json.loads(body)
    except Exception:
        return 0, (time.monotonic() - start) * 1000.0, {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--evidence-dir", required=True)
    ap.add_argument("--pid-file", required=True)
    ap.add_argument("--target-seconds", type=int, required=True)
    ap.add_argument("--source-commit", required=True)
    ap.add_argument("--binary-path", required=True)
    ap.add_argument("--manifest-path", required=True)
    ap.add_argument("--driver-path")
    ap.add_argument("--protected-pid", type=int, default=992634)
    ap.add_argument("--interval", type=float, default=30.0)
    args = ap.parse_args()

    ev = Path(args.evidence_dir)
    pid_file = Path(args.pid_file)
    deadline = time.monotonic() + 180
    while not pid_file.exists() and time.monotonic() < deadline:
        time.sleep(0.25)
    if not pid_file.exists():
        raise SystemExit("pid file did not appear")
    pid = int(pid_file.read_text().strip())
    if not Path(f"/proc/{pid}").exists():
        raise SystemExit(f"runtime pid {pid} is not alive")

    protected_before = cmdline(args.protected_pid)
    identity = {
        "source_commit": args.source_commit,
        "binary_path": args.binary_path,
        "binary_md5": md5(args.binary_path),
        "manifest_path": args.manifest_path,
        "manifest_md5": md5(args.manifest_path),
        "driver_path": args.driver_path,
        "driver_sha256": sha256(args.driver_path),
        "target_seconds": args.target_seconds,
        "runtime_pid": pid,
        "protected_pid": args.protected_pid,
        "protected_cmdline_before": protected_before,
        "collector_started_epoch": time.time(),
    }
    ev.mkdir(parents=True, exist_ok=True)
    (ev / "v3-identity.json").write_text(json.dumps(identity, indent=2) + "\n")

    fields = [
        "ts", "rss_kb", "rssanon_kb", "vmdata_kb", "fd", "threads", "socket_fds",
        "health_status", "health_latency_ms", "state", "devices", "active_pipelines",
        "dropped", "clock_lost", "runtime_status", "runtime_latency_ms", "sessions",
        "inputs", "program_switch_present",
    ]
    out = ev / "v3-observations.csv"
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        while Path(f"/proc/{pid}").exists():
            try:
                st = proc_status(pid)
                fd, sockets = fd_counts(pid)
            except OSError:
                break
            hs, hlat, h = get_json("http://127.0.0.1:8080/health")
            rs, rlat, rt = get_json("http://127.0.0.1:8080/api/v1/runtime")
            sessions = rt.get("sessions") if isinstance(rt, dict) else []
            if not isinstance(sessions, list):
                sessions = []
            inputs = sum(len(s.get("inputs") or []) for s in sessions if isinstance(s, dict))
            w.writerow({
                "ts": int(time.time()),
                "rss_kb": st.get("VmRSS", -1),
                "rssanon_kb": st.get("RssAnon", -1),
                "vmdata_kb": st.get("VmData", -1),
                "fd": fd,
                "threads": st.get("Threads", -1),
                "socket_fds": sockets,
                "health_status": hs,
                "health_latency_ms": f"{hlat:.3f}",
                "state": h.get("state"),
                "devices": h.get("devices"),
                "active_pipelines": h.get("active_pipelines"),
                "dropped": h.get("dropped_bus_events"),
                "clock_lost": h.get("clock_lost_events"),
                "runtime_status": rs,
                "runtime_latency_ms": f"{rlat:.3f}",
                "sessions": len(sessions),
                "inputs": inputs,
                "program_switch_present": bool(rt.get("program_switch")) if isinstance(rt, dict) else False,
            })
            f.flush()
            time.sleep(args.interval)

    time.sleep(3)
    protected_after = cmdline(args.protected_pid)
    post = {
        "collector_finished_epoch": time.time(),
        "runtime_process_absent": not Path(f"/proc/{pid}").exists(),
        "listeners": listeners(),
        "protected_pid": args.protected_pid,
        "protected_alive_after": protected_after is not None,
        "protected_cmdline_before": protected_before,
        "protected_cmdline_after": protected_after,
        "protected_unchanged": protected_before is not None and protected_before == protected_after,
    }
    (ev / "v3-postrun.json").write_text(json.dumps(post, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
