# PR-STAB-01 — Long Stability Acceptance v3（2026-10-04）

Status: **FROZEN FOR IMPLEMENTATION / additive acceptance only**

## 1. Why v3 exists

Step 15 originally requires `30min → 2h → 8h → 24h` coverage for memory/FD/socket/pipeline/pad-probe leakage, repeated-switch drift and BMD long stability. The current `r64-stability-long.sh` is a parameterized extension of the R65 30min predicate-v2 gate: only cycle count changes while thresholds/predicates remain identical.

Audit found four material gaps:

1. rung labels are approximate cycle-count labels, not wall-clock guarantees. Historical raw samples are about 1.91h / 7.67h / 23.03h;
2. RSS `monotonic = all(next > current)` is ineffective for stair-step allocator growth. Historical 8h passed v2 at +27.4MB while terminal-half RSS slope was +4.89MB/h; 24h later failed at +86.6MB and +5.58MB/h;
3. socket/pipeline/pad-probe coverage from the original Step 15 intent is not part of the 10-predicate long-soak verdict;
4. replay, HTTP continuity/latency and clean teardown are collected but are not all gating predicates.

v3 does **not** rewrite historical verdicts and does **not** relax v2. It is an additive production-stability layer.

## 2. Acceptance layers

### Layer A — v2 compatibility gate (unchanged)

The existing ten v2 predicates remain byte-for-byte semantic requirements: bounded threads, bounded FD, RSS +50MB/non-strict-monotonic compatibility check, switch epoch +1, command executed+preserved, observed==target, frames advancing, zero drops/clock-lost, watchdog advancing, no critical events.

A historical v2 PASS stays PASS. A historical v2 FAIL stays FAIL.

### Layer B — v3 evidence integrity and real duration

For a rung to count as `2h`, `8h`, or `24h`:

- exact Runtime source commit / binary hash / manifest hash / BMD identity must be recorded;
- `samples.csv` cycles must be contiguous and complete;
- **sample first→last wall-clock span must be at least the named rung duration**;
- with DWELL=28s and fixed 0.3s post-command sleep, canonical minimum cycle counts are:
  - 2h: **256 cycles**;
  - 8h: **1019 cycles**;
  - 24h: **3055 cycles**;
- replay cadence remains every 5 cycles; switch workload is not reduced.

The old 240/960/2880-cycle runs remain comparison evidence but do not satisfy the v3 duration gate.

### Layer C — steady-state resource gate

RSS must satisfy both v2 and the new steady-state requirement:

- compute OLS slope over the **terminal half** of RSS samples in MB/hour;
- gate: `terminal_half_rss_slope <= +1.0 MB/hour`;
- rationale: known plateau runs are about +0.05/+0.06 MB/h; known failing 8h/24h are +4.89/+5.58 MB/h. +1.0 MB/h preserves >~20× healthy-noise margin while separating known bad behavior by ~5×;
- report whole-frame-like positive steps (`>=4MB`) as diagnostic evidence; do not independently fail solely on one step if terminal slope/other gates remain bounded.

FD keeps the v2 terminal rule and additionally requires `max_fd <= initial_10pct_median + 8`, preventing a large mid-run high-water leak from being hidden by a low terminal sample.

### Layer D — topology/socket observer gate (v3 sidecar)

A read-only sidecar samples every 30s without changing Runtime truth or media commands:

- process RSS/RssAnon/VmData, FD, thread and socket-FD counts;
- `/health`: HTTP 200, `state`, `devices`, `active_pipelines`, drops, clock-lost;
- `/api/v1/runtime`: HTTP 200, session count, total input count, Program Switch presence;
- current PR-STAB BMD shape must remain: devices=3, active_pipelines=3, sessions=1, inputs=2, Program Switch present;
- socket FD baseline on the current BMD is 7 with transient 8 under the existing query loop. Gate: `max_socket_fds <= initial_10pct_median + 4` and `terminal_10pct_median <= initial_10pct_median + 2`.

Sidecar observation is evidence only; it does not command or repair Runtime.

### Layer E — pad-probe/anatomy continuity gate

Diagnostic mode already emits `E4_INGEST_ANATOMY` every 30s from DeckLink source pad probes. v3 requires:

- exactly two DeckLink ingest handles for this dual-input acceptance shape;
- video/audio buffer counters strictly advance per handle across snapshots;
- `no_pts=0`, `pts_backward=0`, `sizes_overflow=0`, `meta_overflow=0`;
- per-handle video observation rate remains within **20–30 buffers/s** for the current 1080p25 acceptance format. This catches stalled observation and duplicate-probe amplification without introducing a new Runtime counter.

This is the available pad-probe continuity/amplification evidence. It does not claim generic GStreamer object-leak proof beyond this bounded acceptance shape.

### Layer F — control-plane continuity and replay gate

- every row in the existing 2s `/health` / `/runtime` query loop must return HTTP 200;
- latency gate for this bounded localhost acceptance: p99 <= 50ms and max <= 500ms. Historical healthy 2h/8h/24h p99 is ~2.0–2.1ms and max <=9.6ms; thresholds retain >20× p99 and >50× max margin while still detecting stalls well before the 2s polling cadence;
- replay count must equal `floor(cycles / REPLAY_EVERY)` and every replay must return `status.status=replayed`.

### Layer G — watchdog cadence gate

The old midpoint/end check stays in v2. v3 additionally parses `watchdog 活体观测行` timestamps:

- at least two ticks;
- no inter-tick gap >30s (observed cadence is ~10.006s, so this permits ~3× jitter but rejects long silent intervals that later recover before the old midpoint/end sample).

### Layer H — teardown / residue gate

A v3 rung cannot PASS without:

- `stop_session` response status=`executed`;
- teardown marker count >=1;
- media-agent process absent after run;
- no listeners on 8080/50051 after run;
- protected device-2 PID/argv unchanged from pre-run to post-run.

Therefore `PASS 10/10 predicates v2` alone is never sufficient for `STABILITY VERIFIED` under v3.

## 3. Rung semantics

- **2h v3 Qualification**: catches fast runaway and proves the Runtime reaches a steady plateau under the production workload.
- **8h v3 Qualification**: proves that plateau persists long enough to reject the historical +4.89MB/h pattern before spending a full day.
- **24h v3 Certification**: final production stability certificate. Only exact-binary 2h+8h+24h v3 PASS can close PR-STAB-01.

No rung has a weaker correctness standard than another; the difference is exposure duration and accumulated evidence.

## 4. Execution policy for the currently running observer-fix 8h

The currently running `6fc1b1a` 8h remains untouched and completes under v2 for historical comparability and fix-effect evidence. It does **not** become a v3-certified 8h because it began before v3 telemetry/duration requirements were frozen.

After it closes:

1. replay v3 core analysis against old 2h/8h/24h and observer-fix 2h/current 8h evidence;
2. exact-head CI for v3 tooling;
3. keep Runtime binary `3898ced3554c148150a60043cd167c19` unchanged;
4. start a fresh true-duration v3 2h (256 cycles) with sidecar;
5. PASS → v3 8h (1019 cycles);
6. PASS → v3 24h (3055 cycles);
7. only all layers PASS → `STABILITY VERIFIED`.

Any Runtime source/binary change invalidates the v3 ladder and restarts from 2h. Acceptance tooling changes after the first v3 rung require explicit reconciliation; no post-hoc gate relaxation.
