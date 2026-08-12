# Reply 06 — the floor loses its plate (supersedes the T2 version)

⚠️ **If you already read a version of this file that put the borderless treatment on T2, discard
it.** That was my misread of the author's note. **T2 is a solid accent plate**, unchanged. The
treatment belongs on **T5**.

## T5 painted

```
SetTextColor      accent.muted darkened .15
no SetBackgroundColor                          <- the game's own background
SetBorderColor    accent.muted darkened .40
```

It is the floor, so the lightest possible treatment is the right one: a dim outline rather than a
plate. Currency's T5 is skipped anyway (no floor below scrolls), so the first place you will see
this is gold, vendor bulk and legacy.

## ⚠️ The constraint

It spends the border, and the border is reserved for states everywhere else. So this form is
**legal only where `state_budget` is empty** — currency, shards and splinters, fragments, scarabs,
divination cards, essences, oils, fossils. The test is mechanical: `state_budget[class].length === 0`.

**Everything with a state keeps a plate at T5:**

```
text    accent.muted darkened .15
bg      48 48 48 215
border  none — reserved for states
```

That is gems, jewels, uniques, maps, heist and all equipment.

## Validator line

T5 is now the one rung whose look depends on the class, so assert it rather than trusting it: if
`state_budget[class]` is non-empty and the resolved T5 preset emits `SetBorderColor`, that is an
error — a borderless-form preset has reached a class that needs its border for states.

## Gold is the permanent case

Author's note, and it is the cleanest example of the form: **gold is auto-collected.** You never
decide to pick it up, so its label is a readout rather than a call to action — it should never wear
a plate at all.

So `gold` gets its own accent with `plate: "never"` and takes the borderless form at **whatever rung
a block puts it on**, not just T5. Everything else takes the form only at T5.

That also closes `Currency/Gold.json` completely — **no plate, no beam, no icon.** The rewrite doc
listed the beam half of that conflict as the designer's to fix; this is all three channels.

## ⚠️ Fixed while writing this: the accent bank was short six entries

`theme-presets.json` carried only the original 17 accents — the six added in reply 02
(`equipment`, `vendor`, `flasks`, `quest`, `allflame`, `corpses`) existed only in
`accent-category-map.json` under `new_accents`. If you were iterating the presets file you would
have compiled a hole exactly where you flagged one last time. **All 24 are now in
`theme-presets.json`**; `new_accents` is kept for its rationale but is no longer a second bank.

## Goldens

`currency.T2` is back to `0 0 0` on `255 170 0 240`. `essences.T2` likewise. Neither golden
exercises the new T5 form, since both categories skip T5 — **`gold` is the right third golden** — it
exercises the borderless path, and `plate: never` is the one rule a compiler could silently drop.
