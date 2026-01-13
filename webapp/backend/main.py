from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import subprocess
import sys
from pathlib import Path

app = FastAPI()

# --- Path Definitions ---
PROJECT_ROOT = Path(__file__).parent.parent.parent
FILTER_GEN_DIR = PROJECT_ROOT / "filter_generation"
CONFIG_DATA_DIR = FILTER_GEN_DIR / "data"
# Determine the python executable to use
VENV_PYTHON = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe" if sys.platform == "win32" else PROJECT_ROOT / ".venv" / "bin" / "python"
PYTHON_EXECUTABLE = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

@app.on_event("startup")
async def startup_event():
    print("Detected Routes:")
    for route in app.routes:
        print(f"  {route.path} [{','.join(route.methods)}]")

@app.get("/")
def root():
    return {"message": "Hello"}

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Address of the Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from typing import List, Dict
from pydantic import BaseModel

class UpdateItemOverrideRequest(BaseModel):
    item_name: str
    overrides: dict
    source_file: str

@app.post("/api/update-item-override")
def update_item_override(request: UpdateItemOverrideRequest):
    """
    Updates or creates an override rule for a specific item.
    """
    file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", request.source_file)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Source mapping file not found.")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        rules = data.get("rules", [])
        
        # Look for existing override rule for this item
        # Rule matches if targets == [item_name] and has no other conditions
        found = False
        for rule in rules:
            if rule.get("targets") == [request.item_name] and not rule.get("conditions"):
                rule["overrides"].update(request.overrides)
                # If overrides are empty (e.g. sound cleared), we might want to remove the rule, 
                # but for now we just update.
                found = True
                break
        
        if not found:
            # Create new override rule
            rules.append({
                "targets": [request.item_name],
                "conditions": {},
                "overrides": request.overrides,
                "comment": f"Manual override for {request.item_name}"
            })
            
        data["rules"] = rules
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        return {"message": "Item override updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TierItemsRequest(BaseModel):
    tier_keys: List[str]

@app.post("/api/tier-items")
def get_items_by_tier(request: TierItemsRequest):
    """
    Scans all base mapping files to find items belonging to the requested tier keys.
    """
    tier_keys_set = set(request.tier_keys)
    result = {k: [] for k in tier_keys_set}
    
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    
    if not mappings_dir.is_dir():
        return {"items": result}

    try:
        # Scan all mapping files
        for file_path in mappings_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    mapping = data.get("mapping", {})
                    loc_data = data.get("_meta", {}).get("localization", {})
                    translations = loc_data.get("ch", {})
                    
                    # Ensure translations is a dict (some files might have a string for the class name)
                    if not isinstance(translations, dict):
                        translations = {}
                    
                    # Check each item in the mapping
                    for item_name, tier_key in mapping.items():
                        if tier_key in tier_keys_set:
                            result[tier_key].append({
                                "name": item_name,
                                "name_ch": translations.get(item_name, item_name),
                                "source": file_path.name
                            })
            except json.JSONDecodeError:
                continue # Skip bad files
                
        return {"items": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def safe_join(base, path):
    """
    Safely join a base directory with a relative path, ensuring the result is within the base.
    """
    full_path = (Path(base) / path).resolve()
    if Path(base).resolve() not in full_path.parents:
        raise HTTPException(status_code=400, detail="Invalid path")
    return full_path


from typing import List, Dict
from pydantic import BaseModel

class UpdateItemTierRequest(BaseModel):
    item_name: str
    new_tier: str
    source_file: str

@app.get("/api/class-items/{class_name}")
def get_all_items_in_class(class_name: str):
    """
    Returns every item in a class (from GGPK) merged with current tier assignments.
    """
    try:
        # 1. Load Item Classes from the correct root data directory
        ggpk_path = PROJECT_ROOT / "data" / "from_ggpk"
        with open(ggpk_path / "itemclasses.json", "r", encoding="utf-8") as f:
            item_classes = json.load(f)
        
        target_rid = None
        for cls in item_classes:
            if cls['Name'] == class_name or cls['Id'] == class_name:
                target_rid = cls['_rid']
                break
        
        if target_rid is None:
            return {"items": []}

        # 2. Load all Base Item Types
        with open(ggpk_path / "baseitemtypes.json", "r", encoding="utf-8") as f:
            all_items = json.load(f)
        
        class_items = [item for item in all_items if item.get("ItemClassesKey") == target_rid]
        
        # 3. Load Current Mappings
        mapping_path = CONFIG_DATA_DIR / "base_mapping" / f"{class_name}.json"
        current_mapping = {}
        translations = {}
        if mapping_path.exists():
            with open(mapping_path, "r", encoding="utf-8") as f:
                map_data = json.load(f)
                current_mapping = map_data.get("mapping", {})
                loc_ch = map_data.get("_meta", {}).get("localization", {}).get("ch", {})
                if isinstance(loc_ch, dict):
                    translations = loc_ch

        # 4. Merge
        result = []
        seen_names = set()
        for item in class_items:
            name = item.get("Name")
            if not name or name.startswith("[UNUSED]") or name.startswith("[DNT]") or name == "..." or name in seen_names:
                continue
            
            seen_names.add(name)
            result.append({
                "name": name,
                "name_ch": translations.get(name, name), 
                "current_tier": current_mapping.get(name),
                "source_file": f"{class_name}.json"
            })
            
        return {"items": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update-item-tier")
def update_item_tier(request: UpdateItemTierRequest):
    """
    Updates the tier of a specific item in its source mapping file.
    """
    file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", request.source_file)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Source mapping file not found.")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Verify item exists (optional, but good safety)
        if request.item_name not in data.get("mapping", {}):
             raise HTTPException(status_code=404, detail="Item not found in specified mapping file.")
             
        # Update
        data["mapping"][request.item_name] = request.new_tier
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        return {"message": "Item tier updated successfully."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/category-structure")
def get_category_structure():
    """Returns the logical hierarchy for the sidebar."""
    path = CONFIG_DATA_DIR / "category_structure.json"
    if not path.exists():
        return {"categories": []}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/unified-category")
def get_unified_category(tier_path: str, mapping_path: str):
    """
    Returns both tier definitions and base mappings for a unified view.
    """
    try:
        tier_full_path = safe_join(CONFIG_DATA_DIR, tier_path)
        mapping_full_path = safe_join(CONFIG_DATA_DIR, mapping_path)
        
        tier_content = {}
        if tier_full_path.exists():
            with open(tier_full_path, "r", encoding="utf-8") as f:
                tier_content = json.load(f)
                
        mapping_content = {}
        if mapping_full_path.exists():
            with open(mapping_full_path, "r", encoding="utf-8") as f:
                mapping_content = json.load(f)
                
        return {
            "tier_definition": tier_content,
            "base_mapping": mapping_content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/themes")
def get_themes_list():
    """Returns a list of available theme names."""
    themes_dir = CONFIG_DATA_DIR / "theme"
    if not themes_dir.is_dir():
        return {"themes": []}
    themes = [d.name for d in themes_dir.iterdir() if d.is_dir()]
    return {"themes": themes}

@app.get("/api/themes/{theme_name}")
def get_theme_data(theme_name: str):
    """Reads and returns the content of a specific theme's configuration files."""
    theme_dir = safe_join(CONFIG_DATA_DIR / "theme", theme_name)
    if not theme_dir.is_dir():
        raise HTTPException(status_code=404, detail="Theme not found.")

    # Note: This makes an assumption about the sound map name. This might need to be more robust later.
    theme_file_path = theme_dir / f"{theme_name}_theme.json"
    sound_map_file_path = list(theme_dir.glob("*_sound_map.json"))

    theme_content = {}
    sound_map_content = {}

    try:
        if theme_file_path.exists():
            with open(theme_file_path, "r", encoding="utf-8") as f:
                theme_content = json.load(f)
        if sound_map_file_path:
             with open(sound_map_file_path[0], "r", encoding="utf-8") as f:
                sound_map_content = json.load(f)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Error reading theme files: {str(e)}")

    return {"theme_name": theme_name, "theme_data": theme_content, "sound_map_data": sound_map_content}


@app.get("/api/base_mappings")
def get_base_mappings_list():
    """Returns a list of available base mapping file names."""
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    if not mappings_dir.is_dir():
        return {"base_mappings": []}
    mappings = [f.name for f in mappings_dir.iterdir() if f.is_file() and f.name.endswith(".json")]
    return {"base_mappings": mappings}

@app.get("/api/base_mappings/{file_name}")
def get_base_mapping_content(file_name: str):
    """Reads and returns the content of a specific base mapping file."""
    file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", file_name)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Base mapping file not found.")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = json.load(f)
        return {"file_name": file_name, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading base mapping file: {str(e)}")

@app.get("/api/tier_definitions/categories")
def get_tier_definition_categories():
    """Returns a list of top-level categories within tier_definition."""
    tier_def_dir = CONFIG_DATA_DIR / "tier_definition"
    if not tier_def_dir.is_dir():
        return {"categories": []}
    
    categories = [d.name for d in tier_def_dir.iterdir() if d.is_dir() or d.name.endswith('.json')]
    return {"categories": categories}


@app.get("/api/configs")
def list_all_configs():
    """Recursively lists all JSON config files in the data directory."""
    try:
        config_files = []
        for root, _, files in os.walk(CONFIG_DATA_DIR):
            for file in files:
                if file.endswith(".json"):
                    # Calculate relative path from CONFIG_DATA_DIR
                    rel_path = Path(root).relative_to(CONFIG_DATA_DIR) / file
                    config_files.append(str(rel_path).replace("\\", "/"))
        return {"configs": sorted(config_files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/{config_path:path}")
def get_config_content(config_path: str):
    """Reads and returns the content of a specific config file."""
    file_path = safe_join(CONFIG_DATA_DIR, config_path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Config file not found.")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = json.load(f)
        return {"file_name": config_path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading config file: {str(e)}")

@app.get("/api/mapping-info/{file_name}")
def get_mapping_info(file_name: str):
    """
    Returns mapping content AND available tiers found in tier definitions.
    """
    mapping_path = safe_join(CONFIG_DATA_DIR / "base_mapping", file_name)
    if not mapping_path.is_file():
        raise HTTPException(status_code=404, detail="Mapping file not found.")

    try:
        with open(mapping_path, "r", encoding="utf-8") as f:
            mapping_content = json.load(f)
        
        # 1. Identify Category
        meta = mapping_content.get("_meta", {})
        theme_category = meta.get("theme_category")
        
        available_tiers = []
        
        # 2. Find Definition
        if theme_category:
            # We assume the default definition key is usually "Default {theme_category}" 
            # or simply the category itself exists in some file.
            # We scan all tier definition files.
            tier_def_dir = CONFIG_DATA_DIR / "tier_definition"
            
            found_def = False
            for root, _, files in os.walk(tier_def_dir):
                if found_def: break
                for file in files:
                    if file.endswith(".json"):
                        try:
                            with open(Path(root) / file, "r", encoding="utf-8") as tf:
                                tier_defs = json.load(tf)
                                
                                # Look for keys like "Default {theme_category}"
                                # The key used in generate_default_tier_definitions.py was f"Default {class_name}"
                                target_key = f"Default {theme_category}"
                                
                                if target_key in tier_defs:
                                    category_data = tier_defs[target_key]
                                    cat_loc = category_data.get("_meta", {}).get("localization", {})
                                    cat_en = cat_loc.get("en", theme_category)
                                    cat_ch = cat_loc.get("ch", cat_en)

                                    for k, v in category_data.items():
                                        if k.startswith("Tier"):
                                            t_num = v.get("theme", {}).get("Tier", "?")
                                            available_tiers.append({
                                                "key": k,
                                                "label_en": f"Tier {t_num} {cat_en}",
                                                "label_ch": f"T{t_num} {cat_ch}"
                                            })
                                    found_def = True
                                    break
                        except:
                            continue
        
        # Sort tiers logic
        def tier_sort_key(t_obj):
            import re
            m = re.search(r"Tier (\d+)", t_obj["key"])
            return int(m.group(1)) if m else 999
            
        available_tiers.sort(key=tier_sort_key)

        return {
            "file_name": file_name,
            "content": mapping_content,
            "theme_category": theme_category,
            "available_tiers": available_tiers,
            # Include translations for items in this class
            "item_translations": mapping_content.get("_meta", {}).get("localization", {}).get("ch", {})
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing mapping info: {str(e)}")

# --- "Write" and "Generate" Endpoints ---

@app.post("/api/config/{config_path:path}")
async def save_config_file(config_path: str, content: dict = Body(...)):
    """
    Saves the provided content to the specified config file within filter_generation/data.
    """
    try:
        # Prevent path traversal outside of the intended config data directory
        file_path = safe_join(CONFIG_DATA_DIR, config_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
            
        return {"message": f"Config file '{config_path}' saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
def generate_filter_file():
    """
    Triggers the correct filter generation script.
    """
    try:
        # Execute `python filter_generation/generate.py` from the project root
        script_path = FILTER_GEN_DIR / "generate.py"
        process = subprocess.run(
            [PYTHON_EXECUTABLE, str(script_path)],
            capture_output=True,
            text=True,
            check=True,
            encoding='utf-8',
            cwd=PROJECT_ROOT 
        )
        return {"message": "Filter generated successfully!", "output": process.stdout}
    except subprocess.CalledProcessError as e:
        # Include stdout and stderr for better debugging on the client side
        raise HTTPException(status_code=500, detail=f"Filter generation failed.\nSTDOUT:\n{e.stdout}\n\nSTDERR:\n{e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/generated-filter")
def get_generated_filter():
    """
    Reads and returns the content of the complete_filter.filter file.
    """
    filter_file_path = FILTER_GEN_DIR / "complete_filter.filter"
    try:
        with open(filter_file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Generated filter file not found. Please generate it first.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search-items")
def search_items(q: str):
    """
    Searches for items across all base mapping files.
    Returns matches with their current tier and source file.
    """
    if not q or len(q) < 2:
        return {"results": []}
    
    q_lower = q.lower()
    results = []
    
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    
    try:
        # Optimization: In a real app, we'd index this once on startup.
        # For now, we scan on demand.
        for file_path in mappings_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    mapping = data.get("mapping", {})
                    loc_data = data.get("_meta", {}).get("localization", {})
                    translations = loc_data.get("ch", {})

                    if not isinstance(translations, dict):
                        translations = {}
                    
                    for item_name, tier_key in mapping.items():
                        if q_lower in item_name.lower():
                            results.append({
                                "name": item_name,
                                "name_ch": translations.get(item_name, item_name),
                                "current_tier": tier_key,
                                "source_file": file_path.name
                            })
                            if len(results) >= 20: # Limit results
                                return {"results": results}
            except:
                continue
                
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
