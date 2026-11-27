#!/usr/bin/env python3
"""VBMF 文档一致性校验（Phase 0.5C.1 引入 · 防"只追加、不回写"再发）

检查项:
  1. Markdown 相对链接目标存在（本地运行: python scripts/check_docs.py）
  2. docs/ 下 HTML wireframe 的 href 目标存在（扫描全部, 不再只查第一个）
  3. Markdown / HTML 的锚点 (#section) 目标存在（防死锚点, 如 #final-state）
  4. 关键数字口径（表面计数 / 收口计数 / 引擎与横向系统名单）
  5. Phase 0.6 FI 集合一致性（canonical FI ID 集合 == scope/schedule/outputs 引用数, 防 5→7→8 类语义漂移）

用法:
  python scripts/check_docs.py          # 全部检查
  python scripts/check_docs.py links    # 只查链接 + 锚点
  python scripts/check_docs.py numbers  # 只查数字口径
  python scripts/check_docs.py phase06  # 只查 Phase 0.6 FI 集合一致性

退出码: 0 = 通过, 1 = 有错误
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", ".zcode", ".codebuddy", "node_modules", ".history"}
# GitHub 站内约定路径（本仓库Issues/Discussions/Security），本地不存在属正常
GITHUB_ONLY = ("../../issues", "../../discussions", "../../pulls", "../../security", "../../wiki")


def iter_files(pattern):
    for p in ROOT.rglob(pattern):
        if SKIP_DIRS & set(p.parts):
            continue
        yield p


def _slugify(heading):
    """GitHub 风格 heading slug: 小写, 去行内格式, 空格→连字符, 去首尾连字符。"""
    s = heading.strip().lower()
    s = s.replace("`", "")
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)  # 保留字母/数字/下划线/空格/连字符(含 CJK)
    s = s.replace(" ", "-")
    s = s.strip("-")
    return s


def _norm(a):
    """宽松归一: 去大小写/标点/空白, 保留字母数字与 CJK。用于锚点近似匹配,
    容忍 `§` / `.` / `-` / 全角等作者约定差异 (如 `#§-3-...signal-graph-v0-2-final` ↔ 标题 `§3 ... V0.2`)。"""
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", a.lower())


def _md_anchors(text):
    """收集一个 md 文件内所有可用锚点: 显式 id/name + 标题 slug。"""
    anchors = set()
    for m in re.finditer(r'\bid="([^"]+)"', text):
        anchors.add(m.group(1))
    for m in re.finditer(r'\bname="([^"]+)"', text):
        anchors.add(m.group(1))
    for m in re.finditer(r"^#{1,6}\s+(.+?)\s*#*\s*$", text, re.MULTILINE):
        anchors.add(_slugify(m.group(1)))
    return anchors


def _html_anchors(text):
    """收集一个 html 文件内所有 id / name 锚点。"""
    anchors = set()
    for m in re.finditer(r'\bid="([^"]+)"', text):
        anchors.add(m.group(1))
    for m in re.finditer(r'\bname="([^"]+)"', text):
        anchors.add(m.group(1))
    return anchors


def check_md_links():
    errs = []
    for md in iter_files("*.md"):
        text = md.read_text(encoding="utf-8")
        for m in re.finditer(r"\]\(([^)\s]+)\)", text):
            target = m.group(1)
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", target) or target.startswith("mailto:"):
                continue
            if target.startswith(GITHUB_ONLY):
                continue
            # 同页锚点 (#section): 校验当前文件自身锚点
            if target.startswith("#"):
                anchor = target[1:]
                if anchor:
                    anc = _md_anchors(text)
                    anc_norm = {_norm(a) for a in anc}
                    if anchor not in anc and _slugify(anchor) not in anc and _norm(anchor) not in anc_norm:
                        errs.append(f"[MD-ANCHOR] {md.relative_to(ROOT)} -> {target} (同页锚点不存在)")
                continue
            path, _, anchor = target.partition("#")
            if not path:
                continue
            resolved = (md.parent / path).resolve()
            if not resolved.exists():
                errs.append(f"[MD-LINK] {md.relative_to(ROOT)} -> {target}")
                continue
            if anchor:
                anc = _md_anchors(resolved.read_text(encoding="utf-8"))
                anc_norm = {_norm(a) for a in anc}
                if anchor not in anc and _slugify(anchor) not in anc and _norm(anchor) not in anc_norm:
                    errs.append(f"[MD-ANCHOR] {md.relative_to(ROOT)} -> {target} (锚点 #{anchor} 不存在)")
    return errs


def check_html_links():
    errs = []
    for html in (ROOT / "docs").rglob("*.html"):
        if SKIP_DIRS & set(html.parts):
            continue
        text = html.read_text(encoding="utf-8")
        for m in re.finditer(r'href="([^"]+)"', text):
            target = m.group(1)
            if target.startswith(("http://", "https://", "mailto:", "javascript:")):
                continue
            # 剥离 query string (?ch=CH02) 和 anchor (#section)
            target_no_qs = target.split("?", 1)[0].split("#", 1)[0]
            if not target_no_qs:
                continue
            if not (html.parent / target_no_qs).resolve().exists():
                errs.append(f"[HTML-LINK] {html.relative_to(ROOT)} -> {target}")
        # 跨文件锚点校验 (#section 且带路径)
        for m in re.finditer(r'href="([^"]*#[^"]+)"', text):
            target = m.group(1)
            if target.startswith(("#", "http://", "https://", "mailto:", "javascript:")):
                continue  # 同页 / 外部锚点不在此校验
            path, _, anchor = target.partition("#")
            if not path:
                continue
            resolved = (html.parent / path.split("?", 1)[0]).resolve()
            if resolved.exists() and anchor:
                anc = _html_anchors(resolved.read_text(encoding="utf-8"))
                anc_norm = {_norm(a) for a in anc}
                if anchor not in anc and _slugify(anchor) not in anc and _norm(anchor) not in anc_norm:
                    errs.append(f"[HTML-ANCHOR] {html.relative_to(ROOT)} -> {target} (锚点 #{anchor} 不存在)")
    return errs  # BUG FIX: 原实现此处 return 误缩进在 for 循环内, 只查了首个 HTML 即返回


def load_sot():
    """从 SURFACE_REGISTRY.yaml 解析 Surface Count SoT（唯一事实源）"""
    reg = (ROOT / "docs" / "phase-0.5" / "SURFACE_REGISTRY.yaml")
    total = wf = None
    if reg.exists():
        t = reg.read_text(encoding="utf-8")
        m = re.search(r"TOTAL\s*(\d+)", t)
        if m:
            total = m.group(1)
        m2 = re.search(r"TOTAL\s*\d+\s*=\s*(\d+)\s*LOCK", t)
        if m2:
            wf = m2.group(1)
    return total, wf


def check_numbers():
    errs = []
    total, wf = load_sot()
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    expectations = [
        (f"README 含 SoT 总数 {total}", bool(total and total in readme)),
        (f"README 含 SoT LOCK 数 {wf}", bool(wf and f"{wf} LOCK" in readme)),
        ("收口计数 36（31 P0 + 5 P1）", "36 项语义收口（31 P0 + 5 P1）" in readme),
        ("README 引擎名单含 Redundancy", "Redundancy" in readme),
        ("README 引擎名单含 Signal Fabric", "Signal Fabric" in readme),
        ("README 横向系统为 H1-H5", "H1 Safety" in readme and "H5 Subtitle" in readme),
    ]
    for name, ok in expectations:
        if not ok:
            errs.append(f"[NUMBER] README.md 口径缺失或被改回: {name}")

    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    for engine in ("Signal Fabric", "Normalize", "Redundancy", "QC"):
        if engine not in changelog:
            errs.append(f"[NUMBER] CHANGELOG.md 引擎名单缺: {engine}")

    spec = ROOT / "docs" / "phase-0.5" / "SURFACE_SPEC.md"
    if spec.exists():
        text = spec.read_text(encoding="utf-8")
        if total and f"**{total}**" not in text:
            errs.append(f"[NUMBER] SURFACE_SPEC §1 当前锁定总计 {total} 口径缺失（SoT: SURFACE_REGISTRY.yaml）")
        if "# 30. 附录：Phase 0.5B 语义收口项总清单" not in text:
            errs.append("[NUMBER] SURFACE_SPEC §30 收口项附录缺失")
    else:
        errs.append("[NUMBER] docs/phase-0.5/SURFACE_SPEC.md 不存在（目录又动了？同步本脚本）")
    return errs


def check_nav_domain_counts():
    """NAVIGATION 每个域的表面数必须与 SURFACE_REGISTRY.yaml SoT 一致
    （数字由 Registry 派生, 不得手写, 防止 BROADCAST / MEDIA / ADMIN / GLOBAL 漂移）。

    - BROADCAST / MEDIA / ENGINEERING / ADMIN: NAVIGATION 有 "DOMAIN 域 (N 表面)" 头,
      与 Registry "DOMAIN (N)" 段头 SoT 比对。
    - GLOBAL: NAVIGATION 无独立"域 (N 表面)"头, 改为校验 Registry 内 GLOBAL 条目数 == SoT。
    """
    errs = []
    reg = (ROOT / "docs" / "phase-0.5" / "SURFACE_REGISTRY.yaml")
    if not reg.exists():
        return errs
    reg_text = reg.read_text(encoding="utf-8")
    nav = (ROOT / "docs" / "phase-0.5" / "NAVIGATION.md").read_text(encoding="utf-8")

    nav_domains = ["BROADCAST", "MEDIA", "ENGINEERING", "ADMIN"]
    for d in nav_domains:
        m = re.search(rf"{d}\s*\((\d+)", reg_text)
        if not m:
            continue
        sot = m.group(1)
        m2 = re.search(rf"{d} 域\s*\((\d+) 表面", nav)
        if m2 and m2.group(1) != sot:
            errs.append(
                f"[NUMBER] NAVIGATION {d} 域表面数 {m2.group(1)} "
                f"与 SURFACE_REGISTRY SoT {sot} 不一致（数字必须由 Registry 派生, 不得手写）"
            )

    # GLOBAL: NAVIGATION 无"域 (N 表面)"头 → 校验 Registry 内 GLOBAL 条目数 == SoT
    mg = re.search(r"GLOBAL\s*\((\d+)", reg_text)
    if mg:
        g_sot = int(mg.group(1))
        g_entries = len(re.findall(r"^\s*domain:\s*GLOBAL\s*$", reg_text, flags=re.MULTILINE))
        if g_entries != g_sot:
            errs.append(
                f"[NUMBER] SURFACE_REGISTRY GLOBAL 条目数 {g_entries} "
                f"与 GLOBAL SoT {g_sot} 不一致"
            )
    return errs


def check_phase06_fi_ids():
    """Phase 0.6 FI Set / Reference Coverage Validator (0.6 G-DOC Entry Patch 升级版)。

    不是简单数字检查器, 而是真正校验 FI/Reference 集合的 **定义-引用-计数** 三方闭环:

    规则 1 (计数): phase-0.6 README 中 "N Fault Injection" / "N FI" 字面量 == canonical FI ID 集合大小。
    规则 2 (定义完整性): canonical 集合中每个 FI ID 必须在 README 内有**定义块**
           (形如 "FI-01A：..." 或 "#### FI-01A" 的行), 否则 "声明了却没定义"。
    规则 3 (引用合法性 / 防 phantom): 任何文档 (README/ROADMAP/CONTRIBUTING/INDEX/其他 phase-0.6)
           中出现的 FI ID 都必须属于 canonical 集合 —— 抓住 "Schedule 写了不存在的 FI-09"。
    规则 4 (反向引用 / 防 orphan): 每个 canonical FI ID 至少被一处 "FI-0X" 引用
           (已在全集抽取中必然成立, 故校验定义块存在即足够)。
    规则 5 (摘要同口径): 其它 0.6 摘要文档的 "N Fault Injection" 必须 == canonical 大小。

    这样即可防: 8→7→5 计数漂移 / FI-06 定义了 Schedule 没列 / Summary 写不存在的 FI-09。
    """
    errs = []
    p06 = ROOT / "docs" / "phase-0.6" / "README.md"
    if not p06.exists():
        return errs
    text = p06.read_text(encoding="utf-8")

    fi_ids = re.findall(r"FI-\d{2}[A-Z]?", text)
    canonical = sorted(set(fi_ids))
    if not canonical:
        return errs
    expected = len(canonical)
    canon_set = set(canonical)

    # 规则 1: README 内 "N Fault Injection" / "N FI" 字面量与 expected 一致
    for m in re.finditer(r"(\d+)\s*(?:Fault\s*Injection|FI)\b", text, flags=re.IGNORECASE):
        n = int(m.group(1))
        if n != expected:
            errs.append(
                f"[FI-COVERAGE] phase-0.6/README.md 出现 '{m.group(0)}' "
                f"但 canonical FI 集合大小为 {expected} ({', '.join(canonical)})"
            )

    # 规则 2: 每个 canonical FI 必须有定义块 (#### FI-0X / "FI-0X：" 行)
    for fid in canonical:
        has_def = re.search(rf"(?:^####?\s*{re.escape(fid)}\b|^\s*\*{re.escape(fid)}\*：|^\s*{re.escape(fid)}：)", text, flags=re.MULTILINE)
        if not has_def:
            errs.append(
                f"[FI-COVERAGE] canonical FI '{fid}' 在 phase-0.6/README.md 中无定义块 "
                f"(期望形如 '#### {fid}' 或 '{fid}：')"
            )

    # 规则 3 + 5: 遍历相关文档, 校验所有 FI ID 引用合法 + 摘要计数一致
    tracked = [
        p06,
        ROOT / "README.md",
        ROOT / "ROADMAP.md",
        ROOT / "CONTRIBUTING.md",
        ROOT / "docs" / "phase-0.5" / "INDEX.md",
    ]
    for f in tracked:
        if not f.exists():
            continue
        t = f.read_text(encoding="utf-8")
        # 规则 3: 任意 FI ID 引用必须属于 canonical (抓 phantom FI-09)
        for ref in re.findall(r"FI-\d{2}[A-Z]?", t):
            if ref not in canon_set:
                errs.append(
                    f"[FI-COVERAGE] {f.relative_to(ROOT)} 引用了不存在的 FI ID '{ref}' "
                    f"(canonical = {', '.join(canonical)})"
                )
        # 规则 5: 摘要 "N Fault Injection" 计数一致
        for m in re.finditer(r"(\d+)\s*Fault\s*Injection", t, flags=re.IGNORECASE):
            n = int(m.group(1))
            if n != expected:
                errs.append(
                    f"[FI-COVERAGE] {f.relative_to(ROOT)} 出现 '{m.group(0)}' "
                    f"但 canonical FI 集合大小为 {expected}"
                )
    return errs


# Phase 0.6 G-DOC-READY 的 COVERAGE 子门禁 SoT:
# 规范明确要求、Harness 必须逐一落地的条目, 以 Test Case id 前缀 (末段 -NNN 之前) 精确核对。
# 任何缺失 => G-DOC-READY = NOT (COVERAGE FAIL), 不能进入 G-RUNTIME。
# 键 = canonical 条目 id 前缀; 值 = 所属 reference 族 (仅文档用途)。
PHASE06_COVERAGE_REQUIRED = {
    "AC-01": "A1",
    "A2": "A2",
    "B": "B",
    "AC-03B": "AC-03B",
    "AC-03B-2": "AC-03B",
    "AC-03B-2-6": "AC-03B",
    "FI-01A": "FI",
    "FI-01B": "FI",
    "FI-02": "FI",
    "FI-03": "FI",
    "FI-04": "FI",
    "FI-05": "FI",
    "FI-06": "FI",
    "FI-07": "FI",
    "HA-01": "HA",
    "HA-02": "HA",
    "HA-03": "HA",
    "HA-04": "HA",
    "HA-05": "HA",
    "HA-06": "HA",
    "HA-07": "HA",
    "UI-E2E-01": "UI-E2E",
    "UI-E2E-02": "UI-E2E",
    "UI-E2E-03": "UI-E2E",
    "UI-E2E-04": "UI-E2E",
}


def id_prefixes(tid):
    """返回 tid 自身 + 逐层剥掉尾部 '-NNN'/'_NNN' 后的所有前缀。

    终止条件必须是「剥离后不再变化」: 旧实现按「t 回到原 tid」判定, 而剥离会停在
    最后一个「无分隔符末段」(如 'AC-03B-2-001' -> 'AC'), 此时 re.sub 不再变化而
    t != tid ⇒ 永不 break ⇒ G-DOC-READY 自落地起从未跑完。
    (无分隔符的单 token id 如 'HA01' 首轮即 t == tid, 旧实现能正常退出。)
    """
    out = {tid}
    t = tid
    while True:
        nt = re.sub(r"[-_][^-_]+$", "", t)
        if nt == t or not nt:
            break
        t = nt
        out.add(t)
    return out


def collect_covered_ids(tests):
    """把 Test Case id 归一化为「规范条目 token」集合 (逐层剥前缀)。

    独立成函数是为了让终止性回归测试无需 PyYAML 即可覆盖这条真实代码路径。
    """
    covered = set()
    for _, d in tests:
        tid = (d or {}).get("id") or ""
        if tid:
            covered.update(id_prefixes(tid))
    return covered


def check_phase06_harness():
    """Phase 0.6 G-DOC-READY 门禁 (回应 GDOC-01/02/03): 拆成 3 个子门禁, 全部 PASS 才 G-DOC-READY。

    STRUCTURE : Harness 引用闭环 (fixture/env/runner 文件存在, 防 "写了没建")。
    COVERAGE  : 规范条目族全落地 (HA-01~07 / UI-E2E-01~04 / AC-03B + AC-03B-2 + AC-03B-2-6 /
                A1/A2/B/FI-01A/B/02~07 每个 ≥1 Test Case, 且 reference 字段精确匹配, 非 id 子串)。
    EXECUTOR  : Runner 真实化 (含 evaluate_pass_rule / HARNESS_READY 三态标记, 不再 "文件存在即 PASS")。

    => G-DOC-READY = STRUCTURE AND COVERAGE AND EXECUTOR 全绿。
    """
    try:
        import yaml as _yaml
    except ImportError:
        return ["[HARNESS] PyYAML 未安装, 跳过 G-DOC-READY 校验 (真实环境: pip install pyyaml)"]
    errs = []
    p06 = ROOT / "docs" / "phase-0.6"
    tests_dir = p06 / "tests"
    if not tests_dir.exists():
        return errs

    def load_yaml(p):
        try:
            return _yaml.safe_load(Path(p).read_text(encoding="utf-8"))
        except Exception as e:  # noqa
            errs.append(f"[HARNESS] 无法解析 {Path(p).relative_to(ROOT)}: {e}")
            return None

    tests = []
    for y in sorted(tests_dir.glob("*.yaml")):
        d = load_yaml(y)
        if d:
            tests.append((y, d))

    # ---------- STRUCTURE ----------
    for y, d in tests:
        rel = y.relative_to(ROOT)
        fid = d.get("fixture_id")
        if fid and not (p06 / "fixtures" / f"{fid}.yaml").exists():
            errs.append(f"[G-DOC-STRUCTURE] {rel} 引用 fixture '{fid}' 不存在 (fixtures/{fid}.yaml)")
        eid = d.get("env_prereq_id")
        if eid and not (p06 / "env" / f"{eid}.yaml").exists():
            errs.append(f"[G-DOC-STRUCTURE] {rel} 引用 env '{eid}' 不存在 (env/{eid}.yaml)")
        runner = d.get("runner")
        if runner and not (p06 / runner).exists():
            errs.append(f"[G-DOC-STRUCTURE] {rel} 引用 runner '{runner}' 不存在 (期望 docs/phase-0.6/{runner})")

    # ---------- COVERAGE ----------
    # 收集所有 Test Case id, 归一化为 "规范条目 token" (去掉末尾 -NNN / _NNN),
    # 再用结构化比对 (非 id 子串猜测) 核对 PHASE06_COVERAGE_REQUIRED 全条目均已被覆盖。
    covered_ids = collect_covered_ids(tests)

    present = sorted(covered_ids)
    for item in PHASE06_COVERAGE_REQUIRED:
        hit = (item in covered_ids) or any(
            t == item or t.startswith(item + "-") or t.startswith(item + "_")
            for t in covered_ids
        )
        if not hit:
            errs.append(
                f"[G-DOC-COVERAGE] 规范要求条目 '{item}' 在 tests/ 无对应 Test Case "
                f"(已建 id 条目: {present if present else 'none'})"
            )

    # FI 弱关联补强 (GDOC-03): canonical FI 集合 (从 README) 须被 id 精确覆盖
    readme = (p06 / "README.md").read_text(encoding="utf-8") if (p06 / "README.md").exists() else ""
    fi_ids = sorted(set(re.findall(r"FI-\d{2}[A-Z]?", readme)))
    for fid in fi_ids:
        if fid not in covered_ids and not any(
            t == fid or t.startswith(fid + "-") or t.startswith(fid + "_")
            for t in covered_ids
        ):
            errs.append(
                f"[G-DOC-COVERAGE] canonical FI '{fid}' 在 tests/ 无对应 Test Case "
                f"(已建 FI: {sorted(t for t in covered_ids if t.startswith('FI-')) or 'none'})"
            )

    # ---------- EXECUTOR ----------
    runner_files = {
        "runners/run_reference_a1.py",
        "runners/run_fi_matrix.py",
        "runners/run_ui_e2e.py",
    }
    for rf in runner_files:
        rp = p06 / rf
        if not rp.exists():
            errs.append(f"[G-DOC-EXECUTOR] runner '{rf}' 缺失")
            continue
        src = rp.read_text(encoding="utf-8")
        # 真实化标记: 必须引入 evaluate_pass_rule (或 harness_common) 且区分 HARNESS_READY 三态,
        # 不得再出现 "文件存在即 PASS" 的 bool(fixture and env and pass_rule) 裸判定。
        if "harness_common" not in src and "evaluate_pass_rule" not in src:
            errs.append(f"[G-DOC-EXECUTOR] {rf} 未接入 evaluate_pass_rule (仍是 skeleton connectivity PASS)")
        if "HARNESS_READY" not in src:
            errs.append(f"[G-DOC-EXECUTOR] {rf} 未区分 HARNESS_READY/PASS 三态 (仍可能误报 PASS)")
        if "bool(fixture and env and test.get(\"pass_rule\"))" in src:
            errs.append(f"[G-DOC-EXECUTOR] {rf} 仍存在 '文件存在即 PASS' 的裸判定")
    return errs


def main():
    # Windows GBK 控制台下确保 utf-8 输出, 避免 ∅/中文编码崩溃
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:  # noqa
        pass
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    errors = []
    if mode in ("all", "links"):
        errors += check_md_links()
        errors += check_html_links()
    if mode in ("all", "numbers"):
        errors += check_numbers()
        errors += check_nav_domain_counts()
    if mode in ("all", "phase06"):
        errors += check_phase06_fi_ids()
        errors += check_phase06_harness()

    if mode in ("all", "phase06") and not errors:
        # 仅当 phase06 无错时给出 G-DOC-READY 三子门禁全绿结论
        print("PASS — Phase 0.6 G-DOC-READY: [STRUCTURE]✓ [COVERAGE]✓ [EXECUTOR]✓ "
              "(注意: 仅表示 'G-DOC 规范已完整建模', 不等于 'Runtime 真实执行 PASS')")
        if mode == "phase06":
            sys.exit(0)
    if errors:
        print(f"FAIL — {len(errors)} 个问题:")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print("PASS — 链接可达 + 锚点有效 + 数字口径一致")


if __name__ == "__main__":
    main()
