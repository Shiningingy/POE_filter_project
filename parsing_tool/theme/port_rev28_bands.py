# -*- coding: utf-8 -*-
"""Port rev 28's band rulings: Fossils gets the vermilion and an orange floor.

    python parsing_tool/theme/port_rev28_bands.py            # review
    python parsing_tool/theme/port_rev28_bands.py --apply    # write

rev 28 answers ask-01. Three rulings land here:

1. **Fossils takes the five-step currency band with the floor on orange.** A player reported
   its bottom ten bases reading as a mute tier; they were on R4, the Armourer's-Scrap tan.
   The designer adopted the proposed table outright — FilterBlade's own tan fossil rung is
   commented out, so nothing lives on tan in Ruthless fossil scarcity. The vermilion R2 that
   the section note always claimed ("currency bands verbatim") is finally actually there.

2. **Every painted row now carries `_rung`**, the GLOBAL rung its recipe resolves to. That is
   rev 28's fix for the naming collision ask-01 opened: the patch used to label rows R0..Rn
   per section, so `R2` meant the vermilion in one file and the orange in another. Their
   instruction is exact — *"Assert routing against `_rung`, never key names."* We stamp our
   own rows the same way, which is what lets the two disagree LOUDLY: our `Tier 1` holds R0's
   recipe, and now it says so instead of merely being so.

3. **Wombgifts reconciles toward the row — DECLINED by the author, do not re-propose.** The
   designer asked us to drop the inline R1 so the reserved R0 row shows, on the stated grounds
   that it "costs nothing in game — the tier is empty". It is not empty: `Tier 1 Wombgifts`
   holds **`Ancient Wombgift`**, so the change would promote a live chase base to red-on-white,
   the loudest look in the system. Author's ruling on that evidence (2026-08-19): *"the current
   state of wombgifts is good"*, meaning V6.95's — the inline stays and the row keeps its R0
   stamp for the record. Only the `_rung` stamps are written for this category.

4. **Runegrafts and Tattoos flatten to two rungs.** The designer's ruling assumed two visible
   tiers and prescribed a third that hides; we have three, and none is residue — each carries
   its own sound (`666` / `符文` / `文身`), which is how the author tells them apart. Author's
   ruling (2026-08-19): *"they should sit at white on red or vermilion level and mostly that's
   it"* — plus the observation that T0's Journey Tattoos *"usually do not drop on the ground
   unless a player do so"*, so nothing here wants a louder rung than the band's own two.

   So: T0 keeps R1 (white on house red), and BOTH rule-fed tiers share **one** R2 vermilion
   row. That is also the real fix for the defect ask-01 reported — the complaint was never
   "two tiers look alike", it was that **two RUNGS were painted the same value**, which breaks
   the scale. One rung, one look, two tiers on it, told apart by sound. The now-unused fifth
   row is deleted, which is the designer's "delete both rows" honoured on the half that is
   genuinely dead.

⚠️ INLINE IS HALF THE TREE, so this writes BOTH. The tier's inline style wins over the row
(`filterStyle.resolveTierTheme`), and 31% of tiers carry one — a rows-only port of this would
have changed the theme file and not the filter.

⚠️ `PlayEffect` IS NOT TOUCHED. It appears in 0 of the patch's 88 painted rows, so the patch
does not model it and its absence carries no intent. Reading absence as a removal is what
stripped the map beams on the rev-25 port. `MinimapIcon` IS modelled (37 of 88), so its
absence on the new R3 floor row IS a removal — the icon moves up with the vermilion and the
floor goes bare, which is also what their reply says in words ("no icon — floor").

Sounds are never touched here; they are the author's.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "filter_generation", "data")
THEME = os.path.join(DATA, "theme", "sharket", "sharket_theme.json")
TD = os.path.join(DATA, "tier_definition")
APPLY = "--apply" in sys.argv

# Currency band rows, rev 28 verbatim — the two rungs Runegrafts is allowed to use.
BAND_R1 = {"TextColor": "#ffffffff", "BackgroundColor": "#d20000ff",
           "BorderColor": "#ffffffff", "FontSize": 45,
           "MinimapIcon": "0 Red Diamond", "_rung": "R1"}
BAND_R2 = {"TextColor": "#ffffffff", "BackgroundColor": "#f05a23ff", "FontSize": 45,
           "MinimapIcon": "1 Green Diamond", "_rung": "R2"}

# ---------------------------------------------------------------- rev 28, verbatim
# theme-patch-rev28.json -> "Fossils & Resonators". Keyed here by OUR row digit, which is
# what the tiers declare; `_rung` records the global rung, so the two can be compared.
FOSSIL_ROWS = {
    "Tier 1": {"TextColor": "#ff0000ff", "BackgroundColor": "#ffffffff",
               "BorderColor": "#ff0000ff", "FontSize": 45,
               "MinimapIcon": "0 Red Star", "_rung": "R0"},
    "Tier 2": {"TextColor": "#ffffffff", "BackgroundColor": "#d20000ff",
               "BorderColor": "#00ff00ff", "FontSize": 45,
               "MinimapIcon": "1 Green Diamond", "_rung": "R1"},
    "Tier 3": {"TextColor": "#ffffffff", "BackgroundColor": "#f05a23ff", "FontSize": 45,
               "MinimapIcon": "2 Orange Diamond", "_rung": "R2"},
    "Tier 4": {"TextColor": "#000000ff", "BackgroundColor": "#ffaa00ff", "FontSize": 45,
               "_rung": "R3"},
}

# tier key -> the row digit it declares. Its inline copy has to move with the row or the
# row change is invisible.
FOSSIL_TIERS = {
    "Tier 0 Fossils": "Tier 1",
    "Tier 1 Fossils": "Tier 2",
    "Tier 2 Fossils": "Tier 3",
    "Tier 3 Fossils": "Tier 4",
}

# Channels the patch models. Everything else on a tier's inline block is left exactly alone.
MODELLED = ("TextColor", "BackgroundColor", "BorderColor", "FontSize", "MinimapIcon")


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)


def save(p, doc):
    io.open(p, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main():
    changes = []
    theme = load(THEME)

    # --- 1. Fossils rows -------------------------------------------------------------
    foss = theme.setdefault("Fossils", collections.OrderedDict())
    for row, want in FOSSIL_ROWS.items():
        have = foss.get(row) or {}
        for k in MODELLED + ("_rung",):
            if k in want and have.get(k) != want[k]:
                changes.append(("row", "Fossils", row, k, have.get(k), want[k]))
            elif k not in want and k in have:
                changes.append(("row", "Fossils", row, k, have.get(k), None))
        foss[row] = collections.OrderedDict(
            [(k, v) for k, v in want.items()])

    # --- 2. Fossils inline -----------------------------------------------------------
    fpath = os.path.join(TD, "Currency", "Fossils.json")
    fdoc = load(fpath)
    for cat, body in fdoc.items():
        if not isinstance(body, dict):
            continue
        for tkey, row in FOSSIL_TIERS.items():
            tier = body.get(tkey)
            if not isinstance(tier, dict):
                continue
            th = tier.setdefault("theme", collections.OrderedDict())
            want = FOSSIL_ROWS[row]
            for k in MODELLED:
                if k in want:
                    if th.get(k) != want[k]:
                        changes.append(("inline", tkey, k, th.get(k), want[k], ""))
                    th[k] = want[k]
                elif k in th:
                    changes.append(("inline", tkey, k, th.get(k), None, ""))
                    del th[k]

    # --- 3. Wombgifts: drop the inline that fights the reserved R0 row ---------------
    wpath = os.path.join(TD, "Currency", "Wombgifts.json")
    wdoc = load(wpath)          # untouched: the author declined the reconcile, see docstring §3
    wrow = theme.setdefault("Wombgifts", collections.OrderedDict())
    if "Tier 3" in wrow:
        wrow["Tier 3"]["_rung"] = "R0"
    if "Tier 4" in wrow:
        wrow["Tier 4"]["_rung"] = "R2"
    if "Tier 5" in wrow:
        wrow["Tier 5"]["_rung"] = "R4"

    # --- 4. Runegrafts: two rungs, three tiers, told apart by sound ---------------------
    rrow = theme.setdefault("Runegrafts", collections.OrderedDict())
    for row, want in (("Tier 3", BAND_R1), ("Tier 4", BAND_R2)):
        have = collections.OrderedDict(rrow.get(row) or {})
        # ⚠️ MERGE, never replace. A wholesale overwrite dropped `PlayEffect: Orange` off the
        # R1 row on the first run — the same unmodelled-channel mistake that stripped the map
        # beams on rev 25, reproduced inside the very script whose docstring warns about it.
        # Only the channels the patch models are allowed to change here.
        for k in list(want):
            if have.get(k) != want[k]:
                changes.append(("row", "Runegrafts", row, k, have.get(k), want[k]))
            have[k] = want[k]
        for k in MODELLED:                      # modelled key absent from the recipe = removal
            if k not in want and k in have:
                changes.append(("row", "Runegrafts", row, k, have[k], None))
                del have[k]
        rrow[row] = have
    # Only the fifth row. It is what this change makes dead — the tattoo tier moves off it onto
    # the R2 row, and a rung painted the same as its neighbour is the defect ask-01 reported.
    # Runegrafts' `Tier 1`/`Tier 2` rows are ALSO dead, but they were dead before this and
    # belong to the separate dead-row sweep, not to a ruling about two rungs.
    if "Tier 5" in rrow:
        changes.append(("row", "Runegrafts", "Tier 5", "(whole row)", "present", None))
        del rrow["Tier 5"]

    rpath = os.path.join(TD, "Currency", "Runegrafts.json")
    rdoc = load(rpath)
    for cat, body in rdoc.items():
        if not isinstance(body, dict):
            continue
        tat = body.get("Tier 2 Runegrafts")          # 纹身 — joins the runegraft rung
        if isinstance(tat, dict):
            th = tat.setdefault("theme", collections.OrderedDict())
            if th.get("Tier") != 4:
                changes.append(("inline", "Tier 2 Runegrafts", "Tier", th.get("Tier"), 4, "share R2"))
                th["Tier"] = 4
            # FS40 inline would undercut the band's 45 — the row cannot win against inline.
            if "FontSize" in th:
                changes.append(("inline", "Tier 2 Runegrafts", "FontSize", th["FontSize"], None, "take band 45"))
                del th["FontSize"]

    print("=== port rev 28 bands ===")
    print("  changes: %d\n" % len(changes))
    for c in changes:
        if c[0] == "row":
            _, cat, row, k, old, new = c
            print("  row     %-10s %-8s %-16s %-22s -> %s" % (cat, row, k, old, new))
        else:
            _, tkey, k, old, new, note = c
            print("  inline  %-22s %-16s %-22s -> %-22s %s" % (tkey[:22], k, old, new, note))

    if APPLY:
        save(THEME, theme)
        save(fpath, fdoc)
        save(rpath, rdoc)
        print("\nwritten: sharket_theme.json + Fossils.json + Runegrafts.json")
    else:
        print("\n(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
