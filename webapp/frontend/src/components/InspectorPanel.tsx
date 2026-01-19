import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useTranslation, RULE_FACTOR_LOCALIZATION } from "../utils/localization";
import type { Language } from "../utils/localization";
import { generateFilterText, generateIconUrl } from "../utils/styleResolver";

interface InspectorPanelProps {
  inspectedTier: {
    name: string;
    key: string;
    style: any;
    visibility: boolean;
    category?: string;
    rules?: any[];
    baseTypes?: string[];
  } | null;
  editingRuleIndex: number | null;
  clipboardStyle: any;
  onClearClipboard: () => void;
  onCopyStyle: (style: any) => void;
  onPasteStyle: (tierKey: string, style: any) => void;
  onAddRulePreset: (tierKey: string, preset: any) => void;
  onRemoveRule: (tierKey: string, ruleIndex: number) => void;
  onDeselectRule?: () => void;
  language: Language;
  viewerBackground: string;
  setViewerBackground: (bg: string) => void;
}

const ITEM_CLASSES = [
    "Stackable Currency", "Maps", "Divination Cards", "Skill Gems", "Support Gems", 
    "Body Armours", "Boots", "Gloves", "Helmets", "Shields", "Quivers",
    "Amulets", "Rings", "Belts", "Jewels", "Abyss Jewels",
    "Claws", "Daggers", "Rune Daggers", "Wands", "One Hand Swords", "Thrusting One Hand Swords", 
    "One Hand Axes", "One Hand Maces", "Sceptres", "Bows", "Staves", "Warstaves", 
    "Two Hand Swords", "Two Hand Axes", "Two Hand Maces",
    "Life Flasks", "Mana Flasks", "Utility Flasks",
    "Map Fragments", "Scarabs", "Expedition Logbooks", "Contract", "Blueprint", "Relic"
];

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  inspectedTier,
  editingRuleIndex,
  clipboardStyle,
  onClearClipboard,
  onCopyStyle,
  onPasteStyle,
  onAddRulePreset,
  onDeselectRule,
  language,
  viewerBackground,
  setViewerBackground
}) => {
  const t = useTranslation(language);
  const [ruleTemplates, setRuleTemplates] = useState<any[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showFullBlock, setShowFullBlock] = useState(false);

  // Specialized Picker States
  const [gemSearch, setGemSearch] = useState("");
  const [gemSuggestions, setGemSuggestions] = useState<any[]>([]);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetSuggestions, setTargetSuggestions] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get("/api/rule-templates")
      .then((res) => setRuleTemplates(res.data.categories || []))
      .catch((e) => console.error("Failed to fetch rule templates", e));
  }, []);

  useEffect(() => {
      if (targetSearch.length < 2) {
          setTargetSuggestions([]);
          return;
      }
      const timeout = setTimeout(async () => {
          try {
              const res = await axios.get(`/api/search-items?q=${encodeURIComponent(targetSearch)}`);
              setTargetSuggestions(res.data.results.slice(0, 10));
          } catch (e) {}
      }, 300);
      return () => clearTimeout(timeout);
  }, [targetSearch]);

  useEffect(() => {
      if (gemSearch.length < 2) {
          setGemSuggestions([]);
          return;
      }
      const timeout = setTimeout(async () => {
          try {
              const res = await axios.get(`/api/search-items?q=${encodeURIComponent(gemSearch)}`);
              // Filter only gems
              const gems = res.data.results.filter((i: any) => i.item_class?.includes("Gem"));
              setGemSuggestions(gems);
          } catch (e) {}
      }, 300);
      return () => clearTimeout(timeout);
  }, [gemSearch]);

  const activeRule = (inspectedTier && editingRuleIndex !== null) ? inspectedTier.rules?.[editingRuleIndex] : null;

  const handleUpdateActiveRule = (updates: any) => {
      if (!inspectedTier || editingRuleIndex === null) return;
      onAddRulePreset(inspectedTier.key, { ...activeRule, ...updates });
  };

  const updateCondition = (key: string, value: string) => {
      if (!activeRule) return;
      const nextConditions = { ...activeRule.conditions };
      if (value === "") delete nextConditions[key];
      else nextConditions[key] = value;
      handleUpdateActiveRule({ conditions: nextConditions });
  };

  const addTarget = (name: string) => {
      if (!activeRule) return;
      if (activeRule.targets?.includes(name)) return;
      handleUpdateActiveRule({ targets: [...(activeRule.targets || []), name] });
  };

  const removeTarget = (name: string) => {
      if (!activeRule) return;
      handleUpdateActiveRule({ targets: (activeRule.targets || []).filter((t: string) => t !== name) });
  };

  const handleAddCondition = (tmp: any) => {
      if (!activeRule) return;
      let val = "";
      if (tmp.type === 'number') val = ">= 0";
      else if (tmp.type === 'bool') val = "True";
      else if (tmp.type === 'select') val = tmp.options[0];
      else if (tmp.type === 'class_picker') val = "Currency";
      
      updateCondition(tmp.condition, val);
  };

  const getPresets = () => {
    if (!inspectedTier?.category) return [];
    const cat = inspectedTier.category.toLowerCase();
    const matches = ruleTemplates.filter(
      (c) =>
        c.id === cat ||
        (c.aliases &&
          c.aliases.some(
            (alias: string) => cat.includes(alias) || alias.includes(cat)
          ))
    );
    const allPresets: any[] = [];
    matches.forEach((categoryMatch) => {
      categoryMatch.templates.forEach((tmp: any) => {
        allPresets.push({
          id: tmp.id,
          label: tmp.label[language],
          template: tmp,
          rule: {
            conditions: {
              [tmp.condition]:
                  tmp.type === "number"
                    ? ">= 0"
                    : tmp.type === "bool"
                    ? "True"
                    : (tmp.type === "select" ? tmp.options[0] : ""),
            },
            comment: tmp.label[language],
          },
        });
      });
    });
    return allPresets;
  };

  const presets = getPresets();

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return ruleTemplates;
    const q = templateSearch.toLowerCase();
    return ruleTemplates
      .map((cat) => ({
        ...cat,
        templates: cat.templates.filter(
          (t: any) =>
            t.label.en.toLowerCase().includes(q) ||
            t.label.ch.toLowerCase().includes(q) ||
            t.condition.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.templates.length > 0);
  }, [ruleTemplates, templateSearch]);

  const filterText = inspectedTier 
    ? generateFilterText(
        inspectedTier.style, 
        inspectedTier.baseTypes || ["Item Name"], 
        inspectedTier.visibility,
        (editingRuleIndex !== null && !showFullBlock) 
            ? [inspectedTier.rules?.[editingRuleIndex]].filter(Boolean)
            : inspectedTier.rules || [],
        (editingRuleIndex === null || showFullBlock),
        (editingRuleIndex === null),
        language
      ) 
    : "";

  const hasExistingRules = (inspectedTier?.rules?.length || 0) > 0;
  const canAddRule = !hasExistingRules || editingRuleIndex !== null;

  const backgrounds = [
    { id: "Item_bg_coast.jpg", name: t.coast },
    { id: "Item_bg_forest.jpg", name: t.forest },
    { id: "Item_bg_sand.jpg", name: t.sand },
  ];

  const renderConditionInput = (key: string, currentVal: string) => {
      const allTemplates = ruleTemplates.flatMap(c => c.templates);
      const tmp = allTemplates.find(t => t.condition === key);
      const label = RULE_FACTOR_LOCALIZATION[key]?.[language] || key;

      if (!tmp) return <div key={key} className="active-cond-row"><span>{label}: {currentVal}</span></div>;

      const isBool = tmp.type === 'bool';
      const isSelect = tmp.type === 'select';
      const isClass = tmp.type === 'class_picker';
      const isGem = tmp.type === 'gem_picker';

      return (
          <div key={key} className="active-cond-row">
              <div className="cond-label-row">
                  <span className="cond-name">{label}</span>
                  <button className="cond-remove" onClick={() => updateCondition(key, "")}>×</button>
              </div>
              <div className="cond-input-area">
                  {isBool ? (
                      <select value={currentVal} onChange={(e) => updateCondition(key, e.target.value)}>
                          <option value="True">{language === 'ch' ? '是' : 'Yes'}</option>
                          <option value="False">{language === 'ch' ? '否' : 'No'}</option>
                      </select>
                  ) : isSelect ? (
                      <select value={currentVal} onChange={(e) => updateCondition(key, e.target.value)}>
                          {tmp.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                  ) : isClass ? (
                      <div className="class-picker-ui">
                          <select value={ITEM_CLASSES.includes(currentVal) ? currentVal : "custom"} onChange={(e) => updateCondition(key, e.target.value)}>
                              {ITEM_CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                              <option value="custom">-- {language === 'ch' ? '手动输入' : 'Manual'} --</option>
                          </select>
                          {!ITEM_CLASSES.includes(currentVal) && (
                              <input 
                                type="text" 
                                value={currentVal === "custom" ? "" : currentVal} 
                                placeholder={language === 'ch' ? '输入类别片段' : 'Enter partial class...'}
                                onChange={(e) => updateCondition(key, e.target.value)}
                                className="mt-5"
                              />
                          )}
                      </div>
                  ) : isGem ? (
                      <div className="gem-picker-ui">
                          <div className="gem-search-box">
                              <input 
                                type="text" 
                                placeholder={language === 'ch' ? '搜索宝石名称...' : 'Search gem name...'} 
                                value={gemSearch}
                                onChange={(e) => setGemSearch(e.target.value)}
                              />
                              {gemSuggestions.length > 0 && (
                                  <div className="gem-popover">
                                      {gemSuggestions.map(g => (
                                          <div key={g.name} className="gem-sugg-item" onClick={() => { updateCondition(key, `"${g.name}"`); setGemSearch(""); setGemSuggestions([]); }}>
                                              {language === 'ch' ? g.name_ch || g.name : g.name}
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                          <div className="current-gem-val">
                              <span>{language === 'ch' ? '当前:' : 'Current:'} <b>{currentVal || (language === 'ch' ? '未指定' : 'None')}</b></span>
                          </div>
                      </div>
                  ) : (
                      <div className="number-cond-input">
                          <select 
                            value={currentVal.match(/^[>=<!]+/)?.[0] || ">="} 
                            onChange={(e) => updateCondition(key, e.target.value + currentVal.replace(/^[>=<!]+/, ""))}
                          >
                              <option value=">=">&gt;=</option>
                              <option value="<=">&lt;=</option>
                              <option value="==">==</option>
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                          </select>
                          <input 
                            type="text" 
                            value={currentVal.replace(/^[>=<!]+/, "")} 
                            onChange={(e) => updateCondition(key, (currentVal.match(/^[>=<!]+/)?.[0] || ">=") + e.target.value)}
                          />
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="inspector-panel">
      {/* 1. Clipboard & Actions */}
      <div className="inspector-section sticky-top">
        <div className="section-header">
          <h3>{t.styleClipboard}</h3>
          {clipboardStyle && (
            <button className="clear-btn" onClick={onClearClipboard}>
              {t.clearClipboard}
            </button>
          )}
        </div>

        {clipboardStyle ? (
          <div className="clipboard-preview">
            <div
              className="preview-swatch"
              style={{
                color: clipboardStyle.TextColor?.substring(0, 7),
                borderColor: clipboardStyle.BorderColor?.substring(0, 7),
                backgroundColor: clipboardStyle.BackgroundColor?.substring(
                  0,
                  7
                ),
                fontSize: "14px",
                borderStyle: "solid",
                borderWidth: "1px",
                padding: "8px",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px"
              }}
            >
              {inspectedTier?.baseTypes?.[0] && (
                  <img 
                    src={generateIconUrl(inspectedTier.baseTypes[0])} 
                    alt="" 
                    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
              )}
              {t.itemPreview}
            </div>
          </div>
        ) : (
          <div className="empty-state mini">
            {language === "ch" ? "剪贴板为空" : "Clipboard Empty"}
          </div>
        )}

        {inspectedTier && (
          <div className="tier-action-group" style={{ marginTop: "10px" }}>
            <div 
                className={`tier-id-tag ${editingRuleIndex !== null ? 'clickable' : ''}`}
                onClick={() => editingRuleIndex !== null && onDeselectRule?.()}
            >
                {inspectedTier.name} {editingRuleIndex !== null && ' > ' + t.rule}
            </div>
            <div className="dual-btns">
              <button className="action-btn-small" onClick={() => onCopyStyle(inspectedTier.style)}>📋 {t.copyStyle}</button>
              <button className="action-btn-small" onClick={() => onPasteStyle(inspectedTier.key, clipboardStyle)} disabled={!clipboardStyle}>📥 {t.pasteStyle}</button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Viewer Settings */}
      <div className="inspector-section">
        <h3>{t.viewerSettings}</h3>
        <div className="bg-switcher">
          <div className="bg-options">
            {backgrounds.map((bg) => (
              <button key={bg.id} className={`bg-btn ${viewerBackground === bg.id ? "active" : ""}`} onClick={() => setViewerBackground(bg.id)}>
                {bg.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Raw Code Preview */}
      <div className="inspector-section code-section">
        <div className="section-header">
          <h3>{t.rawFilter}</h3>
          <div className="header-actions">
            {editingRuleIndex !== null && (
              <button className={`toggle-full-btn ${showFullBlock ? "active" : ""}`} onClick={() => setShowFullBlock(!showFullBlock)}>
                {!showFullBlock ? (language === "ch" ? "显示完整" : "Show Full") : (language === "ch" ? "聚焦规则" : "Focus Rule")}
              </button>
            )}
            <button onClick={() => { navigator.clipboard.writeText(filterText); alert("Copied!"); }} className="copy-link">{t.copyText}</button>
          </div>
        </div>
        <pre className="code-block-modern">{filterText || (language === "ch" ? "# 暂无数据" : "# No data")}</pre>
      </div>

      {/* 4. Rule Management / Editor */}
      <div className="inspector-section rules-lib-section">
        <div className="section-header">
          <h3>{editingRuleIndex !== null ? (language === 'ch' ? '编辑规则' : 'Edit Rule') : t.rules}</h3>
        </div>

        <div className="rule-inspector-content">
          {editingRuleIndex !== null ? (
              <div className="editing-rule-panel">
                  <div className="rule-summary-mini">
                      <span className="label-mini">{t.comment}</span>
                      <input 
                        type="text" 
                        value={activeRule?.comment || ""} 
                        onChange={(e) => handleUpdateActiveRule({ comment: e.target.value })}
                        className="comment-input-mini"
                      />
                  </div>

                  <div className="active-targets-list">
                      <span className="sub-label-mini">{t.targets}</span>
                      <div className="target-chips">
                          {activeRule?.targets?.map((tName: string) => (
                              <div key={tName} className="target-chip">
                                  <span>{tName}</span>
                                  <button onClick={() => removeTarget(tName)}>×</button>
                              </div>
                          ))}
                          {(!activeRule?.targets || activeRule.targets.length === 0) && (
                              <div className="empty-msg-mini">No specific targets (Applies to all in Tier)</div>
                          )}
                      </div>
                      <div className="add-target-mini">
                          <input 
                            type="text" 
                            placeholder={t.addItemTarget} 
                            value={targetSearch} 
                            onChange={(e) => setTargetSearch(e.target.value)}
                          />
                          {targetSuggestions.length > 0 && (
                              <div className="target-popover">
                                  {targetSuggestions.map(s => (
                                      <div key={s.name} className="gem-sugg-item" onClick={() => { addTarget(s.name); setTargetSearch(""); setTargetSuggestions([]); }}>
                                          {language === 'ch' ? s.name_ch || s.name : s.name}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="active-conditions-list">
                      <span className="sub-label-mini">{t.conditions}</span>
                      {Object.entries(activeRule?.conditions || {}).map(([k, v]) => renderConditionInput(k, v as string))}
                      {Object.keys(activeRule?.conditions || {}).length === 0 && (
                          <div className="empty-msg-mini">No conditions added</div>
                      )}
                  </div>

                  <div className="add-cond-presets">
                      <span className="sub-label-mini">{language === "ch" ? "常用条件" : "Quick Add"}</span>
                      <div className="preset-grid mini">
                        {presets.filter(p => !activeRule?.conditions[p.template.condition]).map((p) => (
                          <button key={p.id} className="template-btn preset mini" onClick={() => handleAddCondition(p.template)}>+ {p.label}</button>
                        ))}
                      </div>
                  </div>
              </div>
          ) : (
              <div className="library-section">
                {presets.length > 0 && (
                    <div className="suggestions-box">
                        <span className="sub-label">{language === "ch" ? "建议预设" : "Suggestions"}</span>
                        <div className="preset-grid">
                            {presets.map((p) => (
                                <button key={p.id} className="template-btn preset" disabled={!canAddRule} onClick={() => onAddRulePreset(inspectedTier!.key, p.rule)}>+ {p.label}</button>
                            ))}
                        </div>
                    </div>
                )}
              </div>
          )}

          <div className="library-section full-lib">
            <div className="library-header-row">
              <span className="sub-label">{language === "ch" ? "规则库" : "Library"}</span>
              <input type="text" className="lib-search" placeholder={t.search} value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
            </div>
            <div className="library-scroll-area">
              {filteredTemplates.map((cat) => (
                <div key={cat.id} className="lib-cat">
                  <span className="lib-cat-title">{cat.name[language]}</span>
                  <div className="template-grid">
                    {cat.templates.map((tmp: any) => (
                      <button
                        key={tmp.id}
                        className="template-btn"
                        disabled={!inspectedTier || (!activeRule && !canAddRule)}
                        onClick={() => {
                            if (activeRule) handleAddCondition(tmp);
                            else onAddRulePreset(inspectedTier!.key, { 
                                targets: [],
                                conditions: { [tmp.condition]: tmp.type === 'number' ? ">= 0" : (tmp.type === 'bool' ? "True" : (tmp.type === 'select' ? tmp.options[0] : "")) },
                                comment: tmp.label[language] 
                            });
                        }}
                      >
                        {tmp.label[language]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!activeRule && (
                <button className="custom-raw-btn" disabled={!inspectedTier || !canAddRule} onClick={() => inspectedTier && onAddRulePreset(inspectedTier.key, { conditions: {}, raw: "# Add raw code here", comment: "Custom Rule" })}>
                    📝 {t.addCustomRule}
                </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .inspector-panel { width: 20%; background: #fff; border-left: 1px solid #ddd; display: flex; flex-direction: column; height: 100%; overflow-y: auto; box-shadow: -2px 0 10px rgba(0,0,0,0.05); min-width: 320px; }
        .inspector-section { padding: 20px; border-bottom: 1px solid #f0f0f0; }
        .inspector-section.sticky-top { position: sticky; top: 0; background: #fff; z-index: 20; border-bottom: 2px solid #eee; }
        .inspector-section h3 { margin: 0; font-size: 0.85rem; color: #333; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        
        .empty-state { color: #aaa; font-style: italic; font-size: 0.8rem; padding: 15px; text-align: center; }
        .clipboard-preview { background: #fcfcfc; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
        .tier-id-tag { font-size: 0.75rem; font-weight: bold; color: #2196F3; margin-bottom: 8px; }
        .tier-id-tag.clickable { cursor: pointer; text-decoration: underline; }
        .dual-btns { display: flex; gap: 6px; }
        .action-btn-small { flex: 1; padding: 6px; font-size: 0.7rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; color: #222; font-weight: bold; }
        .action-btn-small:hover:not(:disabled) { border-color: #2196F3; background: #f0f7ff; }

        .bg-options { display: flex; gap: 4px; }
        .bg-btn { flex: 1; padding: 6px; font-size: 0.75rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; color: #222; }
        .bg-btn.active { background: #2196F3; color: white !important; border-color: #2196F3; }

        .code-block-modern { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px; font-family: 'Consolas', monospace; font-size: 0.7rem; line-height: 1.4; overflow-x: auto; border: 1px solid #333; margin: 0; min-height: 80px; }
        .toggle-full-btn { background: #eee; border: 1px solid #ddd; padding: 2px 10px; border-radius: 4px; font-size: 0.65rem; cursor: pointer; color: #444; }
        .copy-link { font-size: 0.7rem; color: #2196F3; text-decoration: underline; cursor: pointer; background: none; border: none; font-weight: bold; }

        .editing-rule-panel { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 20px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05); }
        .rule-summary-mini { margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px; }
        .label-mini { font-size: 0.65rem; color: #888; font-weight: bold; text-transform: uppercase; }
        .comment-input-mini { padding: 8px; font-size: 0.85rem; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; }

        .active-conditions-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; }
        .active-cond-row { background: white; padding: 10px; border-radius: 6px; border: 1px solid #eee; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .cond-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .cond-name { font-size: 0.75rem; font-weight: bold; color: #444; }
        .cond-remove { background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.1rem; line-height: 1; }
        .cond-remove:hover { color: #f44336; }
        .cond-input-area select, .cond-input-area input { width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; }
        .number-cond-input { display: flex; gap: 4px; }
        .number-cond-input select { width: 60px; flex-shrink: 0; }

        .class-picker-ui select { margin-bottom: 5px; }
        .class-picker-ui input { border-style: dashed; }

        .gem-picker-ui { position: relative; }
        .gem-search-box { position: relative; margin-bottom: 5px; }
        .gem-popover { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .gem-sugg-item { padding: 6px 10px; cursor: pointer; font-size: 0.8rem; }
        .gem-sugg-item:hover { background: #f0f7ff; color: #2196F3; }
        .current-gem-val { font-size: 0.7rem; color: #666; }
        .mt-5 { margin-top: 5px; }

        .active-targets-list { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; }
        .target-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .target-chip { background: #e3f2fd; border: 1px solid #bbdefb; color: #1976d2; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; display: flex; align-items: center; gap: 4px; font-weight: bold; }
        .target-chip button { background: none; border: none; color: #1976d2; cursor: pointer; padding: 0; font-size: 0.9rem; line-height: 1; }
        .add-target-mini { position: relative; }
        .add-target-mini input { width: 100%; padding: 6px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .target-popover { position: absolute; bottom: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 150px; overflow-y: auto; box-shadow: 0 -4px 12px rgba(0,0,0,0.1); }
        
        .sub-label { font-size: 0.75rem; color: #999; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; display: block; }
        .sub-label-mini { font-size: 0.65rem; color: #2196F3; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; display: block; }
        
        .library-scroll-area { max-height: 350px; overflow-y: auto; background: #fafafa; border: 1px solid #f0f0f0; padding: 10px; border-radius: 6px; }
        .lib-cat-title { font-size: 0.7rem; color: #666; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 8px; padding: 4px 8px; background: #eee; border-radius: 4px; }
        .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 15px; }
        .template-btn { background: #fff; border: 1px solid #ddd; padding: 6px 8px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; text-align: left; color: #333; }
        .template-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
        .template-btn.preset { background: #f0f7ff; border-color: #d0e8ff; font-weight: bold; }
        .preset-grid.mini { margin-bottom: 0; }
        .template-btn.mini { padding: 4px 6px; font-size: 0.65rem; }

        .custom-raw-btn { width: 100%; margin-top: 15px; padding: 10px; font-size: 0.75rem; border: 1px dashed #2196F3; background: #fff; border-radius: 6px; cursor: pointer; color: #2196F3; font-weight: bold; }
        .empty-msg-mini { font-size: 0.7rem; color: #bbb; font-style: italic; text-align: center; padding: 10px; }
      `}</style>
    </div>
  );
};

export default InspectorPanel;