# Tier Ladder Review — the artifact that reviews all 1082 tiers

A single self-contained HTML page for deciding what each tier ladder should BE, before
asking a designer for colours. It renders every tier as the plate it currently draws in
game, next to a box for "what is this tier for?" and a keep / rename / merge / split /
drop / restyle call.

Published at **https://claude.ai/code/artifact/2fe0ffe3-fe1d-4431-8aa8-278d5419ee1e**.
Republish to that same URL — the review is kept in the browser's `localStorage` under
`sharket-tier-review-v2`, and a new URL would strand it.

## Rebuilding

```sh
# 1. traces - so each tier can report whether it actually EMITS. Both modes, because a
#    Standard-only tier is not silent, it is just absent from the Ruthless filter.
node filter_generation/generate.mjs --mode ruthless --trace traces/ruthless.json --out /tmp/r.filter
node filter_generation/generate.mjs --mode standard --trace traces/standard.json --out /tmp/s.filter

# 2. extract the ladders (writes tier_review_data.json next to the scripts)
python parsing_tool/tier_review/extract_tiers.py traces/ruthless.json traces/standard.json

# 3. inline the data into the page
python parsing_tool/tier_review/build_artifact.py
```

The traces are optional; without them the page still works but cannot show `emits` /
`SILENT`, which is most of its diagnostic value.

## ⚠️ Two traps this tool was built around

**Resolve a theme row by tier NUMBER, not by tier key.** `filterStyle.resolveTierTheme`
uses `theme.Tier` (or the number parsed out of the key), so a tier called
`Chancing Normal` with `theme.Tier: 2` wears row `Tier 2`. Matching on the key instead
double-counted everything: 1416 phantom rows against a true 1082, each real tier showing
once unstyled and once as a fake orphan.

**An item count is not evidence of life.** A tier with zero mapped bases can be entirely
live, because it matches by CONDITION (`ItemLevel >= 86`) or is targeted by a rule. **52
of the 60 Tier-0 tiers are exactly that shape.** The first version of this page showed
only item counts, and that reads as "delete me" on live content. Hence the `condition` /
`class rule` / `N rules` / `emits N` chips, and `SILENT` reserved for a tier that emits
nothing in *either* mode — currently 83 of 1082.

**Export writes to the screen, not to a file.** The page runs sandboxed, where a
Blob + `<a download>` is blocked *silently* — the button looked dead and there was no way
to get a completed review out. The panel shows the JSON to copy; the download is still
attempted, but only as a bonus.

## The export

```json
{ "format":"sharket-tier-review", "version":2,
  "notes": { "<themeKey>": { "_note":"…category-level…",
                             "<tierKey>": {"d":"description","a":"keep|merge|…"},
                             "_new": [{"n":"working name","d":"why"}] } },
  "newCategories": [ {"n":"name","where":"chapter/group","d":"why"} ] }
```

The banked first pass is `docs/design/review.json` (48 categories, 50 tier entries).
