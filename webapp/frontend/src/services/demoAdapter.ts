import axios from 'axios';
import { generateFilter } from '../utils/filterGenerator';
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from '../utils/snapshot';

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
            const savedTheme = localStorage.getItem(`demo_theme_${themeName}`);
            if (savedTheme) {
                config.adapter = async () => {
                    // Match backend structure: { theme_name, theme_data, sound_map_data }
                    // The POST saves whatever the frontend sends. Usually frontend sends { theme_data: ... }
                    // Let's assume content is the theme_data object itself or the wrapper.
                    const content = JSON.parse(savedTheme);
                    const themeData = content.theme_data || content;
                    
                    return { 
                        data: { 
                            theme_name: themeName, 
                            theme_data: themeData,
                            sound_map_data: {} // Mock sound map for now or load separate
                        }, 
                        status: 200, statusText: 'OK', headers: {}, config 
                    };
                };
            } else {
                setDemoUrl(`${baseURL}demo_data/theme_${themeName}.json`);
            }
        } else if (path.endsWith('/api/sounds/list')) {
            setDemoUrl(`${baseURL}demo_data/sounds.json`);
        } else if (path.endsWith('/api/sound-map')) {
            config.adapter = async () => {
                // VFS-saved map (e.g. from a sound import) shadows the bundled one
                const saved = localStorage.getItem(DEMO_CONFIG_PREFIX + 'theme/sharket/Sharket_sound_map.json');
                if (saved) return { data: JSON.parse(saved), status: 200, statusText: 'OK', headers: {}, config };
                const bundle = await loadBundle();
                return { data: bundle?.soundMap || {}, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.endsWith('/api/all-rules')) {
            config.adapter = async () => {
                const bundle = await loadBundle();
                console.log("DEMO ADAPTER: Intercepting /api/all-rules. Bundle present:", !!bundle);
                if (!bundle) return { data: { rules: [] }, status: 200, statusText: 'OK', headers: {}, config };
                
                const allRules: any[] = [];
                const mergedMappings = { ...bundle.mappings };
                
                console.log("DEMO ADAPTER: Mappings in bundle:", Object.keys(mergedMappings).length);
// ...
                Object.entries(mergedMappings).forEach(([fileName, content]: [string, any]) => {
                    const catKey = Object.keys(content).find(k => !k.startsWith('//'));
                    if (catKey) {
                        const rules = content[catKey].rules || content[catKey]._meta?.rules || [];
                        if (rules.length > 0) console.log(`DEMO ADAPTER: Found ${rules.length} rules in ${fileName}`);
                        rules.forEach((r: any) => {
                            allRules.push({ ...r, _source_file: fileName });
                        });
                    }
                });

                console.log("DEMO ADAPTER: Returning total rules:", allRules.length);
                return { data: { rules: allRules }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.endsWith('/api/item-classes')) {
            setDemoUrl(`${baseURL}demo_data/item_classes.json`);
        } else if (path.includes('/api/class-items/')) {
            setDemoUrl(`${baseURL}demo_data/all_items.json`);
        } else if (path.includes('/api/custom-overrides')) {
            const saved = localStorage.getItem('demo_custom_overrides');
            config.adapter = async () => {
                return { data: saved ? JSON.parse(saved) : {}, status: 200, statusText: 'OK', headers: {}, config };
            };
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
        } else if (path.endsWith('/api/export-snapshot')) {
            config.adapter = async () => {
                const bundle = await loadBundle();
                const files: Record<string, any> = {};
                // Static bundle first (keys are relative to their roots), VFS edits overlay it
                Object.entries(bundle?.mappings || {}).forEach(([rel, content]) => {
                    files[`base_mapping/${rel}`] = content;
                });
                Object.entries(bundle?.tiers || {}).forEach(([rel, content]) => {
                    files[`tier_definition/${rel}`] = content;
                });
                if (bundle?.theme) files['theme/sharket/sharket_theme.json'] = bundle.theme;
                if (bundle?.soundMap) files['theme/sharket/Sharket_sound_map.json'] = bundle.soundMap;
                Object.keys(localStorage).forEach(key => {
                    try {
                        if (key.startsWith(DEMO_CONFIG_PREFIX)) {
                            files[key.replace(DEMO_CONFIG_PREFIX, '')] = JSON.parse(localStorage.getItem(key)!);
                        } else if (key === 'demo_custom_overrides') {
                            files['theme/custom_overrides.json'] = JSON.parse(localStorage.getItem(key)!);
                        } else if (key.startsWith('demo_theme_')) {
                            const name = key.replace('demo_theme_', '');
                            const content = JSON.parse(localStorage.getItem(key)!);
                            files[`theme/${name}/${name}_theme.json`] = content.theme_data || content;
                        }
                    } catch { /* skip unparsable keys */ }
                });
                const snapshot = {
                    format: SNAPSHOT_FORMAT,
                    version: SNAPSHOT_VERSION,
                    created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
                    files,
                };
                return { data: snapshot, status: 200, statusText: 'OK', headers: {}, config };
            };
        }
    }

    if (config.method === 'post') {
        if (path.endsWith('/api/sound-map')) {
            const content = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            localStorage.setItem(DEMO_CONFIG_PREFIX + 'theme/sharket/Sharket_sound_map.json', JSON.stringify(content));
            config.adapter = async () => {
                return { data: { message: "Saved Sound Map to Demo Storage" }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.endsWith('/api/tier-items')) {
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

                const savedSoundMap = localStorage.getItem(DEMO_CONFIG_PREFIX + 'theme/sharket/Sharket_sound_map.json');
                const filterText = generateFilter({
                    themeData: bundle.theme,
                    soundMap: savedSoundMap ? JSON.parse(savedSoundMap) : bundle.soundMap,
                    allMappings: mergedMappings,
                    allTierDefinitions: mergedTiers,
                    language: 'ch'
                });

                localStorage.setItem('demo_generated_filter', filterText);
                return { data: { message: "Success (Generated in Demo)", content: filterText }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.includes('/api/custom-overrides')) {
            const content = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            localStorage.setItem('demo_custom_overrides', JSON.stringify(content));
            config.adapter = async () => {
                return { data: { message: "Saved Overrides" }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.includes('/api/themes/')) {
            const themeName = path.split('/').pop();
            const content = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            // Save theme data to localStorage
            // The ThemePresetEditor might send { theme_data: ... } or just raw data.
            // We should save it consistent with how we load it: as a separate file override?
            // Actually, we load themes from static files in demo.
            // Let's save it to a VFS key: `demo_theme_${themeName}`
            localStorage.setItem(`demo_theme_${themeName}`, JSON.stringify(content));
            
            config.adapter = async () => {
                return { data: { message: "Saved Theme to Demo Storage", theme_name: themeName }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.includes('/api/config/')) {
            const configPath = path.split('/api/config/')[1];
            const content = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            localStorage.setItem(DEMO_CONFIG_PREFIX + configPath, JSON.stringify(content));
            config.adapter = async () => {
                return { data: { message: "Saved to Demo Storage" }, status: 200, statusText: 'OK', headers: {}, config };
            };
        } else if (path.endsWith('/api/import-snapshot')) {
            config.adapter = async () => {
                const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const files: Record<string, any> = body?.files || {};
                const syncPrefixes: string[] = body?.sync_prefixes || [];

                // Limitation: files baked into the static bundle can only be
                // shadowed by VFS keys, never truly deleted.
                const deleted: string[] = [];
                syncPrefixes.forEach(prefix => {
                    Object.keys(localStorage).forEach(key => {
                        if (!key.startsWith(DEMO_CONFIG_PREFIX)) return;
                        const rel = key.replace(DEMO_CONFIG_PREFIX, '');
                        if (rel.startsWith(prefix) && !(rel in files)) {
                            localStorage.removeItem(key);
                            deleted.push(rel);
                        }
                    });
                });

                const written: string[] = [];
                Object.entries(files).forEach(([rel, content]) => {
                    if (rel === 'theme/custom_overrides.json') {
                        localStorage.setItem('demo_custom_overrides', JSON.stringify(content));
                    } else {
                        const themeMatch = rel.match(/^theme\/([^/]+)\/\1_theme\.json$/);
                        if (themeMatch) {
                            localStorage.setItem(`demo_theme_${themeMatch[1]}`, JSON.stringify(content));
                        } else {
                            localStorage.setItem(DEMO_CONFIG_PREFIX + rel, JSON.stringify(content));
                        }
                    }
                    written.push(rel);
                });

                return {
                    data: { written: written.sort(), deleted: deleted.sort(), backed_up_to: null },
                    status: 200, statusText: 'OK', headers: {}, config,
                };
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