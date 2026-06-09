import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";
import { generateFilterText } from "../utils/styleResolver";

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
  onPingCondition?: (tierKey: string, ruleIndex: number, conditionKey: string) => void;
  language: Language;
  viewerBackground: string;
  setViewerBackground: (bg: string) => void;
  soundMap?: any;
  categoryClass?: string | null;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  inspectedTier,
  editingRuleIndex,
  clipboardStyle,
  onClearClipboard,
  onCopyStyle,
  onPasteStyle,
  onAddRulePreset,
  onDeselectRule,
  onPingCondition,
  language,
  viewerBackground,
  setViewerBackground,
  categoryClass
}) => {
  const t = useTranslation(language);
  const [ruleTemplates, setRuleTemplates] = useState<any[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showFullBlock, setShowFullBlock] = useState(false);

  useEffect(() => {
    axios
      .get("/api/rule-templates")
      .then((res) => setRuleTemplates(res.data.categories || []))
      .catch((e) => console.error("Failed to fetch rule templates", e));
  }, []);

  const activeRule = (inspectedTier && editingRuleIndex !== null) ? inspectedTier.rules?.[editingRuleIndex] : null;

  const handleAddConditionToCurrent = (tmp: any) => {
      if (!activeRule || !inspectedTier) return;
      if (activeRule.conditions && activeRule.conditions[tmp.condition]) {
          // Rule exists, trigger ping (Toast handled in EditorView)
          onPingCondition?.(inspectedTier.key, editingRuleIndex!, tmp.condition);
          return;
      }
      
      let val = "";
      if (tmp.type === 'number') val = ">= 0";
      else if (tmp.type === 'bool') val = "True";
      else if (tmp.type === 'select') val = tmp.options[0];
      else if (tmp.type === 'class_picker') val = "Currency";
      else if (tmp.type === 'text') val = "";
      else if (tmp.type === 'gem_picker') val = "True";
      
      onAddRulePreset(inspectedTier.key, {
          ...activeRule,
          conditions: { ...activeRule.conditions, [tmp.condition]: val }
      });
  };

  const getPresets = () => {
    if (!inspectedTier?.category) return [];
    const cat = inspectedTier.category.toLowerCase();
    const allPresets: any[] = [];

    ruleTemplates.forEach((category) => {
      category.templates.forEach((tmp: any) => {
        // Filter out if already in active rule
        if (activeRule && activeRule.conditions && activeRule.conditions[tmp.condition]) return;

        const hasMatch = tmp.aliases && tmp.aliases.some(
            (alias: string) => alias === "all" || cat.includes(alias.toLowerCase()) || alias.toLowerCase().includes(cat)
        );

        if (hasMatch) {
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
                        : (tmp.type === "select" ? tmp.options[0] : (tmp.type === "text" ? "" : (tmp.type === "gem_picker" ? "True" : ""))),
                },
                comment: tmp.label[language],
              },
            });
        }
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

  // Split the (search-filtered) templates into class-recommended vs others.
  const { recommended, others } = useMemo(() => {
    const seen = new Set<string>();
    const rec: any[] = [];
    const oth: any[] = [];
    const isRec = (tmp: any) =>
      tmp.universal === true ||
      (categoryClass && Array.isArray(tmp.classes) && tmp.classes.includes(categoryClass)) ||
      (tmp.universal === undefined && tmp.classes === undefined);
    filteredTemplates.forEach((cat: any) =>
      cat.templates.forEach((tmp: any) => {
        if (seen.has(tmp.condition)) return;
        seen.add(tmp.condition);
        (isRec(tmp) ? rec : oth).push(tmp);
      })
    );
    return { recommended: rec, others: oth };
  }, [filteredTemplates, categoryClass]);

  const [showOthers, setShowOthers] = useState(false);

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

  const backgrounds = [
    { id: "Item_bg_coast.jpg", name: t.coast },
    { id: "Item_bg_forest.jpg", name: t.forest },
    { id: "Item_bg_sand.jpg", name: t.sand },
  ];

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
                backgroundColor: clipboardStyle.BackgroundColor?.substring(0, 7),
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

      {/* 4. Rule Library */}
      <div className="inspector-section rules-lib-section">
        <div className="section-header">
          <h3>{editingRuleIndex !== null ? (language === 'ch' ? '规则预设' : 'Rule Presets') : t.rules}</h3>
        </div>

        <div className="rule-inspector-content">
          <div className="library-section">
            {presets.length > 0 && (
                <div className="suggestions-box">
                    <span className="sub-label">{language === "ch" ? "常用建议" : "Suggestions"}</span>
                    <div className="preset-grid">
                        {presets.map((p) => (
                            <button key={p.id} className="template-btn preset" disabled={!inspectedTier} onClick={() => {
                                if (editingRuleIndex !== null) handleAddConditionToCurrent(p.template);
                                else onAddRulePreset(inspectedTier!.key, p.rule);
                            }}>+ {p.label}</button>
                        ))}
                    </div>
                </div>
            )}
          </div>

          <div className="library-section full-lib">
            <div className="library-header-row">
              <span className="sub-label">{language === "ch" ? "全量规则库" : "Library"}</span>
              <input type="text" className="lib-search" placeholder={t.search} value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
            </div>
            <div className="library-scroll-area">
              {(() => {
                const btn = (tmp: any) => (
                  <button
                    key={tmp.id || tmp.condition}
                    className="template-btn"
                    disabled={!inspectedTier}
                    onClick={() => {
                        if (editingRuleIndex !== null) handleAddConditionToCurrent(tmp);
                        else onAddRulePreset(inspectedTier!.key, {
                            targets: [],
                            conditions: { [tmp.condition]: tmp.type === 'number' ? ">= 0" : (tmp.type === 'bool' ? "True" : (tmp.type === 'select' ? tmp.options[0] : (tmp.type === 'text' ? "" : ""))) },
                            comment: tmp.label[language]
                        });
                    }}
                  >
                    {tmp.label[language]}
                  </button>
                );
                return (
                  <>
                    <div className="lib-cat">
                      <span className="lib-cat-title">
                        {language === 'ch' ? '推荐 (本类别)' : 'Recommended'}
                      </span>
                      <div className="template-grid">
                        {recommended.length > 0
                          ? recommended.map(btn)
                          : <span className="lib-empty">{language === 'ch' ? '无' : '—'}</span>}
                      </div>
                    </div>
                    {others.length > 0 && (
                      <div className="lib-cat">
                        <span
                          className="lib-cat-title lib-cat-toggle"
                          onClick={() => setShowOthers((v) => !v)}
                        >
                          {showOthers ? '▼' : '▶'} {language === 'ch' ? `其他全部 (${others.length})` : `All others (${others.length})`}
                        </span>
                        {showOthers && <div className="template-grid">{others.map(btn)}</div>}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {editingRuleIndex === null && (
                <button className="custom-raw-btn" disabled={!inspectedTier} onClick={() => inspectedTier && onAddRulePreset(inspectedTier.key, { conditions: {}, raw: "# Add raw code here", comment: "Custom Rule" })}>
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

        .sub-label { font-size: 0.75rem; color: #999; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; display: block; }
        .library-scroll-area { max-height: 450px; overflow-y: auto; background: #fafafa; border: 1px solid #f0f0f0; padding: 10px; border-radius: 6px; }
        .lib-cat-title { font-size: 0.7rem; color: #666; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 8px; padding: 4px 8px; background: #eee; border-radius: 4px; }
        .lib-cat-toggle { cursor: pointer; user-select: none; }
        .lib-cat-toggle:hover { background: #e3f2fd; color: #1976D2; }
        .lib-empty { font-size: 0.75rem; color: #999; font-style: italic; }
        .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 15px; }
        .template-btn { background: #fff; border: 1px solid #ddd; padding: 6px 8px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; text-align: left; color: #333; }
        .template-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
        .template-btn.preset { background: #f0f7ff; border-color: #d0e8ff; font-weight: bold; }

        .custom-raw-btn { width: 100%; margin-top: 15px; padding: 10px; font-size: 0.75rem; border: 1px dashed #2196F3; background: #fff; border-radius: 6px; cursor: pointer; color: #2196F3; font-weight: bold; }
        .lib-search { width: 120px; padding: 4px 8px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; }
        .library-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      `}</style>
    </div>
  );
};

export default InspectorPanel;