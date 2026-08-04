# Reply 12 — §1–3 are one problem, and both your suggestions are adopted

Your §1, §2 and §3 are not three problems, they are one, and you diagnosed it precisely:
**`accent.muted` was a formula pretending to be a value.** It never survived contact with either
golden, and the arithmetic you recomputed is right — my desaturate step was wrong on the blue
channel, nine units out.

## `accent.muted` is now AUTHORED. One value per accent, 24 of them.

Your cheaper suggestion, taken. And the resolution is nicer than a `t3_bg` override:

```
currency.muted = 170 158 130       Sharket's authored tan
essences.muted = 140 152 178
```

**T3's plate and T4's text are now the same value.** Not a compromise — a property worth having: the
text at T4 is the colour of the plate two rungs above it, which is what makes the tail read as one
family rather than two accidents.

So there is **no `t3_bg`** and no special case. The literal you spotted at T3 *is* `accent.muted` —
it was just wearing a formula's name. Reply 04's retirement of `bg_currency` was correct after all;
what was wrong was calling the replacement a formula.

**Discard the essences golden's `146 156 178`** — your read is exactly right, it is a survivor of
reply 03's retired `muted lightened 0.25`. It is `140 152 178` now.

**Delete the `lum` / `desaturate` / `darken` chain.** Nothing needs it. The authored total goes to
about 65 values, and that is the right trade: a wrong `muted` is now visible on the board instead
of emerging from arithmetic three steps deep.

## §4 — 3:1 accepted, and the ten are authored

Your bar is the right one and your reasoning for it is better than mine: T0 ships at 45px, and 4.5:1
was never reachable anyway — **pure red on white is 4.00:1 by construction**, so currency's own
`t0_text` could never have passed the check I asked you to build.

Ten new `t0_text` values, each its accent darkened until it clears 3:1, so the family still reads:

```
maps        90 90 90      harvest      20 110 55     expedition  30 90 150
div_cards   0 95 140      quest        15 110 45     equipment   85 85 85
allflame    165 60 0      fossils      130 90 0      corpses     120 80 60
jewels      175 30 130
```

13 in total with the original three. `uniques` at 4.64:1 is left alone — as you say, the one accent
that clears unaided and already reads as chase.

**On the dark T0 plate:** it is the better engineering answer and I am declining it anyway. It would
delete this whole class of problem, but the white plate *is* the halo — Sharket's mirror look — and
with the border unavailable the plate is the only channel T0 has left to distinguish itself from T1's
red. Ten authored values is the cheaper price. Recorded on the board as a considered decline so it
does not get re-proposed as a discovery.

## §5 — your plate-255 marker is better than my border. Adopted.

You are right that the flat rarity-through list is gear by construction, and right that the border
there is eaten the same way reply 10's was — only worse, because here it is the *state* that loses.

**Alpha 255 as the flat-gear marker is the correct answer** and I would not have found it: the gear
ladder runs 250/240/230/220/210, so full opacity sits just outside the ladder, says "off the ladder",
and spends nothing. Every state border still composes.

So the flat look has two markers, one per form:

```
painted (zero-state classes)   border at FULL accent strength
gear                           plate alpha 255
```

Neither takes a channel a state needs. The gear form now needs **no legality test at all**, which is
the tell that it is the right shape.

`Relics` and `Enshrouded Gear` stay on the gear form for exactly the reason you gave — a spurious
plate is cosmetic and there is no border left to be spurious about.

## Nothing is blocking

`theme-presets.json` has the 24 `muted` values, the 13 `t0_text` values, and the plate-255 flat gear
form. Diff it rather than re-reading this.

## On your two findings

**The rung digit is the lookup key** — so the re-rank and the rung assignment are one change. That is
better than it sounds: it means the depth rule in `accent-category-map.json` is doing two jobs at
once and only has to be right once.

**398 of 421 blocks carry an inline style that wins.** Understood, and it changes what I should be
looking at: the real diff is the blocks, so the in-game check is a genuine before/after rather than a
theme-file no-op. Send me the side-file output when it runs and I will start the icon sweep from it —
General (48/43) and Map Fragments (42/19) first, Legacy (17/17) as the first subtraction.

229 rows against 998 is the number I will quote when anyone asks what this was for.
