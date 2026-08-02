# [parsing_tool group C: VERIFY BEFORE RUNNING] Compiles category_structure.yaml ->
# category_structure.json.
#
# The regression that made this DO-NOT-RUN was `target_category`: `_default_target`
# stamped one theme key over a whole group, but the theme key belongs to the tier
# definition, so recompiling silently repointed leaves at keys that did not exist.
# That field no longer exists anywhere - a nav leaf carries no theme key at all now
# (see filterStyle.resolveThemeKey) - so the specific regression is gone.
#
# It is still not proven to reproduce the checked-in JSON byte-for-byte in every
# other respect, so diff its output before replacing the committed file.
import yaml
import json
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "filter_generation" / "data"
YAML_FILE = DATA_DIR / "category_structure.yaml"
JSON_FILE = DATA_DIR / "category_structure.json"

def parse_group(group_key, group_data, path_prefix=""):
    """
    Parses a dictionary representing a group (Category or Subgroup).
    Returns a dictionary matching the JSON structure for a Category/Subgroup.
    """

    # Metadata
    loc_en = group_key
    loc_ch = group_data.get("_name", group_key)

    # Disk-path base for shorthand children. Defaults to the display key chain
    # (path_prefix), but `_dir:` overrides it so a category can be displayed at a
    # different level than where its files physically live (e.g. gear is shown as
    # top-level Armour/Weapons/Jewellery but stored under Equipment/...).
    dir_base = group_data.get("_dir", path_prefix)

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
            subgroups.append(parse_group(key, value, current_path))
        else:
            # It's a file
            # Value can be string (ch name) or dict ({name: ch, path: ...})
            file_name_ch = value
            # Path derives from the disk-path base, not the display key chain.
            file_path = f"{dir_base}/{key}.json" if dir_base else f"{key}.json"

            if isinstance(value, dict):
                file_name_ch = value.get("name", key)
                if "path" in value:
                    file_path = value["path"]

            # No theme key here on purpose: the tier definition at tier_path owns the
            # look. See filterStyle.resolveThemeKey.
            file_obj = {
                "path": file_path,
                "tier_path": f"tier_definition/{file_path}",
                "mapping_path": f"base_mapping/{file_path}",
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
        # Chapter separator marker: a non-clickable heading row in the sidebar.
        if isinstance(cat_data, dict) and "_separator" in cat_data:
            categories.append({"separator": cat_data["_separator"]})
            continue
        categories.append(parse_group(cat_key, cat_data, path_prefix=cat_key))

        
    output = {"categories": categories}
    
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully generated {JSON_FILE}")

if __name__ == "__main__":
    main()
