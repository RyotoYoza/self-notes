# Self / じぶんメモ

A note app you use like a chat with yourself. Pick a category, type, send.

    npm install
    npm run dev      # http://localhost:5173
    npm test         # 16 tests, including the export/import round trip
    npm run build    # static site in dist/

## Where things are

    src/storage/     IndexedDB. The ONLY place that touches it.
                     Narrow interface: get, put, list, remove.
    src/state/       React store — loads from storage, holds the UI state.
    src/components/  Rail, category page, chat composer, calendar, settings.
    src/styles/      tokens.css holds both skins; nothing else defines a colour.
    src/i18n/        Every string, English and Japanese side by side.
    design/          The visual direction pitch and the build tracker.

## Two rules worth keeping

**Nothing outside `src/storage/` imports Dexie or opens IndexedDB.** When a
backend arrives, that directory changes and the rest of the app does not.

**Records are never hard-deleted.** `remove()` writes a `deletedAt` tombstone,
so a deletion can still be replayed to a server that has not seen it yet.

## Backups

Settings → Export all notes writes `self-notes-YYYY-MM-DD.json`: every note,
every category, the settings, and the schema version. Import merges it in —
unknown records are added, identical ones skipped, and a record that conflicts
with a local one is kept *alongside* it rather than overwriting. Export → wipe
→ import restoring identical state is covered by a test, not by hope.
