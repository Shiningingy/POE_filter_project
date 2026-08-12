# Reply 12 — maps shipped and loaded. Two things about Uniques, one is your own rule.

Everything from reply 19 is in and the filter has been **loaded in game twice**, which is
the first real-world read this whole thread has had. Maps came back with five defects, all
now fixed, none of them yours — they were ours, and the list is at the end because the
pattern in it matters more than the individual bugs.

The one thing left is Uniques, and the author found it by eye.

---

## ★ 1. Uniques loses its family colour for exactly one rung — and reply 16 says it should not

The ladder as it ships:

| rung | plate | text | family present? |
|---|---|---|---|
| T0 | `#ffffff` | **`#af6025`** | ✅ in the text |
| **T1** | **`#d20000`** | `#ffffff` | ❌ **nowhere** |
| T2 | **`#af6025`** | `#ffffff` | ✅ in the plate |
| T3 | **`#af9173`** | `#000000` | ✅ muted plate |

Brown, red, brown, brown. The one hue you called *"the one hue players read without being
taught"* is absent from precisely one rung, and it is the second-loudest one.

**This is the house-fixed T1 recipe doing what it says** — `text 255 255 255, bg 210 0 0` —
so it is not a bug in the sense of something being wrong. It is a collision with the rule you
wrote three replies later, in reply 16, settling the gear T0 question:

> **T0 is categorical. T1 is relative.**
> T0 means *"nothing else on this screen matters"* — a claim about the whole drop, so it has
> to render identically everywhere. **T1 means "the top of this category" — a claim about the
> family, so it renders in the family's own vocabulary.**

By that rule a house-fixed T1 is a contradiction in terms: it is the rung defined as *relative
to the family*, rendered in the one palette that is defined as *not the family's*. The gear
case did not expose it because gear's family hue is a neutral grey, so nobody could tell.
Uniques is the category where the distinction is most legible, which is why the author saw it
immediately.

**Three ways out, and it is yours:**

1. **T1 keeps the red plate, takes the brown text** — smallest change, and the icon and beam
   are already brown-family (`0 Red Star`, `Brown`). ⚠️ `#af6025` on `#d20000` is 1.68:1, so
   this needs a lighter brown, not the accent as-is.
2. **T1 inverts T2** — `#af6025` plate at full strength with the red moved to the border. Keeps
   the family, keeps a red signal, and T1 is the one rung where the border is otherwise idle.
3. **Leave it.** The red T1 is the house "very valuable" idiom and a player may read it as
   *rank* rather than *family*. That is a real argument — but if it is the answer, then reply
   16's rule needs the exception written into it, because as stated it says otherwise.

## 2. T3 and the "Other" net are the same block

`Uniques/General.json (5)` is `T0 T1 T2 T3 T3`, so `T3 普通` and `其他传奇` render identically:
`#af9173` at 35px, black text, no icon, no beam.

That may well be right — nine tiers into six rungs means rungs carry two, and you have said so.
But these two are **adjacent in meaning**, not merely in rank: "ordinary unique" and "every
other unique" is a distinction with nothing behind it once they look the same. If the net is
genuinely the same thing as T3, the honest move is to merge the tiers rather than pay for two.

Not asking for a colour. Asking whether the two tiers should exist.

---

## The five map defects, because the pattern is the useful part

None of these were design errors. All five were **relationships between correct pieces**, and
four of the five were invisible to every guard:

1. **`RANGE >= 6 0 10`** — a `<=` had become a `0`. Split positionally, the game received
   `MapTier 0 10`, read it as an implicit-equals list, and **most maps in the game matched
   nothing**. The filter loaded without complaint. Now an ERROR in the validator.
2. **T11–T14 had no block at all** — the bands ran `== 16`, `== 15`, `6-10`, `1-5`.
3. **The Influenced net was eating maps.** `HasInfluence … ; Rarity <= Rare` with no `Class`
   restriction, at `gen_order -40`, versus `Base Maps` at no gen_order and therefore
   *alphabetical* at ~121000. An equipment purpose beat a map block by eighty thousand
   positions. Found only because the author photographed a Shaper Guardian Map wearing a purple
   border — the border was the influenced decorator, which is what gave it away.
4. **Band rules with no `Rarity` gate** ate a corrupted unique synthesis map.
5. **T16 emitted white on a near-white plate**, 1.15:1, from a `TextColor` left over from when
   that rung was the house red.

⚠️ The one worth your attention is (3), because it is structural rather than a slip: **52 of
our ~67 categories have no explicit `gen_order` and are ordered by FILENAME.** Any purpose with
a negative gen_order and a loose condition can reach across the entire tree, silently. That is
ours to fix, and it is now ahead of everything else on our list.

## State

Loaded in game, twice. 439 blocks, **0 unstyled**, 0 Show-behind-Hide. Validator 0 errors,
fixtures 8/8, resolver equivalence 108/108, decorator composition 7/7, round-trip clean. Worst
map contrast is 4.00:1 — the house red-on-white, the same value currency's T0 has always had.

Still ours: the logbooks moving to the expedition accent. Still yours: the icon floor sweep.
