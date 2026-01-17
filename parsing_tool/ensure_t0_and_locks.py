import json
import os
from pathlib import Path

def process_files(directory):
    path = Path(directory)
    for json_file in path.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            modified = False
            for cat_key, cat_data in data.items():
                if cat_key == "_meta": continue
                if not isinstance(cat_data, dict): continue
                
                # 1. Ensure Tier 0 exists and is locked
                t0_key = f"Tier 0 {cat_key}"
                if t0_key not in cat_data:
                    cat_data[t0_key] = {
                        "hideable": false,
                        "show_in_editor": false,
                        "theme": { "Tier": 0 },
                        "sound": { "default_sound_id": 6, "sharket_sound_id": "顶级底材.mp3" },
                        "localization": { "en": "T0: Absolute Top", "ch": "T0: 顶级/核心" }
                    }
                    modified = True
                else:
                    # Update existing T0
                    if cat_data[t0_key].get("show_in_editor") != False:
                        cat_data[t0_key]["show_in_editor"] = False
                        modified = True
                    if cat_data[t0_key].get("hideable") != False:
                        cat_data[t0_key]["hideable"] = False
                        modified = True

                # 2. Cleanup other tiers (ensure show_in_editor: true if not T0)
                for tier_key, tier_data in cat_data.items():
                    if tier_key == "_meta" or tier_key == t0_key: continue
                    if isinstance(tier_data, dict):
                        if tier_data.get("show_in_editor") == False:
                            del tier_data["show_in_editor"] # Default is true
                            modified = True
                        
                        # Ensure Hide Tier is correctly marked
                        if "Hide" in tier_key or tier_data.get("is_hide_tier"):
                            if not tier_data.get("is_hide_tier"):
                                tier_data["is_hide_tier"] = True
                                modified = True
                            if tier_data.get("hideable") != True:
                                tier_data["hideable"] = True
                                modified = True
            
            if modified:
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Verified & Fixed: {json_file}")
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    # Fix the boolean names for Python
    false = False
    true = True
    process_files("filter_generation/data/tier_definition")
