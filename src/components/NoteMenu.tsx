import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Note } from '../storage';
import { Icon } from './Icons';
import { dateInputValue, fromDateInput } from '../lib/dates';

export interface MenuAnchor {
  note: Note;
  x: number;
  y: number;
}

/**
 * The note actions. Opened three ways so every device has an obvious one:
 * long-press on touch, the hover "···" button, and right-click on desktop.
 */
export function NoteMenu({
  anchor,
  onClose,
  onAddNote,
}: {
  anchor: MenuAnchor;
  onClose: () => void;
  onAddNote: (note: Note) => void;
}) {
  const { t, categories, categoryLabel, patchNote, deleteNote } = useStore();
  const [pane, setPane] = useState<'root' | 'category' | 'date'>('root');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y });
  const note = anchor.note;

  // Keep the menu on screen no matter which corner it was opened from.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.min(Math.max(pad, anchor.x), window.innerWidth - r.width - pad),
      top: Math.min(Math.max(pad, anchor.y), window.innerHeight - r.height - pad),
    });
  }, [anchor.x, anchor.y, pane]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async (fn: () => Promise<void> | void) => {
    await fn();
    onClose();
  };

  return (
    <>
      <div className="scrim" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="menu" ref={ref} style={pos} role="menu" aria-label={t.addNote}>
        {pane === 'root' && (
          <>
            <button type="button" role="menuitem" onClick={() => act(() => onAddNote(note))}>
              <Icon.reply /> {t.addNote}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => act(() => patchNote(note.id, { urgent: !note.urgent }))}
            >
              <Icon.flag /> {note.urgent ? t.clearUrgent : t.makeUrgent}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                note.scheduled
                  ? act(() => patchNote(note.id, { scheduled: false }))
                  : act(() => patchNote(note.id, { scheduled: true }))
              }
            >
              <Icon.cal /> {note.scheduled ? t.removeFromCalendar : t.addToCalendar}
            </button>
            {note.scheduled && (
              <button type="button" role="menuitem" onClick={() => setPane('date')}>
                <Icon.cal /> {t.changeDate}
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => setPane('category')}>
              <Icon.tag /> {t.moveTo}
            </button>
            <hr />
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                if (confirm(t.confirmDelete)) act(() => deleteNote(note.id));
                else onClose();
              }}
            >
              <Icon.trash /> {t.deleteNote}
            </button>
          </>
        )}

        {pane === 'category' && (
          <>
            <p className="mlabel">{t.moveTo}</p>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitem"
                onClick={() => act(() => patchNote(note.id, { categoryId: c.id }))}
              >
                <span className="dot" style={{ ['--c' as string]: c.color }} />
                {categoryLabel(c)}
              </button>
            ))}
          </>
        )}

        {pane === 'date' && (
          <>
            <p className="mlabel">{t.changeDate}</p>
            <input
              id={`date-${note.id}`}
              type="date"
              defaultValue={dateInputValue(note.scheduledFor)}
              onChange={(e) => {
                if (!e.target.value) return;
                act(() => patchNote(note.id, { scheduledFor: fromDateInput(e.target.value) }));
              }}
            />
          </>
        )}
      </div>
    </>
  );
}

/**
 * Wires all three open gestures onto a bubble. Long-press is 480ms and is
 * cancelled by a scroll, so flicking through a thread never opens the menu.
 */
export function useNoteGestures(note: Note, open: (a: MenuAnchor) => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      open({ note, x: e.clientX, y: e.clientY });
    },
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        open({ note, x: touch.clientX, y: touch.clientY });
      }, 480);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - s.x) > 10 || Math.abs(touch.clientY - s.y) > 10) clear();
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}
