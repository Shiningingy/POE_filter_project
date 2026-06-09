import React, { useState, useEffect } from "react";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";

interface PlayEffectPickerProps {
  /** Current PlayEffect string, e.g. "Red" or "Red Temp". */
  value?: string | null;
  /** Optional heading suffix (e.g. tier or rule name). */
  title?: string;
  language: Language;
  /** Called with the new "color [Temp]" string, or null to clear. */
  onConfirm: (value: string | null) => void;
  onClose: () => void;
}

export const BEAM_COLORS = [
  "Red",
  "Green",
  "Blue",
  "Brown",
  "White",
  "Yellow",
  "Cyan",
  "Grey",
  "Orange",
  "Pink",
  "Purple",
];

/** Localize a stored "color [Temp]" PlayEffect string for display. */
export const formatPlayEffect = (value: string, t: any): string => {
  const [color, temp] = value.split(" ");
  const colorLabel = t[color] || color;
  return temp === "Temp" ? `${colorLabel} (${t.temporary})` : colorLabel;
};

const PlayEffectPicker: React.FC<PlayEffectPickerProps> = ({
  value,
  title,
  language,
  onConfirm,
  onClose,
}) => {
  const t = useTranslation(language);
  const [tempBeam, setTempBeam] = useState({ color: "Red", isTemp: false });

  useEffect(() => {
    if (value) {
      const [color, temp] = value.split(" ");
      setTempBeam({ color: color || "Red", isTemp: temp === "Temp" });
    }
  }, [value]);

  return (
    <div className="play-effect-picker modal-overlay" onClick={onClose}>
      <div className="picker-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h3>
            {t.beam}
            {title ? ` - ${title}` : ""}
          </h3>
          <button className="close-x" onClick={onClose}>
            X
          </button>
        </div>
        <div className="icon-config">
          <div className="config-section">
            <label>{t.color}</label>
            <div className="option-grid color-grid">
              {BEAM_COLORS.map((c) => (
                <button
                  key={c}
                  className={tempBeam.color === c ? "active" : ""}
                  style={{ borderColor: c.toLowerCase() }}
                  onClick={() => setTempBeam({ ...tempBeam, color: c })}
                >
                  {(t as any)[c] || c}
                </button>
              ))}
            </div>
          </div>
          <div className="config-section">
            <label>{t.temporary}</label>
            <div className="toggle-box">
              <button
                className={!tempBeam.isTemp ? "active" : ""}
                onClick={() => setTempBeam({ ...tempBeam, isTemp: false })}
              >
                {t.permanent}
              </button>
              <button
                className={tempBeam.isTemp ? "active" : ""}
                onClick={() => setTempBeam({ ...tempBeam, isTemp: true })}
              >
                {t.temporary}
              </button>
            </div>
          </div>
        </div>
        <div className="popup-footer">
          <div className="preview-indicator">
            {(t as any)[tempBeam.color] || tempBeam.color}{" "}
            {tempBeam.isTemp ? `(${t.temporary})` : `(${t.permanent})`}
          </div>
          <div className="main-actions">
            <button
              className="reset-btn"
              style={{ background: "#c62828" }}
              onClick={() => onConfirm(null)}
            >
              {t.none}
            </button>
            <button className="cancel-btn" onClick={onClose}>
              {t.cancel}
            </button>
            <button
              className="ok-btn"
              onClick={() =>
                onConfirm(
                  `${tempBeam.color}${tempBeam.isTemp ? " Temp" : ""}`,
                )
              }
            >
              {t.ok}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .play-effect-picker.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .play-effect-picker .picker-popup { background: #fff; border: 1px solid #ddd; width: 450px; max-height: 90vh; overflow-y: auto; padding: 20px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 15px; cursor: default; color: #222; }
        .play-effect-picker .popup-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .play-effect-picker .popup-header h3 { margin: 0; color: #2196F3; font-size: 1rem; }
        .play-effect-picker .close-x { background: none; border: none; color: #222 !important; cursor: pointer; font-size: 1.2rem; }
        .play-effect-picker .icon-config { display: flex; flex-direction: column; gap: 15px; }
        .play-effect-picker .config-section { display: flex; flex-direction: column; gap: 8px; }
        .play-effect-picker .config-section label { font-size: 0.85rem; color: #222; font-weight: bold; }
        .play-effect-picker .option-grid { display: flex; flex-wrap: wrap; gap: 5px; }
        .play-effect-picker .option-grid button { background: #f5f5f5; border: 1px solid #ddd; color: #222 !important; padding: 5px 10px; font-size: 0.75rem; border-radius: 2px; min-width: 35px; font-weight: bold; cursor: pointer; }
        .play-effect-picker .option-grid button:hover { background: #eee; border-color: #ccc; }
        .play-effect-picker .option-grid button.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .play-effect-picker .color-grid button { border-left-width: 4px; }
        .play-effect-picker .toggle-box { display: flex; gap: 5px; }
        .play-effect-picker .toggle-box button { flex: 1; padding: 10px; background: #f5f5f5; border: 1px solid #ddd; color: #222 !important; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .play-effect-picker .toggle-box button.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .play-effect-picker .popup-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 15px; border-top: 1px solid #eee; gap: 12px; flex-wrap: wrap; }
        .play-effect-picker .preview-indicator { font-size: 0.85rem; color: #2196F3; font-weight: bold; background: #f5f5f5; padding: 5px 15px; border-radius: 20px; border: 1px solid #ddd; }
        .play-effect-picker .main-actions { display: flex; gap: 12px; justify-content: flex-end; }
        .play-effect-picker .ok-btn { background: #2196F3; color: #fff !important; border: none; padding: 8px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .play-effect-picker .ok-btn:hover { background: #1976D2; }
        .play-effect-picker .cancel-btn { background: #eee; color: #222 !important; border: 1px solid #ddd; padding: 8px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .play-effect-picker .reset-btn { color: #fff !important; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default PlayEffectPicker;
