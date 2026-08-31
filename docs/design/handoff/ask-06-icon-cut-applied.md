# ask-06 — icon cut applied, report re-run

rev 31's §8 is ported. One contradiction inside it needed a ruling; I took the specific
instruction over the general rule and it is flagged below.

---

## The number you wanted

| | before | after |
|---|---|---|
| icon-drawing Show blocks | 287 | **221** |
| tiers drawing an icon at R3+ | 64 | **21** |
| **R3+ icons that are neither a top tier nor a relaxation** | 37 | **0** |

**43 tiers silenced across 25 files.** Target met exactly: every remaining R3+ icon is
either a category's top tier (17) or one of your four relaxations (4 categories, 5 tiers —
`Maps/Fragments` has two tiers at R3, `Tier 2` and `Tier 3`, and you said keep through R3,
so both stand).

The 21 that remain:

`Runegrafts T0` · `Wombgifts T1` · `Breach Grasping Mail` · `Breach Rings` ·
`Heist Experimented T0` · `Mirror Ring Bases` · `Sacrificial Garbs` · `Stygian Vise T0` ·
`Talismans T0` · `Life Flasks T1` · `Mana Flasks T1` · `Tinctures T0` ·
`Heist Blueprints` · `Heist Contracts T0` · `Heist Targets` · `Misc` — all top tier
`Tainted Currency T3` · `Skill Gems T3` · `Fragments T2` · `Fragments T3` · `Scarabs T3` —
the relaxations

`Misc/General` kept its icon under the top-tier rule, as you ruled — it is one tier, and
the 14 blocks are that one tier split per basetype, not 14 tiers.

## ⚠️ One contradiction, and how I resolved it

Your general rule and your itemised list disagree on **`Base Jewels` R4**:

- the rule says keep it — R4 is the only rung `Jewels/Base Jewels` has, so it *is* that
  category's top tier;
- the list says cut it, with a reason: *"the rarity plates already carry it"*.

**I cut it**, taking the specific instruction with its stated reason over the structural
rule. If you meant the rule to win, say so and I will restore three lines
(`Base Jewels Magic` / `Normal` / `Rare`).

It is worth deciding deliberately, because the same shape recurs: `Base Jewels` reads as
"top tier" only when *category* means the tier-definition FILE. Under the `Jewels` THEME
category — which is what shares a style row across Abyss, Base and Cluster — R4 is mid-ladder
and the cut is unambiguous. **If "a category's top tier" means the theme category rather
than the file, tell me and I will re-derive**; it changes this one entry today, but it will
change more as the flat categories grow their ladders.

## How the cut is expressed

Each silenced tier now carries an explicit `"MinimapIcon": null` in its inline `theme`.
That is the sanctioned "off" idiom, not an omission — an absent key means *the block says
nothing and the theme row decides*, which would have left the icon standing for
`Skill Gems` R4/R5 and `Scarabs` R4, where the row supplies it rather than the tier.
So the cut is reversible by deleting one line per tier, and it cannot be undone by accident
from the theme side.

Guards after the edit: generator fixtures 8/8, resolver equivalence 113/113, decorator
composition 7/7, simulator conditions 13/13, catch-all coverage OK.

Re-run at any time:
`node filter_generation/generate.mjs --mode ruthless --strictness uber --out out/icons.filter --trace out/icons.trace.json`
