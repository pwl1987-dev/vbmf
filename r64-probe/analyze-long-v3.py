#!/usr/bin/env python3
"""PR-STAB-01 Long Stability Acceptance v3 analyzer.

Layer A recomputes the frozen v2 predicates. Layers B-H add duration,
steady-state, topology/socket, anatomy, HTTP/replay, watchdog cadence and
teardown requirements. Historical evidence may be inspected with
--allow-missing-v3; strict certification requires all v3 evidence.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
from pathlib import Path
import re
import statistics
from typing import Any

ANSI = re.compile(r"\x1b\[[0-9;]*m")
ISO_TS = re.compile(r"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)")


def gate(name: str, ok: bool | None, note: str = "") -> dict[str, Any]:
    return {"name": name, "status": "PASS" if ok is True else "FAIL" if ok is False else "NOT_MEASURED", "note": note}


def mean(xs):
    return sum(xs) / len(xs)


def median(xs):
    return statistics.median(xs)


def quantile(xs, q: float):
    ys = sorted(xs)
    if not ys:
        return float("nan")
    return ys[min(len(ys) - 1, int((len(ys) - 1) * q))]


def ols_slope_per_hour(ts: list[int], values: list[float]) -> float:
    if len(ts) < 2:
        return float("nan")
    x = [(t - ts[0]) / 3600.0 for t in ts]
    xm, ym = mean(x), mean(values)
    den = sum((v - xm) ** 2 for v in x)
    if den == 0:
        return 0.0
    return sum((a - xm) * (b - ym) for a, b in zip(x, values)) / den


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open() as f:
        return list(csv.DictReader(f))


def json_status_executed(obj: Any) -> bool:
    return isinstance(obj, dict) and isinstance(obj.get("status"), dict) and obj["status"].get("status") == "executed"


def v2(ev: Path, rows: list[dict[str, str]], expected_cycles: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    gs: list[dict[str, Any]] = []
    ths = [int(r["threads"]) for r in rows]
    gs.append(gate("v2_threads_bounded_oscillation", max(ths)-min(ths) <= 4, f"min={min(ths)} max={max(ths)} spread={max(ths)-min(ths)}"))

    fds = [int(r["fd"]) for r in rows]
    gs.append(gate("v2_fd_bounded", mean(fds[-3:]) <= mean(fds[:3])+8, f"first3={mean(fds[:3]):.1f} last3={mean(fds[-3:]):.1f}"))

    rss = [int(r["rss_kb"]) for r in rows]
    n3 = len(rss)//3
    mono = all(rss[i+1] > rss[i] for i in range(len(rss)-1))
    first3 = mean(rss[:n3])/1024
    last3 = mean(rss[-n3:])/1024
    gs.append(gate("v2_rss_bounded", last3 <= first3+50 and not mono, f"first_third={first3:.1f}MB last_third={last3:.1f}MB delta={last3-first3:.1f}MB monotonic={mono}"))

    sws = [int(r["sw_epoch"]) for r in rows]
    consecutive = all(sws[i+1] == sws[i]+1 for i in range(len(sws)-1))
    gs.append(gate("v2_switch_epoch_per_command_plus1", consecutive and sws[0] == 1 and sws[-1] == expected_cycles, f"first={sws[0]} last={sws[-1]} expected={expected_cycles}"))

    ok_cmds = total_cmds = 0
    p = ev/"switch-responses.jsonl"
    if p.exists():
        for line in p.read_text().splitlines():
            if not line.strip(): continue
            total_cmds += 1
            j = json.loads(line)
            if json_status_executed(j) and "outcome=preserved" in (j.get("detail") or ""):
                ok_cmds += 1
    gs.append(gate("v2_switches_all_executed_preserved", total_cmds == expected_cycles and ok_cmds == expected_cycles, f"ok={ok_cmds}/{total_cmds} expected={expected_cycles}"))

    rb_ok = rb_total = 0
    pat = re.compile(r"cycle=(\d+) target=(\S+) observed=(\S+)")
    p = ev/"readbacks.txt"
    if p.exists():
        for line in p.read_text().splitlines():
            m = pat.search(line)
            if m:
                rb_total += 1
                rb_ok += int(m.group(2) == m.group(3))
    gs.append(gate("v2_observed_tracks_per_command", rb_total == expected_cycles and rb_ok == expected_cycles, f"match={rb_ok}/{rb_total} expected={expected_cycles}"))

    fv = [int(r["frames_v"]) for r in rows]; fa = [int(r["frames_a"]) for r in rows]
    frames_ok = all(fv[i+1] > fv[i] for i in range(len(fv)-1)) and all(fa[i+1] > fa[i] for i in range(len(fa)-1))
    gs.append(gate("v2_frames_advancing", frames_ok, f"v={fv[0]}->{fv[-1]} a={fa[0]}->{fa[-1]}"))

    drops_ok = all(int(r["dropped"]) == 0 and int(r["clock_lost"]) == 0 for r in rows)
    gs.append(gate("v2_drops_clock_zero", drops_ok))

    ticks = {}
    p = ev/"ticks.txt"
    if p.exists():
        for item in p.read_text().split():
            if "=" in item:
                k,v=item.split("=",1)
                try: ticks[k]=int(v)
                except ValueError: pass
    mid,end=ticks.get("tick_mid",0),ticks.get("tick_end",0)
    gs.append(gate("v2_watchdog_ticks_advancing", end > mid > 0, f"mid={mid} end={end}"))

    crit_ok = True; n_events = 0
    p = ev/"events.txt"
    if not p.exists():
        crit_ok = False
    else:
        for line in p.read_text().splitlines():
            if "critical" in line:
                n_events += 1
                if "critical=0" not in line and "critical=False" not in line:
                    crit_ok=False
    gs.append(gate("v2_events_no_critical", crit_ok, f"samples={n_events}"))
    metrics={"rss_first_third_mb":first3,"rss_last_third_mb":last3,"rss_third_delta_mb":last3-first3}
    return gs, metrics


def parse_latency(ev: Path):
    vals=[]; codes=[]
    p=ev/"latencies.txt"
    if not p.exists(): return None
    for line in p.read_text().splitlines():
        parts=line.split()
        if len(parts) >= 4 and parts[-1].endswith("s"):
            try:
                codes.append(int(parts[-2])); vals.append(float(parts[-1][:-1]))
            except ValueError: pass
    return codes,vals


def replay_gate(ev: Path, expected_cycles: int, replay_every: int):
    expected=expected_cycles//replay_every
    p=ev/"replays.jsonl"
    if not p.exists(): return gate("v3_replay_exact", False, "replays.jsonl missing")
    total=ok=0
    for line in p.read_text().splitlines():
        if not line.strip(): continue
        total += 1
        raw=line.split(" ",1)[1] if line.startswith("cycle=") and " " in line else line
        try: j=json.loads(raw)
        except json.JSONDecodeError: continue
        if isinstance(j.get("status"),dict) and j["status"].get("status") == "replayed": ok += 1
    return gate("v3_replay_exact", total==expected and ok==expected, f"replayed={ok}/{total} expected={expected}")


def watchdog_cadence(ev: Path):
    p=ev/"svc-final.log"
    if not p.exists(): p=ev/"svc.log"
    if not p.exists(): return gate("v3_watchdog_cadence", None, "svc log missing")
    ts=[]
    for line in p.read_text(errors="ignore").splitlines():
        if "watchdog 活体观测行" not in line: continue
        m=ISO_TS.search(ANSI.sub("",line))
        if m:
            ts.append(dt.datetime.fromisoformat(m.group(1).replace("Z","+00:00")).timestamp())
    if len(ts)<2: return gate("v3_watchdog_cadence", False, f"ticks={len(ts)}")
    maxgap=max(b-a for a,b in zip(ts,ts[1:]))
    return gate("v3_watchdog_cadence", maxgap <= 30.0, f"ticks={len(ts)} max_gap={maxgap:.3f}s")


def anatomy_gate(ev: Path):
    p=ev/"svc-final.log"
    if not p.exists(): p=ev/"svc.log"
    if not p.exists(): return [gate("v3_anatomy_handles", None,"svc log missing")]
    by: dict[int,list[tuple[float,dict[str,Any]]]]={}
    for line in p.read_text(errors="ignore").splitlines():
        clean=ANSI.sub("",line)
        if "E4_INGEST_ANATOMY" not in clean: continue
        tm=ISO_TS.search(clean); hm=re.search(r"handle=(\d+)",clean); am=re.search(r"anatomy=(\{.*\})",clean)
        if not (tm and hm and am): continue
        try:
            t=dt.datetime.fromisoformat(tm.group(1).replace("Z","+00:00")).timestamp(); a=json.loads(am.group(1))
        except Exception: continue
        by.setdefault(int(hm.group(1)),[]).append((t,a))
    if not by:
        return [gate("v3_anatomy_handles", None, "no E4_INGEST_ANATOMY evidence")]
    gs=[gate("v3_anatomy_handles", len(by)==2, f"handles={sorted(by)}")]
    if len(by)!=2: return gs
    all_adv=all_zero=True; rates=[]
    for h,recs in by.items():
        if len(recs)<2: all_adv=False; continue
        for plane in ("video","audio"):
            bs=[int(a[plane]["buffers"]) for _,a in recs]
            if not all(bs[i+1] > bs[i] for i in range(len(bs)-1)): all_adv=False
            for _,a in recs:
                x=a[plane]
                if any(int(x.get(k,0)) != 0 for k in ("no_pts","pts_backward","sizes_overflow","meta_overflow")): all_zero=False
        elapsed=recs[-1][0]-recs[0][0]
        if elapsed>0:
            rate=(int(recs[-1][1]["video"]["buffers"])-int(recs[0][1]["video"]["buffers"]))/elapsed
            rates.append((h,rate))
    gs.append(gate("v3_anatomy_buffers_advancing",all_adv))
    gs.append(gate("v3_anatomy_clean_counters",all_zero))
    rate_ok=len(rates)==2 and all(20.0 <= r <= 30.0 for _,r in rates)
    gs.append(gate("v3_anatomy_video_rate",rate_ok," ".join(f"h{h}={r:.2f}/s" for h,r in rates)))
    return gs


def teardown_gates(ev: Path, strict: bool):
    gs=[]
    p=ev/"stop-response.json"
    ok=False
    if p.exists():
        try: ok=json_status_executed(json.loads(p.read_text()))
        except Exception: pass
    gs.append(gate("v3_stop_session_executed",ok))
    p=ev/"teardown-line.txt"; n=0
    if p.exists():
        try: n=int(p.read_text().strip().split()[0])
        except Exception: pass
    gs.append(gate("v3_teardown_marker",n>=1,f"count={n}"))
    post=ev/"v3-postrun.json"
    if not post.exists():
        gs.extend([gate("v3_runtime_residue",None,"v3-postrun.json missing"),gate("v3_protected_device_unchanged",None,"v3-postrun.json missing")])
    else:
        j=json.loads(post.read_text()); ls=j.get("listeners") or {}
        residue=bool(j.get("runtime_process_absent")) and not bool(ls.get("8080")) and not bool(ls.get("50051"))
        gs.append(gate("v3_runtime_residue",residue,f"process_absent={j.get('runtime_process_absent')} listeners={ls}"))
        gs.append(gate("v3_protected_device_unchanged",bool(j.get("protected_alive_after")) and bool(j.get("protected_unchanged"))))
    return gs


def sidecar_gates(ev: Path, target_seconds: int):
    obs=ev/"v3-observations.csv"; ident=ev/"v3-identity.json"
    if not obs.exists() or not ident.exists():
        return [gate("v3_sidecar_present",None,"v3 observation/identity missing")]
    rows=load_csv(obs); gs=[gate("v3_sidecar_present",len(rows)>=2,f"samples={len(rows)}")]
    if len(rows)<2:return gs
    def ints(row, *keys):
        try:
            return [int(row[k]) for k in keys]
        except (KeyError, TypeError, ValueError):
            return None
    health_ok=True; topo_ok=True; zero_ok=True
    for r in rows:
        hr=ints(r,"health_status","runtime_status")
        tp=ints(r,"devices","active_pipelines","sessions","inputs")
        dz=ints(r,"dropped","clock_lost")
        health_ok = health_ok and hr == [200,200]
        topo_ok = topo_ok and tp == [3,3,1,2] and r.get("program_switch_present") == "True" and r.get("state") == "Capturing"
        zero_ok = zero_ok and dz == [0,0]
    sockets=[]
    for r in rows:
        try: sockets.append(int(r["socket_fds"]))
        except (KeyError,TypeError,ValueError): sockets.append(10**9)
    n=max(1,len(sockets)//10); base=median(sockets[:n]); tail=median(sockets[-n:])
    socket_ok=max(sockets)<=base+4 and tail<=base+2
    obs_ts=[]
    for r in rows:
        try: obs_ts.append(int(r["ts"]))
        except (KeyError,TypeError,ValueError): pass
    coverage=(obs_ts[-1]-obs_ts[0]) if len(obs_ts)>=2 else 0
    gs.append(gate("v3_sidecar_coverage", coverage >= max(0,target_seconds-60), f"coverage={coverage}s target>={max(0,target_seconds-60)}s"))
    gs.append(gate("v3_sidecar_http_200",health_ok))
    gs.append(gate("v3_topology_constant",topo_ok,"expected Capturing devices=3 pipelines=3 sessions=1 inputs=2 switch=true"))
    gs.append(gate("v3_sidecar_drop_clock_zero",zero_ok))
    gs.append(gate("v3_socket_bounded",socket_ok,f"base={base:.1f} tail={tail:.1f} max={max(sockets)}"))
    j=json.loads(ident.read_text()); hdr=(ev/"header.txt").read_text() if (ev/"header.txt").exists() else ""
    identity_ok=bool(j.get("source_commit")) and bool(j.get("binary_md5")) and bool(j.get("manifest_md5")) and j["binary_md5"] in hdr and j["manifest_md5"] in hdr
    gs.append(gate("v3_identity_pinned",identity_ok,f"source={j.get('source_commit')} binary={j.get('binary_md5')}"))
    return gs


# Harness-smoke-only profile: the only parameters --smoke may ever run with.
# A 120s/6-cycle/replay=5 run is toolchain evidence for the full
# soak->collector->analyzer->teardown chain and never a qualification rung.
SMOKE_PARAMS = (120, 6, 5)


def smoke_args_error(smoke: bool, target_seconds: int, expected_cycles: int, replay_every: int) -> str | None:
    params = (target_seconds, expected_cycles, replay_every)
    if smoke and params != SMOKE_PARAMS:
        return "--smoke accepts only the fixed harness-smoke profile: --target-seconds 120 --expected-cycles 6 --replay-every 5"
    if not smoke and params == SMOKE_PARAMS:
        return "120s/6-cycle/replay=5 is the harness-smoke profile: pass --smoke; it is not a qualification rung"
    return None


def smoke_verdict(strict_pass: bool) -> str:
    return "SMOKE_PASS_NOT_QUALIFICATION" if strict_pass else "SMOKE_FAIL"


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("evidence_dir")
    ap.add_argument("--target-seconds",type=int,required=True)
    ap.add_argument("--expected-cycles",type=int,required=True)
    ap.add_argument("--replay-every",type=int,default=5)
    ap.add_argument("--allow-missing-v3",action="store_true")
    ap.add_argument("--smoke",action="store_true",help="harness-smoke-only mode: fixed 120s/6-cycle toolchain chain check, never a qualification rung")
    ap.add_argument("--write-json",action="store_true")
    args=ap.parse_args()
    err=smoke_args_error(args.smoke,args.target_seconds,args.expected_cycles,args.replay_every)
    if err: ap.error(err)
    if args.smoke and args.allow_missing_v3: ap.error("--smoke cannot be combined with --allow-missing-v3")
    ev=Path(args.evidence_dir)
    rows=load_csv(ev/"samples.csv")
    gs,metrics=v2(ev,rows,args.expected_cycles)
    ts=[int(r["ts"]) for r in rows]; rss=[int(r["rss_kb"])/1024 for r in rows]
    contiguous=len(rows)==args.expected_cycles and all(int(r["cycle"])==i+1 for i,r in enumerate(rows))
    span=ts[-1]-ts[0]
    gs.append(gate("v3_evidence_complete",contiguous,f"rows={len(rows)} expected={args.expected_cycles}"))
    gs.append(gate("v3_wallclock_duration",span>=args.target_seconds,f"sample_span={span}s target={args.target_seconds}s"))

    h=len(rows)//2; slope=ols_slope_per_hour(ts[h:],rss[h:]); metrics["rss_terminal_half_slope_mbph"]=slope
    jumps=[rss[i]-rss[i-1] for i in range(1,len(rss)) if rss[i]-rss[i-1]>=4.0]
    metrics["rss_positive_steps_ge4mb"]=len(jumps)
    gs.append(gate("v3_rss_terminal_plateau",slope<=1.0,f"terminal_half_slope={slope:.3f}MB/h steps>=4MB={len(jumps)}"))

    fds=[int(r["fd"]) for r in rows]; n=max(3,len(fds)//10); base=median(fds[:n]); high=max(fds)
    gs.append(gate("v3_fd_highwater",high<=base+8,f"initial10pct_median={base:.1f} max={high}"))
    gs.append(replay_gate(ev,args.expected_cycles,args.replay_every))

    lat=parse_latency(ev)
    if lat is None:
        gs.append(gate("v3_http_continuity_latency",None,"latencies.txt missing"))
    else:
        codes,vals=lat; p99=quantile(vals,.99); mx=max(vals) if vals else math.inf
        ok=bool(vals) and all(c==200 for c in codes) and p99<=0.050 and mx<=0.500
        gs.append(gate("v3_http_continuity_latency",ok,f"rows={len(vals)} non200={sum(c!=200 for c in codes)} p99={p99*1000:.3f}ms max={mx*1000:.3f}ms"))
        metrics.update({"http_p99_ms":p99*1000,"http_max_ms":mx*1000})

    gs.append(watchdog_cadence(ev))
    gs.extend(anatomy_gate(ev))
    gs.extend(sidecar_gates(ev,args.target_seconds))
    gs.extend(teardown_gates(ev,not args.allow_missing_v3))

    v2_g=[g for g in gs if g["name"].startswith("v2_")]
    v2_pass=all(g["status"]=="PASS" for g in v2_g)
    missing=[g for g in gs if g["status"]=="NOT_MEASURED"]
    failed=[g for g in gs if g["status"]=="FAIL"]
    strict_pass=not failed and not missing
    if args.smoke:
        qualification=smoke_verdict(strict_pass)
    else:
        qualification="PASS" if strict_pass else "INCOMPLETE" if args.allow_missing_v3 and not failed else "FAIL"
    result={"evidence_dir":str(ev),"harness_smoke_only":args.smoke,"v2_compat_verdict":"PASS" if v2_pass else "FAIL","v3_verdict":qualification,"gates":gs,"metrics":metrics}
    for g in gs:
        print(f"{g['status']:12} {g['name']} {g['note']}")
    print(f"V2_COMPAT {'PASS' if v2_pass else 'FAIL'}")
    if args.smoke:
        print("HARNESS_SMOKE_ONLY 120s/6-cycle toolchain chain check; NOT a qualification rung")
    print(f"V3_VERDICT {qualification} (fail={len(failed)} missing={len(missing)})")
    if args.write_json:
        (ev/"v3-summary.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    return 0 if qualification in ("PASS","SMOKE_PASS_NOT_QUALIFICATION","INCOMPLETE") else 2


if __name__=="__main__":
    raise SystemExit(main())
