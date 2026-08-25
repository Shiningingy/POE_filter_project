<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

# Rare-equipment strictness curve — proposal

## 0. The finding that reorders everything

**Every shipped build is `soft`** (`out/v694.filter`, `out/final.filter`, `out/rev28b.filter` all have `Minimal=12`, the soft signature; L1=22, L2=26, L3=49, L4=50, L5=70, L6=76). At soft **no `hide_at_strictness` gate fires at all**. So the complaint "rares drop too many" is not a mistuned ladder — it is a ladder that is switched off.

Measured at A75, the existing ladder already answers the complaint with **zero data edits**: `soft 843 → regular 296 → semistrict 191`. Retuning gates without changing the cut level changes nothing the author will see.

Second finding, from the measured candidates: **the rare ladder is not the problem above `semistrict` — the leaks are.** At baseline strict, 101 bases show and only 7 come from `Rare Equipment.json`; 94 come from tiers outside it. That is why "our ladder barely moves".

## 1. Rare Equipment T1/T2/T3/T4: **do not change 5/3/2/1**

Justified from the measured FilterBlade ladder, not taste:

- FilterBlade's L0 and L1 are **the same 364 named rare bases**; the only difference is one soft-only ID-beam block. **Their rung 1 is a duplicate of rung 0.**
- Aligning ours to theirs (T4→2, T3→3, T2→4) **imports that duplicate**. Measured: `regular` goes **296 → 844** — regular becomes indistinguishable from soft, and the author's cheapest escape hatch disappears. Candidate 2 in the table below.
- Our 5/3/2/1 already reproduces the same *distinct states* as theirs (905→258→153→33→0 named-base widths vs their 364→257→152→33→0). We simply reach each state one rung earlier. **They ship 7 files and the player picks one; we ship one file.** Reaching the useful states earlier is strictly better for us — it frees rungs 3–6 to be spent on the leaks, which is exactly where our thinning was missing.

| candidate (A75, bases shown) | soft | reg | semi | strict | very | uber | uber+ |
|---|---|---|---|---|---|---|---|
| 0 baseline | 844 | 297 | 192 | 102 | 102 | 95 | 95 |
| **1 leak gates only (RECOMMENDED)** | 844 | 297 | 192 | **41** | **32** | **25** | **25** |
| 2 + FilterBlade gate alignment | 844 | **844** | 297 | 131 | 32 | 25 | 25 |
| 3 + FB gates + FB DropLevel layers | 852 | 852 | 294 | 131 | 32 | 25 | 25 |
| 4 spread gates + 2 DropLevel layers | 852 | 461 | 282 | 130 | 121 | 32 | 25 |

Candidates 2–4 are all worse at the loose end where the author ships.

## 2. The exact edits

All gates below are **pure `hide_at_strictness` additions** — no condition changes, so **none can create a catch-all leak** (a gated block still matches and claims the item; it only becomes `Minimal`). Every one is `hideable: true` — **no unlock needed**.

| file (`filter_generation/data/tier_definition/…`) | tier key | now | → | reason |
|---|---|---|---|---|
| `Equipment/Magic Net.json` | `Rare Net` | none | **1** | Closes the A68–72 hole: its sibling `Magic Net` already carries gate 1, and `Rare Hide Endgame` (A≥73) is Minimal at every level, so 68–72 ran +53 louder than 73+ at every level, uber included. Symmetry with the file's own magic ladder. |
| `Equipment/League/Heist Experimented.json` | `Heist Experimented T2` | none | **3** | 38 mapped bases, the single largest non-ladder rare source; T0/T1 stay ungated as chase. |
| `Equipment/League/Ritual BaseTypes.json` | `Ritual BaseTypes T1` | none | **3** | 25 bases; T0 (2 bases) stays as chase. |
| `Equipment/League/Talismans.json` | `Talismans T2` | none | **3** | 42 mapped bases; T0/T1 stay. |
| `Equipment/League/Expedition Ward-Bases.json` | `Expedition Ward-Bases` | none | **4** | 9 Runic bases; ward is niche, survives to verystrict. |
| `Equipment/Crafting Priority.json` | `Crafting Over Quality` | none | **4** | 63 bases, `Quality > 20`, ungated and outliving uberplus. |
| `Equipment/Crafting Priority.json` | `Crafting Perfect Defence` | none | **5** | 40 bases, `BaseDefencePercentile >= 99` + `ItemLevel >= 84`; genuinely chase, so it dies last. |

**One condition fix (defect, not a gate)** — `Gems/Skill.json` / `Tier 2 Skill` is `hideable: false`, but `hideable` guards *gating* only, so **no unlock is needed to add a condition**:

```json
"conditions": { "Class": "== \"Skill Gems\" \"Support Gems\"" }
```

The tier currently has **empty `conditions`** and claims `"Energy Blade"`, which `data/items_db.json` carries as **three rows** — `Skill Gems` (drop_level 24) *and* `One Hand Swords` / `Two Hand Swords` (drop_level 1). At order 91013, before Rare Equipment (151xxx), two rare **sword** bases render with gem styling at all 7 levels. Verified after the fix: both fall to `Rare Hide Endgame` (block 152004, Minimal) — **claimed, not the catch-all**.

### Tiers deliberately left alone

| tier | why no edit |
|---|---|
| `Equipment/Special/Influenced.json` / `Tier 0 Influenced` | `hideable: false` → **NEEDS UNLOCK**. Recommend **no gate**: 8 bases, state-gated on `HasInfluence`. A state-gated block is a precision highlight, not volume. |
| `Equipment/VendorRecipes/Recipes.json` / `6-Link`, `6-Socket` | **`hideable: false` → NEEDS UNLOCK** (the measurement did not record this — I checked the file). Recommend **no gate**: in Ruthless a 6-socket drop is chase. My probe fixes `Sockets: 2`, so it cannot measure these — stated as unmeasured, not as zero. |
| `Breach Rings` (6), `Mirror Ring Bases` (5), `Stygian Vise T1`, `Sacrificial Garbs`, `Breach Grasping Mail`, all `T0` league tiers | The intended uber floor. FilterBlade's own L5/L6 survivors include exotic league bases, so keeping ~23 of them at uberplus is upstream-consistent. |
| `Equipment/Special/Fractured.json` | Already gated 6/5/3/3; fully shadowed at uberplus. |
| `_legacy/Legacy.json` | Wins 0 rare equipment bases at A75. |

### The campaign band — **not a strictness problem**

The measurement flagged 791 bases at A67 as "worse and 100% strictness-inert" across `_campaign/70 Safety Net.json` (`Rare Safety Net`, 652), `30 Jewellery Progression.json` (`Jewellery Any Rare` 75, `Jewellery Good Rare` 4) and `20 Armour Progression.json` (`Boots Highlight (Unidentified)` 60).

**It is inert by design.** `CONTEXT.md` rule 11: *"Strictness never applies inside `_campaign`… the campaign section renders identically at every strictness level. Campaign decluttering is the picker's `hide_unselected` toggle, not strictness."* `filterGenerator.ts:390` repeats it. **Gating these four tiers would violate a documented decision, so I am not proposing it.** Measured confirmation that my proposal leaves them untouched: A45 = 505, A60 = 701, A67 = 790, flat across all 7 levels, baseline and proposed identical. If campaign rare volume is a real complaint, the lever is `hide_unselected` — that is a separate author decision.

## 3. FilterBlade's low-DropLevel hide layer: expressible, but **do not build it this league**

**Can we express it? Yes, with one mechanism caveat.**
- `DropLevel` is live in the vocabulary: `filter_generation/data/filter_conditions.yaml:54` — `type: number`, `applies: [universal]`, **`simulatable: true`**. `conditionLines` (`webapp/frontend/src/utils/filterStyle.ts:375–395`) emits any key generically through `normOp`, so operator spacing is correct. It is in `check_catchall_coverage.NUMERIC` (line 75). **Used in 0 places in `filter_generation/data/` today — zero code work.**
- **The caveat:** `hide_at_strictness` only flips Show→Hide (`filterGenerator.ts:408-409`). There is **no inverse** — nothing turns a block *on* at a level. FilterBlade's `rrihide` blocks switch on at L2/L3/L4, which we cannot spell directly. The equivalent is a **gated Show tier** with `class_condition: true`, which reaches the same end state. Exact JSON, if ever built:

```json
"Rare Trash A73": {
  "class_condition": true, "hideable": true, "hide_at_strictness": 2,
  "theme": { "Tier": 5 },
  "conditions": {
    "Class": "== \"Body Armours\" \"Boots\" \"Gloves\" \"Helmets\"",
    "Rarity": "Rare", "AreaLevel": ">= 73", "DropLevel": "< 40"
  }
}
```

**Why not to build it now — measured.** Under *our* gate curve it buys **3 bases** (semistrict 297 → 294) and **costs 8 at soft** (844 → 852): a new class-condition Show block inside Rare Equipment (151xxx) out-prioritises `Rare Hide Endgame` in `Magic Net.json` (block 152004) and **un-hides uncurated armour**. The layer is only worth its blocks when the named tiers survive long enough to need area-precision trimming — i.e. under FilterBlade's *looser* gates. **The DropLevel layer and the gate curve are coupled**, and adopting one without the other is what makes it near-worthless. Which level it would switch on, if the author later adopts candidate 2: DL<40@A73 → gate 2, DL<50@A78 and DL<60@A80 → gate 3, DL<75@A82 → gate 4, mirroring their `%Dn` markers exactly.

DropLevel headroom does exist in our tree (armour bases below threshold, by tier): T1 0/0/0/0 (all DropLevel 84 by construction), T2 0/1/7/51, T3 3/14/29/46, **T4 140/177/202/221** at <40/<50/<60/<75. It is real, just not reachable through gates we already fire earlier.

## 4. Expected curve after the change

Distinct equipment bases **shown as Rare** (939 can drop at A75):

| AreaLevel | | soft | regular | semistrict | strict | verystrict | uber | uberplus |
|---|---|---|---|---|---|---|---|---|
| A68 | base → **prop** | 815 | 281→**221** | 189→**129** | 129→**31** | 129→**24** | 122→**17** | 122→**17** |
| A70 | | 872 | 328→**268** | 228→**168** | 154→**34** | 154→**25** | 147→**18** | 147→**18** |
| A75 | | 843 | 296 | 191 | 101→**40** | 101→**31** | 94→**24** | 94→**24** |
| A83 | | 878 | 331 | 228 | 122→**58** | 122→**52** | 96→**26** | 96→**26** |
| A45/60/67 | | 505/701/790 — **flat at every level, unchanged** (campaign, by design) |

The A68–72 hole is closed: at strict, A70 goes from **+53 louder** than A75 to slightly quieter (34 vs 40).

**Honest sizing — Ruthless cannot remove anything.** `HIDE_CMD` is `Minimal`, which still draws a label and emits no style lines. At A75 strict the split moves from **101 shown / 802 Minimal** to **40 shown / 863 Minimal**. The player still sees ~900 labels; what drops is the number that are **fully styled, coloured and sounded** — 101 → 40. Nothing above is "removed". Note also that T3 already sets `PlayAlertSound: "disabled:"` and T4 has no sound, so this trims labels, not audio.

**Recommended cut level: `semistrict`** — 843 → 191 at A75 (−77%), while T1+T2 named good bases keep full styling and their bespoke `item_overrides` sounds. `regular` (296) is the conservative option; `strict` (40) is likely too tight for Ruthless gear scarcity.

## 5. How to verify

1. Build all 7: `node filter_generation/generate.mjs --mode ruthless --strictness <L> --out out/s_<L>.filter --trace out/s_<L>.trace.json`
2. **Invariant 3, at every level:** `python parsing_tool/check_catchall_coverage.py out/s_<L>.filter --check` → must stay `curated bases lost: 0   equipment probes lost: 0`. Only the Gems edit changes conditions, so it is the only one that can move this.
3. **Block-count signature** (predicted, `Minimal` lines per level): soft `12→12`, regular `22→23`, semistrict `26→27`, strict `49→55`, verystrict `50→66`, uber `70→94`, uberplus `76→100`. A mismatch means an edit did not land.
4. **Re-run the splice measurement** against the real builds — it reproduced the real per-level builds **exactly at all 7 levels** (validated before use), so any divergence is a real behavioural difference: `C:\Users\shini\AppData\Local\Temp\claude\g--POE-filter-development-POE-filter-project\4d5f032b-df21-4ee2-9c40-359000541fec\scratchpad\sim.py` + `cand.py`.
5. `node filter_generation/test_generator_fixtures.mjs` and `test_resolver_equivalence.mjs`.
6. Confirm `grep -c '^Hide' out/s_<L>.filter` is **0** at every level (invariant 1).

## 6. Two defects found while proposing

- ★ **`parsing_tool/check_catchall_coverage.py` cannot evaluate `DropLevel`.** `DropLevel` is in `NUMERIC` (line 75) but the probe item dict (lines 237–243) never sets it, so `match_cond` reads `None` and returns **False** — a `DropLevel` condition would make a block look like it matches nothing. **This must be fixed before any `DropLevel` condition is authored**, or the guard will silently mis-evaluate it. One line: `"DropLevel": it.get("drop_level") or 1`.
- **`Tier 1 Rare Equipment`'s Stygian Vise block (151002) is fully shadowed** by `Equipment/League/Stygian Vise.json` / `Stygian Vise T1` (order 79002, `Rarity <= Rare`, no `AreaLevel`). No audible loss — both emit the same `Sharket掉落音效\深渊腰带.mp3` — but T1's **gate 5 never applies to Stygian Vise**, so it stays loud at uber. Same shadowing affects blocks 151023 and 151026 (Astrolabe Amulet, Sacrificial Garb). Left as-is above; worth a decision separately.

**Not touched:** the currency half of the author's request ("low value currency up to sharpstone" = Blacksmith's Whetstone). `filter_generation/data/{base_mapping,tier_definition}/Currency/General.json` currently carry **uncommitted edits from a concurrent agent** — which is why I measured by splicing into already-built filters rather than editing the shared data tree.