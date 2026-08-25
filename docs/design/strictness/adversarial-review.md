<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

## VERDICT

The proposal is **honest and mostly accurate on documentary claims, but wrong on its own measurements, wrong about its implementation cost, and — decisively — it does not address the task**. It proposes zero strictness gates.

---

## CONFIRMED DEFECTS

### D1. §3's Show/Minimal table is unreproducible. Every row is wrong; the headline "87" is 76.

```
node filter_generation/generate.mjs --mode ruthless --strictness <L> --out out/refute/<L>.filter
```

| level | proposal Show/Minimal | **measured** | Minimal error |
|---|---|---|---|
| soft | 457 / 12 | **456 / 12** | 0 |
| regular | 447 / 22 | **446 / 22** | 0 |
| semistrict | 443 / 26 | **442 / 26** | 0 |
| strict | 416 / 53 | **419 / 49** | −4 |
| verystrict | 412 / 57 | **418 / 50** | −7 |
| uber | 388 / 81 | **398 / 70** | −11 |
| uberplus | 382 / **87** | **392 / 76** | **−11** |

Confirmed two independent ways: `grep -c '^Minimal'` on the emitted files, and the generator's own trace (`out/refute/tr6.json`: 466 blocks, `is_hide` = 76 at uberplus, 12 at soft). The proposal's block total is a constant 469; the real one is 468. My numbers match the brief's pre-measured ladder (456→446→442→419→418→398→392) **exactly**, so the brief and the generator agree and the proposal disagrees with both. §3's rhetorical peak — *"87 blocks at uberplus are currently drawing a bare default label. That is the clutter"* — overstates by 14%.

### D2. The §3 fix would make 50 of the 76 hidden blocks START PLAYING A SOUND.

§3 says *"Making a Minimal block styled means giving it an exception here"*. I measured what those blocks would emit if `blockText()` stopped stripping, by aligning the soft and uberplus traces (453 orders, **0 misaligned**) and reading the unstripped text of each block that is `is_hide` at uberplus:

```
uberplus hide blocks: 76
of those, the SOFT build gives the same block a style: 62
  would regain a SOUND : 50      <-- CustomAlertSound
  would regain an ICON : 1       <-- MinimapIcon
  would regain a BEAM  : 2       <-- PlayEffect
line-kind histogram: SetFontSize 62, SetBackgroundColor 58, SetTextColor 19,
                     SetBorderColor 3, CustomAlertSound 50, PlayEffect 2, MinimapIcon 1
```

Concrete case — `Currency/General.json`, Tier 8, Portal Scroll (order 56053). At soft it is `Show` + `SetFontSize 35` + `CustomAlertSound "Sharket掉落音效\知识卷轴.mp3" 300`. At regular it is `Minimal` with the style stripped. Relax the strip and the *hidden* Portal Scroll plays an alert sound. The proposal frames uniformity as safety (*"all 87 uberplus blocks move together"*); it is the hazard. This is precisely what `filterStyle.ts:129-136` warns about, and the proposal quotes that docstring without noticing it applies to its own fix.

### D3. "`blockText()` is the single line of code your proposal has to change" is false for path G.

Path G (Minimal → invisible `Show`) is the one §1 calls *"the find that matters"* and §5 says *"the answer is to stop emitting Minimal entirely"*. It requires:
- `webapp/frontend/src/utils/filterGenerator.ts:188` (`HIDE_CMD`) plus the three emission sites at **:481, :616, :688** (`isHide ? HIDE_CMD : "Show"`);
- an invisible style to emit — **which does not exist anywhere in the tree**. `styleOff()` (`filterStyle.ts:67`) gates individual channels; there is no hide-style concept. The live theme `filter_generation/data/theme/sharket/sharket_theme.json` has tier keys **0–6 only, no Tier 9, FontSize {40×123, 43×2, 45×57}, minimum 40** — the proposal states this itself in §4 and then forgets it in §3. The FS1/alpha-0 style would have to be synthesized in code.

Secondary: `DisableDropSound` is `simulatable: false` (`filter_generation/data/filter_conditions.yaml:143`), so the preview/simulator — same engine per ADR-0007 — could not render path G's result.

### D4. The test cannot distinguish "clamped to 18" from "clamped to 32", but hard-codes the answer.

Test file line 17: `SAME SIZE = clamped at 18`. But an absent `SetFontSize` paints **32** (`reference_poe_filter_format.md:41`, which the proposal cites in §2). If the floor is 32, blocks C (FS18) and D (FS1) render identically **and** identically to A — and the tester follows the instruction to conclude "clamped at 18". The comparison must be C and D against a known 32 reference. One is available (the trailing `Show / SetFontSize 32` catch-all applies to every other drop) and the instructions never mention it. Cheap fix, but as written Q2 is not answerable.

### D5. SCOPE MISS — the proposal proposes no gate at all, and leaves the author's named target untouched.

The author's words: *"mainly the rare item tiers"* and *"some low value currency up to sharpstone"*. The proposal changes no `hide_at_strictness`, touches neither `Equipment/Rare Equipment.json` nor `Currency/General.json`.

Measured at **uberplus**, the strictest level we ship:

```
#==[56050]- General -T7: 低价值通货 ... Blacksmith's Whetstone ...
Show
    BaseType == "Blacksmith's Whetstone"
    AreaLevel <= 82
    SetFontSize 40
    SetTextColor 0 0 0 255
    SetBackgroundColor 170 158 130 255
    CustomAlertSound "Sharket掉落音效\磨刀石.mp3" 300
```

"Sharpstone" — the author's explicit cutoff — is still a full-size opaque label **that plays a sound** at every one of the seven levels. Structural count: `Tier 7 General` carries `hideable: false` and **no gate**; the only gate in the file is `Tier 8 General` = 1 at line 341 (verified by Grep, one hit; the brief's figure is right). Trace confirms all six Tier 7 blocks are `is_hide=False` at uberplus while all four Tier 8 blocks are `is_hide=True`.

### D6. §3's causal claim is wrong.

*"That is also why the ladder 'barely moves': hiding in Ruthless does not clear the ground, it only removes decoration."* The ladder barely moves because **32 of the tiers carry a gate** (my structural walk over `filter_generation/data/tier_definition`: **32 tier-level gates, 0 rule-level gates**, matching the brief). Making `Minimal` invisible would change the appearance of 76 blocks and hide **zero additional items**. It cannot close a 14%-vs-56% thinning gap.

---

## CLAIMS THAT SURVIVED — what I tried and failed to break

I attacked the documentary half hardest and it held up; every figure below I re-measured.

**Catch-all guard (brief item 1).** Built all seven levels and ran the guard on each:
```
python parsing_tool/check_catchall_coverage.py out/refute/<L>.filter --check
→ curated bases lost: 0   equipment probes lost: 0
  [OK]   exit=0        (all 7 levels: soft, regular, semistrict, strict, verystrict, uber, uberplus)
```
Baseline is clean. The proposal's §6.3 claim that Minimal→Show is neutral to this guard is **correct and non-obvious**: `check_catchall_coverage.py:99` parses `Show`, `Hide` and `Minimal` as equal command words, so the command word genuinely does not affect coverage.

**Font-size histograms (§1)** — reproduced exactly: 3.29 Soft `18×9, 30×1, 35×29, 40×132, 45×540`; 3.29 Uber Plus `18×13, 30×1, 35×16, 40×51, 45×354`; `FilterBlade.ruthlessfilter` min **32**, 15 Minimal blocks carrying condition keywords only (AreaLevel/BaseType/Class/ItemLevel/Quality/Rarity — no style); `Sharket3.27[0]无情异界私货.ruthlessfilter` = **798 Show / 0 Hide / 0 Minimal**, `SetFontSize 1 ×13` at lines 2115, 2135, 2185, 8764, 8776, 8787, 8799, 9215, 9225, 10451, 10461, 11420, 11429.

**Theme claims (§4)** — reproduced exactly: `docs/design/handoff/theme-rungs-rev28.json` really is absent (it is in `_superseded/`); the string is at `theme-rungs-rev29.json:539` under `C_template_defects`; `docs/design/sharket_theme.json` = 99 categories, Tier 9 FontSize 30 on **all 99**, and **exactly 49** rows equal `{bg #000000ff, border #00000000, FontSize 30}`; live theme = 53 categories, min FontSize 40. §4's reading — that "Tier 9: FS18 translucent" is a designer **defect report**, not a recommendation — is correct and is a good catch against the brief's framing.

**Range claims (§2)** — correct: `grep -ri fontsize data/from_ggg/` → **0 hits**; `reference_poe_filter_format.md:41` states only the absent-key default 32; `parsing_tool/audit_visual.py:13` and `docs/design/reply-to-designer-03.md:156` both assert 18–45 with no source. The recommended docstring correction is legitimate.

**Code quote (§3)** — `filterStyle.ts:124–142` is verbatim correct. `DisableDropSound` is indeed absent from `STYLE_PREFIXES`, and 0 Minimal blocks emit it today.

**Brief items 3, 4, 5, 6 — no violation found.** The 3.27 blocks it cites really are `ItemLevel >= 60` / `>= 68` (read at lines 8756–8800); no AreaLevel/ItemLevel confusion. It never claims an item is "removed" and §6.1 explicitly forbids that phrasing. It gates no `hideable:false` tier because it gates nothing. It uses no `Continue`.

**Test file mechanics** — `C:\Users\shini\Documents\My Games\Path of Exile\minimal-visibility-test.ruthlessfilter` exists (7009 bytes, 2026-08-25), in the correct folder alongside the author's own `Sharket3.29无情_合同工版本V6.991.ruthlessfilter`. All ten `BaseType` values verified present in `data/source/cn-3.29/tables/English/BaseItemTypes.json`. Every operator carries its space. Bare `DisableDropSound` (no `True`) matches the author's own 13 shipped uses in the 3.27 file, so it is proven-loading — FilterBlade's `DisableDropSound True` is the other legal spelling.

---

## BOTTOM LINE

Keep §1, §2, §4 and the test file — the research is sound and the FS1-clamp question is genuinely unresolved and genuinely worth one screenshot. **Reject §3's fix** (D2: it un-mutes 50 blocks), **reject its cost estimate** (D3), **fix test line 17 before running it** (D4), and **do not let it substitute for the strictness work** (D5, D6): sharpstone still shouts at uberplus, and no font size will change that — only a gate will.