import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Note } from '../storage';
import { Icon } from './Icons';
import { dayKey } from '../lib/dates';
import { NoteBubble } from './NoteBubble';
import type { MenuAnchor } from './NoteMenu';

/**
 * The right-hand pane: one running conversation with yourself across every
 * category, and the composer underneath. Choosing a category is required
 * before the send button will do anything — that rule is the whole filing
 * system, so it is enforced here rather than cleaned up later.
 */
export function ChatPane({
  onMenu,
  replyTo,
  onClearReply,
}: {
  onMenu: (a: MenuAnchor) => void;
  replyTo: Note | null;
  onClearReply: () => void;
}) {
  const { t, notes, categories, categoryLabel, sendNote, settings } = useStore();
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [nagging, setNagging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const today = dayKey(new Date());
  const todays = useMemo(
    () => notes.filter((n) => dayKey(n.createdAt) === today),
    [notes, today],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [todays.length]);

  // Adding a note onto another inherits its category, so the added note cannot
  // drift into a different part of the app than the note it belongs to.
  useEffect(() => {
    if (replyTo) {
      setCategoryId(replyTo.categoryId);
      inputRef.current?.focus();
    }
  }, [replyTo]);

  const canSend = text.trim().length > 0 && categoryId !== null;

  async function submit() {
    if (!text.trim()) return;
    if (!categoryId) {
      setNagging(true);
      return;
    }
    await sendNote({
      text: text.trim(),
      categoryId,
      scheduled,
      urgent,
      parentId: replyTo?.id ?? null,
    });
    setText('');
    setScheduled(false);
    setUrgent(false);
    setNagging(false);
    onClearReply();
    inputRef.current?.focus();
  }

  return (
    <>
      <header className="chat-head">
        <b>{t.composerTitle}</b>
        <span>{t.todayCount(todays.length)}</span>
      </header>

      <div className="stream">
        <div className="filler" />
        {todays.map((n) => (
          <NoteBubble key={n.id} note={n} showCategory onMenu={onMenu} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        {replyTo && (
          <div className="reply-banner">
            <Icon.reply />
            <span className="tx">
              {t.replyingTo}: {replyTo.text}
            </span>
            <button type="button" className="iconbtn" onClick={onClearReply} aria-label={t.cancel}>
              ×
            </button>
          </div>
        )}

        <div className="chips" role="radiogroup" aria-label={t.categories}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={categoryId === c.id}
              className={`chip${categoryId === c.id ? ' on' : ''}`}
              style={{ ['--c' as string]: c.color }}
              onClick={() => {
                setCategoryId(c.id);
                setNagging(false);
              }}
            >
              <span className="dot" />
              {categoryLabel(c)}
            </button>
          ))}
        </div>

        <div className="toggles">
          <button
            type="button"
            className={`tog${scheduled ? ' on' : ''}`}
            aria-pressed={scheduled}
            onClick={() => setScheduled((v) => !v)}
          >
            <i /> {t.schedule}
          </button>
          <button
            type="button"
            className={`tog warn${urgent ? ' on' : ''}`}
            aria-pressed={urgent}
            onClick={() => setUrgent((v) => !v)}
          >
            <i /> {t.urgent}
          </button>
        </div>

        <div className="inputbar">
          <textarea
            id="composer-input"
            ref={inputRef}
            rows={1}
            value={text}
            lang={settings.lang}
            placeholder={categoryId ? t.placeholder : t.placeholderPickCategory}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a new line — the chat convention.
              // IME composition must be left alone or Japanese input sends
              // halfway through a conversion.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button
            type="button"
            className="send"
            disabled={!canSend}
            aria-label={t.send}
            onClick={() => void submit()}
          >
            <Icon.send />
          </button>
        </div>
        {nagging && !categoryId && <p className="hint">{t.pickCategoryHint}</p>}
      </div>
    </>
  );
}
