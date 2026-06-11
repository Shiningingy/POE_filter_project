# Extract official zh-simplified currency descriptions from raw GGPK .datc64
# tables and join them to EN item names.
#
# Inputs (all already in the repo):
#   data/from_ggpk/ch_simplified/currencyitems.datc64   (fresh zh dump)
#   data/from_ggpk/ch_simplified/baseitemtypes.datc64   (fresh zh dump, same patch)
#   data/from_ggpk/baseitemtypes.json                   (EN dump; gives EN names via stable metadata Id)
#   data/from_ggpk/currencyitems.json                   (EN dump; official EN description, used by the
#                                                        tooltip to dedup FilterBlade text lines)
# Output:
#   data/from_ggpk/ch_simplified/currency_descriptions.json
#     { "<EN item name>": { "en": "<official EN description>", "ch": "<official zh description>" } }
#
# datc64 layout: uint32 row count, fixed-width rows, 8x 0xBB boundary, then a
# variable-length section holding UTF-16LE strings terminated by 4 zero bytes.
# String cells are uint64 offsets into the variable section. Column offsets
# below were located empirically and are guarded by assertions so a future
# patch that reshuffles the tables fails loudly instead of producing garbage.
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GGPK = ROOT / "data" / "from_ggpk"
OUT_PATH = GGPK / "ch_simplified" / "currency_descriptions.json"

# Column offsets within a fixed-width row (verified against the EN JSON dumps).
CURRENCY_BASETYPE_KEY_OFF = 0   # uint64 rid into BaseItemTypes
CURRENCY_DESCRIPTION_OFF = 56   # string
BASETYPE_ID_OFF = 0             # string ("Metadata/Items/...", language-independent)
BASETYPE_NAME_OFF = 32          # string (localized name)

NULL_ROW = 0xFEFEFEFEFEFEFEFE


def load_table(path: Path):
    data = path.read_bytes()
    n = struct.unpack_from("<I", data, 0)[0]
    bb = data.find(b"\xbb" * 8)
    if n == 0 or bb <= 4 or (bb - 4) % n:
        raise ValueError(f"{path.name}: unexpected datc64 layout")
    width = (bb - 4) // n
    return n, width, data[4:bb], data[bb:]


def read_str(var: bytes, off: int):
    if off < 8 or off >= len(var) or off % 2:
        return None
    end = off
    while end + 4 <= len(var):
        if var[end:end + 4] == b"\x00\x00\x00\x00":
            try:
                return var[off:end].decode("utf-16-le")
            except UnicodeDecodeError:
                return None
        end += 2
    return None


def cell_u64(fixed: bytes, width: int, row: int, off: int) -> int:
    return struct.unpack_from("<Q", fixed, row * width + off)[0]


def main():
    # 1. Fresh zh BaseItemTypes: rid -> (metadata Id, zh name)
    n, width, fixed, var = load_table(GGPK / "ch_simplified" / "baseitemtypes.datc64")
    rid_to_id, rid_to_zh = {}, {}
    for r in range(n):
        item_id = read_str(var, cell_u64(fixed, width, r, BASETYPE_ID_OFF))
        name = read_str(var, cell_u64(fixed, width, r, BASETYPE_NAME_OFF))
        if item_id:
            rid_to_id[r] = item_id
            rid_to_zh[r] = name or ""
    assert rid_to_id.get(0, "").startswith("Metadata/"), "BaseItemTypes Id column moved"

    # 2. Fresh zh CurrencyItems: rid -> zh description
    n, width, fixed, var = load_table(GGPK / "ch_simplified" / "currencyitems.datc64")
    zh_desc_by_id = {}
    for r in range(n):
        base_rid = cell_u64(fixed, width, r, CURRENCY_BASETYPE_KEY_OFF)
        if base_rid == NULL_ROW or base_rid not in rid_to_id:
            continue
        desc = read_str(var, cell_u64(fixed, width, r, CURRENCY_DESCRIPTION_OFF))
        if desc:
            zh_desc_by_id[rid_to_id[base_rid]] = desc

    # 3. EN dumps: metadata Id -> EN name, EN name -> official EN description
    en_base = json.loads((GGPK / "baseitemtypes.json").read_text(encoding="utf-8"))
    en_name_by_rid = {b["_rid"]: b.get("Name", "") for b in en_base}
    en_name_by_id = {b["Id"]: b.get("Name", "") for b in en_base if b.get("Id")}
    en_cur = json.loads((GGPK / "currencyitems.json").read_text(encoding="utf-8"))
    en_desc_by_name = {}
    for c in en_cur:
        name = en_name_by_rid.get(c.get("BaseItemTypesKey"))
        if name and c.get("Description"):
            en_desc_by_name[name] = c["Description"]

    # 4. Join on metadata Id
    out = {}
    for item_id, zh_desc in zh_desc_by_id.items():
        en_name = en_name_by_id.get(item_id)
        if not en_name:
            continue  # item newer than the EN dump; nothing references it yet
        out[en_name] = {"en": en_desc_by_name.get(en_name, ""), "ch": zh_desc}

    chaos = out.get("Chaos Orb", {})
    assert chaos.get("ch") and chaos.get("en", "").startswith("Reforges"), \
        "Chaos Orb sanity check failed - column offsets likely moved"

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"zh descriptions extracted: {len(zh_desc_by_id)}")
    print(f"joined to EN names:        {len(out)}")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
