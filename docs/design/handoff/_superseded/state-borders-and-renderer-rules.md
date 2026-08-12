# Theme handoff — state borders, reserved rungs & renderer rules

Companion to `sharket_theme.json` (Download button at the bottom of the theme board).
That file covers `theme_category × Tier N`. Everything below is **not** expressible there.

## 0. Before you port: two name sources disagree

`tier_definition/**/_meta.theme_category` and the generated base_mapping coverage report use
different strings for the same things. Both feed the generator, so the export **emits both
spellings** rather than picking one:

| tier_definition says | coverage report says |
|---|---|
| `General` | `Currency` |
| `Splinters` | `Fragment Splinters` |
| `Heist Currency` / `Heist Contracts` / `Heist Blueprints` / `Heist Equipment` / `Heist Targets` | `Heist` |
| `Abyss Socketed Items`, `Blight Anointed Items`, `ID Mods: <league>`, `Mirror of Kalandra Ring Bases`, `Linked Items`, `Veiled Items`, `Memory-Stranded` | shorter forms, and no Memory-Stranded |

Worth collapsing to one source at some point — until then, extra keys are harmless but the
duplication is real.

Still declaring `theme_category: "Stackable Currency"`: `Curse of the Allflame/League Items.json`,
`Currency/Enshrouding Crystals.json`, `Currency/Incursion Vials.json`. It now has an accent in the
**league violet** band (278°) rather than the warm band — it is league content, not value currency,
and at 52° it was 2° from `Default`, i.e. "league currency" and "unmapped junk" were the same
colour. They still all look identical to each other though; retagging them to their own categories
is the better fix.

## 1. Rule-level state borders

Most rules get no state hue — they use their tier's ramp unchanged. A hue appears only when the
item genuinely has a special property, and then it escalates:

| Level | What moves |
|---|---|
| plain | nothing — the tier ramp as-is |
| enhanced | plate steps DOWN (within the family's own cap), state hue takes the border |
| swap | state hue becomes a BRIGHT plate, the category accent drops to the border |

Font size never changes across levels: a state says *what* an item is, not what it's worth.

| State | RGB | Level | Notes |
|---|---|---|---|
| corrupted | `225 25 55` | enhanced | vaal red |
| 2× corrupted | `255 70 40` | swap | vaal glow |
| enshrouded (allflame) | `255 120 20` | swap | unique-only; it is the existing `Enshrouded (Vestigial)` Tier 2 rule |
| influenced | `150 0 255` | enhanced (swap if you want it unmistakable) | see §2 |
| fractured | `160 200 255` | enhanced | |
| synthesised | `255 0 255` | enhanced | |
| enchanted | `70 200 235` | enhanced | heist blueprint/contract enchant bias uses this |
| over-quality | `120 235 210` | enhanced | also crucible trees |
| linked (5L/6L/6S) | `0 255 0` | enhanced | |
| foulborn | `160 45 255` | enhanced | breach violet |
| replica | `250 80 195` | enhanced | 49° from foulborn so the siblings never blur |
| locked / gated | `150 150 150` | enhanced | |
| EV1 / EV2 / EV3 | `74 230 58` / `255 140 30` / `255 255 255` | enhanced | attention ladder |

## 2. The equipment-state collision — now down to one file

Updated for the current tree: `Synthesised.json` is gone (synthesised rares no longer drop, so
drop it from §1 too), and `Influenced.json` now has its own `theme_category`. That leaves
**`Fractured.json`, which still declares `Body Armours`** — so a fractured bow renders as body
armour, and a fractured T1 is byte-identical to a plain body-armour T1. It wants the fracture-blue
state border (`160 200 255`, enhanced).

### Influenced: category rows *or* state border?

**Both, in that order — and they look the same either way.** `Influenced` now has a key in the
export, so you're unblocked today. But it is built as the state treatment expressed as category
rows: because influenced items are gear, the category is rarity-inherited, so it emits no
`TextColor`, caps its plate at L≤7, and carries **influence purple `150 0 255` on the border** at
T0–T4. That is exactly what the "enhanced" escalation would produce.

So: port the key now. When the rule-level state work in §6 lands, influence becomes a state, the
key stops being asked for, and you can delete it — with no visual change. The reason not to make it
a swap (purple *plate*) is that gear gives up its text channel to show rarity, so a bright plate
would fight the rarity colour it exists to reveal; a base + influence being unmistakable is better
served by the swap on the **rule**, once rules can carry states.

### Magic Net

Added as a key. It's a suppression ladder, not a value ladder — T4 keeps good jewellery alive, T5
kills the rest — so it is capped at the **30/35 acknowledge bucket** and never competes. Steel hue,
almost no saturation, rarity showing through.

## 3. Reserved rungs (for the equipment expansion)

**The apex is full.** `Tier 0` owns the near-white plate and `Tier 1` the brightest accent plate,
both at FontSize 45 — a new rung above them could only duplicate one of the two. So a
"base + influence" rung is the **swap** treatment from §1 (influence plate, accent border), not a
new tier.

Headroom exists at the quiet end, where lightness is still separable. The ramp authors two unused
rows so a future insert has a defined look instead of silently hitting `Default`:

| Tier | FontSize | Plate | Border |
|---|---|---|---|
| `Tier 8` | 30 | accent at L3 | none |
| `Tier 12` | 30 | accent at L1 | none |

They are **not** emitted into `sharket_theme.json` — nothing in the tree uses them, and a
pseudo-category key would break a typed loader. Copy the two rows in from here when a category
starts using them.

## 4. Renderer fallbacks (the preview currently misses these)

`Tier 5` and `Tier 6` omit `BackgroundColor` for accent-text families, so the game paints its own
label. Any preview must apply the game's defaults (from poedit's `applyDefaultStyle`):

- no `BackgroundColor` → `rgba(0, 0, 0, 0.745)` (= `0 0 0 190`)
- no `TextColor` → item-class colour: rare `255 255 119`, magic `136 136 255`, normal `200 200 200`,
  unique `175 96 37`, currency `170 158 130`, gem `27 162 155`, quest `74 230 58`, div card `170 230 230`
- no `BorderColor` → none, except maps/fragments where the game mirrors the text colour
- no `FontSize` → 32

## 5. The hue arcs

The palette itself, in text form. A family owns a **band**; bands don't overlap and sit ≥6° apart.
Inside a band, closeness is deliberate — you should read "currency" before "which currency". Every
plate in the export is derived from these two numbers, so changing an accent here re-derives its
whole ramp.

| Band | Family | Members (hue° / saturation%) |
|---|---|---|
| 10–58 | Warm · value, craft & browns | Chancing 10/44 · Omens 16/72 · Uniques 24/66 · Harbinger 28/74 · Relics 30/40 · Fossils 34/100 · Legacy 36/18 · Crafting Bases 40/30 · Currency 44/82 · Vendor Recipes 48/34 · Default 50/56 · Gold 56/46 · Runegrafts 58/60 |
| 66–72 | Blight · oils | Oils 68/100 |
| 84–145 | Nature green | Tinctures 88/42 · Enshrouding Crystals 104/34 · Quest Items 122/60 · Harvest 142/58 |
| 156–192 | Cool utility | Labyrinth Items 158/62 · Incursion Vials 166/52 · Skill Gems 176/72 · Support Gems 186/58 · Divination Cards 192/100 |
| 200–224 | Maps | Map Fragments 202/56 · Fragment Splinters 210/66 · Maps 218/62 · Expedition 224/80 |
| 234–248 | Essence blues | Essences 236/100 · Mana Flasks 246/60 |
| 258–292 | League violet | Curse of the Allflame 260/54 · Delirium Orbs 272/52 · Stackable Currency 278/44 · Utility Flasks 286/56 |
| 300–316 | Breach & heist | Heist 302/40 · Breach 314/62 |
| 322–340 | Magenta · jewels & idols | Idols 324/58 · Jewels 332/66 · Wombgifts 340/58 |
| 348–360 | Red · blood & life | Corpses 350/26 · Ritual 353/44 · Life Flasks 356/62 |
| — | Tainted · grey means corruption | no hue: authored grey plates + vaal border (§1) |
| — | Rarity-inherited (hue-exempt) | gear classes 214/16 · Exotic bases 200/22 · Heist Experimented 308/26 · Enshrouded Gear 24/30 · Campaign 96/20 |

Deliberate departures from the game's own class colours, in case they look wrong at first glance:
fragments and splinters moved **into** the maps band (they were gold, which read as currency);
oils took chartreuse 68° so a Golden Oil never reads as a Divine.

Adding a category later: pick the band its *kind* belongs to, place it ≥6° clear of the neighbouring
band's edge, and let the ramp derive the rest. The board's separation audit flags an overlap or an
indistinguishable pair immediately.

## 6. Constraints the values already satisfy

- Authored text ≥ 4.5:1 on its own plate. Rarity-inherited labels can't be recoloured, so the
  **plate** yields instead, to the 3:1 large-text floor (unique brown maxes at 4.49:1 on pure black).
- Borders ≥ 3:1 (WCAG graphical-object floor). PoE has no border width — colour is the whole budget.
- Rarity-inherited families (gear, Campaign, exotic bases, Enshrouded Gear) cap plates at L≤7, set
  by magic blue, and **never** drop the plate — with no `TextColor` emitted, a plateless row does
  nothing but shrink the label below the game's own 32.
- Size buckets: 45 stop what you're doing · 40 pick it up · 35 only if convenient · 30 acknowledge.
- Hue: a family owns a band; bands don't overlap and sit ≥6° apart. Inside a band, closeness is
  intentional. Gear/Campaign/Tainted are exempt (saturation ≤30 or no hue at all).

## 7. Still open in the tree

Closed since the last pass — no action:

- `Misc/General.json` now declares `Quest Items` (which is why `Thrusting One Hand Swords` reads
  as unused).
- `Gems/Skill.json` `tier_order` is now T0–T4 / Net / Hide, and Support Gems has a theme.
- The inline gem `theme` block is *discarded*, not conflicting — my "bypasses the theme file" was
  wrong. Deleting it as dead weight is right.

Still open, and both need a **retag on your side** before a key can help:

- `Maps/Scarabs.json` shares `Map Fragments`. There is now a `Scarabs` key waiting at 207°/40 —
  inside the maps band on purpose, so "atlas consumable" reads before "which one".
- All three `Jewels/*.json` share `Jewels`, so abyss / cluster / base look identical. Tell me the
  key names you want and I'll place them in the magenta band; I didn't invent names for files that
  don't declare them yet.
- `Equipment/Special/Fractured.json` still declares `Body Armours` (see §2).
