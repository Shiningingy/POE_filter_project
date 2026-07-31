# ADR-0006: Equipment is three AreaLevel layers; precision beats ordering

## Status

Accepted (decided 2026-07-30). **Not yet implemented** — the equipment rewrite is
the work this ADR exists to govern. The supporting fixes it depends on have
landed (`b1056e9`, `744f136`, `6ce5b20`).

## Context

The equipment categories were **initialised as empty scaffolding and never
filled**. That is the single fact that explains most of what looks broken: a
category with no base types and no rules is not a bug, it is unstarted work. The
FilterBlade rare ladder was ported on top of that scaffolding (`92204e0`) without
a structure to port it *into*, and the result does not survive contact with real
content.

Measured on the tree as it stood:

| | count |
|---|---|
| tiers gating `ItemLevel` | 172 |
| tiers gating `AreaLevel` | **0** |
| crafting bases across two categories | 171 |
| blocks able to steal a unique from the Uniques ladder | 65 |
| position of the 6-link block, inside a rare ladder spanning #5–268 | **#215** |

The last two are the interesting ones, because they are the same mistake:
**relying on emission order to express something that belongs in a condition.**

## Decision

### 1. Equipment is three layers, and the boundary is `AreaLevel`

| layer | gate | contents |
|---|---|---|
| **Campaign** | `AreaLevel <= 67` | early rares; very early white + magic; occasional low-value currency emphasis |
| **Midgame** | `AreaLevel >= 68` | rares on good bases, in two sub-levels: (a) essentially all rares — the vendor/shard layer, (b) hide bad weapons |
| **Endgame** | `AreaLevel >= 68` | crafting bases; catches and emphasises good bases. With midgame fully off, only top-base rares plus optimal normal/magic crafting bases |

Peeling midgame away to leave endgame is **not a new mechanism** — it is
`hide_at_strictness` (ADR-less, see the strictness ladder). Midgame tiers gate at
a lower strictness than endgame tiers.

### 2. `AreaLevel` decides *where you are*; `ItemLevel` decides *what it can roll*

This is the rule that keeps the two from being used interchangeably:

- **`AreaLevel`** — the campaign / midgame / endgame boundary. It is the precise
  question, because a magic monster drops at area+1 and a rare or unique at
  area+2, so `ItemLevel <= 67` leaks items out of a level-67 zone.
- **`ItemLevel`** — mod availability only. Body armour needs ilvl 86 for T1 life
  and defence mods; most weapons need 83; bows 86. Those thresholds are
  per-slot and derived from `Mods.csv.required_level`, not guessed.

An `ItemLevel` floor is **not** needed on the layer boundary. `ItemLevel >=
AreaLevel` holds naturally, so a low-ilvl base cannot appear in a high-level area
unless a player hand-drops it from a stash.

### 3. Precision beats ordering

Under first-match-wins it is tempting to fix a conflict by moving a block earlier.
Do not. **Add the condition that makes the block mean what it says.** Ordering is
a coarse, global lever; a condition is local and survives reordering.

Two concrete instances, both fixed:

- Normal equipment carries **`Rarity <= Rare`**, so it cannot swallow the unique
  of a base it lists. Without it, a unique Vaal Regalia rendered as a T3 body
  armour base. This dropped unique-stealing blocks from 65 to 1.
- Tier-level `conditions` are emitted **only on the base block**. Auto-injected
  sound rules author no conditions of their own, so 41 sound blocks emitted with
  no gating at all — a unique Stygian Vise rendered as an ilvl-86 crafting base.
  Those rules now inherit the tier's conditions.

### 4. Priority is `_meta.gen_order`, and it is category-level

Generation order is **decoupled from editor/nav order** on purpose. `gen_order`
sorts categories ascending, then by path; absent means 0.

Live values: `_campaign` −100 · `VendorRecipes/Recipes` (6L/6S/RGB) −50 ·
`Crafting Priority` −10 · everything else 0 · `_legacy` / `_unclassified` +100.

There is **no per-tier priority**. When a category's tiers must straddle another
category, split the category in two — that is exactly what `Crafting Priority`
(−10) and `Crafting` (+10) are. Do not add per-tier priority until splitting
stops being sufficient.

**6-link / 6-socket / 3-linked-RGB outrank the entire equipment ladder**, not
merely the hides: an earlier `Show` steals an item just as effectively as a
`Hide`.

### 5. Hides must be precise, and one final safety net catches the rest

Every `Hide` names what it hides — a `Class` or a `BaseType`, never a bare
`Rarity` or level band. Anything unmatched falls through to a **final show-all
block**, so new or uncurated items appear rather than vanish.

This inverts the usual filter instinct. It is correct here because the cost of a
missed drop in Ruthless is far higher than the cost of a little noise, and
because it makes the filter fail visibly instead of silently.

The last block today is `[99999]` — a magenta **placeholder**, not a
player-facing net. Replacing it is part of this work.

### 6. Rarity exceptions worth stating

- Flasks and tinctures roll **Normal / Magic / Unique** only. `Rarity <= Rare`
  reads as "not unique" there; a flask rule gating `Rarity Rare` matches nothing.
- Uniques **can** be influenced; they **cannot** be fractured.
- Normal and abyss jewels always show at any rarity — they are genuinely rare
  drops. Hiding magic jewels is an option, expressed by naming the class.

## Consequences

- The 117 tiers gating `ItemLevel >= 68` as a layer boundary must move to
  `AreaLevel >= 68`. `ItemLevel` survives only where mod availability is the
  question.
- Crafting shrinks from 171 bases toward roughly the top base per slot, gated by
  per-slot thresholds derived from `Mods.csv`.
- `Equipment/Special/Influenced` is replaced by one generic
  `HasInfluence` rule: all ten of its bases already sit in the per-class ladders,
  and Hubris Circlet is a `Tier 2 Helmets` base, not a chase item.
- Empty scaffolding categories are filled or deleted, not left to fall through.

## Alternatives rejected

**Diagnose and patch the existing tree.** Rejected: most of what looks wrong is
unstarted rather than broken, so there is little to preserve, and patching leaves
the structural cause in place.

**Adopt FilterBlade's model wholesale.** Rejected for the ladder: their flat
86/85/84/83 matrix ignores that the useful item level differs per slot. Their
softcore file remains the reference for *tiering meta*, and their Ruthless file
for *what exists in Ruthless* — which is how the Heist exclusions were caught.

**Make tier conditions scope every block in the tier.** Deferred, not rejected.
It would fix the leak class permanently rather than per-rule, but it changes the
meaning of every authored rule that deliberately widens beyond its tier, so it
wants its own ADR and a full-filter diff review.
