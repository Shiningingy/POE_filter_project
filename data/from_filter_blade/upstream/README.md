# FilterBlade public assets — upstream snapshot

Fetched from [NeverSinkDev/FilterBlade-Public-Assets](https://github.com/NeverSinkDev/FilterBlade-Public-Assets),
`FbPoe1Configs/`, pinned to commit **`766a5aa2c3ebddc08117521f4545e72c5af807bf`**
(2026-07-31, "sync from FB to GitHub 6403 - csv updates talisman implicit").

★ **These assets ARE 3.29.** 3.29 launched on the **international** realm 2026-07-22; the
**China** realm followed 2026-08-01. This pin is 2026-07-31 — nine days into the league, and
after GGG's own 3.29 filter-info thread (posted 07-21). Corroborated by the contents: it
carries Allflame Embers, Enshrouding Crystals, Mercenary Warrants, Ducats and the four
Zorath's Eyes.

⚠️ **Do not anchor league dates on the China launch.** This repo ships against the
international realm, and using the CN date made a current snapshot look three weeks stale and
nearly got the whole cross-check written off. Both halves of
`parsing_tool/check_filterblade_diff.py` are trustworthy against this pin.

## Why this exists next to `../3.28/`

`../3.28/` is a hand-taken snapshot from 2026-06-06 and is the reference point our
existing analysis is anchored to — leave it alone. **This repo is live-synced from
FilterBlade**, several commits a week, so a copy goes stale in days. All five files
already differed from the June snapshot when this was taken (`Mods.csv` had just
been reworked and is 2.4x larger).

Re-pull with the commit recorded above bumped:

```sh
SHA=$(curl -s https://api.github.com/repos/NeverSinkDev/FilterBlade-Public-Assets/commits/main \
      | python -c "import json,sys; print(json.load(sys.stdin)['sha'])")
for f in BaseTypes.csv CustomizerDefault.options Mods.csv Overview.options bonusItemInfo.json; do
  curl -sL "https://raw.githubusercontent.com/NeverSinkDev/FilterBlade-Public-Assets/$SHA/FbPoe1Configs/$f" -o "$f"
done
```

PoE2 equivalents live under `FbPoe2Configs/` in the same repo — not fetched, but there
when we extend.

## What each file is good for

| file | contents |
|---|---|
| `bonusItemInfo.json` | **the valuable one** — see below |
| `BaseTypes.csv` | per-base `DropLevel`, `DPS`, implicits, `SubGroup A` league-source code |
| `Mods.csv` | mod pool; reworked to a JSON dict 2026-07-28 |
| `Overview.options` | the *presentation* tree for FilterBlade's Overview tab — `StyleSection` titles, player-facing descriptions, representative items. Not the tierlist taxonomy; useful as reference copy |
| `CustomizerDefault.options` | Customizer defaults |

## `bonusItemInfo.json`

1057 annotated items across 9 sections — Currency 127, Fossil 29, DeliriumOrb 12,
Oil 16, DivinationCard 401, Fragment 58, Scarab 123, SkillGem 51, Uniques 240.
Shape is `bonusItemInfo -> <section> -> items -> <BaseType> -> {text, tags[]}`,
and for uniques a further `items -> <uniqueName> -> {text}`.

```json
"Astragali": { "text": "Brought to Gwennen to refresh her vendor inventory",
               "tags": ["Expedition", "LeagueDrop"] }
```

`itemTagDefinitions` carries 23 tags with displayName/description/group. The ones
worth knowing about:

- **`RuthlessOnly`** — "Only obtainable in Ruthless leagues"
- **`StandardOnly`** — "Only obtainable in Standard leagues"
- `NonDrop` — "Does not drop on the ground without the player doing so"
- drop-source tags: `Generic`, `LeagueDrop`, `BossDrop`, `Heist`, `Beyond`, `Harvest`,
  `Lab`, `Eldritch`, `Expedition`, `Blight`, `Ancestors`, `Catalyst`
- outcome tags: `CurrencyOutcome`, `UniqueOutcome`, `MapOutcome`, `GemOutcome`,
  `SixLinkOutcome`, `InfluencedOutcome`

⚠️ **The mode tags are thin — corroboration, not a source.** As of this commit
`RuthlessOnly` is on exactly one item (Eternal Orb) and `StandardOnly` on one
(Veiled Scarab), against the 21 items our own wiki extraction covers in
`data/from_wiki/ruthless_droppability.json`. Both are `isHiddenByDefault: true`,
so NeverSink models the axis deliberately — but FilterBlade targets Standard, and
its treatment of a drop-disabled item is often the *opposite* of what Ruthless
needs. Never let these tags override first-hand play knowledge (see ADR-0005 and
the Thief's Trinket case).
