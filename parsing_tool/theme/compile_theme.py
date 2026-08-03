"""Compile the designer's recipe into a full sharket_theme.json.

Their handoff is a RECIPE, not a painted theme: 24 accents + 6 rung recipes, and every
colour in the filter is a pure function of (accent, rung, variant). This turns that into
the theme file the generator reads.

Built ON TOP of expand_goldens.py rather than forking it, so the golden diff stays the
test that stops this drifting from the recipe.

    python parsing_tool/theme/compile_theme.py            # write the side file + summary
    python parsing_tool/theme/compile_theme.py --diff     # also diff against what ships

⚠️ NEVER writes sharket_theme.json. It writes sharket_theme.compiled.json beside it, because
this changes every colour in the filter at once and the shipping file is hand-tuned.

⚠️ `accent.muted` IS NOT SETTLED — see docs/design/reply-to-designer-04.md. It is used by
exactly two rungs (T3 plate, T4 text) and neither golden reproduces. Every row that depends
on it is tagged in the summary, and MUTED_IS_PROVISIONAL stays True until the designer answers.
"""
import json, io, os, re, sys, collections

try:                              # this console is gbk; the summary has ⚠ in it
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from expand_goldens import P, resolve, rgb, lerp, luminance, muted, H  # noqa: E402

MUTED_IS_PROVISIONAL = True

DATA = os.path.join(ROOT, "filter_generation", "data")
TD = os.path.join(DATA, "tier_definition")
THEME = os.path.join(DATA, "theme", "sharket")
MAP = json.load(io.open(os.path.join(H, "accent-category-map.json"), encoding="utf-8"))

ACCENT_BY_CAT = {k: v for k, v in MAP["accent_by_category"].items() if not k.startswith("_")}
RUNG = MAP["rung_by_depth"]
FLAT_PAINTED = set(P["flat_look"]["applies_to_painted"])
FLAT_RARITY = set(P["flat_look"]["applies_to_rarity_through"])
GEAR_ACCENTS = {"equipment"}          # categories whose rung is a gear ladder
SIZE = {k: v for k, v in P["size_map"].items() if not k.startswith("_")}

# The T5-borderless form and the flat look BOTH spend the border, so both are legal only
# where the class holds no states. Statefulness is a property of the ITEM CLASS, not of the
# accent — `Breach Grasping Mail` wears the breach accent but IS a Body Armour, and a Body
# Armour holds all five. So resolve it the same way the gear groups resolve: GGPK
# BaseItemTypes -> ItemClasses -> class_hierarchy. A spurious plate is cosmetic; a spurious
# border EATS A STATE, so anything unresolvable is treated as stateful.
STATEFUL_HIERARCHY_ROOTS = ("equipment", "gems", "jewels", "maps", "flasks")
VIOLATIONS = []
RERANK = []          # (tier_definition rel, tier_key, new theme.Tier, how it was decided)


def _class_paths():
    """poe_class -> its path in class_hierarchy.yaml (e.g. 'equipment/armour')."""
    import yaml
    h = yaml.safe_load(io.open(os.path.join(DATA, "class_hierarchy.yaml"), encoding="utf-8"))
    out = {}

    def walk(nodes, path):
        for n in nodes:
            if "poe_class" in n:
                out[n["poe_class"]] = "/".join(path)
            else:
                walk(n.get("children", []), path + [n["id"]])
    walk(h["hierarchy"], [])
    return out


def _base_to_class():
    """GGPK base name -> ItemClasses.Name."""
    d = os.path.join(ROOT, "data", "from_ggpk")
    ic = json.load(io.open(os.path.join(d, "itemclasses.json"), encoding="utf-8"))
    icr = ic if isinstance(ic, list) else ic.get("rows", ic.get("data", []))
    idx = {i: (r.get("Name") or r.get("Id")) for i, r in enumerate(icr)}
    gg = json.load(io.open(os.path.join(d, "baseitemtypes.json"), encoding="utf-8"))
    rows = gg if isinstance(gg, list) else gg.get("rows", gg.get("data", []))
    out = {}
    for r in rows:
        n, k = r.get("Name"), r.get("ItemClassesKey")
        if n and k is not None and n not in out:
            out[n] = idx.get(k)
    return out


def _stateful_categories():
    """theme_category -> True if any of its mapped bases is a class that holds a state."""
    paths, b2c = _class_paths(), _base_to_class()
    bm = os.path.join(DATA, "base_mapping")
    td_theme = {}
    for dp, dn, fns in os.walk(TD):
        dn[:] = [x for x in dn if not x.startswith("_arch")]
        for fn in fns:
            if not fn.endswith(".json"):
                continue
            rel = os.path.relpath(os.path.join(dp, fn), TD).replace(os.sep, "/")
            try:
                d = json.load(io.open(os.path.join(dp, fn), encoding="utf-8"))
            except Exception:
                continue
            top = [k for k in d if not k.startswith("//") and isinstance(d[k], dict)]
            if top:
                td_theme[rel] = d[top[0]].get("_meta", {}).get("theme_category") or top[0]
    out = {}
    for dp, dn, fns in os.walk(bm):
        dn[:] = [x for x in dn if not x.startswith("_arch")]
        for fn in fns:
            if not fn.endswith(".json"):
                continue
            rel = os.path.relpath(os.path.join(dp, fn), bm).replace(os.sep, "/")
            cat = td_theme.get(rel)
            if not cat:
                continue
            try:
                d = json.load(io.open(os.path.join(dp, fn), encoding="utf-8"))
            except Exception:
                continue
            bases = list((d.get("mapping") or {}).keys())
            for r in (d.get("rules") or []):
                bases += list(r.get("targets") or [])
            resolved = False
            for b in bases:
                p = paths.get(b2c.get(b) or "")
                if p is None:
                    continue                      # base not in the GGPK dump
                resolved = True
                if p.startswith(STATEFUL_HIERARCHY_ROOTS):
                    out[cat] = True
                    break
            # Only record a NEGATIVE when at least one base actually resolved. A category
            # whose bases are all unknown to GGPK (3.29 content, or a class_condition block
            # with no base list) must stay unresolved so holds_states() errs stateful.
            if resolved:
                out.setdefault(cat, False)
    return out


STATEFUL = _stateful_categories()


def holds_states(theme_cat):
    return STATEFUL.get(theme_cat, True)      # unresolved -> assume stateful


# ── the ladder: which rungs a file has, in order ────────────────────────────────
def is_hide(key, tier):
    return bool(tier.get("is_hide_tier")) or "hide" in key.lower()


def tier_num(key, tier):
    """The generator's own rank for a tier: theme.Tier if set, else parsed from the key,
    else 99 (`filterGenerator.ts`). Load-bearing here because the designer's rung lists are
    BEST-FIRST and a file's key order is not — Currency/General.json is authored
    Tier 0,1,2,3,4,7,6,5, so mapping positionally would hand Tier 7 a better rung than
    Tier 5."""
    t = (tier.get("theme") or {}).get("Tier")
    if isinstance(t, int):
        return t
    if isinstance(t, str) and t.strip().isdigit():
        return int(t.strip())
    m = re.search(r"\bT(?:ier)?\s*(\d+)", key, re.I)
    return int(m.group(1)) if m else 99


def ladders():
    """Yield (rel_path, category_key, theme_category, [ (tier_key, tier) ... ]) per file."""
    for dp, dn, fns in os.walk(TD):
        dn[:] = [d for d in dn if not d.startswith("_arch")]
        for fn in sorted(fns):
            if not fn.endswith(".json"):
                continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, TD).replace(os.sep, "/")
            try:
                d = json.load(io.open(p, encoding="utf-8"))
            except Exception:
                continue
            top = [k for k in d if not k.startswith("//") and isinstance(d[k], dict)]
            if not top:
                continue
            cat = d[top[0]]
            meta = cat.get("_meta", {})
            rungs = [(k, v) for k, v in cat.items()
                     if not k.startswith("_") and isinstance(v, dict) and not is_hide(k, v)]
            # best-first, to line up with the designer's best-first rung lists
            rungs.sort(key=lambda kv: (tier_num(kv[0], kv[1]), kv[0]))
            yield rel, top[0], meta.get("theme_category") or top[0], rungs


def override_key(rel, theme_cat, depth):
    """Their override keys are annotated: 'Currency/General.json (8)' and
    'Misc/General.json — Quest Items (1)'. The separator is an EM DASH."""
    for k in RUNG["overrides"]:
        if k.startswith("_"):
            continue
        body = re.sub(r"\s*\(\d+\)\s*$", "", k)
        parts = [x.strip() for x in body.split("—")]
        if parts[0] != rel:
            continue
        if len(parts) > 1 and parts[1] != theme_cat:
            continue
        return k
    return None


def rungs_for(rel, theme_cat, accent, depth):
    """-> (list_of_rung_names, how_it_was_decided)"""
    ok = override_key(rel, theme_cat, depth)
    if ok:
        got = RUNG["overrides"][ok]
        return got, ("override" if len(got) == depth else "override:DEPTH-MISMATCH")
    template = "gear" if accent in GEAR_ACCENTS else "value"
    table = RUNG[template]
    if str(depth) in table:
        return table[str(depth)], template
    deepest = max(int(k) for k in table if k.isdigit())
    if depth > deepest:                       # deeper than the table: pad with the floor
        return table[str(deepest)] + [table[str(deepest)][-1]] * (depth - deepest), template + ":PADDED"
    return [], template + ":NO-ENTRY"


# ── one theme row ───────────────────────────────────────────────────────────────
def hexify(v):
    if v is None:
        return None
    p = [int(x) for x in str(v).split()]
    if len(p) == 3:
        p.append(255)
    return "#" + "".join("%02x" % max(0, min(255, x)) for x in p)


def flat_row(accent_name, variant, theme_cat):
    rec = P["flat_look"]["recipe_" + variant]
    acc = P["accents"][accent_name]
    row = {"FontSize": rec["size_px"]}
    txt = resolve(rec.get("text"), acc)
    if txt:
        row["TextColor"] = hexify(txt)
    bg = resolve(rec.get("bg"), acc)
    if bg:
        row["BackgroundColor"] = hexify(bg)
    bd = resolve(rec.get("border"), acc)
    if bd and holds_states(theme_cat):
        # Their own legality test, failing on their own list: every flat rarity_through
        # category IS gear, and gear holds all five states. Dropping the border is the
        # safe direction; recorded so it reaches the designer rather than shipping quietly.
        VIOLATIONS.append(("flat", theme_cat, accent_name,
                           "flat border at full accent strength on a class that holds states"))
    elif bd:
        row["BorderColor"] = hexify(bd)
    # ⚠️ shape: null means NO icon line at all — a bare `MinimapIcon 1 White` is malformed
    # and costs the whole filter load.
    if rec.get("icon") and acc.get("shape"):
        row["MinimapIcon"] = "1 White %s" % acc["shape"]
    return row


def rung_row(rung, accent_name, variant, theme_cat):
    """-> (row, uses_muted)"""
    rec = P["rung_recipes"][rung]
    acc = P["accents"][accent_name]
    # T0 and T1 are painted in every family, gear included — a chase drop overrides rarity.
    v = "painted" if rung in ("T0", "T1") else variant
    src = rec.get(v) or rec.get("painted") or {}
    # T5 is the one rung whose look depends on the class: the borderless form is legal only
    # where the budget is empty. Everyone else keeps the 48 48 48 plate.
    if rung == "T5" and v == "painted" and holds_states(theme_cat):
        src = rec.get("painted_with_states") or src
    uses_muted = any("muted" in str(src.get(k) or "") for k in ("text", "bg", "border"))

    row = {"FontSize": SIZE.get(rung, rec.get("size_px", 32))}
    bg = resolve(src.get("bg"), acc)
    if acc.get("plate") == "never":
        bg = None                                    # gold: no plate at any rung
    if bg and not bg.startswith("<"):
        row["BackgroundColor"] = hexify(bg)

    text = resolve(src.get("text"), acc)
    if text == "LUM":
        base = rgb(bg) if bg and not bg.startswith("<") else [0, 0, 0]
        text = "0 0 0" if luminance(base) > 0.5 else "255 255 255"
    if text and not text.startswith("<"):
        row["TextColor"] = hexify(text)

    bd = resolve(src.get("border"), acc)
    if bd and not bd.startswith("<"):
        row["BorderColor"] = hexify(bd)

    floor = acc.get("icon_floor")
    if rec.get("icon") and acc.get("shape") and floor and floor != "none":
        if int(rung[1]) <= int(str(floor)[1]):
            ic = rec["icon"]
            row["MinimapIcon"] = "%s %s %s" % (ic["size"], ic["colour"], acc["shape"])
    bm = rec.get("beam")
    if bm and acc.get("beam"):
        row["PlayEffect"] = ("%s Temp" % acc["beam"]) if bm == "temp" else acc["beam"]
    return row, uses_muted


# ── compile ─────────────────────────────────────────────────────────────────────
def compile_theme():
    out, report, provisional = {}, [], 0
    unmapped, mismatched = [], []
    for rel, catkey, theme_cat, rungs in ladders():
        accent = ACCENT_BY_CAT.get(theme_cat)
        if not accent:
            unmapped.append((rel, theme_cat))
            continue
        if theme_cat == "States":
            continue                                   # decorator file, takes no accent
        depth = len(rungs)
        flat = theme_cat in FLAT_PAINTED or theme_cat in FLAT_RARITY
        variant = "rarity_through" if (accent in GEAR_ACCENTS or accent == "maps") else "painted"
        rows = out.setdefault(theme_cat, {})

        if flat:
            v = "rarity_through" if theme_cat in FLAT_RARITY else "painted"
            # A flat block is off the ladder, so it needs a rung NUMBER to be addressable at
            # all. Park the whole category on Tier 2 — the flat look is one row by definition.
            rows["Tier 2"] = flat_row(accent, v, theme_cat)
            for tk, _ in rungs:
                RERANK.append((rel, tk, 2, "flat"))
            report.append((theme_cat, rel, depth, "FLAT/" + v, accent, 0))
            continue

        names, how = rungs_for(rel, theme_cat, accent, depth)
        if "MISMATCH" in how or "NO-ENTRY" in how:
            mismatched.append((rel, theme_cat, depth, how, len(names)))
        n_muted = 0
        for i, (tk, _) in enumerate(rungs):
            if i >= len(names):
                break
            rung = names[i]                       # "T3"
            row, um = rung_row(rung, accent, variant, theme_cat)
            # ★ The generator keys the theme by `Tier N`, where N is the tier's own
            # theme.Tier (else parsed from its key) — filterStyle.ts:267. So the RUNG DIGIT
            # is the row key, and the same digit has to be written into the tier block's
            # theme.Tier. Those two halves are one change: apply neither or both.
            rows["Tier %s" % rung[1]] = row
            RERANK.append((rel, tk, int(rung[1]), how))
            n_muted += um
        provisional += n_muted
        report.append((theme_cat, rel, depth, how, accent, n_muted))
    return out, report, provisional, unmapped, mismatched


if __name__ == "__main__":
    out, report, provisional, unmapped, mismatched = compile_theme()
    dest = os.path.join(THEME, "sharket_theme.compiled.json")
    io.open(dest, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    rr = os.path.join(THEME, "rerank.compiled.json")
    io.open(rr, "w", encoding="utf-8").write(json.dumps(
        [{"file": f, "tier_key": t, "Tier": n, "how": h} for f, t, n, h in RERANK],
        ensure_ascii=False, indent=1) + "\n")

    rows = sum(len(v) for v in out.values())
    print("compiled %d categories, %d rows -> %s" % (len(out), rows, os.path.relpath(dest, ROOT)))
    print("re-rank for %d tier blocks    -> %s" % (len(RERANK), os.path.relpath(rr, ROOT)))
    print()
    if mismatched:
        print("⚠️ %d ladder(s) whose depth does not match the rung table:" % len(mismatched))
        for rel, tc, depth, how, n in mismatched:
            print("     %-46s %-24s depth=%d gave %d (%s)" % (rel, tc, depth, n, how))
        print()
    if unmapped:
        print("⚠️ %d theme categories with no accent:" % len(unmapped))
        for rel, tc in unmapped:
            print("     %-46s %s" % (rel, tc))
        print()
    if VIOLATIONS:
        seen = {}
        for kind, tc, acc, why in VIOLATIONS:
            seen.setdefault((kind, tc, acc, why), 0)
            seen[(kind, tc, acc, why)] += 1
        print("⚠️ %d state-budget violation(s) — border DROPPED, see reply-to-designer-04:" % len(seen))
        for (kind, tc, acc, why), n in sorted(seen.items()):
            print("     [%s] %-32s accent=%-11s %s" % (kind, tc, acc, why))
        print()
    print("%d rows depend on `accent.muted`, which is NOT SETTLED (reply-to-designer-04 §2/§3)."
          % provisional)
    print("   Everything else is final. Those rows are T3 plates and T4 text.")

    cur = os.path.join(THEME, "sharket_theme.json")
    if "--diff" in sys.argv and os.path.exists(cur):
        old = json.load(io.open(cur, encoding="utf-8"))
        oldcats = {k for k in old if not k.startswith("//")}
        print()
        print("=== against what ships today ===")
        print("  ships %d categories, compiled %d" % (len(oldcats), len(out)))
        print("  dropped: %s" % ", ".join(sorted(oldcats - set(out))[:14]))
        print("  added  : %s" % ", ".join(sorted(set(out) - oldcats)[:14]))
        oldrows = sum(len(v) for k, v in old.items() if not k.startswith("//") and isinstance(v, dict))
        print("  rows   : %d -> %d  (%+d)" % (oldrows, rows, rows - oldrows))
