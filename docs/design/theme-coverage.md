# Theme coverage — what still needs authoring

Generated. Each row is a `theme_category` declared somewhere in
`filter_generation/data/base_mapping/**/_meta.theme_category`, with the tier
numbers that category actually uses.

The generator resolves colours as `sharket_theme.json[theme_category]["Tier N"]`.
A missing key falls back to `Default` silently, which is how the entire currency
tree ended up on the default ramp.

`Tier custom` cannot be authored — those tiers need real numbers first.

## Needs authoring (33)

| theme_category | tiers used | bases |
|---|---|---|
| `Abyss Socketed` | 5, 9 | 0 _(empty — no rush)_ |
| `Blight Anointed` | 5, 9 | 0 _(empty — no rush)_ |
| `Breach` | 0, 1, 2, 3, 9 | 7 |
| `Breach Grasping Mail` | 5, 9 | 1 |
| `Breach Rings` | 5, 9 | 0 _(empty — no rush)_ |
| `Crafting Bases` | 1, 2, 3, 4, 5, 9 | 171 |
| `Currency` | 0, 1, 2, 3, 4, 5, 6, 7, 9 | 87 |
| `Curse of the Allflame` | 1, 2, 3, 4, 5, 6, 9 | 17 |
| `Enshrouded Gear` | 2, 9 | 5 |
| `Enshrouding Crystals` | 2, 9 | 5 |
| `Expedition Ward-Bases` | 5, 9 | 10 |
| `Fragment Splinters` | 0, 1, 2, 9 | 7 |
| `Heist` | 0, 1, 2, 3, 4, 9 | 22 |
| `Heist Experimented` | 5, 9 | 47 |
| `ID Bestiary` | 5, 9 | 0 _(empty — no rush)_ |
| `ID Delve` | 5, 9 | 0 _(empty — no rush)_ |
| `ID Essence` | 5, 9 | 0 _(empty — no rush)_ |
| `ID Incursion` | 5, 9 | 0 _(empty — no rush)_ |
| `ID Mercenaries` | 5, 9 | 0 _(empty — no rush)_ |
| `ID Warband` | 5, 9 | 0 _(empty — no rush)_ |
| `Incursion Vials` | 2, 9 | 9 |
| `Linked` | 5, 9 | 0 _(empty — no rush)_ |
| `Mirror Ring Bases` | 5, 9 | 5 |
| `Oils` | 0, 1, 2, 3, 9 | 16 |
| `Omens` | 0, 1, 2, 3, 9 | 12 |
| `Relics` | 2, 9 | 1 |
| `Ritual BaseTypes` | 5, 9 | 27 |
| `Runegrafts` | 0, 1, 2, 9 | 21 |
| `Sacrificial Garbs` | 5, 9 | 1 |
| `Stygian Vise` | 5, 9 | 1 |
| `Tainted Currency` | 1, 2, 3, 4, 9 | 11 |
| `Talismans` | 5, 9 | 43 |
| `Veiled` | 5, 9 | 0 _(empty — no rush)_ |

## Already in the theme file (44)

| theme_category | tiers used | authored | gaps |
|---|---|---|---|
| `Amulets` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Belts` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Body Armours` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Boots` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Bows` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Campaign` | 2, 3, 4, 5, 6, 7, 9 | 9 | — |
| `Chancing` | 2, 9 | 7 | — |
| `Claws` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Daggers` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Delirium Orbs` | 0, 9 | 7 | — |
| `Divination Cards` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Essences` | 0, 1, 2, 3, 9 | 7 | — |
| `Fossils` | 0, 1, 2, 3, 9 | 7 | — |
| `Gloves` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Gold` | 0, 1, 2, 9 | 7 | — |
| `Harvest` | 0, 1, 2, 3, 9 | 7 | — |
| `Helmets` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Legacy` | 1, 9 | 7 | — |
| `Life Flasks` | 0, 1, 2, 9 | 7 | — |
| `Mana Flasks` | 0, 1, 2, 9 | 7 | — |
| `Map Fragments` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Maps` | 0, 1, 2, 3, 4, 9 | 8 | — |
| `One Hand Axes` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `One Hand Maces` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `One Hand Swords` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Quest Items` | 1 | 7 | — |
| `Quivers` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Rings` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Rune Daggers` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Sceptres` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Shields` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Skill Gems` | 0, 1, 2, 3, 4, 5, 9 | 7 | — |
| `Staves` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Support Gems` | 0, 1, 2, 3, 9 | 7 | — |
| `Tinctures` | 0, 1, 9 | 7 | — |
| `Trinkets` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Two Hand Axes` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Two Hand Maces` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Two Hand Swords` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Uniques` | 0, 1, 2, 3, 9 | 7 | — |
| `Utility Flasks` | 0, 1, 2, 9 | 7 | — |
| `Vendor Recipes` | 0, 1, 2, 3, 9 | 7 | — |
| `Wands` | 0, 1, 2, 3, 4, 9 | 7 | — |
| `Warstaves` | 0, 1, 2, 3, 4, 9 | 7 | — |
