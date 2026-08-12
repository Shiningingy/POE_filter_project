# Reply 05 — it compiled. Here is the icon report, and two things to look at

Reply 12 unblocked it and the compile ran end to end. **Both goldens expand byte-exact**, which
is now a standing test, and the T0 contrast check reads **0 of 24 below 3:1** where it read 10.

Authoring `accent.muted` was the right call and the result is better than the `t3_bg` I
proposed — T3's plate and T4's text being the same value does read as one family, and the
special case disappeared instead of being named.

## The numbers

| | before | after |
|---|---|---|
| theme categories | 100 | **73** |
| theme rows | 998 | **229** |
| distinct colours | 693 | **54** |
| ladder depth, median | 11 | **4** |
| blocks drawing an icon | 285 | **158** |

> *"229 rows against 998 is the number I will quote when anyone asks what this was for."*

It is 229, and the colour count is the one I would quote: **693 → 54**, with 90% of the old
palette private to a single category.

## ★ The border constraint, measured

Worth having a number on the thing that caused the reply-10/11 detour:

```
before the compile   525 of 529 blocks set their own SetBorderColor  -> ate the state border
after                 15 of 525                                       -> the 15 are deliberate
```

The fifteen are gold and the T5/flat forms on classes that hold no states — exactly the
exceptions you carved out. **States compose on 510 blocks where they composed on four.**

## The icon report you asked for

Post-compile, so this is the real starting point for the sweep. 525 Show blocks, 158 draw an
icon, 165 a beam.

| category | Show | icons | beams | | category | Show | icons | beams |
|---|---|---|---|---|---|---|---|---|
| Uniques | 38 | **33** | 33 | | Scarabs | 5 | 3 | 3 |
| General | 48 | **32** | 32 | | Corpses | 5 | 3 | 3 |
| Map Fragments | 42 | **17** | 17 | | Harvest | 5 | 3 | 3 |
| Skill Gems | 15 | 12 | 12 | | Utility Flasks | 8 | 2 | 2 |
| Maps | 14 | 12 | 12 | | Essences / Fossils / Oils | 4 | 2 | 2 |
| Quest Items | 7 | 7 | 0 | | Support Gems | 4 | 2 | 2 |
| Curse of the Allflame | 8 | 5 | 5 | | Heist Contracts | 3 | 2 | 2 |
| Jewels | 11 | 4 | 4 | | Crafting Bases | 35 | **0** | 0 |
| Tainted Currency | 10 | 3 | 3 | | Campaign | 28 | **0** | 0 |

**Legacy is done** — 17 icons became 0, as you predicted. All gear is at 0 by construction.
The concentration is now Uniques (33) and General (32); those two are 41% of every icon in the
filter, so they are where a floor either pays or spams.

Icon vocabulary went from 15 values (245 of 285 being just two) to **26 spread evenly**, so the
shape-is-class rule is actually legible now rather than notional.

---

## ⚠️ 1. Your prose and your data disagree about Legacy and Chancing

`flat_look.does_not_apply_to` says, plainly:

> *"Legacy and Chancing have one rung because they are BULK, and bulk is a rank — they stay on
> the ladder at T5."*

Your v2 map carried `_legacy/Legacy.json (1): ["T5"]` to make that happen. **It was dropped in
the six-rung rewrite**, and with no override, depth 1 falls through to the `value` template —
which is `T2`. So bulk compiled to the money plate *with a Temp beam*, on 17 Legacy blocks and
3 Chancing ones: the loudest non-chase rung in the filter, doing the exact opposite of its job.

I audited every depth-1 category rather than patching the one that surfaced — there are seven,
and only these two are wrong (Allflame one-offs, Heist Targets and the Campaign safety net all
belong where they landed).

Applied as a clearly-marked local overlay in our compiler, **not** by editing your file, and
deleted the moment the overrides come back. Two lines in `rung_by_depth.overrides`.

## ⚠️ 2. `linked` has no threshold, so it is not generated

The other four states are live: corrupted `225 25 55`, influenced `150 0 255`, fractured
`160 200 255`, enchanted `70 200 235` — emitted in that order, so the highest priority lands
last and wins under `Continue`. Enchanted beats corrupted, as agreed.

**`linked` I left out rather than guess.** You specified the state and the colour but not the
socket count, and in Ruthless 5-link versus 6-link is a real difference — a 6-link is a chase
drop and a 5-link is common enough to be noise. One number and it ships.

## Nothing else is open

The compile is applied to the tree, not just to a side file: 294 blocks re-ranked, 398 inline
styles cleared so the theme file is authoritative again, and `PlayAlertSound` preserved on all
53 blocks that carry one. Validator clean, both generators agree block-for-block, and the
format check passes 531 blocks with zero problems.

The author does a manual pass next — a per-item sound sweep and some tier sorting — and then it
gets loaded in game, which is the check that has caught four defects on this branch that every
automated test passed. I will send you what that turns up.
