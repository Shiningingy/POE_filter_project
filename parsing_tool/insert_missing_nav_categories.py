"""Insert generated-but-unlisted categories into the editor nav (category_structure.json)
so they are reachable in the sidebar and the (nav-mirrored) Theme Editor.

- New "League Bases" group (17 Equipment/League/* leaves) inside the "Endgame Gear" section.
- Heist Blueprints + Contracts appended to the existing "Heist Gear" group.
- Corpses appended to the existing "Misc" group (it is NOT currency).

Skips Currency/_archived/Breach.json (intentionally archived).
Builds each leaf from the tier_definition (_meta.localization + theme_category) and base_mapping.
Does NOT affect generation (the generator iterates base_mapping directly).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "filter_generation", "data")
CAT = os.path.join(DATA, "category_structure.json")

LEAGUE = [
    "Equipment/League/Abyss Socketed.json",
    "Equipment/League/Blight Anointed.json",
    "Equipment/League/Breach Grasping Mail.json",
    "Equipment/League/Breach Rings.json",
    "Equipment/League/Expedition Ward-Bases.json",
    "Equipment/League/Heist Experimented.json",
    "Equipment/League/ID Bestiary.json",
    "Equipment/League/ID Delve.json",
    "Equipment/League/ID Essence.json",
    "Equipment/League/ID Incursion.json",
    "Equipment/League/ID Mercenaries.json",
    "Equipment/League/ID Warband.json",
    "Equipment/League/Mirror Ring Bases.json",
    "Equipment/League/Ritual BaseTypes.json",
    "Equipment/League/Sacrificial Garbs.json",
    "Equipment/League/Stygian Vise.json",
    "Equipment/League/Talismans.json",
]
HEIST = ["Heist/Blueprints.json", "Heist/Contracts.json"]
MISC = ["Currency/Corpses.json"]


def leaf_entry(path):
    tier_file = os.path.join(DATA, "tier_definition", path.replace("/", os.sep))
    d = json.load(open(tier_file, encoding="utf-8"))
    k = [x for x in d if not x.startswith("//")][0]
    meta = d[k].get("_meta", {})
    loc = meta.get("localization", {"en": k})
    return {
        "path": path,
        "tier_path": f"tier_definition/{path}",
        "mapping_path": f"base_mapping/{path}",
        "target_category": meta.get("theme_category", k),
        "localization": {"en": loc.get("en", k), "ch": loc.get("ch", loc.get("en", k))},
    }


cat = json.load(open(CAT, encoding="utf-8"))
cats = cat["categories"]

# existing leaf paths (idempotency guard)
existing = {fl.get("path") for g in cats for fl in g.get("files", [])}


def group_index(name_en):
    for i, g in enumerate(cats):
        if g.get("_meta", {}).get("localization", {}).get("en") == name_en:
            return i
    return None


def append_to_group(name_en, paths):
    gi = group_index(name_en)
    if gi is None:
        print(f"  WARN group {name_en!r} not found")
        return 0
    n = 0
    for p in paths:
        if p in existing:
            continue
        cats[gi]["files"].append(leaf_entry(p))
        existing.add(p)
        n += 1
    return n

# 1. New "League Bases" group inside Endgame Gear (after the "Linked Items" group)
if "League Bases" not in [g.get("_meta", {}).get("localization", {}).get("en") for g in cats]:
    league_files = [leaf_entry(p) for p in LEAGUE if p not in existing]
    for p in LEAGUE:
        existing.add(p)
    new_group = {
        "_meta": {"localization": {"en": "League Bases", "ch": "联盟基底"}},
        "files": league_files,
    }
    li = group_index("Linked Items")
    insert_at = (li + 1) if li is not None else len(cats)
    cats.insert(insert_at, new_group)
    print(f"[nav] inserted 'League Bases' group ({len(league_files)} files) at index {insert_at}")
else:
    print("[nav] 'League Bases' group already present")

# 2. Heist Blueprints + Contracts -> Heist Gear
print(f"[nav] appended to 'Heist Gear': {append_to_group('Heist Gear', HEIST)}")

# 3. Corpses -> Misc
print(f"[nav] appended to 'Misc': {append_to_group('Misc', MISC)}")

raw = open(CAT, "rb").read()
trailing = raw.endswith(b"\n")
text = json.dumps(cat, ensure_ascii=False, indent=2) + ("\n" if trailing else "")
with open(CAT, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(text)
print("Done. (Currency/_archived/Breach.json intentionally skipped)")
