# -*- coding: utf-8 -*-
"""Give a curated sound back to the block that actually claims its base.

    node filter_generation/generate.mjs --mode ruthless --strictness soft \
         --out out/x.filter --trace filter_generation/traces/ruthless-soft.json
    python parsing_tool/wire_overridden_sounds.py            # review
    python parsing_tool/wire_overridden_sounds.py --apply    # write

★ THE AUTHOR, IN GAME: *"some individual item sound lost."* `check_lost_item_sounds.py`
separates the two reasons; this fixes the second one, OVERRIDDEN — the base has a curated
sound in the library, and the block that wins it plays something generic instead. Thirteen
equipment bases lose to the Crafting Strands tiers' `顶级底材.mp3`.

The fix is an item CARD on the winning block: `item_overrides[base].PlayAlertSound`. That is
what cards are for — `splitByOverride` gives the base its own block with the same look and
only the sound differing, and orders override groups ahead of the plain block so first-match
cannot swallow them. No condition moves, no block is reordered, nothing is re-tiered.

⚠️ RESTORING INTENT, NOT INVENTING IT. Every sound written here already exists in
`basetype_sounds` — the author curated it and it simply never reached the game. Where a base
loses to a DIFFERENT CURATED sound the winner is left alone: Prismatic Jewel plays
`哇~三相珠宝！.mp3` over its plainer `三相珠宝.mp3` because a rule says so, and that is a
choice, not a loss.

⚠️ Only tier blocks are wired. A base whose winner is a rule-sourced block would need the
override on the RULE, which is a different write and is reported instead.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACE = os.path.join(ROOT, "filter_generation", "traces", "ruthless-soft.json")
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
SOUND_MAP = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket",
                         "Sharket_sound_map.json")
APPLY = "--apply" in sys.argv
SEP = chr(92)

# Conditions that make a block depend on the ITEM rolled rather than on its identity. A block
# behind one of these is not "the" winner — it fires only for that state — so it is skipped.
GATES = ("ItemLevel", "AreaLevel", "Rarity", "StackSize", "Sockets", "LinkedSockets", "Quality",
         "GemLevel", "MapTier", "Corrupted", "Mirrored", "Identified", "FracturedItem",
         "SynthesisedItem", "AnyEnchantment", "HasInfluence", "EnchantmentPassiveNum",
         "BaseDefencePercentile", "TransfiguredGem", "Replica", "MemoryStrands")


def main():
    tr = json.load(io.open(TRACE, encoding="utf-8"))
    curated = {k: (v.get("file") or "")
               for k, v in json.load(io.open(SOUND_MAP, encoding="utf-8"))
               .get("basetype_sounds", {}).items()}

    def gated(b):
        """Does this block only fire for a particular ROLL or STATE?

        ⚠️ THE WINNER IS THE FIRST UNGATED BLOCK, NOT THE FIRST BLOCK. `Tier 0 Influenced`
        emits early and names most equipment, but it carries HasInfluence — a plain drop never
        reaches it. Taking it as the winner would write a card that overrides the INFLUENCED
        sound with the base's own, destroying behaviour the kit calls deliberate: Sharket's
        filter announces an influenced drop as influenced. Same mistake, in the same session,
        as counting 31 lost sounds where the real number was 3.
        """
        return any(re.search(r"(?m)^\s*%s\b" % g, b["text"]) for g in GATES)

    blocks = sorted(tr["blocks"], key=lambda b: b["order"])
    winner, sounds = {}, {}
    for b in blocks:
        if gated(b):
            continue
        m = re.search(r'CustomAlertSound "([^"]+)"', b["text"])
        snd = m.group(1) if m else None
        for base in b["bases"]:
            if base not in winner:
                winner[base] = b
                sounds[base] = snd

    todo, skipped = [], []
    for base, want in curated.items():
        b = winner.get(base)
        if not b or not want:
            continue
        got = sounds.get(base)
        if got and got.split(SEP)[-1] == want.split("/")[-1]:
            continue                                   # already plays it
        if got and got.split(SEP)[-1] in {v.split("/")[-1] for v in curated.values()}:
            skipped.append((base, want, got, "winner plays another CURATED sound — a choice"))
            continue
        if b["source"] not in ("tier_base", "card"):
            skipped.append((base, want, got, "winner is rule-sourced (%s) — needs a rule write" % b["source"]))
            continue
        todo.append((base, want, got, b["file"], b["tier_key"]))

    print("=== wire overridden curated sounds ===")
    print("  to wire : %d" % len(todo))
    print("  skipped : %d" % len(skipped))
    print()
    for base, want, got, rel, tier in todo:
        print("   %-26s %-18s -> %-18s on %s :: %s"
              % (base[:26], (got or "SILENT").split(SEP)[-1][:18], want.split("/")[-1][:18],
                 rel.rsplit("/", 1)[-1][:24], tier[:24]))
    for base, want, got, why in skipped:
        print("   -- %-24s %s" % (base[:24], why))

    if not APPLY:
        print("\n(review only -- pass --apply)")
        return 0

    files = {}
    for base, want, _got, rel, tier in todo:
        path = os.path.join(TD, *rel.split("/"))
        if path not in files:
            files[path] = json.load(io.open(path, encoding="utf-8"),
                                    object_pairs_hook=collections.OrderedDict)
        doc = files[path]
        cat = next(k for k in doc if not k.startswith("//"))
        entry = doc[cat].get(tier)
        if not isinstance(entry, dict):
            print("  !! %s :: %s not found" % (rel, tier))
            continue
        ov = entry.setdefault("item_overrides", collections.OrderedDict())
        card = ov.setdefault(base, collections.OrderedDict())
        card["PlayAlertSound"] = [want, 300]
    for path, doc in files.items():
        io.open(path, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("\nwritten: %d file(s), %d card(s)" % (len(files), len(todo)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
