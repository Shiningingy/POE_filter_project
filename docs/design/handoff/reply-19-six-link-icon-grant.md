# Reply 19 — the 6-link is mine to fix, and the icon floor is a grant

Two calls, one of them settling a contradiction I created three replies ago.

---

## ★ 1. 6-Link goes to T1. Delete the override entirely.

You are right and the argument is mine verbatim. From reply 06, settling the `linked` threshold:

> *"⚠️ SIX, not five. In Ruthless a 6-link is a chase drop and a 5-link is common enough to be
> noise."*

I set a state threshold on the premise that a 6-link is a chase drop, then left a rung on the same
item saying bulk. **The state channel and the rung channel were describing different games.**

So the override goes, and `Recipes.json` takes the plain depth-3 value template:

```
6-Link      LinkedSockets >= 6   ->  T1
6-Socket    Sockets >= 6         ->  T2
RGB Linked  SocketGroup RGB      ->  T4
```

No override at all — which is the second time this file has been better off without one. And
**6-Socket at T2 puts the white-cyan plate on exactly the item the accent was split off for**,
which is the check that the split and the ladder were authored from the same idea.

I flagged the loudness of this myself when the accent was created — T1 is the house red at 45px
with a persistent beam — and offered to soften it to `T2 T2 T4`. Your measurement settles it the
other way: the threshold already claimed chase, so the rung has to pay it. If the load says a
6-link is too loud in practice, the thing to revisit is the *threshold*, not the rung.

### And you named the pattern, so I have written it down

> **An override written against a category's NAME rather than its CONTENTS.**

Chancing, Magic Net, and now this. It is in the presets as
`_overrides_are_written_against_contents`, with the tell: *a note that only restates the category
name.* Every override should be justified by what the file **holds**, and if I cannot write that
justification the override should not exist.

Your knock-on check is the useful half — `Vendor Recipes` being the only live category whose best
rung was T4, with every other quiet category quiet on purpose, is what makes this one file rather
than a miscalibration. I would not have known that from here.

### One thing I want to add, since it is the same item

**The `linked` state should be suppressed on the 6-Link block.** That block matches
`LinkedSockets >= 6`, which is precisely what the state asserts — so the border would be spent
saying what the whole block already is. Suppress it and the border stays free for `corrupted`,
which a 6-link can also be and which *is* news.

General form, in the kit as `_states_can_be_redundant`: **a state is redundant when the block's own
condition is the state's condition.** This is the inverse of Fractured, where the border carries
what the rung cannot — same principle from the other end.

## 2. Icon bands — the floor is a **grant**, not a gate

`rung_recipes.T3.icon = null` is the **default**, not a prohibition. A per-category `icon_floor`
overrides it. That is the whole job of a per-category floor: if it could only gate a recipe that
had already declined, no category could ever be granted an icon the ladder refused, and the
mechanism would have nothing to do.

Maps are the case it was written for, and the board has said so since the beginning: *maps drop
their floor to T3, because a white map is a real decision while you are progressing.*

So, as specified: **Red T11–17, Yellow T6–10, White T1–5, all drawn.** Size from the rung
(0 at T0/T1, 1 at T2, **2 at T3**), colour from the band. A white map gets the smallest icon, which
is right — present on the minimap, not competing.

Clarified in the kit as `_icon_floor_is_a_grant` and on the board's icon ladder.

## 3. On sequencing 2–4, and on the Vaal Temple sound

Nothing to add — you are right and I was cheap. *"Delete the rule"* was one line to write and it
turned out to mean "delete ten rules", because `Tier 0 Base Maps` is a container and I assumed it
was a band. That is the same class of mistake as reply 17's *"stays exactly as it is"*, one week
apart, and it is why I said I would stop making claims about your files.

**Build the special-map tier first, move Vaal Temple onto it, then delete T17, then the bands.**
Your order.

The stranded-sound constraint is the one I would not have seen: *a base that needs its own rule
cannot be rescued by a card, because the ramp rules carry no BaseType to split on.* Worth keeping
somewhere permanent — it is a general limit on `item_overrides`, not a Vaal Temple fact.

## 4. On the shadowing check

**95 unreachable blocks losing a distinct sound** is the largest single finding in this thread, and
putting it in before the map rebuild is the right order — a rebuild that re-sorts map rules is
exactly the thing that would create more of them silently.

It is also the fifth defect class found by compiling and diffing rather than by a guard, and it has
the same signature as the other four: **the failure is in the relationship between two correct
blocks.** No block is wrong. The order is.

---

## Still mine

The icon floor sweep — which now has one more thing to decide, since maps drawing at T3 means the
floor question is no longer "how far down" but "how far down *per category*", and Legacy at 17/17
is still the biggest single cut.
