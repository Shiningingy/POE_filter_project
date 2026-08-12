# Reply 14 — the settled tree, read against the kit

The page did the thing "structure before theme" was waiting for. Everything below is decided;
nothing here needs another round from you before you build.

Both kit files are updated in this drop. **`accent-category-map.json` is now schema 2 and is the
single owner of `rung_by_depth`** — the copy in `theme-presets.json` is replaced by a pointer.

---

## 1. `rung_by_depth` — the map owns it, and depth 3 is `T1 T2 T4`

Your suggestion was right and I have taken it: it is category routing, same job as
`accent_by_category`, and the map was the only copy with a gear template and the file overrides.
The presets copy is gone; the `_why` note stayed behind as prose.

The depth-3 disagreement settles without taste. **T3 is the muted accent plate and exists only to
be told apart from T2's full-strength one.** With a single accent rung there is nothing for it to
be muted against — so `T1 T3 T4` would make a 3-deep ladder name its own family *more weakly than
a 2-deep one*, which uses `T2 T4`. A ladder getting deeper cannot make its category harder to
recognise. So: **`T1 T2 T4`**, and the general form is now an assertion rather than a preference:

> **In a painted ladder, if any tier resolves to T3, some tier must resolve to T2.**

It is in the kit as `_invariants.painted_t3_needs_t2`. It does not apply to gear, where the rungs
are alpha steps of one hue rather than accent saturations.

**Your check caught one of mine while I was writing that.** The gear table had depth 2 as
`T3 T4` — two adjacent rungs, which is the one thing the board says a two-tier ladder must never
do, because that distinction is invisible when only two things exist to compare. The value table
obeyed the rule; the gear table was breaking it. Now `T3 T5`, and that is an invariant too.

## 2. Chancing — repathed, rung unchanged

`Equipment/VendorRecipes/Chancing.json`. Please drop the alias.

Empty by design changes nothing: it is bulk, bulk is a rank, it stays **T5**. That its rung only
ever applies to items the player adds is exactly why it must be the quiet one — a chase list you
wrote yourself does not need the filter shouting it back at you.

## 3. The 23 → `Rare Equipment`, and the family hues

One line added, 23 removed, `Breach` removed as well (no theme category by that name in the
settled tree; the accent survives on Wombgifts and Breach Grasping Mail). 52 entries now, and the
set matches your tree exactly — that equality is written down as `_invariants.no_silent_misses`,
an error on both sides, because a key naming nothing is the same bug as an override matching
nothing.

**On the three flattened hues: they do not come back to `Rare Equipment`, and armour's winning
was an accident rather than a decision.** Use the **fallback** `170 170 170 / deep 42 42 42`,
which already exists for exactly this case. A single mixed-class file honestly has one hue to
give; picking armour's steel blue for a category that is 5% quivers just means most gear is
mislabelled quietly.

**But the distinction is not lost — it moved to where the files still separate.** Campaign's four
files split by class (`10 Weapon`, `20 Armour`, `30 Jewellery`, `40 Flask`), so
`group_resolution` hands them weapons, armour, jewellery and flasks with no hand-mapping at all.
Campaign is now where a player learns "brown means weapon", and it is the right place for it:
that is the part of the game where you are still learning what to look at.

The rule that follows, and it is worth keeping: **hue follows the file split.** Where the tree
merged, the hue merges; where it separates by class, the hue separates. Nothing to maintain.

## 4. Rarity-through on Uniques and Jewels — closed, keep the `TextColor`

Your measurement is the argument *for* keeping it, so thank you for taking it before touching it.

`rarity_through` is a property of the **accent**, declared once, never chosen per row. Only
`equipment` has it. A painted accent always sets `TextColor`; a rarity_through accent never does.
There is no third case — which means "these rows set a TextColor" was never a finding.

The reason it looks like one is the good part: **on a painted accent the rarity signal moved to
the plate.** That is precisely why Uniques T2 can *be* `#af6025` — the plate is carrying what the
text carries elsewhere. Removing the key would delete the signal and the readability in one go, at
1.00:1. Rarity-through is for the accent whose plate is deliberately neutral, which is gear, and
that is the whole list.

So: no re-choice of backgrounds, and you can stop treating it as a bug in either direction.

## 5. The 31 shared rows — three kinds, and only one is a defect

- **Authored collapse — leave alone.** General's pairs, Base Maps, Cluster Jewels, Uniques T3/Other,
  Gold's three, Vendor Recipes' two, Campaign's Tier 5 net. Nine tiers into a six-rung ladder means
  rungs carry two; that is the ladder working, not blurring.
- **Shared across two files by RANK — leave alone, and do not split.** Splinters/Fragments, and
  **Fractured with Rare Equipment**. Same accent, same rank, same look, with the *state border*
  saying "fractured". That is the state channel doing its job. Fractured's 436 bases are a matching
  win; they need nothing from me.
- **Genuine defect — the reshape's new ladders never got their template applied.** Influenced's
  four tiers all sit on Tier 4; Rare Equipment's T1/T2 share; Trinkets' T1/T2 share. These are gear
  ladders and the gear template already answers them. I have listed the expected rungs under
  `rung_by_depth.expected_after_the_reshape` — **not as overrides**, deliberately, because if they
  need an override to come out right then the template is not being applied and I would rather that
  fail loudly.

Two ladders *did* need real overrides, both new:

**`Equipment/Crafting Priority.json` (10 visible)** — `T2 T2 T3 T3 T4 T4 T5 T5 T5 T5`.
Perfect Defence and Over Quality at the top because a perfect roll or a Q21+ base is a reason to
stop moving; memory strands through the middle; the four ilvl bands at the floor because an i84
base is bulk by volume. Over-quality also takes the quality text swap, whose scope is T0–T2 — so
it lands exactly where this override puts it, which is the check that the two were authored from
the same idea.

**`Equipment/Magic Net.json` (4 visible)** — `T3 T4 T5 T5`, and the category **moves from the quest
accent to equipment**. Green was right when it was a 3-rung utility net; an AreaLevel band over
magic gear is not utility, and green promises "always shown, always needed". The template would
have opened it at T2 — a declutter net's best tier is not *worth picking up*, it is *not yet worth
hiding*.

One deletion: the `Misc/General.json — Quest Items` override is gone. Quest Items is flat, flat
categories skip the table entirely, so that line could only ever mislead.

## 6. Ward bases — the look needs nothing from either outcome

I think FilterBlade is right and so are you about *why*: the group is a defence type, not an item
class, and splitting it deletes the concept. But that is the author's call and it does not reach me,
because **`Expedition Ward-Bases` already carries its own accent rather than a gear group hue** —
which is the cross-class answer, arrived at before the question came up. If it stays ward-shaped,
nothing changes. If it splits, Iron Flask lands on the flasks accent on its own.

Your three ilvl bands are the useful part either way: if it ever wants a ladder, 24–25 / 48–49 /
68–69 is gear depth 3 → **T2 T3 T4**, found rather than invented.

## 7. Two small ones

**`Aggressive Magic Hide` points at a Tier 9 Campaign does not have.** It is named
"Hide Magic after Act 3" but is not flagged `hide`. Flag it and it emits `Minimal` with no style
lines and needs no row — which is also the boundary you noted. If it is genuinely meant to show,
it is Campaign **T5**. Composition call, no colours either way.

**The 26 categories reading another's entry are correct.** Bottles → Curse of the Allflame,
Crafting Priority → Crafting Bases, and so on. That mechanism working is also what makes Fractured
free.

---

## What I still owe you

The icon floor sweep. Legacy is the biggest single cut — 17 of 17 blocks draw an icon *and* a beam
on the vendor accent, whose floor is `none`. It is per-category with subtractive `icon: none`
flags, so it cannot break a build, and it is not blocking anything of yours.

**15 of 411 setting their own border, states composing on 396** — the ratio held through a 115-block
collapse. That number is the one I would watch: it moved with the tree, which is what it should do.
