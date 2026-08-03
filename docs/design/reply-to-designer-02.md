# Reply 02 — the goldens ran, and they found two things

Did exactly what §goldens asked: implemented the transforms as a pure function and expanded
`currency` and `essences`.

**`currency` reproduces byte for byte — all five rungs, every channel.** Text, plate, alpha,
icon, beam, size. So the transform language is unambiguous and we read it the same way:
`@ alpha`, `accent.deep lightened/darkened X`, `accent.solid mixed X toward white`,
`accent lerp(solid,deep,X)`, `black_or_white_by_luminance`, icon = rung size + rung colour +
accent shape, beam = accent colour + rung persistence, `bg_<accent>` beating `bg`. Nothing
there needs another pass.

Two things do.

---

## 1. ⚠️ The two goldens disagree about T0's text

```
T0 recipe        painted.text = "255 0 0"   house_fixed: true
currency accent  solid = "255 170 0"    golden T0.text = "255 0 0"     <- house red
essences accent  solid = "60 130 255"   golden T0.text = "60 130 255"  <- the accent
```

Currency's T0 follows the house-fixed recipe. Essences' T0 is its own accent, exactly.
Both cannot be right, and it is not a rounding question — it is red versus blue on the
loudest rung in the filter.

Which did you mean?

- **(a) T0 text is house-fixed red everywhere.** Then the essences golden is wrong and
  `T1 special` essences read red-on-white like a mirror drop. Simple, and "this ends the
  run" looks identical everywhere — which is the stated reason T0/T1/T6 are house-fixed.
- **(b) T0 text is `accent.solid`, plate stays white.** Then the recipe's literal
  `"255 0 0"` is currency's own value that leaked into the house row, and every family's
  chase drop is its own hue on white. Currency still lands on red only if its T0 text is
  overridden — but currency's accent is orange, so it would need an explicit exception.

We would guess (b), because a per-accent T0 is what makes essences' golden self-consistent
and the recipe's other house-fixed rungs (T1 plate `210 0 0`, T6 `150 145 138`) are plainly
house values while `255 0 0` is not obviously one. But guessing the loudest rung in the
filter is not a thing we should do — one line from you settles it.

## 2. `accent.muted` and `accent.muted_deep` are undefined

T3 is the only rung that uses them, and it uses them for both variants:

```
T3 painted.bg        = "accent.muted @ 230"
T3 rarity_through.bg = "accent.muted_deep @ 230"
```

An accent supplies `solid`, `deep`, `shape`, `beam`, `icon_floor` (plus `text`/`border`/
`plate`/`icon_colour` on the exception rows). There is no `muted`, and unlike `lightened`
/ `darkened` / `mixed toward white` there is no operation attached — so it cannot be
derived the way the rest can.

It went unnoticed in the golden run only by luck: currency's T3 uses its `bg_currency`
override, and the essences golden happens to skip T3. Every other family's T3 needs it,
and T3 is "situational / bulk" — a lot of rows.

Either a formula (`solid` desaturated toward grey by X? `lerp(solid, deep, X)` as T4 does
at 0.72?) or two more values per accent. A formula is better for us: 23 accents ×2 hand
values is 46 more things to keep in step, and the rest of the system already derives.

---

## Everything else from reply 02 is settled and being built

- **Rank direction** — building it your way: emit corrupted(5) → linked(4) → influenced(3)
  → fractured(2) → enchanted(1), highest priority last so it wins the border under
  `Continue`. Comment at the emit site, as you suggested.
- **`equipment` accent shared by all ~30 gear classes, no icon, no beam** — understood, and
  it is the single change that makes the gear side coherent. Good catch on
  `rarity_through` still needing `accent.deep` for its plate; we had read the absence as
  "gear needs no accent" and would have compiled a hole.
- **Heist split** — no objection. Heist Equipment / Experimented reading as gear rather
  than as the mechanic's own drops is right, and it matches how we just retiered them.
- **`_tier_to_rung` by ladder depth, per FILE** — the per-file correction matters: our
  category counts are aggregates (Jewels' "11 rungs" is really 3+1+7 across three files),
  and a depth rule applied to the aggregate would have mis-mapped all three. Noted in the
  compiler.
- **maps** — collapsing to plain `rarity_through` + keep `maps.deep` plate + icon colour
  from map tier is simpler than §8.3 and we will treat that paragraph as superseded.
- **Jewels one accent, Fractured off Body Armours, keep both ladder and border** — agreed
  on all three; the ladder/border division of labour is exactly how we had it.
- **`state_budget` as a constraint** — will be a validator error, not a warning: a state
  border reaching a category with an empty budget means a condition leaked. Currency,
  fragments, scarabs and div cards must never carry one.
