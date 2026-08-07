# Theme handbook — Sharket 3.29 Ruthless (CN)

**For the incoming designer.** This replaces the `reply-to-designer-*.md` thread, which is
kept only as the record of why each colour is what it is.

Everything in §1–§3 is **measured, not preferred** — the numbers come from the two reference
filters and from our own emitted output, and each one is reproducible with a script in
`parsing_tool/`. Please argue with them, but argue with the measurement.

Everything in §5 is genuinely **yours to decide**.

---

## 0. What you are theming

| | |
|---|---|
| Game | Path of Exile, **Ruthless** mode, Simplified Chinese client |
| Lineage | Derived from the **Sharket** filter; its players already read Sharket's vocabulary |
| Scale | ~430 emitted blocks, 51 nav categories, **12 colour families** |
| Player | One person and their friends, not a public filter. The author plays it daily and is the final judge |

**Ruthless matters more than anything else about the palette.** Drops are perhaps a tenth of
standard PoE. A wasted line of screen real estate costs little; a missed drop costs an hour.
That asymmetry is why this filter shows more and hides less than any public filter, and why
"quiet" here never means "hard to see".

---

## 1. The one rule the last theme broke

> **One of text and plate must be extreme. Never both in the middle.**

Measured over the two filters:

| | text luminance (median) | plate luminance (median) | gap |
|---|---|---|---|
| FilterBlade | 0.660 | 0.051 | **0.61** |
| our old theme | 0.213 | 0.159 | **0.05** |

Of FilterBlade's 529 styled blocks, **two** put text and plate both in the middle band. The
previous recipe was `T4 = accent.muted on 80 80 80` — a mid-luminance text on a mid-luminance
grey, converging *by construction*: median 3.02:1 across 26 accents, **12 of them under
3.0:1**. The author's verdict was *"a visual disaster"*, and then, on the first attempted fix,
***"raising the contrast is not a fix"*** — which is correct. 4.5:1 between two mid-tones is
still grey on grey.

**Do not offer contrast-raising as a remedy.** If a pair fails, one of the two values is in
the wrong band.

## 2. The ladder, as it now ships

Four rungs per family. The **plate descends**; the **hue never drains out**.

```
T2   black-or-white on the family's BRIGHT plate      "worth picking up"
T3   the family colour on the family's DARK TINT      "a good one of these"
T4   the family colour on PURE BLACK                  "one of these"
T5   the same at 80% opacity                          "bulk"
```

⚠️ **There is no neutral-grey rung, and there must never be one.** An earlier draft ended the
ladder `200 200 200` then `140 140 140`, reasoning that a bottom rung is "bulk". The author
rejected it:

> *"support gems are not good … they tiered low in their category doesn't mean they are
> invaluable."*

Sharket settles it: it has four gem tiers and the cyan `27 162 155` appears in **all four**,
including the lowest (`27 162 155 on 27 51 52`). Its lowest currency rung is `170 158 130 on
0 0 0` — the tan, not a grey. **Rank is carried by the plate and by size, never by draining
the hue.**

*(`200 200 200` does appear in Sharket, and misreading it as a bulk marker is what caused
that draft — it is the **white map** colour, a family colour in its own right.)*

## 3. Size and icons are not free variables

**Size is not a value axis.** Measured across all seven FilterBlade strictness files, font
size barely moves — median **45 at every level** — while the block *count* falls 692 → 309.

> **Strictness removes items. It does not shrink them.**

Our floor is **40px**, with exactly two exceptions the author set by hand: scrolls and gold at
35, gold's top tier back at 40. Uniques are **45 everywhere** — FilterBlade keeps all 45 of
its unique blocks at 45px including tiers measuring 3.72:1, so their low uniques are not
brighter than ours, they are *bigger*.

**An icon means "pick this up", not "this exists".** FilterBlade puts an icon on **70% of Show
blocks even in its Ruthless file** (533 of 759) — barely different from its standard 67%. That
density is a flood and is explicitly **not** to be copied; take their shapes and colours only.

⚠️ **`MinimapIcon` size `0` is the LARGEST.** Our editor had this inverted for months, so
every icon authored through it came out upside down — chase drops with the smallest icon,
safety nets with the biggest. Ladder: **rung 0/1 → size 0, rung 2 → 1, rung 3+ → 2.** Colour
runs `Red → Yellow → White` top to bottom, which is both references' convention.

## 4. ★ The two live defects — this is what we need you for

Both were found in game after the palette copy landed, and **neither is a palette fault.**

### 4a. The rung is local where value is global

The author's report:

> *"ducats T2 still same as scrolls but they are not scroll level. in filterblade you can see
> that clearly. as well as gems."*

Measured, and exactly right:

```
Currency  Tier 8 General   卷轴 (Scroll of Wisdom)   rung 4
Ducats    Ducats T1        其余达克特                  rung 4    ← same rung
```

The palette renders both correctly — they *are* the same rung. The fault is that **a rung is
assigned by rank within its own category, while value is global.** Every category walks its
own tiers 0…n and lands its bottom tier on the bottom rung, so a bulk Ducat (real league
currency) and a Scroll of Wisdom (free, infinite) get the same look.

FilterBlade does not have this problem because **their (text, plate) pair encodes the item's
ROLE and is reused wherever that role occurs** — `0 240 190 on 20 20 0` covers 22 different
categories; `255 0 255 on 100 0 100` covers 21, under a tier literally named `anyremaining`.
60% of their pairs are shared across categories; 41% of ours were private.

**What we need from you: define what each rung MEANS in absolute terms**, so every category
maps its tiers onto one shared scale instead of its own. Something we can hand to a curator as
a test, e.g. *"rung 2 = you would stop moving to pick this up"*. The re-tiering afterwards is
ours, not yours.

### 4b. One family hue is not a hue

Saturation of every family colour we ship:

| hue | rgb | sat | reads as |
|---|---|---|---|
| **currency, low rung** | `170 158 130` | **19%** | **grey on black** |
| fossils | `210 178 135` | 45% | muted |
| uniques | `175 96 37` | 65% | vivid |
| gems | `27 162 155` | 71% | vivid |
| quest | `74 230 58` | 77% | vivid |
| currency / oils / div cards / essences / fragments / jewels / heist / scarabs | — | **100%** | vivid |
| *(FilterBlade's signature `0 240 190`)* | — | 100% | vivid |

`170 158 130` is Sharket's authentic 通货 tan and it is the **only value in the set that is
not a colour** — and **currency wears it across 18 of our 51 categories.** That is the whole
of *"dim-black + a hue color text which is acceptable but not satisfying"*: for 18 categories
the hue is a 19%-saturation tan, which on black is grey.

**What we need from you: a low-rung currency colour with real saturation that is still
recognisably Sharket's currency.** ⚠️ It has to stay clear of two neighbours that already own
their space — `255 165 0` (currency's own bright plate) and `255 230 80` (oils, which the
previous kit deliberately held clear of currency orange *"so a Golden Oil is never a
Divine"*).

## 5. Yours to decide

1. **The rung vocabulary** (§4a) — the single most valuable thing you can give us.
2. **The low-rung currency hue** (§4b).
3. **How many families.** We are at **12**, down from 26. The author's position, in their own
   words: *"i still want to pursue some level of vividness in hues, but i already realized it
   is pretty impossible to make it as many as 26 hues or things will be messed up."* 12 is not
   sacred — argue up or down, but every family you add has to survive §1 at every rung.
4. **The icon floor, per category.** We sit at **64%** of Show blocks carrying an icon against
   FilterBlade's 70%, and the author considers that a flood. Eleven categories are at **100%**
   (Fragments 39/39, Uniques 38/38, Base Maps 15/15, Tainted 11/11) — about 140 of the 278.
   Where does the floor go?
5. **Four categories that may deserve their own hue**, measured but undecided: **Legacy** (328
   bases, and it is a *status* — "this no longer drops" — not a value), **Corpses** (102 bases,
   5 real tiers), **Curse of the Allflame** (8 tiers, the current league), **Tainted Currency**
   (4 tiers). Scarabs and Oils were split out on the same evidence and both improved.

## 6. Constraints that will surprise you

Every one of these was found by loading the filter in game. Generation, the validator and the
parity tests passed all of them.

- **Ruthless cannot `Hide`.** GGG forbids it; we emit `Minimal`, which still *draws a label* —
  so a hidden block must emit **no style lines at all**. There is an open idea to hide with a
  `Show` at alpha 0 instead; not built.
- **An absent colour key means "let the game paint it".** 441 of 998 rows omit `TextColor` on
  purpose so the **rarity colour** shows through. **13 equipment categories are
  rarity-through** — writing white into them would paint over the most informative thing a
  gear drop has. Never specify text for gear.
- **`175 96 37` (uniques) is pinned.** Every other unique rung is keyed to that exact value.
  If a unique pairing fails, **lift the plate, never the text.**
- **Quest items are green** (`74 230 58`) — PoE's own convention, not a choice.
- **Gold never emits a background at any rung.** It is auto-collected; its label is a readout,
  not a call to action.
- **T0 and T1 are house identity** — red-on-white and the red plate. Seen in game and accepted
  twice at 4.00:1. Not up for redesign.
- **The border is free for five families** — currency, shards, fragments, scarabs and div
  cards can never be corrupted, linked, influenced, fractured or enchanted, so the border
  channel reserved for state decorators is permanently idle for them.
- **Several tiers can share one rung.** A rung-keyed change silently merges them; three gold
  tiers once collapsed into one grey this way.

## 7. How to deliver it

The previous thread's decisions were consistently good. What failed was delivery, four times
over, so please:

1. **Give every rung pairing its own contrast number.** `T4 = accent.muted on 80 80 80` is a
   legal-looking recipe that fails on 12 of 26 accents. Nobody could see that from the prose,
   and it shipped.
2. **A recipe is a claim about all families, not the one you designed it against.** Four
   separate prose-vs-array drifts came from writing a rule against a single category.
3. **State the plate a colour speaks against.** `120 235 210` measures 9.99:1 on gear's
   near-black and ~1.3:1 on a light map plate — same colour, two different answers.
4. **Values in a machine-readable file, prose beside it — and make them agree.** We will run a
   consistency check on both.

Ask for a measurement rather than guessing: everything in this document came from a script,
and we can point any of them at a new question in minutes.
