import { getIconStyle } from "../../components/MinimapIconPicker";
import type { FilterBlock, FilterStatement } from "../../utils/filterParser";
import type { Language } from "../../utils/localization";

// Minimal drop shape (the bone owns the real Drop type + generation logic).
interface SimDrop {
  item: { name: string; name_ch?: string; [k: string]: any };
  match: { block: FilterBlock; hidden?: boolean; [k: string]: any } | null;
  elementIndex: number | null;
  x: number;
  y: number;
}

// Tiny block-reading helpers (mirror the bone's module helpers; kept local so
// the simulator panel is self-contained).
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

// CSS plate style for a dropped item from its matched block (or default).
const dropPlateStyle = (b: FilterBlock | null) => {
  if (!b) return { color: '#fff', borderColor: 'rgba(255,255,255,0.45)', background: 'rgba(0,0,0,0.55)', fontSize: '15px' };
  const fs = valsOf(b, 'SetFontSize');
  const fontSize = Math.max(11, Math.min(34, (fs.length ? parseInt(fs[0], 10) || 32 : 32) * 0.5));
  return {
    color: toCssRgba(valsOf(b, 'SetTextColor'), 'rgba(220,220,220,1)'),
    borderColor: toCssRgba(valsOf(b, 'SetBorderColor'), 'rgba(0,0,0,0)'),
    background: toCssRgba(valsOf(b, 'SetBackgroundColor'), 'rgba(0,0,0,0.5)'),
    fontSize: `${fontSize}px`,
  };
};

interface FilterSimulatorProps {
  areaLevel: number;
  dropCount: number;
  drops: SimDrop[];
  hiddenCount: number;
  dataLoading: boolean;
  canGenerate: boolean;
  language: Language;
  onAreaLevelChange: (n: number) => void;
  onDropCountChange: (n: number) => void;
  onGenerate: () => void;
  onClear: () => void;
  onJumpToBlock: (elementIndex: number) => void;
}

// The foreign-filter drop simulator panel: area-level / drop-count controls and
// the rendered "ground" of generated item plates. Pure presentation; the bone
// owns generateDrops and the drops state.
const FilterSimulator = ({
  areaLevel,
  dropCount,
  drops,
  hiddenCount,
  dataLoading,
  canGenerate,
  language,
  onAreaLevelChange,
  onDropCountChange,
  onGenerate,
  onClear,
  onJumpToBlock,
}: FilterSimulatorProps) => {
  const isCh = language === 'ch';
  return (
    <div className="iff-sim">
      <div className="iff-sim-controls">
        <label className="iff-sim-lbl">{isCh ? '区域等级' : 'Area Level'}
          <input type="number" min={1} max={100} value={areaLevel}
            onChange={(e) => onAreaLevelChange(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} />
        </label>
        <label className="iff-sim-lbl">{isCh ? '数量' : 'Drops'}
          <input type="number" min={1} max={60} value={dropCount}
            onChange={(e) => onDropCountChange(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} />
        </label>
        <button className="iff-btn primary" disabled={dataLoading || !canGenerate} onClick={onGenerate}>{isCh ? '生成掉落' : 'Generate'}</button>
        <button className="iff-btn" onClick={onClear}>{isCh ? '清空' : 'Clear'}</button>
        <div className="iff-spacer" />
        {dataLoading
          ? <span className="iff-sim-note">{isCh ? '物品数据加载中…' : 'loading item data…'}</span>
          : <span className="iff-sim-note">{drops.length - hiddenCount} {isCh ? '可见' : 'visible'} · {hiddenCount} {isCh ? '隐藏（灰显）' : 'hidden (greyed)'} · {isCh ? '点击物品跳到规则' : 'click an item to jump to its rule'}</span>}
      </div>
      <div className="iff-ground">
        {drops.map((d, k) => {
          const hidden = !!d.match?.hidden;
          const ic = !hidden && d.match ? valsOf(d.match.block, 'MinimapIcon') : [];
          return (
            <div key={k} className={`iff-drop ${hidden ? 'is-hidden' : ''}`} style={{ left: `${d.x}%`, top: `${d.y}%` }}
              title={hidden
                ? (isCh ? '此物品会被过滤器隐藏' : 'hidden by the filter')
                : (d.match ? `${d.match.block.action} — ${(d.match.block.inlineComment || '').trim()}` : (isCh ? '无匹配（默认样式）' : 'no match (default style)'))}
              onClick={() => { if (d.elementIndex != null) onJumpToBlock(d.elementIndex); }}>
              <div className="iff-plate" style={hidden
                ? { color: '#8a8a8a', borderColor: 'rgba(120,120,120,0.25)', background: 'rgba(0,0,0,0.3)', fontSize: '12px' }
                : dropPlateStyle(d.match?.block ?? null)}>
                {ic.length >= 2 && <span style={getIconStyle(ic[1] || 'Grey', ic[2] || 'Circle', 0.6)} />}
                {language === 'ch' ? (d.item.name_ch || d.item.name) : d.item.name}
              </div>
            </div>
          );
        })}
        {!drops.length && <div className="iff-ground-empty">{isCh ? '点击“生成掉落”，查看该过滤器如何渲染随机掉落物。' : 'Press Generate to see how this filter renders random drops.'}</div>}
      </div>
    </div>
  );
};

export default FilterSimulator;
