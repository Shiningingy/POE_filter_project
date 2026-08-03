# Reply 04 — reply 11 applied; four things stand between here and the compile

Thank you for withdrawing reply 10's border rather than negotiating it — recording it on the
board as a build constraint is exactly right, and it means I will not have to re-litigate it in
six weeks when someone reasonable suggests putting a rung on the border again.

All nine of the other applications look right in the JSON. Three groups plus a fallback, flasks
kept out of gear, `state_budget` corrected in the three places, Magic Net and Stygian Vise off
the flat list, `Blueprints.json` called as contracts-and-blueprints-alike, both quality
thresholds recorded. Nothing there needs another pass.

I implemented the two newly-defined verbs and re-ran the goldens. **`t0_text` reproduces
exactly** — both T0 rows are now byte-identical. `accent.muted` does not, and chasing why turned
up three separate problems plus one of your own asks that fails.

---

## 1. ★ The currency goldens contradict each other on `accent.muted`

```
currency T3.bg    "accent.muted @ 240"   golden  170 158 130 240
currency T4.text  "accent.muted"         golden  176 157 119
```

Same token, two values. No formula satisfies both.

`170 158 130` is Sharket's authored tan, which reply 05 deliberately reverted T3 to. `176 157
119` is (roughly) what the formula produces. So T3 is not really `accent.muted` at all — it is a
literal, and it is the same literal that reply 04 retired as `bg_currency`.

**I think the retirement was slightly too broad.** Reply 04 retired `bg_currency` on the grounds
that "currency no longer special-cases its T3 plate", but reply 05 then put Sharket's tan back at
T3, which *is* that special case. It just needs a name again. The cheapest fix is a per-accent
`t3_bg` in the same shape as `t0_text` — one optional override, used once.

## 2. The worked example's arithmetic is off, so I cannot tell which number is the target

Recomputing reply 03's own example exactly as written:

```
lum(255 170 0)            175.797        you wrote 176        ✓
desaturate 0.70           199.6 174.1 123.1   you wrote 196 175 132
then darken 0.10          180 157 111         you wrote 176 157 119
```

The luminance matches, so `lum` is settled. The desaturate step diverges, and it is not a
rounding difference — 123 vs 132 on the blue channel is nine units. Only the green channel
survives to the end intact, which is why the final numbers *look* close.

So: is the intended `accent.muted` for currency **180 157 111** (the formula) or **176 157 119**
(the golden)? I did not want to pick, because the answer decides the T3 plate and the T4 text of
all 24 accents.

## 3. The essences golden cannot be a darkening at all

```
desaturate(solid, 0.70)   104.9 125.9 163.4
golden T4.text            146   156   178
```

**The golden is brighter than the desaturated solid on every channel** — the blue channel is
above even the un-darkened value. A "then darken 0.10" step cannot produce it in any rounding.

It reads like a survivor of reply 03's `T4.text = accent.muted lightened 0.25`, which replies
04/05 superseded when T4 became plain `accent.muted`. But even that does not reproduce it: it
gives `134 148 174`, not `146 156 178`.

Between this and item 2, I think `accent.muted` wants either a corrected worked example on both
accents, or — cheaper and in the spirit of the rest — **two authored numbers per accent instead
of a formula**, since it is now used in exactly two places (T3 plate, T4 text) and the formula
has not survived contact with either golden.

## 4. ★★ Your own T0 contrast assertion fails on 10 of 24 accents

You asked in reply 03 for "a validator line: assert every T0 text clears 4.5:1 on white". I built
it. It is now a standing check in `parsing_tool/theme/expand_goldens.py`, and it fails widely.

Reporting at **3:1**, not 4.5:1 — T0 ships at 45px, which is large text by any accessibility
standard, so 3:1 is the applicable bar and 4.5:1 would be unfairly strict. Even so:

| accent | T0 text | on white |
|---|---|---|
| maps | `200 200 200` | **1.67:1** |
| harvest | `110 220 130` | **1.72:1** |
| expedition | `130 200 255` | **1.80:1** |
| div_cards | `14 186 255` | **2.21:1** |
| quest | `30 200 80` | **2.23:1** |
| equipment | `170 170 170` | **2.32:1** |
| allflame | `255 120 40` | **2.64:1** |
| fossils | `200 140 0` | **2.91:1** |
| corpses | `190 140 110` | **2.93:1** |
| jewels | `250 80 195` | **3.00:1** |

At 4.5:1 it is 17 of 24. ⚠️ **Including all three accents that carry an explicit `t0_text` to fix
exactly this problem** — currency's `255 0 0` is 4.00:1 and blight_oils' `150 120 0` is 4.21:1.
Pure red on white is 4:1; it cannot clear 4.5 by construction.

Two ways out, and it is your call:

- **Accept 3:1 as the bar** — then ten accents need a `t0_text` and the three existing ones are
  fine. `maps`, `harvest` and `expedition` are the urgent ones; light grey on white at 1.67:1 is
  not a label, it is a rumour.
- **Or reconsider the white plate at T0.** If the plate is the house signal and the text is the
  family, a very dark plate would let every accent through at full saturation and the whole
  problem disappears. Structurally larger, so I mention it rather than propose it.

Worth knowing: `uniques` at 4.64:1 is the *only* accent that clears 4.5 without help and is also
a colour players already read as chase. That is a nice coincidence and probably not one to
disturb.

---

## What I need to compile

Only item 2/3 genuinely blocks: **what is `accent.muted`, on both golden accents.** Give me two
numbers per accent, or a corrected worked example, and the compiler runs. Items 1 and 4 I can
work around — item 1 with a `t3_bg` override if you agree, item 4 by compiling what you have and
raising the contrast failures as a list for the in-game sweep.

Everything else is ready. The transform language is settled, T0 reproduces byte-for-byte, the
group resolution is derived and tested, and the compile is a side file and a diff away.

## Where things stand on my side

`expand_goldens.py` now implements every verb in the recipe with nothing undefined, plus the T0
contrast assertion, and is importable so the compiler can build on it. The border constraint is
recorded in the repo's format reference as a game-and-architecture truth rather than a note on
this handoff, so it survives past this project.
