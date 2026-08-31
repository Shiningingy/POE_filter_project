# ask-05 — the recount you asked for (you were right), and the icon report

Answering rev 30. One correction to ask-04 that changes the derivation rule, plus #8.

---

## 1 · The recount — **you were right, and my first number was wrong twice**

**My error.** The ask-04 table used a first-file-wins lookup, so for a category spanning
several mapping files it reported whichever file the walk reached first. That is the same
defect I had just finished fixing in the tier-label index, committed in the same session.
Sorry — you were right to distrust it.

**But the recount does not vindicate `item_class` either.** Two different failure modes:

- **`Campaign` is MIXED, as you suspected** — 7 mapping files declaring **6 distinct
  values**: Weapons, Armour, Jewellery, Flasks, Linked Gear, Equipment. My "Weapons" was
  file 1 of 7.
- **`Influenced` is single-valued in metadata and still wrong.** One file, declaring
  `Body Armours` — but its **175 bases span 19 classes**, and Body Armours is 18 of them
  (**10%**). The top class is Helmets at 17%. The declared value is a *label someone
  typed*, not a description of the contents.

So the conclusion is stronger than either of us had:

> **Do not derive the group from `_meta.item_class`. Derive it from the classes of the
> category's actual BASES.**

That needs no metadata, cannot drift, and is right for `Influenced` and `Campaign` alike.
It also rescues categories where the declared value is not even a GGPK class:
`Magic Net` declares "Magic Net" and is **100% jewellery**; `Ritual BaseTypes` declares
itself and is **100% armour**. Both are safe to derive — from bases, never from the label.

### Group purity, measured from bases

Your four groups, ≥95% of a category's gear bases in one of them:

**16 group-pure — derive the hue, it is safe**
`Abyss Jewels` · `Base Jewels` · `Cluster Jewels` · `Breach Rings` · `Mirror Ring Bases` ·
`Stygian Vise` · `Talismans` · `Magic Net` (all jewellery) · `Breach Grasping Mail` ·
`Expedition Ward-Bases` · `Ritual BaseTypes` · `Sacrificial Garbs` (all armour) ·
`Life Flasks` · `Mana Flasks` · `Utility Flasks` · `Tinctures` (all flasks)

**7 span groups — fall through to the mixed accent**

| category | spread | declared |
|---|---|---|
| `Rare Equipment` | armour 744 / weapons 486 / jewellery 107 | Fractured, Rare Equipment |
| `Campaign` | armour 333 / weapons 264 | 6 values |
| `Crafting Bases` | armour 166 / weapons 75 / jewellery 41 | Crafting Priority |
| `Uniques` | armour 123 / weapons 65 / jewellery 55 / flasks 12 | Unique Items |
| `Influenced` | armour 111 / weapons 34 / jewellery 30 | Body Armours ⚠️ |
| `Heist Experimented` | weapons 29 / jewellery 12 / armour 6 | Heist Experimented |
| `Legacy` | jewellery 9 / armour 7 / weapons 3 | Legacy |

`Crafting Bases` lands where you already had it. `Influenced` and `Heist Experimented`
move **onto** the mixed list — you had them as guesses, and the guess was armour.

**26 categories are not gear at all**, so the group question does not arise. Note
`Enshrouded Gear` is among them: `Enshrouded Items` is its own GGPK class and sits in none
of the four groups — which matches you taking it as its own look.

Your two orphans are settled as you ruled: `Heist Equipment` → `gear_quiet`,
`Mirror of Kalandra Ring Bases` → jewellery (and its bases *are* 100% jewellery, so the
derivation agrees with you).

---

## 8 · Icon report — floor R2, ruthless/uber

**287 emitted Show blocks draw an icon, across 43 categories.**

Against your rule (*icons at R0–R2 plus safety nets; R3+ is a defect*): **64 tiers draw an
icon at R3+.** But the raw number overstates it, in two ways worth separating before you
spend time on it.

**(a) 15 of those 64 are the category's OWN top tier** — a flat category whose single rung
happens to sit at R3+. These are your §7 re-tier backlog wearing a different hat, not an
icon defect: `Runegrafts T0/T1`, `Wombgifts T1`, `Omens T1`, `Talismans T0`,
`Heist Experimented T0`, `Stygian Vise T0`, `Tinctures T0`, `Life/Mana/Utility Flasks T1`,
`Heist Contracts T0`, `Heist Blueprints`, `Influenced T1`, `Abyss Jewels T1`.
Grow the tier, and the icon moves up with it.

**(b) Twelve categories draw exactly one icon, on their only tier** — `Breach Grasping
Mail`, `Breach Rings`, `Mirror Ring Bases`, `Sacrificial Garbs`, `Stygian Vise`,
`Heist Targets`, `Life`, `Mana`, `Tinctures`, `Blueprints`, `Misc`, `Contracts`. Same
story.

**The genuine review list — a real ladder with icons deep in it:**

| category | icon blocks | tiers w/ icon | deepest |
|---|---|---|---|
| `Currency/General` | 45 | 7 | R3 `Tier 5 General`, R3 `Tier 6 General` |
| `Maps/Fragments` | 44 | 5 | R3 `Tier 2/3 Fragments`, R4 `Tier 4 Fragments` |
| `Uniques/General` | 38 | 5 | R3 `T3`, R3 `Other` |
| `Gems/Skill` | 16 | 6 | R3 `Tier 3`, R4 `Tier 4`, R5 `Tier Net` |
| `Misc/General` | 14 | 1 | R3 `Misc` (14 blocks on one tier) |
| `Currency/Tainted Currency` | 11 | 4 | R3 `Tier 3`, R4 `Tier 4` |
| `Jewels/Cluster Jewels` | 6 | 6 | R4 `Tier 3/4`, R5 `Tier 5/6` |
| `Jewels/Base Jewels` | 3 | 3 | R4 on Magic / Normal / Rare |
| `Maps/Scarabs` | 5 | 5 | R3 `Tier 3`, R4 `Tier 4` |

`Currency/General`, `Maps/Fragments` and `Uniques/General` are where I would start —
they carry 127 of the 287 icons between them.

Raw data is in `out/icons.trace.json` (regenerate:
`node filter_generation/generate.mjs --mode ruthless --strictness uber --out out/icons.filter --trace out/icons.trace.json`).

---

## Absorbed, no reply needed

#5 gem quality `>= 20` · #9 gold unchanged · #3 `Continue` stays DESIGN-ONLY until the
generator can emit it · #6 font-below-32 parked · #4 nine areas as conditions inside two
rungs, not nine rungs · #7 flat list is a re-tier backlog and `flat_look` is declared, never
inferred. #2 `state_budget` is still mine, pending the trace run.
