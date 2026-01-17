import json
from pathlib import Path

def verify_categories():
    try:
        # Load category structure
        cat_file = Path("filter_generation/data/category_structure.json")
        with open(cat_file, "r", encoding="utf-8") as f:
            cat_data = json.load(f)
        
        existing_cats = set()
        def traverse(node):
            if "files" in node:
                for f in node["files"]:
                    if "target_category" in f:
                        existing_cats.add(f["target_category"])
            if "subgroups" in node:
                for sub in node["subgroups"]:
                    traverse(sub)
            if "categories" in node:
                for cat in node["categories"]:
                    traverse(cat)
        traverse(cat_data)

        # Load item classes from GGPK
        ggpk_file = Path("data/from_ggpk/itemclasses.json")
        with open(ggpk_file, "r", encoding="utf-8") as f:
            ggpk_classes = json.load(f)
        
        all_classes = {cls["Id"] for cls in ggpk_classes}
        
        missing = all_classes - existing_cats
        
        # Filter out clearly irrelevant classes if needed, or just list all
        relevant_missing = [c for c in missing if "Quest" in c or "Flask" in c or "Gem" in c or "Map" in c]
        
        print(f"Existing Categories: {len(existing_cats)}")
        print(f"Missing Relevant Classes: {sorted(relevant_missing)}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_categories()
