# -*- coding: utf-8 -*-
"""The work list for re-homing live content out of `_legacy/Legacy.json`.

Reads `data/from_ggg/legacy_verdict.json` (written by audit_legacy.py) and emits the LIVE
rows as a hand-workable list: English name, official Simplified Chinese name, item class,
which league added it, and a suggested destination.

⚠️ ZH NAMES COME FROM GGPK, JOINED ON `Id`. Never hand-written, never transliterated, and
never joined on `_rid` — row indices differ on 94% of rows between the international and CN
dumps while the first ~300 align, so a spot-check looks fine and the tail is silently wrong
(ADR-0004). English `Name` is ambiguous too (413 duplicates), so English is only ever the
display column here; the join key is the Id.

The DESTINATION column is a suggestion, not a decision — the author re-homes by hand.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "data", "source")
OUT_MD = os.path.join(ROOT, "docs", "legacy-rehome-list.md")
OUT_HTML = os.path.join(os.path.expanduser("~"), "Documents",
                        "poe-filter-legacy-rehome.html")

# ── the verdicts ────────────────────────────────────────────────────────────────
verdict = json.load(io.open(os.path.join(
    ROOT, "data", "from_ggg", "legacy_verdict.json"), encoding="utf-8"))
live = {k: v for k, v in verdict.items() if v["verdict"].startswith("LIVE")}

# ★ "live" is not "unhomed". A base listed under `_legacy` in base_mapping can already be
# claimed on screen by an earlier SUBSTRING rule — `BaseType "Tattoo of"` takes all 53
# tattoos, `"Runegraft of"` takes the runegrafts, `"Astrolabe"` takes the astrolabes — and
# under first-match-wins it never reaches the Legacy block at all. The mapping entry is then
# cosmetic and there is no work. who_claims.py resolves this against the EMITTED filter;
# without it this list reported 158 rows of work where 21 existed.
claims = {}
cp = os.path.join(ROOT, "data", "from_ggg", "legacy_claimants.json")
if os.path.exists(cp):
    claims = json.load(io.open(cp, encoding="utf-8"))
if claims:
    live = {k: v for k, v in live.items()
            if claims.get(k, {}).get("state") in ("needs re-homing", "GAP — nothing shows it")}

# ── Id -> zh, via the CN dump; Name -> Id, via the English dump ─────────────────
def rows(label, lang, table="BaseItemTypes.json"):
    p = os.path.join(SRC, label, "tables", lang, table)
    return json.load(io.open(p, encoding="utf-8")) if os.path.exists(p) else []

en = rows("3.29.0.4.2", "English")
cn = rows("cn-3.29", "Simplified Chinese") or rows("cn-3.29", "Traditional Chinese")
zh_by_id = {r.get("Id"): r.get("Name") for r in cn if r.get("Id")}
ids_by_name = collections.defaultdict(list)
for r in en:
    if r.get("Name"):
        ids_by_name[r["Name"]].append(r.get("Id"))

def zh(name):
    ids = ids_by_name.get(name, [])
    got = [zh_by_id.get(i) for i in ids if zh_by_id.get(i)]
    got = [g for g in got if g]
    if not got:
        return ""                       # absent is honest; a guess is not
    return got[0] if len(set(got)) == 1 else got[0] + "  ⚠️(%d ids)" % len(set(got))

# ── suggested destinations ─────────────────────────────────────────────────────
DEST = {
    "Support Gems": "Gems/Support.json",
    "Skill Gems": "Gems/Skill.json",
    "Corpses": "Currency/Corpses.json",
    "Map Fragments": "Maps/Scarabs.json  (or Maps/Fragments.json)",
    "Belts": "Equipment/Rare Equipment.json",
    "Stackable Currency": "— needs a call: Currency/*",
}

groups = collections.defaultdict(list)
for n, v in live.items():
    groups[v["class"]].append(n)

md = ["# Re-home list — live content that nothing else already shows",
      "",
      "**%d bases.** Each one is live in Ruthless (GGG's Item Filter Information threads,"
      " GGPK-verified, minus what the Ruthless wiki disables) AND falls through to the"
      " Legacy block in the emitted filter." % len(live),
      "",
      "★ This is the short list, not the long one. %d bases are live-but-listed-under-_legacy;"
      " the other %d are already claimed on screen by an earlier rule — mostly SUBSTRING"
      " matches (`Tattoo of` takes 50, `Runegraft of` 10, `Astrolabe` 9), so their mapping"
      " entry is cosmetic and there is nothing to do. See `who_claims.py`."
      % (len(claims) if claims else len(live), (len(claims) - len(live)) if claims else 0),
      "",
      "zh names are GGPK's own, joined on `Id` (ADR-0004). A blank zh cell means the CN dump"
      " has no row for that Id — do not fill it in by hand.",
      ""]

if not groups:
    # An empty work list must SAY it is empty. A file that renders as a bare header reads
    # as "the generator broke", which is the same failure as a stale cache serving quietly.
    md += ["## Nothing outstanding",
           "",
           "Every live base is claimed by a real block, or is recorded in",
           "`_legacy/Legacy.json` `_meta.author_confirmed_legacy` as belonging here.",
           "",
           "Re-run `who_claims.py` after any curation change to regenerate this.",
           ""]

for cls in sorted(groups, key=lambda c: -len(groups[c])):
    names = sorted(groups[cls])
    md += ["## %s — %d" % (cls, len(names)),
           "",
           "Suggested home: `%s`" % DEST.get(cls, "?"),
           "",
           "| # | base | zh | added |", "|---|---|---|---|"]
    for i, n in enumerate(names, 1):
        md.append("| %d | %s | %s | %s |"
                  % (i, n, zh(n), live[n]["verdict"].replace("LIVE since ", "")))
    md.append("")

io.open(OUT_MD, "w", encoding="utf-8").write("\n".join(md) + "\n")
print("wrote %s  (%d bases, %d classes)" % (
    os.path.relpath(OUT_MD, ROOT), len(live), len(groups)))
missing = [n for n in live if not zh(n)]
print("zh resolved %d/%d" % (len(live) - len(missing), len(live)))
for n in missing:
    print("     no CN row: %s" % n)
