# -*- coding: utf-8 -*-
"""Put MinimapIcon sizes the right way up, everywhere.

    python parsing_tool/theme/fix_icon_sizes.py           # audit, before/after
    python parsing_tool/theme/fix_icon_sizes.py --apply   # write

★ THE BUG. `MinimapIconPicker` labelled size 0 "small" and size 2 "large", but in PoE **0 is
the LARGEST icon**. Every icon chosen through the editor therefore came out upside down:
chase tiers got the smallest icon and safety nets the biggest. The picker is fixed; this
fixes the data it wrote, including from earlier sessions.

Two independent sources give the same direction, which is why this is not a judgement call:

  - FilterBlade's RUTHLESS filter puts `0 Red Star` on its chase unique tiers (ex6link,
    exforgesword, 3xabyss) and `2 Brown Star` on its quiet ones (hideable, earlyleague).
    Across the whole file, size 0 appears only at font 45; its font-35 blocks use size 2.
  - The designer kit's icon ladder: "Size from the rung (0 at T0/T1, 1 at T2, 2 at T3) ...
    A white map gets the smallest icon", white maps being T3.

⚠️ IT DERIVES FROM THE RUNG RATHER THAN SWAPPING 0 AND 2. A blanket swap would have been
wrong in both directions at once: icons written through the picker are inverted, but icons
that came from the designer compile were already correct, and nothing in the file says which
is which. Deriving `size = f(rung)` lands both on the same correct answer and is idempotent,
so this can be re-run after any future authoring pass without doing damage.

⚠️ COLOUR AND SHAPE ARE NEVER TOUCHED. The author's `Red -> Yellow -> White` ladder already
matches FilterBlade's convention exactly; only the size digit was ever wrong.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
BM = os.path.join(ROOT, "filter_generation", "data", "base_mapping")
APPLY = "--apply" in sys.argv


def size_for(rung):
    """The kit's ladder: 0 at T0/T1, 1 at T2, 2 at T3 and below.

    A rung we cannot read (a tier whose `theme.Tier` is missing, or one of the free-form
    keys like `Other` that parse to 99) is treated as the quiet end, which is where those
    tiers actually sit — `Other`, `Rare Safety Net` and the class nets are all bottom rungs."""
    if rung is None:
        return 2
    if rung <= 1:
        return 0
    if rung == 2:
        return 1
    return 2


def walk(root, rows):
    for dp, _dirs, fs in os.walk(root):
        for fn in sorted(fs):
            if not fn.endswith(".json"):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, root).replace(os.sep, "/")
            try:
                d = json.load(io.open(path, encoding="utf-8"),
                              object_pairs_hook=collections.OrderedDict)
            except Exception:
                continue
            yield path, rel, d


def main():
    changes, kept = [], 0

    # ---- tier definitions: theme.MinimapIcon and item_overrides.*.MinimapIcon
    for path, rel, d in walk(TD, None):
        dirty = False
        for cat, body in d.items():
            if not isinstance(body, dict):
                continue
            for tier, node in body.items():
                if tier == "_meta" or not isinstance(node, dict):
                    continue
                th = node.get("theme")
                if not isinstance(th, dict):
                    continue
                rung = th.get("Tier")
                for holder, label in [(th, tier)] + [
                        (v, "%s / card %s" % (tier, k))
                        for k, v in (node.get("item_overrides") or {}).items()
                        if isinstance(v, dict)]:
                    icon = holder.get("MinimapIcon")
                    if not isinstance(icon, str):
                        continue
                    parts = icon.split()
                    if len(parts) != 3 or not parts[0].isdigit():
                        continue
                    want = str(size_for(rung))
                    if parts[0] == want:
                        kept += 1
                        continue
                    new = " ".join([want] + parts[1:])
                    holder["MinimapIcon"] = new
                    changes.append((rel, label, rung, icon, new))
                    dirty = True
        if dirty and APPLY:
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(d, ensure_ascii=False, indent=2) + "\n")

    # ---- base_mapping: rule overrides carry icons too, and a rule override BEATS the tier
    # A rule has no rung of its own — it inherits the tier named in `overrides.Tier`, so the
    # rung is resolved from the tier definitions before deciding. Worth doing rather than
    # reporting: both live cases are `T17 Maps` and `Valdo Maps` pointing at
    # `Tier 0 Base Maps`, i.e. the two highest-value maps in the game wearing the SMALLEST
    # icon.
    rung_of = {}
    for _p, _r, td in walk(TD, None):
        for cat, body in td.items():
            if not isinstance(body, dict):
                continue
            for tier, node in body.items():
                if tier != "_meta" and isinstance(node, dict):
                    rung_of[tier] = (node.get("theme") or {}).get("Tier")

    for path, rel, d in walk(BM, None):
        if not isinstance(d, dict):
            continue
        dirty = False
        for rule in (d.get("rules") or []):
            ov = rule.get("overrides")
            if not isinstance(ov, dict):
                continue
            icon = ov.get("MinimapIcon")
            if not isinstance(icon, str):
                continue
            parts = icon.split()
            if len(parts) != 3 or not parts[0].isdigit():
                continue
            tier = ov.get("Tier")
            if tier not in rung_of:
                changes.append((("base_mapping/" + rel), "rule: %s" % rule.get("comment"),
                                "?", icon, "-- unresolved tier, not changed"))
                continue
            want = str(size_for(rung_of[tier]))
            if parts[0] == want:
                kept += 1
                continue
            new = " ".join([want] + parts[1:])
            ov["MinimapIcon"] = new
            changes.append((("base_mapping/" + rel), "rule: %s" % rule.get("comment"),
                            rung_of[tier], icon, new))
            dirty = True
        if dirty and APPLY:
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(d, ensure_ascii=False, indent=2) + "\n")

    fixed = [c for c in changes if not str(c[4]).startswith("--")]
    print("=== minimap icon sizes ===")
    print("  icons already correct : %d" % kept)
    print("  icons corrected       : %d" % len(fixed))
    print("  rule icons (reported) : %d" % (len(changes) - len(fixed)))
    print()
    print("  ladder applied: rung 0/1 -> size 0 (largest), rung 2 -> 1, rung 3+ -> 2")
    print()
    by = collections.Counter((c[3].split()[0], c[4].split()[0]) for c in fixed)
    print("  size moves: %s" % ", ".join("%s->%s x%d" % (a, b, n)
                                         for (a, b), n in sorted(by.items())))
    print()
    for rel, tier, rung, old, new in changes:
        print("  %-38s %-26s rung %-4s %-22s -> %s"
              % (rel[:38], str(tier)[:26], rung, old, new))
    if APPLY:
        print()
        print("written")
    else:
        print()
        print("(audit only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
