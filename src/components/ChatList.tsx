import { useMemo } from 'react';
import { useStore } from '../state/store';
import { UNCATEGORISED_ID, type Note } from '../storage';
import { Icon } from './Icons';
import { shortStamp } from '../lib/dates';

/**
 * The phone's Notebook tab: every category as a row in a list of
 * conversations, the way a messaging app opens. Tapping one pushes into that
 * conversation — see the detail stack in App.tsx.
 */
export function ChatList({ onOpen }: { onOpen: (view: Parameters<typeof Object>[0]) => void }) {
  const { t, settings, notes, categories, categoryLabel } = useStore();

  const lastByCategory = useMemo(() => {
    const map = new Map<string, Note>();
    for (const n of notes) {
      const prev = map.get(n.categoryId);
      if (!prev || n.createdAt > prev.createdAt) map.set(n.categoryId, n);
    }
    return map;
  }, [notes]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) map.set(n.categoryId, (map.get(n.categoryId) ?? 0) + 1);
    return map;
  }, [notes]);

  const urgentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      if (!n.urgent) continue;
      map.set(n.categoryId, (map.get(n.categoryId) ?? 0) + 1);
    }
    return map;
  }, [notes]);

  const scheduled = useMemo(
    () => notes.filter((n) => n.scheduled && n.parentId === null),
    [notes],
  );
  /** What is coming up, not what was written last. */
  const nextScheduled = useMemo(() => {
    const byDate = [...scheduled].sort((a, b) =>
      (a.scheduledFor ?? '') < (b.scheduledFor ?? '') ? -1 : 1,
    );
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const cutoff = startOfToday.toISOString();
    return byDate.find((n) => (n.scheduledFor ?? '') >= cutoff) ?? byDate[byDate.length - 1];
  }, [scheduled]);

  return (
    <div className="chatlist">
      <button type="button" className="clrow" onClick={() => onOpen({ kind: 'home' } as never)}>
        <span className="clav home" aria-hidden="true">
          <Icon.cal />
        </span>
        <span className="clbody">
          <span className="cltop">
            <span className="clname">{t.home}</span>
            {nextScheduled && (
              <span className="cltime">
                {shortStamp(nextScheduled.scheduledFor ?? nextScheduled.createdAt, t, settings.lang)}
              </span>
            )}
          </span>
          <span className="clbottom">
            <span className="clprev">
              {nextScheduled ? nextScheduled.text : t.noScheduled}
            </span>
            {scheduled.length > 0 && <span className="clcount">{scheduled.length}</span>}
          </span>
        </span>
      </button>

      {categories.map((c) => {
        const last = lastByCategory.get(c.id);
        const count = counts.get(c.id) ?? 0;
        const urgent = urgentCounts.get(c.id) ?? 0;
        const waiting = c.id === UNCATEGORISED_ID && count > 0;
        return (
          <button
            key={c.id}
            type="button"
            className="clrow"
            style={{ ['--c' as string]: c.color }}
            onClick={() => onOpen({ kind: 'category', id: c.id } as never)}
          >
            <span className="clav" aria-hidden="true">
              {categoryLabel(c).slice(0, 1)}
            </span>
            <span className="clbody">
              <span className="cltop">
                <span className="clname">{categoryLabel(c)}</span>
                {last && <span className="cltime">{shortStamp(last.createdAt, t, settings.lang)}</span>}
              </span>
              <span className="clbottom">
                {/* The flag reports that the category holds urgent notes. The
                    preview text is simply the latest note, so it is only
                    coloured when that note is itself urgent. */}
                {urgent > 0 && (
                  <span className="clflag">
                    <Icon.flag />
                    {urgent}
                  </span>
                )}
                <span className={`clprev${last?.urgent ? ' urgent' : ''}`}>
                  {last ? last.text : t.emptyCategory}
                </span>
                {count > 0 && (
                  <span className={`clcount${waiting ? ' waiting' : ''}`}>{count}</span>
                )}
              </span>
            </span>
          </button>
        );
      })}

      <button type="button" className="clrow quiet" onClick={() => onOpen({ kind: 'settings' } as never)}>
        <span className="clav plain" aria-hidden="true">
          <Icon.gear />
        </span>
        <span className="clbody">
          <span className="cltop">
            <span className="clname">{t.settings}</span>
          </span>
          <span className="clbottom">
            <span className="clprev">{t.settingsPreview}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
