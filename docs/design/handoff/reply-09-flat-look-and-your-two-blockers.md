# Reply 09 — your two blockers were answered in replies 03–08

Good news: **both of your blockers are already resolved**, and have been for several drops. Your note
describes the state of the *first* handoff, so you are missing replies 03 through 08 — that is my
fault for not naming the sequence. Read them in order; the two answers are in reply 03.

## 1. T0's text — **(b), the accent.** You guessed right.

```
T0.painted.text = accent.t0_text ?? accent.solid
```

`"255 0 0"` in the recipe was currency's value leaking into the house row, exactly as you suspected.
It is there for a real reason — `255 170 0` on white is ~1.9:1 — so three accents carry an explicit
`t0_text`: `currency: 255 0 0`, `blight_oils: 150 120 0`, `delirium: 90 90 120`. The other 21 use
their accent directly.

⚠️ **Also on T0: it sets NO border.** An early draft told you the red border was house-fixed. It is
not — the border is reserved for states on every rung.

## 2. `accent.muted` — a formula. `accent.muted_deep` — **retired, never define it.**

```
lum(c)          = 0.2126R + 0.7152G + 0.0722B
desaturate(c,f) = lerp(c, grey(lum(c)), f)
muted           = desaturate(solid, 0.70), then darken 0.10
```

Currency: `255 170 0` → `176 157 119`.

`muted_deep` is gone because **T3 no longer has a private plate** — see reply 04. That is the bigger
change waiting for you.

## ⚠️ Read these before compiling, in this order

| reply | what changed |
|---|---|
| 03 | your two blockers, above |
| 04 | **the plate does not ramp.** Measured from NeverSink: one background per category across ~50 consecutive blocks. Retired `muted_deep`, the T4 lerp, the per-rung alpha ramp, `bg_currency`. |
| 05 | **the ladder is six rungs, T0–T5.** No T6. T3 is Sharket's tan, T4 is his scroll plate kept as-is, T5 is the one addition. |
| 06 | **T5 painted has no plate** — dim accent text + dim accent border, where `state_budget` is empty. Plus `gold`, which never takes a plate at any rung. |
| 07 / 08 | heist is maplike, tiered by AREA from a handpicked list of nine, and **bottoms out at T3** — their contract block draws `MinimapIcon 0 Green Pentagon`. Pentagon leaves reserve. |
| 09 (this) | the flat look, below. |

Both goldens were regenerated across those, and `theme-presets.json` is current — **diff the JSON
rather than re-reading the prose.** One thing worth knowing: it was short six accents until reply 06
(the ones from reply 02 lived only in `accent-category-map.json`). All 24 are in the presets file now.

## New: a flat look for untiered categories

Author's call, and it fixes something the depth rule got wrong: **quest items, relics, incursion
vials, enshrouding crystals are not ranked.** You either need them or you do not, and they are always
shown. Giving them a rung is a category error.

```
painted (quest, vials, crystals, nets, delirium orbs)
  text    accent.solid
  bg      accent.deep @ 240
  border  accent.solid            <- full strength
  size    40
  icon    1 White <accent.shape>
  beam    none

rarity_through (relics, ward bases, stygian vise, grasping mail,
                sacrificial garbs, mirror ring bases, enshrouded gear)
  text    none — rarity shows
  bg      accent.deep @ 240
  border  accent.solid
  size    40
  icon    NONE
  beam    none
```

⚠️ **Half the flat categories are gear**, and both halves of the gear rule apply: no text colour over
rarity, and **no icon at all** — the `equipment` accent declares `shape: null`, so an icon line could
not be written even if we wanted one. Emitting `MinimapIcon 1 White` with no shape is the malformed
line that costs a whole filter load.

**The bright border is the marker.** No rung sets one at FULL accent strength — T5's is deliberately dim — so a full-strength accent border comes to mean
"you need this, it is not worth an amount". That gives the border channel three readings, all
distinguishable: **full accent = flat, dim accent = T5 floor, none = a ranked rung.** Icon is White
because there is no rank to report.

```
block.flat = true      // instead of a rung; skip the rung lookup entirely
```

⚠️ **Depth 1 no longer implies T2/T3 automatically** — check `flat_look.applies_to` first. And **not
every one-rung category is flat**: Legacy and Chancing have one rung because they are *bulk*, and bulk
is a rank. They stay at T5.

## On your compile plan

Agreed on all four steps, and strongly agreed on the side-file diff. One addition: your validator
list should include the two class-dependent rules, since both fail silently —

- `state_budget[class]` non-empty **and** the resolved T5 preset emits `SetBorderColor` → error.
- same test for a `flat` block.
- a `flat` block on a gear-accent category that emits `SetTextColor` → error.
- a `flat` block whose accent has `shape: null` that emits **any** `MinimapIcon` line → error. This is
  the malformed-icon case, so it is the one worth failing the build over.

Your point about changing every colour at once is the right worry. The two categories to look at
first in game are **currency** (two rungs are byte-identical to what ships today, so anything that
looks different there is a bug) and **gold** (the only place `plate: never` is exercised).
