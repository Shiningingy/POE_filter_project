# Retired data — out of the generator's reach

⚠️ **These files used to live in `filter_generation/data/**/_archived/`, and the generator
walked straight into them.** A folder named `_archived` inside the data tree is not a signal
to anything — `loadTree()` in `generate.mjs` and the demo-bundle baker both recurse
unconditionally, so `Currency/_archived/Breach.json` was emitting **four live blocks** into
every shipped filter. Found while measuring emission order for the theme compile.

The fix is location, not code: moving them here removes the trap outright rather than teaching
two independent loaders about a naming convention. `_campaign`, `_decorators` and `_legacy` are
all underscore-prefixed and all **live**, so "skip underscored directories" would have been the
wrong rule.

## What is here, and why

| file | why retired |
|---|---|
| `*-Currency-Breach.json` | Breach splinters and blessings. Retired with the Breach rework — confirmed by the author 2026-08-03. The designer's `breach` accent is now "foulborn uniques and wombgifts only, since splinters are drop-disabled". |
| `*-Equipment-Synthesised.json` | Synthesised bases. Was already emitting nothing. |
| `rule_templates.json`, `rule_templates_v3.yaml` | The editor's OLD condition vocabulary, superseded by `data/filter_conditions.yaml` (which says in its own header that it is the single source for both the rule editor and the simulator). See below — these are the one entry here that must **not** be revived. |

## ⚠️ `rule_templates.*` — retired because it was a trap, not because it went quiet

Unlike the retirements above, this pair was still **wired in**. `/api/rule-templates` served
`filter_conditions.yaml` normally but fell back to `rule_templates.json` whenever the schema
failed to load, and that file was two leagues stale:

- it spelled the unique flags **`IsReplica` / `IsFoulborn`**; the game knows `Replica` /
  `Foulborn`, so either pick wrote a line PoE1 rejects;
- it offered five **PoE2-only** keywords — `WaystoneTier`, `UnidentifiedItemTier`,
  `TwiceCorrupted`, `IsVaalUnique`, `AlwaysShow` — which `filter_conditions.yaml` lists under
  *"EXCLUDED on purpose (do not re-add without checking)"*;
- it was missing 20+ conditions the schema offers, including `BaseType`, every base-defence
  stat, and `MemoryStrands`.

The fallback never fired, so nothing ever reported it. A silent drop to stale data is the
bug class that has cost this project the most (`create_demo_bundle.py` no-opping under a green
parity suite; `clientData.ts` drifting from `main.py`), so the fallback is now a **503**, and
`parsing_tool/check_condition_schema.py` fails if either file reappears under `data/`.

**No delete-by date, and no revive path.** The other rows here are retired *content* that GGG
may bring back; this is a superseded *mechanism*. It is kept only so the next person who finds
`IsReplica` in git history can see what it was and why it went.

## Delete-by

**Delete after 2027-02-01** (one full league cycle) unless something has pulled them back.
Retirement is not permanent in this game — GGG returns drop-disabled content, and all 53
Tattoos came back one league after they were removed — so these are kept readable rather than
deleted outright.

⚠️ **The revive check cannot be run against `data/from_ggg/timeline.json` yet, and the Breach
retirement is not corroborated by it.** The timeline contains **no** occurrence of `Splinter`,
`Blessing` or `Breachstone`, and that absence proves nothing, because:

- `3.28.0.removed_items` is `_complete: false` — 73 items captured, the rest truncated as
  "… and 145 map names";
- `3.28.0.renamed_items` is `_complete: false`, and its own truncation note reads *"multiple
  Breach Scarab renamings"*, so Breach content **is** inside the part that was cut;
- only 8 of the 34 indexed threads (3.22–3.29) have been parsed at all.

The timeline's own rule applies here: *never conclude "not removed" from an incomplete list.*
So the retirement above rests on the **author's confirmation (2026-08-03)** and the designer's
note that splinters are drop-disabled — not on the feed. That is good enough to retire on; it
is **not** good enough to delete on.

Before acting on the delete-by date, close the gap: re-fetch the truncated 3.28 sections
(thread ids are in `data/from_ggg/thread_index.json`; raw post bodies were not kept, so this
needs a refetch), re-run `parsing_tool/ggg_filter_info/reconcile.py`, and confirm the seven
names below appear as removed.

To revive one: move it back under `filter_generation/data/<base_mapping|tier_definition>/`
into its real category folder (**not** an `_archived` subfolder), and re-run the validator.
