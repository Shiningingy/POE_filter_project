#!/usr/bin/env python3
# [parsing_tool group B: CAREFUL] Dry-run by default. See parsing_tool/README.md.
"""Port designer rev 29 into sharket_theme.json — the 51 rows whose key is unambiguous.

    python parsing_tool/theme/port_rev29.py            # dry run, prints the diff
    python parsing_tool/theme/port_rev29.py --apply    # writes

★ SCOPE. rev 29 carries 91 style rows. 51 of them key either to a plain rung ("Tier 4", "R2")
or to a literal tier key of ours, and those are ported here. The other 40 are keyed by CONTENT
("R2 瓶中信", "T1 chase", "6-link") and CANNOT be resolved mechanically — a shared row cannot
say two things, so several of them have to be planted inline on a named tier instead. Those
are resolved separately and deliberately are NOT touched by this script.

⚠️ THE THREE PORTING RULES THIS SCRIPT EXISTS TO OBEY — each cost real time when broken:

1. **MERGE, never replace.** Overwriting a row wholesale drops channels the patch does not
   mention. On rev 25 that stripped `PlayEffect: Orange` off a live row, and on rev 28 the
   same mistake was reproduced inside the very script whose docstring warned about it.

2. **An omitted key is a REMOVAL only for a channel the patch MODELS.** rev 25 stated its icon
   floor by dropping `MinimapIcon` from rows beneath it, so absence there was an instruction.
   But `PlayEffect` appeared in zero rows, and reading that absence as intent stripped every
   map beam. So the modelled set is computed FROM the patch, per channel, and a channel the
   patch never mentions anywhere is left alone.

3. **INLINE BEATS THE ROW.** `resolveTierTheme` merges {...row, ...inline}, and 98 tiers carry
   inline theme. A row edit silently fails to reach any tier that sets the same channel
   inline. This script reports every such shadowed edit rather than pretending it landed.
"""
import argparse
import collections
import glob
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ggpk'))
from jsonio import read_json, write_json  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATCH = os.path.join(ROOT, 'docs', 'design', 'handoff', 'theme-patch-rev29.json')
THEME = os.path.join(ROOT, 'filter_generation', 'data', 'theme', 'sharket', 'sharket_theme.json')
TIERS = os.path.join(ROOT, 'filter_generation', 'data', 'tier_definition')

STYLE = ('FontSize', 'TextColor', 'BackgroundColor', 'BorderColor',
         'PlayEffect', 'MinimapIcon', 'PlayAlertSound')

# rev 29 category name -> our theme category. Only where the two genuinely differ.
CATMAP = {
    'Fossils & Resonators': 'Fossils',
    'Jewels (normal & abyss)': 'Jewels',
}


def our_tiers():
    """theme category -> {tier key: rung}, straight from the tier definitions."""
    out = collections.defaultdict(dict)
    inline = collections.defaultdict(dict)      # (cat, rung) -> {channel: [tier keys]}
    for tf in sorted(glob.glob(os.path.join(TIERS, '**', '*.json'), recursive=True)):
        doc = json.load(io.open(tf, encoding='utf-8'))
        ck = next((k for k in doc if not k.startswith('//')), None)
        if not ck:
            continue
        cat = doc[ck]
        key = (cat.get('_meta') or {}).get('theme_category') or ck
        for tk, tv in cat.items():
            if tk == '_meta' or not isinstance(tv, dict):
                continue
            th = tv.get('theme') or {}
            rung = th.get('Tier')
            if rung is None:
                m = re.search(r'Tier\s+(\d+)', tk)
                rung = int(m.group(1)) if m else (9 if 'Hide' in tk else 99)
            out[key][tk] = rung
            for ch in STYLE:
                if ch in th:
                    inline[(key, rung)].setdefault(ch, []).append(tk)
    return out, inline


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    patch = json.load(io.open(PATCH, encoding='utf-8'))
    theme, style = read_json(THEME)
    tiers, inline = our_tiers()

    # ---- rule 2: which channels does this patch actually MODEL? ------------------
    modelled = set()
    for c, rows in patch.items():
        if c.startswith('_'):
            continue
        for k, v in rows.items():
            if isinstance(v, dict):
                modelled |= {ch for ch in v if ch in STYLE}
    print('channels the patch MODELS: %s' % ', '.join(sorted(modelled)))
    print('channels it never mentions (left untouched): %s'
          % (', '.join(sorted(set(STYLE) - modelled)) or 'none'))
    print()

    edits, skipped, shadowed = [], [], []
    for c, rows in patch.items():
        if c.startswith('_'):
            continue
        mine = CATMAP.get(c, c)
        for k, v in rows.items():
            if not isinstance(v, dict):
                continue
            vals = {ch: val for ch, val in v.items() if ch in STYLE}
            if not vals:
                continue

            # Which of our rows does this key address?
            m = re.fullmatch(r'(?:Tier |R)(\d+)', k)
            if m:
                rung = int(m.group(1))
            elif mine in tiers and k in tiers[mine]:
                rung = tiers[mine][k]          # designer keyed one of OUR tier names
            else:
                skipped.append((c, k))          # content-keyed: resolved separately
                continue

            row_key = 'Tier %d' % rung
            cur = (theme.get(mine) or {}).get(row_key)
            if cur is None:
                skipped.append((c, '%s -> no row %s in our theme' % (k, row_key)))
                continue

            # rule 3: does an inline value shadow this edit?
            for ch in vals:
                sh = (inline.get((mine, rung)) or {}).get(ch)
                if sh:
                    shadowed.append((mine, row_key, ch, sh))

            delta = {ch: val for ch, val in vals.items() if cur.get(ch) != val}
            if delta:
                edits.append((mine, row_key, delta, dict(cur)))

    print('=' * 78)
    print('EDITS — %d rows change' % len(edits))
    print('=' * 78)
    for cat, rk, delta, cur in sorted(edits):
        print('  %-26s %-9s' % (cat, rk))
        for ch, val in delta.items():
            print('       %-16s %-22s -> %s' % (ch, cur.get(ch, '(absent)'), val))

    if shadowed:
        print()
        print('=' * 78)
        print('⚠️  SHADOWED BY INLINE — %d row edits an inline tier value will beat' % len(shadowed))
        print('   The row changes, but these tiers keep their own value. Not a bug; a limit.')
        print('=' * 78)
        for cat, rk, ch, tks in sorted(shadowed):
            print('  %-26s %-9s %-14s <- inline on: %s' % (cat, rk, ch, ', '.join(tks)[:52]))

    print()
    print('%d content-keyed rows deliberately NOT ported here (resolved separately)' % len(skipped))

    if a.apply:
        for cat, rk, delta, _ in edits:
            theme[cat][rk].update(delta)        # rule 1: MERGE
        write_json(THEME, theme, style)
        print()
        print('APPLIED %d row edits to %s' % (len(edits), os.path.relpath(THEME, ROOT)))
    else:
        print()
        print('(dry run — pass --apply to write)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
