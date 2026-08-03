# Reply 04 — measured NeverSink on deep categories, and it changed the design

You asked (fairly, three times) why T4 and T5 kept reading brighter than T3. I stopped adjusting
values and went and measured what FilterBlade does on categories with four or more tiers.

## What they actually do: the plate does not ramp

```
(STYLE) ABYSS/NeverSink's filter - 0-SOFT .filter
  line 1040  SetBackgroundColor 47 0 74 255
  line 1058  SetBackgroundColor 47 0 74 255
  ...
  line 1823  SetBackgroundColor 47 0 74 255     <- ~50 consecutive blocks, one value
```

**One plate per category, held constant across the whole ladder.** `40 0 40`, `20 20 0` and
`0 40 15` behave identically. Alpha is `255` almost everywhere. 77,522 `SetBackgroundColor` lines
across their filters and the plate is a *category* signal, never a tier signal.

Tier is carried by font size, icon, beam, and by whether the block survives strictness at all.

## Why that fixes the thing you kept seeing

My ladder ramped the plate across T2→T5. That forces **every adjacent pair to be compared** — five
plates, four comparisons, each one a chance to come out wrong. Three passes on T4/T5 and it was
still wrong, because the problem was structural rather than a bad value.

**T3, T4 and T5 now share one plate** — `accent.deep @ 240` — and differ only in text:

```
T2   0 0 0        on accent.solid    <- the ONE bright-to-dark step in the ladder
T3   accent.solid on accent.deep
T4   accent.muted on accent.deep
T5   accent.muted darkened .15 on accent.deep
T6   122 118 112  on the house grey
```

Currency: 176 → 158 → 135 → 117 luminance, chroma falling with it. One step instead of four.

## What this retires on your side

Four transforms, gone:

- `accent.muted_deep` — **never define it.** Nothing needs it now.
- `accent lerp(solid, deep, 0.72)` — was T4's plate. Gone.
- the per-rung alpha ramp `240/235/230/225/215` — the shared plate is a flat **240**.
- `bg_currency` — currency no longer special-cases its T3 plate.

`accent.muted` survives and is now **text only**, same formula as reply 03.

For `rarity_through` the text belongs to the game, so the rung is carried by **plate alpha** —
`245 / 240 / 225 / 210` on the same `accent.deep` — plus size and icon. ⚠️ **Not the border.** Gear
is the only class holding all five state borders; if the rung spent the border, your five `Continue`
deviations would have nothing to layer onto on exactly the class that needs them. §6's invariant
holds without exception.

## ⚠️ Two goldens move

- **currency T3** — leaves Sharket's tan `170 158 130` for `accent.solid` text on `accent.deep`.
- **currency T6** — text dims `150 145 138` → `122 118 112` so T5 can clear it.

Everything else in currency is unchanged, but your byte-identical test needs regenerating on those
two rungs. Sorry — this is the last structural change; it came from evidence rather than taste,
which is why I would rather take it now than ship a ladder that reads wrong.

## What did NOT change

Rank direction, the `equipment` accent and the 23-accent bank, the Heist split, per-file rung depth,
maps as plain `rarity_through`, Jewels on one accent, Fractured off Body Armours, `state_budget` as
a validator error, T0 text = `accent.t0_text ?? accent.solid`, T0 sets no border. All as agreed.
