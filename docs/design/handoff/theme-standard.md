# Theme standard — handoff for the code side

**Status:** design settled with the filter's author over this session. This is workstream **E**
of `docs/design/theme-pipeline-rewrite.md`, written in that document's vocabulary so it drops
onto the rewrite without translation.

**Visual truth:** `Theme Standard - Plates, Beams & Icons.dc.html` in the theme project.
Where this file and the board disagree, the board is right and this file is stale — say so.

**Data:** `theme-presets.json` beside this file. 41 authored values, two worked goldens. `accent-category-map.json` maps all 75 theme categories onto them.

---

## 1. What this is, in rewrite terms

| rewrite concept | what this design puts in it |
|---|---|
| **preset bank** (`sharket_theme.json` demoted) | 23 accents x 6 rungs (T0-T5), colours only. **No FontSize** — as workstream E requires. |
| **tier block owns its look** | a block picks `accent + rung`. Two channels, not a colour each. |
| **beam/icon as its own pickable axis** | fully **derived** — nothing to pick per block. Rung gives icon size+colour and beam persistence; accent gives shape and beam colour. |
| **rule deviation** (1-2 channels) | the 5 state borders. One `Continue` rule each. This is the designer's "enhanced". |
| **own block** (whole look changes) | the 3 text swaps + the 2 map exceptions. This is "swap". |
| **item card override** | untouched by this design. Sound stays where the rewrite put it. |

Resolution order is the rewrite's, unchanged: `rule deviation -> block style -> preset -> default`.

## 2. The two-channel model

A block authors **two** values. Everything else is a pure function of them.

```
block.accent   e.g. "essences"      -> plate hue, icon shape, beam colour
block.rung     T0..T6               -> plate recipe, icon size+colour, beam persistence
```

**T0, T1 and T6 are house-fixed** — same in every category, because "this ends the run" and
"this is the noise floor" mean the same thing everywhere. An accent authors **two** colours:
`solid` is T2's plate, `deep` is the shared plate for the whole T3-T5 tail. Rank inside the tail
lives in the **text** (painted) or the **alpha** (rarity_through), never in a plate ramp — see
`reply-04-plate-rule.md` for the NeverSink measurement that settled this.

### 2.1 Rarity-through

Every rung ships **two** variants and the block does not choose — the *item* does:

- **painted** — we set `SetTextColor`. Currency, gems, league items, anything whose rarity is meaningless.
- **rarity-through** — we deliberately emit **no** `SetTextColor` so the game paints unique orange /
  rare yellow / magic blue. Equipment, almost always. Plate stays `accent.deep` and the rung is carried by **alpha** (245/240/225/210) plus size and icon — **never** by the border, which must stay free for states on the one class that holds all five.

⚠️ The bright plates are **not reusable** for rarity-through: rare yellow and magic blue both fall
under 3:1 on them. This is why the two variants exist rather than one plate with optional text.

T0 and T1 are painted in **every** family, gear included — a chase drop overrides rarity. T0 text is `accent.t0_text ?? accent.solid`; **no rung sets a border**, on any rung, because the border belongs to states.

### 2.2 Alpha

T0/T1 opaque; then **240 -> 235 -> 230 -> 225 -> 215**. All above the game's own 190 on purpose:
the plate carries the rank, so it must read as denser than the default rather than dissolving into
it. Only T6 rarity-through drops to the bare game default (no `SetBackgroundColor` at all).

## 3. Tiers share looks — this is the part that shrinks the file

**The tier -> rung mapping is many-to-one.** A tier split mostly exists so strictness can hide one
band and keep another; it does **not** imply a different look. Currency, the deepest category we
have, uses **five** rungs across its whole ladder and skips two:

| rung | currency tiers |
|---|---|
| T0 | mirror-class |
| T1 | divine-class |
| T2 | high (2 tiers share it) |
| T3 | mid (3 tiers share it) |
| T6 | scrolls |
| T4, T5 | **unused** — currency has no unsellable band and no floor below scrolls |

So: **~4 looks per category, however many tiers point at them.** Measured depth distribution is
27 categories with 2 rungs, 14 with 3, 11 with 4, 6 with 5, 25 with 6, 4 with 7 — which is why
generating every category as if it had the full ladder is what produced 998 rows. Emit only the
rungs a category uses and it is ~350.

**Implementation note:** the mapping lives on the tier block (`rung: "T3"`), so two blocks naming
the same rung is normal and must not be deduped or flagged.

## 4. Icons

```
MinimapIcon <size> <colour> <shape>
             rung   rung     accent
```

| rung | size | colour |
|---|---|---|
| T0 | 0 | White |
| T1 | 0 | Red |
| T2 | 1 | Yellow |
| T3-T6 | — | no icon by default |

**Shapes are per accent, eight total** — Diamond stackable currency, Circle crafting consumables,
Square maps, Hexagon atlas keys, Triangle div cards, Star uniques, Cross league one-offs, Kite gems.
Moon, Raindrop, Pentagon and UpsideDownHouse stay unassigned as headroom.

### 4.1 The floor is per-category and gets swept DOWN

⚠️ **T2 is a starting default, not a law.** One number cannot be right for every category — a white
map matters in early progression, a T4 currency never does. Author's plan: **seed from NeverSink's
own assignment, then sweep down by hand.**

Two knobs, both subtractive:

```
accent.icon_floor   "T2"    lowest rung in this category that draws an icon
block.icon          "none"  this block draws none regardless
```

Tuning can only ever **remove**. This is deliberate: a removal cannot emit a malformed
`MinimapIcon` line, and per `theme-pipeline-rewrite.md` the game rejects the **whole filter** over
one bad icon line (`Currency/_archived/Breach.json` was one commit from proving it).

### 4.2 Maps — the one icon exception

Map **tier** drives icon **colour**: red tier -> Red, yellow -> Yellow, white -> White. Legal under
"colour means value" because for a map the tier *is* the value. **Colour only** — size still comes
from the rung. Maps also set `icon_floor: T3` so white maps keep an icon.

## 5. Beams

```
PlayEffect <colour> [Temp]
            accent   rung
```

Colour is always the accent's beam name. **Persistence is the rung**, and it is the one channel the
author wants judged per block rather than derived:

| | meaning | rung |
|---|---|---|
| persistent | don't miss this — survives the portal | T0, T1 |
| `Temp` | just a reminder — flashes and stops | T2 |
| omitted | the default, and the majority | T3-T6 |

Current state for contrast: 196 of 198 beams are `White` and `Temp` is used **zero** times.
NeverSink uses `Temp` **4,602** times, mostly paired with Grey — measured, not recalled.

⚠️ `Currency/Gold.json` sets `PlayEffect: null` while the theme row carries a White beam, so Gold
beams today. Under this design Gold is T6 -> no beam, which closes that conflict at the source.
The rewrite doc flags this as the designer's to fix; it is fixed here.

## 6. States — 5 border deviations

Rarity may own the text and the rung owns the plate, so **the border is the only channel free on
every item in every category.** That is why states live there. One `Continue` rule each, layering
over any preset.

| rank | state | border |
|---|---|---|
| 1 | Enchanted | 70 200 235 |
| 2 | Fractured | 160 200 255 |
| 3 | Influenced | 150 0 255 |
| 4 | Linked / 6-socket | 0 255 0 |
| 5 | Corrupted | 225 25 55 |

**Rank breaks ties when states stack** — enchanted outranks corrupted, per the author. A map or a
heist blueprint can be both.

### 6.1 Per-class state budget

Not one class holds all five. **Gear is the only one that can:**

| class | states |
|---|---|
| currency, shards, div cards, fragments, scarabs | **0** |
| gems, jewels | 1 (corrupted) |
| maps, heist | 2 (corrupted, enchanted) |
| uniques | 2 (corrupted, linked) |
| equipment — normal/magic/rare | 5 |

### 6.2 Text swaps — properties that BEAT rarity

**Rule: if a property is the reason you would pick the item up, it takes the text and rarity yields.**
A replica is a different item, not a decorated one. Each swap frees the border for states that
genuinely stack.

| swap | text | scope |
|---|---|---|
| Replica | 250 80 195 | uniques |
| Foulborn | 160 45 255 | uniques, jewels |
| Q21+ | 120 235 210 | **T0-T2 bases only** — quality never rescues a base you would not have picked up |

⚠️ Q21+ is **scoped, not universal**. The game already prints "Superior" on anything 1-30, so the
filter's job is only the 21-30 band, and only on bases already worth showing — **T0-T2, never lower**. Do not implement it as a global state.

Worked stacking (all real combinations, see the board's §05):

| item state | plate | text | border |
|---|---|---|---|
| Q23 on a T2 base | T2 | quality teal | — |
| Q23 on a T4 base | T4 | accent pale | — (quality ignored) |
| T2 base, corrupted | T2 | rarity | corrupted red |
| Q23 T2 base, corrupted | T2 | quality teal | corrupted red |
| Memory strand | own accent | white | enchanted cyan |

Text and border are different channels, so nothing conflicts.

## 7. Sizes — NOT in the preset

Presets carry colours only. This is the default size map, shipped separately so the player can
retune it:

| px | rungs |
|---|---|
| 45 | T0, T1 |
| 40 | T2 |
| 35 | T3, T4 |
| 30 | T5, T6 |

30 is deliberately **below the game's own 32** so gold and vendor bulk are present without competing.
There is no hide style and no T7: Ruthless draws `Minimal` for a hidden item, so a hidden block
emits **no style lines at all**.

## 8. Category exceptions — 6, against FilterBlade's 16

An exception **substitutes one accent into a rung and never changes the rung's structure** —
whichever of text/plate/border was the bright one stays the bright one. That discipline is what
keeps this from growing back into 519 triples.

1. **Currency** — none needed. It *is* the house ladder.
2. **Uniques** — brown substitutes into the accent slot; the one gear family that paints its text.
3. **Maps** — plate follows item **rarity**, not the rung. Rung carried by size and icon.
4. **Gems** — teal substitution. Largest category, most often misread as currency.
5. **Divination cards** — own blue. Widest value spread of any category.
6. ~~**Corrupted/tainted**~~ — RETIRED. Tainted currency is now an ordinary accent (`205 40 95`, vaal crimson, keeps currency's Diamond), not a structural exception. The old grey plate said "corrupted" by giving up the hue, which left a Tainted Mythic Orb reading as ordinary currency at every rung.

⚠️ Maps carry **two** independent exceptions (plate = item rarity in §8.3, icon = map tier in §4.2).
Those are different item properties. Both are intended.

## 9. Open — needs the author, not the code side

1. **Fragments vs Breach.** Both purple, separated by text (black vs white) and shape
   (Hexagon vs Cross). Fragments also take a purple border, free since fragments have 0 states.
   Splinters being drop-disabled shrinks Breach to foulborn uniques + wombgifts, so the pair
   barely co-occurs. Author: "fine for now."
2. **Icon floor sweep** — §4.1. Needs a pass in game per category. Not blocking.
3. **Jewels key names** once the three files split, and whether `Fractured.json` comes off
   `Body Armours`. Both tree-side, predate this design, neither affects the ladder.

## 10. Verification hooks

Mapping onto the rewrite's own Verification list:

1. **Preset expansion is a pure function.** `theme-presets.json` ships goldens for currency
   (painted, 5 rungs) and essences (painted + rarity-through). Implement the transforms in §2,
   expand, compare. No I/O needed.
2. **Colours only.** Assert no preset emits `SetFontSize`. The size map is a separate input.
3. **Absence is data.** A rarity-through rung emits **no** `SetTextColor` line. Materialising it
   as white is the exact failure `reseed_tier_styles.py` had to guard against — an absent colour
   means "let the game paint it".
4. **Icon/beam validity.** Every emitted `MinimapIcon` is `<0|1|2> <name> <shape>`; every
   `PlayEffect` is `<name> [Temp]`. Malformed = whole filter rejected, so validate at emit.
5. **Gold emits no beam and no icon** (T6). Regression for the `Currency/Gold.json` conflict.
6. **In-game load.** Non-negotiable per the rewrite doc: every bug last session passed generation,
   the validator *and* parity, and was caught only by loading the filter.
