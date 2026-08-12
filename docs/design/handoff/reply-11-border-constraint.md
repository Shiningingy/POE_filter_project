# Reply 11 — you were right, and reply 10's gear ladder is withdrawn

Your question-3 finding is the good kind of correction: it does not just say my ladder was wrong, it
says **it could never have been right**, and gives the reason. Withdrawn, and the board is updated.

## The border is a build constraint, not a preference

The chain is airtight and I had not seen it:

1. A block without `Continue` terminates matching.
2. So decorators must emit **first**, and yours do — order 11001, ahead of all 529.
3. `Continue` then hands each channel to whatever comes **after** — the content block.
4. Therefore any block that sets `SetBorderColor` eats the state border.

And the measurement lands it: **525 of 529 blocks already do exactly that today.** The state border is
being overwritten almost everywhere in the current filter, which is a live bug rather than a
hypothetical.

So the sentence I kept repeating as a design principle —

> *the border is the only channel free on every item in every category*

— is now recorded on the board as a **one-pass build constraint with no exception, gear included.**
That is a better justification than the one I had, and it means the rule cannot quietly erode later.

## Gear ladder, corrected

Everything from reply 10 survives except the channel:

```
T0   text 255 255 255   bg group.hue @ 255   0 White Star   45
T1   rarity              bg group.deep @ 250   —             45
T2   rarity              bg group.deep @ 240   —             40
T3   rarity              bg group.deep @ 230   —             35
T4   rarity              bg group.deep @ 220   —             35
T5   rarity              bg group.deep @ 210   —             30
border: never, at any rung
```

⚠️ One knock-on: **Sharket's transparent T4/T5 plates go too.** With the border unavailable, the plate
is the only ranking channel gear has, so it can never reach zero — T5 bottoms at alpha 210 instead.
Adding that to the declined list beside Tier 9 and the six-step size ramp.

## The other nine, all applied

**1 · groups are derived, not mapped.** Dropped `_meta.item_class` on your evidence that it is a
display label. The compiler resolves `BaseItemTypes → ItemClasses → class_hierarchy.yaml`, and the
intermediate nodes are the groups. **Three groups plus a fallback**, since flasks are their own
top-level node — and your state measurement is why that matters: flasks hold **one** state, so
folding them into gear would have claimed five on a class that can hold one. Trinkets, Relics and
Heist Equipment are off the gear list entirely.

**2 · `state_budget` corrected in three places** — maps +influenced, jewels +enchanted, uniques
+influenced. Consequence I have written into the spec: **maps, jewels and uniques all lose the
T5-borderless form.** That is exactly the failure the validator was for, found before it shipped.

**4 · heist** — we already have six of the nine areas in one tier. Adding Bunker, Repository and
Tunnels is small. The empty `Blueprints.json` mapping is the real news: blueprints-above-contracts
is new work either way, so I will stop treating it as a live question and call it **contracts and
blueprints alike**, matching NeverSink, until the blueprint ladder exists.

**5 · quality** — two thresholds, not one: `Quality >= 21` for gear, `Quality >= 23` for gems, with
your note about the space before the operand recorded next to it.

**6 · size 30** — noted that it already ships in 17 blocks. Nothing to verify.

**7 · flat list** — Magic Net off (three real rungs, so it goes on the ladder). **Stygian Vise off
too**: two rungs is a rank, and flat is for "not rankable" rather than "shallow". Ten remain.

**8 · icon report** — recorded verbatim in the handoff. Starting the sweep at **General (48/43)** and
**Map Fragments (42/19)**, with **Legacy (17/17, plus beams)** as the first subtraction. The fact that
245 of 285 icons are two values is the useful part: the nine-shape vocabulary replaces nothing, so the
sweep is pure addition-then-removal rather than a migration.

**9 · gold** — fair not to guess. I will confirm in game. Your point that Gold.json already emits no
icon and no beam is reassuring: `plate: never` only adds the third channel, and it is one base.

**10 · delirium / corpses** — kept both, with the delirium note now saying plainly that the accent
buys **one base**. Corpses at 114 live bases justify the invented hue.

## Two things you found that are yours

`Currency/_archived/Breach.json` emitting four live blocks, and the `Relics` `[DO NOT USE]` bases —
noted the second as a caution on the flat list, since spending a look on a half-dead class is my
problem even if the data is yours.

## Where that leaves us

Nothing is blocking. The only open items are the two I owe you — the in-game icon sweep and a look at
fragments-vs-breach — plus gold, which I will confirm. **Compile when ready**, and yes to generating
into a side file and diffing before it touches `sharket_theme.json`.
