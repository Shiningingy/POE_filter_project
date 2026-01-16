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
        "Base Jewels": BASE_DIR / "Jewels/Base Jewels.json",
        "Cluster Jewels": BASE_DIR / "Jewels/Cluster Jewels.json",
        "Abyss Jewels": BASE_DIR / "Jewels/Abyss Jewels.json",
        "Incubators": BASE_DIR / "Currency/Incubators.json",
        "One Hand Swords": BASE_DIR / "Equipment/Weapons/One Hand Swords.json",
        "Rune Daggers": BASE_DIR / "Equipment/Weapons/Rune Daggers.json",
        "Breach": BASE_DIR / "Currency/Breach.json",
        "Delirium Orbs": BASE_DIR / "Currency/Delirium Orbs.json",
        "Resonators": BASE_DIR / "Currency/Fossils.json", # Usually grouped with fossils?
        "Fossils": BASE_DIR / "Currency/Fossils.json",
        "Oils": BASE_DIR / "Currency/Oils.json",
    }
    
    # Load target data
    target_data = {}
    for key, path in targets.items():
        if path not in target_data:
            target_data[path] = load_json(path)

    # Helper to determine target
    def get_target(name):
        if "Cluster Jewel" in name: return targets["Cluster Jewels"]
        if "Abyss Jewel" in name or "Eye Jewel" in name: return targets["Abyss Jewels"]
        if "Jewel" in name: return targets["Base Jewels"]
        
        if "Incubator" in name: return targets["Incubators"]
        
        if "Rapier" in name or "Foil" in name or "Smallsword" in name or "Estoc" in name or "Saber" in name or "Cutlass" in name or "Blade" in name or "Sword" in name:
             return targets["One Hand Swords"] # Simplification
             
        if "Breachstone" in name: return targets["Breach"]
        if "Delirium Orb" in name: return targets["Delirium Orbs"]
        if "Resonator" in name or "Fossil" in name: return targets["Fossils"]
        if "Oil" in name or "Tainted Oil" in name: return targets["Oils"]

        return None

    # Iterate mapping
    items_to_remove = []
    
    for item, tier in misc_data.get("mapping", {}).items():
        target_file = get_target(item)
        if target_file and target_file != misc_path:
            # Add to target
            target_json = target_data[target_file]
            
            # Determine new tier name - Default to Tier 1 of that category
            cat_name = target_file.stem
            if "One Hand Swords" in str(target_file): cat_name = "One Hand Swords"
            if "Base Jewels" in str(target_file): cat_name = "Base Jewels"
            
            new_tier = f"Tier 1 {cat_name}"
            
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
