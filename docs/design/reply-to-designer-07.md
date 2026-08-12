# Reply 07 — the kit is live, and one real question: crafting bases

Schema 2 is in and **the compiled theme is now the shipping theme.** That sentence was not true
before this round and it is worth being blunt about why: `compile_theme.py` wrote
`sharket_theme.compiled.json` and the generator read `sharket_theme.json` beside it. Nothing read
the compiled file. Your kit had never reached the game. It does now.

One thing needs you. Four things are reports, and **two are retractions** — items I raised in the
last round that did not survive being measured properly. Those are first, because they cost you
nothing to read and save you from answering questions that have no answer.

---

## ⚠️ Two retractions

**1. "Heist Blueprints is inverted" — wrong, I measured the wrong axis.** I had read the tier
*keys* in the file and found `T4` before `T2`. But rules drive emission for that category, not
key order, and the rule order is right. The generated filter:

```
#==[101001]  T1: 附魔蓝图   Show  Class == "Blueprints" · AnyEnchantment True
             SetFontSize 40 · SetBackgroundColor 200 40 40 240 · MinimapIcon 1 Yellow Pentagon
#==[101002]  T2: 其他蓝图   Show  Class == "Blueprints"
             (the quiet rung)
```

Loud first, quiet second. Nothing to fix, and the lesson is ours: **a tier file's key order is
not the emission order** whenever rules select the tier.

**2. "Depth-2 `T2 T4` skips the family colour" — also wrong, and your own design is why.**
I claimed the jump from the full-strength plate to house grey `80 80 80` loses the accent. It
does not, because **T4 puts the accent in the text**:

| | plate | text |
|---|---|---|
| Life Flasks T2 | `#eb6e6e` @ f0 | `#000000` |
| Life Flasks T4 | `#505050` @ e6 | **`#c39691`** — flasks' muted |
| Heist Contracts T4 | `#505050` @ e6 | **`#b4827d`** — heist's muted |
| Ritual BaseTypes T4 | `#505050` @ e6 | **`#a5787d`** — ritual's muted |

That is `_muted_is_authored` working exactly as written — *"T3's plate and T4's text are now THE
SAME VALUE… the property that makes the tail cohere."* All 8 depth-2 value ladders are fine. No
pair table needed.

---

## ★ 1. Crafting bases — the one real question

**A perfect crafting base and an ordinary rare of the same base are the same picture.**

The four categories on the `equipment` accent — `Rare Equipment`, `Crafting Bases`, `Influenced`,
`Trinkets` — compile to **byte-identical rows**: `#2a2a2a` at f0/e6/dc/d2, sizes 40/35/35/30.
That was the right call for `Rare Equipment` and you said why. Fractured and Influenced survive it
because their **state border** separates them. **Crafting has no such channel**, and here is what
that costs, measured on the emitted filter:

- Crafting Priority emits **39 blocks over 282 bases**. Rare Equipment emits 27 over 905.
- **All 282 crafting bases are also in Rare Equipment's lists.** So `gen_order −10` buys the
  crafting block first look at the item — and then draws the same thing.
- For **115 of the 282**, the best crafting block draws **exactly** what the plain-rare block
  draws. Not similar. Identical:

```
Show  BaseType == "Conquest Lamellar" · Rarity <= Rare
      BaseDefencePercentile >= 99 · Corrupted False · Mirrored False · ItemLevel >= 84
      SetFontSize 40 · SetBackgroundColor 42 42 42 240        ← a 99th-percentile i84 base

Show  BaseType == "Conquest Lamellar" ... · AreaLevel >= 68 · Rarity Rare
      SetFontSize 40 · SetBackgroundColor 42 42 42 240        ← any rare of it, any roll
```

For the other 167 the crafting block is **one rung louder** — which reads as *"this base ranks
higher"*, not *"this instance is exceptional"*. The ladder cannot say why.

### What FilterBlade does, because it answers the question directly

Their `crafting->qualityperfection`:

```
SetFontSize 45
SetTextColor      0 240 190 255      ← they give up rarity-through
SetBorderColor    0 240 190 255
SetBackgroundColor  0 75 30 255
PlayEffect Blue · MinimapIcon 0 Blue Diamond
```

**And `0 240 190` is not a category colour.** It appears in **24 different purposes** — `rareid`
(53 blocks), `exoticmods` (16), `magicid` (13), `crafting->qualityperfection` (8), `exoticbases`
(7), **`gear->memorystrand` (7)**, `exotic->fractured`, `exotic->enchanted`, `heist->contract`,
`jewels->abyss`. It crosses every family. It does not mean *"crafting"*; it means **"this instance
beats its rarity"**.

Their own escalation inside it is your vocabulary, unprompted:

| their block | text | border | plate | your word |
|---|---|---|---|---|
| `qualityperfection` Q28+ | green | green | `0 75 30` green | **swap** |
| `qualityperfection` Q24+ | green | green | `20 20 0` near-black | **enhanced** |
| `qualityperfection` floor | — | green | — | **decorator** |
| `crafting->generalgear` | — | `200 200 0` | — | **decorator**, quieter |

### So the ask is small, and it is not an accent

**You already designed this mechanism.** `text_swaps` in the presets:

> *"Properties that BEAT rarity take the text, freeing the border for real states. Own block, not
> a rule deviation."* — `quality`: text `120 235 210`, scope `equipment`+`gems`, rungs T0–T2,
> `Quality >= 21`.

`120 235 210` against their `0 240 190`. **You and FilterBlade picked the same colour for the same
idea, independently.** The only difference is scope: yours fires on one property, theirs on the
whole crafting purpose.

**The question: should `text_swaps` generalise from "quality beats rarity" to "crafting-worthiness
beats rarity"?** A `crafting` swap on the same channel, same family colour, whose condition is
*"this block is in Crafting Priority"* rather than `Quality >= 21`.

Three things that make this the cheap answer rather than a new axis:

- **No 27th accent.** The accent space is crowded where crafting would want to live — `harvest`
  `110 220 130`, `gems` `27 162 155`, `scarabs` `0 130 90`, `quest` `30 200 80`.
- **Text swaps already reuse accent hues in a different channel** — `replica` is jewels' solid
  exactly, `foulborn` is breach's. A crafting swap is consistent with how yours already work.
- **The border stays free**, so all four equipment states still compose. An accent would not have
  changed that, but a *state* decorator would have fought them, and this avoids the question.

⚠️ **The cost, stated plainly: crafting bases lose rarity-through.** Every crafting block carries
`Rarity <= Rare` (all 39), so today the text tells you whether it dropped Normal, Magic or Rare.
Taking the text deletes that. FilterBlade pays it, and the reasoning holds — you are going to
scour it anyway; the base, the ilvl and the roll are the whole signal. But it is your call and it
is a real loss, so I am not assuming it.

### And the author's "red on white" is right — it is a rung, not a colour

The author asked for *"red on white, to show they are exceptional"*. I flagged that as a conflict,
because red-on-white is the reserved T0 idiom used by exactly one row in our tree. **It is not a
conflict. It is the same answer.** FilterBlade's red-on-white is the top of `exoticbases`:

```
Show # %D9 $type->exoticbases $tier->ecotinkbases84
    ItemLevel >= 84 · Rarity Normal Magic Rare · BaseType == "Iron Flask"
    SetTextColor 255 0 0 · SetBorderColor 255 0 0 · SetBackgroundColor 255 255 255
    PlayEffect Red · MinimapIcon 0 Red Star
```

**One base.** And it is your T0 recipe — white plate, red border — reached from the other side.
(It is also `Iron Flask`, the ward base from §6 of the last round. It keeps turning up.)

So the second half of the question: **should the crafting ladder open at T0 rather than T2?**
Your override is `T2 T2 T3 T3 T4 T4 T5 T5 T5 T5`, and your note says *"a perfect roll or a Q21+
base is a reason to stop moving"* — which is T0's own definition, "drop everything". If Perfect
Defence and Over Quality took `T0 T1`, the author's instinct and FilterBlade's shape and your
prose would all be the same arrangement.

**Nothing here is built yet.** `text_swaps` has **zero readers** on our side — no code path, and
`120 235 210` appears nowhere in the output. So the swap and the crafting answer are one build,
which is why it is worth settling before I write it rather than after.

---

## 2. The `Magic Net` override is stale by two tiers — and it self-answers

```
kit      Equipment/Magic Net.json (4)  ->  T3 T4 T5 T5
file     2 visible tiers               ->  truncates to  T3 T4
```

Two **adjacent** rungs, which `two_tier_never_adjacent` forbids. The cause is the annotation: the
file has 5 tiers, but three are hides, and your own `_rule` says *"Depth counts VISIBLE tiers; a
hide tier emits Minimal with no style lines and is never counted."*

```
Magic Good Jewellery   visible   Rarity Magic · AreaLevel >= 68
Magic Net              visible   Rarity Magic · AreaLevel >= 68 · (24 classes)
Magic Hide Endgame     hide      AreaLevel >= 72 · Identified False
Normal Net             hide
Tier Hide Magic Net    hide
```

The gear depth-2 template gives **`T3 T5`** — which is your `_magic_net_note` intact (*"Top rung
T3"*) and legal, since with two visible tiers there is no floor to double. **I have taken `T3 T5`
unless you say otherwise**; the annotation wants correcting to `(2)` in the kit.

## 3. `painted_t3_needs_t2` — per file or per category?

The one case where it matters, and the invariants are becoming validator checks, so the scope
decides whether the check fires:

```
Jewels/Base Jewels.json     override (1) -> T3      ← painted accent, T3 with no T2
Jewels/Abyss Jewels.json    override (3) -> T2 T3 T4
Jewels/Cluster Jewels.json  override (7) -> T1 T2 T2 T3 T3 T4 T4
```

All three carry `theme_category: "Jewels"`, so **rows merge into one category** that does have a
T2. Per *ladder* — which is how `rung_by_depth` is scoped — Base Jewels violates it alone. Per
*category*, nothing does.

I read it as per-category (the row is what the player sees, and the merged category has its
full-strength rung), but the invariant says "ladder". **Which reading should the check take?**

## 4. Your depth-1 warning fires 4 times — here is what it caught

The reply-13 check is in. It flags a depth-1 ladder landing on T2 with no flat entry and no
override — *"right five times in seven, but this is the shape of the Legacy/Chancing bug"*:

| file | ch | theme category |
|---|---|---|
| `Curse of the Allflame/Bottles.json` | 瓶中信 | Curse of the Allflame |
| `Curse of the Allflame/Mercenary Warrants.json` | 佣兵委托令 | Curse of the Allflame |
| `Curse of the Allflame/Voyage Charts.json` | 海图 | Curse of the Allflame |
| `Heist/Targets.json` | 赏金猎人目标 | Heist Targets |

All four look right to us — three are the 3.29 league drops and T2 "worth picking up" is what new
league content wants; Heist Targets are the smuggler's caches. **Confirming so it can be silenced
deliberately rather than by fatigue.**

## 5. `theme-standard.md` in the kit is stale — we follow the machine files

Flagging so a future reader does not take the prose as current. It disagrees with both JSON files
in three places:

- **T6 on 8 lines**, including a rung table `T0..T6`, `| T6 | scrolls |`, and *"Gold is T6 → no
  beam"*. Both machine files define T0–T5, and the map says outright *"there is no T6"*.
- **Its shape list is 8** ("Moon, Raindrop, Pentagon and UpsideDownHouse stay unassigned");
  `_shape_reserve` assigns 10 including Moon and Pentagon, reserving only UpsideDownHouse.
- **Its currency table ends at T6 = scrolls**; your `Currency/General.json (9)` override ends at
  T4 with the note *"General never reaches T5 — it has no floor below scrolls."*

## Also fixed, since it broke your Crafting Priority override specifically

**Our rung ordering was circular.** `compile_theme` sorted each file's tiers by the `theme.Tier`
the same compile was about to overwrite — so the rung a tier got depended on the theme it already
had. Stable while the old ranks agreed, and wrong for exactly the ladders the reshape changed:

```
yours     T2 T2 T3 T3 T4 T4 T5 T5 T5 T5
applied   T2 T2 T3 T3 T5 T5 T5 T5 T4 T4      ← strands on the floor, ilvl bands above
```

which inverted your own *"strands through the middle, the four ilvl bands at the floor"*. The
authored `tier_order` is the sort key now, and **your override applies exactly as written**. The
author had reported this as *"crafting bases, seems no theme applied yet"* — it was applied,
inverted, and flat grey, which is §1 above.

---

## State of the compile

51 categories, 139 rows, re-rank over 231 tier blocks. 427 emitted blocks.

Green: validator **0 errors** (9 warnings, all known), generator fixtures **8/8**, resolver
equivalence **109/109**, decorator composition **7/7**, filter round-trip clean. Both goldens
expand byte-exact, and **56 rows now use the authored `accent.muted`** — the thing that was the
open blocker two rounds ago and is not open any more.

**17 of 422 non-decorator blocks set their own border, so states compose on 405.** The count moved
with the tree; the ratio did not.

⚠️ One honest caveat on all of that: **none of it has been loaded in game yet.** Every format bug
this project has found — Ruthless cannot `Hide`, an absent colour key means *let the game paint
it*, operators need a space before their value — passed generation, the validator and parity
first. Green is not evidence. The load is scheduled and I will send what it turns up.

Nothing in §1 blocks us. We are continuing on the filter side — the `_legacy` audit and the
in-game load — so take the crafting question at the pace it deserves.
