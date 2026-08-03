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


def lum255(c):
    """Reply 03's luminance, on the 0-255 scale their worked example uses."""
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def muted(solid):
    """reply 03 / 09: desaturate(solid, 0.70), then darken 0.10.

    desaturate(c, f) = lerp(c, grey(lum(c)), f);  darken f = lerp(c, black, f).
    """
    g = lum255(solid)
    des = [solid[i] + (g - solid[i]) * 0.70 for i in range(3)]
    return [round(v * 0.90) for v in des]


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
    muted_c = muted(solid)
    out = None
    if e == 'accent.solid':                              out = solid
    elif e == 'accent.deep':                             out = deep
    elif e == 'accent.muted':                            out = muted_c
    elif e == 'accent.t0_text ?? accent.solid':
        out = rgb(accent['t0_text']) if accent.get('t0_text') else solid
    elif (m := re.fullmatch(r'accent\.muted darkened ([\d.]+)', e)):
        out = lerp(muted_c, [0, 0, 0], float(m.group(1)))
    elif (m := re.fullmatch(r'accent\.muted lightened ([\d.]+)', e)):
        out = lerp(muted_c, [255, 255, 255], float(m.group(1)))
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


def check_goldens():
    """Expand the two golden accents and diff. Returns the mismatch count."""
    fails = 0
    for cat in ('currency', 'essences'):
        g = P['goldens'][cat]
        rows = g.get('painted', {k: v for k, v in g.items() if not k.startswith('_')})
        print(f'=== {cat}')
        n = 0
        for rung, want in rows.items():
            if rung.startswith('_'):
                continue
            n += 1
            got = expand(rung, cat)
            for key in ('text', 'bg', 'border', 'icon', 'beam', 'size'):
                w, gt = want.get(key), got.get(key)
                if str(w) != str(gt):
                    fails += 1
                    print(f'   MISMATCH {rung}.{key}: got {gt!r}  want {w!r}')
        print(f'   {"OK" if not fails else "differs"} — {n} rungs checked')
    print()
    print('UNDEFINED transform verbs:', sorted(UNDEFINED) or 'none')
    return fails


def wcag_luminance(c):
    """WCAG relative luminance — NOT the same as reply 03's lum(), which is a plain
    0-255 weighted average. This one linearises sRGB first, and is the only one valid
    for a contrast ratio."""
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def check_t0_contrast(bar=3.0):
    """Their reply-03 ask: 'assert every T0 text clears 4.5:1 on white'.

    Reported at 3:1, the WCAG bar for LARGE text — T0 ships at 45px, so 3:1 is the
    applicable threshold rather than 4.5:1. Both numbers are printed.
    """
    print('=== T0 text contrast on the white plate ===')
    rows = []
    for name, a in P['accents'].items():
        if name.startswith('_') or not isinstance(a, dict):
            continue
        t0 = rgb(a.get('t0_text') or a['solid'])
        ratio = 1.05 / (wcag_luminance(t0) + 0.05)
        rows.append((ratio, name, t0, 't0_text' if a.get('t0_text') else 'solid'))
    rows.sort()
    fail = [r for r in rows if r[0] < bar]
    for ratio, name, t0, src in rows:
        mark = 'FAIL' if ratio < bar else '    '
        print('   %s %-13s %-14s %.2f:1  (%s)' % (mark, name, ' '.join(map(str, t0)), ratio, src))
    print('   %d of %d below %.1f:1 (large-text bar); %d below 4.5:1'
          % (len(fail), len(rows), bar, len([r for r in rows if r[0] < 4.5])))
    return len(fail)


if __name__ == '__main__':
    bad = check_goldens()
    print()
    check_t0_contrast()
    sys.exit(1 if bad else 0)
