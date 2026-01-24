import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  useTranslation,
  CLASS_KEY_MAP,
  translations,
} from "../utils/localization";
import type { Language } from "../utils/localization";

interface ThemePresetEditorProps {
  language: Language;
  onClose: () => void;
}

const ThemePresetEditor: React.FC<ThemePresetEditorProps> = ({
  language,
  onClose,
}) => {
  const t = useTranslation(language);
  const [themes, setThemes] = useState<string[]>([]);

  // "Active Base Theme" determines the background foundation
  const [activeBaseTheme, setActiveBaseTheme] = useState<string>("sharket");

  // Data Layers
  const [baseThemeData, setBaseThemeData] = useState<any>(null);
  const [overridesData, setOverridesData] = useState<any>({});

  const [selectedCategory, setSelectedCategory] = useState<string>("Currency");
  const [loading, setLoading] = useState(false);

  // Editing UI State
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [unsavedOverrides, setUnsavedOverrides] = useState(false);
  const [sourceCategoryForSeries, setSourceCategoryForSeries] =
    useState<string>("Templates");
  const [importThemeName, setImportThemeName] = useState<string>("");
  const [showUniformControls, setShowUniformControls] = useState(false);

  // 1. Initial Load: Get Themes List, Current Settings, and Custom Overrides
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [themesRes, settingsRes, overridesRes] = await Promise.all([
          axios.get("/api/themes"),
          axios.get("/api/settings"),
          axios.get("/api/custom-overrides"),
        ]);
        setThemes(themesRes.data.themes || []);

        // Load Base Theme preference
        const base = settingsRes.data.base_theme || "sharket";
        setActiveBaseTheme(base);

        // Load Overrides
        setOverridesData(overridesRes.data || {});
      } catch (e) {
        console.error("Failed to fetch initial data", e);
      }
    };
    fetchData();
  }, []);

  // 2. Fetch Base Theme Data when selection changes
  useEffect(() => {
    if (!activeBaseTheme) return;
    const fetchBaseTheme = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/themes/${activeBaseTheme}`);
        let data = res.data.theme_data;

        // Inject Templates if missing
        if (!data["Templates"]) {
          const source = data["Currency"] || data["Stackable Currency"] || {};
          data["Templates"] = JSON.parse(JSON.stringify(source));
          for (let i = 0; i <= 9; i++) {
            const key = `Tier ${i}`;
            if (!data["Templates"][key]) {
              data["Templates"][key] = {
                FontSize: 32,
                TextColor: "#ffffff",
                BackgroundColor: "#000000aa",
              };
            }
          }
        }
        setBaseThemeData(data);
      } catch (e) {
        console.error("Failed to fetch base theme data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBaseTheme();
  }, [activeBaseTheme]);

  // 3. Compute Merged Theme (Base + Overrides) for Display
  const mergedThemeData = useMemo(() => {
    if (!baseThemeData) return null;

    // Deep merge: Base -> Overrides
    // We do it lazily or just overlay overrides.
    // Since overrides structure matches theme structure, we can just overlay.
    const merged = JSON.parse(JSON.stringify(baseThemeData));

    Object.keys(overridesData).forEach((cat) => {
      if (!merged[cat]) merged[cat] = {};
      Object.keys(overridesData[cat]).forEach((tier) => {
        merged[cat][tier] = {
          ...merged[cat][tier],
          ...overridesData[cat][tier],
        };
      });
    });

    return merged;
  }, [baseThemeData, overridesData]);

  // Helpers
  const getLocalizedCategory = (cat: string) => {
    return (t as any)[CLASS_KEY_MAP[cat] || cat] || cat;
  };

  const previewItems = useMemo(() => {
    if (!mergedThemeData || !mergedThemeData[selectedCategory]) return [];

    const categoryStyles = mergedThemeData[selectedCategory];
    const tiers = Object.keys(categoryStyles)
      .filter((k) => k.startsWith("Tier"))
      .sort((a, b) => {
        const getRank = (key: string) => {
          const match = key.match(/Tier (\d+)/);
          if (match) return parseInt(match[1]);
          if (key.includes("Hide")) return 999;
          return 100;
        };
        return getRank(a) - getRank(b);
      });

    return tiers.map((tier) => {
      // Check if overridden
      const isOverridden =
        overridesData[selectedCategory]?.[tier] !== undefined;
      return {
        name: `${selectedCategory} ${tier}`,
        tierKey: tier,
        style: categoryStyles[tier],
        isOverridden,
      };
    });
  }, [mergedThemeData, selectedCategory, overridesData]);

  const activeStyle = useMemo(() => {
    if (isBulkEditing && previewItems.length > 0) {
      return previewItems[0].style;
    } else if (
      editingTier &&
      mergedThemeData &&
      mergedThemeData[selectedCategory]
    ) {
      return mergedThemeData[selectedCategory][editingTier];
    }
    return null;
  }, [
    isBulkEditing,
    previewItems,
    editingTier,
    mergedThemeData,
    selectedCategory,
  ]);

  // Handlers

  const handleApplyBaseTheme = async () => {
    try {
      await axios.post("/api/settings", { base_theme: activeBaseTheme });
      alert(
        language === "ch"
          ? `已切换基础主题: ${activeBaseTheme}`
          : `Switched base theme to: ${activeBaseTheme}`,
      );
    } catch (e) {
      alert("Failed to apply base theme");
    }
  };

  const handleSaveOverrides = async () => {
    try {
      await axios.post("/api/custom-overrides", overridesData);
      setUnsavedOverrides(false);
      alert(
        language === "ch" ? "自定义覆盖已保存！" : "Custom overrides saved!",
      );
    } catch (e) {
      alert("Failed to save overrides");
    }
  };

  const updateOverride = (
    cat: string,
    tier: string,
    key: string,
    value: any,
  ) => {
    setOverridesData((prev: any) => {
      const newData = { ...prev };
      if (!newData[cat]) newData[cat] = {};
      if (!newData[cat][tier]) newData[cat][tier] = {};

      newData[cat][tier][key] = value;
      return newData;
    });
    setUnsavedOverrides(true);
  };

  const handleUpdateStyle = (key: string, value: any) => {
    if (isBulkEditing) {
      if (!selectedCategory || !mergedThemeData) return;
      // Apply to all visible tiers in category
      const tiers = Object.keys(mergedThemeData[selectedCategory]).filter((k) =>
        k.startsWith("Tier"),
      );
      tiers.forEach((tier) =>
        updateOverride(selectedCategory, tier, key, value),
      );
    } else {
      if (!editingTier || !selectedCategory) return;
      updateOverride(selectedCategory, editingTier, key, value);
    }
  };

  const handleResetOverride = () => {
    if (isBulkEditing) {
      if (
        !confirm(
          language === "ch"
            ? "确定要重置当前分类的所有自定义样式吗？"
            : "Reset all overrides for this category?",
        )
      )
        return;
      setOverridesData((prev: any) => {
        const newData = { ...prev };
        delete newData[selectedCategory];
        return newData;
      });
    } else {
      if (!editingTier) return;
      setOverridesData((prev: any) => {
        const newData = { ...prev };
        if (newData[selectedCategory]) {
          delete newData[selectedCategory][editingTier];
          // Cleanup empty category
          if (Object.keys(newData[selectedCategory]).length === 0)
            delete newData[selectedCategory];
        }
        return newData;
      });
    }
    setUnsavedOverrides(true);
  };

  const handleImportFromTheme = async () => {
    if (!importThemeName || !selectedCategory) return;
    if (
      !confirm(
        language === "ch"
          ? `从 ${importThemeName} 导入样式？`
          : `Import styles from ${importThemeName}?`,
      )
    )
      return;

    try {
      const res = await axios.get(`/api/themes/${importThemeName}`);
      const importedData = res.data.theme_data;
      const sourceStyles =
        importedData[selectedCategory] || importedData["Templates"];

      if (!sourceStyles) {
        alert("No styles found.");
        return;
      }

      // Apply as Overrides
      const targetTiers = Object.keys(sourceStyles).filter((k) =>
        k.startsWith("Tier"),
      );

      setOverridesData((prev: any) => {
        const newData = { ...prev };
        if (!newData[selectedCategory]) newData[selectedCategory] = {};

        targetTiers.forEach((tier) => {
          newData[selectedCategory][tier] = { ...sourceStyles[tier] };
        });
        return newData;
      });
      setUnsavedOverrides(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplySeries = () => {
    if (!mergedThemeData || !selectedCategory || !sourceCategoryForSeries)
      return;
    if (!mergedThemeData[sourceCategoryForSeries]) return;

    if (!confirm(language === "ch" ? "应用系列样式？" : "Apply Series?"))
      return;

    const sourceStyles = mergedThemeData[sourceCategoryForSeries];
    const targetTiers = Object.keys(mergedThemeData[selectedCategory]).filter(
      (k) => k.startsWith("Tier"),
    );

    setOverridesData((prev: any) => {
      const newData = { ...prev };
      if (!newData[selectedCategory]) newData[selectedCategory] = {};

      targetTiers.forEach((tier) => {
        if (sourceStyles[tier]) {
          newData[selectedCategory][tier] = { ...sourceStyles[tier] };
        }
      });
      return newData;
    });
    setUnsavedOverrides(true);
  };

  return (
    <div className="theme-editor-modal modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-left">
            <h2>
              🎨{" "}
              {language === "ch"
                ? "外观预设编辑器 (基础 + 覆盖)"
                : "Theme Editor (Base + Overrides)"}
            </h2>
            <div className="theme-selector-wrap">
              <span className="label">
                {language === "ch" ? "基础主题:" : "Base:"}
              </span>
              <select
                className="theme-select"
                value={activeBaseTheme}
                onChange={(e) => setActiveBaseTheme(e.target.value)}
              >
                {themes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
              <button
                className="apply-btn"
                onClick={handleApplyBaseTheme}
                title={language === "ch" ? "切换基础主题" : "Switch Base Theme"}
              >
                {language === "ch" ? "应用基础" : "Apply Base"}
              </button>
            </div>
            {unsavedOverrides && (
              <span className="unsaved-badge">
                ● {language === "ch" ? "自定义修改未保存" : "Unsaved Overrides"}
              </span>
            )}
          </div>
          <div className="header-actions">
            <button
              className="save-btn"
              disabled={!unsavedOverrides}
              onClick={handleSaveOverrides}
            >
              {language === "ch" ? "保存自定义修改" : "Save Overrides"}
            </button>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="editor-layout">
          {/* Sidebar */}
          <div className="category-sidebar">
            <h3>{language === "ch" ? "类别" : "Categories"}</h3>
            <div className="category-list">
              {mergedThemeData &&
                Object.keys(mergedThemeData)
                  .sort((a, b) => {
                    if (a === "Templates") return -1;
                    if (b === "Templates") return 1;
                    return a.localeCompare(b);
                  })
                  .map((cat) => (
                    <div
                      key={cat}
                      className={`category-item ${selectedCategory === cat ? "active" : ""} ${cat === "Templates" ? "template-category" : ""}`}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setEditingTier(null);
                        setIsBulkEditing(false);
                      }}
                    >
                      {cat === "Templates"
                        ? language === "ch"
                          ? "★ 全局模板"
                          : "★ Global Templates"
                        : getLocalizedCategory(cat)}
                      {overridesData[cat] && (
                        <span className="override-dot" title="Has overrides">
                          •
                        </span>
                      )}
                    </div>
                  ))}
            </div>
          </div>

          {/* Main Preview */}
          <div
            className="preview-area"
            onClick={() => {
              setEditingTier(null);
              setIsBulkEditing(false);
            }}
          >
            <div className="preview-header">
              <h3>{getLocalizedCategory(selectedCategory)}</h3>
              <div className="actions">
                <button
                  className={`bulk-edit-btn ${isBulkEditing ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBulkEditing(!isBulkEditing);
                    setEditingTier(null);
                  }}
                >
                  {language === "ch" ? "批量编辑" : "Bulk Edit"}
                </button>
                <span className="theme-badge">{activeBaseTheme}</span>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div
                className={`preview-grid ${isBulkEditing ? "bulk-mode" : ""}`}
              >
                {previewItems.map((item: any) => (
                  <div
                    key={item.tierKey}
                    className={`preview-row ${editingTier === item.tierKey ? "editing" : ""}`}
                    onClick={(e) => {
                      if (isBulkEditing) return;
                      e.stopPropagation();
                      setEditingTier(item.tierKey);
                    }}
                  >
                    <span className="tier-label">
                      {item.tierKey}
                      {item.isOverridden && (
                        <span className="override-mark">*</span>
                      )}
                    </span>
                    <div
                      className="poe-item-preview"
                      style={{
                        fontSize: `${(item.style.FontSize || 32) * 0.8}px`,
                        color: item.style.TextColor || "#fff",
                        backgroundColor:
                          item.style.BackgroundColor || "transparent",
                        borderColor: item.style.BorderColor || "transparent",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        padding: "5px 10px",
                        boxShadow: item.style.PlayEffect
                          ? `0 0 10px ${item.style.TextColor || "#fff"}`
                          : "none",
                      }}
                    >
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel */}
          {activeStyle && (
            <div
              className="style-editor-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panel-header">
                <h3>
                  {isBulkEditing
                    ? language === "ch"
                      ? "批量编辑"
                      : "Bulk Edit"
                    : language === "ch"
                      ? `编辑: ${editingTier}`
                      : `Editing: ${editingTier}`}
                </h3>
                {(isBulkEditing || editingTier) &&
                  overridesData[selectedCategory] &&
                  (isBulkEditing ||
                    overridesData[selectedCategory][editingTier!]) && (
                    <button
                      className="reset-btn"
                      onClick={handleResetOverride}
                      title="Reset to Base"
                    >
                      ↺
                    </button>
                  )}
              </div>

              {isBulkEditing && (
                <div className="bulk-actions">
                  <div className="series-copier">
                    <h4>
                      {language === "ch"
                        ? "应用样式系列 (内部)"
                        : "Apply Internal Series"}
                    </h4>
                    <div className="series-controls">
                      <select
                        value={sourceCategoryForSeries}
                        onChange={(e) =>
                          setSourceCategoryForSeries(e.target.value)
                        }
                      >
                        <option value="Templates">
                          {language === "ch"
                            ? "★ 全局模板"
                            : "★ Global Templates"}
                        </option>
                        {Object.keys(mergedThemeData || {})
                          .sort()
                          .filter((c) => c !== "Templates")
                          .map((c) => (
                            <option key={c} value={c}>
                              {getLocalizedCategory(c)}
                            </option>
                          ))}
                      </select>
                      <button onClick={handleApplySeries}>
                        {language === "ch" ? "应用" : "Apply"}
                      </button>
                    </div>
                  </div>

                  <div
                    className="series-copier"
                    style={{
                      marginTop: "10px",
                      borderColor: "#c8e6c9",
                      background: "#f1f8e9",
                    }}
                  >
                    <h4 style={{ color: "#2e7d32" }}>
                      {language === "ch"
                        ? "从其他主题导入"
                        : "Import from External Theme"}
                    </h4>
                    <div className="series-controls">
                      <select
                        value={importThemeName}
                        onChange={(e) => setImportThemeName(e.target.value)}
                      >
                        <option value="">
                          {language === "ch" ? "-- 选择 --" : "-- Select --"}
                        </option>
                        {themes
                          .filter((t) => t !== activeBaseTheme)
                          .map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={handleImportFromTheme}
                        disabled={!importThemeName}
                        style={{ background: "#43a047" }}
                      >
                        {language === "ch" ? "导入" : "Import"}
                      </button>
                    </div>
                  </div>

                  <div
                    className="toggle-uniform"
                    onClick={() => setShowUniformControls(!showUniformControls)}
                    style={{ marginTop: "15px" }}
                  >
                    {showUniformControls ? "▼" : "▶"}{" "}
                    {language === "ch"
                      ? "高级: 统一修改"
                      : "Advanced: Uniform Override"}
                  </div>
                </div>
              )}

              {activeStyle && (!isBulkEditing || showUniformControls) && (
                <>
                  <div className="control-group">
                    <label>{t.fontSize}</label>
                    <input
                      type="number"
                      value={activeStyle.FontSize || 32}
                      onChange={(e) =>
                        handleUpdateStyle("FontSize", parseInt(e.target.value))
                      }
                    />
                  </div>

                  <div className="control-group">
                    <label>{t.textColor}</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={(activeStyle.TextColor || "#ffffff").slice(0, 7)}
                        onChange={(e) =>
                          handleUpdateStyle(
                            "TextColor",
                            e.target.value +
                              (activeStyle.TextColor?.slice(7) || "ff"),
                          )
                        }
                      />
                      <input
                        type="text"
                        value={activeStyle.TextColor || "#ffffffff"}
                        onChange={(e) =>
                          handleUpdateStyle("TextColor", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="control-group">
                    <label>{t.bgColor}</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={(activeStyle.BackgroundColor || "#000000").slice(
                          0,
                          7,
                        )}
                        onChange={(e) =>
                          handleUpdateStyle(
                            "BackgroundColor",
                            e.target.value +
                              (activeStyle.BackgroundColor?.slice(7) || "ff"),
                          )
                        }
                      />
                      <input
                        type="text"
                        value={activeStyle.BackgroundColor || "#000000ff"}
                        onChange={(e) =>
                          handleUpdateStyle("BackgroundColor", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="control-group">
                    <label>{t.borderColor}</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={(activeStyle.BorderColor || "#000000").slice(
                          0,
                          7,
                        )}
                        onChange={(e) =>
                          handleUpdateStyle(
                            "BorderColor",
                            e.target.value +
                              (activeStyle.BorderColor?.slice(7) || "ff"),
                          )
                        }
                      />
                      <input
                        type="text"
                        value={activeStyle.BorderColor || "#00000000"}
                        onChange={(e) =>
                          handleUpdateStyle("BorderColor", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .theme-editor-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-content { background: #fff; width: 95%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .header-actions { display: flex; align-items: center; gap: 15px; }
        .theme-selector-wrap { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 4px; border-radius: 6px; border: 1px solid #ddd; }
        .theme-select { color:black;padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 0.95rem; font-weight: bold; background: white; }
        .apply-btn { padding: 6px 12px; border-radius: 4px; border: none; background: #2196F3; color: white; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
        .apply-btn:disabled { background: #e0e0e0; color: #999; cursor: default; }
        .icon-btn { background: #eee; border: 1px solid #ddd; border-radius: 4px; padding: 5px 10px; cursor: pointer; transition: all 0.2s; }
        .icon-btn:hover { background: #e0e0e0; border-color: #ccc; }
        
        .editor-layout { display: flex; flex: 1; overflow: hidden; }
        
        .category-sidebar { width: 220px; border-right: 1px solid #eee; display: flex; flex-direction: column; background: #f9f9f9; }
        .category-sidebar h3 { padding: 15px; margin: 0; border-bottom: 1px solid #eee; font-size: 0.9rem; color: #666; text-transform: uppercase; }
        .category-list { flex: 1; overflow-y: auto; padding: 10px; }
        .category-item { padding: 8px 12px; cursor: pointer; border-radius: 6px; margin-bottom: 2px; color: #444; font-weight: 500; font-size: 0.9rem; display: flex; justify-content: space-between; }
        .category-item:hover { background: #e3f2fd; color: #2196F3; }
        .category-item.active { background: #2196F3; color: white; }
        .template-category { color: #d32f2f; font-weight: bold; background: #fff8f8; border-left: 3px solid #d32f2f; }
        .override-dot { color: #ff9800; font-weight: bold; font-size: 1.2rem; line-height: 0.5; }
        
        .preview-area { flex: 1; padding: 30px; overflow-y: auto; background: #151515; color: #eee; display: flex; flex-direction: column; align-items: center; }
        .preview-header { width: 100%; max-width: 600px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 15px; }
        .theme-badge { background: #333; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: #aaa; border: 1px solid #444; }
        .actions { display: flex; gap: 10px; align-items: center; }
        
        .bulk-edit-btn { background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; }
        .bulk-edit-btn:hover, .bulk-edit-btn.active { opacity: 1; box-shadow: 0 0 10px rgba(33, 150, 243, 0.5); }
        .bulk-mode .preview-row { opacity: 0.5; pointer-events: none; }
        
        .preview-grid { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 600px; }
        .preview-row { display: flex; align-items: center; gap: 20px; padding: 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
        .preview-row:hover { background: #252525; }
        .preview-row.editing { background: #2a2a2a; border-color: #2196F3; box-shadow: 0 0 15px rgba(33, 150, 243, 0.2); }
        .tier-label { width: 80px; text-align: right; color: #666; font-family: monospace; font-size: 0.9rem; position: relative; }
        .override-mark { color: #ff9800; font-weight: bold; margin-left: 4px; font-size: 1.2rem; vertical-align: middle; }
        .poe-item-preview { font-family: 'Fontin', sans-serif; display: inline-block; min-width: 300px; text-align: center; cursor: pointer; }
        
        .style-editor-panel { width: 300px; background: #fff; border-left: 1px solid #ddd; padding: 20px; overflow-y: auto; box-shadow: -5px 0 15px rgba(0,0,0,0.05); }
        .panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .panel-header h3 { margin: 0; color: #333; font-size: 1.1rem; }
        .reset-btn { background: none; border: 1px solid #ff5252; color: #ff5252; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-size: 1rem; }
        .reset-btn:hover { background: #ffebee; }
        
        .bulk-warning { background: #fff3e0; color: #f57c00; padding: 10px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 15px; border: 1px solid #ffe0b2; }
        
        .bulk-actions { margin-bottom: 20px; }
        .series-copier { background: #f0f7ff; padding: 15px; border-radius: 8px; border: 1px solid #bbdefb; }
        .series-copier h4 { margin: 0 0 8px 0; color: #1565c0; font-size: 0.9rem; }
        .series-controls { display: flex; gap: 8px; margin-bottom: 8px; }
        .series-controls select { flex: 1; padding: 6px; border: 1px solid #90caf9; border-radius: 4px; }
        .apply-series-btn { background: #1976D2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }
        .apply-series-btn:hover { background: #1565C0; }
        .help-text { font-size: 0.75rem; color: #555; margin: 0; font-style: italic; }
        .separator { margin: 20px 0; border: none; border-top: 1px solid #eee; }
        .toggle-uniform { color: #666; font-size: 0.8rem; cursor: pointer; user-select: none; font-weight: bold; }
        .toggle-uniform:hover { color: #333; }

        .control-group { margin-bottom: 20px; }
        .control-group label { display: block; font-size: 0.85rem; font-weight: bold; color: #666; margin-bottom: 8px; }
        .control-group input[type="number"], .control-group input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .color-input-wrapper { display: flex; gap: 10px; align-items: center; }
        .color-input-wrapper input[type="color"] { width: 40px; height: 36px; padding: 0; border: none; background: none; cursor: pointer; }
        
        .save-btn { background: #4CAF50; color: white; border: none; padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .save-btn:disabled { background: #ccc; cursor: not-allowed; }
        .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; padding: 0 10px; }
        .unsaved-badge { color: #ff9800; font-weight: bold; font-size: 0.8rem; }
      `}</style>
    </div>
  );
};

export default ThemePresetEditor;
