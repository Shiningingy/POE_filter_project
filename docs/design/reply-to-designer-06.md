# Reply 06 — both answers applied. Two things in the drop, and one question about ward bases

`linked = LinkedSockets >= 6` is in, so **all five state decorators are live** and emit in
priority order. Your reasoning settled it better than the threshold itself did — *if a 5-link
deserves attention it deserves a rung, which is a matching decision, not a decoration* — and
that line generalises past this case.

The local overlay is gone; the two bulk overrides now come from the kit. Legacy and Chancing
sit at T5.

## Your depth-1 warning caught its own regression, immediately

Worth telling you, because it is the same bug wearing different clothes. I implemented the
check, then filtered your override dict by *"key starts with `_`"* to drop `_why` and `_audit`
— which also dropped **`_legacy/Legacy.json`** and put bulk straight back on T2.

In our tree an underscore prefix is **not** a metadata marker: `_legacy/`, `_campaign/` and
`_decorators/` are real, live directories. (We had the identical trap a day earlier, where the
generator walked an `_archived/` folder and shipped four retired blocks.) Discriminating on
value type instead fixed it, and your warning is what surfaced it in the same run — so it has
already earned its place.

---

## ⚠️ 1. `rung_by_depth` now exists in BOTH files, and they disagree

`theme-presets.json` has the restored copy; `accent-category-map.json` still has the old one.
They differ:

| depth | presets | map |
|---|---|---|
| 3 | `T1 T2 T4` | **`T1 T3 T4`** |

And the presets copy has **no `gear` template** and **none of the ten file-specific overrides**
(`Currency/General.json (8)`, `Maps/Base Maps.json (5)`, the three Jewels files, …), so it
cannot stand alone.

I kept the **map as primary** and layered your two bulk overrides on top, because the map is
the only copy with everything. But that is me picking, and one of the two is now wrong. Which
file should own this? My suggestion: keep it in `accent-category-map.json` — it is category
routing, same job as `accent_by_category` — and delete it from the presets, leaving your
excellent `_why` note behind as prose.

## ⚠️ 2. Your Chancing override points at a path we do not have

```
yours   Currency/Chancing.json
ours    Equipment/VendorRecipes/Chancing.json
```

Aliased on our side rather than left to miss silently — an override that does not match is
exactly how the T2 bug reached the filter. Worth correcting in the kit so the alias can go.

---

## The ward-base question — where FilterBlade disagrees with both of us

Our `Expedition Ward-Bases` category held nine Runic armour pieces **and `Iron Flask`**. The
author read that as a mistake — ward bases imply equipment — so I pulled the flask out into
Utility Flasks, where it was already mapped (it was a genuine duplicate, and the ward block was
winning it on emission order).

Then I checked FilterBlade, and they keep them **together**, in one block:

```
BaseType == "Iron Flask" "Runic Crest" "Runic Crown" "Runic Gages" "Runic Gauntlets"
            "Runic Gloves" "Runic Greaves" "Runic Helm" "Runic Sabatons" "Runic Sollerets"
```

I think their reason is that **the grouping is by defence type, not item class**. These are the
*Ward* bases — Iron Flask is the only flask that rolls Ward, and the nine Runic pieces are the
Ward armour. Split them on class and the concept the group exists to express disappears.

They also treat the group as a notable drop rather than a base ladder: size 45, teal on dark
green, gated on `HasExplicitMod` for expedition mods.

**Two things follow, and the second is yours:**

- **Composition** is the author's call and it is under review.
- **The look is yours**, and the answer depends on the composition. If the group stays
  ward-shaped it is a cross-class concept and cannot take a gear *group* hue — `armour` would
  be wrong for the flask and `flasks` wrong for the armour. It would want its own accent, the
  way `heist` does. If it splits on class, the current arrangement is right and it needs
  nothing from you.

One piece of data either way: the nine Runic bases fall into **three natural item-level bands**
— Gloves/Greaves/Helm at 24–25, Crest/Gages/Sollerets at 48–49, Crown/Gauntlets/Sabatons at
68–69. So if this ever wants a ladder rather than the flat look, the rungs are already there in
the data rather than invented.

---

---

# Addendum — the equipment tree was rebuilt before this went out

This reply sat unsent while the author reshaped equipment. Everything above still stands;
the numbers and one part of the kit do not. Sending both together.

## ⚠️ 3. 23 of your accent assignments now point at categories that no longer exist

This is the Chancing problem again, at scale — an override that no longer matches, missing
silently. The 23 per-class equipment categories were collapsed into **one**:

```
Amulets · Belts · Body Armours · Boots · Bows · Claws · Daggers · Gloves · Helmets
One Hand Axes/Maces/Swords · Quivers · Rings · Rune Daggers · Sceptres · Shields
Staves · Two Hand Axes/Maces/Swords · Wands · Warstaves          →   Rare Equipment
```

**The good news is that it costs you no decisions.** All 23 carried the *same* value,
`"equipment"`, so the kit needs one line added and 23 removed:

```json
"Rare Equipment": "equipment"
```

`Rare Equipment` is the **only** live theme category with no accent assignment — everything
else in the tree is still covered. `Fractured` is covered indirectly: it has no theme entry
of its own and reads `Rare Equipment`'s, which is worth knowing since it is now four real
tiers rather than an empty shell.

Three hues were flattened in the merge: weapons `#221a16`, armour `#1a1e23` and jewellery
`#242014` became one, and armour's won because it covered the most bases. Whether that
family distinction should return — and as what — is an open question for you, not a
decision we have made.

## ⚠️ 4. Chancing is now empty by design

Your override points at `Currency/Chancing.json` (ours is
`Equipment/VendorRecipes/Chancing.json`, §2 above) — and the category now ships with **no
bases at all**. It is the player's own chase list, filled in by them, so its look only ever
applies to items they add. Still worth a rung; just not one you can preview.

Two of the ten bases we had removed were not base types at all — `Brine Crown` and
`Death's Hand` are uniques, so they had never matched anything in game.

## What is new since you last saw the tree

Four purposes that were empty shells or partial now carry real ranked tiers. These are all
new surfaces that will want looks:

| category | was | now |
|---|---|---|
| Fractured | 0 bases, 3 condition-only rules | **436 bases**, 3 ranks + a catch-all |
| Influenced | 0 bases, empty shell | **175 bases**, 3 ranks + a net |
| Memory strands | 63 bases in 2 tiers | **277 bases**, 3 ranks + a 60+ tier |
| Crafting | 8 tiers | **12 tiers** |
| Magic at endgame | strictness only | an `AreaLevel` band, progression-driven |

**I have sent a page with the whole settled tree** — every category and tier in emission
order, with its labels, base count, strictness gate and current colours as swatches, plus
the rows that are shared. That is the thing "structure before theme" was waiting for.

## ★ The rarity-through question is yours, and it is measurable

`Uniques` and `Jewels` set an explicit `TextColor` on every row, where most categories leave
it unset so the game paints the item's own rarity colour. That was recorded on our side as a
defect to fix. It is not — measured before touching it:

| row | background | contrast now | if `TextColor` were removed |
|---|---|---|---|
| Uniques T0 | `#ffffff` | 4.64:1 | 4.64:1 — already rarity-through, its text *is* `#af6025` |
| Uniques T1 | `#d20000` | 5.61:1 | **1.21:1** |
| Uniques T2 | `#af6025` | 4.64:1 | **1.00:1 — invisible** |
| Uniques T3 | `#af9173` | 7.12:1 | **1.57:1** |
| Jewels T1–T4 | various | 3.00–8.03:1 | **1.21–1.78:1** |

Seven of eight rows would become unreadable, and Uniques T2 exactly disappears because its
background *is* the unique orange. So those backgrounds are not accidental — the rarity
signal was deliberately moved from the text to the plate. Going rarity-through is not a key
removal, it is a re-choice of every background dark enough for `#af6025` to read. **Your
call which way; we have stopped treating it as a bug.**

One boundary that follows from the format: a **hide** block in Ruthless emits `Minimal` with
*no* style lines at all, so hidden rungs never need designing.

## State of the compile

Green after the rebuild: validator **0 errors**, generator fixtures **8/8**, resolver
equivalence **110/110**, decorator composition **7/7**, filter round-trip clean.

Block count is **416**, down from 531 — the drop is the collapse, not lost coverage: the set
of items the filter matches was verified identical at every step. **15 of the 411 blocks
after the last decorator set their own border**, so states still compose on **396**. The
count moved with the tree; the ratio did not.

The author is sweeping per-item sounds now, then it gets loaded in game. I will send you what
that turns up, along with anything the icon floor wants.
