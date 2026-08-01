# ADR-0007: One generation engine — the Python generator is retired

## Status
Accepted. **Supersedes [ADR-0001](0001-dual-generator-parity.md).**

## Context

ADR-0001 kept two implementations of filter generation — `filter_generation/generate.py`
and `webapp/frontend/src/utils/filterGenerator.ts` — byte-identical, guarded by
`test_generator_parity.mjs`. It anticipated this reversal: *"Superseding this (collapse to
a single TS engine, Python doing only offline data prep) is a valid future direction — but
it rewires the local build to run on Node, so treat it as a deliberate migration with its
own ADR, not a cleanup."* This is that ADR.

What changed since:

1. **The tax came due.** Every fix in the theme-pipeline rewrite had to be written twice.
   That is the "known, accepted" cost ADR-0001 named, and it is real, but on its own it
   would not justify a reversal.

2. **The oracle argument weakened, then inverted.** Parity's value was that Python was an
   *independent* implementation. Workstream A collapsed four style resolvers into one
   (`filterStyle.ts`), so the preview, the simulator and the TS generator now share a core
   — and the parity test's remaining reach was the generator pair alone.

3. **Parity cannot see a shared mistake, and there was one.** Writing the replacement
   fixture immediately surfaced that `match_modes` is *written* to `base_mapping/_meta` by
   the editor and *read* from `tier_definition/_meta` by the generator. The Partial match
   toggle had never worked: the item card showed a Partial badge and the filter emitted
   `BaseType ==`. Both engines were wrong identically, so parity was green throughout.
   A test whose question is "do these two agree?" is structurally blind to that, and it is
   the most common failure mode in this codebase — a control that looks live and is not.

4. **The browser engine is not optional.** The app ships backend-free, so
   `filterGenerator.ts` must exist. `generate.py` is the copy, and the copy is the one that
   can go.

## Decision

**`webapp/frontend/src/utils/filterGenerator.ts` is the only generation engine.**

- `filter_generation/generate.py` is **deleted**, along with `test_generator_parity.mjs`.
- `filter_generation/generate.mjs` is the CLI: same flags (`--mode`, `--game-version`,
  `--strictness`, `--language`, `--leveling-selection`, plus `--trace` and `--out`). It
  holds **no generation logic** — it loads `filter_generation/data/**`, calls
  `generateFilter`, writes the file. A CLI with its own logic is how the duplication
  started.
- `POST /api/generate` runs that CLI. The local editor and the deployed site now execute
  the same code, so they cannot disagree.
- **Python keeps offline data prep** — exactly the split ADR-0001 predicted: `parsing_tool/`
  (GGPK ingest, reconciliation, `validate_curation.py`) and `create_demo_bundle.py`.
  Retiring the generator is not retiring Python.

### What replaced the guard

Parity is gone, so two tests carry its weight, and they are deliberately different in kind:

| test | question | catches |
|---|---|---|
| `test_generator_fixtures.mjs` | does the generator emit what we decided it should? | a change in the engine's behaviour |
| `test_resolver_equivalence.mjs` | do the editor preview and the export agree? | preview drifting from output |

`test_generator_fixtures.mjs` runs the engine over a **synthetic** tree
(`test_fixtures/generator/`) with committed golden output. It is not a golden over the
real filter on purpose: this is a filter editor, tier edits are the most frequent change
there is, and a golden that everyone regenerates without reading is not a test. Invented
items and invented tiers mean a data edit never touches it.

**Be honest about what equivalence proves now.** Both sides call `filterStyle.ts`, so it
can no longer cross-check the core — the fixtures do that. What it still proves is the
thing that actually broke: preview and export must feed the core the *same arguments*.
Every divergence workstream A found was of that kind.

`generate.py --trace` was the equivalence test's oracle. That capability moved into the
engine as an opt-in `onBlock` hook on `GeneratorData`, inert when absent.

## Consequences

- **Node is now required to build the filter locally.** It was already required to run the
  app; it is now required for `/api/generate` too. The backend says so by name if `node`
  is missing (`NODE=` overrides the lookup).
- **The CLI compiles TypeScript on each run** (~200ms via esbuild, from
  `webapp/frontend/node_modules`). That cost buys the guarantee that the CLI cannot drift
  from the shipping engine, because it *is* the shipping engine.
- **A shared bug now has no second opinion.** This is the real cost, and it is why the
  fixture landed *before* the deletion rather than after. Fixtures pin behaviour against a
  decision; parity only pinned two programs to each other.
- **`base_theme` started working.** `generate.py` read settings from
  `data/config/settings.json`, a path that does not exist, so it always fell back to
  `sharket`. The CLI reads `filter_generation/data/settings.json`, where the app writes it.
- **One-shots that imported the generator are gone.** `reseed_tier_styles.py` (workstream
  B) had already run; git history and `docs/design/theme-pipeline-rewrite.md` record what
  it did.
- A review recommending "restore the Python generator for safety" should read point 3
  above: the duplication did not provide that safety.

## Evidence

Before deleting anything, the CLI was compared against `generate.py` across a matrix
wider than the parity test covered — **22/22 byte-identical** (newline-normalised; Python's
`write_text` applied Windows CRLF translation, git stores LF either way):

- both modes × all 7 strictness levels (14)
- both languages (2)
- both modes × 3 campaign selections: none, picked, `hide_unselected` (6)
