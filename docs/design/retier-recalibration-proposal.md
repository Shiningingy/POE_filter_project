# Re-tier recalibration — proposal, not applied

**Status: awaiting the author. Nothing here is in the filter.** Applying it would restyle
blocks (rung changes reach the look through row-adoption — that is how the first pass moved
83 of 449), so it must not land while V6.1 is being tested.

Blocks the `family x rung` collapse. Do this first, or the collapse bakes the error in.

## The anchor, corrected

`retier.py` was written against `Currency Tier N = RN`. That is wrong. The shipped ladder
pairs nine currency tiers onto five rungs, and three sources agree — `apply_designer_patch.py`
("collapses nine tiers onto five rungs"), `handoff/reply-05-six-rungs.md` ("currency now uses
T0–T4 and skips only T5, no floor below scrolls"), and `Currency/General.json` itself, which
tops out at rung 4:

| rung | currency | reads as |
|---|---|---|
| **R0** | T0 顶级通货 | Mirror — cross the screen |
| **R1** | T1 神圣石级 + T2 高价值通货 | Divine / high value — turn around |
| **R2** | T3 崇高石级 + T4 混沌石级 | Exalted / Chaos — always pick up |
| **R3** | T5 点金石级 + T6 改造石级 | Alchemy / Alteration — routine pickup |
| **R4** | T7 低价值通货 + T8 卷轴 | scroll level — pick up if convenient |
| **R5** | — | below scroll: nets, readouts, noise |

## What the error did

The table was written believing R3=Exalted, R4=Chaos, R5=alch-and-below. Against the real
anchor every judgement from 高价值 down landed **1–2 rungs quieter than intended**:

| I meant | I wrote | anchor says | drift |
|---|---|---|---|
| 高价值通货 | R2 | R1 | 1 quieter |
| Exalted | R3 | R2 | 1 quieter |
| Chaos | R4 | R2 | **2 quieter** |
| Alchemy and below | R5 | R3 | **2 quieter** |

My scale had no vocabulary below "alch and below", so R5 became a catch-all: 79 tiers landed
on a rung that means *below a Scroll of Wisdom*. Some of them belong there. Most do not.

★ **The author already saw this in game, independently**: *"just find lowtier oils are still
somehow low visibility."* `Oils Tier 3` sits on R4 — scroll level — for an item that is not
scroll-level. That is this bug, reported from the other direction, and it is the reason to
trust the diagnosis rather than the table.

## Proposed moves

Deliberately a short list of defensible moves, not a wholesale reshuffle. Everything not
listed stays put.

### R4 → R3 — above scroll level, currently painted at it

| tier | 名称 | why |
|---|---|---|
| `Fragments Tier 3` | T3: 普通碎片 | a common fragment still sells; it is not a scroll |
| `Oils Tier 3` | T3: 普通圣油 | ★ author-reported, in game |
| `Omens Tier 2` | T2: 普通预兆 | league currency with a real price |
| `Splinters Tier 1` | T1: 值得停下 | the label literally says *worth stopping for* |
| `Essences Tier 3` | T3: 普通精华 | crafting currency, trades above scroll |
| `Scarabs Tier 4` | T4: 普通圣甲虫 | scarabs carry real value even at the bottom |
| `Tainted Currency Tier 4` | T4：低价值 | tainted currency is scarce in Ruthless |
| `Unique Items Other` | 其他传奇 | a unique is always worth one look |

### R5 → R4 — above the floor

| tier | 名称 | why |
|---|---|---|
| `Splinters Tier 2` | T2: 单个 / 小堆 | one splinter still beats a scroll |
| `Life Flasks Tier 2` | T1: 顶级生命药剂 | labelled *top* flask, painted as noise |
| `Mana Flasks Tier 2` | T1: 顶级魔力药剂 | same |
| `Tinctures Tier 1` | T1: 酊剂 | league item, not floor material |
| `Fragments Tier 4` | T4: 低价值碎片 | still a fragment |
| `Heist Blueprint T1` | T2: 其他蓝图 | runnable content, not noise |
| `Heist Contract T1` | T2: 其他契约 | same |

### Staying on R5 — the floor is correct here

Gold ×3 (auto-collected, the label is a readout) · `Magic Net` · `Rare Equipment` T3/T4 ·
`RGB Linked` · `Legacy` · `Influenced Tier 3` (net) · `Trinkets` T3/T4 · `Cluster Jewels`
T5/T6 · the remaining 其余/兜底 nets. These are genuinely below scroll: you want them
present and quiet, which is exactly what R5 is for.

## ★ Open question the author has to settle

**Does Ruthless compress the whole scale upward?** The anchor is priced in currency, and
Ruthless drops far less of it — a Chaos Orb is a bigger event there than in Standard, and
scrolls actually matter. If the answer is yes, the fix is not only these moves but a shift
of the whole ladder, and R5 should hold only true noise (nets and readouts, ~15 tiers rather
than 37).

Recording rather than guessing, because this is a value call and the last time value was
guessed it produced the error this document exists to fix.

## Not touched

`Crafting Gear 84/85/86` and `Crafting Gear 86 Rank B` stay on R5 pending the author's own
note — *"i think we just ported filterblade's tier for the perfect percentile part, so its
fine as not every class have a 84+ drop"* — which reads as accepted-as-is, not as a defect.
