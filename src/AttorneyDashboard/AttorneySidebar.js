import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './AttorneySidebar.css';

const NavIcon = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const NAV_ITEMS = [
  {
    nav: 'attorney-home',
    label: 'Dashboard',
    icon: (
      <NavIcon>
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </NavIcon>
    ),
  },
  {
    nav: 'upcoming-appointments',
    label: 'Consultation Management',
    icon: (
      <NavIcon>
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </NavIcon>
    ),
  },
  {
    nav: 'attorney-availability',
    label: 'My Availability',
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </NavIcon>
    ),
  },
  {
    nav: 'attorney-logs',
    label: 'Logs',
    icon: (
      <NavIcon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </NavIcon>
    ),
  },
  {
    nav: 'attorney-announcements',
    label: 'Announcement',
    icon: (
      <NavIcon>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </NavIcon>
    ),
  },
  {
    nav: 'attorney-profile',
    label: 'Profile',
    icon: (
      <NavIcon>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </NavIcon>
    ),
  },
];

// Rendered into document.body so page-level attorney CSS cannot restyle it.
export default function AttorneySidebar({ open, onClose, active, onNavigate }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return createPortal(
    <>
      <div
        className={`atty-drawer-overlay ${open ? 'atty-drawer-overlay--open' : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <aside className={`atty-drawer ${open ? 'atty-drawer--open' : ''}`} aria-label="Attorney navigation" aria-hidden={!open} inert={!open}>
        <div className="atty-drawer__brand">
          <img src="/logo/logo.jpg" alt="" className="atty-drawer__logo" />
          <div className="atty-drawer__brand-text">
            <span className="atty-drawer__title">LegalLink</span>
            <span className="atty-drawer__subtitle">Attorney Console</span>
          </div>
        </div>
        <nav className="atty-drawer__nav">
          {NAV_ITEMS.map((item) => {
            const isActive = item.nav === active;
            return (
              <button
                key={item.nav}
                type="button"
                className={`atty-drawer__item ${isActive ? 'atty-drawer__item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onClose();
                  if (!isActive) onNavigate(item.nav);
                }}
              >
                <span className="atty-drawer__icon">{item.icon}</span>
                <span className="atty-drawer__label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>,
    document.body,
  );
}
