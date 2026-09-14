import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import type { Note } from '../storage';
import { Icon } from './Icons';
import {
  addDays,
  addMonths,
  dayKey,
  isSameMonth,
  isToday,
  monthGrid,
  weekDays,
} from '../lib/dates';

/**
 * Home. Only original notes appear here — an added note belongs to the note it
 * was written onto, not to a day of its own. Tapping one opens its category.
 */
export function HomeCalendar() {
  const { t, settings, notes, categoryById, focusNote, setSettings } = useStore();
  const [anchor, setAnchor] = useState(() => new Date());
  const view = settings.calendarView;

  const byDay = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      if (!n.scheduled || n.parentId !== null || !n.scheduledFor) continue;
      const key = dayKey(n.scheduledFor);
      const bucket = map.get(key);
      if (bucket) bucket.push(n);
      else map.set(key, [n]);
    }
    return map;
  }, [notes]);

  const scheduledCount = useMemo(
    () => [...byDay.values()].reduce((sum, list) => sum + list.length, 0),
    [byDay],
  );

  const step = (dir: number) =>
    setAnchor((a) => (view === 'month' ? addMonths(a, dir) : addDays(a, dir * 7)));

  const days = view === 'month' ? monthGrid(anchor) : weekDays(anchor);
  const weekLabel = () => {
    const [first] = days;
    const last = days[days.length - 1];
    return settings.lang === 'ja'
      ? `${first.getMonth() + 1}月${first.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`
      : `${first.getDate()} ${t.months[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${t.months[
          last.getMonth()
        ].slice(0, 3)}`;
  };

  const chipFor = (n: Note) => {
    const c = categoryById(n.categoryId);
    return (
      <button
        key={n.id}
        type="button"
        className={`cal-chip${n.urgent ? ' urgent' : ''}`}
        style={{ ['--c' as string]: c?.color ?? 'var(--accent)' }}
        onClick={() => focusNote(n.id, n.categoryId)}
        title={n.text}
      >
        {n.text}
      </button>
    );
  };

  return (
    <>
      <header className="head">
        <span className="head-title">
          <Icon.cal />
          <span className="nm">{t.home}</span>
        </span>
        <span className="head-sub">{t.notesCount(scheduledCount)}</span>
        <div className="seg-views" role="group" aria-label={t.home}>
          <button
            type="button"
            className={view === 'week' ? 'on' : ''}
            onClick={() => void setSettings({ calendarView: 'week' })}
          >
            {t.week}
          </button>
          <button
            type="button"
            className={view === 'month' ? 'on' : ''}
            onClick={() => void setSettings({ calendarView: 'month' })}
          >
            {t.month}
          </button>
        </div>
      </header>

      <div className="cal">
        <div className="cal-bar">
          <h2>{view === 'month' ? t.months[anchor.getMonth()] : weekLabel()}</h2>
          <span className="yr">{anchor.getFullYear()}</span>
          <div className="cal-nav">
            <button type="button" onClick={() => step(-1)} aria-label="Previous">
              <Icon.left />
            </button>
            <button type="button" className="today-btn" onClick={() => setAnchor(new Date())}>
              {t.todayButton}
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next">
              <Icon.right />
            </button>
          </div>
        </div>

        {scheduledCount === 0 && (
          <p className="empty">
            <b>{t.noScheduled}</b>
            {t.noScheduledHint}
          </p>
        )}

        {view === 'month' ? (
          <>
            <div className="cal-dow" aria-hidden="true">
              {t.weekdaysShort.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="cal-grid">
              {days.map((d) => {
                const list = byDay.get(dayKey(d)) ?? [];
                return (
                  <div
                    key={d.toISOString()}
                    className={`cal-cell${isSameMonth(d, anchor) ? '' : ' out'}${
                      isToday(d) ? ' today' : ''
                    }`}
                  >
                    <span className="dn">{d.getDate()}</span>
                    {list.slice(0, 2).map(chipFor)}
                    {list.length > 2 && (
                      <span className="cal-more">+{list.length - 2}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="cal-week">
            {days.map((d, i) => {
              const list = byDay.get(dayKey(d)) ?? [];
              return (
                <div key={d.toISOString()} className={`cal-wcol${isToday(d) ? ' today' : ''}`}>
                  <div className="cal-whead">
                    <span>{t.weekdays[i]}</span>
                    <span>{d.getDate()}</span>
                  </div>
                  {list.map(chipFor)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
