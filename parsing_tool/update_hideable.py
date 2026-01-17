import json
import os
from pathlib import Path

def update_hideable(directory):
    path = Path(directory)
    for json_file in path.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            modified = False
            # Data structure is typically: { CategoryName: { TierName: { hideable: ... } } }
            for cat_key, cat_data in data.items():
                if cat_key == "_meta": continue
                if not isinstance(cat_data, dict): continue
                
                for tier_key, tier_data in cat_data.items():
                    if tier_key == "_meta": continue
                    if isinstance(tier_data, dict) and "hideable" in tier_data:
                        # Logic: If it's a Tier 0 (locked) tier, it must NOT be hideable
                        is_tier_0 = tier_data.get("show_in_editor") == False or "Tier 0" in tier_key
                        
                        if is_tier_0:
                            if tier_data["hideable"] is not False:
                                tier_data["hideable"] = False
                                modified = True
                        else:
                            # Other tiers should remain hideable
                            if tier_data["hideable"] is not True:
                                tier_data["hideable"] = True
                                modified = True
            
            if modified:
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Updated: {json_file}")
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    update_hideable("filter_generation/data/tier_definition")
