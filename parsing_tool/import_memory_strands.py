#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Rebuild the memory-strand tiers: real Show tiers, ranked bases, 30+/60+ thresholds.

    python parsing_tool/import_memory_strands.py            # dry run (default)
    python parsing_tool/import_memory_strands.py --apply

★ Why these are TIERS and not decorators (author, corrected mid-design):

Strands are an emphasiser -- a T2 base is worth a look if it rolled high strands. The
obvious shape for "emphasise what is already there" is a decorator, and that is WRONG here:
**a decorator cannot show an item that is minimalised.** Verified in our own trace -- the 5
decorators emit at orders 11001-11005 while every hide block is at 37002+, and `Continue`
composes per property, so the later `Minimal` wins visibility. A decorator can restyle a
shown item; it can never rescue a hidden one. Promotion therefore needs a real Show block
with its own BaseType list, emitted before the hide.

That also fixes placement: these live in `Crafting Priority` (gen_order -10, the earliest
equipment category), which is what makes them beat `Rare Equipment`'s Tier 4 hide at
gen_order 3. A separate category would have to win that race by hand.

Shape:

    Crafting Strands 60+     condition-only, MemoryStrands >= 60, ANY base
    Crafting Strands T1      38 bases,  MemoryStrands >= 30
    Crafting Strands T2     135 bases,  MemoryStrands >= 30
    Crafting Strands T3     104 bases,  MemoryStrands >= 30

Thresholds are the author's (30/60), not FilterBlade's (15/20/25 + 60): a 1-strand item is
nothing, and a base good in its own right is already caught by the rare ladder or the
crafting rungs. The 60+ tier is deliberately condition-only so an exceptional roll on an
UNRANKED base still shows -- that is the "promote other bases if they are already good"
half, and a ranked-only design would silently drop it.

Replaces `Crafting Strands Weapons` (MemoryStrands >= 1, ItemLevel >= 83) and
`Crafting Strands Gear` (>= 1), which between them held 63 bases -- 60 of which are inside
FilterBlade's 277, the other 3 being the hand-added Runic pieces.

⚠️ The `ItemLevel >= 83` on the old weapons tier is dropped. It was our own addition;
FilterBlade's memory-strand blocks carry no item level at all, and it would now fight the
strand threshold.

⚠️ `item_overrides` (8 custom per-item sounds) are carried onto whichever new tier claims
the base. Moving a base between tiers without carrying its override loses the sound
silently -- the trap recorded in split_currency_scrolls.py.

⚠️ The 3 Runic pieces are NOT auto-assigned to a rank. FilterBlade never ranked them (they
post-date its list), and inventing a rank is exactly the guess this project keeps banning.
They keep showing via the 60+ tier and the crafting rungs; assign them by hand if wanted.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, "filter_generation", "data")
REL = os.path.join("Equipment", "Crafting Priority.json")
TIER = os.path.join(DATA, "tier_definition", REL)
MAP = os.path.join(DATA, "base_mapping", REL)
RERANK = os.path.join(DATA, "theme", "sharket", "rerank.compiled.json")
RANKS = os.path.join(REPO, "data", "from_filter_blade", "3.29", "ruthless_ranks.json")

CAT = "Crafting Priority"
OLD = ["Crafting Strands Weapons", "Crafting Strands Gear"]
HIGH = "Crafting Strands 60+"
ANCHOR = "Crafting Gear 86"          # new tiers go before this
# key, bucket, theme.Tier, label(en), label(ch-from-existing)
PLAN = [("Crafting Strands T1", "t1", 3),
        ("Crafting Strands T2", "t2", 4),
        ("Crafting Strands T3", "t3", 4)]


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, doc):
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    fb = load(RANKS)
    buckets = {b["bucket"]: b for b in fb["purposes"]["gear->memorystrand"]["blocks"]}

    tdoc, mdoc = load(TIER), load(MAP)
    body = tdoc[CAT]
    if HIGH in body:
        sys.exit("%r already exists -- already run?" % HIGH)
    for k in OLD:
        if k not in body:
            sys.exit("expected tier %r not found" % k)

    # zh labels are NOT authored here: reuse the strings already approved on the tiers
    # being replaced.  ⚠️ never transliterate.
    zh_gear = (body["Crafting Strands Gear"].get("localization") or {}).get("ch", "")
    zh_weap = (body["Crafting Strands Weapons"].get("localization") or {}).get("ch", "")

    # carry the old tiers' per-item sounds
    old_ov = OrderedDict()
    for k in OLD:
        for b, o in (body[k].get("item_overrides") or {}).items():
            old_ov[b] = o

    mapping = mdoc.setdefault("mapping", OrderedDict())
    old_bases = {b for b, t in mapping.items()
                 if any(x in OLD for x in (t if isinstance(t, list) else [t]))}

    print("memory strands -> real Show tiers")
    print("  replacing : %s  (%d bases)" % (", ".join(OLD), len(old_bases)))

    def tier(cond, theme_tier, en, ch, gate, cls_cond=False):
        d = OrderedDict()
        if cls_cond:
            d["class_condition"] = True
        d["hideable"] = True
        d["conditions"] = cond
        d["theme"] = OrderedDict([("Tier", theme_tier)])
        d["sound"] = OrderedDict([("default_sound_id", -1), ("sharket_sound_id", None)])
        d["localization"] = OrderedDict([("en", en), ("ch", ch)])
        d["hide_at_strictness"] = gate
        return d

    new = OrderedDict()
    new[HIGH] = tier(
        OrderedDict([("Rarity", "<= Rare"), ("MemoryStrands", ">= 60")]),
        2, "Memory Strands 60+ (any base)", zh_gear + " 60+", 6, cls_cond=True)

    claimed = {}
    for key, bucket, tnum in PLAN:
        blk = buckets.get(bucket)
        if blk is None:
            sys.exit("bucket %r missing" % bucket)
        bases = [b for b in blk["bases"] if b not in claimed]
        for b in bases:
            claimed[b] = key
        zh = (zh_weap if bucket == "t1" else zh_gear)
        new[key] = tier(
            OrderedDict([("Rarity", "<= Rare"), ("MemoryStrands", ">= 30")]),
            tnum, "Memory Strands 30+ (rank %s)" % bucket[-1].upper(),
            "%s %s" % (zh, bucket.upper()), 3 if bucket != "t1" else 5)
        ov = OrderedDict((b, old_ov[b]) for b in bases if b in old_ov)
        if ov:
            new[key]["item_overrides"] = ov
        print("  %-22s <- %-4s %3d bases, %d sounds carried" % (key, bucket, len(bases), len(ov)))

    print("  %-22s <- condition-only, any base, MemoryStrands >= 60" % HIGH)
    lost = [b for b in old_ov if b not in claimed]
    if lost:
        print("  !! sounds with no new home (kept on 60+ is impossible - it names no bases): %s"
              % ", ".join(lost))
    orphan = sorted(old_bases - set(claimed))
    print("  !! previously-stranded bases FilterBlade never ranked: %s"
          % (", ".join(orphan) or "none"))

    # splice: new tiers replace the old pair, in place
    rebuilt = OrderedDict()
    for k, v in body.items():
        if k in OLD:
            if k == OLD[0]:
                rebuilt.update(new)
            continue
        rebuilt[k] = v
    body.clear()
    body.update(rebuilt)
    order = (body.get("_meta") or {}).get("tier_order")
    if isinstance(order, list):
        i = order.index(OLD[0])
        for k in OLD:
            order.remove(k)
        for off, k in enumerate(new):
            order.insert(i + off, k)

    for b in list(mapping):
        cur = mapping[b] if isinstance(mapping[b], list) else [mapping[b]]
        cur = [x for x in cur if x not in OLD]
        if b in claimed and claimed[b] not in cur:
            cur.append(claimed[b])
        if cur:
            mapping[b] = cur if len(cur) > 1 else cur[0]
        else:
            del mapping[b]
    for b, key in claimed.items():
        if b not in mapping:
            mapping[b] = key
    mdoc["mapping"] = OrderedDict(sorted(mapping.items()))

    rr = load(RERANK)
    n = 0
    for row in rr:
        if row.get("tier_key") in OLD:
            row["tier_key"] = "Crafting Strands T2"
            n += 1
    print("  rerank rows retargeted: %d" % n)
    print("  bases mapped          : %d" % len(claimed))

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    dump(TIER, tdoc)
    dump(MAP, mdoc)
    dump(RERANK, rr)
    print("\nwrote 3 files -- regenerate and check the trace")


if __name__ == "__main__":
    main()
