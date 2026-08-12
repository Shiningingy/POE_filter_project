# -*- coding: utf-8 -*-
"""Hand a tier's colour back to its rung, by clearing the stale inline snapshot.

    python parsing_tool/theme/clear_stale_inline.py Currency/General.json
    python parsing_tool/theme/clear_stale_inline.py Currency/General.json --apply

★ WHY THIS EXISTS. The model is: a block authors its RUNG, the theme supplies the look for
that rung, and inline style is for genuine per-block exceptions. But `reseed_tier_styles.py`
(since retired) had pre-filled every block's inline with a SNAPSHOT of its fully-resolved
style, and inline WINS over the row -- so 398 of 421 blocks carried a copy of the answer.

That was harmless while the copy matched. **The re-tier broke it**: rungs moved, the snapshots
did not follow, and each block kept the look of the rung it used to be on. The rung became
decorative. Author, from game: *"chaos orb is the same as alteration orb"* -- `Tier 4 General`
(rung 2) and `Tier 6 General` (rung 3) both still carry `#aa9e82`, the tan from the old
nine-tier scale, differing only in alpha.

`apply_compiled.py` does this same clear, but only as part of applying the COMPILED theme --
which the author rejected ("a visual disaster") in favour of the Sharket copy. This does the
clear alone, against whatever theme is live.

WHAT IS PRESERVED, and why each one matters:

  PlayAlertSound      NOT a style channel. The generator reads `tier.theme.PlayAlertSound`
                      above `sound.sharket_sound_id`; clearing it would silently retune the
                      sound of a fifth of the tree.
  Tier                the rung itself -- the thing we are handing control back TO.
  disabled: / inherit / default
                      omit-SENTINELS, not colours. `Tier 8 General` disables its plate and
                      text on purpose so the game paints the label; dropping the sentinel
                      would let the row paint over an authored silence.
  FontSize, PlayEffect, MinimapIcon
                      left alone BY DEFAULT (`--colours-only`, the default). Size is the
                      author's axis and is hand-tuned -- *"i will tune the size and you will
                      check the theme"* -- so a blanket clear would destroy that work. Pass
                      `--all-channels` to hand those back too.

⚠️ A CLEARED CHANNEL MUST HAVE A ROW TO FALL BACK TO. `theme[cat]["Tier N"]` falls back to
`{}`, never to Default, so clearing a channel whose rung has no row emits a bare label. This
refuses to clear in that case and says so.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")

COLOURS = ["TextColor", "BorderColor", "BackgroundColor"]
EXTRAS = ["FontSize", "PlayEffect", "MinimapIcon"]
KEEP = {"Tier", "PlayAlertSound"}


def sentinel(v):
    return v is None or (isinstance(v, str) and
                         (v.startswith("disabled:") or v in ("inherit", "default")))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply_ = "--apply" in sys.argv
    channels = COLOURS + (EXTRAS if "--all-channels" in sys.argv else [])
    if not args:
        print(__doc__.strip().split("\n")[2].strip())
        return 2

    rel = args[0].replace("\\", "/")
    path = os.path.join(TD, *rel.split("/"))
    if not os.path.exists(path):
        print("no such tier file: %s" % path)
        return 2

    T = json.load(io.open(THEME, encoding="utf-8"))
    d = json.load(io.open(path, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)

    cleared, kept, blocked = [], [], []
    for cat, body in d.items():
        if not isinstance(body, dict):
            continue
        tcat = (body.get("_meta") or {}).get("theme_category") or cat
        # ⚠️ NEVER VIA `Default`. This read `T[tcat] or T["Default"]`, so a category with no
        # rows of its own had its inline cleared and was handed DEFAULT's colours. That is
        # what the author saw as "the voyage chart also fallback to general". A category
        # without its own rows has NOTHING to hand control back to, so there is nothing safe
        # to clear — say so and stop, rather than substituting another family's ladder.
        rows = T.get(tcat)
        if rows is None:
            print("=== %s ===" % rel)
            print("  ★ theme category %r has NO rows of its own." % tcat)
            print("     Clearing would hand every block to `Default` — a different family's")
            print("     ladder. Give the category rows first, then re-run.")
            return 2
        for tier, node in body.items():
            if tier == "_meta" or not isinstance(node, dict):
                continue
            th = node.get("theme")
            if not isinstance(th, dict):
                continue
            row = rows.get("Tier %s" % th.get("Tier")) or {}
            for ch in list(th):
                if ch in KEEP or ch not in channels:
                    continue
                v = th[ch]
                if sentinel(v):
                    kept.append((tier, ch, "sentinel — authored silence"))
                    continue
                if ch not in row:
                    # Not necessarily wrong — an absent channel means "let the game paint it",
                    # which for a border means no border at all. But it is a CHANGE the rung
                    # cannot express, so refuse and report rather than silently drop it.
                    blocked.append((tier, ch, "rung %s supplies no %s — clearing would DROP "
                                    "the channel, not re-derive it" % (th.get("Tier"), ch)))
                    continue
                cleared.append((tier, ch, v, row[ch], v == row[ch]))
                if apply_:
                    del th[ch]

    print("=== %s ===" % rel)
    print("  cleared : %d   (%d were already identical to the row — pure redundancy)"
          % (len(cleared), sum(1 for c in cleared if c[4])))
    print("  kept    : %d sentinels" % len(kept))
    print("  blocked : %d (no row to fall back to)" % len(blocked))
    print()
    print("  %-20s %-16s %-22s %-22s" % ("tier", "channel", "inline was", "rung now supplies"))
    print("  " + "-" * 84)
    for tier, ch, was, now, same in cleared:
        print("  %-20s %-16s %-22s %-22s %s"
              % (tier[:20], ch, str(was)[:22], str(now)[:22], "" if not same else "(same)"))
    for tier, ch, why in kept + blocked:
        print("  %-20s %-16s %s" % (tier[:20], ch, why))

    if apply_:
        io.open(path, "w", encoding="utf-8").write(
            json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        print()
        print("written: %s" % rel)
    else:
        print()
        print("(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
