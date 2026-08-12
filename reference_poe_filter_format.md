# The PoE filter format — rules no test here checks

Everything in this file was found by **loading the filter in game**. Generation, the
validator and (when it existed) the parity test passed every single one of these bugs.
There is no syntax or vocabulary check anywhere in the pipeline that would have caught
them, which is why in-game verification is a required step and not a nicety.

---

## 1. Ruthless cannot `Hide`. At all.

GGG does not permit `Hide` in Ruthless. `Minimal` replaces it, and **`Minimal` still draws
a label**. Evidence: NeverSink's `FilterBlade.ruthlessfilter` has **0 `Hide` against 15
`Minimal`**, each headed `Minimal # Hide-Section replaced with minimal`. Sharket's own
shipped filter has 0 of both.

So "nothing on the ground" is unreachable in this mode; the ceiling is "as quiet as the
game permits". Hence `HIDE_CMD = "Minimal"` when the mode is ruthless.

**Emit no style lines on a hide block.** Minimal honours styling exactly like Hide, so a
styled hide block is visible clutter. `blockText()` strips `Set*`, `PlayEffect`,
`MinimapIcon` and sound lines whenever the block is a hide. NeverSink emits conditions only.

---

## 2. ★ An ABSENT colour key means "let the game paint it"

Absence is a design mechanism, not an omission. **441 of 998 theme rows omit `TextColor`
on purpose** — every gear class, Campaign, and every rarity-inherited family gives up its
text channel so the RARITY colour shows through. Treating absent as "default to white"
painted over all of it, and a rare Quartz Staff rendered with a white name, reading as a
plain normal item.

What the game paints when a line is omitted:

| omitted | game paints |
|---|---|
| `SetBackgroundColor` | `0 0 0 190` |
| `SetTextColor` | the rarity/class colour — rare `255 255 119`, magic `136 136 255`, normal `200 200 200`, unique `175 96 37`, currency `170 158 130`, gem `27 162 155`, quest `74 230 58`, div card `170 230 230` |
| `SetBorderColor` | none, except maps/fragments where it mirrors the text colour |
| `SetFontSize` | 32 |

Guarded in one place — `styleOff()` in `filterStyle.ts` — so every emission site changes
together.

---

## 3. ★ `Continue` composes PER PROPERTY — verified in game 2026-08-03

Two different rules, and conflating them is easy:

* **Without `Continue`** — the **first** matching block wins, applies its whole style, and
  evaluation **stops**. This is the model the filter runs on (first-match-wins), and it is
  whole-block.
* **With `Continue`** — the block's actions apply and matching **keeps going**. Later
  matching blocks override **only the properties they themselves set**. Properties they
  leave unset keep the earlier value.

Verified with a three-case filter loaded in game (`Documents/continue-semantics-test.filter`):

| case | result | meaning |
|---|---|---|
| decorator border, terminal ALSO sets border | terminal's colour | later block wins that property |
| decorator border, terminal leaves border unset | decorator's colour | it survives an unclaimed channel |
| decorator sets ONLY border, preset sets ONLY text + background | **both** | composition works |

**Why it matters.** This is the mechanism behind FilterBlade's decorator pattern: 44 of
their 880 blocks use `Continue`, and **42 of those set exactly one channel** (37 border,
5 text). "Corrupted" is authored once and layers over every preset, so states ADD to looks
instead of multiplying them — 29 + 8 rather than 29 × 8. Our 519 distinct colour triples
against their 138 is what the multiplying version costs.

**The authoring rule that follows:** a preset must deliberately **leave a channel unset**
for a decorator to show through it. That is the same principle as §2 — an absent value is
a decision — now load-bearing for theme composition as well as rarity.

⚠️ **Our generator cannot emit `Continue`.** The parser understands it (`FLOW_KEYWORDS`,
for importing other authors' filters) but nothing in the tree uses it, and the preview and
drop simulator both assume exactly one block decides an item's look. Adopting composition
is engine work, not data work.

---

## 4. A comparison operator needs a SPACE before its value

`StackSize >=10` is rejected outright; `StackSize >= 10` parses. Both spellings were
authorable and the tree contained both, so `normOp()` normalises on emit.

---

## 5. Sound paths resolve relative to the FILTER's folder

Not to this repo. Emit `Sharket掉落音效\x.mp3`, never `sound_files\Sharket…`. Players drop
that folder next to the `.filter`. Prefixing our container directory made all 370 alerts
fail silently — no error, no sound, nothing to notice while playing.

---

## 6. `HasExplicitMod` is TEXT, not a count

It matches mod NAMES (`HasExplicitMod "Tyrannical"`). There is **no condition that counts
explicit mods**, so "8-mod map" cannot be expressed directly and has to be inferred.

---

## 7. A `BaseType` must exist in `BaseItemTypes`

Transfigured gem names do not — they are `GemEffects` rows. Match `TransfiguredGem True`
instead. A `BaseType` that matches nothing fails silently.

---

## 8. Every Show rung needs a paired Hide

First-match-wins means an item no block claims reaches the final catch-all, which SHOWS it.
A filter of Shows shows everything: one build had **470 Show / 1 Minimal** and the campaign
floor was covered in white and magic gear wearing the bright green "update your filter"
plate. The working model:

```
show T1 / show T2 / hide T2 / show T3 / hide T3
```

Ordering is the priority system (`_meta.gen_order`, category-level). 6L / 6S / 3-linked RGB
must outrank any declutter.
