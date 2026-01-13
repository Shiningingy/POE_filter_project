import json
from pathlib import Path
from collections import defaultdict

# Mapping for logical category and file names to their Chinese counterparts
LOCALIZATION_MAP = {
    # Top Level
    "Currency": "通货",
    "Equipment": "装备",
    "Gems": "宝石",
    "Maps": "地图",
    "Divination Cards": "命运卡",
    "Misc": "杂项",
    
    # Sub Groups
    "General": "通用",
    "Armour": "护甲",
    "Weapons": "武器",
    "Jewellery": "饰品",
    
    # Functional Files
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
    "Fishing Rods": "鱼竿"
}

def generate_structure():
    project_root = Path(__file__).parent.parent
    data_dir = project_root / "filter_generation" / "data"
    mapping_dir = data_dir / "base_mapping"
    
    structure = {"categories": []}
    categories_map = {} 

    for json_file in mapping_dir.glob("**/*.json"):
        rel_path = json_file.relative_to(mapping_dir)
        parts = rel_path.parts 
        
        if len(parts) < 2: continue
        
        cat_name = parts[0]
        file_name = parts[-1]
        
        if cat_name not in categories_map:
            categories_map[cat_name] = {
                "_meta": { "localization": { "en": cat_name, "ch": LOCALIZATION_MAP.get(cat_name, cat_name) } },
                "subgroups": defaultdict(list)
            }
        
        sub_name = parts[1] if len(parts) > 2 else "General"
        
        mapping_path = f"base_mapping/{rel_path.as_posix()}"
        tier_path = f"tier_definition/{rel_path.as_posix()}"
        
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            file_loc_en = file_name.replace(".json", "")
            # Priority: Manual Map -> Meta Name -> Filename
            file_loc_ch = LOCALIZATION_MAP.get(file_loc_en, data.get("_meta", {}).get("item_class", {}).get("ch", file_loc_en))
            target_cat = data.get("_meta", {}).get("theme_category", file_loc_en)

        categories_map[cat_name]["subgroups"][sub_name].append({
            "path": rel_path.as_posix(),
            "tier_path": tier_path,
            "mapping_path": mapping_path,
            "target_category": target_cat,
            "localization": { "en": file_loc_en, "ch": file_loc_ch }
        })

    for cat_name, cat_data in sorted(categories_map.items()):
        subgroups = []
        for sub_name, files in sorted(cat_data["subgroups"].items()):
            subgroups.append({
                "_meta": { "localization": { "en": sub_name, "ch": LOCALIZATION_MAP.get(sub_name, sub_name) } },
                "files": sorted(files, key=lambda x: x["localization"]["en"])
            })
        
        category = {
            "_meta": cat_data["_meta"],
            "subgroups": subgroups
        }
        structure["categories"].append(category)

    with open(data_dir / "category_structure.json", "w", encoding="utf-8") as f:
        json.dump(structure, f, indent=2, ensure_ascii=False)

    print("Generated localized category_structure.json")

if __name__ == "__main__":
    generate_structure()