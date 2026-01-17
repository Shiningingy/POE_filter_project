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

    // Normalize URL for matching: Remove protocol/host and strip query params
    const rawUrl = config.url;
    const cleanUrl = rawUrl.replace(/^https?:\/\/[^\/]+/, ''); 
    const path = cleanUrl.split('?')[0]; 

    console.log(`Demo Interceptor: [${config.method}] ${path}`, { original: rawUrl });

    const setDemoUrl = (newUrl: string) => {
        console.log(`  -> Mapping to Demo URL: ${newUrl}`);
        config.url = newUrl;
        config.baseURL = ''; // Important: stop axios from prepending localhost:8000
    };

    // Use endsWith or includes for more robust matching
    if (config.method === 'get') {
        if (path.endsWith('/api/category-structure')) {
            setDemoUrl(`${baseURL}demo_data/category_structure.json`);
        } else if (path.endsWith('/api/rule-templates')) {
            setDemoUrl(`${baseURL}demo_data/rule_templates.json`);
        } else if (path.endsWith('/api/themes')) {
            setDemoUrl(`${baseURL}demo_data/themes.json`);
        } else if (path.includes('/api/themes/')) {
            const themeName = path.split('/').pop();
            setDemoUrl(`${baseURL}demo_data/theme_${themeName}.json`);
        } else if (path.endsWith('/api/sounds/list')) {
            setDemoUrl(`${baseURL}demo_data/sounds.json`);
        } else if (path.endsWith('/api/item-classes')) {
            setDemoUrl(`${baseURL}demo_data/item_classes.json`);
        } else if (path.includes('/api/class-items/')) {
            setDemoUrl(`${baseURL}demo_data/all_items.json`);
        } else if (path.includes('/api/config/')) {
            const configPath = path.split('/api/config/')[1];
            setDemoUrl(`${baseURL}demo_data/config/${configPath}`);
        } else if (path.includes('/api/search-items')) {
            config.adapter = async () => {
                return { data: { results: [] }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.endsWith('/api/generated-filter')) {
            config.adapter = async () => {
                return { data: "# Demo Filter Content", status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    if (config.method === 'post') {
        if (path.endsWith('/api/tier-items')) {
            config.method = 'get';
            setDemoUrl(`${baseURL}demo_data/tier_items.json`);
            const requestedKeys = JSON.parse(config.data).tier_keys;
            (config as any)._tierKeys = requestedKeys;
        } else if (path.includes('/api/update') || path.includes('/api/config') || path.includes('/api/generate')) {
            config.adapter = async () => {
                return { data: { message: "Success (Demo)" }, status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    return config;
  }, (error) => Promise.reject(error));

  axios.interceptors.response.use((response) => {
    if ((response.config as any)._tierKeys && response.config.url?.includes('tier_items.json')) {
        const fullMap = response.data;
        const requestedKeys = (response.config as any)._tierKeys as string[];
        const filteredItems: Record<string, any[]> = {};
        requestedKeys.forEach(key => { filteredItems[key] = fullMap[key] || []; });
        response.data = { items: filteredItems };
    }
    if (response.config.url?.includes('/demo_data/config/')) {
        if (!response.data.content) response.data = { content: response.data };
    }
    return response;
  }, (error) => Promise.reject(error));
};