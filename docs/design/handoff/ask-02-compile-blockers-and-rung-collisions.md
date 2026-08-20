# ask-02 — one blocker, one real defect, and two things you can close

Follows rev 28 / reply-20. Everything below is measured against the shipped build
(`V6.98`, ruthless / soft, 465 blocks) using the kit-checking tools in the repo, so every
number here is reproducible rather than recalled.

Short version: **rev 28 is contrast-sound** — 0 pairings under 3.0:1 across all three files.
The problems are structural, not palette.

---

## 1 · BLOCKER — `compile_theme.py` still cannot run

rev 28 restored `rung_recipes` in structured form (thank you — that closed half of it). Three
keys the compiler reads are still absent from all three rev-28 files:

| key | call sites in `compile_theme.py` | what it decides |
|---|---|---|
| `flat_look` | 3 | which rows render flat vs plated |
| `gear_ladder` | 2 | the equipment rung → step mapping |
| `size_map` | 1 | rung → `SetFontSize` |

Until those land we cannot compile your kit; the theme in the shipped filter is still applied
by hand-porting each rev, which is how the map beams got stripped once and how three Gold
tiers were merged into one grey. **This is the only item here that blocks work.**

If any of the three is deliberately dropped rather than pending, say so and we will delete the
code path instead of waiting for it.

---

## 2 · REAL DEFECT — 18 tiers across 7 categories are on different rungs and render identically

This is new, found by `check_label_collisions.py` against the emitted filter. In each group
below the tiers sit on **different rungs** yet emit **byte-identical** style — same size, same
text, same plate, same border. The ladder exists in the data and disappears on the ground.

| category | rungs | tiers | what they all emit |
|---|---|---|---|
| **Skill Gems** | 3, 4, 5 | `Tier 3 Skill`, `Tier 4 Skill`, `Tier Net Skill` | 40px · text `27 162 155` · plate `27 51 52` |
| **Jewels** | 4, 4, 5 | `Tier 3/4/5 Cluster Jewels` | 40px · text `196 111 255` · plate `0 0 0 240` |
| **Omens** | 2, 3, 3 | `Tier 0/1/2 Omens` | 40px · text `0 0 0` · plate `255 165 0 240` |
| **Harvest** | 3, 4 | `Tier 2/3 Harvest` | 40px · text `46 204 113` · plate `0 0 0` |
| **Map Fragments** | 1, 2 | `Tier 0/1 Fragments` | 45px · text `255 255 255` · plate `210 0 0` |
| **Utility Flasks** | 2, 3 | `Tier 0/1 Utility Flasks` | 40px · text `0 0 0` · plate `184 218 242 240` |
| **Curse of the Allflame** | 0, 1 | `Bottles`, `Sulphur T0` | 45px · text `255 255 255` · plate `0 160 112` · border white |

**Skill Gems is the worst case** — three rungs, one look, and one of them is the *net* tier,
so the safety layer is indistinguishable from curated T3/T4 gems.

Two things worth separating, because they need different answers:

- **Rungs 3/4/5 and 4/5 collapsing** suggests the low end of the ladder has run out of
  distinct steps. If the family colour must survive every rung (your rule, and we agree), the
  remaining levers are **plate darkness** and **size** — and `size_map` is exactly the key
  missing in §1. So this may be one problem, not two.
- **Allflame rung 0 vs 1** is different: those are the top two rungs, where a distinction
  should be most visible.

We are not proposing colours — you own that. We are reporting that the rung numbers are
currently not buying anything in these seven places.

---

## 3 · Minor — two colour pairs have arithmetic that does not match measurement

`check_designer_kit.py` reports 5 mismatches, but they are **two distinct pairs** repeated
across files, not five problems:

| claimed | measured | appears in |
|---|---|---|
| 4.74 | **5.42** | `Heist Experimented T1`, `Trinkets T2`, `Heist family (scarlet) mid` |
| 4.48 | **4.42** | `Trinkets T4`, `Heist family (scarlet) dim` |

Both measure **above** 3.0:1, so nothing is unreadable — it is a bookkeeping slip. Worth
fixing only so the kit's own numbers stay trustworthy as a reference. 69 other pairings verify
exactly.

---

## 4 · CLOSED on our side — the influence violet

`theme-accents-rev28.json:155` still carries *"PENDING unification with decorator 150 0 255 —
pick one, reply 05 still open"*, and `theme-patch-rev28.json:603` recommends unifying on the
decorator's value.

**That note is out of date.** Our influence decorator is `#966eff` = **150 110 255** — the
kit's value — and `150 0 255` appears nowhere in the tree. Both sides are already on
`150 110 255`, so there is nothing to pick. The note can simply be dropped in rev 29.

---

## For reference — what is NOT a problem

So the next rev does not spend effort here:

- **Contrast**: 0 of **167** pairings fall under 3.0:1 across the three rev-28 files
  (87 in the patch, 80 in the rungs file; the accents file carries recipes, not pairs).
- **Heist Currency**: the kit's *"single tier (any amount)"* is now what ships. The old
  `StackSize >= 200` split was retired — markers no longer drop in the open world, and the two
  tiers were emitting identical blocks anyway.
- **Guardian maps**: resolved. `Shaper Guardian Map` is the single live base; the four split
  guardians are dead content.
- **Coverage**: cross-checked against FilterBlade in both directions — 0 gaps either way,
  outside the deliberate divination-card deferral.
