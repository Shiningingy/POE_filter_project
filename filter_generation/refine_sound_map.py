import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
DATA_DIR = PROJECT_ROOT / "data"
SOUND_MAP_FILE = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "Sharket_sound_map.json"
OUTPUT_FILE = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "Sharket_sound_map_v2.json"

def load_reverse_translations():
    """Load CH -> EN mapping for BaseTypes."""
    print("Loading translations...")
    en_map = {} # ID -> Name
    try:
        en_path = DATA_DIR / "from_ggpk" / "baseitemtypes.json"
        if en_path.exists():
            with open(en_path, "r", encoding="utf-8") as f:
                en_data = json.load(f)
                for item in en_data:
                    if "Id" in item and "Name" in item:
                        en_map[item["Id"]] = item["Name"]
    except Exception as e: 
        print(f"Error loading EN base types: {e}")
        return {}

    ch_to_en = {}
    try:
        ch_path = DATA_DIR / "from_ggpk" / "ch_simplified" / "baseitemtypes.json"
        if ch_path.exists():
            with open(ch_path, "r", encoding="utf-8") as f:
                ch_data = json.load(f)
                for item in ch_data:
                    if "Id" in item and "Name" in item:
                        en_name = en_map.get(item["Id"])
                        if en_name:
                            ch_to_en[item["Name"]] = en_name
                            # Also map stripped versions if needed?
    except Exception as e:
        print(f"Error loading CH base types: {e}")
        return {}
        
    print(f"Loaded {len(ch_to_en)} reverse translations.")
    return ch_to_en

def main():
    if not SOUND_MAP_FILE.exists():
        print("Sound map not found!")
        return

    sound_map = json.loads(SOUND_MAP_FILE.read_text(encoding="utf-8"))
    ch_to_en = load_reverse_translations()

    new_map = {
        "basetype_sounds": {},
        "class_sounds": {}
    }

    matched_count = 0
    unmatched_count = 0

    for ch_key, data in sound_map.items():
        # Try exact match
        en_name = ch_to_en.get(ch_key)
        
        if en_name:
            # It's a Base Type!
            new_map["basetype_sounds"][en_name] = data
            matched_count += 1
        else:
            # It's likely a Class or Category
            # Keep the Chinese key for now, or we need a Class translation map too?
            new_map["class_sounds"][ch_key] = data
            unmatched_count += 1

    print(f"Refinement Complete.")
    print(f"  BaseTypes Identified: {matched_count}")
    print(f"  Classes/Categories: {unmatched_count}")
    
    OUTPUT_FILE.write_text(json.dumps(new_map, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()