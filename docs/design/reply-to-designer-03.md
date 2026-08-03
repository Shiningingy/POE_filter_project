# Reply 03 — answers to `questions-for-code-side.md`

All ten measured against the tree rather than reasoned about, so where I say a number it came
out of the generator or the GGPK dump. Method at the bottom.

Replies 03–10 all read and understood — the two blockers are closed and the compiler is
unblocked **except for one thing in reply 10**, which is question 3 and is the only item here
that changes your design rather than confirming it.

---

## ⚠️ 3 first, because it is the one that matters

### A state cannot win the border off a rung. Reply 10's gear ladder is not expressible.

You asked me to confirm a later decorator cleanly replaces an earlier block's
`SetBorderColor`. **It does — but the decorator is not later, and it cannot be.**

The reason is the half of first-match-wins that `Continue` does not change: **a block without
`Continue` terminates matching.** So a decorator placed after the content blocks is never
reached for any item a content block already claimed. Decorators therefore have to be emitted
*first*, and ours are — the state decorator is at emission order 11001, ahead of all 529 other
blocks. `Continue` then hands the override to whatever comes *after*, which is the content
block. The rung wins; the state loses.

Measured on today's tree: **525 of the 529 blocks after the decorator set their own
`SetBorderColor`.** So on the current theme the state border is already being overwritten
almost everywhere. It is in the test suite as two of the seven checks, both passing:

```
ok    block that SETS border overrides the decorator
ok    block that OMITS border keeps the decorator
```

That second line is the whole mechanism: **a decorator paints only the channels the content
block leaves unset.** Which means the invariant you stated in reply 03, restated in reply 04's
`_rarity_through_rule`, and restated again in the T0 note —

> *the border is the only channel free on every item in every category, and that is what makes
> your five `Continue` borders compose*

— is not a stylistic preference. It is a hard requirement of the one-pass model, and reply 10
breaks it on the one class that holds all five states.

**On your second half:** yes, a decorator can set two channels — the emitter writes whatever
channels are stated and the validator only *warns* above two, so border + plate is fine. It
does not rescue the plate step-down though, because if the block sets the plate as well, the
block wins both.

**What I would do, and it is your call:** keep §6 and take the border back off the gear rung —
rank gear on the plate and size, which is your own `_rarity_through_rule` (one hue, alpha
245/240/225/210). Everything else in reply 10 survives intact: the four group hues, Sharket's
structure, text handed back to the game, T0-only Star, the declined size ramp. It is the
border channel alone that has to go back.

The alternative is emitting gear blocks *with* `Continue` so a later decorator can win — but
then every later matching block layers on too, including the final show-all net, and the net
would repaint the gear it was meant to catch. Not worth it for one channel.

---

## Blocking-ish

### 1. Gear groups — derivable. Author four hues, not thirty mappings.

**But not from `_meta.item_class`.** 86 of 89 mapping files carry it, and it is a *display
label*, not a game class — its values include `"Breach Grasping Mail"`, `"Enshrouded Items"`
and `"Crafting Priority"`, none of which are classes the game knows.

The real join is already in the repo: GGPK `BaseItemTypes.ItemClassesKey → ItemClasses.Name`,
then `filter_generation/data/class_hierarchy.yaml`, whose intermediate nodes **are your four
groups, verbatim** — `equipment/weapons`, `equipment/armour`, `equipment/jewellery`, and
`flasks` as its own top-level node. Quivers sit under armour, exactly as you wrote it.

41 theme categories have gear bases. **33 resolve to a single group** with no judgement
needed. Your guesses, checked:

| category | your guess | measured | |
|---|---|---|---|
| Talismans | jewellery | **jewellery** | ✅ (Amulets) |
| Stygian Vise | jewellery | **jewellery** | ✅ (Belts) |
| Mirror Ring Bases | jewellery | **jewellery** | ✅ (Rings) |
| Sacrificial Garbs | armour | **armour** | ✅ (Body Armours) |
| Breach Grasping Mail | armour | **armour** | ✅ (Body Armours) |
| Trinkets | jewellery | **not gear** | own class, `misc/league_content` |
| Relics | armour | **not gear** | own class, `misc/league_content` |
| Heist Equipment | fallback | **not gear** | Heist Tools / Gear / Cloaks / Brooches |
| Heist Experimented | fallback | **mixed** | weapons 29 / jewellery 12 / armour 6 |
| Expedition Ward-Bases | armour | **mixed** | armour 9 + 1 Utility Flask |
| Enshrouded Gear | armour | **unknown** | its 5 bases are not in the GGPK dump yet |
| Campaign, Crafting Bases, Influenced | fallback | **mixed** | ✅ fallback is right |

So: five of your guesses were right, three categories are not gear at all, and three are
genuinely mixed and want the `equipment` fallback you already specified. Uniques and Legacy
are mixed too and take the same fallback.

### 2. `state_budget` — right in four places, low in three.

Measured from the emitted blocks, so this is what the tree actually asks for today:

| class | you said | measured | |
|---|---|---|---|
| currency / fragments / scarabs / div cards | `[]` | `[]` | ✅ |
| heist | corrupted, enchanted | `AnyEnchantment` on both Contracts and Blueprints | ✅ |
| equipment | all five | corrupted, fractured, influenced, linked | ✅ |
| gems | corrupted | corrupted | ✅ |
| **maps** | corrupted, enchanted | **+ influenced** | `HasInfluence Crusader Hunter Redeemer Warlord` on Base Maps |
| **jewels** | corrupted | **+ enchanted** | Cluster Jewels rank on `EnchantmentPassiveNum` |
| **uniques** | corrupted, linked | **+ influenced** | `HasInfluence "Elder" "Shaper"` and `SynthesisedItem` |

To your two specific questions: **a map cannot be fractured, but it can be influenced** — we
match all four conqueror influences on maps today. **A jewel cannot be enchanted in the lab
sense, but cluster jewels carry enchantments** and that is how we tier them, so the channel is
spent either way. `class_hierarchy.yaml` also grants jewels `fractured` and `synthesised`, so
the ceiling there is higher than one.

⚠️ **One more, and it bites reply 10:** `flasks` in the hierarchy holds only
`identified / corrupted / mirrored` — no fractured, no influence, no sockets and so no links.
Folding flasks into the gear group claims five states on a class that can hold one.

Net effect: maps, jewels and uniques all lose the T5-borderless form, and the flat look stays
legal only where you already had it.

---

## De-risking

### 4. Heist areas — yes, we carry them, and we already have six of your nine.

`Heist/Contracts.json` maps by area: **Smuggler's Den, Laboratory, Prohibited Library,
Underbelly, Records Office, Mansion** — all six sitting in one tier, `Heist Contract T0`.
Missing from NeverSink's nine: **Bunker, Repository, Tunnels**.

⚠️ `Heist/Blueprints.json` has an **empty mapping** — zero bases. The blueprint half of the
ladder does not exist yet, so your open question about blueprints sitting a rung above
contracts is not costed by anything today; whichever way you call it, it is new work.

The re-tier is on the table and cheap. Whether their nine is the right nine for Ruthless is a
play-feel call and I have nothing to measure it with.

### 5. Quality — expressible, and gems already want a different number.

The tree runs `>= 20` (flasks), `>= 21` (uniques), `>= 23` (gems), `> 20` (crafting), so the
condition is fine. ⚠️ The operator needs a space before its value — `Quality >= 21`; `>=21` is
rejected by the game.

**Gems want 23, not 21 or 20.** We already pair `Quality >= 23` with `GemLevel >= 21`, because
gem quality caps at 20 and only corruption pushes past it — so 21 is not a breakpoint on a gem,
23 is. A second entry, as you guessed, just with a different number.

### 6. Font size 30 — already shipping. Nothing to verify.

The current filter emits exactly four sizes: **30 (17 blocks), 35 (87), 40 (181), 45 (240)**.
Your `size_map` of 45/45/40/35/35/30 is the ramp that ships today, so it introduces no new
value and no clamping risk that is not already in players' hands. (32 is only the default when
the line is omitted; the game's accepted range is 18–45.)

### 7. Flat list — two should come off.

| category | live rungs | |
|---|---|---|
| **Magic Net** | **3** | Magic Good Jewellery (73 bases) / Magic Net / Normal Net — a real ladder |
| **Stygian Vise** | **2** | T0 is a class-condition block, T1 has the base |
| Quest Items | 1 | it is `Misc/General.json`, which matches your override key exactly |
| Incursion Vials | 1 | 9 bases |
| Enshrouding Crystals | 1 | 5 bases |
| Delirium Orbs | 1 | 1 base |
| Relics | 1 | 1 base |
| Sacrificial Garbs | 1 | 1 base |
| Breach Grasping Mail | 1 | 1 base |
| Expedition Ward-Bases | 1 | 10 bases |
| Mirror Ring Bases | 1 | 5 bases |
| Enshrouded Gear | 1 | 5 bases |

Ten of twelve are genuinely flat. Magic Net is a ladder and should go on it; Stygian Vise is
your call at two.

### 8. Icon report — attached, and one category jumps out.

Emitted Show blocks per category, and how many draw an icon **today** (ruthless / soft, 526
Show blocks, 4 Hide):

| category | Show | icons now | | category | Show | icons now |
|---|---|---|---|---|---|---|
| General | 48 | 43 | | Body Armours | 11 | 3 |
| Map Fragments | 42 | 19 | | Jewels | 11 | 5 |
| Uniques | 38 | 33 | | Tainted Currency | 10 | 1 |
| Crafting Bases | 35 | 27 | | Boots / Helmets | 9 | 5 |
| Campaign | 28 | 0 | | Belts | 9 | 4 |
| Rings | 19 | 12 | | Curse of the Allflame | 8 | 1 |
| **Legacy** | **17** | **17** | | Utility Flasks | 8 | 8 |
| Gloves | 16 | 9 | | Quest Items | 7 | 7 |
| Amulets | 15 | 7 | | Quivers / Wands | 6 | 2 |
| Skill Gems | 15 | 15 | | Maps | 14 | 11 |

Start with **General (48 blocks, 43 icons)** and **Map Fragments (42/19)** — those are where an
icon floor either pays or spams. ⚠️ **Legacy draws an icon and a beam on all 17 of its blocks**;
on your `vendor` accent with `icon_floor: none` that is the single biggest subtraction in the
sweep.

Worth knowing for the shape sweep: the current filter has 15 distinct icon values but **245 of
285 are just two** — `1 White Diamond` (123) and `0 White Star` (122). There is essentially no
existing shape vocabulary to preserve, so yours replaces nothing.

---

## Your two assumptions

### 9. Gold in Ruthless — I cannot confirm it from here.

Nothing in the repo records pickup behaviour, and I would rather say so than guess at a
gameplay rule the whole `plate: never` exception rests on. Two things that reduce the risk:
`Currency/Gold.json` already emits **no icon and no beam** across its three rungs, so
`plate: never` only adds the third channel; and gold is one base, so if it turns out to be a
manual pickup the fix is one block. Flagging it for the author to confirm in game.

### 10. Delirium Orbs yes — one base. Corpses yes — 114.

- **Delirium Orb is `ruthless_exclusive`** in our saved wiki reference, and our mapping is the
  single generic `Delirium Orb`; the fifteen Standard variants are retired. So the `delirium`
  accent buys **exactly one base**. Still worth it if you want the orb unmistakable, but it is
  one line, not a family.
- **Corpses are live**: 114 bases in the 3.29 CN GGPK, 102 mapped here across five rungs. Your
  invented flesh tone has real content under it.

Two things I found next door and should pass on:

- ⚠️ **`Relics`: 7 of the 14 GGPK bases are named `[DO NOT USE]`** — GGG's own retirement
  marker. The class is half-dead, and our category holds one base. Worth knowing before you
  spend the flat look on it.
- ⚠️ **`Trinkets`: the only base in the game is `Thief's Trinket`**, which our Ruthless
  reference lists as removed — though that source has been wrong about this exact item before,
  so treat it as "check", not "dead".

---

## Method

`node filter_generation/generate.mjs --mode ruthless --strictness soft --trace …` — 530 blocks
with their emission order, source file, tier key and full text. Groups from
`data/from_ggpk/baseitemtypes.json` joined to `itemclasses.json` and folded through
`class_hierarchy.yaml`. Content checks against `data/source/cn-3.29/tables/English/`. Validator
clean at 0 errors; the decorator suite passes 7/7.

One unrelated find while in there: **`Currency/_archived/Breach.json` is emitting four live
blocks.** A file under `_archived/` that the generator does not skip. Ours to fix, not yours —
noting it so the Breach rows in your accent map are not a surprise.
