import { useMemo, useState } from 'react';
import ManageAvailabilityPanel from '../components/ManageAvailabilityPanel';
import './AttorneyTheme.css';
import './AttorneyAvailability.css';
import AttorneySidebar from './AttorneySidebar';

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
export default function AttorneyAvailability({ onNavigate, profile }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const attorneyDisplayName = profile?.full_name || 'Attorney';
  const attorneyId = profile?.id;

  const attorneyAvatarSrc = useMemo(
    () => `https://ui-avatars.com/api/?name=${encodeURIComponent(attorneyDisplayName)}&background=1c1f2e&color=fff&size=38`,
    [attorneyDisplayName],
  );

  return (
    <div className="aa-page">
      <AttorneySidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active="attorney-availability"
        onNavigate={onNavigate}
      />

      <header className="aa-topbar">
        <div className="aa-topbar__left">
          <button type="button" className="aa-menu-btn" onClick={() => setDrawerOpen((open) => !open)} aria-label="Menu">
            <MenuIcon />
          </button>
          <div className="aa-topbar__logo">
            <img src="/logo/logo.jpg" alt="LegalLink" className="aa-topbar__brand-logo" />
            <div>
              <p className="aa-topbar__eyebrow">Attorney Workspace</p>
              <span>My Availability</span>
            </div>
          </div>
        </div>
        <button type="button" className="aa-profile" onClick={() => onNavigate('attorney-profile')}>
          <span className="aa-profile__name">{attorneyDisplayName}</span>
          <img src={attorneyAvatarSrc} alt="" className="aa-profile__avatar" />
        </button>
      </header>

      <main className="aa-main">
        {attorneyId ? (
          <ManageAvailabilityPanel
            attorneyId={attorneyId}
            displayName={attorneyDisplayName}
            variant="attorney"
            embedded
          />
        ) : (
          <p className="aa-load-error">Sign in again to manage your schedule.</p>
        )}
      </main>
    </div>
  );
}
