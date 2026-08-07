# READ ME FIRST — importing this kit

Everything in this folder is current as of 2026-08-07. If you only read one file, read this one,
then `reply-19-six-link-icon-grant.md` (answers reply 11), then `reply-18-swap-deadlock.md`.

## Latest round (reply 19) — two calls

- **6-Link → T1. Delete `Recipes.json`'s override entirely** — it takes the plain depth-3 value
  template: 6-Link T1, 6-Socket T2, RGB Linked T4. The `linked` state threshold was set at six on
  the words "a 6-link is a chase drop"; the rung has to pay that. 6-Socket at T2 puts the
  white-cyan plate on the item the accent was split off for.
- **Suppress the `linked` state on the 6-Link block** — its own condition *is* the state's
  condition, so the border would say what the block already is. Keeps it free for `corrupted`.
  New rule: `_states_can_be_redundant`.
- **`icon_floor` is a GRANT, not a gate.** `rung_recipes.T3.icon = null` is the default; a
  per-category floor overrides it. So the map bands draw as specified — Red T11–17, Yellow
  T6–10, White T1–5 — with size from the rung (2 at T3) and colour from the band.
- **New named pattern: `_overrides_are_written_against_contents`.** Chancing, Magic Net and
  Recipes were all overrides written against a category's *name* rather than what its file holds.
  The tell is a note that only restates the category name.
- **Build order for maps accepted as given**: special-map tier first, then move Vaal Temple, then
  delete the T17 rule, then the icon bands.

## Latest round (reply 18) — the swap deadlock, resolved by restating a rule

- **`_swaps_never_paint_the_house_rungs` is about the PLATE, not the rung.** It reads "never on
  T0 or T1"; it *means* "never over a house plate". Those were one sentence until maps, because
  every rung used to supply its own plate. **No map wears a house plate at any rung**, so a
  special map is swap-eligible everywhere, including T1. Unweakened for every other accent.
- **Special maps take their own band's rung, floored at T2** — not a flat T2, which would make a
  T16 quieter when modified. General rule: *a claim may raise an item's rung and must never
  lower it.*
- **T17 and Vaal Temple ≥16 go on the ramp — delete the `MapTier == 17` rule.** A T17 on the
  house red loses its tier, which is what this exception exists to prevent. The ramp's top anchor
  `255 255 255` is the loudest plate in the system anyway.
- **Correction to `t17_falls_out`:** T17 is a *tier*, not a claim — top anchor, **black** text.
  The swap fires on it only if it is also modified.
- **Logbooks leave the maps accent for `expedition`** (no MapTier). The enchanted logbook is the
  enchanted *state* on the same block, not a second tier.
- **Build the icon bands on the same rules** — three values (Red T11–17, Yellow T6–10, White
  T1–5), so plate and icon never disagree.

## Latest round (reply 17) — maps change shape

- **The map TIER takes the plate.** New `maps_tier_ramp` in the presets: **7 anchors, the rest
  interpolated** (never 16 authored values). Anchors are the three atlas bands, so plate and icon
  colour now agree. Luminance ascends with tier and never doubles back, so `_plate_rule` holds.
- **`Maps/Base Maps.json` needs no change** — it is a *size* ladder now; only the plate is
  overridden. The rung still owns size, icon and beam.
- **Maps stop being rarity-through and start painting** (black text). This repairs a
  contradiction already in the kit: the invariant said only gear is rarity-through, the maps
  exception claimed it too. Invariant was right.
- **Fifth text swap: `map_special` = `110 20 140`**, deep violet, for influenced / enchanted /
  8-mod / Vaal Temple / Elder / Shaper / memory / blighted. A T17 renders violet-on-white by
  construction — no second purple authored.
- **New general rule:** a swap colour is chosen for **the plate it speaks against** — the channel
  is the constant, never the hex. (`120 235 210` is 9.99:1 on gear's dark plate and ~1.3:1 on a
  light map plate.)
- **`Curse of the Allflame/Bottles.json (1)` → T0**, and its depth-1 allowlist entry is removed
  (it has an override now, so the warning cannot fire).
- **Exception count is unchanged at 7.** The maps exception grew; it was not added to.

## Latest round (reply 16) — three changes

- **Gear T0 takes the HOUSE rung, T1 does not.** T0 is categorical ("nothing else matters" — must
  render identically in every family); T1 is relative ("top of this category" — renders in the
  family's vocabulary). `gear_ladder.what_we_take` no longer contradicts `rung_recipes.T0`.
  **Campaign T1 keeps its dark plate.**
- **The crafting swap follows the CLAIM, not the rung.** It fires on blocks asserting a property of
  the *instance* (percentile, quality, memory strands) — effective rungs **T2–T4**. The four ilvl
  bands at T5 keep rarity-through. Previously scoped T2–T3, which cut the memory strands in half.
- **Two stale arrays corrected**: Crafting Priority is `T0 T2 T3 T3 T4 T4 T5 T5 T5 T5`, Magic Net
  is `(2)` / `T3 T5`, `quality.only_on_rungs` is `["T2"]`. New rule `overrides._note_discipline`:
  a note must never restate a value that lives in an array.

## The crafting question is answered: YES, with a narrower scope

A fourth text swap, `crafting`, on the **same `120 235 210` as quality** — not a 27th accent.
Condition is the BLOCK (*"originates in Crafting Priority"*), not a property threshold.

**It fires on T2–T4** (revised from T2–T3 — see reply 16), under a rule that governs all four swaps:

> `_swaps_never_paint_the_house_rungs` — a swap only fires where the plate is NEUTRAL, never on
> T0 or T1. Those rungs are house-fixed idioms whose own colours are already the signal.

So crafting loses rarity-through **at T2–T3 only**; the four ilvl bands keep it at T4/T5, where
rarity is the only thing distinguishing one i84 base from another. That is deliberately narrower
than FilterBlade's whole-purpose version.

Two consequences for the build:

- **`Equipment/Crafting Priority.json` opens at T0**: `T0 T2 T3 T3 T4 T4 T5 T5 T5 T5`. Only the
  top row moved (Perfect Defence → T0, the author's red-on-white). Over Quality stays at T2.
- **`_q21_scope` narrows T0–T2 → T2.** Nothing actually moves; Over Quality sits at T2.

Also settled this round: `Magic Net` annotation is **`(2)`** and its rungs **`T3 T5`** (override
kept deliberately, for its note); `painted_t3_needs_t2` is scoped **per theme category**, so Base
Jewels is legal; the four depth-1 T2 warnings are **confirmed and allowlisted** individually —
do not widen the check.

## What to import, and in what order

| file | what it owns |
|---|---|
| `theme-presets.json` | the LOOKS — 26 accents, 6 rung recipes, 5 state borders, 3 text swaps, 7 exceptions, the flat look, the gear ladder |
| `accent-category-map.json` | the ROUTING — which category takes which accent, and `rung_by_depth` |
| `theme-standard.md` | the prose standard. **Was stale; corrected 2026-08-06** (T6 → T0–T5 in 8 places, shape list, currency table). Where prose and JSON disagree, the JSON wins — permanently, not just this round. |
| `reply-14-the-settled-tree.md` | answers to everything in your last two replies |

**`rung_by_depth` lives in `accent-category-map.json` and only there.** The copy in
`theme-presets.json` is now a pointer that explains why. If you find yourself reading a second
copy, something has gone backwards.

## Two accents were added AFTER reply 14 was written

The designer flagged both from the board; neither is in reply 14.

**`tainted` — `205 40 95`, muted `178 112 150`, deep `46 6 24`, Diamond, Red beam.**
`Tainted Currency` moves off `currency` onto its own accent. A Tainted Mythic Orb was rendering
identically to an ordinary orb at every rung. It keeps currency's **Diamond** deliberately — it
IS currency — and separates on hue alone.

⚠️ This **retires an exception**. `_category_exceptions.corrupted_tainted` ("a STATE, not a
category: grey plate + red border") is gone. The old treatment said "corrupted" by *giving up*
the hue, which is what made it invisible. There are **7 exceptions now, not 8** — if your
validator counts them, update the expected number.

**`recipes` — `220 238 242`, muted `165 182 188`, deep `26 38 42`, t0_text `40 105 120`, Moon, White beam.**
`Vendor Recipes` moves off `vendor`. FilterBlade and Sharket both put a white-ish plate on
6-socket and RGB and players already read it. `Legacy` and `Chancing` stay on `vendor` grey.

⚠️ This **removes a rung override**. `Equipment/VendorRecipes/Recipes.json` previously forced
`T4 T5 T5`; on its own accent it is an ordinary 3-deep value ladder and the template gives
**T1 (6-Link) · T2 (6-Socket, the white-cyan plate) · T4 (RGB Linked)**. Delete the override
rather than keeping both.

⚠️ **Moon comes out of shape reserve.** `_shape_reserve` is now 10 assigned, 1 held
(`UpsideDownHouse`). And `t0_text` is now on **14** accents, not 13.

## The five things most likely to bite on import

1. **Chancing is repathed.** `Equipment/VendorRecipes/Chancing.json`, not `Currency/Chancing.json`.
   Drop your alias. Rung unchanged: **T5**.
2. **`Rare Equipment` is the only new accent routing.** One line added, 23 removed, plus `Breach`
   removed (no such theme category exists any more). 52 entries, and the set should match your
   live categories exactly — that equality is an assertion, not a fallback. See
   `_invariants.no_silent_misses`.
3. **Gear depth 2 changed** `T3 T4` → `T3 T5`. Two-tier ladders never use adjacent rungs. If you
   cached the old table anywhere, this is the line that moved.
4. **Depth 3 is `T1 T2 T4`.** Both files agreed to disagree on this; the map's old `T1 T3 T4` was
   the wrong one. Reasoning is in reply 14 §1.
5. **`Fractured` and `Rare Equipment` sharing rows is correct** and must not be "fixed". Same
   accent, same rank, same look, with the fractured state border carrying the property.

## What we would like back from you

- **What the in-game load turns up.** Your own caveat is the right one: green is not evidence, and
  both accents added this round have never been seen on a real drop. `205 40 95` sits 11° from
  ritual — a number worth trusting on a swatch board and not yet on the ground.
- **Confirmation that gold is genuinely auto-pickup in Ruthless.** The whole `plate: never`
  exception rests on it, and it is the one assumption in the kit we cannot check ourselves.
- **The icon-floor sweep numbers after this drop**, whenever the per-item sound pass lands. The
  biggest single subtraction is still Legacy: 17 of 17 blocks draw an icon *and* a beam on the
  `vendor` accent, whose floor is `none`.
- **The border ratio, every drop.** Now 17 of 422, so states compose on 405. It moved with the
  tree and the ratio held through two accent splits — that is the health check for the whole
  one-pass model. If it starts falling, something is spending the border again.

## Two composition calls that are yours, not ours

- **Ward bases** — keep the cross-class Ward grouping or split on item class. The look needs
  nothing either way; `Expedition Ward-Bases` already carries its own accent rather than a gear
  group hue.
- **`Aggressive Magic Hide`** points at a Tier 9 row `Campaign` does not have. It reads as a hide
  but is not flagged as one. Flag it and it emits `Minimal` with no style lines; if it is meant to
  show, it is Campaign **T5**.
