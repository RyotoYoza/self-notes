import { useStore } from '../state/store';
import { Icon } from './Icons';

/**
 * Shown once, and only when the browser has refused to mark this data as
 * persistent. On iOS a site that is not on the home screen can be cleared
 * after seven days of disuse, so the copy differs there.
 */
export function InstallBanner() {
  const { t, setSettings } = useStore();
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return (
    <div className="banner" role="status">
      <span className="bi"><Icon.install /></span>
      <span className="bt">
        <b>{t.bannerTitle}</b>
        <p>{isIos ? t.bannerBodyIos : t.bannerBody}</p>
      </span>
      <button
        type="button"
        className="btn ghost"
        onClick={() => void setSettings({ storageWarningDismissed: true })}
      >
        {t.bannerDismiss}
      </button>
    </div>
  );
}
