import json
from pathlib import Path

def create_defs():
    cats = {
        "Currency/Gold.json": { "name": "Gold", "ch": "金币" },
        "Currency/Corpses.json": { "name": "Corpses", "ch": "尸体" },
    }
    
    base_dir = Path("filter_generation/data/tier_definition")
    
    for rel_path, meta in cats.items():
        path = base_dir / rel_path
        if not path.exists():
            cat_key = meta["name"]
            data = {
                cat_key: {
                    "_meta": {
                        "theme_category": "Gold" if "Gold" in cat_key else "Stackable Currency",
                        "localization": { "en": meta["name"], "ch": meta["ch"] }
                    },
                    f"Tier 0 {cat_key}": {
                        "hideable": False,
                        "show_in_editor": False,
                        "theme": { "Tier": 0 },
                        "sound": { "default_sound_id": 6, "sharket_sound_id": "顶级底材.mp3" },
                        "localization": { "en": "T0: Top", "ch": "T0: 顶级" }
                    },
                    f"Tier 1 {cat_key}": {
                        "hideable": False,
                        "theme": { "Tier": 1 },
                        "sound": { "default_sound_id": 6, "sharket_sound_id": "高级通货.mp3" },
                        "localization": { "en": "T1: High", "ch": "T1: 高级" }
                    },
                    f"Tier 2 {cat_key}": {
                        "hideable": False,
                        "theme": { "Tier": 2 },
                        "sound": { "default_sound_id": 1, "sharket_sound_id": "通货.mp3" },
                        "localization": { "en": "T2: Standard", "ch": "T2: 常用" }
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
    create_defs()
