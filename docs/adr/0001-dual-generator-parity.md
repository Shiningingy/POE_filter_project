# ADR-0001: The filter generator is duplicated in Python and TypeScript, kept in byte-parity

## Status
Accepted.

## Context
The app ships backend-free (a static site), so the filter must be generatable in the
browser. But the data pipeline, local dev, and build tooling are Python. A single shared
engine would require either running Python in the browser (not viable) or moving the whole
build pipeline onto Node (a large migration).

## Decision
Maintain two implementations of the same generation logic:
- `filter_generation/generate.py` — Python: the reference/oracle and the local CLI build
  (`--mode`, `--strictness`, `--leveling-selection`, `create_demo_bundle.py`).
- `webapp/frontend/src/utils/filterGenerator.ts` — TypeScript: the engine that runs in
  every visitor's browser (the permanent shipping engine).

They are kept **byte-for-byte identical** on shared inputs, guarded by
`webapp/frontend/test_generator_parity.mjs` (run it whenever either side changes).

## Consequences
- Any generation change is a two-file change plus a parity-test run. This is a known,
  accepted tax.
- Divergence is a real risk — it has shipped before (a `SetBackgroundColor` mismatch slipped
  in when the parity test wasn't run after a commit). Mitigation: keep the parity test green
  on every change; a pre-commit/CI hook would make the guard unmissable.
- **Superseding this** (collapse to a single TS engine, Python doing only offline data prep)
  is a valid future direction — but it rewires the local build to run on Node, so treat it
  as a deliberate migration with its own ADR, not a cleanup. A review recommending "merge the
  two generators" should reference this ADR rather than assume the duplication is accidental.
