/**
 * The guarantee this file exists to protect:
 *
 *   export -> wipe local data -> import  ==  the state you started with
 *
 * If this ever fails, someone's notes are unrecoverable from their backup,
 * so it is the first test written and the last one allowed to break.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _useDatabase,
  bootstrap,
  exportAll,
  exportFilename,
  get,
  importAll,
  list,
  newNote,
  parseExportFile,
  put,
  remove,
  uuid,
  wipe,
  UNCATEGORISED_ID,
  type ExportFile,
  type Note,
} from '../storage';

let dbCount = 0;

async function freshApp() {
  _useDatabase(`test-${dbCount++}-${uuid()}`);
  return bootstrap();
}

/** A small but representative body of data: replies, urgency, schedule, deletions. */
async function seedRealisticData() {
  const { categories } = await freshApp();
  const work = categories.find((c) => c.name === 'Work')!;
  const hobby = categories.find((c) => c.name === 'Hobby')!;

  const original = await put(
    'notes',
    newNote({
      text: 'Ship the Q3 handover doc before Friday standup',
      categoryId: work.id,
      urgent: true,
    }),
  );
  await put(
    'notes',
    newNote({
      text: 'Invoice ref INV-2291. Finance needs it by the 20th.',
      categoryId: work.id,
      parentId: original.id,
    }),
  );
  await put(
    'notes',
    newNote({
      text: 'Darkroom booked — drop the film off the day before',
      categoryId: hobby.id,
      scheduled: true,
      scheduledFor: '2026-09-20T00:00:00.000Z',
    }),
  );
  await put(
    'notes',
    newNote({ text: 'Deal with this later', categoryId: UNCATEGORISED_ID }),
  );

  const doomed = await put(
    'notes',
    newNote({ text: 'Typo, replaced by the note above', categoryId: work.id }),
  );
  await remove('notes', doomed.id);

  // Re-read so the test holds the tombstoned record, not the pre-delete one.
  return { work, hobby, original, doomed: (await get('notes', doomed.id))! };
}

/** exportedAt is a timestamp of the export itself, not part of the state. */
function comparable(file: ExportFile) {
  const { exportedAt: _ignored, ...rest } = file;
  return rest;
}

describe('export / import round trip', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('restores an identical app state after a full wipe', async () => {
    await seedRealisticData();

    const before = await exportAll();
    const notesBefore = await list('notes', { includeDeleted: true });
    const catsBefore = await list('categories', { includeDeleted: true });
    const settingsBefore = await get('settings', 'app');

    await wipe();
    expect(await list('notes', { includeDeleted: true })).toHaveLength(0);
    expect(await list('categories', { includeDeleted: true })).toHaveLength(0);

    // Import the file exactly as it would come back off disk.
    const summary = await importAll(parseExportFile(JSON.stringify(before)));

    expect(summary.notesKeptBoth).toBe(0);
    expect(summary.categoriesKeptBoth).toBe(0);
    expect(summary.notesSkipped).toBe(0);
    expect(summary.notesImported).toBe(before.notes.length);
    expect(summary.settingsRestored).toBe(true);

    const after = await exportAll();
    expect(comparable(after)).toEqual(comparable(before));

    // And the same through the app's own read path, not just the export path.
    expect(await list('notes', { includeDeleted: true })).toEqual(notesBefore);
    expect(await list('categories', { includeDeleted: true })).toEqual(catsBefore);
    expect(await get('settings', 'app')).toEqual(settingsBefore);
  });

  it('survives a second round trip unchanged', async () => {
    await seedRealisticData();
    const first = await exportAll();

    await wipe();
    await importAll(parseExportFile(JSON.stringify(first)));
    const second = await exportAll();

    await wipe();
    await importAll(parseExportFile(JSON.stringify(second)));
    const third = await exportAll();

    expect(comparable(third)).toEqual(comparable(first));
  });

  it('keeps soft-deleted notes deleted after the round trip', async () => {
    const { doomed } = await seedRealisticData();
    const file = await exportAll();

    await wipe();
    await importAll(parseExportFile(JSON.stringify(file)));

    const restored = await get('notes', doomed.id);
    expect(restored?.deletedAt).toEqual(doomed.deletedAt);
    expect((await list('notes')).some((n) => n.id === doomed.id)).toBe(false);
  });

  it('keeps a reply attached to its original note', async () => {
    const { original } = await seedRealisticData();
    const file = await exportAll();

    await wipe();
    await importAll(parseExportFile(JSON.stringify(file)));

    const replies = (await list('notes')).filter((n) => n.parentId === original.id);
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toContain('INV-2291');
  });
});

describe('import is a merge, not a replace', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('skips records that are already here, unchanged', async () => {
    await seedRealisticData();
    const file = await exportAll();

    const summary = await importAll(parseExportFile(JSON.stringify(file)));

    expect(summary.notesImported).toBe(0);
    expect(summary.notesKeptBoth).toBe(0);
    expect(summary.notesSkipped).toBe(file.notes.length);
    expect(summary.categoriesSkipped).toBe(file.categories.length);
    expect(await list('notes', { includeDeleted: true })).toHaveLength(file.notes.length);
  });

  it('keeps both when the same id holds different text, and never overwrites', async () => {
    const { original } = await seedRealisticData();
    const file = await exportAll();

    // The note is edited on this device after the backup was taken.
    const edited = await put('notes', {
      ...(await get('notes', original.id))!,
      text: 'Handover doc — pushed to Monday, Mori is covering',
    });

    const summary = await importAll(parseExportFile(JSON.stringify(file)));

    expect(summary.notesKeptBoth).toBe(1);

    // The local edit is untouched.
    const localNow = await get('notes', original.id);
    expect(localNow!.text).toBe(edited.text);

    // The incoming version survives too, under a new id, pointing back.
    const copies = (await list('notes')).filter((n) => n.importedFrom === original.id);
    expect(copies).toHaveLength(1);
    expect(copies[0].id).not.toBe(original.id);
    expect(copies[0].text).toBe('Ship the Q3 handover doc before Friday standup');
  });

  it('rewrites a reply to point at the kept-both copy of its parent', async () => {
    const { original } = await seedRealisticData();

    // Build a file where BOTH the parent and its reply differ from local.
    const file = await exportAll();
    const conflicting: ExportFile = {
      ...file,
      notes: file.notes.map((n): Note => {
        if (n.id === original.id) return { ...n, text: 'A different original' };
        if (n.parentId === original.id) return { ...n, text: 'A different reply' };
        return n;
      }),
    };

    await importAll(conflicting);

    const copyOfParent = (await list('notes')).find((n) => n.importedFrom === original.id)!;
    const copyOfReply = (await list('notes')).find((n) => n.text === 'A different reply')!;

    expect(copyOfReply.parentId).toBe(copyOfParent.id);
    expect(copyOfReply.parentId).not.toBe(original.id);
  });

  it('merges notes from a device that has categories this one has never seen', async () => {
    await seedRealisticData();
    const file = await exportAll();

    const strangerCatId = uuid();
    const strangerNoteId = uuid();
    const fromAnotherDevice: ExportFile = {
      ...file,
      categories: [
        ...file.categories,
        {
          id: strangerCatId,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          syncedAt: null,
          deletedAt: null,
          name: 'Reading',
          nameJa: '読書',
          color: '#2F5D62',
          order: 4,
          system: false,
        },
      ],
      notes: [
        ...file.notes,
        {
          id: strangerNoteId,
          createdAt: '2026-01-02T09:00:00.000Z',
          updatedAt: '2026-01-02T09:00:00.000Z',
          syncedAt: null,
          deletedAt: null,
          text: 'Finish the Le Guin before the loan expires',
          categoryId: strangerCatId,
          parentId: null,
          scheduled: false,
          scheduledFor: null,
          urgent: false,
        },
      ],
    };

    const summary = await importAll(fromAnotherDevice);

    expect(summary.categoriesImported).toBe(1);
    expect(summary.notesImported).toBe(1);
    expect((await get('notes', strangerNoteId))!.categoryId).toBe(strangerCatId);
  });
});

describe('import refuses files it should not accept', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('rejects JSON that did not come from this app', () => {
    expect(() => parseExportFile('{"hello":"world"}')).toThrow(/not exported from this app/i);
  });

  it('rejects text that is not JSON at all', () => {
    expect(() => parseExportFile('not json')).toThrow(/not valid JSON/i);
  });

  it('rejects a file from a future schema rather than guessing', () => {
    expect(() =>
      parseExportFile(JSON.stringify({ app: 'self-notes', schemaVersion: 99, notes: [], categories: [] })),
    ).toThrow(/newer version/i);
  });
});

describe('export filename', () => {
  it('carries the date so backups sort and never overwrite each other', () => {
    expect(exportFilename(new Date('2026-09-14T22:10:00Z'))).toBe('self-notes-2026-09-14.json');
  });
});

describe('bootstrap', () => {
  it('seeds exactly one set of categories even when called twice at once', async () => {
    _useDatabase(`test-boot-${uuid()}`);
    const [a, b] = await Promise.all([bootstrap(), bootstrap()]);
    expect(a.categories).toHaveLength(5);
    expect(b.categories).toHaveLength(5);
    expect(await list('categories')).toHaveLength(5);
  });

  it('is idempotent across restarts', async () => {
    _useDatabase(`test-boot2-${uuid()}`);
    await bootstrap();
    await bootstrap();
    await bootstrap();
    const cats = await list('categories');
    expect(cats).toHaveLength(5);
    expect(cats.filter((c) => c.name === 'Work')).toHaveLength(1);
  });

  it('gives two fresh installs identical default categories, so a merge does not duplicate them', async () => {
    _useDatabase(`test-dev-a-${uuid()}`);
    const deviceA = (await bootstrap()).categories;
    _useDatabase(`test-dev-b-${uuid()}`);
    await bootstrap();
    const deviceB = await exportAll();

    // Import device B's backup into a database holding device A's defaults.
    _useDatabase(`test-dev-a2-${uuid()}`);
    await bootstrap();
    const summary = await importAll(deviceB);

    expect(summary.categoriesSkipped).toBe(5);
    expect(summary.categoriesKeptBoth).toBe(0);
    expect(await list('categories')).toHaveLength(5);
    expect(deviceA.map((c) => c.id).sort()).toEqual(
      (await list('categories')).map((c) => c.id).sort(),
    );
  });
});

describe('timestamps', () => {
  it('keeps notes fired off in the same millisecond in the order they were sent', async () => {
    _useDatabase(`test-order-${uuid()}`);
    await bootstrap();

    const texts = ['first thought', 'second thought', 'third thought', 'fourth thought'];
    const created: string[] = [];
    for (const text of texts) {
      const n = await put('notes', newNote({ text, categoryId: UNCATEGORISED_ID }));
      created.push(n.createdAt);
    }

    // Strictly increasing, so a sort by createdAt can never scramble them.
    for (let i = 1; i < created.length; i++) {
      expect(created[i] > created[i - 1]).toBe(true);
    }

    const inOrder = (await list('notes')).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    expect(inOrder.map((n) => n.text)).toEqual(texts);
  });
});
