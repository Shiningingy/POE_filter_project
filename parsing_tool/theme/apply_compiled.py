"""Apply the compiled theme to the tree — the re-rank and the inline-style clear, together.

Run `compile_theme.py` first; this consumes its two side files.

    python parsing_tool/theme/apply_compiled.py --dry-run    # report only (default)
    python parsing_tool/theme/apply_compiled.py --apply      # write

## Why it clears inline styles rather than overwriting them

Workstream B made the tier block own its look, and `reseed_tier_styles.py` then wrote every
block's fully-resolved style inline — so today 398 of 421 blocks carry an inline style that
WINS over the theme row, and the theme file is very nearly dead weight.

Measured before touching anything: **377 of those inline styles are byte-identical to the
theme row they came from** — redundant snapshots, not authoring. Clearing them changes nothing
and hands the channel back to the theme file, which is what makes the designer's model work:
a block authors its RUNG, the category supplies its ACCENT, and the look derives from the two.
Inline stays available as the per-block override; it is simply no longer pre-filled with a
copy of the answer.

⚠️ **21 blocks DID differ** and those values are dropped. Nearly all are `MinimapIcon` lines
the theme row never supplied — deliberate per-block icons, now superseded by the recipe, where
icons derive from `icon_floor` + rung. They are listed in the report; read it.

⚠️ **`PlayAlertSound` is NOT a style channel** and is preserved. 53 blocks carry one, and the
generator reads it (`tier.theme.PlayAlertSound` sits above `sound.sharket_sound_id` in the
sound chain). Clearing it would silently retune the sound of a fifth of the tree.
"""
import json, io, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, "filter_generation", "data")
TD = os.path.join(DATA, "tier_definition")
THEME_DIR = os.path.join(DATA, "theme", "sharket")

STYLE_CHANNELS = ["FontSize", "TextColor", "BorderColor", "BackgroundColor",
                  "PlayEffect", "MinimapIcon"]
KEEP = {"Tier", "PlayAlertSound"}          # ⚠️ PlayAlertSound is sound, not style

# ⚠️ A DECORATOR'S INLINE STYLE *IS* THE DECORATOR. It has no theme row to fall back to — it
# states the one channel it layers and nothing else, then `Continue`. Clearing it leaves a
# bare `Continue` that changes nothing, which the validator correctly calls an error. Caught
# on the first apply; excluded here so it cannot happen again.
SKIP_DIRS = ("_decorators/",)

APPLY = "--apply" in sys.argv


def load(p):
    with io.open(p, encoding="utf-8") as f:
        return json.load(f, object_pairs_hook=collections.OrderedDict)


def main():
    rr_path = os.path.join(THEME_DIR, "rerank.compiled.json")
    tc_path = os.path.join(THEME_DIR, "sharket_theme.compiled.json")
    for p in (rr_path, tc_path):
        if not os.path.exists(p):
            print("missing %s — run compile_theme.py first" % p)
            return 1

    rerank = json.load(io.open(rr_path, encoding="utf-8"))
    by_block = {(r["file"], r["tier_key"]): r for r in rerank}

    changed_tier = cleared = kept_sound = untouched = 0
    dropped = []
    files_touched = set()

    for dp, dn, fns in os.walk(TD):
        dn[:] = [d for d in dn if not d.startswith("_arch")]
        for fn in sorted(fns):
            if not fn.endswith(".json"):
                continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, TD).replace(os.sep, "/")
            if any(rel.startswith(d) for d in SKIP_DIRS):
                continue
            doc = load(p)
            top = [k for k in doc if not k.startswith("//") and isinstance(doc[k], dict)]
            if not top:
                continue
            cat = doc[top[0]]
            dirty = False
            for tk, tv in cat.items():
                if tk.startswith("_") or not isinstance(tv, dict):
                    continue
                theme = tv.get("theme")
                if not isinstance(theme, dict):
                    continue
                rk = by_block.get((rel, tk))
                if rk is not None and theme.get("Tier") != rk["Tier"]:
                    theme["Tier"] = rk["Tier"]
                    changed_tier += 1
                    dirty = True
                stated = [k for k in STYLE_CHANNELS if theme.get(k) is not None]
                if stated:
                    for k in stated:
                        del theme[k]
                    cleared += 1
                    dirty = True
                if theme.get("PlayAlertSound") is not None:
                    kept_sound += 1
                if not stated and rk is None:
                    untouched += 1
                # order the survivors predictably
                for k in list(theme):
                    if k not in KEEP:
                        dropped.append((rel, tk, k))
            if dirty:
                files_touched.add(rel)
                if APPLY:
                    io.open(p, "w", encoding="utf-8").write(
                        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

    print("%s" % ("APPLIED" if APPLY else "DRY RUN — nothing written (pass --apply)"))
    print("  tier blocks re-ranked (theme.Tier set) : %d" % changed_tier)
    print("  tier blocks with inline style cleared  : %d" % cleared)
    print("  PlayAlertSound values PRESERVED        : %d" % kept_sound)
    print("  files touched                          : %d" % len(files_touched))
    if dropped:
        print("  ⚠️ non-style keys left in inline theme  : %s"
              % collections.Counter(k for _, _, k in dropped).most_common())

    if APPLY:
        # The theme file becomes authoritative again, so it has to land in the same change.
        dest = os.path.join(THEME_DIR, "sharket_theme.json")
        compiled = io.open(tc_path, encoding="utf-8").read()
        io.open(dest, "w", encoding="utf-8").write(compiled)
        print("  wrote %s from the compiled side file" % os.path.relpath(dest, ROOT))
    else:
        print("  (would also copy sharket_theme.compiled.json -> sharket_theme.json)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
