import { useState, useMemo, useRef, useEffect } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { loadItemsDb } from '../services/clientData';
import SoundPicker from '../components/SoundPicker';
import MinimapIconPicker, { getIconStyle } from '../components/MinimapIconPicker';
import PlayEffectPicker from '../components/PlayEffectPicker';
import {
  parseFilter,
  serializeFilter,
  parseStatement,
  extractOutline,
  type ParsedFilter,
  type FilterBlock,
  type FilterStatement,
} from '../utils/filterParser';

// Purely client-side editing session: a foreign filter is not server state,
// so we persist straight to localStorage (no fake endpoint, no parity impact).
const LS_DATA = 'demo_foreign_filter';
const LS_NAME = 'demo_foreign_filter_name';

interface Props {
  language: Language;
}

// ---------------------------------------------------------------------------
// Style helpers (operate on raw filter values like "255 0 0 255")
// ---------------------------------------------------------------------------

const stmtOf = (b: FilterBlock, kw: string): FilterStatement | undefined =>
  b.statements.find((s) => s.keyword === kw);

const valsOf = (b: FilterBlock, kw: string): string[] =>
  stmtOf(b, kw)?.values.map((v) => v.value) ?? [];

const toCssRgba = (vals: string[], fallback: string): string => {
  if (vals.length < 3) return fallback;
  const [r, g, b, a] = vals;
  const alpha = a !== undefined ? Math.max(0, Math.min(255, parseInt(a, 10) || 0)) / 255 : 1;
  return `rgba(${r || 0},${g || 0},${b || 0},${alpha})`;
};

const valsToHex = (vals: string[]): string => {
  const h = (n: string | undefined) => (Math.max(0, Math.min(255, parseInt(n || '0', 10) || 0)))
    .toString(16).padStart(2, '0');
  return `#${h(vals[0])}${h(vals[1])}${h(vals[2])}`;
};

const hexToRgb = (hex: string): string[] => {
  const c = hex.replace('#', '');
  return [
    String(parseInt(c.slice(0, 2), 16)),
    String(parseInt(c.slice(2, 4), 16)),
    String(parseInt(c.slice(4, 6), 16)),
  ];
};

// Render a statement back to an editable one-line string (re-quoting as needed).
const condText = (s: FilterStatement): string => {
  const vals = s.values
    .map((v) => (v.quoted || v.value === '' || /\s/.test(v.value) ? `"${v.value}"` : v.value))
    .join(' ');
  return `${s.keyword}${s.operator ? ` ${s.operator}` : ''}${vals ? ` ${vals}` : ''}`;
};

const ACTION_COLORS: Record<string, string> = {
  Show: '#3da35d',
  Hide: '#b3473f',
  Minimal: '#777',
};

const SOUND_KEYS = ['PlayAlertSound', 'CustomAlertSound'];

// --- pure block transforms (reused by single + bulk edits) ---

const blockIndent = (b: FilterBlock): string =>
  b.statements.find((s) => s.kind !== 'comment')?.indent ?? '\t';

/** Insert or replace a statement, keeping it before any Continue/flow line. */
const upsert = (
  b: FilterBlock,
  keyword: string,
  values: string[],
  opts: { quotedFirst?: boolean } = {},
): FilterBlock => {
  const arr = b.statements.slice();
  const idx = arr.findIndex((s) => s.keyword === keyword);
  const tokens = values.map((v, i) => ({ value: v, quoted: !!opts.quotedFirst && i === 0 }));
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], values: tokens };
  } else {
    let pos = arr.findIndex((s) => s.kind === 'flow');
    if (pos < 0) pos = arr.length;
    arr.splice(pos, 0, {
      keyword, operator: null, values: tokens, comment: null,
      kind: 'action', indent: blockIndent(b), raw: '',
    });
  }
  return { ...b, statements: arr };
};

const removeKeywords = (b: FilterBlock, kws: string[]): FilterBlock =>
  ({ ...b, statements: b.statements.filter((s) => !kws.includes(s.keyword)) });

const applySound = (b: FilterBlock, path: string, vol: number): FilterBlock => {
  const cleared = removeKeywords(b, SOUND_KEYS);
  if (/^Default\/AlertSound/.test(path)) {
    const n = path.match(/AlertSound(\d+)/)?.[1] ?? '1';
    return upsert(cleared, 'PlayAlertSound', [n, String(vol)]);
  }
  // Custom sound: write a backslash path (the in-game convention).
  return upsert(cleared, 'CustomAlertSound', [path.replace(/\//g, '\\'), String(vol)], { quotedFirst: true });
};

const applyIconBeam = (b: FilterBlock, keyword: string, value: string | null): FilterBlock =>
  value === null ? removeKeywords(b, [keyword]) : upsert(b, keyword, value.split(/\s+/));

const makeNewBlock = (): FilterBlock => ({
  type: 'block', action: 'Show', headerIndent: '', headerGap: ' ', inlineComment: null,
  statements: [
    { keyword: 'SetFontSize', operator: null, values: [{ value: '40', quoted: false }], comment: null, kind: 'action', indent: '\t', raw: '' },
    { keyword: 'SetTextColor', operator: null, values: ['255', '255', '255', '255'].map((v) => ({ value: v, quoted: false })), comment: null, kind: 'action', indent: '\t', raw: '' },
    { keyword: 'SetBorderColor', operator: null, values: ['255', '255', '255', '255'].map((v) => ({ value: v, quoted: false })), comment: null, kind: 'action', indent: '\t', raw: '' },
    { keyword: 'SetBackgroundColor', operator: null, values: ['40', '40', '40', '255'].map((v) => ({ value: v, quoted: false })), comment: null, kind: 'action', indent: '\t', raw: '' },
  ],
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ImportForeignFilterView = ({ language }: Props) => {
  const t = useTranslation(language) as any;
  const isCh = language === 'ch';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedFilter | null>(null);
  const [fileName, setFileName] = useState<string>('imported.filter');
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [classMap, setClassMap] = useState<Record<string, string>>({});

  // Condition editing (uncontrolled input).
  const [edit, setEdit] = useState<{ block: number; stmt: number } | null>(null);
  const editInitRef = useRef<string>('');
  const cancelRef = useRef<boolean>(false);

  // Sound/icon/beam picker: target is a block index or 'bulk'.
  const [picker, setPicker] = useState<{ kind: 'sound' | 'icon' | 'beam'; target: number | 'bulk' } | null>(null);

  // Bulk select / restyle.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Restore a previously imported filter on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_DATA);
      if (raw) {
        setParsed(JSON.parse(raw));
        setFileName(localStorage.getItem(LS_NAME) || 'imported.filter');
      }
    } catch { /* ignore corrupt cache */ }
  }, []);

  // BaseType -> class map (for grouping filters without section banners).
  useEffect(() => {
    loadItemsDb()
      .then((db) => {
        const m: Record<string, string> = {};
        for (const [name, info] of Object.entries(db.items || {})) {
          const cls = (info as any)?.item_class;
          if (cls) m[name] = cls;
        }
        setClassMap(m);
      })
      .catch(() => { /* falls back to Class conditions */ });
  }, []);

  const persist = (pf: ParsedFilter | null, name: string) => {
    try {
      if (pf) {
        localStorage.setItem(LS_DATA, JSON.stringify(pf));
        localStorage.setItem(LS_NAME, name);
      } else {
        localStorage.removeItem(LS_DATA);
        localStorage.removeItem(LS_NAME);
      }
    } catch { /* quota — non-fatal */ }
  };

  const outline = useMemo(() => (parsed ? extractOutline(parsed) : []), [parsed]);
  const autoGrouped = !!parsed && outline.length === 0;

  const stats = useMemo(() => {
    if (!parsed) return { total: 0, show: 0, hide: 0 };
    let show = 0, hide = 0, total = 0;
    for (const el of parsed.elements) {
      if (el.type !== 'block') continue;
      total++;
      if (el.action === 'Hide') hide++; else show++;
    }
    return { total, show, hide };
  }, [parsed]);

  const groupKeyOf = (b: FilterBlock): string => {
    const cls = valsOf(b, 'Class')[0];
    if (cls) return cls;
    const base = valsOf(b, 'BaseType')[0];
    if (base && classMap[base]) return classMap[base];
    return isCh ? '其他' : 'Other';
  };

  const headerAt = useMemo(() => {
    const m = new Map<number, { level: number; title: string }>();
    if (!parsed) return m;
    if (!autoGrouped) {
      for (const o of outline) {
        m.set(o.elementIndex, { level: o.level, title: (o.code ? `[${o.code}] ` : '') + o.title });
      }
    } else {
      let prev: string | null = null;
      parsed.elements.forEach((el, i) => {
        if (el.type !== 'block') return;
        const k = groupKeyOf(el);
        if (k !== prev) { m.set(i, { level: 1, title: k }); prev = k; }
      });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, outline, autoGrouped, classMap, isCh]);

  const navEntries = useMemo(() => {
    if (!parsed) return [] as { title: string; elementIndex: number; level: number }[];
    if (!autoGrouped) {
      return outline.map((o) => ({ title: o.title, elementIndex: o.elementIndex, level: o.level }));
    }
    const first = new Map<string, number>();
    const count = new Map<string, number>();
    parsed.elements.forEach((el, i) => {
      if (el.type !== 'block') return;
      const k = groupKeyOf(el);
      if (!first.has(k)) first.set(k, i);
      count.set(k, (count.get(k) || 0) + 1);
    });
    return [...first.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([k, idx]) => ({ title: `${k} (${count.get(k)})`, elementIndex: idx, level: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, outline, autoGrouped, classMap, isCh]);

  // -------------------------------------------------------------------------
  // Import / clear / export
  // -------------------------------------------------------------------------

  const resetTransientState = () => {
    setExpanded(new Set());
    setEdit(null);
    setPicker(null);
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const pf = parseFilter(text);
      const blocks = pf.elements.filter((e) => e.type === 'block').length;
      if (blocks === 0) {
        setError(isCh ? '未在该文件中找到任何 Show/Hide 规则。' : 'No Show/Hide blocks found in that file.');
        return;
      }
      setError('');
      setParsed(pf);
      setFileName(file.name || 'imported.filter');
      setQuery('');
      resetTransientState();
      persist(pf, file.name || 'imported.filter');
    } catch (e) {
      console.error('Foreign filter parse failed:', e);
      setError(isCh ? '无法解析该文件。' : 'Could not parse that file.');
    }
  };

  const clearAll = () => {
    setParsed(null);
    setError('');
    resetTransientState();
    persist(null, '');
  };

  const downloadBlob = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reExport = () => {
    if (!parsed) return;
    downloadBlob(serializeFilter(parsed), fileName);
  };

  // -------------------------------------------------------------------------
  // Edits (immutable)
  // -------------------------------------------------------------------------

  const mutateBlock = (elemIndex: number, fn: (b: FilterBlock) => FilterBlock) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const el = prev.elements[elemIndex];
      if (!el || el.type !== 'block') return prev;
      const elements = prev.elements.slice();
      elements[elemIndex] = fn(el);
      const next = { ...prev, elements };
      persist(next, fileName);
      return next;
    });
  };

  const mutateBlocks = (indices: number[], fn: (b: FilterBlock) => FilterBlock) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const elements = prev.elements.slice();
      for (const idx of indices) {
        const el = elements[idx];
        if (el && el.type === 'block') elements[idx] = fn(el);
      }
      const next = { ...prev, elements };
      persist(next, fileName);
      return next;
    });
  };

  const mutateElements = (fn: (els: ParsedFilter['elements']) => ParsedFilter['elements']) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const next = { ...prev, elements: fn(prev.elements.slice()) };
      persist(next, fileName);
      return next;
    });
  };

  const toggleAction = (elemIndex: number) =>
    mutateBlock(elemIndex, (b) => ({
      ...b, action: b.action === 'Hide' ? 'Show' : b.action === 'Show' ? 'Hide' : b.action,
    }));

  const setStyleValues = (elemIndex: number, keyword: string, values: string[]) =>
    mutateBlock(elemIndex, (b) => upsert(b, keyword, values));

  const addBlockAt = (pos: number) => {
    mutateElements((els) => { els.splice(pos, 0, makeNewBlock()); return els; });
    resetTransientState();
  };

  const deleteBlock = (elemIndex: number) => {
    if (!window.confirm(isCh ? '删除这条规则？' : 'Delete this rule?')) return;
    mutateElements((els) => { els.splice(elemIndex, 1); return els; });
    resetTransientState();
  };

  const deleteSelected = () => {
    if (!selected.size) return;
    if (!window.confirm(isCh ? `删除选中的 ${selected.size} 条规则？` : `Delete ${selected.size} selected rules?`)) return;
    const drop = new Set(selected);
    mutateElements((els) => els.filter((_, i) => !drop.has(i)));
    resetTransientState();
  };

  // bulk style application
  const selArr = () => [...selected];
  const bulkStyle = (keyword: string, values: string[]) => mutateBlocks(selArr(), (b) => upsert(b, keyword, values));
  const bulkAction = (action: string) => mutateBlocks(selArr(), (b) => ({ ...b, action }));

  // sound/icon/beam apply (single or bulk based on picker.target)
  const applyPicker = (apply: (b: FilterBlock) => FilterBlock) => {
    if (!picker) return;
    if (picker.target === 'bulk') mutateBlocks(selArr(), apply);
    else mutateBlock(picker.target, apply);
    setPicker(null);
  };

  const toggleExpand = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  const toggleSelect = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  // -------------------------------------------------------------------------
  // Condition edit lifecycle (uncontrolled input)
  // -------------------------------------------------------------------------

  const startEdit = (block: number, stmt: number, text: string) => {
    editInitRef.current = text; cancelRef.current = false; setEdit({ block, stmt });
  };
  const startAdd = (block: number) => { editInitRef.current = ''; cancelRef.current = false; setEdit({ block, stmt: -1 }); };
  const commitEdit = (value: string) => {
    if (cancelRef.current) { cancelRef.current = false; setEdit(null); return; }
    const e = edit;
    if (!e) return;
    const text = value.trim();
    if (e.stmt === -1) {
      if (text) mutateBlock(e.block, (b) => {
        const ns: FilterStatement = { ...parseStatement(text), indent: blockIndent(b) };
        const arr = b.statements.slice();
        let pos = arr.findIndex((s) => s.kind === 'action' || s.kind === 'flow');
        if (pos < 0) pos = arr.length;
        arr.splice(pos, 0, ns);
        return { ...b, statements: arr };
      });
    } else if (!text) {
      mutateBlock(e.block, (b) => { const arr = b.statements.slice(); arr.splice(e.stmt, 1); return { ...b, statements: arr }; });
    } else {
      mutateBlock(e.block, (b) => {
        const arr = b.statements.slice();
        const old = arr[e.stmt];
        arr[e.stmt] = { ...parseStatement(text), indent: old?.indent ?? blockIndent(b) };
        return { ...b, statements: arr };
      });
    }
    setEdit(null);
  };
  const onEditKey = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); }
    else if (ev.key === 'Escape') { cancelRef.current = true; ev.currentTarget.blur(); }
  };

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const matchesQuery = (b: FilterBlock): boolean => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    if ((b.inlineComment || '').toLowerCase().includes(q)) return true;
    return b.statements.some((s) =>
      s.keyword.toLowerCase().includes(q) ||
      s.values.some((v) => v.value.toLowerCase().includes(q)));
  };

  const scrollTo = (elemIndex: number) => {
    document.getElementById(`iff-sec-${elemIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById(`iff-blk-${elemIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // sound description / picker init
  const soundInit = (b: FilterBlock): { path: string; vol: number } => {
    const csa = stmtOf(b, 'CustomAlertSound');
    if (csa) return { path: (csa.values[0]?.value || '').replace(/\\/g, '/'), vol: parseInt(csa.values[1]?.value || '300', 10) };
    const pas = stmtOf(b, 'PlayAlertSound');
    if (pas) return { path: `Default/AlertSound${pas.values[0]?.value || '1'}.mp3`, vol: parseInt(pas.values[1]?.value || '300', 10) };
    return { path: '', vol: 300 };
  };
  const soundLabel = (b: FilterBlock): string => {
    const csa = stmtOf(b, 'CustomAlertSound');
    if (csa) return (csa.values[0]?.value || '').split(/[\\/]/).pop() || '?';
    const pas = stmtOf(b, 'PlayAlertSound');
    if (pas) return `Default #${pas.values[0]?.value || '?'}`;
    return isCh ? '无' : 'None';
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderConditions = (b: FilterBlock, i: number) => {
    const addingNew = edit?.block === i && edit.stmt === -1;
    return (
      <div className="iff-conds">
        {b.statements.map((s, si) => {
          if (s.kind !== 'condition') return null;
          if (edit?.block === i && edit.stmt === si) {
            return (
              <input key={si} className="iff-cond-edit" autoFocus defaultValue={editInitRef.current}
                onKeyDown={onEditKey} onBlur={(e) => commitEdit(e.target.value)} />
            );
          }
          const vals = s.values.map((v) => v.value);
          const shown = vals.slice(0, 6).join(' ');
          const more = vals.length > 6 ? ` +${vals.length - 6}` : '';
          const rest = `${s.operator ? ' ' + s.operator : ''} ${shown}${more}`;
          return (
            <span key={si} className="iff-cond" onClick={() => startEdit(i, si, condText(s))}
              title={isCh ? '点击编辑' : 'Click to edit'}>
              <span className="iff-cond-kw">{s.keyword}</span>
              <span className="iff-cond-val">{rest}</span>
              <button className="iff-cond-x" title={isCh ? '删除条件' : 'Delete condition'}
                onClick={(e) => { e.stopPropagation(); mutateBlock(i, (bb) => { const arr = bb.statements.slice(); arr.splice(si, 1); return { ...bb, statements: arr }; }); }}>×</button>
            </span>
          );
        })}
        {addingNew ? (
          <input className="iff-cond-edit" autoFocus defaultValue=""
            placeholder={isCh ? '例如 ItemLevel >= 84' : 'e.g. ItemLevel >= 84'}
            onKeyDown={onEditKey} onBlur={(e) => commitEdit(e.target.value)} />
        ) : (
          <button className="iff-cond-add" onClick={() => startAdd(i)}>+ {isCh ? '条件' : 'condition'}</button>
        )}
      </div>
    );
  };

  const renderPreview = (b: FilterBlock) => {
    const text = toCssRgba(valsOf(b, 'SetTextColor'), 'rgba(200,200,200,1)');
    const border = toCssRgba(valsOf(b, 'SetBorderColor'), 'rgba(0,0,0,0)');
    const bg = toCssRgba(valsOf(b, 'SetBackgroundColor'), 'rgba(0,0,0,0.35)');
    const fsArr = valsOf(b, 'SetFontSize');
    const fontSize = Math.max(12, Math.min(60, fsArr.length ? parseInt(fsArr[0], 10) || 32 : 32));
    const beam = valsOf(b, 'PlayEffect')[0];
    const icon = valsOf(b, 'MinimapIcon');
    const sample = valsOf(b, 'BaseType')[0] || valsOf(b, 'Class')[0] || (b.inlineComment || '').trim() || b.action;
    const label = sample.length > 28 ? sample.slice(0, 27) + '…' : sample;
    return (
      <div className="iff-preview-wrap">
        {beam && <span className="iff-beam" style={{ background: beam.toLowerCase() }} title={`Beam: ${beam}`} />}
        <div className="iff-plate" style={{ color: text, borderColor: border, background: bg, fontSize: `${Math.round(fontSize * 0.55)}px` }}>
          {icon.length >= 2 && <span className="iff-icon-mini" style={getIconStyle(icon[1] || 'Grey', icon[2] || 'Circle', 0.7)} />}
          {label}
        </div>
      </div>
    );
  };

  const ColorRow = ({ b, i, keyword, label }: { b: FilterBlock; i: number; keyword: string; label: string }) => {
    const vals = valsOf(b, keyword);
    const hex = vals.length >= 3 ? valsToHex(vals) : '#000000';
    const alpha = vals[3] !== undefined ? parseInt(vals[3], 10) : 255;
    return (
      <div className="iff-srow">
        <span className="iff-slabel">{label}</span>
        <input type="color" value={hex} onChange={(e) => setStyleValues(i, keyword, [...hexToRgb(e.target.value), String(alpha)])} />
        <input type="range" min={0} max={255} value={alpha}
          onChange={(e) => setStyleValues(i, keyword, [...(vals.length >= 3 ? vals.slice(0, 3) : hexToRgb(hex)), e.target.value])} />
        <span className="iff-alpha">{alpha}</span>
      </div>
    );
  };

  const renderBlock = (b: FilterBlock, i: number) => {
    const open = expanded.has(i);
    const fsArr = valsOf(b, 'SetFontSize');
    const fontSize = fsArr.length ? parseInt(fsArr[0], 10) || 32 : 32;
    const icon = valsOf(b, 'MinimapIcon');
    const beam = valsOf(b, 'PlayEffect')[0];
    return (
      <div className={`iff-block ${b.action === 'Hide' ? 'is-hide' : ''} ${selected.has(i) ? 'is-sel' : ''}`} id={`iff-blk-${i}`} key={i}>
        <div className="iff-block-top">
          {selectMode && (
            <input type="checkbox" className="iff-sel" checked={selected.has(i)} onChange={() => toggleSelect(i)} />
          )}
          <button className="iff-action" style={{ background: ACTION_COLORS[b.action] || '#777' }}
            onClick={() => toggleAction(i)} title={isCh ? '点击切换 显示/隐藏' : 'Click to toggle Show/Hide'}>{b.action}</button>
          {b.inlineComment && <span className="iff-meta">{b.inlineComment.trim()}</span>}
          <div className="iff-spacer" />
          {renderPreview(b)}
          <button className="iff-expand" onClick={() => toggleExpand(i)}>{open ? '▾ ' : '▸ '}{isCh ? '样式' : 'Style'}</button>
          <button className="iff-mini-btn" title={isCh ? '在下方插入规则' : 'Insert rule below'} onClick={() => addBlockAt(i + 1)}>＋</button>
          <button className="iff-mini-btn danger" title={isCh ? '删除规则' : 'Delete rule'} onClick={() => deleteBlock(i)}>🗑</button>
        </div>
        {renderConditions(b, i)}
        {open && (
          <div className="iff-style">
            <ColorRow b={b} i={i} keyword="SetTextColor" label={t.textColor || 'Text'} />
            <ColorRow b={b} i={i} keyword="SetBorderColor" label={t.borderColor || 'Border'} />
            <ColorRow b={b} i={i} keyword="SetBackgroundColor" label={t.bgColor || 'Background'} />
            <div className="iff-srow">
              <span className="iff-slabel">{t.fontSize || 'Font Size'}</span>
              <input type="range" min={18} max={45} value={Math.max(18, Math.min(45, fontSize))}
                onChange={(e) => setStyleValues(i, 'SetFontSize', [e.target.value])} />
              <span className="iff-alpha">{fontSize}</span>
            </div>
            <div className="iff-srow">
              <span className="iff-slabel">{isCh ? '音效' : 'Sound'}</span>
              <button className="iff-pick-btn" onClick={() => setPicker({ kind: 'sound', target: i })}>{soundLabel(b)}</button>
              {(stmtOf(b, 'PlayAlertSound') || stmtOf(b, 'CustomAlertSound')) && (
                <button className="iff-clear-x" title={isCh ? '清除' : 'Clear'} onClick={() => mutateBlock(i, (bb) => removeKeywords(bb, SOUND_KEYS))}>×</button>
              )}
            </div>
            <div className="iff-srow">
              <span className="iff-slabel">{isCh ? '图标' : 'Icon'}</span>
              <button className="iff-pick-btn" onClick={() => setPicker({ kind: 'icon', target: i })}>
                {icon.length >= 2
                  ? <><span style={getIconStyle(icon[1] || 'Grey', icon[2] || 'Circle', 0.7)} /> {icon.join(' ')}</>
                  : (isCh ? '无' : 'None')}
              </button>
            </div>
            <div className="iff-srow">
              <span className="iff-slabel">{isCh ? '光柱' : 'Beam'}</span>
              <button className="iff-pick-btn" onClick={() => setPicker({ kind: 'beam', target: i })}>
                {beam ? <><span className="iff-beam-dot" style={{ background: beam.toLowerCase() }} /> {valsOf(b, 'PlayEffect').join(' ')}</> : (isCh ? '无' : 'None')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBody = () => {
    if (!parsed) return null;
    const searching = query.trim().length > 0;
    const nodes: ReactElement[] = [];
    parsed.elements.forEach((el, i) => {
      const hdr = !searching ? headerAt.get(i) : undefined;
      if (hdr) nodes.push(<div className={`iff-sec lvl${hdr.level}`} id={`iff-sec-${i}`} key={`s${i}`}>{hdr.title}</div>);
      if (el.type === 'comment') {
        if (!searching && el.containsDisabledBlock && !hdr) {
          nodes.push(<div className="iff-disabled" key={`d${i}`}>{isCh ? '（已禁用规则，导出时原样保留）' : '(disabled rule — preserved verbatim on export)'}</div>);
        }
        return;
      }
      if (searching && !matchesQuery(el)) return;
      nodes.push(renderBlock(el, i));
    });
    return nodes;
  };

  const warning = isCh
    ? '不推荐：这是导入他人过滤器的实验性功能。即使重新导出为标准 .filter，它仍不在我们的预设体系内，后续升级与维护会更困难。建议优先使用本站从零生成过滤器。'
    : 'Not recommended: importing someone else’s filter is an experimental power feature. Even re-exported as a standard .filter, it lives outside our preset system and is harder to maintain and update. Prefer building a filter from scratch here.';

  // bulk-bar picker init (empty) + apply
  const pickerInit = picker && picker.target !== 'bulk'
    ? (picker.kind === 'sound' ? soundInit(parsed!.elements[picker.target] as FilterBlock) : null)
    : null;
  const pickerIconVal = picker && picker.target !== 'bulk' && picker.kind === 'icon'
    ? (valsOf(parsed!.elements[picker.target] as FilterBlock, 'MinimapIcon').join(' ') || null) : null;
  const pickerBeamVal = picker && picker.target !== 'bulk' && picker.kind === 'beam'
    ? (valsOf(parsed!.elements[picker.target] as FilterBlock, 'PlayEffect').join(' ') || null) : null;

  // -------------------------------------------------------------------------

  return (
    <div className="iff-root">
      <input ref={fileInputRef} type="file" accept=".filter,.ruthlessfilter,.txt" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      <div className="iff-warning"><span className="iff-warn-icon">⚠</span><span>{warning}</span></div>

      {!parsed ? (
        <div className="iff-empty">
          <h2>{isCh ? '导入外来过滤器' : 'Import a Foreign Filter'}</h2>
          <p>{isCh
            ? '选择任意 .filter 文件（NeverSink / FilterBlade / 手写均可）。我们会按其原本的结构解析，并尽量原样保留，可在此查看、增删规则、编辑条件/颜色/音效/图标/光柱，然后重新导出。'
            : 'Pick any .filter file (NeverSink / FilterBlade / hand-written). We parse it in its own structure, preserve it faithfully, and let you add/remove rules and edit conditions, colors, sounds, icons and beams, then re-export.'}</p>
          <button className="iff-import-btn" onClick={() => fileInputRef.current?.click()}>{isCh ? '选择 .filter 文件' : 'Choose .filter file'}</button>
          {error && <div className="iff-error">{error}</div>}
        </div>
      ) : (
        <>
          <div className="iff-toolbar">
            <span className="iff-fname" title={fileName}>{fileName}</span>
            <span className="iff-stat">{stats.total} {isCh ? '条规则' : 'blocks'}</span>
            <span className="iff-stat show">▸ {stats.show}</span>
            <span className="iff-stat hide">▾ {stats.hide}</span>
            <input className="iff-search" placeholder={isCh ? '筛选规则…' : 'Filter blocks…'} value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="iff-spacer" />
            <button className="iff-btn" onClick={() => addBlockAt(0)}>+ {isCh ? '规则' : 'Rule'}</button>
            <button className={`iff-btn ${selectMode ? 'primary' : ''}`} onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}>
              {selectMode ? (isCh ? '退出选择' : 'Done') : (isCh ? '选择' : 'Select')}
            </button>
            <button className="iff-btn" onClick={() => fileInputRef.current?.click()}>{isCh ? '重新选择' : 'Replace'}</button>
            <button className="iff-btn primary" onClick={reExport}>{isCh ? '导出 .filter' : 'Export .filter'}</button>
            <button className="iff-btn danger" onClick={clearAll}>{isCh ? '清除' : 'Clear'}</button>
          </div>

          {selectMode && (
            <div className="iff-bulkbar">
              <span className="iff-bulk-count">{selected.size} {isCh ? '已选' : 'selected'}</span>
              <button className="iff-bulk-act" onClick={() => bulkAction('Show')}>{isCh ? '显示' : 'Show'}</button>
              <button className="iff-bulk-act" onClick={() => bulkAction('Hide')}>{isCh ? '隐藏' : 'Hide'}</button>
              <span className="iff-bulk-sep" />
              <label className="iff-bulk-color">{isCh ? '文字' : 'Text'}<input type="color" onChange={(e) => bulkStyle('SetTextColor', [...hexToRgb(e.target.value), '255'])} /></label>
              <label className="iff-bulk-color">{isCh ? '边框' : 'Border'}<input type="color" onChange={(e) => bulkStyle('SetBorderColor', [...hexToRgb(e.target.value), '255'])} /></label>
              <label className="iff-bulk-color">{isCh ? '背景' : 'BG'}<input type="color" onChange={(e) => bulkStyle('SetBackgroundColor', [...hexToRgb(e.target.value), '255'])} /></label>
              <span className="iff-bulk-sep" />
              <button className="iff-bulk-act" disabled={!selected.size} onClick={() => setPicker({ kind: 'sound', target: 'bulk' })}>{isCh ? '音效' : 'Sound'}</button>
              <button className="iff-bulk-act" disabled={!selected.size} onClick={() => setPicker({ kind: 'icon', target: 'bulk' })}>{isCh ? '图标' : 'Icon'}</button>
              <button className="iff-bulk-act" disabled={!selected.size} onClick={() => setPicker({ kind: 'beam', target: 'bulk' })}>{isCh ? '光柱' : 'Beam'}</button>
              <span className="iff-bulk-sep" />
              <button className="iff-bulk-act danger" disabled={!selected.size} onClick={deleteSelected}>{isCh ? '删除' : 'Delete'}</button>
            </div>
          )}

          <div className="iff-main">
            <div className="iff-outline">
              <div className="iff-outline-title">{autoGrouped ? (isCh ? '按类别分组' : 'Grouped by class') : (isCh ? '章节' : 'Sections')}</div>
              {autoGrouped && <div className="iff-outline-empty">{isCh ? '该过滤器无章节标记，已按物品类别自动分组。' : 'No section markers — auto-grouped by item class.'}</div>}
              {navEntries.map((o, k) => (
                <button key={k} className={`iff-onav lvl${o.level}`} onClick={() => scrollTo(o.elementIndex)} title={o.title}>{o.title}</button>
              ))}
            </div>
            <div className="iff-list">{renderBody()}</div>
          </div>
        </>
      )}

      {picker?.kind === 'sound' && (
        <SoundPicker language={language} initialPath={pickerInit?.path} initialVolume={pickerInit?.vol}
          onClose={() => setPicker(null)} onConfirm={(p, v) => applyPicker((b) => applySound(b, p, v))} />
      )}
      {picker?.kind === 'icon' && (
        <MinimapIconPicker language={language} value={pickerIconVal}
          onClose={() => setPicker(null)} onConfirm={(val) => applyPicker((b) => applyIconBeam(b, 'MinimapIcon', val))} />
      )}
      {picker?.kind === 'beam' && (
        <PlayEffectPicker language={language} value={pickerBeamVal}
          onClose={() => setPicker(null)} onConfirm={(val) => applyPicker((b) => applyIconBeam(b, 'PlayEffect', val))} />
      )}

      <style>{`
        .iff-root { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #1e1e1e; color: #ddd; }
        .iff-warning { display: flex; gap: 10px; align-items: center; flex-shrink: 0; background: #5a3a12; color: #ffd9a0; border-bottom: 1px solid #7a5018; padding: 10px 18px; font-size: 0.85rem; line-height: 1.4; }
        .iff-warn-icon { font-size: 1.2rem; flex-shrink: 0; }

        .iff-empty { margin: auto; max-width: 560px; text-align: center; padding: 40px 20px; }
        .iff-empty h2 { margin: 0 0 12px; }
        .iff-empty p { color: #aaa; line-height: 1.6; margin-bottom: 24px; }
        .iff-import-btn, .iff-btn, .iff-action, .iff-expand, .iff-onav, .iff-mini-btn, .iff-pick-btn, .iff-bulk-act { cursor: pointer; border: none; border-radius: 6px; font-family: inherit; }
        .iff-import-btn { background: #2196F3; color: white; padding: 12px 28px; font-size: 1rem; }
        .iff-import-btn:hover { background: #1976D2; }
        .iff-error { color: #ff8a80; margin-top: 16px; }

        .iff-toolbar { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding: 10px 18px; background: #2a2a2a; border-bottom: 1px solid #383838; flex-wrap: wrap; }
        .iff-fname { font-weight: 600; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iff-stat { font-size: 0.8rem; color: #aaa; }
        .iff-stat.show { color: #6cc070; }
        .iff-stat.hide { color: #d9756c; }
        .iff-spacer { flex: 1; }
        .iff-search { background: #1e1e1e; border: 1px solid #444; color: #ddd; padding: 6px 10px; border-radius: 6px; min-width: 160px; }
        .iff-btn { background: #444; color: #eee; padding: 7px 13px; font-size: 0.85rem; }
        .iff-btn:hover { background: #555; }
        .iff-btn.primary { background: #2196F3; color: white; }
        .iff-btn.primary:hover { background: #1976D2; }
        .iff-btn.danger { background: #7a3631; color: #ffd9d4; }
        .iff-btn.danger:hover { background: #94403a; }

        .iff-bulkbar { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding: 8px 18px; background: #14324a; border-bottom: 1px solid #1f4a6e; flex-wrap: wrap; }
        .iff-bulk-count { font-weight: 700; color: #7fd1ff; font-size: 0.85rem; }
        .iff-bulk-act { background: #2a5a7a; color: #dff; padding: 5px 12px; font-size: 0.82rem; }
        .iff-bulk-act:hover { background: #356c92; }
        .iff-bulk-act:disabled { opacity: 0.4; cursor: not-allowed; }
        .iff-bulk-act.danger { background: #7a3631; color: #ffd9d4; }
        .iff-bulk-sep { width: 1px; align-self: stretch; background: #2f5d80; }
        .iff-bulk-color { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: #bdf; }
        .iff-bulk-color input[type=color] { width: 30px; height: 24px; border: none; background: none; padding: 0; cursor: pointer; }

        .iff-main { display: flex; flex: 1; min-height: 0; }
        .iff-outline { width: 240px; flex-shrink: 0; overflow-y: auto; background: #232323; border-right: 1px solid #383838; padding: 10px 6px; }
        .iff-outline-title { font-size: 0.75rem; text-transform: uppercase; color: #888; padding: 4px 8px 8px; letter-spacing: 0.05em; }
        .iff-outline-empty { font-size: 0.78rem; color: #777; padding: 4px 8px 10px; line-height: 1.4; }
        .iff-onav { display: block; width: 100%; text-align: left; background: none; color: #bbb; padding: 5px 8px; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iff-onav:hover { background: #333; color: #fff; }
        .iff-onav.lvl1 { font-weight: 600; color: #ddd; }
        .iff-onav.lvl2 { padding-left: 20px; color: #999; }

        .iff-list { flex: 1; overflow-y: auto; padding: 14px 18px; min-width: 0; }
        .iff-sec { font-weight: 700; color: #7fd1ff; padding: 16px 0 8px; border-bottom: 1px solid #333; margin-bottom: 10px; }
        .iff-sec.lvl2 { font-size: 0.9rem; color: #9ab; padding-left: 12px; }
        .iff-disabled { color: #666; font-size: 0.78rem; font-style: italic; padding: 4px 0 4px 12px; }

        .iff-block { background: #262626; border: 1px solid #353535; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .iff-block.is-hide { opacity: 0.72; }
        .iff-block.is-sel { border-color: #2f7fb5; box-shadow: 0 0 0 1px #2f7fb5; }
        .iff-block-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .iff-sel { width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
        .iff-action { color: white; padding: 3px 10px; font-size: 0.78rem; font-weight: 700; min-width: 56px; }
        .iff-meta { font-size: 0.76rem; color: #888; font-family: 'Consolas', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
        .iff-expand { background: #333; color: #ccc; padding: 4px 10px; font-size: 0.78rem; }
        .iff-expand:hover { background: #404040; }
        .iff-mini-btn { background: #333; color: #bbb; padding: 4px 8px; font-size: 0.8rem; line-height: 1; }
        .iff-mini-btn:hover { background: #404040; color: #fff; }
        .iff-mini-btn.danger:hover { background: #6e2f2b; color: #ffd9d4; }

        .iff-preview-wrap { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .iff-beam { width: 6px; height: 26px; border-radius: 3px; display: inline-block; }
        .iff-plate { display: inline-flex; align-items: center; gap: 6px; border: 2px solid; padding: 3px 12px; border-radius: 3px; font-weight: 700; line-height: 1.2; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iff-icon-mini { flex-shrink: 0; }

        .iff-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
        .iff-cond { display: inline-flex; align-items: center; cursor: pointer; font-size: 0.72rem; font-family: 'Consolas', monospace; color: #aab; background: #1d1d1d; border: 1px solid #333; border-radius: 4px; padding: 2px 4px 2px 7px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iff-cond:hover { border-color: #557; background: #23232b; color: #cce; }
        .iff-cond-kw { font-weight: 700; color: #cdd; }
        .iff-cond-val { white-space: pre; }
        .iff-cond-x { background: none; border: none; color: #966; cursor: pointer; font-size: 0.9rem; line-height: 1; padding: 0 0 0 5px; }
        .iff-cond-x:hover { color: #ff8a80; }
        .iff-cond-add { font-size: 0.72rem; font-family: inherit; color: #8ab; background: none; border: 1px dashed #456; border-radius: 4px; padding: 2px 9px; cursor: pointer; }
        .iff-cond-add:hover { color: #fff; border-color: #68a; }
        .iff-cond-edit { font-size: 0.72rem; font-family: 'Consolas', monospace; background: #15151a; border: 1px solid #68a; color: #dde; border-radius: 4px; padding: 2px 7px; min-width: 220px; }

        .iff-style { margin-top: 10px; padding-top: 10px; border-top: 1px solid #333; display: flex; flex-direction: column; gap: 8px; max-width: 440px; }
        .iff-srow { display: flex; align-items: center; gap: 10px; }
        .iff-slabel { width: 96px; font-size: 0.8rem; color: #aaa; flex-shrink: 0; }
        .iff-srow input[type=range] { flex: 1; }
        .iff-srow input[type=color] { width: 38px; height: 26px; border: none; background: none; padding: 0; cursor: pointer; }
        .iff-alpha { width: 32px; text-align: right; font-size: 0.78rem; color: #999; }
        .iff-pick-btn { flex: 1; text-align: left; background: #2e2e2e; color: #ccd; border: 1px solid #3c3c3c; padding: 5px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iff-pick-btn:hover { background: #383838; }
        .iff-beam-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .iff-clear-x { background: none; border: none; color: #966; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 4px; }
        .iff-clear-x:hover { color: #ff8a80; }
      `}</style>
    </div>
  );
};

export default ImportForeignFilterView;
