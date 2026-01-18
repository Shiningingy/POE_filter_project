export const getSoundUrl = (filePath: string) => {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  // Ensure baseURL ends with /
  const rawBase = import.meta.env.BASE_URL;
  const baseUrl = rawBase.endsWith('/') ? rawBase : rawBase + '/';

  if (!filePath) return "";

  if (isDemo) {
    // In demo mode, use the static files we generated in public/demo_data/sounds
    return `${baseUrl}demo_data/sounds/${filePath}`;
  }
  
  // In development mode, use proxy for all files to ensure correct path/encoding resolution on backend
  if (filePath.startsWith('Default/') || filePath.startsWith('Sharket')) {
      return `/api/sounds/proxy?path=${encodeURIComponent(filePath)}`;
  } else {
      // Custom absolute path on user's disk
      return `/api/sounds/proxy?path=${encodeURIComponent(filePath)}`;
  }
};
