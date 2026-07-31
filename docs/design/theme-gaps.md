# Theme gaps — what's left after porting the export

Your `sharket_theme.json` is **ported and live** (52 → 98 keys), the filter regenerates
on it, and the dual-generator parity test passes 16/16. Thanks — the bulk of it landed
cleanly.

What follows is only the remainder. It splits into **our work** and **yours**, and the
list of ours is longer than the list of yours.

---

## 0. First, a correction to the handoff

§3 says an unauthored tier *"falls back to `Default` silently"*. It does not, and the
real behaviour is worse in a way that's useful to know:

```python
theme_ref = theme_data.get(theme_cat_key, theme_data.get("Default", {}))   # category miss -> Default
ttheme    = theme_ref.get(f"Tier {tnum}", {})                              # tier miss    -> {} , no fallback
```

A missing **category** does fall back to `Default`. A missing **tier row inside a
category that exists** falls back to nothing — `ttheme` is `{}`, and `parse_rgba(None)`
returns white. The block emits:

```
    SetTextColor 255 255 255 255
    SetBorderColor 255 255 255 255
    SetBackgroundColor 0 0 0 255
```

White text, white border, black plate, default size. **49 blocks** in the current filter
look like this. So the failure is loud, not silent — which is the one good thing about
it, and why this list is short and specific rather than "something looks off".

## 1. Why anything is missing at all

The export was made against an older snapshot of the tree. Since then Corpses and
Wombgifts were restored, Crafting Priority was rewritten, and the Heist, Cluster Jewels
and Allflame ladders changed shape. **Nothing below is a mistake in your export** — the
tree moved underneath it.

---

## 2. Done already: three retags that needed no design work

You authored `Curse of the Allflame`, `Enshrouding Crystals` and `Incursion Vials`. All
three sat in the "authored but unused" pile because the tree still tagged those files
`Stackable Currency` — in fact the `base_mapping` half of each pair *already* named your
key correctly, and only the `tier_definition` half was stale, which is the one the
generator reads. This is exactly the retag you recommended in §0, and it resolved
**all four** Stackable Currency holes with no new values (53 → 49 blocks, zero Allflame
blocks left failing):

| file | tags today | should tag | your key already has | covers |
|---|---|---|---|---|
| `Curse of the Allflame/League Items.json` | `Stackable Currency` | `Curse of the Allflame` | T1–T6, T9 | T1, T3, T4, T6 ✅ |
| `Currency/Enshrouding Crystals.json` | `Stackable Currency` | `Enshrouding Crystals` | T2, T9 | T2 ✅ |
| `Currency/Incursion Vials.json` | `Stackable Currency` | `Incursion Vials` | T2, T9 | T2 ✅ |

This also fixes the *"they'd all look identical"* problem you flagged, and it's the
reason the league-violet 278° move was the right call.

**No action needed from you.** Listed so you know those four rows are already handled,
and because it confirms the retag argument in your §0 was right.

---

## 3. Yours: 15 rows

These are `theme_category × Tier N` rows the generator asks for and the file doesn't
answer. Counted as **rows**, not tier keys — several tier keys share one row (all four
Crafting Priority ladders resolve to `Crafting Bases` T0, and all three Jewels files
resolve to `Jewels` T0).

One thing to be aware of: **a tier key's name does not predict its number.** An explicit
`theme.Tier` overrides the label, so `Tier 5 General` resolves to **T7**, `Tier 3 Cluster
Jewels` to **T5**, and `CustomTier 4 Curse of the Allflame` to **T3**. The Tier column
below is the resolved number — the only one that matters to you.

### `Corpses` — authored T2, T5, T9

| Tier | what it is | blocks | sits |
|---|---|---|---|
| **T1** | 顶级尸体 — top corpses | 1 | above T2 |
| **T3** | 常用尸体 — common corpses | 1 | between T2 and T5 |
| **T4** | 低价值尸体 — low-value corpses | 1 | between T2 and T5 |

Red band, 350°/26 per §5. A 3-rung interior between an authored T2 and T5.

### `Crafting Bases` — authored T1–T5, T9

| Tier | what it is | blocks | sits |
|---|---|---|---|
| **T0** | the apex crafting rung, shared by four ladders | 27 | above T1 |

The loudest single gap in the filter. The four tier keys that resolve here are
超额品质底材 (over-quality), 完美防御数值 (perfect defence), 追忆武器底材 and
追忆防具/首饰底材 (memory-strand weapons / gear). These are the three properties the
player told us are *"extremely valuable"*, so T0 wants the apex treatment.

### `General` — authored T0–T5, T9

| Tier | what it is | blocks | sits |
|---|---|---|---|
| **T6** | 改造石级 — alteration-tier currency | 6 | between T5 and T9 |
| **T7** | 低价值通货 — low-value currency | 5 | between T5 and T9 |

The quiet end of the main currency ladder. This is the case your §3 reserved rungs were
designed for — T8/T12 exist for exactly this shape, so T6/T7 may just be the rows above
them on the same lightness walk.

### `Heist Blueprints` / `Heist Contracts` / `Heist Currency` — each authored T1, T2, T9

| category | Tier | what it is | blocks |
|---|---|---|---|
| `Heist Blueprints` | **T0** | 附魔蓝图 — enchanted blueprints | 1 |
| `Heist Contracts` | **T0** | 附魔/欺诈契约 — enchanted / deception contracts | 2 |
| `Heist Currency` | **T0** | 大量印记 — large markers stack | 1 |

All three are the same shape: an apex rung above an authored T1. Note the first two are
the **enchant bias** — your §1 gives enchanted its own state hue (`70 200 235`), so these
may want to be a state border on T1 rather than a T0 row. Your call; either works, we
just need one of them.

### `Heist Equipment` — authored T1, T2, T9

| Tier | what it is | blocks | sits |
|---|---|---|---|
| **T0** | 赏金猎人装备 — apex heist gear | 0 | above T1 |
| **T3** | 赏金猎人装备 — third rung | 0 | between T2 and T9 |
| **T4** | 基础装备 — base heist gear | 1 | between T2 and T9 |

Two of these emit nothing today (the tiers exist but hold no items yet), so they're
lower priority — but they'd break the moment the category is populated.

### `Jewels` — authored T1, T2, T3, T4, T9

| Tier | what it is | blocks | sits |
|---|---|---|---|
| **T0** | apex jewels — shared by abyss / base / cluster | 1 | above T1 |
| **T5** | 低阶群集珠宝 — low cluster jewels | 1 | between T4 and T9 |

### `Wombgifts` — authored T1, T2, T3, T9

| Tier | what it is | blocks | sits |
|---|---|---|---|
| **T5** | 其余孕育赠礼 — the class-condition catch-all | 1 | between T3 and T9 |

---

## 4. Yours: two categories with no key

These fall to `Default`, so they render as generic gold — wrong, but not white-on-black.

| theme_category | declared by | tiers used |
|---|---|---|
| `Influenced` | `Equipment/Special/Influenced.json` | T0, T1, T9 |
| `Magic Net` | `Equipment/Magic Net.json` | T4, T5, T9 |

**`Influenced` has drifted since you wrote §2.** It no longer declares `Body Armours` —
it has its own `theme_category` now, which means the collision you described is partly
resolved and influence is currently a *category*, not a state. Your §2 argues it should
be a state border (`150 0 255`, enhanced or swap). We'd rather take your recommendation
than guess: **category rows, or state border?** If state, `Influenced` stops needing a
key at all.

`Magic Net` is the two-stage magic-hide ladder — T4 keeps good jewellery alive, T5 kills
the rest. Mostly a suppression rung, so it wants to be quiet rather than styled.

---

## 5. §7 re-checked — three of four are already fixed

Worth knowing so you don't spend time on them:

| your note | status today |
|---|---|
| `Misc/General.json` points at `Thrusting One Hand Swords` | ✅ **fixed** — now declares `Quest Items`. That's why `Thrusting One Hand Swords` shows as unused. |
| `Gems/Skill.json` `tier_order` is only T0/T1/Hide | ✅ **fixed** — now T0, T1, T2, T3, T4, Net, Hide. Support Gems has T0, T1, T2, Net, Hide and a theme. |
| `Gems/Skill.json` inline `theme` "bypasses the theme file" | ⚠️ **not quite** — inline colours don't bypass anything, they're *silently discarded*. The generator reads only `theme.Tier` from a tier and takes every colour from your file. So the hardcoded cyan and the malformed `MinimapIcon: "CyanCircle"` are dead weight, not a conflict. We'll delete them. |
| `Maps/Scarabs.json` shares `Map Fragments` | ❌ **still true** — scarabs and fragments are indistinguishable. Wants its own key. |
| all three `Jewels/*.json` share `Jewels` | ❌ **still true** — abyss / cluster / base look identical. |
| `Equipment/Special/Synthesised.json` | ➖ **gone** — synthesised rares no longer drop, file deleted. Drop it from §2. |
| `Equipment/Special/Fractured.json` declares `Body Armours` | ❌ **still true** — a fractured bow renders as body armour. |

---

## 6. Not ported, and why

§1 state borders and §3 reserved rungs are **rule-level**, not expressible as
`theme_category × Tier N`, so nothing was ported from them. They're real work against the
corrupted / enchanted / linked / influenced rules rather than a file copy, and they're
queued separately. The values are recorded and nothing is lost.

`arc_theme.json` is kept in the repo as the derivation source, per its own `_about`:
regenerate from it rather than hand-editing the output.

---

## Summary

| | count |
|---|---|
| rows already resolved by retagging | 4 |
| **rows we need from you** | **15** |
| **categories we need from you** | **2** (one is a design question) |
| §7 items already fixed | 3 |
| §7 items still open | 3 |
