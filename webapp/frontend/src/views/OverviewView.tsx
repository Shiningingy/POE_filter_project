// Overview / Get-Started landing — the default view. A card grid over the app's
// top-level actions, each showing live state, adapted from FilterBlade's START page
// (not copied): our dark theme, our modes/strictness/leveling concepts, our nav.
// Control cards (Strictness, Game Mode) change state in place; navigation cards
// switch views; the Auto-Adjust card opens the Campaign picker. Applying Campaign is
// a customization (updates state), not a generation trigger — see App.handleApplyCampaign.
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { STRICTNESS_LEVELS, type StrictnessLevel, type LevelingSelection } from '../utils/filterGenerator';
import ManualContent from '../components/ManualContent';

type NavTarget = 'overview' | 'editor' | 'simulator' | 'export' | 'theme' | 'import-foreign';

interface OverviewViewProps {
  language: Language;
  gameVersion: 'poe1' | 'poe2';
  gameMode: 'normal' | 'ruthless';
  setGameMode: (m: 'normal' | 'ruthless') => void;
  strictness: StrictnessLevel;
  setStrictness: (s: StrictnessLevel) => void;
  levelingSelection: LevelingSelection;
  baseTheme: string;
  onOpenCampaign: () => void;
  onNavigate: (view: NavTarget) => void;
}

const OverviewView: React.FC<OverviewViewProps> = ({
  language, gameVersion, gameMode, setGameMode, strictness, setStrictness,
  levelingSelection, baseTheme, onOpenCampaign, onNavigate,
}) => {
  const t = useTranslation(language);
  const isPoe1 = gameVersion === 'poe1';

  // The manual panel follows the app language, but keeps its own toggle.
  const [manualDoc, setManualDoc] = useState<Language>(language);
  useEffect(() => { setManualDoc(language); }, [language]);

  const levelingLabel = (): string => {
    const p = levelingSelection?.preset;
    if (!p || p === 'all') return t.lvAll;
    if (p === 'CUSTOM') return t.lvCustom;
    return t.lvPresetNames[p] || p;
  };

  return (
    <div className="ov-root">
      <div className="ov-head">
        <h1>{t.overviewTitle}</h1>
        <p>{t.overviewSubtitle}</p>
      </div>

      <div className="ov-grid">
        {isPoe1 && (
          <button className="ov-card accent" onClick={onOpenCampaign}>
            <div className="ov-icon">🎯</div>
            <div className="ov-title">{t.cardAutoAdjust}</div>
            <div className="ov-state">{levelingLabel()}</div>
            <div className="ov-desc">{t.cardAutoAdjustDesc}</div>
          </button>
        )}

        {isPoe1 && (
          <div className="ov-card ov-ctrl">
            <div className="ov-icon">🎚</div>
            <div className="ov-title">{t.strictness}</div>
            <div className="ov-state">{t.strictnessLevels[strictness]}</div>
            <div className="ov-desc">{t.cardStrictnessDesc}</div>
            <select className="ov-select" value={strictness}
              onChange={e => setStrictness(e.target.value as StrictnessLevel)}>
              {STRICTNESS_LEVELS.map(lvl => (
                <option key={lvl} value={lvl}>{t.strictnessLevels[lvl]}</option>
              ))}
            </select>
          </div>
        )}

        {isPoe1 && (
          <div className="ov-card ov-ctrl">
            <div className="ov-icon">⚔️</div>
            <div className="ov-title">{t.gameMode}</div>
            <div className="ov-state">{gameMode === 'ruthless' ? t.ruthlessMode : t.normalMode}</div>
            <div className="ov-desc">{t.cardGameModeDesc}</div>
            <select className="ov-select" value={gameMode}
              onChange={e => setGameMode(e.target.value as 'normal' | 'ruthless')}>
              <option value="normal">{t.normalMode}</option>
              <option value="ruthless">{t.ruthlessMode}</option>
            </select>
          </div>
        )}

        <button className="ov-card" onClick={() => onNavigate('editor')}>
          <div className="ov-icon">✏️</div>
          <div className="ov-title">{t.cardCustomize}</div>
          <div className="ov-desc">{t.cardCustomizeDesc}</div>
          <div className="ov-go">{t.overviewOpen} →</div>
        </button>

        <button className="ov-card" onClick={() => onNavigate('theme')}>
          <div className="ov-icon">🎨</div>
          <div className="ov-title">{t.cardThemes}</div>
          <div className="ov-state">{baseTheme}</div>
          <div className="ov-desc">{t.cardThemesDesc}</div>
        </button>

        <button className="ov-card" onClick={() => onNavigate('export')}>
          <div className="ov-icon">⬇️</div>
          <div className="ov-title">{t.saveExport}</div>
          <div className="ov-desc">{t.cardExportDesc}</div>
          <div className="ov-go">{t.overviewOpen} →</div>
        </button>

        <button className="ov-card" onClick={() => onNavigate('import-foreign')}>
          <div className="ov-icon">📥</div>
          <div className="ov-title">{t.importForeign}</div>
          <div className="ov-desc">{t.cardImportDesc}</div>
          <div className="ov-go">{t.overviewOpen} →</div>
        </button>
      </div>

      <div className="ov-manual">
        <div className="ov-manual-head">
          <span className="ov-manual-title">📖 {t.userManual}</span>
          <div className="ov-manual-toggle">
            <button className={manualDoc === 'ch' ? 'on' : ''} onClick={() => setManualDoc('ch')}>中文</button>
            <button className={manualDoc === 'en' ? 'on' : ''} onClick={() => setManualDoc('en')}>EN</button>
          </div>
        </div>
        <div className="ov-manual-body">
          <ManualContent doc={manualDoc} onDocChange={setManualDoc} />
        </div>
      </div>

      <style>{`
        .ov-root { flex: 1; overflow-y: auto; padding: 40px 32px 60px; background: #1b1c22; color: #e8e8ea; }
        .ov-head { max-width: 1120px; margin: 0 auto 26px; }
        .ov-head h1 { font-size: 1.9rem; margin: 0 0 6px; font-weight: 600; }
        .ov-head p { color: #9a9aa2; margin: 0; font-size: 0.95rem; }
        .ov-grid { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
        .ov-card { text-align: left; background: #24252d; border: 1px solid #33343d; border-radius: 10px; padding: 20px; cursor: pointer; color: inherit; font: inherit; display: flex; flex-direction: column; gap: 6px; min-height: 158px; transition: transform .08s ease, border-color .08s ease, background .08s ease; }
        .ov-card:hover { transform: translateY(-2px); border-color: #2f9fe0; background: #282a33; }
        .ov-card.ov-ctrl { cursor: default; }
        .ov-card.ov-ctrl:hover { transform: none; border-color: #33343d; background: #24252d; }
        .ov-card.accent { background: linear-gradient(135deg, #14618a, #1b3a52); border-color: #2f9fe0; }
        .ov-card.accent:hover { background: linear-gradient(135deg, #1a72a1, #21455f); }
        .ov-icon { font-size: 1.7rem; line-height: 1; }
        .ov-title { font-size: 1.05rem; font-weight: 600; }
        .ov-state { font-size: 1.15rem; font-weight: 700; color: #7fd4ff; }
        .ov-card.accent .ov-state { color: #eaf6ff; }
        .ov-desc { font-size: 0.82rem; color: #9a9aa2; margin-top: auto; }
        .ov-card.accent .ov-desc { color: #cfe8f6; }
        .ov-go { font-size: 0.82rem; color: #7fd4ff; font-weight: 600; margin-top: auto; }
        .ov-select { margin-top: 8px; background: #1b1c22; color: #e8e8ea; border: 1px solid #44454f; border-radius: 5px; padding: 6px 8px; font-size: 0.85rem; cursor: pointer; }
        .ov-select:hover { border-color: #2f9fe0; }
        .ov-manual { max-width: 1120px; margin: 30px auto 0; }
        .ov-manual-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .ov-manual-title { font-size: 1.1rem; font-weight: 600; }
        .ov-manual-toggle { display: flex; gap: 4px; }
        .ov-manual-toggle button { padding: 3px 12px; border-radius: 14px; border: 1px solid #44454f; background: #24252d; color: #9a9aa2; cursor: pointer; font-size: 0.78rem; }
        .ov-manual-toggle button.on { background: #2f9fe0; border-color: #2f9fe0; color: #06263a; font-weight: 600; }
        .ov-manual-body { height: 62vh; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #33343d; }
      `}</style>
    </div>
  );
};

export default OverviewView;
