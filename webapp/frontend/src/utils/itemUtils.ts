export const getSubTypeBackground = (st?: string) => {
  switch (st) {
    case "Armour":
      return "#ff4444";
    case "Evasion Rating":
      return "#44ff44";
    case "Energy Shield":
      return "#4444ff";
    case "Evasion / Armour":
      return "linear-gradient(90deg, #44ff44 0%, #44ff44 50%, #ff4444 50%, #ff4444 100%)";
    case "Armour / ES":
      return "linear-gradient(90deg, #ff4444 0%, #ff4444 50%, #4444ff 50%, #4444ff 100%)";
    case "ES / Evasion":
      return "linear-gradient(90deg, #4444ff 0%, #4444ff 50%, #44ff44 50%, #44ff44 100%)";
    case "Armour / Evasion / ES":
      return "conic-gradient(#ff4444 0deg 120deg, #44ff44 120deg 240deg, #4444ff 240deg 360deg)";
    default:
      return null;
  }
};
