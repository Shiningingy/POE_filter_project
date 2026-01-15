import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "../utils/localization";
import { getSoundUrl } from "../utils/soundUtils";
import type { Language } from "../utils/localization";

interface StyleProps {
  FontSize?: number;
  TextColor?: string;
  BorderColor?: string;
  BackgroundColor?: string;
  PlayEffect?: string;
  MinimapIcon?: string;
  PlayAlertSound?: [string, number];
}

interface TierStyleEditorProps {
  tierName: string;
  style: StyleProps;
  visibility: boolean;
  onChange: (newStyle: StyleProps, newVisibility: boolean) => void;
  language: Language;
  onInspect: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onReset?: () => void;
  viewerBackground: string;
}

const TierStyleEditor: React.FC<TierStyleEditorProps> = ({
  // Component to edit tier styles
  tierName,
  style,
  visibility,
  onChange,
  language,
  onInspect,
  onCopy: _onCopy,
  onPaste: _onPaste,
  canPaste: _canPaste,
  onReset,
  viewerBackground,
}) => {
  const t = useTranslation(language);
  const [showAlphaPopup, setShowAlphaPopup] = useState(false);
  const [showSoundPopup, setShowSoundPopup] = useState(false);
  const [showIconPopup, setShowIconPopup] = useState(false);
  const [showBeamPopup, setShowBeamPopup] = useState(false);

  const [availableSounds, setAvailableSounds] = useState<{
    defaults: string[];
    sharket: string[];
  }>({ defaults: [], sharket: [] });
  const [soundSearch, setSoundSearch] = useState("");
  const [localAlphas, setLocalAlphas] = useState({
    TextColor: getAlpha(style.TextColor),
    BorderColor: getAlpha(style.BorderColor),
    BackgroundColor: getAlpha(style.BackgroundColor),
  });

  // Interface for sound state to avoid TS parsing issues
  interface TempSoundState {
    type: "default" | "sharket" | "custom";
    file: string;
    vol: number;
  }

  const [tempSound, setTempSound] = useState<TempSoundState>({ type: "default", file: "Default/AlertSound1.mp3", vol: 100 });

  const [tempIcon, setTempIcon] = useState({
    size: 0,
    color: "Red",
    shape: "Circle",
  });
  const [tempBeam, setTempBeam] = useState({ color: "Red", isTemp: false });

  const ICON_COLORS = [
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
  const ICON_SHAPES = [
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
  const BEAM_COLORS = [
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

  const getIconStyle = (color: string, shape: string, scale: number = 1) => {
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
      backgroundImage: `url('${import.meta.env.BASE_URL}/assets/Icon/MiniMapIcon_FullSpriteV2.png')`,
      backgroundPosition: `-${(colorIdx * stepX + offset) * scale}px -${
        (shapeIdx * stepY + offset) * scale
      }px`,
      backgroundSize: `${logicalWidth * scale}px auto`,
      backgroundRepeat: "no-repeat",
      display: "inline-block",
      flexShrink: 0,
      verticalAlign: "middle",
    };
  };

  useEffect(() => {
    if (showSoundPopup && availableSounds.defaults.length === 0) {
      axios
        .get("http://localhost:8000/api/sounds/list")
        .then((res) => setAvailableSounds(res.data))
        .catch((err) => console.error(err));
    }
  }, [showSoundPopup, availableSounds.defaults.length]);

  useEffect(() => {
    if (showSoundPopup) {
      const soundData = style.PlayAlertSound;
      const [file, vol] = Array.isArray(soundData)
        ? soundData
        : ["Default/AlertSound1.mp3", 100];
      let type: "default" | "sharket" | "custom" = "custom";
      if (file.startsWith("Default/")) type = "default";
      else if (file.startsWith("Sharket掉落音效/")) type = "sharket";
      setTempSound({ type, file, vol });
    }
    if (showIconPopup) {
      const iconStr = style.MinimapIcon || "0 Red Circle";
      const [s, c, sh] = iconStr.split(" ");
      setTempIcon({
        size: parseInt(s) || 0,
        color: c || "Red",
        shape: sh || "Circle",
      });
    }
    if (showBeamPopup) {
      const beamStr = style.PlayEffect || "Red";
      const parts = beamStr.split(" ");
      setTempBeam({ color: parts[0] || "Red", isTemp: parts.includes("Temp") });
    }
  }, [showSoundPopup, showIconPopup, showBeamPopup, style]);

  useEffect(() => {
    if (!showAlphaPopup) {
      setLocalAlphas({
        TextColor: getAlpha(style.TextColor),
        BorderColor: getAlpha(style.BorderColor),
        BackgroundColor: getAlpha(style.BackgroundColor),
      });
    }
  }, [style, showAlphaPopup]);

  const handleChange = (key: keyof StyleProps, value: any) => {
    onChange({ ...style, [key]: value }, visibility);
  };

  const applySound = () => {
    handleChange("PlayAlertSound", [tempSound.file, tempSound.vol]);
    setShowSoundPopup(false);
  };

  const applyIcon = () => {
    handleChange(
      "MinimapIcon",
      `${tempIcon.size} ${tempIcon.color} ${tempIcon.shape}`
    );
    setShowIconPopup(false);
  };

  const applyBeam = () => {
    handleChange(
      "PlayEffect",
      `${tempBeam.color}${tempBeam.isTemp ? " Temp" : ""}`
    );
    setShowBeamPopup(false);
  };

  const handleTestSound = () => {
    const url = getSoundUrl(tempSound.file);
    const audio = new Audio(url);
    audio.volume = Math.min(1, tempSound.vol / 300);
    audio.play().catch((err) => alert("Play failed: " + err.message));
  };

  const toggleVisibility = () => {
    onChange(style, !visibility);
  };

  const rgbaToHex = (rgba: string | null | undefined) => {
    if (!rgba) return "#000000";
    const clean = rgba.startsWith("disabled:") ? rgba.split(":")[1] : rgba;
    if (clean.startsWith("#")) return clean.substring(0, 7);
    return "#000000";
  };

  function getAlpha(rgba: string | null | undefined) {
    if (!rgba) return 255;
    const clean = rgba.startsWith("disabled:") ? rgba.split(":")[1] : rgba;
    if (clean.length >= 9) return parseInt(clean.substring(7, 9), 16);
    return 255;
  }

  const applyAlphas = () => {
    const nextStyle = { ...style };
    const keys: (keyof StyleProps)[] = [
      "TextColor",
      "BorderColor",
      "BackgroundColor",
    ];
    keys.forEach((key) => {
      const val =
        ((style as any)[key] as string) ||
        (key === "BackgroundColor" ? "#000000ff" : "#ffffffff");
      const clean = val.startsWith("disabled:") ? val.split(":")[1] : val;
      const base = clean.substring(0, 7);
      const aHex = localAlphas[key as keyof typeof localAlphas]
        .toString(16)
        .padStart(2, "0");
      const newVal = `${base}${aHex}`;
      (nextStyle as any)[key] = val.startsWith("disabled:")
        ? `disabled:${newVal}`
        : newVal;
    });
    onChange(nextStyle, visibility);
    setShowAlphaPopup(false);
  };

  const isColorActive = (color: string | null | undefined) => {
    return color && !color.startsWith("disabled:");
  };

  const hexToCssRgba = (hex: string | null | undefined, isActive: boolean) => {
    if (!hex || !isActive) return "transparent";
    const clean = hex.startsWith("disabled:") ? hex.split(":")[1] : hex;
    const r = parseInt(clean.substring(1, 3), 16);
    const g = parseInt(clean.substring(3, 5), 16);
    const b = parseInt(clean.substring(5, 7), 16);
    const a = clean.length >= 9 ? parseInt(clean.substring(7, 9), 16) / 255 : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  const toggleColor = (
    key: keyof StyleProps,
    currentValue: string | null | undefined
  ) => {
    if (!currentValue) {
      handleChange(key, key === "BackgroundColor" ? "#000000ff" : "#ffffffff");
    } else if (currentValue.startsWith("disabled:")) {
      handleChange(key, currentValue.split(":")[1]);
    } else {
      handleChange(key, `disabled:${currentValue}`);
    }
  };

  const hexToRgba = (hex: string, key: keyof StyleProps) => {
    const currentAlpha = getAlpha(style[key] as string)
      .toString(16)
      .padStart(2, "0");
    return `${hex}${currentAlpha}`;
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isActive = (val: any) =>
      val && (typeof val !== "string" || !val.startsWith("disabled:"));
    if (isActive(style.PlayAlertSound)) {
      const soundData = style.PlayAlertSound;
      const [soundFile, volume] = Array.isArray(soundData)
        ? soundData
        : [null, 0];
      if (soundFile) {
        const audio = new Audio(getSoundUrl(soundFile));
        audio.volume = Math.min(1, (volume as number) / 300);
        audio.play().catch((err) => console.error("Sound play failed:", err));
      }
    }
  };

  const toggleExtra = (key: keyof StyleProps) => {
    if (key === "PlayAlertSound") setShowSoundPopup(true);
    else if (key === "MinimapIcon") setShowIconPopup(true);
    else if (key === "PlayEffect") setShowBeamPopup(true);
  };

  const filteredSounds =
    tempSound.type === "default"
      ? availableSounds.defaults.filter((s) =>
          s.toLowerCase().includes(soundSearch.toLowerCase())
        )
      : availableSounds.sharket.filter((s) =>
          s.toLowerCase().includes(soundSearch.toLowerCase())
        );

  return (
    <div
      className={`VisualEditor_Container tier-style-editor ${
        visibility ? "hidden-tier" : ""
      }`}
      style={{
        backgroundImage: `url('${
          import.meta.env.BASE_URL
        }/assets/item_bg/${viewerBackground}')`,
      }}
      onClick={onInspect}
    >
      {/* Modals Section */}
      {showSoundPopup && (
        <div className="modal-overlay" onClick={() => setShowSoundPopup(false)}>
          <div className="sound-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>
                {t.sound} - {tierName}
              </h3>
              <button
                className="close-x"
                onClick={() => setShowSoundPopup(false)}
              >
                X
              </button>
            </div>
            <div className="sound-tabs">
              <button
                className={tempSound.type === "default" ? "active" : ""}
                onClick={() =>
                  setTempSound({
                    ...tempSound,
                    type: "default",
                    file: availableSounds.defaults[0],
                  })
                }
              >
                {t.default}
              </button>
              <button
                className={tempSound.type === "sharket" ? "active" : ""}
                onClick={() =>
                  setTempSound({
                    ...tempSound,
                    type: "sharket",
                    file: availableSounds.sharket[0],
                  })
                }
              >
                {t.sharket}
              </button>
              <button
                className={tempSound.type === "custom" ? "active" : ""}
                onClick={() => setTempSound({ ...tempSound, type: "custom" })}
              >
                {t.custom}
              </button>
            </div>
            <div className="sound-config">
              {tempSound.type !== "custom" ? (
                <>
                  <input
                    type="text"
                    className="sound-search"
                    placeholder={t.search}
                    value={soundSearch}
                    onChange={(e) => setSoundSearch(e.target.value)}
                  />
                  <div className="sound-list">
                    {filteredSounds.map((s) => (
                      <div
                        key={s}
                        className={`sound-item ${
                          tempSound.file === s ? "active" : ""
                        }`}
                        onClick={() => setTempSound({ ...tempSound, file: s })}
                      >
                        {s.split("/").pop()}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="custom-path-input">
                  <label>{t.filePath}</label>
                  <input
                    type="text"
                    value={tempSound.file}
                    onChange={(e) =>
                      setTempSound({ ...tempSound, file: e.target.value })
                    }
                    placeholder="C:\path\to\sound.mp3"
                  />
                </div>
              )}
              <div className="volume-control">
                <div className="volume-header">
                  <label>{t.volume}</label>
                  <input
                    type="number"
                    min="0"
                    max="600"
                    className="vol-num-input"
                    value={tempSound.vol}
                    onChange={(e) =>
                      setTempSound({
                        ...tempSound,
                        vol: Math.min(600, parseInt(e.target.value) || 0),
                      })
                    }
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="600"
                  value={tempSound.vol}
                  onChange={(e) =>
                    setTempSound({
                      ...tempSound,
                      vol: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="popup-footer">
              <button className="test-btn" onClick={handleTestSound}>
                {t.testSound} 🔊
              </button>
              <div className="main-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowSoundPopup(false)}
                >
                  {t.cancel}
                </button>
                <button className="ok-btn" onClick={applySound}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIconPopup && (
        <div className="modal-overlay" onClick={() => setShowIconPopup(false)}>
          <div className="sound-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>
                {t.icon} - {tierName}
              </h3>
              <button
                className="close-x"
                onClick={() => setShowIconPopup(false)}
              >
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
                      {s === 0 ? t.small : s === 1 ? t.medium : t.large}
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
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={getIconStyle(tempIcon.color, tempIcon.shape, 1)}
                  ></div>
                  <span>
                    {
                      (t as any)[
                        tempIcon.size === 0
                          ? "small"
                          : tempIcon.size === 1
                          ? "medium"
                          : "large"
                      ]
                    }{" "}
                    {(t as any)[tempIcon.color]}{" "}
                    {(t as any)[tempIcon.shape] || tempIcon.shape}
                  </span>
                </div>
              </div>
              <div className="main-actions">
                <button
                  className="reset-btn"
                  style={{ background: "#c62828" }}
                  onClick={() => {
                    handleChange("MinimapIcon", null);
                    setShowIconPopup(false);
                  }}
                >
                  {t.none}
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowIconPopup(false)}
                >
                  {t.cancel}
                </button>
                <button className="ok-btn" onClick={applyIcon}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBeamPopup && (
        <div className="modal-overlay" onClick={() => setShowBeamPopup(false)}>
          <div className="sound-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>
                {t.beam} - {tierName}
              </h3>
              <button
                className="close-x"
                onClick={() => setShowBeamPopup(false)}
              >
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
                {(t as any)[tempBeam.color]}{" "}
                {tempBeam.isTemp ? `(${t.temporary})` : `(${t.permanent})`}
              </div>
              <div className="main-actions">
                <button
                  className="reset-btn"
                  style={{ background: "#c62828" }}
                  onClick={() => {
                    handleChange("PlayEffect", null);
                    setShowBeamPopup(false);
                  }}
                >
                  {t.none}
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowBeamPopup(false)}
                >
                  {t.cancel}
                </button>
                <button className="ok-btn" onClick={applyBeam}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tier-header-bar">
        <h4 className="tier-title">{tierName}</h4>
        <div className="header-actions">
          <button
            className={`vis-btn ${visibility ? "is-hidden" : "is-shown"}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility();
            }}
          >
            {visibility ? t.hide : t.show}
          </button>
          {onReset && (
            <button
              className="reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
            >
              RESET
            </button>
          )}
        </div>
      </div>

      <div className="editor-layout">
        <div className="color-controls">
          {["TextColor", "BorderColor", "BackgroundColor"].map((key) => {
            const label =
              key === "TextColor"
                ? t.text
                : key === "BorderColor"
                ? t.border
                : t.background;
            const val = (style as any)[key];
            return (
              <div key={key} className="color-row">
                <span className="color-label">{label}</span>
                <input
                  type="color"
                  className={!isColorActive(val) ? "disabled-picker" : ""}
                  value={rgbaToHex(val)}
                  onChange={(e) =>
                    handleChange(
                      key as keyof StyleProps,
                      hexToRgba(e.target.value, key as keyof StyleProps)
                    )
                  }
                />
                <div
                  className={`status-check ${
                    isColorActive(val) ? "active" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleColor(key as keyof StyleProps, val);
                  }}
                >
                  {isColorActive(val) && "✓"}
                </div>
              </div>
            );
          })}
          <div className="alpha-bulk-container">
            <button
              className="alpha-bulk-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowAlphaPopup(!showAlphaPopup);
              }}
              title={t.transparency}
            >
              {t.transparency}
            </button>
            {showAlphaPopup && (
              <div className="alpha-popup" onClick={(e) => e.stopPropagation()}>
                <div className="alpha-popup-header">{t.transparency}</div>
                {["TextColor", "BorderColor", "BackgroundColor"].map((key) => (
                  <div key={key} className="alpha-input-row">
                    <label>
                      {key === "TextColor"
                        ? t.text
                        : key === "BorderColor"
                        ? t.border
                        : t.background}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={localAlphas[key as keyof typeof localAlphas]}
                      onChange={(e) =>
                        setLocalAlphas({
                          ...localAlphas,
                          [key]: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
                <button className="apply-alpha-btn" onClick={applyAlphas}>
                  OK
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="CombiBoxShowcaseDiv" onClick={handlePreviewClick}>
          <div
            className="item-plate"
            style={{
              fontSize: `${(style.FontSize || 32) / 1.8}px`,
              color: visibility
                ? "#555"
                : isColorActive(style.TextColor)
                ? hexToCssRgba(style.TextColor, true)
                : "#000000",
              borderColor: visibility
                ? "#333"
                : isColorActive(style.BorderColor)
                ? hexToCssRgba(style.BorderColor, true)
                : "transparent",
              backgroundColor: visibility
                ? "#1a1a1a"
                : isColorActive(style.BackgroundColor)
                ? hexToCssRgba(style.BackgroundColor, true)
                : "#000000",
              borderStyle: "solid",
              borderWidth: isColorActive(style.BorderColor) ? "1px" : "0",
              opacity: visibility ? 0.6 : 1,
            }}
          >
            {style.MinimapIcon && (
              <div
                style={getIconStyle(
                  style.MinimapIcon.split(" ")[1],
                  style.MinimapIcon.split(" ")[2],
                  0.8
                )}
              ></div>
            )}
            {tierName.toUpperCase()}
          </div>
        </div>

        <div className="right-controls">
          <div className="top-row">
            <div className="font-slider-container">
              <div className="slider-track"></div>
              <div
                className="slider-thumb-visual"
                style={{
                  left: `${(((style.FontSize || 32) - 12) / (45 - 12)) * 100}%`,
                }}
              >
                {style.FontSize || 32}
              </div>
              <input
                type="range"
                min="12"
                max="45"
                className="real-range-input"
                value={style.FontSize || 32}
                onChange={(e) =>
                  handleChange("FontSize", parseInt(e.target.value))
                }
              />
            </div>
            <div className="action-btns" style={{ display: "none" }}>
              {/* Copy/Paste buttons removed */}
            </div>
          </div>
          <div className="bottom-row extra-btns">
            <button
              className={`extra-toggle-btn ${
                style.PlayAlertSound ? "active" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExtra("PlayAlertSound");
              }}
            >
              {t.sound}
            </button>
            <button
              className={`extra-toggle-btn ${
                style.MinimapIcon ? "active" : ""
              }`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleExtra("MinimapIcon");
              }}
            >
              {style.MinimapIcon && (
                <div
                  style={getIconStyle(
                    style.MinimapIcon.split(" ")[1],
                    style.MinimapIcon.split(" ")[2],
                    0.6
                  )}
                ></div>
              )}
              {t.icon}
            </button>
            <button
              className={`extra-toggle-btn ${style.PlayEffect ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleExtra("PlayEffect");
              }}
            >
              {style.PlayEffect && (
                <div
                  className={`beam-icon-mini ${
                    style.PlayEffect.includes("Temp") ? "is-temp" : ""
                  }`}
                  style={{
                    color: style.PlayEffect.split(" ")[0].toLowerCase(),
                  }}
                ></div>
              )}
              {t.beam}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .VisualEditor_Container { width: 100%; position: relative; border: 1px solid #61523e; border-radius: 1px; display: block; z-index: 5; background-color: #1e1e1e; background-repeat: no-repeat; background-position: top center; background-size: cover; margin-bottom: 15px; cursor: pointer; }
        .tier-header-bar { background: rgba(37, 37, 37, 0.8); padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; }
        .tier-title { margin: 0; font-size: 0.95rem; font-weight: bold; text-transform: uppercase; color: #aaa; }
        .vis-btn { background: #333; color: #fff; border: 1px solid #444; padding: 4px 12px; border-radius: 2px; cursor: pointer; font-size: 0.75rem; }
        .vis-btn.is-shown { color: #4CAF50; border-color: #2e7d32; }
        .vis-btn.is-hidden { color: #f44336; border-color: #c62828; }
        .reset-btn { background: #1a237e; color: #fff; border: none; padding: 4px 12px; border-radius: 2px; cursor: pointer; font-size: 0.75rem; }
        .editor-layout { display: flex; padding: 15px 20px; align-items: center; justify-content: space-between; min-height: 120px; background: rgba(0,0,0,0.4); }
        .color-controls { display: flex; flex-direction: column; gap: 6px; width: 130px; }
        .color-row { display: flex; align-items: center; gap: 8px; }
        .color-label { font-size: 0.75rem; font-weight: bold; color: #888; width: 40px; text-align: left; }
        .color-controls input[type="color"] { background: none; border: 1px solid #444; width: 40px; height: 24px; cursor: pointer; padding: 0; transition: opacity 0.2s; }
        .disabled-picker { opacity: 0.3; pointer-events: none; }
        .alpha-bulk-container { position: relative; margin-top: 10px; display: flex; justify-content: flex-start; }
        .alpha-bulk-btn { height: 24px; background: #e0e0e0; color: #222; border: 1px solid #ccc; border-radius: 2px; font-size: 11px; cursor: pointer; font-weight: bold; padding: 0 12px; text-transform: uppercase; transition: background 0.2s; }
        .alpha-bulk-btn:hover { background: #fff; }
        .alpha-popup { position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid #2196F3; padding: 12px; border-radius: 4px; z-index: 100; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-top: 5px; min-width: 160px; color: #222; }
        .alpha-popup-header { font-size: 11px; font-weight: bold; color: #2196F3; text-transform: uppercase; margin-bottom: 2px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .alpha-input-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .alpha-input-row label { font-size: 11px; color: #666; flex: 1; }
        .alpha-input-row input { width: 50px; background: #fff; color: #222; border: 1px solid #ddd; padding: 3px; font-size: 12px; text-align: center; border-radius: 2px; }
        .apply-alpha-btn { background: #2196F3; color: #fff !important; border: none; padding: 6px; cursor: pointer; font-size: 11px; border-radius: 2px; font-weight: bold; margin-top: 5px; }
        
        .status-check { width: 22px; height: 22px; border: 1px solid #444; background: #222; color: #4CAF50; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; border-radius: 50%; }
        .status-check.active { border-color: #4CAF50; box-shadow: 0 0 5px rgba(76, 175, 80, 0.3); }
        .CombiBoxShowcaseDiv { width: 360px; height: 80px; display: flex; align-items: center; justify-content: center; background: transparent; position: relative; }
        .item-plate { font-family: Verdana, sans-serif; box-shadow: 0 0 10px rgba(0,0,0,0.5); white-space: nowrap; transition: all 0.2s; text-align: center; padding: 8px 30px; position: relative; z-index: 10; display: flex; align-items: center; gap: 10px; font-weight: bold; }
        
        .right-controls { display: flex; flex-direction: column; gap: 12px; width: 260px; align-items: stretch; }
        .top-row { display: flex; flex-direction: column; gap: 10px; }
        .font-slider-container { position: relative; width: 100%; height: 36px; display: flex; align-items: center; background: rgba(0,0,0,0.2); border-radius: 2px; padding: 0 12px; box-sizing: border-box; }
        .slider-track { width: 100%; height: 2px; background: #444; border-radius: 1px; }
        .slider-thumb-visual { position: absolute; width: 32px; height: 20px; background: #1a237e; border: 1px solid #3949ab; color: #fff; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; pointer-events: none; transform: translate(-50%, 0); z-index: 2; box-shadow: 0 0 5px rgba(0,0,0,0.5); border-radius: 2px; top: 8px; }
        .real-range-input { position: absolute; left: 12px; right: 12px; width: calc(100% - 24px); opacity: 0; cursor: pointer; z-index: 3; margin: 0; height: 100%; }
        .action-btns { display: flex; gap: 6px; }
        .style-btn { flex: 1; padding: 6px; font-size: 0.8rem; background: #eee; color: #222 !important; border: 1px solid #ccc; cursor: pointer; font-weight: bold; border-radius: 2px; }
        .style-btn:hover { background: #fff; }
        .style-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .extra-btns { display: flex; gap: 6px; }
        .extra-toggle-btn { flex: 1; padding: 8px 4px; font-size: 0.8rem; background: #eee; color: #222 !important; border: 1px solid #ccc; cursor: pointer; text-transform: uppercase; font-weight: bold; border-radius: 2px; }
        .extra-toggle-btn.active { background: #2196F3; color: white !important; border-color: #2196F3; box-shadow: inset 0 0 5px rgba(0,0,0,0.2); }
        .extra-toggle-btn:hover:not(.active) { background: #fff; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .sound-popup { background: #fff; border: 1px solid #ddd; width: 450px; padding: 20px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 15px; cursor: default; color: #222; }
        .popup-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .popup-header h3 { margin: 0; color: #2196F3; font-size: 1rem; }
        .close-x { background: none; border: none; color: #222 !important; cursor: pointer; font-size: 1.2rem; }
        .sound-tabs { display: flex; gap: 5px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .sound-tabs button { flex: 1; padding: 8px; font-size: 0.8rem; background: #f5f5f5; color: #222 !important; border: 1px solid #ddd; border-radius: 4px; font-weight: bold; }
        .sound-tabs button.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .sound-config { display: flex; flex-direction: column; gap: 12px; }
        .sound-search { width: 100%; background: #fff; border: 1px solid #ddd; padding: 8px; color: #222 !important; border-radius: 4px; font-size: 0.85rem; }
        .sound-list { height: 200px; overflow-y: auto; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px; padding: 5px; }
        .sound-item { padding: 6px 10px; cursor: pointer; font-size: 0.8rem; color: #222 !important; border-radius: 2px; }
        .sound-item:hover { background: #e3f2fd; }
        .sound-item.active { background: #2196F3; color: white !important; font-weight: bold; }
        .custom-path-input { display: flex; flex-direction: column; gap: 8px; }
        .custom-path-input label { font-size: 0.8rem; color: #222; font-weight: bold; }
        .custom-path-input input { background: #fff; border: 1px solid #ddd; padding: 8px; color: #222 !important; border-radius: 4px; font-size: 0.85rem; }
        .volume-control { display: flex; flex-direction: column; gap: 8px; }
        .volume-header { display: flex; justify-content: space-between; align-items: center; }
        .volume-header label { font-size: 0.8rem; color: #222; font-weight: bold; }
        .vol-num-input { width: 60px; background: #fff; border: 1px solid #ddd; color: #222 !important; padding: 4px; border-radius: 2px; font-size: 12px; text-align: center; }
        .volume-control input[type="range"] { width: 100%; cursor: pointer; }
        .popup-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 15px; border-top: 1px solid #eee; }
        .test-btn { background: #455a64; color: white !important; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .main-actions { display: flex; gap: 10px; }
        .ok-btn { background: #4CAF50; color: white !important; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .cancel-btn { background: none; border: 1px solid #ddd; color: #222 !important; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
        .icon-config { display: flex; flex-direction: column; gap: 15px; }
        .config-section { display: flex; flex-direction: column; gap: 8px; }
        .config-section label { font-size: 0.85rem; color: #222; font-weight: bold; }
        .option-grid { display: flex; flex-wrap: wrap; gap: 5px; }
        .option-grid button { background: #f5f5f5; border: 1px solid #ddd; color: #222 !important; padding: 5px 10px; font-size: 0.75rem; border-radius: 2px; min-width: 35px; font-weight: bold; }
        .option-grid button:hover { background: #eee; border-color: #ccc; }
        .option-grid button.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .color-grid button { border-left-width: 4px; }
        .icon-grid button { flex: 0 0 calc(16.66% - 5px); display: flex; align-items: center; justify-content: center; padding: 8px 0; background: #fcfcfc; }
        .size-grid button { flex: 1; }
        .toggle-box { display: flex; gap: 5px; }
        .toggle-box button { flex: 1; padding: 10px; background: #f5f5f5; border: 1px solid #ddd; color: #222 !important; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .toggle-box button.active { background: #2196F3; color: white !important; border-color: #2196F3; }
        .preview-indicator { font-size: 0.85rem; color: #2196F3; font-weight: bold; background: #f5f5f5; padding: 5px 15px; border-radius: 20px; border: 1px solid #ddd; }
        .visual-beam { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 40px; height: 100%; z-index: 1; pointer-events: none; filter: blur(8px); background: linear-gradient(to top, transparent, var(--beam-color), transparent); }
        .visual-beam.is-temp { background: repeating-linear-gradient(to top, transparent, transparent 10px, var(--beam-color) 10px, var(--beam-color) 20px); }
        .beam-icon-mini { width: 4px; height: 14px; border-radius: 2px; background: currentColor; box-shadow: 0 0 5px currentColor; }
        .beam-icon-mini.is-temp { background: repeating-linear-gradient(to bottom, currentColor, currentColor 3px, transparent 3px, transparent 6px); }
      `}</style>
    </div>
  );
};

export default TierStyleEditor;
