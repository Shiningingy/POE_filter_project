// Campaign / Leveling picker — a FilterBlade-style "Auto-Adjust: Campaign" modal.
// Toggles which leveling highlights the filter shows: build-archetype presets, a
// per-weapon-class row (the lv_group "weapon" substrate), an armour DEFENSE-type
// row ("armour"), and options (vendor-rare LVL bands "vendor", "Minion Focused",
// and "Hide Unselected Gear Aggressively" = hide_unselected). Apply persists the
// selection to /api/settings; the generator reads it via `leveling_selection` and
// emits only the selected groups (unselected -> omitted, or Minimal when
// hide_unselected). Selection shape mirrors LevelingSelection in filterGenerator.ts.
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation, CLASS_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import type { LevelingSelection } from '../utils/filterGenerator';

interface CampaignPickerProps {
  language: Language;
  initialSelection?: LevelingSelection;
  onClose: () => void;
  onApply: (selection: LevelingSelection) => void;
}

// Picker rows (order matches FilterBlade's dialog). Keys are the exact lv_group
// keys the importer tags, so a toggle maps 1:1 to the leveling tiers.
const WEAPON_CLASSES = [
  'Warstaves', 'Two Hand Maces', 'Two Hand Axes', 'One Hand Maces', 'One Hand Axes',
  'Two Hand Swords', 'One Hand Swords', 'Thrusting One Hand Swords', 'Bows', 'Quivers',
  'Claws', 'Daggers', 'Rune Daggers', 'Wands', 'Sceptres', 'Staves', 'Shields',
];
const ARMOUR_DEFENSE = ['Armour', 'AR/EV', 'Evasion', 'EV/ES', 'Energy Shield', 'AR/ES'];
const VENDOR_BANDS = ['1-16', '16-24', '24-42', '42-68'];

const PRESET_FORMAT = 'sharket-leveling-preset';

// Build-archetype presets. Each selects a set of weapon classes + armour defense
// types (+ minion focus). Vendor bands stay fully on (universally useful); the
// user tunes any of it afterward (which flips the active preset to CUSTOM).
type Preset = { weapons: string[]; armour_defense: string[]; minion_focused: boolean };
const PRESETS: Record<string, Preset> = {
  claw_dagger: { weapons: ['Claws', 'Daggers', 'Rune Daggers'], armour_defense: ['Evasion', 'EV/ES', 'Energy Shield'], minion_focused: false },
  bow_ranger: { weapons: ['Bows', 'Quivers'], armour_defense: ['Evasion', 'AR/EV', 'EV/ES'], minion_focused: false },
  sword_shield: { weapons: ['One Hand Swords', 'Thrusting One Hand Swords', 'One Hand Axes', 'One Hand Maces', 'Shields'], armour_defense: ['Armour', 'AR/EV', 'AR/ES'], minion_focused: false },
  axe_mace: { weapons: ['Two Hand Axes', 'Two Hand Maces', 'Two Hand Swords', 'Warstaves'], armour_defense: ['Armour', 'AR/EV', 'AR/ES'], minion_focused: false },
  fire_templar: { weapons: ['Sceptres', 'Staves', 'Shields'], armour_defense: ['Armour', 'AR/ES', 'Energy Shield'], minion_focused: false },
  spells_minions: { weapons: ['Wands', 'Sceptres', 'Staves'], armour_defense: ['Energy Shield', 'EV/ES', 'AR/ES'], minion_focused: true },
};
const PRESET_ORDER = ['claw_dagger', 'bow_ranger', 'sword_shield', 'axe_mace', 'fire_templar', 'spells_minions'];

const selectAll = (): LevelingSelection => ({
  weapons: [...WEAPON_CLASSES],
  armour_defense: [...ARMOUR_DEFENSE],
  vendor_bands: [...VENDOR_BANDS],
  minion_focused: true,
  hide_unselected: false,
  preset: 'all',
});

const CampaignPicker: React.FC<CampaignPickerProps> = ({ language, initialSelection, onClose, onApply }) => {
  const t = useTranslation(language);
  const fileRef = useRef<HTMLInputElement>(null);

  const seed = useMemo<LevelingSelection>(() => {
    const s = initialSelection && Object.keys(initialSelection).length ? initialSelection : selectAll();
    return { ...selectAll(), ...s };
  }, [initialSelection]);

  const [weapons, setWeapons] = useState<Set<string>>(new Set(seed.weapons));
  const [armour, setArmour] = useState<Set<string>>(new Set(seed.armour_defense));
  const [bands, setBands] = useState<Set<string>>(new Set(seed.vendor_bands));
  const [minion, setMinion] = useState<boolean>(!!seed.minion_focused);
  const [hideUnselected, setHideUnselected] = useState<boolean>(!!seed.hide_unselected);
  const [preset, setPreset] = useState<string>(seed.preset || 'CUSTOM');

  const toggleIn = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    set(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    setPreset('CUSTOM');
  };

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (!p) return;
    setWeapons(new Set(p.weapons));
    setArmour(new Set(p.armour_defense));
    setBands(new Set(VENDOR_BANDS)); // vendor rares stay on for every build
    setMinion(p.minion_focused);
    setPreset(name);
  };

  const doSelectAll = () => {
    const a = selectAll();
    setWeapons(new Set(a.weapons)); setArmour(new Set(a.armour_defense));
    setBands(new Set(a.vendor_bands)); setMinion(true); setPreset('all');
  };

  const buildSelection = (): LevelingSelection => ({
    weapons: [...weapons], armour_defense: [...armour], vendor_bands: [...bands],
    minion_focused: minion, hide_unselected: hideUnselected, preset,
  });

  const savePreset = () => {
    const blob = new Blob([JSON.stringify({ format: PRESET_FORMAT, version: 1, selection: buildSelection() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Sharket.leveling.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importPreset = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const s: LevelingSelection = data?.selection || {};
      const merged = { ...selectAll(), ...s };
      setWeapons(new Set(merged.weapons)); setArmour(new Set(merged.armour_defense));
      setBands(new Set(merged.vendor_bands)); setMinion(!!merged.minion_focused);
      setHideUnselected(!!merged.hide_unselected); setPreset(merged.preset || 'CUSTOM');
    } catch {
      alert(t.presetImportFailed);
    }
  };

  const chip = (label: string, active: boolean, onClick: () => void, key: string, title?: string) => (
    <button key={key} className={`cp-chip ${active ? 'on' : 'off'}`} onClick={onClick} title={title}>{label}</button>
  );
  const weaponLabel = (c: string) => (language === 'ch' ? (CLASS_CH[c] || c) : c);
  const defenseLabel = (d: string) => (language === 'ch' ? (t.lvDefense[d] || d) : d);

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={e => e.stopPropagation()}>
        <div className="cp-header">
          <h3>🎯 {t.campaignTitle}</h3>
          <div className="cp-header-actions">
            <button className="cp-mini" onClick={doSelectAll}>{t.lvSelectAll}</button>
            <button className="cp-mini" onClick={savePreset}>⬇ {t.savePreset}</button>
            <button className="cp-mini" onClick={() => fileRef.current?.click()}>⬆ {t.importPreset}</button>
            <button className="cp-close" onClick={onClose}>×</button>
          </div>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) importPreset(f); e.target.value = ''; }} />
        </div>
        <div className="cp-hint">{t.campaignHint}</div>

        <div className="cp-body">
          <div className="cp-section-label">{t.lvPresets}</div>
          <div className="cp-row">
            {PRESET_ORDER.map(name => chip(t.lvPresetNames[name] || name, preset === name, () => applyPreset(name), name))}
            {chip(t.lvCustom, preset === 'CUSTOM' || preset === 'all', () => {}, 'custom')}
          </div>

          <div className="cp-section-label">{t.lvWeapons}</div>
          <div className="cp-row">
            {WEAPON_CLASSES.map(c => chip(weaponLabel(c), weapons.has(c), () => toggleIn(setWeapons, c), c, c))}
          </div>

          <div className="cp-section-label">{t.lvArmour}</div>
          <div className="cp-row">
            {ARMOUR_DEFENSE.map(d => chip(defenseLabel(d), armour.has(d), () => toggleIn(setArmour, d), d))}
          </div>

          <div className="cp-section-label">{t.lvVendorRares}</div>
          <div className="cp-row">
            {VENDOR_BANDS.map(b => chip(`LVL ${b}`, bands.has(b), () => toggleIn(setBands, b), b))}
          </div>

          <div className="cp-section-label">{t.lvOptions}</div>
          <div className="cp-row">
            {chip(t.lvMinionFocused, minion, () => { setMinion(m => !m); setPreset('CUSTOM'); }, 'minion')}
            {chip(t.lvHideUnselected, hideUnselected, () => setHideUnselected(h => !h), 'hideunsel',
              t.lvHideUnselectedHint)}
          </div>
        </div>

        <div className="cp-footer">
          <button onClick={onClose}>{t.cancel}</button>
          <button className="cp-apply" onClick={() => onApply(buildSelection())}>{t.applyChanges}</button>
        </div>
      </div>

      <style>{`
        .cp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1600; display: flex; align-items: center; justify-content: center; }
        .cp-modal { background: #1e1f26; color: #e8e8ea; border-radius: 8px; width: 860px; max-width: 94vw; max-height: 88vh; display: flex; flex-direction: column; padding: 16px 20px; }
        .cp-header { display: flex; justify-content: space-between; align-items: center; }
        .cp-header h3 { margin: 0; font-size: 1.05rem; }
        .cp-header-actions { display: flex; align-items: center; gap: 8px; }
        .cp-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #999; }
        .cp-mini { font-size: 0.72rem; border: 1px solid #444; background: #2a2c35; border-radius: 3px; padding: 3px 9px; cursor: pointer; color: #cfcfd4; }
        .cp-mini:hover { border-color: #6aa9ff; }
        .cp-hint { font-size: 0.78rem; color: #9a9aa2; margin: 4px 0 10px; }
        .cp-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .cp-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #8a8a92; margin: 12px 0 5px; }
        .cp-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .cp-chip { font-size: 0.78rem; border: 1px solid #3a3c46; border-radius: 5px; padding: 5px 11px; cursor: pointer; background: #24252d; color: #7c7c86; transition: all 0.08s; }
        .cp-chip:hover { border-color: #6aa9ff; }
        .cp-chip.on { background: #14618a; border-color: #2f9fe0; color: #eaf6ff; font-weight: 600; }
        .cp-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding-top: 14px; }
        .cp-footer button { padding: 7px 18px; border-radius: 4px; border: 1px solid #444; background: #2a2c35; color: #ddd; cursor: pointer; }
        .cp-apply { background: #2f9fe0 !important; border-color: #2f9fe0 !important; color: #06263a !important; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default CampaignPicker;
