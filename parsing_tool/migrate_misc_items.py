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
    
    # Target files
    targets = {
        "Life Flask": BASE_DIR / "Flasks/Life.json",
        "Mana Flask": BASE_DIR / "Flasks/Mana.json",
        "Hybrid Flask": BASE_DIR / "Flasks/Life.json", # Put Hybrid in Life for now? Or make Hybrid file?
        "Utility Flask": BASE_DIR / "Flasks/Utility.json",
        "Quest": BASE_DIR / "Quest/Quest Items.json",
        "Labyrinth": BASE_DIR / "Quest/Labyrinth.json",
        "Heist": BASE_DIR / "Currency/Heist.json",
        "Expedition": BASE_DIR / "Currency/Expedition.json",
        "Sentinels": BASE_DIR / "Misc/General.json", # Keep for now
        "Corpses": BASE_DIR / "Misc/General.json", # Keep for now
    }
    
    # Load target data
    target_data = {}
    for key, path in targets.items():
        if path not in target_data:
            target_data[path] = load_json(path)

    # Keywords to match
    moves = []
    
    # Helper to determine target
    def get_target(name):
        if "Life Flask" in name: return targets["Life Flask"]
        if "Mana Flask" in name: return targets["Mana Flask"]
        if "Hybrid Flask" in name: return targets["Life Flask"] # Group with Life
        if "Flask" in name and "Life" not in name and "Mana" not in name and "Hybrid" not in name: return targets["Utility Flask"]
        
        if "Contract:" in name or "Blueprint:" in name or "Lockpick" in name or "Brooch" in name or "Cloak" in name or "Bracers" in name or "Gear" in name or "Tool" in name or "Disguise" in name:
             return targets["Heist"]
             
        if "Logbook" in name: return targets["Expedition"]
        
        # Quest / Labyrinth
        if "Key" in name or "Glyph" in name or "Bust" in name or "Page" in name or "Plum" in name or "Banner" in name or "Organ" in name or "Eye" in name or "Heart" in name or "Lungs" in name or "Entrails" in name or "Sign" in name or "Hair" in name or "Tooth" in name or "Jaw" in name or "Manuscript" in name or "Flag" in name or "Venom" in name or "Firefly" in name or "Star" in name or "Locket" in name or "Necklace" in name or "Ankh" in name or "Wings" in name or "Orb" in name or "Blade" in name or "Bottle" in name or "Calendar" in name or "Acid" in name or "Powder" in name or "Feather" in name or "Teardrop" in name or "Elixir" in name or "Compass" in name or "Astrolabe" in name:
             # Refine Quest vs Currency
             if "Divine Orb" in name or "Chaos Orb" in name or "Exalted Orb" in name: return None # Keep currency
             if "Offering to the Goddess" in name or "Dedication" in name or "Tribute" in name or "Gift" in name: return targets["Labyrinth"]
             return targets["Quest"]

        return None

    # Iterate mapping
    items_to_remove = []
    
    for item, tier in misc_data.get("mapping", {}).items():
        target_file = get_target(item)
        if target_file and target_file != misc_path:
            # Add to target
            target_json = target_data[target_file]
            
            # Determine new tier name
            # Simple heuristic: If it was T1 General, map to T1 Target?
            # Or just set a default "Tier 1 [Category]"
            
            # Extract category name from target filename
            cat_name = target_file.stem # e.g. "Life"
            if "Quest" in str(target_file): cat_name = "Quest Items"
            if "Labyrinth" in str(target_file): cat_name = "Labyrinth Items"
            if "Heist" in str(target_file): cat_name = "Heist"
            if "Life" in str(target_file): cat_name = "Life Flasks"
            if "Mana" in str(target_file): cat_name = "Mana Flasks"
            if "Utility" in str(target_file): cat_name = "Utility Flasks"
            
            new_tier = f"Tier 1 {cat_name}" # Default all to T1 for now, user can resort
            
            target_json["mapping"][item] = new_tier
            
            # Move localization if exists
            if "_meta" in misc_data and "localization" in misc_data["_meta"] and "ch" in misc_data["_meta"]["localization"]:
                loc = misc_data["_meta"]["localization"]["ch"].get(item)
                if loc:
                    if "localization" not in target_json["_meta"]: target_json["_meta"]["localization"] = {"en": cat_name, "ch": {}}
                    if "ch" not in target_json["_meta"]["localization"]: target_json["_meta"]["localization"]["ch"] = {}
                    target_json["_meta"]["localization"]["ch"][item] = loc
            
            items_to_remove.append(item)

    # Remove from source
    for item in items_to_remove:
        del misc_data["mapping"][item]
        if "_meta" in misc_data and "localization" in misc_data["_meta"] and "ch" in misc_data["_meta"]["localization"]:
             if item in misc_data["_meta"]["localization"]["ch"]:
                 del misc_data["_meta"]["localization"]["ch"][item]

    # Save all
    save_json(misc_path, misc_data)
    for path, data in target_data.items():
        if path != misc_path:
            save_json(path, data)
            print(f"Updated {path}")

if __name__ == "__main__":
    migrate()
