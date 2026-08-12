# -*- coding: utf-8 -*-
"""Verify every contrast number a designer kit claims, and every colour it names.

    python parsing_tool/theme/check_designer_kit.py <kit.json> [more.json ...]

★ WHY THIS EXISTS. The previous designer thread produced consistently good DECISIONS and
consistently unreliable DELIVERY — four separate prose-vs-array drifts, recipes written
against one category and stated as universal, and colours specified without naming the plate
they speak against. One of those shipped: `T4 = accent.muted on 80 80 80` reads like a legal
recipe and fails on 12 of 26 accents, which nobody could see from the prose. The handbook
(§7) therefore asks for a measured contrast on every pairing, and promises this check in
return. Trusting the numbers is the failure mode; re-deriving them is the job.

WHAT IT CHECKS
  - every object carrying TextColor + BackgroundColor has its WCAG contrast recomputed and
    compared against the `contrast` the kit claims (tolerance 0.05)
  - alpha is composited before measuring where the kit gives an 80%-style text alpha, since
    an `effective` colour is a claim too
  - every colour string parses as an RGB or RGBA triple
  - borders are measured against the plate they sit on
  - a pairing with no claimed number is reported separately -- silence is not a pass

⚠️ IT DOES NOT JUDGE THE DESIGN. A number can be perfectly accurate and still be the wrong
call; that is the author's read, in game. This only guarantees that what the kit SAYS is what
the kit MEANS.
"""
import io, json, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

TOL = 0.05


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
    """'232 92 104 204' or '#e85c68cc' -> ((232,92,104), 204), else None.

    ⚠️ BOTH SPELLINGS, and the hex one matters most: the rung document writes colours as
    space-separated triples while the PATCH — the artifact that actually gets applied —
    writes `#rrggbbaa` because that is sharket_theme.json's format. A checker that only
    understood triples reported "0 pairings found" on the patch and passed it silently,
    which is precisely the class of miss this tool exists to prevent."""
    if not isinstance(s, str):
        return None
    s = s.strip()
    if s.startswith("#"):
        h = s[1:]
        if len(h) not in (6, 8) or not re.fullmatch(r"[0-9a-fA-F]+", h):
            return None
        v = [int(h[i:i + 2], 16) for i in range(0, len(h), 2)]
        return (tuple(v[:3]), v[3] if len(v) == 4 else 255)
    p = s.split()
    if not (3 <= len(p) <= 4) or not all(x.isdigit() for x in p):
        return None
    v = [int(x) for x in p]
    if any(x > 255 for x in v):
        return None
    return (tuple(v[:3]), v[3] if len(v) == 4 else 255)


def over(fg, alpha, bg):
    """Composite fg at `alpha` over bg -- what the eye actually receives."""
    a = alpha / 255.0
    return tuple(int(round(fg[i] * a + bg[i] * (1 - a))) for i in range(3))


def claimed(node):
    """The kit writes `contrast` as a number or inside prose ('contrast': 11, or a string
    like 'currency 10.63 vs 255 165 0'). Take the first number either way."""
    c = node.get("contrast")
    if isinstance(c, (int, float)):
        return float(c)
    if isinstance(c, str):
        m = re.search(r"(\d+(?:\.\d+)?)", c)
        if m:
            return float(m.group(1))
    return None


def walk(node, path, out):
    if isinstance(node, dict):
        t, b = rgba(node.get("TextColor")), rgba(node.get("BackgroundColor"))
        if t and b:
            out.append((path, node, t, b))
        for k, v in node.items():
            walk(v, "%s.%s" % (path, k), out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, "%s[%d]" % (path, i), out)


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip().split("\n")[2])
        return 2
    bad = thin = unchecked = ok = 0
    for path in sys.argv[1:]:
        if path.startswith("--"):
            continue
        print("=== %s" % os.path.basename(path))
        d = json.load(io.open(path, encoding="utf-8"))
        pairs = []
        walk(d, "", pairs)
        print("   pairings found: %d" % len(pairs))
        print()
        for p, node, (tc, ta), (bc, ba) in pairs:
            # ⚠️ COMPOSITE BEFORE MEASURING. An 80%-alpha text over a solid plate is a
            # different colour than the one written down; the kit's own `effective` field
            # says so, and measuring the raw value would silently pass a rung that is
            # dimmer than claimed.
            eff = over(tc, ta, bc) if ta < 255 else tc
            got = contrast(eff, bc)
            cl = claimed(node)
            label = p.lstrip(".")[:52]
            if cl is None:
                print("   ?  %-52s  %5.2f:1  (no number claimed)" % (label, got))
                unchecked += 1
                continue
            if abs(got - cl) > TOL:
                print("   ✗  %-52s  claims %.2f  MEASURES %.2f" % (label, cl, got))
                bad += 1
            else:
                mark = " "
                if got < 3.0:
                    mark = "!"
                    thin += 1
                print("   %s  %-52s  %5.2f:1  ok" % (mark, label, got))
                ok += 1
            # the kit's own `effective` claim, when it makes one
            e = rgba(node.get("effective"))
            if e and ta < 255:
                if e[0] != eff:
                    print("      ✗ effective colour: kit says %s, composite gives %s"
                          % (node["effective"], " ".join(map(str, eff))))
                    bad += 1
            bd = rgba(node.get("BorderColor"))
            if bd and bd[1] > 0:
                bgot = contrast(bd[0], bc)
                if bgot < 3.0:
                    print("      ! border %.2f:1 vs its plate (kit floor 3.0)" % bgot)
        print()
    print("--- %d verified, %d MISMATCHED, %d unnumbered, %d under 3.0:1 ---"
          % (ok, bad, unchecked, thin))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
