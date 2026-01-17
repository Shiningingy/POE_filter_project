import os
import json
import shutil
import csv
import re
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = BACKEND_DIR.parent.parent.resolve()
FILTER_GEN_DIR = PROJECT_ROOT / "filter_generation"
DATA_DIR = FILTER_GEN_DIR / "data"
SOUND_DIR = PROJECT_ROOT / "sound_files"
FRONTEND_PUBLIC_DIR = PROJECT_ROOT / "webapp" / "frontend" / "public"
DEMO_DATA_DIR = FRONTEND_PUBLIC_DIR / "demo_data"
RAW_DATA_DIR = PROJECT_ROOT / "data"

def safe_copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)

def load_base_data():
    item_classes = set()
    class_to_items = {} # Class -> set of item names
    item_to_class = {}
    item_details = {}
    item_subtypes = {}
    
    csv_path = RAW_DATA_DIR / "from_filter_blade" / "BaseTypes.csv"
    if csv_path.exists():
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cls = row.get("Class", "").strip()
                name = row.get("BaseType", "").strip()
                if cls and name:
                    item_classes.add(cls)
                    if cls not in class_to_items: class_to_items[cls] = set()
                    class_to_items[cls].add(name)
                    item_to_class[name] = cls
                    
                    subtype = "Other"
                    if cls in ["Body Armours", "Gloves", "Boots", "Helmets", "Shields"]:
                        s = int(row.get("Game:Strength") or 0)
                        d = int(row.get("Game:Dexterity") or 0)
                        i = int(row.get("Game:Intelligence") or 0)
                        if s > 0 and d == 0 and i == 0: subtype = "Armour"
                        elif d > 0 and s == 0 and i == 0: subtype = "Evasion Rating"
                        elif i > 0 and s == 0 and d == 0: subtype = "Energy Shield"
                        elif s > 0 and d > 0 and i == 0: subtype = "Evasion / Armour"
                        elif s > 0 and i > 0 and d == 0: subtype = "Armour / ES"
                        elif d > 0 and i > 0 and s == 0: subtype = "ES / Evasion"
                        elif s > 0 and d > 0 and i > 0: subtype = "Armour / Evasion / ES"
                    item_subtypes[name] = subtype
                    
                    item_details[name] = {
                        "drop_level": int(row.get("DropLevel") or 0),
                        "width": int(row.get("Width") or 1),
                        "height": int(row.get("Height") or 1),
                        "implicit": [row.get("Game:Implicit 1"), row.get("Game:Implicit 2")],
                        "armour": int(row.get("Game:Armour") or 0),
                        "evasion": int(row.get("Game:Evasion") or 0),
                        "energy_shield": int(row.get("Game:Energy Shield") or 0),
                        "req_str": int(row.get("Game:Strength") or 0),
                        "req_dex": int(row.get("Game:Dexterity") or 0),
                        "req_int": int(row.get("Game:Intelligence") or 0),
                        "item_class": cls,
                    }
                    item_details[name]["implicit"] = [i for i in item_details[name]["implicit"] if i]

    # Load translations
    translations = {}
    en_map = {}
    en_path = RAW_DATA_DIR / "from_ggpk" / "baseitemtypes.json"
    ch_path = RAW_DATA_DIR / "from_ggpk" / "ch_simplified" / "baseitemtypes.json"
    
    if en_path.exists():
        with open(en_path, "r", encoding="utf-8") as f:
            for item in json.load(f):
                if "Id" in item and "Name" in item: en_map[item["Id"]] = item["Name"]
    if ch_path.exists():
        with open(ch_path, "r", encoding="utf-8") as f:
            for item in json.load(f):
                if "Id" in item and "Name" in item:
                    en_name = en_map.get(item["Id"])
                    if en_name: translations[en_name] = item["Name"]

    return sorted(list(item_classes)), item_to_class, item_details, item_subtypes, translations

def main():
    print(f"Setting up demo data in {DEMO_DATA_DIR}...")
    if DEMO_DATA_DIR.exists():
        shutil.rmtree(DEMO_DATA_DIR)
    os.makedirs(DEMO_DATA_DIR)

    # Load base data
    classes, item_to_class, item_details, item_subtypes, translations = load_base_data()

    # 0. Item Classes and All Items
    print("Generating item_classes.json and all_items.json...")
    with open(DEMO_DATA_DIR / "item_classes.json", "w", encoding="utf-8") as f:
        json.dump({"classes": classes}, f)

    # We need to scan mappings to find current tiers for all_items.json
    item_data = {}
    for name, cls in item_to_class.items():
        details = item_details.get(name, {})
        item_data[name] = {
            "name": name,
            "name_ch": translations.get(name, name),
            "sub_type": item_subtypes.get(name, "Other"),
            **details,
            "current_tier": [],
            "source_file": None
        }

    # 1. Category Structure
    print("Copying category structure...")
    safe_copy(DATA_DIR / "category_structure.json", DEMO_DATA_DIR / "category_structure.json")

    # 2. Rule Templates
    print("Copying rule templates...")
    safe_copy(DATA_DIR / "rule_templates.json", DEMO_DATA_DIR / "rule_templates.json")

    # 3. Themes
    print("Copying themes...")
    themes_dir = DATA_DIR / "theme"
    if themes_dir.exists():
        themes = [d.name for d in themes_dir.iterdir() if d.is_dir()]
        with open(DEMO_DATA_DIR / "themes.json", "w", encoding="utf-8") as f:
            json.dump({"themes": themes}, f)
        for theme_name in themes:
            t_dir = themes_dir / theme_name
            t_file = t_dir / f"{theme_name}_theme.json"
            s_map = list(t_dir.glob("*_sound_map.json"))
            t_data = json.load(open(t_file, "r", encoding="utf-8")) if t_file.exists() else {}
            s_data = json.load(open(s_map[0], "r", encoding="utf-8")) if s_map else {}
            with open(DEMO_DATA_DIR / f"theme_{theme_name}.json", "w", encoding="utf-8") as f:
                json.dump({"theme_name": theme_name, "theme_data": t_data, "sound_map_data": s_data}, f)

    # 4. Sounds
    print("Generating sound list...")
    default_dir = SOUND_DIR / "Default"
    sharket_dir = SOUND_DIR / "Sharket掉落音效"
    defaults = [f"Default/{f.name}" for f in default_dir.iterdir() if f.suffix.lower() == '.mp3'] if default_dir.is_dir() else []
    sharket = [f"Sharket掉落音效/{f.name}" for f in sharket_dir.iterdir() if f.suffix.lower() == '.mp3'] if sharket_dir.is_dir() else []
    with open(DEMO_DATA_DIR / "sounds.json", "w", encoding="utf-8") as f:
        json.dump({"defaults": sorted(defaults), "sharket": sorted(sharket)}, f, ensure_ascii=False)

    # 5. Tier Items and Scanning mappings for all_items.json
    print("Generating tier items map...")
    tier_items_map = {}
    mappings_dir = DATA_DIR / "base_mapping"
    if mappings_dir.exists():
        for file_path in mappings_dir.rglob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    mapping = data.get("mapping", {})
                    rules = data.get("rules", [])
                    trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                    
                    # For all_items.json
                    all_involved = set(mapping.keys())
                    for r in rules: all_involved.update(r.get("targets", []))
                    
                    for item_name in all_involved:
                        if item_name not in item_data:
                            # Item not in BaseTypes.csv but in mapping
                            item_data[item_name] = {
                                "name": item_name,
                                "name_ch": translations.get(item_name, item_name),
                                "sub_type": item_subtypes.get(item_name, "Other"),
                                **item_details.get(item_name, {}),
                                "current_tier": [],
                                "source_file": None
                            }
                        
                        item_data[item_name]["source_file"] = file_path.relative_to(mappings_dir).as_posix()
                        if item_name in trans: item_data[item_name]["name_ch"] = trans[item_name]
                        
                        # Tiers
                        tiers = []
                        if item_name in mapping:
                            val = mapping[item_name]
                            tiers.extend(val if isinstance(val, list) else [val])
                        for r in rules:
                            if item_name in r.get("targets", []):
                                t_over = r.get("overrides", {}).get("Tier")
                                if t_over: tiers.append(t_over)
                        
                        item_data[item_name]["current_tier"] = list(set(tiers))

                        # For tier_items.json
                        for t in tiers:
                            if t not in tier_items_map: tier_items_map[t] = []
                            # Check if already added
                            if not any(x['name'] == item_name for x in tier_items_map[t]):
                                tier_items_map[t].append({
                                    "name": item_name, 
                                    "name_ch": item_data[item_name]["name_ch"], 
                                    "source": file_path.relative_to(mappings_dir).as_posix()
                                })
            except: continue
    
    with open(DEMO_DATA_DIR / "tier_items.json", "w", encoding="utf-8") as f:
        json.dump(tier_items_map, f, ensure_ascii=False)
    
    with open(DEMO_DATA_DIR / "all_items.json", "w", encoding="utf-8") as f:
        json.dump({"items": list(item_data.values())}, f, ensure_ascii=False)

    # 6. Config Files
    print("Copying config files...")
    if (DATA_DIR / "tier_definition").exists():
        shutil.copytree(DATA_DIR / "tier_definition", DEMO_DATA_DIR / "config" / "tier_definition", dirs_exist_ok=True)
    if (DATA_DIR / "base_mapping").exists():
        shutil.copytree(DATA_DIR / "base_mapping", DEMO_DATA_DIR / "config" / "base_mapping", dirs_exist_ok=True)

    # 7. Actual MP3 Files
    print("Copying actual sound files...")
    if SOUND_DIR.exists():
        shutil.copytree(SOUND_DIR / "Default", DEMO_DATA_DIR / "sounds" / "Default", dirs_exist_ok=True)
        shutil.copytree(SOUND_DIR / "Sharket掉落音效", DEMO_DATA_DIR / "sounds" / "Sharket掉落音效", dirs_exist_ok=True)

    print("Demo setup complete.")

if __name__ == "__main__":
    main()