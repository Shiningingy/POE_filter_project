# Visual encoding brief — for the theme designer

Working document. Prepared 2026-07-26 for discussion; nothing here is final.

---

## 1. What we are styling

| | count |
|---|---|
| Theme **categories** (each needs a style set) | **88** |
| — already styled | 49 |
| — currently falling back to `Default` | **39** |
| Category files in the editor's navigation | 102 |
| Curated item names | 4,376 |
| Blocks in the generated filter | 419 |

**Tier depth is not uniform.** Categories declare different numbers of rungs:

| rungs | categories |
|---|---|
| 2 | 27 |
| 3 | 14 |
| 4 | 11 |
| 5 | 6 |
| 6 | 25 |
| 7–8 | 4 |

Slot numbers in use: `0 1 2 3 4 5 6 7 9` (9 = the hide/minimal slot).
So: **a full ladder is 6 visible rungs + hide, but half the categories use 2–3.**
Any design must degrade gracefully to a 2-rung category.

Largest categories: Campaign 597 items, Uniques 521, Divination Cards 450,
Skill Gems 347, Legacy 326, Support Gems 212, Map Fragments 170.

---

## 2. The problem with the current theme

Measured across the 50 styled categories — how much each channel varies by
**tier** (rank) versus by **category** (what kind of thing it is):

| channel | varies by tier | varies by category | reads as |
|---|---|---|---|
| FontSize | 7.0 | 1.7 | mostly clean |
| TextColor | 6.1 | 9.7 | **both** |
| BackgroundColor | 5.0 | 10.0 | **both** |
| BorderColor | 6.0 | **18.0** | **both** |
| PlayEffect | 1.0 | 2.7 | category only |

**Every colour channel encodes both rank and family at once.** A darker label
could mean "lower tier" or "different category" — the player cannot tell which.
There is no spare channel for anything new because nothing is cleanly assigned.

Two specifics:

- **Border is visible on 100% of tiers** (every category, every rung) and holds
  **18 distinct values** — it is currently our strongest *family* signal.
- **Background is the weak channel** — 25 of 50 categories share the identical
  Tier-1 background `#1a1e23`.

This is inverted from where we want to be.

---

## 3. Proposed strategy — one owner per channel

The rule: **each visual channel encodes exactly one thing.** Where a channel
carries two meanings today, one of them moves.

| channel | owns | notes |
|---|---|---|
| **Font size** | tier rank | `45 / 42 / 40 / 38 / 36 / 34` + `30` for hide. Primary signal. |
| **Background hue** | drop family | must take over from the border |
| **Background lightness** | within-tier nudge | **binary only** — "T2" vs "T2+" |
| **Text colour** | *derived* for contrast | follows the background; not a free channel |
| **Border** | orthogonal flags | corrupted / league-mod / locked. Rare, binary, never rank. |
| **Beam** | tier-gated (top rungs only) | currently fires at every rung |
| **Minimap icon** | tier-gated; shape = family | it answers "walk over there?" |
| **Sound** | top rungs only | the loudest channel we have |

### The key idea

Colour is not one channel — it is **three**: hue, saturation, lightness. That
lets "colour" carry both *what kind of drop* and *better-than-its-neighbours*
without stealing the border:

- **Hue** = family
- **Lightness of that same hue** = the within-tier nudge

They are orthogonal, so they never collide. The comparison that matters is
always *within* a category (two T2 gems side by side), where a brighter version
of the same hue reads instantly. Cross-category rank is carried by size, so
lightness never needs to be comparable between families.

---

## 4. How much separation is actually available

This is the budget. Exceeding it produces noise, not information.

| channel | reliably distinguishable | notes |
|---|---|---|
| Font size | **6 steps** + hide | 2-point steps; readable *comparatively* when several items drop together, not in isolation |
| Hue families | **6–8** | hard ceiling. Against a dark, cluttered game background, more hues stop being separable |
| Lightness within a hue | **2–3** | we should use 2 |
| Border | **binary**, plus 2–3 colours | reserve for flags |
| Beam | 4–5 colours | very high attention cost — top rungs only |
| Sound | 5–7 memorable | top rungs only |

**The critical consequence: 88 categories cannot have 88 identities.**
They must be grouped into **6–8 hue families**. Within a family, categories are
distinguished by *context* (a scarab and a map fragment both being "map blue" is
fine — the item name tells you which).

A first-cut grouping for discussion:

1. **Currency** — currency, shards, splinters, catalysts, oils, omens, runegrafts
2. **Maps** — maps, fragments, scarabs, breachstones
3. **Gems** — skill + support
4. **Equipment bases** — all gear classes, sub-keyed by item rarity
5. **Uniques** — its own identity
6. **Divination cards** — its own identity
7. **League mechanics** — Heist, Expedition, Delve, Ritual, Breach, Abyss, …
8. **Utility / quest / legacy** — deliberately quiet

Combinatorially this yields 6 sizes × 7 hues × 2 lightness ≈ **84 distinguishable
states**, which covers 88 categories once they are grouped into families. But the
eye decodes roughly **three** dimensions at once — so size, hue, and one accent
is the working budget per item, and everything else must stay quiet.

### One factor in our favour

This is a **Ruthless** filter: drops are sparse. Far fewer items are on screen at
once than in a standard filter, so we can afford richer per-item styling than a
trade-league filter would tolerate.

---

## 4b. How the reference filters tier things

Our own tiering is still rough, so we measured the two references. FilterBlade
annotates every block with `$type->… $tier->…`, which is a complete dump of its
taxonomy; Sharket tags styled lines with `# T1通货`.

| | categories | mean rungs | median rungs | deepest real ladder |
|---|---|---|---|---|
| **Sharket** (hand-made, Ruthless) | ~15 | 2.1 | 2 | **4** (currency) |
| **FilterBlade** (Regular) | 143 in **52 families** | 6.1 | **4** | 7 (`t1`…`t7`) |
| **ours** | 88 | 4.4 | **4** | 8 |

Three things fall out of this.

**Our median already matches FilterBlade's.** Both sit at 4 rungs. Sharket's
deepest category is 4 (currency), everything else is 1–3. So our ladders are
**not too coarse** — if anything they are on the deep side.

**But our depth is bimodal, and that is the roughness.** FilterBlade tapers
smoothly (19 categories at 1 rung, 24 at 2, 21 at 3, 13 at 4, 16 at 5, 13 at 6,
9 at 7). Ours clusters at the extremes: **27 categories at 2 rungs and 25 at 6**,
with a thin middle. Categories are either barely tiered or fully laddered, with
little judgement in between. Evening that out is tiering work, not theme work,
but the designer should know a "6-rung ramp" is used by only ~28% of categories.

**FilterBlade's deep categories are not ladders.** `jewels->clustereco` (54),
`rareid` (52), `maps` (39), `uniques` (37) are *variant matrices* — cluster
jewels keyed by notable-count × item-level, rare IDs by mod archetype, maps by
map tier — not rank. We have two of our own (Campaign weapon/armour progression,
19 and 32). These need a different visual treatment from a rank ladder, and
should not consume 32 distinct styles.

Also worth noting how *little* vocabulary Sharket needs: the entire filter uses
**29 distinct tier tags**, and its whole currency ladder is `T1通货`…`T4通货`.
FilterBlade's core vocabulary is equally plain — `t1`–`t7` plus semantic names
(`any`, `general`, `restex`, `exhide`).

**Conclusion for the design:** target a **4-rung ramp as the common case**, with
6 as the maximum for the few genuinely deep categories, and treat 1–2 rung
categories as first-class rather than as degenerate cases. This also settles the
open question below — since neither reference goes beyond 4 rungs for currency,
"better than T2 but not T1" is a **within-tier nudge, not a missing rung**.

## 5. What we need

1. **6–8 hue families**, each with a ramp built for **4 rungs as the common
   case**, extending to 6 for the deep categories, plus the hide slot — and a
   defined "+" lightness variant for the within-tier nudge.
2. A rule for **text colour derivation** so contrast holds on every background in
   the ramp.
3. **Border treatments for flags** — corrupted, league-mod, locked — that read on
   any family background.
4. Guidance on **shallow categories**: 27 of our 88 have only 2 rungs. Which two
   steps of the ramp do they use, and do they read correctly next to a 6-rung
   category?
5. A treatment for the **variant matrices** (Campaign weapon/armour progression,
   19 and 32 entries) that does not require 32 distinct styles.

## 6. Open questions

- Should the hide/minimal slot stay visible at size 30? Under Ruthless `Hide`
  becomes `Minimal`, so those items still render.
- Beams currently fire on every rung. Confirm they should be top-rungs-only.
- We have **88 categories against FilterBlade's 52 families**. Some of ours are
  probably over-split for styling purposes even where they are right for
  curation — the theme could group them without the tree changing.

*(Resolved by §4b: "better than T2 but not T1" is a within-tier nudge, not a
missing rung — neither reference filter uses more than 4 rungs for currency.)*
