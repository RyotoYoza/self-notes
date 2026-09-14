import { useMemo } from 'react';
import { useStore } from '../state/store';
import { UNCATEGORISED_ID } from '../storage';
import { Icon } from './Icons';

export function Rail({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { t, view, setView, categories, notes, categoryLabel } = useStore();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) map.set(n.categoryId, (map.get(n.categoryId) ?? 0) + 1);
    return map;
  }, [notes]);

  const go = (v: Parameters<typeof setView>[0]) => {
    setView(v);
    onNavigate();
  };

  return (
    <aside className={`rail${open ? ' open' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        {t.appName}
      </div>

      <div className="rail-nav">
        <button
          type="button"
          className={`rail-item${view.kind === 'home' ? ' on' : ''}`}
          onClick={() => go({ kind: 'home' })}
        >
          <Icon.home />
          <span className="nm">{t.home}</span>
        </button>
      </div>

      <p className="rail-label">{t.categories}</p>
      <div className="rail-nav">
        {categories.map((c) => {
          const count = counts.get(c.id) ?? 0;
          // Uncategorised is the fast lane, so it shows what is still waiting
          // to be filed rather than a plain total.
          const waiting = c.id === UNCATEGORISED_ID && count > 0;
          return (
            <button
              key={c.id}
              type="button"
              className={`rail-item${view.kind === 'category' && view.id === c.id ? ' on' : ''}`}
              style={{ ['--c' as string]: c.color }}
              onClick={() => go({ kind: 'category', id: c.id })}
            >
              <span className="dot" />
              <span className="nm">{categoryLabel(c)}</span>
              {waiting ? <span className="badge">{count}</span> : <span className="ct">{count || ''}</span>}
            </button>
          );
        })}
      </div>

      <div className="rail-foot">
        <button
          type="button"
          className={`rail-item${view.kind === 'settings' ? ' on' : ''}`}
          onClick={() => go({ kind: 'settings' })}
        >
          <Icon.gear />
          <span className="nm">{t.settings}</span>
        </button>
      </div>
    </aside>
  );
}
