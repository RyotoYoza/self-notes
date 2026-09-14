/**
 * Record shapes. Every record carries the four sync fields from day one so that
 * adding a server later is a change inside src/storage/ and nowhere else.
 *
 * deletedAt is a soft delete. Nothing in this app ever hard-deletes a record,
 * because a hard delete cannot be replayed to a server that has not seen it yet.
 */

export const SCHEMA_VERSION = 1;

/** Fields shared by everything that will one day sync. */
export interface SyncFields {
  /** UUID v4, generated on this device at creation time. */
  id: string;
  /** ISO 8601, UTC. */
  createdAt: string;
  /** ISO 8601, UTC. Bumped on every write. */
  updatedAt: string;
  /** ISO 8601, UTC. null until a server acknowledges this record. */
  syncedAt: string | null;
  /** ISO 8601, UTC. null while the record is live. */
  deletedAt: string | null;
}

export interface Note extends SyncFields {
  /** The note itself, as typed. */
  text: string;
  /** Category this note was filed under. Always set — see UNCATEGORISED_ID. */
  categoryId: string;
  /**
   * Set when this note was added onto another note (the "reply" in the thread).
   * null for original notes. Only originals appear on the calendar.
   */
  parentId: string | null;
  /** On the calendar when true. */
  scheduled: boolean;
  /** ISO 8601 date, UTC. The day this note sits on in the calendar. */
  scheduledFor: string | null;
  /** Red, bold, and pinned to the top of its category page. */
  urgent: boolean;
  /** Set when an import kept this alongside a conflicting local record. */
  importedFrom?: string;
}

export interface Category extends SyncFields {
  /** Primary label. */
  name: string;
  /** Japanese label. Falls back to `name` when null. */
  nameJa: string | null;
  /** Hex, e.g. "#4B4ACF". Drives the dot, the chip and the calendar mark. */
  color: string;
  /** Ascending. Position in the left rail. */
  order: number;
  /** Built-in and undeletable (currently only Uncategorised). */
  system: boolean;
  /** Set when an import kept this alongside a conflicting local record. */
  importedFrom?: string;
}

export type Lang = 'en' | 'ja';
export type Skin = 'slate' | 'graphite' | 'obsidian' | 'porcelain' | 'bone' | 'system';
export type CalendarView = 'month' | 'week';

export interface Settings {
  /** Always "app" — there is exactly one settings record. */
  id: string;
  lang: Lang;
  skin: Skin;
  calendarView: CalendarView;
  /** The storage-persistence warning is shown once per install, not every launch. */
  storageWarningDismissed: boolean;
  updatedAt: string;
  syncedAt: string | null;
}

export type Collection = 'notes' | 'categories' | 'settings';

export interface CollectionMap {
  notes: Note;
  categories: Category;
  settings: Settings;
}

/** The on-disk shape of an export file. */
export interface ExportFile {
  /** Guards against importing an unrelated JSON file. */
  app: 'self-notes';
  schemaVersion: number;
  exportedAt: string;
  notes: Note[];
  categories: Category[];
  settings: Settings | null;
}

export interface ImportSummary {
  notesImported: number;
  notesSkipped: number;
  notesKeptBoth: number;
  categoriesImported: number;
  categoriesSkipped: number;
  categoriesKeptBoth: number;
  settingsRestored: boolean;
}

export const UNCATEGORISED_ID = 'uncategorised';
