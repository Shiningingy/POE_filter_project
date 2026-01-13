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
