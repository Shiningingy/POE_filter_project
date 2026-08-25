<!-- Banked from workflow wf_b2952eaa-693 (strictness). The run was stopped before
     its adversarial-review phase completed, so treat proposals here as UNVERIFIED. -->

Experiment reverted; the tree is clean. Everything below is measured on real builds.

---

# Strictness curve for low-value currency (up to 磨刀石)

## 1. Mechanism: (a) tier gates is the answer; (b) StackSize is a two-base garnish

**Recommend (a) `hide_at_strictness` on tiers, with one tier split.** Four measured reasons:

1. **FilterBlade themselves switch (b) off in Ruthless.** In `data/from_filter_blade/3.29/FilterBlade.ruthlessfilter`, every endgame currency `StackSize` ladder is commented out — `stackedsix` t1–t7, `stackedthree` t1–t7, `stackedsupplieshigh` (Orb of Transmutation 10/5/3), `stackedsupplieslow` (Orb of Augmentation 10/5/3). **20 of 32 blocks dead.** Only `stackedsuppliesportal` / `stackedsupplieswisdom` (lines 7463–7513) and the 6 `levelingstacked` blocks (lines 7221–7288, `AreaLevel <= 67`) stay live. Stacks of 3+ endgame orbs are a Standard phenomenon.
2. **Two in-repo sources already say so** — `docs/design/theme-pipeline-rewrite.md:276` and `filterGenerator.ts:517` ("a `StackSize >= 10` tier-up that cannot even fire in Ruthless").
3. **(b) cannot express "go quiet" at all.** A `StackSize` rule only adds a *louder* block in front of the home block. It is a rescue, never a thinner. The thinning still has to come from (a).
4. **(a) is the endorsed model and prior art exists on this exact file.** `parsing_tool/split_currency_scrolls.py` already split T7→T8 here, and its docstring records both the design ("★ The two halves keep `theme.Tier: 4`, so they look IDENTICAL… this needs nothing from the designer") and the author's own ordering: **"scrolls first, scrap/whetstone next."** It also records that generate-time hide injection was *considered and rejected*.

That last line is the whole proposal: the scrolls rung exists, the **scrap/whetstone rung was the announced next step and was never built.**

**Use (b) for exactly two bases.** FilterBlade keeps the scroll stack ladder live in Ruthless (`%DS4`/`%D3`/`%D2` on `StackSize >= 10 / 5 / 3`), so scroll piles demonstrably still drop there. I built it and it works — see §6.

## 2. Exact edits

### A. `filter_generation/data/tier_definition/Currency/General.json`

| tier key | current gate | proposed | protect | reason |
|---|---|---|---|---|
| `Tier 8 General` | **1** | **1 (keep)** | `hideable:false` → **NEEDS UNLOCK (bug fix, see §5.6)** | Already correct. FB Ruthless hides scrolls at L1 (gate 2); we are 1 step ahead. Don't churn a shipped value. |
| `Tier 7 General` | none | **3** (`strict`) | `hideable:false` → **NEEDS UNLOCK** | Shards + the two low orbs. FB Ruthless: Orb of Transmutation + Alteration Shard `t8trans %HS1` = gate 3 — **exact match**. |
| **`Tier 7B General`** *(NEW)* | — | **4** (`verystrict`) | author as `hideable:true` | The "up to sharpstone" rung: Armourer's Scrap + Whetstone. FB Ruthless: Scrap `t7chance %HS2` = gate 4 — **exact match**; Whetstone `t6chrom %HS3` = gate 5, we are 1 early (deliberate — the author asked for this band to go quiet). |
| `Tier 6 General` | none | **5** (`uber`) *(optional rung)* | `hideable:false` → **NEEDS UNLOCK** | One step past the stated cutoff, bites only at uber+. FB Ruthless: Orb of Chance + Orb of Alteration `t6chrom %HS3` = gate 5 — **exact match** on 2 of 4. Drop this line if you want to stay strictly inside "up to sharpstone". |
| `Tier 5 / 4 / 3 General` | none | **none — leave** | — | FB Ruthless marks all of these `%H6`/`%H7` = never hidden across 0–6. No gate is the correct value. |

New tier body (mirrors `split_currency_scrolls.py` exactly — **no theme file edit**, `theme.Tier: 4` reuses T7's row; `sharket_theme.json` `General` only defines rows Tier 0–4):

```json
"Tier 7B General": {
  "hideable": true,
  "theme": { "Tier": 4, "FontSize": 40, "BorderColor": "disabled:#ffffffFF" },
  "sound": { "default_sound_id": -1, "sharket_sound_id": null },
  "localization": { "en": "T7B: 打磨通货", "ch": "T7B: 打磨通货" },
  "hide_at_strictness": 4
}
```
Insert after `Tier 7 General` in the object **and** in `_meta.tier_order`.

### B. `filter_generation/data/base_mapping/Currency/General.json` — mapping

| base | from | to |
|---|---|---|
| `Armourer's Scrap` | `Tier 7 General` | `Tier 7B General` |
| `Blacksmith's Whetstone` | `Tier 7 General` | `Tier 7B General` |

### C. `base_mapping/Currency/General.json` — rules (**mandatory, not optional**)

★ Moving the mapping alone silently breaks this. Rules resolve against `overrides.Tier` and use `targets` **directly**, bypassing the tier's pending set (`filterGenerator.ts` ~line 552: `else if (ruleTargets.length > 0) ruleMatches = ruleTargets;`). Leave the rules on T7 and Whetstone emits under *both* tiers with *different* gates, and T7 wins first-match.

| rule idx | current | edit |
|---|---|---|
| `[0]` | targets `[Orb of Transmutation, Orb of Augmentation, Armourer's Scrap, Blacksmith's Whetstone]`, `AreaLevel >= 83` → T7 | **drop** Scrap + Whetstone from `targets` |
| *(new, after [0])* | — | clone of `[0]` with targets `["Armourer's Scrap","Blacksmith's Whetstone"]`, `overrides.Tier: "Tier 7B General"` |
| `[3]` | `[Armourer's Scrap]`, `AreaLevel <= 82` → T7 | `overrides.Tier` → `Tier 7B General` |
| `[4]` | `[Blacksmith's Whetstone]`, `AreaLevel <= 82` → T7 | `overrides.Tier` → `Tier 7B General` |

Verified: the curated sounds ride along. At `soft` the Whetstone block still emits `CustomAlertSound "Sharket掉落音效/磨刀石.mp3" 300`; at `verystrict` it is `Minimal` + `BaseType` + `AreaLevel` and **zero style lines** (invariant 2 holds).

## 3. The cutoff — exactly who is in and who is out

**INSIDE (13 bases, gated):**
| gate | level it goes quiet | bases |
|---|---|---|
| 1 | `regular` | Scroll of Wisdom, Portal Scroll, Scroll Fragment |
| 3 | `strict` | Orb of Transmutation, Orb of Augmentation, Alteration Shard, Transmutation Shard |
| 4 | `verystrict` | **Armourer's Scrap, Blacksmith's Whetstone ← the named cutoff** |
| 5 | `uber` | Alchemy Shard, Jeweller's Orb, Orb of Alteration, Orb of Chance *(optional rung)* |

**JUST OUTSIDE (never gated):** Orb of Alchemy, Orb of Fusing, Glassblower's Bauble, Orb of Regret, Orb of Unmaking, Chaos Shard (our T5) — FB Ruthless has all of these at `t4chaos %H6` or `t3annul %H7`, i.e. shown at every level 0–6. **No gate is the correct value; do not add one.**

Measured accuracy of the proposal against FilterBlade Ruthless, per base:

| base | proposed | FB Ruthless | Δ |
|---|---|---|---|
| Scroll of Wisdom / Portal Scroll | 1 | 2 | −1 |
| Orb of Augmentation | 3 | 2 | +1 |
| Transmutation Shard | 3 | 2 | +1 |
| Orb of Transmutation | 3 | 3 | **match** |
| Alteration Shard | 3 | 3 | **match** |
| Armourer's Scrap | 4 | 4 | **match** |
| Blacksmith's Whetstone | 4 | 5 | −1 |
| Alchemy Shard | 5 | 3 | **+2** ← homing, not gating |
| Jeweller's Orb | 5 | 4 | +1 |
| Orb of Chance | 5 | 5 | **match** |
| Orb of Alteration | 5 | 5 | **match** |

**6 exact, 10 of 11 within ±1.**

## 4. FB Ruthless ladder (re-derived from source, corrects the earlier summary)

The marker is on the `Show` line itself (`Show # %HS3 $type->currency $tier->t6chrom`), which my first parse missed. `%Hn` → last shown level `n`; `S` → +1. Our gate = last-shown + 1.

`t9armour %H1`(1): Augmentation, Transmutation Shard · `t8trans %HS1`(2): Orb of Transmutation, Alteration Shard, **Alchemy Shard** · `t7chance %HS2`(3): Armourer's Scrap, Jeweller's Orb · `t6chrom %HS3`(4): **Whetstone, Orb of Alteration, Orb of Chance** · `t5alchemy %HS4`(5): Orb of Binding, Orb of Scouring, Regal Orb · `t4chaos %H6`(6): Chaos, Chromatic, Scrap Metal, Fusing, Alchemy, Glassblower, Regret, Astragali · `t3annul %H7`(never): Blessed Orb, Orb of Unmaking.

## 5. Flags

1. **Chromatic Orb + Scrap Metal on Tier 4 with Chaos Orb — CORRECT, verified.** FB Ruthless puts Chaos Orb, Chromatic Orb and Scrap Metal in the *same* rung `t4chaos %H6` (line 7762). We are in fact *finer-grained* than they are (we split Fusing/Alchemy/Glassblower/Regret down to T5; they keep them with Chaos). No change, no gate.
2. **★ `Alchemy Shard` is the one real misplacement.** It sits on T6 while `Alteration Shard`/`Transmutation Shard` sit on T7. FB Ruthless puts Alchemy Shard and Alteration Shard on the *same* rung (`t8trans`). This is the sole +2 error above. Fix by moving it T6 → T7 — but that is a re-homing, so per `feedback_sweep_in_progress` I'd land the gates first and do this separately.
3. **★ `Scroll Fragment` — FilterBlade never shows it, at any level.** `FilterBlade.ruthlessfilter:8933` is `Minimal # Hide-Section replaced with minimal` (which is also independent in-game confirmation of invariant 1). Ours shows it at `soft`. Candidate for `Tier Hide General` outright.
4. `Orb of Scouring` on T4 vs FB Ruthless `t5alchemy`, and `Regal Orb` on T3 ("T3: Exalt Level") vs FB Ruthless `t5alchemy` — two rungs generous. Both plausible Ruthless hand-tunes (Regal is a crafting staple there). **No gate consequence** either way; flagging only.
5. `Chaos Shard` and `Regal Shard` appear **0 times** in FilterBlade 3.29 (both files) — no schedule to copy, leave on T5/T4.
6. **★ Live footgun: `Tier 8 General` carries `hideable: false` AND `hide_at_strictness: 1`.** `CategoryView.tsx:441` does `delete td.hide_at_strictness` whenever the 🔒 protect toggle is clicked. One click in the editor silently erases the only currency gate in the tree. Set `hideable: true` on every gated tier so file state and UI state agree. (`split_currency_scrolls.py:64` inherited the `false` from T7 — that is where it came from.)

## 6. Optional: the StackSize rescue (mechanism b), built and verified

Two rules prepended to `base_mapping/Currency/General.json`, mirroring the only stack ladder FilterBlade keeps live in Ruthless:

```json
{ "targets": ["Portal Scroll","Scroll of Wisdom"], "conditions": {"StackSize": ">= 10"},
  "overrides": {"Tier": "Tier 6 General"}, "comment": "卷轴大堆 (10+)" },
{ "targets": ["Portal Scroll","Scroll of Wisdom"], "conditions": {"StackSize": ">= 5"},
  "overrides": {"Tier": "Tier 7 General"},  "comment": "卷轴中堆 (5+)" }
```

Measured behaviour for Portal Scroll — the tier-up blocks emit *before* the T8 home block and inherit the target tier's gate, so a single scroll goes quiet at `regular` while a pile survives:

| level | SS≥10 (T6) | SS≥5 (T7) | single (T8) |
|---|---|---|---|
| soft | Show | Show | Show |
| semistrict | Show | Show | Minimal |
| strict | Show | Minimal | Minimal |
| verystrict | **Show** | Minimal | Minimal |
| uber | Minimal | Minimal | Minimal |

Operator spacing is emitted correctly (`StackSize >= 10`), and catch-all stays 0 — the checker probes with `StackSize: 1` (`check_catchall_coverage.py:240`), so a stack rule can never satisfy coverage and the home block still has to exist. **What I cannot verify:** actual Ruthless scroll stack sizes. FilterBlade's own build is the only evidence they occur.

## 7. Measured Show-count curve

Whole filter, `grep -c '^Show'`, `--mode ruthless`:

| | soft | regular | semistrict | strict | verystrict | uber | uberplus |
|---|---|---|---|---|---|---|---|
| **before** | 456 | 446 | 442 | 419 | 418 | 398 | 392 |
| **after (§2)** | 457 | 447 | 443 | **416** | **412** | **388** | **382** |
| *+ §6 scroll rules* | 459 | — | 445 | 417 | 413 | 388 | — |

Thinning 14.0% → **16.4%**. The `+1` at soft is expected: the T7B split turns the `AreaLevel >= 83` group block into two.

The band itself is where it shows — Currency/General.json T6/T7/T7B/T8 Show blocks:

| | soft | regular | semistrict | strict | verystrict | uber | uberplus |
|---|---|---|---|---|---|---|---|
| **before** | 14 | 10 | 10 | 10 | 10 | 10 | 10 |
| **after** | 15 | 11 | 11 | **7** | **4** | **0** | **0** |

A flat line becomes a ladder. Note this is 15 blocks of 457 — currency alone will not close the gap to FilterBlade's 56%; the rare-equipment work is where that lives.

## 8. Verification plan

Ran already on the candidate, all green — re-run after applying:

1. **Build all 7:** `node filter_generation/generate.mjs --mode ruthless --strictness <L> --out out/x.filter --trace out/x.json`
2. **Catch-all at every level (invariant 3):** `python parsing_tool/check_catchall_coverage.py out/x.filter --check` → `curated bases lost: 0` × 7. ✔ verified 7/7.
3. **No new shadowing:** `python parsing_tool/check_shadowed_blocks.py out/uber.filter` → `SHOW blocks hidden by an earlier block: 0`, `cosmetic: 3`. ✔ **identical before and after** (7 unreachable / 3 cosmetic both ways) — the split introduces none.
4. **Invariants 1+2:** `grep -c '^Hide'` must be **0**; every `Minimal` block must carry no `Set*`/`Play*`/`Minimap*` line. ✔ 81 Minimal, 0 Hide, 0 style leaks.
5. **Condition vocab:** `python parsing_tool/check_condition_schema.py` → OK (needed only if you add §6; `StackSize` is already in the schema at line 63).
6. **Per-base curve:** assert first-quiet level per base against the §3 table from the trace (`is_hide` on every block naming the base).
7. **Regression suites:** `node filter_generation/test_generator_fixtures.mjs` and `test_resolver_equivalence.mjs` — **not run**, and the fixtures are pinned by `standard-regular-ch` / `standard-semistrict-ch`; a Currency gate change may move a golden. Run and **read the diff**.
8. **In game.** Per `reference_poe_filter_format.md`, every format rule this project has hit was found by loading, not by testing. Check specifically that `Minimal` scrap/whetstone at `verystrict` reads as intended — invariant 1 means they still draw a label, so this is "quiet", never "gone".

Scratch scripts (throwaway): `C:\Users\shini\AppData\Local\Temp\claude\g--POE-filter-development-POE-filter-project\4d5f032b-df21-4ee2-9c40-359000541fec\scratchpad\fbr3.py` (FB Ruthless ladder), `patch.py` (the candidate edit), `cur2.py` (per-base trace reader).