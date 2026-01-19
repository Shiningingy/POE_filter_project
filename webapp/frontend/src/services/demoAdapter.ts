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
            const query = new URLSearchParams(cleanUrl.split('?')[1]).get('q')?.toLowerCase() || '';
            config.adapter = async () => {
                try {
                    const res = await axios.get(`${baseURL}demo_data/all_items.json`, { baseURL: '' });
                    const allItems = res.data.items || [];
                    const filtered = allItems.filter((i: any) => 
                        i.name.toLowerCase().includes(query) || 
                        (i.name_ch && i.name_ch.toLowerCase().includes(query))
                    ).slice(0, 20);
                    return { data: { results: filtered }, status: 200, statusText: 'OK', headers: {}, config };
                } catch (e) {
                    return { data: { results: [] }, status: 200, statusText: 'OK', headers: {}, config };
                }
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
            config.adapter = async () => {
                const bundle = await loadBundle();
                if (!bundle) return { data: { items: {} }, status: 500, statusText: 'Error', headers: {}, config };

                // Build dynamic tier items map
                const tierItemsMap: Record<string, any[]> = {};
                
                // 1. Start with bundled mappings
                const mergedMappings = { ...bundle.mappings };
                
                // 2. Overwrite with VFS mappings
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(DEMO_CONFIG_PREFIX) && key.includes('base_mapping/')) {
                        const vfsPath = key.replace(DEMO_CONFIG_PREFIX, '').replace('base_mapping/', '');
                        mergedMappings[vfsPath] = JSON.parse(localStorage.getItem(key)!);
                    }
                });

                // 3. Scan all items in all mappings
                // Note: We need item metadata (name_ch, etc.) which usually comes from all_items.json
                // For simplicity, we'll fetch all_items.json once or use a cache
                const allItemsRes = await axios.get(`${baseURL}demo_data/all_items.json`, { baseURL: '' });
                const allItems = allItemsRes.data.items || [];
                const itemLookup: Record<string, any> = {};
                allItems.forEach((i: any) => { itemLookup[i.name] = i; });

                Object.entries(mergedMappings).forEach(([sourceFile, mapping]: [string, any]) => {
                    if (mapping.items) {
                        Object.entries(mapping.items).forEach(([itemName, tiers]: [string, any]) => {
                            const tierList = Array.isArray(tiers) ? tiers : [tiers];
                            tierList.forEach(tk => {
                                if (!tierItemsMap[tk]) tierItemsMap[tk] = [];
                                const meta = itemLookup[itemName] || { name: itemName };
                                tierItemsMap[tk].push({
                                    ...meta,
                                    source: sourceFile
                                });
                            });
                        });
                    }
                });

                // Filter by requested keys if provided
                let requestedKeys = [];
                try {
                    const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                    requestedKeys = data.tier_keys || [];
                } catch (e) {}

                const result: Record<string, any[]> = {};
                if (requestedKeys.length > 0) {
                    requestedKeys.forEach((k: string) => { result[k] = tierItemsMap[k] || []; });
                } else {
                    Object.assign(result, tierItemsMap);
                }

                return { data: { items: result }, status: 200, statusText: 'OK', headers: {}, config };
            };
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
                        const vfsPath = key.replace(DEMO_CONFIG_PREFIX, '');
                        const content = JSON.parse(localStorage.getItem(key)!);
                        if (vfsPath.startsWith('base_mapping/')) {
                            mergedMappings[vfsPath.replace('base_mapping/', '')] = content;
                        } else if (vfsPath.startsWith('tier_definition/')) {
                            mergedTiers[vfsPath.replace('tier_definition/', '')] = content;
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
        } else if (path.includes('/api/update-item-tier')) {
             config.adapter = async () => {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const { item_name, new_tier, new_tiers, source_file } = payload;
                
                const vfsPath = `base_mapping/${source_file}`;
                let mappingContent: any = null;
                
                const saved = localStorage.getItem(DEMO_CONFIG_PREFIX + vfsPath);
                if (saved) {
                    mappingContent = JSON.parse(saved);
                } else {
                    try {
                        const res = await axios.get(`${baseURL}demo_data/config/${vfsPath}`, { baseURL: '' });
                        mappingContent = res.data;
                    } catch (e) {
                        console.error("Failed to load mapping for update", e);
                    }
                }

                if (mappingContent) {
                    // Update tier in mapping
                    if (!mappingContent.items) mappingContent.items = {};
                    
                    if (new_tiers !== undefined) {
                        // BulkTierEditor style: array of tiers
                        mappingContent.items[item_name] = new_tiers;
                    } else if (new_tier === "" || new_tier === null) {
                        // Remove item
                        delete mappingContent.items[item_name];
                    } else {
                        // Single tier update
                        mappingContent.items[item_name] = [new_tier];
                    }
                    
                    localStorage.setItem(DEMO_CONFIG_PREFIX + vfsPath, JSON.stringify(mappingContent));
                    console.log(`DEMO VFS: Updated ${item_name} in ${vfsPath}`);
                }

                return { data: { message: "Success (Demo VFS Updated)" }, status: 200, statusText: 'OK', headers: {}, config };
             };
        } else if (path.includes('/api/update-item-override')) {
             config.adapter = async () => {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const { item_name, overrides, source_file } = payload;
                
                const vfsPath = `base_mapping/${source_file}`;
                let mappingContent: any = null;
                
                const saved = localStorage.getItem(DEMO_CONFIG_PREFIX + vfsPath);
                if (saved) mappingContent = JSON.parse(saved);
                else {
                    try {
                        const res = await axios.get(`${baseURL}demo_data/config/${vfsPath}`, { baseURL: '' });
                        mappingContent = res.data;
                    } catch (e) {}
                }

                if (mappingContent) {
                    if (!mappingContent.overrides) mappingContent.overrides = {};
                    mappingContent.overrides[item_name] = overrides;
                    localStorage.setItem(DEMO_CONFIG_PREFIX + vfsPath, JSON.stringify(mappingContent));
                }

                return { data: { message: "Success (Override Saved)" }, status: 200, statusText: 'OK', headers: {}, config };
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
    if (response.config.url?.includes('/demo_data/config/')) {
        if (!response.data.content) response.data = { content: response.data };
    }
    return response;
  }, (error) => Promise.reject(error));
};