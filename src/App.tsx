import { useCallback, useEffect, useMemo, useState } from 'react';
import { StoreProvider, useStore, type View } from './state/store';
import { UNCATEGORISED_ID, type Note } from './storage';
import { Rail } from './components/Rail';
import { CategoryPage } from './components/CategoryPage';
import { ChatPane } from './components/ChatPane';
import { HomeCalendar } from './components/HomeCalendar';
import { SettingsPage } from './components/SettingsPage';
import { SweepPage } from './components/SweepPage';
import { InstallBanner } from './components/InstallBanner';
import { ChatList } from './components/ChatList';
import { NoteMenu, type MenuAnchor } from './components/NoteMenu';
import { Icon } from './components/Icons';

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { t, view, settings, notes, categoryById, categoryLabel, setView } = useStore();
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [replyTo, setReplyTo] = useState<Note | null>(null);
  const [tab, setTab] = useState<'notes' | 'write'>('notes');
  /**
   * The phone navigates like a messaging app: the Notebook tab opens on a list
   * of conversations, and picking one pushes into it. `detail` is that push.
   */
  const [detail, setDetail] = useState(false);
  const isMobile = useMediaQuery('(max-width: 880px)');
  const [needsInstallNudge, setNeedsInstallNudge] = useState(false);

  /* Ask the browser to protect this data. Once, at startup. */
  useEffect(() => {
    (async () => {
      if (!navigator.storage?.persist) {
        console.info('[storage] persistence API unavailable in this browser');
        setNeedsInstallNudge(true);
        return;
      }
      const already = await navigator.storage.persisted();
      const granted = already || (await navigator.storage.persist());
      console.info(`[storage] persistent storage ${granted ? 'granted' : 'refused'}`);
      setNeedsInstallNudge(!granted);
    })();
  }, []);

  /* Resolve the skin. "system" never reaches the DOM. */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      // "Follow system" needs one light palette and one dark one to swap
      // between; these are the two the picker names in its description.
      const resolved =
        settings.skin === 'system' ? (media.matches ? 'slate' : 'porcelain') : settings.skin;
      document.documentElement.setAttribute('data-skin', resolved);
      document.documentElement.lang = settings.lang;
      const theme = document.querySelector('meta[name="theme-color"]');
      theme?.setAttribute('content', THEME_COLOR[resolved] ?? THEME_COLOR.slate);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.skin, settings.lang]);

  /* Adding a note onto another switches to the composer on a phone, where the
     composer is a separate tab and would otherwise be out of sight. */
  const startReply = useCallback(
    (note: Note) => {
      setReplyTo(note);
      if (isMobile) setTab('write');
    },
    [isMobile],
  );

  const openFromList = useCallback(
    (next: View) => {
      setView(next);
      setDetail(true);
    },
    [setView],
  );

  const current = view.kind === 'category' ? categoryById(view.id) : undefined;

  // A deleted category leaves the view pointing at nothing.
  useEffect(() => {
    if (view.kind === 'category' && !categoryById(view.id)) setView({ kind: 'home' });
  }, [view, categoryById, setView]);

  const mobileTitle = useMemo(() => {
    if (view.kind === 'home') return { label: t.home, color: undefined };
    if (view.kind === 'settings') return { label: t.settings, color: undefined };
    // Short label: the app bar shares its row with the Notebook/Memo tabs.
    if (view.kind === 'sweep') return { label: t.sweep, color: undefined };
    return current
      ? { label: categoryLabel(current), color: current.color }
      : { label: t.home, color: undefined };
  }, [view, current, t, categoryLabel]);

  const showBanner = needsInstallNudge && !settings.storageWarningDismissed;

  const detailSubtitle = useMemo(() => {
    if (!detail || view.kind !== 'category') return null;
    return t.notesCount(notes.filter((n) => n.categoryId === view.id).length);
  }, [detail, view, notes, t]);

  return (
    <div className="app">
      {isMobile && (
        <div className="mobile-top">
          {tab === 'notes' && detail ? (
            <button
              type="button"
              className="iconbtn"
              onClick={() => setDetail(false)}
              aria-label={t.back}
            >
              <Icon.left />
            </button>
          ) : (
            <span className="applogo" aria-hidden="true" />
          )}
          <span className="cur" style={{ ['--c' as string]: mobileTitle.color ?? 'transparent' }}>
            {mobileTitle.color && detail && <span className="dot" />}
            <span className="stack">
              <span className="nm">
                {tab === 'notes' && !detail ? t.notebook : mobileTitle.label}
              </span>
              {detailSubtitle && <span className="sub">{detailSubtitle}</span>}
            </span>
          </span>
          <div className="seg-tab" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'notes'}
              className={tab === 'notes' ? 'on' : ''}
              onClick={() => setTab('notes')}
            >
              {t.tabNotes}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              className={tab === 'write' ? 'on' : ''}
              onClick={() => setTab('write')}
            >
              {t.tabWrite}
            </button>
          </div>
        </div>
      )}

      {!isMobile && <Rail open={false} onNavigate={() => undefined} />}

      <main className="main" hidden={isMobile && tab !== 'notes'}>
        {isMobile && !detail ? (
          <ChatList onOpen={openFromList as never} />
        ) : (
          <>
            {view.kind === 'home' && <HomeCalendar />}
            {view.kind === 'settings' && <SettingsPage />}
            {view.kind === 'sweep' && (
              <SweepPage
                isMobile={isMobile}
                onClose={() => setView({ kind: 'category', id: UNCATEGORISED_ID })}
              />
            )}
            {view.kind === 'category' && current && (
              <CategoryPage category={current} onMenu={setMenu} isMobile={isMobile} />
            )}
            {view.kind === 'category' && !current && <div className="thread" />}
          </>
        )}
      </main>

      <aside className="chat" hidden={isMobile && tab !== 'write'}>
        <ChatPane onMenu={setMenu} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      </aside>

      {menu && (
        <NoteMenu anchor={menu} onClose={() => setMenu(null)} onAddNote={startReply} />
      )}
      {showBanner && <InstallBanner />}
    </div>
  );
}

/** The browser chrome colour each palette asks for. */
const THEME_COLOR: Record<string, string> = {
  slate: '#171a1f',
  graphite: '#08090c',
  obsidian: '#070a08',
  porcelain: '#1b1f2b',
  bone: '#2a2722',
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const on = () => setMatches(media.matches);
    media.addEventListener('change', on);
    return () => media.removeEventListener('change', on);
  }, [query]);
  return matches;
}
