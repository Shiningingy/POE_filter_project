import axios from 'axios';

export const setupDemoAdapter = () => {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  if (!isDemo) return;

  const baseURL = import.meta.env.BASE_URL.endsWith('/') 
    ? import.meta.env.BASE_URL 
    : import.meta.env.BASE_URL + '/';

  console.log("Initializing Demo Adapter...", { baseURL });

  axios.interceptors.request.use(async (config) => {
    if (!config.url) return config;

    // Remove base URL if present to make it relative
    let url = config.url.replace('http://localhost:8000', '');
    if (!url.startsWith('/')) url = '/' + url;

    // 1. GET Requests
    if (config.method === 'get') {
        if (url === '/api/category-structure') {
            config.url = `${baseURL}demo_data/category_structure.json`;
        } else if (url === '/api/rule-templates') {
            config.url = `${baseURL}demo_data/rule_templates.json`;
        } else if (url === '/api/themes') {
            config.url = `${baseURL}demo_data/themes.json`;
        } else if (url.startsWith('/api/themes/')) {
            const themeName = url.split('/').pop();
            config.url = `${baseURL}demo_data/theme_${themeName}.json`;
        } else if (url === '/api/sounds/list') {
            config.url = `${baseURL}demo_data/sounds.json`;
        } else if (url === '/api/item-classes') {
            config.url = `${baseURL}demo_data/item_classes.json`;
        } else if (url.startsWith('/api/class-items/')) {
            config.url = `${baseURL}demo_data/all_items.json`;
        } else if (url.startsWith('/api/search-items')) {
            config.adapter = async () => {
                return { data: { results: [] }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (url === '/api/generated-filter') {
            config.adapter = async () => {
                return { data: "# Demo Filter Content", status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    // 2. POST Requests
    if (config.method === 'post') {
        if (url === '/api/tier-items') {
            config.method = 'get';
            config.url = `${baseURL}demo_data/tier_items.json`;
            
            const requestedKeys = JSON.parse(config.data).tier_keys;
            (config as any)._tierKeys = requestedKeys;
        } else if (url.startsWith('/api/update') || url.startsWith('/api/config')) {
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

    // Post-process config files to match backend structure { content: ... }
    if (response.config.url?.includes('/demo_data/config/')) {
        if (!response.data.content) {
            response.data = { content: response.data };
        }
    }

    return response;
  });
};