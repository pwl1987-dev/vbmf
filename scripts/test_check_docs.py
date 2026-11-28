#!/usr/bin/env python3
"""scripts/check_docs.py 的回归测试。

背景: Phase 0.6 G-DOC-READY 的前缀剥离循环把终止条件写成「t 回到原 tid」, 而剥离会停在
最后一个「无分隔符末段」(如 'AC-03B-2-001' -> 'AC') ⇒ re.sub 不再变化而 t != tid ⇒
无限循环, 该门禁自落地起从未跑完 (CI 五条 workflow 均不调用 scripts/check_docs.py ⇒
缺陷长期潜伏)。含分隔符的 id 才会触发; 无分隔符的单 token id (如 'HA01') 首轮即退出。

关键: 终止性断言必须能在**无 PyYAML** 的环境 (GitHub runner 大概率没有) 下真正跑到那条
代码路径, 否则 CI 上这项测试是空转 —— 故用 collect_covered_ids() 直接喂合成 id。

shortcut: 用守护线程 + join 超时断言「一定终止」; 若门禁语义变更, 需同步更新期望集合。
"""
from __future__ import annotations

import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_docs  # noqa: E402

SYNTHETIC_TESTS = [
    (None, {"id": "AC-03B-2-001"}),
    (None, {"id": "HA-01"}),
    (None, {"id": "FI-01A"}),
    (None, {"id": "HA01"}),
    (None, {"id": ""}),
]


class IdPrefixesTests(unittest.TestCase):
    def test_strips_every_layer(self):
        self.assertEqual(
            check_docs.id_prefixes("AC-03B-2-001"),
            {"AC-03B-2-001", "AC-03B-2", "AC-03B", "AC"},
        )

    def test_single_token_is_itself(self):
        self.assertEqual(check_docs.id_prefixes("HA01"), {"HA01"})

    def test_terminates_on_dashed_id(self):
        """死循环回归: 旧实现在此永不返回。"""
        done = threading.Event()

        def run():
            check_docs.id_prefixes("AC-03B-2-001")
            done.set()

        threading.Thread(target=run, daemon=True).start()
        self.assertTrue(done.wait(5), "id_prefixes 未在 5s 内终止（死循环回归）")


class CollectCoveredIdsTests(unittest.TestCase):
    """覆盖门禁里真正的那段循环 —— 不依赖 PyYAML, 故 CI 上不会空转。"""

    def test_collect_terminates(self):
        done = threading.Event()
        out = []

        def run():
            out.append(check_docs.collect_covered_ids(SYNTHETIC_TESTS))
            done.set()

        threading.Thread(target=run, daemon=True).start()
        self.assertTrue(done.wait(5), "collect_covered_ids 未在 5s 内终止（死循环回归）")
        covered = out[0]
        self.assertIn("AC-03B-2-001", covered)
        self.assertIn("AC-03B-2", covered)
        self.assertIn("AC-03B", covered)
        self.assertIn("AC", covered)
        self.assertIn("HA-01", covered)
        self.assertIn("FI-01A", covered)


class GateTerminationTests(unittest.TestCase):
    def test_phase06_harness_terminates(self):
        """G-DOC-READY 子门禁必须能在限定时间内返回（有 PyYAML 时走真实路径，无则走跳过分支）。"""
        done = threading.Event()
        out = []

        def run():
            out.append(check_docs.check_phase06_harness())
            done.set()

        threading.Thread(target=run, daemon=True).start()
        self.assertTrue(done.wait(60), "check_phase06_harness 未在 60s 内返回（死循环回归）")
        self.assertIsInstance(out[0], list)


class VerificationStatusGuardTests(unittest.TestCase):
    """VERIFICATION_STATUS canonical 守卫（2026-11-27 接入）。

    canonical 词表**不写死在脚本里**, 由 DOCUMENT_STATUS_MODEL.md §2.3 派生 ——
    故测试要同时守住三件事: 派生结果不被改坏 / 非 canonical 值必须被拒 / 列缺失必须 fail-closed。
    全部纯文本解析, 不依赖 PyYAML ⇒ CI 上不会空转。
    """

    def test_canonical_values_derived_from_status_model(self):
        self.assertEqual(
            check_docs.load_verification_status_values(),
            {"NOT_VERIFIED", "LAB_VERIFIED", "HARDWARE_VERIFIED", "ACCEPTED"},
        )

    def test_repo_tables_pass_guard(self):
        """当前仓库（SoT 表 + 产品层镜像表）必须零问题。"""
        self.assertEqual(check_docs.check_verification_status(), [])

    def test_rejects_non_canonical_value(self):
        canonical = check_docs.load_verification_status_values()
        errs = check_docs.validate_verification_status(
            canonical, ["ACCEPTED", "VERIFIED"], "synthetic"
        )
        self.assertEqual(len(errs), 1)
        self.assertIn("VERIFIED", errs[0])

    def test_accepts_all_canonical_values(self):
        canonical = check_docs.load_verification_status_values()
        errs = check_docs.validate_verification_status(
            canonical,
            ["NOT_VERIFIED", "LAB_VERIFIED", "HARDWARE_VERIFIED", "ACCEPTED"],
            "synthetic",
        )
        self.assertEqual(errs, [])

    def test_missing_column_is_fail_closed(self):
        """列被改名/删掉 => 提取返回 None（调用方据此 fail-closed）, 不能静默放行。"""
        text = "| 能力项 | Implementation |\n|---|---|---|\n| X | IMPLEMENTED |\n"
        self.assertIsNone(check_docs.extract_verification_status_column(text))

    def test_extracts_column_values(self):
        text = (
            "| 能力项 | Implementation | VERIFICATION_STATUS |\n"
            "|---|---|---|\n"
            "| A | `IMPLEMENTED` | `ACCEPTED` |\n"
            "| B | `PARTIAL` | `LAB_VERIFIED` |\n"
        )
        self.assertEqual(
            check_docs.extract_verification_status_column(text),
            ["ACCEPTED", "LAB_VERIFIED"],
        )

    def test_fail_closed_when_canonical_cannot_be_derived(self):
        """SoT 读不到 => 必须报 fail-closed, 而不是「无问题」。"""
        original = check_docs.VERIFICATION_STATUS_SOT
        check_docs.VERIFICATION_STATUS_SOT = Path("/nonexistent/DOCUMENT_STATUS_MODEL.md")
        try:
            errs = check_docs.check_verification_status()
        finally:
            check_docs.VERIFICATION_STATUS_SOT = original
        self.assertTrue(errs)
        self.assertTrue(any("fail-closed" in e for e in errs))


if __name__ == "__main__":
    unittest.main()
