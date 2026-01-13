import json
from pathlib import Path
import os

def generate_default_definitions():
    project_root = Path(__file__).parent.parent
    base_mapping_dir = project_root / "filter_generation" / "data" / "base_mapping"
    tier_def_dir = project_root / "filter_generation" / "data" / "tier_definition"
    
    # 1. Collect all Tier Keys used in Base Mappings
    used_tier_keys = set()
    used_tier_classes = set() # To help categorize

    print("Scanning base mappings...")
    for mapping_file in base_mapping_dir.glob("*.json"):
        with open(mapping_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            mapping = data.get("mapping", {})
            class_id_data = data.get("_meta", {}).get("item_class", "Unknown")
            if isinstance(class_id_data, dict):
                class_id = class_id_data.get("en", "Unknown")
            else:
                class_id = class_id_data
            
            for tier_key in mapping.values():
                used_tier_keys.add(tier_key)
                used_tier_classes.add(class_id)

    print(f"Found {len(used_tier_keys)} unique tier keys used in mappings.")

    # 2. Collect existing Tier Definitions
    existing_tier_keys = set()
    print("Scanning existing tier definitions...")
    for root, _, files in os.walk(tier_def_dir):
        for file in files:
            if file.endswith(".json"):
                with open(Path(root) / file, "r", encoding="utf-8") as f:
                    try:
                        content = json.load(f)
                        for category_data in content.values():
                            if isinstance(category_data, dict):
                                for key in category_data.keys():
                                    if not key.startswith("//") and key != "_meta":
                                        existing_tier_keys.add(key)
                    except json.JSONDecodeError:
                        pass

    print(f"Found {len(existing_tier_keys)} existing defined tier keys.")

    # 3. Identify Missing Keys
    missing_keys = used_tier_keys - existing_tier_keys
    print(f"Found {len(missing_keys)} missing tier keys.")

    if not missing_keys:
        print("No missing definitions!")
        return

    # 4. Generate Defaults
    # We will group them by their class name for better organization, 
    # assuming the key format is "Tier X {ClassName}"
    
    defaults_by_class = {}
    
    for key in missing_keys:
        # Simple parsing logic
        # e.g. "Tier 1 One Hand Sword" -> class "One Hand Sword"
        parts = key.split(" ", 2)
        if len(parts) >= 3 and parts[0] == "Tier":
             class_name = parts[2]
        else:
            class_name = "General"
            
        if class_name not in defaults_by_class:
            defaults_by_class[class_name] = {}
            
        defaults_by_class[class_name][key] = {
            "hideable": False,
            "theme": {
                "Tier": 1 # Default to Tier 1 style
            },
            "localization": {
                "en": key,
                "zh": key # Placeholder, maybe use class translation if available
            },
            "sound": {
                "default_sound_id": -1, # No sound by default
                "sharket_sound_id": None
            }
        }

    # 5. Write to File
    output_file = tier_def_dir / "generated_defaults.json"
    
    # Structure the output file
    output_data = {
        "//comment": "Auto-generated default tier definitions for missing keys",
    }
    
    # Flatten the grouping back into the category structure used by generate.py
    # We can just make one big category per class or one big "Defaults" category.
    # Let's do one category per class to be clean.
    
    for class_name, tiers in defaults_by_class.items():
        category_name = f"Default {class_name}"
        output_data[category_name] = {
            "_meta": {
                "theme_category": class_name,
                "localization": {"en": class_name, "zh": class_name}
            }
        }
        output_data[category_name].update(tiers)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)

    print(f"Generated default definitions in: {output_file}")

if __name__ == "__main__":
    generate_default_definitions()