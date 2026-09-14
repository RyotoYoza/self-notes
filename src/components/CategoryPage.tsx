import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { UNCATEGORISED_ID } from '../storage';
import type { Category, Note } from '../storage';
import { Icon } from './Icons';
import { dayKey, dayLabel, shortStamp } from '../lib/dates';
import { NoteBubble } from './NoteBubble';
import type { MenuAnchor } from './NoteMenu';

/**
 * A category, read as a chat thread: urgent notes pinned across the top,
 * everything else below in the order it was sent, split by day.
 */
export function CategoryPage({
  category,
  onMenu,
  isMobile,
}: {
  category: Category;
  onMenu: (a: MenuAnchor) => void;
  isMobile: boolean;
}) {
  const { t, settings, notes, categoryLabel, focusNoteId, clearFocus, setView } = useStore();
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // The pinned block keeps to two rows until asked, so a category with nine
  // urgent notes cannot squeeze the thread off the screen.
  const [urgentOpen, setUrgentOpen] = useState(false);

  const mine = useMemo(
    () => notes.filter((n) => n.categoryId === category.id),
    [notes, category.id],
  );
  const originals = useMemo(() => mine.filter((n) => n.parentId === null), [mine]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of mine) {
      if (!n.parentId) continue;
      const bucket = map.get(n.parentId);
      if (bucket) bucket.push(n);
      else map.set(n.parentId, [n]);
    }
    return map;
  }, [mine]);
  const urgent = useMemo(() => mine.filter((n) => n.urgent), [mine]);

  // New notes land at the bottom, the way a chat does.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [category.id, mine.length]);

  useEffect(() => setUrgentOpen(false), [category.id]);

  // Arriving from the calendar: scroll the note into view, then let the
  // highlight fade so it does not stay lit forever.
  useEffect(() => {
    if (!focusNoteId) return;
    const el = threadRef.current?.querySelector(`[data-note="${focusNoteId}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const id = window.setTimeout(clearFocus, 2200);
    return () => window.clearTimeout(id);
  }, [focusNoteId, clearFocus]);

  let lastDay = '';

  return (
    <>
      {/* On a phone the app bar already names the conversation, so this row
          would only repeat it. */}
      {!isMobile && (
        <header className="head">
          <span className="head-title" style={{ ['--c' as string]: category.color }}>
            <span className="dot" />
            <span className="nm">{categoryLabel(category)}</span>
          </span>
          <span className="head-sub">{t.notesCount(mine.length)}</span>
          {category.id === UNCATEGORISED_ID && mine.length > 0 && (
            <button
              type="button"
              className="btn ghost sweep-open"
              onClick={() => setView({ kind: 'sweep' })}
            >
              {t.sweep}
            </button>
          )}
        </header>
      )}

      {urgent.length > 0 && (
        <section
          className={`pinned${urgentOpen ? ' open' : ''}`}
          aria-label={t.urgentCount(urgent.length)}
        >
          <p className="pin-head">
            <Icon.flag />
            {t.urgentCount(urgent.length)}
            {urgent.length > COLLAPSED_URGENT && (
              <button
                type="button"
                className="pin-toggle"
                aria-expanded={urgentOpen}
                onClick={() => setUrgentOpen((v) => !v)}
              >
                {urgentOpen
                  ? t.collapseUrgent
                  : t.expandUrgent(urgent.length - COLLAPSED_URGENT)}
                <Icon.down />
              </button>
            )}
          </p>
          <div className="pin-list">
            {(urgentOpen ? urgent : urgent.slice(0, COLLAPSED_URGENT)).map((n) => (
              <button
                key={n.id}
                type="button"
                className="pin"
                onClick={() => {
                  const el = threadRef.current?.querySelector(`[data-note="${n.id}"]`);
                  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}
              >
                <span className="tx">{n.text}</span>
                <span className="tm">{shortStamp(n.createdAt, t, settings.lang)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {isMobile && category.id === UNCATEGORISED_ID && mine.length > 0 && (
        <button type="button" className="sweep-bar" onClick={() => setView({ kind: 'sweep' })}>
          <Icon.tag />
          <span>{t.sweep}</span>
          <span className="n">{mine.length}</span>
        </button>
      )}

      <div className="thread" ref={threadRef}>
        {originals.length === 0 && (
          <p className="empty">
            <b>{t.emptyCategory}</b>
            {isMobile ? t.emptyCategoryHintMobile : t.emptyCategoryHint}
          </p>
        )}

        {originals.map((note) => {
          const key = dayKey(note.createdAt);
          const newDay = key !== lastDay;
          lastDay = key;
          const replies = repliesByParent.get(note.id) ?? [];
          return (
            <div key={note.id} style={{ display: 'contents' }}>
              {newDay && (
                <div className="daysep">
                  <span>{dayLabel(note.createdAt, t, settings.lang)}</span>
                </div>
              )}
              <NoteBubble note={note} onMenu={onMenu} focused={focusNoteId === note.id} />
              {replies.map((r) => (
                <NoteBubble
                  key={r.id}
                  note={r}
                  side="left"
                  quote={truncate(note.text)}
                  focused={focusNoteId === r.id}
                  onMenu={onMenu}
                />
              ))}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </>
  );
}

/** How many urgent notes the pinned block shows before you ask for the rest. */
const COLLAPSED_URGENT = 2;

function truncate(text: string, max = 46): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
