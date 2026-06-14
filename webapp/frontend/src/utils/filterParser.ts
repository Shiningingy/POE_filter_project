// ============================================================================
// filterParser.ts
// ----------------------------------------------------------------------------
// Parser + serializer for raw Path of Exile `.filter` text (the on-disk format
// written by GGG's client / FilterBlade / NeverSink / hand-authored filters).
//
// This is the READ direction that the rest of the app never had: everything
// else (generate.py, filterGenerator.ts) goes structured-data -> text. This
// goes text -> structured data and back.
//
// Design goal: a FOREIGN filter can be imported and re-exported faithfully.
//   - Live `Show` / `Hide` / `Minimal` blocks are parsed into structured
//     fields (action, conditions, actions) and RE-SERIALIZED FROM THOSE FIELDS.
//     This is what makes the round-trip a real test of the parse, not a raw
//     passthrough.
//   - Comment runs, section banners, disabled (commented-out) blocks and blank
//     lines are preserved VERBATIM so nothing the author wrote is silently lost.
//
// No imports on purpose: keeps this module trivially bundle-able for the
// stand-alone round-trip test (test_filter_roundtrip.mjs).
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockAction = 'Show' | 'Hide' | 'Minimal' | string;

/** One whitespace-delimited token of a statement's value list. */
export interface FilterToken {
  value: string;
  /** True if it was wrapped in double quotes in the source (e.g. "Apex Cleaver"). */
  quoted: boolean;
}

export type StatementKind = 'condition' | 'action' | 'flow' | 'comment' | 'unknown';

/** A single line inside a block: a condition, a style action, Continue, etc. */
export interface FilterStatement {
  /** e.g. "BaseType", "SetTextColor", "ItemLevel", "Continue". Empty for comment lines. */
  keyword: string;
  /** Comparison operator if present ("==", ">=", "<", ...) else null. */
  operator: string | null;
  values: FilterToken[];
  /** Trailing inline `# ...` comment on the statement line, if any. */
  comment: string | null;
  kind: StatementKind;
  /** Leading whitespace of the source line (tab or N spaces), preserved on emit. */
  indent: string;
  /** Verbatim original line (kept for debugging / diffing; NOT used to serialize). */
  raw: string;
}

/** A live Show/Hide/Minimal block. */
export interface FilterBlock {
  type: 'block';
  action: BlockAction;
  /** Leading whitespace before the action keyword (usually ""). */
  headerIndent: string;
  /** Whitespace between the action and the inline `#` (e.g. " " or "  "). */
  headerGap: string;
  /** Verbatim text after `#` on the header line (e.g. " %D8 $type->6l ..."), or null if no `#`. */
  inlineComment: string | null;
  statements: FilterStatement[];
}

/** A run of comment / blank / disabled-block lines, preserved verbatim. */
export interface CommentRun {
  type: 'comment';
  lines: string[];
  /** Heuristic flag: this run contains a commented-out Show/Hide block. */
  containsDisabledBlock: boolean;
}

export type FilterElement = FilterBlock | CommentRun;

export interface ParsedFilter {
  elements: FilterElement[];
  /** True if the source used CRLF line endings (so we can re-emit in kind). */
  crlf: boolean;
}

/** One entry of the navigable outline derived from section banners. */
export interface OutlineEntry {
  level: number;       // 1 = top ([[NNNN]]), 2 = sub ([NNNN])
  code: string | null; // e.g. "0200", "0301"
  title: string;
  /** Index into ParsedFilter.elements where this banner lives. */
  elementIndex: number;
}

// ---------------------------------------------------------------------------
// Keyword tables (used only to TAG statements; unknown keywords are preserved)
// ---------------------------------------------------------------------------

const CONDITION_KEYWORDS = new Set([
  'AlternateQuality', 'AnyEnchantment', 'ArchnemesisMod', 'AreaLevel', 'BaseArmour',
  'BaseDefencePercentile', 'BaseEnergyShield', 'BaseEvasion', 'BaseType', 'BaseWard',
  'BlightedMap', 'Class', 'Corrupted', 'CorruptedMods', 'DropLevel', 'ElderItem',
  'ElderMap', 'EnchantmentPassiveNode', 'EnchantmentPassiveNum', 'FracturedItem',
  'GemLevel', 'GemQualityType', 'HasCruciblePassiveTree', 'HasEaterOfWorldsImplicit',
  'HasEnchantment', 'HasExplicitMod', 'HasImplicitMod', 'HasInfluence',
  'HasSearingExarchImplicit', 'Height', 'Identified', 'ItemLevel', 'LinkedSockets',
  'MapTier', 'Memoryitem', 'Mirrored', 'Quality', 'Rarity', 'Replica', 'Scourged',
  'ShapedMap', 'ShaperItem', 'SocketGroup', 'Sockets', 'StackSize', 'SynthesisedItem',
  'TransfiguredGem', 'UberBlightedMap', 'Width', 'ZanaMemory',
]);

const ACTION_KEYWORDS = new Set([
  'SetBorderColor', 'SetTextColor', 'SetBackgroundColor', 'SetFontSize',
  'PlayAlertSound', 'PlayAlertSoundPositional', 'CustomAlertSound',
  'CustomAlertSoundOptional', 'DisableDropSound', 'EnableDropSound',
  'DisableDropSoundIfAlertSound', 'EnableDropSoundIfAlertSound',
  'MinimapIcon', 'PlayEffect',
]);

const FLOW_KEYWORDS = new Set(['Continue', 'Import']);

const OPERATORS = new Set(['==', '!=', '<=', '>=', '<', '>', '=']);

function classify(keyword: string): StatementKind {
  if (CONDITION_KEYWORDS.has(keyword)) return 'condition';
  if (ACTION_KEYWORDS.has(keyword)) return 'action';
  if (FLOW_KEYWORDS.has(keyword)) return 'flow';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Split the value portion of a statement into tokens, honouring double quotes
 * and stripping a trailing inline `# comment`.
 */
function tokenizeValues(s: string): { tokens: FilterToken[]; comment: string | null } {
  const tokens: FilterToken[] = [];
  let comment: string | null = null;
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const ch = s[i];
    if (ch === '#') {
      comment = s.slice(i + 1).replace(/\s+$/, '');
      break;
    }
    if (ch === '"') {
      i++;
      let v = '';
      while (i < s.length && s[i] !== '"') { v += s[i]; i++; }
      i++; // consume closing quote
      tokens.push({ value: v, quoted: true });
    } else {
      let v = '';
      while (i < s.length && !/\s/.test(s[i])) { v += s[i]; i++; }
      tokens.push({ value: v, quoted: false });
    }
  }
  return { tokens, comment };
}

function parseStatement(rawLine: string): FilterStatement {
  const indent = (rawLine.match(/^(\s*)/) as RegExpMatchArray)[1];
  const content = rawLine.trim();
  const m = content.match(/^(\S+)\s*([\s\S]*)$/);
  const keyword = m ? m[1] : content;
  const rest = m ? m[2] : '';
  const { tokens, comment } = tokenizeValues(rest);

  let operator: string | null = null;
  if (tokens.length && !tokens[0].quoted && OPERATORS.has(tokens[0].value)) {
    operator = tokens.shift()!.value;
  }

  return {
    keyword,
    operator,
    values: tokens,
    comment,
    kind: classify(keyword),
    indent,
    raw: rawLine,
  };
}

// ---------------------------------------------------------------------------
// Line classification helpers
// ---------------------------------------------------------------------------

const isBlank = (line: string) => line.trim() === '';
const isComment = (line: string) => line.trimStart().startsWith('#');
const isIndented = (line: string) => /^\s/.test(line);

/** A live (non-commented) block header: `Show`, `Hide ...`, `Minimal ...`. */
function matchBlockHeader(line: string): { indent: string; action: string; rest: string } | null {
  const m = line.match(/^(\s*)(Show|Hide|Minimal)\b([\s\S]*)$/);
  if (!m) return null;
  return { indent: m[1], action: m[2], rest: m[3] };
}

/** A commented-out block header: `#Hide`, `#  Show ...`. */
function isDisabledBlockHeader(line: string): boolean {
  return /^#\s*(Show|Hide|Minimal)\b/.test(line);
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function parseFilter(text: string): ParsedFilter {
  const crlf = /\r\n/.test(text);
  const lines = text.split(/\r?\n/);
  // A trailing newline produces a final empty string element; drop it so we
  // don't fabricate an extra blank line on re-serialize.
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  const elements: FilterElement[] = [];
  let i = 0;

  const flushComment = (buf: string[], disabled: boolean) => {
    if (buf.length) elements.push({ type: 'comment', lines: buf.slice(), containsDisabledBlock: disabled });
  };

  let commentBuf: string[] = [];
  let bufHasDisabled = false;

  while (i < lines.length) {
    const line = lines[i];
    const header = matchBlockHeader(line);

    if (header && !isComment(line)) {
      // Live block: flush any pending comment/blank run first.
      flushComment(commentBuf, bufHasDisabled);
      commentBuf = [];
      bufHasDisabled = false;

      // Split the header remainder into the gap before `#` and the verbatim
      // comment text after it, so e.g. `Hide  # %RH1` round-trips exactly.
      let headerGap = '';
      let inlineComment: string | null = null;
      const cm = header.rest.match(/^(\s*)#([\s\S]*)$/);
      if (cm) { headerGap = cm[1]; inlineComment = cm[2]; }

      const statements: FilterStatement[] = [];
      i++;
      // Consume indented, non-blank statement lines.
      while (i < lines.length && !isBlank(lines[i]) && isIndented(lines[i])) {
        const sline = lines[i];
        if (sline.trimStart().startsWith('#')) {
          // Inline full-line comment inside a block: preserve verbatim.
          statements.push({
            keyword: '', operator: null, values: [], comment: null,
            kind: 'comment', indent: '', raw: sline,
          });
        } else {
          statements.push(parseStatement(sline));
        }
        i++;
      }

      elements.push({
        type: 'block', action: header.action,
        headerIndent: header.indent, headerGap, inlineComment, statements,
      });
      continue;
    }

    // Comment, blank, or disabled-block line: accumulate verbatim.
    if (isComment(line) && isDisabledBlockHeader(line)) bufHasDisabled = true;
    commentBuf.push(line);
    i++;
  }

  flushComment(commentBuf, bufHasDisabled);

  return { elements, crlf };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

function serializeToken(tok: FilterToken): string {
  const needsQuote = tok.quoted || tok.value === '' || /\s/.test(tok.value);
  return needsQuote ? `"${tok.value}"` : tok.value;
}

function serializeStatement(st: FilterStatement): string {
  if (st.kind === 'comment') return st.raw; // verbatim
  const parts: string[] = [st.keyword];
  if (st.operator) parts.push(st.operator);
  for (const tok of st.values) parts.push(serializeToken(tok));
  let line = st.indent + parts.join(' ');
  // comment is stored verbatim (incl. its own leading space), so only the
  // separator space before `#` is added here.
  if (st.comment !== null) line += ` #${st.comment}`;
  return line;
}

function serializeBlock(b: FilterBlock): string[] {
  const head = b.inlineComment !== null
    ? `${b.headerIndent}${b.action}${b.headerGap}#${b.inlineComment}`
    : `${b.headerIndent}${b.action}`;
  return [head, ...b.statements.map(serializeStatement)];
}

export function serializeFilter(pf: ParsedFilter): string {
  const out: string[] = [];
  for (const el of pf.elements) {
    if (el.type === 'comment') out.push(...el.lines);
    else out.push(...serializeBlock(el));
  }
  const eol = pf.crlf ? '\r\n' : '\n';
  // Trailing newline to match conventional filter files.
  return out.join(eol) + eol;
}

// ---------------------------------------------------------------------------
// Outline extraction (the "documented filter" sectioning signal)
// ---------------------------------------------------------------------------

/**
 * Pull a navigable outline from section-banner comments. Recognises the
 * NeverSink/FilterBlade convention:
 *   # [[NNNN]] Title   -> top-level section
 *   #   [NNNN] Title   -> subsection
 * Returns [] for filters with no such markers (the "undocumented" case, where
 * we fall back to a different grouping strategy).
 */
export function extractOutline(pf: ParsedFilter): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  pf.elements.forEach((el, idx) => {
    if (el.type !== 'comment') return;
    for (const line of el.lines) {
      const top = line.match(/^#\s*\[\[(\w+)\]\]\s+(.*\S)\s*$/);
      if (top) { out.push({ level: 1, code: top[1], title: top[2], elementIndex: idx }); continue; }
      const sub = line.match(/^#\s+\[(\w+)\]\s+(.*\S)\s*$/);
      if (sub) { out.push({ level: 2, code: sub[1], title: sub[2], elementIndex: idx }); }
    }
  });
  return out;
}

/** Convenience: all live blocks in document order. */
export function liveBlocks(pf: ParsedFilter): FilterBlock[] {
  return pf.elements.filter((e): e is FilterBlock => e.type === 'block');
}
