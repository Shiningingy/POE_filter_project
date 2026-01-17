import json
import os
import re
from pathlib import Path

def get_tier_num(key):
    # Tier 0 ... -> 0
    # Tier Hide ... -> 9
    if "Tier 0" in key: return 0
    if "Hide" in key: return 9
    match = re.search(r"Tier (\d+)", key)
    if match: return int(match[1])
    return 999 # Custom tiers at the end

def resort_tiers(directory):
    path = Path(directory)
    for json_file in path.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            modified = False
            for cat_key, cat_data in data.items():
                if cat_key == "_meta": continue
                if not isinstance(cat_data, dict): continue
                
                # Get all tier keys (excluding _meta and rules)
                keys = [k for k in cat_data.keys() if k != "_meta" and k != "rules"]
                
                # Sort them
                sorted_keys = sorted(keys, key=get_tier_num)
                
                if "_meta" not in cat_data:
                    cat_data["_meta"] = {}
                
                if cat_data["_meta"].get("tier_order") != sorted_keys:
                    cat_data["_meta"]["tier_order"] = sorted_keys
                    modified = True
            
            if modified:
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Resorted: {json_file}")
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    resort_tiers("filter_generation/data/tier_definition")
