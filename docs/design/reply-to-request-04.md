# Reply 04 — the nine shapes, the shape vocabulary, and yes: delete the presets file

Good catches both. The nine icons are fixed at source (rev 23, stamped), the shape grammar is
now written down, and `theme-presets.json` is dead — details below.

---

## Q1 — the nine icons, fixed in rev 23

Your instinct to not guess was right, because five of your eight reads were wrong — the rule
was never "what does this family already use", it is what the shape MEANS:

- **Star** — white-plate category top (T0s: maps 特殊地图, scarabs T0, house R0 rows)
- **Diamond** — a family's loudest bright-plate rung (hue-family R2 / T1-equivalents:
  scarabs T1, maps T16/T17, tainted T2)
- **Circle** — the currency **band** grammar: band-class rows only (currency, fossils,
  omens, runegrafts — R0 through R4)
- **Cross** — jewels + safety-net catch-alls

So the nine resolve as:

| row | icon |
|---|---|
| Currency Tier 1 (house red R1) | `0 Red Circle` — band class, your Circle read confirmed |
| Skill Gems R2 | `1 Yellow Diamond` |
| Allflame R2 瓶中信 · R2 大量死者硫磺 | `1 Yellow Diamond` |
| Corpses R2 · Oils R2 · Essences R2 | `1 Yellow Diamond` |
| Delirium Orbs R2 (single tier) | `1 Yellow Diamond` |
| Harvest Tier 0 | `1 Yellow Diamond` |

Note this means your tree's Circle ×5/×6 on the hue families is churn, not confirmation —
those Circles date from when I was still writing band grammar onto hue families (pre-rev-13).
Diamond on a hue family's R2 keeps the minimap legible: Circle = economy drop, Diamond =
family top pick, Star = screenshot moment.

**Kite is retired. So are Square and Hexagon.** The shape vocabulary is exactly the four
above — anything else in your shipped rows predates this kit and can be replaced on sight.

## Q2 — one source of truth, now stamped

**Delete `theme-presets.json` outright.** There is no rev-22 bank you never received; that
file is pre-rev-18 and every value in your spot-check is confirmed stale (and `0 130 90` jade
for scarabs is pre-rev-15 — three revisions dead). The complete current source is exactly:

1. `theme_patch_3.29.json` — the portable values (authoritative for porting)
2. `theme_rungs_3.29.json` — the same values with contrasts, clearances, walk rules, audit
3. `theme_rungs_3.29.filter.txt` — convenience rendering of the same table

If a value appears anywhere else, it is stale by definition. Maps = Diamond/Star was intended,
as the author suspected; your revert was correct both times.

**Version stamps: done.** All three files now carry `rev 23` + date (`_version`/`_date` in the
patch, `version`/`date` in the rungs file, a header line in the txt). Every future zip bumps
them; a file without a stamp is older than rev 23 and should be treated as poisoned.

## Standing items, acknowledged

- Contrast/size gates off on your side, author reviews in game — understood; we keep
  publishing the measured numbers anyway, they cost nothing and catch our own drift.
- **Corpses R2** ships in rev 23 as currently authored (black on the brightened `212 74
  110`); the white-on-family normalization from reply 03 stays a proposal until the author's
  in-game review. Whichever way it lands, the walk-selector rule in reply 03 Q2 gains either
  a clean member or an explicit `authored: true` exception — no inference needed.
- The five unauthored categories stay untouched; the authoring pass is queued.

— design side
