# -*- coding: utf-8 -*-
"""Port the designer's patch into the theme rows, VERBATIM.

    python parsing_tool/theme/port_designer_patch.py            # review
    python parsing_tool/theme/port_designer_patch.py --apply    # write

★ VERBATIM IS THE WHOLE POINT. Author, 2026-08-10: *"just follow what designer give you, if
anything wrong we will propose a new version for you to port"* and *"we own the themes"*. So
this copies values; it does not judge them.

Specifically it does NOT gate on:
  - contrast — *"i think we dont need to gate the contrast sometimes"*, and the designer's own
    line: "Contrast is a floor, never an objective". Their currency R2 takes white at 3.39:1
    over black at 6.19:1 on purpose.
  - font size — the patch carries FS45 at rungs our rows had at 40. That is the design.

⚠️ WHY A PORTER AND NOT A GENERATOR. Deriving is what went wrong twice. `accent.solid` x a
rung recipe reproduced neither the designer's text choice nor their plates, because
`docs/design/handoff/theme-presets.json` is a PRE-REV-22 bank — corpses, harvest, scarabs and
allflame are all stale in it, and allflame's `255 120 40` is actually the enshrouded STATE.
An explicit value always outranks a derived one; where the patch is silent, nothing is written.

⚠️ BAND FAMILIES TAKE THE CURRENCY LADDER, NOT AN ACCENT. Reply 03: currency, fossils &
resonators, omens and runegrafts own no colour — they walk Sharket's five authored bands, and
"for these the generator must not run". They are ported from the patch's own rows.

⚠️ FIVE CATEGORIES ARE UNAUTHORED AND MUST NOT BE TOUCHED — breach, expedition, vendor
recipes, ritual, incursion vials. The designer's bank values for them collide with shipped
colours (breach `160 45 255` is ~7° from the maps T17 plate; ritual `150 20 40` IS tainted's
blood plate verbatim). Waiting for rev 23 is deliberate: "five decisions, not 22, and I would
rather make them than have arithmetic make them".

★★ THE PATCH USES TWO KEY CONVENTIONS AND THEY RESOLVE DIFFERENTLY. This cost a whole port.
The first pass read every key with one regex — `Tier 3` and `R3` both to 3 — and wrote the row
`Tier 3`. A theme row is looked up by the tier's declared `theme.Tier` (its RUNG), so that is
only right when a tier's key number happens to equal its rung. For the `R` sections it does not,
and the rows landed at indices no tier ever looks up: inert. Oils shipped its top tier wearing
the CURRENCY house plate because the row it actually reads was never written.

  `Tier N`  (Harvest, Scarabs, Tainted) — the patch's own words: *"Tier keys follow each
            category's existing tier_definition"*. So the key NAMES one of our tiers: resolve
            `Tier 0` to `Tier 0 Harvest` and take that tier's declared rung. Do NOT read N as
            the row index — `Tier 0 Harvest` declares rung 1, so reading the number wrote every
            Harvest row one index below the one its tier actually looks up.

  `RN`      (Skill Gems, Corpses, Oils, Fossils, Essences, Delirium) — N is the HOUSE BAND, not
            our rung. A family whose ladder starts at R2 still declares rung 0 on its top tier.
            No name to resolve, so pair the section's looks in order down the category's live
            tiers and take that tier's rung.

  Currency  the one exception, and the only place the row index IS the band number. See
            BAND_INDEXED_SECTIONS.

⚠️ THE PAIRING IS EVIDENCE, NOT INFERENCE. 17 of the 19 `R` looks land on a tier whose existing
inline style already carries that exact value, independently confirming the order-pairing. The
two that do not (Oils, which carries no inline colours at all) resolve onto tiers that share a
rung with a confirmed neighbour, so every live tier is still covered.

⚠️ TWO LOOKS ON ONE ROW IS REPORTED, NOT RESOLVED. Scarabs and Tainted each author five bands
onto four distinct rungs, so their last band has nowhere to go. The first look wins the row and
the collision is printed — because picking silently is how a ladder loses a rung without anyone
noticing. Both currently render correctly anyway: the affected tiers carry the value inline.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATCH = os.path.join(ROOT, "docs", "design", "handoff", "theme-patch-rev25-2.json")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")
APPLY = "--apply" in sys.argv

# patch section -> our theme_category. Only unambiguous, single-category sections are mapped;
# everything else is reported for a human, never guessed at.
MAP = {
    "Currency": "General",
    "Skill Gems": "Skill Gems",
    "Corpses": "Corpses",
    "Oils": "Oils",
    "Fossils & Resonators": "Fossils",
    "Essences": "Essences",
    "Delirium Orbs": "Delirium Orbs",
    "Harvest": "Harvest",
    "Scarabs": "Scarabs",
    "Tainted Currency": "Tainted Currency",
    # rev 25's authoring pass. Every key in these sections NAMES one of our tiers verbatim
    # (checked against tier_definition), so they resolve by name and never positionally.
    "Trinkets": "Trinkets",
    "Influenced": "Influenced",
    "Heist Experimented": "Heist Experimented",
    "Talismans": "Talismans",
    "Wombgifts": "Wombgifts",
    "Campaign": "Campaign",
    "Class Nets": "Class Nets",
}

# Still no authored values. rev 25 cleared Wombgifts; these five remain deliberately blank
# and the designer's bank values for them collide with shipped colours.
UNAUTHORED = {"Breach Grasping Mail", "Expedition Ward-Bases",
              "Vendor Recipes", "Ritual BaseTypes", "Incursion Vials"}

STYLE = ("TextColor", "BackgroundColor", "BorderColor", "FontSize", "MinimapIcon", "PlayEffect")
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")


def key_num(key):
    """'Tier 3' / 'R3' / 'R2 mid' / 'Tier 1 (T16)' -> 3 / 3 / 2 / 1, else None."""
    m = re.match(r"^(?:Tier|R)\s*(\d+)", key.strip())
    return int(m.group(1)) if m else None


def is_band_key(key):
    """True for the `RN` convention, False for `Tier N`."""
    return re.match(r"^R\s*\d", key.strip()) is not None


def load_live_tiers():
    """theme_category -> [(tier_key, declared_rung)] in authored order, ladder tiers only.

    Hide tiers carry no style at all (Ruthless cannot Hide), so they never take a row.

    ⚠️ NET TIERS ARE KEPT. They used to be dropped here, because a safety net is not part of
    the authored band ladder and must not consume a position when a band list is paired down
    it positionally. But rev 25 AUTHORS net rows by name — `Tier Net Wombgifts`, `Rare Safety
    Net`, and the whole Class Nets category — so dropping them here made those keys resolve to
    nothing. The exclusion belongs at the pairing step, which is the only place it was ever
    about, and it now lives in resolve_rows().
    """
    out = collections.defaultdict(list)
    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            try:
                doc = json.load(io.open(os.path.join(dp, f), encoding="utf-8"))
            except Exception:
                continue
            for cat, body in doc.items():
                if not isinstance(body, dict):
                    continue
                meta = body.get("_meta") or {}
                tcat = meta.get("theme_category") or cat
                order = meta.get("tier_order") or [k for k in body if k != "_meta"]
                for tkey in order:
                    tier = body.get(tkey)
                    if not isinstance(tier, dict) or tier.get("is_hide_tier"):
                        continue
                    out[tcat].append((tkey, (tier.get("theme") or {}).get("Tier")))
    return out


def is_net(tier_key):
    """A safety-net tier — excluded from POSITIONAL band pairing, never from name lookup."""
    return re.search(r"\bNet\b", tier_key) is not None


# The one section where the row index is the BAND number rather than the paired tier's rung.
# Author's decision, 2026-08-10, choosing between two coherent readings of the currency ladder:
# our General category has 9 live tiers and the designer authored 5 bands, and our tiers already
# pair two-per-band (rungs 0,1,1,2,2,3,3,4,4). Keeping the pairing and re-mapping the patch onto
# it — R0→rung 0 … R4→rung 4 — was chosen over stretching the ladder to one rung per tier.
#
# The cost was stated and accepted: `Tier 3 General` and `Tier 4 General` share rung 2, so
# Exalted Orb and Chaos Orb are the same label by construction and no palette edit can separate
# them. Only a re-tier can.
BAND_INDEXED_SECTIONS = {"Currency"}


def resolve_rows(section_keys, section, tcat, live):
    """patch key -> theme row index. See the module docstring for the two conventions.

    Everything but `Currency` resolves the key to the TIER it refers to and then takes that
    tier's declared rung — by name where the key names one (`Tier 0` -> `Tier 0 Harvest`),
    positionally where it names a band (`R2` -> the ladder's first live tier). The number in the
    key is deliberately NOT used as the row index: `Tier 0 Harvest` declares rung 1 and Corpses'
    R2 sits on a tier declaring rung 0, so reading the number is exactly the bug this replaces.

    Returns (mapping, notes). An unresolvable key is left out rather than guessed at.
    """
    mapping, notes = {}, []
    if section in BAND_INDEXED_SECTIONS:
        for k in section_keys:
            n = key_num(k)
            if n is None:
                notes.append((k, "no band number in the key — needs a human"))
            else:
                mapping[k] = n
        return mapping, notes

    ladder = live.get(tcat) or []
    if not ladder:
        notes.append(("*", "no live tiers for theme category %r" % tcat))
        return mapping, notes

    # Positional pairing walks the LADDER only; a safety net is not a band and must not eat a
    # position. Name lookup still sees every live tier, nets included, because rev 25 names
    # them explicitly.
    band_ladder = [(t, r) for t, r in ladder if not is_net(t)]
    pos = 0
    for k in section_keys:
        tkey = rung = None
        if not is_band_key(k):                       # `Tier N` names one of our tiers
            # A trailing parenthetical is the designer's annotation, not part of the name:
            # `Tier 1 Wombgifts (reserved)` names our `Tier 1 Wombgifts`. Try the key as
            # written first so an exact match always wins.
            stems = [k.strip()]
            bare = re.sub(r"\s*\([^)]*\)\s*$", "", k.strip())
            if bare and bare != stems[0]:
                stems.append(bare)
            for stem in stems:
                for name, r in ladder:
                    if name == stem or name.startswith(stem + " "):
                        tkey, rung = name, r
                        break
                if tkey is not None:
                    break
            if tkey is None:
                # A key that names no tier is still resolvable when the category is
                # SINGLE-RUNG — Class Nets' "all Tier 0 net rows" describes six tiers that all
                # declare rung 0, so there is exactly one row it can mean and no guess in it.
                rungs = {r for _, r in ladder if r is not None}
                if len(rungs) == 1:
                    tkey, rung = "%d tiers, all rung %d" % (len(ladder), list(rungs)[0]), list(rungs)[0]
                else:
                    notes.append((k, "names no tier in %r (and it is not single-rung)" % tcat))
                    continue
        else:                                        # `RN` is a band — pair down the ladder
            if pos >= len(band_ladder):
                notes.append((k, "the ladder has only %d live band tiers — nothing left to pair"
                              % len(band_ladder)))
                continue
            tkey, rung = band_ladder[pos]
            pos += 1
        if rung is None:
            notes.append((k, "%s declares no theme.Tier" % tkey))
            continue
        mapping[k] = rung
    return mapping, notes


def clean(node):
    """Only real style keys; the patch also carries note/contrast/examples prose."""
    return collections.OrderedDict(
        (k, node[k]) for k in STYLE if k in node and node[k] is not None)


def modelled_channels(patch):
    """Which style channels this patch has ANY opinion about.

    ★ AN OMITTED KEY ONLY MEANS "REMOVE THIS" FOR A CHANNEL THE PATCH ACTUALLY MODELS.
    rev 25 states an icon floor — icons at R0-R2 only — by DROPPING MinimapIcon from the rows
    below it (33 of 79 rows carry one, 46 do not), so for icons absence is a decision and has
    to be honoured, or the floor silently does nothing.

    `PlayEffect` appears in ZERO of the 79 rows: the kit does not describe beams at all. Read
    naively, "omitted means remove" would therefore strip every beam in the tree — the first
    run of this did exactly that to Wombgifts Tier 3, and would have taken all five map beams
    with it on the inline side. Absence of an opinion is not an opinion.
    """
    out = set()
    for section, body in patch.items():
        if section.startswith("_") or not isinstance(body, dict):
            continue
        for node in body.values():
            if isinstance(node, dict):
                out |= {k for k in STYLE if k in node and node[k] is not None}
    return out


def merge_row(before, vals, modelled):
    """The patch's values, plus anything it has no opinion about, in a stable key order."""
    out = collections.OrderedDict()
    for k in STYLE:
        if k in vals:
            out[k] = vals[k]
        elif before and k in before and k not in modelled:
            out[k] = before[k]
    return out


def main():
    P = json.load(io.open(PATCH, encoding="utf-8"))
    T = json.load(io.open(THEME, encoding="utf-8"),
                  object_pairs_hook=collections.OrderedDict)

    live = load_live_tiers()
    modelled = modelled_channels(P)
    wrote, skipped, unmapped, collisions = [], [], [], []
    for section, body in P.items():
        if section.startswith("_") or not isinstance(body, dict):
            continue
        cat = MAP.get(section)
        if not cat:
            unmapped.append((section, sorted(k for k in body if not k.startswith("_"))))
            continue
        if cat in UNAUTHORED:
            skipped.append((cat, "unauthored — reply 03 says do not generate"))
            continue

        keys = [k for k in body if isinstance(body[k], dict) and not k.startswith("_")]
        rowmap, notes = resolve_rows(keys, section, cat, live)
        for k, why in notes:
            skipped.append(("%s / %s" % (cat, k), why))

        # Two looks resolving onto one row means the ladder cannot express the patch — the
        # later one would silently overwrite the earlier. Report it instead of picking.
        seen = {}
        for key in keys:
            n = rowmap.get(key)
            if n is None:
                continue
            if n in seen:
                collisions.append((cat, "Tier %d" % n, seen[n], key))
                continue
            seen[n] = key
            vals = clean(body[key])
            if not vals:
                continue
            row = "Tier %d" % n
            before = (T.get(cat) or {}).get(row)
            after = merge_row(before, vals, modelled)
            if before == after:
                continue
            T.setdefault(cat, collections.OrderedDict())[row] = after
            wrote.append((cat, row, key, before, after))

    print("=== port rev-25 patch -> theme rows ===")
    print("  rows written : %d" % len(wrote))
    print("  skipped      : %d" % len(skipped))
    print("  row collisions : %d" % len(collisions))
    print("  sections needing a human : %d" % len(unmapped))
    print()
    for cat, row, key, before, vals in wrote:
        print("  %-22s %-8s <- %-18s" % (cat[:22], row, key[:18]))
        print("        was %s" % json.dumps(before, ensure_ascii=False))
        print("        now %s" % json.dumps(vals, ensure_ascii=False))
    if collisions:
        print()
        print("  -- two looks resolved onto one row; the ladder cannot hold both, so the FIRST wins --")
        for cat, row, first, second in collisions:
            print("     %-22s %-8s %r kept, %r dropped" % (cat[:22], row, first, second))
    if skipped:
        print()
        print("  -- skipped --")
        for what, why in skipped:
            print("     %-34s %s" % (what[:34], why))
    if unmapped:
        print()
        print("  -- sections with no single theme category (do these by hand) --")
        for s, keys in unmapped:
            print("     %-28s %s" % (s[:28], ", ".join(keys)[:64]))

    if APPLY:
        io.open(THEME, "w", encoding="utf-8").write(
            json.dumps(T, ensure_ascii=False, indent=2) + "\n")
        print()
        print("written: %s" % os.path.relpath(THEME, ROOT))
    else:
        print()
        print("(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
