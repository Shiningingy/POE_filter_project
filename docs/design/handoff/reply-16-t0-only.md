# Reply 16 — T0 only, the swap follows the claim, and the arrays are fixed

All three answered. §1 is mine and was already a bug; §3 is you catching a leak in my own
reasoning and you are right; §2 is the one real decision and it is **T0 only**.

---

## 1. The arrays are fixed, and the cause was structural

You applied the prose and you were right to. Both arrays are corrected in this drop:

```
Equipment/Crafting Priority.json (10)   T0 T2 T3 T3 T4 T4 T5 T5 T5 T5
Equipment/Magic Net.json (2)            T3 T5
quality.only_on_rungs                   ["T2"]
```

The cause is worth naming because "be more careful" would not have caught it: **my notes restate
the values they explain.** A `_note` that says "Perfect Defence moves T2 → T0" is a second copy of
the array, in prose, with no mechanism keeping them together — the same shape as `rung_by_depth`
living in two files and `theme-standard.md` disagreeing with both. Three instances, one failure.

So the rule is now in the kit as `overrides._note_discipline`:

> **A note must not restate a value that lives in an array.** The array is the value; the note
> says *why* and never *what*.

The one exception is a note explaining why a rung was *not* chosen — that names a value which
appears nowhere else by construction, so it cannot drift.

**Your intersection is the right implementation and please keep it**, even now that
`only_on_rungs` is correct. A stale field that can only produce a *reported* discrepancy instead of
a wrong colour is the right failure mode for anything I hand you in prose-plus-data form.

## 2. T0 only. T1 keeps the gear ladder.

Your instinct not to touch T1 was correct, and the reason it is correct is a distinction I had not
written down:

> **T0 is categorical. T1 is relative.**
>
> T0 means *"nothing else on this screen matters"* — a claim about the whole drop, not about the
> family. It has to render identically everywhere or the claim does not survive being read.
> T1 means *"the top of this category"* — a claim about the family, so it renders in the family's
> own vocabulary.

That is why the argument that forces T0 stops dead at T1, and it settles `gear_ladder.what_we_take`
against itself: T0's treatment is **not taken**, T1's is. Both entries updated.

And concretely: **Campaign T1 must keep its dark plate.** A good act-3 upgrade is not a Divine Orb
and must not wear its colour. Restyling it to house red would have been the change you correctly
refused to make.

On the defect itself — that is the best catch in this thread, because neither decision was wrong.
Sharket's `white on group hue` is fine at ~3.03:1 against a mid-dark steel blue. Flattening to the
neutral `170 170 170` was right on its own terms. The recipe only became unreadable where the two
met, and it stayed invisible because **no equipment category had a T0 rung until I promoted one**.
A latent defect that requires a later, unrelated decision to render is not findable by review; it
is findable by exactly what you did, which is compiling it and measuring.

2.32:1 on the drop-everything rung. Thank you for catching it before the load rather than after.

## 3. You are right — the swap follows the claim, not the rung

I scoped it to T2–T3 and justified the floor with *"the four ilvl bands sit at T4/T5"*. **The four
ilvl bands are T5.** T4 is the other half of the memory strands, and my sentence simply did not
describe the override I had written.

A memory strand *is* a claim about the instance — it is the sentence the swap exists to say. The
author's own framing (*"strands serve as an emphasiser"*) is the same idea, and `gear->memorystrand`
carrying FilterBlade's `0 240 190` is the third independent landing on it.

**So the condition changes rather than the range**, because the range was always a proxy:

> The crafting swap fires on blocks that **assert a property of the instance** — percentile,
> quality, memory strands. Never on the ilvl bands, which assert a property of the *base type*.
> `_swaps_never_paint_the_house_rungs` still applies as a floor.

Effective rungs **T2–T4**; T5 keeps rarity-through. Nothing moves in the ladder — the strand tiers
stay where they rank — the swap just follows what the block claims.

That your 88-of-90 residual sits behind this one boundary is the confirmation. I would have taken
it on the reasoning alone, but a scoping error that accounts for 98% of the remaining defect is not
a coincidence; it is the measurement finding the seam.

**Cost, restated honestly:** crafting now gives up rarity-through on three rungs rather than two.
I still think the floor is the right place to keep it — at T5 rarity is the only thing separating
one i84 base from another — but the line moved once, so treat "T5 keeps rarity-through" as the
claim to test in game rather than as settled.

---

## Smaller

**The other three swaps not being applied is correct** and I would rather they stay off than get a
rule-level mechanism built for them this round. `quality` is covered in practice exactly as you
say. `replica` and `foulborn` are the two I actually want eventually — they say *"this is a
different item"*, which no other channel can — but they need the property-level deviation, and
under the house-rung rule the T1 pair would not fire anyway. Nothing silently on is the right state.

**Your truncation fix is the more important half of that paragraph.** A longer list keeping its
first *n* rungs meant a stale override degraded into *adjacent* rungs specifically — so the failure
mode of a stale annotation was to violate `two_tier_never_adjacent`, silently, in the one place I
had written an invariant to forbid. Falling back to the template loudly is right.

## What I am watching

**Still not loaded.** 7.46:1 is a calculation and a white plate at 45px in a dark map at night is
not, as you say. The three numbers I want from the load, in order: the T0 white plate at size 45,
`205 40 95` against ritual's `150 20 40` on the same screen, and whether `220 238 242` reads as
"recipe" or just as "bright" when a 6-socket and a currency drop land together.
