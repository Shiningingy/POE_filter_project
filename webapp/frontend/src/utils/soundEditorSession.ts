// Lightweight, module-scoped persistence for the Sound Bulk Editor workspace.
// Survives the editor being unmounted (e.g. when "Open in full Editor" switches
// the app view) so reopening the Sound Manager restores the columns/staging.
// Session-only: cleared on a hard page reload.

export interface SoundDefLike {
  path: string;
  label: string;
  type: 'sharket' | 'default' | 'custom';
}

export interface SoundEditorSession {
  activeColumns: SoundDefLike[];
  stagedChanges: Record<string, string>;
}

let session: SoundEditorSession | null = null;

export const loadSoundEditorSession = (): SoundEditorSession | null => session;

export const saveSoundEditorSession = (s: SoundEditorSession): void => {
  session = s;
};

export const clearSoundEditorSession = (): void => {
  session = null;
};
