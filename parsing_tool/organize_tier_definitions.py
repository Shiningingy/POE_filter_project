import json
from pathlib import Path
import os

# Define categorization rules
CATEGORY_MAPPING = {
    "Weapon": [
        "Claws", "Daggers", "Rune Daggers", "One Hand Axes", "One Hand Maces", 
        "One Hand Swords", "Thrusting One Hand Swords", "Sceptres", "Wands", 
        "Two Hand Axes", "Two Hand Maces", "Two Hand Swords", "Bows", "Staves", 
        "Warstaves", "Fishing Rods"
    ],
    "Armour": [
        "Helmets", "Body Armours", "Gloves", "Boots", "Shields", "Quivers"
    ],
    "Jewellery": [
        "Amulets", "Rings", "Belts", "Trinkets"
    ],
    "Gem": [
        "Skill Gems", "Support Gems"
    ],
    "Map": [
        "Maps", "Map Fragments", "Misc Map Items", "Labyrinth Map Items", 
        "Atlas Upgrade Items"
    ],
    "Currency": [
        "Stackable Currency", "Delve Stackable Socketable Currency", 
        "Delve Socketable Currency", "Incubators"
    ],
    "Flask": [
        "Life Flasks", "Mana Flasks", "Hybrid Flasks", "Utility Flasks", "Tinctures"
    ],
    "LeagueSpecific": [
        "Contracts", "Blueprints", "Heist Targets", 
        "Heist Gear", "Heist Tools", "Heist Cloaks", 
        "Heist Brooches", "Expedition Logbooks", "Incursion Items", 
        "Breachstones", "Abyss Jewels", "Labyrinth Items", "Labyrinth Trinkets",
        "Metamorph Samples", "Wombgifts", "Grafts", "Sanctified Relics",
        "Sentinels", "Memories", "Corpses", "Sanctum Research",
        "Archnemesis Mods", "Embers of the Allflame", "Leaguestones", "Pantheon Souls",
        "Vault Keys", "Pieces", "Relics", "Charms", "Gold", "Microtransactions", "Hidden Items", "GiftBox", "Instance Local Items", "Divination Cards", "Atlas Relics", "Idols"
    ]
}

# Catch-all for anything else
DEFAULT_CATEGORY = "General"

def organize_definitions():
    project_root = Path(__file__).parent.parent
    tier_def_dir = project_root / "filter_generation" / "data" / "tier_definition"
    defaults_file = tier_def_dir / "generated_defaults.json"
    
    if not defaults_file.exists():
        print(f"Error: {defaults_file} not found.")
        return

    with open(defaults_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Prepare data structures for new files
    new_files_content = {
        "Weapon": {},
        "Armour": {},
        "Jewellery": {},
        "Gem": {},
        "Map": {},
        "Currency": {},
        "Flask": {},
        "LeagueSpecific": {},
        "General": {}
    }

    # Iterate through the generated defaults
    for category_key, category_data in data.items():
        if category_key.startswith("//"):
            continue

        # Extract the base class name (e.g., "Default One Hand Sword" -> "One Hand Sword")
        # Assuming the format "Default {ClassName}"
        class_name = category_key.replace("Default ", "")
        
        # Determine target category
        target_category = DEFAULT_CATEGORY
        for cat, classes in CATEGORY_MAPPING.items():
            if class_name in classes:
                target_category = cat
                break
        
        # Add to the corresponding dictionary
        new_files_content[target_category][category_key] = category_data

    # Write new files
    for category, content in new_files_content.items():
        if not content:
            continue
            
        # Create directory if it doesn't exist (e.g., Weapon/)
        # For simplicity, we can just put files directly in tier_definition/Weapon.json
        # or create subfolders. The prompt asked for "Weapon folder", so let's try to match that
        # or just grouped files like "weapons.json".
        # Let's use folders for better organization: tier_definition/Weapon/defaults.json
        
        output_dir = tier_def_dir / category
        output_dir.mkdir(exist_ok=True)
        
        output_file = output_dir / "defaults.json"
        
        # Structure the output
        final_output = {
            "//comment": f"Default tier definitions for {category} items",
        }
        final_output.update(content)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(final_output, f, indent=4, ensure_ascii=False)
            
        print(f"Created {output_file} with {len(content)} categories.")

    # Remove the original generated_defaults.json
    # defaults_file.unlink()
    print(f"Organization complete. You can now delete {defaults_file} if you are satisfied.")

if __name__ == "__main__":
    organize_definitions()