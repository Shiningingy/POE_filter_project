# [parsing_tool group D: SPENT ONE-SHOT, 2026-01-17] Already applied to the tree.
# Re-running reverts that region to its 2026-01-17 state and destroys curation done
# since. Kept as the record of how the tree got its shape. See parsing_tool/README.md.
import json
from pathlib import Path

def verify_tier_completeness(directory):
    path = Path(directory)
    for json_file in path.rglob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            for cat_key, cat_data in data.items():
                if cat_key == "_meta": continue
                if not isinstance(cat_data, dict): continue
                
                tier_keys = cat_data.keys()
                has_t0 = any("Tier 0" in k for k in tier_keys)
                has_hide = any("Hide" in k for k in tier_keys)
                
                if not has_t0 or not has_hide:
                    print(f"Missing T0 or Hide in: {json_file}")
                    # Auto-fix via existing scripts recommended
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    verify_tier_completeness("filter_generation/data/tier_definition")
