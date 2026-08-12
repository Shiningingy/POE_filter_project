# Designer brief — a value-ranked house palette

**For:** the Sharket filter's designer
**From:** the filter build, 3.29 "Curse of the Allflame", Ruthless / China server
**Status:** a proposal to react to, not a spec. If the theory below is wrong, say so — it
is drawn from measurements, and measurements can be measuring the wrong thing.

---

## 1. First, the thing that changed under you

The generation pipeline has been rebuilt. This matters to you because of what it fixes:

**Your colours now actually reach the game.** Previously a tier block's own styling was
read by the editor's preview and then *discarded* at export — the preview showed one thing
and the filter emitted another. 216 hand-authored style values were being thrown away. The
tier block now owns its look, and what you see is what ships.

Also changed, briefly:

- **One engine.** There used to be two generators (Python and TypeScript) that had to agree.
  The Python one is gone. There is now a single engine, and it is the same code the browser
  editor runs — so the editor cannot disagree with the exported filter.
- **The theme is a preset bank, not an authority.** A theme file supplies the *base* a tier
  was seeded from; the tier can then state its own values and they win.
- **One category identity.** A category's look used to be decided by three different fields
  that had drifted apart, so editing some categories silently painted a different one
  (styling "Contracts" restyled every Map). That is fixed and guarded by a build check.
- **Sound is explicit.** Sounds are no longer synthesised by rules you cannot see.

Net effect: **the styling surface is now honest.** That is the precondition for asking you
for a system rather than a list of colours.

---

## 2. What we measured, and the theory that came out of it

We compared our filter against **NeverSink's FilterBlade** (3.28, all seven strictness
files) and against the **Sharket 3.28 Ruthless** filter.

### Tier counts — we are already in line. This is *not* the problem.

| | categories | tiers per category |
|---|---|---|
| FilterBlade | 141 | **median 4**, mean 6.2 |
| ours | 74 live | **median 4**, mean 4.6 |

45% of FilterBlade's categories have three tiers or fewer; 21 have exactly one. Their long
ladders are all economy-driven (cluster jewels 54, rare-mod combinations 52, maps 39,
uniques 37). So no general "too many tiers" problem exists on our side.

### The palette — this is where we diverge, and we are the outlier.

| | distinct colour triples | categories with an entirely private palette |
|---|---|---|
| FilterBlade | 138 across 141 categories | **16 — 11%** |
| Sharket Ruthless | 68 across 10 top categories | 3 of 10 |
| **ours** | **519** across 100 categories | **41 — 41%** |

**FilterBlade does not give a category its own theme.** It uses one house palette, reused
across categories, where a colour encodes *how much this is worth and what kind of thing it
is* — their most-shared colour combinations each cover 16–21 different categories. Roughly
16 categories get a dedicated look, as deliberate exceptions.

The Sharket filter says the same thing explicitly: its colour definitions are commented by
**rung, not by category** — `# T1通货`, `# T2通货`, `# T3通货`. Same colour, many categories.

We built the inverse: colour encodes *which category this is*. That is why we carry nearly
**four times their colour vocabulary for fewer categories**.

### The theory

> **A player reads a drop by value first, category second.** Colour should therefore carry
> value; category should be carried by the axis that is currently doing nothing — the icon
> and the beam.

Two supporting facts from our own filter:

- Our **equipment** ladder already works this way — 25 categories share each of its rungs —
  and it is the part nobody complains about.
- The 41 private palettes are concentrated in league and currency content, which is exactly
  where the filter feels least consistent.

**If this theory is right, the ask is much smaller than "100 category palettes".**

---

## 3. What we are asking you for

### (a) The value ladder — the main deliverable

Define what a drop looks like at each rung, **independent of category**:

| rung | meaning | you define |
|---|---|---|
| T0 | drop everything, this is the run | text / border / background |
| T1 | very valuable | " |
| T2 | worth picking up | " |
| T3 | situational / bulk | " |
| T4 | noise floor, still shown | " |

Four to five rungs. Our median category has four tiers, so this covers most of the filter
on its own.

**Two constraints on this, both learned the hard way:**

- **Please do not specify font size.** Size is the player's setting, not the design. We are
  removing it from presets.
- **An absent colour is a real, deliberate choice.** In Path of Exile, *not* setting a text
  colour lets the game paint the item its rarity colour (unique orange, rare yellow, magic
  blue). **441 of our 998 theme rows omit text colour on purpose.** If a rung should let
  rarity show through, say "no text colour" — that is different from picking a colour that
  happens to look similar, and it is often the better choice for equipment.

### (b) The exceptions list — deliberately short

Which categories have earned a look of their own? FilterBlade allows itself about 16.
Candidates on our side: currency, uniques, maps and fragments, league mechanics.

For each one, say **what makes it recognisable** — a hue family, a border treatment — while
still reading as its rung.

### (c) ★ States compose — author each one ONCE

**Added 2026-08-03, after your `Continue` note. We tested it in game and you are right.**

A block can set one property and then `Continue`, letting whatever styles the item next
supply the rest. Later blocks override **only the properties they set**; anything they
leave unset keeps the earlier value. Verified with three cases in game: a border from an
earlier block survives onto a preset that sets only text and background.

So a state — corrupted, fractured, enchanted, influenced — is authored **once** as a single
channel and layers over every look we own. States **add** to presets instead of multiplying
them: 29 + 8, not 29 × 8. That is almost certainly how we ended up with 519 colour
combinations against FilterBlade's 138; they use exactly this (44 blocks with `Continue`,
42 of which set a single channel — 37 border, 5 text).

**What this asks of you:**

1. **Which channel does each state own?** Border is the natural one (it's what FilterBlade
   reserves for exactly this), but the choice is yours — it just has to be *the same
   channel every time*, or the states collide with each other.
2. **Which channel do the presets deliberately leave unset**, so the state can show
   through? A preset that fills every channel cannot be decorated. This is the same
   principle as the absent-colour rule above, now doing a second job.

The eight equipment state borders in your §05 are exactly this pattern — they are not a
special gear mechanism, they are eight overlays that happen to have been written against
gear first.

### (d) The second axis: beam and icon

This is currently near-dead in our filter and is the natural home for "how much does this
matter" and "what kind of thing is it":

- **Beam:** set on 198 rows. **196 of them are `White`.** The temporary beam (`Temp`, which
  flashes briefly on drop rather than persisting) is used **zero** times.
- **Icon:** set on 200 rows. **194 are one of two values** — `0 White Star` or
  `1 White Diamond`.

The game gives three independent icon axes and eleven beam colours:

- **Icon shape:** Circle, Diamond, Hexagon, Square, Star, Triangle, Cross, Moon, Raindrop,
  Kite, Pentagon, UpsideDownHouse
- **Icon colour:** Red, Green, Blue, Brown, White, Yellow, Cyan, Grey, Orange, Pink, Purple
- **Icon size:** 0 (largest), 1, 2 (smallest)
- **Beam:** the same eleven colours, each either persistent or `Temp`

What we would like from you is a **vocabulary**, not a table — for example: *shape says what
kind of thing it is; size says how much it matters; a persistent beam means do not walk past
this, a `Temp` beam means glance at it.* Any consistent assignment beats one shape doing
every job.

---

## 4. Constraints that are not negotiable

These come from the game, not from us. Every one was found by loading a filter in game after
it passed all our automated checks.

1. **Ruthless cannot hide items.** The game forbids `Hide` in Ruthless filters. Our "hidden"
   items use `Minimal`, which still draws a small label — so a hidden item must carry **no
   styling at all**, or it becomes visible clutter. Do not design a "hidden" look.
2. **Absent ≠ black.** Covered above, and worth repeating: omitting a colour is a design
   decision the filter format supports, and painting over the rarity colour is the single
   easiest way to make equipment harder to read. It is now doing double duty — an unset
   channel is also what lets a state decorator (c) show through.
3. **Background alpha matters.** The game's own default label is a dark background at alpha
   190. Fully opaque backgrounds read as heavier than anything the game draws itself.

---

## 5. How to hand it back

Whatever is comfortable — a table, an image, a filter snippet. What we need per rung:

```
rung : text colour (or "none — let rarity show")
       border colour (or "none")
       background colour + alpha
       beam: colour + persistent/Temp, or none
       icon: shape + colour + size, or none
```

Plus the exceptions list, and the beam/icon vocabulary in a sentence or two each.

We apply it mechanically and the author reviews it **visually in game** before anything
ships — so a first pass that is directionally right is more useful than a complete one that
takes weeks.

---

## Appendix — where the numbers come from

- Palette and tier counts: `data/from_filter_blade/3.28/` (FilterBlade's seven strictness
  files, which self-describe each block as `$type->category $tier->rung`, plus the Sharket
  Ruthless filter).
- Our own figures: `filter_generation/data/theme/sharket/sharket_theme.json` (998 rows,
  100 keys) and the tier ladders in `filter_generation/data/tier_definition/`.
- Full per-tier review of all 1082 tiers: `docs/design/review.json`.
