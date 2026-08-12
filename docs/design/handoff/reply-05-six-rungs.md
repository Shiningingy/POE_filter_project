# Reply 05 — the ladder is six rungs, and the tail is Sharket's

Last structural change, and it simplifies rather than adds. Driven by the same NeverSink
measurement as reply 04 plus the author's read on how it looked in practice.

## What changed

**There is no T6.** The ladder is **T0–T5**. Two moves:

- **T3 reverts to Sharket's mid-currency tan** `170 158 130`, black text. It was briefly
  `accent.deep` with accent text; that was worse and it is now back to his value.
- **T4 becomes Sharket's scroll look** — `80 80 80` plate, `accent.muted` text. His plate, promoted
  one rung.
- **T5 is the old T6** — `48 48 48`, `138 132 124`. The floor.

## Why this is the shape that works

Plate luminance now descends **twice and never doubles back**:

```
T2   accent.solid   plate ~176      the money plate
T3   accent.muted   plate ~158      Sharket's tan
T4   80 80 80       plate ~80       Sharket's scroll plate, accent survives as TEXT
T5   48 48 48       plate ~48       the floor
```

The key move is that **the accent leaves the plate at T4.** Everything above T4 is coloured by the
category; T4 and T5 are house greys that merely carry a tinted label. That is why the bottom stops
competing with the top — and it is Sharket's own instinct, not something I invented.

## What this retires on your side

On top of reply 04's list: **the entire T6 row**, and `accent.muted_deep` stays retired. An accent
still authors exactly two colours (`solid`, `deep`) — `deep` is now used only by `rarity_through`
at T3, and `muted` is derived as before.

## ⚠️ Both goldens are regenerated in this drop

- **currency** now uses **T0–T4 and skips only T5** (no floor below scrolls). T3 is Sharket's tan
  again, T4 is his scroll plate — so two of the five rungs are byte-identical to the filter you
  ship today, which is a better test than the version I sent you.
- **essences** maps `low → T4`, not T5.

## Also updated: `rung_by_depth`

Both templates in `accent-category-map.json` are rewritten for six rungs, and the 11 overrides with
them. Nothing references T6.

## Unchanged

Rank direction, 23 accents, `equipment` shared by all gear, Heist split, per-file depth mapping,
maps as plain `rarity_through` + icon colour by map tier, Jewels on one accent, Fractured off Body
Armours, `state_budget` as a validator error, T0 text = `accent.t0_text ?? accent.solid`, no rung
sets a border.
