#!/usr/bin/env python3
from __future__ import annotations

import csv
import importlib.util
import io
import json
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock

MOD_PATH = Path(__file__).with_name("analyze-long-v3.py")
spec = importlib.util.spec_from_file_location("analyze_long_v3", MOD_PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)
ROOT = Path(__file__).resolve().parents[1]
EV = ROOT / "evidence" / "bmd-10.30.15.10"


class LongStabilityV3Tests(unittest.TestCase):
    def test_terminal_slope_plateau_vs_growth(self):
        ts = [0, 3600, 7200, 10800]
        self.assertAlmostEqual(mod.ols_slope_per_hour(ts, [100.0, 100.1, 100.0, 100.1]), 0.02, places=2)
        self.assertGreater(mod.ols_slope_per_hour(ts, [100.0, 105.0, 110.0, 115.0]), 4.9)

    def test_historical_8h_is_v2_pass_but_v3_rss_growth(self):
        d = EV / "r64-stability-8h-rerun"
        rows = mod.load_csv(d / "samples.csv")
        gates, _ = mod.v2(d, rows, 960)
        self.assertTrue(all(g["status"] == "PASS" for g in gates))
        h = len(rows) // 2
        ts = [int(r["ts"]) for r in rows]
        rss = [int(r["rss_kb"]) / 1024 for r in rows]
        slope = mod.ols_slope_per_hour(ts[h:], rss[h:])
        self.assertGreater(slope, 4.0)
        self.assertLess(ts[-1] - ts[0], 8 * 3600)

    def test_historical_24h_remains_v2_fail(self):
        d = EV / "r64-stability-24h"
        rows = mod.load_csv(d / "samples.csv")
        gates, _ = mod.v2(d, rows, 2880)
        by = {g["name"]: g["status"] for g in gates}
        self.assertEqual(by["v2_rss_bounded"], "FAIL")
        self.assertLess(int(rows[-1]["ts"]) - int(rows[0]["ts"]), 24 * 3600)

    def test_true_duration_profiles_are_conservative(self):
        # Each interval has a hard floor of DWELL(28s)+post-command sleep(0.3s).
        floor = 28.3
        for seconds, cycles in [(7200, 256), (28800, 1019), (86400, 3055)]:
            self.assertGreaterEqual((cycles - 1) * floor, seconds)

    def _sidecar_row(self, ts, steady=True, **over):
        row = {
            "ts": ts, "socket_fds": 7, "health_status": 200, "runtime_status": 200,
            "state": "Capturing", "devices": 3, "active_pipelines": 3, "sessions": 1,
            "inputs": 2, "program_switch_present": True, "dropped": 0, "clock_lost": 0,
        }
        if not steady:  # startup sample: pid file just appeared, HTTP 0/state empty
            row.update({"health_status": 0, "runtime_status": 0, "state": "",
                        "program_switch_present": False})
        row.update(over)
        return row

    def _write_sidecar_csv(self, root: Path, rows):
        fields = [
            "ts", "socket_fds", "health_status", "runtime_status", "state", "devices",
            "active_pipelines", "sessions", "inputs", "program_switch_present", "dropped", "clock_lost",
        ]
        with (root / "v3-observations.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for row in rows:
                w.writerow(row)
        (root / "v3-identity.json").write_text(json.dumps({
            "source_commit": "abc", "binary_md5": "b" * 32, "manifest_md5": "m" * 32
        }))
        (root / "header.txt").write_text(f"bin_md5={'b'*32}\nmanifest_md5={'m'*32}\n")

    def _write_sidecar_fixture(self, root: Path, second_ts: int, malformed: bool = False):
        rows = [
            self._sidecar_row(1000),
            self._sidecar_row(second_ts, devices="bad" if malformed else 3),
        ]
        self._write_sidecar_csv(root, rows)

    def test_sidecar_startup_samples_are_diagnostics_only(self):
        # BMD smoke evidence: the first sidecar sample lands when the pid file
        # just appeared (HTTP 0 / state empty). Startup samples must not fail
        # the active window; coverage is measured on the window itself.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            rows = [self._sidecar_row(1000, steady=False),
                    self._sidecar_row(1060), self._sidecar_row(1120)]
            self._write_sidecar_csv(root, rows)
            gates = {g["name"]: g for g in mod.sidecar_gates(root, 120)}
            self.assertEqual(gates["v3_sidecar_http_200"]["status"], "PASS")
            self.assertEqual(gates["v3_topology_constant"]["status"], "PASS")
            self.assertEqual(gates["v3_sidecar_drop_clock_zero"]["status"], "PASS")
            self.assertEqual(gates["v3_socket_bounded"]["status"], "PASS")
            self.assertEqual(gates["v3_sidecar_coverage"]["status"], "PASS")
            self.assertIn("warmup_samples=1 active_samples=2", gates["v3_topology_constant"]["note"])
            self.assertIn("active_window=60s", gates["v3_sidecar_coverage"]["note"])

    def test_sidecar_teardown_row_fails_closed(self):
        # Collector contract: after the stop marker no further samples may be
        # written. If a teardown-state row (active_pipelines=1 / switch=false,
        # as seen post-stop_session in the smoke evidence) does appear, the
        # active window fails closed instead of hiding it.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            rows = [self._sidecar_row(1000), self._sidecar_row(1060),
                    self._sidecar_row(1120, active_pipelines=1, program_switch_present=False)]
            self._write_sidecar_csv(root, rows)
            by = {g["name"]: g["status"] for g in mod.sidecar_gates(root, 120)}
            self.assertEqual(by["v3_topology_constant"], "FAIL")

    def test_sidecar_without_steady_state_fails_all_window_gates(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            rows = [self._sidecar_row(1000, steady=False), self._sidecar_row(1060, steady=False)]
            self._write_sidecar_csv(root, rows)
            by = {g["name"]: g["status"] for g in mod.sidecar_gates(root, 120)}
            for name in ("v3_sidecar_coverage", "v3_sidecar_http_200", "v3_topology_constant",
                         "v3_sidecar_drop_clock_zero", "v3_socket_bounded"):
                self.assertEqual(by[name], "FAIL", name)

    def test_sidecar_coverage_must_span_the_rung(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._write_sidecar_fixture(root, 1060)
            by = {g["name"]: g["status"] for g in mod.sidecar_gates(root, 7200)}
            self.assertEqual(by["v3_sidecar_coverage"], "FAIL")

    def test_sidecar_malformed_topology_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._write_sidecar_fixture(root, 8140, malformed=True)
            by = {g["name"]: g["status"] for g in mod.sidecar_gates(root, 7200)}
            self.assertEqual(by["v3_topology_constant"], "FAIL")

    def test_smoke_params_are_pinned_and_formal_profiles_unchanged(self):
        # --smoke accepts only the fixed harness-smoke profile (120s/6/replay=5).
        self.assertIsNone(mod.smoke_args_error(True, 120, 6, 5))
        for params in [(120, 6, 4), (120, 5, 5), (121, 6, 5), (7200, 6, 5), (120, 256, 5)]:
            self.assertIsNotNone(mod.smoke_args_error(True, *params), params)
        # Formal rung profiles (and historical replay cycle counts) never need --smoke.
        for params in [(7200, 256, 5), (28800, 1019, 5), (86400, 3055, 5), (7200, 240, 5), (28800, 960, 5)]:
            self.assertIsNone(mod.smoke_args_error(False, *params), params)
        # Smoke parameters without --smoke are rejected: not a qualification rung.
        self.assertIsNotNone(mod.smoke_args_error(False, 120, 6, 5))

    def test_smoke_verdict_label_is_never_pass(self):
        self.assertEqual(mod.smoke_verdict(True), "SMOKE_PASS_NOT_QUALIFICATION")
        self.assertEqual(mod.smoke_verdict(False), "SMOKE_FAIL")

    def test_runner_profiles_formal_unchanged_and_smoke_fixed(self):
        text = (ROOT / "r64-probe" / "run-long-v3.sh").read_text()
        self.assertIn("2h) TARGET_SECONDS=7200; CYCLES=256", text)
        self.assertIn("8h) TARGET_SECONDS=28800; CYCLES=1019", text)
        self.assertIn("24h) TARGET_SECONDS=86400; CYCLES=3055", text)
        self.assertIn("smoke)\n    # harness-smoke-only", text)
        self.assertIn("TARGET_SECONDS=120; CYCLES=6; SMOKE_FLAG=\"--smoke\"", text)
        self.assertIn("DEFAULT_TAG=\"pr-stab-01-v3-smoke-$(date +%H%M%S)\"", text)
        self.assertIn("evidence destination exists; refusing to overwrite", text)
        self.assertIn('if [ -e "$EV" ]; then', text)
        self.assertIn("text.count(old) != 1", text)
        self.assertIn('DWELL="${DWELL:-28}"', text)
        self.assertIn('REPLAY_EVERY="${REPLAY_EVERY:-5}"', text)
        # 6 smoke cycles still satisfy the 120s wall-clock floor.
        self.assertGreaterEqual((6 - 1) * 28.3, 120)

    def test_runner_stop_marker_and_smoke_acceptance_wiring(self):
        text = (ROOT / "r64-probe" / "run-long-v3.sh").read_text()
        # Collector receives the stop marker path.
        self.assertIn('--stop-marker "$EV/v3-stop.marker"', text)
        # Temporary driver patch touches the marker strictly before the
        # stop_session POST, anchored on the unique queries.stop touch.
        self.assertIn("expected unique legacy queries.stop touch", text)
        self.assertIn('touch "$EV/v3-stop.marker"', text)
        # Smoke-only success: driver_rc=2 solely from rss_bounded, collector
        # clean, analyzer JSON confirming SMOKE_PASS_NOT_QUALIFICATION.
        self.assertIn("grep -c '^FAIL rss_bounded '", text)
        self.assertIn('"SMOKE_PASS_NOT_QUALIFICATION"', text)
        self.assertIn("smoke_accepted=1", text)
        # The legacy v2 driver itself stays byte-unchanged: no marker there.
        legacy = (ROOT / "r64-probe" / "r64-stability-long.sh").read_text()
        self.assertNotIn("v3-stop.marker", legacy)

    def test_collector_stop_marker_contract(self):
        src = (ROOT / "r64-probe" / "collect-long-v3.py").read_text()
        self.assertIn('ap.add_argument("--stop-marker"', src)
        # Marker ends active sampling inside the sampling loop...
        self.assertIn("stop_marker.exists():", src)
        # ...and postrun residue is still recorded only after the runtime
        # process exits (bounded wait), with the marker state in evidence.
        self.assertIn("stop_marker_seen", src)

    def _write_min_samples(self, root: Path, cycles: int = 6):
        fields = ["cycle", "ts", "rss_kb", "threads", "fd", "sw_epoch",
                  "frames_v", "frames_a", "dropped", "clock_lost"]
        with (root / "samples.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for i in range(cycles):
                w.writerow({"cycle": i + 1, "ts": 1000 + i * 30, "rss_kb": 100000,
                            "threads": 10, "fd": 40, "sw_epoch": i + 1,
                            "frames_v": 1000 * (i + 1), "frames_a": 500 * (i + 1),
                            "dropped": 0, "clock_lost": 0})

    # 6-cycle startup-ramp shapes: FAIL reproduces the observed +60.9MB
    # third-delta; PASS is a flat non-monotonic wiggle.
    SMOKE_RSS_FAIL = [100000, 100000, 155000, 161000, 160000, 161000]
    SMOKE_RSS_PASS = [100000, 100064, 99968, 100096, 100032, 100128]

    def _write_full_evidence(self, root: Path, *, cycles: int, ts_step: int,
                             rss_kb, threads=None, replay_every: int = 5,
                             sidecar_rows=None):
        """Complete, otherwise-healthy evidence so exactly one chosen gate can
        be observed in isolation (smoke tolerance / formal verdicts)."""
        threads = threads or [10] * cycles
        fields = ["cycle", "ts", "rss_kb", "threads", "fd", "sw_epoch",
                  "frames_v", "frames_a", "dropped", "clock_lost"]
        with (root / "samples.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for i in range(cycles):
                w.writerow({"cycle": i + 1, "ts": 1000 + i * ts_step, "rss_kb": rss_kb[i],
                            "threads": threads[i], "fd": 40, "sw_epoch": i + 1,
                            "frames_v": 1000 * (i + 1), "frames_a": 500 * (i + 1),
                            "dropped": 0, "clock_lost": 0})
        with (root / "switch-responses.jsonl").open("w") as f:
            for i in range(cycles):
                f.write(json.dumps({"command_id": f"c{i}", "status": {"status": "executed"},
                                    "detail": "switch executed outcome=preserved"}) + "\n")
        with (root / "readbacks.txt").open("w") as f:
            for i in range(cycles):
                f.write(f"cycle={i + 1} target=devB observed=devB\n")
        with (root / "replays.jsonl").open("w") as f:
            for i in range(replay_every, cycles + 1, replay_every):
                f.write(f"cycle={i} " + json.dumps(
                    {"command_id": f"c{i}", "status": {"status": "replayed"}}) + "\n")
        (root / "ticks.txt").write_text("tick_mid=5 tick_end=9\n")
        (root / "events.txt").write_text("t=12:00:00 total=0 critical=0 kinds={}\n")
        (root / "latencies.txt").write_text(
            "12:00:00 /health 200 0.005s\n12:00:02 /runtime 200 0.004s\n")
        (root / "svc-final.log").write_text(
            "2026-10-04T14:16:00Z watchdog 活体观测行 tick=1\n"
            "2026-10-04T14:16:10Z watchdog 活体观测行 tick=2\n"
            '2026-10-04T14:16:00Z E4_INGEST_ANATOMY handle=101 anatomy='
            '{"video":{"buffers":1000},"audio":{"buffers":500}}\n'
            '2026-10-04T14:16:01Z E4_INGEST_ANATOMY handle=101 anatomy='
            '{"video":{"buffers":1025},"audio":{"buffers":525}}\n'
            '2026-10-04T14:16:00Z E4_INGEST_ANATOMY handle=102 anatomy='
            '{"video":{"buffers":2000},"audio":{"buffers":900}}\n'
            '2026-10-04T14:16:02Z E4_INGEST_ANATOMY handle=102 anatomy='
            '{"video":{"buffers":2050},"audio":{"buffers":950}}\n')
        self._write_sidecar_csv(root, sidecar_rows)
        (root / "stop-response.json").write_text(json.dumps({"status": {"status": "executed"}}))
        (root / "teardown-line.txt").write_text("1\n")
        (root / "v3-postrun.json").write_text(json.dumps({
            "runtime_process_absent": True, "listeners": {"8080": False, "50051": False},
            "protected_alive_after": True, "protected_unchanged": True,
            "stop_marker_seen": True}))

    def _smoke_root(self, *, rss_fail=False, threads=None, drop_svc_log=False):
        td = tempfile.mkdtemp()
        self.addCleanup(lambda: shutil.rmtree(td, ignore_errors=True))
        root = Path(td)
        self._write_full_evidence(
            root, cycles=6, ts_step=30,
            rss_kb=self.SMOKE_RSS_FAIL if rss_fail else self.SMOKE_RSS_PASS,
            threads=threads,
            sidecar_rows=[self._sidecar_row(1000, steady=False)] +
                         [self._sidecar_row(1030 + 30 * i) for i in range(4)])
        if drop_svc_log:
            (root / "svc-final.log").unlink()
        return root

    def test_smoke_tolerates_exactly_the_v2_rss_short_run_diagnostic(self):
        root = self._smoke_root(rss_fail=True)
        rc, out = self._run_analyzer([
            "analyze-long-v3.py", str(root),
            "--target-seconds", "120", "--expected-cycles", "6",
            "--replay-every", "5", "--smoke", "--write-json",
        ])
        self.assertEqual(rc, 0)
        self.assertIn("V3_VERDICT SMOKE_PASS_NOT_QUALIFICATION", out)
        self.assertIn("SMOKE_TOLERATED v2_rss_bounded", out)
        self.assertNotIn("V3_VERDICT PASS\n", out)
        j = json.loads((root / "v3-summary.json").read_text())
        self.assertTrue(j["harness_smoke_only"])
        self.assertEqual(j["v3_verdict"], "SMOKE_PASS_NOT_QUALIFICATION")
        self.assertEqual(j["smoke_tolerated_failures"], ["v2_rss_bounded"])
        self.assertEqual(j["v2_compat_verdict"], "FAIL")  # v2 predicate still truthfully failed
        non_pass = [g["name"] for g in j["gates"] if g["status"] != "PASS"]
        self.assertEqual(non_pass, ["v2_rss_bounded"])  # fixture: everything else healthy

    def test_smoke_rejects_any_other_v2_failure(self):
        root = self._smoke_root(rss_fail=True, threads=[10, 17, 10, 17, 10, 17])
        rc, out = self._run_analyzer([
            "analyze-long-v3.py", str(root),
            "--target-seconds", "120", "--expected-cycles", "6",
            "--replay-every", "5", "--smoke", "--write-json",
        ])
        self.assertEqual(rc, 2)
        self.assertIn("V3_VERDICT SMOKE_FAIL", out)
        j = json.loads((root / "v3-summary.json").read_text())
        self.assertEqual(j["v3_verdict"], "SMOKE_FAIL")

    def test_smoke_rejects_not_measured_even_with_rss_pass(self):
        root = self._smoke_root(rss_fail=False, drop_svc_log=True)
        rc, out = self._run_analyzer([
            "analyze-long-v3.py", str(root),
            "--target-seconds", "120", "--expected-cycles", "6",
            "--replay-every", "5", "--smoke", "--write-json",
        ])
        self.assertEqual(rc, 2)
        self.assertIn("V3_VERDICT SMOKE_FAIL", out)
        j = json.loads((root / "v3-summary.json").read_text())
        self.assertEqual(j["smoke_tolerated_failures"], [])

    def test_formal_profiles_get_no_tolerance(self):
        # 2h rung, same startup-ramp RSS shape: formal verdict must stay FAIL.
        td = tempfile.mkdtemp()
        self.addCleanup(lambda: shutil.rmtree(td, ignore_errors=True))
        root = Path(td)
        rss = [100000] * 85 + [161000] * 171  # 256 cycles, third-delta ~+59.6MB
        self._write_full_evidence(
            root, cycles=256, ts_step=30, rss_kb=rss,
            sidecar_rows=[self._sidecar_row(1000 + 300 * i) for i in range(25)])
        rc, out = self._run_analyzer([
            "analyze-long-v3.py", str(root),
            "--target-seconds", "7200", "--expected-cycles", "256",
            "--replay-every", "5", "--write-json",
        ])
        self.assertEqual(rc, 2)
        self.assertIn("V3_VERDICT FAIL", out)
        self.assertNotIn("SMOKE_TOLERATED", out)
        j = json.loads((root / "v3-summary.json").read_text())
        self.assertEqual(j["v3_verdict"], "FAIL")
        self.assertEqual(j["smoke_tolerated_failures"], [])
        self.assertFalse(j["harness_smoke_only"])
        # Healthy formal evidence still PASSes with the formal label.
        td2 = tempfile.mkdtemp()
        self.addCleanup(lambda: shutil.rmtree(td2, ignore_errors=True))
        root2 = Path(td2)
        self._write_full_evidence(
            root2, cycles=256, ts_step=30,
            rss_kb=[100000 + 64 * (i % 3) for i in range(256)],
            sidecar_rows=[self._sidecar_row(1000 + 300 * i) for i in range(25)])
        rc2, out2 = self._run_analyzer([
            "analyze-long-v3.py", str(root2),
            "--target-seconds", "7200", "--expected-cycles", "256",
            "--replay-every", "5", "--write-json",
        ])
        self.assertEqual(rc2, 0)
        self.assertIn("V3_VERDICT PASS", out2)

    def _run_analyzer(self, argv: list[str]) -> tuple[int, str]:
        out = io.StringIO()
        with mock.patch("sys.argv", argv), redirect_stdout(out):
            rc = mod.main()
        return rc, out.getvalue()

    def test_smoke_mode_end_to_end_fail_label_and_json_marker(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._write_min_samples(root)
            rc, out = self._run_analyzer([
                "analyze-long-v3.py", str(root),
                "--target-seconds", "120", "--expected-cycles", "6",
                "--replay-every", "5", "--smoke", "--write-json",
            ])
            # Incomplete evidence (no switch/readback/tick/sidecar files) must be SMOKE_FAIL.
            self.assertEqual(rc, 2)
            self.assertIn("HARNESS_SMOKE_ONLY", out)
            self.assertIn("V3_VERDICT SMOKE_FAIL", out)
            self.assertNotIn("V3_VERDICT PASS", out)
            j = json.loads((root / "v3-summary.json").read_text())
            self.assertTrue(j["harness_smoke_only"])
            self.assertEqual(j["v3_verdict"], "SMOKE_FAIL")

    def test_cli_rejects_smoke_param_mismatches(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._write_min_samples(root)
            err = io.StringIO()
            bad = [
                ["analyze-long-v3.py", str(root), "--target-seconds", "120",
                 "--expected-cycles", "6", "--replay-every", "5"],  # smoke params w/o --smoke
                ["analyze-long-v3.py", str(root), "--target-seconds", "120",
                 "--expected-cycles", "7", "--replay-every", "5", "--smoke"],
                ["analyze-long-v3.py", str(root), "--target-seconds", "120",
                 "--expected-cycles", "6", "--replay-every", "5",
                 "--smoke", "--allow-missing-v3"],
            ]
            for argv in bad:
                with self.assertRaises(SystemExit) as cm, \
                        mock.patch("sys.argv", argv), redirect_stderr(err):
                    mod.main()
                self.assertEqual(cm.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
