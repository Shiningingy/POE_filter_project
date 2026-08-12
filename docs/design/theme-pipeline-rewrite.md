# Theme pipeline rewrite — tier block owns its look, rules own matching

> **Status: in progress on `feature/theme-pipeline-rewrite`.** Settled with the filter's
> author on 2026-07-31 after a read-only audit of the whole pipeline (three exploration
> passes over the generators, the editor surface and the rules model). Everything under
> *Target model*, *Settled* and *Sequencing* is a decision, not a proposal — the items
> marked ⚠️ are implementation constraints, not open questions.
>
> **Done so far:** prerequisite H (parity can no longer pass against a stale bundle,
> `c8b279c`) and prerequisite 2 (the generation trace is captured, `18a4ab0`). Both
> prerequisites forced corrections to this document; they are marked ⚠️ inline.
>
> The shipping filter is untouched and remains buildable from the
> `v3.29-ruthless-pre-rewrite` tag throughout.
>
> Supersedes the deferred decision recorded in `decision_inline_theme_priority`: inline
> style wins, and the theme file becomes a preset bank. Reverses ADR-0001 (workstream G) —
> that needs its own ADR when it lands.

## Context

The theme pipeline is the last part of the filter that fights its author. Two symptoms
drove this, both found by using the editor:

1. **A tier block can only match BaseTypes.** Conditions live in rules, a separate and
   half-visible mechanism. The original intent was *tier block = general theme, rule =
   condition* — but the tier block also became a matcher, so the two overlap and neither
   is complete.
2. **Allflame proves the tier ladder is the wrong shape.** Most of that category is not a
   ladder — some contents are bundled lists, some tiered, some standalone one-offs.
   `theme_category × Tier N` forces the look to be justified by a tier *number* the
   content doesn't have.

Underneath both: **four style resolvers that disagree.**

| resolver | used by | guarded |
|---|---|---|
| `filter_generation/generate.py` | `POST /api/generate` (local) | parity w/ TS |
| `webapp/frontend/src/utils/filterGenerator.ts` | deployed/demo build | parity w/ py |
| `webapp/frontend/src/utils/styleResolver.ts` | **editor preview + Inspector raw text** | **no** |
| `webapp/frontend/src/utils/simulatorEngine.ts` | drop simulator | **no** |

The preview spreads the tier's inline `theme` **on top** (`styleResolver.ts:32-33`), while
both generators read only `Tier` and `PlayAlertSound` from that block and discard the
rest. **216 inline style keys across 24 tier files** already exist. So the editor shows
styling the filter throws away — `Maps/Scarabs.json` "Tier 1" previews gold-on-dark with
an Orange beam and exports a blue plate with a White beam. That is why authoring feels
like it works, and it is the thing to eliminate.

## Target model

- **A tier block is a look.** It owns its style. It is no longer a matcher.
- **Rules do the matching.** Creating a tier block auto-creates one rule so it is never
  inert. A block may emit **several** filter blocks — one per rule — which is how a few
  items get their own sound without a new look.
- **The dividing line:** a *rule* is a small deviation inside the same look — a different
  sound, an extra condition, **or one or two style channels** — while a *new tier block*
  is what you make when the look as a whole must change. So a rule keeps a narrow style
  override; it just stops being a second, competing full styling surface.
  This matches both the data (112 rules carry `PlayAlertSound`, 3 carry `BorderColor`,
  and *zero* carry the other five channels) and the designer's own escalation vocabulary:
  their **"enhanced"** (state hue takes the border, plate steps down) is a rule-sized
  deviation, while **"swap"** (state hue becomes the plate) is a different look and
  therefore a block.
- **Theme resolves per tier block.** `sharket_theme.json` demotes from authority to a
  **preset bank** you pick from — the decision already recorded in
  `decision_inline_theme_priority`, finally built.
- **Auto-sound is deleted, and a per-item sound is not a rule either.** It is an override
  on the **item card**.

  **What an item card is** (author, 2026-07-31 — an earlier draft of this document got it
  wrong): the card is the **per-occurrence representation of a base type in the editor**.
  It is *not* a matcher. It carries no conditions and no rules of its own; a card sitting
  inside a rule is simply a quick reference to that base type. Matching stays entirely on
  the rules axis, where it belongs.

  A card exists to do four things: **quick move**, **individual style override**, show what
  is in a category **at a glance**, and **hover for bonus info**. The override is any style
  channel, not just sound — though in practice ~99% of use is sound.

  Because a card is per *occurrence*, the same base has a separate card everywhere it
  appears, each with its own override. That is what expresses "5 splinters sound different
  from 50": the **rules** carry `StackSize >= 5` and `>= 50`, and the splinter's card
  inside each rule carries that occurrence's sound. Nothing is duplicated and nothing can
  drift, because there is no shared global entry to disagree with.

  Generation then **splits a block by override** — each distinct card sound emits its own
  filter block, same look, only the sound line differing. Derived, never authored: you tag
  the card instead of inventing a rule.

  ⚠️ **Ordering is generation's responsibility.** A split-out block must emit BEFORE the
  plain claim of the same base, or first-match-wins swallows it — the same failure the
  index already counts 86 of. Since the split is derived, the generator orders it; the
  index's `reachable` flag is the check.

  This retires the global `basetype_sounds` table (142 entries) and with it
  `already_handled`, `suppress_basetype_sounds` and `suppress_auto_sound`. There is nothing
  left to suppress once the card is the authority — which is exactly why the 9 curated
  sounds that never play (below) fix themselves.
- **Navigation becomes Title → Category → Subcategory → tier blocks**, Title and Category
  in the navbar, Subcategory expandable.

## What the current pipeline does (measured)

```
FontSize         rule.overrides > theme[cat]["Tier N"] > 32          (always emitted)
TextColor        rule.overrides > theme[cat]["Tier N"] > OMIT
BorderColor      rule.overrides > theme[cat]["Tier N"] > OMIT
BackgroundColor  rule.overrides > theme[cat]["Tier N"] > OMIT
PlayEffect       rule.overrides > theme[cat]["Tier N"] > OMIT
MinimapIcon      rule.overrides > theme[cat]["Tier N"] > OMIT
PlayAlertSound   rule.overrides > tier.theme.PlayAlertSound > sound.sharket_sound_id
                                > sound.default_sound_id > OMIT
```

`[cat]` = `tier_definition._meta.theme_category`. `Tier N` = `tier.theme.Tier` if present,
else parsed from the tier key, else **99** — load-bearing, since real keys like `"T1"`,
`"Other"`, `"Rare Safety Net"` all parse to 99.

- **A missing tier row inside an existing category falls back to `{}`, not Default** — the
  block emits `SetFontSize 32` and nothing else. Only a missing *category* reaches Default.
- **Three different category identities are in play**: the generator reads
  `tier_definition._meta.theme_category`; `base_mapping._meta.theme_category` exists in 84
  files and is dead; the theme board keys off `target_category` from
  `category_structure.json`. Consequence: all 7 campaign leaves and Fragment Splinters edit
  buckets the generator never reads, and `Influenced`/`Magic Net` have no nav leaf.
- **`roles.json` has zero runtime consumers**; `custom_overrides.json` is `{}`.
- **Dead controls:** the theme board's Sound row writes a `PlayAlertSound` no generator
  reads; `base_theme` is saved to `filter_generation/data/settings.json` while
  `generate.py:267` reads a non-existent `data/config/settings.json`.
- **The preview mangles `"disabled:"`** — emits `CustomAlertSound "sound_files\d" i`.

### Rules (264 across 49 files)

Only **10 distinct rule shapes** exist, which is what makes the split tractable. And
`overrides` — the seam — is barely used as styling: `PlayAlertSound` (112 rules) and
`BorderColor` (3) are the only channels with users; `FontSize`, `TextColor`,
`BackgroundColor`, `PlayEffect`, `MinimapIcon` have **zero**. 151 rules carry no styling;
**no rule is styling-only**. So the split is mostly moving `overrides.Tier` to the
matching side.

Four hazards for the migration:

- **`tier + targets` rules do NOT intersect `pending_items`** (`generate.py:667`), so a
  rule can conjure a base absent from `mapping`. **24 rules do**, including all 12
  flask-progression rules. **The set of bases a category emits is not derivable from
  `mapping` alone.**
- **`class_condition` tiers bypass the rules loop entirely** (`generate.py:585`). **55
  tiers.** No rule targets one today, but "Move to tier" will silently kill any rule moved
  there.
- **`pending_items` makes rules mutually destructive and order-dependent** — an earlier
  rule steals items from a later one.
- **Four writers, three readers, no schema**, and two different definitions of
  "self-selecting" (`styleResolver.ts:145` still uses the old narrow one), so preview and
  export disagree for ~40 rules.

Also worth fixing in passing: **`rule.localization` is uneditable** (110 rules carry it;
renaming writes `comment` while `localization.ch` wins the output — the "no invisible
filter logic" invariant, violated), and the condition picker offers the **wrong spelling**
of conditions in use (`IsReplica`/`IsFoulborn` vs the data's `Replica`/`Foulborn`), omits 6
the data uses, and offers 23 nobody does.

## Workstreams

### A. One resolver (first — everything depends on it)

Collapse four resolvers into one shared module both the generator and every editor surface
call. `filterGenerator.ts` is the correct implementation — it has `normOp`, `blockText`
hide-stripping, the `disabled:` mute and the no-`sound_files\`-prefix fix — so extract from
it. `styleResolver.ts` and `simulatorEngine.ts` become thin callers; delete their private
chains, including the simulator's inverted precedence and its `"Fragments" → "Map
Fragments"` special case. After this the preview *cannot* disagree with the export.

### B. Data model

- **Inline style on a tier block becomes authoritative**: `tier.style → picked preset →
  hardcoded default`.

  ⚠️ **Corrected by measurement (2026-07-31): inline style cannot simply be promoted.**
  The editor writes the RESOLVED theme back into a tier when it saves, so `theme` holds a
  mix of deliberate authoring and stale snapshots. Of 358 inline style keys across 72
  tiers in 24 files, 176 already agree with the theme row, and of the 182 that differ:

  | | count | promoting it would |
  |---|---|---|
  | matches the **pre-designer** theme exactly | 87 | undo the designer's port |
  | differs from both, but looks like an editor default (`#FFFFFF`, `#AAAAAA`) | 67 | replace designer colour with UI default |
  | **additive** — the theme row says nothing | 28 | be pure gain |

  So the migration must **reseed each block from its RESOLVED style**, not from its raw
  inline block. That is byte-identical by construction, which is what makes Verification
  item 1 achievable; only then is "inline wins" safe.

  **✅ DONE, in two steps.** First beam and icon were promoted where the theme row is
  silent (+64 lines, 0 removed) — 24 authored values that reached the filter nowhere.
  Then `reseed_tier_styles.py` rewrote all 388 tiers' inline blocks as their fully
  resolved style, and the priority was flipped: **the block's own style now wins.**

  Both steps verified by generating before and after: **byte-identical**, in standard and
  ruthless. That is the design's own Verification item 1, and it is what made the flip
  safe — post-reseed, inline and the row agree by construction. Proven to actually bite by
  editing one block's colour and icon: 8 emitted blocks changed, revert restored the bytes.

  The reseed drops a style key only where the theme row deliberately omits that channel
  (4 such values), since an absent colour means "let the game paint it" and materialising
  it would paint over the designer's intent. A block silences a channel *explicitly*, with
  `null` or a `disabled:` value — `Currency/Gold.json` does exactly that.

  Two things this surfaced, both for the author/designer, not for the migration:
  - `Currency/_archived/Breach.json` carries `MinimapIcon: "RedStar"` — no size, no
    space. It was harmless only because inline reached nothing; promoting would have
    shipped it onto the Breach splinter block and the game rejects the WHOLE filter over
    one bad line. Generation now validates beam/icon shape, warns, and drops it. **The
    intended value is still unset** — the size is a design choice.
  - `Currency/Gold.json` sets `PlayEffect`/`MinimapIcon` to `null` to suppress them, but
    the theme row *has* a White beam and star, so this is a conflict, not additive, and
    Gold still beams. Fix belongs in the theme row (the designer owns that file), or waits
    for the reseed above.
- **Split `overrides`**: `Tier` becomes the block identity (matching), and the style
  channels become an explicit, narrow **deviation** on the rule rather than a parallel
  styling surface. Resolution stays `rule deviation → block style → preset → default`,
  which is what already ships; the change is that the block — not a theme grid keyed by
  category × tier number — supplies the base.
- **Delete auto-sound; per-item sound moves to the item card.** The 122 synthesised
  sounds and the 112 rules that exist only to carry a `PlayAlertSound` both collapse into
  one per-item field. This retires all three suppression levers (`already_handled`,
  `suppress_basetype_sounds`, `suppress_auto_sound`): there is nothing to suppress once a
  sound is an item's property rather than an injected block. You clear the field.
  The generator groups a block's claimed bases by sound at emission time.
- **Retire `class_condition`** as a separate path; a condition-matching tier is just a rule
  now. Removes the 55-tier bypass and the silent-death trap.
- **Migrate from a generation trace, not from `mapping`.** Run the current engine, record
  which bases each emitted block actually claimed, and build the new tree from that — the
  only way to survive the `tier + targets` and `class_condition` hazards above.
- **Add a rule schema + validator** (there is none). Fold in the in-game-only checks:
  BaseType exists in `BaseItemTypes` (never `GemEffects`), operator spacing, `Class ==`
  plurals, dangling tier refs, dead rules, malformed `MinimapIcon`.

### C. Drop `base_mapping`; generate an index in its place

`base_mapping` stops existing as an authored file. Everything it holds has a better home:

| holds today | goes to |
|---|---|
| `mapping` (base → tier) | the block's rule `targets` |
| `rules[]` | onto the tier block itself |
| `_meta.localization.ch` | one GGPK-derived translation registry (GGPK is already the authority — `feedback_official_translations`) |
| `_meta.item_class` | tier block / category meta, or derived per-base from GGPK |
| `_meta.theme_category` | **dies** — already dead to both generators; the block owns its look |
| `_meta.suppress_basetype_sounds` | **dies with auto-sound** |
| per-item sound (today: `basetype_sounds` + 112 rules) | the **item card** |

Note what that last row means: dropping `base_mapping` does **not** leave zero authored
per-base data. The **item card is the surviving authored store** — but per *occurrence*,
not per base (see the card definition above), and it holds a style override rather than
anything about matching. The index stays purely derived; the card does not.

### ★ Measured: 9 curated per-item sounds never play

Found from the author's observation that `StackSize` tier-ups are a softcore FilterBlade
idiom rather than a Ruthless one. `Chaos Orb`, `Blue Pearl Amulet`, `Marble Amulet`,
`Seaglass Amulet`, `Cerulean Ring`, `Quicksilver Flask`, `Vaal Temple Map`,
`Ritual Splinter`, `Mortal Hope` — each has a curated file in `basetype_sounds`, and no
emitted block plays it.

The mechanism is `already_handled` (`generate.py:753`): auto-sound is skipped for a base if
**any** rule in the file names it in `targets`. Not if that rule sets a sound — merely if
it *mentions* the base. So one rule written for an unrelated purpose silences the item
everywhere in its file, including tiers no rule touches. Blue Pearl Amulet is claimed by 5
blocks; two are rules that carry no sound, and the other three get nothing because those
two exist.

Chaos Orb is the sharpest case: the rule doing the silencing is the `StackSize >= 10` stack
tier-up, which cannot fire in Ruthless at all. **A rule that never fires silences a sound
that would have.** Two unrelated features coupled through a shared side-channel — which is
precisely what moving the override onto the card removes.

In its place, a **generated index** (an editor convenience, never authored).

To be unambiguous: this is neither the category tree nor the generation order. It is a
**reverse lookup — base → everywhere that base appears.** Today `mapping` is forward and
authored (`"Chaos Orb" → "Tier 3 General"`); the index is the inverse and derived:

```
"Chaos Orb": [
  { category, subcategory, block: "Tier 3 General", rule: "#1 规则", order: 46018, wins: true  },
  { category, subcategory, block: "Tier 4 General", rule: "基础",     order: 46031, wins: false }
]
```

Generation order is an **input**, not the subject: `wins` is derived from it. The Chaos Orb
case above is real — it appears in a hand-written rule *and* a tier base list, and
consequently plays the generic `通货.mp3` instead of its curated `混沌石.mp3`. Nothing in
the editor shows that today.

⚠️ **Corrected by the trace (2026-07-31): `wins` is NOT "earliest occurrence".** Naming a
base in several blocks is the normal, correct pattern here — `Opal Ring` is claimed 8
times, each behind a different gate (`Quality > 20`, `MemoryStrands >= 1`,
`ItemLevel >= 86` / `>= 84`, `AreaLevel >= 68` + `Rarity Rare`). Those are the ADR-0006
precision layers and **every one of them is live**. A later claim is dead only when an
earlier block is at least as permissive — its condition set a subset of the later one's.

The difference is not academic: order alone calls **573** bases shadowed; the
condition-aware test says **86**. `filter_generation/analyze_trace.py` implements the
sound version.

**Resolution (author, 2026-07-31): multi-claiming is intended, and `wins` splits in two.**
A filter is a simple system with complex consequences; several blocks naming one base is
how precision is expressed, not a defect. The consequence is only that a single boolean
per `(base, occurrence)` cannot answer "which block catches this drop", because the answer
depends on the *item*: an Opal Ring at ilvl 84 with Quality 21 lands in
`Crafting Over Quality`, the same base at Quality 0 lands in `Crafting Gear 84`, and at
ilvl 70 it falls to `Tier 2 Rings`. There is no winner for "Opal Ring" as such.

So the index answers the **static** question and the simulator answers the **dynamic** one:

| question | needs | answered by |
|---|---|---|
| where does this base appear at all? | nothing | the index (cheap, exact) |
| **can this claim ever fire?** | the claims before it | the index — `reachable`, not `wins` |
| which block catches *this* drop? | the item's own state | the **drop simulator**, which already does it |

This is a narrowing, and a welcome one: `reachable` is decidable and provable, while a
global `wins` would have been confidently wrong. It is also still the cure for the bug
class the index was introduced for — "mapped but emits nothing" is exactly an unreachable
or absent claim.

And `reachable` is a **report, not an error**. Of the 86 today, 72 sit behind ordinary
`tier_base` blocks, mostly because `Crafting Priority` carries `gen_order −10` so it
deliberately outranks the equipment ladders. The editor should show these, not fix them.

**The system stays predictable, so index the two axes that matter** (author, 2026-07-31).
Conditions are finite and enumerable, so "which rule catches this item" is not a mystery —
it is a thing you can hold an *expectation* about and then measure. Two axes follow, and
the trace already records both:

- **per BASE** — where does it appear, and can each claim fire? (above)
- **per RULE** — did this rule emit **anything at all**? A rule that produces no block is
  the silent-failure class this project keeps rediscovering (the Blueprints rules that
  matched nothing; a rule with conditions but no tier is skipped outright). The trace
  names the emitting rule on every block, so "authored rules minus emitting rules" is a
  standing list rather than a script someone remembers to re-run.

Expected item → rule pairs then become **assertable**: pin a handful (`Opal Ring` ilvl 84
Q21 → `Crafting Over Quality`; ilvl 70 → `Tier 2 Rings`) and a reordering that breaks them
fails loudly instead of being noticed in game.

- The **sound picker** and **bulk editors** query it for "where does this base appear?"
  instead of walking the tree — the operation they already perform, made cheap.
- `wins` records which occurrence actually claims the base under first-match-wins. **That
  is what nobody can see today** — the direct cure for the recurring "mapped but emits
  nothing" bug class (525 entries on undeclared tier keys, the 13 silent quivers, the
  Blueprints rules that matched nothing). It also turns the coverage report into a live
  view instead of a script re-run by hand.
- Bases with **zero** entries are the gap list, for free.

Feature check — nothing is lost:
- **Sound picker**: writes the **item card's** sound field. It stops authoring filter logic
  altogether — no rule is created, in `base_mapping` or anywhere else.
- **Bulk editors**: the Sound Bulk Editor already had to be made per-occurrence by hand
  because occurrences were implicit; the index makes them explicit, so that stops being a
  special case. Tier reassignment becomes moving a base between blocks' rule targets.
- Only genuine casualty: `suppress_basetype_sounds`, which auto-sound's removal retires
  anyway.

⚠️ The risk is at **migration time only**: anything expressed solely in `mapping` must
become a rule, or it is lost. That is what the generation trace in B exists to prove —
not an ongoing limitation of the index.

### D. League intake — update the existing artifact, do not rebuild it

Dropping `base_mapping` removes the place new league content was hand-added, but the
replacement already exists: the **League Maintenance** artifact
(`claude.ai/code/artifact/be71eda1-...`, currently labelled `3.29.0.2.2`). It already:

- diffs GGPK against our curation and presents each difference as a **question**, on the
  correct principle — *"GGPK tells you what exists, not what drops"*;
- offers **Map / Legacy / Skip** per row, with a J/K/M/L/S/X/U keyboard flow, filter by
  item class, and **Select all shown** → assign the batch to one destination;
- carries a `dests` table of every destination file with its item classes and tier keys,
  so a Map decision resolves to a real target;
- exports decisions that *"name the file and tier it lands in, so this is applyable, not
  just readable"* — decisions live in the browser until exported;
- already surfaces the undeclared-tier-key bug through its `bad` field (the Breach
  blessings and the div cards all showing `Tier 1 Stackable Currency`).

**What the rewrite breaks — the only real work here:** its destination model is
`{file, tier}`. The new system needs `{block, rule}`. Specifically:

1. `dests` becomes a list of **tier blocks** (with their subcategory path) and, per block,
   its rules — so a Map decision picks a block *and* which rule's `targets` receives the
   base.
2. Routing by kind stays as designed: **equipment** → the corresponding tier by class and
   item level (mechanical; the per-class ladder exists), while **BaseType-sensitive
   content** — currency, div cards, fragments, league items — appends to the block's
   **rule**, since a tier assignment alone says nothing for individually-curated items.
3. Its "what's new/uncovered" input becomes the **generated index** from C — a base with
   zero entries is exactly a question — instead of a diff against `base_mapping`.
4. Export emits rule-target patches; still a **reviewed diff**, never a direct write,
   matching ADR-0005 and the one-shot uniques-importer convention.

This retires the current intake pain: 3.29 needed **six hardcoded `3.28` spots** found by
hand, and the coverage reports regenerated by script each session become a standing view.

### E. Theme presets, beams and icons

- Presets carry **colours only — no FontSize.** Size is the player's call, not the
  designer's.
- **Beam and icon become their own pickable axis**, separate from the colour preset, with
  a semantic vocabulary rather than free choice: *big icon → important; diamond →
  currency; Temp beam → worth noticing; solid beam → don't miss*. **Designer task.**
  This is also what fixes the current state: 210 of 215 icons are one of two values, and
  `Temp` is used zero times against Sharket's 90.
- The hue generator (`themeGenerator.ts`) becomes the preset *author* rather than an
  override writer.

  ⚠️ **Corrected by checking (2026-08-01).** "Retire `custom_overrides.json` (empty) and
  `roles.json` (unread)" was half wrong, and the wrong half would have deleted a working
  feature:

  - **`roles.json` — genuinely unread.** Confirmed: the only hit outside `node_modules`
    is a *comment* in `themeGenerator.ts` saying its role names mirror the file. Retiring
    it is safe, but note that makes the TS copy the sole source of those names.
  - **`custom_overrides.json` — NOT dead.** It has live `GET`/`POST /api/custom-overrides`
    endpoints and is plumbed through the backend, the Sidebar, `clientData`, `demoAdapter`
    and the bundle baker. It is `{}` because nobody has saved a per-category override yet,
    not because nothing reads it. Removing it would delete a capability, which is a
    decision, not a cleanup.

  (The simulator's private use of it is already gone — that was part of collapsing the
  four resolvers in A, and is a separate thing from the feature itself.)

  ✅ **RETIRED anyway (`80a8e0e`), as a decision — the author's call: "it is legacy, old
  structure."** Correct: a category × tier patch file exists because the THEME was the
  authority, and B moved the look onto the block. Measured before removing, since the note
  above was right that it was live — across 418 tiers an override could still reach
  TextColor on 240, PlayEffect on 294, MinimapIcon on 278, i.e. exactly the channels tiers
  deliberately leave unset. That sharpens the case rather than weakening it: its remaining
  power was mostly the power to paint over an ABSENT colour, which is the one thing an
  absence is there to prevent. The theme board keeps `overridesData` as a session-local
  buffer and banks it through the existing (lossless) save-as-preset path. Output
  byte-identical.

### F. Navigation

`category_structure.json` grows a Subcategory level; the editor renders Title/Category in
the navbar and Subcategory as expandable groups of tier blocks. Delete the third
theme-category identity so the theme board and the generator key off the same thing.

### G. Retire the Python generator ✅ DONE (`74adc5b`, ADR-0007)

Go TS-only; delete `generate.py` and `test_generator_parity.mjs`, keep a thin CLI wrapper.
An ADR-0001 reversal, so it needs its own ADR.

⚠️ **The argument AGAINST, created by workstream A, and how it resolved.** The objection
was real: `test_resolver_equivalence.mjs` only proved something because Python was an
INDEPENDENT implementation, and once the preview, the simulator and the TS generator all
shared `filterStyle.ts`, comparing them to each other is close to tautological. Deleting
Python looked like giving up the only outside opinion in the project.

What settled it was **measuring what that opinion was actually worth.** Parity answers
"do these two agree?", which is structurally blind to a mistake they share — and building
the replacement fixture found one within minutes: `match_modes` is written to
`base_mapping/_meta` and read from `tier_definition/_meta`, so the Partial match toggle
had never worked, in either engine, while parity stayed green. An independent
implementation of the *same misunderstanding* is not an independent check.

So the net was rebuilt around a different question before anything was deleted:

- `test_generator_fixtures.mjs` — **does the engine emit what we DECIDED it should?**
  Synthetic tree, committed goldens. Deliberately not a golden over the real filter:
  tier edits are the most common change in a filter editor, and a golden everyone
  regenerates without reading is not a test.
- `test_resolver_equivalence.mjs` — **do preview and export agree?** Kept, with its
  header rewritten to say plainly what it can no longer prove.

`generate.py --trace` became an opt-in `onBlock` hook on `GeneratorData`. The CLI
(`generate.mjs`) holds no generation logic — that is the invariant now, in CONTEXT.md.
Proof before deletion: **22/22 byte-identical** against `generate.py` (both modes × all 7
strictness levels, both languages, both modes × 3 campaign selections). Python keeps
offline data prep, exactly the split ADR-0001 predicted.

### H. Prerequisite — fix before migrating ✅ DONE (`c8b279c`)

`create_demo_bundle.py` silently no-ops as a CLI script, so `test_generator_parity.mjs`
compares fresh Python against a **stale** bundle. Every parity result is untrustworthy
until this is fixed. The bundle also drops sound files on every bake.

**Outcome.** Neither symptom reproduced on a clean tree — the bake runs correctly from
both shells and sound counts come out exact (723/723). So the trigger was environmental
(a lock, a half-written tree, or a `python` that is really the Microsoft Store stub —
still installed here, and it *hangs* rather than erroring). The fix is therefore
structural rather than a patch to one bug: the baker fingerprints its input tree and
stamps the output, but only after verifying it; the parity test recomputes that
fingerprint independently and refuses to run on a mismatch. Staleness can no longer pass,
whatever caused it. All four failure paths were made to fire before being called done.

### ★ What the trace measured (prerequisite 2, `18a4ab0`)

Captured from the current engine before any change, for both modes at soft
(`filter_generation/traces/`). The numbers that change the plan:

- **61 bases across 6 files are claimed by blocks but appear nowhere in `mapping`** —
  the `tier + targets` hazard, confirmed. A mapping-driven migration drops all 61,
  including the whole campaign flask progression. This is why the trace exists.
- **75 blocks emit no `BaseType` line at all** (32 `class_condition`, 43 self-selecting
  rules). Their claim is not expressible as a base list and must migrate as conditions.
- **3 bases are mapped but reach no block**, once the campaign gate is separated out —
  the other 597 are unpicked weapon/armour groups working exactly as designed. (In
  standard, 420 archived divination cards also surface: the known undeclared-tier-key bug,
  now measured.)
- **86 genuinely unreachable claims.** ⚠️ Deleting auto-sound does **not** fix these, as
  first thought: only 6 have an auto-sound winner, **72 are ordinary `tier_base` blocks**.
  `Opal Ring` really is mapped into `Crafting Gear 84`, so that block claims it whether or
  not a sound was injected. This is cross-category precedence — `Crafting Priority` is
  `gen_order −10` on purpose, so it legitimately outranks the equipment ladders — and it
  belongs to the open **global emission order** question, not to this rewrite. Recorded
  here so the migration does not "fix" it by accident.

## Settled

- **Nav mapping** — confirmed: today's chapter → Title, today's category → Category, and
  Subcategory is a **new** level grouping tier blocks (Allflame → Embers / Enshrouding /
  one-offs).
- **States** — either shape, chosen by size of change: a state that moves only one or two
  channels (corrupted's border, an enchant tint) is a **rule deviation**; a state that
  changes the whole look (enshrouded, 2× corrupted) gets its **own block**. This maps
  exactly onto the designer's "enhanced" vs "swap", so their §1 spec becomes portable
  without inventing a third concept.

### Where the index lives — a validated cache

**The tier blocks are the truth; the index file is reference only.** It is a cache, never
an authority, and is allowed to be wrong only in ways that are detectable.

- Written incrementally on every block edit and on export, so the common path costs
  nothing.
- Carries a **fingerprint** of the tree. On read: fingerprint matches → trust the cache
  and skip the check; mismatch → revalidate and regenerate.
- Promoting local → feature runs a **validation pass** — every index line must still
  resolve to a real block and rule — so the cache is never carried across a boundary on
  trust alone.

Two constraints this design has to respect, both learned the hard way here:

⚠️ **Fingerprint the walk, not the files.** `wins` is derived from generation order, so
changing a category's `gen_order`, or reordering rules inside a block, changes the index
while every block body stays byte-identical — a content-only hash misses exactly that edit
and the cache then lies about the most valuable field it has.

Proposal: walk the tree as the generator does and hash a canonical line per position —
`(gen_order, category path, tier key, rule index, targets, conditions)`. Exact in both
directions: order or matching changes → hash changes → regen; a colour, font size or sound
changes → the walk is identical → cache stands. That second half matters, because this is
a *theme* editor: style edits are the most frequent edit made, and a naive whole-file hash
would force a rebuild on every one of them. Avoid mtimes — they do not survive a clone or
checkout and would fire on style-only saves anyway.

⚠️ **The index is mode-specific.** `excluded_modes` means Ruthless and Standard emit
different block sets, so `wins` differs between them. Key the cache by mode, or store one
index per mode.

**Regenerate partially, not wholesale.** One global hash forces a full rebuild for a
one-block edit. Use two levels instead, and recompute only the affected *bases*:

- **Per-block match hash** over `(targets, conditions)`. Only block X changed → the
  affected set is X's targets **before ∪ after**; recompute `wins` for just those bases by
  walking the ordered list for them alone.
- **Order hash** over the sequence of block identities. If it changes, blocks moved → the
  affected set is the bases claimed by blocks in the moved span.

The subtlety this design exists to handle: **`wins` is global and ripples.** If block #5
gains a target it can flip `wins` for a base that block #20 used to claim, so a naive
per-block cache that only refreshes the edited block's own entries would be wrong. The
ripple is bounded by *bases* rather than blocks, which is what makes the incremental
version both correct and cheap — editing one block costs the bases in that block, not all
~2,890. A style-only edit changes neither hash and costs nothing, which matters because in
a theme editor that is the dominant edit.

⚠️ **Mismatch must be loud.** Regenerating quietly on mismatch is fine; *failing* to
regenerate and silently serving the stale copy is precisely the bug that ran all session —
`create_demo_bundle.py` no-ops without error and the parity test kept reporting 16/16
against a frozen bundle. A cache miss that cannot be satisfied is an error, not a
fallback.

## Sequencing and prerequisites

**Timing.** 3.29 has already started, and the user's call is explicit: *shipping a good
filter matters more than shipping a wrecked one, even if that costs time.* So this is not
racing a date — it is its own branch, taken at the pace correctness needs, with the
`v3.29-ruthless-pre-rewrite` tag as the standing fallback and the current filter shippable
from it throughout.

**Order of work** — two of these are hard prerequisites, not preferences:

1. **H first (bundle baker).** Until `create_demo_bundle.py` stops silently no-opping, no
   verification performed *during* the migration can be trusted — the parity test has
   spent this entire session comparing against a frozen bundle while reporting 16/16.
2. **Capture the generation trace before anything changes.** The migration is driven from
   what each block actually claimed under the *current* engine; that evidence has to be
   recorded first or it is gone.
3. **A (one resolver)** next — it is what makes the preview stop lying, and every later
   step is verified through it.
4. **B / C / D** (data model, drop `base_mapping`, intake artifact) together, since they
   share the migration.
5. **E, F, G** (presets, navigation, retiring Python) after the model is stable.

**Kick off in parallel, now:** the designer's beam/icon vocabulary (E) is an external
dependency with a real turnaround, and it does not depend on any of the code work.

## Verification

1. **Migration is byte-safe**: generate before and after the data migration with the
   *current* engine — outputs must be identical. Proves the move changed nothing before
   any resolver change lands.
2. **One-resolver equivalence**: for every tier block, `styleResolver` output ==
   generator output. This test replaces dual-generator parity as the invariant.
3. **Inline-style flip**: the 216 inline keys now reach the output — spot-check
   `Maps/Scarabs.json` Tier 1 (gold/dark/Orange, not blue/White) and confirm
   `Currency/Gold.json` emits no beam and no icon.
4. **In-game load.** Non-negotiable: every bug found this session passed generation, the
   validator *and* parity, and was caught only by loading the filter.
5. `npx tsc -b`; in the editor create a tier block, confirm it auto-creates a rule, add a
   sound-only rule for two items, and confirm the preview matches the exported blocks
   exactly.
