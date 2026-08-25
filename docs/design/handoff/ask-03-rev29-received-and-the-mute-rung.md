# ask-03 — rev 29 received. One blocker, two small gaps, and four questions withdrawn.

Measured against rev 29 (`_version: "rev 29"`, `_date: 2026-08-23`) and the shipped build
V7.0 (Ruthless). **This document was rewritten before sending**: a first draft asked four
things rev 29 had already answered, in `theme-rungs-rev29.json` rather than in the patch. Those
are listed at the bottom as withdrawn, so you can see what not to spend time on.

**rev 29 is the most useful drop so far.** 39 rows gained a `MinimapIcon`, 56 gained a
`PlayEffect`, and `_icon_beam` states the invariant plainly:

> *"icon ⟺ sound; beam only where an icon is; quiet list carries neither."*

Measured against our 197 live tiers: **91 satisfy it, 77 do not** (59 sound-without-icon,
9 icon-without-sound, 9 beam-without-icon). That is a mechanical worklist and we will apply it.

---

## 1 · ★ STILL BLOCKING, third time of asking — `compile_theme.py` cannot run

`rung_recipes` is present and correct. Three keys the compiler reads are absent from every
rev-29 deliverable, as they were in rev 28 and rev 27:

| key | call sites in `compile_theme.py` | what it decides |
|---|---|---|
| `flat_look` | 3 | which rows render flat vs plated |
| `gear_ladder` | 2 | the equipment rung → step mapping |
| `size_map` | 1 | rung → `SetFontSize` |

Until these land, every rev is **hand-ported row by row**. That is not a hypothetical cost —
it is how the map beams were stripped once, how three Gold tiers merged into one grey, and how
the inversion in §2 below survived three revisions of hand porting.

**If any of the three has been deliberately dropped rather than being pending, say so in one
line and we will delete the code path instead of waiting for it.**

---

## 2 · Two categories with no bottom rung — and one that is new to you

Your `audit_2026_08_08.A_deep_tier_desaturation` diagnoses our problem exactly, and the R4/R5
recipes give us the fix, so **this is not a request for values.** Two exceptions:

**`Omens` — in neither the patch nor the finding-A affected list.** Its `Tier 4` is
`#aa9e82` text on `#000000f0`. Under `authored_by_construction` you list Omens as inheriting
shared template tiers for "T2/T3 bands", which does not reach T4. Should Omens T4 take the
generic R4 currency recipe, or does the category end at T3?

**`Breach Rings` — created after your last sweep, so you have never seen it.** Six new 3.29
ring bases (Cryonic / Enthalpic / Synaptic / Organic / Fugitive / Formless). We gave it the
verdigris league-base look by copying its sibling `Breach Grasping Mail` verbatim, on the
reasoning that it is a league base category like the other six Prized Bases. **Confirm that is
right, or name the accent you want.** If it should simply be the 7th Prized Base, say so and
we will route it there.

---

## 3 · What is OURS, not yours — stated so you do not spend time on it

- **Two tiers sharing one rung.** `Jewels` Tier 3/Tier 4 both claim rung 4; `Omens` Tier 1/2
  both claim rung 3. Two tiers on one rung must render identically — arithmetic, not palette.
  Your `rung_collision_rule` already tells us what to do (*"re-tier on your side… and say so in
  the port report"*), so we will re-tier and report.
- **The mute rows are an INVERSION on our side, not a missing value.** Your R4 recipe reads
  *"Currency: `TextColor 0 0 0` on the classic tan plate `170 158 130`"* — the tan is the
  **plate**, with black text on it. Our rows had tan as the **text** on a black plate, which is
  why the author kept reporting things as "greyed". Six of our seven such rows are covered by
  your patch or by finding-A; we are fixing them from your recipes.
- **Sulphur bands.** `rungs_by_stack: ["R2","R3","R4"]` answers it — our ladder was on rungs
  1/2/4, which is why the small band went mute. Ours to correct.

---

## 4 · Withdrawn from the first draft — rev 29 already answers these

Recorded so the same questions are not asked twice:

| withdrawn question | where you had already answered it |
|---|---|
| "Sulphur has 3 stack bands but you gave 1 row — what rule?" | `new_families → Dead Man's Sulphur → rungs_by_stack: ["R2","R3","R4"]`, *"amount promotes the rung (like gold)"* |
| "rev 29 reaches only 29 of our 53 categories — Uniques, Rare Equipment, Map Fragments and the Flasks are uncovered" | `coverage_rollcall` classifies all 67 tier files. Uniques and the Flasks are **`intentionally_untouched`** (pinned / campaign grammar); Omens, Runegrafts, Heist Currency, Fragment Splinters and Relics are **`authored_by_construction`** |
| "The seven mute rows need bottom-rung values" | `A_deep_tier_desaturation` + the R4/R5 recipes. Ours was an inversion — see §3 |
| "Is `icon ⟺ sound` absolute or a default?" | Absolute. The author's own rationale settles it: a sound says *something dropped*, the icon says *where* — and in Ruthless mobs die off screen, so a sound with no icon is a drop you can hear and cannot find |

---

## 5 · One thing you may want to know

The author's in-game verdict on the rung system itself: **"rung is good."** The difficulty was
never the scale — it was the icon floor, which rev 29 has now settled. Two of the three items
left in this document are ours to fix, and the third is `flat_look` / `gear_ladder` /
`size_map`.
