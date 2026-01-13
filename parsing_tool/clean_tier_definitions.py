import json
from pathlib import Path
import os

def clean_tier_definitions():
    project_root = Path(__file__).parent.parent
    tier_def_dir = project_root / "filter_generation" / "data" / "tier_definition"
    
    files_updated = 0
    
    print("Cleaning tier definitions...")
    
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
                if category_key.startswith("//") or not isinstance(category_data, dict):
                    continue
                
                # Iterate tier entries
                for tier_key, tier_data in category_data.items():
                    if tier_key.startswith("//") or tier_key == "_meta":
                        continue
                    
                    if isinstance(tier_data, dict) and "localization" in tier_data:
                        del tier_data["localization"]
                        modified = True
                        
            if modified:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(content, f, indent=4, ensure_ascii=False)
                files_updated += 1

    print(f"Cleaned {files_updated} tier definition files.")

if __name__ == "__main__":
    clean_tier_definitions()