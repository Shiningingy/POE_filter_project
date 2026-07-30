# Theme handoff — state borders & renderer rules

Companion to `sharket_theme.json` (downloaded from the theme board). That file covers
`theme_category × Tier N` only. The two things below are **not** expressible there.

## 1. Rule-level state borders

Most rules get no state hue at all — they use their tier's ramp unchanged. A hue appears
only when the item genuinely has a special property, and then it escalates:

| Level | What moves | Result |
|---|---|---|
| plain | nothing | the tier ramp as-is |
| enhanced | plate steps DOWN to the dark band, state hue takes the border | `BackgroundColor` = accent at L15, `BorderColor` = state hue |
| swap | plate becomes the state hue (bright), accent drops to the border | `BackgroundColor` = state hue at L48, `BorderColor` = accent darkened |

Font size never changes across levels: a state says *what* an item is, not what it's worth.

### State hues

| State | RGB | Level | Notes |
|---|---|---|---|
| corrupted | `225 25 55` | enhanced | vaal red. Was `190 0 30`, which cannot reach 3:1 on any darker plate |
| 2× corrupted | `255 70 40` | swap | vaal glow — the plate, per the escalation |
| enshrouded (allflame) | `255 120 20` | swap | 3.29. Unique-only, so it is a state on the Uniques ladder, not a category |
| enchanted | `70 200 235` | enhanced | brightened from `184 218 242`, which vanished on light plates |
| over-quality | `120 235 210` | enhanced | also used for crucible trees |
| linked (5L/6L/6S) | `0 255 0` | enhanced | |
| foulborn | `160 45 255` | enhanced | breach violet |
| replica | `250 80 195` | enhanced | counterfeit magenta, 49° from foulborn so the siblings never blur |
| locked / gated | `150 150 150` | enhanced | blueprints, quest-gated |
| EV1 / EV2 / EV3 | `74 230 58` / `255 140 30` / `255 255 255` | enhanced | attention ladder, green → orange → white |

Rules that deliberately get **no** hue: Replica/Foulborn were reclassified as states (above),
but Idols (a class, not a state) and the plain T0–T5 value tiers stay unmarked.

## 2. Renderer fallbacks (the preview currently misses these)

`Tier 5` omits `BackgroundColor` on purpose, so the game paints its own label. Any preview must
apply the same defaults the game does (from poedit's `applyDefaultStyle`):

- no `BackgroundColor` → `rgba(0, 0, 0, 0.745)` (= `0 0 0 190`)
- no `TextColor` → the item-class colour: rare `255 255 119`, magic `136 136 255`,
  normal `200 200 200`, unique `175 96 37`, currency `170 158 130`, gem `27 162 155`,
  quest `74 230 58`, div card `170 230 230`
- no `BorderColor` → none, except maps/fragments where the game mirrors the text colour
- no `FontSize` → 32

## 3. Constraints the values already satisfy

Worth preserving if anyone hand-edits the JSON:

- Authored text ≥ 4.5:1 against its own plate. Rarity-inherited labels cannot be recoloured, so
  the **plate** yields instead, to the 3:1 large-text floor (unique brown maxes at 4.49:1 on pure
  black, so 4.5 is unreachable there).
- Borders ≥ 3:1 (WCAG graphical-object floor). PoE has no border width — colour is the whole budget.
- Rarity-inherited categories (21 gear classes + Campaign) cap plates at L≤7, set by magic blue.
  Their T5 also drops to FS30, the only expressible way to keep "bulk" distinct from "useful".
- Hue: a family owns a band; bands must not overlap and sit ≥6° apart. Inside a band closeness is
  intentional. Gear/Campaign are exempt (saturation ≤30, no text colour).

## 4. Known blockers in the tree

- `Curse of the Allflame/League Items.json` and `Currency/Enshrouding Crystals.json` both declare
  `_meta.theme_category: "Stackable Currency"`, which is not a key in `sharket_theme.json` — they
  fall through to `Default` today.
- `Gems/Skill.json` has an inline `theme` block that hardcodes cyan and bypasses the theme file;
  its `MinimapIcon: "CyanCircle"` is not the game's `<size> <colour> <shape>` syntax. Support Gems
  has no theme at all. Gems `tier_order` is still only T0 / T1 / Hide.
