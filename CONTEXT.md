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
- **decorator** — a purely visual emphasis applied to items **in place**, via a rule
  `overrides` block (the emphasis button). A decorator is **not a tier**: it changes
  how an item looks without changing which tier owns it. *(Retired 2026-07-27: Tier 0's
  role used to be called "Decorator" and was allowed to be an empty highlight band,
  which forced an empty Tier-0 into every category — 34 of 65 were empty. Tier 0 is now
  the top/chase rank and a category with no chase items should omit it. The old role
  entry is kept commented in `theme/roles.json` under `_retired` and in
  `themeGenerator.ts` for easy revert.)*
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
  = separate trees. Core generator code is identical across modes. **Ruthless
  forbids the `Hide` keyword in-game** — hidden tiers MUST emit `Minimal` (GGG's
  Ruthless-only Hide-equivalent; before it existed the workaround was FontSize 1 +
  transparent border/background). `HIDE_CMD` resolves to `Minimal` under ruthless in
  the generator. It is mode-aware via `GeneratorData.mode` (fed from `game_mode`), and
  the ruthless case is pinned by the `ruthless-soft-ch` fixture golden.
- **coverage: cherry-pick + safety net + catch-all** — a category does **not**
  have to name every base it covers, so "this base type is in no `base_mapping`"
  is *not* by itself a defect. Three layers, in emission order:
  1. **Cherry-pick** — named `BaseType` lists for the bases actually worth
     calling out. For very general classes (gems above all) this is a small
     minority by design. Ruthless cherry-picks *more* than standard, because in
     standard you can ignore ~95% of gems outright.
  2. **Class safety net** — a `class_condition: true` tier whose `conditions`
     carry a `Class` line, catching the rest of that class in one rule (every
     map via `Maps/Base Maps.json`, boots, jewellery, weapons/armour, relics,
     idols, tinctures). Note `class_condition` alone does *not* imply a `Class`
     line — it means "emit `conditions` verbatim with no BaseType list"; the
     `Class` key has to be inside `conditions`. `_meta.item_class` is a display
     label only and never emits (Invariant: see `item_class` below).
  3. **`[99999] Unknown Items`** — the final catch-all for anything no rule
     above matched. Currently a magenta PLACEHOLDER, deliberately loud: a new
     league's unmapped bases scream in-game instead of vanishing.
  `parsing_tool/ggpk/reconcile.py` models exactly this — it counts `Class`
  conditions as coverage, so it reports what would fall through to 3, not what
  merely lacks a name.
- **drop-disabled vs removed, and why placement barely matters** — GGG's filter-info feed
  knows three verbs (new / removed / returning). The game has more, and poewiki's
  *Drop-restricted item* page grades them: **usable** (drop-disabled, existing copies still
  work), **defunct** (drop-disabled and non-functional), **removed** (deleted entirely).
  `parse_drop_restricted.py` extracts all three into `data/from_wiki/drop_restricted.json`.
  ★ **Author's rule (2026-08-19): for anything not removed entirely, whether it sits in
  `_legacy` or in the category it would belong to *if it dropped* is a cosmetic choice, not a
  correctness one — neither breaks the filter, and keeping it in is the safer default because
  GGG re-enables content.** So the legacy bucket is not a backlog to drain; the only outcome
  that actually costs anything is a base reaching the `[99999]` catch-all, which
  `check_catchall_coverage.py` guards at zero. Curation effort here buys tidiness and a better
  look, never safety. ⚠️ The corollary bit once already: "the mechanic is live" does not imply
  "its old rewards drop" — Sanctum exists in Ruthless and `Lycia's Invocation` is still listed
  removed.
- **the generation engine** — one, in TypeScript; see Invariant 1.
- **demo / backend-free build** — the deployed site has no server; `clientData.ts` +
  `demoAdapter.ts` re-implement the FastAPI endpoints over a static bundle + localStorage.

## Architectural invariants (do not "clean these up" without a deliberate decision)

1. **There is ONE generation engine, and the CLI must stay a shell around it.**
   `webapp/frontend/src/utils/filterGenerator.ts` is the engine — the same module every
   visitor's browser runs. `filter_generation/generate.mjs` is the CLI: it loads
   `filter_generation/data/**`, calls `generateFilter`, writes the file, and holds **no
   generation logic of its own**. That last clause is the invariant; a CLI that starts
   deciding things is how this project ended up with two engines to keep in parity.
   Python still does offline data prep (`parsing_tool/`, `create_demo_bundle.py`) — the
   generator is what was retired, not the language.

   Guarded by two tests that ask different questions:
   `test_generator_fixtures.mjs` (synthetic tree + committed goldens — does the engine
   emit what we decided?) and `test_resolver_equivalence.mjs` (does the editor preview
   match the export?). Regenerate goldens with `--update`, then **read the diff** — that
   diff is the behaviour change, and it is the only review the test gets.

   This reverses the original dual-generator design. Parity proved the two engines
   agreed; it could not see a mistake they shared, and there was one —
   `match_modes` was written to `base_mapping` and read from `tier_definition`, so the
   Partial toggle never worked while parity stayed green.
   See [ADR-0007](docs/adr/0007-one-generation-engine.md), superseding
   [ADR-0001](docs/adr/0001-dual-generator-parity.md).

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

8. **Emission order is a 3-level hybrid, authored (never auto-sorted).** PoE
   filters are first-match-wins, so order = specific→general (valuable/precise
   blocks before broad catch-alls).
   - **Category (file) order** = each mapping's `_meta.gen_order` (integer,
     ascending; absent = 0), then relative path. This is **decoupled from nav
     display order** (`category_structure` order) on purpose: campaign files carry
     `gen_order: -100` so they emit FIRST (owning the acts), while the nav shows
     campaign low (opened less often); `_legacy`/`_unclassified` carry `+100`
     (last). Both generators sort by this — parity-guarded. (Replaced the old
     `!campaign`/`~` filename hack.)
   - **Tier order** within a category = `_meta.tier_order`, authored by dragging
     blocks in the editor. Editor order == generation order.
   - **Rule order** within a tier = the `rules` array order, authored in
     RuleManager; rules emit before the tier's base block.
   The generator follows all three verbatim and never reorders (consistent with
   invariant #10). Consequence: **every emitting campaign tier AND band rule MUST
   carry an `AreaLevel` guard (≤ 67)** — an unguarded one, emitting first, would
   hijack items from the entire endgame filter.

9. **Localization contract (built for N languages).** One canonical string +
   per-language dicts + a single fallback chain: `loc[lang] → loc.en → raw key`.
   Data (tiers/categories) carries `localization: {en, ch, …}`; **rules** carry a
   canonical English `comment` plus an optional `localization: {ch, …}` dict —
   never bake a translation into `comment`. Both generators resolve displays
   through this chain (parity-guarded); the Python output language is `LANG`
   (currently hardcoded `"ch"`), the TS side uses its `language` input. Adding a
   language = adding dict keys + a `localization.ts` block — no schema changes.
   (Future: make the output language a generation parameter for localized
   `.filter` exports.)

10. **No invisible filter logic (user rule, 2026-07-19).** Everything the
    generators emit must be visible in the editor: condition-driven tiers show
    their conditions (the condition strip in CategoryView), predefined bands are
    ordinary RULES in the Rules panel (never generator-side magic), and gates
    surface as controls (strictness chips, ⚡ enable, dimming). If a predefined
    behavior can't be seen in the UI, users can't debug a broken rule — show it.
    (Known remaining exception: `data/footer.filter`, the hand-maintained
    catch-all appended verbatim — visible only in the filter preview/export.)

11. **Strictness never applies inside `_campaign`.** Strictness is an endgame-only
   mechanism (user decision, 2026-07-18): campaign tiers carry no
   `hide_at_strictness`, and the campaign section renders identically at every
   strictness level. Campaign decluttering is the picker's `hide_unselected`
   toggle, not strictness.

12. **Most of `parsing_tool/` is spent.** 41 of its 52 scripts write directly into
   `filter_generation/data/`, and the majority were run once during a build or
   migration and are now historical — re-running one reverts that region of the tree
   to its state on the date it was written. The filenames give no hint of this
   (`generate_base_mappings.py` would flatten the curation). Every script carries a
   group banner on line 1; **`parsing_tool/README.md` is the index** and says which
   are safe. Notable: `generate_category_json.py` is a known regression, and
   `build_campaign_bands.py`, `build_standard_theme.py` and
   `import_uniques_from_filterblade.py` would each destroy hand-tuning.

## Where the roadmap + progress lives

Ongoing work, decisions, and the 3.29-league to-do live in the maintainer's `.claude`
project memory (loaded per session). **This file is the *stable* contract; memory is the
*current* state.** When an invariant here changes, update this file (and the relevant ADR)
in the same commit.
