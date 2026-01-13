import json
from pathlib import Path
import sys
import os
from collections import defaultdict
import csv

# Add the parent directory to the Python path to allow sibling imports
sys.path.append(str(Path(__file__).parent))

from generator.currency import build_currency_section

def generate_filter():
    project_root = Path(__file__).parent.parent
    data_dir = project_root / "filter_generation" / "data"
    ggpk_data_dir = project_root / "data" / "from_ggpk"
    output_path = project_root / "filter_generation" / "complete_filter.filter"
    
    print("--- Starting Filter Generation ---")

    # 1. Load Data
    with open(ggpk_data_dir / "baseitemtypes.json", "r", encoding="utf-8") as f:
        all_base_item_types = json.load(f)

    # Load Base Mappings
    base_mapping_dir = data_dir / "base_mapping"
    global_item_mapping = {}
    global_translations = {}
    for mapping_file in base_mapping_dir.glob("**/*.json"):
        with open(mapping_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            global_item_mapping.update(data.get("mapping", {}))
            global_translations.update(data.get("_meta", {}).get("localization", {}).get("ch", {}))

    # Load Tier Definitions
    tier_def_dir = data_dir / "tier_definition"
    tier_def_lookup = {}
    for root, _, files in os.walk(tier_def_dir):
        for file in files:
            if file.endswith(".json"):
                with open(Path(root) / file, "r", encoding="utf-8") as f:
                    content = json.load(f)
                    for category_name, category_data in content.items():
                        if category_name.startswith("//"): continue
                        for tier_key, tier_data in category_data.items():
                            if tier_key == "_meta" or tier_key.startswith("//"): continue
                            tier_def_lookup[tier_key] = (tier_data, category_data)

    # 2. Group items by Tier
    items_by_tier = defaultdict(list)
    for item in all_base_item_types:
        name = item.get("Name")
        if not name or name.startswith("[UNUSED]") or name.startswith("[DNT]") or name == "...":
            continue
        tier_key = global_item_mapping.get(name)
        if tier_key:
            items_by_tier[tier_key].append(name)

    # 3. Process Tier Groups and Rules
    tier_groups_data = []
    
    # Sort tier keys to ensure T0 comes before T1 in the file
    for tier_key in sorted(items_by_tier.keys()):
        items = items_by_tier[tier_key]
        tier_info_tuple = tier_def_lookup.get(tier_key)
        if not tier_info_tuple: continue
        
        tier_data, category_data = tier_info_tuple
        cat_meta = category_data.get("_meta", {})
        cat_loc = cat_meta.get("localization", {})
        tier_num = tier_data.get('theme', {}).get('Tier', "?")
        cat_name_ch = cat_loc.get("ch", cat_loc.get("en", "Unknown"))
        
        # A. Process Rules for this tier
        rules = cat_meta.get("rules", [])
        for rule in rules:
            # Logic: rule applies to items in its 'targets' OR all items in tier if targets empty
            rule_targets = rule.get("targets", [])
            
            # Identify which items from THIS tier match the rule
            matching_items = []
            if not rule_targets:
                # Rule with no targets applies to ALL items in the tier
                matching_items = items
            else:
                # Only items that belong to this tier AND are in the targets list
                matching_items = [i for i in items if i in rule_targets]
            
            if matching_items:
                rule_tier_key = rule.get("overrides", {}).get("Tier", tier_key)
                tier_groups_data.append({
                    "tier_key": rule_tier_key,
                    "items": matching_items,
                    "group_text": f"T{tier_num} {cat_name_ch}",
                    "text_ch": "Rules",
                    "conditions": rule.get("conditions", {}),
                    "style_override": rule.get("overrides", {}),
                    "comment": rule.get("comment", "")
                })

        # B. Add default group for this tier
        tier_groups_data.append({
            "tier_key": tier_key,
            "items": items,
            "group_text": f"T{tier_num} {cat_name_ch}",
            "text_ch": "Default",
            "conditions": {},
            "style_override": {},
            "comment": ""
        })

    # 4. Final Build
    print("Loading Theme...")
    theme_path = data_dir / "theme" / "sharket" / "sharket_theme.json"
    with open(theme_path, "r", encoding="utf-8") as f:
        theme = json.load(f)
    sound_map_path = data_dir / "theme" / "sharket" / "Sharket_sound_map.json"
    with open(sound_map_path, "r", encoding="utf-8") as f:
        sound_map = json.load(f)

    final_filter_content, style_map = build_currency_section(tier_groups_data, theme, sound_map)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_filter_content)
    with open(project_root / "filter_generation" / "complete_filter_styles.json", "w", encoding="utf-8") as f:
        json.dump(style_map, f, indent=2, ensure_ascii=False)
        
    print(f"Filter generated at: {output_path}")

if __name__ == "__main__":
    generate_filter()