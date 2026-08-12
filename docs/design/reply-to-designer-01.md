# Reply to the theme handoff (v1)

Read `theme-presets.json` + `theme-standard.md`. This is the right shape — a recipe with
35 authored values rather than a painted theme — and it fits the engine as rebuilt. Below:
what already works, the two answers you asked for, and the four things that block
compiling it.

---

## 1. The engine is ready for this, and three of your choices are already load-bearing

- **`Continue` state borders.** Built and shipping: a tier can set `"decorator": true` and
  emits its conditions, only the channels it states, then `Continue`. Guarded by a
  validator (errors on no-conditions, on a hide tier, on stating no channel; warns above
  two channels) and by 7 composition tests. **We verified the semantics in game before
  building**: without `Continue` the first match wins whole-block and stops; with it, later
  blocks override *only the properties they set*. So your five borders compose exactly as
  §6 assumes.

- **`rarity_through` is not new to us** — it is how 441 of our 998 current rows already
  work. Omitting a colour is a real instruction to the game, and we have a shared guard so
  every emission site treats absent-vs-off identically. Your painted/rarity_through split
  formalises something the tree was already doing implicitly.

- **Presets carry no FontSize.** Agreed and already true on our side; `size_map` shipping
  separately is exactly right.

## 2. Your open question 3, answered — both are done

> *"Jewels key names after the 3-file split; whether Fractured.json comes off Body Armours."*

- **Jewels** is now three files that all resolve to one theme key, `Jewels`:
  `Abyss Jewels` (3 rungs, ilvl 86/82/any), `Base Jewels` (1 rung, always shown),
  `Cluster Jewels` (7 rungs: size × passive count × ilvl, ported from FilterBlade's
  thresholds — Large at ≥12 or ≤8, Medium at ≤5, Small on ilvl only). So one accent covers
  all three today. **If you want abyss/cluster to read differently, say so** — they are
  separate files, so splitting the accent is a one-line change, not a restructure.

- **Fractured** now has its own three-rung ladder (`FracturedItem True` + `Mirrored False`
  + `Corrupted False`, banded ilvl 84+ / 68+ / any). It still resolves to the
  `Body Armours` theme key, which is wrong — fractured applies to all gear, not body
  armour. **Our recommendation: take it off Body Armours.** But note it now overlaps your
  `fractured` state border: the ladder decides *whether and how loudly* a fractured item
  shows, the border says *that it is fractured*. If you would rather the state border do
  the whole job, the ladder can shrink to one rung — your call, and worth deciding before
  we compile.

## 3. Four things we need before we can expand the recipe

**(a) accent → category mapping. This is the blocker.**
You authored **17 accents**; the tree has **75 live theme categories**. Most map by
inspection (`Essences`→essences, `Maps`→maps), but a lot do not, and guessing would put
your colours on the wrong content:

- four Heist categories (`Heist Contracts`, `Heist Blueprints`, `Heist Currency`,
  `Heist Equipment`, plus `Heist Targets`, `Heist Experimented`) against one `heist` accent
- `General`, `Gold`, `Corpses`, `Delirium Orbs`, `Enshrouding Crystals`, `Incursion Vials`,
  `Chancing`, `Crafting Bases`, `Legacy`, `Campaign`, `Magic Net`, `Influenced`,
  `Enshrouded Gear`, `Curse of the Allflame`, and every equipment class
- `equipment` appears in `state_budget` but has **no accent entry** — we read that as
  "gear is rarity_through, no accent". Please confirm.

The full list of 75 is attached as `theme-categories.txt`. Mapping it does not need one
accent each — "these twelve share `currency`" is a perfectly good answer.

**(b) `_tier_to_rung` for the other 15.**
You gave it for `currency` and `essences` inside the goldens, and it is the piece we cannot
derive: our ladders are 1–7 rungs and yours are T0–T6, with skips (currency skips T4/T5).
Same format is fine.

**(c) Rank direction — please confirm, because getting it backwards is silent.**
§6 says rank breaks ties and *enchanted outranks corrupted*. Since `Continue` means the
**last** matching block wins a channel, the highest-priority state must be emitted **last**
— i.e. we write them in order corrupted(5) → linked(4) → influenced(3) → fractured(2) →
enchanted(1). We will build it that way unless you say otherwise. It only shows up in game
on an item carrying two states at once, so it is exactly the kind of thing that ships wrong.

**(d) `maps` has two exceptions we want to scope.**
"plate follows item rarity, icon colour follows map tier." Icon-colour-per-map-tier is fine
(each map tier is its own block). Plate-follows-rarity we read as: leave text and
background unset and let the game paint, keeping only the border. Confirm?

## 4. What we will do with it

Compile `accents × rung_recipes` into the theme rows the filter actually reads — a pure
function, no I/O, exactly as your `goldens` section describes — and pin it with a test that
expands `currency` and `essences` and compares against your two goldens byte for byte.
That test is the contract: if we ever drift from the recipe, it fails.

One consequence worth naming: today the tree carries **655 theme rows that no tier resolves
to** — a full T0–T9 ladder authored for categories with four real rungs. Compiling from the
recipe deletes them by construction, because rows will exist only where a rung does. That
is the single biggest reason this handoff is the right shape.
