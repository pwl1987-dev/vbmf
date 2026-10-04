#!/usr/bin/env python3
from __future__ import annotations

import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main()
