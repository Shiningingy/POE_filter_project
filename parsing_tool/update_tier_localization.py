import json
from pathlib import Path
import re
import os

def update_tier_localization():
    project_root = Path(__file__).parent.parent
    base_mapping_dir = project_root / "filter_generation" / "data" / "base_mapping"
    tier_def_dir = project_root / "filter_generation" / "data" / "tier_definition"

    # 1. Load Class Translations
    # Map English Class ID -> Chinese Class Name
    class_translation_map = {}
    
    print("Loading class translations from base mappings...")
    for mapping_file in base_mapping_dir.glob("*.json"):
        try:
            with open(mapping_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                meta = data.get("_meta", {})
                class_id_data = meta.get("item_class")
                if isinstance(class_id_data, dict):
                    class_id = class_id_data.get("en")
                else:
                    class_id = class_id_data
                
                # Navigate to the class name in the new structure
                loc_zh = meta.get("localization", {}).get("ch", {}) # Note: changed to 'ch' based on generate_base_mappings
                class_name_ch = loc_zh.get("__class_name__")

                if class_id and class_name_ch:
                    class_translation_map[class_id] = class_name_ch
        except Exception as e:
            print(f"Error reading {mapping_file}: {e}")

    print(f"Loaded {len(class_translation_map)} class translations.")
    
    # Manual overrides/additions if needed (e.g. for "Currency" if not found)
    # Based on previous output, Currency was generated, so it should be there.

    # 2. Update Tier Definitions
    print("Updating tier definitions...")
    
    files_updated = 0
    
    for root, _, files in os.walk(tier_def_dir):
        for file in files:
            if not file.endswith(".json"):
                continue
                
            file_path = Path(root) / file
            
            # Read file
            with open(file_path, "r", encoding="utf-8") as f:
                try:
                    content = json.load(f)
                except json.JSONDecodeError:
                    print(f"Skipping {file}: Invalid JSON")
                    continue
            
            modified = False
            
            # Iterate categories
            for category_key, category_data in content.items():
                if category_key.startswith("//"): 
                    continue
                
                # Check category meta localization
                if isinstance(category_data, dict) and "_meta" in category_data:
                    meta_loc = category_data["_meta"].get("localization", {})
                    
                    # Rename zh -> ch if needed
                    if "zh" in meta_loc:
                        meta_loc["ch"] = meta_loc.pop("zh")
                        modified = True
                    
                    # Update 'ch' value if we have a translation
                    if "ch" in meta_loc:
                        class_key = category_data["_meta"].get("theme_category")
                        if class_key in class_translation_map:
                            meta_loc["ch"] = class_translation_map[class_key]
                            modified = True

                # Iterate tier entries
                if isinstance(category_data, dict):
                    for tier_key, tier_data in category_data.items():
                        if tier_key.startswith("//") or tier_key == "_meta":
                            continue
                        
                        if "localization" in tier_data:
                            loc = tier_data["localization"]
                            
                            # 1. Rename zh -> ch
                            current_ch_val = None
                            if "zh" in loc:
                                current_ch_val = loc.pop("zh")
                                modified = True
                            
                            # 2. Update the value using class translation
                            # Attempt to parse the Tier Key: "Tier X ClassName"
                            # Regex to capture Tier Number and Class Name
                            match = re.search(r"Tier (\d+) (.+)", tier_key)
                            
                            new_val = current_ch_val # Default to old value if regex fails
                            
                            if match:
                                tier_num = match.group(1)
                                class_name_en = match.group(2)
                                
                                # Look up translation
                                if class_name_en in class_translation_map:
                                    class_name_ch = class_translation_map[class_name_en]
                                    new_val = f"T{tier_num} {class_name_ch}"
                                    modified = True
                                else:
                                    # Try partial match or fallback
                                    pass
                            
                            # If regex didn't match "Tier X", maybe it's "Default X" or just "X"
                            # But standard format for these files is "Tier X ..."
                            
                            # Ensure 'ch' key exists
                            if new_val:
                                loc["ch"] = new_val
                            elif "ch" not in loc and current_ch_val:
                                loc["ch"] = current_ch_val

            if modified:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(content, f, indent=4, ensure_ascii=False)
                files_updated += 1

    print(f"Updated {files_updated} tier definition files.")

if __name__ == "__main__":
    update_tier_localization()