import csv
import json
import os
import shutil
from pathlib import Path
from collections import defaultdict

def get_routing():
    return {
        "Stackable Currency": {
            "defa": "Currency/General",
            "delve": "Currency/Fossils",
            "ess": "Currency/Essences",
            "deli": "Currency/Delirium Orbs",
            "incu": "Currency/Incubators",
            "harv": "Currency/Oils & Harvest",
            "brea": "Currency/Breach",
            "habi": "Currency/Harbinger",
            "scar": "Currency/Scarabs",
            "heis": "Currency/Heist",
            "expe": "Currency/Expedition",
            "eldr": "Currency/Eldritch",
            "ritual": "Currency/Ritual",
        },
        "Skill Gems": "Gems/Skill",
        "Support Gems": "Gems/Support",
    }

def reorganize():
    project_root = Path(__file__).parent.parent
    data_dir = project_root / "filter_generation" / "data"
    base_mapping_dir = data_dir / "base_mapping"
    tier_def_dir = data_dir / "tier_definition"
    csv_path = project_root / "data" / "from_filter_blade" / "BaseTypes.csv"

    if not csv_path.exists():
        print(f"Error: {csv_path} not found.")
        return

    # 1. Load ALL existing mappings
    print("Loading existing mappings...")
    all_mappings = {} # ItemName -> (TierKey, ClassID, ClassNameCh, Translations)
    for json_file in base_mapping_dir.glob("**/*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                meta = data.get("_meta", {})
                class_info = meta.get("item_class", {})
                class_id = class_info.get("en", json_file.stem)
                class_name_ch = class_info.get("ch", class_id)
                translations = meta.get("localization", {}).get("ch", {})
                for item_name, tier_key in data.get("mapping", {}).items():
                    all_mappings[item_name] = (tier_key, class_id, class_name_ch, translations)
        except: continue

    # 2. Load ALL existing tier definitions
    print("Loading existing tier definitions...")
    all_defs = {} # TierKey -> (TierData, CategoryData)
    for json_file in tier_def_dir.glob("**/*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                content = json.load(f)
                for cat_name, cat_data in content.items():
                    if cat_name.startswith("//"): continue
                    for tier_key, tier_data in cat_data.items():
                        if tier_key == "_meta" or tier_key.startswith("//"): continue
                        all_defs[tier_key] = (tier_data, cat_data)
        except: continue

    # 3. Route items using CSV
    new_mappings = defaultdict(lambda: {"mapping": {}, "translations": {}, "class_id": "", "class_ch": ""})
    new_defs = defaultdict(lambda: {}) # Path -> { CategoryName -> { _meta: {}, TierKeys... } }
    routing = get_routing()

    print("Routing items and definitions...")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item_name = row['BaseType']
            item_class = row['Class']
            sub_a = row['SubGroup A']
            if item_name not in all_mappings: continue
                
            tier_key, old_class_id, old_class_ch, old_translations = all_mappings[item_name]
            
            # Determine target path
            target = "Misc/General"
            if item_class in routing:
                route = routing[item_class]
                target = route.get(sub_a, route.get("defa", f"Currency/{sub_a}")) if isinstance(route, dict) else route
            elif item_class in ["One Hand Swords", "Two Hand Swords", "Bows", "Claws", "Daggers", "Rune Daggers", "One Hand Axes", "Two Hand Axes", "One Hand Maces", "Two Hand Maces", "Staves", "Warstaves", "Sceptres", "Wands"]:
                target = f"Equipment/Weapons/{item_class}"
            elif item_class in ["Body Armours", "Helmets", "Boots", "Gloves", "Shields", "Quivers"]:
                target = f"Equipment/Armour/{item_class}"
            elif item_class in ["Amulets", "Rings", "Belts", "Trinkets"]:
                target = f"Equipment/Jewellery/{item_class}"
            elif item_class == "Divination Cards": target = "Divination Cards/Cards"
            elif item_class == "Maps": target = "Maps/Base Maps"
            elif item_class == "Map Fragments": target = "Maps/Fragments"
            
            # A. Update Mapping
            new_mappings[target]["mapping"][item_name] = tier_key
            new_mappings[target]["class_id"] = item_class
            new_mappings[target]["class_ch"] = old_class_ch
            if item_name in old_translations:
                new_mappings[target]["translations"][item_name] = old_translations[item_name]

            # B. Update Definition (Move matching TierKey to the same logical folder)
            if tier_key in all_defs:
                tier_data, cat_data = all_defs[tier_key]
                category_name = target.split('/')[-1] # e.g. "Fossils"
                
                if category_name not in new_defs[target]:
                    new_defs[target][category_name] = {
                        "_meta": cat_data.get("_meta", {
                            "theme_category": item_class,
                            "localization": { "en": category_name, "ch": old_class_ch }
                        })
                    }
                new_defs[target][category_name][tier_key] = tier_data

    # 4. Write Files
    print("Cleaning and Writing...")
    for d in [base_mapping_dir, tier_def_dir]:
        for item in d.iterdir():
            if item.is_dir(): shutil.rmtree(item)
            elif item.suffix == ".json": item.unlink()

    for path_str, content in new_mappings.items():
        out = base_mapping_dir / f"{path_str}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        loc_ch = content["translations"].copy()
        loc_ch["__class_name__"] = content["class_ch"]
        final = {
            "_meta": {
                "localization": { "ch": loc_ch },
                "item_class": { "en": content["class_id"], "ch": content["class_ch"] },
                "theme_category": content["class_id"]
            },
            "mapping": content["mapping"],
            "rules": []
        }
        with open(out, "w", encoding="utf-8") as f: json.dump(final, f, indent=2, ensure_ascii=False)

    for path_str, content in new_defs.items():
        out = tier_def_dir / f"{path_str}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f: json.dump(content, f, indent=2, ensure_ascii=False)

    print("Reorganization complete.")

if __name__ == "__main__":
    reorganize()