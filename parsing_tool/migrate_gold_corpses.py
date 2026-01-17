import json
from pathlib import Path

BASE_DIR = Path("filter_generation/data/base_mapping")

def load_json(path):
    if not path.exists(): return {"_meta": {}, "mapping": {}, "rules": []}
    with open(path, "r", encoding="utf-8") as f: return json.load(f)

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def migrate():
    misc_path = BASE_DIR / "Misc/General.json"
    misc_data = load_json(misc_path)
    
    # Targets
    gold_path = BASE_DIR / "Currency/Gold.json"
    corpse_path = BASE_DIR / "Currency/Corpses.json"
    
    gold_data = load_json(gold_path)
    corpse_data = load_json(corpse_path)
    
    # Init Meta if empty
    if not gold_data.get("_meta"):
        gold_data["_meta"] = { "localization": { "ch": {} }, "item_class": { "en": "Gold", "ch": "金币" }, "theme_category": "Gold" }
    if not corpse_data.get("_meta"):
        corpse_data["_meta"] = { "localization": { "ch": {} }, "item_class": { "en": "Corpses", "ch": "尸体" }, "theme_category": "Stackable Currency" }

    items_to_remove = []
    
    for item, tier in misc_data.get("mapping", {}).items():
        target_json = None
        new_tier = ""
        
        if item == "Gold":
            target_json = gold_data
            new_tier = "Tier 1 Gold"
        elif "Perfect " in item or "Imperfect " in item:
            target_json = corpse_data
            new_tier = "Tier 1 Corpses"
            
        if target_json:
            target_json["mapping"][item] = new_tier
            
            # Move Loc
            if "_meta" in misc_data and "localization" in misc_data["_meta"] and "ch" in misc_data["_meta"]["localization"]:
                loc = misc_data["_meta"]["localization"]["ch"].get(item)
                if loc:
                    target_json["_meta"]["localization"]["ch"][item] = loc
            
            items_to_remove.append(item)

    # Remove
    for item in items_to_remove:
        del misc_data["mapping"][item]
        if item in misc_data.get("_meta", {}).get("localization", {}).get("ch", {}):
            del misc_data["_meta"]["localization"]["ch"][item]

    save_json(misc_path, misc_data)
    save_json(gold_path, gold_data)
    save_json(corpse_path, corpse_data)
    print(f"Migrated {len(items_to_remove)} items.")

if __name__ == "__main__":
    migrate()
