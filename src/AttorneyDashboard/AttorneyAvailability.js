import { useMemo, useState } from 'react';
import ManageAvailabilityPanel from '../components/ManageAvailabilityPanel';
import './AttorneyTheme.css';
import './AttorneyAvailability.css';

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const ScheduleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const AvailabilityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="14" />
  </svg>
);
const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const NAV_ITEMS = [
  { label: 'Dashboard', icon: <DashboardIcon />, nav: 'attorney-home' },
  { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
  { label: 'My Availability', icon: <AvailabilityIcon />, nav: 'attorney-availability' },
  { label: 'Logs', icon: <LogsIcon />, nav: 'attorney-logs' },
  { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
  { label: 'Profile', icon: <ProfileIcon />, nav: 'attorney-profile' },
];

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
      {drawerOpen ? <div className="aa-drawer-overlay" onClick={() => setDrawerOpen(false)} role="presentation" /> : null}

      <aside className={`aa-sidebar ${drawerOpen ? 'aa-sidebar--open' : ''}`}>
        <div className="aa-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>LegalLink</span>
        </div>
        <nav className="aa-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`aa-sidebar__item ${item.nav === 'attorney-availability' ? 'aa-sidebar__item--active' : ''}`}
              onClick={() => {
                setDrawerOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="aa-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

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
