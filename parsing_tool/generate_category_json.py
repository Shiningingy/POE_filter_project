import yaml
import json
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "filter_generation" / "data"
YAML_FILE = DATA_DIR / "category_structure.yaml"
JSON_FILE = DATA_DIR / "category_structure.json"

def parse_group(group_key, group_data, path_prefix="", parent_default_target=None):
    """
    Parses a dictionary representing a group (Category or Subgroup).
    Returns a dictionary matching the JSON structure for a Category/Subgroup.
    """
    
    # Metadata
    loc_en = group_key
    loc_ch = group_data.get("_name", group_key)
    
    default_target = group_data.get("_default_target", parent_default_target)
    
    group_obj = {
        "_meta": {
            "localization": {
                "en": loc_en,
                "ch": loc_ch
            }
        }
    }
    
    subgroups = []
    files = []
    
    # Iterate through children
    for key, value in group_data.items():
        if key.startswith("_"):
            continue
            
        current_path = f"{path_prefix}/{key}" if path_prefix else key
        
        # Check if it's a subgroup (dict with _name) or a file
        is_subgroup = isinstance(value, dict) and "_name" in value
        
        if is_subgroup:
            subgroups.append(parse_group(key, value, current_path, default_target))
        else:
            # It's a file
            # Value can be string (ch name) or dict ({name: ch, target: ...})
            file_name_ch = value
            target_cat = default_target
            
            if isinstance(value, dict):
                file_name_ch = value.get("name", key)
                if "target" in value:
                    target_cat = value["target"]
            
            if target_cat is None:
                target_cat = key # Default to file key if no default set
                
            file_obj = {
                "path": f"{current_path}.json",
                "tier_path": f"tier_definition/{current_path}.json",
                "mapping_path": f"base_mapping/{current_path}.json",
                "target_category": target_cat,
                "localization": {
                    "en": key,
                    "ch": file_name_ch
                }
            }
            files.append(file_obj)
            
    if subgroups:
        group_obj["subgroups"] = subgroups
    if files:
        group_obj["files"] = files
        
    return group_obj

def main():
    if not YAML_FILE.exists():
        print(f"Error: {YAML_FILE} not found.")
        return

    with open(YAML_FILE, "r", encoding="utf-8") as f:
        yaml_data = yaml.safe_load(f)
        
    categories = []
    for cat_key, cat_data in yaml_data.items():
        categories.append(parse_group(cat_key, cat_data, path_prefix=cat_key))
        
    output = {"categories": categories}
    
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully generated {JSON_FILE}")

if __name__ == "__main__":
    main()
