#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] read-only. Writes only under data/from_filter_blade/.
"""Extract FilterBlade's per-purpose base ranking out of their compiled .filter.

    python parsing_tool/extract_filterblade_ranks.py                    # ruthless, full
    python parsing_tool/extract_filterblade_ranks.py --report crafting  # one purpose, readable
    python parsing_tool/extract_filterblade_ranks.py --file FilterBlade.filter

★ The finding this exists to make importable: **membership IS the rank.** FilterBlade's
editor shows RANK A/B/C/D per *purpose page*, so a base is rank A for `exotic->fractured`
and unranked for `crafting->qualityperfection` (436 bases vs 104, 340 in one and not the
other). There is nothing to score and nothing to infer -- for each of their blocks, record
the purpose, the bucket, the `BaseType ==` list and the conditions, and that mapping is the
whole dataset.

Their block header carries all three axes:

    Show # %D5 $type->crafting->generalgear $tier->t1_86
         ^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^
         last strictness   purpose          bucket (rank + ilvl)
         level shown

⚠️ `$tier->` is NOT read as a rank here. `t1_86` looks like "rank 1, ilvl 86" and for
`crafting->generalgear` it is, but `t1basescrusader` / `anyoverqualityperf` /
`qualchancing` are not on that scheme at all. The bucket name is recorded verbatim; the
ilvl comes from the block's own `ItemLevel` condition, which is exact.

⚠️ Read the RUTHLESS file, not `FilterBlade.filter` (softcore) -- they are different
content, and the ruthless one is in places MORE permissive. Ruthless is the default here
on purpose.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC_DIR = os.path.join(REPO, "data", "from_filter_blade", "3.29")
OUT = os.path.join(SRC_DIR, "ruthless_ranks.json")

# Everything that paints rather than matches.
STYLE = {
    "SetFontSize", "SetTextColor", "SetBorderColor", "SetBackgroundColor",
    "PlayAlertSound", "PlayAlertSoundPositional", "CustomAlertSound",
    "CustomAlertSoundOptional", "PlayEffect", "MinimapIcon", "DisableDropSound",
    "EnableDropSound", "DisableDropSoundIfAlertSound", "EnableDropSoundIfAlertSound",
}

# ⚠️ An explicit allowlist, not "anything indented". Block bodies in this file are
# indented in some sections and flush-left in others (`$type->rr->amuring` is flush-left),
# so keying off indentation silently drops whole purposes -- it read rr->amuring as 0 bases
# while the block plainly lists 8 rings and amulets. And keying off "starts with a capital"
# instead swallows their prose comments, which are capitalised too (`Level 85 crafting
# bases`, `Selected top tier bases`). Only a keyword list separates the two exactly.
CONDITIONS = {
    "AnyEnchantment", "AreaLevel", "BaseArmour", "BaseDefencePercentile",
    "BaseEnergyShield", "BaseEvasion", "BaseType", "BaseWard", "BlightedMap", "Class",
    "Corrupted", "CorruptedMods", "DropLevel", "ElderMap", "EnchantmentPassiveNode",
    "EnchantmentPassiveNum", "Foulborn", "FracturedItem", "GemLevel", "GemQualityType",
    "HasCruciblePassiveTree", "HasEaterOfWorldsImplicit", "HasExplicitMod",
    "HasImplicitMod", "HasInfluence", "HasSearingExarchImplicit", "Height", "Identified",
    "ItemLevel", "LinkedSockets", "MapTier", "MemoryStrands", "Mirrored", "Quality",
    "Rarity", "Replica", "Scourged", "ShapedMap", "SocketGroup", "Sockets", "StackSize",
    "SynthesisedItem", "TransfiguredGem", "UberBlightedMap", "Width", "ZanaMemory",
}
BODY_KEYWORDS = STYLE | CONDITIONS | {"Continue"}

HEADER = re.compile(
    r"^(?P<off>#)?(?P<action>Show|Hide|Minimal)\b"
    r"(?P<rest>.*)$"
)
TYPE_RE = re.compile(r"\$type->(\S+)")
TIER_RE = re.compile(r"\$tier->(\S+)")
STRICT_RE = re.compile(r"%([DH])(\d)")
# BaseType/Class values are quoted; bare words appear on unquoted single-value forms.
VALUES_RE = re.compile(r'"([^"]*)"|(\S+)')


def values(s):
    out = []
    for quoted, bare in VALUES_RE.findall(s):
        v = quoted if quoted else bare
        if v in ("==", "=", "!", "!=", ">=", "<="):
            continue
        out.append(v)
    return out


def parse(path):
    """Walk the file once, returning one dict per block in file order."""
    blocks = []
    cur = None
    with io.open(path, encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            if not line.strip():
                cur = None          # a blank line is the only block separator
                continue
            stripped = line.lstrip("#").strip()

            m = HEADER.match(stripped)
            if m:
                t = TYPE_RE.search(m.group("rest"))
                tr = TIER_RE.search(m.group("rest"))
                st = STRICT_RE.search(m.group("rest"))
                cur = {
                    "line": lineno,
                    "action": m.group("action"),
                    "enabled": not line.startswith("#"),
                    "purpose": t.group(1) if t else None,
                    "bucket": tr.group(1) if tr else None,
                    "strictness": (st.group(1) + st.group(2)) if st else None,
                    "conditions": OrderedDict(),
                    "bases": [],
                    "classes": [],
                    "style": [],
                    "continue": False,
                }
                blocks.append(cur)
                continue

            parts = stripped.split(None, 1)
            if not parts:
                continue        # a bare `#` divider line
            key = parts[0]
            rest = parts[1] if len(parts) > 1 else ""
            if cur is None or key not in BODY_KEYWORDS:
                continue        # prose comment, or a stray line outside any block

            if key == "Continue":
                cur["continue"] = True
            elif key in STYLE:
                cur["style"].append(key)
            elif key == "BaseType":
                cur["bases"] = values(rest)
                cur["conditions"]["BaseType"] = "== (%d)" % len(cur["bases"])
            elif key == "Class":
                cur["classes"] = values(rest)
                cur["conditions"]["Class"] = "== (%d)" % len(cur["classes"])
            else:
                cur["conditions"][key] = rest.strip()
    return blocks


def ilvl_of(block):
    """The block's own ItemLevel gate -- exact, unlike anything read off the bucket name."""
    v = block["conditions"].get("ItemLevel")
    if not v:
        return None
    m = re.search(r"(\d+)", v)
    return int(m.group(1)) if m else None


def build(blocks):
    purposes = OrderedDict()
    bases = defaultdict(list)

    for b in blocks:
        if not b["purpose"]:
            continue
        p = purposes.setdefault(b["purpose"], OrderedDict([("blocks", []), ("bases", [])]))
        entry = OrderedDict([
            ("bucket", b["bucket"]),
            ("line", b["line"]),
            ("action", b["action"]),
            ("enabled", b["enabled"]),
            ("strictness", b["strictness"]),
            ("item_level", ilvl_of(b)),
            ("conditions", b["conditions"]),
            ("classes", b["classes"]),
            ("base_count", len(b["bases"])),
            ("bases", b["bases"]),
        ])
        p["blocks"].append(entry)
        for base in b["bases"]:
            bases[base].append(OrderedDict([
                ("purpose", b["purpose"]),
                ("bucket", b["bucket"]),
                ("item_level", ilvl_of(b)),
                ("enabled", b["enabled"]),
                ("line", b["line"]),
            ]))

    for p in purposes.values():
        seen = []
        for blk in p["blocks"]:
            for base in blk["bases"]:
                if base not in seen:
                    seen.append(base)
        p["bases"] = sorted(seen)

    return purposes, bases


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="FilterBlade.ruthlessfilter")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--report", metavar="PURPOSE_PREFIX",
                    help="print the blocks of matching purposes instead of a summary")
    args = ap.parse_args()

    path = args.file if os.path.isabs(args.file) else os.path.join(SRC_DIR, args.file)
    blocks = parse(path)
    purposes, bases = build(blocks)

    named = [b for b in blocks if b["purpose"]]
    print("%s" % os.path.basename(path))
    print("  blocks     : %d  (%d carry a $type, %d disabled)"
          % (len(blocks), len(named), sum(1 for b in named if not b["enabled"])))
    print("  purposes   : %d" % len(purposes))
    print("  bases named: %d distinct" % len(bases))

    if args.report:
        for name, p in purposes.items():
            if not name.startswith(args.report):
                continue
            print("\n=== %s  (%d blocks, %d bases) ===" % (name, len(p["blocks"]), len(p["bases"])))
            for blk in p["blocks"]:
                cond = ", ".join("%s %s" % (k, v) for k, v in blk["conditions"].items())
                print("  %-28s %-4s %-3s L%-5d %s"
                      % (blk["bucket"], blk["strictness"] or "-",
                         "on" if blk["enabled"] else "OFF", blk["line"], cond))
    else:
        print("\n  %-34s %6s %6s" % ("purpose", "blocks", "bases"))
        for name, p in sorted(purposes.items(), key=lambda kv: -len(kv[1]["bases"])):
            print("  %-34s %6d %6d" % (name, len(p["blocks"]), len(p["bases"])))

    doc = OrderedDict([
        ("_meta", OrderedDict([
            ("source", os.path.basename(path)),
            ("generated_by", "parsing_tool/extract_filterblade_ranks.py"),
            ("note", "Reference extraction, not curation. Membership in a purpose's "
                     "bucket IS the rank; item_level is read from the block's own "
                     "ItemLevel condition, never from the bucket name."),
            ("block_count", len(blocks)),
            ("purpose_count", len(purposes)),
            ("base_count", len(bases)),
        ])),
        ("purposes", purposes),
        ("bases", OrderedDict(sorted(bases.items()))),
    ])
    io.open(args.out, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("\nwrote %s" % os.path.relpath(args.out, REPO))


if __name__ == "__main__":
    main()
