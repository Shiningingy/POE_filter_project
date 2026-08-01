# GGPK extraction

Step 1 of the own-database pipeline: pull the curated table set straight out of
the game's bundles into `data/source/<label>/`.

This replaces the per-league scramble for FilterBlade's `BaseTypes.csv`. It
produces **raw tables only** — joining them into a catalog is step 2's job. See
[ADR-0004](../../docs/adr/0004-catalog-curation-split-and-ggpk-join-keys.md) for
why the catalog and our curation (`base_mapping`) are kept separate, and which
keys are safe to join on.

## Setup

```bash
npm install --prefix parsing_tool/ggpk
```

`postinstall` applies `patches/pathofexile-dat+15.2.0.patch` — see
[The Simplified Chinese patch](#the-simplified-chinese-patch). The version is
pinned exactly because the patch is cut against that build.

## Run

```bash
# CDN — no game install needed. The only leg that has the current league
# during the window where the China client still lags.
python parsing_tool/ggpk/extract.py --source cdn --patch latest

# Local install — reads Bundles2/_.index.bin directly, no GGPK extraction step.
python parsing_tool/ggpk/extract.py --source local \
    --game-path "D:\WeGameApps\<game folder>" --label cn-3.29
```

Useful flags: `--languages`, `--tables` (limit the run while iterating),
`--drop-column Table.Column`, `--offline` (reuse the cached schema).

### Which leg, and when

| | CDN | Local install |
|---|---|---|
| Needs a game install | no | yes |
| Has the current league | immediately | only once that client patches |
| English | yes | yes |
| Traditional Chinese | yes | yes |
| **Simplified Chinese** | **no** | **yes (China client only)** |

The China client is the only source of Simplified Chinese, and it yields English
from the same dump with `Id` perfectly aligned — so once it has the league, one
local run covers both languages and the CDN leg is redundant.

Until then the CDN leg with **Traditional Chinese** is the fallback. That is
cosmetic-only risk: filter `BaseType` lines are always English, so zh drives
editor display and block comments, nothing that ships in the `.filter`.

## Output

```
data/source/<label>/
    manifest.json                    <- committed
    tables/<Language>/<Table>.json   <- gitignored
```

Raw dumps are ~40 MB per league (three quarters of it `Mods`) and regenerate
deterministically from the patch version, so they are build artifacts. The
manifest is committed: it records the patch, the tool and schema versions, and
the exact columns and row counts, so every league's extraction stays on the
record even though the bytes don't.

`.work/` holds `config.json`, the fetched schema, and the CDN bundle cache
(~45 MB). Keeping it means a repeat run of the same patch never re-downloads.

## Reconcile — the league work queue

Extraction answers *what does the game contain*. Reconcile answers the question
league maintenance actually asks: **what changed, and what do I have to decide?**

```bash
python parsing_tool/ggpk/reconcile.py --label 3.29.0.2.2 \
    --baseline data/from_ggpk/baseitemtypes.json \
    --html "$HOME/Documents/poe-league-maintenance.html"
```

**Always pass `--baseline`.** It is the difference between a usable queue and an
unusable one: with the previous patch to diff against, the headline queue is
what *this* patch added — a couple of dozen rows. Without it, the queue is every
base we have never mapped, which was 893 on the first run and mostly ancient.
The baseline is a `data/source` label or a path to an older `BaseItemTypes`
dump; the diff is computed on `Id`, never on row index or name.

| Queue | Meaning |
|---|---|
| **Emitting nothing** | mapped to a tier key that doesn't exist — see below |
| **New this league** | the patch added it, nothing covers it — *the work* |
| **Removed** | gone from the game, we still map it (usually a rename) |
| **Backlog** | never mapped, not new — carried over, dip in when there's time |
| **Retired** | we moved it to `_legacy`, the game still ships it |
| **Not in the game** | we map it, GGPK has no such base |
| **Class headers** | declared `item_class` disagrees with the members' real class |

**Nothing is applied automatically.** GGPK says what exists, not what drops, so
a row is a question, never an instruction.

### The console is a cheap editor, not a report

`--html` writes a standalone page: filter by item class, tag rows with a
**category and tier**, and export. Decisions are keyed by patch label in
`localStorage`, so closing the tab doesn't lose the session.

`M`/`L`/`S` decide the row under the cursor, `X` selects it. The bulk path is
the point — filter the class rail to `Map Fragments`, search `Scarab`,
**Select all shown**, and assign 27 items to one tier in a single action. Tier
choices come from the category's real `tier_order`, never free text.

Then close the loop:

```bash
python parsing_tool/ggpk/apply_decisions.py decisions.json          # dry run
python parsing_tool/ggpk/apply_decisions.py decisions.json --write
node filter_generation/generate.mjs --mode ruthless
```

`apply_decisions.py` writes into `base_mapping` and fills missing zh from the
dump (reporting every one it added, since those are machine translations, not
hand-tuned). It refuses to write a tier that isn't in the target's `tier_order`,
and refuses to re-home a name that's already mapped in a *different* file —
re-tiering within the same file is allowed, which is how the queue below is
fixed. `skip` writes nothing at all.

### "Emitting nothing" — the queue that outranks the others

A tier key that isn't in the category's `tier_order` does **not** error. The
generator appends it to the order, then skips it for having no tier entry
([filterGenerator.ts](../../webapp/frontend/src/utils/filterGenerator.ts)) — so the
items produce no output at all. Underscore folders (`_legacy`, `_campaign`) are
exempt: they remap undeclared keys to their first non-hide tier on purpose.

On the first run this found **525 already-curated entries emitting nothing**,
including all 420 divination cards. Every one used the item *class* name where
the category's tier suffix was wanted — `Tier 1 Divination Cards` against a
declared `Tier 1 Cards` — so they are renames, not re-tierings. The console
suggests the matching declared tier in the same file for each.

Because of this, the destination picker only ever offers **declared** tier keys.
Offering the in-use spelling back would let you "fix" a dropped entry by writing
the same dead key again.

Three things the tool deliberately does *not* treat as findings:

- **Coverage by `Class` rather than by name.** Whole categories select on
  `Class` — every map is handled by one rule in `Maps/Base Maps.json` — so
  checking `mapping` keys alone reported 229 maps as unmapped. `reconcile.py`
  scans `tier_definition/` for `Class` conditions and counts them as coverage.

- **Umbrella class headers.** `Unique Items`, `Weapons`, `Legacy` are not GGPK
  class names; files carrying them are *supposed* to span classes. Only a label
  that names a real class while describing none of its members is wrong.
- **Transfigured gems.** They are composed from `GrantedEffects`/`ActiveSkills`
  and appear in **no** table we extract — not even `Ice Nova of Frostbolts`.
  Their absence proves nothing about our data. (FilterBlade doesn't enumerate
  them either; it matches `TransfiguredGem True` instead.)

Non-drop item classes (hideout doodads, microtransactions, quest items…) and
retired-mechanic classes (Allflame Embers, Corpses, Leaguestones…) are held out
of the queues. Both counts are printed by the tool and stated on the console's
header — a silent cap would read as "we covered everything".

## Why the column list is curated

`tables.json` requests only the columns we actually consume. That isn't tidiness:

- The published dat-schema is always **latest**. Against an older client the
  trailing columns of a table don't exist yet, so the reader walks past the end
  of the row and dies with `RangeError: Offset is outside the bounds of the
  DataView`. `BaseItemTypes.TalismanEnchants` is the last column and the usual
  trigger — drop it for a lag-window dump.
- Tables are defined **twice** in the schema, PoE1 and PoE2, with different
  column names. `extract.py` filters on `validFor` bit 1; without that you
  silently get PoE2's shape.
- Every requested name is validated against the schema before the exporter runs,
  so a GGG rename fails loudly here instead of looking like an item vanished.

Adding a column is deliberate: add it to `tables.json`, say why in `why`, re-run.

## Verification

Column-name validation cannot catch a column **inserted mid-table** by a newer
schema — every later offset shifts and the reader returns plausible garbage. So
`extract.py` asserts known-true values after the export (Chaos Orb's `Id`
resolves to `StackableCurrency`, Exalted Orb's `DropLevel` is 35, row counts
clear their floors) and fails the run rather than staging a bad dump.

One check earns its place specially: **the translation probe.** The exporter
falls back to the English file when a language folder is absent, so asking for a
language the source doesn't have gives you an English dump wearing a zh label,
with no error. The probe asserts the value actually differs from English.

## The Simplified Chinese patch

`pathofexile-dat` hardcodes its language list and has no Simplified Chinese
entry. That, not the install, is why zh never appeared in earlier attempts. The
patch is one line:

```js
{ name: 'Simplified Chinese', path: 'Data/Simplified Chinese' }
```

Verified against the China client: EN 5348 rows / SC 5348 rows / `Id` overlap
5348 (100%), and CN-exclusive items get **both** names (`Stone of Wisdom` /
`智慧之石`) — filter-usable strings FilterBlade's CSV can never supply.

Worth upstreaming. Until then, `extract.py` refuses to run a Simplified Chinese
export if the patch isn't applied, rather than let the English fallback through.

## Dead rows share live names — always filter Royale and `[DNT]`

**Every join that keys on a display `Name` must drop `Royale` and `[DNT]` rows
first.** They are not exotic edge cases; they reuse the names of real items with
*different numbers*, so letting them through silently overwrites good data with
bad and nothing looks wrong afterwards.

```python
if 'Royale' in row['Id'] or (row.get('Name') or '').startswith('[DNT]'):
    continue
```

Path of Exile Royale was a limited-time mode, long dead, but its rows still ship.
`Metadata/Items/Gems/SkillGemClarityRoyale` is named **"Clarity"** and requires
level 1, where the real Clarity requires 10 — a name-keyed dict built without the
filter ends up with the Royale value, because it happens to come second. The same
trap caught `Fireball` (Royale drop level 1 vs the real 5).

`[DNT]` ("do not translate") marks unfinished or internal content GGG left in the
data. `SkillGems` additionally carries monster and NPC skills — `Death Aura`,
`Blinding Aura`, `Order: To me!`, `Playtest Slam`, `[UNUSED] Blitz` — which are
not obtainable items at all. Seeding a curation list from that table without
filtering pulls in ~80 of them.

This is the `Name`-side companion to ADR-0004's join rule: join on `Id`, and even
then, decide which `Id`s are real.

## Known limits

**GGPK tells you what EXISTS, not what DROPS.** 3.29 still ships all 78
talismans — including the 26 FilterBlade retired — with their implicits intact.
GGG disables drops without deleting data. So never auto-retire an item to
`_legacy` on GGPK absence, and never read GGPK presence as "it drops".
Droppability has to come from elsewhere: FilterBlade's CSV as an oracle, drop
tables, or our own curation.

**Drop *location* is not in GGPK either.** FilterBlade's `bonusItemInfo.json`
prose ("Drops from Blueprints", `BossDrop`/`LeagueDrop`/`RuthlessOnly` tags) is
hand-curated editorial research. We seed from it once, then own it.
