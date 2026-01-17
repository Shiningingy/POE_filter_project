import json
import os
from pathlib import Path

def set_visibility_defaults(directory):
    path = Path(directory)
    for json_file in path.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            modified = False
            for cat_key, cat_data in data.items():
                if cat_key == "_meta": continue
                if not isinstance(cat_data, dict): continue
                
                for tier_key, tier_data in cat_data.items():
                    if tier_key == "_meta": continue
                    if isinstance(tier_data, dict):
                        is_hide_tier = tier_data.get("is_hide_tier") == True or "Tier Hide" in tier_key
                        
                        # Default Rule:
                        # 1. Tier 9 (Hide) -> Default to Hidden (hideable: true)
                        # 2. Others -> Default to Shown (hideable: false)
                        if is_hide_tier:
                            if tier_data.get("hideable") is not True:
                                tier_data["hideable"] = True
                                modified = True
                        else:
                            if tier_data.get("hideable") is not False:
                                tier_data["hideable"] = False
                                modified = True
            
            if modified:
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Defaults applied: {json_file}")
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    set_visibility_defaults("filter_generation/data/tier_definition")
