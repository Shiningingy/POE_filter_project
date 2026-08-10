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
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATCH = os.path.join(ROOT, "docs", "design", "handoff", "theme-patch-rev23.json")
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
}

# Reply 03 is explicit that these have no authored values yet.
UNAUTHORED = {"Breach Grasping Mail", "Wombgifts", "Expedition Ward-Bases",
              "Vendor Recipes", "Ritual BaseTypes", "Incursion Vials"}

STYLE = ("TextColor", "BackgroundColor", "BorderColor", "FontSize", "MinimapIcon", "PlayEffect")


def rung_of(key):
    """'Tier 3' / 'R3' / 'R2 mid' / 'Tier 1 (T16)' -> 3 / 3 / 2 / 1, else None."""
    m = re.match(r"^(?:Tier|R)\s*(\d+)", key.strip())
    return int(m.group(1)) if m else None


def clean(node):
    """Only real style keys; the patch also carries note/contrast/examples prose."""
    return collections.OrderedDict(
        (k, node[k]) for k in STYLE if k in node and node[k] is not None)


def main():
    P = json.load(io.open(PATCH, encoding="utf-8"))
    T = json.load(io.open(THEME, encoding="utf-8"),
                  object_pairs_hook=collections.OrderedDict)

    wrote, skipped, unmapped = [], [], []
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
        for key, node in body.items():
            if not isinstance(node, dict):
                continue
            n = rung_of(key)
            if n is None:
                skipped.append(("%s / %s" % (cat, key), "no rung in the key — needs a human"))
                continue
            vals = clean(node)
            if not vals:
                continue
            row = "Tier %d" % n
            before = (T.get(cat) or {}).get(row)
            if before == vals:
                continue
            T.setdefault(cat, collections.OrderedDict())[row] = vals
            wrote.append((cat, row, key, before, vals))

    print("=== port rev-23 patch -> theme rows ===")
    print("  rows written : %d" % len(wrote))
    print("  skipped      : %d" % len(skipped))
    print("  sections needing a human : %d" % len(unmapped))
    print()
    for cat, row, key, before, vals in wrote:
        print("  %-22s %-8s <- %-18s" % (cat[:22], row, key[:18]))
        print("        was %s" % json.dumps(before, ensure_ascii=False))
        print("        now %s" % json.dumps(vals, ensure_ascii=False))
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
