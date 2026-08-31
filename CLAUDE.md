# POE Filter Project

## Project invariants (read `CONTEXT.md` before refactoring)

Several "obvious cleanups" here are deliberate. Full glossary + rationale in `CONTEXT.md`; decisions in `docs/adr/`. The load-bearing ones:

- There is **ONE generation engine**: `webapp/frontend/src/utils/filterGenerator.ts`, the same module the browser runs. `filter_generation/generate.mjs` is a CLI shell around it with **no logic of its own** — keep it that way, that is how the old duplication started. Python still does offline data prep (`parsing_tool/`, `create_demo_bundle.py`); it no longer generates. Guarded by `test_generator_fixtures.mjs` (synthetic tree + committed goldens — regenerate with `--update` and **read the diff**) and `test_resolver_equivalence.mjs` (preview == export). (ADR-0007, superseding ADR-0001)
- **`hideable` is a live UI protect-guard, not dead code** — generators ignore it by design; do not delete it. (ADR-0002)
- `hide_at_strictness` is **live, not a mechanism-only gate** — 98 of 422 tiers carry values (every equipment class: gate 1 `regular` = T4 fallback, 2 `semistrict` = T3, 3 `strict` = T2, 5 `uber` = T1). Building at `soft` (index 0) fires none of them, which is why a soft build looks like it never hides. *(Was recorded as "zero values in tier data is intentional"; that stopped being true.)*
- **The game format has rules no test here checks.** All found by loading in game; generation, the validator and parity passed every one. See `reference_poe_filter_format.md`. The load-bearing ones: **Ruthless cannot `Hide`** (GGG forbids it — `HIDE_CMD` is `Minimal`, which still *draws* a label, so emit no style lines on a hide block); an **absent** colour key means "let the game paint it" (441 of 998 theme rows omit `TextColor` so the RARITY colour shows — emitting a default paints over it); a comparison operator needs a **space** before its value (`>=10` is rejected); `CustomAlertSound` paths resolve relative to the **filter's** folder, not this repo; and a `BaseType` must exist in `BaseItemTypes` — **transfigured gem names do not** (they are `GemEffects` rows; match `TransfiguredGem True`). **`Continue` composes PER PROPERTY** (verified in game 2026-08-03): without it the first match wins whole-block and stops; with it, later matching blocks override only the properties they set, so a state can be authored once and layer over every preset — but our generator **cannot emit `Continue` yet**, and the preview/simulator assume one block decides a look.
- App language code is **`'ch'`** (not `'zh'`; `zh` appears only in some data filenames). **Localization is key-first behind a locale engine** (`utils/locales.ts` = registry + per-locale fallback chain + the one `resolve()`; `utils/localization.ts` = the data, one line per string). **No component may branch on a language id** — UI chrome goes in the table, `{en, ch}` data bags go through `resolve()`, and a *dynamic* lookup uses `translate()` (which returns `undefined` on a miss) never `t[expr] || fallback`, because `t` yields the key on a miss and that guard is unreachable. Guarded by `test_locale_coverage.mjs`. (ADR-0008)
- `RuleManager` / `SoundBulkEditor` / `CategoryView` / `ImportForeignFilterView` and the big `localization.ts` are **deliberately not split**. (ADR-0003)
- **Ruthless and Standard are separate content trees**, not one tree with an overlay — they invert their primary axis (Standard 551 `Class` vs 18; Ruthless 382 `BaseType`), and they have different maintainers. Contributor/player work arrives as **modules**, applied only through a **reviewed diff**. Not built yet; the fork waits until Ruthless tuning is done. (ADR-0005)
- **Equipment is three `AreaLevel` layers** (campaign ≤67 / midgame ≥68 / endgame), and **`AreaLevel` decides *where you are* while `ItemLevel` decides *what it can roll*** — they are not interchangeable, because magic drops at area+1 and rare/unique at area+2. **Precision beats ordering**: fix a first-match-wins conflict by adding the condition, not by moving the block. Normal equipment carries `Rarity <= Rare` so it cannot swallow uniques. Priority is `_meta.gen_order`, **category-level only** — split a category in two when its tiers must straddle another (that is what `Crafting Priority` −10 / `Crafting` +10 is). Every `Hide` names a `Class` or `BaseType`; anything unmatched falls to a final show-all net. (ADR-0006)
- GGPK item data joins on **`Id`** only. **Never join the international and CN dumps on `_rid`** — row indices differ on 94% of rows, and the first ~300 align so a spot-check looks fine. English `Name` is ambiguous (413 duplicates). Curation (`base_mapping`) stays **name-keyed** on purpose — the filter matches names, and several `Id`s can share one. (ADR-0004)

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues (`Shiningingy/POE_filter_project`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
