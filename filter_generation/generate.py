import json
from pathlib import Path
import sys
import os
from collections import defaultdict
import csv

# Add the parent directory to the Python path to allow sibling imports
sys.path.append(str(Path(__file__).parent))

from generator.currency import build_currency_section

# Helper function to parse CSV data into a list of dictionaries
def load_csv_data(file_path):
    data = []
    try:
        with open(file_path, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            for row in reader:
                data.append(row)
    except FileNotFoundError:
        print(f"Warning: CSV file not found at {file_path}")
    return data

def generate_filter():
    """
    Generates the complete POE filter file by combining various sections,
    using base mappings to link items to tier definitions.
    """
    # Define paths
    project_root = Path(__file__).parent.parent
    data_dir = project_root / "filter_generation" / "data"
    ggpk_data_dir = project_root / "data" / "from_ggpk"
    output_path = project_root / "filter_generation" / "complete_filter.filter"
    
    print("--- Starting Filter Generation ---")

    # --- 1. Load Core GGPK Data ---
    print("Loading GGPK data...")
    item_classes_path = ggpk_data_dir / "itemclasses.json"
    with open(item_classes_path, "r", encoding="utf-8") as f:
        item_classes_lookup = {cls['_rid']: cls for cls in json.load(f)}

    base_item_types_path = ggpk_data_dir / "baseitemtypes.json"
    with open(base_item_types_path, "r", encoding="utf-8") as f:
        all_base_item_types = json.load(f)

    # --- 2. Load Base Mappings (Item Name -> Tier Key) ---
    print("Loading Base Mappings...")
    base_mapping_dir = data_dir / "base_mapping"
    global_item_mapping = {}
    
    # We also want to keep track of translations if available in the mapping files
    global_translations = {}

    if not base_mapping_dir.exists():
        print(f"Error: Base mapping directory not found at {base_mapping_dir}")
        return

    for mapping_file in base_mapping_dir.glob("*.json"):
        try:
            with open(mapping_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
                # Load Mapping (Item Name -> Tier Key)
                mapping = data.get("mapping", {})
                global_item_mapping.update(mapping)
                
                # Load Translations (Item Name -> Chinese Name)
                # New structure: _meta -> localization -> ch -> {ItemName: ChName, __class_name__: ClassName}
                loc_ch = data.get("_meta", {}).get("localization", {}).get("ch", {})
                
                # We can update directly, __class_name__ won't collide with valid item names
                global_translations.update(loc_ch)
                
        except json.JSONDecodeError as e:
            print(f"Error decoding {mapping_file.name}: {e}")

    print(f"Loaded mappings for {len(global_item_mapping)} items.")

    # --- 3. Load Tier Definitions (Tier Key -> Styling/Rules) ---
    print("Loading Tier Definitions...")
    all_tier_definitions = {}
    tier_definition_dir = data_dir / "tier_definition"
    
    # We map "Tier Key" -> {tier_data, category_data}
    # This allows us to find the rule AND know the category context (for _meta)
    tier_def_lookup = {}

    for root, _, files in os.walk(tier_definition_dir):
        for file in files:
            if file.endswith(".json"):
                try:
                    with open(Path(root) / file, "r", encoding="utf-8") as f:
                        content = json.load(f)
                        for category_name, category_data in content.items():
                            if category_name.startswith("//"): 
                                continue
                            
                            # Flatten the structure: Tier Key -> Rule Data
                            if isinstance(category_data, dict):
                                for tier_key, tier_data in category_data.items():
                                    if tier_key == "_meta" or tier_key.startswith("//"):
                                        continue
                                    
                                    # Store tuple: (Rule Data, Category Data)
                                    tier_def_lookup[tier_key] = (tier_data, category_data)
                                    
                except json.JSONDecodeError as e:
                    print(f"Error decoding tier def {file}: {e}")

    print(f"Loaded {len(tier_def_lookup)} tier definitions.")

    # --- 4. Process Items and Assign Tiers ---
    print("Processing items...")
    item_data_for_generator = {}
    
    # Iterate through all known items from GGPK
    for item in all_base_item_types:
        item_name = item.get("Name")
        if not item_name:
            continue

        # Check if we have a mapping for this item
        tier_key = global_item_mapping.get(item_name)
        
        if tier_key:
            # Look up the Tier Definition
            tier_info_tuple = tier_def_lookup.get(tier_key)
            
            if tier_info_tuple:
                tier_data, category_data = tier_info_tuple
                
                # Construct the meta object expected by the generator
                theme_data = tier_data.get('theme', {})
                loc_data = tier_data.get('localization', {}) # Might be empty now
                
                # Dynamic Group Text Construction
                group_text = loc_data.get("ch") # Try direct look up first
                if not group_text:
                    # Fallback: T{Tier} {CategoryChName}
                    tier_num = theme_data.get('Tier', "?")
                    
                    cat_meta = category_data.get("_meta", {})
                    cat_loc = cat_meta.get("localization", {})
                    cat_name_ch = cat_loc.get("ch", cat_loc.get("en", "UnknownCategory"))
                    
                    group_text = f"T{tier_num} {cat_name_ch}"

                meta = {
                    "group": f"Tier {theme_data.get('Tier')}" if "Tier" in theme_data else loc_data.get('en', tier_key),
                    "group_text": group_text,
                    "text_ch": global_translations.get(item_name, item_name),
                    "hideable": tier_data.get("hideable", False),
                    "category": category_data.get("_meta", {}).get("theme_category", "Unknown"),
                    "tier_key": tier_key
                }
                item_data_for_generator[item_name] = meta
            else:
                # We have a mapping (e.g., "Tier 1 StackableCurrency") but no definition for it
                # print(f"Warning: Item '{item_name}' mapped to '{tier_key}' but no Tier Definition found.")
                pass
        else:
            # Item has no mapping in base_mapping/*.json
            # Use Default/Fallback
            pass
            
    print(f"Prepared {len(item_data_for_generator)} items for generator.")

    # --- 5. Load Theme and Sound ---
    print("Loading Theme and Sound...")
    theme_path = data_dir / "theme" / "sharket" / "sharket_theme.json"
    try:
        with open(theme_path, "r", encoding="utf-8") as f:
            theme = json.load(f)
        sound_map_path = data_dir / "theme" / "sharket" / "Sharket_sound_map.json"
        with open(sound_map_path, "r", encoding="utf-8") as f:
            sound_map = json.load(f)
    except FileNotFoundError:
        print("Error: Theme or Sound map file not found.")
        return

    # --- 6. Generate Sections ---
    print("Building Filter Sections...")
    # currently only building currency section as a test/start
    final_filter_content = build_currency_section(item_data_for_generator, theme, sound_map)
    print(f"Generated filter content size: {len(final_filter_content)} bytes")
    
    # --- 7. Write Output ---
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_filter_content)
        
    print(f"Filter successfully generated at: {output_path}")

if __name__ == "__main__":
    generate_filter()
