# Request 03 — the accent bank contradicts rev 22 §1, and two rules I can't derive

Rev 22 landed. The `net` accent is applied and shipping; `equipment_loudness` and
`equipment_recipes` are queued behind a re-tier and will follow. Your §1 clarification
settled an open argument on our side — thank you, it was the right call and we had it wrong.

Then applying it surfaced something.

---

## ★ Q1 — `accents.currency.solid` and your §1 R2 value disagree

§1 says currency's family plate at **R2 = FB vermilion `240 90 35`**, no border, 3.39:1.
We applied that; a Chaos Orb now reads white on vermilion.

But the accent bank says:

```json
"currency": { "solid": "255 170 0", "muted": "170 158 130", ... }
```

and `rung_recipes.T2.painted.bg` is `accent.solid @ 240`. Derived from the bank, currency's
R2 is `255 170 0` — **not** the vermilion you specified.

**Which is authoritative?** Two readings and they lead different places:

- **the bank is stale** → `accents.currency.solid` should become `240 90 35`, and the recipe
  keeps working unchanged. This is the one we'd guess, but guessing is what we're trying to
  stop doing.
- **R2 is authored per family, not derived** → then `accent.solid` is not the R2 plate and we
  should stop treating the recipe as a generator at all.

This matters beyond currency: **Omens and Runegrafts sit on the `currency` accent**, so
whatever answer applies to Chaos Orb applies to them too.

---

## ★ Q2 — what is the real `black_or_white_by_luminance` rule?

`rung_recipes.T2.painted.text` is `black_or_white_by_luminance`. We implemented it as "pick
whichever actually has more contrast" — crossover at relative luminance 0.1791.

Your own currency R2 contradicts that:

| plate | L | white | black | you chose |
|---|---|---|---|---|
| vermilion `240 90 35` | 0.2596 | **3.39:1** | 6.19:1 | **white** |

You took the *lower* contrast deliberately, so the rule isn't "maximise contrast". Is it a
different threshold, a hue condition, or is the text authored per family and the phrase only a
default?

We are asking rather than fitting a curve to one data point. Whatever we implement gets
applied to every painted family, and if we infer it wrong we will quietly overwrite your
choices with our arithmetic across the whole tree — which is exactly the failure mode that
cost us a rollback this week.

---

## Q3 — 22 rows on a colour that belongs to nobody

`#ffa500` sits at R2/R3 in **15 categories**. It is not currency's (that's the vermilion) and
not any accent in the bank — it predates the accent system and was never substituted out.

| category | accent | `solid` | `muted` |
|---|---|---|---|
| Curse of the Allflame · Enshrouded Gear · Enshrouding Crystals | allflame | `255 120 40` | `195 155 125` |
| Breach Grasping Mail · Wombgifts | breach | `160 45 255` | `160 130 180` |
| Harvest · Incursion Vials | harvest | `110 220 130` | `145 180 150` |
| Expedition Ward-Bases | expedition | `130 200 255` | `155 175 195` |
| Vendor Recipes | recipes | `220 238 242` | `165 182 188` |
| Corpses | corpses | `190 140 110` | `180 155 135` |
| Delirium Orbs | delirium | `210 210 230` | `175 175 185` |
| Ritual BaseTypes | ritual | `150 20 40` | `165 120 125` |
| Tainted Currency | tainted | `205 40 95` | `178 112 150` |
| Omens · Runegrafts | currency | see Q1 | |

**If Q1 resolves as "the bank is authoritative"**, we can derive all 22 from
`accent.solid @ 240` / `accent.muted @ 240` and no further input is needed — say so and we'll
run it. **If R2/R3 are authored**, we need the values, and we would rather wait for them than
generate 22 plates you did not choose.

---

## Not questions — two things you should know about our side

**Rungs here are assigned by VALUE, not by category depth.** `rung_by_depth` maps a category's
tier count onto a rung set; we don't use it. The author re-tiered the whole tree so a rung
answers *"what is this worth against currency"* globally — a Ducat and a Scroll of Wisdom
landing on the same rung was the defect that started it. Anchored on the currency ladder,
which pairs nine tiers onto five rungs (R5 is the floor, below scroll level, and currency
never reaches it). So a 3-deep category here can legitimately use R1/R3/R5 rather than the
depth-3 template. Nothing for you to change — but if a future drop assumes depth-derived
rungs, it will not match what we build.

**Jewellery loudness is being extended to Base and Abyss Jewels.** Your rev 22
`equipment_loudness` keeps the game's bright rarity plates on jewellery and steps
weapons/armour down to `32 32 32`; the author wants jewels treated the same way, on the
grounds that they're the same "small, easy to miss, high value density" problem. Flagging it
because it widens a rule you wrote for gear, and if that conflicts with the jewels accent
you'd rather we asked than discovered.

---

## Still open from request 02

The **corpses rose `232 92 104` vs vaal-red `245 85 75`** clearance — 8.7° and 9 saturation
points, failing both halves of your own ceiling test. Plate separation may carry it (`214 76
90` at 91% value vs blood `150 20 40` at 59%). Your call: intended distinguisher, or does one
hue move?
