// Theme hue generator: derive a full tier ladder of styles from 1-2 accent hues.
// TypeScript port of the color math in parsing_tool/build_standard_theme.py —
// the 'standard' series must stay byte-identical to role_style() there.
//
// Styles intentionally NEVER include PlayAlertSound: overrides merge per-property,
// so omitting it preserves the user's / base theme's sounds. PlayEffect (tiers 0-1)
// and MinimapIcon (tiers 0-2) are emitted on exactly the tiers the sharket base
// theme uses, so no stale base icon shows through the merge. A non-sharket base
// that decorates other tiers could still leak an icon there — acceptable.

export type RGB = [number, number, number];

export interface GeneratedTierStyle {
  FontSize: number;
  TextColor: string;
  BorderColor: string;
  BackgroundColor: string;
  PlayEffect?: string;
  MinimapIcon?: string;
}

export type SeriesId = 'standard' | 'boldFill' | 'minimalOutline' | 'light' | 'neon';

export const SERIES_META: { id: SeriesId; en: string; ch: string }[] = [
  { id: 'standard', en: 'Sharket Default', ch: 'Sharket标准' },
  { id: 'boldFill', en: 'Bold Fill', ch: '浓重填充' },
  { id: 'minimalOutline', en: 'Outline', ch: '简约描边' },
  { id: 'light', en: 'Light', ch: '浅色亮底' },
  { id: 'neon', en: 'Neon', ch: '霓虹' },
];

// Role names per tier, mirroring filter_generation/data/theme/roles.json.
export const ROLE_LABELS: Record<number, { en: string; ch: string }> = {
  0: { en: 'Decorator', ch: '装饰高亮' },
  1: { en: 'High Value', ch: '高价值' },
  2: { en: 'Valuable', ch: '有价值' },
  3: { en: 'Notable', ch: '值得注意' },
  4: { en: 'Useful', ch: '实用' },
  5: { en: 'Bulk / Leveling', ch: '大批量 / 过渡' },
  9: { en: 'Hide', ch: '隐藏' },
};

export const GENERATOR_TIERS = [0, 1, 2, 3, 4, 5];

export interface GenParams {
  hueA: RGB;
  hueB: RGB | null;
  balance: number; // 0-100; how much of the ladder hue A claims (top -> bottom)
  gradient: boolean; // false = band split at `balance`; true = smooth blend A -> B
  gamma: number; // gradient-mode handoff sharpness: >1 steeper around the midpoint, <1 softer
}

// ---- color math (ported from build_standard_theme.py) -------------------------

// Python round() is banker's rounding (half-to-even); needed so the 'standard'
// series stays byte-identical to the sharket theme built by the Python tool.
const pyRound = (x: number) => {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

const clamp = (x: number) => Math.max(0, Math.min(255, pyRound(x)));

const scale = (c: RGB, f: number): RGB => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)];

const mix = (c1: RGB, c2: RGB, t: number): RGB => [
  clamp(c1[0] * (1 - t) + c2[0] * t),
  clamp(c1[1] * (1 - t) + c2[1] * t),
  clamp(c1[2] * (1 - t) + c2[2] * t),
];

const lum = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

const hx = (c: RGB, a = 255) =>
  `#${clamp(c[0]).toString(16).padStart(2, '0')}${clamp(c[1]).toString(16).padStart(2, '0')}${clamp(c[2]).toString(16).padStart(2, '0')}${clamp(a).toString(16).padStart(2, '0')}`;

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
};

// PoE named colours, for PlayEffect / MinimapIcon (verbatim from the Python tool).
const NAMED: Record<string, RGB> = {
  Red: [255, 0, 0], Green: [0, 255, 0], Blue: [60, 90, 255],
  Brown: [150, 90, 40], White: [255, 255, 255], Yellow: [255, 230, 60],
  Cyan: [0, 230, 230], Grey: [140, 140, 150], Orange: [255, 150, 40],
  Pink: [255, 110, 170], Purple: [170, 60, 210],
};

const nearestNamed = (c: RGB): string => {
  let best = 'Grey';
  let bestD = Infinity;
  for (const [name, n] of Object.entries(NAMED)) {
    const d = (n[0] - c[0]) ** 2 + (n[1] - c[1]) ** 2 + (n[2] - c[2]) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
};

// HSL round-trip for the neon saturation boost (h, s, l all in [0, 1]).
const rgbToHsl = (c: RGB): [number, number, number] => {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  if (s === 0) return [clamp(l * 255), clamp(l * 255), clamp(l * 255)];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [clamp(hue2rgb(p, q, h + 1 / 3) * 255), clamp(hue2rgb(p, q, h) * 255), clamp(hue2rgb(p, q, h - 1 / 3) * 255)];
};

// ---- hue assignment across the ladder ------------------------------------------

// Resolve the accent each tier renders in. Band mode: hue A claims the top
// `aCount` of the 6 visible tiers, hue B the rest (both always appear).
// Gradient mode: smooth blend A -> B (single hue fades toward neutral grey);
// `balance` shifts the blend midpoint (high = A dominates, like band mode) and
// `gamma` sharpens (>1) or softens (<1) the handoff around that midpoint.
const accentFor = (p: GenParams, tier: number): RGB => {
  if (p.gradient) {
    const b = p.hueB ?? mix(p.hueA, [150, 150, 160], 0.75);
    const x = tier / 5;
    const m = Math.min(0.92, Math.max(0.08, p.balance / 100));
    const tm = x === 0 ? 0 : x ** (Math.log(0.5) / Math.log(m)); // blend = 0.5 at x = m
    const t = tm < 0.5 ? 0.5 * (2 * tm) ** p.gamma : 1 - 0.5 * (2 * (1 - tm)) ** p.gamma;
    return mix(p.hueA, b, t);
  }
  if (!p.hueB) return p.hueA;
  const aCount = Math.max(1, Math.min(5, Math.round((p.balance / 100) * 6)));
  return tier < aCount ? p.hueA : p.hueB;
};

// ---- shared pieces ---------------------------------------------------------------

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const NEUTRAL: RGB = [150, 150, 158];
const FONT = [45, 42, 39, 36, 34, 31]; // tiers 0..5; tier 9 = 18

// Tier 9 (Hide) — identical for every series; style irrelevant in game.
const HIDE_STYLE: GeneratedTierStyle = {
  FontSize: 18,
  TextColor: hx([90, 90, 100], 170),
  BorderColor: hx([45, 45, 52], 120),
  BackgroundColor: hx(BLACK, 0),
};

// PlayEffect on tiers 0-1, MinimapIcon on tiers 0-2 (matches the sharket base).
const extras = (accent: RGB, tier: number): Partial<GeneratedTierStyle> => {
  const pe = nearestNamed(accent);
  if (tier === 0) return { PlayEffect: pe, MinimapIcon: `0 ${pe} Star` };
  if (tier === 1) return { PlayEffect: pe, MinimapIcon: `1 ${pe} Diamond` };
  if (tier === 2) return { MinimapIcon: `1 ${pe} Circle` };
  return {};
};

// ---- the 5 series ----------------------------------------------------------------

// Exact port of role_style() in build_standard_theme.py.
const standardTier = (A: RGB, tier: number): GeneratedTierStyle => {
  switch (tier) {
    case 0: return {
      FontSize: 45, TextColor: hx(lum(A) > 0.6 ? BLACK : WHITE),
      BorderColor: hx(WHITE), BackgroundColor: hx(A), ...extras(A, 0),
    };
    case 1: return {
      FontSize: 42, TextColor: hx(WHITE), BorderColor: hx(A),
      BackgroundColor: hx(scale(A, 0.20)), ...extras(A, 1),
    };
    case 2: return {
      FontSize: 39, TextColor: hx(mix(A, WHITE, 0.15)), BorderColor: hx(A),
      BackgroundColor: hx([16, 16, 22]), ...extras(A, 2),
    };
    case 3: return {
      FontSize: 36, TextColor: hx(mix(A, WHITE, 0.30)),
      BorderColor: hx(scale(A, 0.55)), BackgroundColor: hx([10, 10, 13]),
    };
    case 4: return {
      FontSize: 34, TextColor: hx(mix(A, NEUTRAL, 0.55)),
      BorderColor: hx(scale(A, 0.30)), BackgroundColor: hx(BLACK, 0),
    };
    default: return {
      FontSize: 31, TextColor: hx([150, 150, 160]),
      BorderColor: hx([60, 60, 70]), BackgroundColor: hx(BLACK, 0),
    };
  }
};

const BOLD_FILL_F = [1.00, 0.78, 0.60, 0.45, 0.32, 0.22];

const boldFillTier = (A: RGB, tier: number): GeneratedTierStyle => {
  const bg = scale(A, BOLD_FILL_F[tier]);
  const border = tier === 0 ? WHITE : tier <= 2 ? A : scale(A, 0.6);
  return {
    FontSize: FONT[tier],
    TextColor: hx(lum(bg) > 0.6 ? BLACK : WHITE),
    BorderColor: hx(border),
    BackgroundColor: hx(bg, tier <= 2 ? 255 : 221),
    ...extras(A, tier),
  };
};

const OUTLINE_BORDER_F = [1.0, 0.85, 0.65, 0.45, 0.28];

const minimalOutlineTier = (A: RGB, tier: number): GeneratedTierStyle => {
  const text =
    tier === 0 ? mix(A, WHITE, 0.50) :
    tier === 1 ? mix(A, WHITE, 0.30) :
    tier === 2 ? mix(A, WHITE, 0.15) :
    tier === 3 ? A :
    tier === 4 ? mix(A, NEUTRAL, 0.35) : mix(A, NEUTRAL, 0.60);
  return {
    FontSize: FONT[tier],
    TextColor: hx(text),
    BorderColor: tier === 5 ? hx(BLACK, 0) : hx(scale(A, OUTLINE_BORDER_F[tier])),
    BackgroundColor: hx(BLACK, 0),
    ...extras(A, tier),
  };
};

// Light "white tag" look: pale accent-tinted backgrounds with dark accent text,
// fading out via alpha down the ladder.
const LIGHT_BG_MIX = [0.82, 0.72, 0.62, 0.55, 0.50, 0.45];
const LIGHT_BG_ALPHA = [255, 255, 238, 221, 187, 153];
const LIGHT_TEXT_F = [0.45, 0.42, 0.40, 0.36, 0.33, 0.30];

const lightTier = (A: RGB, tier: number): GeneratedTierStyle => {
  const border = tier <= 1 ? A : tier <= 3 ? scale(A, 0.75) : scale(A, 0.55);
  return {
    FontSize: FONT[tier],
    TextColor: hx(scale(A, LIGHT_TEXT_F[tier])),
    BorderColor: hx(border),
    BackgroundColor: hx(mix(A, WHITE, LIGHT_BG_MIX[tier]), LIGHT_BG_ALPHA[tier]),
    ...extras(A, tier),
  };
};

const NEON_BG_ALPHA = [0, 230, 230, 200, 200, 160];
const NEON_TEXT_F = [1, 1, 1, 0.85, 0.70, 0.55];
const NEON_BORDER_F = [1, 1, 0.80, 0.60, 0.40, 0.25];

const neonTier = (A: RGB, tier: number): GeneratedTierStyle => {
  const [h, s, l] = rgbToHsl(A);
  const neon = hslToRgb(h, Math.min(1, s * 1.4), Math.max(0.55, Math.min(0.65, l)));
  if (tier === 0) {
    return {
      FontSize: 45, TextColor: hx(WHITE), BorderColor: hx(WHITE),
      BackgroundColor: hx(neon), ...extras(A, 0),
    };
  }
  return {
    FontSize: FONT[tier],
    TextColor: hx(scale(neon, NEON_TEXT_F[tier])),
    BorderColor: hx(scale(neon, NEON_BORDER_F[tier])),
    BackgroundColor: hx(BLACK, NEON_BG_ALPHA[tier]),
    ...extras(A, tier),
  };
};

// ---- public API ------------------------------------------------------------------

export const generateSeries = (id: SeriesId, p: GenParams): Record<string, GeneratedTierStyle> => {
  const out: Record<string, GeneratedTierStyle> = {};
  for (const tier of GENERATOR_TIERS) {
    const A = accentFor(p, tier);
    out[`Tier ${tier}`] =
      id === 'standard' ? standardTier(A, tier) :
      id === 'boldFill' ? boldFillTier(A, tier) :
      id === 'minimalOutline' ? minimalOutlineTier(A, tier) :
      id === 'light' ? lightTier(A, tier) :
      neonTier(A, tier);
  }
  out['Tier 9'] = { ...HIDE_STYLE };
  return out;
};

export const generateAllSeries = (p: GenParams): Record<SeriesId, Record<string, GeneratedTierStyle>> => ({
  standard: generateSeries('standard', p),
  boldFill: generateSeries('boldFill', p),
  minimalOutline: generateSeries('minimalOutline', p),
  light: generateSeries('light', p),
  neon: generateSeries('neon', p),
});
