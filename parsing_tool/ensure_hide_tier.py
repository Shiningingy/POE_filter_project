import json
import os
from pathlib import Path

def ensure_hide_tier(directory):
    path = Path(directory)
    for json_file in path.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            modified = False
            for cat_key, cat_data in data.items():
                if cat_key == "_meta": continue
                if not isinstance(cat_data, dict): continue
                
                # Check for existing Hide Tier
                hide_key = f"Tier Hide {cat_key}"
                has_hide = any("Hide" in k for k in cat_data.keys())
                
                if not has_hide:
                    cat_data[hide_key] = {
                        "hideable": True,
                        "is_hide_tier": True,
                        "theme": { "Tier": 9 },
                        "sound": { "default_sound_id": -1, "sharket_sound_id": null },
                        "localization": { "en": "Hide", "ch": "隐藏" }
                    }
                    modified = True
                    print(f"Added Hide Tier to: {cat_key} in {json_file}")
                
                # Ensure Tier Order includes the Hide Tier
                if modified and "_meta" in cat_data and "tier_order" in cat_data["_meta"]:
                    if hide_key not in cat_data["_meta"]["tier_order"]:
                        cat_data["_meta"]["tier_order"].append(hide_key)

            if modified:
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    # Fix python boolean/null for JSON structure if needed, but standard python uses True/False/None
    # This script writes valid JSON.
    null = None
    ensure_hide_tier("filter_generation/data/tier_definition")
