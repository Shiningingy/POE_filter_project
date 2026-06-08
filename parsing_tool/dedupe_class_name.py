#!/usr/bin/env python3
"""Collapse the `__class_name__` / `item_class.ch` duplicate (make item_class canonical).

The class label was stored twice in each base_mapping file: in
`_meta.localization.ch.__class_name__` (the live key both filter generators read)
and in `_meta.item_class.ch`. This migration makes `_meta.item_class` the single
home and removes the magic `__class_name__` key, so `localization.ch` becomes a
pure baseType->zh map.

For each base_mapping file whose `_meta.localization.ch` is a dict containing
`__class_name__`:
  - ensure `_meta.item_class` exists; set `item_class.ch = __class_name__`
    (preserve the live value so generated output is unchanged);
  - if `item_class.en` is missing/empty, fill it from the tier_definition group key
    (same relative path), else the filename stem;
  - delete `__class_name__` from `localization.ch`.

Skips `_archived/` and files whose `localization.ch` is a string (the campaign /
Recipes / Chancing string-localization files — they have no `__class_name__`).
Idempotent. Run once.

Usage: python parsing_tool/dedupe_class_name.py [--dry-run]
"""

import argparse
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
BASE_MAPPING = ROOT / "filter_generation" / "data" / "base_mapping"
TIER_DEF = ROOT / "filter_generation" / "data" / "tier_definition"


def tier_group_en(rel):
    """First non-comment top-level key of the matching tier_definition file."""
    tp = TIER_DEF / rel
    if tp.exists():
        try:
            td = json.loads(tp.read_text(encoding="utf-8"))
            return next((k for k in td if not k.startswith("//")), None)
        except Exception:
            return None
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    changed = skipped_string = no_key = 0
    for path in sorted(BASE_MAPPING.rglob("*.json")):
        if "_archived" in path.parts:
            continue
        rel = path.relative_to(BASE_MAPPING)
        data = json.loads(path.read_text(encoding="utf-8"))
        meta = data.get("_meta", {})
        loc = meta.get("localization", {}).get("ch")
        if not isinstance(loc, dict):
            skipped_string += 1
            continue
        if "__class_name__" not in loc:
            no_key += 1
            continue

        cn = loc["__class_name__"]
        ic = meta.get("item_class")
        if not isinstance(ic, dict):
            ic = {}
            meta["item_class"] = ic
        ic["ch"] = cn
        if not ic.get("en"):
            ic["en"] = tier_group_en(rel) or path.stem
        del loc["__class_name__"]

        changed += 1
        print(f"  {rel.as_posix()}: item_class.ch={cn}  (en={ic['en']})")
        if not args.dry_run:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.write("\n")

    print(f"\n{changed} files migrated, {no_key} dict-loc files had no __class_name__, "
          f"{skipped_string} string-loc files skipped.")
    if args.dry_run:
        print("[DRY RUN] nothing written.")


if __name__ == "__main__":
    main()
