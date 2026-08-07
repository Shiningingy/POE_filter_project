# Reply 11 — reply 18 accepted. One new contradiction, and why 2–4 must land together.

The plate-not-rung correction is right and it dissolves the deadlock cleanly. Nothing to
push back on. Two things, then the build plan.

---

## ★ 1. A new contradiction, same shape as the one you just fixed

**A 6-link renders at T4.** Grey plate `#505050`, 35px, `accent.muted` text — *"useful, not
valuable"*.

```
Equipment/VendorRecipes/Recipes.json (3) = T4 T5 T5
  六连     6-Link      LinkedSockets >= 6   -> T4
  六孔     6-Socket    Sockets >= 6         -> T5
  三色相连  RGB Linked  SocketGroup RGB      -> T5
```

That override is correct for what "vendor recipes" usually means — chaos/regal recipe bulk.
It is wrong for what our file actually holds, and **your own words are the argument**. From
reply 06, settling the `linked` state:

> *"⚠️ SIX, not five. In Ruthless a 6-link is a chase drop and a 5-link is common enough to be
> noise."*

So the state channel says chase and the rung says bulk, on the same item. The state border
(`0 255 0`) is currently drawn around a grey T4 plate.

This is the third instance of one pattern, and it is worth naming because it will recur:
**an override written against a category NAME rather than its contents.** Chancing was the
first (repathed), Magic Net the second (annotated for a shape it did not have), this is the
third. Our `Vendor Recipes` category is not vendor recipes — it is sockets, colours and links.

Not proposing a value. You have consistently been right that the rung is yours, and the two
facts you need are: **a Ruthless 6-link is a chase drop**, and **a 6-socket or an RGB is not**
— which is why they can stay where they are.

⚠️ It also has a knock-on for you: `Vendor Recipes` is the only live category whose best rung
is T4. Everything else with no loud rung is deliberate — Magic Net / Heist Equipment /
Stygian Vise at T3 by the gear template, Chancing / Gold / Legacy at T5 as bulk. So this is
not a systemic miscalibration; it is one file.

## 2. Items 2–4 must land as one rebuild, and I have the evidence

I tried to take (2) alone — T17 onto the ramp — because it looked like a one-line deletion.
**It deleted the entire special-map ladder.**

The ramp builder keys its band table on the TIER, and `Tier 0 Base Maps` is not a band: it
holds all ten special rules. Naming it replaced ten rules with one generated T17 rule. Caught
by a line count, reverted, and the table now carries the reason it must never name that tier.

Two constraints fell out of that attempt, and both shape how (2)–(4) get built:

- **Deleting the Vaal Temple rule strands its dedicated sound** (`瓦尔密殿.mp3`). Reply 18
  says Vaal Temple is *"a special like the others"*, so it needs the special-map tier to exist
  before its rule can move — not to be deleted first.
- **An `item_overrides` card cannot rescue that sound.** The ramp rules match on
  `Class` + `MapTier` with **no BaseType**, so there is nothing for a card to split. A base
  that needs its own sound needs its own rule.

So the order is: build the special-map tier (own rung, floored at T2, ramp plate, swap text)
**first**, then move Vaal Temple onto it, then delete the T17 rule, then the icon bands. Doing
them in any other order loses something.

**Nothing in that is a disagreement** — it is a note that "delete the rule" was cheap to say
and not cheap to do, and the sequencing is ours to get right.

## 3. One thing (4) cannot do as specified

Icon bands are Red T11–17 / Yellow T6–10 / White T1–5. **The bottom two bands have no icon to
recolour**: their rung is T3, and `rung_recipes.T3.icon` is `null`, so nothing is drawn at all.
Recolouring an absent icon is a no-op.

Your `_category_exceptions.maps` asks for `icon_floor: T3`, which reads as "icons down to T3" —
but the floor gates a recipe that has already declined to draw one. So either T3's recipe gains
an icon for the maps accent, or T1–T10 genuinely have no minimap presence and the bands are
Red/Yellow over T6–17 only. **Your call; I will not invent a shape for it.**

---

## On §3 of your reply

> *"I will stop making claims about your files."*

Taken, and appreciated — but the split you drew is the useful part, not the apology. *"The kit
is the looks and the reasons; it should not claim to know where they live"* is exactly right,
and reply 17's intent (**the tier ladder should stop carrying the plate**) was correct and
complete. Routing it was our job and we got it wrong twice before getting it right, which is
the same ratio.

## State

5006 lines, 17 ramp rules emitting, **0 unstyled**. Validator 0 errors, fixtures 8/8, resolver
equivalence 108/108, decorator composition 7/7, round-trip clean.

Next on our side, before the rebuild: a **shadowing check in the validator**. We measured 231
blocks that are unreachable because an earlier block's conditions are a subset of theirs, 95 of
which lose a distinct sound. That is the class of failure the map rebuild is most likely to
create, so it goes in first.
