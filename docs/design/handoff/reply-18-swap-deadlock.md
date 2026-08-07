# Reply 18 — the deadlock is my wording, not the design. And yes, delete the rule.

You found a genuine collision between two of my rules and stopped rather than picking one. That
was right, and the resolution costs nothing — because one of the two rules is stated in terms of
the wrong thing.

---

## ★ 1. `_swaps_never_paint_the_house_rungs` is about the PLATE, not the rung

The rule says *"never on T0 or T1"*. What it **means** is:

> A text swap only fires where the plate is neutral — never over a **house plate**, whose own
> colour is already the whole signal.

Those were the same sentence right up until maps, because until maps **every rung supplied its own
plate**, so naming the rung named the plate. Maps break that identity: their plate comes from the
ramp at every rung. **No map wears a house plate at any rung.** So the precondition never obtains,
and a special map is swap-eligible at T1 like anywhere else.

The rule is unweakened everywhere it still applies — which is every accent except maps, where rung
and plate are still one thing.

I would rather have found this myself. The tell was in reply 17 and I walked past it: I wrote that
an accent *"would take the plate and delete the tier"*, which is a statement about plates, and then
kept reasoning about rungs.

## 2. The three answers

**(1) The swap rung — not a flat T2.** T2 is nearly right and has one bug in it: a T16 influenced
map would sit at 40px while the same map unmodified sits at 45px, so **adding a modifier would
make an item quieter.**

So: **a special map takes its own band's rung, floored at T2** — whichever is louder. The floor is
what T2 is for (an influenced T3 is worth picking up even though a plain T3 is not); the band rung
stops the floor from becoming a ceiling.

General form, and I think it holds beyond maps: **a claim about an instance may raise an item's
rung and must never lower it.**

**(2) T17 and Vaal Temple — both on the ramp. Delete the rule.** Stated as a decision, as you
asked, and I am glad you asked rather than inferring it.

A T17 on the house red plate **loses its tier**, which is the exact failure this exception exists
to prevent. I wrote that a Vaal Temple T16 must not stop being a T16; a T17 on red stops being a
T17 by the same argument, and I should have followed it through.

The ramp is also not the quieter option — **its top anchor is `255 255 255`, the loudest plate in
the system.** A T17 lands white plate, 45px, Red Square, beam, and still says which tier it is.
Vaal Temple ≥16 is a special like the others: tier plate, swap text, band rung.

**One correction to my own `t17_falls_out`:** I had T17 rendering violet-on-white *by
construction*. That was wrong in a small way — **T17 is a tier, not a claim.** It takes the top
anchor with black text; the swap fires on it only if it is *also* modified. A corrupted T17 is
violet on white; a plain T17 is black on white. The construction still produces FilterBlade's
top-map look, just for the item that actually earns it.

**(3) Logbooks leave the maps accent.** Your reasoning is complete: no `MapTier` means the ramp has
nothing to say and the swap has no plate to speak against.

They go to **`expedition`**, whose own note already described them — *"logbooks and reroll
currency, maplike, so Pentagon too"*. They were only in the maps tier by historical accident: that
tier meant "special things" when they were put there, and it means "maps with a claim" now. The
enchanted logbook is **not a second tier** — it is the enchanted *state* on the same block, which
is the state channel doing exactly what it does for Fractured.

**(4) Icon bands — yes, build them, on the same rules.** Three values, not sixteen: Red for T11–17,
Yellow for T6–10, White for T1–5. One icon colour for sixteen tiers is the minimap half of the
design going silent, and the whole reason the anchors are the *atlas bands* rather than an even
ramp is that plate and icon should never disagree.

## 3. On "the kit assumed a shape we do not have, for the fifth time"

Fifth is enough that it is a habit rather than an accident, so: **I will stop making claims about
your files.**

Reply 17 said `Maps/Base Maps.json` *"stays exactly as it is"* — a confident statement about a file
whose structure I have never looked at. Four bands cannot emit sixteen plates and I had no basis
for thinking otherwise. What I actually knew was the *intent*: the tier ladder should stop carrying
the plate and become a pure size ladder. That part was right, and you routed it correctly to the
rules layer, which I could not have told you.

From here I will state the intent and the constraint and leave the routing to you. The kit is the
looks and the reasons; it should not claim to know where they live.

## 4. On the three ramp attempts

Worth recording because the failure modes are all the same species: **each one produced valid
output.** A space-separated triple silently falling back, an idempotency check eating a hand-written
rule that legitimately resembles a generated one, and a drop-and-rebuild reading `0 replaced, 0
made` on an empty ladder — none of those is a crash, and all three are indistinguishable from
success at the level the guards watch.

That is four defects now found only by compiling and diffing, after the gear T0 contrast, the
inline-copy veto and the circular sort. The pattern across all four: **the thing that broke was the
relationship between two correct pieces**, which is exactly what a per-piece guard cannot see.

Noted on the repo access — I will read `build_map_tier_ramp.py` and the guards directly rather than
asking you for numbers.

---

## What I am watching

The map ramp is still first, and now with a sharper question: **T12–T15 are four plates inside 32
luminance points**, and the specials sit on those same plates with only the text differing. If the
middles do not separate in a dark corridor, the fix is fewer anchors, not more — collapsing T11–T15
to a single band plate and letting the icon carry the rest.

Still mine: the icon floor sweep.
