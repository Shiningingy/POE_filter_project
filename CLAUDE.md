# POE Filter Project

## Project invariants (read `CONTEXT.md` before refactoring)

Several "obvious cleanups" here are deliberate. Full glossary + rationale in `CONTEXT.md`; decisions in `docs/adr/`. The load-bearing ones:

- The generator is **intentionally duplicated** (`generate.py` ↔ `filterGenerator.ts`) and kept in **byte-parity** (`test_generator_parity.mjs`) — edit both, run the test. Collapsing to one engine is an ADR-level migration, not a cleanup. (ADR-0001)
- **`hideable` is a live UI protect-guard, not dead code** — generators ignore it by design; do not delete it. (ADR-0002)
- `hide_at_strictness` having **zero values in tier data is intentional** (mechanism-only gate).
- App language code is **`'ch'`** (not `'zh'`; `zh` appears only in some data filenames).
- `RuleManager` / `SoundBulkEditor` / `CategoryView` / `ImportForeignFilterView` and the big `localization.ts` are **deliberately not split**. (ADR-0003)

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues (`Shiningingy/POE_filter_project`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
