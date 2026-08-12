# Reply 08 — the swap is built and shipping. Three things it turned up.

`text_swaps` is live. It had zero readers before today, so this is the first time any of that
block has reached a filter. A crafting base now reads as a crafting base:

```
T0  Perfect Defence      45px   white plate, #555555 text        (was T2, flat grey)
T2  Over Quality         40px   #2a2a2a + #78ebd2                ← the swap
T3  Strands 60+ / T1     35px   #2a2a2a + #78ebd2                ← the swap
T4  Strands T2 / T3      35px   #2a2a2a, rarity-through
T5  the four ilvl bands  30px   #2a2a2a, rarity-through
```

**Bases drawing byte-identically to a plain rare of the same base: 115 → 90 of 282.** The swap
measures 9.99:1 on the neutral plate. `_swaps_never_paint_the_house_rungs` is implemented as an
intersection rather than read from `only_on_rungs`, for a reason in §1.

Three things need you, in order of how much they cost if left.

---

## ⚠️ 1. The kit's arrays disagree with the kit's own prose — twice, this drop

Both notes were rewritten for this round. **Neither array was.**

```
_crafting_note      "⚠️ REVISED: Perfect Defence moves T2 -> T0"
the array            ["T2", "T2", "T3", ...]

_magic_net_note     "⚠️ ANNOTATION CORRECTED to (2) ... T3 T5 confirmed"
the key and array    "Equipment/Magic Net.json (4)": ["T3", "T4", "T5", "T5"]
```

**I applied the prose**, because each decision is stated twice — in reply 15 and in the note — and
a note that says "REVISED" next to an unrevised array is unambiguous about which one lagged. But
that is me choosing, and it is the third instance of the same failure mode in this thread:

| | stale | current |
|---|---|---|
| reply 06 | `rung_by_depth` in both files, disagreeing at depth 3 | one owner |
| reply 07 | `theme-standard.md` prose vs both machine files | fixed |
| **this drop** | **`_note` prose vs the array beside it** | ? |
| **this drop** | **`quality.only_on_rungs = T0 T1 T2`** vs `_q21_scope` "T2 only" vs `_swaps_never_paint_the_house_rungs` | ? |

That last one is three fields describing one scope, and the machine-readable one is the stale one
— the exact inversion of "we follow the machine files". **So the swap does not read
`only_on_rungs` and trust it.** It intersects with the governing rule, which means a stale
`only_on_rungs` cannot produce a wrong colour, only a reported one.

**Worth fixing in the kit so the next drop does not revert it.** No decision needed — you have
already made all four.

## ★ 2. The T0 promotion exposed a real defect: gear T0 was 2.32:1

Worth telling you in full, because the cause is a decision of yours interacting with a recipe of
yours, and neither was wrong on its own.

`Crafting Bases T0` compiled to **white text on `#aaaaaa`** — 2.32:1, under the 3:1 large-text
floor, on the one rung whose entire job is *drop everything*. It would have been the least visible
label in the filter.

The chain:

- Our `rung_row` applied `gear_ladder.ladder` to **every** rung on the equipment accent.
- `gear_ladder.ladder.T0` is `text 255 255 255` on `group.hue @ 255` — authored for Sharket's
  class hues, where the plate is a mid-dark steel blue and white text reads at ~3.03:1.
- **Reply 14 flattened the three gear hues to the neutral fallback `170 170 170`.** Correct on its
  own terms, and it turns that same recipe into white-on-light-grey.
- It had never once been rendered, because **until reply 15 no equipment-accent category had a T0
  rung at all.** The promotion created the first one.

The fix is your own text: `rung_recipes.T0.rarity_through` says *"chase overrides rarity — painted
in every family, **gear included**"*. So T0 now takes the house rung for gear too. **7.46:1**, and
it is the idiom the author asked for.

### ⚠️ But `gear_ladder.what_we_take` says the opposite, and I need you to pick

> `rung_recipes.T0.rarity_through` — *"painted in every family, gear included"*
> `gear_ladder.what_we_take` — *"T0's treatment: white text on the group hue"*

Both cannot hold. **I excluded T0 only, and deliberately left T1 alone**, even though the same
argument reaches it: excluding T1 would restyle **Campaign T1** from its dark plate `#2a2a2afa` to
the house white-on-red `#d20000`. That is a large, visible change to a category nobody asked
about, made on the strength of a document that disagrees with itself. So it is not made.

**The question: on the equipment accent, do T0 and T1 take the house rungs or the gear ladder?**
T0 is forced — the alternative is unreadable. T1 is genuinely open and it is yours.

## 3. Two of the four memory-strand tiers sit at T4 and get no swap

Not a disagreement — a case your reasoning may not have covered. The override lands:

```
T2   Over Quality                      swap ✓
T3   Strands 60+, Strands T1           swap ✓
T4   Strands T2, Strands T3            no swap
T5   Gear 86 / 86 Rank B / 85 / 84     no swap
```

Your justification for the floor was *"the four ilvl bands sit at T4/T5 and keep it… an i84 base
is bulk by volume… there is nothing exceptional to claim there."* **That is exactly true of T5,
which is the four ilvl bands. T4 is not the ilvl bands** — it is the other half of the memory
strands.

And a memory strand is a claim about the *instance*, which is the sentence the swap exists to say.
The author's own framing: *"strands serve as an emphasiser — a T2 item might be worth a look if it
has high strands."* FilterBlade agrees, and it is in the 24: **`gear->memorystrand` carries their
`0 240 190`**, the same colour, alongside `crafting->qualityperfection`.

**Measured consequence:** of the 90 bases still drawing identically to a plain rare, **88 are
claimed first by `Strands T2`** — so this one boundary is essentially the whole residual. The
other 2 are ilvl-band bases, which is the intended case.

Two ways, both yours: extend the crafting swap to T4, or move the two strands tiers up. I have
changed nothing — you scoped it to T2–T3 explicitly and I would rather ask than widen it quietly.

---

## Smaller

**The other three swaps are declared but NOT applied, and the compile now says so out loud** —
`quality`, `replica`, `foulborn` all fire on an item property rather than a block, which needs a
rule-level deviation that is not built. `quality` on equipment is covered in practice: Over Quality
is its own block at T2 and the crafting swap paints it the same `120 235 210`. `replica` and
`foulborn` have real rules on Uniques (T1/T2/T3) waiting for the mechanism; under the new house-rung
rule the T1 pair would not fire anyway. Nothing is silently on.

**Magic Net's override is kept**, as you asked, and now agrees with the template. Our compile also
stopped truncating a stale override: a longer list keeps its FIRST *n* rungs, and since your lists
are best-first the survivors always come out adjacent — which is how `(4)` became the illegal
`T3 T4`. It falls back to the template now, still loudly.

## State

427 blocks, 26 changed, all in Crafting Priority. **0 unstyled.** Validator 0 errors, fixtures 8/8,
resolver equivalence 109/109, decorator composition 7/7, round-trip clean.

⚠️ **Still not loaded in game.** That has not changed and it is the caveat on everything above,
including the two contrast numbers — 7.46:1 is a calculation, and a white plate at 45px in a dark
map at night is not a calculation. You will get what the load turns up.
