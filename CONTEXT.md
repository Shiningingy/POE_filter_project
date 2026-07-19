# CONTEXT — POE Filter Project (Sharket)

Canonical glossary + architectural invariants for this repo. Agents, skills, and
reviewers: **read this before proposing refactors.** Several "obvious cleanups" here
are deliberate decisions — the invariants below say which, and why.

## What this is

A Path of Exile loot-filter editor. A data pipeline builds tier/mapping JSON from
game dumps; a generator turns that JSON into a `.filter` file; a React editor lets
you tune it. It ships **backend-free** (static site), so the generator also exists
as a TypeScript port that runs in the browser.

## Glossary

- **Filter** — the generated `.filter` text (the loot rules the game reads).
- **tier_definition** (`filter_generation/data/tier_definition/**`) — per-category
  JSON defining tiers (visual/priority bands) and their conditions.
- **base_mapping** (`.../base_mapping/**`) — maps item base types → their tier.
- **theme** (`.../theme/sharket/sharket_theme.json`) — per-category, per-`Tier N`
  colours/fonts/sounds. Tier files store only `theme.Tier: N`; colours resolve here.
- **strictness gate** — optional per-tier `hide_at_strictness: N` (0–6). A shown tier
  flips to Hide once the selected strictness level's index ≥ N.
- **`hideable`** — a per-tier **protect-guard** (see Invariant 2). `hideable:false` =
  protected, cannot be gated/hidden (the 🔒 lock in the editor).
- **campaign module (selection-centric ladder)** — `_campaign/**` group tiers
  tagged `lv_group:{axis,key}`. The Campaign picker's `leveling_selection` decides
  which groups emit: a picked weapon class / armour defense type emits its
  **T1 layer** ("X Progression": band rules = level-matched good bases, theme
  Tier 2) and its **T2 layer** ("X Rares": class-wide rare catch, Tier 4);
  unpicked groups emit nothing and fall to the **T3 safety net** (Tier 6).
  Nothing picked = the simple baseline (net + boots/jewellery/links/flasks/early).
  `hide_unselected` = declutter (unpicked WEAPON groups + the `axis:"aggressive"`
  late-campaign-magic tiers emit as Hide). There is NO boost/theme-swap mechanism.
  Tree is seeded by `parsing_tool/build_campaign_bands.py` (ONE-SHOT — output is
  hand-tuned afterward; never re-run over tuned data without a commit).
- **mode** vs **game-version** — *mode* (ruthless/standard) shares item data and
  differs only in tier VALUES (overlay + `excluded_modes`); *game-version* (poe1/poe2)
  = separate trees. Core generator code is identical across modes.
- **the dual generator** — see Invariant 1.
- **demo / backend-free build** — the deployed site has no server; `clientData.ts` +
  `demoAdapter.ts` re-implement the FastAPI endpoints over a static bundle + localStorage.

## Architectural invariants (do not "clean these up" without a deliberate decision)

1. **The generator is intentionally duplicated across two languages, kept in
   byte-for-byte parity.** `filter_generation/generate.py` (Python — the
   reference/oracle + local build) and `webapp/frontend/src/utils/filterGenerator.ts`
   (TypeScript — the engine that actually ships to browsers) must emit identical output.
   Guarded by `webapp/frontend/test_generator_parity.mjs`. **Editing generation logic
   means editing BOTH and running the parity test.** Collapsing to a single engine is a
   *legitimate but ADR-level* migration (it rewires the local Python build pipeline) —
   not a casual cleanup. See [ADR-0001](docs/adr/0001-dual-generator-parity.md).

2. **`hideable` is a live UI-authoring guard, NOT dead code.** Both generators
   *intentionally* ignore it; it is enforced only in the editor. `hideable:false` means
   "protected — never gate or hide this high-value tier." Do **not** retire it as "read
   by no generator." See [ADR-0002](docs/adr/0002-hideable-is-a-ui-guard.md).

3. **`hide_at_strictness` carrying zero values in tier data is intentional.** The
   strictness feature shipped "mechanism only" — the economy curve is authored by the
   user via the editor, not baked into the data. An empty gate ≠ a dead field.

4. **The app's language code is `'ch'` (alongside `'en'`), never `'zh'`.** `zh` appears
   only in some *data filenames* (e.g. `unique_name_zh_extra.json`) — a naming choice,
   not a language-code drift or bug.

5. **Some large components are deliberately not split.** `RuleManager`,
   `SoundBulkEditor`, `CategoryView`, `ImportForeignFilterView` were kept whole by a
   prior refactor that chose not to force bad `>20`-prop seams. Don't split on line count
   alone. See [ADR-0003](docs/adr/0003-large-components-not-split.md).

6. **`localization.ts` is large because it is a translation DATA table** — inherent, not
   a smell.

7. **`filter_generation/complete_filter.filter` is a tracked build artifact.** It may be
   stale relative to source; it's regenerated on demand.

8. **`_campaign` emits FIRST in the generated filter.** PoE filters are
   first-match-wins; both generators sort `_campaign` before every other folder
   (other `_`-prefixed folders stay last). The campaign tree is just TWO category
   files (`Gear Progression.json`, `Flasks.json`); emission order *within* each
   is `_meta.tier_order` (progression tiers → nets → links → declutter last), and
   level bands live as per-tier RULES carrying their own Rarity/AreaLevel
   conditions. Consequence: **every emitting campaign tier AND band rule MUST
   carry an `AreaLevel` guard (≤ 67)** — an unguarded one would hijack items from
   the entire endgame filter.

9. **Strictness never applies inside `_campaign`.** Strictness is an endgame-only
   mechanism (user decision, 2026-07-18): campaign tiers carry no
   `hide_at_strictness`, and the campaign section renders identically at every
   strictness level. Campaign decluttering is the picker's `hide_unselected`
   toggle, not strictness.

## Where the roadmap + progress lives

Ongoing work, decisions, and the 3.29-league to-do live in the maintainer's `.claude`
project memory (loaded per session). **This file is the *stable* contract; memory is the
*current* state.** When an invariant here changes, update this file (and the relevant ADR)
in the same commit.
