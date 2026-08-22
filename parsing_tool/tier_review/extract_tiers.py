"""Extract the live tier ladder (theme key -> tiers -> label + current style) for review.

Usage:  python extract_tiers.py [trace.json ...]

Pass a trace from `node filter_generation/generate.mjs --trace <path>` and each tier also
reports whether it actually EMITTED a block. That matters more than it sounds: a tier can
carry zero mapped bases and still be live, because it matches by CONDITION
(`ItemLevel >= 86`). 52 of the 60 Tier-0 tiers are exactly that shape, so an item count
alone reads them as dead and invites deleting live content.
"""
import json, glob, os, collections, sys

DATA = 'filter_generation/data'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tier_review_data.json')

# (file, tier key) -> blocks emitted, from any traces passed on the command line
emitted = collections.Counter()
# ★ What each tier ACTUALLY draws, read from the emitted block text rather than the theme
# row. The row is not the answer: an inline tier `theme` beats it, and a per-item
# `item_overrides` card can add a sound the row never mentions. For an icon review that
# distinction is the whole point — the question "does this tier draw an icon?" has to be
# answered from what came out, not from what was authored.
emit_icons = collections.defaultdict(set)   # (file, tier key) -> {"1 Yellow Diamond", ...}
emit_sound = collections.defaultdict(bool)  # (file, tier key) -> any block plays something
emit_hide = collections.defaultdict(bool)   # (file, tier key) -> emitted as Hide/Minimal
trace_modes = []
for tp in sys.argv[1:]:
    with open(tp, encoding='utf-8') as fh:
        tr = json.load(fh)
    for b in tr.get('blocks', []):
        k = (b.get('file'), b.get('tier_key'))
        emitted[k] += 1
        if b.get('is_hide'):
            emit_hide[k] = True
        for ln in (b.get('text') or '').split('\n'):
            s = ln.strip()
            if s.startswith('MinimapIcon'):
                emit_icons[k].add(s[len('MinimapIcon'):].strip())
            elif 'AlertSound' in s:
                emit_sound[k] = True
    m = tr.get('meta') or {}
    trace_modes.append(m.get('mode') or os.path.basename(tp))


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def topkey(d):
    for k in d:
        if not k.startswith('//'):
            return k
    return None


theme = load(os.path.join(DATA, 'theme', 'sharket', 'sharket_theme.json'))

# theme key -> tier key -> {label_en, label_ch, files[], hide}
tiers = collections.defaultdict(dict)
files_of = collections.defaultdict(set)
item_counts = collections.Counter()   # (theme key, tier key) -> mapped item count
rule_counts = collections.Counter()   # (theme key, tier key) -> rules aiming at it

for tf in sorted(glob.glob(os.path.join(DATA, 'tier_definition', '**', '*.json'), recursive=True)):
    rel = os.path.relpath(tf, os.path.join(DATA, 'tier_definition')).replace(os.sep, '/')
    doc = load(tf)
    ck = topkey(doc)
    if not ck:
        continue
    cat = doc[ck]
    meta = cat.get('_meta') or {}
    key = meta.get('theme_category') or ck
    files_of[key].add(rel)

    # how many curated items land in each tier of this file
    mf = os.path.join(DATA, 'base_mapping', rel.replace('/', os.sep))
    if os.path.exists(mf):
        mdoc = load(mf)
        for base, tk in (mdoc.get('mapping') or {}).items():
            for t in (tk if isinstance(tk, list) else [tk]):
                item_counts[(key, t)] += 1
        # rules can target a tier directly, which is a third way to be live
        for r in (mdoc.get('rules') or []):
            ov = (r.get('overrides') or {}).get('Tier')
            for t in ([ov] if isinstance(ov, str) else (ov or [])):
                rule_counts[(key, t)] += 1

    for tk, tv in cat.items():
        if tk == '_meta' or not isinstance(tv, dict):
            continue
        loc = tv.get('localization') or {}
        num = (tv.get('theme') or {}).get('Tier')
        row = tiers[key].setdefault(tk, {
            'tier': tk, 'num': num, 'en': '', 'ch': '',
            'hide': bool(tv.get('is_hide_tier')), 'files': [],
            'conds': 0, 'classCond': False, 'emits': 0, 'rules': 0,
            'drawnIcons': [], 'hasSound': False,
        })
        # How this tier can match, beyond its mapped bases.
        row['conds'] = max(row['conds'], len(tv.get('conditions') or {}))
        if tv.get('class_condition'):
            row['classCond'] = True
        row['emits'] += emitted.get((rel, tk), 0)
        for ic in emit_icons.get((rel, tk), ()):
            if ic not in row['drawnIcons']:
                row['drawnIcons'].append(ic)
        if emit_sound.get((rel, tk)):
            row['hasSound'] = True
        if emit_hide.get((rel, tk)):
            row['hide'] = True
        if loc.get('en') and not row['en']:
            row['en'] = loc['en']
        if loc.get('ch') and not row['ch']:
            row['ch'] = loc['ch']
        if num is not None and row['num'] is None:
            row['num'] = num
        if tv.get('is_hide_tier'):
            row['hide'] = True
        if rel not in row['files']:
            row['files'].append(rel)

STYLE_KEYS = ('FontSize', 'TextColor', 'BackgroundColor', 'BorderColor',
              'PlayEffect', 'MinimapIcon', 'PlayAlertSound')


def tier_num(tk, fallback):
    if fallback is not None:
        return fallback
    if 'Tier 0' in tk:
        return 0
    if 'Hide' in tk:
        return 9
    import re
    m = re.search(r'Tier\s+(\d+)', tk)
    return int(m.group(1)) if m else 99


cats = []
all_keys = sorted(set(list(tiers.keys()) + [k for k in theme if not k.startswith('//')]))
for key in all_keys:
    themed = theme.get(key) or {}
    rows = []
    claimed = set()          # theme-row NUMBERS a tier definition actually resolves to
    for tk, row in tiers.get(key, {}).items():
        num = tier_num(tk, row['num'])
        # ★ Resolve exactly as filterStyle.resolveTierTheme does: by tier NUMBER, not by
        # key. A tier called "Chancing Normal" with theme.Tier = 2 wears row "Tier 2".
        # Matching on the key instead showed real curated tiers as unstyled and their
        # actual styles as orphan rows - wrong in both directions.
        claimed.add(num)
        style = {k: v for k, v in (themed.get(f'Tier {num}') or {}).items() if k in STYLE_KEYS}
        rows.append({**row, 'num': num, 'style': style,
                     'items': item_counts.get((key, tk), 0),
                     'rules': rule_counts.get((key, tk), 0),
                     'row': f'Tier {num}', 'inTheme': f'Tier {num}' in themed})
    # theme rows no tier definition resolves to - styling that can never be seen
    for tk, tv in themed.items():
        if not isinstance(tv, dict):
            continue
        n = tier_num(tk, None)
        if n in claimed:
            continue
        rows.append({'tier': tk, 'num': n, 'en': '', 'ch': '',
                     'hide': False, 'files': [], 'items': 0, 'rules': 0,
                     'conds': 0, 'classCond': False, 'emits': 0,
                     'drawnIcons': [], 'hasSound': False,
                     'inTheme': True, 'row': tk,
                     'style': {k: v for k, v in tv.items() if k in STYLE_KEYS},
                     'orphanRow': True})
    rows.sort(key=lambda r: (r['num'], r['tier']))
    cats.append({
        'key': key,
        'files': sorted(files_of.get(key, [])),
        'live': bool(tiers.get(key)),      # False = theme row nothing resolves to
        'tiers': rows,
    })

cats.sort(key=lambda c: (not c['live'], c['key']))

# ---- the editor's own navigation, so the rail here matches the app the user knows ----
# chapter separator -> group -> optional subgroup -> leaf. A leaf's theme key comes from
# its tier definition (filterStyle.resolveThemeKey), never from the nav itself.
key_of_file = {}
for c in cats:
    for rel in c['files']:
        key_of_file[rel] = c['key']

nav = []
struct = load(os.path.join(DATA, 'category_structure.json'))


def leaf_of(f):
    tp = (f.get('tier_path') or '')[len('tier_definition/'):]
    return {'en': (f.get('localization') or {}).get('en', '?'),
            'ch': (f.get('localization') or {}).get('ch', ''),
            'key': key_of_file.get(tp, ''), 'path': tp}


def group_of(g):
    loc = (g.get('_meta') or {}).get('localization') or {}
    return {'en': loc.get('en', '?'), 'ch': loc.get('ch', ''),
            'leaves': [leaf_of(f) for f in g.get('files', [])],
            'subgroups': [group_of(s) for s in g.get('subgroups', [])]}


for g in struct.get('categories', []):
    if 'separator' in g:
        nav.append({'separator': g['separator'].get('en', ''),
                    'separator_ch': g['separator'].get('ch', '')})
    else:
        nav.append(group_of(g))

navkeys = set()
for g in nav:
    stack = [g] if 'separator' not in g else []
    while stack:
        cur = stack.pop()
        for lf in cur.get('leaves', []):
            if lf['key']:
                navkeys.add(lf['key'])
        stack.extend(cur.get('subgroups', []))

out = {'categories': cats, 'nav': nav,
       'unnavigated': sorted(c['key'] for c in cats if c['key'] not in navkeys),
       'traced': bool(trace_modes), 'traceModes': trace_modes,
       'totals': {'categories': len(cats),
                  'live': sum(1 for c in cats if c['live']),
                  'tiers': sum(len(c['tiers']) for c in cats),
                  'silent': sum(1 for c in cats for t in c['tiers']
                                if not t.get('orphanRow') and not t.get('hide')
                                and not t.get('emits')) if trace_modes else None}}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(json.dumps(out['totals'], indent=2))
print('bytes:', os.path.getsize(OUT))
