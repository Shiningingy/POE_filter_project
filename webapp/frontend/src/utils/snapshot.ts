// Snapshot round-trip helpers: the exported .filter is a lossy render of the
// data tree, so exports can carry a full data snapshot (sidecar .json or a
// gzip+base64 comment block embedded in the filter) that import restores from.

export const SNAPSHOT_FORMAT = 'sharket-filter-snapshot';
export const SNAPSHOT_VERSION = 1;
export const EMBED_BEGIN = '__SHARKET_SNAPSHOT_BEGIN__';
export const EMBED_END = '__SHARKET_SNAPSHOT_END__';
const EMBED_LINE_LEN = 120;

export interface Snapshot {
  format: string;
  version: number;
  created?: string;
  files: Record<string, unknown>;
}

export interface SnapshotGroup {
  key: string;            // checkbox identity, e.g. "cat:Currency" or "theme"
  label: string;          // raw folder name or fixed group id (localized by the UI)
  kind: 'category' | 'theme' | 'sounds' | 'settings';
  paths: string[];
  syncPrefixes: string[]; // category groups only: prefixes synced exactly on import
}

// --- gzip + base64 (browser-native streams, no deps) ---

async function streamBytes(input: Uint8Array, stream: { readable: ReadableStream; writable: WritableStream }): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  writer.write(input);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

export async function gzipBase64(text: string): Promise<string> {
  const bytes = await streamBytes(new TextEncoder().encode(text), new CompressionStream('gzip'));
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function gunzipBase64(b64: string): Promise<string> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const out = await streamBytes(bytes, new DecompressionStream('gzip'));
  return new TextDecoder().decode(out);
}

// --- embedded comment block ---

export async function buildEmbeddedBlock(snapshot: Snapshot): Promise<string> {
  const b64 = await gzipBase64(JSON.stringify(snapshot));
  const lines: string[] = [`# ${EMBED_BEGIN} v${SNAPSHOT_VERSION} gzip+base64`];
  for (let i = 0; i < b64.length; i += EMBED_LINE_LEN) {
    lines.push(`# ${b64.slice(i, i + EMBED_LINE_LEN)}`);
  }
  lines.push(`# ${EMBED_END}`);
  return '\n\n' + lines.join('\n') + '\n';
}

/** Parse uploaded text as a sidecar snapshot JSON or a filter with an embedded
 *  snapshot block. Returns null when neither applies. */
export async function parseSnapshotInput(text: string): Promise<Snapshot | null> {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.format === SNAPSHOT_FORMAT) {
      return parsed as Snapshot;
    }
    return null;
  } catch { /* not JSON — look for an embedded block */ }

  const lines = text.split(/\r?\n/);
  const begin = lines.findIndex(l => l.includes(EMBED_BEGIN));
  const end = lines.findIndex(l => l.includes(EMBED_END));
  if (begin === -1 || end === -1 || end <= begin) return null;
  const b64 = lines.slice(begin + 1, end)
    .map(l => l.replace(/^#\s*/, '').trim())
    .join('');
  try {
    const parsed = JSON.parse(await gunzipBase64(b64));
    if (parsed && parsed.format === SNAPSHOT_FORMAT) return parsed as Snapshot;
  } catch { /* corrupt block */ }
  return null;
}

// --- import checklist grouping ---

const SOUND_FILE_RE = /_sound_map\.json$/i;

/** Group snapshot file paths into import checkboxes: one per top-level category
 *  folder (tier_definition + base_mapping merged), plus theme / sounds / settings. */
export function groupSnapshotFiles(files: Record<string, unknown>): SnapshotGroup[] {
  const categories = new Map<string, SnapshotGroup>();
  const theme: string[] = [];
  const sounds: string[] = [];
  const settings: string[] = [];

  for (const path of Object.keys(files)) {
    const parts = path.split('/');
    const root = parts[0];
    if ((root === 'tier_definition' || root === 'base_mapping') && parts.length >= 2) {
      const cat = parts[1];
      let group = categories.get(cat);
      if (!group) {
        group = {
          key: `cat:${cat}`,
          label: cat,
          kind: 'category',
          paths: [],
          syncPrefixes: [`tier_definition/${cat}/`, `base_mapping/${cat}/`],
        };
        categories.set(cat, group);
      }
      group.paths.push(path);
    } else if (root === 'theme') {
      (SOUND_FILE_RE.test(path) ? sounds : theme).push(path);
    } else if (path === 'settings.json') {
      settings.push(path);
    }
  }

  const catGroups = [...categories.values()].sort((a, b) => {
    const aPriv = a.label.startsWith('_') ? 1 : 0;
    const bPriv = b.label.startsWith('_') ? 1 : 0;
    return aPriv - bPriv || a.label.localeCompare(b.label);
  });

  const fixed: SnapshotGroup[] = [];
  if (theme.length) fixed.push({ key: 'theme', label: 'theme', kind: 'theme', paths: theme, syncPrefixes: [] });
  if (sounds.length) fixed.push({ key: 'sounds', label: 'sounds', kind: 'sounds', paths: sounds, syncPrefixes: [] });
  if (settings.length) fixed.push({ key: 'settings', label: 'settings', kind: 'settings', paths: settings, syncPrefixes: [] });
  return [...catGroups, ...fixed];
}
