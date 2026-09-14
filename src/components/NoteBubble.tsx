import { useStore } from '../state/store';
import type { Note } from '../storage';
import { Icon } from './Icons';
import { formatTime } from '../lib/dates';
import { useNoteGestures, type MenuAnchor } from './NoteMenu';

/**
 * One note. The same component draws the thread, the added notes underneath it
 * and the running stream in the chat pane, so a note looks identical wherever
 * you meet it.
 */
export function NoteBubble({
  note,
  side = 'right',
  quote,
  showCategory = false,
  focused = false,
  onMenu,
}: {
  note: Note;
  side?: 'right' | 'left';
  quote?: string;
  showCategory?: boolean;
  focused?: boolean;
  onMenu: (a: MenuAnchor) => void;
}) {
  const { t, categoryById, categoryLabel } = useStore();
  const gestures = useNoteGestures(note, onMenu);
  const category = categoryById(note.categoryId);

  return (
    <div className={side === 'left' ? 'row left' : 'row'} data-note={note.id}>
      <div className="row-meta">
        {side === 'left' && <span>{t.addedNote}</span>}
        {showCategory && category && (
          <span className="cat-tag" style={{ ['--c' as string]: category.color }}>
            <span className="dot" />
            {categoryLabel(category)}
          </span>
        )}
        {note.scheduled && (
          <span className="sched-tag">
            <Icon.cal />
            {t.scheduled}
          </span>
        )}
        <span>{formatTime(note.createdAt)}</span>
      </div>

      <div className="bub-wrap">
        <div
          className={`bub${note.urgent ? ' urgent' : ''}${focused ? ' focused' : ''}`}
          {...gestures}
        >
          {quote && <span className="quote">{quote}</span>}
          {note.text}
        </div>
        <button
          type="button"
          className="dots"
          aria-label={t.addNote}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onMenu({ note, x: r.left, y: r.bottom + 4 });
          }}
        >
          <Icon.dots />
        </button>
      </div>
    </div>
  );
}
