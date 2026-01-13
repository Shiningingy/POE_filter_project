import json
from pathlib import Path
from collections import defaultdict

def load_and_prepare_data():
    """
    Loads and prepares the core filter data from various JSON and CSV files.
    """
    # Define paths using the correct 'ch_simplified' directory
    project_root = Path(__file__).parent.parent
    ggpk_data_dir = project_root / "data" / "from_ggpk" / "ch_simplified"
    
    # --- Load Core Data ---
    
    # Load Item Classes
    item_classes_path = ggpk_data_dir / "itemclasses.json"
    with open(item_classes_path, "r", encoding="utf-8") as f:
        # Create a dictionary mapping the class _rid to its data
        item_classes = {cls['_rid']: cls for cls in json.load(f)}

    # Load Base Item Types
    base_item_types_path = ggpk_data_dir / "baseitemtypes.json"
    with open(base_item_types_path, "r", encoding="utf-8") as f:
        all_base_item_types = json.load(f)

    # --- Group Base Types by Item Class ---
    base_types_by_class = defaultdict(list)
    for item in all_base_item_types:
        class_key = item.get("ItemClassesKey")
        if class_key in item_classes:
            # Use the English 'Id' from itemclasses.json as the key for consistency
            class_id = item_classes[class_key]['Id']
            base_types_by_class[class_id].append(item)
            
    return item_classes, base_types_by_class

def main():
    """
    Main function to demonstrate loading and structuring of the data.
    """
    item_classes, base_types_by_class = load_and_prepare_data()
    
    print("--- Item Classes and their Base Types (Sample) ---")
    
    # Print a few examples to verify
    sample_classes = ["Currency", "One Hand Sword", "Bow", "Body Armour"]
    
    for class_id in sample_classes:
        if class_id in base_types_by_class:
            # Find the Chinese name from the original item_classes dict
            class_name_ch = ""
            for cls_data in item_classes.values():
                if cls_data['Id'] == class_id:
                    class_name_ch = cls_data['Name']
                    break
            
            print(f"\nItem Class: {class_id} ({class_name_ch})")
            
            # Print the first 5 base types for this class
            for item in base_types_by_class[class_id][:5]:
                print(f"  - {item['Name']}")
        else:
            print(f"\nItem Class '{class_id}' not found in base_types_by_class dictionary.")


if __name__ == "__main__":
    main()
