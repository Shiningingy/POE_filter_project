"""Expand the designer's recipe for currency + essences and diff against their goldens.

Their instruction: "Implement the transforms in rung_recipes, expand these two accents, and
compare. Pure function, no I/O." This is that check, and it also tells us exactly which
transform verbs the handoff leaves undefined.
"""
import json, os, re, sys

# The designer's handoff, unzipped beside the zip in docs/design/.
H = os.environ.get('THEME_HANDOFF') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'docs', 'design', 'handoff')
P = json.load(open(os.path.join(H, 'theme-presets.json'), encoding='utf-8'))

UNDEFINED = set()


def rgb(s):
    return [int(x) for x in str(s).split()][:3]


def lerp(a, b, t):
    return [round(a[i] + (b[i] - a[i]) * t) for i in range(3)]


def resolve(expr, accent):
    """Evaluate one recipe colour expression -> 'r g b' or 'r g b a' or None."""
    if expr is None:
        return None
    e = str(expr).strip()

    alpha = None
    m = re.search(r'@\s*(\d+)\s*$', e)
    if m:
        alpha = int(m.group(1)); e = e[:m.start()].strip()

    if re.fullmatch(r'[\d ]+', e):                       # already literal
        v = [int(x) for x in e.split()]
        return ' '.join(str(x) for x in (v if alpha is None else v[:3] + [alpha]))

    if e == 'black_or_white_by_luminance':
        return 'LUM'                                     # resolved by caller (needs the bg)

    solid, deep = rgb(accent['solid']), rgb(accent['deep'])
    out = None
    if e == 'accent.solid':                              out = solid
    elif e == 'accent.deep':                             out = deep
    elif (m := re.fullmatch(r'accent\.deep lightened ([\d.]+)', e)):
        out = lerp(deep, [255, 255, 255], float(m.group(1)))
    elif (m := re.fullmatch(r'accent\.deep darkened ([\d.]+)', e)):
        out = lerp(deep, [0, 0, 0], float(m.group(1)))
    elif (m := re.fullmatch(r'accent\.solid mixed ([\d.]+) toward white', e)):
        out = lerp(solid, [255, 255, 255], float(m.group(1)))
    elif (m := re.fullmatch(r'accent lerp\(solid,deep,([\d.]+)\)', e)):
        out = lerp(solid, deep, float(m.group(1)))
    else:
        UNDEFINED.add(e)                                 # e.g. accent.muted / accent.muted_deep
        return f'<UNDEFINED {e}>'
    return ' '.join(str(x) for x in (out if alpha is None else out + [alpha]))


def luminance(c):
    r, g, b = [x / 255 for x in c]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def expand(rung, accent_name, variant='painted'):
    rec = P['rung_recipes'][rung]
    acc = P['accents'][accent_name]
    src = rec.get(variant) or {}
    out = {}
    bg = resolve(src.get('bg_' + accent_name, src.get('bg')), acc)
    out['bg'] = bg
    text = resolve(src.get('text'), acc)
    if text == 'LUM':
        base = rgb(bg.split('<')[0]) if bg and not bg.startswith('<') else [0, 0, 0]
        text = '0 0 0' if luminance(base) > 0.5 else '255 255 255'
    out['text'] = text
    out['border'] = resolve(src.get('border'), acc)
    ic = rec.get('icon')
    out['icon'] = f"{ic['size']} {ic['colour']} {acc['shape']}" if ic and acc.get('shape') else None
    bm = rec.get('beam')
    out['beam'] = None if not bm else (f"{acc['beam']} Temp" if bm == 'temp' else acc['beam'])
    out['size'] = rec['size_px']
    return out


fails = 0
for cat in ('currency', 'essences'):
    g = P['goldens'][cat]
    rows = g.get('painted', {k: v for k, v in g.items() if not k.startswith('_')})
    print(f'=== {cat}')
    for rung, want in rows.items():
        if rung.startswith('_'):
            continue
        got = expand(rung, cat)
        for key in ('text', 'bg', 'border', 'icon', 'beam', 'size'):
            w, gt = want.get(key), got.get(key)
            if str(w) != str(gt):
                fails += 1
                print(f'   MISMATCH {rung}.{key}: got {gt!r}  want {w!r}')
        else:
            pass
    ok = all(str(want.get(k)) == str(expand(r, cat).get(k))
             for r, want in rows.items() if not r.startswith('_')
             for k in ('text', 'bg', 'border', 'icon', 'beam', 'size'))
    print(f'   {"OK" if ok else "differs"} — {len([r for r in rows if not r.startswith("_")])} rungs checked')

print()
print('UNDEFINED transform verbs:', sorted(UNDEFINED) or 'none')
sys.exit(1 if fails else 0)
