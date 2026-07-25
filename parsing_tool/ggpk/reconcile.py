#!/usr/bin/env python3
"""Reconcile our curation against a GGPK dump, and emit the league work queue.

Step 3 of the own-database pipeline. Answers the only question league
maintenance actually asks: *what changed, and what do I have to decide?*

    python parsing_tool/ggpk/reconcile.py --label 3.29.0.2.2 \
        --baseline data/from_ggpk/baseitemtypes.json \
        --html "$HOME/Documents/poe-league-maintenance.html"

Writes data/source/<label>/reconcile.json.

WITH a baseline the headline queue is the league DIFF - what this patch added
and removed - which is a few dozen rows. WITHOUT one it is every base we have
never mapped, which is hundreds and mostly ancient. Always pass a baseline for
routine maintenance; the backlog is a separate, deliberately secondary queue.

Three hard rules this tool obeys, each learned the expensive way:

  GGPK says what EXISTS, not what DROPS. 3.29 still ships every pre-3.22 scarab
  and all 26 retired talismans. So a row here is a QUESTION, never an
  instruction - nothing is added or retired automatically.

  Coverage is not only by name. Whole categories match on Class (every Map is
  handled by one rule in Maps/Base Maps.json), so checking `mapping` keys alone
  reports 229 maps as unmapped. Class conditions count as coverage.

  Names are ambiguous, Ids are not. Several Ids share one name (Two-Toned Boots
  x3), and a name substring proves nothing: `Vial Of Power` looks like a 10th
  Incursion Vial and is a Labyrinth trinket. Diffs are computed on Id, and every
  row carries its Id and class. See ADR-0004.
"""

from __future__ import annotations

import argparse
import collections
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BASE_MAPPING = os.path.join(REPO, "filter_generation", "data", "base_mapping")
TIER_DEFINITION = os.path.join(REPO, "filter_generation", "data", "tier_definition")

# Item classes that exist in the data but can never appear in a loot filter.
# Listed explicitly rather than silently skipped, and the count is reported.
NON_DROP_CLASSES = {
    "HideoutDoodad", "Microtransaction", "QuestItem", "LabyrinthItem",
    "LabyrinthTrinket", "LabyrinthMapItem", "PantheonSoul", "AtlasUpgradeItem",
    "IncursionItem", "HeistContract", "HeistBlueprint", "HeistEquipmentWeapon",
    "HeistEquipmentTool", "HeistEquipmentUtility", "HeistEquipmentReward",
    "HeistObjective", "Relic", "SentinelDrone", "MemoryLine", "ArchnemesisMod",
    "UltimatumProgress", "Trinket", "AnimalCharm", "HiddenItem",
    "InstanceLocalItem", "MiscMapItem",
}

# Retired mechanics GGG kept in the data. Their bases are real and still
# present, they simply cannot drop - so they belong in the backlog's quiet
# bucket, not in a queue that implies action.
DEAD_LEAGUE_CLASSES = {
    "Embers of the Allflame", "Corpses", "Leaguestones", "Metamorph Samples",
    "Incubators", "Pieces",
}

# Authored entries that are deliberately not base type names: the generator
# turns them into socket/link conditions or class-wide rules.
PSEUDO_NAMES = {"6-Link", "6-Socket", "RGB Linked", "Relics", "Heist Target"}


def die(msg: str) -> None:
    sys.exit(f"ERROR: {msg}")


# --------------------------------------------------------------------------- #
# inputs
# --------------------------------------------------------------------------- #

def load_tables(label: str, lang: str = "English") -> dict:
    root = os.path.join(REPO, "data", "source", label, "tables", lang)
    if not os.path.isdir(root):
        die(f"no dump at {root}\n"
            f"  Run:  python parsing_tool/ggpk/extract.py --source cdn --patch {label}")

    def L(n):
        with open(os.path.join(root, n + ".json"), encoding="utf-8") as fh:
            return json.load(fh)

    return {n: L(n) for n in ("BaseItemTypes", "ItemClasses", "Words",
                              "UniqueStashLayout", "UniqueMaps")}


def load_baseline(spec: str) -> tuple[set[str], str]:
    """Ids of the previous patch. Accepts a data/source label or a JSON path.

    Older hand-made dumps under data/from_ggpk/ carry a `_rid` column; ignore
    it. Row indices differ across dumps on 94% of rows - Id is the only key
    that survives a patch (ADR-0004).
    """
    path = spec
    if not os.path.exists(path):
        path = os.path.join(REPO, "data", "source", spec, "tables", "English", "BaseItemTypes.json")
    if not os.path.exists(path):
        die(f"baseline not found: {spec}")
    with open(path, encoding="utf-8-sig") as fh:
        doc = json.load(fh)
    rows = doc if isinstance(doc, list) else (doc.get("rows") or list(doc.values())[0])
    ids = {r["Id"] for r in rows if r.get("Id")}
    if not ids:
        die(f"baseline {path} has no Id column - cannot diff safely")
    return ids, os.path.relpath(path, REPO).replace("\\", "/")


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
            die(f"{rel} is not valid JSON: {exc}")
        metas[rel] = doc.get("_meta") or {}
        for name in (doc.get("mapping") or {}):
            where[name].append(rel)
    return where, metas


def read_class_coverage() -> dict[str, list[str]]:
    """Class values any tier or rule matches on -> the files that match them.

    Categories that select by Class cover every member of that class without
    naming one, so those bases are handled even though no mapping mentions them.
    """
    cover = collections.defaultdict(set)
    for path in glob.glob(os.path.join(TIER_DEFINITION, "**", "*.json"), recursive=True):
        rel = os.path.relpath(path, TIER_DEFINITION).replace("\\", "/")
        try:
            with open(path, encoding="utf-8-sig") as fh:
                doc = json.load(fh)
        except Exception as exc:
            die(f"tier_definition/{rel} is not valid JSON: {exc}")

        def scan(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == "Class":
                        for val in (v if isinstance(v, list) else [v]):
                            if not isinstance(val, str):
                                continue
                            for token in (re.findall(r'"([^"]+)"', val) or [val]):
                                token = token.strip().lstrip("=").strip().strip('"')
                                if token:
                                    cover[token].add(rel)
                    else:
                        scan(v)
            elif isinstance(obj, list):
                for item in obj:
                    scan(item)

        scan(doc)
    return {c: sorted(f) for c, f in cover.items()}


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #

def build(label: str, baseline: str | None) -> dict:
    t = load_tables(label)
    tc = {}
    tc_path = os.path.join(REPO, "data", "source", label, "tables",
                           "Traditional Chinese", "BaseItemTypes.json")
    if os.path.exists(tc_path):
        with open(tc_path, encoding="utf-8") as fh:
            tc = {r["Id"]: r["Name"] for r in json.load(fh)}

    classes, words = t["ItemClasses"], t["Words"]

    by_name: dict[str, dict] = {}
    id_to_name: dict[str, str] = {}
    for row in t["BaseItemTypes"]:
        name = row.get("Name")
        if not name:
            continue
        id_to_name[row["Id"]] = name
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
    cover = read_class_coverage()
    live = {n: f for n, f in where.items() if not all(p.startswith("_legacy/") for p in f)}

    base_ids, base_src = (set(), None)
    if baseline:
        base_ids, base_src = load_baseline(baseline)
    new_names = {id_to_name[i] for i in id_to_name if i not in base_ids} if baseline else set()
    gone_names = ({id_to_name.get(i) for i in base_ids if i not in id_to_name} - {None}
                  if baseline else set())

    def row(name, info, **extra):
        return {"name": name, **info, **extra}

    # --- what this patch added, that nothing covers yet ------------------- #
    new_items, new_done = [], []
    for name in sorted(new_names):
        info = by_name[name]
        if info["class_id"] in NON_DROP_CLASSES:
            continue
        if name in where:
            new_done.append(name)
        elif info["class_name"] in cover:
            new_done.append(name)
        else:
            new_items.append(row(name, info))

    # --- what this patch removed, that we still map ----------------------- #
    removed_items = [{"name": n, "files": where[n]} for n in sorted(gone_names) if n in live]

    # --- everything else we have never mapped ----------------------------- #
    backlog, quiet = [], collections.Counter()
    for name, info in sorted(by_name.items()):
        if name in where or name in new_names:
            continue
        if info["class_id"] in NON_DROP_CLASSES:
            continue
        if info["class_name"] in cover:
            continue
        if info["class_name"] in DEAD_LEAGUE_CLASSES:
            quiet[info["class_name"]] += 1
            continue
        backlog.append(row(name, info))

    # --- authored names GGPK does not have -------------------------------- #
    unmatched = []
    for name, files in sorted(live.items()):
        if name in by_name or name in uniques or name in unique_maps:
            continue
        if name in PSEUDO_NAMES:
            reason = "pseudo-name (generator turns it into a condition, not a BaseType)"
        elif " of " in name:
            # Transfigured gems are composed from GrantedEffects/ActiveSkills and
            # appear in NO table we extract - not even Ice Nova of Frostbolts.
            # FilterBlade does not enumerate them either; it matches
            # `TransfiguredGem True`. Absence here is not evidence of a typo.
            reason = "likely a transfigured gem - absent from BaseItemTypes by design"
        else:
            reason = "UNKNOWN - verify by hand"
        unmatched.append({"name": name, "files": files, "reason": reason})

    # --- mapped only in _legacy, but still in the game data --------------- #
    legacy_only = [row(n, by_name[n], files=f) for n, f in sorted(where.items())
                   if n not in live and n in by_name]

    # --- declared header class vs the real class of the members ----------- #
    # Files legitimately span classes under an UMBRELLA label - "Unique Items",
    # "Weapons", "Legacy" are not GGPK class names and those files are supposed
    # to be mixed. Only a label naming a real class while describing none of its
    # members is actually wrong.
    real_classes = {c["Name"] for c in classes if c.get("Name")}
    class_mismatch = []
    for rel, meta in sorted(metas.items()):
        declared = (meta.get("item_class") or {}).get("en")
        if not declared:
            continue
        seen = collections.Counter()
        for name, files in where.items():
            if rel in files and name in by_name and by_name[name]["class_name"]:
                seen[by_name[name]["class_name"]] += 1
        if not seen:
            continue
        if declared not in real_classes:
            kind = "umbrella"
        elif seen[declared] == 0:
            kind = "wrong"
        elif len(seen) > 1:
            kind = "mixed"
        else:
            continue
        class_mismatch.append({"file": rel, "declared": declared, "kind": kind,
                               "actual": dict(seen.most_common())})
    class_mismatch.sort(key=lambda m: ({"wrong": 0, "mixed": 1, "umbrella": 2}[m["kind"]], m["file"]))

    excluded = collections.Counter(
        info["class_id"] for name, info in by_name.items()
        if name not in where and info["class_id"] in NON_DROP_CLASSES)

    return {
        "label": label,
        "baseline": base_src,
        "totals": {
            "ggpk_base_names": len(by_name),
            "ggpk_uniques": len(uniques),
            "authored_live": len(live),
            "authored_legacy_only": len(where) - len(live),
            "added_since_baseline": len(new_names),
            "added_already_handled": len(new_done),
            "removed_since_baseline": len(gone_names),
        },
        "new_items": new_items,
        "removed_items": removed_items,
        "backlog": backlog,
        "legacy_only": legacy_only,
        "unmatched": unmatched,
        "class_mismatch": class_mismatch,
        "class_covered": {c: sorted(f) for c, f in cover.items()},
        "quiet_dead_league": dict(quiet.most_common()),
        "excluded_non_drop_classes": dict(excluded.most_common()),
    }


def summarise(rep: dict) -> None:
    t = rep["totals"]
    print(f"\n=== reconcile {rep['label']} ===")
    print(f"  GGPK     : {t['ggpk_base_names']} base names, {t['ggpk_uniques']} uniques")
    print(f"  authored : {t['authored_live']} live, {t['authored_legacy_only']} legacy-only")
    if rep["baseline"]:
        print(f"  baseline : {rep['baseline']}")
        print(f"\n  THIS LEAGUE")
        print(f"    added         {t['added_since_baseline']:>4}  "
              f"({t['added_already_handled']} already mapped or covered by a class rule)")
        print(f"    -> to decide  {len(rep['new_items']):>4}")
        print(f"    removed       {t['removed_since_baseline']:>4}  "
              f"({len(rep['removed_items'])} of them still mapped by us)")
    else:
        print("  baseline : none - pass --baseline for the league diff")

    print(f"\n  STANDING")
    print(f"    backlog       {len(rep['backlog']):>4}  never mapped, not new this league")
    for cls, n in collections.Counter(b["class_name"] for b in rep["backlog"]).most_common(8):
        print(f"                  {n:>4}  {cls}")
    print(f"    retired       {len(rep['legacy_only']):>4}  we retired it, the game still ships it")
    print(f"    not in game   {len(rep['unmatched']):>4}  we map it, GGPK has no such base")
    kinds = collections.Counter(m["kind"] for m in rep["class_mismatch"])
    print(f"    class headers {kinds['wrong'] + kinds['mixed']:>4}  "
          f"({kinds['wrong']} wrong, {kinds['mixed']} mixed; {kinds['umbrella']} umbrella ignored)")

    suppressed = [
        (sum(rep["excluded_non_drop_classes"].values()), "non-drop classes"),
        (sum(rep["quiet_dead_league"].values()), "retired-mechanic classes"),
        (len(rep["class_covered"]), "classes covered by a Class rule"),
    ]
    print("\n  suppressed from the queues (never silently): "
          + "; ".join(f"{n} {what}" for n, what in suppressed))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--label", required=True, help="dump under data/source/")
    ap.add_argument("--baseline", help="previous patch: a data/source label, or a path to an "
                                       "older BaseItemTypes json. Strongly recommended.")
    ap.add_argument("--html", metavar="PATH", help="also write the triage console")
    args = ap.parse_args()

    rep = build(args.label, args.baseline)
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
