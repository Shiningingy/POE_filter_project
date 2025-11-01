import json
import logging
from pathlib import Path
from sqlalchemy.orm import sessionmaker
from sql_model import ItemClass, BaseType, ENGINE, Base
from sqlalchemy import text
from dotenv import load_dotenv

# --- Load environment and setup logging ---
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("import_log.txt"),
    ],
)
logger = logging.getLogger(__name__)

# --- Paths ---
ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "../data/from_ggpk/ch"
DATA_ENG = ROOT / "../data/from_ggpk"

FILES = ["itemclasses.json", "baseitemtypes.json"]

# --- DB setup ---
Base.metadata.create_all(ENGINE)
Session = sessionmaker(bind=ENGINE)

# Drop and recreate all tables
Base.metadata.drop_all(ENGINE)
Base.metadata.create_all(ENGINE)

# --- English name mapping ---
with open(DATA_ENG / "baseitemtypes.json", "r", encoding="utf-8") as f:
    en_data = json.load(f)
eng_basetype_name = {item["_rid"]: item["Name"] for item in en_data}

# --- Model map ---
MODEL_MAP = {
    "itemclasses.json": ItemClass,
    "baseitemtypes.json": BaseType,
}

# --- Load data ---
data = {}
for filename in FILES:
    path = DATA_PATH / filename
    with open(path, "r", encoding="utf-8") as f:
        data[filename] = json.load(f)

# --- Parsers ---
def parse_item_classes(data):
    return [
        {
            "id": e["_rid"],
            "name": e["Id"],
            "text": e["Name"],
        }
        for e in data
    ]

def parse_base_item_types(data):
    return [
        {
            "id": e["_rid"],
            "name": eng_basetype_name.get(e["_rid"], f"Unknown_{e['_rid']}"),
            "text": e["Name"],
            "item_class_id": e.get("ItemClassesKey"),
            "width": e.get("Width"),
            "height": e.get("Height"),
        }
        for e in data
    ]

PARSERS = {
    "itemclasses.json": parse_item_classes,
    "baseitemtypes.json": parse_base_item_types,
}

# --- Parse all files ---
parsed_results = {}
for filename, json_data in data.items():
    parser = PARSERS.get(filename)
    if parser:
        parsed_results[filename] = parser(json_data)
    else:
        logger.warning(f"No parser defined for {filename}")

# --- Clean old data safely ---
with ENGINE.begin() as conn:
    logger.info("Clearing old data...")
    conn.execute(text("DELETE FROM base_types;"))
    conn.execute(text("DELETE FROM item_classes;"))
    logger.info("Tables cleared.")

# --- Insert data ---
try:
    with Session.begin() as session:
        for filename in ["itemclasses.json", "baseitemtypes.json"]:
            rows = parsed_results.get(filename)
            model = MODEL_MAP.get(filename)
            if not rows or not model:
                logger.warning(f"Skipping {filename} — no rows or model.")
                continue

            logger.info(f"Inserting {len(rows)} rows into {model.__tablename__}...")
            try:
                session.bulk_insert_mappings(model, rows)
                logger.info(f"Inserted {filename}")
            except Exception as e:
                logger.error(f"Error inserting {filename}: {e}")
                session.rollback()
                raise #end process
    logger.info("All inserts committed successfully.")
except Exception as e:
    logger.exception("Critical failure during insert process:")