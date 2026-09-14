/**
 * The only file in the app that knows IndexedDB exists.
 * Everything else goes through the narrow interface in ./index.ts.
 */
import Dexie, { type Table } from 'dexie';
import type { Category, Note, Settings } from './types';

class SelfNotesDB extends Dexie {
  notes!: Table<Note, string>;
  categories!: Table<Category, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'self-notes') {
    super(name);
    // Indexes are listed for the queries the app actually runs: notes by
    // category, by parent (to gather added notes), and by calendar date.
    this.version(1).stores({
      notes: 'id, categoryId, parentId, createdAt, scheduledFor, deletedAt',
      categories: 'id, order, deletedAt',
      settings: 'id',
    });
  }
}

export let db = new SelfNotesDB();

/** Test hook: swap in a fresh database so suites cannot leak into each other. */
export function _useDatabase(name: string) {
  db = new SelfNotesDB(name);
  return db;
}
