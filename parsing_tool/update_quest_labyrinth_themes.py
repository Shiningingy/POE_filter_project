# [parsing_tool group D: SPENT ONE-SHOT, 2026-01-17] Already applied to the tree.
# Re-running reverts that region to its 2026-01-17 state and destroys curation done
# since. Kept as the record of how the tree got its shape. See parsing_tool/README.md.
import json
from pathlib import Path

def update_tier_defs():
    base_dir = Path("filter_generation/data/tier_definition")
    
    # Map file path (relative to tier_definition) to the theme key in sharket_theme.json
    updates = {
        "Quest/Quest Items.json": "Quest Items",
        "Quest/Labyrinth.json": "Labyrinth Items",
        "Currency/Harvest.json": "Harvest",
    }
    
    for rel_path, theme_key in updates.items():
        path = base_dir / rel_path
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
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
