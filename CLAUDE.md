# POE Filter Project

## Project invariants (read `CONTEXT.md` before refactoring)

Several "obvious cleanups" here are deliberate. Full glossary + rationale in `CONTEXT.md`; decisions in `docs/adr/`. The load-bearing ones:

- The generator is **intentionally duplicated** (`generate.py` ↔ `filterGenerator.ts`) and kept in **byte-parity** (`test_generator_parity.mjs`) — edit both, run the test. Collapsing to one engine is an ADR-level migration, not a cleanup. (ADR-0001)
- **`hideable` is a live UI protect-guard, not dead code** — generators ignore it by design; do not delete it. (ADR-0002)
- `hide_at_strictness` having **zero values in tier data is intentional** (mechanism-only gate).
- App language code is **`'ch'`** (not `'zh'`; `zh` appears only in some data filenames).
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
