# Request 01 — the kit checks out; five families are missing

Ran the consistency check you asked for, over `theme_patch_3.29.json` and
`theme_rungs_3.29.json`. Tool is in the repo at
`parsing_tool/theme/check_designer_kit.py`, so you can run it yourself before the next drop.

## The check passed

| | |
|---|---|
| numbered contrast claims | **46 of 47 verify exactly** (tolerance 0.05) |
| rungs-doc vs patch agreement | **13 of 13 identical** |
| pairings under 3.0:1 | **0 of 106** |
| colours that fail to parse | 0 |

For context on why we check rather than read: the previous kit shipped
`T4 = accent.muted on 80 80 80`, which reads like a legal recipe and fails on 12 of 26
accents. Yours is the first delivery where the numbers survived re-derivation.

**One stale number.** `visibility_pass.Maps 地图.T0 特殊地图` claims **10.11**; `29 64 124` on
`248 248 242` measures **9.49**. The patch value is right — it is the rungs doc that drifted.

## ★ One clearance fails your own ceiling test

Your ceiling test: *">= 10° from band neighbours OR >= 30 saturation points."*

| pair | measured | your note | verdict |
|---|---|---|---|
| **corpses rose `232 92 104` vs vaal-red `245 85 75`** | **8.7°, 9 sat pts** | "the tightest", eyeballs pending | **fails both halves** |
| scarab lime vs quest green | 33.2°, 1 sat pt | "~111°, Δ25" | passes — you were being cautious, it is 81° vs 114° |
| allflame vs harvest | 16.6°, 23 sat pts | "Δ17" | passes |
| allflame vs gems | 14.9°, 17 sat pts | "Δ15" | passes |
| scarab vs oils | 29.7°, 5 sat pts | "Δ35" | passes |

So **scarab-vs-quest needs no eyeballing** — that one is settled by measurement and you can
drop it from the pending list.

Corpses-vs-vaal-red is the real question, and we would rather move a hue than ship it and
squint. We can see the mitigation in your own notes — the plates are far apart (`214 76 90`
at 91% value vs blood `150 20 40` at 59%), so the plates may separate what the hues do not.
**Your call**: is the plate separation the intended distinguisher, or does one hue move?

## Scope is correct as delivered

The patch covers 15 sections and leaves Uniques, Map Fragments, Divination Cards, Heist,
Flasks, Quest and Gold untouched. **That is right** — the author considers those good in
their current state and scoped you to the families that were not. No action wanted there.

`Jewels`, `Sockets & Links` and `Legacy` are present but partial (T2 rarity grammar, three
socket looks, a border mark). We are reading those as deliberate — the rest inherits — and
will treat them as complete unless you say otherwise.

## We do NOT need the prose twin

Both files reference `Theme Proposal 3.29.dc.html` and it was not in the zip. **Please don't
produce it.** Handbook §7's "prose beside the values" rule existed to fix the previous
thread's failure mode, where prose and arrays disagreed four separate times. You solved that
better by putting `principle`, `rationale`, `clearance`, `risk` and `note` **inside** the
JSON — one source, so drift is structurally impossible. A second document would reintroduce
exactly the risk the rule was written to prevent. Keep doing it your way.

## Accepted, no action needed

- **Maps** — the author reviewed the restructure and prefers it to their own hand-tuned
  MapTier ramp: *"looks good on paper, mine is somehow not that good in live game."* The new
  T17 key and the shared blue family plate are approved. This was the one place we expected to
  push back and we are not.
- **The rung vocabulary** — the behavioural tests are exactly what was asked for, and the
  Ducats split (高级 R3 / 普通 R4) resolves the defect that prompted the handbook: a bulk Ducat
  and a Scroll of Wisdom were on the same rung.
- **The currency plate-walk** — using `170 158 130` as a *plate* with black text at 7.92:1
  rather than as text is the right reading of Sharket, and it dissolves the 19%-saturation
  problem instead of replacing the colour.
- **Harvest is 4 tiers**, banded on `StackSize` at the rule level (≥1000 / ≥300 / ≥100 / any).
  Your information was right; your `Tier 2+3` merge lands it on three effective bands.
- **The 3.0:1 bright-plate floor at FS45** — accepted as specified, with the precedent you
  cite. We will report back from in game on the two thinnest (white on gems cyan 3.14, white
  on allflame green 3.35).

## How we will apply it

Colours first as a single patch, so the author can see it in game and revert in one command.
The re-tiering implied by `_tier_map` is ours and lands separately — it moves ~430 blocks onto
your scale, and we would rather have the palette confirmed by eye before paying for that.
