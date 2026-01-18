import axios from 'axios';
import { generateFilter } from '../utils/filterGenerator';

const DEMO_CONFIG_PREFIX = 'demo_vfs_';

export const setupDemoAdapter = () => {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  if (!isDemo) return;

  const baseURL = import.meta.env.BASE_URL.endsWith('/') 
    ? import.meta.env.BASE_URL 
    : import.meta.env.BASE_URL + '/';

  console.log("Initializing Demo Adapter with Generator support...", { baseURL });

  // Pre-load necessary generation data
  let dataBundle: any = null;
  const loadBundle = async () => {
      if (dataBundle) return dataBundle;
      try {
          const res = await axios.get(`${baseURL}demo_data/bundle.json`, { baseURL: '' });
          dataBundle = res.data;
          return dataBundle;
      } catch (e) {
          console.error("Failed to load demo data bundle", e);
          return null;
      }
  };

  axios.interceptors.request.use(async (config) => {
    if (!config.url) return config;

    const rawUrl = config.url;
    const cleanUrl = rawUrl.replace(/^https?:\/\/[^\/]+/, ''); 
    const path = cleanUrl.split('?')[0]; 

    const setDemoUrl = (newUrl: string) => {
        config.url = newUrl;
        config.baseURL = ''; 
    };

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
            const saved = localStorage.getItem(DEMO_CONFIG_PREFIX + configPath);
            if (saved) {
                config.adapter = async () => {
                    return { data: { content: JSON.parse(saved) }, status: 200, statusText: 'OK', headers: {}, config };
                };
            } else {
                setDemoUrl(`${baseURL}demo_data/config/${configPath}`);
            }
        } else if (path.includes('/api/search-items')) {
            config.adapter = async () => {
                return { data: { results: [] }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.endsWith('/api/generated-filter')) {
            config.adapter = async () => {
                const content = localStorage.getItem('demo_generated_filter') || "# No filter generated yet.";
                return { data: content, status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    if (config.method === 'post') {
        if (path.endsWith('/api/tier-items')) {
            config.method = 'get';
            setDemoUrl(`${baseURL}demo_data/tier_items.json`);
            
            let requestedKeys = [];
            try {
                const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                requestedKeys = data.tier_keys || [];
            } catch (e) {
                console.error("Failed to parse tier_keys", e);
            }
            (config as any)._tierKeys = requestedKeys;
        } else if (path.endsWith('/api/generate')) {
            config.adapter = async () => {
                console.log("DEMO GENERATOR: Running...");
                const bundle = await loadBundle();
                if (!bundle) return { data: { message: "Error: No bundle" }, status: 500, statusText: 'Error', headers: {}, config };

                // Merge User modifications from VFS
                const mergedMappings = { ...bundle.mappings };
                const mergedTiers = { ...bundle.tiers };

                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(DEMO_CONFIG_PREFIX)) {
                        const path = key.replace(DEMO_CONFIG_PREFIX, '');
                        const content = JSON.parse(localStorage.getItem(key)!);
                        if (path.startsWith('base_mapping/')) {
                            mergedMappings[path.replace('base_mapping/', '')] = content;
                        } else if (path.startsWith('tier_definition/')) {
                            mergedTiers[path.replace('tier_definition/', '')] = content;
                        }
                    }
                });

                const filterText = generateFilter({
                    themeData: bundle.theme,
                    soundMap: bundle.soundMap,
                    allMappings: mergedMappings,
                    allTierDefinitions: mergedTiers,
                    language: 'ch'
                });

                localStorage.setItem('demo_generated_filter', filterText);
                return { data: { message: "Success (Generated in Demo)", content: filterText }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.includes('/api/update-item-tier') || path.includes('/api/update-item-override')) {
             config.adapter = async () => {
                return { data: { message: "Success (Demo)" }, status: 200, statusText: 'OK', headers: {}, config };
             };
        } else if (path.includes('/api/config/')) {
            const configPath = path.split('/api/config/')[1];
            const content = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            localStorage.setItem(DEMO_CONFIG_PREFIX + configPath, JSON.stringify(content));
            config.adapter = async () => {
                return { data: { message: "Saved to Demo Storage" }, status: 200, statusText: 'OK', headers: {}, config };
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