# Request 04 — nine icon values are missing their shape, and one file of yours is poisoned

Reply 03 answered both questions cleanly and we have ported currency's vermilion and the Oils
ladder verbatim. Two things block the rest of the port. The first is small and mechanical; the
second is ours to flag and yours to decide.

---

## ★ Q1 — nine `MinimapIcon` values are two-token, and that is filter-fatal

`theme_patch_3.29.json` writes nine icons as size + colour with no shape:

```
Currency.Tier 1            "0 Red"
Skill Gems.R2              "1 Yellow"
Curse of the Allflame.R2 瓶中信 / R2 大量死者硫磺   "1 Yellow"
Corpses.R2 · Oils.R2 · Essences.R2 · Delirium Orbs.R2 · Harvest.Tier 0   "1 Yellow"
```

The game wants `MinimapIcon <size 0-2> <colour> <shape>`. **A malformed icon line makes PoE
reject the entire filter on load** — not the block, the file — so we cannot port these and we
will not guess a shape into them.

Everything else in the patch validates: all colours parse, all `PlayEffect` values are legal.
It is only these nine.

What our tree currently uses, in case it saves you time — five look obvious, three do not:

| family | shapes already in our tree | our read |
|---|---|---|
| Curse of the Allflame | Circle ×6 | Circle? |
| Corpses | Circle ×5 | Circle? |
| Oils | Circle ×5 | Circle? |
| Essences | Circle ×5 | Circle? |
| Harvest | Circle ×3 | Circle? |
| **Currency** | Diamond ×5, Circle ×5 | your other currency rows are all **Circle**, so Circle — confirm? |
| **Skill Gems** | **Kite** ×3, Circle ×1 | Kite is in our shipped rows but appears **nowhere in rev 22** — is Kite retired? |
| **Delirium Orbs** | Cross ×1, Circle ×1 | genuinely unknown |

Rev 22 names only **Circle, Star, Diamond and Cross**. Is that the whole shape vocabulary now?
If so, Kite is a leftover on our side and we will retire it — but we would rather hear it than
assume it, having just been burned doing exactly that (below).

---

## ★ Q2 — `theme-presets.json` is pre-rev-18 and has now caused two bad passes

We have been treating the accent bank as current. It is not. Spot-checked against reply 03:

```
corpses    bank 190 140 110   actual 235 90 130     ("badly stale" — your words)
harvest    bank 110 220 130   actual  46 204 113
scarabs    bank   0 130  90   actual 170 230 60
allflame   bank 255 120  40   actual   0 160 112    (255 120 40 is the enshrouded STATE)
```

Two things went wrong on our side because of it, both now reverted:

1. **An icon-shape pass.** The bank says maps = Square, gems = Kite, scarabs = Hexagon. Rev 22
   says maps = Diamond/Star, scarabs = Diamond/Star, and has no Square, Kite or Hexagon
   anywhere. The author asked *"maps are not using squares, is that intended?"* — it was; we
   "fixed" 21 correct blocks to match a stale document. Reverted.
2. **A ladder derivation.** We derived Oils R3 as `accent.muted`, a value in neither of your
   walks. Your patch's explicit `#ffe650 on #302c0f` was already what our tree carried.
   Reverted, and yours applied.

**The ask:** is `theme-patch-3.29.json` + `theme_rungs_3.29.json` the complete current source,
and should we delete `theme-presets.json` outright? Or is there a rev-22 bank we never
received? We would rather have one file that is right than two where the older one looks
authoritative.

A version or date stamp inside each file would make this self-checking — we have four
separate incidents this week of a tool confidently reading a stale artifact, and in every
case the file gave no way to tell.

---

## Standing, no action needed

- **Contrast and font size are no longer gated on our side.** The author's call: *"we don't
  need to gate the contrast"* and *"just follow what designer give you, if anything wrong we
  will propose a new version for you to port."* Your FS45 rungs and the 3.39:1 R2 land as
  written.
- **Corpses R2** — the author is not treating the contrast as a blocker and will review it in
  game. Send whichever you prefer in rev 23; we port it either way.
- **The five unauthored categories** (breach, expedition, vendor recipes, ritual, incursion
  vials) are untouched and waiting, as you asked.
