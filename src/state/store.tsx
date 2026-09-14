import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  bootstrap,
  exportAll,
  exportFilename,
  get,
  importAll,
  list,
  newCategory,
  newNote,
  parseExportFile,
  put,
  remove,
  SCHEMA_VERSION,
  UNCATEGORISED_ID,
  type Category,
  type ImportSummary,
  type Lang,
  type Note,
  type Settings,
  type Skin,
} from '../storage';
import { dictionaries, type Strings } from '../i18n/strings';

export type View =
  | { kind: 'home' }
  | { kind: 'category'; id: string }
  | { kind: 'settings' }
  | { kind: 'sweep' };

interface Store {
  ready: boolean;
  notes: Note[];
  categories: Category[];
  settings: Settings;
  t: Strings;
  view: View;
  setView: (v: View) => void;
  /** Set when the user jumps to a note from the calendar. */
  focusNoteId: string | null;
  focusNote: (noteId: string, categoryId: string) => void;
  clearFocus: () => void;

  categoryById: (id: string) => Category | undefined;
  categoryLabel: (c: Category) => string;

  sendNote: (fields: {
    text: string;
    categoryId: string;
    scheduled: boolean;
    urgent: boolean;
    parentId?: string | null;
  }) => Promise<Note>;
  patchNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  saveCategory: (c: Category) => Promise<void>;
  createCategory: (name: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  setSettings: (patch: Partial<Settings>) => Promise<void>;
  runExport: () => Promise<void>;
  runImport: (text: string) => Promise<ImportSummary>;
}

const StoreContext = createContext<Store | null>(null);

/** Swatches offered when recolouring a category. */
const PALETTE = [
  '#5B6BE8', '#17A08A', '#CC7A22', '#A45CD6', '#7C8698',
  '#E8A33D', '#5FC2A4', '#7FA8E0', '#C8372A', '#3F6B52',
];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const boot = await bootstrap();
      setCategories(boot.categories);
      setSettingsState(boot.settings);
      setNotes(sortNotes(await list('notes')));
      setReady(true);
    })();
  }, []);

  const refreshNotes = useCallback(async () => {
    setNotes(sortNotes(await list('notes')));
  }, []);

  const refreshCategories = useCallback(async () => {
    setCategories((await list('categories')).sort((a, b) => a.order - b.order));
  }, []);

  const value = useMemo<Store | null>(() => {
    if (!settings) return null;
    const t = dictionaries[settings.lang];

    const categoryById = (id: string) => categories.find((c) => c.id === id);
    const categoryLabel = (c: Category) =>
      settings.lang === 'ja' && c.nameJa ? c.nameJa : c.name;

    return {
      ready,
      notes,
      categories,
      settings,
      t,
      view,
      setView: (v) => {
        setFocusNoteId(null);
        setView(v);
      },
      focusNoteId,
      focusNote: (noteId, categoryId) => {
        setView({ kind: 'category', id: categoryId });
        setFocusNoteId(noteId);
      },
      clearFocus: () => setFocusNoteId(null),

      categoryById,
      categoryLabel,

      async sendNote(fields) {
        const note = await put('notes', newNote(fields));
        await refreshNotes();
        return note;
      },

      async patchNote(id, patch) {
        const existing = await get('notes', id);
        if (!existing) return;
        const next: Note = { ...existing, ...patch };
        // Turning the calendar toggle on without a date puts the note on the
        // day it was written, which is the only date we actually know.
        if (next.scheduled && !next.scheduledFor) next.scheduledFor = next.createdAt;
        if (!next.scheduled) next.scheduledFor = null;
        await put('notes', next);
        await refreshNotes();
      },

      async deleteNote(id) {
        // Added notes go with their original — an orphaned reply quoting a
        // note that is gone would be unreadable.
        const children = notes.filter((n) => n.parentId === id);
        await Promise.all([remove('notes', id), ...children.map((c) => remove('notes', c.id))]);
        await refreshNotes();
      },

      async saveCategory(c) {
        await put('categories', c);
        await refreshCategories();
      },

      async createCategory(name, color) {
        const order = categories.filter((c) => !c.system).length;
        await put('categories', newCategory({ name, color, order }));
        await refreshCategories();
      },

      async deleteCategory(id) {
        const orphans = notes.filter((n) => n.categoryId === id);
        await Promise.all(
          orphans.map((n) => put('notes', { ...n, categoryId: UNCATEGORISED_ID })),
        );
        await remove('categories', id);
        await Promise.all([refreshCategories(), refreshNotes()]);
        setView({ kind: 'home' });
      },

      async setSettings(patch) {
        const next = { ...settings, ...patch };
        await put('settings', next);
        setSettingsState(next);
      },

      async runExport() {
        const file = await exportAll();
        downloadJson(exportFilename(), file);
      },

      async runImport(text) {
        const summary = await importAll(parseExportFile(text));
        await Promise.all([refreshNotes(), refreshCategories()]);
        const fresh = await get('settings', 'app');
        if (fresh) setSettingsState(fresh);
        return summary;
      },
    };
  }, [ready, notes, categories, settings, view, focusNoteId, refreshNotes, refreshCategories]);

  if (!value) return null;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore called outside StoreProvider');
  return s;
}

/**
 * Oldest first, the way a chat thread reads. The id tie-break only matters for
 * imported notes, whose timestamps were issued by another device's clock.
 */
function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { PALETTE, SCHEMA_VERSION, UNCATEGORISED_ID };
export type { Category, Note, Settings, Lang, Skin, ImportSummary };
