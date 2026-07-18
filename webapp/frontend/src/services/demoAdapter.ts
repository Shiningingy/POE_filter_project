// Backend-free mode: axios interceptors that route every /api/* call to the
// client-side data layer (clientData.ts = ports of the FastAPI endpoints over
// the baked data bundle + localStorage VFS). Active when VITE_DEMO_MODE=true —
// used by the deployed site AND the GitHub Pages preview.

import axios from 'axios';
import { generateFilter } from '../utils/filterGenerator';
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from '../utils/snapshot';
import * as data from './clientData';

const VFS_PREFIX = data.VFS_PREFIX;

export const setupDemoAdapter = () => {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  if (!isDemo) return;

  const baseURL = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/';

  console.log('Initializing backend-free data adapter...', { baseURL });

  // Serve a static demo_data file as-is
  const setStaticUrl = (config: any, name: string) => {
    config.url = `${baseURL}demo_data/${name}`;
    config.baseURL = '';
  };

  // Answer the request from an async function (200 on success, 404 on throw)
  const respond = (config: any, fn: () => Promise<any>) => {
    config.adapter = async () => {
      try {
        return { data: await fn(), status: 200, statusText: 'OK', headers: {}, config };
      } catch (e: any) {
        return Promise.reject({
          response: { data: { detail: e?.message || 'Not found' }, status: 404, statusText: 'Not Found', headers: {}, config },
          message: e?.message || 'Not found',
          config, isAxiosError: true,
        });
      }
    };
  };

  const parseBody = (config: any) =>
    typeof config.data === 'string' ? JSON.parse(config.data) : config.data;

  axios.interceptors.request.use(async (config) => {
    if (!config.url) return config;

    const rawUrl = config.url;
    const cleanUrl = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const [path, queryString] = cleanUrl.split('?');
    const query = new URLSearchParams(queryString || '');

    if (config.method === 'get') {
      if (path.endsWith('/api/category-structure')) {
        setStaticUrl(config, 'category_structure.json');
      } else if (path.endsWith('/api/rule-templates')) {
        setStaticUrl(config, 'rule_templates.json');
      } else if (path.endsWith('/api/filter-conditions')) {
        setStaticUrl(config, 'filter_conditions.json');
      } else if (path.endsWith('/api/class-properties')) {
        setStaticUrl(config, 'class_properties.json');
      } else if (path.endsWith('/api/class-hierarchy')) {
        setStaticUrl(config, 'class_hierarchy.json');
      } else if (path.endsWith('/api/bonus-info')) {
        respond(config, () => data.loadBonusInfo());
      } else if (path.includes('/api/item-info/')) {
        const base = decodeURIComponent(path.split('/api/item-info/')[1] || '');
        respond(config, () => data.itemInfo(base));
      } else if (path.endsWith('/api/sounds/list')) {
        setStaticUrl(config, 'sounds.json');
      } else if (path.endsWith('/api/themes')) {
        respond(config, () => data.themesList());
      } else if (path.includes('/api/themes/')) {
        const themeName = decodeURIComponent(path.split('/').pop() || '');
        respond(config, () => data.themeData(themeName));
      } else if (path.endsWith('/api/sound-map')) {
        respond(config, () => data.getSoundMap());
      } else if (path.endsWith('/api/all-rules')) {
        respond(config, () => data.allRules());
      } else if (path.endsWith('/api/item-classes')) {
        respond(config, async () => ({ classes: (await data.loadItemsDb()).classes }));
      } else if (path.includes('/api/class-items/')) {
        const cls = decodeURIComponent(path.split('/api/class-items/')[1] || 'All');
        respond(config, () => data.classItems(cls));
      } else if (path.endsWith('/api/custom-overrides')) {
        respond(config, () => data.getCustomOverrides());
      } else if (path.endsWith('/api/settings')) {
        respond(config, () => data.getSettings());
      } else if (path.includes('/api/mapping-info/')) {
        const file = decodeURIComponent(path.split('/api/mapping-info/')[1] || '');
        respond(config, () => data.mappingInfo(file));
      } else if (path.endsWith('/api/simulator-bundle')) {
        respond(config, () => data.simulatorBundle());
      } else if (path.includes('/api/config/')) {
        const configPath = decodeURIComponent(path.split('/api/config/')[1] || '');
        respond(config, () => data.getConfig(configPath));
      } else if (path.includes('/api/search-items')) {
        const q = query.get('q') || '';
        respond(config, () => data.searchItems(q));
      } else if (path.endsWith('/api/generated-filter')) {
        respond(config, async () => localStorage.getItem('demo_generated_filter') || '# No filter generated yet.');
      } else if (path.endsWith('/api/export-snapshot')) {
        respond(config, async () => {
          const bundle = await data.loadBundle();
          const files: Record<string, any> = {};
          // Static bundle first (keys relative to their roots), VFS edits overlay it
          Object.entries(bundle?.mappings || {}).forEach(([rel, content]) => {
            files[`base_mapping/${rel}`] = content;
          });
          Object.entries(bundle?.tiers || {}).forEach(([rel, content]) => {
            files[`tier_definition/${rel}`] = content;
          });
          if (bundle?.theme) files['theme/sharket/sharket_theme.json'] = bundle.theme;
          files['theme/sharket/Sharket_sound_map.json'] = await data.getSoundMap();
          files['theme/custom_overrides.json'] = await data.getCustomOverrides();
          files['settings.json'] = await data.getSettings();
          Object.keys(localStorage).forEach(key => {
            try {
              if (key.startsWith(VFS_PREFIX)) {
                files[key.replace(VFS_PREFIX, '')] = JSON.parse(localStorage.getItem(key)!);
              } else if (key.startsWith('demo_theme_')) {
                const name = key.replace('demo_theme_', '');
                const content = JSON.parse(localStorage.getItem(key)!);
                files[`theme/${name}/${name}_theme.json`] = content.theme_data || content;
              }
            } catch { /* skip unparsable keys */ }
          });
          return {
            format: SNAPSHOT_FORMAT,
            version: SNAPSHOT_VERSION,
            created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
            files,
          };
        });
      }
    }

    if (config.method === 'post') {
      if (path.endsWith('/api/sound-map')) {
        const content = parseBody(config);
        respond(config, async () => {
          data.writeVfs('theme/sharket/Sharket_sound_map.json', content);
          return { message: 'Saved sound map' };
        });
      } else if (path.endsWith('/api/tier-items')) {
        const body = parseBody(config) || {};
        respond(config, () => data.tierItems(body.tier_keys || [], body.class_filter || null));
      } else if (path.endsWith('/api/update-item-tier')) {
        const body = parseBody(config);
        respond(config, () => data.updateItemTier(body));
      } else if (path.endsWith('/api/update-item-override')) {
        const body = parseBody(config);
        respond(config, () => data.updateItemOverride(body));
      } else if (path.endsWith('/api/settings')) {
        const content = parseBody(config);
        respond(config, () => data.saveSettings(content));
      } else if (path.endsWith('/api/generate')) {
        const genBody = parseBody(config) || {};
        respond(config, async () => {
          const merged = await data.getMergedState();
          const bundle = await data.loadBundle();
          // Campaign picker selection: prefer the POST body, else the persisted setting.
          const settings = await data.getSettings();
          const levelingSelection = genBody.leveling_selection || settings?.leveling_selection || {};
          const filterText = generateFilter({
            themeData: await data.getMergedTheme(),
            soundMap: await data.getSoundMap(),
            allMappings: merged.mappings,
            allTierDefinitions: merged.tiers,
            language: 'ch',
            footer: bundle?.footer || '',
            strictness: genBody.strictness || 'soft',
            leveling_selection: levelingSelection,
          });
          localStorage.setItem('demo_generated_filter', filterText);
          return { message: 'Success (generated in browser)', content: filterText };
        });
      } else if (path.endsWith('/api/custom-overrides')) {
        const content = parseBody(config);
        respond(config, async () => {
          localStorage.setItem('demo_custom_overrides', JSON.stringify(content));
          return { message: 'Saved overrides' };
        });
      } else if (path.includes('/api/themes/')) {
        const themeName = decodeURIComponent(path.split('/').pop() || '');
        const content = parseBody(config);
        respond(config, async () => {
          localStorage.setItem(`demo_theme_${themeName}`, JSON.stringify(content));
          return { message: 'Saved theme', theme_name: themeName };
        });
      } else if (path.includes('/api/config/')) {
        const configPath = decodeURIComponent(path.split('/api/config/')[1] || '');
        const content = parseBody(config);
        respond(config, async () => {
          data.writeVfs(configPath, content);
          return { message: 'Saved' };
        });
      } else if (path.endsWith('/api/import-snapshot')) {
        respond(config, async () => {
          const body = parseBody(config);
          const files: Record<string, any> = body?.files || {};
          const syncPrefixes: string[] = body?.sync_prefixes || [];

          // Limitation: files baked into the static bundle can only be
          // shadowed by VFS keys, never truly deleted.
          const deleted: string[] = [];
          syncPrefixes.forEach(prefix => {
            Object.keys(localStorage).forEach(key => {
              if (!key.startsWith(VFS_PREFIX)) return;
              const rel = key.replace(VFS_PREFIX, '');
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
                localStorage.setItem(VFS_PREFIX + rel, JSON.stringify(content));
              }
            }
            written.push(rel);
          });
          data.invalidateMerged();

          return { written: written.sort(), deleted: deleted.sort(), backed_up_to: null };
        });
      }
    }

    return config;
  }, (error) => Promise.reject(error));
};
