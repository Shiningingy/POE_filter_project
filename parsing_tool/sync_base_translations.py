#!/usr/bin/env python3
"""Sync base-type Chinese translations from the official GGPK client dump.

The editor displays item base types via each base_mapping file's
``_meta.localization.ch[<EnglishBaseName>]`` value. Those strings were originally
seeded from a third-party source (items_db.json) and are unreliable. This script
rebuilds them from the authoritative GGPK dump:

    data/from_ggpk/baseitemtypes.json              (English)
    data/from_ggpk/ch_simplified/baseitemtypes.json (Simplified Chinese)

Both are lists of rows keyed by the ``Id`` metadata path; joining on ``Id`` gives
the canonical English-name -> Chinese-name map.

Rules:
  * Only mapping keys that exist in the GGPK EN->CH map are touched (fills missing,
    overwrites mismatches). Keys absent from GGPK (transfigured gems, logical rule
    names like "6-Link Recipe") are left exactly as-is.
  * Files whose ``_meta.localization.ch`` is NOT a dict (the _campaign / Recipes /
    Chancing string-label files) are skipped — they have no per-base lists.
  * ``_archived/`` files are skipped.
  * ``__class_name__`` and any non-mapping keys in localization.ch are preserved.

A second pass syncs each file's ``_meta.item_class.ch`` and
``localization.ch.__class_name__`` from itemclasses.json (joined on ``Id``).

Idempotent: re-running after a successful run reports zero changes.

Usage:
    python parsing_tool/sync_base_translations.py [--dry-run] [--no-class]
"""

import argparse
import json
import sys
from pathlib import Path

# Make stdout safe for Hanzi on the Windows console.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
GGPK = ROOT / "data" / "from_ggpk"
BASE_MAPPING = ROOT / "filter_generation" / "data" / "base_mapping"


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def build_en2ch(en_rows, ch_rows, name_key="Name"):
    """Join two GGPK tables on Id and return {en_name: ch_name}."""
    id2en = {r["Id"]: r.get(name_key) for r in en_rows}
    id2ch = {r["Id"]: r.get(name_key) for r in ch_rows}
    en2ch = {}
    for _id, en_name in id2en.items():
        ch_name = id2ch.get(_id)
        if en_name and ch_name:
            # First write wins; GGPK Names are effectively unique per Id.
            en2ch.setdefault(en_name, ch_name)
    return en2ch


def iter_mapping_files():
    for path in sorted(BASE_MAPPING.rglob("*.json")):
        if "_archived" in path.parts:
            continue
        yield path


def sync_base_types(en2ch, dry_run):
    total_filled = 0
    total_corrected = 0
    not_found = {}  # key -> [files]
    skipped_string = []
    changed_files = []

    for path in iter_mapping_files():
        rel = path.relative_to(BASE_MAPPING).as_posix()
        data = load_json(path)
        loc = data.get("_meta", {}).get("localization", {}).get("ch")
        if not isinstance(loc, dict):
            skipped_string.append(rel)
            continue
        mapping = data.get("mapping", {})
        if not isinstance(mapping, dict):
            continue

        filled = 0
        corrected = 0
        corrections = []
        for key in mapping:
            official = en2ch.get(key)
            if official is None:
                not_found.setdefault(key, []).append(rel)
                continue
            current = loc.get(key)
            if current is None:
                loc[key] = official
                filled += 1
            elif current != official:
                corrections.append((key, current, official))
                loc[key] = official
                corrected += 1

        if filled or corrected:
            changed_files.append(rel)
            total_filled += filled
            total_corrected += corrected
            print(f"  {rel}: {filled} filled, {corrected} corrected")
            for key, old, new in corrections[:6]:
                print(f"      ~ {key}: {old} -> {new}")
            if len(corrections) > 6:
                print(f"      ... +{len(corrections) - 6} more corrections")
            if not dry_run:
                with open(path, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=2)
                    fh.write("\n")

    return {
        "filled": total_filled,
        "corrected": total_corrected,
        "not_found": not_found,
        "skipped_string": skipped_string,
        "changed_files": changed_files,
    }


def sync_classes(cls_en2ch, dry_run):
    """Secondary pass: sync the canonical class label _meta.item_class.ch."""
    changed = 0
    for path in iter_mapping_files():
        rel = path.relative_to(BASE_MAPPING).as_posix()
        data = load_json(path)
        meta = data.get("_meta", {})
        ic = meta.get("item_class")
        if not isinstance(ic, dict):
            continue
        en = ic.get("en")
        official = cls_en2ch.get(en)
        if not official:
            continue

        touched = False
        if ic.get("ch") != official:
            print(f"  {rel}: item_class.ch {ic.get('ch')} -> {official}")
            ic["ch"] = official
            touched = True

        if touched:
            changed += 1
            if not dry_run:
                with open(path, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=2)
                    fh.write("\n")
    return changed


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="report only; write nothing")
    ap.add_argument("--no-class", action="store_true", help="skip the item_class sync pass")
    args = ap.parse_args()

    en2ch = build_en2ch(
        load_json(GGPK / "baseitemtypes.json"),
        load_json(GGPK / "ch_simplified" / "baseitemtypes.json"),
    )
    print(f"Loaded {len(en2ch)} EN->CH base-type pairs from GGPK\n")

    print("=== Base-type translation sync ===")
    res = sync_base_types(en2ch, args.dry_run)

    print("\n--- Summary ---")
    print(f"Files changed : {len(res['changed_files'])}")
    print(f"Total filled  : {res['filled']}")
    print(f"Total corrected: {res['corrected']}")
    print(f"String-localization files skipped: {len(res['skipped_string'])}")

    nf = res["not_found"]
    print(f"\nMapping keys not in GGPK ({len(nf)}) — expected: transfigured gems + logical keys:")
    for key in sorted(nf):
        print(f"    {key}")

    if not args.no_class:
        cls_en2ch = build_en2ch(
            load_json(GGPK / "itemclasses.json"),
            load_json(GGPK / "ch_simplified" / "itemclasses.json"),
        )
        print(f"\n=== Item-class sync ({len(cls_en2ch)} EN->CH class pairs) ===")
        cls_changed = sync_classes(cls_en2ch, args.dry_run)
        print(f"\nItem-class entries changed: {cls_changed}")

    if args.dry_run:
        print("\n[DRY RUN] No files were written.")


if __name__ == "__main__":
    main()
