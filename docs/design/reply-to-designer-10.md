# Reply 10 — the ramp is in. The special-map swap is blocked, and by your own rule.

Reply 17 built and shipping. Sixteen map tiers now render as sixteen plates, black text,
luminance ascending, band carried by tint. The three anchors interpolate exactly as specified:

```
T1  110 110 112   T5  146 146 148   T6  150 146 120   T10 200 194 156
T11 210 196 194   T15 236 230 229   T16 242 238 238   T17 (house red, unchanged)
```

Two things. §1 needs a decision from you. §2 is a build report you should have because three
of its findings are about mechanisms you designed.

---

## ★ 1. The `map_special` swap cannot fire, and the reason is `_swaps_never_paint_the_house_rungs`

**Our special-map tier resolves to rung T1.** Your rule from reply 16 — *"a swap only fires
where the plate is neutral, never on T0 or T1"* — forbids a swap there. So `map_special` is
declared, correct, and inert.

This is not an accident of our tree. It is the two rules meeting:

- reply 16: **a swap needs a neutral plate to speak against**, so T0/T1 are excluded
- reply 17: **special maps must take a swap**, because the plate is spoken for by the tier

Both hold. Together they say: *a special map may not be at T0 or T1* — which is a **matching**
constraint arriving from the theme side, and the first time that has happened in this thread.

### What is actually on that rung

Ten rules, one look — the `#d20000` house red, 45px, `0 Red Square`, White beam:

```
#1  MapTier == 17                          #6  Corrupted True + Identified True (8-mod)
#2  Vaal Temple Map, MapTier >= 16         #7  ElderMap True
#3  HasInfluence (4 conquerors)            #8  Shaper Guardian Map
#4  ZanaMemory True                        #9  Expedition Logbook + AnyEnchantment
#5  AnyEnchantment True                    #10 Expedition Logbook
```

**Three kinds are stacked here and only one of them is what T1 is for:**

- **#1 and #2 are top-of-ramp.** A T17 and a Vaal Temple at 16+ genuinely are "very valuable".
  They belong at a house rung and want no swap — your `t17_falls_out` already says a T17 renders
  deep violet on white *by construction*, which only works if T17 is on the ramp rather than on
  the red plate it currently wears.
- **#3–#8 are the swap's actual population.** Influenced, Zana, enchanted, 8-mod, Elder, Shaper
  Guardian: each asserts a property of the instance over a map that still has its own tier. These
  are the ones whose plate must stay the tier's.
- **#9 and #10 are not maps at all.** An Expedition Logbook has no MapTier, so the ramp has
  nothing to say about it and the swap has no plate to speak against. It is in this tier because
  it is map-*like*, which was a reasonable call when the tier was "special things", and is not one
  now that the tier is "maps with a claim".

### The question

Splitting #3–#8 out of T1 into their own tier is a **matching** change, which is ours, and we can
do it as soon as you confirm the shape. What we need from you is which of these you intend:

1. **The swap rung.** If #3–#8 leave T1, what do they land on? They keep their own MapTier plate,
   so the rung is only supplying size, icon and beam. T2 is the obvious answer; say so and it is
   done.
2. **#1/#2 — ramp or house red?** `t17_falls_out` reads as though T17 should be on the ramp
   (255 255 255 plate + swap = deep violet on white). Today it is on the red plate and therefore
   is neither. Same question for Vaal Temple at 16+.
3. **#9/#10, the logbooks** — do they leave the maps accent entirely? They have no tier to carry
   and no rarity to show through.

⚠️ **And a boundary worth stating explicitly, since it is the first of its kind:** if the answer
to (2) is "T17 goes on the ramp", then the theme has told the matching side to delete a rule. We
are happy to do it; we would rather it be a decision than a consequence.

## 2. Build report — three of these are about your mechanisms

**The kit assumed a shape we do not have, for the fifth time.** Reply 17 says
`Maps/Base Maps.json` *"stays exactly as it is"*. It could not: our ladder is four BANDS
(T16 / T11–15 / T6–10 / T1–5), and four blocks cannot emit sixteen plates. The ramp went where
the `MapTier` condition already lives — onto the rules, as `overrides.BackgroundColor`. The tier
ladder itself is untouched and is now the pure size ladder you wanted, so the conclusion held even
though the premise did not.

**That channel had zero users before today**, and it took three attempts:

| | what happened | why it was invisible |
|---|---|---|
| 1 | `"210 196 194"` ignored | `parseRgba` takes `#rrggbbaa`; a space-separated triple falls back to the theme value and emits the OLD plate, with no error |
| 2 | 15 rules, not 16 | idempotency inferred from SHAPE ate the original T16 band rule, which legitimately looks exactly like a generated one |
| 3 | ladder emptied on re-run | drop-and-rebuild, but the band rules are consumed by the first run — and `0 replaced, 0 made` reads exactly like a no-op |

All three were caught by diffing the emitted filter. **All four guards stayed green through all
three.** That is now the fourth defect in this thread that only compiling-and-diffing found, after
the gear T0 contrast, the inline-copy veto, and the circular rung sort.

**Maps paint now**, which resolved the contradiction you flagged in your §4 — and the ramp forced
it rather than us choosing: white Normal-map text on a 242 plate is unreadable.

## 3. Two things from your reply 17 we did not do

**The crafting plate ramp: nothing changed**, per your §5. Your `equipment.deep` hypothesis is
recorded and waits on the load. Agreed that it is one authored value versus the shape of the
system, and the cheaper bet is the value.

**The icon colour from the three bands** is not built. Your maps exception says
*"icon colour from the same three bands + icon_floor T3"*, but the ramp is per-MapTier on the
rule while the icon comes from the rung's row — so the icon is currently one colour for all
sixteen. Same shape as §1: the mechanism the plate needed does not exist for the icon. Tell us
whether you want it and we will put it on the same rules.

---

## State

428 → 449 blocks (the map split), **0 unstyled**. Validator 0 errors, generator fixtures 8/8,
resolver equivalence 109/109, decorator composition 7/7, round-trip clean.

Still not loaded. Your three numbers to watch are unchanged, and the map ramp joins them — with
your own caveat as the thing we will look at first: **T12–T15 are four plates inside 32 luminance
points**, and interpolated middles are exactly where a ramp stops being readable.

One workflow note: you have repo access, so these replies live in `docs/design/` and every number
above is reproducible from `parsing_tool/theme/build_map_tier_ramp.py` and the guards. No zip
round-trip needed for anything you want to check.
