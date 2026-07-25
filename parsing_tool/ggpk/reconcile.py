#!/usr/bin/env python3
"""Reconcile our curation against a GGPK dump, and emit the league work queue.

Step 3 of the own-database pipeline. Answers the only question league
maintenance actually asks: *what changed, and what do I have to decide?*

    python parsing_tool/ggpk/reconcile.py --label 3.29.0.2.2

Writes data/source/<label>/reconcile.json (and --html for the triage GUI).

Two hard rules this tool obeys, both learned the expensive way:

  GGPK says what EXISTS, not what DROPS. 3.29 still ships every pre-3.22
  scarab and all 26 retired talismans. So an unmapped base is a QUESTION,
  never an instruction - nothing here auto-adds or auto-retires.

  Names are ambiguous, Ids are not. Several Ids share one name (Two-Toned
  Boots x3), and a name substring proves nothing: `Vial Of Power` looks like a
  10th Incursion Vial and is actually a Labyrinth trinket. Every row carries
  its Ids and class so a decision is made on evidence. See ADR-0004.
"""

from __future__ import annotations

import argparse
import collections
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BASE_MAPPING = os.path.join(REPO, "filter_generation", "data", "base_mapping")

# Item classes that exist in the data but can never appear in a loot filter -
# they are not drops. Listed explicitly rather than silently skipped, and
# echoed into the report so the exclusion stays visible.
NON_DROP_CLASSES = {
    "HideoutDoodad", "Microtransaction", "QuestItem", "LabyrinthItem",
    "LabyrinthTrinket", "LabyrinthMapItem", "PantheonSoul", "AtlasUpgradeItem",
    "IncursionItem", "HeistContract", "HeistBlueprint", "HeistEquipmentWeapon",
    "HeistEquipmentTool", "HeistEquipmentUtility", "HeistEquipmentReward",
    "HeistObjective", "Relic", "SentinelDrone", "MemoryLine", "ArchnemesisMod",
    "UltimatumProgress", "Trinket", "AnimalCharm",
}

# Authored entries that are deliberately not base type names: the generator
# turns them into socket/link conditions or class-wide rules.
PSEUDO_NAMES = {"6-Link", "6-Socket", "RGB Linked", "Relics", "Heist Target"}


def load_tables(label: str, lang: str = "English") -> dict:
    root = os.path.join(REPO, "data", "source", label, "tables", lang)
    if not os.path.isdir(root):
        sys.exit(f"ERROR: no dump at {root}\n"
                 f"  Run:  python parsing_tool/ggpk/extract.py --source cdn --patch {label}")

    def L(n):
        with open(os.path.join(root, n + ".json"), encoding="utf-8") as fh:
            return json.load(fh)

    return {n: L(n) for n in ("BaseItemTypes", "ItemClasses", "Words",
                              "UniqueStashLayout", "UniqueMaps")}


def read_curation() -> tuple[dict, dict]:
    """name -> [files that map it], and file -> its _meta."""
    where = collections.defaultdict(list)
    metas = {}
    for path in sorted(glob.glob(os.path.join(BASE_MAPPING, "**", "*.json"), recursive=True)):
        rel = os.path.relpath(path, BASE_MAPPING).replace("\\", "/")
        try:
            with open(path, encoding="utf-8-sig") as fh:
                doc = json.load(fh)
        except Exception as exc:
            # A corrupt mapping file silently drops its whole category from the
            # generated filter - it has happened. Never swallow it.
            sys.exit(f"ERROR: {rel} is not valid JSON: {exc}")
        metas[rel] = doc.get("_meta") or {}
        for name in (doc.get("mapping") or {}):
            where[name].append(rel)
    return where, metas


def build(label: str) -> dict:
    t = load_tables(label)
    tc = {}
    tc_path = os.path.join(REPO, "data", "source", label, "tables", "Traditional Chinese",
                           "BaseItemTypes.json")
    if os.path.exists(tc_path):
        with open(tc_path, encoding="utf-8") as fh:
            tc = {r["Id"]: r["Name"] for r in json.load(fh)}

    classes = t["ItemClasses"]
    words = t["Words"]

    # name -> {ids, class ids, drop levels}. One name can span several Ids.
    by_name: dict[str, dict] = {}
    for row in t["BaseItemTypes"]:
        name = row.get("Name")
        if not name:
            continue
        cls = classes[row["ItemClassesKey"]] if isinstance(row.get("ItemClassesKey"), int) else None
        e = by_name.setdefault(name, {"ids": [], "class_id": None, "class_name": None,
                                      "drop_level": None, "zh": None})
        e["ids"].append(row["Id"])
        if cls:
            e["class_id"], e["class_name"] = cls["Id"], cls["Name"]
        e["drop_level"] = row.get("DropLevel")
        e["zh"] = e["zh"] or tc.get(row["Id"])

    def word(idx):
        return words[idx]["Text"] if isinstance(idx, int) and idx < len(words) else None

    uniques = {word(r["WordsKey"]) for r in t["UniqueStashLayout"]} - {None}
    unique_maps = {word(r["WordsKey"]) for r in t["UniqueMaps"]} - {None}

    where, metas = read_curation()
    live = {n: f for n, f in where.items() if not all(p.startswith("_legacy/") for p in f)}

    # --- authored names GGPK does not have -------------------------------- #
    unmatched = []
    for name, files in sorted(live.items()):
        if name in by_name or name in uniques or name in unique_maps:
            continue
        if name in PSEUDO_NAMES:
            reason = "pseudo-name (generator turns it into a condition, not a BaseType)"
        elif " of " in name:
            # Transfigured gems are composed from GrantedEffects/ActiveSkills
            # and appear in NO table we extract - not even Ice Nova of
            # Frostbolts. Absence here is not evidence of a typo.
            reason = "likely a transfigured gem - not present in BaseItemTypes by design"
        else:
            reason = "UNKNOWN - verify by hand"
        unmatched.append({"name": name, "files": files, "reason": reason})

    # --- GGPK bases nothing maps ------------------------------------------ #
    unmapped = []
    for name, info in sorted(by_name.items()):
        if name in where:
            continue
        if info["class_id"] in NON_DROP_CLASSES:
            continue
        unmapped.append({"name": name, **info})

    # --- mapped only in _legacy, but still in the game data --------------- #
    legacy_only = []
    for name, files in sorted(where.items()):
        if name in live or name not in by_name:
            continue
        legacy_only.append({"name": name, "files": files, **by_name[name]})

    # --- declared header class vs the real class of the members ----------- #
    # Many files legitimately span classes under an UMBRELLA label - "Unique
    # Items", "Weapons", "Legacy" are not GGPK class names at all, and those
    # files are supposed to be mixed. Only a declared label that IS a real GGPK
    # class but describes none of its members is actually wrong.
    real_classes = {c["Name"] for c in classes if c.get("Name")}
    class_mismatch = []
    for rel, meta in sorted(metas.items()):
        declared = ((meta.get("item_class") or {}).get("en"))
        if not declared:
            continue
        seen = collections.Counter()
        for name, files in where.items():
            if rel in files and name in by_name and by_name[name]["class_name"]:
                seen[by_name[name]["class_name"]] += 1
        if not seen:
            continue
        if declared not in real_classes:
            kind = "umbrella"            # informational; not an error
        elif seen[declared] == 0:
            kind = "wrong"               # names a real class, describes none of them
        elif len(seen) > 1:
            kind = "mixed"               # majority right, minority strays
        else:
            continue
        class_mismatch.append({"file": rel, "declared": declared, "kind": kind,
                               "actual": dict(seen.most_common())})
    order = {"wrong": 0, "mixed": 1, "umbrella": 2}
    class_mismatch.sort(key=lambda m: (order[m["kind"]], m["file"]))

    excluded = collections.Counter(
        info["class_id"] for name, info in by_name.items()
        if name not in where and info["class_id"] in NON_DROP_CLASSES)

    return {
        "label": label,
        "totals": {
            "ggpk_base_names": len(by_name),
            "ggpk_uniques": len(uniques),
            "authored_live": len(live),
            "authored_legacy_only": len(where) - len(live),
        },
        "unmatched": unmatched,
        "unmapped": unmapped,
        "legacy_only": legacy_only,
        "class_mismatch": class_mismatch,
        "excluded_non_drop_classes": dict(excluded.most_common()),
    }


def summarise(rep: dict) -> None:
    t = rep["totals"]
    print(f"\n=== reconcile {rep['label']} ===")
    print(f"  GGPK       : {t['ggpk_base_names']} base names, {t['ggpk_uniques']} uniques")
    print(f"  authored   : {t['authored_live']} live, {t['authored_legacy_only']} legacy-only")
    print(f"\n  unmatched      {len(rep['unmatched']):>5}  authored, not in GGPK")
    for reason, n in collections.Counter(u["reason"].split(" -")[0].split(" (")[0]
                                         for u in rep["unmatched"]).most_common():
        print(f"                       {n:>4}  {reason}")
    print(f"  unmapped       {len(rep['unmapped']):>5}  in GGPK, nothing maps it")
    for cls, n in collections.Counter(u["class_name"] for u in rep["unmapped"]).most_common(12):
        print(f"                       {n:>4}  {cls}")
    print(f"  legacy-only    {len(rep['legacy_only']):>5}  retired by us, still in the game data")
    kinds = collections.Counter(m["kind"] for m in rep["class_mismatch"])
    print(f"  class headers  {len(rep['class_mismatch']):>5}  "
          f"({kinds['wrong']} wrong, {kinds['mixed']} mixed, {kinds['umbrella']} umbrella)")
    for m in rep["class_mismatch"]:
        if m["kind"] == "umbrella":
            continue
        print(f"     [{m['kind']:<5}] {m['file']}  declared {m['declared']!r} -> {m['actual']}")
    if rep["excluded_non_drop_classes"]:
        n = sum(rep["excluded_non_drop_classes"].values())
        print(f"\n  ({n} unmapped bases hidden as non-drop classes: "
              f"{', '.join(list(rep['excluded_non_drop_classes'])[:6])}...)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--label", required=True, help="dump under data/source/")
    ap.add_argument("--html", metavar="PATH",
                    help="also write the standalone triage GUI to this path")
    args = ap.parse_args()

    rep = build(args.label)
    out = os.path.join(REPO, "data", "source", args.label, "reconcile.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=2)
    summarise(rep)
    print(f"\nWrote {os.path.relpath(out, REPO)}")

    if args.html:
        from render_console import render  # noqa: E402  (sibling module)
        os.makedirs(os.path.dirname(os.path.abspath(args.html)), exist_ok=True)
        with open(args.html, "w", encoding="utf-8") as fh:
            fh.write(render(rep))
        print(f"Wrote {args.html}  ({os.path.getsize(args.html) / 1024:.0f} KB)")


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    main()
