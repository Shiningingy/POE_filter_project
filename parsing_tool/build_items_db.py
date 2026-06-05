"""
build_items_db.py
-----------------
Builds data/items_db.json from GGPK-extracted source files, making the project
league-day independent (no reliance on FilterBlade's BaseTypes.csv for core data).

Usage:
    python build_items_db.py [--no-filterblade] [--output PATH]

Inputs (from data/from_ggpk/):
    baseitemtypes.json                  – all English base items
    itemclasses.json                    – item class definitions (_rid → Name)
    componentattributerequirements.json – Str/Dex/Int requirements per item
    ch_simplified/baseitemtypes.json    – Chinese name translations

Optional supplement:
    data/from_filter_blade/3.28/BaseTypes.csv – Game:* stat columns

Output:
    data/items_db.json
"""

import argparse
import csv
import json
import sys
import warnings
from pathlib import Path


# ---------------------------------------------------------------------------
# Resolve project root regardless of where the script is called from
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
GGPK_DIR = DATA_DIR / "from_ggpk"
FILTERBLADE_CSV = DATA_DIR / "from_filter_blade" / "3.28" / "BaseTypes.csv"
DEFAULT_OUTPUT = DATA_DIR / "items_db.json"

# Item classes that carry armour sub-type information
ARMOUR_CLASSES = {"Body Armours", "Gloves", "Boots", "Helmets", "Shields"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_json(path: Path) -> list | dict | None:
    """Load a JSON file, returning None and printing a warning on failure."""
    if not path.exists():
        print(f"  WARNING: file not found: {path}", file=sys.stderr)
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:
        print(f"  WARNING: could not parse {path}: {exc}", file=sys.stderr)
        return None


def _compute_sub_type(item_class: str, req_str: int, req_dex: int, req_int: int) -> str:
    """Mirror the sub-type logic used in main.py lines 106-119."""
    if item_class not in ARMOUR_CLASSES:
        return "Other"
    s, d, i = req_str, req_dex, req_int
    if   s > 0 and d == 0 and i == 0:  return "Armour"
    elif d > 0 and s == 0 and i == 0:  return "Evasion Rating"
    elif i > 0 and s == 0 and d == 0:  return "Energy Shield"
    elif s > 0 and d > 0  and i == 0:  return "Evasion / Armour"
    elif s > 0 and i > 0  and d == 0:  return "Armour / ES"
    elif d > 0 and i > 0  and s == 0:  return "ES / Evasion"
    elif s > 0 and d > 0  and i > 0:   return "Armour / Evasion / ES"
    return "Other"


def _safe_int(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _safe_float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# Step 1: Load itemclasses.json  →  {_rid: "Name string"}
# ---------------------------------------------------------------------------

def load_item_classes() -> dict[int, str]:
    """Return a dict mapping _rid (integer row index) to the class Name string."""
    data = _load_json(GGPK_DIR / "itemclasses.json")
    if data is None:
        return {}

    rid_to_name: dict[int, str] = {}
    for entry in data:
        rid = entry.get("_rid")
        name = entry.get("Name", "")
        if rid is not None and name:
            rid_to_name[int(rid)] = name
    print(f"  Loaded {len(rid_to_name)} item classes.")
    return rid_to_name


# ---------------------------------------------------------------------------
# Step 2: Load componentattributerequirements.json  →  {item_id: (s,d,i)}
# ---------------------------------------------------------------------------

def load_attr_requirements() -> dict[str, tuple[int, int, int]]:
    """Return a dict mapping BaseItemTypesKey (metadata path) to (Str, Dex, Int)."""
    data = _load_json(GGPK_DIR / "componentattributerequirements.json")
    if data is None:
        return {}

    reqs: dict[str, tuple[int, int, int]] = {}
    for entry in data:
        key = entry.get("BaseItemTypesKey", "")
        if key:
            reqs[key] = (
                _safe_int(entry.get("ReqStr")),
                _safe_int(entry.get("ReqDex")),
                _safe_int(entry.get("ReqInt")),
            )
    print(f"  Loaded attribute requirements for {len(reqs)} items.")
    return reqs


# ---------------------------------------------------------------------------
# Step 3: Load ch_simplified/baseitemtypes.json  →  {metadata_id: zh_name}
# ---------------------------------------------------------------------------

def load_chinese_names() -> dict[str, str]:
    """Return a dict mapping metadata Id to Chinese Name."""
    data = _load_json(GGPK_DIR / "ch_simplified" / "baseitemtypes.json")
    if data is None:
        return {}

    zh_map: dict[str, str] = {}
    for entry in data:
        item_id = entry.get("Id", "")
        name = entry.get("Name", "")
        if item_id and name:
            zh_map[item_id] = name
    print(f"  Loaded {len(zh_map)} Chinese name entries.")
    return zh_map


# ---------------------------------------------------------------------------
# Step 4 (optional): Load FilterBlade CSV  →  {base_type_name: row_dict}
# ---------------------------------------------------------------------------

def load_filterblade_csv(csv_path: Path) -> dict[str, dict]:
    """Return a dict mapping BaseType name to the full CSV row dict."""
    if not csv_path.exists():
        print(f"  WARNING: FilterBlade CSV not found at {csv_path}. "
              f"Game:* stats will be 0.", file=sys.stderr)
        return {}

    fb_map: dict[str, dict] = {}
    try:
        with open(csv_path, "r", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                name = row.get("BaseType", "").strip()
                if name:
                    fb_map[name] = row
        print(f"  Loaded FilterBlade stats for {len(fb_map)} items.")
    except Exception as exc:
        print(f"  WARNING: could not read FilterBlade CSV: {exc}", file=sys.stderr)
    return fb_map


# ---------------------------------------------------------------------------
# Main build function
# ---------------------------------------------------------------------------

def build_items_db(use_filterblade: bool = True, output_path: Path = DEFAULT_OUTPUT) -> None:
    print("=== build_items_db.py ===")
    print(f"GGPK source: {GGPK_DIR}")
    print(f"Output:      {output_path}")
    print()

    # --- Load auxiliary data ---
    print("[1/4] Loading item classes...")
    rid_to_class = load_item_classes()

    print("[2/4] Loading attribute requirements...")
    attr_reqs = load_attr_requirements()

    print("[3/4] Loading Chinese translations...")
    zh_map = load_chinese_names()  # metadata_id → zh name

    fb_map: dict[str, dict] = {}
    if use_filterblade:
        print("[4/4] Loading FilterBlade CSV (optional supplement)...")
        fb_map = load_filterblade_csv(FILTERBLADE_CSV)
    else:
        print("[4/4] Skipping FilterBlade CSV (--no-filterblade).")

    # --- Load main base item types ---
    print()
    print("Building item list from baseitemtypes.json...")
    en_data = _load_json(GGPK_DIR / "baseitemtypes.json")
    if en_data is None:
        print("ERROR: Cannot proceed without baseitemtypes.json.", file=sys.stderr)
        sys.exit(1)

    items: list[dict] = []
    translations: dict[str, str] = {}
    missing_class_count = 0
    zh_count = 0

    for entry in en_data:
        item_id  = entry.get("Id", "")          # metadata path, e.g. "Metadata/Items/..."
        en_name  = entry.get("Name", "").strip()
        class_key = entry.get("ItemClassesKey")  # integer → rid into itemclasses

        if not en_name:
            continue  # skip unnamed/internal items

        # Resolve item class
        item_class = ""
        if class_key is not None:
            item_class = rid_to_class.get(int(class_key), "")
        if not item_class:
            missing_class_count += 1
            item_class = "Unknown"

        # Attribute requirements (keyed by metadata path)
        req_str, req_dex, req_int = attr_reqs.get(item_id, (0, 0, 0))

        # Sub-type (armour defence type)
        sub_type = _compute_sub_type(item_class, req_str, req_dex, req_int)

        # Base stats from GGPK
        drop_level = _safe_int(entry.get("DropLevel"))
        width      = _safe_int(entry.get("Width")) or 1
        height     = _safe_int(entry.get("Height")) or 1
        implicit   = []  # Implicit_ModsKeys are integer references; resolve to [] for now

        # Game stats – prefer FilterBlade if available, else 0
        fb_row = fb_map.get(en_name, {})
        armour          = _safe_int(fb_row.get("Game:Armour"))
        armour_max      = _safe_int(fb_row.get("Game:Armour Max"))
        evasion         = _safe_int(fb_row.get("Game:Evasion"))
        evasion_max     = _safe_int(fb_row.get("Game:Evasion Max"))
        energy_shield   = _safe_int(fb_row.get("Game:Energy Shield"))
        energy_shield_max = _safe_int(fb_row.get("Game:Energy Shield Max"))
        damage_min      = _safe_int(fb_row.get("Game:Damage From"))
        damage_max      = _safe_int(fb_row.get("Game:Damage To"))
        aps             = _safe_float(fb_row.get("Game:APS"))
        crit            = _safe_float(fb_row.get("Game:Crit"))
        dps             = _safe_float(fb_row.get("Game:DPS"))

        # Override req_str/dex/int from CSV if available (CSV may have more items)
        if fb_row:
            req_str = _safe_int(fb_row.get("Game:Strength")) or req_str
            req_dex = _safe_int(fb_row.get("Game:Dexterity")) or req_dex
            req_int = _safe_int(fb_row.get("Game:Intelligence")) or req_int
            # Recompute sub_type with CSV-sourced requirements when CSV has data
            sub_type = _compute_sub_type(item_class, req_str, req_dex, req_int)

        item_record = {
            "name":               en_name,
            "item_class":         item_class,
            "drop_level":         drop_level,
            "width":              width,
            "height":             height,
            "implicit":           implicit,
            "req_str":            req_str,
            "req_dex":            req_dex,
            "req_int":            req_int,
            "sub_type":           sub_type,
            "armour":             armour,
            "armour_max":         armour_max,
            "evasion":            evasion,
            "evasion_max":        evasion_max,
            "energy_shield":      energy_shield,
            "energy_shield_max":  energy_shield_max,
            "damage_min":         damage_min,
            "damage_max":         damage_max,
            "aps":                aps,
            "crit":               crit,
            "dps":                dps,
        }
        items.append(item_record)

        # Chinese translation
        zh_name = zh_map.get(item_id, "")
        if zh_name:
            translations[en_name] = zh_name
            zh_count += 1

    # --- Write output ---
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_data = {"items": items, "translations": translations}
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(output_data, fh, ensure_ascii=False, indent=2)

    # --- Summary ---
    class_names = {item["item_class"] for item in items if item["item_class"] != "Unknown"}
    print()
    print("=== Summary ===")
    print(f"  Total items written:          {len(items)}")
    print(f"  Distinct item classes:        {len(class_names)}")
    print(f"  Items missing class mapping:  {missing_class_count}")
    print(f"  Items with zh translation:    {zh_count}")
    print(f"  Output written to:            {output_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Build data/items_db.json from GGPK source files."
    )
    parser.add_argument(
        "--no-filterblade",
        action="store_true",
        help="Skip the optional FilterBlade CSV supplement (Game:* stats will be 0).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        metavar="PATH",
        help=f"Output JSON path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    build_items_db(
        use_filterblade=not args.no_filterblade,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
