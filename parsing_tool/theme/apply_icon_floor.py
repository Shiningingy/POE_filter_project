# -*- coding: utf-8 -*-
"""Drop icons below the kit's floor — the scrolls, the tan band, the common fossils.

    python parsing_tool/theme/apply_icon_floor.py            # review
    python parsing_tool/theme/apply_icon_floor.py --apply    # write

rev 25.2 `icon_floor`: *"Rung-keyed, not category-keyed: icons at R0-R2 only. R3-R5 carry
none."* An icon means "you would cross the screen for this", so a scroll carrying one spends
the minimap's attention on something nobody walks toward.

The 25.2 port applied this to the ROWS. Inline wins over the row and holds its own copies, so
the floor only reached half the tree — the same shape as the border defect in reply 05 Q1.

★ ROW-DRIVEN, NOT RUNG-DRIVEN. "Rung >= 3, delete" is wrong twice over, and both exceptions
are real:

  the kit GRANTS icons below the floor. `Tier 1 Wombgifts` sits at rung 3 and the patch
  authors it `0 Red Star`. The floor is a default, and an authored row outranks it — the same
  relationship reply 19 described as *"icon_floor is a GRANT, not a gate"*.

  the floor reads the PROMISE, not the paint (25.2, answering our jewels question). Jewels
  borrow the rarity-plate grammar so they LOOK rung-4, but they pass the R2 curator test in
  Ruthless — you cross the screen for any jewel — so they keep their Crosses. That grant is
  stated in prose rather than in a row, so it is listed here explicitly.

So: an inline icon at rung >= 3 is dropped only where the row it resolves to has no icon
either. Where the row carries one, the kit means it and the inline copy stays.

⚠️ Does NOT touch shapes. Retired shapes (Circle, UpsideDownHouse, Pentagon) are a separate
pass — apply_icon_shapes.py — and 33 of those are still waiting on a ruling. A block that
keeps its icon here keeps whatever shape it has.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")
APPLY = "--apply" in sys.argv

FLOOR = 3          # R0-R2 carry icons; R3 and below do not
HIDE_RUNG = 9

# Granted in the 25.2 floor text rather than in a row: "jewels ... KEEP their Crosses".
GRANTED_CATEGORIES = {"Jewels"}


def main():
    theme = json.load(io.open(THEME, encoding="utf-8"))
    dropped, kept_row, kept_grant, files = [], [], [], {}

    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            path = os.path.join(dp, f)
            doc = json.load(io.open(path, encoding="utf-8"),
                            object_pairs_hook=collections.OrderedDict)
            touched = False
            for cat, body in doc.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category") or cat
                rows = theme.get(tcat) or {}
                for tkey, tier in body.items():
                    if tkey == "_meta" or not isinstance(tier, dict):
                        continue
                    th = tier.get("theme") or {}
                    icon, rung = th.get("MinimapIcon"), th.get("Tier")
                    if not isinstance(icon, str) or not isinstance(rung, int):
                        continue
                    if rung < FLOOR or rung == HIDE_RUNG:
                        continue
                    if tcat in GRANTED_CATEGORIES:
                        kept_grant.append((tcat, tkey, rung, icon))
                        continue
                    row = rows.get("Tier %d" % rung) or {}
                    if row.get("MinimapIcon"):
                        kept_row.append((tcat, tkey, rung, icon, row["MinimapIcon"]))
                        continue
                    del th["MinimapIcon"]
                    dropped.append((tcat, tkey, rung, icon))
                    touched = True
            if touched:
                files[path] = doc

    print("=== apply the rev-25.2 icon floor (R0-R2 only) ===")
    print("  dropped      : %d   (rung >= %d and the row carries no icon either)" % (len(dropped), FLOOR))
    print("  kept, granted: %d   (category granted below the floor by the kit's prose)" % len(kept_grant))
    print("  kept, row    : %d   (the kit authors an icon at that rung)" % len(kept_row))
    print()
    for tcat, tkey, rung, icon in dropped:
        print("   %-24s %-28s rung=%d  %s" % (tcat[:24], tkey[:28], rung, icon))
    if kept_row:
        print()
        print("  -- kept, the row authors one --")
        for tcat, tkey, rung, icon, rowicon in kept_row:
            print("     %-22s %-26s rung=%d  inline=%-16s row=%s" % (tcat[:22], tkey[:26], rung, icon, rowicon))
    if kept_grant:
        print()
        print("  -- kept, granted by the floor's promise test --")
        for tcat, n in collections.Counter(k[0] for k in kept_grant).most_common():
            print("     %-22s %d tiers" % (tcat, n))

    if APPLY:
        for path, doc in files.items():
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        print()
        print("written: %d files" % len(files))
    else:
        print()
        print("(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
