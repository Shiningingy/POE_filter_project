// Quick style apply: pick a ready-made style from the active theme (any
// category's Tier N bucket) and land it on the tier block / rule being edited.
// Lives entirely inside the Editor — the theme is only the style SOURCE.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation, CLASS_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import { fetchTierLabelMap } from '../utils/tierLabels';
import type { TierLabelMap } from '../utils/tierLabels';

// Style keys copied by the picker. Sounds are intentionally excluded —
// they have their own editor.
const STYLE_KEYS = ['FontSize', 'TextColor', 'BorderColor', 'BackgroundColor', 'PlayEffect', 'MinimapIcon'];

interface StylePresetPickerProps {
  themeData: any; // category -> "Tier N" -> style
  initialCategory?: string;
  language: Language;
  onSelect: (style: Record<string, any>) => void;
  onClose: () => void;
}

const cssColor = (v: any, fallback: string): string =>
  typeof v === 'string' && v.startsWith('#') ? v : fallback;

const StylePresetPicker: React.FC<StylePresetPickerProps> = ({
  themeData, initialCategory, language, onSelect, onClose,
}) => {
  const t = useTranslation(language);
  const categories = useMemo(
    () => Object.keys(themeData || {}).sort((a, b) => (a < b ? -1 : 1)),
    [themeData],
  );
  const [category, setCategory] = useState<string>(
    initialCategory && themeData?.[initialCategory] ? initialCategory : (categories[0] || ''),
  );
  const [labelMap, setLabelMap] = useState<TierLabelMap>({});

  useEffect(() => { fetchTierLabelMap().then(setLabelMap); }, []);

  const catLabel = (cat: string) => (language === 'ch' && CLASS_CH[cat]) || cat;

  const tierRows = useMemo(() => {
    const cat = themeData?.[category] || {};
    return Object.keys(cat)
      .filter(k => /^Tier (\d+)$/.test(k))
      .map(k => ({ key: k, num: parseInt(k.match(/Tier (\d+)/)![1], 10), style: cat[k] }))
      .filter(r => r.num !== 9) // hide tier's style never shows in game
      .sort((a, b) => a.num - b.num);
  }, [themeData, category]);

  const rowLabel = (num: number) => {
    const loc = labelMap[category]?.[num];
    return loc?.[language] || loc?.en || `Tier ${num}`;
  };

  const pickStyle = (style: any) => {
    const out: Record<string, any> = {};
    for (const k of STYLE_KEYS) {
      if (style && style[k] !== undefined) out[k] = style[k];
    }
    onSelect(out);
    onClose();
  };

  return (
    <div className="spp-overlay" onClick={onClose}>
      <div className="spp-modal" onClick={e => e.stopPropagation()}>
        <div className="spp-header">
          <h4>🎨 {t.applyStylePreset}</h4>
          <button className="spp-close" onClick={onClose}>×</button>
        </div>
        <label className="spp-cat-row">
          <span>{t.presetSourceCategory}</span>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </label>
        <div className="spp-list">
          {tierRows.length === 0 && <div className="spp-empty">{t.noItems}</div>}
          {tierRows.map(row => {
            const s = row.style || {};
            const fontPx = Math.max(12, Math.min(26, Math.round((s.FontSize || 32) * 0.55)));
            return (
              <button
                key={row.key}
                className="spp-chip"
                style={{
                  color: cssColor(s.TextColor, '#ffffff'),
                  borderColor: cssColor(s.BorderColor, '#888888'),
                  backgroundColor: cssColor(s.BackgroundColor, '#000000cc'),
                  fontSize: `${fontPx}px`,
                }}
                onClick={() => pickStyle(s)}
                title={`FontSize ${s.FontSize ?? '-'}${s.PlayEffect ? ` · ${s.PlayEffect}` : ''}${s.MinimapIcon ? ` · ${s.MinimapIcon}` : ''}`}
              >
                {rowLabel(row.num)}
              </button>
            );
          })}
        </div>
        <div className="spp-hint">{t.applyStyleHint}</div>
      </div>

      <style>{`
        .spp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1600; display: flex; align-items: center; justify-content: center; }
        .spp-modal { background: #222; color: #eee; border-radius: 8px; padding: 16px 18px; width: 420px; max-width: 92vw; max-height: 80vh; display: flex; flex-direction: column; gap: 10px; }
        .spp-header { display: flex; justify-content: space-between; align-items: center; }
        .spp-header h4 { margin: 0; font-size: 0.95rem; }
        .spp-close { background: none; border: none; color: #999; font-size: 1.3rem; cursor: pointer; }
        .spp-cat-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #bbb; }
        .spp-cat-row select { flex: 1; padding: 5px 8px; background: #333; color: #eee; border: 1px solid #555; border-radius: 4px; }
        .spp-list { overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 4px 2px; }
        .spp-chip { border: 1px solid; border-radius: 3px; padding: 7px 12px; cursor: pointer; text-align: center; font-weight: bold; transition: transform 0.06s; font-family: 'Fontin SmallCaps', 'Segoe UI', sans-serif; }
        .spp-chip:hover { transform: scale(1.02); outline: 2px solid #4CAF50; }
        .spp-empty { color: #888; text-align: center; padding: 16px 0; }
        .spp-hint { font-size: 0.72rem; color: #888; }
      `}</style>
    </div>
  );
};

export default StylePresetPicker;
