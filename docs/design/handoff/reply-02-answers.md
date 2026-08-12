# Answers — reply 02

Everything you asked for is here. `accent-category-map.json` beside this file carries the data;
this is the reasoning and the four confirmations.

---

## (a) accent → category — BLOCKER, and you found a real gap

**Six accents were missing, and one of them matters a lot: `equipment`.**

You read the absence right — gear is `rarity_through` — but `rarity_through` still derives its
**plate** from `accent.deep`. With no gear accent there is nothing to derive from. So there is now
an `equipment` accent, and the important part is that **all ~30 gear classes share it.** Boots and
Bows and Warstaves are separated by the game's own rarity text, never by a class hue; 30 ladders
wearing 30 colours is precisely what this design exists to stop. Gear also takes **no icon and no
beam** — gear is judged by reading the label, not from across the room.

The other five: `vendor` (Gold, Legacy, Vendor Recipes, Chancing), `flasks`, `quest`
(Quest Items + Magic Net), `allflame` (Allflame, Enshrouding Crystals, Enshrouded Gear),
`corpses`. That takes the bank to **23 accents for 75 categories** — still the "clean separation on
class" shape, not a hue per category.

**The Heist split is the one judgement call worth challenging.** Contracts / Blueprints / Targets /
Heist Currency take the heist red. **Heist Equipment and Heist Experimented go to `equipment`** and
lose the red — they are gear, rarity matters on them, and heist red should identify the mechanic's
own drops rather than gear that happens to come from it. If you disagree, that is two lines.

## (b) `_tier_to_rung` — answered as a rule, not 15 tables

Hand tables would need re-authoring every league, so this derives from **ladder depth** instead:
two templates (`value` and `gear`) keyed 1–7, plus 11 explicit overrides where depth alone gets it
wrong. New content then maps itself.

The `gear` template is separate because **a gear ladder is ilvl bands, not a value ladder** — its
top rung is a good crafting base, not a chase drop. So gear starts at T2 and only reaches T0/T1
where a genuine chase gear drop exists.

⚠️ It applies **per ladder (per file)**, not per theme category — your aggregates span files, so
"Jewels, 11 rungs" is really 3+1+7 and each gets its own mapping. Listed in the overrides.

## (c) Rank direction — your reading is correct, build it that way

Emit **corrupted(5) → linked(4) → influenced(3) → fractured(2) → enchanted(1)**, so the
highest-priority state lands last and wins the border under `Continue`. Enchanted beats corrupted.

The `rank` field in `theme-presets.json` is priority, not emission order — 1 is highest. Emission
is the reverse. Worth a comment at the emit site, since as you say it only shows up on a
double-state item and would ship wrong silently.

## (d) maps — confirmed, with one refinement

Your reading is right and simpler than what I wrote: **maps are `rarity_through`** — no
`SetTextColor`, let the game paint rare/magic/normal. One refinement: **keep the dark plate**
(`maps.deep`) rather than nothing at all, because the border has to read against something and an
unset background is the game's own grey. So: no text colour, dark plate, border carries the rung,
icon colour carries the map tier.

That collapses my "two map exceptions" into one real one — **icon colour from map tier** — and the
plate exception disappears into the general rarity_through rule. Better than what I handed you;
please treat §8.3 of `theme-standard.md` as superseded by this paragraph.

## On your §2 — Jewels and Fractured

- **Jewels: keep one accent for now.** Three files, one hue. Abyss and Cluster differ in *depth*,
  not in kind, and the rung ladder already separates them. Revisit if cluster jewels turn out to
  need their own read in game — you said that is one line, so it is cheap to defer.
- **Fractured: take it off Body Armours** — agreed. On the overlap: **keep your three-rung ladder
  and keep the state border.** They answer different questions, exactly as you put it. The ladder
  decides whether an ilvl-84 fractured base is worth showing at all; the border says *fractured*
  on whatever the ladder decided to show. Shrinking the ladder to one rung would make every
  fractured item equally loud, which is the thing we spent this design removing.

## What is still mine to decide, not yours

- Icon floor per category needs an in-game sweep — seed from NeverSink, then remove. Subtractive,
  so it cannot break a build.
- Fragments vs Breach share the purple band, separated by text colour and shape. Fine for now.

## One thing I want to check in your compile

`state_budget` is a **constraint, not a suggestion** — currency, fragments, scarabs and div cards
hold **zero** border states. If the compiler can emit a corrupted border onto a currency block,
that is a bug worth a validator line: an orb cannot be corrupted, and a state border appearing
there means a condition leaked.
