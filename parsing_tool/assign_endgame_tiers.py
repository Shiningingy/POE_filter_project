"""
assign_endgame_tiers.py

Rebuilds tier assignments in all endgame equipment base_mapping files:
  - filter_generation/data/base_mapping/Equipment/Armour/
  - filter_generation/data/base_mapping/Equipment/Weapons/
  - filter_generation/data/base_mapping/Equipment/Jewellery/

Tier rules:
  - Jewellery files (Amulets, Rings, Belts, Trinkets): explicit name lists
  - Armour + Weapons: DropLevel thresholds from BaseTypes.csv

Preservation: items already at T0 are never downgraded.
"""

import csv
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

CSV_PATH = PROJECT_ROOT / "data" / "from_filter_blade" / "3.28" / "BaseTypes.csv"

BASE_MAPPING_ROOT = PROJECT_ROOT / "filter_generation" / "data" / "base_mapping" / "Equipment"
TIER_DEF_ROOT     = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition"  / "Equipment"

# Subdirectories to process
EQUIPMENT_SUBDIRS = ["Armour", "Weapons", "Jewellery"]

# ---------------------------------------------------------------------------
# Jewellery explicit tier lists
# ---------------------------------------------------------------------------
JEWELLERY_TIERS = {
    "Amulets.json": {
        "T0": {"Agate Amulet", "Citrine Amulet", "Onyx Amulet", "Turquoise Amulet"},
        "T1": {"Amber Amulet", "Blue Pearl Amulet", "Jade Amulet", "Lapis Amulet", "Marble Amulet"},
        "T2": {"Coral Amulet", "Gold Amulet", "Paua Amulet", "Seaglass Amulet"},
        # T3 = everything else
    },
    "Rings.json": {
        "T0": {"Amethyst Ring", "Cerulean Ring", "Opal Ring", "Prismatic Ring",
               "Two-Stone Ring", "Vermillion Ring"},
        "T1": {"Bone Ring", "Diamond Ring", "Iolite Ring", "Ruby Ring", "Sapphire Ring",
               "Steel Ring", "Topaz Ring", "Unset Ring"},
        "T2": {"Gold Ring", "Iron Ring", "Moonstone Ring", "Paua Ring"},
        # T3 = everything else
    },
    "Belts.json": {
        "T0": {"Stygian Vise"},
        "T1": {"Crystal Belt", "Heavy Belt", "Leather Belt", "Vanguard Belt"},
        "T2": {"Chain Belt", "Cloth Belt", "Rustic Sash", "Studded Belt"},
        # T3 = everything else
    },
    "Trinkets.json": {
        # All trinkets → T1 (no T0/T2/T3 buckets)
        "_all_t1": True,
    },
}

# ---------------------------------------------------------------------------
# DropLevel → numeric tier thresholds for Armour/Weapons
# ---------------------------------------------------------------------------
def drop_level_to_numeric_tier(drop_level: int) -> int:
    if drop_level >= 62:
        return 0
    elif drop_level >= 50:
        return 1
    elif drop_level >= 36:
        return 2
    elif drop_level >= 22:
        return 3
    else:
        return 4


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_csv(path: Path) -> dict[str, int]:
    """Return {BaseType: DropLevel} for all rows."""
    result = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("BaseType", "").strip()
            level_str = row.get("DropLevel", "").strip()
            if name and level_str:
                try:
                    result[name] = int(level_str)
                except ValueError:
                    pass
    return result


def load_tier_def(tier_def_path: Path) -> dict[str, str]:
    """
    Return a mapping {numeric_tier_str: tier_key} by reading the tier_definition file.
    E.g. {"0": "Tier 0 Body Armours", "1": "Tier 1 Body Armours", ...}
    Only includes tiers 0-4.
    The tier_def JSON has a single top-level key (category name) with _meta.tier_order inside.
    """
    with open(tier_def_path, encoding="utf-8") as f:
        data = json.load(f)

    # The file has exactly one top-level key (the category name)
    category_key = next(iter(data))
    tier_order = data[category_key]["_meta"]["tier_order"]

    tier_map = {}
    for key in tier_order:
        m = re.match(r"Tier (\d+) ", key)
        if m:
            n = m.group(1)
            if n not in tier_map:  # keep first match
                tier_map[n] = key
    return tier_map


def get_current_numeric_tier(tier_key: str) -> int | None:
    """Extract numeric tier from a key like 'Tier 2 Body Armours'. Returns None if not found."""
    m = re.match(r"Tier (\d+) ", tier_key)
    if m:
        return int(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Core logic: assign tiers for a single base_mapping file
# ---------------------------------------------------------------------------
def process_file(
    mapping_path: Path,
    drop_levels: dict[str, int],
    is_jewellery: bool,
) -> int:
    """
    Processes one base_mapping file. Returns count of items re-tiered.
    """
    with open(mapping_path, encoding="utf-8") as f:
        data = json.load(f)

    mapping: dict[str, str] = data.get("mapping", {})
    if not mapping:
        return 0

    filename = mapping_path.name

    # Derive the corresponding tier_definition path
    # mapping_path:  .../base_mapping/Equipment/Armour/Body Armours.json
    # tier_def_path: .../tier_definition/Equipment/Armour/Body Armours.json
    rel_parts = mapping_path.relative_to(BASE_MAPPING_ROOT).parts  # e.g. ("Armour", "Body Armours.json")
    tier_def_path = TIER_DEF_ROOT.joinpath(*rel_parts)

    if not tier_def_path.exists():
        print(f"  WARNING: tier_definition not found at {tier_def_path}, skipping {filename}")
        return 0

    tier_map = load_tier_def(tier_def_path)  # {"0": "Tier 0 X", "1": "Tier 1 X", ...}

    def resolve_tier_key(numeric: int) -> str | None:
        """Return the tier key for a numeric tier, falling back T4→T3 if T4 not defined."""
        key = tier_map.get(str(numeric))
        if key is None and numeric == 4:
            key = tier_map.get("3")
        return key

    changes = 0

    if is_jewellery:
        jewellery_spec = JEWELLERY_TIERS.get(filename)
        if jewellery_spec is None:
            # Not a file we explicitly handle (e.g. something new) — skip
            return 0

        if jewellery_spec.get("_all_t1"):
            # Trinkets: all → T1
            t1_key = tier_map.get("1")
            if t1_key is None:
                print(f"  WARNING: no T1 key in tier_def for {filename}, skipping")
                return 0
            for item_name in mapping:
                current = mapping[item_name]
                if current != t1_key:
                    mapping[item_name] = t1_key
                    changes += 1
        else:
            t0_set = jewellery_spec.get("T0", set())
            t1_set = jewellery_spec.get("T1", set())
            t2_set = jewellery_spec.get("T2", set())

            for item_name in mapping:
                if item_name in t0_set:
                    desired_num = 0
                elif item_name in t1_set:
                    desired_num = 1
                elif item_name in t2_set:
                    desired_num = 2
                else:
                    desired_num = 3  # T3 = fallback

                desired_key = resolve_tier_key(desired_num)
                if desired_key is None:
                    continue  # no such tier in this file

                current = mapping[item_name]
                current_num = get_current_numeric_tier(current)

                # Preservation rule: never downgrade from T0
                if current_num == 0 and desired_num > 0:
                    continue

                if current != desired_key:
                    mapping[item_name] = desired_key
                    changes += 1

    else:
        # Armour / Weapons: use DropLevel
        for item_name in mapping:
            if item_name not in drop_levels:
                continue  # skip unknown items

            dl = drop_levels[item_name]
            desired_num = drop_level_to_numeric_tier(dl)
            desired_key = resolve_tier_key(desired_num)
            if desired_key is None:
                continue

            current = mapping[item_name]
            current_num = get_current_numeric_tier(current)

            # Preservation rule: never downgrade from T0
            if current_num == 0 and desired_num > 0:
                continue

            if current != desired_key:
                mapping[item_name] = desired_key
                changes += 1

    if changes > 0:
        data["mapping"] = mapping
        with open(mapping_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return changes


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not CSV_PATH.exists():
        print(f"ERROR: BaseTypes.csv not found at {CSV_PATH}")
        sys.exit(1)

    print(f"Loading DropLevel data from: {CSV_PATH}")
    drop_levels = load_csv(CSV_PATH)
    print(f"  Loaded {len(drop_levels)} entries.\n")

    total_changes = 0
    total_files = 0

    for subdir in EQUIPMENT_SUBDIRS:
        mapping_dir = BASE_MAPPING_ROOT / subdir
        if not mapping_dir.exists():
            print(f"WARNING: Directory not found: {mapping_dir}")
            continue

        is_jewellery = (subdir == "Jewellery")
        json_files = sorted(mapping_dir.glob("*.json"))

        for mapping_path in json_files:
            changes = process_file(mapping_path, drop_levels, is_jewellery)
            rel = mapping_path.relative_to(PROJECT_ROOT)
            print(f"  {rel}: {changes} items re-tiered")
            total_changes += changes
            total_files += 1

    print(f"\nDone. {total_files} files processed, {total_changes} total items re-tiered.")


if __name__ == "__main__":
    main()
