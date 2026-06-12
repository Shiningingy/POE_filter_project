import React, { useMemo, useState } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { getIconStyle } from './MinimapIconPicker';
import {
  SERIES_META, ROLE_LABELS, GENERATOR_TIERS,
  generateAllSeries, hexToRgb,
} from '../utils/themeGenerator';
import type { SeriesId, GeneratedTierStyle } from '../utils/themeGenerator';

// Hue-generator modal: pick 1-2 accent hues, preview 5 generated style series
// side by side (one card per series), mix-match per tier, apply into the
// category's custom overrides via the parent. "Gradient" is a fundamental
// option: it swaps the band-split hue assignment for a smooth A->B blend
// (curve slider) across ALL series.

interface ThemeHueGeneratorProps {
  language: Language;
  categoryLabel: string;
  tierName: (tierKey: string) => string;
  backgroundStyle: React.CSSProperties;
  onApply: (styles: Record<string, GeneratedTierStyle>) => void;
  onClose: () => void;
}

const ThemeHueGenerator: React.FC<ThemeHueGeneratorProps> = ({
  language, categoryLabel, tierName, backgroundStyle, onApply, onClose,
}) => {
  const t = useTranslation(language);
  const [hueA, setHueA] = useState('#d4af37');
  const [useHueB, setUseHueB] = useState(false);
  const [hueB, setHueB] = useState('#4d7dff');
  const [balance, setBalance] = useState(50);
  const [gradient, setGradient] = useState(false);
  // Curve slider 0..100 -> gamma 0.25..4 (50 = even handoff around the midpoint).
  const [curve, setCurve] = useState(50);
  const [selection, setSelection] = useState<Record<number, SeriesId>>(
    () => Object.fromEntries(GENERATOR_TIERS.map(tier => [tier, 'standard'])) as Record<number, SeriesId>
  );

  const allSeries = useMemo(
    () => generateAllSeries({
      hueA: hexToRgb(hueA),
      hueB: useHueB ? hexToRgb(hueB) : null,
      balance,
      gradient,
      gamma: 2 ** ((curve - 50) / 25),
    }),
    [hueA, hueB, useHueB, balance, gradient, curve]
  );

  const selectColumn = (id: SeriesId) =>
    setSelection(Object.fromEntries(GENERATOR_TIERS.map(tier => [tier, id])) as Record<number, SeriesId>);

  const columnFullySelected = (id: SeriesId) => GENERATOR_TIERS.every(tier => selection[tier] === id);

  const handleApply = () => {
    const styles: Record<string, GeneratedTierStyle> = {};
    GENERATOR_TIERS.forEach(tier => {
      styles[`Tier ${tier}`] = allSeries[selection[tier]][`Tier ${tier}`];
    });
    styles['Tier 9'] = allSeries.standard['Tier 9'];
    onApply(styles);
  };

  // Balance matters with a second hue (band split) or in gradient mode
  // (midpoint of the blend, even single-hue). Curve only shapes gradients.
  const balanceDisabled = !useHueB && !gradient;

  const renderCell = (id: SeriesId, tier: number) => {
    const style = allSeries[id][`Tier ${tier}`];
    const selected = selection[tier] === id;
    return (
      <div
        key={tier}
        className={`hue-cell ${selected ? 'sel' : ''}`}
        onClick={() => setSelection(prev => ({ ...prev, [tier]: id }))}
      >
        {selected && <span className="sel-badge">✓</span>}
        <div className="hue-cell-preview" style={{
          fontSize: `${style.FontSize * 0.42}px`,
          color: style.TextColor,
          backgroundColor: style.BackgroundColor,
          borderColor: style.BorderColor,
          borderWidth: '1px', borderStyle: 'solid',
        }}>
          {style.MinimapIcon && (
            <div style={getIconStyle(style.MinimapIcon.split(' ')[1], style.MinimapIcon.split(' ')[2], 0.5)}></div>
          )}
          <span className="hue-cell-name">{tierName(`Tier ${tier}`)}</span>
          {style.PlayEffect && (
            <span className="beam-mini" style={{ color: style.PlayEffect.split(' ')[0].toLowerCase() }}></span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay import-overlay" onClick={onClose}>
      <div className="modal-content hue-gen-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🎛 {t.hueGenTitle} — {categoryLabel}</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div className="hue-gen-controls">
          <div className="hue-control">
            <label>{t.hueGenHueA}</label>
            <div className="hue-input-row">
              <input type="color" value={hueA} onChange={e => setHueA(e.target.value)} />
              <input type="text" value={hueA} onChange={e => setHueA(e.target.value)} />
            </div>
          </div>
          <label className="hue-check">
            <input type="checkbox" checked={useHueB} onChange={e => setUseHueB(e.target.checked)} />
            <span>{t.hueGenUseSecondHue}</span>
          </label>
          {useHueB && (
            <div className="hue-control">
              <label>{t.hueGenHueB}</label>
              <div className="hue-input-row">
                <input type="color" value={hueB} onChange={e => setHueB(e.target.value)} />
                <input type="text" value={hueB} onChange={e => setHueB(e.target.value)} />
              </div>
            </div>
          )}
          <label className="hue-check">
            <input type="checkbox" checked={gradient} onChange={e => setGradient(e.target.checked)} />
            <span>{t.hueGenGradient}</span>
          </label>
          <div className={`hue-control balance-control ${balanceDisabled ? 'disabled' : ''}`}>
            <label>{t.hueGenBalance}</label>
            <div className="balance-row">
              <span className="balance-end" style={{ background: useHueB ? hueB : '#888' }}>B</span>
              <input
                type="range" min="0" max="100" value={balance} disabled={balanceDisabled}
                onChange={e => setBalance(parseInt(e.target.value))}
              />
              <span className="balance-end" style={{ background: hueA }}>A</span>
            </div>
          </div>
          <div className={`hue-control balance-control ${gradient ? '' : 'disabled'}`}>
            <label>{t.hueGenGamma}</label>
            <div className="balance-row">
              <span className="curve-end">{t.hueGenCurveSoft}</span>
              <input
                type="range" min="0" max="100" value={curve} disabled={!gradient}
                onChange={e => setCurve(parseInt(e.target.value))}
              />
              <span className="curve-end">{t.hueGenCurveSharp}</span>
            </div>
          </div>
        </div>

        <div className="hue-gen-hint">{t.hueGenHint}</div>

        <div className="hue-gen-matrix" style={backgroundStyle}>
          <div className="hue-label-col">
            <div className="hue-label-spacer"></div>
            {GENERATOR_TIERS.map(tier => (
              <div key={tier} className="hue-row-label">
                <span className="role-name">{ROLE_LABELS[tier][language === 'ch' ? 'ch' : 'en']}</span>
                <span className="tier-num">Tier {tier}</span>
              </div>
            ))}
          </div>
          {SERIES_META.map(s => (
            <div key={s.id} className={`hue-series-card ${columnFullySelected(s.id) ? 'active' : ''}`}>
              <button
                className={`hue-col-btn ${columnFullySelected(s.id) ? 'active' : ''}`}
                onClick={() => selectColumn(s.id)}
              >
                {language === 'ch' ? s.ch : s.en}
              </button>
              {GENERATOR_TIERS.map(tier => renderCell(s.id, tier))}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>{t.cancel}</button>
          <button className="confirm-btn primary-action-btn" onClick={handleApply}>{t.hueGenApply}</button>
        </div>

        <style>{`
          .hue-gen-content { width: min(1320px, 97vw); max-height: 94vh; display: flex; flex-direction: column; }

          .hue-gen-controls {
            display: flex; align-items: flex-end; gap: 25px; flex-wrap: wrap;
            padding: 15px 25px; background: #f9f9f9; border-bottom: 1px solid #eee; flex-shrink: 0;
          }
          .hue-control { display: flex; flex-direction: column; gap: 6px; }
          .hue-control > label { font-size: 0.75rem; font-weight: bold; color: #888; text-transform: uppercase; }
          .hue-input-row { display: flex; gap: 8px; align-items: center; }
          .hue-input-row input[type="color"] { width: 42px; height: 36px; padding: 0; border: none; background: none; cursor: pointer; }
          .hue-input-row input[type="text"] { width: 90px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: white !important; color: black !important; font-family: monospace; }
          .hue-check { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #333; cursor: pointer; padding-bottom: 8px; }
          .balance-control { min-width: 220px; }
          .balance-control.disabled { opacity: 0.4; }
          .balance-row { display: flex; align-items: center; gap: 8px; }
          .balance-row input[type="range"] { flex: 1; }
          .balance-end {
            width: 22px; height: 22px; border-radius: 50%; color: white; font-size: 0.7rem; font-weight: bold;
            display: inline-flex; align-items: center; justify-content: center; text-shadow: 0 0 3px rgba(0,0,0,0.7);
            border: 1px solid rgba(0,0,0,0.2); flex-shrink: 0;
          }
          .curve-end { font-size: 0.7rem; color: #888; font-weight: bold; flex-shrink: 0; }

          .hue-gen-hint { padding: 8px 25px; font-size: 0.8rem; color: #888; background: #fff; flex-shrink: 0; }

          .hue-gen-matrix {
            flex: 1; overflow-y: auto; padding: 18px 25px; display: flex; gap: 10px;
            align-items: flex-start; background-color: #111; background-size: cover; background-position: center;
          }
          .hue-label-col { display: flex; flex-direction: column; flex-shrink: 0; width: 86px; }
          .hue-label-spacer { height: 36px; margin-bottom: 10px; }
          .hue-row-label {
            height: 56px; display: flex; flex-direction: column; justify-content: center;
            align-items: flex-end; padding-right: 6px; text-shadow: 1px 1px 2px black; text-align: right;
          }
          .hue-row-label .role-name { color: #eee; font-weight: bold; font-size: 0.76rem; line-height: 1.15; }
          .hue-row-label .tier-num { color: #999; font-family: monospace; font-size: 0.7rem; }

          .hue-series-card {
            flex: 1; min-width: 0; display: flex; flex-direction: column;
            background: rgba(0,0,0,0.40); border: 1px solid rgba(255,255,255,0.14);
            border-radius: 10px; padding: 6px; backdrop-filter: blur(2px);
            transition: border-color 0.15s;
          }
          .hue-series-card.active { border-color: #2196F3; box-shadow: 0 0 0 1px #2196F3; }
          .hue-col-btn {
            height: 36px; margin-bottom: 10px; border-radius: 6px; border: 1px solid #555;
            background: rgba(40,40,40,0.9); color: #ccc; font-weight: bold; font-size: 0.82rem; cursor: pointer;
          }
          .hue-col-btn:hover { border-color: #2196F3; color: white; }
          .hue-col-btn.active { background: #2196F3; border-color: #2196F3; color: white; }

          .hue-cell {
            position: relative; height: 56px; box-sizing: border-box;
            border: 2px solid transparent; border-radius: 8px; padding: 4px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: border-color 0.15s, background 0.15s;
          }
          .hue-cell:hover { background: rgba(255,255,255,0.08); border-color: rgba(33,150,243,0.5); }
          .hue-cell.sel { border-color: #2196F3; background: rgba(33,150,243,0.12); }
          .sel-badge {
            position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
            background: #2196F3; color: white; font-size: 0.65rem; font-weight: bold;
            display: flex; align-items: center; justify-content: center; z-index: 1;
          }
          .hue-cell-preview {
            font-family: 'Fontin', sans-serif; padding: 3px 8px; max-width: 100%;
            display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          }
          .hue-cell-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        `}</style>
      </div>
    </div>
  );
};

export default ThemeHueGenerator;
