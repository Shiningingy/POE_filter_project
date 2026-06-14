import { useState, useMemo, useRef, useEffect } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { loadItemsDb } from '../services/clientData';
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
// Small style helpers (operate on raw filter values like "255 0 0 255")
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
  // BaseType -> item class, for grouping filters that lack section banners.
  const [classMap, setClassMap] = useState<Record<string, string>>({});

  // Condition editing: which (block element index, statement index) is open.
  // stmt === -1 means "adding a new condition to this block". The input is
  // UNCONTROLLED (defaultValue + read-on-blur) so typing doesn't re-render
  // the whole block list.
  const [edit, setEdit] = useState<{ block: number; stmt: number } | null>(null);
  const editInitRef = useRef<string>('');
  const cancelRef = useRef<boolean>(false);

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

  // Load the BaseType->class map (deployed demo build serves it statically;
  // degrades to {} under a bare local backend, where we fall back to Class
  // conditions for grouping).
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
      .catch(() => { /* grouping falls back to Class conditions */ });
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

  // Group key for the auto-grouping (undocumented) path: prefer an explicit
  // Class condition, else the class of the first BaseType, else "Other".
  const groupKeyOf = (b: FilterBlock): string => {
    const cls = valsOf(b, 'Class')[0];
    if (cls) return cls;
    const base = valsOf(b, 'BaseType')[0];
    if (base && classMap[base]) return classMap[base];
    return isCh ? '其他' : 'Other';
  };

  // Element index -> section header to render before that element.
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

  // Sidebar navigation entries.
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
      setExpanded(new Set());
      setEdit(null);
      setQuery('');
      persist(pf, file.name || 'imported.filter');
    } catch (e) {
      console.error('Foreign filter parse failed:', e);
      setError(isCh ? '无法解析该文件。' : 'Could not parse that file.');
    }
  };

  const clearAll = () => {
    setParsed(null);
    setError('');
    setExpanded(new Set());
    setEdit(null);
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
  // Block edits (immutable)
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

  const toggleAction = (elemIndex: number) => {
    mutateBlock(elemIndex, (b) => ({
      ...b,
      action: b.action === 'Hide' ? 'Show' : b.action === 'Show' ? 'Hide' : b.action,
    }));
  };

  const setStyleValues = (elemIndex: number, keyword: string, values: string[]) => {
    mutateBlock(elemIndex, (b) => {
      const statements = b.statements.slice();
      const idx = statements.findIndex((s) => s.keyword === keyword);
      const tokens = values.map((v) => ({ value: v, quoted: false }));
      if (idx >= 0) {
        statements[idx] = { ...statements[idx], values: tokens };
      } else {
        const indent = b.statements.find((s) => s.kind !== 'comment')?.indent ?? '\t';
        const newStmt: FilterStatement = {
          keyword, operator: null, values: tokens, comment: null,
          kind: 'action', indent, raw: '',
        };
        const flowIdx = statements.findIndex((s) => s.kind === 'flow');
        if (flowIdx >= 0) statements.splice(flowIdx, 0, newStmt);
        else statements.push(newStmt);
      }
      return { ...b, statements };
    });
  };

  const blockIndent = (b: FilterBlock): string =>
    b.statements.find((s) => s.kind !== 'comment')?.indent ?? '\t';

  const replaceStmt = (elemIndex: number, si: number, text: string) => {
    mutateBlock(elemIndex, (b) => {
      const statements = b.statements.slice();
      const old = statements[si];
      const ns = parseStatement(text);
      statements[si] = { ...ns, indent: old?.indent ?? blockIndent(b) };
      return { ...b, statements };
    });
  };

  const deleteStmt = (elemIndex: number, si: number) => {
    mutateBlock(elemIndex, (b) => {
      const statements = b.statements.slice();
      statements.splice(si, 1);
      return { ...b, statements };
    });
  };

  const addConditionTo = (elemIndex: number, text: string) => {
    mutateBlock(elemIndex, (b) => {
      const statements = b.statements.slice();
      const ns: FilterStatement = { ...parseStatement(text), indent: blockIndent(b) };
      // Conditions belong before style actions / Continue.
      let pos = statements.findIndex((s) => s.kind === 'action' || s.kind === 'flow');
      if (pos < 0) pos = statements.length;
      statements.splice(pos, 0, ns);
      return { ...b, statements };
    });
  };

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Condition edit lifecycle (uncontrolled input)
  // -------------------------------------------------------------------------

  const startEdit = (block: number, stmt: number, text: string) => {
    editInitRef.current = text;
    cancelRef.current = false;
    setEdit({ block, stmt });
  };
  const startAdd = (block: number) => {
    editInitRef.current = '';
    cancelRef.current = false;
    setEdit({ block, stmt: -1 });
  };
  const commitEdit = (value: string) => {
    if (cancelRef.current) { cancelRef.current = false; setEdit(null); return; }
    const e = edit;
    if (!e) return;
    const text = value.trim();
    if (e.stmt === -1) {
      if (text) addConditionTo(e.block, text);
    } else if (!text) {
      deleteStmt(e.block, e.stmt);
    } else {
      replaceStmt(e.block, e.stmt, text);
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
    const node = document.getElementById(`iff-sec-${elemIndex}`)
      || document.getElementById(`iff-blk-${elemIndex}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              <input
                key={si}
                className="iff-cond-edit"
                autoFocus
                defaultValue={editInitRef.current}
                onKeyDown={onEditKey}
                onBlur={(e) => commitEdit(e.target.value)}
              />
            );
          }
          const vals = s.values.map((v) => v.value);
          const shown = vals.slice(0, 6).join(' ');
          const more = vals.length > 6 ? ` +${vals.length - 6}` : '';
          const rest = `${s.operator ? ' ' + s.operator : ''} ${shown}${more}`;
          return (
            <span
              key={si}
              className="iff-cond"
              onClick={() => startEdit(i, si, condText(s))}
              title={isCh ? '点击编辑' : 'Click to edit'}
            >
              <span className="iff-cond-kw">{s.keyword}</span>
              <span className="iff-cond-val">{rest}</span>
              <button
                className="iff-cond-x"
                title={isCh ? '删除条件' : 'Delete condition'}
                onClick={(e) => { e.stopPropagation(); deleteStmt(i, si); }}
              >×</button>
            </span>
          );
        })}
        {addingNew ? (
          <input
            className="iff-cond-edit"
            autoFocus
            defaultValue=""
            placeholder={isCh ? '例如 ItemLevel >= 84' : 'e.g. ItemLevel >= 84'}
            onKeyDown={onEditKey}
            onBlur={(e) => commitEdit(e.target.value)}
          />
        ) : (
          <button className="iff-cond-add" onClick={() => startAdd(i)}>
            + {isCh ? '条件' : 'condition'}
          </button>
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
    // Preview a representative item so the plate shows a real in-game label.
    const sample = valsOf(b, 'BaseType')[0] || valsOf(b, 'Class')[0]
      || (b.inlineComment || '').trim() || b.action;
    const label = sample.length > 28 ? sample.slice(0, 27) + '…' : sample;
    return (
      <div className="iff-preview-wrap">
        {beam && <span className="iff-beam" style={{ background: beam.toLowerCase() }} title={`Beam: ${beam}`} />}
        <div
          className="iff-plate"
          style={{
            color: text,
            borderColor: border,
            background: bg,
            fontSize: `${Math.round(fontSize * 0.55)}px`,
          }}
        >
          {icon.length >= 2 && (
            <span className="iff-icon" style={{ background: (icon[1] || 'grey').toLowerCase() }} />
          )}
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
        <input
          type="color"
          value={hex}
          onChange={(e) => {
            const rgb = hexToRgb(e.target.value);
            setStyleValues(i, keyword, [...rgb, String(alpha)]);
          }}
        />
        <input
          type="range" min={0} max={255} value={alpha}
          onChange={(e) => {
            const rgb = vals.length >= 3 ? vals.slice(0, 3) : hexToRgb(hex);
            setStyleValues(i, keyword, [...rgb, e.target.value]);
          }}
        />
        <span className="iff-alpha">{alpha}</span>
      </div>
    );
  };

  const renderBlock = (b: FilterBlock, i: number) => {
    const open = expanded.has(i);
    const fsArr = valsOf(b, 'SetFontSize');
    const fontSize = fsArr.length ? parseInt(fsArr[0], 10) || 32 : 32;
    return (
      <div className={`iff-block ${b.action === 'Hide' ? 'is-hide' : ''}`} id={`iff-blk-${i}`} key={i}>
        <div className="iff-block-top">
          <button
            className="iff-action"
            style={{ background: ACTION_COLORS[b.action] || '#777' }}
            onClick={() => toggleAction(i)}
            title={isCh ? '点击切换 显示/隐藏' : 'Click to toggle Show/Hide'}
          >
            {b.action}
          </button>
          {b.inlineComment && <span className="iff-meta">{b.inlineComment.trim()}</span>}
          <div className="iff-spacer" />
          {renderPreview(b)}
          <button className="iff-expand" onClick={() => toggleExpand(i)}>
            {open ? '▾ ' : '▸ '}{isCh ? '样式' : 'Style'}
          </button>
        </div>
        {renderConditions(b, i)}
        {open && (
          <div className="iff-style">
            <ColorRow b={b} i={i} keyword="SetTextColor" label={t.textColor || 'Text'} />
            <ColorRow b={b} i={i} keyword="SetBorderColor" label={t.borderColor || 'Border'} />
            <ColorRow b={b} i={i} keyword="SetBackgroundColor" label={t.bgColor || 'Background'} />
            <div className="iff-srow">
              <span className="iff-slabel">{t.fontSize || 'Font Size'}</span>
              <input
                type="range" min={18} max={45} value={Math.max(18, Math.min(45, fontSize))}
                onChange={(e) => setStyleValues(i, 'SetFontSize', [e.target.value])}
              />
              <span className="iff-alpha">{fontSize}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Ordered render stream: section headers (outline or auto-group) + blocks.
  const renderBody = () => {
    if (!parsed) return null;
    const searching = query.trim().length > 0;
    const nodes: ReactElement[] = [];
    parsed.elements.forEach((el, i) => {
      const hdr = !searching ? headerAt.get(i) : undefined;
      if (hdr) {
        nodes.push(
          <div className={`iff-sec lvl${hdr.level}`} id={`iff-sec-${i}`} key={`s${i}`}>{hdr.title}</div>
        );
      }
      if (el.type === 'comment') {
        if (!searching && el.containsDisabledBlock && !hdr) {
          nodes.push(
            <div className="iff-disabled" key={`d${i}`}>
              {isCh ? '（已禁用规则，导出时原样保留）' : '(disabled rule — preserved verbatim on export)'}
            </div>
          );
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

  // -------------------------------------------------------------------------

  return (
    <div className="iff-root">
      <input
        ref={fileInputRef}
        type="file"
        accept=".filter,.ruthlessfilter,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      <div className="iff-warning">
        <span className="iff-warn-icon">⚠</span>
        <span>{warning}</span>
      </div>

      {!parsed ? (
        <div className="iff-empty">
          <h2>{isCh ? '导入外来过滤器' : 'Import a Foreign Filter'}</h2>
          <p>{isCh
            ? '选择任意 .filter 文件（NeverSink / FilterBlade / 手写均可）。我们会按其原本的结构解析，并尽量原样保留，可在此查看、编辑条件、微调显示/隐藏与颜色，然后重新导出。'
            : 'Pick any .filter file (NeverSink / FilterBlade / hand-written). We parse it in its own structure, preserve it faithfully, and let you inspect, edit conditions, tweak Show/Hide and colors, then re-export.'}</p>
          <button className="iff-import-btn" onClick={() => fileInputRef.current?.click()}>
            {isCh ? '选择 .filter 文件' : 'Choose .filter file'}
          </button>
          {error && <div className="iff-error">{error}</div>}
        </div>
      ) : (
        <>
          <div className="iff-toolbar">
            <span className="iff-fname" title={fileName}>{fileName}</span>
            <span className="iff-stat">{stats.total} {isCh ? '条规则' : 'blocks'}</span>
            <span className="iff-stat show">▸ {stats.show}</span>
            <span className="iff-stat hide">▾ {stats.hide}</span>
            <input
              className="iff-search"
              placeholder={isCh ? '筛选规则…' : 'Filter blocks…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="iff-spacer" />
            <button className="iff-btn" onClick={() => fileInputRef.current?.click()}>
              {isCh ? '重新选择' : 'Replace'}
            </button>
            <button className="iff-btn primary" onClick={reExport}>
              {isCh ? '导出 .filter' : 'Export .filter'}
            </button>
            <button className="iff-btn danger" onClick={clearAll}>
              {isCh ? '清除' : 'Clear'}
            </button>
          </div>

          <div className="iff-main">
            <div className="iff-outline">
              <div className="iff-outline-title">
                {autoGrouped ? (isCh ? '按类别分组' : 'Grouped by class') : (isCh ? '章节' : 'Sections')}
              </div>
              {autoGrouped && (
                <div className="iff-outline-empty">
                  {isCh ? '该过滤器无章节标记，已按物品类别自动分组。' : 'No section markers — auto-grouped by item class.'}
                </div>
              )}
              {navEntries.map((o, k) => (
                <button
                  key={k}
                  className={`iff-onav lvl${o.level}`}
                  onClick={() => scrollTo(o.elementIndex)}
                  title={o.title}
                >
                  {o.title}
                </button>
              ))}
            </div>
            <div className="iff-list">
              {renderBody()}
            </div>
          </div>
        </>
      )}

      <style>{`
        .iff-root { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #1e1e1e; color: #ddd; }
        .iff-warning {
          display: flex; gap: 10px; align-items: center; flex-shrink: 0;
          background: #5a3a12; color: #ffd9a0; border-bottom: 1px solid #7a5018;
          padding: 10px 18px; font-size: 0.85rem; line-height: 1.4;
        }
        .iff-warn-icon { font-size: 1.2rem; flex-shrink: 0; }

        .iff-empty { margin: auto; max-width: 540px; text-align: center; padding: 40px 20px; }
        .iff-empty h2 { margin: 0 0 12px; }
        .iff-empty p { color: #aaa; line-height: 1.6; margin-bottom: 24px; }
        .iff-import-btn, .iff-btn, .iff-action, .iff-expand, .iff-onav {
          cursor: pointer; border: none; border-radius: 6px; font-family: inherit;
        }
        .iff-import-btn { background: #2196F3; color: white; padding: 12px 28px; font-size: 1rem; }
        .iff-import-btn:hover { background: #1976D2; }
        .iff-error { color: #ff8a80; margin-top: 16px; }

        .iff-toolbar {
          display: flex; align-items: center; gap: 12px; flex-shrink: 0;
          padding: 10px 18px; background: #2a2a2a; border-bottom: 1px solid #383838;
        }
        .iff-fname { font-weight: 600; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iff-stat { font-size: 0.8rem; color: #aaa; }
        .iff-stat.show { color: #6cc070; }
        .iff-stat.hide { color: #d9756c; }
        .iff-spacer { flex: 1; }
        .iff-search { background: #1e1e1e; border: 1px solid #444; color: #ddd; padding: 6px 10px; border-radius: 6px; min-width: 200px; }
        .iff-btn { background: #444; color: #eee; padding: 7px 14px; font-size: 0.85rem; }
        .iff-btn:hover { background: #555; }
        .iff-btn.primary { background: #2196F3; color: white; }
        .iff-btn.primary:hover { background: #1976D2; }
        .iff-btn.danger { background: #7a3631; color: #ffd9d4; }
        .iff-btn.danger:hover { background: #94403a; }

        .iff-main { display: flex; flex: 1; min-height: 0; }
        .iff-outline {
          width: 240px; flex-shrink: 0; overflow-y: auto; background: #232323;
          border-right: 1px solid #383838; padding: 10px 6px;
        }
        .iff-outline-title { font-size: 0.75rem; text-transform: uppercase; color: #888; padding: 4px 8px 8px; letter-spacing: 0.05em; }
        .iff-outline-empty { font-size: 0.78rem; color: #777; padding: 4px 8px 10px; line-height: 1.4; }
        .iff-onav {
          display: block; width: 100%; text-align: left; background: none; color: #bbb;
          padding: 5px 8px; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .iff-onav:hover { background: #333; color: #fff; }
        .iff-onav.lvl1 { font-weight: 600; color: #ddd; }
        .iff-onav.lvl2 { padding-left: 20px; color: #999; }

        .iff-list { flex: 1; overflow-y: auto; padding: 14px 18px; min-width: 0; }
        .iff-sec { font-weight: 700; color: #7fd1ff; padding: 16px 0 8px; border-bottom: 1px solid #333; margin-bottom: 10px; }
        .iff-sec.lvl2 { font-size: 0.9rem; color: #9ab; padding-left: 12px; }
        .iff-disabled { color: #666; font-size: 0.78rem; font-style: italic; padding: 4px 0 4px 12px; }

        .iff-block { background: #262626; border: 1px solid #353535; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .iff-block.is-hide { opacity: 0.72; }
        .iff-block-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .iff-action { color: white; padding: 3px 10px; font-size: 0.78rem; font-weight: 700; min-width: 56px; }
        .iff-meta { font-size: 0.76rem; color: #888; font-family: 'Consolas', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
        .iff-expand { background: #333; color: #ccc; padding: 4px 10px; font-size: 0.78rem; }
        .iff-expand:hover { background: #404040; }

        .iff-preview-wrap { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .iff-beam { width: 6px; height: 26px; border-radius: 3px; display: inline-block; }
        .iff-plate {
          display: inline-flex; align-items: center; gap: 6px; border: 2px solid;
          padding: 3px 12px; border-radius: 3px; font-weight: 700; line-height: 1.2;
          max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .iff-icon { width: 12px; height: 12px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

        .iff-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
        .iff-cond {
          display: inline-flex; align-items: center; cursor: pointer;
          font-size: 0.72rem; font-family: 'Consolas', monospace; color: #aab;
          background: #1d1d1d; border: 1px solid #333; border-radius: 4px; padding: 2px 4px 2px 7px;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .iff-cond:hover { border-color: #557; background: #23232b; color: #cce; }
        .iff-cond-kw { font-weight: 700; color: #cdd; }
        .iff-cond-val { white-space: pre; }
        .iff-cond-x { background: none; border: none; color: #966; cursor: pointer; font-size: 0.9rem; line-height: 1; padding: 0 0 0 5px; }
        .iff-cond-x:hover { color: #ff8a80; }
        .iff-cond-add {
          font-size: 0.72rem; font-family: inherit; color: #8ab; background: none;
          border: 1px dashed #456; border-radius: 4px; padding: 2px 9px; cursor: pointer;
        }
        .iff-cond-add:hover { color: #fff; border-color: #68a; }
        .iff-cond-edit {
          font-size: 0.72rem; font-family: 'Consolas', monospace; background: #15151a;
          border: 1px solid #68a; color: #dde; border-radius: 4px; padding: 2px 7px; min-width: 220px;
        }

        .iff-style { margin-top: 10px; padding-top: 10px; border-top: 1px solid #333; display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
        .iff-srow { display: flex; align-items: center; gap: 10px; }
        .iff-slabel { width: 110px; font-size: 0.8rem; color: #aaa; flex-shrink: 0; }
        .iff-srow input[type=range] { flex: 1; }
        .iff-srow input[type=color] { width: 38px; height: 26px; border: none; background: none; padding: 0; cursor: pointer; }
        .iff-alpha { width: 32px; text-align: right; font-size: 0.78rem; color: #999; }
      `}</style>
    </div>
  );
};

export default ImportForeignFilterView;
