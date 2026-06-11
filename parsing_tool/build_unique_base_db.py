"""
Build a COMPLETE base-type -> unique-names map from GGG's official trade
static data, complementing FilterBlade's curated bonusItemInfo (which only
covers ~237 "notable" bases — e.g. Leather Hood/Frostferno was missing).

Source caches:
  * data/cache/trade_items.json — refresh with:
        curl -H "User-Agent: Mozilla/5.0" \
            https://www.pathofexile.com/api/trade/data/items \
            -o data/cache/trade_items.json
  * data/cache/poewiki_unique_drop.json — poewiki cargo query (paginated,
    browser UA required), fields items.name + items.drop_enabled where
    rarity="Unique"; rows like {"name": ..., "drop enabled": "0"|"1"}.

Output: data/unique_base_db.json
    {"bases": {base_type: [unique names]}, "legacy": [unique names]}
The backend merges bases as low-priority candidates after FilterBlade's
curated entries (which carry drop-source text); "legacy" lists uniques the
wiki marks drop-disabled (fated/legacy/league-removed) — the hover shows a
"Legacy" badge for those instead of a drop-source badge.

Run from the project root:
    python parsing_tool/build_unique_base_db.py
"""

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CACHE = PROJECT_ROOT / "data" / "cache" / "trade_items.json"
WIKI_CACHE = PROJECT_ROOT / "data" / "cache" / "poewiki_unique_drop.json"
OUT = PROJECT_ROOT / "data" / "unique_base_db.json"

# Item-shaped categories only; beasts/corpses/gems/cards etc. are flagged
# "unique" too but their `type` is not a hoverable gear base.
CATEGORIES = {
    "accessory", "armour", "flask", "jewel", "weapon", "map",
    "tincture", "heistequipment", "heistmission", "sanctum", "idol",
}


def main():
    data = json.loads(CACHE.read_text(encoding="utf-8"))
    bases = {}
    n = 0
    for cat in data.get("result", []):
        if cat.get("id") not in CATEGORIES:
            continue
        for e in cat.get("entries", []):
            name, base = e.get("name"), e.get("type")
            if not (name and base and e.get("flags", {}).get("unique")):
                continue
            lst = bases.setdefault(base, [])
            if name not in lst:
                lst.append(name)
                n += 1
    legacy = []
    if WIKI_CACHE.exists():
        rows = json.loads(WIKI_CACHE.read_text(encoding="utf-8"))
        legacy = sorted({r["name"] for r in rows if r.get("drop enabled") == "0"})

    out = {
        "_meta": {
            "source": "pathofexile.com/api/trade/data/items + poewiki drop_enabled (see module docstring to refresh)",
            "note": "complete unique->base map; merged after FilterBlade's curated bonusItemInfo",
        },
        "bases": {b: bases[b] for b in sorted(bases)},
        "legacy": legacy,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[ok] {n} uniques across {len(bases)} base types, {len(legacy)} legacy "
          f"-> {OUT.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
