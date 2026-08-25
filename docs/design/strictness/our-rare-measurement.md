<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

MEASUREMENT REPORT — rare equipment across all 7 strictness levels

BUILDS (all succeeded, `--mode ruthless`, with traces)
`g:/POE_filter_development/POE_filter_project/out/m_{soft,regular,semistrict,strict,verystrict,uber,uberplus}.filter` (+ `.trace.json` each).

Block count is **468 at every level** — strictness never removes a block, it flips Show→Minimal:
soft 456 Show/12 Minimal · regular 446/22 · semistrict 442/26 · strict 419/49 · verystrict 418/50 · uber 398/70 · uberplus 392/76. 0 `Hide` anywhere (invariant 1 respected).

METHOD
`check_catchall_coverage.py`'s own `parse()` / `winner()` / `match_cond()` (imported, not reimplemented — so substring-BaseType, exact-`==`, plural-Class and `Continue` semantics are the guard's). Probe = `Rarity Rare, AreaLevel 75, ItemLevel 80`, over the 963 distinct equipment bases in `data/items_db.json` across the 24 classes in `check_catchall_coverage.EQUIPMENT` (939 have drop_level ≤ 75). Parsed block index aligns 1:1 with trace block index for the first 466 blocks (verified); the tail 2 are the `[99999]` catch-all pair, which has no trace row. That alignment is what gives every number below a `file` + `tier_key`.

════════ 1. THE LADDER, MEASURED (A75 / IL80) ════════

| level | blocks that CAN match | blocks that WIN | Show-blocks | bases SHOWN | bases MINIMAL | catch-all |
|---|---|---|---|---|---|---|
| soft | 46 | 36 | 35 | **845** | 59 | 0 |
| regular | 46 | 36 | 33 | 298 | 606 | 0 |
| semistrict | 46 | 36 | 30 | 193 | 711 | 0 |
| strict | 46 | 36 | 20 | 103 | 801 | 0 |
| verystrict | 46 | 36 | 20 | **103** | 801 | 0 |
| uber | 46 | 36 | 18 | 96 | 808 | 0 |
| uberplus | 46 | 36 | 18 | **96** | 808 | 0 |

★ **Only 5 distinct states exist across 7 levels.** verystrict (gate 4) and uberplus (gate 6) are exact no-ops for rare equipment — no rare tier anywhere carries gate 4 or 6 except `Crafting Strands 60+`/`Crafting Gear 86` (gate 6) and a few Crafting/Influenced tiers (gate 5/4). 845 → 96 is 89% thinning at A75, which is *better* than the 14% headline; the headline is diluted by non-equipment categories.

Per-file breakdown of what is still SHOWN as rare (distinct bases):

| file | soft | reg | semi | strict | very | uber | uber+ |
|---|---|---|---|---|---|---|---|
| Equipment/Rare Equipment.json | 749 | 202 | 97 | 7 | 7 | **0** | **0** |
| Equipment/League/Heist Experimented.json | 45 | 45 | 45 | 45 | 45 | 45 | 45 |
| Equipment/League/Ritual BaseTypes.json | 24 | 24 | 24 | 24 | 24 | 24 | 24 |
| Equipment/League/Expedition Ward-Bases.json | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| Equipment/League/Breach Rings.json | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| Equipment/League/Mirror Ring Bases.json | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| Equipment/League/Talismans.json | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| Gems/Skill.json | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| Sacrificial Garbs / Stygian Vise / Breach Grasping Mail | 1+1+1 | … | … | … | … | 1+1+1 | 1+1+1 |
| **TOTAL** | **845** | **298** | **193** | **103** | **103** | **96** | **96** |

★ **At uber and uberplus the curated rare ladder shows ZERO bases.** `Tier 1 Rare Equipment` (`hide_at_strictness: 5`, 33 bases incl. Amethyst Ring / Vermillion Ring / Stygian Vise, each with a bespoke `PlayAlertSound`) goes Minimal at uber. Every rare still visible at uber+ comes from **outside** `Rare Equipment.json`.

Ladder gate response verified against `filter_generation/data/tier_definition/Equipment/Rare Equipment.json` (all four `hideable: false`):
T1 gate 5 (33 bases) · T2 gate 3 (120) · T3 gate 2 (105) · T4 gate 1 (647) · `Tier Hide Rare Equipment` no gate, emits nothing. All conditioned `AreaLevel >= 68` + `Rarity Rare`. 905 of 963 equipment bases are named by the ladder.

════════ 2. ★ THE COMPLAINT, QUANTIFIED ════════

**At soft, A75: 845 distinct equipment bases show as rare, through 35 separate Show blocks.** Volume ranking:

| bases | order | file | tier_key |
|---|---|---|---|
| **546** | 151027 | Equipment/Rare Equipment.json | Tier 4 Rare Equipment |
| **103** | 151022 | Equipment/Rare Equipment.json | Tier 3 Rare Equipment |
| **81** | 151019 | Equipment/Rare Equipment.json | Tier 2 Rare Equipment |
| 36 | 75008 | Equipment/League/Heist Experimented.json | Heist Experimented T2 |
| 22 | 77002 | Equipment/League/Ritual BaseTypes.json | Ritual BaseTypes T1 |
| 9 | 74001 | Equipment/League/Expedition Ward-Bases.json | Expedition Ward-Bases |
| 6 | 151004 | Equipment/Rare Equipment.json | Tier 1 Rare Equipment |
| 6 | 73001 | Equipment/League/Breach Rings.json | Breach Rings |
| 5 | 76001 | Equipment/League/Mirror Ring Bases.json | Mirror of Kalandra Ring Bases |
| 4 | 75005 | Equipment/League/Heist Experimented.json | Heist Experimented T0 |
| 2 | 91013 | **Gems/Skill.json** | **Tier 2 Skill** ← see §4 |
| 2 | 77001 | Ritual BaseTypes T0 | |
| 1 each ×21 | 151003/05/06/08/09/11/12/13/15/17/20/21/25, 72001, 75001/02/04/06/07, 79002, 78001, 80001/02 | | |

`Rare Equipment.json` alone is 749 of 845 = **89% of the noise**, and 546 of that is the single T4 trash net.

★★ **But the campaign band is worse and is 100% strictness-inert.** Distinct equipment bases shown as rare, soft vs uberplus:

| Area | soft SHOW | uberplus SHOW | soft blocks | uberplus blocks |
|---|---|---|---|---|
| A1 | 51 | **51** | 3 | 3 |
| A10 | 140 | **140** | 4 | 4 |
| A20 | 228 | **228** | 4 | 4 |
| A34 | 364 | **364** | 4 | 4 |
| A45 | 506 | **506** | 4 | 4 |
| A60 | 702 | **702** | 4 | 4 |
| A67 | **791** | **791** | 4 | 4 |
| A68 | 816 | 123 | 19 | 14 |
| A72 | 880 | 149 | 28 | 17 |
| A75 | 845 | 96 | 35 | 18 |
| A83 | 880 | 98 | 35 | 19 |

Every level from soft to uberplus is byte-identical below A68. The 4 responsible blocks (all `hideable: true`, all `hide_at_strictness: NONE` — gateable without unlocking):

| bases | order | file | tier_key | conditions |
|---|---|---|---|---|
| **652** | 37001 | `_campaign/70 Safety Net.json` | **Rare Safety Net** | `Class ==` (22 weapon+armour classes) · `Rarity Rare` · `AreaLevel <= 67` · `ItemLevel <= 72` |
| 75 | 33003 | `_campaign/30 Jewellery Progression.json` | Jewellery Any Rare | `Class == "Amulets" "Belts" "Rings"` · `Rarity Rare` · `AreaLevel <= 67` · `ItemLevel <= 72` |
| 60 | 32006 | `_campaign/20 Armour Progression.json` | Boots Highlight (Unidentified) | `Class == "Boots"` · `Rarity Rare` · `Identified False` · `AreaLevel <= 67` · `ItemLevel <= 72` |
| 4 | 33001 | `_campaign/30 Jewellery Progression.json` | Jewellery Good Rare | `BaseType ==` 4 rings · `Rarity Rare` · `AreaLevel <= 67` · `ItemLevel <= 72` |

════════ 3. ★ WHAT STILL SHOWS A RARE AT UBER/UBERPLUS (A75), AND WHY ════════

96 bases via 18 blocks. **Not one of them is in `Rare Equipment.json`.** All carry `hide_at_strictness: NONE`, all `hideable: true`.

| bases | order | file | tier_key | why it wins |
|---|---|---|---|---|
| 36 | 75008 | Equipment/League/Heist Experimented.json | Heist Experimented T2 | `BaseType ==` list · `Rarity <= Rare` |
| 22 | 77002 | Equipment/League/Ritual BaseTypes.json | Ritual BaseTypes T1 | `BaseType ==` list · `Rarity <= Rare` |
| 9 | 74001 | Equipment/League/Expedition Ward-Bases.json | Expedition Ward-Bases | `BaseType == "Runic …"` · `Rarity <= Rare` |
| 6 | 73001 | Equipment/League/Breach Rings.json | Breach Rings | `BaseType ==` 6 rings · `Rarity <= Rare` |
| 5 | 76001 | Equipment/League/Mirror Ring Bases.json | Mirror of Kalandra Ring Bases | `BaseType ==` 5 rings · `Rarity <= Rare` |
| 4+1+1+1 | 75005/75001/75002/75004 | Heist Experimented.json | Heist Experimented T0 | `BaseType ==` · `Rarity <= Rare` |
| 1+1 | 75006/75007 | Heist Experimented.json | Heist Experimented T2 | Micro-Distillery / Mechalarm Belt |
| 2 | 77001 | Ritual BaseTypes.json | Ritual BaseTypes T0 | Archdemon/Blizzard Crown |
| 1 | 80002 | Talismans.json | Talismans T2 | `BaseType ==` list · `Rarity <= Rare` |
| 1 | 80001 | Talismans.json | Talismans T0 | Greatwolf Talisman |
| 1 | 79002 | Stygian Vise.json | Stygian Vise T1 | `BaseType == "Stygian Vise"` · `Rarity <= Rare` |
| 1 | 78001 | Sacrificial Garbs.json | Sacrificial Garbs | `BaseType == "Sacrificial Garb"` · `Rarity <= Rare` |
| 1 | 72001 | Breach Grasping Mail.json | Breach Grasping Mail | `BaseType == "Grasping Mail"` · `Rarity <= Rare` |
| **2** | **91013** | **Gems/Skill.json** | **Tier 2 Skill** | **name collision — see §4** |

**Root cause is uniform**: the 9 league files sit at `gen_order` 72000–80000, ~70,000 slots **before** `Rare Equipment.json` at 151000, and every one is written `Rarity <= Rare` with **no `AreaLevel` condition**. So they claim the rare form of their base at every area level and every strictness, and the ladder never sees those 94 bases at all — at *any* level, including soft. Note the overlap is real: Stygian Vise, Sacrificial Garb, Astrolabe Amulet, Grasping Mail are named by *both* the league file and `Rare Equipment.json`, and the league file always wins (blocks 151002, 151023, 151026 win 0 bases — they are fully shadowed).

════════ 4. ★ A DEFECT FOUND WHILE MEASURING ════════

`Gems/Skill.json` / `Tier 2 Skill` (order 91013) claims **"Energy Blade"**, which in `items_db.json` is a real weapon base in **two** classes (`One Hand Swords` and `Two Hand Swords`). The gem block uses `BaseType ==` (exact), the gem list contains the skill-gem name "Energy Blade", and the block sits at 91000 — before Rare Equipment (151000). Result: two rare *sword* bases show with **gem styling at every one of the 7 strictness levels**, and they are invisible to the rare ladder. Source: `filter_generation/data/base_mapping/Gems/Skill.json`. Fix by precision, not order (invariant 6): the gem tiers need a `Class` condition, since gem classes are disjoint from weapon classes.

════════ 5. ★ THE A68–A72 HOLE ════════

`Equipment/Magic Net.json` / **`Rare Net`** (order 152005), `hideable: true`, `hide_at_strictness: NONE` → **Show at all 7 levels**:
```
Class == <the same 22 equipment classes>
Rarity Rare
AreaLevel >= 68
AreaLevel <= 72
```
Its sibling `Rare Hide Endgame` (152004, identical class list, `Rarity Rare`, `AreaLevel >= 73`) is **Minimal at all 7 levels**. So the same 59 uncurated rare bases are loud in the 68–72 band and quiet from 73 up, and no strictness level touches either. Measured at uberplus: A68 = 123 shown, A70 = 148, A72 = **149**, A73 = 90. The 68–72 band runs **+59 bases louder than A73+ at every level**, uber included.

Those 59 come from the 62 equipment bases with `drop_level <= 68` that the rare ladder does not name at all (905 named of 963): Amulets 31 (mostly Talismans), Quivers 6, Rings 4, Wands 3, One Hand Swords 3, Boots 3, Two Hand Swords 2, Belts 2, Helmets 2, Body Armours 2, Shields/Gloves/Daggers/Bows/Thrusting 1 each.

════════ 6. STATE-GATED BLOCKS — DO THEY DEFEAT THE LADDER? ════════

Probed by re-running the winner with each state set.

- **`Equipment/Special/Influenced.json` — NOT a volume leak.** Gated T1=6, T2=5, T3=4; `Tier 0 Influenced` is **ungated and `hideable: false`**. With `HasInfluence Shaper` at uberplus, exactly **8 bases** show, all from `Tier 0 Influenced` (order 41001). This is the only tier in this whole report that would **need unlocking** to gate.
- **`Equipment/Special/Fractured.json` — NOT a leak, and fully shadowed.** All four tiers gated (6/5/3/3); at uberplus all three Show tiers are Minimal. Of the 436 BaseTypes it names, at uberplus **435 land on a Minimal Fractured tier and 1 (Stygian Vise) is stolen by `Stygian Vise T1`**. A fractured rare at uberplus shows **94** bases and **none of them come from Fractured.json** — they are the same league blocks from §3, which sit at 72000–80000, before Fractured at 82000, and ignore `FracturedItem`.
- **`Equipment/Crafting Priority.json` — PARTIAL leak, 2 of 10 tiers ungated Show at all 7 levels:**
  - `Crafting Perfect Defence` (orders 42001–42008) — `BaseType ==` · `Rarity <= Rare` · `BaseDefencePercentile >= 99` · `Corrupted False` · `Mirrored False`
  - `Crafting Over Quality` (orders 42009–42017) — `BaseType ==` · `Rarity <= Rare` · `Quality > 20`
  Both `hideable: true`, `hide_at_strictness: NONE`. Both are genuinely reachable by a rare drop. The other 8 crafting tiers *are* gated (Strands 60+/T1/T2/T3 = 6/5/3/3; Gear 86/86-RankB/85/84 = 6/5/5/5).
- **`Equipment/VendorRecipes/Recipes.json`** — `6-Link` (21001, `LinkedSockets >= 6` · `Rarity <= Rare`) and `6-Socket` (21002, `Sockets >= 6`) are ungated Show at all 7 levels and carry **no `Class` restriction**. I cannot give a real base count here: the probe has no per-base socket cap, so its 904 is a probe artifact, not evidence. What *is* verified is that both blocks are ungated and outlive uberplus.
- **`_legacy/Legacy.json`** — 6 blocks name equipment bases (Ornate Quiver, Grasping Mail, Unset Amulet, Ruby Amulet, Breach Ring, + a long list) but sit at order 161xxx, after everything, and win **0** rare equipment bases at A75. Not a leak.
- Corrupted / Identified / BaseDefencePercentile 100 / A83 all produce the same 96–98 set as plain — no additional rare-showing tier is unlocked by state.

════════ 7. INVARIANTS ════════

`parsing_tool/check_catchall_coverage.py` at all seven levels: **curated bases lost 0, equipment probes lost 0** (uberplus run with `--check` → `[OK]`). Invariant 3 holds everywhere. No `Hide` emitted at any level (invariant 1). All demotions are `Minimal`, i.e. a quiet label — nothing above is "removed", only demoted.

**Protect-guard status for any proposal**: every tier named as a leak in §2, §3, §5 and §6 is `hideable: true` and therefore gateable as-is. The single exception that **needs unlocking** is `Equipment/Special/Influenced.json` / `Tier 0 Influenced` (`hideable: false`, no gate, 8 bases). The four `Rare Equipment.json` tiers are also `hideable: false` but already carry gates, so retuning their existing `hide_at_strictness` values does not need an unlock.

Scratch scripts (reusable): `C:/Users/shini/AppData/Local/Temp/claude/g--POE-filter-development-POE-filter-project/4d5f032b-df21-4ee2-9c40-359000541fec/scratchpad/{align,measure,detail,detail2,detail3}.py`