# Pending features — deferred to ship a usable filter first

Decided 2026-08-05. Shipping beats feature work; these are parked with enough context to
restart cold. Nothing here blocks generation — the filter builds, the validator reports 0
errors, and every guard is green.

---

## 1. Base-rank + generated conditions (the big one)

**The finding it rests on: we hand-author what FilterBlade generates.**

Measured from `data/from_filter_blade/3.29/FilterBlade.ruthlessfilter` — one ranked base fans
out into **11–14 blocks** there, each with its own derived gates:

```
Gemini Claw  →  influenced        ilvl 84  Rare
                rareid            —        Rare
                qualityperfection ilvl 83  —
                memorystrand      —        Normal
                fractured         —        Normal
                veiled            ilvl 68  Rare
                rr                ilvl 68  Rare
                generalgear       ilvl 83  Normal
```

`crafting->generalgear` gates **Gemini Claw at 83, Imperial Bow at 86, Jewelled Foil at 83** —
so the threshold is a property of the BASE, derived, never authored.

| layer | FilterBlade | us |
|---|---|---|
| authored | base → rank, and nothing else | tier blocks, rules, ilvl gates, all by hand |
| derived | base → ilvl threshold | — |
| generated | rank × purpose → ~12 blocks | what we author directly |

That single mismatch explains everything found on 2026-08-05: the 10 hand-written Ring rules
for 5 bases × 2 bands, ~90 hand-written ilvl rules across equipment, the silent `Tier 0`
scaffolds, and `Body Armours` missing the 84 rung all 11 of its siblings have.

**Two decisions must be made before any code:**

1. **Which purpose blocks do we want?** FilterBlade's ~12 are trade-shaped — `rareid` presumes
   you identify rares to sell, which Ruthless has no economy for. This list IS the spec.
2. **Where do thresholds come from?** Theirs is per-BASE, not per-class. Our measured
   per-category grouping is a starting approximation, not their data:

```
[84, 86]  11 cats  Amulets Belts Boots Bows Claws Daggers Gloves Helmets Quivers Rings Shields
[83]      10 cats  Axes Maces Sceptres Staves Swords 2H-Axes 2H-Maces 2H-Swords Wands Warstaves
[86]       4 cats  Body Armours, Influenced, Rune Daggers, Stygian Vise
[82]       2 cats  Life / Mana Flasks
[84]       2 cats  Cluster Jewels, Tinctures
```

⚠️ Note this does **not** split weapon-vs-armour: Bows, Claws and Daggers follow the armour
ladder; the heavy weapons are the ones on 83.

**Already built toward it** (shipped, in use): the rank brush and the collapsed base card in
`BulkTierEditor.tsx` / `CategoryView.tsx`. Those are the authoring surface this model needs.

## 2. Match presets — shared, named condition sets

Class-condition tiers show an **empty base list** in the editor, which reads as unfinished
work whether or not it is. And the same 24-class equipment list is repeated verbatim across
**13 tiers in 6 files**, in 4 textually-different forms — two of which are already
semantically identical but not textually equal. Nothing has drifted yet; nothing prevents it.

```
Magic Net ×2 · Influenced ×2 · 6-Link · 6-Socket · RGB Linked
Camp 4-Link · Camp 3-Link · Rare Safety Net · Normal/Magic Declutter · Aggressive Magic Hide
```

Split the work:

- **Small, do first:** render a `class_condition` tier as a **rule card** ("matches by rule:
  6 linked sockets, 24 classes"), with the rule view minus the basetype field behind the
  click. Pure UI, no data change. Same shape as the base card already shipped.
- **Larger:** the shared preset library itself — a new data concept plus a reference
  mechanism. Design it alongside #1, not before.

Naming candidates: **Match Presets** (fits the project's existing "preset" vocabulary),
*Shared Conditions* (plainest), or the author's *Predefined Rules*. The distinction to encode:
**bases match by identity, these match by property.**

⚠️ **Boundary to write down when building:** decorators are ALREADY property-matchers. The
difference is that a decorator paints one channel and composes via `Continue`, while these are
full blocks that terminate. `6-Link` and the `Linked` decorator match nearly the same items
for different purposes — say so explicitly or we end up with two systems doing one job.

## 3. Cluster jewel passive-type axis

`EnchantmentPassiveNode` is in `filter_conditions.yaml` with a 22-option picker and used
**zero** times. Two problems:

- The picker offers 22 options; FilterBlade uses **41**. Missing include `Reservation
  Efficiency` and `Minion Life` — the two the author's own model needs.
- It is declared `type: select`, but the game matches on **substring** (FilterBlade ships
  `EnchantmentPassiveNode "Suppres"` deliberately). A fixed list is the wrong control.

Author's intended ladder, for when this is picked up: 12p Large with Minion/Spell emphasised,
3p Small with Reservation Efficiency emphasised, 6p Medium Minion Life shown, ilvl 84+ shown,
**nothing hidden**.

## 4. `from_tier` selector

Would let `Tier 0` say *"T1's bases, at ilvl 86"* instead of re-listing them — it is what
collapses the 10 Ring rules to 1. **Not a fix**: investigated 2026-08-05 and all 36 silent
tiers need BASES, not a new primitive (`class_condition` already provides condition-only
matching, 56 tiers use it). Subsumed by #1 if that goes ahead.

## 5. Weapon ranking — half evidence-backed, half not

FilterBlade's `rareid` set maps onto our classes as: Claws 9, Bows 8, Thrusting One Hand
Swords 7, Wands 5, Daggers 3, One Hand Swords 1, Rune Daggers 1.

⚠️ It names **no base at all** for One Hand Axes, One Hand Maces, Sceptres, Staves, Two Hand
Axes/Maces/Swords, Warstaves — which are exactly the classes whose T1/T2 are silent here. That
is a signal, not an omission: the rungs may be empty because nothing belongs in them, and
deleting them may be more correct than filling them. **Do not invent a ranking for those 8.**

## 6. Editable tier conditions in the app

Cluster Jewel conditions are correct but read-only in the editor. UI-only change.
