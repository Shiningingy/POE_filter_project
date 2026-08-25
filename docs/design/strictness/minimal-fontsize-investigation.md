<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

## Answer: unresolved by evidence, but the technique is already in your own shipped filter — and the repo contradicts itself on the clamp

---

## 1 · What FontSize values actually ship

Uncommented `SetFontSize` lines only (`^\s*SetFontSize N`):

| file | values seen | **min** |
|---|---|---|
| `data/from_filter_blade/3.29/FilterBlade_0_Soft.filter` | 18×9, 30×1, 35×29, 40×132, 45×540 | **18** |
| `…_1_Regular` | 18×9, 30×1, 35×28, 40×131, 45×539 | **18** |
| `…_2_Semi-Strict` | 18×10, 30×1, 35×24, 40×128, 45×539 | **18** |
| `…_3_Strict` | 18×12, 30×1, 35×19, 40×116, 45×535 | **18** |
| `…_4_Very Strict` | 18×13, 30×1, 35×16, 40×106, 45×508 | **18** |
| `…_5_Uber Strict` | 18×13, 30×1, 35×16, 40×52, 45×445 | **18** |
| `…_6_Uber Plus Strict` | 18×13, 30×1, 35×16, 40×51, 45×354 | **18** |
| `FilterBlade.filter` | 18×10, 30×1, 35×24, 40×128, 45×545 | **18** |
| **`FilterBlade.ruthlessfilter`** | 32×1, 35×12, 36×1, 40×91, 42×3, 45×588 | **32** |
| `data/Sharket3.15[0]标准版.filter` | **1×2**, **17×66**, 30×6, 34×122, 37×216, 40×1017, 43×596, 45×353 | **1** |
| `data/Sharket3.27[0]无情异界私货.ruthlessfilter` | **1×13**, 30×1, 35×3, 37×11, 40×240, 43×28, 45×412 | **1** |

**Nobody but you ships below 18.** NeverSink's floor is 18 in Standard and **32 in Ruthless** — his ruthless file has no small sizes at all, because all **15** of his `Minimal` blocks carry **zero style lines** (verified: I dumped all 15; every one is `Minimal # Hide-Section replaced with minimal` followed by conditions only — not even `DisableDropSound`, which the *same rules* carry in his Standard file). That is a deliberate Hide→Minimal transformation that strips style, identical to ours.

FilterBlade's Standard hide idiom is a fixed quartet:
```
SetFontSize 18
SetBorderColor 0 0 0 0
SetBackgroundColor 20 20 0 0
DisableDropSound True
```
It appears on `hidelayer` blocks (`$tier->rrihide1`, `normalmagicendgame`, `outdatedlevelflaska`, `final`, …). Corroborated in `test/theme.json` — their own imported style JSON — key `hidelayer_general_raresendgame` = `"FontSize": 18`.

### ★ The find that matters: your 3.27 Ruthless filter already does this

`data/Sharket3.27[0]无情异界私货.ruthlessfilter` — **798 Show, 0 Hide, 0 Minimal** — contains **13 `SetFontSize 1` blocks**, all `Show`, all with `DisableDropSound`, 5 headed `Show # 全局设置 - 显示全部垃圾物品` ("show all trash items"). I tested them for first-match-wins reachability: **4 of the 13 are reachable** (the other 9 sit behind an earlier block with a subset of their conditions, so they never fire). The 4 live ones:

```
Show                                        # @8756  ilvl>=60 normal jewellery
Show                                        # @8779  ilvl>=68 magic jewellery
Show                                        # @9209  Rarity <= Magic Cluster Jewel
Show                                        # @11415 THE BIG NET: Rarity <= Rare, all 20 gear classes
    SetBackgroundColor 0 0 0 0
    SetBorderColor 0 0 0 0
    SetFontSize 1
    DisableDropSound
```

All four **omit `SetTextColor`** — so the text keeps its rarity colour at size 1 on a fully transparent plate. Your 3.15 Standard version of the same idea *does* set `SetTextColor 0 0 0 0` (both @3454 and @3483), but both of those are unreachable behind a styled block above them.

So the technique is yours, it shipped, and the file loaded. **That proves the parser accepts `SetFontSize 1`. It proves nothing about how it renders** — and the fact that you are asking now suggests it never got a clean read in play.

---

## 2 · What the docs say about the range — and the contradiction

**`reference_poe_filter_format.md` states no range.** Its only FontSize statement is in the §2 absent-key table (line 41): omitted `SetFontSize` → the game paints **32**. No minimum, no maximum, no clamp.

**`data/from_ggg/` states nothing.** All 34 league filter-info threads: `grep -ri fontsize data/from_ggg/` → **0 hits**. GGG's feed never mentions FontSize. Nothing to quote.

Two places in the repo assert 18–45, **both unsourced**:

- `parsing_tool/audit_visual.py:13` — *"`SetFontSize`, always emitted, so this is total coverage. The game clamps to 18..45; 32 is the generator's fallback…"*
- `docs/design/reply-to-designer-03.md:156` — *"(32 is only the default when the line is omitted; the game's accepted range is 18–45.)"*

And one place flatly contradicts them — `docs/pending-features.md:326–345`, item 8, **"True minimal — a Ruthless hide that actually hides" (author, 2026-08-07)**. It records your exact proposal (`SetFontSize 1` + alpha-0 text/bg/border + `DisableDropSound`), notes the FS17/FS1 corroboration from your own filter, and then says:

> ⚠️ **Two things need an in-game check before this ships**, and neither can be settled from the format doc: whether the game **clamps** `FontSize` into 18–45 (if it does, size 1 renders at 18 and the *alpha* is doing all the work), and whether an alpha-0 label still takes a highlight on Alt — which would be a feature, not a bug, since a Ruthless player wants the item findable but silent.

**Verdict on Q2: the 18–45 range is an unverified assumption stated as fact in two files.** Nothing in this repo measured it. `audit_visual.py`'s docstring should be corrected to "assumed" until the test below runs.

---

## 3 · The code that strips style from a hide block

`webapp/frontend/src/utils/filterStyle.ts:124–142` — exact text:

```ts
const STYLE_PREFIXES = ["    Set", "    PlayEffect", "    MinimapIcon",
                       "    CustomAlertSound", "    PlayAlertSound"];

/**
 * Join a block, dropping style lines when it is a hide block.
 *
 * A `Hide` block renders nothing, so its styling was always dead weight. Under
 * RUTHLESS it is worse than dead: GGG does not permit `Hide` there, so HIDE_CMD
 * is `Minimal` — which still DRAWS a label. Emitting a font size and a plate on
 * it makes the very thing we are trying to quieten more visible, not less.
 * NeverSink's Ruthless filter emits conditions only on its Minimal blocks
 * ("Hide-Section replaced with minimal"). Mirrors block_text() in generate.py.
 */
export const blockText = (blockLines: string[], isHide: boolean): string => {
  const kept = isHide
    ? blockLines.filter((l) => !STYLE_PREFIXES.some((p) => l.startsWith(p)))
    : blockLines;
  return kept.join('\n') + '\n';
};
```

The rule: **on a hide block, drop every line starting `    Set`, `    PlayEffect`, `    MinimapIcon`, `    CustomAlertSound`, `    PlayAlertSound`.** Prefix-matched on four literal spaces.

Two consequences worth naming:

- `DisableDropSound` is **not** in `STYLE_PREFIXES`, so it would survive a hide block. No tier sets it, so today **0 Minimal blocks emit it** — verified on `out/fs-uberplus.filter`: the only line-heads inside `Minimal` blocks are `AreaLevel BaseType Class Corrupted FracturedItem HasInfluence Identified ItemLevel MapTier MemoryStrands Mirrored Rarity`. Conditions only. Byte-for-byte the same discipline as NeverSink.
- **`blockText()` is the single line of code your proposal has to change.** Making a Minimal block styled means giving it an exception here, and `filterStyle.ts` is shared by the generator, the preview and the simulator (ADR-0007), so all three move together.

**What is at stake, measured** (`node filter_generation/generate.mjs --mode ruthless --strictness <L>`):

| level | Show | **Minimal** |
|---|---|---|
| soft | 457 | 12 |
| regular | 447 | 22 |
| semistrict | 443 | 26 |
| strict | 416 | 53 |
| verystrict | 412 | 57 |
| uber | 388 | 81 |
| uberplus | 382 | **87** |

87 blocks at uberplus are currently drawing a bare default label — FS32, `0 0 0 190` plate, rarity-coloured text. That is the clutter. It is also why the ladder "barely moves": **hiding in Ruthless does not clear the ground, it only removes decoration.**

---

## 4 · The "Tier 9: FS18 translucent" rung — it is a DEFECT REPORT, not a recommendation

Correction to the brief first: **`docs/design/handoff/theme-rungs-rev28.json` does not exist at that path.** rev28 was superseded; it is at `docs/design/handoff/_superseded/theme-rungs-rev28.json`, and the identical string survives verbatim in the live `docs/design/handoff/theme-rungs-rev29.json:539` (and in rev23/25/25-2/27/27-1).

It lives under `audit_2026_08_08` → **`C_template_defects`** — a list of three things the designer says are *wrong*:

```json
"C_template_defects": [
  "Tier 0 white border 2.17:1 vs its own plate (< 3.0 border floor)",
  "Tier 9: FS18 translucent text on transparent plate, 1.92:1 effective — below every Ruthless floor",
  "Tiers 3/4/5 byte-identical — pre-merged in the template (§6 merge trap at the source)"
]
```

Read against `contrast_floors` in the same file — `dark_plate_text >= 4.5:1`, `bright_or_white_plate_text >= 3.0:1`, `text_R5_effective >= 3.5:1`, `border >= 3.0:1` — **1.92:1 fails all four.** The designer is complaining that Tier 9 is too dim to read, not proposing it as a hide.

**So: no, it is not the intended near-invisible treatment.** Three further checks confirm that:

- The designer's ladder has **six rungs, R0–R5, and stops**. The quietest, R5 *"Know it's there / 知道就好"*, is `FontSize 40`, text at alpha 204 on a **solid** `0 0 0 255` plate — or, for currency, *"NO style lines at all — the game paints the label (absent-key rule, §6)"*. There is no invisible rung anywhere in the kit.
- The current designer theme (`docs/design/sharket_theme.json`, 99 categories) puts Tier 9 at **FontSize 30**, not 18 — 49 of 99 rows are exactly `{BackgroundColor #000000ff, BorderColor #00000000, FontSize 30}`.
- The **live** theme (`filter_generation/data/theme/sharket/sharket_theme.json`, 53 categories) has **no Tier 9 at all**. Tier keys are 0–6; the FontSize histogram is `40×123, 43×2, 45×57`. **Minimum 40.** The whole FS18 row is dead in the shipping build.

The only intentional FS18 rows in the repo are `parsing_tool/build_standard_theme.py:136–137` — `# tier 9 — Hide (style irrelevant)` → `{"FontSize": 18, "TextColor": (90,90,100,170), …}`, written for **Standard**, where `Hide` genuinely hides and the comment says so.

---

## 5 · The test — `minimal-visibility-test.ruthlessfilter`

Written to **`C:\Users\shini\Documents\My Games\Path of Exile\minimal-visibility-test.ruthlessfilter`**, next to `continue-semantics-test.ruthlessfilter` and modelled on it. All ten `BaseType` values verified present in `data/source/cn-3.29/tables/English/BaseItemTypes.json` (invariant 7 — a `BaseType` that matches nothing fails silently), and every operator carries its space (invariant 4).

Must be loaded on a **Ruthless character** — `Minimal` is not legal outside a `.ruthlessfilter`.

```
#===============================================================================
# MINIMAL VISIBILITY TEST  -  Ruthless only.
#
# HOW TO RUN IT
#   1. Select this filter in game.  2. Hideout, take the ten items from stash.
#   3. Drop them on the ground in a row, in order A..J.
#   4. Walk back, stand still, read the labels.  5. HOLD ALT, read again.
#   6. Screenshot both.
#
#   Q1  Does Minimal honour SetFontSize at all?       -> B / C / D
#   Q2  Is FontSize clamped at the bottom?            -> D vs C.
#                                                        SAME SIZE = clamped at 18.
#                                                        D SMALLER = no clamp, 1 works.
#   Q3  Does alpha 0 alone erase a label?             -> E and J
#   Q4  Is Show+FS1+alpha0 quieter than bare Minimal? -> A vs G
#   Q5  Does an invisible label still take an Alt highlight? -> step 5
#
#   A is EXACTLY what V6.991 ships today. A is the baseline. Anything quieter
#   than A is a win. Anything identical to A means the game ignored that style
#   line on a Minimal block.
#
# IF THE FILTER REFUSES TO LOAD: the suspects are `SetFontSize 1` in D, F and G.
# Comment those three lines out and reload. If it then loads, the game rejects
# FontSize 1 outright and the idea is dead - that is itself an answer, report it.
#===============================================================================


# CANARY - proves the filter loaded. If a Scroll of Wisdom is NOT a big red
# label, stop: nothing below means anything.
Show
    BaseType == "Scroll of Wisdom"
    SetFontSize 45
    SetTextColor 255 255 255 255
    SetBackgroundColor 200 0 0 255
    SetBorderColor 255 255 255 255


# A - BASELINE. What every hidden item in V6.991 looks like today.
Minimal
    BaseType == "Portal Scroll"


# B - Minimal + FS45. Control for Q1. If B is not bigger than A, Minimal
#     ignores style entirely and the answer is no - stop reading.
Minimal
    BaseType == "Armourer's Scrap"
    SetFontSize 45


# C - Minimal + FS18. FilterBlade's own floor.
Minimal
    BaseType == "Blacksmith's Whetstone"
    SetFontSize 18


# D - Minimal + FS1. THE QUESTION. D vs C is the clamp test.
Minimal
    BaseType == "Orb of Transmutation"
    SetFontSize 1


# E - Minimal + alpha 0 everywhere, size left to the game. Isolates alpha.
Minimal
    BaseType == "Orb of Augmentation"
    SetTextColor 0 0 0 0
    SetBackgroundColor 0 0 0 0
    SetBorderColor 0 0 0 0


# F - Minimal + FS1 + alpha 0. Quietest thing that is still a Minimal block.
Minimal
    BaseType == "Orb of Alteration"
    SetTextColor 0 0 0 0
    SetBackgroundColor 0 0 0 0
    SetBorderColor 0 0 0 0
    SetFontSize 1


# G - Show + FS1 + alpha 0 + DisableDropSound. NOT a Minimal block. This is the
#     idiom in your own shipped 3.27 ruthless filter (13 blocks, 4 of them live).
#     If G beats A, the answer is to stop emitting Minimal entirely.
Show
    BaseType == "Jeweller's Orb"
    SetTextColor 0 0 0 0
    SetBackgroundColor 0 0 0 0
    SetBorderColor 0 0 0 0
    SetFontSize 1
    DisableDropSound


# H - Show + FS18 + alpha 0. G vs H = the SAME clamp test on a Show block.
#     If G and H match too, the clamp is global, not a Minimal quirk.
Show
    BaseType == "Orb of Chance"
    SetTextColor 0 0 0 0
    SetBackgroundColor 0 0 0 0
    SetBorderColor 0 0 0 0
    SetFontSize 18
    DisableDropSound


# J - Show + FS45 + alpha 0. Alpha doing ALL the work at maximum size.
#     If J is invisible, size is irrelevant and alpha 0 is the whole mechanism.
Show
    BaseType == "Glassblower's Bauble"
    SetTextColor 0 0 0 0
    SetBackgroundColor 0 0 0 0
    SetBorderColor 0 0 0 0
    SetFontSize 45
    DisableDropSound


# Everything else stays loud, so you can tell "invisible on purpose" from
# "the filter is broken".
Show
    SetFontSize 32
```

**Why dropping from the stash rather than farming:** ten labels side by side, in a known order, in a hideout with a controlled background. Ground labels are filtered regardless of how the item got there. If a base is scarce, swap it — any name works, keep one block per base and keep the canary first.

### The three decision paths

- **B ≈ A** → Minimal ignores style. Question closed, answer is no, and `blockText()` is already correct.
- **B > A but D ≈ C** → Minimal honours size, but the floor is 18. Font size alone can never hide; **alpha is doing all the work**, and E/F/J tell you whether alpha alone is enough.
- **D < C** → no clamp, size 1 renders at size 1, and F is a genuine invisible Minimal.

---

## 6 · What I am *not* asserting, and the guard rails

**The range question can only be settled in game.** I have no measurement of it and neither does this repo. `docs/pending-features.md:339` says so explicitly, and the two files that state "18–45" cite nothing. **Clamping is the likelier outcome** — it is what `audit_visual.py` assumes, it is the reason FilterBlade's floor across 8 files is exactly 18 and never 17, and it would explain why your own reachable FS1 blocks stop bothering to set `SetTextColor`. But "likelier" is a prior, not a result. Do not let me talk you into it before the screenshot.

Three things to hold onto whichever way it goes:

1. **Never say "removed".** Even a fully invisible label is still an item on the ground with a hitbox, and Alt may still surface it (Q5). The honest phrasing stays *"demoted to a quiet label"* — invariant 1.
2. **This is a format-level change, not a category fix.** `pending-features.md` item 8 already rules it: *"This would change what 'hide' means everywhere… Do not apply it piecemeal."* If F or G wins, it changes `blockText()` once and all 87 uberplus blocks move together.
3. **Converting Minimal → invisible Show does not change matching**, only the command word, so `check_catchall_coverage.py` should stay at 0 — but re-run it at **every** strictness level after the change, because that guard is the one thing standing between a curated base and the `[99999]` net.

**One correction to file regardless of the outcome:** `parsing_tool/audit_visual.py:13–14` states the 18..45 clamp as fact. Until this test runs it should read "assumed, unverified — see `docs/pending-features.md` §8."