# Reply 04 — reply 11 applied; five things stand between here and the compile

Thank you for withdrawing reply 10's border rather than negotiating it — recording it on the
board as a build constraint is exactly right, and it means I will not have to re-litigate it in
six weeks when someone reasonable suggests putting a rung on the border again.

All nine of the other applications look right in the JSON. Three groups plus a fallback, flasks
kept out of gear, `state_budget` corrected in the three places, Magic Net and Stygian Vise off
the flat list, `Blueprints.json` called as contracts-and-blueprints-alike, both quality
thresholds recorded. Nothing there needs another pass.

I implemented the two newly-defined verbs and re-ran the goldens. **`t0_text` reproduces
exactly** — both T0 rows are now byte-identical. `accent.muted` does not, and chasing why turned
up three separate problems (§1–3). Then I built the compiler while waiting, and it broke two of
your own assertions: the T0 contrast rule (§4) and the flat look's border legality (§5). Only §2/3
actually blocks.

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

## 5. ★★ The flat look spends the border too — on a list that is entirely gear

I built the compiler while waiting (details below) and implemented your `state_budget` legality
test as a hard check. **It fails on your own flat list**, and it is the reply-10 problem again in
a different place.

`flat_look.legality` says *"these classes hold zero states, so the border is spare."* For
`applies_to_painted` that is true. For **`applies_to_rarity_through` it is false on every single
entry** — that list is gear *by construction*, which is why it is the rarity-through half:

| flat rarity_through category | what its bases actually are |
|---|---|
| Sacrificial Garbs | Body Armours |
| Breach Grasping Mail | Body Armours |
| Mirror of Kalandra Ring Bases | Rings |
| Expedition Ward-Bases | Helmets / Gloves / Boots (+1 Utility Flask) |
| Relics | own class, bases unknown to GGPK — unresolved |
| Enshrouded Gear | 3.29 content, bases not in the dump yet — unresolved |

The first four are provably gear and gear holds all five states, so a full-strength accent border
there is eaten by the rung the same way reply 10's was — except here it is the *state* that gets
eaten, since the flat block comes after the decorator. The last two I cannot resolve, so the
compiler treats them as stateful: a spurious plate is cosmetic, a spurious border costs a state.

**The compiler currently drops the border on all six and reports it.** That is the safe direction,
not a decision — the flat look then has no marker at all on gear, which was the whole point of the
bright border.

**A suggestion, since the constraint is now fixed and the channel is genuinely gone:** gear ranks
on plate alpha `250 / 240 / 230 / 220 / 210`, so **alpha `255` is unused and sits just outside the
ladder**. A flat gear block at full opacity reads as "off the ladder" without spending a channel,
and it composes with every state border because it leaves the border alone. It also keeps your
three-way reading of the border intact — it just makes the third case "plate at 255" instead.

⚠️ One false positive to ignore: `Enshrouding Crystals` is on the *painted* list and is
currency-like, so it holds no states; it only trips the check because its five bases are not in
the GGPK dump either. The painted flat list is otherwise clean.

---

## What I need to compile

Only item 2/3 genuinely blocks: **what is `accent.muted`, on both golden accents.** Give me two
numbers per accent, or a corrected worked example, and the compiler runs. Items 1, 4 and 5 I can
work around — item 1 with a `t3_bg` override if you agree, item 4 by compiling what you have and
handing you the contrast failures as a list for the in-game sweep, item 5 by dropping the border
until you decide.

## Where things stand on my side — the compiler is built

`expand_goldens.py` implements every verb in the recipe with nothing undefined, plus the T0
contrast assertion, and `compile_theme.py` is built on top of it rather than forked from it, so
the golden diff stays the test that stops the compiler drifting from your recipe.

It runs end to end today: **73 categories, 229 rows against the 998 that ship now.** Your
prediction that the orphan rows disappear by construction is the right measure and it holds — a
row exists only where a rung does. It writes to a side file, never to `sharket_theme.json`, and I
generated a full Ruthless filter with it and format-checked the output: 532 blocks, no malformed
icon lines, no styled hide block.

Two things it turned up that are mine, not yours, but change the shape of the handover:

- **The rung digit is the lookup key.** Our generator keys the theme by `Tier N`, so assigning a
  rung and rewriting the block's tier number are two halves of one change. That is the deferred
  re-rank, and it is now generated and ready rather than hypothetical.
- **The theme file is largely bypassed.** An earlier workstream made the tier block own its look,
  so 398 of 421 blocks carry a full inline style that wins over the theme row. The real compile
  therefore rewrites the *blocks*, not the theme file. No change to your recipe — it changes where
  the output lands, and it means the in-game diff you asked for will be a real diff rather than a
  no-op.

The border constraint is recorded in the repo's format reference as a game-and-architecture truth
rather than a note on this handoff, so it survives past this project.
