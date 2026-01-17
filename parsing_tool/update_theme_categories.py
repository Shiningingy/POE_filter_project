import json
from pathlib import Path

def update_themes():
    base_dir = Path("filter_generation/data/tier_definition")
    
    mapping = {
        "Divination Cards": "Divination Cards",
        "Maps": "Maps",
        "Gems": "Gems",
        "Jewels": "Jewels",
        "Flasks/Life.json": "Life Flasks",
        "Flasks/Mana.json": "Mana Flasks",
        "Flasks/Utility.json": "Utility Flasks",
        "Uniques": "Uniques",
        "Currency/Gold.json": "Gold",
        "Currency/Corpses.json": "Stackable Currency", # Fallback or new?
        "Maps/Fragments.json": "Map Fragments"
    }
    
    for path_key, theme_key in mapping.items():
        if path_key.endswith(".json"):
            # Single file
            files = [base_dir / path_key]
        else:
            # Directory
            files = (base_dir / path_key).rglob("*.json")
            
        for json_file in files:
            if not json_file.exists(): continue
            
            try:
                data = json.load(open(json_file, "r", encoding="utf-8"))
                for cat_key, cat_data in data.items():
                    if "_meta" in cat_data:
                        cat_data["_meta"]["theme_category"] = theme_key
                        
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Updated {json_file} -> {theme_key}")
            except Exception as e:
                print(f"Error {json_file}: {e}")

if __name__ == "__main__":
    update_themes()
