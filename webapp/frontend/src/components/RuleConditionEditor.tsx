import React from "react";
import {
  RULE_FACTOR_LOCALIZATION,
  translations,
  CLASS_KEY_MAP,
} from "../utils/localization";
import type { Language } from "../utils/localization";
import { StableInput } from "./StableField";

interface Rule {
  targets: string[];
  targetMatchModes?: Record<string, "exact" | "partial">;
  conditions: Record<string, string>;
  overrides: Record<string, any>;
  comment?: string;
  raw?: string;
  disabled?: boolean;
  applyToTier?: boolean;
}

// A class name is emitted verbatim into the .filter, so it MUST be quoted: PoE
// splits an unquoted `Class Skill Gems` into two values, "Skill" and "Gems", which
// are OR'd - so the block silently matches far more than the picker showed. The
// picker used to store the bare name, producing exactly that.
//
// Stored form is `== "Skill Gems"`. classToken() reads a stored value back to the
// bare name so the dropdown still selects correctly for both the old unquoted data
// and the quoted form. Hand-typed values in the custom box are left ALONE - an
// unquoted partial like `Class "Gems"` (matches Skill Gems and Support Gems both)
// is a deliberate, useful idiom.
const classToken = (v: string): string =>
  (v || "").replace(/^\s*(==|!=)?\s*/, "").replace(/^"|"$/g, "").trim();
const asClassValue = (name: string): string => `== "${name}"`;

// Item classes offered by the class_picker condition. Used only here.
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

interface RuleConditionEditorProps {
  rule: Rule;
  globalIndex: number;
  language: Language;
  t: any;
  ruleTemplates: any[];
  relevantFactors: { recommended: any[]; others: any[] };
  localPing: { ruleIndex: number; conditionKey: string; timestamp: number } | null;
  updateCondition: (globalIndex: number, key: string, value: string) => void;
  addCondition: (globalIndex: number, key: string) => void;
}

// The conditions/factors grid of a rule editor: each active condition's
// editor (bool / select / text / class_picker / numeric / range) plus the
// "add condition" dropdown. Pure presentation + callbacks; all state lives in
// the parent RuleManager.
const RuleConditionEditor: React.FC<RuleConditionEditorProps> = ({
  rule,
  globalIndex,
  language,
  t,
  ruleTemplates,
  relevantFactors,
  localPing,
  updateCondition,
  addCondition,
}) => {
  return (
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
          const isMulti = tmp?.type === "multiselect";
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
                ) : isMulti ? (
                  // Space-separated list; the condition matches ANY of the picked
                  // values, so all-ticked reads as "any influence".
                  (() => {
                    const picked = (currentVal || "").trim().split(/\s+/).filter(Boolean);
                    const opts: string[] = tmp.options || [];
                    const toggle = (opt: string) => {
                      const next = picked.includes(opt)
                        ? picked.filter((p) => p !== opt)
                        : [...opts.filter((o) => picked.includes(o) || o === opt)];
                      updateCondition(globalIndex, key, next.join(" "));
                    };
                    const allOn = opts.every((o) => picked.includes(o));
                    return (
                      <div className="multi-picker">
                        <button
                          type="button"
                          className={`multi-chip multi-all ${allOn ? "on" : ""}`}
                          onClick={() =>
                            updateCondition(globalIndex, key, allOn ? "" : opts.join(" "))
                          }
                        >
                          {(translations[language] as any).selectAll || "All"}
                        </button>
                        {opts.map((opt) => {
                          const locKey = opt.replace(/ /g, "_");
                          // The influence names are already localized, keyed
                          // lowercase (shaper/elder/...) - reuse those rather
                          // than adding a second set of Chinese strings.
                          const locName =
                            (translations[language] as any)[opt] ||
                            (translations[language] as any)[locKey] ||
                            (translations[language] as any)[opt.toLowerCase()] ||
                            opt;
                          return (
                            <button
                              type="button"
                              key={opt}
                              className={`multi-chip ${picked.includes(opt) ? "on" : ""}`}
                              onClick={() => toggle(opt)}
                            >
                              {locName}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : isText ? (
                  <StableInput
                    value={currentVal}
                    placeholder={tmp.placeholder || ""}
                    onChange={(v) =>
                      updateCondition(globalIndex, key, v)
                    }
                  />
                ) : isClass ? (
                  <div className="class-picker-ui">
                    <select
                      value={
                        ITEM_CLASSES.includes(classToken(currentVal))
                          ? classToken(currentVal)
                          : "custom"
                      }
                      onChange={(e) =>
                        updateCondition(
                          globalIndex,
                          key,
                          e.target.value === "custom"
                            ? ""
                            : asClassValue(e.target.value),
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
                    {!ITEM_CLASSES.includes(classToken(currentVal)) && (
                      <StableInput
                        value={
                          currentVal === "custom" ? "" : currentVal
                        }
                        placeholder={
                          (translations[language] as any).search
                        }
                        onChange={(v) =>
                          updateCondition(globalIndex, key, v)
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
                        <StableInput
                          value={v1}
                          onChange={(v) =>
                            updateCondition(globalIndex, key, `${op1}${v}`)
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
                          <StableInput
                            value={v1}
                            onChange={(v) =>
                              updateCondition(
                                globalIndex,
                                key,
                                `RANGE ${op1} ${v} ${op2} ${v2}`,
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
                          <StableInput
                            value={v2}
                            onChange={(v) =>
                              updateCondition(
                                globalIndex,
                                key,
                                `RANGE ${op1} ${v1} ${op2} ${v}`,
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
  );
};

export default RuleConditionEditor;
