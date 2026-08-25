<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

## FilterBlade 3.29 rare-equipment strictness — decoded

### 0. The structural fact that explains everything

All seven `data/from_filter_blade/3.29/FilterBlade_<0-6>_*.filter` files contain **the same 893 blocks in the same order**. Strictness does not regenerate the filter — it comments blocks out with a leading `#`.

| | 0 soft | 1 regular | 2 semistrict | 3 strict | 4 verystrict | 5 uber | 6 uberplus |
|---|---|---|---|---|---|---|---|
| `^Show` | 766 | 761 | 749 | 694 | 621 | 464 | 337 |
| `^Hide` | 19 | 21 | 26 | 58 | 78 | 112 | 146 |
| active total | 785 | 782 | 775 | 752 | 699 | 576 | 483 |

Measured, not assumed:
- **0 of 893 blocks change their conditions between levels.** No threshold is ever retuned. (96 change *style* only — font size / decoration.)
- Marker `%Dn` in the block comment = "active at levels 0..n, commented from n+1". 409 blocks carry one and all 409 obey it exactly.
- Thinning is **‑429 Show, +127 Hide**. The dominant lever is *removing Show tiers above a hide floor that is already present at soft*, not adding hides.

### 1. Rare-equipment block census

Blocks carrying `Rarity Rare` on equipment classes/bases, active at ≥1 level: **290** = 268 pickup `Show` + 15 `Continue` decorators + 7 `Hide`.

| | L0 | L1 | L2 | L3 | L4 | L5 | L6 |
|---|---|---|---|---|---|---|---|
| pickup Show | 268 | 266 | 261 | 245 | 224 | 143 | 73 |
| `Continue` decorators | 15 | 15 | 15 | 15 | 15 | 15 | 15 |
| Hide | 3 | 3 | 4 | 6 | 7 | 7 | 7 |

**The decorator layer never thins.** All 15 (`$type->decorators->rareeg` — size, 4-link, ilvl 83/84/85/86, corrupted, plus 4 leveling twins) are on at uberplus. Rare *appearance* is constant; only rare *pickup* thins.

Rare equipment is ~45% of the whole filter's thinning (195 of the 429 Shows turned off).

### 2. The core ladder — exact file order, `FilterBlade_0_Soft.filter`

| line | block | L0 | L1 | L2 | L3 | L4 | L5 | L6 | bases |
|---|---|---|---|---|---|---|---|---|---|
| 3508 | HIDE corrupted unid, 0 implicit | ON | ON | ON | ON | ON | ON | ON | class |
| 3518 | HIDE mirrored unid | ON | ON | ON | ON | ON | ON | ON | class |
| 3533 | `rr->amuring t1` | ON | ON | ON | ON | ON | – | – | **8** |
| 3544 | `rr->amuring t2` | ON | ON | ON | ON | – | – | – | **17** |
| 3555 | `rr->amuring t3` | ON | ON | ON | – | – | – | – | **7** |
| 3559 | `rr->belts t1` | ON | ON | ON | ON | ON | – | – | **1** (Stygian Vise) |
| 3570 | `rr->belts t2` | ON | ON | ON | ON | – | – | – | **4** |
| 3580 | `rr->belts t3` | ON | ON | ON | – | – | – | – | **4** |
| 3588 | **HIDE rrihide1** `DropLevel < 75` + `AreaLevel >= 82` | – | – | – | – | **ON** | ON | ON | 4 classes |
| 3599 | **HIDE rrihide2** `DropLevel < 60` + `AreaLevel >= 80` | – | – | – | **ON** | ON | ON | ON | 4 classes |
| 3610 | **HIDE rrihide3** `DropLevel < 50` + `AreaLevel >= 78` | – | – | – | **ON** | ON | ON | ON | 4 classes |
| 3621 | **HIDE rrihide4** `DropLevel < 40` + `AreaLevel >= 73` | – | – | **ON** | ON | ON | ON | ON | 4 classes |
| 3637 | `rr t1` | ON | ON | ON | ON | ON | – | – | **24** |
| 3646 | `rr t2` | ON | ON | ON | ON | – | – | – | **98** |
| 3658 | `rr identifieditemhandling` (blue temp beam) | ON | – | – | – | – | – | – | class |
| 3668 | `rr t3` | ON | ON | ON | – | – | – | – | **94** |
| 3677 | `rr t4` | ON | ON | – | – | – | – | – | **107** |
| 4237 | `rr t5` — **CLASS NET, every endgame rare** | ON | ON | – | – | – | – | – | 21 classes |
| 4249 | HIDE normal/magic endgame (`AreaLevel >= 68`) | ON | ON | ON | ON | ON | ON | ON | 25 classes |
| 4258 | **HIDE raresendgame — TERMINAL** (`ItemLevel >= 68`) | ON | ON | ON | ON | ON | ON | ON | 24 classes |

Every pickup block carries exactly `ItemLevel >= 68` + `Rarity Rare` + (`BaseType ==` list, or `Class ==` for t5). Nothing else. No mod checks, no ilvl sub-thresholds inside the ladder.

### 3. THE LADDER — what a rare must be to still show

| level | what a rare has to be | distinct named bases | class net? |
|---|---|---|---|
| **0 soft** | anything `ItemLevel >= 68` in 21 equipment classes | 364 | **YES — everything** |
| **1 regular** | identical to soft (only the soft-only ID-beam block drops) | 364 | **YES — everything** |
| **2 semistrict** | on the **T1+T2+T3 named-base list**; and if armour in a 73+ area, `DropLevel >= 40` | **257** | no |
| **3 strict** | on the **T1+T2 list**; armour also needs `DropLevel >= 50` in 78+ areas, `>= 60` in 80+ | **152** | no |
| **4 verystrict** | on the **T1 list only** — the 24 `DropLevel 84` armour bases + 8 top rings/amulets + Stygian Vise; armour also needs `DropLevel >= 75` in 82+ areas | **33** | no |
| **5 uber** | **no plain rare shows at all.** Only exotic paths: influence, eldritch implicit, fractured, synthesised, enchanted, double-corrupt, abyss socket, 6L, exotic league base, breach ring, talisman, or a `HasExplicitMod` hit | **0** | no |
| **6 uberplus** | same, minus most of the mod paths (`HasExplicitMod` blocks 66 → 10) | **0** | no |

### 4. The design rule behind the base lists

`rr t1` = **24 bases, all `DropLevel 84`, all four armour classes** (6 Body Armours / 6 Helmets / 6 Gloves / 6 Boots: Conquest Lamellar, Divine Crown, Giantslayer Helmet, Haunted Bascinet, Leviathan Gauntlets/Greaves, Lich's Circlet, Majestic Pelt, Necrotic Armour, Paladin Boots/Gloves, Phantom Boots/Mitts, Royal Plate, Sacred Chainmail, Syndicate's Garb, Torturer's Mask, Twilight Regalia, Velour Boots/Gloves, Warlock Boots/Gloves, Wyvernscale Boots/Gauntlets).

DropLevel medians down the ladder (joined against `data/items_db.json`): t1 = 84, t2 = 69, t3 = 61, t4 = 53. **Their armour ladder is a DropLevel ladder wearing a base-name coat.**

That is exactly why the `rrihide` layers name only `"Body Armours" "Boots" "Gloves" "Helmets"` — DropLevel tracks base quality for armour but *not* for jewellery (Two-Stone Ring is `DropLevel 20`, Stygian Vise is `1`), so rings/amulets/belts get their own name-keyed tiers at lines 3533–3590 and are placed **before** the DropLevel hides so they can never be caught by them.

### 5. Honest sizing of the DropLevel hide layers

Measured against the bases actually still live at each level — **they are a finishing trim, not the main lever**:

- L2, `rrihide4` (DL<40 @ AL≥73): prunes **3** live bases — Antique Gauntlets (39), Antique Greaves (37), Riveted Boots (36).
- L3, `rrihide2/3` (DL<60 @ AL≥80, DL<50 @ AL≥78): prunes **8** — Goliath Gauntlets (53), Goliath Greaves (54), Hydrascale Boots/Gauntlets (59), Legion Boots (58), Legion Gloves (57), Soldier Boots (49).
- L4, `rrihide1` (DL<75 @ AL≥82): prunes **0** — T1 is all DropLevel 84 by construction.

Their value is that they are **AreaLevel-conditional**: those bases keep showing in a level-70 map and stop showing in a level-80 map, at the same strictness. That is a precision axis we do not have anywhere in the tree. It is textbook ADR-0006 (`AreaLevel` = where you are) and textbook invariant #6 (add a condition, don't move a block).

### 6. Mechanism breakdown of surviving rare pickup blocks

| requires | L0 | L1 | L2 | L3 | L4 | L5 | L6 |
|---|---|---|---|---|---|---|---|
| `HasExplicitMod` | 92 | 91 | 89 | 86 | 82 | 66 | 10 |
| Corrupted/Mirrored state | 75 | 74 | 73 | 66 | 60 | 42 | 17 |
| Enchantment / `EnchantmentPassiveNum` | 33 | 33 | 33 | 33 | 32 | 30 | 30 |
| `HasInfluence` | 18 | 18 | 18 | 18 | 17 | 2 | 1 |
| Sockets/links | 14 | 14 | 13 | 13 | 10 | 5 | 2 |
| `FracturedItem` | 8 | 8 | 8 | 6 | 6 | 5 | 4 |
| eldritch implicit | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| `SynthesisedItem` | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **PLAIN (base/class/ilvl only)** | **69** | **69** | **67** | **61** | **56** | **21** | **20** |
| total | 268 | 266 | 261 | 245 | 224 | 143 | 73 |

### 7. What we CAN copy

Everything in §2 uses only `BaseType`, `Class`, `Rarity`, `ItemLevel`, `AreaLevel`, `DropLevel`.

- `DropLevel` is already in our condition vocabulary (`parsing_tool/check_condition_schema.py:62` `SPECIAL_CASED`, `webapp/frontend/src/utils/localization.ts:1378`) and `conditionLines` in `webapp/frontend/src/utils/filterStyle.ts:375` emits any key generically with correct operator spacing. **It is currently used in 0 places in `filter_generation/data/`.** Zero code work to adopt.
- The whole `rr` / `amuring` / `belts` base ladder — we already have it (see §9).
- The AreaLevel×DropLevel hide layers — copyable verbatim as four gated tiers.
- Their `%Dn` model is *our* model: same block set, toggled. `hide_at_strictness` is the direct analogue.
- `HasExplicitMod` is in the schema (`simulatorEngine.ts:391`) and `normOp` turns `">=2 \"a\" \"b\""` into the game-legal `>= 2 "a" "b"`. Format is not the blocker.

### 8. What we CANNOT copy

1. **The 92 `HasExplicitMod` blocks — the single biggest mechanism.** Not a format problem: FilterBlade generates those mod-name lists from their Mods dump joined to live economy data, per league, and tiers them with `>=N` count operators over 100+ affix fragments. We have no Mods table and no economy feed. We could snapshot their strings, but they go stale every league and we would own a 92-block maintenance surface with no way to regenerate it. **Recommend: do not attempt this league.**
2. **`Hide` itself.** Their ladder assumes an item *vanishes*. Ours cannot — `HIDE_CMD` is `Minimal` and still draws a label. Independently corroborated here: NeverSink's own `FilterBlade.ruthlessfilter` has 759 `Show`, **0 `Hide`, 15 `Minimal`**, each stamped `# Hide-Section replaced with minimal` and **stripped of every style line** — exactly what `blockText` does at `filterStyle.ts:137`. Never describe a strictness level as "removing" a rare.
3. **There is no upstream Ruthless ladder to copy.** `FilterBlade.zip` contains only the seven Standard files. The shipped `.ruthlessfilter` is a single unladdered build at soft equivalence and **contains no `rrihide` blocks at all**. We are building something they do not ship.
4. Their `BaseDefencePercentile` / economy-ranked crafting-base blocks — same data problem, though these are 0 blocks in the rare ladder proper.

### 9. Where we already stand (measured, not assumed)

Built all 7 levels from `filter_generation/generate.mjs --mode ruthless`; counted bases in `Equipment/Rare Equipment.json` blocks from the trace:

| | L0 | L1 | L2 | L3 | L4 | L5 | L6 |
|---|---|---|---|---|---|---|---|
| **ours** — bases shown | 905 | 258 | 153 | 33 | 33 | 0 | 0 |
| **theirs** — named bases | 364 +net | 364 +net | 257 | 152 | 33 | 0 | 0 |

Our `filter_generation/data/base_mapping/Equipment/Rare Equipment.json` **is already a port of their ladder**: our T1 = 33 = their `rr t1` (24) + `amuring t1` (8) + `belts t1` (1), exactly; our T3 = 105 = 94 + 7 + 4, exactly; our T2 = 120 = 98 + 17 + 4 + Ghostflame Blade (a 3.29 base they don't list). Our T4 = 647 is their `t4` (107) plus everything their `t5` class net would have caught.

Two concrete divergences:

- **Our gates are one level earlier than theirs.** Ours: T1 = 5, T2 = 3, T3 = 2, T4 = 1. Theirs: T1 dies at 5 (matches), T2 at 4, T3 at 3, T4 at 2. Shifting T4→2, T3→3, T2→4 and leaving T1 at 5 would make our curve land on 905 / 905 / 258 / 153 / 33 / 0 / 0 — an exact level-for-level match to column-theirs above.
- **We have no terminal rare hide.** Their `$type->hidelayer $tier->raresendgame` (line 4258) is on at *all seven* levels. Our `Tier Hide Rare Equipment` reports `emitted: false, reason: no-items-mapped` at every level, and our tree ends in a *show*-all net per ADR-0006. Our per-tier gate flips the tier itself to `Minimal`, which reaches the same place for the 905 mapped bases — but the 63 unmapped equipment bases (38 Talismans, Breach Ring, Energy Blade, etc., which live in other categories) have no rare floor here.

### 10. The thing most likely to be the actual complaint

`out/v694.filter`, `out/rev28b.filter` and `out/final.filter` all have **`Minimal` = 12**, which matches a level-0 build exactly (L0 = 12, L1 = 22, L2 = 26, L3 = 49, L4 = 50, L5 = 70, L6 = 76). **The shipped filter is built at `soft`, where no `hide_at_strictness` gate fires at all** — so all 905 rare equipment bases show with full styling, including the 647-base T4 trash net. The rare ladder is already built and already correct in shape; at soft it is simply switched off. Worth confirming with the author which level 6.991 was cut at before retuning any gate, because if they are shipping soft, moving gates *later* to match FilterBlade would make the complaint worse, not better.

Scratch analysis scripts (throwaway): `C:\Users\shini\AppData\Local\Temp\claude\g--POE-filter-development-POE-filter-project\4d5f032b-df21-4ee2-9c40-359000541fec\scratchpad\` — `fbparse.py` (block extractor), `fbmark.py` (`%D` verification), `fbrare.py`, `fbsteps.py`, `fbmech.py`, `fbprune.py`, `final.py`.