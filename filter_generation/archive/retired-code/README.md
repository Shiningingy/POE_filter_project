# Retired code — kept for the trace, on a delete-by clock

Python that is **provably unreachable** and superseded. Moved here rather than deleted so a
wrong call is one `git mv` away from being undone, and so the reasoning survives with the
code instead of only in a commit message.

**Policy (the author's, 2026-08-01): if these sit here long enough that nobody has missed
them, delete them.** Archiving is a grace period, not a second home. Anything still here
after the branch merges and a league ships has earned deletion.

Moved with `git mv`, so `git log --follow` still reaches the full history of each file.

## Contents

| file | what it was | why it is dead |
|---|---|---|
| `__init__.py.txt` | a 252-line filter generator | **A third generator.** Predates even `generate.py`: hardcoded relative Windows paths, the `zh` language code (the app's is `ch`), and `theme_category` read with the wrong fallback. Nothing imported it. It survived ADR-0007's cleanup only because it was named `__init__.py` and read as packaging. |
| `data_loader.py` | GGPK loader for `generate.py` | Its only caller was the Python generator, deleted in ADR-0007. No importers. |
| `refine_sound_map.py` | wrote `Sharket_sound_map_v2.json` | The v2 file **does not exist and never did** — the output was never adopted, and nothing references the name. A tool whose product was thrown away. |
| `migrate_item_overrides.py` | one-shot for workstream C | **Spent, and re-running it is destructive.** It rebuilt `item_overrides` from auto-sound's global table; auto-sound is deleted, so a re-run now writes from nothing. Its `--check` is only a dry-run of the same write ("would write" vs "wrote"), not an independent verifier — so it is not a reason to keep it live. |

## Why `__init__.py` is here as `.txt`

Because an `__init__.py` in this directory would make the archive an **importable package** —
exactly the mistake being corrected. The `.txt` suffix makes it inert: readable, `git
log --follow`-able, and impossible to execute or import by accident.

Removing it also turned `filter_generation/` into a plain directory. That is safe and was
checked: nothing does `import filter_generation`, and every live script is invoked **by
path** (`python filter_generation/create_demo_bundle.py`, `node
filter_generation/generate.mjs`), never as a package module.

## What deliberately stayed behind

| file | why it is live |
|---|---|
| `generate.mjs` | THE CLI. A shell around `filterGenerator.ts` with no logic of its own — keep it that way (ADR-0007). |
| `create_demo_bundle.py` | Bakes the deployed data bundle. Used by CI, by `DEPLOYMENT.md`, and by `test_resolver_equivalence.mjs`. |
| `analyze_trace.py` | Not dead, but **currently BROKEN — see below.** It is the prototype of the derived index that replaces `base_mapping` in workstream C, and the only tool that reports silent tiers. |

## ⚠️ `analyze_trace.py` is broken by a regression in `generate.mjs --trace`

Running it today raises `KeyError: 'tiers'`.

A trace has two halves. `generate.py --trace` emitted both; the Node CLI that replaced it
(ADR-0007, workstream G) emits only the first:

* `blocks` — every block that WAS emitted. ✅ still produced.
* `tiers` — every tier CONSIDERED, each with `{file, emitted, reason, mapped_items}`. ❌ not
  produced any more.

The missing half is the valuable one. It answers *"which tiers carried mapped items and
emitted nothing?"* — the recurring defect in this repo (the 420 divination cards, the 13
silent quivers, the Blueprints rules that matched nothing). Losing it silently is precisely
the class of regression this branch exists to remove, so it is recorded here rather than
discovered later.

Restoring it means an `onTier` observer on `GeneratorData`, symmetric with the existing
`onBlock`, reporting each tier plus **why** it stayed silent (campaign gate / strictness
gate / `excluded_modes` / no items). That reason vocabulary is the fiddly part and is worth
designing against workstream C's needs rather than guessed at now — so it is queued with C,
not done here. `analyze_trace.py` stays in place, unarchived, because it is wanted.

## Untracked scratch files — not archived

`filter_generation/test_generate.py`, `test_generation.filter` and `test_roundtrip.py` sit
**untracked** in the working directory. They are not here because there is nothing to
preserve: git never held them, so there is no history to keep and no revert to protect.
Delete them freely.
