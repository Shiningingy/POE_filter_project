# Equipment reshape — the plan of record

★ **Direction settled 2026-08-05: RESHAPE FIRST, then ship.** Shape confirmed against
FilterBlade's own editor structure 2026-08-06.

*A poor filter only receives negative feedback and is unusable at all*, so shipping the
current filter as a checkpoint was rejected in favour of shipping the reshaped one.

Consequences, so nobody re-litigates them:

- **All theme work is deferred until every category is settled.** Not just the known
  defects — the theme will need new designs once equipment reshapes, so fixing anything
  now is throwaway. That explicitly includes the Uniques/Jewels rarity-through regression
  (`compile_theme.py:420`), a real in-game defect being left alone on purpose.
- **No release tag in the meantime.** `v3.29-ruthless-pre-rewrite` remains the fallback.
- Nothing below blocks generation — the filter builds, validator reports 0 errors.

---

## 0. The evidence base

`parsing_tool/extract_filterblade_ranks.py` (group A, read-only) parses
`data/from_filter_blade/3.29/FilterBlade.ruthlessfilter` into
`data/from_filter_blade/3.29/ruthless_ranks.json` — **900 blocks, 140 purposes, 2739
bases**, each block with its purpose, bucket, conditions and BaseType list.

Their editor structure is in `data/from_filter_blade/upstream/CustomizerDefault.options`
and is the authority on *shape*; the compiled filter is the authority on *content*.
Screenshots of the live UI: `data/from_filter_blade/UI_1.png`, `UI_2.png`.

⚠️ **The parser must not key off indentation.** Block bodies are tab-indented in some
sections and flush-left in others (`$type->rr->amuring`), so an indentation rule silently
read whole purposes as empty. It must not key off capitalisation either — their prose
comments are capitalised (`Level 85 crafting bases`). Only an explicit keyword allowlist
separates body from comment. This bug cost a wrong "jewellery is unranked" conclusion.

## 1. What is already correct — do not rebuild it

★★ **Our per-class T1/T2/T3 ladder IS FilterBlade's `rr` ladder, verified exact.**
259 bases agree, **0 disagree**, 2 unranked by them (`Thief's Trinket` — Heist;
`Ghostflame Blade` — post-dump base). Our T4 is the deliberate catch-all net (their t4 plus
everything unranked).

Also measured: `rr` + `rr->amuring` + `rr->belts` **== `rare->exotic->veiled` exactly** —
same 364 bases, same ranks, zero disagreements. Veiled is not a separate ranking, it is the
same base ladder pointed at a different mechanic. **Ruthless has no veiled rares (author),
so that purpose is dropped — and dropping it costs no rank data.**

## 2. The corrected model

★ **The ilvl threshold is a property of the CLASS, via a named split — not per base.**
This supersedes the earlier reading in this doc, which cited Gemini Claw 83 / Imperial Bow
86 / Jewelled Foil 83 as proof of a per-base threshold. Those are just Claws / Bows /
Thrusting Swords under a declared class split. Their own warning says it outright:
*"Any Gloves will be part of and ONLY of the level 85 rules."*

`BaseTypeMatrix("EgHighLevelCraftingBases", "1.0", "LevelSplit1", true,
[[T1:0..T1:3], [T2:0..T2:3], [T3:0..T3:3]])` — 3 ranks × 4 ilvl bands, verified against
every base in the purpose (every class sits in exactly one band):

| band | classes |
|---|---|
| **86** | Body Armours, Boots, Shields, Bows, Belts, Quivers |
| **85** | Amulets, Gloves, Helmets |
| **84** | Rings, Rune Daggers, Sceptres, Staves, Wands *(caster)* |
| **83** | Claws, 1H/2H Axes, Maces, Swords, Warstaves *(attack)* |

So the authoring model is **base → rank, per purpose**; everything else is derived. Their
whole equipment editor is one control, `BaseTypeMatrix(name, ver, splitter, …, ranks)`,
reused per purpose with the splitter choosing the column layout (`Default` / `ClassSplit`
/ `LevelSplit1`).

★ **The rank is PER PURPOSE.** Measured: 268 of 368 bases get a different rank in
different purposes. It cannot be collapsed to one global rank. **Membership IS the rank**,
so the import is mechanical — no scoring, no inference.

## 3. Decisions taken (author, 2026-08-06)

1. **Collapse the 24 per-class ladder files into ONE category, `Rare Equipment`.**
   Class becomes a matrix column derived from GGPK, not a file location.
2. **Adopt four purposes**: High Level Crafting Bases, Fractured Items, Memory-Stranded
   Items, Influenced Items. Veiled dropped (see §1).
3. ★ **Our layout diverges from theirs deliberately.** They tick Rank A/B/C/Untiered which
   all share one look. **We use Tier 1/2/3/4, each with its own theme.** This needs no new
   mechanism — a purpose category is a `theme_category` with a real tier ladder, which is
   what `theme_category × Tier N` already does.
4. **The editor is an extension of the existing bulk editor**, not a new surface — the rank
   brush and collapsed base card already shipped; what is missing is a purpose-scoped
   endpoint returning the candidate pool grouped by class.

### Why the collapse is safe (measured, not assumed)

- All 24 ladders are **uniform**: `hide_at_strictness` T1=5/T2=3/T3=2/T4=1, `theme.Tier`
  2/3/3/4/5/9, same sounds, same `AreaLevel >= 68 · Rarity Rare`.
- `_meta.item_class` reaches **only comment headers** in `filterGenerator.ts`
  (lines 382/416/543/614) — never an emitted condition. The collapse cannot change matching.
- 60 `item_overrides` across the 24 files, **0 collisions**.
- Only 2 bases appear in two ladder files, and both are misfilings (below).

⚠️ **Trinkets is the one genuine outlier** — 1 base (`Thief's Trinket`, a Heist item), no
`AreaLevel` gate, own labels, no sounds. Kept out of the collapse.

★ **34 ladder bases are filed under the wrong class** (GGPK is the authority): 24 Thrusting
One Hand Swords under One Hand Swords, 4 Rune Daggers under Daggers, **3 Corpses**
(`Dancing Sword` variants) under One Hand Swords, `Maligaro's Spike` (Quest Item),
`Piledriver` (Two Hand Mace), `Reaver Sword` (Two Hand Sword). Harmless today because
`item_class` only reaches comments — but they would poison the new matrix's class columns.
Deriving class from GGPK fixes all 34 for free. Same principle as ADR-0004.

## 4. ★ T0 is a duplicate of the Crafting purpose — and less accurate

The 33 rules across the ladder files are a **hand-written LevelSplit**: the same top-N
bases listed twice, once at `ItemLevel >= 86` → `Tier 0`, once at `>= 84` → `Tier 1`
(heavy weapons: one rule at 83). 33 of those targets are already in `Crafting Priority`,
but gated wrong:

| class | our T0 gate | their band |
|---|---|---|
| Claws | `>= 86` | **83** — 3 levels too strict |
| Rings, Daggers, Sceptres, Wands, Rune Daggers | `>= 86` | **84** |
| Gloves, Helmets, Amulets | `>= 86` | **85** |

⚠️ **Body Armours' 3 rules carry no `overrides.Tier`, so they are dead** — that is the
"missing 84 rung all 11 siblings have". A rule with conditions but no tier is skipped
outright (`reference_rule_gotchas`).

**Plan: T0 stops being a ladder rung and is absorbed into the Crafting purpose**, keeping
our ~14 extra bases (`Sorcerer Boots`, `Hubris Circlet`, `Lion Pelt`, `Royal Burgonet`,
`Imperial Staff`, `Coronal Maul`, `Great White Claw`, …) — deliberate "best base for the
slot" curation — while adopting **their** per-class bands.

## 5. Import backlog, measured

"We have" below means the purpose membership is recorded, not merely that the base exists
somewhere in our tree (every base does, via the ladder).

| their purpose | bases | we express | gap |
|---|---|---|---|
| `rr` (+amuring/belts) | 364 | ✅ per-class T1–T3 | **0 — verified exact** |
| `crafting->generalgear` | 132 | 33 (the `t1` rung only) | **99** |
| `crafting->qualityperfection` | 104 | partial | — |
| `gear->memorystrand` | 277 | 63 in Crafting Strands | **214** |
| `exotic->fractured` | 436 | 0 — empty shell, 3 condition-only rules | **436** |
| `influenced->all` | 185 | 0 — empty category | **185** |
| `6l` / `magicid` / `rareid` / `exoticbases` | 47/22/45/98 | not expressed | — |

⚠️ `Crafting Gear 86`/`85` are **byte-identical** to their `t1_86`/`t1_85` — a past import
took the t1 rung only and dropped t2/t3. `Crafting Gear 84` = their `t1_84` plus 3
hand-added Runic pieces (keep those).

Influenced needs more than a matrix: their section has the 3-rank matrix **plus** per-influence
base lists (Shaper/Elder/Crusader/Hunter/Redeemer/Warlord) and per-influence class lists.

## 6. Open — not yet decided

- **`AreaLevel >= 68` vs `ItemLevel >= 68`.** Ours gates the ladder on `AreaLevel`, theirs
  on `ItemLevel`. ADR-0006 says these are not interchangeable: `AreaLevel` decides *where
  you are*, `ItemLevel` decides *what it can roll*. For a "is this base worth picking up"
  ladder, ItemLevel is arguably the right axis. **Needs an author call.**
- Whether the ~14 extra T0 bases stay (proposed: yes, see §4).
- `Ghostflame Blade` and `Pearlescent Amulet` are in our tree but not `items_db.json` —
  post-dump 3.29 bases; the DB needs a refresh before class is derived from it.

## 7. Deferred features (unchanged)

- **Match presets / predefined rules** — the same 24-class list is repeated across 13 tiers
  in 6 files in 4 textually-different forms. Nothing has drifted yet; nothing prevents it.
  ⚠️ Boundary to write down when building: decorators are already property-matchers; the
  difference is that a decorator paints one channel and composes via `Continue`, while these
  are full blocks that terminate.
- **Cluster jewel passive-type axis** — `EnchantmentPassiveNode` is declared `type: select`
  with 22 options but the game matches on **substring** and FilterBlade uses 41. A fixed
  list is the wrong control.
- **Editable tier conditions in-app** — theirs is `QuickUI(rule, "SH", [conditions…],
  label)`, i.e. the section declares which conditions are editable. Ours are read-only.
- **`from_tier` selector** — subsumed by the purpose model; all silent tiers need bases,
  not a new primitive.
- **Weapon ranking for the 8 unnamed classes** — FilterBlade names no top base for One Hand
  Axes/Maces, Sceptres, Staves, Two Hand Axes/Maces/Swords, Warstaves. That is a signal, not
  an omission: the rungs may want deleting rather than filling. **Do not invent a ranking.**
