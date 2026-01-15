import axios from 'axios';

export const setupDemoAdapter = () => {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  if (!isDemo) return;

  console.log("Initializing Demo Adapter...");

  axios.interceptors.request.use(async (config) => {
    if (!config.url) return config;

    // Remove base URL if present to make it relative
    let url = config.url.replace('http://localhost:8000', '');
    if (!url.startsWith('/')) url = '/' + url;

    // 1. GET Requests
    if (config.method === 'get') {
        if (url === '/api/category-structure') {
            config.url = '/demo_data/category_structure.json';
        } else if (url === '/api/rule-templates') {
            config.url = '/demo_data/rule_templates.json';
        } else if (url === '/api/themes') {
            config.url = '/demo_data/themes.json';
        } else if (url.startsWith('/api/themes/')) {
            const themeName = url.split('/').pop();
            config.url = `/demo_data/theme_${themeName}.json`;
        } else if (url === '/api/sounds/list') {
            config.url = '/demo_data/sounds.json';
        } else if (url.startsWith('/api/config/')) {
            const path = url.replace('/api/config/', '');
            config.url = `/demo_data/config/${path}`;
        } else if (url.startsWith('/api/search-items')) {
            // Mock empty search
            config.adapter = async () => {
                return { data: { results: [] }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (url.startsWith('/sounds/')) {
            // Let sounds pass through if they are in public (but backend serves them)
            // In demo mode, we might not have sounds. 
            // We can try to point to a dummy file or just let 404.
            // Or if we copied sounds to public/sounds? We didn't.
            // So sounds won't play. Mock adapter?
            // "just demo our viewer". Sounds are secondary.
        }
    }

    // 2. POST Requests
    if (config.method === 'post') {
        if (url === '/api/tier-items') {
            // Fetch the full map and filter client-side
            config.method = 'get';
            config.url = '/demo_data/tier_items.json';
            
            // Store original data to use in transformResponse
            const requestedKeys = JSON.parse(config.data).tier_keys;
            (config as any)._tierKeys = requestedKeys;
        } else if (url.startsWith('/api/update') || url.startsWith('/api/config')) {
            // Mock success for mutations
            config.adapter = async () => {
                console.log("Mocking mutation success for:", url);
                return { data: { message: "Success (Demo)" }, status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    return config;
  });

  axios.interceptors.response.use((response) => {
    // Post-process tier-items
    if ((response.config as any)._tierKeys && response.config.url?.includes('tier_items.json')) {
        const fullMap = response.data;
        const requestedKeys = (response.config as any)._tierKeys as string[];
        const filteredItems: Record<string, any[]> = {};
        
        requestedKeys.forEach(key => {
            filteredItems[key] = fullMap[key] || [];
        });
        
        response.data = { items: filteredItems };
    }
    return response;
  });
};
