# Webapp UI review — Sharket POE Filter (2026-08-23)

Reviewed against `webapp/frontend` @737b372: `index.css`, `App.css`, and the six manual
screenshots (editor, bulk editor, theme editor, simulator, export, import). Ordered by
value-for-effort.

---

## A · One app, two design languages — pick the dark one

The chrome (nav, sidebar, simulator) is a dark tool; the work surfaces (rule cards, bulk
editor, export) are light Bootstrap cards. The eye re-adapts at every modal open, and item
looks — the thing being designed — read differently against white than they will in game.

- `index.css` is still ~40% Vite starter: `color-scheme: light dark`, the
  `prefers-color-scheme: light` flip, `#646cff` links, `h1 { font-size: 3.2em }`. The
  accidental indigo `#646cff` has become the de-facto brand colour. Delete the starter
  residue and pick the palette deliberately.
- Duplicate, conflicting definitions in both files (load-order dependent):
  `.item-card-base`, `.rule-source-badge-tl`, `.item-card-del-btn-tr`,
  `.match-mode-badge-br`, `.staged-indicator-bl`. Consolidate into one tokens + components
  layer.
- Recommendation: dark surfaces everywhere (`#1a1a1a` chrome / `#242424` panels), light
  text; keep ONE light exception — none needed. Item previews always sit on game-dark or
  the item_bg photos, never white.

## B · The UI should wear the theme kit

The tool edits a colour system but shows it almost nowhere outside the preview strip:

1. **Bulk editor columns** (biggest win): T0–T4 column headers are arbitrary pastels
   (pink/purple/blue) with no relation to the authored looks. Paint each column header as
   its real tier row — the rev-29 kit look, text-on-plate at small scale. The board then
   teaches the ladder while you sort.
2. **Sidebar categories**: add a 10px family-hue swatch before each name (currency gold
   plate, gems cyan, scarab lime, heist scarlet…). Navigation becomes a legend for free.
3. **Theme editor tier labels**: "Tier 0…Tier 5" could carry the rung vocabulary
   (一季一遇 / 停手也捡 / 跨屏必捡 / 顺路必捡 / 按需捡取 / 知道就好) as subtitles — the
   curator test IS the definition of each row; the tool should say so.
4. **Editor tier header "T0: ABSOLUTE TOP"**: render the minimap icon shape + beam state
   inline next to SOUND/ICON/BEAM buttons (rev 29 adds beams as a first-class channel —
   the three buttons should show current values, not just open pickers: e.g. the ICON
   button shows the actual sprite, BEAM shows colour + Temp/Perm).

## C · Control semantics — one primary, tame the destructive

Today: green Save Config, purple Bulk Edit, blue viewer chips, red Clear Ground, and a
permanently visible red **Reset All Changes** pinned at the sidebar bottom — the most
destructive action is the most prominent persistent control.

- One primary accent for confirm/save; one neutral for secondary; red reserved for
  confirmed destruction behind a click-through ("type RESET" or two-step).
- Move Reset All Changes out of the sidebar into Save & Export (it is a save-domain
  action), or an overflow menu.
- Rule rows: the green dot + red ✕ pair reads as status + delete, but enable/disable is a
  toggle — make it a switch with a label; ✕ gets a confirm on rules with conditions.

## D · Legibility floor

- Corner badges at `0.6rem` (~9.6px) and `0.65rem` sound-info text are below any
  comfortable floor — set a hard minimum of 11px for any readable text (badges can become
  icon-only with tooltips).
- `#7f7f7f` label text on white cards is ~3.9:1 at small sizes; on the dark theme keep
  labels ≥ `#9a9a9a` on `#242424` (≥ 4.6:1). Same discipline the filter kit enforces —
  apply it to the tool.
- Focus states: `outline: 4px auto -webkit-focus-ring-color` is inconsistent cross-browser;
  define an explicit 2px accent outline.

## E · Screen-specific notes

- **Editor**: the right rail mixes clipboard, viewer settings, raw filter code, and the
  rule library — four unrelated tools in one column. Raw filter code belongs behind a tab
  or the Export view; the rule library belongs inside Add Rule's flow (it's only relevant
  mid-add). What remains (clipboard + viewer bg) is small enough to become a toolbar.
- **Simulator** (strongest screen): already uses real looks on real ground. Add the rev-29
  channels — minimap inset showing each drop's icon (the findability story is exactly what
  the simulator should demo), and a "hide beams" toggle mirroring Temp/Perm.
- **Export**: four radio wordings are engineer-speak. Default to the recommended one,
  collapse the rest under "Advanced"; one green primary is right here — make it the app's
  primary everywhere.
- **Theme editor modal**: unlabeled checkbox next to Base Theme (apply? enable?) — label
  it. "Save Overrides" disabled state is indistinguishable from enabled-grey; use
  opacity + cursor.
- **Bulk editor**: staged-count chip is good; "Show All Classes" checkbox + class dropdown
  + filter field in one row read as three unrelated filters — group them visually.
- **Import foreign filter**: not reviewed in depth; same light/dark split applies.

## Suggested order

1. CSS consolidation + kill starter residue (half a day, unblocks everything)
2. Bulk-editor columns wear real tier looks + sidebar swatches (the "wow" change)
3. Primary/destructive button rework incl. Reset relocation
4. Legibility floor pass (badges, greys, focus)
5. Editor right-rail split; simulator minimap inset (pairs with rev-29 port)
