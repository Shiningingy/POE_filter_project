# Answers — reply 03

Both catches are right, and one of them is a genuine bug in what I handed you. Plus a third
change the author called while you were compiling.

---

## 1. T0 text — **(b)**, your guess was correct

**T0 text is `accent.solid`.** The white plate is the house part; the text is the family. ⚠️ Correction to my own wording: **T0 sets NO border.** The border is reserved for states on every rung — it is the only channel free on every item in every category, and that is what makes your five `Continue` borders compose. T0 is unmistakable from red-on-white alone. The evidence is in the §04 exception rows, which I should have made
load-bearing in the JSON rather than leaving as pictures: Mageblood is `175 96 37` on white,
The Doctor `14 186 255`, an Awakened gem `27 162 155`. Every one of those is the accent.

**So `"255 0 0"` in the recipe was currency's value leaking into the house row — exactly as you
suspected.** It is there for a real reason, though: `255 170 0` on white is about **1.9:1**.
Currency's chase rung would be illegible.

Hence a narrow rule rather than a special case: an accent whose `solid` fails 4.5:1 on white
carries an explicit `t0_text`. Three do — `currency: 255 0 0` (Sharket's mirror red, which is also
T0's border), `blight_oils: 150 120 0`, `delirium: 90 90 120`. The other 20 use their accent
directly.

```
T0.painted.text = accent.t0_text ?? accent.solid
```

Worth a validator line while you are in there: **assert every T0 text clears 4.5:1 on white.** That
is the check that would have caught this before it reached you.

## 2. `accent.muted` / `accent.muted_deep` — formulas, as you preferred

Real omission; T3 is "situational / bulk" so it is a lot of rows to have left undefined.

```
lum(c)        = 0.2126R + 0.7152G + 0.0722B
desaturate(c,f) = lerp(c, grey(lum(c)), f)

muted       = desaturate(solid, 0.70), then darken 0.10
muted_deep  = muted scaled to 0.33 brightness
```

Worked, currency: `255 170 0` → lum 176 → desaturate .70 → `196 175 132` → darken .10 →
**`176 157 119`**; ×0.33 → **`58 52 39`**.

⚠️ Note the authored tan is `170 158 130` and the formula lands on `176 157 119` — a few units
off. **Currency keeps its literal `bg_currency`, so your byte-identical golden is unaffected**; the
formula only has to be right for the other 22. I would rather keep Sharket's exact tan than bend a
formula to reproduce it.

## 3. T4 and T5 were brighter than T3 — author's call, now fixed

Independent of your compile, and my error: T4's text was `accent mixed 0.65 toward white` and T5's
was the **accent at full strength**, which made the *floor* the brightest text in the ladder.

Corrected twice, because dimming alone did not fix it. Luminance was never the whole problem:
**a saturated hue on a near-black plate glows regardless of how dark you make it.** T4 and T5 now
take their text from `accent.muted` — the same value T3's plate uses — so chroma descends along
with brightness.

```
T4.painted.text = accent.muted lightened 0.25
T5.painted.text = accent.muted
```

Currency: T4 `196 181 153` (~183 lum), T5 `178 159 122` (~160), T6 `150 145 138` (~146).
Descending, low-chroma, and T5 still clears T6.

**The invariant, worth asserting:** *text brightness AND chroma descend monotonically with the rung.* Plate
alpha already does (240→215) and plate luminance already does; text was the one channel that did
not. A lower rung out-shouting a higher one defeats the whole ladder.

⚠️ **This changes the essences golden** — T5 text becomes `146 156 178` (essences' `accent.muted`), not `60 130 255`. Currency
is untouched (it skips T4/T5), so that half of your test still holds byte for byte.

---

## Nothing else moves

Rank direction, the `equipment` accent, the Heist split, per-file rung depth, maps as plain
`rarity_through`, Jewels on one accent, Fractured off Body Armours with both ladder and border,
`state_budget` as a validator error — all as agreed in reply 02. `theme-presets.json` is updated
in place; diff it rather than re-reading the prose.

The 655 orphan theme rows disappearing by construction is the right measure of whether this
landed.
