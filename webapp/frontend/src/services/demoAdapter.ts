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

    // 1. Clean the URL: Remove host and ignore query parameters for matching
    let url = config.url.replace(/^https?:\/\/[^\/]+/, ''); 
    const [path] = url.split('?'); 

    const setDemoUrl = (newUrl: string) => {
        config.url = newUrl;
        config.baseURL = ''; // CRITICAL: prevent axios from prepending localhost:8000
    };

    // 2. GET Requests
    if (config.method === 'get') {
        if (path === '/api/category-structure') {
            setDemoUrl(`${baseURL}demo_data/category_structure.json`);
        } else if (path === '/api/rule-templates') {
            setDemoUrl(`${baseURL}demo_data/rule_templates.json`);
        } else if (path === '/api/themes') {
            setDemoUrl(`${baseURL}demo_data/themes.json`);
        } else if (path.startsWith('/api/themes/')) {
            const themeName = path.split('/').pop();
            setDemoUrl(`${baseURL}demo_data/theme_${themeName}.json`);
        } else if (path === '/api/sounds/list') {
            setDemoUrl(`${baseURL}demo_data/sounds.json`);
        } else if (path === '/api/item-classes') {
            setDemoUrl(`${baseURL}demo_data/item_classes.json`);
        } else if (path.startsWith('/api/class-items/')) {
            setDemoUrl(`${baseURL}demo_data/all_items.json`);
        } else if (path.startsWith('/api/config/')) {
            const configPath = path.replace('/api/config/', '');
            setDemoUrl(`${baseURL}demo_data/config/${configPath}`);
        } else if (path.startsWith('/api/search-items')) {
            config.adapter = async () => {
                return { data: { results: [] }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path === '/api/generated-filter') {
            config.adapter = async () => {
                return { data: "# Demo Filter Content", status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    // 3. POST Requests
    if (config.method === 'post') {
        if (path === '/api/tier-items') {
            config.method = 'get';
            setDemoUrl(`${baseURL}demo_data/tier_items.json`);
            
            const requestedKeys = JSON.parse(config.data).tier_keys;
            (config as any)._tierKeys = requestedKeys;
        } else if (path.startsWith('/api/update') || path.startsWith('/api/config') || path.startsWith('/api/generate')) {
            config.adapter = async () => {
                console.log("Mocking mutation success for:", path);
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
