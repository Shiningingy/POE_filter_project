# Reply 10 — the gear ladder, rewritten from Sharket's own

Author asked me to analyse how Sharket and FilterBlade handle gear and take the good parts. Read
Sharket's `Body Armours` rows verbatim rather than from memory. **His structure is better than the
one I sent you, and §05 is now his.**

## What he does

```
T0   text #ffffff  border #ffffff  plate #8296af   Grey beam   0 Grey Star
T1   text #ffffff  border #8296af  plate #1a1e23   Grey beam   1 Grey Diamond
T2   text #95a6bb  border #8296af  plate #101016               1 Grey Circle
T3   text #a8b6c7  border #485260  plate #0a0a0d
T4   text #8d96a6  border #272d34  plate TRANSPARENT
T5   text #9696a0  border #3c3c46  plate TRANSPARENT
T9   18px, everything faded — a "shown but nearly gone" band
sizes  45 / 42 / 39 / 36 / 34 / 31 / 18
```

Three things I had wrong:

1. **The border carries the rung, not the plate.** I even wrote on the board that this "was the
   cleanest part of the old system" and then gave it up. Sharket keeps it and he is right.
2. **The plate is the QUIET channel on gear** — it darkens under the border, then vanishes at T4.
   He already ends the ladder with no plate at all, which is the same instinct as our T5 form.
3. **The plate darkens rather than brightens** as the rung falls, which is the opposite of the value
   ladder — on gear the plate is background, not signal.

## What we change

**He paints gear text in the class hue, which overrides rarity.** That is the one thing on a gear
label worth more than anything we can add. So we keep his hue and his structure and put the hue on
the **border**, handing the text back to the game. Rarity reads at every rung.

## What we decline

**Tier 9 at 18px.** A hidden block emits no style lines at all in this system; an 18px ghost is a
third state between shown and hidden and it is not worth a rung.

**And his six-step gear size ramp** (45/42/39/36/34/31). Author's call, and it is the right one: gear
uses the shared **45/45/40/35/35/30** like everything else. The border is already carrying the rung
on gear, so size does not need to repeat it — and one ramp of four values is far easier for a player
to retune than two ramps of ten. `size_map` stays a single table.

## Four group hues, replacing my single `equipment` accent

Sharket has ~30 class hues. That is the variance the author asked to cut — but one shared grey was
my over-correction, and it threw away information. **Four groups** answers the only question a gear
drop poses at distance:

```
armour      130 150 175   Sharket's steel blue, verbatim
weapons     180 140 120   warm counterpart — a weapon is not a shield
jewellery   200 180 120   rings, amulets, belts, trinkets
flasks      235 110 110   folded in from its own accent
```

`equipment` stays in the bank as the fallback for any gear category not in a group.

## ⚠️ The one conflict, and it resolves in your favour

Gear now spends the border on the rung — and gear is the class holding all five state borders.

**The state wins the border; the plate steps down one step to compensate.** That is not a new
invention: it is the designer's own **"enhanced"** escalation as recorded in
`theme-pipeline-rewrite.md` — *"state hue takes the border, plate steps down"* — so the vocabulary
already exists on both sides and you do not need a third concept.

Consequence: on a stateful gear item the rung is carried by **size and plate alone**. Acceptable —
knowing an item is corrupted matters more than knowing it is T3 rather than T4.

**Validator:** a gear block emitting both a rung border and a state border is an error. Exactly one
wins, and it is the state.

## ⚠️ Gear is iconless below T0

Correcting myself before you compile it: an earlier draft of this reply had T1 drawing
`1 Grey <group.shape>`. **No group declares a shape**, so that would emit `MinimapIcon 1 Grey` with
no shape — the malformed line that costs a whole filter load.

**T0 draws `0 White Star`** (the existing chase rule: a chase drop takes Star whatever its class).
**Every rung below T0 draws nothing.**

Sharket draws icons at T0–T2 — `0 Grey Star`, `1 Grey Diamond`, `1 Grey Circle` — and we decline T1
and T2 deliberately: his shapes vary by *rung*, which collides with shape = class everywhere else in
this system. Trading his three gear icons for one consistent rule is worth it.

## On FilterBlade's gear

Their approach is volume-gating rather than styling: **24,192 `Rarity Rare` conditions** across the
filter, gear tiered by rarity × item level × class. That is a matching strategy, not a theme one, and
our tree already does the equivalent through the per-class ilvl ladders — so there is nothing to lift
from them here beyond confirming that gear wants many narrow rungs rather than a few broad ones,
which Sharket's six-step ramp already gives us.
