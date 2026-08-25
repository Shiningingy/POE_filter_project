<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

I have everything measured. Here are the findings.

---

# How FilterBlade 3.29 thins low-value currency

## 1. The mechanism: two markers, and they do different jobs

Every block header in FilterBlade's files carries a build marker. I decoded both against all 785 blocks in the Soft file, tracked through all 7 files — **zero exceptions**:

| Marker | Behaviour | Count (soft) |
|---|---|---|
| `%Dn` | Block is **deleted from the file** after level `n` | 423 |
| `%DSn` | Deleted after level `n+1` | (incl. above) |
| `%Hn` | Block **stays in place forever**, flips `Show` → `Hide` after level `n` | 185 |
| `%HSn` | Flips after level `n+1` | (incl. above) |
| none | Never changes (19 of these are `Hide` from the start) | 177 |

Whole-file effect soft → uberplus: **306 blocks deleted, 123 blocks flipped `Show`→`Hide`** (785 → 483 blocks).

The two markers are assigned by *role*, and that is the design:

- **`%H` is used only on the terminal "one item, no `StackSize`" tier block.** That block is *never* deleted. It is the base's home, and at high strictness it simply becomes a `Hide`. **This is their catch-all guarantee** — a curated currency base always terminates in its own tier block and never falls through to anything.
- **`%D` is used on every *extra* visibility layer** — campaign leveling, campaign leveling-stacked, the per-base stack ladders, and the shared stack ladders. Deleting a layer makes the item fall through to the next surviving layer, and finally to the `Hide`d home block.

`S` = +1 on the level. Empirically exact across all 785 blocks (`DS2`→3, `DS3`→4, `DS4`→5, `HS1`→2, `HS2`→3, `HS3`→4, `HS4`→5). I could not determine what `S` *means*; the offset is measured, not documented.

## 2. ★ StackSize is the whole answer

63 blocks in the Soft file carry `StackSize`; **30 of them are the low-value currency ladders**. There are three families, and the thinning works by **stripping the lowest thresholds first**, so a base survives only in ever-larger stacks.

**A. Per-base "supplies" ladders — 3 rungs, thresholds 10 / 5 / 3** (`FilterBlade_0_Soft.filter:7314–7434`)

| Ladder | Base | SS≥10 | SS≥5 | SS≥3 |
|---|---|---|---|---|
| `stackedsupplieshigh` | Orb of Transmutation | `%DS4` → L5 | `%DS3` → L4 | `%D3` → L3 |
| `stackedsupplieslow` | Orb of Augmentation | `%DS4` → L5 | `%DS3` → L4 | `%D3` → L3 |
| `stackedsuppliesportal` | Portal Scroll | `%DS4` → L5 | `%D3` → L3 | `%D2` → L2 |
| `stackedsupplieswisdom` | Scroll of Wisdom | `%DS4` → L5 | `%D3` → L3 | `%D2` → L2 |

**B. Shared generic ladders — one threshold, 7 value tiers each** (`:7438–7600`)

`stackedsix` (`StackSize >= 6`): t1 `%D9`, t2 `%D8`, t3 `%D7`, t4 `%D6` (all never expire), t5 `%DS4`→L5, t6 disabled, t7 `%DS2`→L3.
`stackedthree` (`StackSize >= 3`): t1–t4 never expire, t5 `%DS4`→L5, t6 `%DS3`→L4, t7 disabled.

**C. Campaign leveling-stacked** (`AreaLevel <= 67`, `:7141–7208`) — `SS >= 3` for Chance / Alteration+Transmutation / Armourer's Scrap+Whetstone / Augmentation (all `%D4`), and `SS >= 2` for Portal Scroll (`%D4`) and Scroll of Wisdom (`%D3`).

Only five thresholds are ever used for this currency: **2, 3, 5, 6, 10**.

## 3. Per-base table (measured, Standard 7-file set)

"SS=1" = last level a **single** drop is shown. "any stack" = last level shown at all, with the threshold. Campaign column is `AreaLevel <= 67`.

| Base | FB tier + marker | last L, SS=1 (map) | last L, campaign | last L, any stack | Mechanism |
|---|---|---|---|---|---|
| Scroll of Wisdom | `twisdom` `%H1` | **1** | 3 | 5 @ SS≥10 | Hide-flip + wisdom ladder 3/5/10 |
| Portal Scroll | `tportal` `%H1` | **1** | 4 | 5 @ SS≥10 | Hide-flip + portal ladder 3/5/10 |
| Orb of Augmentation | `t9armour` `%H1` | **1** | 4 | 5 @ SS≥10 | Hide-flip + supplieslow 3/5/10 |
| Transmutation Shard | `t9armour` `%H1` | **1** | 1 | **1** | Hide-flip, **no stack rescue at all** |
| Orb of Transmutation | `t8trans` `%HS1` | **2** | 4 | 5 @ SS≥10 | Hide-flip + supplieshigh 3/5/10 |
| Alchemy Shard | `t8trans` `%HS1` | **2** | 2 | **2** | Hide-flip, **no stack rescue** |
| Alteration Shard | `t8trans` `%HS1` | **2** | 2 | 3 @ SS≥6 | Hide-flip + `stackedsix/t7` |
| Armourer's Scrap | `t7chance` `%HS2` | **3** | 4 | 5 @ SS≥6 | Hide-flip → SS≥3 (L4) → SS≥6 (L5) |
| Jeweller's Orb | `t7chance` `%HS2` | **3** | 3 | 5 @ SS≥3 | Hide-flip + `stackedthree/t5` |
| Orb of Chance | `t7chance` `%HS2` | **3** | 4 | 5 @ SS≥3 | Hide-flip + `stackedthree/t5` |
| Orb of Binding | `t7chance` `%HS2` | **3** | **5** | 5 @ SS≥6 | Hide-flip; campaign `%D5` keeps SS=1 to L5 |
| **Blacksmith's Whetstone** ★ | `t6chrom` `%HS3` | **4** | 4 | **6 @ SS≥6** | Hide-flip → SS≥3 (L5) → SS≥6 (L6); never fully gone |
| Orb of Alteration | `t6chrom` `%HS3` | **4** | 4 | 6 @ SS≥6 | same as Whetstone |
| Orb of Fusing | `t6chrom` `%HS3` | **4** | 4 | 6 @ SS≥6 | same as Whetstone |
| Blessed Orb | `t6chrom` `%HS3` | **4** | 4 | 6 @ SS≥3 | Hide-flip + `stackedthree/t4` |
| Orb of Alchemy | `t5alchemy` `%HS4` | **5** | 5 | 6 @ SS≥6 | Hide-flip + `stackedsix/t4` |
| Glassblower's Bauble | `t5alchemy` `%HS4` | **5** | 5 | 6 @ SS≥3 | Hide-flip + `stackedthree/t4` |
| Orb of Regret | `t5alchemy` `%HS4` | **5** | 5 | 6 @ SS≥3 | same |
| Orb of Scouring | `t5alchemy` `%HS4` | **5** | 5 | 6 @ SS≥3 | same |
| Regal Orb | `t5alchemy` `%HS4` | **5** | 5 | 6 @ SS≥3 | same |
| Orb of Unmaking | `t5alchemy` `%HS4` | **5** | 5 | 6 @ SS≥6 | Hide-flip + `stackedsix/t4` |
| Astragali | `t5alchemy` `%HS4` | **5** | 5 | **5** | both its stack blocks are `%DS4`, gone at L6 |
| Chromatic Orb | `t4chaos` `%H6` | never | never | never | **not thinned at any level** |
| Scrap Metal | `t4chaos` `%H6` | never | never | never | **not thinned at any level** |

**Not present in FilterBlade 3.29 at all** (0 occurrences in every file, so nothing to copy): Cartographer's Chisel, Chromatic Shard, Horizon Shard, Binding Shard, Regal Shard, Chaos Shard, Ancient Shard, Harbinger's Shard, Engineer's Shard, Engineer's Orb, Orb of Horizons.

**The headline shape**: for the band at and below Whetstone, the value ladder maps 1:1 onto the strictness ladder, **one rung per level** — `t6chrom` L4 → `t7chance` L3 → `t8trans` L2 → `t9armour`/`tportal`/`twisdom` L1. Single-drop stackable-currency bases visible: 490 (L0) → 481 (L4) → 446 (L5) → **344 (L6)**, with 143 hidden.

## 4. ★★ The finding that changes the port: FilterBlade turns most of this OFF in Ruthless

`FilterBlade.ruthlessfilter` comments out **20 of its 32 currency StackSize blocks**:

- **DISABLED**: `stackedsix` t1–t7 (SS≥6), `stackedthree` t1–t7 (SS≥3), `stackedsupplieshigh` (Orb of Transmutation, 10/5/3), `stackedsupplieslow` (Orb of Augmentation, 10/5/3).
- **KEPT LIVE**: `stackedsuppliesportal` (Portal Scroll 10/5/3), `stackedsupplieswisdom` (Scroll of Wisdom 10/5/3), and all 6 `levelingstacked` blocks (SS≥3 / SS≥2, `AreaLevel <= 67`).

This independently corroborates the author's own recorded observation at `docs/design/theme-pipeline-rewrite.md:276` — *"`StackSize` tier-ups are a softcore FilterBlade idiom rather than a Ruthless one"* — and the generator comment at `webapp/frontend/src/utils/filterGenerator.ts:517` that a `StackSize >= 10` tier-up "cannot even fire in Ruthless." Two independent sources now agree. **Stacks of 3+ endgame orbs are a Standard-only phenomenon; Portal/Wisdom scrolls and campaign drops still stack in Ruthless.**

FilterBlade also **re-tiers upward** in Ruthless, because scarcity raises value. Their Ruthless general ladder vs Standard:

| Base | Standard | Ruthless | Effect |
|---|---|---|---|
| Blessed Orb | `t6chrom` (L4) | `t3annul` `%H7` | never hidden |
| Orb of Unmaking | `t5alchemy` (L5) | `t3annul` `%H7` | never hidden |
| Glassblower's Bauble | `t5alchemy` (L5) | `t4chaos` `%H6` | never hidden |
| Orb of Fusing | `t6chrom` (L4) | `t4chaos` `%H6` | never hidden |
| Orb of Alchemy | `t5alchemy` (L5) | `t4chaos` `%H6` | never hidden |
| Orb of Regret / Astragali | `t5alchemy` (L5) | `t4chaos` `%H6` | never hidden |
| Orb of Binding | `t7chance` (L3) | `t5alchemy` `%HS4` | L3 → L5 |
| Orb of Chance | `t7chance` (L3) | `t6chrom` `%HS3` | L3 → L4 |

**Unchanged between Standard and Ruthless — exactly the bottom band the author named:** Scroll of Wisdom, Portal Scroll, Orb of Augmentation, Transmutation Shard (all L1); Orb of Transmutation, Alteration Shard, Alchemy Shard (L2); Armourer's Scrap, Jeweller's Orb (L3); **Blacksmith's Whetstone (L4)**; Chromatic Orb, Scrap Metal (never).

## 5. What this means against our tree

`filter_generation/data/tier_definition/Currency/General.json` — 10 tiers, only `Tier 8 General` gated (`hide_at_strictness: 1`), all 9 non-hide tiers `hideable: false` (**protected — any gate proposal needs unlocking first**).

Our `filter_generation/data/base_mapping/Currency/General.json` bottom bands vs FilterBlade's schedule:

| Our tier | bases | FilterBlade's last-shown level for them |
|---|---|---|
| Tier 5 (6) | Glassblower's Bauble, Orb of Alchemy, Orb of Fusing, Orb of Regret, Orb of Unmaking, Chaos Shard | 4–5 (never, in Ruthless) |
| Tier 6 (4) | Alchemy Shard, Jeweller's Orb, Orb of Alteration, Orb of Chance | **2, 3, 4, 4** |
| Tier 7 (6) | Armourer's Scrap, Blacksmith's Whetstone, Alteration Shard, Transmutation Shard, Orb of Transmutation, Orb of Augmentation | **3, 4, 2, 1, 2, 1** |
| Tier 8 (3) | Portal Scroll, Scroll of Wisdom, Scroll Fragment | **1, 1** |

**Our Tier 7 is the blocker.** It merges FilterBlade's L1 band (Orb of Augmentation, Transmutation Shard) with its L4 band (Whetstone) — a 3-level spread inside one tier. A single `hide_at_strictness` on Tier 7 cannot reproduce their schedule; it needs splitting (or per-base rules) before a faithful port. Tier 6 has the same problem at 2 levels' spread.

Three portability notes, stated plainly:
1. The `%H` half of their model is **not** directly portable — our `HIDE_CMD` is `Minimal`, which still draws a label. Porting it buys "quiet label", not cleared ground.
2. The `%D` half **is** portable and is what actually does the work: delete the extra visibility layer, let the item fall to its home block. That maps onto `hide_at_strictness` on a *layer* tier while the home tier stays ungated.
3. The `StackSize` half is portable only for **Portal Scroll, Scroll of Wisdom, and the campaign `AreaLevel <= 67` layer** — per FilterBlade's own Ruthless build and our own recorded finding.

**What I could not verify**: `FilterBlade.zip` contains only the 7 Standard files, and only one `.ruthlessfilter` ships (a level-0 export — every `%H` block is still `Show` and every `%D` block still present). So the Ruthless `%D`/`%H` schedule above is read from build metadata in that file; I could not observe it applied across levels.

Scripts: `C:\Users\shini\AppData\Local\Temp\claude\g--POE-filter-development-POE-filter-project\4d5f032b-df21-4ee2-9c40-359000541fec\scratchpad\fb_parse.py`, `fb_table.py`, `fb_eff2.py`.