# ask-03 — rev 29 received; the mute rung, and the half of the tree it does not reach

Measured against rev 29 (`_version: rev 29`, `_date: 2026-08-23`) as delivered in
`Filter theme improvements.zip`, and against the shipped build V6.991 (466 blocks, Ruthless /
soft). Every number below is reproducible from the repo.

**Thank you for the icon and beam pass — that is the part we could not do ourselves.** 39 rows
gained a `MinimapIcon` and 56 gained a `PlayEffect` over rev 28, and the new invariant in
`_icon_beam` is the clearest rule we have been given:

> *"icon ⟺ sound; beam only where an icon is; quiet list carries neither."*

We measured our 197 live tiers against it immediately: **91 already satisfy it, 77 violate
it** (59 have a sound and no icon, 9 have an icon and no sound, 9 draw a beam with no icon).
That is a mechanical worklist, not a taste argument, which is exactly what we wanted.

---

## 1 · ★ THE IN-GAME DEFECT — a mute rung the family colour never reaches

The author has now rejected the same look three times in play: fossils/resonators, the Legacy
bucket, and most recently **"the small amount of Dead Man's Sulphur is greyed while
medium/large are correct."**

We traced it. Our Sulphur ladder bands by stack — `>= 3000` → rung 1, `>= 500` → rung 2,
everything smaller → **rung 4**. And our `Curse of the Allflame` **Tier 4** row is:

```
{ "TextColor": "#aa9e82ff", "BackgroundColor": "#000000f0", "FontSize": 40 }
```

Tan on near-black. The family verdigris is gone, so a small sulphur stack reads as grey while
the same item in a larger stack reads correctly. **rev 29 fixes exactly this** — your R4 is
`#000000` on `#00a070`, the family plate surviving to the bottom rung, which is your own
stated rule: *"the family colour survives every rung; there is no neutral-grey rung."*

**We hold seven such rows, in six categories:**

| category | row | text | plate |
|---|---|---|---|
| Curse of the Allflame | Tier 4 | `#aa9e82` | `#000000f0` |
| Corpses | Tier 4 | `#aa9e82` | `#000000f0` |
| Omens | Tier 4 | `#aa9e82` | `#000000f0` |
| Chancing | Tier 5 | `#aa9e82cc` | `#000000f0` |
| Vendor Recipes | Tier 4 | `#aa9e82` | `#000000f0` |
| Vendor Recipes | Tier 5 | `#aa9e82` | `#000000f0` |
| Gold | Tier 5 | `#8c8c8c` | `#000000f0` |

rev 29 covers **Corpses** and **Curse of the Allflame**. The other four categories it does not
reach, so those rows keep the mute look until you give them a bottom rung. **This is the
highest-value thing in this document.**

---

## 2 · The band-count mismatch — we have more bands than you have rows

`_tier_map` says sulphur is *"死者硫磺-by-stack"*, and the patch gives **one** sulphur row:
`R2 大量死者硫磺`. Our ladder has **three** stack bands (3000+ / 500+ / rest).

So we can place the large band with confidence and are guessing at the other two — which is
how the small band ended up on a mute rung in the first place.

**What we need per banded category: the rung for EVERY band, or a rule for deriving them.**
A rule would be better than a list. Something like *"bands descend R2 → R3 → R4 within the
family, never below R4"* would let us place any number of bands without asking again.

Where else this bites: Fossils (4 socket bands), Harvest (4 lifeforce bands — though your
`_tier_map` already merges Tier 2+3 into R4, which we will follow), Essences, Heist Currency.

---

## 3 · Coverage — rev 29 reaches 29 of our 53 theme categories

Allowing for name differences (your `Fossils & Resonators` = our `Fossils`, your `Heist
family` = our four Heist categories, your `Jewels (normal & abyss)` = our `Jewels`), these are
**live categories with no row in any patch you have sent**:

`Omens` · `Map Fragments` · `Utility Flasks` · `Life Flasks` · `Mana Flasks` · `Gold` ·
`Tinctures` · `Uniques` · `Rare Equipment` · `Magic Net` · `Chancing` · `Vendor Recipes` ·
`Quest Items` · `Relics` · `Support Gems` · `Enshrouding Crystals` · `Incursion Vials` ·
`Breach Rings` · `Breach Grasping Mail` · `Expedition Ward-Bases` · `Ritual BaseTypes` ·
`Sacrificial Garbs` · `Stygian Vise` · `Mirror of Kalandra Ring Bases` · `Enshrouded Gear`

Several are load-bearing: **Uniques** and **Rare Equipment** are the two biggest things a
player looks at, and **Map Fragments** and the three **Flask** categories are constant drops.

We are not asking for 25 bespoke palettes. **A default rule would do**: which accent a category
takes when you have not named it, and how its rungs descend. If some of these should simply
inherit an existing family, say which and we will route them.

---

## 4 · What is OURS, not yours — we are fixing these, no action needed

Stated so you do not spend time on them:

- **Two tiers sharing one rung.** `Jewels`: Tier 3 and Tier 4 Cluster Jewels both claim rung 4.
  `Omens`: Tier 1 and Tier 2 both claim rung 3. Two tiers on one rung must render identically —
  that is arithmetic, not palette. We will re-rank.
- **Sulphur's top band sits on rung 1**, but your Allflame family starts at R2 and `_tier_map`
  says *"NO R5"*. We will move it into the family range once §2 tells us the band rule.
- **Harvest Tier 2 == Tier 3.** We flagged this in ask-02 as a defect; it is not. Your
  `_tier_map` says *"Tier 2+3 少量/命能 MERGED=R4"*. Deliberate — withdrawn.

---

## 5 · Still blocking, third time of asking — `compile_theme.py` cannot run

rev 28 restored `rung_recipes` and rev 29 keeps it. Still absent from all deliverables:

| key | call sites in `compile_theme.py` | what it decides |
|---|---|---|
| `flat_look` | 3 | which rows render flat vs plated |
| `gear_ladder` | 2 | the equipment rung → step mapping |
| `size_map` | 1 | rung → `SetFontSize` |

Until these land, every rev is **hand-ported row by row**, which is how the map beams were
stripped once and how three Gold tiers were merged into one grey. It is also why §1 exists:
a hand port reaches the rows someone remembers to touch.

**If any of the three is deliberately dropped rather than pending, tell us and we will delete
the code path instead of waiting for it.** That answer costs you one line and unblocks us.

---

## 6 · One question about sequencing

The author is part-way through a manual pass over all 197 live tiers, marking each one
*"should this draw an icon? a beam?"* — intended as input to a brief for you.

Your `icon ⟺ sound` invariant may make most of that pass unnecessary: the rule already decides
77 of the 197 rows. Before they spend more time on it —

**Is the invariant meant to be absolute, or a default with exceptions?** If absolute, we apply
it mechanically and the author only reviews the *quiet list* (which tiers deserve neither icon
nor sound). If it has exceptions, the manual pass is still worth finishing and we will send you
its output.
