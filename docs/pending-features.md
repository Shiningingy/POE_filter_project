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

## 6. ★ The magic/normal net should follow AreaLevel, not strictness

**The complaint (author, from play):** FilterBlade still shows magic equipment in T16 maps,
which is annoying, and the only way to stop it there is to raise strictness. *"This should be
something auto-fit in progress, not a strictness control"* — like our campaign's hide-magic-
after-Act-3 behaviour.

**Measured — they are right, and it is structural.** FilterBlade barely uses `AreaLevel` for
magic at endgame at all: their magic handling is gated by `ItemLevel`, by mods (`magicid` =
identified magic with good rolls) and by `%D`, i.e. strictness. There is no "where you are"
axis in it.

**We already have the mechanism, and it stops dead at 67.** The campaign uses AreaLevel
RANGES, which are progression-driven and strictness-free:

```
Normal Declutter        AreaLevel 10-67   Rarity Normal
Magic Declutter         AreaLevel 10-67   Rarity Magic
Aggressive Magic Hide   AreaLevel 34-67   Rarity Magic
```

Above 68 there is a single flat layer, so a white map and a T16 are treated identically.
That is the "midgame >= 68 / endgame" third layer CLAUDE.md describes and that was never
built. Map area levels run T1 = 68 to T16 = 83, so bands are directly expressible.

Today at 68+: `Normal Net` is already a hide tier; `Magic Net` (24 classes) and
`Magic Good Jewellery` SHOW, gated only at strictness 1 and 2 respectively.

### Design constraints (author, 2026-08-06)

1. **This layer is for hiding trash equipment — mainly armour/weapons.** Some items only
   ever drop as magic, so it must not become a blanket magic hide.
2. **Add `Identified False` to the hide**, so a magic base someone identified for its mods
   survives. (`Identified` is available: `filter_conditions.yaml:67`, bool, universal.)
3. **The hide must be LOWER priority than the crafting layer**, so good jewellery bases are
   never swallowed by it — those stay strictness-controlled.
   ✅ **Already true**: `Crafting Priority` gen_order -10, `Rare Equipment` 3, `Magic Net` 5.
   The magic net is already the last equipment layer to speak.
4. **Do not hide everything** — talismans can drop magic and still be good.
   ✅ **Already true**: all 43 talismans are mapped into `Magic Good Jewellery`, which sits
   FIRST in `tier_order`, so a magic talisman is claimed there before the generic net.
5. **Normal at 68+ stays as-is — decided, no change.** You can scour a magic to normal
   anyway, and a base worth crafting hits the crafting layer, which should be
   strictness-controlled rather than a general rule.

### ✅ BUILT 2026-08-06 — boundary AreaLevel 72

`Magic Hide Endgame` sits between `Magic Good Jewellery` and `Magic Net`:

```
Class == <24 equipment classes>
Rarity Magic
AreaLevel >= 72
Identified False
```

Verified in the output at **soft** strictness, where no gate fires, which is the whole
point — the band is progression-driven and strictness plays no part:

| situation | outcome |
|---|---|
| area 68-71, magic trash | falls past the hide → shown by `Magic Net` |
| area 72+, unidentified magic trash | hidden |
| area 72+, **identified** magic | falls past → shown |
| magic talisman / good jewellery, any level | claimed first by name → shown |

The hide emits `Minimal` with NO style lines, per the Ruthless invariant that a styled
`Minimal` still draws a label.

⚠️ Area 72 is map tier **5** by the standard `area = 67 + tier` formula; tier 6 is area 73.
The author wrote "below 72 (Tier 6)", and 72 was taken as the literal number. Change the
one condition to `>= 73` if the intent was "from T6 onward".

⚠️ 41 of the 43 talismans are absent from `items_db.json` (post-dump 3.29 bases), so any
class-derived reasoning about them is blind until that DB is refreshed.

## 6b. ★ The two "theme defects" are NOT defects — checked 2026-08-06

Both were recorded as bugs to fix before the theme pass. Neither is.

**Uniques/Jewels "lost rarity-through" (`compile_theme.py:420`) — a DESIGN DECISION, not a
bug.** The recorded fix is "remove the explicit `TextColor` so the game paints the rarity
colour". Measured contrast if that were done (PoE's unique text is `#af6025`):

| row | background | now | if TextColor removed |
|---|---|---|---|
| Uniques T0 | `#ffffff` | 4.64:1 | 4.64:1 ✅ — its text already IS `#af6025` |
| Uniques T1 | `#d20000` | 5.61:1 | **1.21:1** |
| Uniques T2 | `#af6025` | 4.64:1 | **1.00:1 — invisible** |
| Uniques T3 | `#af9173` | 7.12:1 | **1.57:1** |
| Jewels T1–T4 | various | 3.00–8.03:1 | **1.21–1.78:1** |

7 of 8 rows would become unreadable. Those saturated backgrounds *require* an explicit text
colour — the rarity signal was deliberately moved from the text to the background. Going
rarity-through means **re-choosing every background** dark/neutral enough for the orange to
read. That is designer work, so it belongs in the handoff as a question, not in a bugfix.

**`Campaign / Aggressive Magic Hide` pointing at a non-existent `Tier 9` row — harmless.**
It is the only tier in the tree aimed at a missing row. It cannot matter: the generator
forces `isHide = true` for any `lv_group.axis === 'aggressive'` tier
(`filterGenerator.ts:333`), so the absent `is_hide_tier` is covered, and in Ruthless a hide
emits `Minimal` with NO style lines. Verified by generating with
`--leveling-selection '{"hide_unselected":true}'`: it emits `Minimal` plus conditions only.

## 6c. Theme state, measured 2026-08-06 (post-reshape)

- **1** tier points at a missing theme row (the harmless one above).
- **31** theme rows are shared by 2+ tiers. Most are legitimate — Campaign's 38 per-class
  "Rares" tiers *should* look alike. The ones that are ours and want distinct looks:
  `Crafting Bases Tier 4` ×4, `Crafting Bases Tier 2` ×3, `Rare Equipment Tier 3` ×3
  (Fractured borrows it), `Jewels Tier 3` ×4.
- **Fractured has no theme category of its own** — it points at `Rare Equipment`.
- **Influenced has 4 tiers and only 2 rows** (Tier 3, Tier 4), so T1/T2/T3 look identical.
- `_decorators/States` has no theme entry by design — decorators carry inline style.

⚠️ `sharket_theme.json` is HAND-TUNED. Any fix must be a surgical edit; regenerating it
would flatten the tuning (`build_standard_theme.py` is group B for exactly this reason).

## 6d. ★ NEXT UP — the queue as of 2026-08-06, after the theme adoption

The equipment reshape and the theme adoption are **done and committed**. These are the live
items, in the order they matter.

### A. ★ Crafting bases look exactly like ordinary rare equipment — author wants an accent

Measured: `Crafting Bases`, `Rare Equipment`, `Influenced` and `Trinkets` compile to
**byte-identical rows** — `#2a2a2a` at f0/e6/dc/d2, sizes 40/35/35/30. All four take the
`equipment` accent, which reply 14 pointed at the neutral fallback. That decision was
justified for `Rare Equipment` alone ("a single mixed file honestly has one hue to give")
but applies to every equipment-accent category.

For Fractured and Influenced this is fine and reply 14 says why — their **state border**
decorator separates them ("same accent, same rank, same look, with the state border saying
fractured"). **Crafting has no such channel**, so a top crafting base is indistinguishable
from a random rare, even though `Crafting Priority` emits FIRST at `gen_order -10` precisely
to say "this one is worth crafting on". The precedence we built is invisible on screen, and
it contradicts the standard's own §02 premise that you can tell categories apart at a glance.

**Author's call: crafting bases should read as exceptional — "like red on white".**

★ **Measured properly for reply 07, and the author's instinct is FilterBlade's, exactly.** I
had recorded red-on-white as a conflict with the reserved T0 idiom. It is not a conflict — it
is the same answer:

- **`0 240 190` (cyan-green) is FilterBlade's crafting look** — text + border + `0 75 30`
  plate on `crafting->qualityperfection`. And it is **not a category colour**: it appears in
  **24 purposes** (`rareid` 53 blocks, `exoticmods` 16, `magicid` 13, `exoticbases` 7,
  **`gear->memorystrand` 7**, `exotic->fractured`, `heist->contract`, `jewels->abyss`…). It
  means *"this instance beats its rarity"* — a **state**, not an accent.
- **Their escalation inside it is the designer's own vocabulary**: Q28+ = swap (all three
  channels), Q24+ = enhanced (text+border, plate steps down), floor = **border-only decorator**.
- ★ **Their red-on-white is `exoticbases` top = `Iron Flask` at ilvl 84+, ONE base**, with
  `text 255 0 0 / border 255 0 0 / bg 255 255 255 / Red Star / PlayEffect Red` — which *is* our
  T0 recipe, reached from the other side. So "red on white" is a **rung assignment for the top
  of the crafting ladder**, not a category colour. (It is also the ward base from reply 06 §6.)
- ★ **The kit already has the mechanism**: `text_swaps` — *"Properties that BEAT rarity take
  the text, freeing the border for real states."* Its `quality` entry is `120 235 210`, scope
  `equipment`+`gems`, rungs T0–T2, `Quality >= 21`. **They and FilterBlade picked the same
  colour for the same idea independently.** The ask is just to generalise the *condition* from
  one property to the crafting purpose.
- ⚠️ **`text_swaps` is NOT BUILT** — zero readers, and `120 235 210` appears nowhere in the
  output. The swap and the crafting answer are one build, which is why it waits on the answer.
- ⚠️ **Cost, unchanged: crafting bases lose rarity-through.** All 39 crafting blocks carry
  `Rarity <= Rare`, so today the text says Normal / Magic / Rare. FilterBlade pays it.

Measurements behind the ask: Crafting Priority emits **39 blocks over 282 bases**; **all 282
are also in Rare Equipment's lists**; and for **115 of 282** the best crafting block draws
*byte-identically* to the plain-rare block for the same base (e.g. `Conquest Lamellar`, both
`SetFontSize 40` + `SetBackgroundColor 42 42 42 240`). The other 167 get one rung, which reads
as "ranks higher", not "is exceptional".

### B. ★ `_legacy` holds live 3.29 content — 327 bases, needs an audit

Author's report, verified. `_legacy/Legacy.json` is one flat rung (T5, bulk) and contains:

| class | n | note |
|---|---|---|
| Support Gems | **46** | the new exceptional supports — live |
| Corpses | **9** | live |
| Map Fragments | 18 | scarabs, Divine Vessel |
| Misc Map Items | **2** | `Primeval Remnant` / `Primordial Remnant` — memory boss entry tickets, live |
| Skill Gems | 5 | Divine Blast, Vaal Breach etc. |
| Stackable Currency | 159 | the genuinely retired bulk |

Anything still dropping needs re-homing to its real category; the rest stays.

⚠️ **BLOCKED — do not audit this from the tree alone.** It needs TWO sources and neither is
ready:

1. **GGG's filter-info feed** says what exists in the game. `data/from_ggg/` has **34 threads
   indexed and 0 fetched**; `timeline.json` covers only 8 versions (3.29.0 → 3.22.0) and
   **6 of its 25 sections are `_complete: false`**. Its own note: *"false means the capture
   was truncated and the list is a floor, not a census — never conclude 'not removed' from
   an incomplete list."* **None of `Divine Vessel`, `Primeval Remnant`, `Annihilation
   Support` or `Astral Lich` appear in it at all.** So the feed cannot currently answer the
   question for the very items in dispute. Extracting the remaining 26 posts is the
   prerequisite.
2. **The Ruthless wiki** says what drops *in Ruthless*, which the GGG feed never does —
   droppability is per-MODE (`reference_ruthless_exclusive_drops`; the page 403s every fetch,
   so it is hand-saved and parsed by `parse_ruthless_wiki.py`).

★ **Worked example of why both are needed: `Divine Vessel` is drop-disabled in Ruthless right
now** (author, from play). It is live in the game, so source 1 would say "keep it" — and it
belongs in `_legacy` anyway. Re-homing on GGPK presence alone would have been wrong.

### C. Reply 07 to the designer — WRITTEN, `docs/design/reply-to-designer-07.md`

Re-measured before sending. **Two of the four items I had listed here were wrong and are
retracted in the reply itself** — both worth keeping written down, because each was a
measurement mistake rather than a data change:

- ⚠️ **"`Heist Blueprints` is inverted" — FALSE.** I read the tier *keys* in the file. Rules
  drive emission for that category, and the rule order is right: `[101001]` (enchanted, T2,
  size 40, red plate) emits before `[101002]`. **A tier file's key order is not the emission
  order whenever rules select the tier** — the general lesson.
- ⚠️ **"depth-2 `T2 T4` skips the family colour" — FALSE.** T4 puts the accent in the TEXT
  (`Life Flasks` T4 = `#505050` plate with `#c39691` text; Heist `#b4827d`; Ritual `#a5787d`).
  That is `_muted_is_authored` working as designed — T3's plate and T4's text are the same
  value. All 8 depth-2 value ladders are fine; no pair table is needed.

What the reply actually asks and reports:

1. ★ **Crafting bases** — the one real question, now with FilterBlade corroboration and a
   *small* ask. See A above; the sharpened version is that crafting does **not** need a 27th
   accent, it needs their existing **`text_swaps`** mechanism generalised from "quality beats
   rarity" to "crafting-worthiness beats rarity". ⚠️ `text_swaps` **has zero readers on our
   side** — no code path, and `120 235 210` appears nowhere in the output — so the swap and
   the crafting answer are one build.
2. **`Magic Net`** — ✅ **FIXED AND LANDED**, not just reported. Their override annotated `(4)`
   counted the three hide tiers; the ladder has 2 visible, so `T3 T4 T5 T5` truncated to the
   adjacent `T3 T4`. `rungs_for()` now **discards** a stale override and falls back to the
   template instead of truncating, still warning loudly. Magic Net's floor moved T4 → T5
   (size 35/alpha 220 → 30/210); exactly 1 block changed in the whole filter.
3. **`painted_t3_needs_t2` — per file or per category?** `Jewels/Base Jewels.json` resolves to
   `T3` alone (painted accent, no T2), but all three Jewels files share `theme_category:
   "Jewels"` so the merged rows do have a T2. The invariants are becoming validator checks, so
   the scope decides whether this fires.
4. **Their depth-1 → T2 warning fires 4×** — Bottles / Mercenary Warrants / Voyage Charts (all
   → `Curse of the Allflame`) and `Heist/Targets.json`. All four look correct to us; confirming
   so it gets silenced deliberately rather than by fatigue.
5. **`theme-standard.md` in the kit is stale** — `T6` on 8 lines, a shape list of 8 against
   `_shape_reserve`'s 10 assigned + 1 reserved, and a currency table ending at `T6 = scrolls`
   while their own `Currency/General.json (9)` override ends at T4. We follow the machine files.

### D. Standing

- ⚠️ **Nothing from this session has been loaded in game.** Guards are all green, which is
  historically the exact state that hides format bugs.
- **Per-item sound sweep is the AUTHOR's work**, not the assistant's, unless a bulk import is
  explicitly requested. The editor display bug is fixed, so sounds now show as they are set.
- Sound coverage by tree, if a bulk import is ever wanted: `_campaign` 4% of tiers, Equipment
  39%, Heist 42%, Currency 80%.

⚠️ **Do NOT adopt the `sharket_theme.json` inside the designer's project export.** It is a
pre-reshape snapshot: still has the 23 per-class equipment categories, missing `General`,
`Corpses`, `Scarabs`, `Crafting Bases` and 25 more, **0 of 51 categories identical to ours**.
The kit files are the deliverable; `compile_theme.py` + `adopt_compiled_theme.py` is the path.

## 7. Open — not yet decided

- **`AreaLevel >= 68` vs `ItemLevel >= 68`.** Ours gates the ladder on `AreaLevel`, theirs
  on `ItemLevel`. ADR-0006 says these are not interchangeable: `AreaLevel` decides *where
  you are*, `ItemLevel` decides *what it can roll*. For a "is this base worth picking up"
  ladder, ItemLevel is arguably the right axis. **Needs an author call.**
- Whether the ~14 extra T0 bases stay (proposed: yes, see §4).
- `Ghostflame Blade` and `Pearlescent Amulet` are in our tree but not `items_db.json` —
  post-dump 3.29 bases; the DB needs a refresh before class is derived from it.

## 8. Deferred features (unchanged)

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
