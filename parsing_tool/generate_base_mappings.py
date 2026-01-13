import json
from pathlib import Path
from collections import defaultdict

def generate_mappings():
    """
    Generates base_mapping JSON files using English names as keys
    and populating them with Chinese translations.
    Uses 'Id' for matching items between languages and linking to classes.
    """
    project_root = Path(__file__).parent.parent
    ggpk_data_dir_en = project_root / "data" / "from_ggpk"
    ggpk_data_dir_ch = project_root / "data" / "from_ggpk" / "ch_simplified"
    base_mapping_dir = project_root / "filter_generation" / "data" / "base_mapping"

    # --- 1. Load Data ---
    print("Loading English and Chinese data...")
    try:
        # Load Base Items keyed by Id (stable identifier) instead of _rid (index)
        with open(ggpk_data_dir_en / "baseitemtypes.json", "r", encoding="utf-8") as f:
            base_items_en = {item['Id']: item for item in json.load(f)}

        with open(ggpk_data_dir_ch / "baseitemtypes.json", "r", encoding="utf-8") as f:
            base_items_ch = {item['Id']: item for item in json.load(f)}

        # Load Item Classes
        # We need EN classes to map the integer ItemClassesKey from base_items_en to a String Class Id
        with open(ggpk_data_dir_en / "itemclasses.json", "r", encoding="utf-8") as f:
            item_classes_en = {cls['_rid']: cls for cls in json.load(f)}
        
        # We need CH classes to get the localized Class Name using the Class Id
        with open(ggpk_data_dir_ch / "itemclasses.json", "r", encoding="utf-8") as f:
            item_classes_ch = {cls['Id']: cls for cls in json.load(f)}
            
    except FileNotFoundError as e:
        print(f"Error: Required data file not found. {e}")
        return

    # --- 2. Group items and prepare combined data ---
    items_by_class = defaultdict(list)
    
    for item_id, item_en in base_items_en.items():
        item_ch = base_items_ch.get(item_id)
        if not item_ch:
            continue # Skip if no Chinese counterpart

        # Resolve Class ID
        class_key_rid = item_en.get("ItemClassesKey")
        class_obj_en = item_classes_en.get(class_key_rid)
        
        if class_obj_en:
            #class_id = class_obj_en['Id']
            class_id = class_obj_en['Name']
            name_en = item_en.get("Name")
            if name_en and (name_en.startswith("[UNUSED]") or name_en.startswith("[DNT]") or name_en.startswith("WIP") or name_en == "..."):
                continue

            combined_item_data = {
                "name_en": name_en,
                "name_ch": item_ch.get("Name"),
            }
            items_by_class[class_id].append(combined_item_data)

    # Create Name -> Id mapping for looking up Chinese data later
    class_name_to_id = {cls['Name']: cls['Id'] for cls in item_classes_en.values()}

    # --- 3. Identify Classes to Generate ---
    # We regenerate all classes that have items to ensure correctness
    print("Regenerating all mappings...")
    classes_to_generate = list(items_by_class.keys())
    print(f"Found {len(classes_to_generate)} item classes with items.")

    # --- 4. Generate Files ---
    generated_count = 0
    
    for class_name_en in classes_to_generate:
        items_in_class = items_by_class.get(class_name_en)
        if not items_in_class:
            continue

        # Resolve proper Class ID to find Chinese translation
        real_class_id = class_name_to_id.get(class_name_en)
        class_ch_obj = item_classes_ch.get(real_class_id)
        
        class_name_ch = class_ch_obj.get("Name") if class_ch_obj else class_name_en
        
        print(f"Generating for: {class_name_en} ({class_name_ch})...")

        translations = {}
        mapping = {}
        
        default_tier_name = f"Tier 1 {class_name_en}"

        for item in items_in_class:
            name_en = item.get("name_en")
            name_ch = item.get("name_ch")
            if name_en and name_ch:
                translations[name_en] = name_ch
                mapping[name_en] = default_tier_name

        # Prepare localization structure
        loc_ch = translations.copy()
        loc_ch["__class_name__"] = class_name_ch

        output_data = {
            "_meta": {
                "localization": {
                    "ch": loc_ch
                },
                "item_class": {"en":class_name_en,
                               "ch":class_name_ch},
                "theme_category": class_name_en
            },
            "mapping": mapping,
            "rules": []
        }

        output_path = base_mapping_dir / f"{class_name_en}.json"
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            generated_count += 1
        except IOError as e:
            print(f"Error writing file for {class_name_en}: {e}")

    print(f"\nGeneration complete. Successfully generated/updated {generated_count} mapping files.")
    if generated_count > 0:
        print(f"Files are located in: {base_mapping_dir}")

if __name__ == "__main__":
    generate_mappings()