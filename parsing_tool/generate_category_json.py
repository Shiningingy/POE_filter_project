import json
from pathlib import Path
from collections import defaultdict

def generate_structure():
    project_root = Path(__file__).parent.parent
    data_dir = project_root / "filter_generation" / "data"
    mapping_dir = data_dir / "base_mapping"
    
    # We want a tree: TopLevel -> SubGroup -> File
    # Based on our folders: Currency/Fossils.json
    
    structure = {"categories": []}
    categories_map = {} # Name -> { _meta, subgroups: {} }

    # Walk the directory
    for json_file in mapping_dir.glob("**/*.json"):
        rel_path = json_file.relative_to(mapping_dir)
        parts = rel_path.parts # e.g. ('Currency', 'Fossils.json')
        
        if len(parts) < 2: continue
        
        cat_name = parts[0]
        file_name = parts[-1]
        
        if cat_name not in categories_map:
            categories_map[cat_name] = {
                "_meta": { "localization": { "en": cat_name, "ch": cat_name } },
                "subgroups": defaultdict(list)
            }
        
        # Subgroup is second level if exists, else "General"
        sub_name = parts[1] if len(parts) > 2 else "General"
        
        # Determine paths
        # rel_path is relative to base_mapping
        mapping_path = f"base_mapping/{rel_path.as_posix()}"
        tier_path = f"tier_definition/{rel_path.as_posix()}"
        
        # Read the file to get localized name
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            file_loc_en = file_name.replace(".json", "")
            file_loc_ch = data.get("_meta", {}).get("item_class", {}).get("ch", file_loc_en)
            target_cat = data.get("_meta", {}).get("theme_category", file_loc_en)

        categories_map[cat_name]["subgroups"][sub_name].append({
            "path": rel_path.as_posix(),
            "tier_path": tier_path,
            "mapping_path": mapping_path,
            "target_category": target_cat,
            "localization": { "en": file_loc_en, "ch": file_loc_ch }
        })

    # Convert map to sorted list
    for cat_name, cat_data in sorted(categories_map.items()):
        subgroups = []
        for sub_name, files in sorted(cat_data["subgroups"].items()):
            subgroups.append({
                "_meta": { "localization": { "en": sub_name, "ch": sub_name } },
                "files": sorted(files, key=lambda x: x["localization"]["en"])
            })
        
        category = {
            "_meta": cat_data["_meta"],
            "subgroups": subgroups
        }
        structure["categories"].append(category)

    with open(data_dir / "category_structure.json", "w", encoding="utf-8") as f:
        json.dump(structure, f, indent=2, ensure_ascii=False)

    print("Generated category_structure.json")

if __name__ == "__main__":
    generate_structure()
