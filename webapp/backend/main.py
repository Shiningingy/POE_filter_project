from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import json
import shutil
import subprocess
import sys
import tempfile
import time
import re
import csv
import threading
import collections
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional
from pydantic import BaseModel

app = FastAPI()

# --- Safe curation writes -------------------------------------------------- #
# These endpoints are sync `def`, so FastAPI runs them in a threadpool: several
# requests genuinely execute at once. Every one of them does a read-modify-write
# of a whole JSON file, which without protection produced three distinct
# failures on the same file - a shorter document written over a longer one
# leaving an orphaned tail ("Extra data"), a reader catching a half-written file
# ("Invalid control character"), and silent lost updates where the last writer
# wins and the earlier edits vanish with no error at all.

_FILE_LOCKS: Dict[str, threading.Lock] = collections.defaultdict(threading.Lock)
_FILE_LOCKS_GUARD = threading.Lock()


def file_lock(path: Path) -> threading.Lock:
    """One lock per file, so a read-modify-write cycle is never interleaved."""
    key = str(Path(path).resolve()).lower()
    with _FILE_LOCKS_GUARD:
        return _FILE_LOCKS[key]


def write_json_atomic(path: Path, data: dict, indent: int = 2) -> None:
    """Write via a temp file in the same directory, then os.replace().

    os.replace is atomic on Windows and POSIX, so a reader sees either the old
    file or the new one - never a partial write - and a crash mid-write cannot
    leave a truncated file behind.
    """
    path = Path(path)
    tmp = path.with_suffix(path.suffix + f".tmp{os.getpid()}.{threading.get_ident()}")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=indent, ensure_ascii=False)
            f.write("\n")          # keep git from reporting "\ No newline at end of file"
            f.flush()
            os.fsync(f.fileno())
        # On Windows os.replace fails with ACCESS_DENIED whenever anything else
        # holds even a transient handle on the destination - Defender, the
        # search indexer, a sync client. Measured: roughly 1 write in 40 during
        # a bulk edit. Without the retry that exception propagates and the edit
        # is simply lost, which is the failure we are here to remove.
        for attempt in range(12):
            try:
                os.replace(tmp, path)
                break
            except PermissionError:
                if attempt == 11:
                    raise
                time.sleep(0.02 * (attempt + 1))
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass

# --- Models ---
class UpdateItemOverrideRequest(BaseModel):
    item_name: str
    overrides: dict
    source_file: str
    # Keys to DELETE from the item's bare override rule. Sound could only ever be
    # added; clearing it needs an explicit removal so the item falls back to its
    # tier's sound. When the rule has nothing left it is dropped entirely rather
    # than left behind as an empty block.
    remove_keys: Optional[List[str]] = None
    # WHICH occurrence of the item the caller means. A base type can appear in
    # several tiers (Simulacrum Splinter is in three), and each occurrence is its
    # own block, so each can carry its own sound. Without these the write landed
    # on ONE bare rule targeting the item, which applied everywhere at once - the
    # "global override" that made per-block sounds impossible.
    #   rule_index -> the card IS a target of that rule; the sound belongs to the
    #                 rule, because a separate rule placed ahead of it would emit
    #                 without the rule's own conditions.
    #   tier_key   -> a plain tier card; gets a rule scoped to that tier only.
    rule_index: Optional[int] = None
    tier_key: Optional[str] = None
    # The card's sound is injected from the sound map (basetype_sounds), so there is
    # no rule to strip a key from - clearing it means pinning an empty rule so the
    # generator stops injecting. Set by the card when it knows the source is auto.
    suppress_auto: Optional[bool] = None

class UpdateItemTierRequest(BaseModel):
    item_name: str
    new_tier: Optional[str] = None
    source_file: str
    is_append: bool = False
    old_tier: Optional[str] = None
    new_tiers: Optional[List[str]] = None
    match_mode: Optional[str] = None # 'exact' or 'partial'

class TierItemsRequest(BaseModel):
    tier_keys: List[str]
    class_filter: Optional[str] = None

# --- Path Definitions ---
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
FILTER_GEN_DIR = (PROJECT_ROOT / "filter_generation").resolve()
CONFIG_DATA_DIR = (FILTER_GEN_DIR / "data").resolve()
SOUND_FILES_DIR = (PROJECT_ROOT / "sound_files").resolve()
DATA_DIR = PROJECT_ROOT / "data"

VENV_PYTHON = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe" if sys.platform == "win32" else PROJECT_ROOT / ".venv" / "bin" / "python"
PYTHON_EXECUTABLE = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
# The generator is Node now (ADR-0007). PATH lookup, overridable for a pinned install.
NODE_EXECUTABLE = os.environ.get("NODE") or "node"

# --- Globals ---
ITEM_CLASSES = []
CLASS_TO_ITEMS = {} # Class -> Set(BaseTypes)
ITEM_TO_CLASS = {}  # BaseType -> Class
ITEM_TRANSLATIONS = {} # English Name -> Chinese Name
CATEGORY_MAP = {} # mapping_path -> ch_name
CLASS_TO_FILE = {} # item_class -> mapping_path (relative to base_mapping)

ITEM_SUBTYPES = {} # BaseType -> STR/DEX/INT
ITEM_DETAILS = {} # BaseType -> {drop_level, implicit, ...}

CLASS_HIERARCHY_TREE = []     # full resolved hierarchy tree
CLASS_RESOLVED_PROPS = {}     # poe_class -> {properties, flags, constraints}
NODE_TO_CLASSES = {}          # hierarchy node id / poe_class -> set(poe_class)
ITEM_BONUS_INFO = {}          # item_name -> {description, tags}  (flat sections: currency/scarab/...)
UNIQUE_BASE_INFO = {}         # base_type -> [{unique, text, priority, ruleLink, hideInHoverBox}]

FILTER_CONDITIONS = []        # resolved condition schema (flat, with `classes`)
RULE_TEMPLATE_CATEGORIES = [] # grouped condition templates for /api/rule-templates

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    print(f"DEBUG: {request.method} {request.url.path} -> {response.status_code} ({duration:.4f}s)")
    return response

# --- Helper ---
def safe_join(base: Path, path: str):
    full_path = (base / path).resolve()
    try:
        full_path.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path traversal")
    return full_path

def load_base_types():
    global ITEM_CLASSES, CLASS_TO_ITEMS, ITEM_TO_CLASS, ITEM_SUBTYPES
    # The current drop lives at the top of from_filter_blade/; the dated
    # subfolders are previous leagues. Pointing at 3.28 made the editor blind to
    # every 3.29 item - search and tooltips could not resolve Scrying Orb, the
    # new talismans, or the Enshrouded bases. Stopgap until the GGPK catalog
    # (ADR-0004) replaces this loader outright.
    csv_path = DATA_DIR / "from_filter_blade" / "BaseTypes.csv"
    if not csv_path.exists():
        print("Warning: BaseTypes.csv not found.")
        return

    print("Loading BaseTypes.csv...")
    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cls = row.get("Class", "").strip()
                name = row.get("BaseType", "").strip()
                if cls and name:
                    if cls not in CLASS_TO_ITEMS:
                        CLASS_TO_ITEMS[cls] = set()
                    CLASS_TO_ITEMS[cls].add(name)
                    ITEM_TO_CLASS[name] = cls
                    
                    # Parse attributes and assign game-facing sub-types only for relevant classes
                    subtype = "Other"
                    if cls in ["Body Armours", "Gloves", "Boots", "Helmets", "Shields"]:
                        s = int(row.get("Game:Strength") or 0)
                        d = int(row.get("Game:Dexterity") or 0)
                        i = int(row.get("Game:Intelligence") or 0)
                        
                        if s > 0 and d == 0 and i == 0: subtype = "Armour"
                        elif d > 0 and s == 0 and i == 0: subtype = "Evasion Rating"
                        elif i > 0 and s == 0 and d == 0: subtype = "Energy Shield"
                        elif s > 0 and d > 0 and i == 0: subtype = "Evasion / Armour"
                        elif s > 0 and i > 0 and d == 0: subtype = "Armour / ES"
                        elif d > 0 and i > 0 and s == 0: subtype = "ES / Evasion"
                        elif s > 0 and d > 0 and i > 0: subtype = "Armour / Evasion / ES"
                    
                    ITEM_SUBTYPES[name] = subtype
                    
                    # Parse detailed stats
                    details = {
                        "drop_level": int(row.get("DropLevel") or 0),
                        "width": int(row.get("Width") or 1),
                        "height": int(row.get("Height") or 1),
                        "implicit": [],
                        "armour": int(row.get("Game:Armour") or 0),
                        "armour_max": int(row.get("Game:Armour Max") or 0),
                        "evasion": int(row.get("Game:Evasion") or 0),
                        "evasion_max": int(row.get("Game:Evasion Max") or 0),
                        "energy_shield": int(row.get("Game:Energy Shield") or 0),
                        "energy_shield_max": int(row.get("Game:Energy Shield Max") or 0),
                        "damage_min": int(row.get("Game:Damage From") or 0),
                        "damage_max": int(row.get("Game:Damage To") or 0),
                        "aps": float(row.get("Game:APS") or 0),
                        "crit": float(row.get("Game:Crit") or 0),
                        "dps": float(row.get("Game:DPS") or 0),
                        "req_str": int(row.get("Game:Strength") or 0),
                        "req_dex": int(row.get("Game:Dexterity") or 0),
                        "req_int": int(row.get("Game:Intelligence") or 0),
                        "item_class": cls,
                    }
                    imp1 = row.get("Game:Implicit 1")
                    imp2 = row.get("Game:Implicit 2")
                    if imp1: details["implicit"].append(imp1)
                    if imp2: details["implicit"].append(imp2)
                    
                    ITEM_DETAILS[name] = details
        
        ITEM_CLASSES = sorted(list(CLASS_TO_ITEMS.keys()))
        print(f"Loaded {len(ITEM_CLASSES)} item classes.")
    except Exception as e:
        print(f"Error loading BaseTypes.csv: {e}")

def load_translations():
    global ITEM_TRANSLATIONS
    print("Loading translations...")
    en_map = {}
    try:
        en_path = DATA_DIR / "from_ggpk" / "baseitemtypes.json"
        if en_path.exists():
            with open(en_path, "r", encoding="utf-8") as f:
                en_data = json.load(f)
                for item in en_data:
                    if "Id" in item and "Name" in item:
                        en_map[item["Id"]] = item["Name"]
    except Exception as e: 
        print(f"Error loading EN base types: {e}")
        return

    try:
        ch_path = DATA_DIR / "from_ggpk" / "ch_simplified" / "baseitemtypes.json"
        if ch_path.exists():
            with open(ch_path, "r", encoding="utf-8") as f:
                ch_data = json.load(f)
                for item in ch_data:
                    if "Id" in item and "Name" in item:
                        en_name = en_map.get(item["Id"])
                        if en_name:
                            ITEM_TRANSLATIONS[en_name] = item["Name"]
        print(f"Loaded {len(ITEM_TRANSLATIONS)} translations.")
    except Exception as e:
        print(f"Error loading CH base types: {e}")

def item_trans_of(meta_loc: dict) -> dict:
    """Per-item zh dict from a mapping file's _meta.localization, tolerating both
    shapes: core files use {'ch': {item: zh}}, nav-rebuild/campaign files use
    {'ch': '<category zh string>', 'ch_items': {...}}. A string 'ch' used to
    raise inside the bare except of tier-items/search, silently skipping the
    whole file (campaign categories showed 0 items in local dev)."""
    t = meta_loc.get("ch_items") or meta_loc.get("ch") or {}
    return t if isinstance(t, dict) else {}


def set_item_trans(meta_loc: dict, item_name: str, trans: str) -> None:
    """Write a per-item zh translation, mirroring item_trans_of's read shapes:
    core files keep the per-item dict under 'ch'; nav-rebuild/campaign files keep
    a category-name STRING in 'ch' and the per-item dict under 'ch_items'. Assigning
    into a string 'ch' raised 'str object does not support item assignment' → a 500
    ('Failed to update some items') when tiering an item in a campaign/chancing file."""
    ch = meta_loc.get("ch")
    if isinstance(ch, dict):
        ch[item_name] = trans
        return
    items = meta_loc.get("ch_items")
    if not isinstance(items, dict):
        items = {}
        meta_loc["ch_items"] = items
    items[item_name] = trans


def load_category_map():
    global CATEGORY_MAP
    print("Loading category map...")
    try:
        with open(CONFIG_DATA_DIR / "category_structure.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            def traverse(node):
                if "files" in node:
                    for file in node["files"]:
                        if "mapping_path" in file and "localization" in file:
                            CATEGORY_MAP[file["mapping_path"]] = file["localization"].get("ch", "")
                if "subgroups" in node:
                    for sub in node["subgroups"]:
                        traverse(sub)
                if "categories" in node:
                    for cat in node["categories"]:
                        traverse(cat)
            traverse(data)
        print(f"Loaded {len(CATEGORY_MAP)} category mappings.")
    except Exception as e:
        print(f"Error loading category map: {e}")

def load_class_hierarchy():
    global CLASS_HIERARCHY_TREE, CLASS_RESOLVED_PROPS
    yaml_path = FILTER_GEN_DIR / "data" / "class_hierarchy.yaml"
    if not yaml_path.exists():
        print("Warning: class_hierarchy.yaml not found, skipping.")
        return
    try:
        import yaml
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # Also load existing class_properties.yaml for leaf overrides
        class_props_path = FILTER_GEN_DIR / "data" / "class_properties.yaml"
        yaml_overrides = {}
        if class_props_path.exists():
            with open(class_props_path, "r", encoding="utf-8") as f:
                cp = yaml.safe_load(f) or {}
                yaml_overrides = cp.get("classes", {})

        def resolve_node(node, inherited_props, inherited_flags, inherited_constraints):
            own_props = node.get("properties", [])
            own_flags = node.get("flags", [])
            resolved_props = list(dict.fromkeys(inherited_props + own_props))
            resolved_flags = list(dict.fromkeys(inherited_flags + own_flags))
            resolved_constraints = {**inherited_constraints, **node.get("constraints", {})}
            result = dict(node)
            result["resolved_properties"] = resolved_props
            result["resolved_flags"] = resolved_flags
            result["constraints"] = resolved_constraints
            if "poe_class" in node:
                poe_class = node["poe_class"]
                override = yaml_overrides.get(poe_class, {})
                CLASS_RESOLVED_PROPS[poe_class] = {
                    "properties": override.get("properties", resolved_props),
                    "flags": override.get("flags", resolved_flags),
                    "constraints": override.get("constraints", resolved_constraints),
                }
            if "children" in node:
                result["children"] = [
                    resolve_node(child, resolved_props, resolved_flags, resolved_constraints)
                    for child in node["children"]
                ]
            return result

        CLASS_HIERARCHY_TREE = [
            resolve_node(top, [], [], {}) for top in data.get("hierarchy", [])
        ]

        # Build NODE_TO_CLASSES: each node id -> set of descendant poe_classes;
        # each poe_class -> {itself}. Used to resolve condition `applies` tokens.
        global NODE_TO_CLASSES
        NODE_TO_CLASSES = {}
        def collect(node):
            classes = set()
            if "poe_class" in node:
                classes.add(node["poe_class"])
            for child in node.get("children", []):
                classes |= collect(child)
            if node.get("id"):
                NODE_TO_CLASSES[node["id"]] = NODE_TO_CLASSES.get(node["id"], set()) | classes
            if node.get("poe_class"):
                NODE_TO_CLASSES[node["poe_class"]] = {node["poe_class"]}
            return classes
        for top in data.get("hierarchy", []):
            collect(top)

        print(f"Loaded class hierarchy: {len(CLASS_RESOLVED_PROPS)} leaf classes, {len(NODE_TO_CLASSES)} nodes.")
    except Exception as e:
        print(f"Error loading class hierarchy: {e}")

def load_filter_conditions():
    """Load the unified condition schema; resolve class applicability; build the
    rule-template categories and derive per-class simulator props. Single source
    for the rule editor + the Drop Simulator form."""
    global FILTER_CONDITIONS, RULE_TEMPLATE_CATEGORIES, CLASS_RESOLVED_PROPS
    path = FILTER_GEN_DIR / "data" / "filter_conditions.yaml"
    if not path.exists():
        print("Warning: filter_conditions.yaml not found, skipping.")
        return
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        cat_labels = data.get("categories", {})
        conds = data.get("conditions", [])
        all_classes = set(CLASS_RESOLVED_PROPS.keys())

        def resolve_applies(tokens):
            if "universal" in tokens:
                return set(all_classes)
            result = set()
            for tok in tokens:
                result |= NODE_TO_CLASSES.get(tok, {tok})  # node id or exact class
            return result

        resolved = []
        for c in conds:
            applies = c.get("applies", [])
            resolved.append({
                "key": c["key"], "condition": c["key"],
                "label": c.get("label", {"en": c["key"], "ch": c["key"]}),
                "type": c.get("type", "text"),
                "options": c.get("options"), "default": c.get("default"),
                "placeholder": c.get("placeholder"),
                "category": c.get("category", "general"),
                "simulatable": bool(c.get("simulatable", False)),
                "universal": "universal" in applies,
                "classes": sorted(resolve_applies(applies)),
            })
        FILTER_CONDITIONS = resolved

        # Grouped templates for /api/rule-templates (declared category order)
        cats = []
        for cat_id in (list(cat_labels.keys()) or list(dict.fromkeys(e["category"] for e in resolved))):
            tmpls = []
            for e in resolved:
                if e["category"] != cat_id:
                    continue
                t = {"id": e["key"].lower(), "label": e["label"], "condition": e["condition"],
                     "type": e["type"], "classes": e["classes"], "universal": e["universal"],
                     "simulatable": e["simulatable"]}
                for k in ("options", "default", "placeholder"):
                    if e[k] is not None:
                        t[k] = e[k]
                tmpls.append(t)
            if tmpls:
                cats.append({"id": cat_id, "name": cat_labels.get(cat_id, {"en": cat_id, "ch": cat_id}), "templates": tmpls})
        RULE_TEMPLATE_CATEGORIES = cats

        # Derive per-class simulator props (camelCase sim fields) from simulatable conditions.
        SIM_FIELD = {
            "ItemLevel": "itemLevel", "DropLevel": "dropLevel", "Rarity": "rarity",
            "Quality": "quality", "Width": "width", "Height": "height",
            "Sockets": "sockets", "LinkedSockets": "linkedSockets", "SocketGroup": "socketGroup",
            "StackSize": "stackSize", "GemLevel": "gemLevel", "MapTier": "mapTier",
            "MemoryStrands": "memoryStrands",
            "Identified": "identified", "Corrupted": "corrupted", "Mirrored": "mirrored",
            "FracturedItem": "fractured", "SynthesisedItem": "synthesised",
            "ShaperItem": "shaper", "ElderItem": "elder", "Scourged": "scourged",
            "Replica": "replica", "Imbued": "imbued", "TransfiguredGem": "transfigured",
            "BlightedMap": "blightedMap",
            "ShapedMap": "shapedMap", "ElderMap": "elderMap",
            # `BlightRavagedMap` and `ZanasMemory` sat here for months and could never
            # fire: no condition carries those names. filter_conditions.yaml:119 records
            # the correction (the game knows UberBlightedMap / ZanaMemory), and both fall
            # through to the camelCase default below, which already yields the right
            # field — so this is a rename of dead weight, not a behaviour change. The
            # same two spellings were live in simulatorEngine.ts's BOOL_FIELD, where
            # they DID cost something.
        }
        INFLUENCE_FLAGS = ["shaper", "elder", "crusader", "hunter", "redeemer", "warlord"]
        SKIP = {"AreaLevel", "Class"}  # global / implicit — not per-item form fields
        for cls in all_classes:
            props, flags = ["itemLevel", "dropLevel"], []
            for e in resolved:
                if not e["simulatable"] or cls not in e["classes"] or e["key"] in SKIP:
                    continue
                if e["key"] == "HasInfluence":
                    flags.extend(INFLUENCE_FLAGS); continue
                field = SIM_FIELD.get(e["key"], e["key"][0].lower() + e["key"][1:])
                (flags if e["type"] == "bool" else props).append(field)
            CLASS_RESOLVED_PROPS[cls] = {
                "properties": list(dict.fromkeys(props)),
                "flags": list(dict.fromkeys(flags)),
                "constraints": CLASS_RESOLVED_PROPS.get(cls, {}).get("constraints", {}),
            }

        print(f"Loaded filter conditions: {len(resolved)} conditions, {len(cats)} categories.")
    except Exception as e:
        print(f"Error loading filter_conditions.yaml: {e}")


def _norm_unique_name(name: str) -> str:
    """Join key for unique names: the GGPK Words rows differ from trade-data
    names by curly apostrophes (Tasalio’s), casing (Jack, The Axe) and stray
    whitespace (Demigod's Immortality<space>)."""
    return " ".join(name.replace("’", "'").split()).lower()


def load_unique_name_translations():
    """EN->CH unique item names, normalized-keyed (see _norm_unique_name).

    Sources: GGPK `words` dump (ch_simplified alone suffices: "Text"=EN,
    "Text2"=zh, Wordlist 6 = unique names) + the hand-maintained supplement
    data/unique_name_zh_extra.json for names absent from the dump (fill the
    empty values there as translations are found). Fails soft if absent.
    """
    trans = {}
    ch_path = DATA_DIR / "from_ggpk" / "ch_simplified" / "words.json"
    if ch_path.exists():
        try:
            with open(ch_path, "r", encoding="utf-8") as f:
                ch_data = json.load(f)
            for row in ch_data:
                if row.get("Wordlist") != 6:
                    continue
                en_name = row.get("Text")
                ch_name = row.get("Text2")
                if en_name and ch_name and ch_name.strip() != en_name.strip():
                    trans[_norm_unique_name(en_name)] = ch_name.strip()
            print(f"Loaded {len(trans)} unique-name translations from words.json.")
        except Exception as e:
            print(f"Error loading words.json translations: {e}")

    extra_path = DATA_DIR / "unique_name_zh_extra.json"
    if extra_path.exists():
        try:
            with open(extra_path, "r", encoding="utf-8") as f:
                extra = json.load(f)
            n = 0
            for en_name, ch_name in extra.items():
                if en_name.startswith("_") or not ch_name:
                    continue  # meta keys / not-yet-filled entries
                trans[_norm_unique_name(en_name)] = ch_name
                n += 1
            if n:
                print(f"Merged {n} supplemental unique-name translations.")
        except Exception as e:
            print(f"Error loading unique_name_zh_extra.json: {e}")
    return trans


def load_bonus_item_info():
    """Load FilterBlade's bonusItemInfo hover data.

    Two shapes share one file under "bonusItemInfo":
      * Flat sections (Currency, Fossil, Oil, Scarab, Fragment, ...): `items` is
        keyed by the item's OWN name -> {text, tags}. Hovering that item shows it.
      * The "Uniques" section is NESTED: `items` is keyed by BASE TYPE -> {text,
        items:{unique_name -> {text, priority, ruleLink, hideInHoverBox}}}. This
        is the "which valuable uniques could this base be" data. We index it by
        base type so the tooltip can list candidate uniques.
    """
    global ITEM_BONUS_INFO, UNIQUE_BASE_INFO
    ITEM_BONUS_INFO = {}
    UNIQUE_BASE_INFO = {}
    unique_trans = load_unique_name_translations()
    path = DATA_DIR / "from_filter_blade" / "3.28" / "bonusItemInfo.json"
    if not path.exists():
        print("Warning: bonusItemInfo.json not found.")
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        bonus = data.get("bonusItemInfo", {})
        for section_name, section_data in bonus.items():
            if not isinstance(section_data, dict):
                continue
            items = section_data.get("items", {})
            if not isinstance(items, dict):
                continue

            if section_name == "Uniques":
                # Nested: base -> {text, items:{unique -> {...}}}
                for base_type, base_info in items.items():
                    if not isinstance(base_info, dict):
                        continue
                    candidates = []
                    base_text = base_info.get("text")
                    inner = base_info.get("items", {})
                    if isinstance(inner, dict):
                        for uname, uinfo in inner.items():
                            if not isinstance(uinfo, dict):
                                continue
                            cand = {
                                "unique": uname,
                                "text": uinfo.get("text", ""),
                                "priority": uinfo.get("priority", 0),
                                "ruleLink": uinfo.get("ruleLink"),
                                "hideInHoverBox": uinfo.get("hideInHoverBox", False),
                            }
                            uname_key = _norm_unique_name(uname)
                            if uname_key in unique_trans:
                                cand["name_ch"] = unique_trans[uname_key]
                            candidates.append(cand)
                    # Lower priority number = more notable -> sort ascending.
                    candidates.sort(key=lambda c: c.get("priority", 0))
                    if candidates or base_text:
                        UNIQUE_BASE_INFO[base_type] = {
                            "text": base_text,
                            "uniques": candidates,
                        }
            else:
                # Flat: item's own name -> {text, tags}
                for item_name, item_info in items.items():
                    if isinstance(item_info, dict):
                        ITEM_BONUS_INFO[item_name] = {
                            "description": item_info.get("text", ""),
                            "tags": item_info.get("tags", []),
                        }
        print(f"Loaded bonus item info: {len(ITEM_BONUS_INFO)} flat entries, "
              f"{len(UNIQUE_BASE_INFO)} unique bases.")
    except Exception as e:
        print(f"Error loading bonusItemInfo.json: {e}")

    # Official GGPK usage descriptions (EN + zh-simplified), extracted from the
    # raw tables by parsing_tool/extract_zh_currency_descriptions.py. zh gives
    # the tooltip a localized description; the official EN text lets the
    # frontend dedup FilterBlade lines (FilterBlade text = drop-source hint
    # lines + the official description). Items without a FilterBlade entry get
    # a plain official-description entry so their hovers aren't empty.
    desc_path = DATA_DIR / "from_ggpk" / "ch_simplified" / "currency_descriptions.json"
    if desc_path.exists():
        try:
            with open(desc_path, "r", encoding="utf-8") as f:
                official = json.load(f)
            n_attached = n_added = 0
            for name, d in official.items():
                entry = ITEM_BONUS_INFO.get(name)
                if entry is None:
                    if not d.get("en") and not d.get("ch"):
                        continue
                    entry = ITEM_BONUS_INFO[name] = {
                        "description": d.get("en", ""),
                        "tags": [],
                    }
                    n_added += 1
                else:
                    n_attached += 1
                entry["description_en"] = d.get("en", "")
                entry["description_ch"] = d.get("ch", "")
            print(f"Merged official GGPK descriptions: {n_attached} localized, "
                  f"{n_added} new entries.")
        except Exception as e:
            print(f"Error merging currency_descriptions.json: {e}")

    # Merge the COMPLETE unique->base map (GGG trade data via
    # parsing_tool/build_unique_base_db.py). FilterBlade's curated entries keep
    # their drop-source text and priority; trade-data extras are appended after
    # them with no text (the hover shows no source badge for those).
    db_path = DATA_DIR / "unique_base_db.json"
    if db_path.exists():
        try:
            with open(db_path, "r", encoding="utf-8") as f:
                db = json.load(f)
            db_bases = db.get("bases", {})
            legacy = set(db.get("legacy", []))
            added = 0
            for base, names in db_bases.items():
                entry = UNIQUE_BASE_INFO.setdefault(base, {"text": None, "uniques": []})
                existing = {c["unique"] for c in entry["uniques"]}
                for name in names:
                    if name in existing:
                        continue
                    cand = {
                        "unique": name,
                        "text": "",
                        "priority": 50,
                        "ruleLink": None,
                        "hideInHoverBox": False,
                    }
                    name_key = _norm_unique_name(name)
                    if name_key in unique_trans:
                        cand["name_ch"] = unique_trans[name_key]
                    entry["uniques"].append(cand)
                    added += 1
            # Drop-disabled (fated/legacy/league-removed) per poewiki — applies
            # to FilterBlade-curated candidates too (e.g. Frostferno).
            n_legacy = 0
            for entry in UNIQUE_BASE_INFO.values():
                for cand in entry["uniques"]:
                    if cand["unique"] in legacy:
                        cand["legacy"] = True
                        n_legacy += 1
            print(f"Merged unique_base_db: +{added} uniques "
                  f"({n_legacy} legacy-flagged), {len(UNIQUE_BASE_INFO)} bases total.")
        except Exception as e:
            print(f"Error merging unique_base_db.json: {e}")

def load_stack_sizes():
    """Patch ITEM_DETAILS with max_stack_size from currencyitems.json."""
    try:
        base_path = DATA_DIR / "from_ggpk" / "baseitemtypes.json"
        currency_path = DATA_DIR / "from_ggpk" / "currencyitems.json"
        if not base_path.exists() or not currency_path.exists():
            print("Warning: stack size source files not found, skipping.")
            return

        with open(base_path, "r", encoding="utf-8") as f:
            base_data = json.load(f)
        rid_to_name = {item["_rid"]: item["Name"] for item in base_data if "_rid" in item and "Name" in item}

        with open(currency_path, "r", encoding="utf-8") as f:
            currency_data = json.load(f)

        count = 0
        for entry in currency_data:
            rid = entry.get("BaseItemTypesKey")
            stack_size = entry.get("StackSize")
            if rid is None or stack_size is None:
                continue
            name = rid_to_name.get(rid)
            if not name or name not in ITEM_DETAILS:
                continue
            ITEM_DETAILS[name]["max_stack_size"] = stack_size
            count += 1

        # Gold is a separate class; hardcode its known max stack size
        if "Gold" in ITEM_DETAILS:
            ITEM_DETAILS["Gold"]["max_stack_size"] = 50000
            count += 1

        print(f"Loaded stack sizes for {count} items.")
    except Exception as e:
        print(f"Error loading stack sizes: {e}")

# --- Specific Endpoints (Top Priority) ---

@app.get("/")
def root():
    return {"message": "Hello"}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.3"}

@app.get("/api/sounds/list")
def list_available_sounds():
    try:
        default_dir = SOUND_FILES_DIR / "Default"
        sharket_dir = SOUND_FILES_DIR / "Sharket掉落音效"
        defaults = [f"Default/{f.name}" for f in default_dir.iterdir() if f.suffix.lower() == '.mp3'] if default_dir.is_dir() else []
        sharket = [f"Sharket掉落音效/{f.name}" for f in sharket_dir.iterdir() if f.suffix.lower() == '.mp3'] if sharket_dir.is_dir() else []
        return {"defaults": sorted(defaults), "sharket": sorted(sharket)}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sounds/proxy")
def proxy_local_sound(path: str):
    # If it's an absolute path (from user disk), use it directly
    p = Path(path)
    if not p.is_absolute():
        # Otherwise, assume it's relative to our sound_files folder
        p = SOUND_FILES_DIR / p
    
    print(f"DEBUG PROXY: Requested '{path}' -> Resolved '{p}' (Exists: {p.exists()})")
    
    if not p.is_file(): 
        raise HTTPException(status_code=404, detail=f"File not found: {p}")
    return FileResponse(p, media_type="audio/mpeg", content_disposition_type="inline")

@app.get("/api/debug/sounds")
def debug_sounds():
    files = []
    if SOUND_FILES_DIR.exists():
        for root, dirs, fnames in os.walk(SOUND_FILES_DIR):
            for f in fnames:
                try:
                    files.append(str(Path(root) / f))
                except: pass
    return {"root": str(SOUND_FILES_DIR), "files": files[:100]} # Limit to 100

@app.get("/api/generated-filter")
def get_generated_filter():
    path = FILTER_GEN_DIR / "complete_filter.filter"
    if not path.exists(): raise HTTPException(status_code=404, detail="Not generated")
    return FileResponse(path)

@app.get("/api/category-structure")
def get_category_structure():
    path = CONFIG_DATA_DIR / "category_structure.json"
    if not path.exists(): return {"categories": []}
    with open(path, "r", encoding="utf-8") as f: return json.load(f)

@app.get("/api/settings")
def get_settings():
    path = CONFIG_DATA_DIR / "settings.json"
    if not path.exists():
        return {"base_theme": "sharket"} # Changed default key
    try:
        data = json.load(open(path, "r", encoding="utf-8"))
        if "active_theme" in data and "base_theme" not in data:
             data["base_theme"] = data["active_theme"] # Migration
        return data
    except:
        return {"base_theme": "sharket"}

@app.post("/api/settings")
async def save_settings(content: dict = Body(...)):
    path = CONFIG_DATA_DIR / "settings.json"
    try:
        existing = {}
        if path.exists():
            existing = json.load(open(path, "r", encoding="utf-8"))
        
        existing.update(content)
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=4, ensure_ascii=False)
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/themes")
def get_themes_list():
    themes_dir = CONFIG_DATA_DIR / "theme"
    return {"themes": [d.name for d in themes_dir.iterdir() if d.is_dir()]} if themes_dir.is_dir() else {"themes": []}

@app.get("/api/rule-templates")
def get_rule_templates():
    """The condition picker's vocabulary, from the unified filter_conditions.yaml.

    ⚠️ THERE IS NO FALLBACK, DELIBERATELY. This used to drop to a legacy static
    `rule_templates.json` whenever the schema failed to load, and that file was two
    leagues stale: it spelled the unique flags `IsReplica` / `IsFoulborn` (the game
    knows `Replica` / `Foulborn`) and offered five PoE2-only keywords — WaystoneTier,
    UnidentifiedItemTier, TwiceCorrupted, IsVaalUnique, AlwaysShow — which
    filter_conditions.yaml lists under "EXCLUDED on purpose". Picking any of them
    wrote a line PoE1 rejects. The fallback never fired, so nothing ever reported it.

    A silent drop to stale data is the bug class that has cost this project the most
    (create_demo_bundle.py no-opping under a green parity suite; clientData drifting
    from main.py). The rule the rewrite plan states for the index cache applies here
    too: a miss that cannot be satisfied is an error, not a fallback. Both legacy
    files now live in filter_generation/archive/retired-data/.
    """
    if not RULE_TEMPLATE_CATEGORIES:
        raise HTTPException(
            status_code=503,
            detail="filter_conditions.yaml did not load — the condition vocabulary is "
                   "unavailable. Check the backend log for the parse error; do not "
                   "author conditions until it loads.",
        )
    return {"categories": RULE_TEMPLATE_CATEGORIES}

@app.get("/api/filter-conditions")
def get_filter_conditions():
    # Flat resolved condition schema (key, type, options, classes, universal,
    # simulatable) — consumed by the simulator form + engine (lenient handling).
    return {"conditions": FILTER_CONDITIONS}

@app.get("/api/search-items")
def search_items(q: str):
    if not q: return {"results": []}
    q_lower = q.lower()
    results_map = {} # name -> result_obj (to deduplicate)

    # 1. Search in Mappings (Tiered items)
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                trans = item_trans_of(data.get("_meta", {}).get("localization", {}))
                
                # Resolve category CH name
                rel_path = file_path.relative_to(CONFIG_DATA_DIR).as_posix()
                cat_ch = CATEGORY_MAP.get(rel_path, "")

                for item_name, tier_val in mapping.items():
                    name_ch = trans.get(item_name, "")
                    if q_lower in item_name.lower() or (name_ch and q_lower in name_ch.lower()):
                        details = ITEM_DETAILS.get(item_name, {})
                        tiers = tier_val if isinstance(tier_val, list) else [tier_val]
                        results_map[item_name] = {
                            "name": item_name, 
                            "name_ch": name_ch or item_name, 
                            "current_tier": tiers[0] if tiers else None,
                            "current_tiers": tiers,
                            "category_ch": cat_ch,
                            "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                            "source_file": file_path.relative_to(mappings_dir).as_posix(),
                            **details
                        }
        except: continue
    
    # 2. Search in BaseTypes (Untiered items)
    for cls, items in CLASS_TO_ITEMS.items():
        for item_name in items:
            if item_name in results_map: continue
            
            name_ch = ITEM_TRANSLATIONS.get(item_name, item_name)
            
            if q_lower in item_name.lower() or q_lower in name_ch.lower():
                details = ITEM_DETAILS.get(item_name, {})
                results_map[item_name] = {
                    "name": item_name,
                    "name_ch": name_ch,
                    "current_tier": None,
                    "current_tiers": [],
                    "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                    "source_file": None,
                    **details
                }

    results = list(results_map.values())
    results.sort(key=lambda x: x["name"])
    
    if len(results) > 50: results = results[:50]
    return {"results": results}

@app.get("/api/item-classes")
def get_item_classes():
    return {"classes": ITEM_CLASSES}

@app.get("/api/class-items/{item_class}")
def get_items_by_class(item_class: str):
    # Items to explicitly include (based on class filter)
    if item_class == "All":
        requested_items = set(ITEM_TO_CLASS.keys())
    else:
        requested_items = CLASS_TO_ITEMS.get(item_class, set())
    
    item_data = {} 
    
    # Pre-populate requested items
    for name in requested_items:
        details = ITEM_DETAILS.get(name, {})
        item_data[name] = {
            "name": name,
            "name_ch": ITEM_TRANSLATIONS.get(name, name),
            "sub_type": ITEM_SUBTYPES.get(name, "Other"),
            **details,
            "current_tier": [],
            "source_file": None,
            "occurrences": []
        }

    # Scan all mappings to find current tiers AND include tiered items from other classes
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                rules = data.get("rules", [])
                trans = item_trans_of(data.get("_meta", {}).get("localization", {}))
                
                # Items specifically in this category
                all_possible_items = set(mapping.keys())
                for r in rules:
                    all_possible_items.update(r.get("targets", []))

                for item_name in all_possible_items:
                    # If item is not in requested_items but is in a mapping/rule, we still want it!
                    if item_name not in item_data:
                        # ...but only when viewing "All". For a specific class, don't inject
                        # tiered items that belong to other classes (e.g. Corpses tiered in
                        # Currency/Corpses.json must not leak into every class's list).
                        if item_class != "All" and ITEM_TO_CLASS.get(item_name) != item_class:
                            continue
                        details = ITEM_DETAILS.get(item_name, {})
                        item_data[item_name] = {
                            "name": item_name,
                            "name_ch": ITEM_TRANSLATIONS.get(item_name, item_name),
                            "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                            **details,
                            "current_tier": [],
                            "source_file": None,
                            "occurrences": []
                        }

                    current_list = item_data[item_name]["current_tier"]
                    rel_file = file_path.relative_to(mappings_dir).as_posix()
                    # Tiers this item occupies WITHIN this specific file (for the occurrence).
                    file_tiers: list[str] = []

                    # Add base mapping tier
                    if item_name in mapping:
                        t_val = mapping[item_name]
                        tiers = t_val if isinstance(t_val, list) else [t_val]
                        for t in tiers:
                            if t not in current_list:
                                current_list.append(t)
                            if t not in file_tiers:
                                file_tiers.append(t)

                    # Add rule tiers + detect an existing per-file sound rule for this item
                    file_sound = None
                    for r in rules:
                        r_targets = r.get("targets", [])
                        if r_targets and item_name in r_targets:
                            r_over = r.get("overrides", {})
                            tier_override = r_over.get("Tier")
                            if tier_override and tier_override not in current_list:
                                current_list.append(tier_override)
                            if tier_override and tier_override not in file_tiers:
                                file_tiers.append(tier_override)
                            if file_sound is None:
                                sound_key = next((k for k in ("CustomAlertSound", "AlertSound", "DropSound", "PlayAlertSound") if k in r_over), None)
                                if sound_key:
                                    sval = r_over[sound_key]
                                    file_sound = sval[0] if isinstance(sval, list) and sval else sval

                    item_data[item_name]["source_file"] = rel_file
                    # Record one occurrence per (item, file) so the editor can target each
                    # repeated basetype independently (per-file rule overrides).
                    item_data[item_name]["occurrences"].append({
                        "file": rel_file,
                        "tiers": file_tiers,
                        "sound": file_sound
                    })
                    if item_name in trans:
                        item_data[item_name]["name_ch"] = trans[item_name]
        except: continue
        
    return {"items": list(item_data.values())}

# --- Action Endpoints ---

@app.post("/api/update-item-tier")
def update_item_tier(request: UpdateItemTierRequest):
    if not request.source_file:
        raise HTTPException(status_code=422, detail="Source file is required")
    
    if request.source_file.startswith("base_mapping/"):
        file_path = safe_join(CONFIG_DATA_DIR, request.source_file)
    else:
        file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", request.source_file)

    # Destination tiers only. old_tier may legitimately BE a dead tier - that is
    # what moving an item off one looks like.
    assert_tiers_exist(request.source_file, (request.new_tiers or []) + [request.new_tier])
    try:
        # One lock per file for the whole read-modify-write, and an atomic
        # replace at the end. Without both, concurrent edits to the same
        # category corrupted it or silently dropped each other's changes.
        with file_lock(file_path):
            with open(file_path, "r", encoding="utf-8") as f: data = json.load(f)
            apply_tier_change(data, request)
            write_json_atomic(file_path, data)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


def assert_tiers_exist(source_file: str, tiers: List[str]) -> None:
    """Reject a tier the target category does not define, before writing it.

    The generator skips any tier label the category does not define, so an item
    filed under an undefined tier emits NOTHING - the filter builds cleanly and
    the item is simply missing in game. That is how 525 curated entries went
    dark unnoticed. Catching it at write time turns a silent data-loss bug into
    an error message naming the valid tiers.
    """
    wanted = [t for t in tiers if t]
    if not wanted:
        return
    rel = source_file[len("base_mapping/"):] if source_file.startswith("base_mapping/") else source_file
    tier_path = CONFIG_DATA_DIR / "tier_definition" / rel
    if not tier_path.exists():
        return          # unpaired category - the CLI validator reports it
    try:
        with open(tier_path, encoding="utf-8-sig") as f:
            doc = json.load(f)
    except Exception:
        return          # a broken tier file is the validator's problem, not this write's
    defined = set()
    for _key, body in doc.items():
        if isinstance(body, dict) and isinstance(body.get("_meta"), dict):
            defined |= {k for k in body if k != "_meta"}
    unknown = [t for t in wanted if t not in defined]
    if unknown and defined:
        raise HTTPException(status_code=400, detail=(
            f"{rel} does not define {', '.join(repr(t) for t in unknown)}. "
            f"An item filed there would emit nothing. Valid tiers: "
            f"{', '.join(sorted(defined))}"))


def apply_tier_change(data: dict, request: "UpdateItemTierRequest") -> None:
    """Mutate one loaded mapping document in place.

    Shared by the single and batch endpoints so their semantics cannot drift
    apart. Does no I/O - the caller owns the lock and the write.
    """
    if True:
        mapping = data.get("mapping", {})

        # 1. Update Localization. Tolerates the string-'ch' nav-rebuild/campaign
        # shape (category name in 'ch', per-item dict in 'ch_items'); the old code
        # assigned into localization['ch'][item] which raised on a string 'ch' → 500.
        # Mirrors item_trans_of on read. (see set_item_trans)
        if "_meta" not in data: data["_meta"] = {}
        if "localization" not in data["_meta"]: data["_meta"]["localization"] = {"en": {}, "ch": {}}
        meta_loc = data["_meta"]["localization"]
        if request.item_name not in item_trans_of(meta_loc):
            trans = ITEM_TRANSLATIONS.get(request.item_name)
            if trans:
                set_item_trans(meta_loc, request.item_name, trans)

        # 3. Update Match Mode
        if "match_modes" not in data["_meta"]: data["_meta"]["match_modes"] = {}
        if request.match_mode:
            data["_meta"]["match_modes"][request.item_name] = request.match_mode
        
        # 2. Update Mapping
        if request.new_tiers is not None:
            # Set exact list (bulk editor)
            # Ensure we don't accidentally remove T0 tiers if the bulk editor didn't see them
            # (though the current editor should see them now)
            mapping[request.item_name] = request.new_tiers
        elif not request.new_tier:
            # DELETE logic
            if request.item_name in mapping:
                current = mapping[request.item_name]
                if request.old_tier and isinstance(current, list):
                    if request.old_tier in current:
                        current.remove(request.old_tier)
                    if not current: del mapping[request.item_name]
                    else: mapping[request.item_name] = current
                elif request.old_tier and current == request.old_tier:
                    del mapping[request.item_name]
                elif not request.old_tier: # Delete all
                    del mapping[request.item_name]
        else:
            current = mapping.get(request.item_name)
            if request.is_append:
                if current:
                    if isinstance(current, list):
                        if request.new_tier not in current:
                            current.append(request.new_tier)
                            mapping[request.item_name] = current
                    elif current != request.new_tier:
                        mapping[request.item_name] = [current, request.new_tier]
                else:
                    mapping[request.item_name] = request.new_tier
            elif request.old_tier and current:
                # Move specific instance
                if isinstance(current, list):
                    if request.old_tier in current:
                        current.remove(request.old_tier)
                    if request.new_tier not in current:
                        current.append(request.new_tier)
                    mapping[request.item_name] = current
                elif current == request.old_tier:
                    mapping[request.item_name] = request.new_tier
            else:
                # Overwrite (Reset)
                mapping[request.item_name] = request.new_tier

        data["mapping"] = mapping


class BulkTierChange(BaseModel):
    """One item's change inside a batch. Same fields as UpdateItemTierRequest."""
    item_name: str
    new_tier: Optional[str] = None
    source_file: str
    is_append: bool = False
    old_tier: Optional[str] = None
    new_tiers: Optional[List[str]] = None
    match_mode: Optional[str] = None


class BulkTierRequest(BaseModel):
    changes: List[BulkTierChange]


@app.post("/api/update-item-tiers-bulk")
def update_item_tiers_bulk(request: BulkTierRequest):
    """Apply many tier changes with ONE read-modify-write per file.

    The editor used to fire one request per item in parallel. Each was a full
    read-modify-write of the same document, so N concurrent edits to one
    category raced: the file could be corrupted, or edits could silently
    disappear because the last writer overwrote everything before it. Grouping
    by file removes the race entirely rather than just narrowing it, and turns
    a 40-item bulk edit into one write instead of forty.
    """
    by_file: Dict[str, List[BulkTierChange]] = collections.OrderedDict()
    for change in request.changes:
        if not change.source_file:
            raise HTTPException(status_code=422, detail="Source file is required")
        by_file.setdefault(change.source_file, []).append(change)

    applied, failures = 0, []
    for source_file, changes in by_file.items():
        if source_file.startswith("base_mapping/"):
            file_path = safe_join(CONFIG_DATA_DIR, source_file)
        else:
            file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", source_file)
        try:
            for change in changes:
                assert_tiers_exist(change.source_file,
                                   (change.new_tiers or []) + [change.new_tier])
            with file_lock(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for change in changes:
                    apply_tier_change(data, change)
                write_json_atomic(file_path, data)
            applied += len(changes)
        except Exception as exc:
            # Report per file: one bad category must not hide the rest, and the
            # editor needs to know WHICH items did not land.
            failures.append({"source_file": source_file,
                             "items": [c.item_name for c in changes],
                             "error": str(exc)})

    if failures:
        raise HTTPException(status_code=500, detail={
            "message": f"{applied} change(s) applied, {sum(len(f['items']) for f in failures)} failed",
            "failures": failures,
        })
    return {"message": "Success", "applied": applied, "files": len(by_file)}

@app.post("/api/update-item-override")
def update_item_override(request: UpdateItemOverrideRequest):
    """Write an item CARD's style override: tier_definition[cat][tier].item_overrides[base].

    The card is the per-occurrence representation of a base in the editor, and
    `(tier, base)` identifies that occurrence — within a tier, `pending_items`
    guarantees a base is claimed by exactly one emitted block, whether that block
    came from a rule or from the tier's own base list. So one write reaches the
    right block either way, and `rule_index` is no longer needed to disambiguate.

    This replaces a much larger routine that synthesised RULES to carry a sound:
    tier-scoped `sound_scope` rules, `suppress_auto_sound` rules whose entire job
    was to exist so auto-sound would skip the item, first-match-wins insertion
    ordering against older bare rules, and a pruning pass to drop rules that had
    been emptied. All of it existed because sound had to be expressed as filter
    logic. It no longer does, so the whole apparatus goes and the write is a dict
    assignment.

    Sound is the common case but nothing here is sound-specific — any style
    channel the mini style editor exposes lands the same way.
    """
    rel = request.source_file
    if rel.startswith("base_mapping/"):
        rel = rel[len("base_mapping/"):]
    file_path = safe_join(CONFIG_DATA_DIR / "tier_definition", rel)

    if not request.tier_key:
        raise HTTPException(status_code=400,
                            detail="tier_key is required: an override belongs to one occurrence")

    try:
        with file_lock(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            category_key = next((k for k in data if not k.startswith("//")), None)
            if not category_key:
                raise HTTPException(status_code=400, detail=f"no category in {rel}")
            entry = data[category_key].get(request.tier_key)
            if not isinstance(entry, dict):
                raise HTTPException(status_code=404,
                                    detail=f"no tier {request.tier_key!r} in {rel}")

            overrides = dict(entry.get("item_overrides") or {})
            card = dict(overrides.get(request.item_name) or {})
            for k in (request.remove_keys or []):
                card.pop(k, None)
            card.update(request.overrides or {})

            # An empty card says nothing, and a card that says nothing is just the
            # block's own look — so it is removed rather than left as an override
            # that would split a block for no reason.
            if card:
                overrides[request.item_name] = card
            else:
                overrides.pop(request.item_name, None)

            if overrides:
                entry["item_overrides"] = overrides
            else:
                entry.pop("item_overrides", None)

            write_json_atomic(file_path, data)
        return {"message": "Success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tier-items")
def get_items_by_tier(request: TierItemsRequest):
    tier_keys_set = set(request.tier_keys)
    result = {k: [] for k in tier_keys_set}
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                rules = data.get("rules", [])
                meta = data.get("_meta", {})
                trans = item_trans_of(meta.get("localization", {}))
                match_modes = meta.get("match_modes", {})
                
                # Evaluate all possible items in this file context
                all_involved = set(mapping.keys())
                for r in rules: all_involved.update(r.get("targets", []))

                for item_name in all_involved:
                    if request.class_filter:
                        item_class = ITEM_TO_CLASS.get(item_name)
                        if item_class != request.class_filter:
                            continue
                    
                    # Calculate final tiers for this item
                    final_tier_entries = [] # List of (tier_key, rule_index or None)

                    if item_name in mapping:
                        t_val = mapping[item_name]
                        base_tiers = t_val if isinstance(t_val, list) else [t_val]
                        for t in base_tiers:
                            final_tier_entries.append((t, None))
                    
                    absorbed: set[str] = set()
                    for idx, r in enumerate(rules):
                        # applyToTier makes `targets` DEAD: the generator replaces
                        # rule_matches with the tier's pending items and never reads
                        # them. A target listed here is not one the generator honours,
                        # so it must not become a card of its own.
                        if r.get("applyToTier"):
                            continue
                        r_t = r.get("targets", [])
                        # ONLY match if targets is a non-empty list
                        if isinstance(r_t, list) and len(r_t) > 0 and item_name in r_t:
                            t_over = r.get("overrides", {}).get("Tier")
                            if t_over:
                                final_tier_entries.append((t_over, idx))
                                if not r.get("disabled"):
                                    absorbed.add(t_over)

                    # ONE card per (item, tier). A live rule that names the item for a
                    # tier discards it from pendingItems, so the
                    # base block never follows: the mapping entry and the rule entry
                    # are the SAME emitted block, not two. Two RULES on one tier do
                    # emit twice, so only the mapping (None) entry is absorbed.
                    if absorbed:
                        final_tier_entries = [
                            (t, r) for t, r in final_tier_entries
                            if r is not None or t not in absorbed
                        ]

                    # Distribute to results
                    for tier_key, rule_idx in final_tier_entries:
                        if tier_key in tier_keys_set:
                            details = ITEM_DETAILS.get(item_name, {})
                            # Determine current_tiers list for frontend display
                            current_tiers_list = list(set(t for t, _ in final_tier_entries))
                            
                            # Resolve match mode: from rule or from base mapping meta
                            item_mode = "exact"
                            if rule_idx is not None:
                                item_mode = rules[rule_idx].get("targetMatchModes", {}).get(item_name, "exact")
                            else:
                                item_mode = match_modes.get(item_name, "exact")

                            result[tier_key].append({
                                "name": item_name, 
                                "name_ch": trans.get(item_name, item_name), 
                                "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                                "current_tiers": current_tiers_list,
                                "source": file_path.relative_to(mappings_dir).as_posix(),
                                "rule_index": rule_idx,
                                "match_mode": item_mode,
                                **details
                            })
        except: continue
    
    return {"items": result}

class GenerateRequest(BaseModel):
    game_version: str = "poe1"
    game_mode: str = "normal"
    strictness: str = "soft"
    leveling_selection: dict = {}  # Campaign picker selection ({} = baseline, picks add T1 boosts)

@app.post("/api/generate")
def generate_filter_file(request: GenerateRequest = Body(default=GenerateRequest())):
    """Build the filter with the one generation engine (ADR-0007).

    This used to run filter_generation/generate.py, a second implementation kept in
    byte-parity with the TypeScript one. There is now a single engine — the same
    filterGenerator.ts every visitor's browser runs — and generate.mjs is a thin CLI
    around it. Local dev and the deployed site therefore cannot disagree, because
    they are no longer two programs.

    A JSON selection goes via a temp file: passing it as an argv string was fine
    through subprocess, but the file form keeps the CLI's one quoting rule ("@path
    or inline") the same everywhere it is called from.
    """
    mode_arg = "ruthless" if request.game_mode == "ruthless" else "standard"
    sel_file = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                         encoding="utf-8") as fh:
            json.dump(request.leveling_selection or {}, fh)
            sel_file = fh.name
        cmd = [
            NODE_EXECUTABLE, str(FILTER_GEN_DIR / "generate.mjs"),
            "--mode", mode_arg,
            "--game-version", request.game_version,
            "--strictness", request.strictness,
            "--leveling-selection", f"@{sel_file}",
        ]
        result = subprocess.run(cmd, check=True, cwd=PROJECT_ROOT,
                                capture_output=True, text=True)
        return {"message": "Success", "output": result.stdout}
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=(
            f"Node not found (tried {NODE_EXECUTABLE!r}). The filter generator runs on "
            "Node now (ADR-0007). Install Node 20+, or set the NODE environment "
            "variable to the executable."))
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=(e.stdout or "") + (e.stderr or ""))
    finally:
        if sel_file:
            try: os.unlink(sel_file)
            except OSError: pass

@app.get("/api/class-hierarchy")
def get_class_hierarchy():
    return {"hierarchy": CLASS_HIERARCHY_TREE}

@app.get("/api/item-info/{base_type}")
def get_item_info(base_type: str):
    info = ITEM_BONUS_INFO.get(base_type, {})
    unique = UNIQUE_BASE_INFO.get(base_type, {})
    return {
        "description": info.get("description", ""),
        "tags": info.get("tags", []),
        "baseText": unique.get("text"),
        "uniques": unique.get("uniques", []),
    }

@app.get("/api/bonus-info")
def get_bonus_info():
    """Bulk hover data: flat item descriptions + per-base unique candidate lists.
    Loaded once by the frontend tooltip layer."""
    return {"items": ITEM_BONUS_INFO, "uniques": UNIQUE_BASE_INFO}

@app.get("/api/class-properties")
def get_class_properties():
    return {"classes": CLASS_RESOLVED_PROPS, "defaults": {}}

@app.get("/api/simulator-bundle")
def get_simulator_bundle():
    # Construct a bundle similar to demo bundle
    mappings = {}
    tier_defs = {}
    
    # Load Mappings
    for file_path in (CONFIG_DATA_DIR / "base_mapping").rglob("*.json"):
        try:
            rel_path = file_path.relative_to(CONFIG_DATA_DIR).as_posix() # "base_mapping/..."
            with open(file_path, "r", encoding="utf-8") as f:
                mappings[rel_path] = json.load(f)
        except: pass

    # Load Tier Defs
    for file_path in (CONFIG_DATA_DIR / "tier_definition").rglob("*.json"):
        try:
            rel_path = file_path.relative_to(CONFIG_DATA_DIR).as_posix()
            with open(file_path, "r", encoding="utf-8") as f:
                tier_defs[rel_path] = json.load(f)
        except: pass

    return {"mappings": mappings, "tiers": tier_defs}

# --- Snapshot Export / Import (lossless filter round-trip) ---

SNAPSHOT_FORMAT = "sharket-filter-snapshot"
SNAPSHOT_VERSION = 1
# Roots (relative to CONFIG_DATA_DIR) captured in a snapshot and writable on import.
SNAPSHOT_DIR_ROOTS = ("tier_definition", "base_mapping", "theme")
IMPORT_BACKUP_DIR = CONFIG_DATA_DIR / "_import_backup"

class ImportSnapshotRequest(BaseModel):
    files: Dict[str, dict]
    # Directory prefixes within which local files absent from `files` are deleted,
    # so a checked category exactly matches the snapshot. tier_definition/ and
    # base_mapping/ only — theme presets added locally are never deleted.
    sync_prefixes: List[str] = []

@app.get("/api/export-snapshot")
def export_snapshot():
    """Full user-editable data tree as a versioned bundle, used by the export
    sidecar/embedded snapshot. Walks the real directories so future additions
    (e.g. variant overlay folders) are captured automatically."""
    files = {}
    for root in SNAPSHOT_DIR_ROOTS:
        root_dir = CONFIG_DATA_DIR / root
        if not root_dir.is_dir():
            continue
        for file_path in sorted(root_dir.rglob("*.json")):
            try:
                rel_path = file_path.relative_to(CONFIG_DATA_DIR).as_posix()
                with open(file_path, "r", encoding="utf-8") as f:
                    files[rel_path] = json.load(f)
            except Exception as e:
                print(f"WARN: snapshot skipped {file_path}: {e}")
    settings_path = CONFIG_DATA_DIR / "settings.json"
    if settings_path.exists():
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                files["settings.json"] = json.load(f)
        except Exception as e:
            print(f"WARN: snapshot skipped settings.json: {e}")
    return {
        "format": SNAPSHOT_FORMAT,
        "version": SNAPSHOT_VERSION,
        "created": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": files,
    }

def _validate_snapshot_relpath(relpath: str, allow_settings: bool = True) -> str:
    rel = relpath.replace("\\", "/").strip()
    if allow_settings and rel == "settings.json":
        return rel
    parts = rel.split("/")
    if (
        not rel
        or rel.startswith("/")
        or ":" in rel
        or ".." in parts
        or parts[0] not in SNAPSHOT_DIR_ROOTS
        or len(parts) < 2
        or not rel.endswith(".json")
    ):
        raise HTTPException(status_code=400, detail=f"Invalid snapshot path: {relpath}")
    safe_join(CONFIG_DATA_DIR, rel)  # final traversal guard
    return rel

@app.post("/api/import-snapshot")
def import_snapshot(request: ImportSnapshotRequest):
    # Validate everything up front — nothing is written if any path is bad.
    files = {_validate_snapshot_relpath(p): content for p, content in request.files.items()}
    prefixes = []
    for prefix in request.sync_prefixes:
        rel = prefix.replace("\\", "/").strip().rstrip("/")
        parts = rel.split("/")
        if not rel or ".." in parts or ":" in rel or parts[0] not in ("tier_definition", "base_mapping"):
            raise HTTPException(status_code=400, detail=f"Invalid sync prefix: {prefix}")
        safe_join(CONFIG_DATA_DIR, rel)
        prefixes.append(rel)

    # Local files under a synced prefix that the snapshot doesn't have get deleted,
    # so the imported category exactly matches the export.
    to_delete = []
    for rel in prefixes:
        prefix_dir = CONFIG_DATA_DIR / rel
        if not prefix_dir.is_dir():
            continue
        for file_path in prefix_dir.rglob("*.json"):
            rel_path = file_path.relative_to(CONFIG_DATA_DIR).as_posix()
            if rel_path not in files:
                to_delete.append(rel_path)

    # Files whose parsed content already matches are skipped entirely, so a
    # restore only touches (and only backs up) what actually changed.
    to_write = {}
    unchanged = []
    for rel_path, content in files.items():
        path = CONFIG_DATA_DIR / rel_path
        try:
            with open(path, "r", encoding="utf-8") as f:
                if json.load(f) == content:
                    unchanged.append(rel_path)
                    continue
        except Exception:
            pass
        to_write[rel_path] = content

    backup_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = IMPORT_BACKUP_DIR / backup_stamp
    backed_up = False
    for rel_path in list(to_write.keys()) + to_delete:
        src = CONFIG_DATA_DIR / rel_path
        if src.exists():
            dest = backup_dir / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            backed_up = True

    for rel_path in to_delete:
        (CONFIG_DATA_DIR / rel_path).unlink(missing_ok=True)
    for rel_path, content in to_write.items():
        path = CONFIG_DATA_DIR / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return {
        "written": sorted(to_write.keys()),
        "unchanged": sorted(unchanged),
        "deleted": sorted(to_delete),
        "backed_up_to": backup_dir.relative_to(CONFIG_DATA_DIR).as_posix() if backed_up else None,
    }

# --- Generic Path Endpoints (Bottom Priority) ---

@app.get("/api/sound-map")
def get_sound_map():
    path = CONFIG_DATA_DIR / "theme" / "sharket" / "Sharket_sound_map.json"
    if not path.exists(): return {"basetype_sounds": {}, "class_sounds": {}}
    try:
        with open(path, "r", encoding="utf-8") as f: return json.load(f)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sound-map")
async def save_sound_map(content: dict = Body(...)):
    path = CONFIG_DATA_DIR / "theme" / "sharket" / "Sharket_sound_map.json"
    try:
        with open(path, "w", encoding="utf-8") as f: json.dump(content, f, indent=2, ensure_ascii=False)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/all-rules")
async def get_all_rules():
    all_rules = []
    mapping_dir = CONFIG_DATA_DIR / "base_mapping"
    print(f"DEBUG: Scanning rules in {mapping_dir}...")
    files_found = 0
    for file_path in mapping_dir.rglob("*.json"):
        files_found += 1
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Rules in mapping files are at the root or inside _meta
                rules = data.get("rules", [])
                if not rules:
                    # Fallback to checking inside category keys (old format)
                    cat_key = next((k for k in data if not k.startswith("//") and k not in ["mapping", "_meta"]), None)
                    if cat_key and isinstance(data[cat_key], dict):
                        rules = data[cat_key].get("rules", []) or data[cat_key].get("_meta", {}).get("rules", [])
                
                if rules:
                    print(f"DEBUG: Found {len(rules)} rules in {file_path.name}")
                    for r in rules:
                        r["_source_file"] = file_path.name
                    all_rules.extend(rules)
        except Exception as e: 
            print(f"DEBUG: Error reading {file_path}: {e}")
            continue
    print(f"DEBUG: Scan complete. Total files: {files_found}, Total rules: {len(all_rules)}")
    return {"rules": all_rules}

@app.get("/api/themes/{theme_name}")
def get_theme_data(theme_name: str):
    theme_dir = safe_join(CONFIG_DATA_DIR / "theme", theme_name)
    theme_file = theme_dir / f"{theme_name}_theme.json"
    sound_map = list(theme_dir.glob("*_sound_map.json"))
    try:
        t_data = json.load(open(theme_file, "r", encoding="utf-8")) if theme_file.exists() else {}
        s_data = json.load(open(sound_map[0], "r", encoding="utf-8")) if sound_map else {}
        return {"theme_name": theme_name, "theme_data": t_data, "sound_map_data": s_data}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/themes/{theme_name}")
async def save_theme_data(theme_name: str, content: dict = Body(...)):
    theme_dir = safe_join(CONFIG_DATA_DIR / "theme", theme_name)
    theme_file = theme_dir / f"{theme_name}_theme.json"
    
    if not theme_dir.exists():
        # Create new theme if it doesn't exist (Folder + File)
        theme_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # If content has 'theme_data' key, use that (wrapper), else use content directly
        data_to_save = content.get("theme_data", content)
        
        with open(theme_file, "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, indent=4, ensure_ascii=False)
        return {"message": "Success", "theme_name": theme_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mapping-info/{file_name:path}")
def get_mapping_info(file_name: str):
    path = safe_join(CONFIG_DATA_DIR / "base_mapping", file_name)
    try:
        with open(path, "r", encoding="utf-8") as f: mapping_content = json.load(f)
        # The look comes from the TIER definition, so report its key (set below).
        # This used to read the base_mapping duplicate, which is wrong on 8 of the 82
        # files that declare it - it showed "Heist" for Contracts while the filter
        # styles it "Heist Contracts". Keep in step with clientData.mappingInfo.
        theme_category = None
        available_tiers = []
        # Load tiers from the matching tier_definition file (same relative path as the mapping file)
        tier_def_path = CONFIG_DATA_DIR / "tier_definition" / file_name
        if tier_def_path.exists():
            try:
                tier_defs = json.loads(tier_def_path.read_text(encoding="utf-8"))
                # The top-level key is the category name (e.g. "General", "Legacy", etc.)
                category_key = next((k for k in tier_defs if not k.startswith("//")), None)
                if category_key:
                    category_data = tier_defs[category_key]
                    theme_category = category_data.get("_meta", {}).get("theme_category") or category_key
                    cat_loc = category_data.get("_meta", {}).get("localization", {})
                    cat_en = cat_loc.get("en", category_key)
                    cat_ch = cat_loc.get("ch", cat_en)
                    for k, v in category_data.items():
                        if k.startswith("Tier"):
                            t_num = v.get("theme", {}).get("Tier", "?")
                            available_tiers.append({
                                "key": k,
                                "label_en": v.get("localization", {}).get("en", f"Tier {t_num} {cat_en}"),
                                "label_ch": v.get("localization", {}).get("ch", f"T{t_num} {cat_ch}"),
                                "show_in_editor": v.get("show_in_editor", True),
                                "is_hide_tier": v.get("is_hide_tier", False)
                            })
            except Exception: pass
        available_tiers.sort(key=lambda x: int(re.search(r"Tier (\d+)", x["key"]).group(1)) if re.search(r"Tier (\d+)", x["key"]) else 999)
        return {"content": mapping_content, "theme_category": theme_category, "available_tiers": available_tiers, "item_translations": item_trans_of(mapping_content.get("_meta", {}).get("localization", {}))}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/{config_path:path}")
def get_config_content(config_path: str):
    path = safe_join(CONFIG_DATA_DIR, config_path)
    try: return {"content": json.load(open(path, "r", encoding="utf-8"))}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/config/{config_path:path}")
async def save_config_file_v2(config_path: str, content: dict = Body(...)):
    path = safe_join(CONFIG_DATA_DIR, config_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Whole-document save from the editor. Atomic + locked so it cannot
    # interleave with a per-item write to the same file.
    with file_lock(path):
        write_json_atomic(path, content)
    return {"message": "Success"}

# --- Mounts ---
if SOUND_FILES_DIR.exists():
    app.mount("/sounds", StaticFiles(directory=str(SOUND_FILES_DIR)), name="sounds")

@app.on_event("startup")
async def startup_event():
    print(f"Backend 1.0.3 started. Project: {PROJECT_ROOT}")
    load_base_types()
    load_translations()
    load_stack_sizes()
    load_category_map()
    load_class_hierarchy()
    load_filter_conditions()
    load_bonus_item_info()