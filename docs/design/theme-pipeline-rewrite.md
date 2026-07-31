# Theme pipeline rewrite — tier block owns its look, rules own matching

> **Status: agreed design, not yet built.** Settled with the filter's author on
> 2026-07-31 after a read-only audit of the whole pipeline (three exploration passes over
> the generators, the editor surface and the rules model). Everything under *Target model*,
> *Settled* and *Sequencing* is a decision, not a proposal — the two items still marked
> ⚠️ inside the cache section are implementation constraints, not open questions.
>
> Nothing here is implemented. The shipping filter is unaffected and remains buildable
> from the `v3.29-ruthless-pre-rewrite` tag throughout.
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
- **Auto-sound is deleted.** Its intent was to make the Sharket sound library shine
  conveniently; in practice it created more problems than it solved.
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
  hardcoded default`. Immediately revives the 216 authored inline keys and the discarded
  `Gold.json` beam/icon suppression.
- **Split `overrides`**: `Tier` becomes the block identity (matching), and the style
  channels become an explicit, narrow **deviation** on the rule rather than a parallel
  styling surface. Resolution stays `rule deviation → block style → preset → default`,
  which is what already ships; the change is that the block — not a theme grid keyed by
  category × tier number — supplies the base.
- **Delete auto-sound.** Convert the 122 currently-synthesised sounds into **explicit,
  visible rules** in the one-shot migration so nothing is lost but nothing is magic. This
  retires all three suppression levers (`already_handled`,
  `suppress_basetype_sounds`, `suppress_auto_sound`) — you delete a rule you don't want.
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

Generation order is an **input**, not the subject: `wins` is derived from it, since
first-match-wins means the earliest block claims the base and every later occurrence is
dead. The Chaos Orb case above is real — it appears in a hand-written rule *and* a tier
base list, and consequently plays the generic `通货.mp3` instead of its curated
`混沌石.mp3`. Nothing in the editor shows that today.

- The **sound picker** and **bulk editors** query it for "where does this base appear?"
  instead of walking the tree — the operation they already perform, made cheap.
- `wins` records which occurrence actually claims the base under first-match-wins. **That
  is what nobody can see today** — the direct cure for the recurring "mapped but emits
  nothing" bug class (525 entries on undeclared tier keys, the 13 silent quivers, the
  Blueprints rules that matched nothing). It also turns the coverage report into a live
  view instead of a script re-run by hand.
- Bases with **zero** entries are the gap list, for free.

Feature check — nothing is lost:
- **Sound picker**: appends a rule to the tier block instead of to `base_mapping`. Same
  operation, better home.
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
  override writer. Retire `custom_overrides.json` (empty) and `roles.json` (unread).

### F. Navigation

`category_structure.json` grows a Subcategory level; the editor renders Title/Category in
the navbar and Subcategory as expandable groups of tier blocks. Delete the third
theme-category identity so the theme board and the generator key off the same thing.

### G. Retire the Python generator

Go TS-only; delete `generate.py` and `test_generator_parity.mjs`, keep a thin CLI wrapper.
An ADR-0001 reversal, so it needs its own ADR. Every bug fixed this session had to be
fixed twice, against a parity test that was itself comparing to a stale bundle.

### H. Prerequisite — fix before migrating

`create_demo_bundle.py` silently no-ops as a CLI script, so `test_generator_parity.mjs`
compares fresh Python against a **stale** bundle. Every parity result is untrustworthy
until this is fixed. The bundle also drops sound files on every bake.

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
