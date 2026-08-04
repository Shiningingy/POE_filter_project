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

## State of the compile

Applied to the tree and green: validator 0 errors, generator fixtures 8/8, resolver equivalence
164/164, decorator composition 7/7, format check 531 blocks with 0 problems. **15 of 524 blocks
after the last decorator set their own border**, so states compose on 509 — unchanged by this
round, which is what we wanted.

The author is doing a manual pass now (a per-item sound sweep, some tier sorting), then it gets
loaded in game. I will send you what that turns up, along with anything the icon floor wants.
