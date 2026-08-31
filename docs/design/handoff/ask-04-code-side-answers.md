# ask-04 — answers to `questions-for-code-side.md`

Measured 2026-08-30 against the current tree. Four of your ten are answered from data;
the rest need in-game time or a trace run and are marked with who owns them.

---

## 1 · Gear group membership — **derive it, don't hand-map it** ✅ ANSWERED

**`item_class` survives, and it is on the mapping file where you hoped.**

- `_meta.item_class` is present as `{ en, ch }` on **65 of 68** `base_mapping` files.
  The only three without it are `Jewels/Abyss Jewels`, `Jewels/Base Jewels`,
  `Jewels/Cluster Jewels` — all obviously jewellery-adjacent, so hand-map those three.
- **9** `tier_definition` files carry one as well (the campaign ladder + Scarabs +
  Enshrouded Gear), so a tier block can reach it without the mapping.
- **44 distinct values** in use.

So: **author your four hues and derive the group from `item_class`.** Drop the 30-entry map.

Thirteen of the fifteen you hand-mapped resolve straight away — and three of your guesses
were wrong, which is exactly why this was worth asking:

| category | you assumed | `item_class` actually says |
|---|---|---|
| `Campaign` | mixed → equipment accent | **Weapons** |
| `Influenced` | mixed → equipment accent | **Body Armours** |
| `Enshrouded Gear` | armour | **Enshrouded Items** |
| `Crafting Bases` | mixed → equipment accent | `Crafting Priority` ⚠️ |
| `Magic Net` / `Relics` / `Talismans` / `Stygian Vise` / `Trinkets` / `Sacrificial Garbs` / `Heist Experimented` / `Expedition Ward-Bases` / `Breach Grasping Mail` | as you guessed | same |

Two have no `base_mapping` under that theme key and still need you: **`Heist Equipment`**
and **`Mirror of Kalandra Ring Bases`**.

⚠️ Two cautions before you lean on this:

- **`Crafting Bases` → `Crafting Priority` is a category name, not a GGPK item class.**
  That category deliberately spans every equipment slot, so it has no single group. Treat
  it as mixed, as you were going to.
- **`item_class` names the CLASS, not the category.** Eleven categories report
  `可堆叠通货` (Stackable Currency) and Scarabs reports `Map Fragments`. Fine for a group
  hue; do not use it as a display name.

`Enshrouded Items` is a genuine 3.29 GGPK class (official zh 雾隐物品) — it is now in our
class table, pulled from the dump and joined on `Id`.

## 4 · The nine heist areas — **all nine are in our data** ✅ ANSWERED

Bunker, Laboratory, Mansion, Prohibited Library, Records Office, Repository, Smuggler's
Den, Tunnels, Underbelly — **9 of 9** present in our heist files, and the condition vocab
has area/heist entries. **The heist re-tier is on the table.**

Still yours to judge: whether NeverSink's trade-softcore nine are the right nine for
Ruthless. We can match them; we cannot tell you they are correct.

## 7 · The flat list — **17 are genuinely flat, not 12** ✅ ANSWERED

Counting distinct non-hide `theme.Tier` rungs per category: **17 have exactly one, 36 have
two or more.**

The seventeen: `Breach Grasping Mail`, `Breach Rings`, `Chancing`, `Class Nets`,
`Delirium Orbs`, `Enshrouded Gear`, `Enshrouding Crystals`, `Expedition Ward-Bases`,
`Gold`, `Heist Currency`, `Heist Targets`, `Incursion Vials`, `Legacy`,
`Mirror of Kalandra Ring Bases`, `Quest Items`, `Relics`, `Sacrificial Garbs`.

Diff that against your `flat_look.applies_to_*`: anything on yours but not here has grown
a second rung and belongs on the ladder; anything here but not on yours is a candidate you
had not flagged.

## 10 · Delirium Orbs and Corpses — **both live** ✅ ANSWERED

Both still have a `base_mapping` and a theme entry in the 3.29 tree
(`Currency/Delirium Orbs.json`, `Currency/Corpses.json`). Neither accent is wasted, and
your invented `corpses` hue has something to paint.

---

## Still open — not answerable from the repo

| # | question | owner | why |
|---|---|---|---|
| 2 | `state_budget` vs reality — can a map be fractured/influenced, a jewel enchanted? | code side | needs a trace run over co-occurring conditions; not yet done |
| 3 | Does `Continue` compose a state border over a rung border? | **in game** | `Continue` composition per property was verified in game once; the two-channel decorator step-down has not been. ⚠️ our generator **cannot emit `Continue` yet** — see CLAUDE.md — so this cannot be tested from a build today |
| 5 | `Quality >= 21` expressible; do gems want `>= 20`? | code side | the operator is fine (note the required space before the value); the gem threshold is an author call |
| 6 | Does Ruthless render a font size below 32? | **in game** | only loading it answers this; every format rule we know was found that way |
| 8 | Icon count per category at floor T2 | code side | cheap once the floor is set — say the word and it is a one-column report |
| 9 | Is gold auto-collected in Ruthless? | **in game / author** | economy rules differ there; we should not assume Settlers behaviour |

Questions 3, 6 and 9 all need the game rather than the repo, and they are the ones most
likely to invalidate a design assumption — the project's whole format reference was built
from rules that generation, the validator and the parity suite all passed.
