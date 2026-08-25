# Reply 03 — the bank is half right: there are two kinds of families, and one of them has no accent at all

Rev 22 is current. Short answers first, then the detail.

- **Q1** — neither reading. `accent.solid` IS authoritative **for hue families**; currency is
  not a hue family — it (and its kin) has **no accent**, only authored band rows. Your
  `accents.currency.solid = 255 170 0` is our **R3 band plate** wearing an accent's name.
- **Q2** — the phrase is not a per-row rule. It is a per-FAMILY **walk selector** keyed on the
  luminance of `accent.solid`, threshold **L = 0.35**. Text colour then falls out of the walk;
  no row ever picks text by maximising contrast.
- **Q3** — do **not** derive the 22 from the bank: six of its accent rows are stale against
  rev 22 and two collide with authored values. Corrected table below; five categories are
  genuinely unauthored — wait for rev 23 rather than generate.

---

## Q1 — two classes of family

**Hue families** own one colour. `accent.solid` is that colour, and the whole ladder is
derivable from it (see Q2): gems, allflame, essences, oils, corpses, harvest emerald
`46 204 113`, scarab lime `170 230 60`, tainted vaal, maps (text ladder), the net.

**Band families** own no colour — they walk Sharket's five authored currency bands, and every
rung is an authored row: **currency, fossils & resonators, omens, runegrafts**. For these the
generator must not run. The currency ladder, verbatim:

| rung | band | row |
|---|---|---|
| R0 | T1通货 | `255 0 0` on white, red border, 45, Red Circle |
| R1 | house red | white on `210 0 0`, white border, 45 |
| R2 | FB "very valuable" | white on `240 90 35`, no border, 45, Green Circle — 3.39:1 |
| R3 | T3通货 | black on `255 170 0`, 45, Orange Circle — 11:1 |
| R4 | T4通货 | black on `170 158 130`, 45, Yellow Circle — 7.91:1 |
| R5 | game default | **emit no style lines** (scrolls/gold keep hand-set FS35) |

So: `255 170 0` is not stale and not currency's solid — it is the **R3 band plate**. Fix is
structural, not a value swap: delete `accents.currency`, mark currency/fossils/omens/runegrafts
as band-class, and have them reference the band rows above at whatever rung the re-tier
assigns. A Chaos Orb at R2 reads white on vermilion — you applied it right.

**Omens & Runegrafts**: same answer as Chaos Orb by construction — band rows at their
value-assigned rungs. They never take a derived accent.

## Q2 — the real rule behind `black_or_white_by_luminance`

Compute **L = relative luminance of `accent.solid`**. That selects one of two authored walks
— it never selects text per row:

**Mid-value walk (L < 0.35)** — the family colour is dark enough to BE a plate under white:
- R2: **white** on `solid`, **white border**, FS45, icon 1 — border + icon carry rank over R3
- R3: white on `solid`, bare, FS45
- R4: **black** on `solid`, FS43
- R5 (where the family has one): `solid @ alpha 204` as TEXT on solid black, FS40

Members: gems (L .284), allflame (.263), essences (.184), currency-R2-vermilion (.260 — same
band, authored), corpses family (.266).

**Light-value walk (L ≥ 0.35)** — white text can never sit on the colour; the colour is the
top plate and then becomes text:
- R2: **black** on `solid`, FS45, icon 1
- R3: `solid` as text on its own tint (`solid × 0.19`), FS40
- R4: `solid` as text on solid black, FS40
- R5 (where it exists): `solid @ 204` on black, FS40

Members: oils (.76), delirium (.66), scarab lime (.65), harvest emerald (.45).

Why your 0.1791 crossover misfired: R2 white-on-vermilion at 3.39:1 is *deliberately* below
black's 6.19:1 — R2 descends from R1's white-on-red, so white text is the R2 signature, and
3.39 clears the FS45 bright-plate floor (3.0). Contrast is a floor, never an objective.

**One row in our own kit violates this rule — corpses R2** (black on a brightened `212 74
110`, a survivor of the pre-rev-13 grammar). Proposed for rev 23, pending the author here:
normalize corpses to the mid walk — R2 = white on `235 90 130`, white border, 3.32:1 FS45.
If the author keeps the brightened plate instead, corpses gets an explicit `authored: true`
flag so your generator skips it. Either way you will not have to infer.

**Alpha note:** your `@ 240` plate recipe is not ours. All plates ship fully opaque
(alpha 255); the only alpha anywhere is R5 **text** at 204. A translucent plate over ground
clutter is noise — audit finding A's cousin. Please drop the @240.

## Q3 — the 22 `#ffa500` rows, resolved

`255 165 0` is my own fossil: the draft R3 plate from the pre-rev-11 proposal, superseded by
the T3通货 `255 170 0`. It should exist nowhere. Per category:

| category | resolution |
|---|---|
| Curse of the Allflame | hue family `0 160 112`, mid walk (R2 3.35 · R3 · R4 6.26). Bank's `255 120 40` is wrong — that is (nearly) the enshrouded-fire STATE `255 120 20`, not the family |
| Enshrouded Gear | not the family: keeps the state look, black on `255 120 20`, Orange Star — no generation |
| Enshrouding Crystals | moved OUT to Legion: black on `145 155 170`, FS40 |
| Incursion Vials | not harvest — moved OUT to Vaal/Incursion; unauthored (working suggestion white on `40 150 80`) — **wait** |
| Harvest | hue family `46 204 113` (bank's `110 220 130` is stale), light walk, 3 ranks, no R5 |
| Corpses | hue family `235 90 130` (bank's `190 140 110` is badly stale), mid walk pending the rev-23 decision above |
| Delirium Orbs | single-rung family: R2 black on `210 210 230` FS45 only. R3 rows for delirium should not exist |
| Tainted Currency | authored ladder (bank's `205 40 95` stale): T1 = house R0 · T2 white on blood `150 20 40` 8.65 · T3 `245 85 75` on `47 16 14` · T4 on black — hideable below T2 |
| Omens · Runegrafts | band class — currency band rows at value-assigned rungs (Q1) |
| Breach (Grasping Mail · Wombgifts) | **unauthored — do not generate.** Bank's `160 45 255` sits ~7° from the maps T17 plate `108 52 180`: a collision waiting to ship |
| Expedition Ward-Bases | **unauthored — do not generate.** Bank's `130 200 255` crowds the pale map-text blues |
| Vendor Recipes | **unauthored — wait.** FB precedent is the dark-green recipe plate family; audit finding C touches these rows too |
| Ritual BaseTypes | **unauthored — do not generate.** Bank's `150 20 40` IS tainted's blood plate, verbatim — hard collision |

Net: 9 of 15 resolve from rev 22 today; breach, expedition, vendor recipes, ritual, vials
need an authoring pass (rev 23) — that is five decisions, not 22, and I would rather make
them than have arithmetic make them.

## Your two FYIs

**Value-based rungs** — aligned; that is §1's own doctrine (a rung is assigned by the test,
never by rank within a category; `rung_by_depth` deserves to be unused). The currency ladder
as global anchor is exactly the intended use.

**Jewels join the jewellery loudness class** — approved, same reasoning (small, high value
density, outvalues rarity). Jewels keep the game's bright rarity plates with black text;
weapons/armour stay stepped down at `32 32 32`. This matches the `Jewels` rows already in
`theme_patch_3.29.json`; no accent conflict.

## The "still open" corpses clearance

It closed in **rev 18** — your table cites the pre-rev-18 rose `232 92 104`. Corpses moved to
`235 90 130` (343°): Δ20° from vaal red `245 85 75`, and the ritual/pale-rose half clears on
saturation. Nothing rides on plate-separation squinting. If your kit still carries `232 92
104` anywhere, it predates rev 18 — re-pull the rev 22 zip before the next checker run.

— design side
