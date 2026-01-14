import csv
import json
import os
import shutil
import re
from pathlib import Path
from collections import defaultdict

LOCALIZATION_MAP = {
    "Fossils": "化石",
    "Essences": "精华",
    "Delirium Orbs": "惊怖宝珠",
    "Incubators": "孕育石",
    "Oils & Harvest": "圣油与庄园",
    "Breach": "裂隙",
    "Harbinger": "先驱",
    "Scarabs": "圣甲虫",
    "Heist": "夺宝",
    "Expedition": "探险",
    "Ritual": "仪式",
    "Eldritch": "古灵",
    "Cards": "命运卡",
    "Base Maps": "常规地图",
    "Fragments": "碎片",
    "Skill": "技能宝石",
    "Support": "辅助宝石",
    "Body Armours": "胸甲",
    "Boots": "鞋子",
    "Gloves": "手套",
    "Helmets": "头部",
    "Quivers": "箭袋",
    "Shields": "盾",
    "Amulets": "项链",
    "Belts": "腰带",
    "Rings": "戒指",
    "Trinkets": "饰品",
    "Bows": "弓",
    "Claws": "爪",
    "Daggers": "匕首",
    "One Hand Axes": "单手斧",
    "One Hand Maces": "单手锤",
    "One Hand Swords": "单手剑",
    "Rune Daggers": "符文匕首",
    "Sceptres": "短杖",
    "Staves": "长杖",
    "Two Hand Axes": "双手斧",
    "Two Hand Maces": "双手锤",
    "Two Hand Swords": "双手剑",
    "Wands": "法杖",
    "Warstaves": "战杖",
    "Fishing Rods": "鱼竿",
    "General": "通用"
}

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
    all_mappings = {} 
    for json_file in base_mapping_dir.glob("**/*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                meta = data.get("_meta", {})
                class_info = meta.get("item_class", {})
                class_name_ch = class_info.get("ch", json_file.stem)
                translations = meta.get("localization", {}).get("ch", {})
                for item_name, tier_key in data.get("mapping", {}).items():
                    all_mappings[item_name] = (tier_key, class_name_ch, translations)
        except: continue

    # 2. Load ALL existing tier definitions
    print("Loading existing tier definitions...")
    all_defs = {} 
    for json_file in tier_def_dir.glob("**/*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                content = json.load(f)
                for cat_name, cat_data in content.items():
                    if cat_name.startswith("//"): continue
                    for tier_key, tier_data in cat_data.items():
                        if tier_key == "_meta" or tier_key.startswith("//"): continue
                        all_defs[tier_key] = tier_data
        except: continue

    # 3. Route items using CSV
    new_mappings = defaultdict(lambda: {"mapping": {}, "translations": {}, "class_id": "", "class_ch": ""})
    new_defs = defaultdict(lambda: {}) 
    routing = get_routing()

    print("Routing items and definitions...")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item_name = row['BaseType']
            item_class = row['Class']
            sub_a = row['SubGroup A']
            if item_name not in all_mappings: continue
                
            old_tier_key, old_class_ch, old_translations = all_mappings[item_name]
            
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
            
            category_name = target.split('/')[-1] # e.g. "Fossils"
            
            # --- NEW: Convert Tier Key to Functional Name ---
            # e.g. "Tier 1 Stackable Currency" -> "Tier 1 Fossils"
            match = re.search(r"Tier (\d+)", old_tier_key)
            new_tier_key = f"Tier {match.group(1)} {category_name}" if match else old_tier_key

            # A. Update Mapping
            new_mappings[target]["mapping"][item_name] = new_tier_key
            new_mappings[target]["class_id"] = item_class
            new_mappings[target]["class_ch"] = old_class_ch
            if item_name in old_translations:
                new_mappings[target]["translations"][item_name] = old_translations[item_name]

            # B. Update Definition
            if old_tier_key in all_defs:
                tier_data = all_defs[old_tier_key]
                
                if category_name not in new_defs[target]:
                    cat_ch = LOCALIZATION_MAP.get(category_name, category_name)
                    new_defs[target][category_name] = {
                        "_meta": {
                            "theme_category": item_class,
                            "localization": { "en": category_name, "ch": cat_ch }
                        }
                    }
                new_defs[target][category_name][new_tier_key] = tier_data

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
