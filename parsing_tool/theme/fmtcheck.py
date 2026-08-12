"""Format-check a generated .filter against the game truths in reference_poe_filter_format.md.

    python parsing_tool/theme/fmtcheck.py <path.filter> [label]

Every rule here cost a real in-game load to discover — generation, the validator and parity
all passed each one. See reference_poe_filter_format.md.
"""
import re, io, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ⚠️ Match the operator GREEDILY, then look at what follows. `(>=|>)` backtracks to `>` and
# makes `>= 10` look unspaced — that trap has now cost time twice, once corrupting ~700 values
# and once producing 463 phantom findings against a filter that was fine.
OP = re.compile(r"^\s*(\w+)\s+([=!<>]+)(.*)$", re.M)
ICON = re.compile(r"^\s*MinimapIcon\s+(.*)$", re.M)
COLOUR = re.compile(r"^\s*Set\w*Color\s+(.*)$", re.M)
STYLE = re.compile(r"^\s*(Set\w+|PlayEffect|MinimapIcon|PlayAlertSound|CustomAlertSound)", re.M)
SIZE = re.compile(r"^\s*SetFontSize\s+(\d+)", re.M)


def check(path, label):
    txt = io.open(path, encoding="utf-8").read()
    prob = collections.Counter()
    icons, sizes = collections.Counter(), collections.Counter()
    n = nostyle = 0
    for b in re.split(r"(?=^Show|^Hide|^Minimal)", txt, flags=re.M):
        if not re.match(r"^(Show|Hide|Minimal)", b):
            continue
        n += 1
        head = b.split("\n")[0].strip()
        for m in ICON.finditer(b):
            v = m.group(1).strip()
            icons[v] += 1
            p = v.split()
            # a bare `MinimapIcon 1 White` with no shape is the malformed line that costs
            # the whole filter load
            if len(p) != 3 or not p[0].isdigit():
                prob["MALFORMED MinimapIcon: %r" % v] += 1
        for m in COLOUR.finditer(b):
            p = m.group(1).split()
            if len(p) not in (3, 4) or not all(x.isdigit() for x in p):
                prob["bad colour: %r" % m.group(1)] += 1
        for m in OP.finditer(b):
            if m.group(3) and not m.group(3).startswith(" "):
                prob["operator with no space: %s%s%s" % m.groups()] += 1
        # Ruthless cannot Hide — HIDE_CMD is Minimal, which still DRAWS a label, so a hide
        # block must emit no style lines at all
        if head.startswith(("Minimal", "Hide")) and STYLE.search(b):
            prob["Hide/Minimal block with style lines"] += 1
        s = SIZE.search(b)
        if s:
            sizes[int(s.group(1))] += 1
        if head.startswith("Show") and not STYLE.search(b):
            nostyle += 1
    print("=== %s" % label)
    print("   blocks %d   problems %d" % (n, sum(prob.values())))
    for k, v in prob.most_common(10):
        print("      %s  x%d" % (k, v))
    print("   sizes: %s" % sorted(sizes.items()))
    print("   distinct icon values: %d" % len(icons))
    print("   Show blocks with NO style at all: %d" % nostyle)
    return sum(prob.values())


if __name__ == "__main__":
    bad = check(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1])
    sys.exit(1 if bad else 0)
