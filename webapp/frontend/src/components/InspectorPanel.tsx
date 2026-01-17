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
  language: Language;
  viewerBackground: string;
  setViewerBackground: (bg: string) => void;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  inspectedTier,
  editingRuleIndex,
  clipboardStyle,
  onClearClipboard,
  onCopyStyle,
  onPasteStyle,
  onAddRulePreset,
  language,
  viewerBackground,
  setViewerBackground
}) => {
  const t = useTranslation(language);
  const [ruleTemplates, setRuleTemplates] = useState<any[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showFullBlock, setShowFullBlock] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/rule-templates")
      .then((res) => setRuleTemplates(res.data.categories || []))
      .catch((e) => console.error("Failed to fetch rule templates", e));
  }, []);

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
          rule: {
            conditions: [
              {
                key: tmp.condition,
                value:
                  tmp.type === "number"
                    ? ">= 0"
                    : tmp.type === "bool"
                    ? "True"
                    : "",
              },
            ],
            comment: "",
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
        (editingRuleIndex === null || showFullBlock)
      ) 
    : "";

  const hasExistingRules = (inspectedTier?.rules?.length || 0) > 0;
  const canAddRule = !hasExistingRules || editingRuleIndex !== null;

  const handleCopyCode = () => {
    if (filterText) {
      navigator.clipboard.writeText(filterText);
      alert("Code copied!");
    }
  };

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
                backgroundColor: clipboardStyle.BackgroundColor?.substring(
                  0,
                  7
                ),
                fontSize: "14px",
                borderStyle: "solid",
                borderWidth: "1px",
                padding: "8px",
                textAlign: "center",
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
            <div className="tier-id-tag">{inspectedTier.name}</div>
            <div className="dual-btns">
              <button
                className="action-btn-small"
                onClick={() => onCopyStyle(inspectedTier.style)}
              >
                📋 {t.copyStyle}
              </button>
              <button
                className="action-btn-small"
                onClick={() => onPasteStyle(inspectedTier.key, clipboardStyle)}
                disabled={!clipboardStyle}
              >
                📥 {t.pasteStyle}
              </button>
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
              <button
                key={bg.id}
                className={`bg-btn ${
                  viewerBackground === bg.id ? "active" : ""
                }`}
                onClick={() => setViewerBackground(bg.id)}
              >
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
              <button
                className={`toggle-full-btn ${!showFullBlock ? "active" : ""}`}
                onClick={() => setShowFullBlock(!showFullBlock)}
              >
                {!showFullBlock
                  ? language === "ch"
                    ? "显示完整"
                    : "Show Full"
                  : language === "ch"
                  ? "聚焦规则"
                  : "Focus Rule"}
              </button>
            )}
            <button onClick={handleCopyCode} className="copy-link">
              {t.copyText}
            </button>
          </div>
        </div>
        <pre className="code-block-modern">
          {filterText || (language === "ch" ? "# 暂无数据" : "# No data")}
        </pre>
      </div>

      {/* 4. Rule Management (ALWAYS SHOW) */}
      <div className="inspector-section rules-lib-section">
        <div className="section-header">
          <h3>{t.rules}</h3>
        </div>

        <div className="rule-inspector-content">
          {/* Suggested Presets */}
          {presets.length > 0 && (
            <div className="library-section">
              <span className="sub-label">
                {language === "ch" ? "建议预设" : "Suggestions"}
              </span>
              <div className="preset-grid">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    className="template-btn preset"
                    disabled={!canAddRule}
                    title={!canAddRule ? (language === 'ch' ? '每阶级仅限一个规则' : 'Only 1 rule per tier allowed') : ''}
                    onClick={() => onAddRulePreset(inspectedTier!.key, p.rule)}
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full Library */}
          <div className="library-section">
            <div className="library-header-row">
              <span className="sub-label">
                {language === "ch" ? "规则库" : "Library"}
              </span>
              <input
                type="text"
                className="lib-search"
                placeholder={t.search}
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
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
                        disabled={!inspectedTier || !canAddRule}
                        title={!canAddRule ? (language === 'ch' ? '每阶级仅限一个规则' : 'Only 1 rule per tier allowed') : ''}
                        onClick={() => inspectedTier && onAddRulePreset(inspectedTier.key, { 
                                            targets: [],
                                            conditions: { [tmp.condition]: tmp.type === 'number' ? ">= 0" : (tmp.type === 'bool' ? "True" : "") },
                                            comment: "" 
                                        })}
                      >
                        {tmp.label[language]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              className="custom-raw-btn"
              disabled={!inspectedTier || !canAddRule}
              title={!canAddRule ? (language === 'ch' ? '每阶级仅限一个规则' : 'Only 1 rule per tier allowed') : ''}
              onClick={() =>
                inspectedTier &&
                onAddRulePreset(inspectedTier.key, {
                  conditions: {},
                  raw: "# Add your raw code here",
                  comment: "",
                })
              }
            >
              📝 {t.addCustomRule}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .inspector-panel {
          width: 20%; background: #fff; border-left: 1px solid #ddd;
          display: flex; flex-direction: column; height: 100%; overflow-y: auto;
          box-shadow: -2px 0 10px rgba(0,0,0,0.05);
          min-width: 300px;
        }
        .inspector-section { padding: 20px; border-bottom: 1px solid #f0f0f0; }
        .inspector-section.sticky-top { position: sticky; top: 0; background: #fff; z-index: 20; border-bottom: 2px solid #eee; }
        .inspector-section h3 { margin: 0; font-size: 0.9rem; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        
        /* Button text color fix */
        button { color: #222; }
        button:disabled { color: #999; }

        .empty-state { color: #aaa; font-style: italic; font-size: 0.85rem; padding: 15px; text-align: center; border: 1px dashed #ddd; border-radius: 6px; }
        .empty-state.mini { padding: 10px; border: none; }

        .clipboard-preview { background: #fcfcfc; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
        .tier-id-tag { font-size: 0.75rem; font-weight: bold; color: #2196F3; margin-bottom: 8px; }
        .dual-btns { display: flex; gap: 6px; }
        .action-btn-small { flex: 1; padding: 6px; font-size: 0.75rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s; }
        .action-btn-small:hover:not(:disabled) { border-color: #2196F3; background: #f0f7ff; }
        .action-btn-small:disabled { opacity: 0.3; cursor: not-allowed; }

        .bg-options { display: flex; gap: 4px; }
        .bg-btn { flex: 1; padding: 6px; font-size: 0.75rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; }
        .bg-btn.active { background: #2196F3; color: white !important; border-color: #2196F3; }

        .sub-label { font-size: 1rem; color: #999; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; display: block; }
        .active-rule-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px; }
        .active-rule-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8f9fa; border: 1px solid #eee; border-radius: 4px; }
        .active-rule-item.highlight { border-color: #2196F3; background: #f0f7ff; }
        .rule-name { font-size: 0.8rem; font-weight: 600; color: #444; }
        .remove-rule-btn { background: none; border: none; color: #ff5252 !important; cursor: pointer; font-size: 1.1rem; line-height: 1; opacity: 0.5; }
        .remove-rule-btn:hover { opacity: 1; }

        .library-section { margin-top: 15px; }
        .library-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .lib-search { padding: 4px 8px; font-size: 1rem; border: 1px solid #ddd; border-radius: 4px; width: 100px; color: #222; }
        .library-scroll-area { max-height: 250px; overflow-y: auto; padding-right: 5px; border: 1px solid #f0f0f0; border-radius: 4px; padding: 8px; background: #fafafa; }
        .lib-cat { margin-bottom: 15px; }
        .lib-cat-title { 
            font-size: 1.2rem; color: #444; font-weight: bold; text-transform: uppercase; 
            display: block; margin-bottom: 6px; padding: 4px 8px; background: #eee; 
            border-radius: 4px; border-left: 3px solid #2196F3;
        }
        
        .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .template-btn { background: #fff; border: 1px solid #eee; padding: 4px 8px; font-size: 0.9rem; border-radius: 3px; cursor: pointer; text-align: left; }
        .template-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3 !important; }
        .template-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .template-btn.preset { background: #f0f7ff; border-color: #d0e8ff; }
        .preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 10px; }

        .custom-raw-btn { width: 100%; margin-top: 10px; padding: 8px; font-size: 0.75rem; border: 1px dashed #ddd; background: #fff; border-radius: 4px; cursor: pointer; }
        .custom-raw-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3 !important; background: #f0f7ff; }
        .custom-raw-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .code-block-modern { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px; font-family: 'Consolas', monospace; font-size: 0.75rem; line-height: 1.5; overflow-x: auto; border: 1px solid #333; margin: 0; min-height: 100px; }
        .toggle-full-btn { background: #eee; border: 1px solid #ddd; padding: 2px 12px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; font-weight: bold; transition: all 0.2s; }
        .toggle-full-btn.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .copy-link { font-size: 0.75rem; color: #2196F3 !important; background: none; border: none; cursor: pointer; text-decoration: underline; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default InspectorPanel;
