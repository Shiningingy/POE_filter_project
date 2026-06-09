import React, { useState, useEffect } from "react";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";
import { getAssetUrl } from "../utils/assetUtils";

interface MinimapIconPickerProps {
  /** Current MinimapIcon string, e.g. "0 Red Circle". */
  value?: string | null;
  /** Optional heading suffix (e.g. tier or rule name). */
  title?: string;
  language: Language;
  /** Called with the new "size color shape" string, or null to clear. */
  onConfirm: (value: string | null) => void;
  onClose: () => void;
}

export const ICON_COLORS = [
  "Blue",
  "Green",
  "Brown",
  "Red",
  "White",
  "Yellow",
  "Cyan",
  "Grey",
  "Orange",
  "Pink",
  "Purple",
];

export const ICON_SHAPES = [
  "Circle",
  "Diamond",
  "Hexagon",
  "Square",
  "Star",
  "Triangle",
  "Cross",
  "Moon",
  "Raindrop",
  "Kite",
  "Pentagon",
  "UpsideDownHouse",
];

/** Localize a stored "size color shape" MinimapIcon string for display. */
export const formatMinimapIcon = (value: string, t: any): string => {
  const [size, color, shape] = value.split(" ");
  const sizeKey = size === "0" ? "small" : size === "1" ? "medium" : "large";
  return [t[sizeKey], t[color] || color, t[shape] || shape]
    .filter(Boolean)
    .join(" ");
};

/** Build the sprite-sheet background style for a given icon color + shape. */
export const getIconStyle = (
  color: string,
  shape: string,
  scale: number = 1,
): React.CSSProperties => {
  const shapeIdx = ICON_SHAPES.indexOf(shape);
  const colorIdx = ICON_COLORS.indexOf(color);
  if (shapeIdx === -1 || colorIdx === -1) return {};
  const baseSize = 26;
  const logicalWidth = 969.8;
  const stepX = 85.2;
  const stepY = 28.45;
  const offset = 2;
  return {
    width: `${baseSize * scale}px`,
    height: `${baseSize * scale}px`,
    backgroundImage: `url('${getAssetUrl("assets/Icon/MiniMapIcon_FullSpriteV2.png")}')`,
    backgroundPosition: `-${(colorIdx * stepX + offset) * scale}px -${(shapeIdx * stepY + offset) * scale}px`,
    backgroundSize: `${logicalWidth * scale}px auto`,
    backgroundRepeat: "no-repeat",
    display: "inline-block",
    flexShrink: 0,
    verticalAlign: "middle",
  };
};

const MinimapIconPicker: React.FC<MinimapIconPickerProps> = ({
  value,
  title,
  language,
  onConfirm,
  onClose,
}) => {
  const t = useTranslation(language);
  const [tempIcon, setTempIcon] = useState({
    size: 0,
    color: "Red",
    shape: "Circle",
  });

  useEffect(() => {
    if (value) {
      const [size, color, shape] = value.split(" ");
      setTempIcon({
        size: parseInt(size) || 0,
        color: color || "Red",
        shape: shape || "Circle",
      });
    }
  }, [value]);

  const sizeLabel = (s: number) =>
    s === 0 ? t.small : s === 1 ? t.medium : t.large;

  return (
    <div className="mm-icon-picker modal-overlay" onClick={onClose}>
      <div className="picker-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h3>
            {t.icon}
            {title ? ` - ${title}` : ""}
          </h3>
          <button className="close-x" onClick={onClose}>
            X
          </button>
        </div>
        <div className="icon-config">
          <div className="config-section">
            <label>{t.size}</label>
            <div className="option-grid size-grid">
              {[0, 1, 2].map((s) => (
                <button
                  key={s}
                  className={tempIcon.size === s ? "active" : ""}
                  onClick={() => setTempIcon({ ...tempIcon, size: s })}
                >
                  {sizeLabel(s)}
                </button>
              ))}
            </div>
          </div>
          <div className="config-section">
            <label>{t.color}</label>
            <div className="option-grid color-grid">
              {ICON_COLORS.map((c) => (
                <button
                  key={c}
                  className={tempIcon.color === c ? "active" : ""}
                  style={{ borderColor: c.toLowerCase() }}
                  onClick={() => setTempIcon({ ...tempIcon, color: c })}
                >
                  {(t as any)[c] || c}
                </button>
              ))}
            </div>
          </div>
          <div className="config-section">
            <label>{t.shape}</label>
            <div className="option-grid icon-grid">
              {ICON_SHAPES.map((sh) => (
                <button
                  key={sh}
                  className={tempIcon.shape === sh ? "active" : ""}
                  onClick={() => setTempIcon({ ...tempIcon, shape: sh })}
                  title={sh}
                >
                  <div style={getIconStyle(tempIcon.color, sh, 1.2)}></div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="popup-footer">
          <div className="preview-indicator">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={getIconStyle(tempIcon.color, tempIcon.shape, 1)}></div>
              <span>
                {sizeLabel(tempIcon.size)} {(t as any)[tempIcon.color]}{" "}
                {(t as any)[tempIcon.shape] || tempIcon.shape}
              </span>
            </div>
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
                  `${tempIcon.size} ${tempIcon.color} ${tempIcon.shape}`,
                )
              }
            >
              {t.ok}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .mm-icon-picker.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .mm-icon-picker .picker-popup { background: #fff; border: 1px solid #ddd; width: 450px; max-height: 90vh; overflow-y: auto; padding: 20px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 15px; cursor: default; color: #222; }
        .mm-icon-picker .popup-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .mm-icon-picker .popup-header h3 { margin: 0; color: #2196F3; font-size: 1rem; }
        .mm-icon-picker .close-x { background: none; border: none; color: #222 !important; cursor: pointer; font-size: 1.2rem; }
        .mm-icon-picker .icon-config { display: flex; flex-direction: column; gap: 15px; }
        .mm-icon-picker .config-section { display: flex; flex-direction: column; gap: 8px; }
        .mm-icon-picker .config-section label { font-size: 0.85rem; color: #222; font-weight: bold; }
        .mm-icon-picker .option-grid { display: flex; flex-wrap: wrap; gap: 5px; }
        .mm-icon-picker .option-grid button { background: #f5f5f5; border: 1px solid #ddd; color: #222 !important; padding: 5px 10px; font-size: 0.75rem; border-radius: 2px; min-width: 35px; font-weight: bold; cursor: pointer; }
        .mm-icon-picker .option-grid button:hover { background: #eee; border-color: #ccc; }
        .mm-icon-picker .option-grid button.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .mm-icon-picker .color-grid button { border-left-width: 4px; }
        .mm-icon-picker .icon-grid button { flex: 0 0 calc(16.66% - 5px); display: flex; align-items: center; justify-content: center; padding: 8px 0; background: #fcfcfc; }
        .mm-icon-picker .size-grid button { flex: 1; }
        .mm-icon-picker .popup-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 15px; border-top: 1px solid #eee; gap: 12px; flex-wrap: wrap; }
        .mm-icon-picker .preview-indicator { font-size: 0.85rem; color: #2196F3; font-weight: bold; background: #f5f5f5; padding: 5px 15px; border-radius: 20px; border: 1px solid #ddd; }
        .mm-icon-picker .main-actions { display: flex; gap: 12px; justify-content: flex-end; }
        .mm-icon-picker .ok-btn { background: #2196F3; color: #fff !important; border: none; padding: 8px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .mm-icon-picker .ok-btn:hover { background: #1976D2; }
        .mm-icon-picker .cancel-btn { background: #eee; color: #222 !important; border: 1px solid #ddd; padding: 8px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .mm-icon-picker .reset-btn { color: #fff !important; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default MinimapIconPicker;
