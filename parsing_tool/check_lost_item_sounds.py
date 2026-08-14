# -*- coding: utf-8 -*-
"""Which curated per-item sounds never reach the filter?

    node filter_generation/generate.mjs --mode ruthless --strictness soft \
         --out out/x.filter --trace filter_generation/traces/ruthless-soft.json
    python parsing_tool/check_lost_item_sounds.py

★ THE AUTHOR, IN GAME (2026-08-10): *"6.92 got some individual item sound lost, but not a big
portion."* This finds them, and separates the two reasons an item can go quiet — they need
different fixes and only one of them is a bug.

  UNWIRED   the base has a curated sound in `Sharket_sound_map.json` -> `basetype_sounds`,
            but nothing in the tree asks for it. Auto-sound used to synthesise a one-target
            rule per such base; it was deliberately deleted (a rule that merely NAMED a base
            silenced it across its whole file, so nine curated sounds reached the game
            nowhere). The plan was to convert every synthesised sound into an EXPLICIT rule
            in the migration. Whatever was not converted is silently unwired — the entry is
            still in the library, still visible in the editor's sound picker, and emits
            nothing.

  OVERRIDDEN the base IS wired — a tier item-card or rule sets its sound — but the block that
            actually claims the base is an earlier one carrying a different sound. First
            match wins, so the curated sound loses. This is a tiering/order question, not a
            wiring one.

⚠️ NOT EVERY UNWIRED ENTRY IS A DEFECT. `basetype_sounds` is a LIBRARY of 142 curated
sounds, not a promise that all 142 are in use: a base can be retired, moved to a category
that wants a family sound instead, or deliberately left on its tier's sound. So this prints a
list to read, and the author decides which deserve wiring — sound is theirs.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "filter_generation", "data")
TRACE = os.path.join(ROOT, "filter_generation", "traces", "ruthless-soft.json")
SEP = chr(92)  # backslash


def stem(p):
    if not p:
        return None
    return p.split(SEP)[-1].split("/")[-1]


def main():
    if not os.path.exists(TRACE):
        print("no trace — run generate.mjs --trace first")
        return 2
    sound_map = json.load(io.open(os.path.join(DATA, "theme", "sharket", "Sharket_sound_map.json"),
                                  encoding="utf-8"))
    curated = {b: stem((v or {}).get("file"))
               for b, v in (sound_map.get("basetype_sounds") or {}).items()
               if (v or {}).get("file")}

    blocks = sorted(json.load(io.open(TRACE, encoding="utf-8"))["blocks"], key=lambda x: x["order"])

    # ⚠️ A GATED BLOCK IS NOT A THIEF. The first block that NAMES a base is not necessarily
    # the one that catches the drop: `Tier 0 Influenced` carries `HasInfluence`, so it wins
    # only for an influenced item and a plain one falls through to its own category. Counting
    # it as the winner reported 28 curated sounds as lost when almost none of them are — the
    # same DEFINITE-vs-POSSIBLE distinction check_cross_category_claims.py already documents.
    #
    # So the winner is the first block with NO gate beyond the name/class match. Gated blocks
    # are collected separately: they change the sound only for the state they name, which for
    # influence is exactly what Sharket's own filter does on purpose.
    # ⚠️ `Rarity <= Rare` is NOT a state gate — it is the ordinary scope of an equipment tier
    # (41 of 49 carry it), and counting it as one made 63 perfectly normal bases look like they
    # reached nothing. Only `Rarity Unique` narrows to a state. Everything else here genuinely
    # describes a condition the item is IN rather than what it IS.
    # ⚠️ `MemoryStrands` was missing and belongs here by this list's own criterion — it
    # describes a condition the item is IN, not what it IS, exactly like Corrupted or
    # FracturedItem. Without it the Crafting Strands tiers counted as ungated winners and 13
    # equipment bases were reported as having lost their sound, when a stranded drop is
    # supposed to announce the STRAND — the same reasoning that makes an influenced drop
    # announce influence. Found because wire_overridden_sounds.py disagreed with this file,
    # which is the whole reason the two share one vocabulary.
    GATES = ("ItemLevel", "AreaLevel", "StackSize", "Sockets", "LinkedSockets",
             "SocketGroup", "Quality", "GemLevel", "MapTier", "Corrupted", "Mirrored",
             "Identified", "FracturedItem", "SynthesisedItem", "AnyEnchantment", "HasInfluence",
             "EnchantmentPassiveNum", "BaseDefencePercentile", "TransfiguredGem", "Replica",
             "Foulborn", "HasExplicitMod", "HasEaterOfWorldsImplicit", "HasSearingExarchImplicit",
             "MemoryStrands")

    def gated(text):
        if re.search(r"^\s*Rarity\s+.*\bUnique\b", text, re.M):
            return True
        return any(re.search(r"^\s*%s\b" % g, text, re.M) for g in GATES)

    winner, all_sounds, gated_alt = {}, collections.defaultdict(set), collections.defaultdict(list)
    for b in blocks:
        m = re.search(r'^\s*CustomAlertSound\s+"([^"]+)"', b["text"], re.M)
        snd = stem(m.group(1)) if m else None
        g = gated(b["text"])
        for base in b["bases"]:
            all_sounds[base].add(snd)
            if g:
                gated_alt[base].append((snd, b))
            elif base not in winner:
                winner[base] = (snd, b)

    unwired, overridden, ok, absent = [], [], 0, []
    for base, want in curated.items():
        if base not in winner:
            absent.append(base)
            continue
        got, blk = winner[base]
        if got == want:
            ok += 1
        elif want in all_sounds[base]:
            overridden.append((base, want, got, blk))
        else:
            unwired.append((base, want, got, blk))

    print("=== curated per-item sounds (basetype_sounds) ===")
    print("  curated entries                     : %d" % len(curated))
    print("  reaching the game on a normal drop  : %d" % ok)
    print("  ★ UNWIRED (nothing asks for it)     : %d" % len(unwired))
    print("  OVERRIDDEN by an UNGATED earlier block: %d" % len(overridden))
    print("  base reaches no ungated block       : %d" % len(absent))
    print()
    n_gated = sum(1 for b in curated if gated_alt.get(b))
    print("  (%d curated bases also appear in GATED blocks — influenced, corrupted, high-ilvl."
          % n_gated)
    print("   Those play the state's sound only for that state, which is deliberate: Sharket's")
    print("   own filter announces an influenced drop as influenced. Not counted as lost.)")
    print()

    if unwired:
        print("--- UNWIRED: curated, but no tier or rule requests it ---")
        by_sound = collections.Counter(w for _, w, _, _ in unwired)
        for base, want, got, blk in sorted(unwired)[:40]:
            print("   %-30s wants %-22s plays %-20s  [%s] %s"
                  % (base[:30], want[:22], (got or "SILENT")[:20], blk["order"], blk["tier_key"][:26]))
        if len(unwired) > 40:
            print("   ... +%d more" % (len(unwired) - 40))
        print()
        print("   most-wanted unwired sounds: %s"
              % ", ".join("%s×%d" % (s, n) for s, n in by_sound.most_common(6)))
        print()
    if overridden:
        print("--- OVERRIDDEN: wired somewhere, but an earlier block claims the base ---")
        for base, want, got, blk in sorted(overridden)[:20]:
            print("   %-30s wants %-22s plays %-20s  [%s] %s"
                  % (base[:30], want[:22], (got or "SILENT")[:20], blk["order"], blk["tier_key"][:26]))
    if absent:
        print()
        print("--- curated but the base reaches no block at all : %d ---" % len(absent))
        print("   %s" % ", ".join(sorted(absent)[:12]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
