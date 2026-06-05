import React, { useState } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface GeneratorSettings {
  itemLevelMin: number;
  itemLevelMax: number;
  rarityWeights: { Normal: number; Magic: number; Rare: number; Unique: number };
  enabledCategories: Set<string>;
  dropCount: number;
}

interface TopLevelNode {
  id: string;
  label: string;
}

interface SimulatorSettingsPanelProps {
  globalAreaLevel: number;
  onAreaLevelChange: (v: number) => void;
  viewerBackground: string;
  onBackgroundChange: (v: string) => void;
  backgrounds: { id: string; label: string }[];
  settings: GeneratorSettings;
  onSettingsChange: (s: GeneratorSettings) => void;
  onGenerateDrop: (mode: 'random' | 'valuable') => void;
  isPrewarming: boolean;
  topLevelNodes: TopLevelNode[];
  language: Language;
}

const SimulatorSettingsPanel: React.FC<SimulatorSettingsPanelProps> = ({
  globalAreaLevel,
  onAreaLevelChange,
  viewerBackground,
  onBackgroundChange,
  backgrounds,
  settings,
  onSettingsChange,
  onGenerateDrop,
  isPrewarming,
  topLevelNodes,
  language,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslation(language);

  const raritySum =
    settings.rarityWeights.Normal +
    settings.rarityWeights.Magic +
    settings.rarityWeights.Rare +
    settings.rarityWeights.Unique;

  const handleNormalize = () => {
    if (raritySum === 0) return;
    const keys: (keyof typeof settings.rarityWeights)[] = ['Normal', 'Magic', 'Rare', 'Unique'];
    const scaled = keys.map(k => Math.round((settings.rarityWeights[k] / raritySum) * 100));
    // Fix rounding drift on the largest weight
    const scaledSum = scaled.reduce((a, b) => a + b, 0);
    const diff = 100 - scaledSum;
    if (diff !== 0) {
      const maxIdx = scaled.indexOf(Math.max(...scaled));
      scaled[maxIdx] += diff;
    }
    const newWeights = { Normal: scaled[0], Magic: scaled[1], Rare: scaled[2], Unique: scaled[3] };
    onSettingsChange({ ...settings, rarityWeights: newWeights });
  };

  const handleCategoryToggle = (id: string, checked: boolean) => {
    const next = new Set(settings.enabledCategories);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onSettingsChange({ ...settings, enabledCategories: next });
  };

  if (collapsed) {
    return (
      <div className="ssp-collapsed" onClick={() => setCollapsed(false)} title={t.openSettings}>
        <span className="ssp-collapsed-icon">&#9881;</span>
        <style>{collapsedStyle}</style>
      </div>
    );
  }

  // Pair up topLevelNodes for 2-per-row grid
  const categoryRows: TopLevelNode[][] = [];
  for (let i = 0; i < topLevelNodes.length; i += 2) {
    categoryRows.push(topLevelNodes.slice(i, i + 2));
  }

  return (
    <div className="ssp-panel">
      <div className="ssp-header">
        <span className="ssp-title">{t.simulatorSettings}</span>
        <button className="ssp-collapse-btn" onClick={() => setCollapsed(true)} title={t.collapse}>&#8249;</button>
      </div>

      {/* Section 1: Scene Settings */}
      <div className="ssp-section">
        <div className="ssp-section-title">{t.scene}</div>

        <div className="ssp-row">
          <label className="ssp-label">{t.areaLevel}</label>
          <div className="ssp-range-row">
            <input
              type="range"
              min={1}
              max={100}
              value={globalAreaLevel}
              onChange={e => onAreaLevelChange(parseInt(e.target.value))}
              className="ssp-range"
            />
            <span className="ssp-range-val">{globalAreaLevel}</span>
          </div>
        </div>

        <div className="ssp-row">
          <label className="ssp-label">{t.background}</label>
          <div className="ssp-bg-row">
            {backgrounds.map(bg => (
              <button
                key={bg.id}
                className={`ssp-bg-btn${viewerBackground === bg.id ? ' active' : ''}`}
                onClick={() => onBackgroundChange(bg.id)}
                title={bg.label}
              >
                {bg.label.substring(0, 1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 2: Random Generator */}
      <div className="ssp-section">
        <div className="ssp-section-title">{t.randomGenerator}</div>

        <div className="ssp-row">
          <label className="ssp-label">{t.dropCount}</label>
          <input
            type="number"
            min={1}
            max={20}
            value={settings.dropCount}
            onChange={e => onSettingsChange({ ...settings, dropCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
            className="ssp-num-input"
          />
        </div>

        <div className="ssp-btn-row">
          <button
            className="ssp-btn"
            onClick={() => onGenerateDrop('random')}
            disabled={isPrewarming}
          >
            {isPrewarming ? t.loading : t.generateDrop}
          </button>
          <button
            className="ssp-btn ssp-btn-valuable"
            onClick={() => onGenerateDrop('valuable')}
            disabled={isPrewarming}
          >
            {isPrewarming ? t.loading : t.generateValuable}
          </button>
        </div>

        <div className="ssp-row">
          <label className="ssp-label">{t.itemLevel}</label>
          <div className="ssp-dual-range">
            <div className="ssp-range-labeled">
              <span className="ssp-range-sub-label">{t.min}</span>
              <input
                type="range"
                min={1}
                max={100}
                value={settings.itemLevelMin}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  onSettingsChange({ ...settings, itemLevelMin: Math.min(v, settings.itemLevelMax) });
                }}
                className="ssp-range"
              />
              <span className="ssp-range-val">{settings.itemLevelMin}</span>
            </div>
            <div className="ssp-range-labeled">
              <span className="ssp-range-sub-label">{t.max}</span>
              <input
                type="range"
                min={1}
                max={100}
                value={settings.itemLevelMax}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  onSettingsChange({ ...settings, itemLevelMax: Math.max(v, settings.itemLevelMin) });
                }}
                className="ssp-range"
              />
              <span className="ssp-range-val">{settings.itemLevelMax}</span>
            </div>
          </div>
        </div>

        <div className="ssp-subsection-title">{t.rarityWeights}</div>
        <div className="ssp-rarity-grid">
          {(['Normal', 'Magic', 'Rare', 'Unique'] as const).map(key => (
            <div key={key} className="ssp-rarity-item">
              <label className="ssp-rarity-label">{(t as any)[key] || key}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.rarityWeights[key]}
                onChange={e => onSettingsChange({
                  ...settings,
                  rarityWeights: { ...settings.rarityWeights, [key]: Math.max(0, parseInt(e.target.value) || 0) }
                })}
                className="ssp-num-input"
              />
            </div>
          ))}
        </div>
        <div className="ssp-rarity-footer">
          <span className={`ssp-sum ${raritySum === 100 ? 'ok' : 'bad'}`}>Sum: {raritySum}</span>
          <button className="ssp-normalize-btn" onClick={handleNormalize} disabled={raritySum === 0}>{t.normalize}</button>
        </div>

        <div className="ssp-subsection-title">{t.categories}</div>
        <div className="ssp-category-grid">
          {categoryRows.map((row, rowIdx) => (
            <React.Fragment key={rowIdx}>
              {row.map(node => (
                <label key={node.id} className="ssp-category-label">
                  <input
                    type="checkbox"
                    checked={settings.enabledCategories.has(node.id)}
                    onChange={e => handleCategoryToggle(node.id, e.target.checked)}
                    className="ssp-checkbox"
                  />
                  {node.label}
                </label>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <style>{panelStyle}</style>
    </div>
  );
};

const collapsedStyle = `
  .ssp-collapsed {
    width: 32px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12px;
    background: #1a1a1a;
    border-right: 1px solid #333;
    cursor: pointer;
    height: 100%;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .ssp-collapsed:hover { background: #222; }
  .ssp-collapsed-icon { font-size: 1.1rem; color: #aaa; }
`;

const panelStyle = `
  .ssp-panel {
    width: 260px;
    min-width: 260px;
    flex-shrink: 0;
    background: #1a1a1a;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
  }

  .ssp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px 8px;
    background: #222;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }
  .ssp-title { font-weight: bold; font-size: 0.9rem; color: #ddd; letter-spacing: 0.5px; }
  .ssp-collapse-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0 4px;
    line-height: 1;
  }
  .ssp-collapse-btn:hover { color: #eee; }

  .ssp-section {
    padding: 10px 12px 12px;
    border-bottom: 1px solid #2a2a2a;
  }
  .ssp-section-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: #666;
    margin-bottom: 10px;
    font-weight: bold;
  }
  .ssp-subsection-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #555;
    margin: 12px 0 6px;
    border-top: 1px solid #2a2a2a;
    padding-top: 10px;
  }

  .ssp-row { margin-bottom: 10px; }
  .ssp-label {
    display: block;
    font-size: 0.72rem;
    color: #888;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .ssp-range-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ssp-range {
    flex: 1;
    accent-color: #2196F3;
    cursor: pointer;
  }
  .ssp-range-val {
    min-width: 28px;
    text-align: right;
    color: #ccc;
    font-size: 0.85rem;
  }

  .ssp-bg-row { display: flex; gap: 3px; flex-wrap: wrap; }
  .ssp-bg-btn {
    padding: 3px 8px;
    background: #333;
    border: 1px solid #555;
    color: #aaa;
    cursor: pointer;
    border-radius: 3px;
    font-size: 0.8rem;
  }
  .ssp-bg-btn:hover { background: #444; color: #eee; }
  .ssp-bg-btn.active { background: #2196F3; border-color: #1976D2; color: white; }

  .ssp-num-input {
    width: 64px;
    padding: 5px 6px;
    background: #111;
    border: 1px solid #444;
    color: white;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  .ssp-num-input:focus { border-color: #2196F3; outline: none; }

  .ssp-btn-row { display: flex; gap: 6px; margin-bottom: 10px; }
  .ssp-btn {
    flex: 1;
    padding: 7px 4px;
    background: #444;
    border: 1px solid #555;
    color: #eee;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  .ssp-btn:hover:not(:disabled) { background: #555; }
  .ssp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .ssp-btn-valuable {
    background: #c5860a;
    border-color: #a06a00;
    color: white;
  }
  .ssp-btn-valuable:hover:not(:disabled) { background: #d9960f; }

  .ssp-dual-range { display: flex; flex-direction: column; gap: 5px; }
  .ssp-range-labeled { display: flex; align-items: center; gap: 5px; }
  .ssp-range-sub-label { font-size: 0.7rem; color: #666; min-width: 24px; }

  .ssp-rarity-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
  }
  .ssp-rarity-item { display: flex; flex-direction: column; gap: 3px; }
  .ssp-rarity-label { font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 0.3px; }

  .ssp-rarity-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  .ssp-sum { font-size: 0.8rem; font-weight: bold; }
  .ssp-sum.ok { color: #4caf50; }
  .ssp-sum.bad { color: #f44336; }
  .ssp-normalize-btn {
    padding: 4px 10px;
    background: #333;
    border: 1px solid #555;
    color: #ccc;
    cursor: pointer;
    border-radius: 3px;
    font-size: 0.75rem;
  }
  .ssp-normalize-btn:hover:not(:disabled) { background: #444; color: #eee; }
  .ssp-normalize-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .ssp-category-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 8px;
  }
  .ssp-category-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: #ccc;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ssp-category-label:hover { color: #eee; }
  .ssp-checkbox { accent-color: #2196F3; cursor: pointer; flex-shrink: 0; }
`;

export default SimulatorSettingsPanel;
