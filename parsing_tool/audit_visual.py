# -*- coding: utf-8 -*-
"""Measure the EMITTED filter's two visual failure modes: too small, and too dim.

★ WHY THIS READS THE FILTER AND NOT THE THEME. Size and colour arrive from four layers
(rung recipe -> sharket_theme row -> tier inline `theme` -> rule `overrides`), and every
visual defect this project has found came from layers 2-4 rather than from the recipe.
Auditing the theme file therefore measures what the designer INTENDED; auditing the
emitted filter measures what the player SEES. Only the second one can be wrong in the way
the author is complaining about.

TWO NUMBERS, AND THEY ARE NOT THE SAME COMPLAINT:

  SIZE   `SetFontSize`, always emitted, so this is total coverage. The game clamps to
         18..45; 32 is the generator's fallback when nothing supplies a size, so a 32 is
         usually an ABSENCE of a decision rather than a decision.

  DIM    contrast between text and plate, WCAG relative luminance. Reported straight
         (alpha ignored) because that is the number the earlier sessions quoted and
         because the plate composites over a game world whose brightness we cannot know.
         Alpha is reported SEPARATELY: a low-alpha plate is a different kind of dim -- it
         is not the text/plate pair failing, it is the plate not being there.

⚠️ AN ABSENT `SetTextColor` IS NOT A DEFECT. 441 of 998 theme rows omit it so the RARITY
colour shows through (reference_poe_filter_format). Those blocks have no measurable pair
and are counted apart -- calling them "no contrast" would bury the real rows under 400
false ones.

⚠️ DECORATORS ARE NOT BLOCKS. A `Continue` block sets one channel and hands the item on;
it has no size and no plate of its own. Counting them drags every average down.
"""
import io, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILTER = os.path.join(ROOT, "out", "audit.filter")

SIZE_FLOOR = int(sys.argv[sys.argv.index("--floor") + 1]) if "--floor" in sys.argv else 40
ONLY = sys.argv[sys.argv.index("--category") + 1] if "--category" in sys.argv else None


def lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def rgba(s):
    n = [int(x) for x in s.split()]
    return (n[0], n[1], n[2], n[3] if len(n) > 3 else 255)


def parse(path):
    out, pending, cur = [], None, None
    for ln in io.open(path, encoding="utf-8").read().split("\n"):
        m = re.match(r"^#==\[(\d+)\]-\s*(.*?)\s*==$", ln)
        if m:
            pending = (m.group(1), m.group(2))
            continue
        if re.match(r"^(Show|Hide|Minimal)\b", ln):
            cur = {"id": pending[0] if pending else "?",
                   "label": pending[1] if pending else "(no header)",
                   "cmd": ln.split()[0], "size": None, "text": None, "bg": None,
                   "border": None, "cont": False}
            out.append(cur)
            pending = None
            continue
        if cur is None:
            continue
        s = ln.strip()
        if s == "Continue":
            cur["cont"] = True
        elif s.startswith("SetFontSize"):
            cur["size"] = int(s.split()[1])
        elif s.startswith("SetTextColor"):
            cur["text"] = rgba(s[len("SetTextColor"):])
        elif s.startswith("SetBackgroundColor"):
            cur["bg"] = rgba(s[len("SetBackgroundColor"):])
        elif s.startswith("SetBorderColor"):
            cur["border"] = rgba(s[len("SetBorderColor"):])
    return out


def cat_of(label):
    """'装备 Equipment - 首饰 Jewellery - T2 ...' -> the top-level category."""
    return label.split(" - ")[0].strip()


def main():
    if not os.path.exists(FILTER):
        print("no out/audit.filter -- run:")
        print("  node filter_generation/generate.mjs --mode ruthless --strictness soft "
              "--out out/audit.filter")
        return 2
    blocks = [b for b in parse(FILTER) if not b["cont"]]
    # Ruthless hide blocks carry NO style lines by design (HIDE_CMD is Minimal and a
    # styled hide still draws a label), so they have nothing to measure.
    shown = [b for b in blocks if b["cmd"] == "Show"]
    if ONLY:
        shown = [b for b in shown if ONLY.lower() in b["label"].lower()]

    print("=== visual audit :: %d Show blocks (%d total, %d hide) ==="
          % (len(shown), len(blocks), len(blocks) - len(shown)))
    print()

    # ---------------------------------------------------------------- size
    hist = collections.Counter(b["size"] for b in shown)
    print("--- SetFontSize distribution ---")
    for s in sorted(x for x in hist if x is not None):
        bar = "#" * min(60, hist[s])
        mark = "  <- generator fallback (no size decided anywhere)" if s == 32 else ""
        print("  %2d px  %4d  %s%s" % (s, hist[s], bar, mark))
    small = [b for b in shown if b["size"] is not None and b["size"] < SIZE_FLOOR]
    print()
    print("  below the %dpx floor : %d of %d Show blocks (%.0f%%)"
          % (SIZE_FLOOR, len(small), len(shown), 100.0 * len(small) / max(1, len(shown))))

    by_cat = collections.defaultdict(lambda: [0, 0])
    for b in shown:
        c = by_cat[cat_of(b["label"])]
        c[1] += 1
        if b["size"] is not None and b["size"] < SIZE_FLOOR:
            c[0] += 1
    print()
    print("  worst categories by share under %dpx:" % SIZE_FLOOR)
    for cat, (n, tot) in sorted(by_cat.items(), key=lambda kv: -kv[1][0])[:15]:
        if not n:
            continue
        print("    %-34s %3d/%-3d  %3.0f%%" % (cat[:34], n, tot, 100.0 * n / tot))

    # ------------------------------------------------------------- contrast
    print()
    print("--- contrast (text vs plate) ---")
    pairs, rarity, noplate = [], 0, 0
    for b in shown:
        if b["text"] is None:
            rarity += 1
            continue
        if b["bg"] is None:
            noplate += 1
            continue
        pairs.append((contrast(b["text"], b["bg"]), b))
    pairs.sort(key=lambda p: p[0])
    print("  measurable text/plate pairs   : %d" % len(pairs))
    print("  rarity-painted (no TextColor) : %d   <- by design, not a defect" % rarity)
    print("  text but no plate             : %d" % noplate)
    if pairs:
        bad = [p for p in pairs if p[0] < 3.0]
        weak = [p for p in pairs if 3.0 <= p[0] < 4.5]
        print("  ★ under 3.0:1 (unreadable)    : %d" % len(bad))
        print("    3.0-4.5:1 (thin)            : %d" % len(weak))
        print()
        print("  worst 25:")
        for r, b in pairs[:25]:
            print("    %5.2f:1  %2spx  txt %-16s bg %-16s  %s"
                  % (r, b["size"], " ".join(map(str, b["text"][:3])),
                     " ".join(map(str, b["bg"][:3])), b["label"][:60]))

    # ----------------------------------------------------------- plate alpha
    faint = [b for b in shown if b["bg"] and b["bg"][3] < 200]
    print()
    print("--- plate alpha under 200 (plate barely present) : %d ---" % len(faint))
    for b in sorted(faint, key=lambda x: x["bg"][3])[:12]:
        print("    a=%3d  %s" % (b["bg"][3], b["label"][:66]))

    # ------------------------------------------------- the combined offender
    print()
    print("--- ★ SMALL **AND** DIM (the author's complaint, both at once) ---")
    both = [(r, b) for r, b in pairs
            if b["size"] is not None and b["size"] < SIZE_FLOOR and r < 4.5]
    print("  %d blocks are under %dpx and under 4.5:1" % (len(both), SIZE_FLOOR))
    for r, b in sorted(both, key=lambda p: p[0])[:30]:
        print("    %5.2f:1  %2dpx  %s" % (r, b["size"], b["label"][:66]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
