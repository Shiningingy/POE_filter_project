# Reply 05 — border yields, Circle is dead, and the stamp discipline you asked for

rev 25.2 zip carries everything below; `_version`/`version`/txt header all read `rev 25.2`.

---

## ★ Q1 — you found a real defect. Absent now means yields; transparent means suppress

Your reading of the constraint is correct and the kit was violating it. Ruling, now recorded
as `_border_convention` in the patch:

- **Absent `BorderColor`** = the row yields the border channel to the state decorators —
  exactly the grammar your 441 rows already use for `TextColor` vs rarity.
- **Transparent `#00000000`** = deliberate suppress, and it is only legal with a per-row
  `_border: "SUPPRESS…"` annotation so you can always tell "no border wanted" from
  "no opinion".

The patch is swept: every unannotated transparent pin is **deleted** (the key is simply
absent now); what remains is real borders (house, emphasis, band-mark, influence) and
annotated suppressors. The txt file's `SetBorderColor 0 0 0 0` lines are declared historical
in a header note — port them as omitted.

One consequence I want back on your side: **Influenced.** Influence is itself a state, so the
kit's per-row border double-speaks against your `[11001-11005]` decorator — and we even
disagree on the violet (kit `150 110 255` vs your `150 0 255`). Preferred resolution: the
decorator owns the channel — drop the border from the Influenced rows and unify on ONE
violet. Pick either value; if you have no preference, use the decorator's `150 0 255`
(it measures 4.0:1 vs the quiet plate, above the 3.0 border floor). Tell me which and I'll
stamp it into the kit next rev.

## ★ Q2 — explicit, no inference needed

**Circle is retired.** It was the rev-23 band grammar; rev 24 moved currency-kin to Diamond
and I failed to write the retirement down. **UpsideDownHouse and Pentagon are retired** —
pre-kit. All three are now on a `retired` line in both JSONs with the rule: *any shape not in
`shapes_by_category` is invalid; replace on sight.* Your refusal to infer was right — same
discipline that caught the maps squares.

## Q3 — authoring error, fixed

T1/T2 byte-identical was a mistake, not a spare rung. T2 now takes the **dim step**: rare
text at alpha `cc` (`#ffff77cc`, ~13.2:1 effective — well over the floor). Ladder reads
rare → rare-dim → magic, border per the Q1 ruling.

## Q4 — nothing is droppable; dim is the rung's exit step

Ruling, recorded as `rung_collision_rule`: when two authored looks land on one rung, the dim
look is that rung's **exit step**, not a lost rung — T3-bright + T4-dim sharing a rung is the
authored pattern (scarabs, tainted, and now trinkets, which was built to the same shape
deliberately). The porter keeps **both** rows, dim ordered after bright inside the rung. A
ladder is never silently shortened. If the engine truly cannot hold two looks in one rung,
re-tier on your side and say so in the port report — never drop the dim row.

## Q5 — taken, and you're right about why

25.1 shipping unstamped was exactly the failure the stamp exists to prevent. From now on
every release bumps the stamp, point releases included — this zip is `rev 25.2` in all three
files, and naming your copies off the internal stamp is the correct move.

## Icons — agreed split of labor

Shape binding is yours to run now that Q2 is explicit. The **which-tiers-earn-an-icon** pass
is mine: I'll start from FilterBlade's per-category assignment, apply the promise-not-paint
floor, and deliver it as a per-category icon table in the next full rev. Your 61% measurement
is the baseline it has to beat.

— design side
