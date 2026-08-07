# -*- coding: utf-8 -*-
"""Remove inline tier style that is a COPY of a theme row, keeping real author choices.

⚠️ WHY THIS EXISTS. Inline `tier.theme` style WINS over `sharket_theme.json` — the tier block
owns its look (`resolveTierTheme`, "THE TIER BLOCK OWNS ITS LOOK"). That is correct and
deliberate. The hazard is a stale COPY: while the copy equals the row, nothing is visibly
wrong, so it survives every review. The moment the rung moves, the copy silently vetoes the
move and the block keeps its old look while the theme file says otherwise.

That is not hypothetical. `Curse of the Allflame/Bottles.json` was re-ranked T2 -> T0 on the
author's call; `adopt_compiled_theme` wrote `theme.Tier: 0`, the theme file grew a correct
`Tier 0` row (white plate, allflame's 165 60 0 t0_text) -- and the emitted block did not
change one byte, because the tier still carried a verbatim copy of the old T2 row.

THE TEST: an inline block that exactly equals SOME row of its own category is a copy and is
removed. One that differs from every row is an author decision -- the currency sweep is 30 of
these -- and is never touched. Removing a copy cannot change output: the row it is deleted in
favour of is the value it held.

`PlayAlertSound` is NOT a style key and is never removed: the generator reads it off the tier
directly and it has no theme-row equivalent.
"""
import io, json, os, sys

try:                                   # console is GBK on this box; the report has ⚠️ in it
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket",
                     "sharket_theme.json")
STYLE = {"FontSize", "BackgroundColor", "TextColor", "BorderColor",
         "MinimapIcon", "PlayEffect"}
APPLY = "--apply" in sys.argv


def main():
    theme = json.load(io.open(THEME, encoding="utf-8"))
    cleared, kept, files = [], [], 0
    for dp, dn, fns in os.walk(TD):
        dn[:] = [d for d in dn if not d.startswith("_arch")]
        for fn in sorted(fns):
            if not fn.endswith(".json"):
                continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, TD).replace(os.sep, "/")
            raw = io.open(p, encoding="utf-8").read()
            d = json.loads(raw)
            top = [k for k in d if not k.startswith("//") and isinstance(d[k], dict)]
            if not top:
                continue
            cat = d[top[0]]
            tc = (cat.get("_meta") or {}).get("theme_category") or top[0]
            if tc == "States":
                continue                      # decorators own their look by definition
            rows = theme.get(tc) or {}
            dirty = False
            for k, v in cat.items():
                if k.startswith("_") or not isinstance(v, dict):
                    continue
                th = v.get("theme") or {}
                inline = {x: th[x] for x in STYLE if x in th}
                if not inline:
                    continue
                # ⚠️ THE TIER'S OWN ROW, and nothing else. A first version matched ANY row in
                # the category, which is not a copy test at all — it deletes any inline block
                # that happens to equal some other rung, and that is precisely how an author
                # says "this tier ranks T3 but should LOOK like T2". It reverted six blocks of
                # the currency sweep (`T5:点金石级` carries the T2 plate on a T3 rung, on
                # purpose) plus the Tattoo rule. Matching only `Tier <own>` makes the removal
                # byte-safe by construction: the row it falls back to IS the value deleted.
                own = "Tier %s" % th.get("Tier")
                rv = rows.get(own)
                match = own if (rv is not None
                                and all(rv.get(x) == vv for x, vv in inline.items())
                                and len(inline) == len([x for x in rv if x in STYLE])) else None
                if match:
                    cleared.append((rel, k, th.get("Tier"), match, sorted(inline)))
                    for x in inline:
                        th.pop(x, None)
                    dirty = True
                else:
                    kept.append((rel, k, th.get("Tier")))
            if dirty and APPLY:
                io.open(p, "w", encoding="utf-8").write(
                    json.dumps(d, ensure_ascii=False, indent=2) + "\n")
                files += 1

    print("inline style that COPIES ITS OWN row -> cleared : %d" % len(cleared))
    for rel, k, t, match, keys in cleared:
        print("    %-46s %-30s %s" % (rel, k, match))
    print()
    print("inline style that DIFFERS (author's own) -> kept : %d" % len(kept))
    print()
    print(("wrote %d files" % files) if APPLY else "(dry run -- pass --apply)")


if __name__ == "__main__":
    main()
