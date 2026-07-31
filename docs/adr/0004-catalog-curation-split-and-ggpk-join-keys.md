# ADR-0004: Item data comes from GGPK as a generated *catalog*, joined by `Id`; curation stays name-keyed

## Status
Accepted.

## Context

Item data (class grouping, drop levels, stats, zh names) has always come from FilterBlade's
`BaseTypes.csv`, re-pulled by hand each league. That is a third-party asset on someone else's
release schedule, and 3.29 exposed its limits concretely: all 95 new-league rows shipped with
**names only** — every stat column (`SubGroup Tier`, `Game:Implicit 1`, armour/evasion/ES,
`Corrupted`) was empty, which blocked talisman tiering entirely.

The project goal is our own database and a league-to-league maintenance workflow, so that
shipping a new league is a small reconcile rather than a massive import.

Two facts shape the design:

1. **Data acquisition is inherently two-source.** GGG's international patch CDN does not carry
   Simplified Chinese game data; the China (WeGame/Tencent) client ships different files. The
   established workflow is therefore: **international CDN for structure + English, local CN
   `Bundles2/_.index.bin` for translations.** Both legs must be joined.
2. **The China client lags.** Global 3.29 shipped 2026-07-24, the China server 2026-08-01, so
   for the gap there is *no* Chinese text for new items. Missing translation is a normal
   state, not an error.

That makes "what do we join on?" the load-bearing question. It was settled empirically by
comparing the two dumps we already have on disk
(`data/from_ggpk/baseitemtypes.json` vs `data/from_ggpk/ch_simplified/baseitemtypes.json`):

| Candidate key | Result |
|---|---|
| **`Id`** (`Metadata/Items/...`) | **5334 / 5334 international Ids present in CN. Zero misses.** |
| `_rid` (row index) | **Differs on 5027 of 5334 shared Ids (94%).** |
| English `Name` (the method in use) | 413 duplicate names; **43 carry genuinely different zh text**. |

## Decision

**1. Two layers with a hard boundary.**

- **Catalog** — 100% generated from GGPK, **never hand-edited**, regenerated per patch.
  Holds identity, class, drop level, stats, and per-language names.
- **Curation** — 100% ours, hand-maintained: `base_mapping/**`, `tier_definition/**`,
  `category_structure.json`, themes. Must survive catalog churn.

Neither may be derived from the other. The API and `create_demo_bundle.py` both consume a
shared library; the build pipeline must **not** import the web server (today
`create_demo_bundle.py` reads `webapp/backend/main.py` module globals — that inversion is
what this ADR's migration removes).

**2. Join keys — non-negotiable.**

- The catalog is keyed by **`Id`**. It is the only key valid across languages *and* across
  renames.
- **Never join on `_rid`.** Row indices are not stable between the international and CN dumps.
  The first ~300 rows happen to align, so a spot-check looks correct while 94% of the table is
  silently mismatched.
- Joining on English `Name` is **ambiguous** and must not be used for translation lookup.

**3. Curation stays keyed by display name — deliberately.**

The filter's matching unit is the BaseType *string*, and several `Id`s can legitimately
collapse into one name: `Two-Toned Boots` is three metadata rows
(`BootsAtlas1/2/3`, which CN distinguishes as 异色鞋 (火冰)/(火闪)/(冰闪)) but exactly **one**
filter concept. Keying `base_mapping` on `Id` would force three entries for one rule and make
the data less readable, for no gain. It also avoids migrating ~4,376 existing entries.

**4. The bridge: the catalog maintains `name → {Id set}`.**

This is what makes renames cheap without Id-keying the curation. When a display name changes
but its Id set does not, the pipeline recognises a **rename** (not delete+add) and proposes
migrating the mapping key, preserving the tier. 3.29 had at least four such renames
(`Dark Pact`→`Dark Bargain`, `Omen of Blanching`→`Omen of Trichromatism`, two Abyss Scarabs),
each handled by hand this time.

**5. A league is a `reconcile`, not an import.**

Refresh catalog → diff against the previous catalog by `Id` → classify **added / removed /
renamed** → check against curation → emit a work queue: unmapped-new items to tier, removed
items to retire to `_legacy`, renames to auto-migrate. Humans resolve only the queue.

**6. Missing translation is a supported state.** Fall back to English and mark the item
"translation pending" (the existing `loc[lang] → loc.en → key` chain, CONTEXT.md invariant #9).
The pending list doubles as the per-league zh to-do queue.

## Consequences

- **We can see things the CSV cannot.** The CN dump contains 3 real CN-exclusive currency
  items — 智慧之石 / 敏捷之石 / 力量之石
  (`Metadata/Items/Currency/CurrencyStoneOf{Wisdom,Agility,Power}`) — that the international
  client, and therefore FilterBlade's CSV, structurally cannot report.
- **Royale is a non-problem.** Of 167 `*Royale` rows, 165 share an English name with a normal
  item and are already matched by existing blocks; only 2 have distinct names.
- The catalog gains a genuinely better "which league introduced this item" signal than
  FilterBlade's `SubGroup`: the first patch snapshot in which an `Id` appears. That requires
  keeping per-patch catalog snapshots.
- Implicits require `Mods` + `Stats` tables to render as text (GGPK stores
  `Implicit_ModsKeys` as unresolved integer references — this is why
  `build_items_db.py` leaves `implicit: []`). Until those are dumped, the CSV remains a useful
  *stat supplement*; the recommended path is hybrid, not cold-turkey.
- A larger automated pipeline writing into `base_mapping` raises the value of the typed
  validator (C2): 3.29 already produced a silently corrupt mapping file that the generator's
  bare-`except` skipped, dropping 102 currency entries with no error.
- Superseding this — e.g. going pure-GGPK with no CSV, or Id-keying curation after all —
  should be a new ADR referencing this one, not an incremental refactor.
