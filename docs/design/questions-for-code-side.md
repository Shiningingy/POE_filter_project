# Questions for the code side — what I cannot answer from the design alone

Ordered by how much they block. Each says **why it matters** and **what I will assume if you have
nothing** — so silence is safe, just less good.

---

## Blocking-ish

### 1. Gear group membership — can it be derived, or do I hand-map it?

`gear_ladder.groups` has four hues (armour / weapons / jewellery / flasks). I assigned the ~30 gear
categories by name, which is fine for `Bows` and `Boots` and a guess for these:

`Crafting Bases`, `Campaign`, `Influenced`, `Magic Net`, `Relics`, `Talismans`, `Stygian Vise`,
`Trinkets`, `Sacrificial Garbs`, `Heist Equipment`, `Heist Experimented`, `Enshrouded Gear`,
`Expedition Ward-Bases`, `Breach Grasping Mail`, `Mirror of Kalandra Ring Bases`

**Why it matters:** the group hue is on the border, which is the rung channel — a wrong group means a
wrong-coloured rung across a whole class.

**The real question:** does a tier block know its `item_class`? `base_mapping._meta.item_class` is
listed as moving to "tier block / category meta, or derived per-base from GGPK". **If item_class
survives, derive the group from it and I author four hues instead of thirty mappings.** That is much
better than my list.

**Assumption otherwise:** Talismans/Trinkets → jewellery; Relics, Sacrificial Garbs, Grasping Mail,
Ward-Bases, Enshrouded Gear → armour; Stygian Vise → jewellery; Mirror Ring Bases → jewellery;
Campaign, Crafting Bases, Influenced, Heist Equipment/Experimented → mixed, so they fall back to the
`equipment` accent rather than guess.

### 2. Is `state_budget` right, or is it my inference?

I asserted which classes can hold which of the five state borders (currency 0, gems 1, gear 5, …) and
asked you to make it a validator error. **That table is reasoning, not measurement.** The trace knows
which conditions actually co-occur with which classes.

**Ask:** can you check `state_budget` against the trace and tell me where I am wrong? Specifically —
can a **map** be fractured or influenced? Can a **jewel** be enchanted? If any class has more states
than I claim, the T5-borderless and flat forms become illegal there and I need to know before you
compile.

### 3. Does `Continue` compose a state border over a *rung* border across blocks?

You verified `Continue` overrides only the properties a later block sets. Gear now puts its **rung**
on the border, and a state also wants the border — resolved as "the state wins, plate steps down".

**Ask:** confirm that a later decorator setting `SetBorderColor` cleanly replaces an earlier block's
`SetBorderColor` on the same item, and that the plate step-down can be expressed in the same
decorator (it needs to set two channels, which your validator warns above two). If a decorator cannot
set both, the plate step-down has to move into the gear presets as a second variant and I would
rather know now.

---

## De-risking, not blocking

### 4. The nine handpicked heist areas — are they our nine?

I took NeverSink's list verbatim (Bunker, Laboratory, Mansion, Prohibited Library, Records Office,
Repository, Smuggler's Den, Tunnels, Underbelly). Theirs is tuned for trade softcore.

**Ask:** does our tree carry contract *area* names at all, and is that list right for Ruthless? If
area is not a matchable property in our data, the whole heist re-tier is off the table and I should
know.

### 5. Quality thresholds — one number or two?

`text_swaps.quality` uses `Quality >= 21` on T0–T2 bases. Gems and gear may want different numbers
(a Q20 gem is the meaningful breakpoint; Q21+ only exists on corrupted gems).

**Ask:** confirm `Quality >= 21` is expressible, and whether gems need their own threshold. If gems
want `>= 20` that is a second entry, not a change to the rule.

### 6. Does Ruthless honour a font size below 32?

T5 is 30, deliberately under the game's default. **Ask:** confirm the game renders 30 rather than
clamping. If it clamps, T5 loses its only size distinction from T4 and I would move T4 to 36.

### 7. Which of the 12 "flat" categories are genuinely untiered?

`flat_look.applies_to_*` lists 12. `theme-categories.txt` shows most at 1 rung, but that was before
your restructures.

**Ask:** any of those 12 that now have 2+ real rungs should come off the flat list and onto the
ladder. Flat is for "not rankable", not for "shallow".

### 8. An icon-count report, so the floor sweep is data-driven

The per-category `icon_floor` sweep is mine to do in game, but I am guessing at scale.

**Ask (cheap, high value):** with floor T2, how many emitted blocks draw an icon, per category? A
one-column report is enough. If a category emits 40 icons at T2 I know to look at it first, instead of
running maps until something feels wrong.

---

## Two facts I am assuming and should not

### 9. Is gold auto-collected in **Ruthless**?

The whole `plate: never` exception rests on it. I believe Settlers gold is auto-pickup, but Ruthless
changes economy rules more than anything else. If gold is a manual pickup there, it is an ordinary T5
and the exception goes away.

### 10. Do `Delirium Orbs` and `Corpses` exist in 3.29 Ruthless?

They have accents and a category each. If either is dead content, that is two accents I should not be
spending — and `corpses` is a hue I invented for it.

---

## Nothing else is open on my side

The design is otherwise complete: 24 accents, 6 rungs, 5 state borders, 8 category exceptions, the
flat look, the gear ladder. Everything is in `theme-presets.json` and `accent-category-map.json`;
`theme-standard.md` is the spec and the board is visual truth.

The two things I still owe **you** are both post-compile and neither blocks it: the per-category icon
floor sweep (needs question 8, then in-game time) and a look at fragments-vs-breach in a real map.
