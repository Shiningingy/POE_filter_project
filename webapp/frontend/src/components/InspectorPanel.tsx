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

const TRANSFIGURED_GEMS = [
    "Absolution of Inspiring", "Animate Guardian of Smiting", "Bladestorm of Uncertainty", "Boneshatter of Carnage",
    "Boneshatter of Complex Trauma", "Cleave of Rage", "Consecrated Path of Endurance", "Dominating Blow of Inspiring",
    "Earthquake of Amplification", "Earthshatter of Fragility", "Earthshatter of Prominence", "Exsanguinate of Transmission",
    "Frozen Legion of Rallying", "Glacial Hammer of Shattering", "Ground Slam of Earthshaking", "Holy Flame Totem of Ire",
    "Ice Crash of Cadence", "Infernal Blow of Immolation", "Leap Slam of Groundbreaking", "Molten Strike of the Zenith",
    "Perforate of Bloodshed", "Perforate of Duality", "Rage Vortex of Berserking", "Shield Crush of the Chieftain",
    "Smite of Divine Judgement", "Summon Flame Golem of Hordes", "Summon Flame Golem of the Meteor", "Summon Stone Golem of Hordes",
    "Summon Stone Golem of Safeguarding", "Sunder of Earthbreaking", "Tectonic Slam of Cataclysm", "Volcanic Fissure of Snaking",
    "Animate Weapon of Ranged Arms", "Animate Weapon of Self Reflection", "Artillery Ballista of Cross Strafe", "Artillery Ballista of Focus Fire",
    "Barrage of Volley Fire", "Bear Trap of Skewers", "Blade Blast of Dagger Detonation", "Blade Blast of Unloading",
    "Blade Flurry of Incision", "Blade Trap of Greatswords", "Blade Trap of Laceration", "Blade Vortex of the Scythe",
    "Bladefall of Impaling", "Bladefall of Volleys", "Blink Arrow of Bombarding Clones", "Blink Arrow of Prismatic Clones",
    "Burning Arrow of Vigour", "Caustic Arrow of Poison", "Cremation of Exhuming", "Cremation of the Volcano",
    "Cyclone of Tumult", "Detonate Dead of Chain Reaction", "Detonate Dead of Scavenging", "Double Strike of Impaling",
    "Double Strike of Momentum", "Dual Strike of Ambidexterity", "Elemental Hit of the Spectrum", "Ethereal Knives of Lingering Blades",
    "Ethereal Knives of the Massacre", "Explosive Concoction of Destruction", "Explosive Trap of Magnitude", "Explosive Trap of Shrapnel",
    "Fire Trap of Blasting", "Flicker Strike of Power", "Frenzy of Onslaught", "Frost Blades of Katabasis",
    "Galvanic Arrow of Energy", "Galvanic Arrow of Surging", "Ice Shot of Penetration", "Ice Trap of Hollowness",
    "Lacerate of Butchering", "Lacerate of Haemorrhage", "Lancing Steel of Spraying", "Lightning Arrow of Electrocution",
    "Lightning Strike of Arcing", "Mirror Arrow of Bombarding Clones", "Mirror Arrow of Prismatic Clones", "Poisonous Concoction of Bouncing",
    "Puncture of Shanking", "Rain of Arrows of Artillery", "Rain of Arrows of Saturation", "Reave of Refraction",
    "Scourge Arrow of Menace", "Seismic Trap of Swells", "Shattering Steel of Ammunition", "Shrapnel Ballista of Steel",
    "Siege Ballista of Splintering", "Spectral Shield Throw of Shattering", "Spectral Throw of Materialising", "Split Arrow of Splitting",
    "Splitting Steel of Ammunition", "Storm Rain of the Conduit", "Storm Rain of the Fence", "Summon Ice Golem of Hordes",
    "Summon Ice Golem of Shattering", "Tornado of Elemental Turbulence", "Tornado Shot of Cloudburst", "Toxic Rain of Sporeburst",
    "Toxic Rain of Withering", "Viper Strike of the Mamba", "Volatile Dead of Confinement", "Volatile Dead of Seething",
    "Wild Strike of Extremes", "Arc of Oscillating", "Arc of Surging", "Armageddon Brand of Recall",
    "Armageddon Brand of Volatility", "Ball Lightning of Orbiting", "Ball Lightning of Static", "Bane of Condemnation",
    "Blight of Atrophy", "Blight of Contagion", "Bodyswap of Sacrifice", "Cold Snap of Power",
    "Contagion of Subsiding", "Contagion of Transference", "Crackling Lance of Branching", "Crackling Lance of Disintegration",
    "Discharge of Misery", "Divine Ire of Disintegration", "Divine Ire of Holy Lightning", "Essence Drain of Desperation",
    "Essence Drain of Wickedness", "Eye of Winter of Finality", "Eye of Winter of Transience", "Firestorm of Meteors",
    "Firestorm of Pelting", "Flame Dash of Return", "Flame Surge of Combusting", "Flameblast of Celerity",
    "Flameblast of Contraction", "Forbidden Rite of Soul Sacrifice", "Frost Bomb of Forthcoming", "Frost Bomb of Instability",
    "Frostblink of Wintry Blast", "Galvanic Field of Intensity", "Glacial Cascade of the Fissure", "Hexblast of Contradiction",
    "Hexblast of Havoc", "Ice Nova of Deep Freeze", "Ice Nova of Frostbolts", "Ice Spear of Splitting",
    "Icicle Mine of Fanning", "Icicle Mine of Sabotage", "Incinerate of Expanse", "Incinerate of Venting",
    "Kinetic Blast of Clustering", "Kinetic Bolt of Fragmentation", "Kinetic Rain of Impact", "Lightning Conduit of the Heavens",
    "Lightning Spire Trap of Overloading", "Lightning Spire Trap of Zapping", "Lightning Tendrils of Eccentricity", "Lightning Tendrils of Escalation",
    "Lightning Trap of Sparking", "Penance Brand of Conduction", "Penance Brand of Dissipation", "Power Siphon of the Archmage",
    "Purifying Flame of Revelations", "Pyroclast Mine of Sabotage", "Raise Spectre of Transience", "Raise Zombie of Falling",
    "Raise Zombie of Slamming", "Righteous Fire of Arcane Devotion", "Scorching Ray of Immolation", "Soulrend of Reaping",
    "Soulrend of the Spiral", "Spark of the Nova", "Spark of Unpredictability", "Storm Brand of Indecision",
    "Stormbind of Teleportation", "Summon Carrion Golem of Hordes", "Summon Carrion Golem of Scavenging", "Summon Chaos Golem of Hordes",
    "Summon Chaos Golem of the Maelström", "Summon Holy Relic of Conviction", "Summon Lightning Golem of Hordes", "Summon Raging Spirit of Enormity",
    "Summon Reaper of Eviscerating", "Summon Reaper of Revenants", "Summon Skeletons of Archers", "Summon Skeletons of Mages",
    "Void Sphere of Rending", "Vortex of Projection"
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

  // Picker States
  const [gemSearch, setGemSearch] = useState("");
  const [gemSuggestions, setGemSuggestions] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get("/api/rule-templates")
      .then((res) => setRuleTemplates(res.data.categories || []))
      .catch((e) => console.error("Failed to fetch rule templates", e));
  }, []);

  useEffect(() => {
      if (gemSearch.length < 2) {
          setGemSuggestions([]);
          return;
      }
      const timeout = setTimeout(async () => {
          try {
              const res = await axios.get(`/api/search-items?q=${encodeURIComponent(gemSearch)}`);
              const gems = res.data.results.filter((i: any) => i.item_class?.includes("Gem"));
              setGemSuggestions(gems);
          } catch (e) {}
      }, 300);
      return () => clearTimeout(timeout);
  }, [gemSearch]);

  const activeRule = (inspectedTier && editingRuleIndex !== null) ? inspectedTier.rules?.[editingRuleIndex] : null;

  const handleAddConditionToCurrent = (tmp: any) => {
      if (!activeRule) return;
      if (activeRule.conditions && activeRule.conditions[tmp.condition]) {
          alert(`${tmp.label[language]} already exists in this rule.`);
          return;
      }
      
      let val = "";
      if (tmp.type === 'number') val = ">= 0";
      else if (tmp.type === 'bool') val = "True";
      else if (tmp.type === 'select') val = tmp.options[0];
      else if (tmp.type === 'class_picker') val = "Currency";
      else if (tmp.type === 'text') val = "";
      
      onAddRulePreset(inspectedTier!.key, {
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
                        : (tmp.type === "select" ? tmp.options[0] : (tmp.type === "text" ? "" : "")),
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
              {filteredTemplates.map((cat) => (
                <div key={cat.id} className="lib-cat">
                  <span className="lib-cat-title">{cat.name[language]}</span>
                  <div className="template-grid">
                    {cat.templates.map((tmp: any) => (
                      <button
                        key={tmp.id}
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
                    ))}
                  </div>
                </div>
              ))}
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