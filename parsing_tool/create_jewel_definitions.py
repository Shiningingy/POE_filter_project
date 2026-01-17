import json
from pathlib import Path

def create_definitions():
    cats = {
        "Jewels/Base Jewels.json": { "name": "Base Jewels", "ch": "基础珠宝" },
        "Jewels/Cluster Jewels.json": { "name": "Cluster Jewels", "ch": "星团珠宝" },
        "Jewels/Abyss Jewels.json": { "name": "Abyss Jewels", "ch": "深渊珠宝" }
    }
    
    base_dir = Path("filter_generation/data/tier_definition")
    
    for rel_path, meta in cats.items():
        path = base_dir / rel_path
        if not path.exists():
            cat_key = meta["name"]
            data = {
                cat_key: {
                    "_meta": {
                        "theme_category": "Jewels",
                        "localization": { "en": meta["name"], "ch": meta["ch"] }
                    },
                    f"Tier 0 {cat_key}": {
                        "hideable": False,
                        "show_in_editor": False,
                        "theme": { "Tier": 0 },
                        "sound": { "default_sound_id": 6, "sharket_sound_id": "顶级底材.mp3" },
                        "localization": { "en": "T0: Top Value", "ch": "T0: 顶级珠宝" }
                    },
                    f"Tier 1 {cat_key}": {
                        "hideable": False,
                        "theme": { "Tier": 1 },
                        "sound": { "default_sound_id": 1, "sharket_sound_id": "高级通货.mp3" },
                        "localization": { "en": "T1: High Value", "ch": "T1: 高级珠宝" }
                    },
                    f"Tier 2 {cat_key}": {
                        "hideable": False,
                        "theme": { "Tier": 2 },
                        "sound": { "default_sound_id": 2, "sharket_sound_id": "通货.mp3" },
                        "localization": { "en": "T2: Standard", "ch": "T2: 常用珠宝" }
                    },
                    f"Tier Hide {cat_key}": {
                        "hideable": True,
                        "is_hide_tier": True,
                        "theme": { "Tier": 9 },
                        "sound": { "default_sound_id": -1, "sharket_sound_id": None },
                        "localization": { "en": "Hide", "ch": "隐藏" }
                    }
                }
            }
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Created {path}")

if __name__ == "__main__":
    create_definitions()
