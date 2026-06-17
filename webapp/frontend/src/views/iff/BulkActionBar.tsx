import type { Language } from "../../utils/localization";

interface BulkActionBarProps {
  selectedCount: number;
  language: Language;
  onShow: () => void;
  onHide: () => void;
  onColor: (keyword: string, hex: string) => void;
  onSound: () => void;
  onIcon: () => void;
  onBeam: () => void;
  onDelete: () => void;
}

// Bulk-edit bar shown in select mode: Show/Hide, text/border/bg colour, and
// sound/icon/beam pickers + delete for the selected blocks. Pure presentation;
// the bone owns the selection set and mutation logic (incl. hex→rgb).
const BulkActionBar = ({
  selectedCount,
  language,
  onShow,
  onHide,
  onColor,
  onSound,
  onIcon,
  onBeam,
  onDelete,
}: BulkActionBarProps) => {
  const isCh = language === 'ch';
  return (
    <div className="iff-bulkbar">
      <span className="iff-bulk-count">{selectedCount} {isCh ? '已选' : 'selected'}</span>
      <button className="iff-bulk-act" onClick={onShow}>{isCh ? '显示' : 'Show'}</button>
      <button className="iff-bulk-act" onClick={onHide}>{isCh ? '隐藏' : 'Hide'}</button>
      <span className="iff-bulk-sep" />
      <label className="iff-bulk-color">{isCh ? '文字' : 'Text'}<input type="color" onChange={(e) => onColor('SetTextColor', e.target.value)} /></label>
      <label className="iff-bulk-color">{isCh ? '边框' : 'Border'}<input type="color" onChange={(e) => onColor('SetBorderColor', e.target.value)} /></label>
      <label className="iff-bulk-color">{isCh ? '背景' : 'BG'}<input type="color" onChange={(e) => onColor('SetBackgroundColor', e.target.value)} /></label>
      <span className="iff-bulk-sep" />
      <button className="iff-bulk-act" disabled={!selectedCount} onClick={onSound}>{isCh ? '音效' : 'Sound'}</button>
      <button className="iff-bulk-act" disabled={!selectedCount} onClick={onIcon}>{isCh ? '图标' : 'Icon'}</button>
      <button className="iff-bulk-act" disabled={!selectedCount} onClick={onBeam}>{isCh ? '光柱' : 'Beam'}</button>
      <span className="iff-bulk-sep" />
      <button className="iff-bulk-act danger" disabled={!selectedCount} onClick={onDelete}>{isCh ? '删除' : 'Delete'}</button>
    </div>
  );
};

export default BulkActionBar;
