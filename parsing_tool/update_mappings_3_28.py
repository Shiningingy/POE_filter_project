"""
update_mappings_3_28.py

Patch-mode rebuild of filter_generation/data/base_mapping/ using the authoritative
3.28 item list from data/from_filter_blade/3.28/BaseTypes.csv.

Behaviour:
  - Preserves ALL existing tier assignments (never overwrites a mapped item)
  - Adds missing 3.28 items to the correct subcategory file
  - Moves items absent from 3.28 CSV into _legacy/Legacy.json
  - Collects items with no determinable target into _unclassified/Unclassified.json
  - Prints a full report at the end
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent
BASE_MAPPING_DIR = PROJECT_ROOT / "filter_generation" / "data" / "base_mapping"
BASETYPES_CSV    = PROJECT_ROOT / "data" / "from_filter_blade" / "3.28" / "BaseTypes.csv"
ITEMS_DB_JSON    = PROJECT_ROOT / "data" / "items_db.json"

LEGACY_FILE       = BASE_MAPPING_DIR / "_legacy" / "Legacy.json"
UNCLASSIFIED_FILE = BASE_MAPPING_DIR / "_unclassified" / "Unclassified.json"

# ---------------------------------------------------------------------------
# SubGroup A codes that mean the item is disabled / non-droppable
# → send directly to Legacy
# ---------------------------------------------------------------------------
LEGACY_SUBGROUPS = {"disa", "nonDrop", "mirage"}

# ---------------------------------------------------------------------------
# Classes that use SubGroup A for subcategory routing
# (all other classes use the class-name → file map)
# ---------------------------------------------------------------------------
SUBGROUP_ROUTED_CLASSES = {"Stackable Currency", "Map Fragments"}

# ---------------------------------------------------------------------------
# SubGroup A → relative file path  (for Stackable Currency)
# ---------------------------------------------------------------------------
CURRENCY_SUBGROUP_MAP = {
    "defa":    "Currency/General.json",
    "habi":    "Currency/Harbinger.json",
    "brea":    "Currency/Splinters.json",      # Breach splinters
    "ess":     "Currency/Essences.json",
    "beast":   "Currency/General.json",
    "incu":    "Currency/Incubators.json",
    "delve":   "Currency/Fossils.json",        # stackable delve currency
    "legion":  "Currency/Splinters.json",      # Timeless Legion splinters
    "blight":  "Currency/Oils.json",
    "metam":   "Currency/General.json",
    "deli":    "Currency/Delirium Orbs.json",
    "harv":    "Currency/Harvest.json",
    "heis":    "Currency/Heist.json",
    "ritual":  "Currency/Ritual.json",
    "expe":    "Currency/Expedition.json",
    "scor":    "Currency/General.json",
    "kalan":   "Currency/General.json",
    "kalgu":   "Currency/General.json",
    "sota":    "Currency/General.json",
    "affli":   "Currency/Omens.json",          # Affliction Omens
    "secret":  "Currency/Runegrafts.json",     # Secrets of the Stone Runegrafts
    "keepers": "Currency/General.json",
    "sanc":    "Currency/General.json",
    "cruc":    "Currency/General.json",
    "talis":   "Currency/General.json",
    "ulti":    "Currency/General.json",
    "necro":   "Currency/General.json",
}

# SubGroup A → relative file path  (for Map Fragments)
FRAGMENT_SUBGROUP_MAP = {
    "necro":   "Maps/Scarabs.json",            # 101 Necropolis scarabs → own file
    "defa":    "Maps/Fragments.json",
    "secret":  "Maps/Fragments.json",
    "legion":  "Maps/Fragments.json",
    "metam":   "Maps/Fragments.json",
    "keepers": "Maps/Fragments.json",
    "sota":    "Maps/Fragments.json",
    "harv":    "Maps/Fragments.json",
    "ritual":  "Maps/Fragments.json",
    "kalgu":   "Maps/Fragments.json",
    "ulti":    "Maps/Fragments.json",
    "scor":    "Maps/Fragments.json",
    "deli":    "Maps/Fragments.json",
}

SUBGROUP_MAPS = {
    "Stackable Currency": CURRENCY_SUBGROUP_MAP,
    "Map Fragments":      FRAGMENT_SUBGROUP_MAP,
}

# Classes not auto-detectable from scan → explicit file override
CLASS_EXPLICIT_ROUTES = {
    "Atlas Upgrade Items": "Misc/General.json",  # Voidstones
    "Vault Keys":          "Misc/General.json",  # Reliquary Keys (Keepers of the Void)
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_items_db() -> dict[str, str]:
    """Returns EN name → CH name from items_db.json."""
    if not ITEMS_DB_JSON.exists():
        print(f"Warning: items_db.json not found at {ITEMS_DB_JSON}, translations will be English-only.")
        return {}
    with open(ITEMS_DB_JSON, encoding="utf-8") as f:
        db = json.load(f)
    # Preferred format: {"items": [...], "translations": {"EN name": "CH name"}}
    if isinstance(db, dict) and "translations" in db:
        trans = db["translations"]
        if isinstance(trans, dict):
            return {k: v for k, v in trans.items() if v}
    # Fallback: list of {name, name_ch, ...}
    result = {}
    items = db.get("items", db) if isinstance(db, dict) else db
    if isinstance(items, list):
        for entry in items:
            en = entry.get("name_en") or entry.get("name")
            ch = entry.get("name_ch")
            if en and ch:
                result[en] = ch
    return result


def scan_existing_files() -> tuple[dict[str, str], dict[str, dict], dict[str, str]]:
    """
    Scan all *.json in base_mapping (excluding _legacy, _unclassified).
    Returns:
        known_items:  item_name → relative file path (str)
        file_data:    relative file path → parsed JSON dict
        class_to_file: poe_class_en → relative file path (primary file per class)
    """
    known_items: dict[str, str] = {}
    file_data:   dict[str, dict] = {}
    class_to_file: dict[str, str] = {}
    class_item_count: dict[str, dict[str, int]] = {}  # class → {rel_path: count}

    for fpath in sorted(BASE_MAPPING_DIR.rglob("*.json")):
        rel = fpath.relative_to(BASE_MAPPING_DIR).as_posix()
        # Skip legacy/unclassified (they may already exist from a prior run)
        if rel.startswith("_legacy/") or rel.startswith("_unclassified/"):
            continue
        try:
            with open(fpath, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Warning: could not read {rel}: {e}")
            continue

        file_data[rel] = data
        mapping = data.get("mapping", {})

        # Track which class uses this file
        cls_en = data.get("_meta", {}).get("item_class", {}).get("en", "")
        if cls_en:
            if cls_en not in class_item_count:
                class_item_count[cls_en] = {}
            class_item_count[cls_en][rel] = class_item_count[cls_en].get(rel, 0) + len(mapping)

        for item_name in mapping:
            known_items[item_name] = rel
        # Also cover translations (items with no mapping entry yet)
        for item_name in data.get("_meta", {}).get("localization", {}).get("ch", {}):
            if item_name != "__class_name__" and item_name not in known_items:
                known_items[item_name] = rel

    # Determine primary file per class (the file with the most items)
    for cls_en, file_counts in class_item_count.items():
        primary = max(file_counts, key=lambda r: file_counts[r])
        class_to_file[cls_en] = primary

    return known_items, file_data, class_to_file


def resolve_target_file(
    item_class: str,
    subgroup: str,
    class_to_file: dict[str, str],
) -> str | None:
    """Return the relative file path for this item, or None if unresolvable."""
    # Always send legacy/disabled items to None (handled separately)
    if subgroup in LEGACY_SUBGROUPS:
        return "__legacy__"

    # Use SubGroup A routing for classes that span multiple files
    if item_class in SUBGROUP_ROUTED_CLASSES:
        sg_map = SUBGROUP_MAPS[item_class]
        target = sg_map.get(subgroup)
        if target:
            return target
        # Unknown subgroup for a routed class → use class default if available
        default = class_to_file.get(item_class)
        return default  # may be None

    # Explicit overrides for classes not present in existing mapping files
    if item_class in CLASS_EXPLICIT_ROUTES:
        return CLASS_EXPLICIT_ROUTES[item_class]

    # All other classes: route by class name
    return class_to_file.get(item_class)  # may be None


def make_empty_mapping_file(cls_en: str, cls_ch: str) -> dict:
    return {
        "_meta": {
            "localization": {"ch": {"__class_name__": cls_ch}},
            "item_class": {"en": cls_en, "ch": cls_ch},
            "theme_category": cls_en,
        },
        "mapping": {},
        "rules": [],
    }


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 70)
    print("  update_mappings_3_28.py  —  POE 3.28 base_mapping rebuild")
    print("=" * 70)

    # 1. Load translations
    print("\n[1] Loading items_db.json for translations...")
    translations = load_items_db()
    print(f"    {len(translations)} translations loaded.")

    # 2. Scan existing mapping files
    print("\n[2] Scanning existing base_mapping files...")
    known_items, file_data, class_to_file = scan_existing_files()
    print(f"    {len(file_data)} mapping files found.")
    print(f"    {len(known_items)} items currently tracked.")
    print(f"    {len(class_to_file)} item classes detected.")

    # 3. Parse BaseTypes.csv
    print(f"\n[3] Parsing {BASETYPES_CSV.name}...")
    csv_items: list[dict] = []
    with open(BASETYPES_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("BaseType", "").strip()
            cls  = row.get("Class",    "").strip()
            sga  = row.get("SubGroup A", "").strip()
            dl   = row.get("DropLevel", "0").strip()
            if not name or not cls:
                continue
            if any(name.startswith(p) for p in ("[UNUSED]", "[DNT]", "WIP")):
                continue
            csv_items.append({"name": name, "class": cls, "subgroup": sga, "drop_level": dl})
    csv_names = {i["name"] for i in csv_items}
    print(f"    {len(csv_items)} items loaded from CSV.")

    # 4. Determine what to do with each CSV item
    items_to_add:   dict[str, list[dict]] = defaultdict(list)  # rel_path → items
    legacy_items:   list[dict]            = []
    unclassified:   list[dict]            = []
    # Names from CSV that are explicitly disabled/legacy (by subgroup)
    legacy_subgroup_names: set[str]       = set()

    for item in csv_items:
        name     = item["name"]
        cls      = item["class"]
        subgroup = item["subgroup"]

        target = resolve_target_file(cls, subgroup, class_to_file)

        if target == "__legacy__":
            legacy_subgroup_names.add(name)
            if name not in known_items:
                legacy_items.append(item)   # new legacy item (not already mapped)
            # If already in a mapping file, step 5 will move it to Legacy
            continue

        if target is None:
            if name not in known_items:
                unclassified.append(item)
            continue

        # Already known → skip (preserve existing tier)
        if name in known_items:
            continue

        items_to_add[target].append(item)

    # 5. Find items in existing files that should move to Legacy:
    #    a) Not in 3.28 CSV at all (removed items)
    #    b) In CSV but with a legacy subgroup (disa / nonDrop / mirage)
    items_to_legacy: dict[str, dict] = {}  # item_name → {rel_path, tier, ch_name}
    for item_name, rel_path in known_items.items():
        if item_name not in csv_names or item_name in legacy_subgroup_names:
            mapping = file_data.get(rel_path, {}).get("mapping", {})
            ch_map  = file_data.get(rel_path, {}).get("_meta", {}).get("localization", {}).get("ch", {})
            items_to_legacy[item_name] = {
                "source_file": rel_path,
                "tier":    mapping.get(item_name, "Tier 1 Legacy"),
                "ch_name": ch_map.get(item_name, item_name),
            }

    # 6. Patch active mapping files (add new items)
    print("\n[4] Patching active mapping files...")
    files_modified = set()
    total_added = 0
    added_per_file: dict[str, list[str]] = defaultdict(list)

    for rel_path, items in items_to_add.items():
        abs_path = BASE_MAPPING_DIR / rel_path
        if rel_path not in file_data:
            # File doesn't exist yet — create skeleton using first item's class info
            first_cls = items[0]["class"]
            cls_ch = translations.get(f"__class_{first_cls}__", first_cls)
            file_data[rel_path] = make_empty_mapping_file(first_cls, cls_ch)
            print(f"  [NEW] {rel_path}")

        doc     = file_data[rel_path]
        mapping = doc.setdefault("mapping", {})
        loc_ch  = doc.setdefault("_meta", {}).setdefault("localization", {}).setdefault("ch", {})

        for item in items:
            name     = item["name"]
            cls      = item["class"]
            ch_name  = translations.get(name, name)
            tier     = f"Tier 1 {cls}"

            mapping[name] = tier
            loc_ch[name]  = ch_name
            added_per_file[rel_path].append(name)
            total_added += 1

        files_modified.add(rel_path)

    # Fix translation fallbacks: any loc_ch entry where CH name == EN name
    # means the first run stored a bad fallback — update it now.
    trans_fixes = 0
    for rel_path, doc in file_data.items():
        loc_ch = doc.get("_meta", {}).get("localization", {}).get("ch", {})
        for item_name in list(loc_ch.keys()):
            if item_name == "__class_name__":
                continue
            if loc_ch[item_name] == item_name:
                better = translations.get(item_name)
                if better and better != item_name:
                    loc_ch[item_name] = better
                    files_modified.add(rel_path)
                    trans_fixes += 1
    if trans_fixes:
        print(f"\n[FIX] Fixed {trans_fixes} bad translation fallbacks in existing files.")

    # 7. Remove legacy items from their source files
    print("\n[5] Moving legacy items out of active files...")
    for item_name, info in items_to_legacy.items():
        rel_path = info["source_file"]
        if rel_path not in file_data:
            continue
        doc = file_data[rel_path]
        doc.get("mapping", {}).pop(item_name, None)
        doc.get("_meta", {}).get("localization", {}).get("ch", {}).pop(item_name, None)
        files_modified.add(rel_path)

    # 8. Write modified active files
    print(f"\n[6] Writing {len(files_modified)} modified files...")
    for rel_path in sorted(files_modified):
        write_json(BASE_MAPPING_DIR / rel_path, file_data[rel_path])

    # 9. Write Legacy file
    print("\n[7] Writing _legacy/Legacy.json...")
    legacy_doc = make_empty_mapping_file("Legacy", "历史物品")
    # Add items that were moved from active files
    for item_name, info in items_to_legacy.items():
        legacy_doc["mapping"][item_name] = info["tier"]
        legacy_doc["_meta"]["localization"]["ch"][item_name] = info["ch_name"]
    # Add new legacy items from CSV (disa/nonDrop/mirage not seen before)
    for item in legacy_items:
        name    = item["name"]
        ch_name = translations.get(name, name)
        legacy_doc["mapping"][name] = f"Tier 1 {item['class']}"
        legacy_doc["_meta"]["localization"]["ch"][name] = ch_name
    write_json(LEGACY_FILE, legacy_doc)

    # 10. Write Unclassified file
    print("\n[8] Writing _unclassified/Unclassified.json...")
    unc_doc = make_empty_mapping_file("Unclassified", "待分类")
    for item in unclassified:
        name    = item["name"]
        ch_name = translations.get(name, name)
        unc_doc["mapping"][name] = f"Tier 1 {item['class']}"
        unc_doc["_meta"]["localization"]["ch"][name] = ch_name
    write_json(UNCLASSIFIED_FILE, unc_doc)

    # ---------------------------------------------------------------------------
    # Report
    # ---------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("  REPORT")
    print("=" * 70)

    print(f"\n=== Items ADDED to active files ({total_added} total) ===")
    for rel_path in sorted(added_per_file):
        names = added_per_file[rel_path]
        sample = ", ".join(names[:5])
        suffix = f", ... (+{len(names)-5} more)" if len(names) > 5 else ""
        print(f"  {rel_path:<55}: +{len(names):>4}   [{sample}{suffix}]")

    print(f"\n=== Items MOVED to _legacy/Legacy.json ({len(items_to_legacy)} from active files"
          f" + {len(legacy_items)} new disa/nonDrop) ===")
    all_legacy_names = list(items_to_legacy.keys()) + [i["name"] for i in legacy_items]
    sample = ", ".join(all_legacy_names[:10])
    suffix = f" ... (+{len(all_legacy_names)-10} more)" if len(all_legacy_names) > 10 else ""
    print(f"  {sample}{suffix}")

    print(f"\n=== Items in _unclassified/Unclassified.json ({len(unclassified)} items) ===")
    if unclassified:
        for item in unclassified[:20]:
            print(f"  {item['name']}  (class={item['class']}, subgroup={item['subgroup']})")
        if len(unclassified) > 20:
            print(f"  ... and {len(unclassified)-20} more")
    else:
        print("  (none — all items were successfully classified)")

    if items_to_add.get("Maps/Scarabs.json"):
        print(f"\n=== NOTE: Maps/Scarabs.json is NEW ({len(items_to_add['Maps/Scarabs.json'])} scarabs) ===")
        print("  Remember to add it to category_structure.yaml under 'Maps & Fragments'.")


    print(f"\n=== Summary ===")
    print(f"  Active mapping files modified : {len(files_modified)}")
    print(f"  New items added               : {total_added}")
    print(f"  Legacy items (total)          : {len(items_to_legacy) + len(legacy_items)}")
    print(f"  Unclassified items            : {len(unclassified)}")
    print(f"\nDone.")


if __name__ == "__main__":
    main()
