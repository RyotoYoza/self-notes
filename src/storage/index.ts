/**
 * The storage interface. Four verbs — get, put, list, remove — plus the
 * transfer and bootstrap helpers that need direct table access.
 *
 * Nothing outside this directory imports Dexie or touches IndexedDB. When a
 * backend arrives, the bodies here change and the rest of the app does not.
 */
import { db } from './db';
import { nowIso, uuid } from './uuid';
import {
  UNCATEGORISED_ID,
  type Category,
  type Collection,
  type CollectionMap,
  type Note,
  type Settings,
} from './types';

export * from './types';
export { uuid, nowIso } from './uuid';
export { exportAll, importAll, exportFilename, parseExportFile } from './transfer';
export { _useDatabase } from './db';

function table(collection: Collection) {
  return db[collection] as any;
}

/** Fetch one record by id. Returns soft-deleted records too — callers decide. */
export async function get<C extends Collection>(
  collection: C,
  id: string,
): Promise<CollectionMap[C] | undefined> {
  return table(collection).get(id);
}

/**
 * Insert or replace one record, stamping updatedAt and clearing syncedAt —
 * a locally-modified record is by definition no longer in sync with a server.
 */
export async function put<C extends Collection>(
  collection: C,
  record: CollectionMap[C],
): Promise<CollectionMap[C]> {
  const stamped = { ...record, updatedAt: nowIso(), syncedAt: null };
  await table(collection).put(stamped);
  return stamped as CollectionMap[C];
}

/** Insert or replace many records verbatim, without re-stamping them. */
export async function putMany<C extends Collection>(
  collection: C,
  records: CollectionMap[C][],
): Promise<void> {
  if (records.length === 0) return;
  await table(collection).bulkPut(records);
}

export interface ListOptions {
  /** Soft-deleted records are hidden unless this is true. */
  includeDeleted?: boolean;
}

/** All records in a collection. Soft-deleted ones are filtered out by default. */
export async function list<C extends Collection>(
  collection: C,
  options: ListOptions = {},
): Promise<CollectionMap[C][]> {
  const all: CollectionMap[C][] = await table(collection).toArray();
  if (options.includeDeleted) return all;
  return all.filter((r) => !('deletedAt' in r) || (r as any).deletedAt === null);
}

/**
 * Soft delete. The record stays on disk with deletedAt set so the deletion can
 * be replayed to a server later. Never removes the row.
 */
export async function remove(collection: Collection, id: string): Promise<void> {
  const existing = await table(collection).get(id);
  if (!existing) return;
  await table(collection).put({
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    syncedAt: null,
  });
}

/** Drops every record. Used by the settings "delete everything" path and by tests. */
export async function wipe(): Promise<void> {
  await Promise.all([db.notes.clear(), db.categories.clear(), db.settings.clear()]);
}

/* ------------------------------------------------------------------ *
 * Record constructors — the one place new ids and timestamps are made *
 * ------------------------------------------------------------------ */

export function newNote(fields: {
  text: string;
  categoryId: string;
  parentId?: string | null;
  scheduled?: boolean;
  scheduledFor?: string | null;
  urgent?: boolean;
}): Note {
  const now = nowIso();
  return {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    deletedAt: null,
    text: fields.text,
    categoryId: fields.categoryId,
    parentId: fields.parentId ?? null,
    scheduled: fields.scheduled ?? false,
    scheduledFor: fields.scheduled ? (fields.scheduledFor ?? now) : null,
    urgent: fields.urgent ?? false,
  };
}

/**
 * The built-in categories use fixed ids and a fixed creation timestamp, which
 * buys two things: seeding is idempotent however many times it runs, and two
 * fresh installs produce byte-identical defaults, so importing one into the
 * other skips them as duplicates instead of stacking up a second "Work".
 */
const BUILT_IN_EPOCH = '2020-01-01T00:00:00.000Z';

export function newCategory(fields: {
  name: string;
  nameJa?: string | null;
  color: string;
  order: number;
  system?: boolean;
  id?: string;
}): Category {
  const now = nowIso();
  return {
    id: fields.id ?? uuid(),
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    deletedAt: null,
    name: fields.name,
    nameJa: fields.nameJa ?? null,
    color: fields.color,
    order: fields.order,
    system: fields.system ?? false,
  };
}

export const DEFAULT_SETTINGS: Omit<Settings, 'updatedAt'> = {
  id: 'app',
  lang: 'en',
  skin: 'slate',
  calendarView: 'month',
  storageWarningDismissed: false,
  syncedAt: null,
};

function builtIn(
  id: string,
  name: string,
  nameJa: string,
  color: string,
  order: number,
  system = false,
): Category {
  return {
    id,
    createdAt: BUILT_IN_EPOCH,
    updatedAt: BUILT_IN_EPOCH,
    syncedAt: null,
    deletedAt: null,
    name,
    nameJa,
    color,
    order,
    system,
  };
}

/** The categories a brand-new install starts with. */
export function defaultCategories(): Category[] {
  return [
    // Mid-tone hues, picked to stay legible on the light palettes and to stay
    // visible on the dark ones. A category's colour is user data, so switching
    // palette never rewrites it.
    builtIn('cat-work', 'Work', '仕事', '#5B6BE8', 0),
    builtIn('cat-ideas', 'Ideas', 'アイデア', '#17A08A', 1),
    builtIn('cat-chores', 'Chores', '家事', '#CC7A22', 2),
    builtIn('cat-hobby', 'Hobby', '趣味', '#A45CD6', 3),
    builtIn(UNCATEGORISED_ID, 'Uncategorised', '未分類', '#7C8698', 99, true),
  ];
}

let bootstrapping: Promise<{ settings: Settings; categories: Category[] }> | null = null;

/**
 * Called at startup. Seeds the default categories on a fresh install and
 * guarantees Uncategorised exists, since the composer falls back to it and a
 * missing one would strand notes.
 *
 * Concurrent callers share one run. React's StrictMode fires mount effects
 * twice in development, and two racing seeds used to produce two of every
 * category; the fixed ids above make that harmless, and this makes it moot.
 */
export function bootstrap(): Promise<{ settings: Settings; categories: Category[] }> {
  bootstrapping ??= runBootstrap().finally(() => {
    bootstrapping = null;
  });
  return bootstrapping;
}

async function runBootstrap(): Promise<{ settings: Settings; categories: Category[] }> {
  const existing = await list('categories', { includeDeleted: true });
  if (existing.length === 0) {
    await putMany('categories', defaultCategories());
  } else if (!existing.some((c) => c.id === UNCATEGORISED_ID)) {
    await putMany('categories', [
      builtIn(UNCATEGORISED_ID, 'Uncategorised', '未分類', '#6B7085', 99, true),
    ]);
  }

  let settings = await get('settings', 'app');
  if (!settings) {
    settings = { ...DEFAULT_SETTINGS, updatedAt: nowIso() };
    await putMany('settings', [settings]);
  }

  const categories = (await list('categories')).sort((a, b) => a.order - b.order);
  return { settings, categories };
}
