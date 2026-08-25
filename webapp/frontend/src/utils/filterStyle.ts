/**
 * The ONE style/emission core. Every surface that renders a filter block must
 * come through here.
 *
 * Why this module exists: the project had FOUR resolvers that disagreed —
 * generate.py and filterGenerator.ts (then a parity-guarded pair), styleResolver.ts
 * (the editor preview and Inspector raw text) and simulatorEngine.ts (the drop
 * simulator). The last two were unguarded and both diverged, so the editor
 * previewed styling the exported filter discarded, and authoring felt like it
 * worked when it did not.
 *
 * The rules below are not stylistic preferences. Every one was found by loading
 * a generated filter in game, after generation, the validator AND the then-16/16
 * parity test had all passed:
 *
 *   * Ruthless cannot `Hide` — GGG forbids it, so HIDE_CMD is `Minimal`, which
 *     still DRAWS a label. A hide block must therefore emit no style lines.
 *   * An ABSENT colour key means "let the game paint it". 441 of 998 theme rows
 *     omit TextColor on purpose so the rarity colour shows through.
 *   * A comparison operator needs a SPACE before its value; `>=10` is rejected
 *     outright and breaks the whole filter on load.
 *   * A CustomAlertSound path resolves against the FILTER's folder, not this
 *     repo — so no `sound_files\` prefix.
 *
 * ⚠️ "Mirrors generate.py" in the comments here and in filterGenerator.ts is now
 * HISTORY, not an instruction. ADR-0007 retired the Python generator; there is one
 * engine. Those notes are kept because they record WHY a line behaves as it does —
 * follow them as rationale, not as a second file to go and edit.
 *
 * The guard is now `test_generator_fixtures.mjs`: a synthetic tree with committed
 * golden output. Change anything here and that diff is where it shows up — read it
 * rather than regenerating past it.
 */

export const DEFAULT_FONT_SIZE = 32;

/**
 * Volume for a NEWLY picked sound, and the divisor for in-app previews.
 *
 * PoE's sound volume runs 0–300, so 300 is "as authored". It lives here because
 * five separate UIs pick sounds and they had drifted: the tier-block style editor
 * defaulted a new sound to 100 while the sound picker, the item manager, the rule
 * target manager and the foreign-filter importer all used 300 — so the same
 * "choose this sound" action produced a different loudness depending on which
 * panel you happened to be in.
 *
 * Existing data is deliberately tuned across the range (90 emitted lines at 100,
 * 93 at 200, 231 at 300), so this only governs NEW picks — nothing already
 * authored is rewritten.
 */
export const DEFAULT_SOUND_VOLUME = 300;

/**
 * True when a theme/override style value means OMIT the line entirely: the
 * editor's 'disabled:' toggle, or the designer sentinels 'inherit' (TextColor
 * keeps the rarity colour) / 'default' (BackgroundColor keeps the game's default
 * label bg).
 *
 * ALSO true for an ABSENT value. An absent key is the designer's primary way of
 * saying "let the game paint this": 441 of the 998 theme rows omit `TextColor` on
 * purpose — every gear class, Campaign, and every rarity-inherited family gives up
 * its text channel so the RARITY colour shows through. We were falling through to
 * parseRgba(undefined) = white and painting over it, so a rare staff rendered with
 * a white name and read as a plain normal item. Same for the 98 rows omitting
 * `BackgroundColor`, which want the game's own 0 0 0 190 label.
 */
export const styleOff = (value: any): boolean =>
  value === undefined || value === null ||
  (typeof value === 'string' && (value.startsWith('disabled:') || value === 'inherit' || value === 'default'));

export const parseRgba = (value: any, defaultValue: string = "255 255 255 255"): string => {
  if (!value || value === -1) return defaultValue;
  if (typeof value === "string" && value.startsWith("disabled:")) return defaultValue;

  if (typeof value === "string" && value.startsWith("#")) {
    const hexv = value.replace("#", "");
    // Require valid hex chars too (parity with generate.py): a bad-char string
    // of the right length would otherwise yield "NaN NaN NaN 255" here while
    // Python's int(..,16) raises — both must fall through to the default.
    if ((hexv.length === 6 || hexv.length === 8) && /^[0-9a-fA-F]+$/.test(hexv)) {
      const r = parseInt(hexv.substring(0, 2), 16);
      const g = parseInt(hexv.substring(2, 4), 16);
      const b = parseInt(hexv.substring(4, 6), 16);
      const a = hexv.length === 8 ? parseInt(hexv.substring(6, 8), 16) : 255;
      return `${r} ${g} ${b} ${a}`;
    }
  }
  return defaultValue;
};

/** [file, volume] -> a filter sound line, or null. */
export const soundLineFromPair = (pair: any): string | null => {
  if (!pair || !Array.isArray(pair) || pair.length !== 2) return null;
  const [file, vol] = pair;
  if (typeof file !== "string") return null;
  if (file.startsWith("Default/AlertSound")) {
    const numMatch = file.match(/\d+/);
    const num = numMatch ? numMatch[0] : "1";
    return `PlayAlertSound ${num} ${vol}`;
  }
  const winPath = file.replace(/\//g, "\\");
  // NO "sound_files\" prefix: the game resolves a CustomAlertSound path relative to
  // the FILTER's own folder, not to this repo. Players drop the shipped
  // `Sharket掉落音效\` folder next to the .filter, which is what Sharket's own
  // released filter emits. Prefixing our repo's container directory made every alert
  // silently fail to load in game. (Mirrors generate.py.)
  return `CustomAlertSound "${winPath}" ${vol}`;
};

/**
 * PoE needs a SPACE between a comparison operator and its value: the game rejects
 * `StackSize >=10` outright ("cannot be recognised") while `StackSize >= 10` parses.
 * Both spellings are authorable in the editor and the tree contains both — `>= 300`
 * and `>= 50` alongside `>=10`, `>=100`, `>=1000`, `>=3000` — so one bad line broke
 * the whole filter in game. Normalising on emit fixes every existing case and any
 * future one, instead of chasing the data. Mirrors norm_op() in generate.py.
 */
export const normOp = (val: any): any => {
  if (typeof val !== "string") return val;
  const m = val.trim().match(/^(==|!=|<=|>=|<|>|=)\s*(\S.*)$/);
  return m ? `${m[1]} ${m[2]}` : val;
};

const STYLE_PREFIXES = ["    Set", "    PlayEffect", "    MinimapIcon",
                       "    CustomAlertSound", "    PlayAlertSound"];

/**
 * Join a block. A hide block drops its authored style and takes the QUIET RECIPE.
 *
 * ★ CORRECTED 2026-08-25 BY AN IN-GAME TEST. This used to strip style and emit
 * conditions only, reasoning that `Minimal` still draws a label so any style
 * would make it louder. The author tested it and the reverse is true:
 *
 *     "minimal do use stylelines and it defaults to the fontsize 1, but those
 *      text/bg/bd style works, so we should emit those three for minimal block
 *      to make it nearly invisible"
 *
 * So a bare `Minimal` draws the GAME'S default plate — which is exactly the
 * clutter we were trying to remove. Painting the plate and border transparent
 * removes it. Ruthless cannot reach "nothing on the ground", but this is much
 * closer to it than conditions-only was.
 *
 * The recipe is not invented: it is copied from the author's own
 * `Sharket3.27[0]无情异界私货.ruthlessfilter`, which uses it five times under
 * `全局设置 - 显示全部垃圾物品`.
 *
 * ⚠️ TEXT ALPHA IS 80, NOT 0. The game REJECTS alpha 0 on text — a test filter
 * using `SetTextColor 0 0 0 0` failed to load outright, which is how we learned
 * the channel is special. 80/255 is the author's chosen value: legal, and dim
 * enough to read as absent. Plate and border DO accept alpha 0, and both ship
 * that way today in FilterBlade 3.29 and in our own V7.0.
 *
 * ⚠️ NO `SetFontSize`. Minimal already renders at size 1; emitting a size would
 * make it BIGGER. This is why the old "strip everything" rule half-worked — it
 * accidentally preserved the tiny default.
 *
 * Order matches the normal emit path (text, border, background) so a hide block
 * diffs cleanly against a shown one.
 */
const QUIET_HIDE_STYLE = [
  "    SetTextColor 0 0 0 80",
  "    SetBorderColor 0 0 0 0",
  "    SetBackgroundColor 0 0 0 0",
];

export const blockText = (blockLines: string[], isHide: boolean): string => {
  if (!isHide) return blockLines.join('\n') + '\n';
  const kept = blockLines.filter((l) => !STYLE_PREFIXES.some((p) => l.startsWith(p)));
  return kept.concat(QUIET_HIDE_STYLE).join('\n') + '\n';
};

/**
 * Priority: rule override -> tier theme.PlayAlertSound -> sharket -> default.
 *
 * Returns the [file, volume] PAIR. The generator wants a filter line and the
 * editor wants the pair (to show which sound is picked, and to play it), so the
 * chain is resolved once here and shaped by the caller — previously the editor
 * had its own copy of this chain and they disagreed.
 */
export const resolveSoundPair = (tierEntry: any, soundMap: any, overrideSound?: [string, number]): [string, number] | null => {
  const asPair = (p: any): [string, number] | null =>
    (p && Array.isArray(p) && p.length === 2 && typeof p[0] === "string") ? [p[0], p[1]] : null;

  const override = asPair(overrideSound);
  if (override) return override;

  // The tier style editor writes the sound it picks to theme.PlayAlertSound.
  // Nothing read it, so choosing a sound for a tier appeared to save and then did
  // nothing. A rule's own override still wins, which is why this sits below.
  // An EXPLICIT disable silences the tier outright and must NOT fall through to
  // the `sound` block below — that fallback is the whole reason a tier could not be
  // muted from the editor before: clearing the picked sound just re-exposed whatever
  // sharket_sound_id/default_sound_id the tier was seeded with. Checked on the raw
  // string, not via styleOff(), because styleOff(undefined) is true and an ABSENT
  // PlayAlertSound must still fall through.
  const themeSnd = (tierEntry.theme || {}).PlayAlertSound;
  if (typeof themeSnd === "string" &&
      (themeSnd.startsWith("disabled:") || themeSnd === "inherit" || themeSnd === "default")) {
    return null;
  }
  const picked = asPair(themeSnd);
  if (picked) return picked;

  const sb = tierEntry.sound || {};
  // sharket_sound_id was authored WITH the ".mp3" extension in 192 of 197 tiers,
  // but class_sounds is keyed by the bare stem ("顶级底材", not "顶级底材.mp3").
  // The old exact-match lookup missed nearly every tier and fell through to
  // default_sound_id, so a tier asking for a custom Sharket sound played a stock
  // PoE alert instead, or was silent where default_sound_id was -1.
  const sid = sb.sharket_sound_id;
  const classSounds = soundMap?.class_sounds || {};
  if (sid) {
    let s = classSounds[sid];
    if (s === undefined && typeof sid === "string" && sid.toLowerCase().endsWith(".mp3")) {
      s = classSounds[sid.slice(0, -4)];
    }
    if (s !== undefined) return [s.file, s.volume];
  }

  if (sb.default_sound_id !== undefined && sb.default_sound_id !== -1) {
    return [`Default/AlertSound${sb.default_sound_id}.mp3`, 300];
  }

  return null;
};

/** The same chain, shaped as a filter line. */
export const resolveSound = (tierEntry: any, soundMap: any, overrideSound?: [string, number]): string | null =>
  soundLineFromPair(resolveSoundPair(tierEntry, soundMap, overrideSound));

export const tierNumFromLabel = (label: string): number => {
  if (label.includes("Tier 0")) return 0;
  if (label.includes("Hide")) return 9;
  const m = label.match(/Tier\s+(\d+)/);
  return m ? parseInt(m[1]) : 99;
};

/**
 * The theme resolution key for one tier-definition category — the `[category]`
 * half of `theme[category]["Tier N"]`.
 *
 * ★ There is ONE source for this: the tier definition's own `_meta.theme_category`,
 * falling back to its top-level key. The filter is emitted from the tier tree, so
 * the tier tree decides which look a block wears. Everything that displays or edits
 * a look must ask this function, or it is editing a different bucket than the one
 * that ships.
 *
 * It exists because three answers to "which theme key?" coexisted, and the two
 * non-authoritative ones had both drifted:
 *   * `tier_definition._meta.theme_category` — what the generator reads (correct);
 *   * `base_mapping._meta.theme_category` — declared by 82 files and WRONG on 8
 *     (`Heist` for all four Heist files, `Currency` for Currency/General,
 *     `Fragment Splinters`, `Mirror Ring Bases`). Every one of those wrong values is
 *     an orphan theme key — a row nothing else points at — which is what a duplicate
 *     identity decays into. It dies with `base_mapping`;
 *   * `category_structure.json`'s `target_category` — hand-typed in BOTH the yaml
 *     and the compiled json (the compiler is a known-broken DO-NOT-RUN script), so
 *     it drifted on 13 of 92 nav leaves with nothing to catch it.
 *
 * That drift was not a cosmetic mismatch. The theme board used `target_category` as
 * its read AND write key, so on those 13 leaves it showed a look the filter does not
 * emit and banked edits where nothing reads them — and where the wrong key happened
 * to be another category's real key, editing Contracts restyled every Map while
 * Contracts itself never changed.
 */
export const resolveThemeKey = (categoryData: any, categoryKey: string): string =>
  categoryData?._meta?.theme_category || categoryKey;

/** The first non-comment top-level key of a tier-definition document. */
export const topCategoryKey = (doc: any): string | undefined =>
  Object.keys(doc || {}).find(k => !k.startsWith("//"));

/**
 * The theme row a tier block resolves to: `theme[category]["Tier N"]`.
 *
 * Two fallbacks, and they are NOT symmetric — this asymmetry is load-bearing and
 * was one of the four resolvers' divergences:
 *   * a missing CATEGORY falls back to `Default`;
 *   * a missing TIER ROW inside a category falls back to `{}`, NOT to Default's
 *     row. Such a block emits `SetFontSize 32` and nothing else.
 *
 * `Tier N` comes from the tier's own `theme.Tier` when present, else from parsing
 * its key. Real keys like "T1", "Other" and "Rare Safety Net" all parse to 99,
 * which is why the explicit override exists.
 *
 * (The editor preview used to try `Stackable Currency` -> `Currency` ->
 * `currency` -> `Templates` here, none of which either generator has ever looked
 * at, and defaulted the category to "Stackable Currency" — so it showed a
 * plausible style for blocks the filter emitted bare.)
 */
export const resolveTierTheme = (themeData: any, themeCategory: string, tierEntry: any, tierKey: string): any => {
  const themeRef = themeData?.[themeCategory] || themeData?.["Default"] || {};
  const inline = tierEntry?.theme || {};
  const tnum = inline.Tier !== undefined ? inline.Tier : tierNumFromLabel(tierKey);
  const row = themeRef[`Tier ${tnum}`] || {};

  // ★ THE TIER BLOCK OWNS ITS LOOK. Its inline style wins; the theme row is the
  // base it was seeded from, and now only supplies channels the block does not
  // state. Editing a block's style in the editor therefore changes the filter —
  // which is the whole point of the rewrite, and was not true before.
  //
  // This was only safe to switch on AFTER reseed_tier_styles.py rewrote every
  // tier's inline block as its fully resolved style. Before that, inline held a
  // mix of deliberate authoring and stale snapshots (the editor writes the
  // resolved theme back whenever it saves): of 182 inline values that differed
  // from the theme row, 87 were exactly the PRE-DESIGNER value and 67 more looked
  // like editor defaults, so flipping against that data would have silently undone
  // the designer's port. Post-reseed the two agree by construction, which is why
  // the flip emits byte-identical output.
  //
  // Note an ABSENT key is not the same as an off one. Absent means the block says
  // nothing, so the row (then the game) decides — 441 of 998 theme rows omit
  // TextColor on purpose so the RARITY colour shows through. A block that wants a
  // channel silenced says so explicitly with null or a `disabled:` value, which
  // styleOff() turns into an omitted line. `Currency/Gold.json` does exactly that.
  const out: any = { ...row };
  for (const [k, v] of Object.entries(inline)) {
    if (k === 'Tier' || k === 'PlayAlertSound') continue;   // not style channels
    if (wellFormed(k, v)) out[k] = v;
  }
  return out;
};

/**
 * Is this beam/icon value syntactically emittable?
 *
 * Gate on the promotion above, and NOT a style judgement — one malformed line
 * makes the game reject the WHOLE filter on load, so a value that has never been
 * emitted before must not be able to break it on its way in. Structural only
 * (token count + size digit), deliberately not an enumeration of colour and
 * shape names, so GGG adding a shape does not silently start dropping icons.
 *
 *   MinimapIcon <size 0-2> <colour> <shape>
 *   PlayEffect  <colour> [Temp]
 *
 * `Currency/_archived/Breach.json` carries `"RedStar"` — no size, no space —
 * which was harmless only because inline style reached nothing. Promoting beam
 * and icon would have shipped it onto the Breach splinter block.
 */
export const wellFormed = (channel: string, value: any): boolean => {
  if (channel !== 'MinimapIcon' && channel !== 'PlayEffect') return true;  // only beam/icon have a grammar
  if (styleOff(value)) return true;          // an off value emits no line at all
  if (typeof value !== 'string') return false;
  const parts = value.trim().split(/\s+/);
  if (channel === 'MinimapIcon') return parts.length === 3 && /^[0-2]$/.test(parts[0]);
  return parts.length === 1 || (parts.length === 2 && parts[1] === 'Temp');
};

/**
 * Split a block's base list into (bases, override) groups.
 *
 * An item card can carry its own style override — in practice almost always a
 * sound. A filter block has ONE of each style line, so a base with its own
 * override has to become its own block: same look, only the overridden channel
 * differing. Derived here, never authored — you tag the card and the shape follows.
 *
 * ⚠️ Overridden groups come FIRST, plain last. First-match-wins means a plain block
 * listing the base ahead of its override block would swallow it — the dead-claim
 * class the index counts 86 of. Ordered by the override's JSON so runs are stable.
 *
 * Mirrors split_by_override() in generate.py (parity-guarded).
 */
export const splitByOverride = (
  bases: string[],
  itemOverrides: Record<string, any>,
): Array<[string[], any]> => {
  if (!itemOverrides || Object.keys(itemOverrides).length === 0) return [[bases, null]];
  const groups = new Map<string, string[]>();
  const plain: string[] = [];
  for (const b of bases) {
    const ovr = itemOverrides[b];
    if (ovr) {
      const key = stableStringify(ovr);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    } else {
      plain.push(b);
    }
  }
  const out: Array<[string[], any]> = [...groups.keys()].sort()
    .map((k) => [groups.get(k)!, JSON.parse(k)] as [string[], any]);
  if (plain.length) out.push([plain, null]);
  return out;
};

/** JSON with sorted keys — Python's json.dumps(sort_keys=True) equivalent, for grouping. */
const stableStringify = (v: any): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(', ')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}: ${stableStringify(v[k])}`).join(', ')}}`;
};

/**
 * Emit a block's MATCHING lines for one condition map.
 *
 * Three shapes, all of which exist in the tree:
 *   * a LIST value -> one repeated line per entry (AND), e.g. two HasInfluence;
 *   * "RANGE >= a <= b" -> two lines on the same key;
 *   * Rarity -> a leading `==` is stripped (the game wants `Rarity Rare`).
 * Everything else passes through normOp.
 */
export const conditionLines = (conditions: Record<string, any> | undefined | null): string[] => {
  const lines: string[] = [];
  if (!conditions) return lines;
  for (const [key, val] of Object.entries(conditions)) {
    if (Array.isArray(val)) {
      for (const v of val) lines.push(`    ${key} ${normOp(v)}`);
    } else if (typeof val === "string" && val.startsWith("RANGE ")) {
      const parts = val.split(" ");
      if (parts.length >= 5) {
        lines.push(`    ${key} ${parts[1]} ${parts[2]}`);
        lines.push(`    ${key} ${parts[3]} ${parts[4]}`);
      }
    } else if (key === "Rarity") {
      const clean = typeof val === "string" && val.trim().startsWith("==")
        ? val.trim().slice(2).trim() : val;
      lines.push(`    ${key} ${normOp(clean)}`);
    } else {
      lines.push(`    ${key} ${normOp(val)}`);
    }
  }
  return lines;
};

/** The line that makes a block COMPOSE instead of terminate. */
export const CONTINUE_LINE = "    Continue";

/**
 * ★ A DECORATOR block: it states one or two channels, then `Continue`s.
 *
 * Verified in game 2026-08-03 (see reference_poe_filter_format.md §3): without
 * `Continue` the first matching block wins whole-block and evaluation stops; WITH it,
 * later matching blocks override only the properties THEY set, and anything they leave
 * unset keeps the earlier value. So a state — corrupted, fractured, enchanted — is
 * authored once and layers over every preset: 29 + 8 instead of 29 x 8. FilterBlade
 * runs 44 such blocks, 42 of which set exactly one channel.
 *
 * Two rules make it work, and both are why this cannot reuse `styleLines`:
 *
 *  1. **Only stated channels are emitted — no theme row, no defaults.** `styleLines`
 *     always emits `SetFontSize` (defaulting to 32) and falls back to the theme row for
 *     everything else. A decorator doing that would claim every channel and overwrite
 *     the very preset it is supposed to decorate.
 *  2. **The decorator must be emitted BEFORE what it decorates**, and the preset must
 *     leave that channel unset. Ordering is `_meta.gen_order` (category-level), so a
 *     decorator category wants a low one.
 */
export const decoratorStyleLines = (theme: any): string[] => {
  const lines: string[] = [];
  if (!theme) return lines;
  const put = (key: string, fmt: (v: any) => string) => {
    const v = theme[key];
    if (v === undefined || v === null || styleOff(v)) return;
    lines.push(`    ${fmt(v)}`);
  };
  put("FontSize", v => `SetFontSize ${v}`);
  put("TextColor", v => `SetTextColor ${parseRgba(v)}`);
  put("BorderColor", v => `SetBorderColor ${parseRgba(v)}`);
  put("BackgroundColor", v => `SetBackgroundColor ${parseRgba(v)}`);
  put("PlayEffect", v => `PlayEffect ${v}`);
  put("MinimapIcon", v => `MinimapIcon ${v}`);
  return lines;
};

/**
 * Emit a block's STYLE lines, in the generators' exact order.
 *
 * `overrides` is a rule's narrow deviation; absent keys fall through to the
 * theme row. Note FontSize is ALWAYS emitted (defaulting to 32) while every
 * colour channel is omitted when styleOff — that difference is deliberate, see
 * styleOff above.
 *
 * `soundLine` is passed in already resolved because its priority chain needs the
 * tier's `sound` block, which is not part of the style row.
 */
export const styleLines = (
  ttheme: any,
  overrides: Record<string, any> = {},
  soundLine: string | null = null,
): string[] => {
  const lines: string[] = [];
  const pick = (k: string) => (k in overrides ? overrides[k] : ttheme?.[k]);

  lines.push(`    SetFontSize ${overrides.FontSize ?? ttheme?.FontSize ?? DEFAULT_FONT_SIZE}`);

  const text = pick("TextColor");
  if (!styleOff(text)) lines.push(`    SetTextColor ${parseRgba(overrides.TextColor, parseRgba(ttheme?.TextColor))}`);
  const border = pick("BorderColor");
  if (!styleOff(border)) lines.push(`    SetBorderColor ${parseRgba(overrides.BorderColor, parseRgba(ttheme?.BorderColor))}`);
  const bg = pick("BackgroundColor");
  if (!styleOff(bg)) lines.push(`    SetBackgroundColor ${parseRgba(overrides.BackgroundColor, parseRgba(ttheme?.BackgroundColor, "0 0 0 255"))}`);

  if (soundLine) lines.push(`    ${soundLine}`);

  const eff = pick("PlayEffect");
  if (eff && !styleOff(eff)) lines.push(`    PlayEffect ${eff}`);
  const icon = pick("MinimapIcon");
  if (icon && !styleOff(icon)) lines.push(`    MinimapIcon ${icon}`);

  return lines;
};
