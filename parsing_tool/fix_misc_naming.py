import json
from pathlib import Path

def fix_misc():
    base_map = Path("filter_generation/data/base_mapping/Misc/General.json")
    tier_def = Path("filter_generation/data/tier_definition/Misc/General.json")
    
    # Fix Mapping
    if base_map.exists():
        data = json.load(open(base_map, "r", encoding="utf-8"))
        
        # Rename Tier Values
        new_mapping = {}
        for item, tier in data.get("mapping", {}).items():
            new_tier = tier.replace("Tier 1 General", "Tier 1 Misc") \
                           .replace("Tier 0 General", "Tier 0 Misc") \
                           .replace("Tier 2 General", "Tier 2 Misc") \
                           .replace("Tier 3 General", "Tier 3 Misc") \
                           .replace("Tier 4 General", "Tier 4 Misc") \
                           .replace("Tier 5 General", "Tier 5 Misc") \
                           .replace("Tier Hide General", "Tier Hide Misc")
            new_mapping[item] = new_tier
            
        data["mapping"] = new_mapping
        
        # Update Rules if any
        for r in data.get("rules", []):
            if "overrides" in r and "Tier" in r["overrides"]:
                r["overrides"]["Tier"] = r["overrides"]["Tier"].replace("General", "Misc")
                
        with open(base_map, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Updated Mapping")

    # Fix Definition
    if tier_def.exists():
        data = json.load(open(tier_def, "r", encoding="utf-8"))
        
        # Rename Root Key
        if "General" in data:
            data["Misc"] = data.pop("General")
            
        cat_data = data["Misc"]
        
        # Rename Keys
        new_cat_data = {}
        for k, v in cat_data.items():
            new_key = k.replace("General", "Misc")
            new_cat_data[new_key] = v
            
        # Update _meta
        if "_meta" in new_cat_data:
            new_cat_data["_meta"]["localization"] = {"en": "Misc", "ch": "杂项"}
            if "tier_order" in new_cat_data["_meta"]:
                new_cat_data["_meta"]["tier_order"] = [t.replace("General", "Misc") for t in new_cat_data["_meta"]["tier_order"]]
                
        data["Misc"] = new_cat_data
        
        with open(tier_def, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Updated Definition")

if __name__ == "__main__":
    fix_misc()
