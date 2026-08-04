# GGG's official Item Filter Information posts

**The authoritative answer to "what is legacy" — and we found it late.** GGG publishes an
*Item Filter Information* thread in the Announcements forum (forum 54) for **every league**,
and it is exactly the intake feed this project has been reconstructing by hand from the wiki
(which 403s every fetch) and from FilterBlade snapshots (which go stale in days).

Each post carries the same sections:

| section | why we care |
|---|---|
| **New Keyword** | a filter condition the game now accepts — our validator and condition picker need it |
| **Removed Item Filter Conditions** | a condition that now fails to parse |
| **New Items** | league intake: what to curate |
| **Removed Items** | what to retire — the thing we kept getting wrong |
| **Returning Items** | ⚠️ **removal is not permanent.** See below |
| **Renamed Items** | a stale name in `base_mapping` silently matches nothing |
| **Map Tiers** | the map ladder |

## ⚠️ "Removed Items" means NO LONGER DROPS — the basetype survives

**All 61 items GGG retired in 3.29 are still in `BaseItemTypes`.** Retirement stops the drop;
it does not delete the base. Three consequences:

- A retired base stays **matchable**, which is exactly why `_legacy/Legacy.json` is right to
  keep them — a player's stash still holds the item.
- **Basetype survival is therefore not evidence of anything.** It is true of every retired
  item, so it cannot distinguish "reworked into a unique's base" from "plainly retired".
- The "not in `BaseItemTypes`" check can never catch a retirement. It catches a different bug
  — a name that matches nothing at all.

## Three sources, and they answer different questions

| source | answers |
|---|---|
| GGPK `BaseItemTypes` | what **exists** (ADR-0004) |
| this timeline | what **drops**, per version |
| `data/from_filter_blade/` | what a maintained filter **still matches** |
| `data/from_wiki/ruthless_droppability.json` | what Ruthless **subtracts further** |

`reconcile.py` triangulates the first three and flags **disputes** — GGG says removed but
FilterBlade still lists it. FilterBlade tracks basetypes closely per league, so a dispute is
worth a look before acting on it. On the 3.29 run there were **0 disputes across 58 items**.

## ⚠️ Status is a TIMELINE, not a flag

GGG brings drop-disabled content back. Tattoos were removed and returned; six divination
cards returned in 3.26 after being gone. So an item's status is **its most recent event**,
never the first one found:

```
Tattoo of the Ngamahu Firewalker   removed 3.22  ->  returning 3.24   =>  LIVE
Growing Wombgift                   new 3.27      ->  removed 3.28     =>  LEGACY
```

`timeline.json` is built that way: every event is stamped with the version it happened in,
and `resolve_status()` takes the last one. `docs/league_timeline.csv` supplies the
version↔date map, which is what orders the events — the forum thread titles are marketing
names and do NOT match league names (*Secrets of the Atlas* is the Mercenaries league,
3.26.0), so threads join to versions **by date**, not by title.

## Two things this immediately told us

- **`Vestigial` (3.29) and `Imbued` (3.28) are filter keywords we do not support.** Both were
  published months before we would have found them by loading the filter in game.
- **`TransfiguredGem` was published in the 3.23 post.** We discovered it by hand and wrote it
  into `CLAUDE.md` as a game truth. It had been documented all along.

## Refreshing this

`thread_index.json` lists every post found (2016→2026) with its URL. To take a new league:
fetch the thread for the new version, append its events to `timeline.json`, re-run
`parsing_tool/ggg_filter_info/reconcile.py`. Nothing here is scraped automatically — the
posts are prose with spoiler blocks, so extraction is a read-and-record step, and the
`_complete` flag on each section records whether the list was captured in full or truncated.

⚠️ **This is "what GGG says drops", not "what drops in Ruthless".** Ruthless subtracts further
— see `data/from_wiki/ruthless_droppability.json` and
`[[reference-ruthless-exclusive-drops]]`. Both filters apply.
