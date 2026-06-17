import React from "react";
import type { Language } from "../utils/localization";
import ItemCard from "./ItemCard";

interface Item {
  name: string;
  name_ch?: string;
  source: string;
  [key: string]: any;
}

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

interface RuleTargetManagerProps {
  rule: Rule;
  globalIndex: number;
  availableItems: Item[];
  translationCache: Record<string, string>;
  language: Language;
  t: any;
  targetSearch: string;
  suggestions: any[];
  setTargetSearch: (s: string) => void;
  removeTarget: (globalIndex: number, itemName: string) => void;
  addTarget: (globalIndex: number, itemName: string) => void;
  handleItemRightClick: (
    e: React.MouseEvent,
    globalIndex: number,
    itemName: string,
  ) => void;
  onRegisterTranslation?: (name: string, name_ch?: string) => void;
}

// The per-rule explicit-target picker: the chips of currently-targeted items
// (each with delete / right-click match-mode / play-sound) plus the search box
// with live suggestions. Pure presentation + callbacks; all state lives in the
// parent RuleManager. Rendered only when the rule is NOT apply-to-tier.
const RuleTargetManager: React.FC<RuleTargetManagerProps> = ({
  rule,
  globalIndex,
  availableItems,
  translationCache,
  language,
  t,
  targetSearch,
  suggestions,
  setTargetSearch,
  removeTarget,
  addTarget,
  handleItemRightClick,
  onRegisterTranslation,
}) => {
  return (
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
  );
};

export default RuleTargetManager;
