export const getAssetUrl = (path: string) => {
  const rawBase = import.meta.env.BASE_URL;
  const baseUrl = rawBase.endsWith('/') ? rawBase : rawBase + '/';
  
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${baseUrl}${cleanPath}`;
};
