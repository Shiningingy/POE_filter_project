# Reply to ask-01 — F1 accepted and stamped out; F2: binding, inputs restored; fossils take the five steps

rev 28 zip. Four files now — the fourth is new and it is F2's answer.

---

## ★ F1 — accepted. It was a naming defect, and "verbatim" was the damaging word

You're right on every count, including the diagnosis: a label that restates a rung is either
quoting the global scale or contradicting it, and section-local `R0..Rn` is the one option
that cannot be made safe. Fix shipped both ways:

1. **Fossils is re-keyed to global rung ids** — and after the content ruling below, its note
   is finally *true*: it IS the currency bands verbatim now.
2. **Every painted row in the patch carries `_rung`** (83 stamped): the global rung its recipe
   resolves to, or `"authored"` for looks outside the global recipes (maps text-rank rows,
   gear rows, gems' Sharket-verbatim walk). Assert routing against `_rung`, never key names.

Your three extra instances, under stamping:
- **Wombgifts** — the row stamps `R0` **by design** (rev 24: the reserved house-chase tier,
  promote-into, never restyle). The winning inline R1 is port-side residue; reconcile toward
  the row. Costs nothing in game — the tier is empty.
- **Tainted T1** — stamps `R0` by design (rev 16). Collision dissolves.
- **Runegrafts** — a real defect, and the port predates rev 27: Runegrafts has **two visible
  tiers** — T1 = currency R1 row verbatim, T2 = currency R2 (vermilion) verbatim — and the
  third tier **hides**. The byte-identical tan pair is pre-kit residue: delete both rows.

## ★ F2 — binding. And the honest half: rev 23 killed the compiler's input and never said so

`rung_by_depth` is the kit's intent, so the answer is **yes, binding** — but you've caught a
real process failure: "if a value appears anywhere else, it is stale by definition" was right
about the values and wrong to orphan the 24 accents. That silence was our shared defect;
yours was implementing around it without saying so. Even.

Restored: **`theme_accents_3.29.json`** — small, stamped, no painted looks. Accent RGBs, walk
selectors (`hue` / `light-hue` / `bands` / `single` / `authored`), polarity, and explicit
overrides (corpses' brightened R2 plate, heist's fallback plate, the white-plate-top text
tones). Point `compile_theme.py` at it; fix `accent_by_category` on your side
(`"States"` → `"Class Nets"` — the miss stays an ERROR, never a fallback); put the four
invariants in CI against this file plus the patch's `_rung` stamps.

On your proposal: **derive-everything is the right end state, adopt it after the inline
reconciliation, not before.** Painted rows stay the porting surface for now — I keep per-row
tuning, you keep clean ports — and the compiler's restored job is to *disagree loudly*, not to
ship. When your 31% inline number is reconciled and the compiler agrees with the tree for a
full rev, flip `sharket_theme.json` to build-artifact and take per-row tuning through
`overrides`. That ordering is also your own second cost, stated back at you.

## Content — yes: five steps, floor on orange

The player is right and your FilterBlade check is the corroboration that matters: their tan
rung is *commented out* — nothing lives on tan in Ruthless fossil scarcity, and ours had ten
bases there. Adopted exactly as your proposed table:

```
R0  red on white          (0 Red Star)       Faceted, Fractured, Prime Chaotic
R1  white on 210 0 0      (1 Green Diamond)  green border kept — authored band mark
R2  white on 240 90 35    (2 Orange Diamond) 3.39:1, FS45 band
R3  black on 255 170 0    (no icon — floor)  11:1 — "at least alch level", delivered
```

The base re-tier (which fossil sits where) is yours to own per the kit's split; your proposed
mapping looks sound and ships as the default.

## Recorded, no action

- Alchemical Resonators in `_legacy`: correct, corroborated, keep.
- Fossil R1 green border: mine, authored, keep.
- Fossil rung digits conforming: noted — Fossils moves to the "conforms" column entirely
  once the compiler runs.
- Influence violet unification (reply 05): still open on your side — decorator's
  `150 0 255` vs kit's `150 110 255`. Pick one; the accents file carries the pending note.

— design side, rev 28 (all four files stamped)
