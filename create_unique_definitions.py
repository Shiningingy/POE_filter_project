import json
from pathlib import Path

def create_uniques():
    cats = {
        "Uniques/General.json": { "name": "Unique Items", "ch": "传奇物品" },
    }
    
    base_dir = Path("filter_generation/data/tier_definition")
    
    for rel_path, meta in cats.items():
        path = base_dir / rel_path
        if not path.exists():
            cat_key = meta["name"]
            data = {
                cat_key: {
                    "_meta": {
                        "theme_category": "Uniques",
                        "localization": { "en": meta["name"], "ch": meta["ch"] }
                    },
                    f"Tier 0 {cat_key}": {
                        "hideable": False,
                        "show_in_editor": False,
                        "theme": { "Tier": 0 },
                        "sound": { "default_sound_id": 6, "sharket_sound_id": "超级传奇.mp3" },
                        "localization": { "en": "T0: Chase Uniques", "ch": "T0: 顶级传奇" }
                    },
                    f"Tier 1 {cat_key}": {
                        "hideable": False,
                        "theme": { "Tier": 1 },
                        "sound": { "default_sound_id": 6, "sharket_sound_id": "传奇.mp3" },
                        "localization": { "en": "T1: High Value", "ch": "T1: 高级传奇" }
                    },
                    f"Tier 2 {cat_key}": {
                        "hideable": False,
                        "theme": { "Tier": 2 },
                        "sound": { "default_sound_id": 1, "sharket_sound_id": "传奇.mp3" },
                        "localization": { "en": "T2: Good Value", "ch": "T2: 优质传奇" }
                    },
                    f"Tier 3 {cat_key}": {
                        "hideable": True,
                        "theme": { "Tier": 3 },
                        "sound": { "default_sound_id": 1, "sharket_sound_id": "传奇.mp3" },
                        "localization": { "en": "T3: Decent", "ch": "T3: 常用传奇" }
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
    create_uniques()
