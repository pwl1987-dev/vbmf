#!/usr/bin/env python3
from __future__ import annotations

import csv
import importlib.util
import io
import json
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
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

    def _write_sidecar_fixture(self, root: Path, second_ts: int, malformed: bool = False):
        fields = [
            "ts", "socket_fds", "health_status", "runtime_status", "state", "devices",
            "active_pipelines", "sessions", "inputs", "program_switch_present", "dropped", "clock_lost",
        ]
        with (root / "v3-observations.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for ts in (1000, second_ts):
                w.writerow({
                    "ts": ts, "socket_fds": 7, "health_status": 200, "runtime_status": 200,
                    "state": "Capturing", "devices": "bad" if malformed else 3,
                    "active_pipelines": 3, "sessions": 1, "inputs": 2,
                    "program_switch_present": True, "dropped": 0, "clock_lost": 0,
                })
        (root / "v3-identity.json").write_text(json.dumps({
            "source_commit": "abc", "binary_md5": "b" * 32, "manifest_md5": "m" * 32
        }))
        (root / "header.txt").write_text(f"bin_md5={'b'*32}\nmanifest_md5={'m'*32}\n")

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
