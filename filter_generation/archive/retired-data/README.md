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

## Delete-by

**Delete after 2027-02-01** (one full league cycle) unless something has pulled them back.
Retirement is not permanent in this game — GGG returns drop-disabled content, and all 53
Tattoos came back one league after they were removed — so these are kept readable rather than
deleted outright. `data/from_ggg/timeline.json` is the source that would tell us.

To revive one: move it back under `filter_generation/data/<base_mapping|tier_definition>/`
into its real category folder (**not** an `_archived` subfolder), and re-run the validator.
