"""
Patch all 14 tier_definition/_campaign/Weapons/*.json files:
- Add AreaLevel <= 30 to Early tier
- Add AreaLevel <= 50 to Mid tier
- Add AreaLevel <= 63 to Late tier
- Leave PreEndgame unchanged
"""
import json
from pathlib import Path

TIER_DIR = Path(__file__).parent.parent / "filter_generation/data/tier_definition/_campaign/Weapons"

AREALEVEL_BY_SUFFIX = {
    "Early": "<= 30",
    "Mid": "<= 50",
    "Late": "<= 63",
    "PreEndgame": None,  # no change
}

files = sorted(TIER_DIR.glob("*.json"))
print(f"Found {len(files)} weapon tier files")

for fp in files:
    with open(fp, encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    for group_name, group_data in data.items():
        for tier_key, tier_entry in group_data.items():
            if not isinstance(tier_entry, dict):
                continue
            conditions = tier_entry.get("conditions")
            if conditions is None:
                continue
            for suffix, arealevel in AREALEVEL_BY_SUFFIX.items():
                if tier_key.endswith(suffix):
                    if arealevel and "AreaLevel" not in conditions:
                        conditions["AreaLevel"] = arealevel
                        changed = True
                        print(f"  [{fp.name}] {tier_key}: added AreaLevel {arealevel}")
                    break

    if changed:
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"  -> Saved {fp.name}")
    else:
        print(f"  [{fp.name}] no changes needed")

print("Done.")
