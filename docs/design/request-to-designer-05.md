# Request 05 — rev 25 is ported; five things it surfaced

rev 25 (25.1) is in and generating. 33 rows, 5 inline tiers, no colour moved anywhere —
every change was an icon, which matches your own summary. All guards pass: 461 blocks,
0 format problems, 0 Show behind Hide, 0 blocks under 3.0:1, 0 plates under alpha 200.

Both 25.1 rulings landed cleanly, and *"the floor reads the promise, not the paint"* is a
better rule than the one we were working from — it explains why jewels keep Crosses at a
rung-4 look without making them an exception. Thank you for that framing.

Five things, in the order they'd block us.

---

## ★ Q1 — every row pins `BorderColor`, and that kills the state decorators

This is the one we'd fix first, and it's a direct collision with a constraint you recorded.

The build constraint, your words: **a decorator paints only the channels the block leaves
unset.** Our five state decorators each emit exactly one channel and then `Continue`:

```
[11001] Corrupted    SetBorderColor 225 25 55    Continue
[11002] Linked       SetBorderColor 0 255 0      Continue
[11003] Influenced   SetBorderColor 150 0 255    Continue
[11004] Fractured    SetBorderColor 160 200 255  Continue
[11005] Enchanted    SetBorderColor 70 200 235   Continue
```

Measured against the current build:

| | count |
|---|---|
| non-decorator `Show` blocks | 442 |
| ...that pin `SetBorderColor` | **187** |
| ...of those, emitted *after* every decorator (so they win) | **187 of 187** |

So on 42% of shown blocks, a corrupted item's red border, a 6-link's green, a fractured
item's blue — none of them can appear. The block overwrites the channel the state was
speaking through.

rev 25 pushes this further rather than back: **all 79 rows carry `BorderColor`, and 59 of
them pin it to transparent `#00000000`.** As the port spreads, more blocks go opaque to the
states.

**The ask:** should a row **omit** `BorderColor` wherever a state is allowed to show through,
the way 441 of our rows already omit `TextColor` so the rarity colour comes through? An absent
key and a transparent key are very different here — absent yields to the decorator, `#00000000`
overwrites it with nothing. If the transparent pins are deliberate (a block that must *suppress*
a state, like the 6-Link one you already called out), then it'd help to have that stated per row,
because we currently cannot tell "no border wanted" from "no opinion".

## ★ Q2 — is `Circle` retired? And `UpsideDownHouse` / `Pentagon`?

`shapes_by_category` in rev 25 lists nine shapes: Diamond, Square, Hexagon, Triangle,
Raindrop, Kite, Cross, Star, Moon. Three shapes in our shipped tree are on none of those
lines:

| shape | icon lines | was |
|---|---|---|
| Circle | 54 | the rev-23 band grammar (currency, fossils, omens, runegrafts) |
| UpsideDownHouse | 25 | predates the kit |
| Pentagon | 4 | predates the kit |

Circle is the interesting one — rev 23 made it the band-class grammar, and rev 25 moves the
band families to Diamond, which leaves Circle unmentioned rather than explicitly retired.

We are **not** going to infer this. Inferring shapes from tree usage is exactly what caused a
reverted pass (we "fixed" 21 correct blocks against a stale bank, and the author's *"maps are
not using squares, is that intended?"* was right — it was).

## Q3 — `Influenced` T1 and T2 are byte-identical

```
Tier 1 Influenced   #ffff77 on #202020, border #966eff, FS40, no icon
Tier 2 Influenced   #ffff77 on #202020, border #966eff, FS40, no icon
```

Same text, plate, border, size, and neither carries an icon — so two rungs render one label.
Intended (T2 held as a spare rung), or should one of them carry a step? Note the ladder does
step at T3, which goes blue `#8888ff`.

## Q4 — three places two authored looks land on one rung

Our porter reports these instead of picking, because silently keeping the first is how a
ladder loses a rung without anyone noticing.

| category | collision | what has nowhere to go |
|---|---|---|
| Trinkets | `Tier 3` and `Tier 4` both declare rung 5 | T4's dimmed `#d590d3cc` |
| Scarabs | T3/T4 on one rung | known, carried inline today |
| Tainted Currency | T3/T4 on one rung | known, carried inline today |

Trinkets is new with rev 25. Is the fix a re-tier on our side (give T4 its own rung), or is
the last band droppable when a category's ladder is shorter than the authored list?

## Q5 — 25.1 shipped without bumping `_version`

All four files still stamp `rev 25`. The stamp exists because of request 04 — *"a file without
a stamp is older than rev 23 and should be treated as poisoned"* — and it's the safeguard that
would have prevented two reverted passes here. A point release that doesn't move the version
puts us back to comparing file sizes. Could 25.1 and later carry `rev 25.1` in `_version` /
`version` / the txt header?

We named our copies after the internal stamp rather than the zip so the two can't disagree.

---

## Not a question — what we're doing about icons

The author's direction, and we agree: **bind shape to item category** so a player can tell what's
on the ground at a glance. `shapes_by_category` gives us that, and it's derivable rather than
guessed.

What the kit can't tell us is **which tiers earn an icon at all** — that's a judgement about what
you'd cross the screen for, per category, and the author's plan is to ask you to start from
FilterBlade's assignment and tune from there.

For scale, measured on the current build: 275 icon lines across 449 `Show` blocks — **61%**,
against your `icon_floor` note's "under today's 64%" and "well under FilterBlade's 70%". The
rev-25 row port moved only 4 lines, because the patch addresses rows while most icons live in
tier inline and rule overrides. So the shape pass is ours to run once Q2 is answered.
