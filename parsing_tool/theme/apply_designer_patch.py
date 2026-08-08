# -*- coding: utf-8 -*-
"""Apply the designer's 3.29 theme patch onto the tier definitions.

    python parsing_tool/theme/apply_designer_patch.py <theme_patch_3.29.json>
    python parsing_tool/theme/apply_designer_patch.py <patch> --apply

★ WHY IT WRITES INLINE, PER TIER, RATHER THAN INTO sharket_theme.json ROWS.
The theme file is keyed by RUNG (`Tier 2` means "the rung-2 row of this category"). The
designer's rungs are a NEW global scale; our tiers still carry their OLD rung numbers. Those
two disagree almost everywhere — `Tier 0 Harvest` sits on rung 1 today and the kit assigns it
R2 — so writing a rung-keyed patch into rung-keyed rows would land nearly every colour on the
wrong tier. Writing the look onto the TIER puts it on the right item now, and leaves the rung
renumbering as the separate pass it always was.

⚠️ THE PATCH USES TWO KEYING CONVENTIONS AND THEY ARE NOT INTERCHANGEABLE. `Skill Gems`,
`Corpses`, `Oils`, `Essences` and `Fossils` are keyed by RUNG (`R2`..`R5`); `Currency`,
`Harvest`, `Maps`, `Scarabs` and `Tainted Currency` are keyed by our TIER KEYS. `_tier_map`
is the authority for the second group and is quoted per row below.

⚠️ WHAT IS DELIBERATELY NOT APPLIED, and why each one needs a human:

  Currency Tier 5-8    `_tier_map` says "Tier 9/R5 = EMIT NOTHING". That is correct AFTER the
                       re-tier collapses nine tiers onto five rungs. Today `Tier 5 General`
                       is 点金石级 — alch-level — and blanking it now would make Alchemy Orbs
                       unstyled. The looks for Tier 0-4 apply; the blanking waits.
  Essences / Oils /    Four tiers, three or four rung entries, and no `_tier_map` line saying
  Corpses / gems       which tier takes which rung. Order-mapping them would be a guess about
                       value, which is the author's call, not a script's.
  Maps T17             "NEW key needed" — a tier that does not exist yet. The author adds it.
  Sockets & Links      No theme category; these are rule overrides in VendorRecipes.
  Jewels               A rarity grammar (white/magic/rare plates), not a rung ladder — it
                       needs rule-level work rather than a tier style.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
APPLY = "--apply" in sys.argv

# (patch section, patch key) -> (tier_definition file, tier key)
# Every row here is either stated verbatim in `_tier_map` or resolved by NAME (Allflame),
# never inferred from ordering.
MAP = {
    ("Currency", "Tier 0"): ("Currency/General.json", "Tier 0 General"),
    ("Currency", "Tier 1"): ("Currency/General.json", "Tier 1 General"),
    ("Currency", "Tier 2"): ("Currency/General.json", "Tier 2 General"),
    ("Currency", "Tier 3"): ("Currency/General.json", "Tier 3 General"),
    ("Currency", "Tier 4"): ("Currency/General.json", "Tier 4 General"),

    ("Harvest", "Tier 0"): ("Currency/Harvest.json", "Tier 0 Harvest"),
    ("Harvest", "Tier 1"): ("Currency/Harvest.json", "Tier 1 Harvest"),
    ("Harvest", "Tier 2"): ("Currency/Harvest.json", "Tier 2 Harvest"),
    ("Harvest", "Tier 3"): ("Currency/Harvest.json", "Tier 3 Harvest"),

    ("Maps", "Tier 0"):        ("Maps/Base Maps.json", "Tier 0 Base Maps"),
    ("Maps", "Tier 1 (T16)"):  ("Maps/Base Maps.json", "Tier 1 Base Maps"),
    ("Maps", "Tier 2 (红图)"):  ("Maps/Base Maps.json", "Tier 2 Base Maps"),
    ("Maps", "Tier 3 (黄图)"):  ("Maps/Base Maps.json", "Tier 3 Base Maps"),
    ("Maps", "Tier 4 (白图)"):  ("Maps/Base Maps.json", "Tier 4 Base Maps"),

    ("Scarabs", "Tier 0"): ("Maps/Scarabs.json", "Tier 0 Scarabs"),
    ("Scarabs", "Tier 1"): ("Maps/Scarabs.json", "Tier 1 Scarabs"),
    ("Scarabs", "Tier 2"): ("Maps/Scarabs.json", "Tier 2 Scarabs"),
    ("Scarabs", "Tier 3"): ("Maps/Scarabs.json", "Tier 3 Scarabs"),
    ("Scarabs", "Tier 4"): ("Maps/Scarabs.json", "Tier 4 Scarabs"),

    ("Tainted Currency", "Tier 1"): ("Currency/Tainted Currency.json", "Tier 1 Tainted"),
    ("Tainted Currency", "Tier 2"): ("Currency/Tainted Currency.json", "Tier 2 Tainted"),
    ("Tainted Currency", "Tier 3"): ("Currency/Tainted Currency.json", "Tier 3 Tainted"),
    ("Tainted Currency", "Tier 4"): ("Currency/Tainted Currency.json", "Tier 4 Tainted"),

    # "R0 premium(12 fossils+prime resonators) · R1 rest-good · R2 mid · R3 common" — four
    # entries, four tiers, and the kit names the contents of each, so this one is stated.
    ("Fossils & Resonators", "R0 premium"): ("Currency/Fossils.json", "Tier 0 Fossils"),
    ("Fossils & Resonators", "R1 good"):    ("Currency/Fossils.json", "Tier 1 Fossils"),
    ("Fossils & Resonators", "R2 mid"):     ("Currency/Fossils.json", "Tier 2 Fossils"),
    ("Fossils & Resonators", "R3 common"):  ("Currency/Fossils.json", "Tier 3 Fossils"),

    ("Delirium Orbs", "R2 (single tier)"): ("Currency/Delirium Orbs.json", "Delirium Orbs"),

    # Resolved by NAME from `_tier_map`: "瓶中信 R2 · 高级达克特 R3 · 普通达克特 ... 死者硫磺-by-stack
    # · charts own blue"
    ("Curse of the Allflame", "R2 瓶中信"):      ("Curse of the Allflame/Bottles.json", "Bottles"),
    ("Curse of the Allflame", "R3 高级达克特"):    ("Curse of the Allflame/Ducats.json", "Ducats T0"),
    ("Curse of the Allflame", "R4 普通达克特"):    ("Curse of the Allflame/Ducats.json", "Ducats T1"),
    ("Curse of the Allflame", "R2 大量死者硫磺"):  ("Curse of the Allflame/Sulphur.json", "Sulphur T0"),
    ("Curse of the Allflame", "海图 (own blue, one tier)"):
        ("Curse of the Allflame/Voyage Charts.json", "Voyage Charts"),
}

# Sections we deliberately leave for a human; the reason is printed, never silently dropped.
DEFER = {
    "Skill Gems": "rung-keyed, 6 tiers vs 4 rungs, no _tier_map line -> which tier takes which rung is a value call",
    "Corpses": "rung-keyed, 5 tiers vs 4 rungs, no _tier_map line",
    "Oils": "rung-keyed, 4 tiers vs 3 rungs, no _tier_map line",
    "Essences": "rung-keyed, 4 tiers vs 3 rungs, no _tier_map line",
    "Legacy": "border mark only; `items keep family/rarity look - retire the text ladder` is a structural change",
    "Sockets & Links": "no theme category - these are rule overrides in VendorRecipes",
    "Jewels (normal & abyss)": "a rarity grammar (white/magic/rare), not a rung ladder",
}

STYLE = ("TextColor", "BackgroundColor", "BorderColor", "FontSize", "MinimapIcon", "PlayEffect")


def main():
    src = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not src:
        print("usage: apply_designer_patch.py <theme_patch.json> [--apply]")
        return 2
    P = json.load(io.open(src[0], encoding="utf-8"))

    touched = collections.defaultdict(list)
    unmapped, applied = [], []
    for sec, body in P.items():
        if sec.startswith("_"):
            continue
        if sec in DEFER:
            continue
        if not isinstance(body, dict):
            continue
        for key, spec in body.items():
            if not isinstance(spec, dict):
                continue
            tgt = MAP.get((sec, key))
            if not tgt:
                unmapped.append((sec, key))
                continue
            touched[tgt[0]].append((tgt[1], sec, key, spec))

    for rel, items in sorted(touched.items()):
        path = os.path.join(TD, rel.replace("/", os.sep))
        d = json.load(io.open(path, encoding="utf-8"),
                      object_pairs_hook=collections.OrderedDict)
        dirty = False
        for tier, sec, key, spec in items:
            node = None
            for cat, cbody in d.items():
                if isinstance(cbody, dict) and isinstance(cbody.get(tier), dict):
                    node = cbody[tier]
                    break
            if node is None:
                unmapped.append((sec, "%s -> tier %s NOT FOUND in %s" % (key, tier, rel)))
                continue
            th = node.setdefault("theme", collections.OrderedDict())
            before = {k: th.get(k) for k in STYLE}
            for k in STYLE:
                if k in spec:
                    th[k] = spec[k]
            # ⚠️ A `disabled:` value is an omit-sentinel, not a colour (scrolls carry one).
            # The patch never sends one, so nothing here can resurrect a muted rung by
            # accident — but if a future kit does, it must be passed through verbatim.
            applied.append((rel, tier, sec, key, before, {k: th.get(k) for k in STYLE}))
            dirty = True
        if dirty and APPLY:
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(d, ensure_ascii=False, indent=2) + "\n")

    print("=== designer patch ===")
    print("  tier styles written : %d across %d files" % (len(applied), len(touched)))
    print("  sections deferred   : %d" % len(DEFER))
    print("  unmapped entries    : %d" % len(unmapped))
    print()
    for rel, tier, sec, key, b, a in applied:
        print("  %-30s %-20s  <- %s / %s" % (rel[:30], tier[:20], sec, key))
        print("       %s on %s  fs=%s icon=%s"
              % (a["TextColor"], a["BackgroundColor"], a["FontSize"], a["MinimapIcon"]))
    print()
    print("--- deferred, each needs a human decision ---")
    for k, why in DEFER.items():
        print("  %-26s %s" % (k, why))
    print()
    if unmapped:
        print("--- unmapped (no rule in MAP) ---")
        for s, k in unmapped:
            print("  %s / %s" % (s, k))
    print()
    print("⚠️ ALSO NOT DONE: `_tier_map` says Currency Tier 5-8 = R5 = EMIT NOTHING.")
    print("   Correct after the re-tier; today Tier 5 General is 点金石级 (alch-level) and")
    print("   blanking it would make Alchemy Orbs unstyled. Looks for Tier 0-4 are applied.")
    print()
    print("written" if APPLY else "(dry run -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
