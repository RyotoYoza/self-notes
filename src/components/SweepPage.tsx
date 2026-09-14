import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { UNCATEGORISED_ID } from '../storage';
import { Icon } from './Icons';
import { shortStamp } from '../lib/dates';

/**
 * Filing the pile that Uncategorised accumulates.
 *
 * Making a category mandatory before sending is the right rule, but it puts a
 * decision in front of every thought — so "Uncategorised, sort it later"
 * quietly becomes the fast lane. This is the "later": one note at a time, the
 * chips right under it, so a backlog of twenty takes seconds rather than
 * twenty long-presses.
 */
export function SweepPage({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const { t, settings, notes, categories, categoryLabel, patchNote } = useStore();
  const [index, setIndex] = useState(0);
  const [filed, setFiled] = useState(0);

  const pile = useMemo(
    () => notes.filter((n) => n.categoryId === UNCATEGORISED_ID),
    [notes],
  );
  const targets = useMemo(
    () => categories.filter((c) => c.id !== UNCATEGORISED_ID),
    [categories],
  );

  // Filing a note removes it from the pile, so the next one slides into this
  // same index. Skipping is what moves the pointer forward.
  const remaining = pile.slice(index);
  const current = remaining[0];

  async function file(categoryId: string) {
    if (!current) return;
    await patchNote(current.id, { categoryId });
    setFiled((n) => n + 1);
  }

  const progress = current ? t.sweepProgress(filed + 1, pile.length + filed) : null;

  return (
    <>
      {/* On a phone the app bar already names this screen, so the header would
          repeat it — and its Done button would push the row off the edge. */}
      {!isMobile && (
        <header className="head">
          <span className="head-title">
            <Icon.tag />
            <span className="nm">{t.sweepTitle}</span>
          </span>
          {progress && <span className="head-sub">{progress}</span>}
          <button type="button" className="btn ghost sweep-close" onClick={onClose}>
            {t.sweepClose}
          </button>
        </header>
      )}

      <div className="sweep">
        {isMobile && (
          <div className="sweep-top">
            <span className="p">{progress}</span>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t.sweepClose}
            </button>
          </div>
        )}
        {!current ? (
          <p className="empty">
            <b>{t.sweepDone}</b>
            {filed > 0 ? t.sweepFiled(filed) : t.sweepDoneHint}
          </p>
        ) : (
          <>
            <div className="sweep-card">
              <p className="sweep-time">{shortStamp(current.createdAt, t, settings.lang)}</p>
              <p className="sweep-text">{current.text}</p>
              {remaining.length > 1 && (
                <span className="sweep-stack" aria-hidden="true">
                  <i />
                  <i />
                </span>
              )}
            </div>

            <p className="sweep-label">{t.sweepPick}</p>
            <div className="sweep-chips">
              {targets.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="sweep-chip"
                  style={{ ['--c' as string]: c.color }}
                  onClick={() => void file(c.id)}
                >
                  <span className="dot" />
                  {categoryLabel(c)}
                </button>
              ))}
            </div>

            <button type="button" className="sweep-skip" onClick={() => setIndex((i) => i + 1)}>
              {t.sweepSkip}
            </button>
          </>
        )}
      </div>
    </>
  );
}
