#!/usr/bin/env python3
"""Phase 0.6 Runner — FI Matrix (FI-01A/B/02~09).

演进 (回应 GDOC-05): 不再 "结构连通即 PASS"。
- 通过 harness_common.evaluate_pass_rule 对 expected 做结构化求值。
- FI 必须有 fixture.injection_point (骨架必经校验)。
- 当前 measured=None (无真实注入点 <INJECTION_HOOK>), 只能产出 HARNESS_READY。
- 真实注入→检测→恢复→Health→Exit DEGRADED 全链路经 pass_rule 判定通过才输出 PASS。

用法:
  python docs/phase-0.6/runners/run_fi_matrix.py docs/phase-0.6/tests/FI-01A-001.yaml
"""
import sys
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
P06 = ROOT / "docs" / "phase-0.6"
sys.path.insert(0, str(P06 / "runners"))
import harness_common as H  # noqa: E402


def resolve_ref(test, subdir, key):
    ref = test.get(key)
    if not ref:
        return None
    p = P06 / subdir / f"{ref}.yaml"
    if not p.exists():
        raise SystemExit(f"[HARNESS] {key} '{ref}' not found at {p}")
    return H.load_yaml(p)


def main():
    if len(sys.argv) < 2:
        print("usage: run_fi_matrix.py <test.yaml>")
        sys.exit(2)
    test = H.load_yaml(Path(sys.argv[1]))
    fixture = resolve_ref(test, "fixtures", "fixture_id")
    env = resolve_ref(test, "env", "env_prereq_id")
    run_ts = time.strftime("%Y%m%dT%H%M%S")

    # 骨架必经: FI 必须声明 injection_point
    inj = fixture.get("injection_point") if fixture else None
    if not inj:
        evidence = {"test_id": test["id"], "result": "FAIL",
                    "reason": "FI fixture missing injection_point"}
        art = P06 / "evidence" / f"{test['id']}_{run_ts}_fail.json"
        art.write_text(json.dumps(evidence, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(evidence, indent=2, ensure_ascii=False))
        sys.exit(1)

    # --- 真实注入/检测/恢复调用点 (占位) ---
    # measured = injection_hook.inject(fixture["injection_point"])
    #         + runtime_rpc.detect() + runtime_rpc.recover()  # <INJECTION_HOOK>
    measured = None  # 骨架阶段: 不臆造测量值

    result, detail = H.classify(test, fixture, env, measured)
    evidence = {
        "test_id": test["id"],
        "run_ts": run_ts,
        "injection_point": inj,
        "expected_recovery": fixture.get("expected_recovery") if fixture else None,
        "runner_phase": "skeleton (inject/detect/recover via <INJECTION_HOOK> not yet wired)",
        "pass_rule": test.get("pass_rule"),
        "result": result,
        "measurements": detail,
    }
    art = P06 / "evidence" / f"{test['id']}_{run_ts}_{result.lower()}.json"
    art.write_text(json.dumps(evidence, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(evidence, indent=2, ensure_ascii=False))
    sys.exit(0 if result == "PASS" else 1)


if __name__ == "__main__":
    main()
