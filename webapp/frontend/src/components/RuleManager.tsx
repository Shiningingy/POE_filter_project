import React, { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import {
  useTranslation,
  RULE_FACTOR_LOCALIZATION,
  translations,
  CLASS_KEY_MAP,
} from "../utils/localization";
import type { Language } from "../utils/localization";
import ItemCard from "./ItemCard";
import ContextMenu from "./ContextMenu";
import SoundPicker from "./SoundPicker";
import MinimapIconPicker, { getIconStyle, formatMinimapIcon } from "./MinimapIconPicker";
import PlayEffectPicker, { formatPlayEffect } from "./PlayEffectPicker";
import StylePresetPicker from "./StylePresetPicker";

interface Item {
  name: string;
  name_ch?: string;
  source: string;
  [key: string]: any;
}

interface Rule {
  targets: string[];
  targetMatchModes?: Record<string, "exact" | "partial">; // New field
  conditions: Record<string, string>;
  overrides: Record<string, any>;
  comment?: string;
  raw?: string;
  disabled?: boolean;
  applyToTier?: boolean;
}

interface TierOption {
  key: string;
  label: string;
}

interface RuleManagerProps {
  tierKey: string;
  allRules: Rule[];
  onGlobalRulesChange: (newRules: Rule[]) => void;
  onRuleEdit: (tierKey: string, ruleIndex: number | null) => void;
  language: Language;
  availableItems: Item[];
  translationCache: Record<string, string>;
  availableTiers?: TierOption[];
  activeRuleIndex?: number | null;
  onPingCondition?: (tierKey: string, ruleIndex: number, conditionKey: string) => void;
  onRegisterTranslation?: (name: string, name_ch?: string) => void;
  categoryClass?: string | null;
  themeData?: any;
  themeCategory?: string;
  pingedCondition?: {
    tierKey: string;
    ruleIndex: number;
    conditionKey: string;
    timestamp: number;
  } | null;
  soundMap?: any;
}

const ITEM_CLASSES = [
  "Stackable Currency",
  "Maps",
  "Divination Cards",
  "Skill Gems",
  "Support Gems",
  "Body Armours",
  "Boots",
  "Gloves",
  "Helmets",
  "Shields",
  "Quivers",
  "Amulets",
  "Rings",
  "Belts",
  "Jewels",
  "Abyss Jewels",
  "Claws",
  "Daggers",
  "Rune Daggers",
  "Wands",
  "One Hand Swords",
  "Thrusting One Hand Swords",
  "One Hand Axes",
  "One Hand Maces",
  "Sceptres",
  "Bows",
  "Staves",
  "Warstaves",
  "Two Hand Swords",
  "Two Hand Axes",
  "Two Hand Maces",
  "Life Flasks",
  "Mana Flasks",
  "Utility Flasks",
  "Map Fragments",
  "Scarabs",
  "Expedition Logbooks",
  "Contract",
  "Blueprint",
  "Relic",
];

const RuleManager: React.FC<RuleManagerProps> = ({
  tierKey,
  allRules,
  onGlobalRulesChange,
  onRuleEdit,
  language,
  availableItems,
  translationCache,
  availableTiers,
  activeRuleIndex,
  onPingCondition,
  onRegisterTranslation,
  categoryClass,
  themeData,
  themeCategory,
  pingedCondition
}) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const ruleRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [targetSearch, setTargetSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    ruleIndex: number;
  } | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<{
    x: number;
    y: number;
    ruleIndex: number;
    itemName: string;
  } | null>(null);

  // Specialized Picker States
  const [ruleTemplates, setRuleTemplates] = useState<any[]>([]);

  // Per-rule style-override picker (sound / icon / drop effect)
  const [stylePicker, setStylePicker] = useState<{
    index: number;
    type: "sound" | "icon" | "effect";
  } | null>(null);

  // Quick style apply (rule whose overrides receive a theme preset style)
  const [presetPickerIndex, setPresetPickerIndex] = useState<number | null>(null);

  const applyPresetToRule = (globalIndex: number, presetStyle: Record<string, any>) => {
    const rule = allRules[globalIndex];
    if (!rule) return;
    // Only style keys land; Tier / conditions / sound stay untouched.
    handleUpdateRule(globalIndex, {
      ...rule,
      overrides: { ...(rule.overrides || {}), ...presetStyle },
    });
  };

  const [localPing, setLocalPing] = useState<{
    ruleIndex: number;
    conditionKey: string;
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    if (pingedCondition && pingedCondition.tierKey === tierKey) {
      setLocalPing({
        ruleIndex: pingedCondition.ruleIndex,
        conditionKey: pingedCondition.conditionKey,
        timestamp: pingedCondition.timestamp,
      });
      const timeout = setTimeout(() => setLocalPing(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [pingedCondition, tierKey]);

  useEffect(() => {
    axios
      .get("/api/rule-templates")
      .then((res) => setRuleTemplates(res.data.categories || []))
      .catch((e) => console.error(e));
  }, []);

  const tierRulesIndices = useMemo(() => {
    return allRules
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        // 1. Must match this tier (if tier override exists) or target items in this tier
        const hasTierOverride = !!r.overrides?.Tier;
        const matchesTier = hasTierOverride
          ? r.overrides.Tier === tierKey
          : r.targets.some((target) =>
              availableItems.some((i) => i.name === target),
            );
        if (!matchesTier) return false;

        // 2. Hide "Sound-only" rules (rules that only override sound and have no conditions/other visuals)
        const hasConditions = Object.keys(r.conditions || {}).length > 0;
        const overrideKeys = Object.keys(r.overrides || {}).filter(
          (k) => k !== "Tier",
        );

        const hasSound = overrideKeys.some((k) =>
          k.toLowerCase().includes("sound"),
        );
        const hasVisuals = overrideKeys.some((k) =>
          [
            "TextColor",
            "BackgroundColor",
            "BorderColor",
            "PlayEffect",
            "MinimapIcon",
          ].includes(k),
        );

        // If it's sound-only (no conditions, no other visuals, no tier override), hide it
        if (hasSound && !hasConditions && !hasVisuals && !hasTierOverride)
          return false;

        return true;
      })
      .map((item) => item.i);
  }, [allRules, tierKey, availableItems]);

  const activeCount = tierRulesIndices.filter(
    (i) => !allRules[i].disabled,
  ).length;

  useEffect(() => {
    if (activeRuleIndex !== undefined && activeRuleIndex !== null) {
      setEditingIndex(activeRuleIndex);
      // Scroll into view
      setTimeout(() => {
        const el = ruleRefs.current[activeRuleIndex];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [activeRuleIndex]);

  useEffect(() => {
    if (targetSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axios.get(
          `/api/search-items?q=${encodeURIComponent(targetSearch)}`,
        );
        setSuggestions(res.data.results);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [targetSearch]);

  const handleAddRule = () => {
    const newRule: Rule = {
      targets: [],
      conditions: {},
      overrides: { Tier: tierKey },
      comment: "",
    };
    onGlobalRulesChange([...allRules, newRule]);
    setEditingAndNotify(allRules.length);
  };

  const handleUpdateRule = (globalIndex: number, updatedRule: Rule) => {
    const newRules = [...allRules];
    newRules[globalIndex] = updatedRule;
    onGlobalRulesChange(newRules);
    onRuleEdit(tierKey, globalIndex);
  };

  const setEditingAndNotify = (idx: number | null) => {
    setEditingIndex(idx);
    onRuleEdit(tierKey, idx);
  };

  const handleDeleteRule = (e: React.MouseEvent, globalIndex: number) => {
    e.stopPropagation();
    if (window.confirm(t.deleteRuleConfirm)) {
      onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex));
      setEditingAndNotify(null);
    }
  };

  const handleDeleteRuleNoConfirm = (globalIndex: number) => {
    onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex));
    setEditingAndNotify(null);
  };

  const toggleDisable = (e: React.MouseEvent, globalIndex: number) => {
    e.stopPropagation();
    const rule = allRules[globalIndex];
    handleUpdateRule(globalIndex, { ...rule, disabled: !rule.disabled });
  };

  const toggleItemMatchMode = (globalIndex: number, itemName: string) => {
    const rule = allRules[globalIndex];
    const modes = { ...(rule.targetMatchModes || {}) };
    const current = modes[itemName] || "exact";
    modes[itemName] = current === "exact" ? "partial" : "exact";
    handleUpdateRule(globalIndex, { ...rule, targetMatchModes: modes });
    setItemContextMenu(null);
  };

  const handleItemRightClick = (
    e: React.MouseEvent,
    globalIndex: number,
    itemName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setItemContextMenu({
      x: e.clientX,
      y: e.clientY,
      ruleIndex: globalIndex,
      itemName,
    });
  };

  const handleMoveRule = (globalIndex: number, newTierKey: string) => {
    const rule = allRules[globalIndex];
    const newOverrides = { ...rule.overrides, Tier: newTierKey };
    handleUpdateRule(globalIndex, { ...rule, overrides: newOverrides });
    setEditingAndNotify(null);
  };

  const handleRightClick = (e: React.MouseEvent, globalIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, ruleIndex: globalIndex });
  };

  const addTarget = (globalIndex: number, itemName: string) => {
    const rule = allRules[globalIndex];
    if (!rule.targets.includes(itemName)) {
      handleUpdateRule(globalIndex, {
        ...rule,
        targets: [...rule.targets, itemName],
      });
    }
    setTargetSearch("");
    setSuggestions([]);
  };

  const removeTarget = (globalIndex: number, itemName: string) => {
    const rule = allRules[globalIndex];
    handleUpdateRule(globalIndex, {
      ...rule,
      targets: rule.targets.filter((t) => t !== itemName),
    });
  };

  const updateCondition = (globalIndex: number, key: string, value: string) => {
    const rule = allRules[globalIndex];
    const nextConditions = { ...rule.conditions };

    // Only delete if explicitly requested or if it's a type that SHOULD be removed when empty
    // For text/class_picker manual entry, we want to allow empty string while typing
    const tmp = ruleTemplates
      .flatMap((c) => c.templates)
      .find((t) => t.condition === key);
    const isTextField = tmp?.type === "text" || tmp?.type === "class_picker";

    if (value === null || (value === "" && !isTextField)) {
      delete nextConditions[key];
    } else {
      nextConditions[key] = value;
    }
    handleUpdateRule(globalIndex, { ...rule, conditions: nextConditions });
  };

  const addCondition = (globalIndex: number, key: string) => {
    const rule = allRules[globalIndex];
    if (rule.conditions[key] !== undefined) {
      // Trigger ping if trying to add existing from dropdown
      onPingCondition?.(tierKey, globalIndex, key);
      onRuleEdit(tierKey, globalIndex);
      return;
    }

    const allTemplates = ruleTemplates
      .flatMap((c) => c.templates)
      .find((t) => t.condition === key);

    let val = ">= 0";
    if (allTemplates) {
      if (allTemplates.type === "bool") val = "True";
      else if (allTemplates.type === "select") val = allTemplates.options[0];
      else if (allTemplates.type === "class_picker") val = "Stackable Currency";
      else if (allTemplates.type === "text") val = "";
      else if (allTemplates.type === "gem_picker") val = "True";
    }
    updateCondition(globalIndex, key, val);
  };

  // Partition conditions into "recommended" (universal or applicable to this
  // category's class) and "others" (everything else), de-duplicated.
  const getRelevantFactors = () => {
    if (ruleTemplates.length === 0) return { recommended: [], others: [] };
    const seen = new Set<string>();
    const recommended: any[] = [];
    const others: any[] = [];
    const isRecommended = (tmp: any) =>
      tmp.universal === true ||
      (categoryClass && Array.isArray(tmp.classes) && tmp.classes.includes(categoryClass)) ||
      // Schema not loaded (no class metadata): treat everything as recommended.
      (tmp.universal === undefined && tmp.classes === undefined);

    ruleTemplates.forEach((category: any) => {
      category.templates.forEach((tmp: any) => {
        if (seen.has(tmp.condition)) return;
        seen.add(tmp.condition);
        const entry = { key: tmp.condition, label: tmp.label[language], template: tmp };
        (isRecommended(tmp) ? recommended : others).push(entry);
      });
    });
    return { recommended, others };
  };

  const relevantFactors = useMemo(getRelevantFactors, [
    ruleTemplates,
    language,
    categoryClass,
  ]);

  return (
    <div className="tier-rule-manager">
      <div className="rule-header">
        <span className="label">
          🛠 {t.rules} ({activeCount}/{tierRulesIndices.length})
        </span>
        <button className="mini-add-btn" onClick={handleAddRule}>
          + {t.addRule}
        </button>
      </div>

      <div className="rules-stack">
        {tierRulesIndices.map((globalIndex, localIndex) => {
          const rule = allRules[globalIndex];
          const isEditing = editingIndex === globalIndex;

          return (
            <div
              key={globalIndex}
              className={`inline-rule-card ${isEditing ? "editing" : ""} ${rule.disabled ? "disabled-card" : ""}`}
              onContextMenu={(e) => handleRightClick(e, globalIndex)}
              ref={(el) => {
                ruleRefs.current[globalIndex] = el;
              }}
            >
              <div
                className="summary"
                onClick={() =>
                  setEditingAndNotify(isEditing ? null : globalIndex)
                }
              >
                <div
                  className={`rule-badge ${rule.disabled ? "disabled-badge" : ""}`}
                >
                  #{localIndex + 1}
                </div>
                <input
                  className={`rule-name-input ${rule.disabled ? "disabled-text" : ""}`}
                  value={rule.comment || ""}
                  placeholder={t.ruleComment}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    handleUpdateRule(globalIndex, {
                      ...rule,
                      comment: e.target.value,
                    })
                  }
                />
                <div className="rule-actions">
                  <button
                    className="icon-btn"
                    title={rule.disabled ? "Enable" : "Disable"}
                    onClick={(e) => toggleDisable(e, globalIndex)}
                  >
                    {rule.disabled ? "⚪" : "🟢"}
                  </button>
                  <button
                    className="delete-btn"
                    title={t.deleteRule}
                    onClick={(e) => handleDeleteRule(e, globalIndex)}
                  >
                    ×
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="details">
                  <div className="section-divider">
                    <span>{t.targets}</span>
                  </div>

                  <div className="tier-apply-toggle">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={!!rule.applyToTier}
                        onChange={(e) =>
                          handleUpdateRule(globalIndex, {
                            ...rule,
                            applyToTier: e.target.checked,
                          })
                        }
                      />
                      <span className="checkmark"></span>
                      <span className="toggle-label">
                        {language === "ch"
                          ? "应用至此阶级的所有物品"
                          : "Apply to all items in this Tier"}
                      </span>
                    </label>
                  </div>

                  {!rule.applyToTier && (
                    <div className="target-manager">
                      <div className="target-grid">
                        {rule.targets.map((tName) => {
                          const item = availableItems.find(
                            (i) => i.name === tName,
                          ) || {
                            name: tName,
                            name_ch: translationCache[tName],
                          };
                          const displayItem = {
                            ...item,
                            rule_index: undefined,
                          };
                          const matchMode =
                            rule.targetMatchModes?.[tName] || "exact";
                          
                          // Check for sound overrides
                          const soundKeys = ["CustomAlertSound", "AlertSound", "DropSound"];
                          const soundOverrideKey = soundKeys.find(k => rule.overrides?.[k] && !rule.overrides[k].startsWith("disabled:"));
                          const hasExplicitSound = !!soundOverrideKey;
                          
                          const handlePlaySound = () => {
                              let file: string | null = null;
                              let vol = 300;

                              if (hasExplicitSound) {
                                  const val = rule.overrides?.[soundOverrideKey!];
                                  if (typeof val === 'string') {
                                      if (val.match(/^\d+ \d+$/)) {
                                          const parts = val.split(' ');
                                          file = `Default/AlertSound${parts[0]}.mp3`;
                                          vol = parseInt(parts[1]);
                                      } else {
                                          file = val;
                                      }
                                  } else if (Array.isArray(val)) {
                                      file = val[0];
                                      vol = val[1];
                                  }
                              }

                              if (file) {
                                  const url = `/sounds/${file.replace(/\\/g, '/')}`;
                                  const audio = new Audio(url);
                                  audio.volume = Math.min(Math.max(vol / 300, 0), 1);
                                  audio.play().catch(e => console.error("Play failed", e));
                              }
                          };

                          return (
                            <ItemCard
                              key={tName}
                              item={displayItem}
                              language={language}
                              onDelete={() => removeTarget(globalIndex, tName)}
                              onContextMenu={(e) =>
                                handleItemRightClick(e, globalIndex, tName)
                              }
                              matchMode={matchMode}
                              hasSound={hasExplicitSound}
                              onPlaySound={handlePlaySound}
                              className="compact-card"
                            />
                          );
                        })}

                        {rule.targets.length === 0 && (
                          <div className="target-empty-hint">
                            {t.targetTooltip}
                          </div>
                        )}
                      </div>

                      <div className="add-target-box">
                        <input
                          type="text"
                          placeholder={t.addItemTarget}
                          value={targetSearch}
                          onChange={(e) => setTargetSearch(e.target.value)}
                        />
                        {suggestions.length > 0 && (
                          <ul className="suggestions-pop">
                            {suggestions.map((s) => (
                              <li
                                key={s.name}
                                onClick={() => { onRegisterTranslation?.(s.name, s.name_ch); addTarget(globalIndex, s.name); }}
                              >
                                <ItemCard
                                  item={s}
                                  language={language}
                                  showStagedIndicator={false}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="section-divider">
                    <span>{t.conditions}</span>
                  </div>

                  <div className="factors-mini-grid">
                    {Object.entries(rule.conditions).map(
                      ([key, currentVal]) => {
                        const isRange = currentVal?.startsWith("RANGE ");
                        const parts = isRange ? currentVal.split(" ") : [];
                        const op1 = isRange
                          ? parts[1]
                          : currentVal?.match(/^[>=<!]+/)?.[0] || "";
                        const v1 = isRange
                          ? parts[2]
                          : currentVal?.replace(/^[>=<!]+/, "");
                        const op2 = isRange ? parts[3] : "";
                        const v2 = isRange ? parts[4] : "";

                        const tmp = ruleTemplates
                          .flatMap((c) => c.templates)
                          .find((t) => t.condition === key);

                        const isBool =
                          tmp?.type === "bool" ||
                          (["True", "False"].includes(currentVal) &&
                            [
                              "corrupted",
                              "mirrored",
                              "identified",
                              "fractureditem",
                              "synthesiseditem",
                              "blightedmap",
                              "blightravagedmap",
                              "vaalgem",
                              "transfiguredgem",
                            ].includes(key.toLowerCase()));

                        const label =
                          tmp?.label[language] ||
                          RULE_FACTOR_LOCALIZATION[key]?.[language] ||
                          key;
                        const isSelect = tmp?.type === "select";
                        const isClass = tmp?.type === "class_picker";
                        const isText = tmp?.type === "text";

                        const isPinging =
                          localPing?.ruleIndex === globalIndex &&
                          localPing?.conditionKey === key;

                        return (
                          <div
                            key={`${key}-${localPing?.timestamp || "static"}`}
                            className={`mini-factor ${isRange ? "range-factor" : ""} ${isPinging ? "pinging" : ""}`}
                          >
                            <div className="factor-header">
                              <span>{label}</span>
                              <button
                                className="remove-factor-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCondition(
                                    globalIndex,
                                    key,
                                    null as any,
                                  );
                                }}
                              >
                                ×
                              </button>
                            </div>
                            <div className="inputs">
                              {isBool ? (
                                <select
                                  value={currentVal || ""}
                                  onChange={(e) =>
                                    updateCondition(
                                      globalIndex,
                                      key,
                                      e.target.value,
                                    )
                                  }
                                  style={{ width: "100%" }}
                                >
                                  <option value="True">
                                    {(translations[language] as any).true}
                                  </option>
                                  <option value="False">
                                    {(translations[language] as any).false}
                                  </option>
                                </select>
                              ) : isSelect ? (
                                <select
                                  value={currentVal}
                                  onChange={(e) =>
                                    updateCondition(
                                      globalIndex,
                                      key,
                                      e.target.value,
                                    )
                                  }
                                  style={{ width: "100%" }}
                                >
                                  {tmp.options.map((opt: string) => {
                                    const locKey = opt.replace(/ /g, "_");
                                    const locName =
                                      (translations[language] as any)[opt] ||
                                      (translations[language] as any)[locKey] ||
                                      opt;
                                    return (
                                      <option key={opt} value={opt}>
                                        {locName}
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : isText ? (
                                <input
                                  type="text"
                                  value={currentVal}
                                  placeholder={tmp.placeholder || ""}
                                  onChange={(e) =>
                                    updateCondition(
                                      globalIndex,
                                      key,
                                      e.target.value,
                                    )
                                  }
                                />
                              ) : isClass ? (
                                <div className="class-picker-ui">
                                  <select
                                    value={
                                      ITEM_CLASSES.includes(currentVal)
                                        ? currentVal
                                        : "custom"
                                    }
                                    onChange={(e) =>
                                      updateCondition(
                                        globalIndex,
                                        key,
                                        e.target.value,
                                      )
                                    }
                                  >
                                    {ITEM_CLASSES.map((cls) => {
                                      const locKey =
                                        CLASS_KEY_MAP[cls] ||
                                        cls.replace(/ /g, "_");
                                      const locName =
                                        (translations[language] as any)[
                                          locKey
                                        ] || cls;
                                      return (
                                        <option key={cls} value={cls}>
                                          {locName}
                                        </option>
                                      );
                                    })}
                                    <option value="custom">
                                      --{" "}
                                      {(translations[language] as any).custom}{" "}
                                      --
                                    </option>
                                  </select>
                                  {!ITEM_CLASSES.includes(currentVal) && (
                                    <input
                                      type="text"
                                      value={
                                        currentVal === "custom"
                                          ? ""
                                          : currentVal
                                      }
                                      placeholder={
                                        (translations[language] as any).search
                                      }
                                      onChange={(e) =>
                                        updateCondition(
                                          globalIndex,
                                          key,
                                          e.target.value,
                                        )
                                      }
                                      className="mt-5"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="op-val-pair">
                                  {!isRange ? (
                                    <>
                                      <select
                                        value={op1}
                                        onChange={(e) => {
                                          const newOp = e.target.value;
                                          if (newOp === "RANGE")
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `RANGE >= ${v1} <= 100`,
                                            );
                                          else
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `${newOp}${v1}`,
                                            );
                                        }}
                                      >
                                        <option value=">=">&gt;=</option>
                                        <option value="<=">&lt;=</option>
                                        <option value="==">==</option>
                                        <option value=">">&gt;</option>
                                        <option value="<">&lt;</option>
                                        <option value="RANGE">
                                          {t.rangeBetween}
                                        </option>
                                      </select>
                                      <input
                                        type="text"
                                        value={v1}
                                        onChange={(e) =>
                                          updateCondition(
                                            globalIndex,
                                            key,
                                            `${op1}${e.target.value}`,
                                          )
                                        }
                                      />
                                    </>
                                  ) : (
                                    <div className="range-controls-row">
                                      <div className="range-half">
                                        <select
                                          value={op1}
                                          onChange={(e) =>
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `RANGE ${e.target.value} ${v1} ${op2} ${v2}`,
                                            )
                                          }
                                        >
                                          <option value=">=">&gt;=</option>
                                          <option value=">">&gt;</option>
                                        </select>
                                        <input
                                          type="text"
                                          value={v1}
                                          onChange={(e) =>
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `RANGE ${op1} ${e.target.value} ${op2} ${v2}`,
                                            )
                                          }
                                        />
                                      </div>
                                      <span className="range-sep">AND</span>
                                      <div className="range-half">
                                        <select
                                          value={op2}
                                          onChange={(e) =>
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `RANGE ${op1} ${v1} ${e.target.value} ${v2}`,
                                            )
                                          }
                                        >
                                          <option value="<=">&lt;=</option>
                                          <option value="<">&lt;</option>
                                        </select>
                                        <input
                                          type="text"
                                          value={v2}
                                          onChange={(e) =>
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `RANGE ${op1} ${v1} ${op2} ${e.target.value}`,
                                            )
                                          }
                                        />
                                      </div>
                                      <button
                                        className="range-back-btn"
                                        onClick={() =>
                                          updateCondition(
                                            globalIndex,
                                            key,
                                            `>= ${v1}`,
                                          )
                                        }
                                      >
                                        ×
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}

                    <div className="mini-factor add-condition-card">
                      <span>+ {t.conditions}</span>
                      <select
                        value=""
                        onChange={(e) =>
                          addCondition(globalIndex, e.target.value)
                        }
                        className="add-cond-select"
                      >
                        <option value="" disabled>
                          {t.addItemTarget}
                        </option>
                        {(() => {
                          const opt = (f: any) => (
                            <option key={f.key} value={f.key}>
                              {RULE_FACTOR_LOCALIZATION[f.key]?.[language] || f.label}
                            </option>
                          );
                          const rec = relevantFactors.recommended.filter((f) => rule.conditions[f.key] === undefined);
                          const oth = relevantFactors.others.filter((f) => rule.conditions[f.key] === undefined);
                          return (
                            <>
                              {rec.length > 0 && (
                                <optgroup label={language === 'ch' ? '推荐 (本类别)' : 'Recommended'}>
                                  {rec.map(opt)}
                                </optgroup>
                              )}
                              {oth.length > 0 && (
                                <optgroup label={language === 'ch' ? '其他全部' : 'All others'}>
                                  {oth.map(opt)}
                                </optgroup>
                              )}
                            </>
                          );
                        })()}
                      </select>
                    </div>
                  </div>

                  <div className="section-divider">
                    <span>{t.themeOverrides}</span>
                    {themeData && (
                      <button
                        className="rule-preset-btn"
                        title={t.applyStylePreset}
                        onClick={() => setPresetPickerIndex(globalIndex)}
                      >
                        🎨 {t.applyStylePreset}
                      </button>
                    )}
                  </div>

                  <div className="theme-overrides-grid">
                    {["TextColor", "BackgroundColor", "BorderColor"].map(
                      (key) => {
                        const label =
                          key === "TextColor"
                            ? t.text
                            : key === "BackgroundColor"
                              ? t.background
                              : t.border;
                        const hexToRgba = (hex: string) => `${hex}ff`;
                        const rgbaToHex = (rgba: string) =>
                          rgba?.startsWith("disabled:")
                            ? rgba.split(":")[1].substring(0, 7)
                            : rgba?.substring(0, 7) || "#000000";
                        const val = rule.overrides?.[key];
                        const isActive = !!val && !val.startsWith("disabled:");

                        return (
                          <div key={key} className="color-override-item">
                            <label>{label}</label>
                            <div className="color-input-group">
                              <input
                                type="color"
                                value={rgbaToHex(val)}
                                disabled={!isActive}
                                onChange={(e) => {
                                  const newOverrides = {
                                    ...rule.overrides,
                                    [key]: hexToRgba(e.target.value),
                                  };
                                  handleUpdateRule(globalIndex, {
                                    ...rule,
                                    overrides: newOverrides,
                                  });
                                }}
                              />
                              <button
                                className={`toggle-override-btn ${isActive ? "active" : ""}`}
                                onClick={() => {
                                  const nextOverrides = { ...rule.overrides };
                                  if (isActive) delete nextOverrides[key];
                                  else
                                    nextOverrides[key] =
                                      key === "BackgroundColor"
                                        ? "#000000ff"
                                        : "#ffffffff";
                                  handleUpdateRule(globalIndex, {
                                    ...rule,
                                    overrides: nextOverrides,
                                  });
                                }}
                              >
                                {isActive ? "ON" : "OFF"}
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}

                    {/* Font Size override */}
                    {(() => {
                      const active =
                        rule.overrides?.FontSize !== undefined &&
                        rule.overrides?.FontSize !== null;
                      const setFont = (next: number | null) => {
                        const nextOverrides = { ...rule.overrides };
                        if (next === null) delete nextOverrides.FontSize;
                        else nextOverrides.FontSize = next;
                        handleUpdateRule(globalIndex, {
                          ...rule,
                          overrides: nextOverrides,
                        });
                      };
                      return (
                        <div className="color-override-item">
                          <label>{t.fontSize}</label>
                          <div className="color-input-group">
                            <input
                              type="range"
                              min="12"
                              max="45"
                              disabled={!active}
                              value={rule.overrides?.FontSize ?? 32}
                              onChange={(e) =>
                                setFont(parseInt(e.target.value))
                              }
                              style={{ flex: 1 }}
                            />
                            <span className="font-val">
                              {active ? rule.overrides.FontSize : "—"}
                            </span>
                            <button
                              className={`toggle-override-btn ${active ? "active" : ""}`}
                              onClick={() => setFont(active ? null : 32)}
                            >
                              {active ? "ON" : "OFF"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sound override */}
                    <div className="color-override-item">
                      <label>{t.sound}</label>
                      <div
                        className="override-picker-box"
                        onClick={() =>
                          setStylePicker({ index: globalIndex, type: "sound" })
                        }
                      >
                        <span className="override-icon">🎵</span>
                        <span className="override-name">
                          {Array.isArray(rule.overrides?.PlayAlertSound)
                            ? rule.overrides.PlayAlertSound[0]
                                .split("/")
                                .pop()
                            : t.none}
                        </span>
                      </div>
                    </div>

                    {/* Minimap Icon override */}
                    <div className="color-override-item">
                      <label>{t.minimapIcon}</label>
                      <div
                        className="override-picker-box"
                        onClick={() =>
                          setStylePicker({ index: globalIndex, type: "icon" })
                        }
                      >
                        {rule.overrides?.MinimapIcon ? (
                          <div
                            style={getIconStyle(
                              rule.overrides.MinimapIcon.split(" ")[1],
                              rule.overrides.MinimapIcon.split(" ")[2],
                              0.7,
                            )}
                          ></div>
                        ) : (
                          <span className="override-icon">📍</span>
                        )}
                        <span className="override-name">
                          {rule.overrides?.MinimapIcon
                            ? formatMinimapIcon(rule.overrides.MinimapIcon, t)
                            : t.none}
                        </span>
                      </div>
                    </div>

                    {/* Drop Effect override */}
                    <div className="color-override-item">
                      <label>{t.dropEffect}</label>
                      <div
                        className="override-picker-box"
                        onClick={() =>
                          setStylePicker({ index: globalIndex, type: "effect" })
                        }
                      >
                        {rule.overrides?.PlayEffect ? (
                          <span
                            className="effect-swatch"
                            style={{
                              background: rule.overrides.PlayEffect.split(
                                " ",
                              )[0].toLowerCase(),
                            }}
                          ></span>
                        ) : (
                          <span className="override-icon">✨</span>
                        )}
                        <span className="override-name">
                          {rule.overrides?.PlayEffect
                            ? formatPlayEffect(rule.overrides.PlayEffect, t)
                            : t.none}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="section-divider">
                    <span>{t.rawText}</span>
                  </div>

                  <div className="raw-code-field">
                    <textarea
                      placeholder="# Custom lines like: \n    SetFontSize 45"
                      value={rule.raw || ""}
                      onChange={(e) =>
                        handleUpdateRule(globalIndex, {
                          ...rule,
                          raw: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="section-divider">
                    <span>{t.actions}</span>
                  </div>
                  <div className="actions-row">
                    {availableTiers && (
                      <div className="move-control">
                        <label>{t.moveTo}</label>
                        <select
                          value={rule.overrides?.Tier || tierKey}
                          onChange={(e) =>
                            handleMoveRule(globalIndex, e.target.value)
                          }
                          className="tier-select"
                        >
                          {availableTiers.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-rule style-override pickers */}
      {stylePicker?.type === "sound" && (
        <SoundPicker
          language={language}
          initialPath={
            Array.isArray(allRules[stylePicker.index]?.overrides?.PlayAlertSound)
              ? allRules[stylePicker.index].overrides.PlayAlertSound[0]
              : undefined
          }
          initialVolume={
            Array.isArray(allRules[stylePicker.index]?.overrides?.PlayAlertSound)
              ? allRules[stylePicker.index].overrides.PlayAlertSound[1]
              : undefined
          }
          onClose={() => setStylePicker(null)}
          onConfirm={(path, vol) => {
            const idx = stylePicker.index;
            const rule = allRules[idx];
            handleUpdateRule(idx, {
              ...rule,
              overrides: { ...rule.overrides, PlayAlertSound: [path, vol] },
            });
            setStylePicker(null);
          }}
        />
      )}
      {stylePicker?.type === "icon" && (
        <MinimapIconPicker
          value={allRules[stylePicker.index]?.overrides?.MinimapIcon}
          language={language}
          onClose={() => setStylePicker(null)}
          onConfirm={(v) => {
            const idx = stylePicker.index;
            const rule = allRules[idx];
            const next = { ...rule.overrides };
            if (v === null) delete next.MinimapIcon;
            else next.MinimapIcon = v;
            handleUpdateRule(idx, { ...rule, overrides: next });
            setStylePicker(null);
          }}
        />
      )}
      {stylePicker?.type === "effect" && (
        <PlayEffectPicker
          value={allRules[stylePicker.index]?.overrides?.PlayEffect}
          language={language}
          onClose={() => setStylePicker(null)}
          onConfirm={(v) => {
            const idx = stylePicker.index;
            const rule = allRules[idx];
            const next = { ...rule.overrides };
            if (v === null) delete next.PlayEffect;
            else next.PlayEffect = v;
            handleUpdateRule(idx, { ...rule, overrides: next });
            setStylePicker(null);
          }}
        />
      )}

      {presetPickerIndex !== null && themeData && (
        <StylePresetPicker
          themeData={themeData}
          initialCategory={themeCategory}
          language={language}
          onClose={() => setPresetPickerIndex(null)}
          onSelect={(presetStyle) => applyPresetToRule(presetPickerIndex, presetStyle)}
        />
      )}

      <style>{`
        .tier-rule-manager { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ddd; }
        .rule-preset-btn { margin-left: auto; background: #fafafa; border: 1px solid #ddd; border-radius: 4px; padding: 2px 10px; font-size: 0.72rem; cursor: pointer; }
        .rule-preset-btn:hover { border-color: #4CAF50; color: #2e7d32; }
        .override-picker-box { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; cursor: pointer; transition: background 0.2s; min-height: 28px; }
        .override-picker-box:hover { background: #f0f7ff; border-color: #2196F3; }
        .override-name { font-size: 0.78rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .override-icon { font-size: 0.85rem; flex-shrink: 0; }
        .font-val { font-size: 0.78rem; color: #555; font-weight: bold; min-width: 22px; text-align: center; }
        .effect-swatch { width: 14px; height: 14px; border-radius: 50%; display: inline-block; flex-shrink: 0; box-shadow: 0 0 5px currentColor; border: 1px solid rgba(0,0,0,0.2); }
        .rule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .mini-add-btn { background: #e3f2fd; color: #222 !important; border: 1px solid #2196F3; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; }
        
        .inline-rule-card { border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; margin-bottom: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .inline-rule-card.editing { border-color: #2196F3; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15); }
        
        .summary { padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 12px; background: #fcfcfc; }
        .rule-badge { background: #eee; color: #666; font-size: 0.7rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
        
        .rule-name-input { 
            flex: 1; 
            background: transparent; 
            border: 1px solid transparent; 
            font-size: 0.9rem; 
            color: #222; 
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .rule-name-input:hover { background: rgba(0,0,0,0.03); }
        .rule-name-input:focus { background: white; border-color: #ddd; outline: none; }

        .details { padding: 15px; border-top: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 15px; }
        .field label { font-size: 0.7rem; color: #999; font-weight: bold; text-transform: uppercase; }
        .field input { padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 0.85rem; color: #222; background: #fff; }
        
        .label-with-tooltip { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
        .tooltip-icon { 
            display: inline-flex; width: 14px; height: 14px; 
            background: #bbb; color: white; border-radius: 50%; 
            align-items: center; justify-content: center; 
            font-size: 10px; cursor: help; 
        }

        .section-divider { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
        .section-divider span { font-size: 0.7rem; color: #bbb; font-weight: bold; text-transform: uppercase; white-space: nowrap; }
        .section-divider::after { content: ""; height: 1px; background: #eee; width: 100%; }

        .target-manager { background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; }
        .target-grid { display: flex; flex-wrap: wrap; gap: 8px; min-height: 20px; }
        .target-empty-hint { font-size: 0.75rem; color: #999; font-style: italic; line-height: 1.4; }
        .target-class-hint { font-size: 0.8rem; color: #2196F3; font-weight: bold; background: #e3f2fd; padding: 8px 12px; border-radius: 4px; width: 100%; border: 1px dashed #2196F3; }
        
        .compact-card { min-width: 140px; max-width: 200px; padding: 6px 10px; }

        .add-target-box { position: relative; }
        .add-target-box input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box; }
        .add-target-box input:focus { border-color: #2196F3; outline: none; }
        
        .suggestions-pop { 
            position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
            background: white; border: 1px solid #ddd; border-radius: 6px;
            max-height: 250px; overflow-y: auto; padding: 5px; list-style: none; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }
        .suggestions-pop li { padding: 2px; cursor: pointer; }
        .suggestions-pop li:hover { background: #f0f7ff; }

        .factors-mini-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .mini-factor { display: flex; flex-direction: column; gap: 4px; background: #fcfcfc; padding: 8px; border-radius: 4px; border: 1px solid #f0f0f0; }
        .mini-factor.range-factor { grid-column: span 2; }
        .factor-header { display: flex; justify-content: space-between; align-items: center; }
        .mini-factor span { font-size: 0.75rem; color: #555; font-weight: bold; }
        .remove-factor-btn { background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0; transition: color 0.2s; }
        .remove-factor-btn:hover { color: #ff5252; }
        
        .add-condition-card { border-style: dashed; background: #fff; cursor: pointer; justify-content: center; min-width: 180px; }
        .add-condition-card:hover { border-color: #2196F3; }
        .add-cond-select { background: none; border: none; font-size: 0.75rem; color: #2196F3 !important; font-weight: bold; cursor: pointer; outline: none; width: 100%; }

        .op-val-pair { display: flex; gap: 4px; flex: 1; }
        .op-val-pair select { flex: 0 0 80px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        .op-val-pair input { flex: 1; width: 100%; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        
        .range-controls-row { display: flex; align-items: center; gap: 10px; flex: 1; }
        .range-half { display: flex; gap: 4px; flex: 1; }
        .range-half select { flex: 0 0 60px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        .range-half input { flex: 1; min-width: 40px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        .range-sep { font-size: 0.7rem; color: #999; font-weight: bold; }
        .range-back-btn { background: none; border: none; color: #bbb; cursor: pointer; font-size: 1rem; }
        .range-back-btn:hover { color: #2196F3; }

        .mini-factor select { padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }

        .raw-code-field textarea {
            width: 100%;
            height: 100px;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 12px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.8rem;
            border: 1px solid #333;
            border-radius: 6px;
            resize: vertical;
            line-height: 1.5;
        }
        
        .delete-btn { background: none; border: none; color: #ff5252; cursor: pointer; font-size: 1.4rem; opacity: 0.6; transition: opacity 0.2s; }
        .delete-btn:hover { opacity: 1; }

        .disabled-card { opacity: 0.6; background: #f5f5f5; }
        .disabled-badge { background: #ccc; color: #888; }
        .disabled-text { color: #aaa; text-decoration: line-through; }
        .rule-actions { display: flex; align-items: center; gap: 8px; }
        .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 0; opacity: 0.8; }
        .icon-btn:hover { opacity: 1; }
        .move-control { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; width: 100%; }
        .tier-select { padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; flex-grow: 1; max-width: 250px; }
        .actions-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }

        .tier-apply-toggle { margin-bottom: 10px; padding: 5px 0; }
        .checkbox-container { display: flex; align-items: center; cursor: pointer; font-size: 0.85rem; user-select: none; gap: 10px; }
        .checkbox-container input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        .checkmark { height: 18px; width: 18px; background-color: #eee; border-radius: 4px; border: 1px solid #ddd; transition: all 0.2s; position: relative; }
        .checkbox-container:hover input ~ .checkmark { background-color: #ccc; }
        .checkbox-container input:checked ~ .checkmark { background-color: #2196F3; border-color: #2196F3; }
        .checkmark:after { content: ""; position: absolute; display: none; left: 6px; top: 2px; width: 4px; height: 9px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .checkbox-container input:checked ~ .checkmark:after { display: block; }
        .toggle-label { font-weight: 600; color: #444; }

        .theme-overrides-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; background: #fdfdfd; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
        .color-override-item { display: flex; flex-direction: column; gap: 6px; }
        .color-override-item label { font-size: 0.7rem; color: #888; font-weight: bold; text-transform: uppercase; }
        .color-input-group { display: flex; align-items: center; gap: 8px; }
        .color-input-group input[type="color"] { width: 40px; height: 28px; padding: 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
        .color-input-group input[type="color"]:disabled { opacity: 0.3; cursor: not-allowed; }
        
        .toggle-override-btn { 
            padding: 4px 10px; font-size: 0.7rem; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; 
            font-weight: bold; transition: all 0.2s; background: #f5f5f5; color: #999;
        }
        .toggle-override-btn.active { background: #2196F3; color: white; border-color: #2196F3; }

        .class-picker-ui select { margin-bottom: 5px; width: 100%; }
        .class-picker-ui input { border-style: dashed; width: 100%; }
        .mt-5 { margin-top: 5px; }

        .gem-picker-ui { position: relative; }
        .gem-search-box { position: relative; margin-bottom: 5px; }
        .gem-search-box input { width: 100%; box-sizing: border-box; }
        .gem-popover { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .gem-sugg-item { padding: 6px 10px; cursor: pointer; font-size: 0.8rem; color: #222; }
        .gem-sugg-item:hover { background: #f0f7ff; color: #2196F3; }
        .gem-sugg-item.bool-opt { font-weight: bold; color: #1976d2; background: #f0f7ff; border-bottom: 1px solid #e3f2fd; }
        .gem-sugg-item.bool-opt:hover { background: #e3f2fd; }
        .current-gem-val { font-size: 0.7rem; color: #666; padding: 2px 4px; background: #eee; border-radius: 3px; }

        @keyframes ping-fade {
            0% { border-color: #2196F3; box-shadow: 0 0 10px rgba(33, 150, 243, 0.5); transform: scale(1.02); }
            100% { border-color: #f0f0f0; box-shadow: none; transform: scale(1); }
        }
        .mini-factor.pinging {
            animation: ping-fade 2s ease-out;
            border-width: 2px;
            z-index: 10;
        }
      `}</style>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          language={language}
          options={[
            {
              label: allRules[contextMenu.ruleIndex].disabled
                ? t.enableRule
                : t.disableRule,
              onClick: () => {
                const rule = allRules[contextMenu.ruleIndex];
                handleUpdateRule(contextMenu.ruleIndex, {
                  ...rule,
                  disabled: !rule.disabled,
                });
              },
            },
            { divider: true, label: "", onClick: () => {} },
            ...(availableTiers || []).map((tier) => ({
              label: `${t.moveTo} ${tier.label}`,
              onClick: () => handleMoveRule(contextMenu.ruleIndex, tier.key),
            })),
            { divider: true, label: "", onClick: () => {} },
            {
              label: t.deleteRuleLabel,
              onClick: () => handleDeleteRuleNoConfirm(contextMenu.ruleIndex),
              className: "delete-option",
            },
          ]}
        />
      )}

      {itemContextMenu && (
        <ContextMenu
          x={itemContextMenu.x}
          y={itemContextMenu.y}
          onClose={() => setItemContextMenu(null)}
          language={language}
          options={[
            {
              label:
                (allRules[itemContextMenu.ruleIndex].targetMatchModes?.[
                  itemContextMenu.itemName
                ] || "exact") === "exact"
                  ? language === "ch"
                    ? "切换为模糊匹配"
                    : "Switch to Partial Match"
                  : language === "ch"
                    ? "切换为精确匹配"
                    : "Switch to Exact Match",
              onClick: () =>
                toggleItemMatchMode(
                  itemContextMenu.ruleIndex,
                  itemContextMenu.itemName,
                ),
            },
          ]}
        />
      )}
    </div>
  );
};

export default RuleManager;
