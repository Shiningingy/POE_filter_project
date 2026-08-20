# `parsing_tool/` — what is safe to run

52 scripts live here and **41 of them write directly into `filter_generation/data/`**,
the curated tree. Most were written once, run once, and are now spent: re-running one
today would overwrite months of hand curation with whatever it generated in January.
The filenames do not distinguish them — `generate_base_mappings.py` sounds like
something you would run, and it would flatten the tree.

Every script carries a one-line banner at the top saying which group it is in. This
file is the index.

**Before running anything here that is not in group A: check `git status` is clean, so
whatever it does is one `git checkout` away from being undone.**

---

## A. Live tools — safe to run

| script | what it does |
|---|---|
| `validate_curation.py` | **read-only.** Checks the tree against what the generator actually enforces. `--file Currency` to scope. Run this often |
| `ggpk/extract.py` | writes `data/source/<label>/` from a GGPK dump. Never touches the curated tree |
| `ggpk/reconcile.py` | reads the tree + a dump, writes `reconcile.json` and the triage console |
| `ggpk/render_console.py` | renders the console HTML from `reconcile.json` |
| `ggpk/apply_decisions.py` | applies decisions **you exported from the console** — it only does what you picked |
| `ggpk/jsonio.py` | library, not a script. Preserves each file's indent/BOM/line endings; any tool that edits curation JSON must use it |
| `parse_ruthless_wiki.py` | parses a hand-saved wiki page into `data/from_wiki/` |
| `build_items_db.py` | builds `data/items_db.json` from GGPK sources |
| `build_unique_base_db.py` | builds the base→uniques map the backend serves |
| `extract_zh_currency_descriptions.py` | builds the zh description DB |

### A2. Standing guards — read-only, exit non-zero on a real problem

Run these against a **built** filter (`out/*.filter`) unless noted. They were each written
after a defect reached the game, so the docstring of every one names the bug it exists to
catch — read it before deciding a finding is noise. Note the **input** column: the two that
need a `--trace` cannot be run from a filter alone, because they compare what was authored
against what was emitted.

| script | input | the failure it catches |
|---|---|---|
| `check_catchall_coverage.py` | filter | a **curated** base falling all the way to the `[99999]` catch-all. Held at 0; found 232 on V6.94 |
| `check_shadowed_blocks.py` | filter | an emitted block nothing can ever reach, and the sounds it takes down with it. A property of the *emitted order*, which is why `validate_curation.py` cannot see it |
| `check_cross_category_claims.py` | filter | the opposite failure: a reachable block that gets there first and quietly claims bases curated in a **different** category |
| `check_condition_schema.py` | *none* | any of the four copies of the condition vocabulary drifting from `filter_generation/data/filter_conditions.yaml` — the drift that silently made 4 bool conditions never match in the simulator |
| `check_label_collisions.py` | trace | the look on the ground not matching the look that was authored |
| `check_lost_item_sounds.py` | trace | a curated per-item sound that never reaches the filter |
| `normalize_sound_volume.py` | filter | sound lines off the mandated volume 300 (`--check` fails; no args rewrites) |
| `check_filterblade_diff.py` | filter | **review only, never fails.** Bidirectional coverage diff against a FilterBlade filter |
| `parse_drop_restricted.py` | saved HTML | not a guard — parses the hand-saved wiki page into the 3 drop-restriction grades |

## B. Careful — rerunnable, but they overwrite hand-tuned data

| script | why |
|---|---|
| `sync_base_translations.py` | pulls official zh from the GGPK dump into the tree. Correct source of truth, but it overwrites per-file localization wholesale |
| `audit_fix_tier_ladders.py` | audits by default; `--fix` rewrites ladders |
| `apply_font_ladder.py` | committed but **never run**. `sharket_theme.json` is hand-tuned |
| `build_standard_theme.py` | regenerates a theme. **`sharket_theme.json` is hand-tuned — do not regenerate it** |
| `build_campaign_bands.py` | **ONE-SHOT.** Generated the `_campaign` tree; it has been hand-tuned since. Never re-run over that tuning without asking |
| `import_uniques_from_filterblade.py` | **DO NOT re-run.** The uniques data has been hand-tuned |
| `import_leveling_from_filterblade.py` | superseded for gear content by the campaign work |

## C. Do not run — known broken

| script | why |
|---|---|
| `generate_category_json.py` | **RETIRED — moved to `filter_generation/archive/retired-code/`**, together with its input `category_structure.yaml`. The yaml had drifted to 27 groups / 111 leaves against the json's 30 / 96: nine groups existed only in the json (the whole Curse of the Allflame chapter, all seven campaign leaves) and six only in the yaml, long dead. Compiling it DELETED a league's content. **`filter_generation/data/category_structure.json` is now the one nav file — edit it directly.** |

## D. Spent one-shots — already applied, do not re-run

These built or migrated the tree once. The curation has moved on; running one now
reverts that region to its state on the date shown.

**2026-01-13 — initial build**
`clean_tier_definitions.py` · `generate_base_mappings.py` ·
`generate_default_tier_definitions.py` · `organize_tier_definitions.py` ·
`reorganize_by_function.py` · `update_tier_localization.py`

**2026-01-17 — first migration wave**
`apply_config_defaults.py` · `create_gold_corpse_defs.py` ·
`create_jewel_definitions.py` · `create_unique_definitions.py` ·
`ensure_hide_tier.py` · `ensure_t0_and_locks.py` · `fix_misc_naming.py` ·
`migrate_gold_corpses.py` · `migrate_misc_items.py` · `migrate_misc_items_v2.py` ·
`resort_tiers.py` · `update_hideable.py` · `update_quest_labyrinth_themes.py` ·
`update_special_currency_themes.py` · `update_theme_categories.py` ·
`verify_and_update_categories.py` · `verify_tier_completeness.py`

**2026-01-24 — theme spike**
`inspect_styles_html.py` · `parse_html_styles.py`

**2026-06 — 3.28 rebuild**
`assign_endgame_tiers.py` · `update_mappings_3_28.py` · `patch_campaign_arealevel.py` ·
`dedupe_class_name.py` · `make_placeholder_categories.py` ·
`insert_missing_nav_categories.py` · `migrate_theme_default.py` ·
`migrate_theme_default_demo.py`

**2026-07 — pipeline repairs**
`ggpk/fix_dead_tier_keys.py` (repaired the 105 dead tier keys in `416a262`)

---

## Why they were kept rather than deleted

They are the record of how the tree got its shape, and several document a decision
that is not written down anywhere else — `ensure_t0_and_locks.py` is where the
`show_in_editor: false` guard came from, `dedupe_class_name.py` is why `item_class`
is canonical. Deleting them loses that. Marking them costs nothing and makes the
hazard obvious at the top of the file.
