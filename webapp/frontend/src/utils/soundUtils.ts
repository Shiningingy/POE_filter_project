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
  
  // In development mode, check if it's a known folder or a custom absolute path
  if (filePath.startsWith('Default/') || filePath.startsWith('Sharket')) {
      // Served statically by the FastAPI backend
      return `http://localhost:8000/sounds/${filePath}`;
  } else {
      // Custom absolute path on user's disk, served via proxy
      return `http://localhost:8000/api/sounds/proxy?path=${encodeURIComponent(filePath)}`;
  }
};
