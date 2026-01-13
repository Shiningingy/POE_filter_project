// webapp/frontend/src/utils/styleResolver.ts

interface StyleProps {
  FontSize?: number;
  TextColor?: string;
  BorderColor?: string;
  BackgroundColor?: string;
  PlayEffect?: string;
  MinimapIcon?: string;
  PlayAlertSound?: [string, number];
  [key: string]: any;
}

export const resolveStyle = (tierData: any, themeData: any): StyleProps => {
  const localTheme = tierData.theme || {};
  let resolved: StyleProps = {};

  // 1. Check if it references a global tier
  if (localTheme.Tier !== undefined) {
    const tierKey = `Tier ${localTheme.Tier}`;
    // Assuming 'currency' category for now, this logic might need to be smarter
    // if themes are categorized differently.
    const globalStyle = themeData.currency?.[tierKey] || {}; 
    resolved = { ...globalStyle };
  }

  // 2. Merge local overrides
  // We merge everything from localTheme except 'Tier'
  const { Tier, ...overrides } = localTheme;
  resolved = { ...resolved, ...overrides };

  return resolved;
};

export const generateFilterText = (style: StyleProps, tierName: string, baseTypes: string[] = ["Item Name"]): string => {
  const lines = [`# ${tierName}`];
  lines.push('Show');
  lines.push(`    BaseType "${baseTypes.join('" "')}"`);
  
  if (style.FontSize) lines.push(`    SetFontSize ${style.FontSize}`);
  
  const toRgb = (hex?: string) => {
    if (!hex || !hex.startsWith('#')) return "255 255 255";
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return `${r} ${g} ${b}`;
  };

  if (style.TextColor) lines.push(`    SetTextColor ${toRgb(style.TextColor)}`);
  if (style.BorderColor) lines.push(`    SetBorderColor ${toRgb(style.BorderColor)}`);
  if (style.BackgroundColor) lines.push(`    SetBackgroundColor ${toRgb(style.BackgroundColor)}`);
  
  if (style.PlayEffect) lines.push(`    PlayEffect ${style.PlayEffect}`);
  if (style.MinimapIcon) lines.push(`    MinimapIcon 0 ${style.MinimapIcon}`);
  
  if (style.PlayAlertSound) {
    const [file, vol] = style.PlayAlertSound;
    lines.push(`    CustomAlertSound "${file}" ${vol}`);
  }

  return lines.join('\n');
};
