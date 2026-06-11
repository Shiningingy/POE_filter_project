"""Audit (and optionally fix) tier-ladder data quality in tier_definition files.

Detects, per file:
  A. duplicate theme.Tier numbers (two tiers render with the SAME theme style)
  B. theme.Tier number != the number in a "Tier N ..." key (label says T1,
     styles as T3 — confusing in editor + game)
  C. ladder gaps among visible numeric tiers
  D. missing hide tier / hide tier whose localization isn't Hide/隐藏

Fix policy (--fix):
  - `_campaign/`, `_legacy/`, `Uniques/` are REPORT-ONLY: campaign files are
    intentionally single/partial ladders, the uniques ladder shares numbers by
    design (named value-tiers), legacy is a special bucket.
  - B: set theme.Tier = key number.
  - C: fill gaps ONLY for real ladders (>= 2 visible numeric tiers after the
    B-fix) — single-tier highlight categories are intentional. Plus forced
    ladders listed in FORCED_LADDERS (user-requested).
  - D: normalize hide-tier localization to en "Hide" / ch "隐藏"; add a hide
    tier where missing.
  - A: a NAMED special tier sharing a number with a numeric "Tier N" key is
    renumbered to the next free number below 9, and the theme file
    (sharket_theme.json) gets a style for the new number copied from the old
    shared one — zero visual change, but the tier becomes independently
    styleable and the duplicate label/style disappears.

Usage:
  python parsing_tool/audit_fix_tier_ladders.py          # report only
  python parsing_tool/audit_fix_tier_ladders.py --fix
"""
import argparse
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
TIER_DIR = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition"
THEME_FILE = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "sharket_theme.json"

HIDE_NUM = 9
KEY_NUM_RE = re.compile(r"^Tier (\d+)\b")
REPORT_ONLY_PREFIXES = ("_campaign/", "_legacy/", "Uniques/")
# file (relative, posix) -> visible numeric ladder it must at least contain
FORCED_LADDERS = {
    "Currency/Runegrafts.json": [0, 1, 2],
}


def tier_entries(cat_data):
    for key, val in cat_data.items():
        if key == "_meta" or not isinstance(val, dict):
            continue
        if "theme" not in val and "localization" not in val and "is_hide_tier" not in val:
            continue
        yield key, val


def audit_file(path, theme_data, fix=False):
    data = json.loads(path.read_text(encoding="utf-8"))
    cat_key = next((k for k in data if not k.startswith("//")), None)
    if not cat_key:
        return [], False, False
    rel = path.relative_to(TIER_DIR).as_posix()
    report_only = rel.startswith(REPORT_ONLY_PREFIXES)
    do_fix = fix and not report_only

    cat = data[cat_key]
    meta = cat.get("_meta", {})
    meta_loc = meta.get("localization", {})
    cat_en = meta_loc.get("en", cat_key)
    cat_ch = meta_loc.get("ch", cat_en)
    theme_category = meta.get("theme_category", cat_key)

    issues = []
    changed = False
    theme_changed = False
    tag = "(manual) " if report_only else ""

    entries = list(tier_entries(cat))

    def num_of(val):
        return val.get("theme", {}).get("Tier")

    # B: key number vs theme.Tier mismatch
    for key, val in entries:
        m = KEY_NUM_RE.match(key)
        if not m:
            continue
        key_num = int(m.group(1))
        theme_num = num_of(val)
        if theme_num is not None and theme_num != key_num:
            issues.append(f"{tag}B key '{key}' has theme.Tier={theme_num} (key says {key_num})")
            if do_fix:
                val.setdefault("theme", {})["Tier"] = key_num
                changed = True

    # A: duplicate theme.Tier (post-B)
    by_num = {}
    for key, val in entries:
        n = num_of(val)
        if n is not None:
            by_num.setdefault(n, []).append(key)
    for n, keys in sorted(by_num.items()):
        if len(keys) <= 1:
            continue
        issues.append(f"{tag}A theme.Tier={n} shared by: {keys}")
        if not do_fix:
            continue
        numeric = [k for k in keys if KEY_NUM_RE.match(k)]
        specials = [k for k in keys if not KEY_NUM_RE.match(k)]
        if len(numeric) > 1 or not specials:
            issues.append("A!  ambiguous duplicate — left for manual fix")
            continue
        used = {num_of(v) for _, v in tier_entries(cat) if num_of(v) is not None}
        for sk in specials:
            free = next((x for x in range(n + 1, HIDE_NUM) if x not in used), None)
            if free is None:
                issues.append(f"A!  no free number below {HIDE_NUM} for '{sk}'")
                continue
            cat[sk].setdefault("theme", {})["Tier"] = free
            used.add(free)
            changed = True
            issues.append(f"A-> '{sk}' renumbered theme.Tier {n} -> {free}")
            # seed the theme style for the new number from the old shared one
            tcat = theme_data.get(theme_category)
            if isinstance(tcat, dict) and f"Tier {free}" not in tcat and f"Tier {n}" in tcat:
                tcat[f"Tier {free}"] = json.loads(json.dumps(tcat[f"Tier {n}"]))
                theme_changed = True
                issues.append(f"A-> theme '{theme_category}'/'Tier {free}' seeded from 'Tier {n}'")

    # D: hide tier
    hide_keys = [k for k, v in tier_entries(cat) if v.get("is_hide_tier") or num_of(v) == HIDE_NUM]
    if not hide_keys:
        issues.append(f"{tag}D no hide tier")
        if do_fix:
            cat[f"Tier Hide {cat_key}"] = {
                "theme": {"Tier": HIDE_NUM},
                "localization": {"en": "Hide", "ch": "隐藏"},
                "is_hide_tier": True,
            }
            changed = True
    else:
        for k in hide_keys:
            loc = cat[k].setdefault("localization", {})
            if loc.get("en") != "Hide" or loc.get("ch") != "隐藏":
                issues.append(f"{tag}D hide tier '{k}' localization {loc}")
                if do_fix:
                    loc["en"] = "Hide"
                    loc["ch"] = "隐藏"
                    changed = True

    # C: ladder gaps among visible numeric tiers (recomputed after fixes)
    nums = sorted({
        num_of(v) for _, v in tier_entries(cat)
        if num_of(v) is not None and num_of(v) != HIDE_NUM and not v.get("is_hide_tier")
    })
    forced = FORCED_LADDERS.get(rel, [])
    if nums:
        expected = sorted(set(range(0, max(nums) + 1)) | set(forced))
        missing = [n for n in expected if n not in nums]
        if missing:
            is_real_ladder = len(nums) >= 2 or forced
            note = "" if is_real_ladder else " (single-tier category — intentional, not filled)"
            issues.append(f"{tag}C ladder {nums} missing {missing}{note}")
            if do_fix and is_real_ladder:
                for n in missing:
                    new_key = f"Tier {n} {cat_key}"
                    if new_key in cat:
                        issues.append(f"C!  key '{new_key}' exists but isn't numeric-themed — skipped")
                        continue
                    cat[new_key] = {
                        "theme": {"Tier": n},
                        "localization": {"en": f"T{n}: {cat_en}", "ch": f"T{n}: {cat_ch}"},
                        "show_in_editor": True,
                    }
                    changed = True

    if do_fix and changed:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    return [(rel, i) for i in issues], changed, theme_changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true")
    args = ap.parse_args()

    theme_data = json.loads(THEME_FILE.read_text(encoding="utf-8"))
    all_issues = []
    changed_files = []
    theme_dirty = False
    for path in sorted(TIER_DIR.rglob("*.json")):
        issues, changed, theme_changed = audit_file(path, theme_data, fix=args.fix)
        all_issues.extend(issues)
        theme_dirty = theme_dirty or theme_changed
        if changed:
            changed_files.append(path.relative_to(TIER_DIR).as_posix())

    if args.fix and theme_dirty:
        THEME_FILE.write_text(json.dumps(theme_data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"theme updated: {THEME_FILE.name}")

    if not all_issues:
        print("Clean: no tier-ladder issues found.")
    else:
        cur = None
        for rel, issue in all_issues:
            if rel != cur:
                print(f"\n{rel}")
                cur = rel
            print(f"  {issue}")
    if args.fix:
        print(f"\nFixed {len(changed_files)} file(s):")
        for f in changed_files:
            print(f"  {f}")


if __name__ == "__main__":
    main()
