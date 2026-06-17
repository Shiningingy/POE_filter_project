import type { Language } from "../../utils/localization";

interface FilterToolbarProps {
  fileName: string;
  stats: { total: number; show: number; hide: number };
  query: string;
  simOpen: boolean;
  selectMode: boolean;
  language: Language;
  onQueryChange: (q: string) => void;
  onToggleSim: () => void;
  onAddRule: () => void;
  onToggleSelect: () => void;
  onReplace: () => void;
  onExport: () => void;
  onClear: () => void;
}

// Top bar of the foreign-filter editor: filename, block stats, search, and the
// simulate / add-rule / select / replace / export / clear actions. Pure
// presentation; all state + handlers live in the bone.
const FilterToolbar = ({
  fileName,
  stats,
  query,
  simOpen,
  selectMode,
  language,
  onQueryChange,
  onToggleSim,
  onAddRule,
  onToggleSelect,
  onReplace,
  onExport,
  onClear,
}: FilterToolbarProps) => {
  const isCh = language === 'ch';
  return (
    <div className="iff-toolbar">
      <span className="iff-fname" title={fileName}>{fileName}</span>
      <span className="iff-stat">{stats.total} {isCh ? '条规则' : 'blocks'}</span>
      <span className="iff-stat show">▸ {stats.show}</span>
      <span className="iff-stat hide">▾ {stats.hide}</span>
      <input className="iff-search" placeholder={isCh ? '筛选规则…' : 'Filter blocks…'} value={query} onChange={(e) => onQueryChange(e.target.value)} />
      <div className="iff-spacer" />
      <button className={`iff-btn ${simOpen ? 'primary' : ''}`} onClick={onToggleSim}>▶ {isCh ? '模拟' : 'Simulate'}</button>
      <button className="iff-btn" onClick={onAddRule}>+ {isCh ? '规则' : 'Rule'}</button>
      <button className={`iff-btn ${selectMode ? 'primary' : ''}`} onClick={onToggleSelect}>
        {selectMode ? (isCh ? '退出选择' : 'Done') : (isCh ? '选择' : 'Select')}
      </button>
      <button className="iff-btn" onClick={onReplace}>{isCh ? '重新选择' : 'Replace'}</button>
      <button className="iff-btn primary" onClick={onExport}>{isCh ? '导出 .filter' : 'Export .filter'}</button>
      <button className="iff-btn danger" onClick={onClear}>{isCh ? '清除' : 'Clear'}</button>
    </div>
  );
};

export default FilterToolbar;
