#!/usr/bin/env python3
"""Apply the triage console's exported decisions to base_mapping.

This is what makes the console a cheap editor instead of a report: you tag
items with a category and tier there, and this writes them into the curation
tree, so nothing has to be re-found and re-mapped by hand in the real editor.

    python parsing_tool/ggpk/apply_decisions.py decisions.json            # dry run
    python parsing_tool/ggpk/apply_decisions.py decisions.json --write

Dry run is the default and prints the exact diff it would make.

What it will not do, on purpose:

  * write a tier that is not in the target category's `tier_order` - an invalid
    tier key does not fail loudly, it silently remaps to the first non-hide
    tier, which is how an item ends up in the wrong band with no error.
  * overwrite an existing mapping. If a name is already mapped anywhere, the
    row is reported as a conflict and skipped; moving an item between
    categories stays a deliberate manual act.
  * touch anything for `skip` decisions. Skip means "not ours", and recording
    that in the tree would be a lie.

zh is filled in from the dump's Traditional Chinese column when the target file
has no translation for the name. It is a stand-in, not hand-tuned - the run
reports every one it added so they can be reviewed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BASE_MAPPING = os.path.join(REPO, "filter_generation", "data", "base_mapping")
TIER_DEFINITION = os.path.join(REPO, "filter_generation", "data", "tier_definition")
LEGACY = "_legacy/Legacy.json"


def die(msg: str) -> None:
    sys.exit(f"ERROR: {msg}")


def load(path: str) -> dict:
    with open(path, encoding="utf-8-sig") as fh:
        return json.load(fh)


def tier_keys(rel: str) -> list[str]:
    """The tier ladder the paired tier_definition declares for this category."""
    path = os.path.join(TIER_DEFINITION, rel)
    if not os.path.exists(path):
        return []
    keys = []
    for cat in load(path).values():
        if isinstance(cat, dict):
            keys += (cat.get("_meta") or {}).get("tier_order") or []
    return keys


def zh_lookup(label: str | None) -> dict[str, str]:
    if not label:
        return {}
    path = os.path.join(REPO, "data", "source", label, "tables",
                        "Traditional Chinese", "BaseItemTypes.json")
    if not os.path.exists(path):
        return {}
    en_path = os.path.join(REPO, "data", "source", label, "tables",
                           "English", "BaseItemTypes.json")
    if not os.path.exists(en_path):
        return {}
    # Join on Id, never on row index (ADR-0004), and keep only rows that are
    # genuinely translated - untranslated rows repeat the English string.
    en = {r["Id"]: r.get("Name") for r in load(en_path)}
    return {en[row["Id"]]: row["Name"]
            for row in load(path)
            if row.get("Name") and en.get(row["Id"]) and row["Name"] != en[row["Id"]]}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("decisions", help="JSON exported from the triage console")
    ap.add_argument("--write", action="store_true", help="actually modify base_mapping")
    ap.add_argument("--no-zh", action="store_true", help="do not fill zh from the dump")
    args = ap.parse_args()

    doc = load(args.decisions)
    adds, legacy = doc.get("add") or [], doc.get("legacy") or []
    skips = doc.get("skip") or []
    zh = {} if args.no_zh else zh_lookup(doc.get("label"))

    # where every name currently lives, so nothing is silently re-homed
    existing: dict[str, str] = {}
    for root, _, files in os.walk(BASE_MAPPING):
        for fn in files:
            if not fn.endswith(".json"):
                continue
            rel = os.path.relpath(os.path.join(root, fn), BASE_MAPPING).replace("\\", "/")
            for name in (load(os.path.join(root, fn)).get("mapping") or {}):
                existing[name] = rel

    planned: dict[str, list[tuple[str, str]]] = {}
    conflicts, bad_tier, retier = [], [], 0

    for entry in adds + [{"name": e["name"], "file": LEGACY, "tier": None} for e in legacy]:
        name, rel = entry["name"], entry["file"]
        if name in existing and existing[name] != rel:
            conflicts.append((name, existing[name], rel))
            continue
        if name in existing:
            # Same file: this is a re-tier, which is exactly how the "emitting
            # nothing" queue gets fixed. Allowed.
            retier += 1
        ladder = tier_keys(rel)
        tier = entry.get("tier")
        if tier is None:                       # legacy: take the file's first tier
            tier = next((t for t in ladder if "Hide" not in t), ladder[0] if ladder else None)
        if not ladder:
            bad_tier.append((name, rel, tier, "no tier_definition for that category"))
            continue
        if tier not in ladder:
            # An unknown tier key does NOT error in the generator - it silently
            # remaps to the first non-hide tier. Refuse it here instead.
            bad_tier.append((name, rel, tier, f"not in tier_order {ladder}"))
            continue
        planned.setdefault(rel, []).append((name, tier))

    print(f"decisions: {len(adds)} add, {len(legacy)} legacy, {len(skips)} skip (skip is a no-op)")
    if retier:
        print(f"  {retier} of them are re-tiers within the same file (allowed)")
    if conflicts:
        print(f"\n{len(conflicts)} already mapped ELSEWHERE - skipped, move them by hand:")
        for name, was, want in conflicts:
            print(f"   {name:<34} in {was}  (wanted {want})")
    if bad_tier:
        print(f"\n{len(bad_tier)} REFUSED - bad destination:")
        for name, rel, tier, why in bad_tier:
            print(f"   {name:<34} {rel} · {tier!r}: {why}")

    added_zh = []
    for rel, rows in sorted(planned.items()):
        path = os.path.join(BASE_MAPPING, rel)
        if not os.path.exists(path):
            print(f"\n!! {rel} does not exist - skipped ({len(rows)} rows)")
            continue
        doc_bm = load(path)
        mapping = doc_bm.setdefault("mapping", {})
        loc = (doc_bm.setdefault("_meta", {}).setdefault("localization", {})
               .setdefault("ch", {}))
        print(f"\n{rel}")
        for name, tier in sorted(rows):
            mapping[name] = tier
            note = ""
            if name not in loc and zh.get(name):
                loc[name] = zh[name]
                added_zh.append((name, zh[name]))
                note = f"   zh {zh[name]} (from the dump, not hand-tuned)"
            print(f"   + {name:<34} -> {tier}{note}")
        if args.write:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(doc_bm, fh, ensure_ascii=False, indent=2)
                fh.write("\n")

    total = sum(len(v) for v in planned.values())
    if args.write:
        print(f"\nWrote {total} entries across {len(planned)} files.")
        print("Next: python filter_generation/generate.py --mode ruthless")
    else:
        print(f"\nDry run - nothing written. {total} entries across {len(planned)} files.")
        print("Re-run with --write to apply.")
    if added_zh:
        print(f"{len(added_zh)} translations came from the dump and want a review pass.")


if __name__ == "__main__":
    main()
