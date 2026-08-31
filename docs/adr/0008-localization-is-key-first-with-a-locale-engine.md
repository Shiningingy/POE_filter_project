# ADR-0008: Localization is key-first, behind a locale engine

## Status
Accepted. Refines ADR-0003 (which named `localization.ts` as deliberately un-split).

## Context

The app shipped two languages, `en` and `ch`, in a **language-first** table:
`translations = { en: {...534 keys}, ch: {...594 keys} }`, read through a Proxy whose
lookup chain was `lang → en → the key string itself`.

Three problems, all measured rather than assumed:

1. **The resolver could not express "missing".** On a miss it returned the key, which is
   always truthy — so every `t[expr] || fallback` in the codebase was unreachable code.
   Twelve sites had one. Two were visibly wrong: the item-card style editor rendered
   `styleTextColor`, `styleFontSize` … as its row labels in **both** languages (no
   `style*` key had ever existed; the labels were there under `TextColor` / `fontSize`),
   and the drop simulator rendered `foulborn` and `enchanted` as raw lowercase keys.
   A gap could not fail a test because it did not look like a failure.

2. **Single-language maps were structural.** `CLASS_CH`, `BONUS_TAG_CH`, `BONUS_HINT_CH`
   and `DATA_FOLDER_CH` were `Record<string, string>` holding **only** Chinese, so every
   call site carried a `language === 'ch' ? … : …` branch. There were **98** such branches.
   A third locale meant `CLASS_DE`, `BONUS_TAG_DE`, … and a third arm at every one.

3. **No registry for theme categories at all.** Two surfaces answered the question
   "what is this category called?" with two different ad-hoc chains: the style-preset
   picker consulted only the item-class map (**35 of 51 categories fell through to raw
   English**), the theme editor consulted the class map and then the string table
   (**25 of 51**). Same data, same question, two answers on two screens.

## Decision

- **`webapp/frontend/src/utils/locales.ts` holds the locale ENGINE** — the `LOCALES`
  registry, the `Language` type derived from it, per-locale fallback chains, and one
  `resolve()`. It is behaviour behind a small interface, not data.
- **`localization.ts` stays one file and holds the DATA, key-first**:
  `appTitle: { en: "…", ch: "…" }`. Every locale's wording for a string sits on one line.
  It re-exports the engine, so existing `from '../utils/localization'` imports still work.
- **The fallback chain is per-locale data**, not a hardcoded "everything → en", because
  a future Traditional Chinese must fall back to `ch`, not to English.
- **`resolve()` returns `undefined` when a string is missing.** `useTranslation` keeps the
  key-as-last-resort for `t.someKey` so a typo renders something visible, but every
  *dynamic* lookup goes through `translate(key, lang)`, which can say "missing" so the
  caller's own fallback fires.
- **One helper per registry** (`itemClassLabel`, `themeCategoryLabel`, `dataFolderLabel`,
  `ruleFactorLabel`, `bonusTagLabel`, `bonusHintLabel`), so two surfaces asking the same
  question cannot get two answers.
- **No component branches on a language id.** UI chrome lives in the table; local
  `{ en, ch }` content arrays are `Localized` bags read through `resolve()`; item names go
  through `getItemName`, which walks the chain over `name_<locale>` fields.

### Why this is not a violation of ADR-0003

ADR-0003 forbids splitting these files **on line count**, and calls `localization.ts`
"a translation data table". Extracting the engine leaves the data table whole and intact —
it is the clean seam ADR-0003 explicitly leaves open for a future decision.

## Consequences

- **Adding a locale is a data change.** Add a row to `LOCALES` naming its fallback, add
  that field to the rows, pull official item/class names from the GGPK dump joined on `Id`
  (ADR-0004). No component changes.
- `test_locale_coverage.mjs` reports missing translations per locale against a committed
  baseline, and fails on a **new** gap. It also lints the two shapes that caused the bugs
  above — a dead `||` after a dynamic lookup, and an inline zh/en literal ternary — both
  of which are currently at **zero**.
- The migration was verified behaviour-preserving: 1188 resolutions (594 keys × 2
  locales) compared before and after, **0 unexpected differences**. The only intended
  changes are 49 `ch`-only keys that used to render their raw identifier in English mode
  (`Axe_and_Sword_Damage`) and now render `Axe and Sword Damage`.
- **22 strings are still untranslated** (10 UI, 12 theme categories) and are listed in the
  baseline. They render English via the chain, which is exactly what the hardcoded
  literals did before — the difference is that the gap is now data the app can report.
  Filling them is the author's call: this project never hand-writes or transliterates zh.
