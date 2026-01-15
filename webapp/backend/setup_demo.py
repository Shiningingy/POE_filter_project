import os
import json
import shutil
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = BACKEND_DIR.parent.parent.resolve()
FILTER_GEN_DIR = PROJECT_ROOT / "filter_generation"
DATA_DIR = FILTER_GEN_DIR / "data"
SOUND_DIR = PROJECT_ROOT / "sound_files"
FRONTEND_PUBLIC_DIR = PROJECT_ROOT / "webapp" / "frontend" / "public"
DEMO_DATA_DIR = FRONTEND_PUBLIC_DIR / "demo_data"

def safe_copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)

def main():
    print(f"Setting up demo data in {DEMO_DATA_DIR}...")
    if DEMO_DATA_DIR.exists():
        shutil.rmtree(DEMO_DATA_DIR)
    os.makedirs(DEMO_DATA_DIR)

    # 1. Category Structure
    print("Copying category structure...")
    safe_copy(DATA_DIR / "category_structure.json", DEMO_DATA_DIR / "category_structure.json")

    # 2. Rule Templates
    print("Copying rule templates...")
    safe_copy(DATA_DIR / "rule_templates.json", DEMO_DATA_DIR / "rule_templates.json")

    # 3. Themes (Sharket only for now or all?)
    print("Copying themes...")
    # Assuming the frontend requests /api/themes/sharket -> We need to structure it.
    # Frontend calls /api/themes -> returns list.
    # Frontend calls /api/themes/sharket -> returns { theme_data, sound_map_data }
    # We will generate static JSONs for these.
    
    themes_dir = DATA_DIR / "theme"
    if themes_dir.exists():
        themes = [d.name for d in themes_dir.iterdir() if d.is_dir()]
        with open(DEMO_DATA_DIR / "themes.json", "w", encoding="utf-8") as f:
            json.dump({"themes": themes}, f)
        
        for theme_name in themes:
            t_dir = themes_dir / theme_name
            t_file = t_dir / f"{theme_name}_theme.json"
            s_map = list(t_dir.glob("*_sound_map.json"))
            
            t_data = json.load(open(t_file, "r", encoding="utf-8")) if t_file.exists() else {}
            s_data = json.load(open(s_map[0], "r", encoding="utf-8")) if s_map else {}
            
            # Save as specifically named file for the mock adapter to find
            with open(DEMO_DATA_DIR / f"theme_{theme_name}.json", "w", encoding="utf-8") as f:
                json.dump({"theme_name": theme_name, "theme_data": t_data, "sound_map_data": s_data}, f)

    # 4. Sounds
    print("Generating sound list...")
    default_dir = SOUND_DIR / "Default"
    sharket_dir = SOUND_DIR / "Sharket掉落音效"
    defaults = [f"Default/{f.name}" for f in default_dir.iterdir() if f.suffix.lower() == '.mp3'] if default_dir.is_dir() else []
    sharket = [f"Sharket掉落音效/{f.name}" for f in sharket_dir.iterdir() if f.suffix.lower() == '.mp3'] if sharket_dir.is_dir() else []
    
    with open(DEMO_DATA_DIR / "sounds.json", "w", encoding="utf-8") as f:
        json.dump({"defaults": sorted(defaults), "sharket": sorted(sharket)}, f, ensure_ascii=False)

    # 5. Tier Items (All Items Map)
    print("Generating tier items map...")
    tier_items_map = {} # tier_key -> list of items
    mappings_dir = DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                for item_name, tier_key in mapping.items():
                    if tier_key not in tier_items_map:
                        tier_items_map[tier_key] = []
                    tier_items_map[tier_key].append({
                        "name": item_name, 
                        "name_ch": trans.get(item_name, item_name), 
                        "source": file_path.relative_to(mappings_dir).as_posix()
                    })
        except: continue
    
    with open(DEMO_DATA_DIR / "tier_items.json", "w", encoding="utf-8") as f:
        json.dump(tier_items_map, f, ensure_ascii=False)

    # 6. Config Files (Tier Definitions)
    print("Copying config files...")
    # Frontend requests /api/config/{path}. We will mirror the structure inside demo_data/config
    # We only need to copy what's in 'tier_definitions' basically, or whatever category_structure points to.
    # category_structure points to files relative to 'data'.
    # e.g. "tier_definition/General/Currency.json"
    # So we copy the whole data folder structure? No, just the JSONs.
    
    # We'll walk DATA_DIR and copy all JSONs to DEMO_DATA_DIR/config
    # But wait, sidebar path is like "tier_definition/..."
    # So we copy DATA_DIR/tier_definition to DEMO_DATA_DIR/config/tier_definition
    
    if (DATA_DIR / "tier_definition").exists():
        shutil.copytree(DATA_DIR / "tier_definition", DEMO_DATA_DIR / "config" / "tier_definition", dirs_exist_ok=True)

    print("Demo setup complete.")

if __name__ == "__main__":
    main()
