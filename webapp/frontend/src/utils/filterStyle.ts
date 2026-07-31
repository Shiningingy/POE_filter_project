/**
 * The ONE style/emission core. Every surface that renders a filter block must
 * come through here.
 *
 * Why this module exists: the project had FOUR resolvers that disagreed —
 * generate.py and filterGenerator.ts (the parity-guarded pair), styleResolver.ts
 * (the editor preview and Inspector raw text) and simulatorEngine.ts (the drop
 * simulator). The last two were unguarded and both diverged, so the editor
 * previewed styling the exported filter discarded, and authoring felt like it
 * worked when it did not.
 *
 * The rules below are not stylistic preferences. Every one was found by loading
 * a generated filter in game, after generation, the validator AND the 16/16
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
 * Keep this module byte-faithful to filter_generation/generate.py: ADR-0001
 * makes the two generators a parity pair, and test_generator_parity.mjs enforces
 * it. Editing one without the other is what this module exists to stop.
 */

export const DEFAULT_FONT_SIZE = 32;

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
 * Join a block, dropping style lines when it is a hide block.
 *
 * A `Hide` block renders nothing, so its styling was always dead weight. Under
 * RUTHLESS it is worse than dead: GGG does not permit `Hide` there, so HIDE_CMD
 * is `Minimal` — which still DRAWS a label. Emitting a font size and a plate on
 * it makes the very thing we are trying to quieten more visible, not less.
 * NeverSink's Ruthless filter emits conditions only on its Minimal blocks
 * ("Hide-Section replaced with minimal"). Mirrors block_text() in generate.py.
 */
export const blockText = (blockLines: string[], isHide: boolean): string => {
  const kept = isHide
    ? blockLines.filter((l) => !STYLE_PREFIXES.some((p) => l.startsWith(p)))
    : blockLines;
  return kept.join('\n') + '\n';
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
  const override = (tierEntry?.theme || {}).Tier;
  const tnum = override !== undefined ? override : tierNumFromLabel(tierKey);
  return themeRef[`Tier ${tnum}`] || {};
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
