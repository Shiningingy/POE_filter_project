# Standard-only content, parked until the Standard tree forks

Curated content that **does not drop in Ruthless**, moved out of `filter_generation/data/`
so no generator, editor, or validator sees it.

This is not deletion. Ruthless and Standard are separate content trees (ADR-0005), and the
fork waits until Ruthless tuning is done. When it happens, these files move back into the
Standard tree's `base_mapping/` and `tier_definition/` — the directory layout here mirrors
the data tree exactly so the move is a rename, not a rewrite.

## Why it left `data/`

Living under `data/…/_archived/` was not enough. `excluded_modes: ["ruthless"]` kept it out
of the shipping filter, but the file was still **walked** — by the generator in `standard`
mode, by the editor, and by `parsing_tool/validate_curation.py`, which is what surfaced the
defect below. Content nobody is maintaining should not be able to fail a check on content
that ships.

## Contents

| directory | what it is |
|---|---|
| `base_mapping/Divination Cards/Cards.json` | 450 cards → tiers, 420+ official `ch` names, 10 curated per-card sound rules |
| `tier_definition/Divination Cards/Cards.json` | the T0–T4 + Hide card ladder and its styling |

## ⚠️ Known defect — do not "fix" it with a rename

420 of the 450 cards map to **`Tier 1 Divination Cards`**, a tier key the category does not
define (it defines `Tier 1 Cards`). Under a non-underscore folder an undefined tier key is
dropped, so those 420 cards emitted **nothing** the whole time they were in the tree.

The tempting one-character fix — rename the key to `Tier 1 Cards` — is **wrong**. It would
silently promote all 420 cards to the highest-value tier. Those cards were bulk-imported and
never tiered; only the 30 on real tier keys were curated. Tiering them is real work and
belongs to whoever forks the Standard tree.

The 420 official Chinese card names in `_meta.localization.ch` are GGPK-derived and correct —
they are the part of this file worth keeping.
