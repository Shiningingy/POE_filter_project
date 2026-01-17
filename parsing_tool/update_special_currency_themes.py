import json
from pathlib import Path

def update_tier_defs():
    base_dir = Path("filter_generation/data/tier_definition")
    
    # Map file path (relative to tier_definition) to the theme key in sharket_theme.json
    updates = {
        "Currency/Essences.json": "Essences",
        "Currency/Fossils.json": "Fossils",
        "Currency/Delirium Orbs.json": "Delirium Orbs",
        "Currency/Harvest.json": "Harvest",
        "Currency/Ritual.json": "Stackable Currency", # Default for now
        "Currency/Heist.json": "Stackable Currency",
        "Currency/Expedition.json": "Stackable Currency",
        "Currency/Oils.json": "Stackable Currency",
    }
    
    for rel_path, theme_key in updates.items():
        path = base_dir / rel_path
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                # Update theme_category in all top-level categories in this file
                changed = False
                for cat_key, cat_data in data.items():
                    if isinstance(cat_data, dict) and "_meta" in cat_data:
                        if cat_data["_meta"].get("theme_category") != theme_key:
                            cat_data["_meta"]["theme_category"] = theme_key
                            changed = True
                
                if changed:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                    print(f"Updated {rel_path} -> {theme_key}")
            except Exception as e:
                print(f"Error updating {rel_path}: {e}")

if __name__ == "__main__":
    update_tier_defs()
