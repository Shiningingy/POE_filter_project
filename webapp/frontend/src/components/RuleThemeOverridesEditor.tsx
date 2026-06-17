import React from "react";
import { getIconStyle, formatMinimapIcon } from "./MinimapIconPicker";
import { formatPlayEffect } from "./PlayEffectPicker";

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

interface RuleThemeOverridesEditorProps {
  rule: Rule;
  globalIndex: number;
  t: any;
  handleUpdateRule: (globalIndex: number, updatedRule: Rule) => void;
  setStylePicker: (
    v: { index: number; type: "sound" | "icon" | "effect" } | null,
  ) => void;
}

// The per-rule style overrides grid: text/background/border colours, font size,
// and the sound / minimap-icon / drop-effect picker tiles. Pure presentation +
// callbacks; all state lives in the parent RuleManager.
const RuleThemeOverridesEditor: React.FC<RuleThemeOverridesEditorProps> = ({
  rule,
  globalIndex,
  t,
  handleUpdateRule,
  setStylePicker,
}) => {
  return (
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
  );
};

export default RuleThemeOverridesEditor;
