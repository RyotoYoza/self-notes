/**
 * Export and import.
 *
 * Import is a MERGE, never a replace:
 *   - a record whose id is unknown locally is imported
 *   - a record identical to the local one is skipped
 *   - a record that differs from the local one of the same id is kept as well,
 *     under a fresh id, and the local record is left untouched
 *
 * Keeping both means incoming ids can change, so references (a note's
 * parentId and categoryId) are rewritten through a remap table. That is why
 * the import runs in two passes: decide every id first, then write.
 */
import { db } from './db';
import { nowIso, uuid } from './uuid';
import {
  SCHEMA_VERSION,
  type Category,
  type ExportFile,
  type ImportSummary,
  type Note,
  type Settings,
} from './types';

/** Everything on this device, as one plain object. */
export async function exportAll(): Promise<ExportFile> {
  const [notes, categories, settings] = await Promise.all([
    db.notes.toArray(),
    db.categories.toArray(),
    db.settings.get('app'),
  ]);
  return {
    app: 'self-notes',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    // Soft-deleted records are included on purpose: an export is a full
    // backup, and dropping tombstones would resurrect deleted notes on import.
    notes: notes.sort(byId),
    categories: categories.sort(byId),
    settings: settings ?? null,
  };
}

export function exportFilename(date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `self-notes-${d}.json`;
}

export class ImportError extends Error {}

/** Parses and validates a file's text, throwing a message fit to show a user. */
export function parseExportFile(text: string): ExportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('That file is not valid JSON.');
  }
  const f = raw as Partial<ExportFile>;
  if (!f || typeof f !== 'object' || f.app !== 'self-notes') {
    throw new ImportError('That file was not exported from this app.');
  }
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion > SCHEMA_VERSION) {
    throw new ImportError(
      `That file was made by a newer version of the app (schema ${String(
        f.schemaVersion,
      )}). Update this app, then import again.`,
    );
  }
  if (!Array.isArray(f.notes) || !Array.isArray(f.categories)) {
    throw new ImportError('That file is missing its notes or categories.');
  }
  return {
    app: 'self-notes',
    schemaVersion: f.schemaVersion,
    exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : nowIso(),
    notes: f.notes as Note[],
    categories: f.categories as Category[],
    settings: (f.settings as Settings | undefined) ?? null,
  };
}

export async function importAll(file: ExportFile): Promise<ImportSummary> {
  const [localNotes, localCategories, localSettings] = await Promise.all([
    db.notes.toArray(),
    db.categories.toArray(),
    db.settings.get('app'),
  ]);

  const localNoteById = new Map(localNotes.map((n) => [n.id, n]));
  const localCatById = new Map(localCategories.map((c) => [c.id, c]));

  const summary: ImportSummary = {
    notesImported: 0,
    notesSkipped: 0,
    notesKeptBoth: 0,
    categoriesImported: 0,
    categoriesSkipped: 0,
    categoriesKeptBoth: 0,
    settingsRestored: false,
  };

  /* ---- pass 1: decide the fate and final id of every incoming record ---- */
  const catRemap = new Map<string, string>();
  const catsToWrite: Category[] = [];

  for (const incoming of file.categories) {
    if (!incoming || typeof incoming.id !== 'string') continue;
    const local = localCatById.get(incoming.id);
    if (!local) {
      catsToWrite.push(incoming);
      summary.categoriesImported++;
    } else if (identical(local, incoming)) {
      summary.categoriesSkipped++;
    } else {
      const id = uuid();
      catRemap.set(incoming.id, id);
      catsToWrite.push({ ...incoming, id, importedFrom: incoming.id });
      summary.categoriesKeptBoth++;
    }
  }

  const noteRemap = new Map<string, string>();
  const pending: { incoming: Note; id: string; keptBoth: boolean }[] = [];

  for (const incoming of file.notes) {
    if (!incoming || typeof incoming.id !== 'string') continue;
    const local = localNoteById.get(incoming.id);
    if (!local) {
      pending.push({ incoming, id: incoming.id, keptBoth: false });
      summary.notesImported++;
    } else if (identical(local, incoming)) {
      summary.notesSkipped++;
    } else {
      const id = uuid();
      noteRemap.set(incoming.id, id);
      pending.push({ incoming, id, keptBoth: true });
      summary.notesKeptBoth++;
    }
  }

  /* ---- pass 2: rewrite references, then write ---- */
  const notesToWrite: Note[] = pending.map(({ incoming, id, keptBoth }) => {
    const note: Note = {
      ...incoming,
      id,
      categoryId: catRemap.get(incoming.categoryId) ?? incoming.categoryId,
      parentId: incoming.parentId
        ? (noteRemap.get(incoming.parentId) ?? incoming.parentId)
        : null,
    };
    if (keptBoth) note.importedFrom = incoming.id;
    return note;
  });

  await db.transaction('rw', db.categories, db.notes, db.settings, async () => {
    if (catsToWrite.length) await db.categories.bulkPut(catsToWrite);
    if (notesToWrite.length) await db.notes.bulkPut(notesToWrite);
    // Settings are restored only into an install that has none, so importing a
    // backup onto a configured device never silently changes its language.
    if (!localSettings && file.settings) {
      await db.settings.put(file.settings);
      summary.settingsRestored = true;
    }
  });

  return summary;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Field-by-field equality, key order independent. */
function identical(a: object, b: object): boolean {
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`;
}
