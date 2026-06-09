import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { ItemProps, FilterContext } from '../utils/simulatorEngine';
import type { Language } from '../utils/localization';
import { useTranslation } from '../utils/localization';
import CategoryView from './CategoryView';

interface SimulatorRulePanelProps {
  item: ItemProps;
  context: FilterContext;
  language: Language;
  viewerBackground: string;
  file: string;                       // target base_mapping key to edit
  matchedTier?: string;               // header hint: which tier this item matched
  matchedRuleIndex?: number | null;   // for the "open in editor" jump
  onClose: () => void;
  onJumpToRule?: (file: string, ruleIndex?: number) => void;
  // Optimistically replace a file's tier-definition + base-mapping content in the
  // simulator context after save, so ground items re-evaluate immediately.
  onSaved: (mappingsKey: string, mappingContent: any, tierKey: string, tierContent: any) => void;
}

// base_mapping/<x>.json -> tier_definition/<x>.json (live keys); demo bundle keys
// lack the prefix and already match the tier_definition bundle keys (no-op there).
const tierDefKey = (file: string) => file.replace(/^base_mapping\//, 'tier_definition/');
const relOf = (file: string) => file.replace(/^base_mapping\//, '');

const SimulatorRulePanel: React.FC<SimulatorRulePanelProps> = ({
  item, context, language, viewerBackground, file, matchedTier, matchedRuleIndex,
  onClose, onJumpToRule, onSaved,
}) => {
  const t = useTranslation(language);
  const ch = language === 'ch';

  const [configContent, setConfigContent] = useState<string>('');
  const [tierItems, setTierItems] = useState<Record<string, any[]>>({});
  const [soundMap, setSoundMap] = useState<any>({ basetype_sounds: {}, class_sounds: {} });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayName = ch && item.name_ch ? item.name_ch : item.name;

  const fetchTierItems = async (keys: string[]) => {
    if (!keys.length) return;
    try {
      const res = await axios.post('/api/tier-items', { tier_keys: keys });
      setTierItems(res.data.items);
    } catch (e) { console.error('Failed to load tier items', e); }
  };

  // Build the merged config (tier_definition + base-mapping rules), exactly like
  // EditorView does, from data already loaded in the simulator context.
  useEffect(() => {
    if (!file) return;
    const tierData = context.tierDefinitions?.[tierDefKey(file)];
    if (!tierData) return;
    const merged = JSON.parse(JSON.stringify(tierData));
    const catKey = Object.keys(merged).find((k) => !k.startsWith('//'));
    if (catKey) {
      merged[catKey].rules = context.mappings?.[file]?.rules || [];
      const keys = Object.keys(merged[catKey]).filter((k) => !k.startsWith('//') && k !== '_meta' && k !== 'rules');
      fetchTierItems(keys);
    }
    setConfigContent(JSON.stringify(merged, null, 2));
    setDirty(false);
    // Only rebuild when the target file changes (not on every context tick).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    axios.get('/api/sound-map').then((r) => setSoundMap(r.data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!file || !configContent) return;
    setSaving(true);
    try {
      const data = JSON.parse(configContent);
      const catKey = Object.keys(data).find((k) => !k.startsWith('//'));
      if (!catKey) return;

      const rules = data[catKey].rules || [];
      const tierToSave = JSON.parse(JSON.stringify(data));
      delete tierToSave[catKey].rules;
      if (tierToSave[catKey]._meta?.rules) delete tierToSave[catKey]._meta.rules;

      const mappingToSave = JSON.parse(JSON.stringify(context.mappings?.[file] || {}));
      mappingToSave.rules = rules;

      const rel = relOf(file);
      await Promise.all([
        axios.post(`/api/config/tier_definition/${rel}`, tierToSave),
        axios.post(`/api/config/base_mapping/${rel}`, mappingToSave),
      ]);

      onSaved(file, mappingToSave, tierDefKey(file), tierToSave);
      setDirty(false);
    } catch (e) {
      console.error('Failed to save tier block', e);
      alert(ch ? '保存失败' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = useMemo(() => {
    if (!file) return '';
    const tierData = context.tierDefinitions?.[tierDefKey(file)];
    const catKey = tierData && Object.keys(tierData).find((k) => !k.startsWith('//'));
    const loc = catKey && tierData[catKey]?._meta?.localization;
    return (ch ? loc?.ch : loc?.en) || relOf(file).replace(/\.json$/, '');
  }, [file, context, ch]);

  return (
    <div className="sim-tierblock-overlay" onClick={onClose}>
      <div className="sim-tierblock-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stb-header">
          <div className="stb-title">
            <h3>{ch ? '规则与样式' : 'Rules & Styles'}</h3>
            <div className="stb-sub">
              {displayName} · {item.class}
              {matchedTier && <span className="stb-matched"> → {categoryLabel} · {matchedTier}</span>}
            </div>
          </div>
          <button className="stb-close" onClick={onClose}>×</button>
        </div>

        <div className="stb-body">
          {!configContent ? (
            <div className="stb-empty">{ch ? '加载中…' : 'Loading…'}</div>
          ) : (
            <CategoryView
              configContent={configContent}
              onConfigContentChange={(newContent) => { setConfigContent(newContent); setDirty(true); }}
              language={language}
              onInspectTier={() => {}}
              onRuleEdit={() => {}}
              viewerBackground={viewerBackground}
              tierItems={tierItems}
              fetchTierItems={fetchTierItems}
              defaultMappingPath={`base_mapping/${relOf(file)}`}
              onUpdateTierItems={(tierKey, items) => setTierItems((prev) => ({ ...prev, [tierKey]: items }))}
              soundMap={soundMap}
              themeData={context.theme}
            />
          )}
        </div>

        <div className="stb-footer">
          <button className="stb-jump" onClick={() => onJumpToRule?.(file, matchedRuleIndex ?? undefined)}>
            {ch ? '在完整编辑器中打开' : 'Open in full Editor'}
          </button>
          <div className="stb-spacer" />
          <button className="stb-cancel" onClick={onClose}>{ch ? '关闭' : 'Close'}</button>
          <button className="stb-save" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? (ch ? '保存中…' : 'Saving…') : (t.save || (ch ? '保存' : 'Save'))}
          </button>
        </div>
      </div>

      <style>{`
        .sim-tierblock-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2500; }
        .sim-tierblock-panel { background: #f0f2f5; color: #222; width: 92vw; max-width: 1100px; height: 88vh; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; }
        .stb-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 22px; background: #fff; border-bottom: 1px solid #e2e2e2; flex-shrink: 0; }
        .stb-title h3 { margin: 0; font-size: 1.05rem; color: #333; }
        .stb-sub { font-size: 0.82rem; color: #777; margin-top: 4px; }
        .stb-matched { color: #2196F3; font-weight: 600; }
        .stb-close { background: none; border: none; color: #999; font-size: 1.5rem; cursor: pointer; line-height: 1; }
        .stb-close:hover { color: #333; }
        .stb-body { flex: 1; overflow-y: auto; padding: 18px; }
        .stb-empty { color: #888; font-style: italic; text-align: center; padding: 40px; }
        .stb-footer { display: flex; align-items: center; gap: 12px; padding: 12px 22px; background: #fff; border-top: 1px solid #e2e2e2; flex-shrink: 0; }
        .stb-spacer { flex: 1; }
        .stb-jump { background: #eef4fb; color: #1565C0; border: 1px solid #bcd; border-radius: 6px; padding: 8px 16px; font-size: 0.82rem; cursor: pointer; font-weight: 600; }
        .stb-jump:hover { background: #e3f0fb; }
        .stb-cancel { background: #eee; color: #444; border: 1px solid #ddd; border-radius: 6px; padding: 8px 18px; cursor: pointer; }
        .stb-save { background: #4CAF50; color: #fff; border: none; border-radius: 6px; padding: 8px 24px; font-weight: bold; cursor: pointer; }
        .stb-save:disabled { background: #c5c5c5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default SimulatorRulePanel;
