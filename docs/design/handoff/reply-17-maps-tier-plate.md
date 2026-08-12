# Reply 17 — maps: the tier takes the plate. Seven anchors, not sixteen values.

Three answers, one refusal, and one contradiction of mine that your question uncovered.

---

## ★ 1. Yes — the tier goes on the plate

**A T17 and an unidentified logbook being the same picture** is the whole argument and I do not
need to add to it. But the reason maps are the exception is worth stating precisely, because it is
the thing that decides whether this generalises:

> Everywhere else a rung answers *"how much do I care?"*, and two tiers can honestly share one
> answer. On a map the tier **is the item's identity** — monster level, atlas progression, price,
> and the one number read before deciding to run it. Sixteen values in two steps is not a
> compressed ladder. It is the information being dropped.

You spotted that this is the crafting problem one level up, and that is exactly right: **the ladder
ranks *how good*, and the thing that needs saying is *which one*.** Three times now — crafting
bases, memory strands, map tiers — and each time the answer has been to move the claim off the rung
onto a channel that is free. This is the third instance of one pattern, not a third exception.

### Seven anchors, the rest interpolated

Not sixteen authored values — that is the 998-row problem returning in a new costume.

```
T1  110 110 112     T6   150 146 120     T11  210 196 194     T17  255 255 255
T5  146 146 148     T10  200 194 156     T16  242 238 238
```

Linear in sRGB between the bracketing anchors. **The anchors are the three atlas bands**, which is
the player's own model and the same banding the icon colour already used — so icon and plate now
say the same thing at two distances: the icon on the minimap, the plate on the ground. Band at a
glance, tier on a look.

Luminance ascends with tier and never doubles back — 110 → 146 → 150 → 200 → 210 → 242 → 255 — so
`_plate_rule` holds unchanged. **The tint carries the band; the luminance carries the tier.** Black
text throughout, 4.3:1 on the darkest anchor at 45px.

**The rung keeps size, icon and beam.** Only its plate is overridden, so `Maps/Base Maps.json`
stays exactly as it is — it is a *size* ladder now, and the doubling that collapsed red into T16 is
harmless once the plate carries the tier. Nothing to re-decide there.

And I am not adding an exception: the maps exception already said *"the plate is not the rung's"*.
It now says which axis takes it. Still seven.

## 2. Special maps take a swap — and it is forced, not chosen

By the rule from reply 16: a swap fires on blocks asserting a property of the **instance**, and an
influenced or enchanted or 8-mod map is precisely that claim.

But the stronger reason is that **an accent is no longer available.** The plate is spoken for by the
tier, and an accent would take the plate and delete it — a Vaal Temple T16 would stop being a T16.
Text is the only free channel left, and a swap is what "the text carries a claim" is called here.

I like that this was forced. It means the architecture decided it rather than my taste.

## 3. The purple — and the rule your question produced

Your §3 is the useful question, because the obvious answer is wrong for a measurable reason.

The obvious answer is `120 235 210`: same sentence, same channel, one colour for "this instance
beats its type". **It is unusable.** That colour measures 9.99:1 on gear's near-black plate and
about **1.3:1 on a 242 map plate**. Same colour, same claim, and invisible.

So:

> **A swap colour is chosen for the plate it speaks against. The channel is the constant, never the
> hex.**

Gear runs dark, so its swap runs light. Maps run light, so the maps swap runs dark: **`110 20 140`**.

**One purple, not two.** FilterBlade needs `145 30 220` for "has a modifier" and `100 0 122` on
white for "top map" because their ramp does not reach white. Ours does — so a T17 is
top-of-ramp *and* special, and lands **deep violet on white** with no second value authored. Their
top-map band falls out of our construction. That is the fourth time in this thread that following
the structure has landed on their answer without copying it, and I have stopped being surprised.

On the collision with `breach 160 45 255` and `jewels 250 80 195`: no. Both are far brighter, and
neither shares a **surface** with this one — they are plates, this is text on a light plate. Two
purples in a filter only conflict when they compete for the same surface.

## 4. My contradiction, which your question surfaced

Worth flagging since it is the same class as the four you found:

```
_invariants.rarity_through_is_an_accent_property   "only the equipment accent has it"
_category_exceptions.maps                          "rarity_through (no text colour)"
```

Both have been in the kit for several rounds. **The plate ramp forces it the right way**: the
game's white Normal-map text on a 242 plate is unreadable, so maps must paint. The invariant was
right and the exception was the stale one. Fixed in both files.

---

## 5. The crafting plate ramp — no, and here is the line

The author's read is correct: four steps of 6% alpha on a `#2a2a2a` plate against a dark map floor
is close to no ramp at all. But **I am not spending the swap on it**, and the reason is a boundary
worth keeping sharp:

> A swap says what the item **is**. It never says how it **ranks**.

Three brightnesses of `#78ebd2` would be the ladder colonising the one channel I just freed —
and it would be the second thing carrying rung, duplicating the plate rather than adding
information.

The real suspect is not the ramp, it is `equipment.deep` at `42 42 42` sitting too close to the map
floor, so a 240→210 alpha ramp has nothing to be alpha *against*. **That is a load question, not a
calculation** — I cannot answer it from a swatch board and neither can you from a contrast number.

If the load confirms it: lighten `equipment.deep` toward roughly `52 52 52` and keep the alpha ramp
as authored. One value, every gear ladder benefits, no channel spent. I would rather change one
authored colour than the shape of the system.

## 6. Bottles — taken, and its allowlist entry removed

`Curse of the Allflame/Bottles.json (1)` → **T0**. First use of the allflame `t0_text`.

Your framing is the right one and I want it in the record: **the tier was already named `T0: 瓶中信`
while resolving lower.** A label promising what the rung would not pay is the smallest possible
version of the crafting problem — same bug, one item wide.

I also **removed Bottles from the depth-1 allowlist**. It has an override now, so the warning
cannot fire, and an allowlist entry that can never be reached is exactly the drift we are policing.
Mercenary Warrants and Voyage Charts keep theirs.

---

## On the two silent-veto classes

The inline-copy veto is the more interesting one, because **a stale copy is invisible while the
rung is unchanged and becomes a veto the moment it moves** — so it is undetectable by any test that
does not also change something. That is the same shape as the gear T0 contrast defect, which needed
an unrelated later decision to render. Two now, and both were found by compiling and diffing rather
than by review.

And `T5:点金石级` wearing the T2 plate on a T3 rung **on purpose** is a real thing to be able to do.
Whatever the eventual guard is, it should not be able to call that a copy — an author overriding a
rung deliberately is the system working, not drift.

## What I still owe you

The icon sweep. And these anchors are now the fourth thing in the drop that has never been seen in
game — `205 40 95`, `220 238 242`, the gear T0 white plate, and now seven map plates whose whole
job is to be told apart from each other in a dark corridor. The map ramp is the one I would watch
first: **interpolated middles are exactly where a ramp stops being readable**, and T12–T15 are four
plates inside 32 luminance points.
