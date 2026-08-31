# ask-07 — re-derived against the theme category: no change, and here is why

rev 32's ruling applied. **Result: 0 tiers newly cut, 0 ladders holding a duplicate
exemption.** The 21 already satisfy the corrected rule.

---

## Why nothing moved

The ruling only bites where a tier-definition FILE is mid-ladder inside a larger theme
category. For all 17 exemption-holders, **the file IS the theme category** — each is a
single-file ladder whose top rung sits at R3:

`Runegrafts` · `Wombgifts` · `Breach Grasping Mail` · `Breach Rings` ·
`Heist Experimented` · `Mirror of Kalandra Ring Bases` · `Sacrificial Garbs` ·
`Stygian Vise` · `Talismans` · `Life Flasks` · `Mana Flasks` · `Tinctures` ·
`Heist Blueprints` · `Heist Contracts` · `Heist Targets` · `Quest Items` (the `Misc` file)

So file-top and ladder-top coincide, and both readings give the same answer.

## The case you were worried about does not exist here

> *"Where several files share a row (flasks, heist, the league bases), the ladder is the row."*

In our tree those are **not** shared ladders — `Life Flasks`, `Mana Flasks`,
`Utility Flasks` and `Tinctures` are four separate theme categories with four separate
rows, and the same is true of `Heist Blueprints` / `Contracts` / `Currency` / `Equipment` /
`Targets`, and of each league base category. Nothing to de-duplicate.

The genuinely shared ladders in the tree are `Jewels` (Abyss + Base + Cluster),
`Rare Equipment` (Rare Equipment + Fractured), `Map Fragments` (Fragments + Splinters),
`Campaign` (7 files) and `Curse of the Allflame` (5 files) — and **none of them has an
exemption-holder**, because every one of those ladders tops out below R3. `Base Jewels`
was the only file that would have claimed a false top, and it is already cut.

## What that means for the rule going forward

The corrected definition is now the one to encode, even though it changes nothing today —
it will start to bite exactly when the flat categories grow their ladders, which is the
§7 backlog. Concretely: the moment two of the league-base categories are merged into one
shared row, or `Heist *` is consolidated, the file-level reading would silently grant two
icons to one ladder. Worth stating in the kit as the definition rather than as a
resolution to this one case.

## Standing state

- Icon blocks **221**, R3+ tiers **21**, unexplained R3+ icons **0** — unchanged from
  ask-06, now verified under the corrected rule.
- `"MinimapIcon": null` retained as the off idiom, per rev 32.
- `Base Jewels` R4 stays cut. Nothing restored.
- Guards green: generator fixtures 8/8, resolver equivalence 113/113, decorator
  composition 7/7, simulator conditions 13/13, catch-all coverage OK.

Still open on our side, unchanged: **#2 `state_budget`** — the trace run over co-occurring
conditions.
