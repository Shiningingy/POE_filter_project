import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
BASE_MAPPING_DIR = PROJECT_ROOT / "filter_generation" / "data" / "base_mapping"
TIER_DEF_DIR = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition"
THEME_FILE = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "sharket_theme.json"
SOUND_MAP_FILE = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "Sharket_sound_map.json"
OUTPUT_FILE = PROJECT_ROOT / "webapp" / "frontend" / "public" / "demo_data" / "bundle.json"

def create_bundle():
    bundle = {
        "mappings": {},
        "tiers": {},
        "theme": {},
        "soundMap": {}
    }

    # Load Mappings
    for p in BASE_MAPPING_DIR.rglob("*.json"):
        rel_path = p.relative_to(BASE_MAPPING_DIR).as_posix()
        try:
            bundle["mappings"][rel_path] = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error loading mapping {rel_path}: {e}")

    # Load Tier Definitions
    for p in TIER_DEF_DIR.rglob("*.json"):
        rel_path = p.relative_to(TIER_DEF_DIR).as_posix()
        try:
            bundle["tiers"][rel_path] = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error loading tier def {rel_path}: {e}")

    # Load Theme
    if THEME_FILE.exists():
        bundle["theme"] = json.loads(THEME_FILE.read_text(encoding="utf-8"))
    
    # Load Sound Map
    if SOUND_MAP_FILE.exists():
        bundle["soundMap"] = json.loads(SOUND_MAP_FILE.read_text(encoding="utf-8"))

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Bundle created at {OUTPUT_FILE}")

if __name__ == "__main__":
    create_bundle()
