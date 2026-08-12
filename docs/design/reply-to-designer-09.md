# Reply 09 — reply 16 is in. Now maps, which are the worst-lit category we have.

All three of reply 16 built and shipping. The swap follows the claim now, T1 keeps the gear
ladder, and Campaign T1 keeps its dark plate. Two notes on that below, then the real subject.

---

## 1. Built, with one measurement each

**The swap at T2–T4.** Crafting Bases now reads:

```
T0  #ffffff / #555555          Perfect Defence
T2  #2a2a2a f0 / #78ebd2       Over Quality
T3  #2a2a2a e6 / #78ebd2       Strands 60+ / T1
T4  #2a2a2a dc / #78ebd2       Strands T2 / T3      ← the boundary you moved
T5  #2a2a2a d2, rarity-through the four ilvl bands
```

Your read was right about why the residual sat there: those two strand tiers were 88 of the
90 remaining identical bases.

**T0 only.** *"T0 is categorical, T1 is relative"* is the cleanest thing in this thread and it
generalises past this case. It is in our compile as the comment on the exclusion, because the
next person to read that line will otherwise ask why it stops at one rung.

**Your `_note_discipline` earned itself within the hour.** The kit-16 sync silently dropped a
rung override I had added locally — because you had never seen it, so your file did not carry
it and the copy overwrote mine. Same failure shape as the four you fixed, pointing the other
way. §4 below is that override, stated properly this time.

---

## ★ 2. Maps: 16 map tiers render as 2 looks, and 10 special states render as 1

The author's words were *"maps seem weird, our map tier block is pretty busy"*. Measured, the
whole `Base Maps` ladder — 14 emitted blocks covering every map tier and every special state —
resolves to **three** distinct looks:

| look | what wears it |
|---|---|
| `45px · #ffffff on #d20000 · Red Square` | **all ten** special-map rules |
| `40px · #303030 @245 · White Temp · Yellow Square` | **T16 *and* T11–T15** |
| `35px · #303030 @240` | **T6–T10 *and* T1–T5** |

The ten sharing one look are: `MapTier == 17`, Vaal Temple, influenced, Zana memory, enchanted,
8-mod corrupted, Elder, Shaper Guardian, enchanted logbook, plain logbook. **A T17 and an
unidentified logbook are the same picture.**

And the ladder halves collapse because `Maps/Base Maps.json (5)` is `T1 T2 T2 T3 T3` — the
doubling that is correct everywhere else. Here it means **red maps look like T16, and yellow
maps look like white maps.**

### Why maps are the case where doubling does not work

Everywhere else a rung answers *"how much do I care?"* and two tiers can honestly share one
answer. On a map the tier **is** the item's identity — it sets the monster level, the atlas
progression and the price, and it is the one number a player reads before deciding to run it.
Sixteen values shown in two steps is not a compressed ladder; it is the information being
dropped.

It is also the same shape as the crafting problem, one level up: the ladder ranks *how good*,
and the thing that needs saying is *which one*.

### What FilterBlade does — measured from their 3.29 Ruthless filter, 64 map blocks

**Two separate channels, and that is the whole trick.**

**Plate lightness carries the tier**, black text throughout, size 45 flat:

```
MapTier >= 16   bg 235 235 235      MapTier 13   bg 200 200 200
MapTier 15      bg 235 235 235      ... continuing to darken as the tier falls
MapTier 14      bg 235 235 235
```

**A separate `Continue` layer puts the tier band on the BORDER** — blocks with no size, no
text, no plate, border only:

```
MapTier >= 11   border 0 0 0          MapTier >= 1..16  border 220 50 0
MapTier >= 6    border 200 200 200    (no MapTier)      border 255 180 0
```

**And purple is their special-map signal, across every one of them:**

```
maps->influenced       text/border 145 30 220   bg 200 200 200
maps->blighted         text/border 145 30 220   bg 235 220 245
maps->corruptedspecial text/border 145 30 220   bg 235 220 245
maps->enchanted        text/border 145 30 220   bg 235 220 245
maps->nightmare        text/border 100 0 122    bg 255 255 255
maps->vaaltemple       text/border 100 0 122    bg 255 255 255   (MapTier >= 16)
```

Two purples, and the split is meaningful: `145 30 220` for *"this map has a modifier"*,
`100 0 122` on **white** for *"this is a top map"*. The author's instinct — *"T17 → purpleish"*
— is exactly their `100 0 122`-on-white band, arrived at independently for the third time in
this thread.

### What we are asking for

Not their implementation — the border is spent on states for us, so their border-band layer is
unavailable and we would not copy it. The question is the **channel**:

1. **Do maps get their tier on the plate rather than the rung?** A `maps` accent that ramps
   lightness across T1–T16 rather than resolving to two rungs. Maps are already
   `rarity_through`, so the text is free of it and the plate is doing nothing else.
2. **Do special maps get a swap, or their own accent?** Ten states currently share the house
   red. FilterBlade gives them a hue, and by the rule you just wrote — *the swap fires on
   blocks that assert a property of the instance* — an influenced or enchanted or 8-mod map is
   exactly that claim. This looks like the same answer as crafting, in a different family.
3. **If they do get a swap, `Curse of the Allflame` already holds one purple** (`breach` is
   `160 45 255`, `jewels` `250 80 195`). Is there room for a maps purple, or should the special
   signal be something else entirely?

## 3. A smaller one that came out of the same look: crafting's plate ramp is alpha-only

Now that the swap is in, the author's next note was *"T2 and below are only black background,
maybe make them brighter?"* The gear ladder ranks by plate alpha on one hue, so crafting reads
`#2a2a2a` at `f0 / e6 / dc / d2` — four steps that differ by 6% opacity each on a near-black
plate. Against a dark map floor that is close to no ramp at all.

Not asking for a change, since `_plate_rule` was measured from NeverSink and says plate
luminance descends and never doubles back. But **the swap now gives gear a second channel it
did not have when that rule was written** — the text. If the crafting rungs want separating,
`#78ebd2` at three brightnesses would do it without touching the plate. Your call whether that
is a swap or a violation of "declared once, never chosen per row".

## 4. The Bottles override, stated properly

`Curse of the Allflame/Bottles.json` moves to its own rung, author's call. Their tier was
already **named** `T0: 瓶中信` while resolving lower — the label was promising what the rung
would not pay, which is the smallest possible version of the crafting problem. Only Bottles
moves; Mercenary Warrants and Voyage Charts keep yours and their allowlist entries stand.

It is the first row on that accent's top rung, so the first use of its `t0_text`.

---

## Also fixed here: a second silent-veto class, found by the Bottle

The re-rank wrote the new `theme.Tier`, the theme file grew the correct row — **and the emitted
block did not change one byte.** The tier still carried a verbatim inline copy of its old row,
and inline style wins over the theme row.

A stale copy is invisible while the rung is unchanged and becomes a silent veto the moment it
moves. 16 of them cleared, byte-safe by construction. ⚠️ My first version matched *any* row in
the category rather than the tier's own, and reverted six blocks of the author's currency sweep
— `T5:点金石级` wears the T2 plate on a T3 rung **on purpose**, which is a legitimate thing to
do and not a copy at all. Caught by diffing the output, not by the guards.

## State

428 blocks, 0 unstyled. Validator 0 errors, fixtures 8/8, resolver equivalence 109/109,
decorator composition 7/7, round-trip clean. Still not loaded — and your three numbers to watch
are noted.
