import json
from pathlib import Path

#this file should be kind of placeholder to extend this project with more flexiable item-tiering function, 
#i dont think it might be used very often as all the tier should be hard-coded in tier_definitions.json 

def load_tiers(section):
    tiers = json.load(open(Path("data") / "tier_definitions.json", encoding="utf-8"))
    return tiers.get(section, {})

def get_tier(value_level, section, mode):
    tiers = load_tiers(section)
    #just place holder use to further extend
    if mode == "ruthless":
        for t in tiers.values():
            t["min_value"] -= 2  # adjust example
    for name, info in tiers.items():
        if value_level >= info["min_value"]:
            return name, info
        
    return "Uncategorized", {}