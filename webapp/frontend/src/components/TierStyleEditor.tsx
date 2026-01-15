import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "../utils/localization";
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

  const [tempSound, setTempSound] = useState<{ 
    type: "default" | "sharket" | "custom";
    file: string;
    vol: number;
  }>({ type: "default", file: "Default/AlertSound1.mp3", vol: 100 });

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
      backgroundImage: `url('/assets/Icon/MiniMapIcon_FullSpriteV2.png')`,
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
    const url =
      tempSound.type === "custom"
        ? `http://localhost:8000/api/sounds/proxy?path=${encodeURIComponent(
            tempSound.file
          )}`
        : `http://localhost:8000/sounds/${tempSound.file}`;
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
        (style[key] as string) ||
        (key === "BackgroundColor" ? "#000000ff" : "#ffffffff");
      const clean = val.startsWith("disabled:") ? val.split(":")[1] : val;
      const base = clean.substring(0, 7);
      const aHex = localAlphas[key as keyof typeof localAlphas]
        .toString(16)
        .padStart(2, "0");
      const newVal = `${base}${aHex}`;
      nextStyle[key] = val.startsWith("disabled:")
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
        const audio = new Audio(`http://localhost:8000/sounds/${soundFile}`);
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
      style={{ backgroundImage: `url('/assets/item_bg/${viewerBackground}')` }}
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
                    placeholder="C:\\path\\to\\sound.mp3"
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
                    }{