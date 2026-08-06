# READ ME FIRST — importing this kit

Everything in this folder is current as of 2026-08-06. If you only read one file, read this one,
then `reply-14-the-settled-tree.md`.

## What to import, and in what order

| file | what it owns |
|---|---|
| `theme-presets.json` | the LOOKS — 26 accents, 6 rung recipes, 5 state borders, 3 text swaps, 7 exceptions, the flat look, the gear ladder |
| `accent-category-map.json` | the ROUTING — which category takes which accent, and `rung_by_depth` |
| `theme-standard.md` | the prose standard, with the reasoning behind each rule |
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

- **Confirmation that gold is genuinely auto-pickup in Ruthless.** The whole `plate: never`
  exception rests on it, and it is the one assumption in the kit we cannot check ourselves.
- **The icon-floor sweep numbers after this drop**, whenever the per-item sound pass lands. The
  biggest single subtraction is still Legacy: 17 of 17 blocks draw an icon *and* a beam on the
  `vendor` accent, whose floor is `none`.
- **The border ratio after the reshape.** It was 15 of 411 blocks setting their own border, so
  states compose on 396. That ratio is the health check for the whole one-pass model — if it
  starts falling, something is spending the border again.
- **Anything the in-game load turns up on the two new accents.** They are the only values in this
  drop that have never been seen on a real drop, and `205 40 95` in particular was chosen against
  measured neighbours rather than in a map.

## Two composition calls that are yours, not ours

- **Ward bases** — keep the cross-class Ward grouping or split on item class. The look needs
  nothing either way; `Expedition Ward-Bases` already carries its own accent rather than a gear
  group hue.
- **`Aggressive Magic Hide`** points at a Tier 9 row `Campaign` does not have. It reads as a hide
  but is not flagged as one. Flag it and it emits `Minimal` with no style lines; if it is meant to
  show, it is Campaign **T5**.
