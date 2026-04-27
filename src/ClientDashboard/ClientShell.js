import { useEffect, useMemo, useRef, useState } from 'react';
import './ClientShell.css';
import { fetchClientNotifications, subscribeToClientNotifications } from '../lib/userApi';

const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', page: 'home-logged' },
  { key: 'booking', label: 'Book Consultation', page: 'book-appointment' },
  { key: 'announcements', label: 'Announcement', page: 'announcements' },
  { key: 'history', label: 'Transaction History', page: 'transaction-history' },
  { key: 'logs', label: 'Logs', page: 'client-logs' },
];

const PAGE_COPY = {
  'home-logged': 'Welcome to your BatasMo client dashboard.',
  'book-appointment': 'Choose an attorney and confirm your consultation flow.',
  'my-appointments': 'Track your consultations and notary services.',
  'chat-room': 'Collaborate with your legal team securely.',
  'transaction-history': 'Review completed services and transactions.',
  'client-logs': 'Review completed consultations, ratings, and your attorney’s session summary.',
  announcements: 'Read official updates and schedule notices from BatasMo Admin.',
  profile: 'Manage account preferences and security.',
  'my-notarial-requests': 'Track your consultations and notary services.',
  'notarial-request': 'Track your consultations and notary services.',
};

const ACTIVE_MENU_BY_PAGE = {
  'home-logged': 'dashboard',
  'book-appointment': 'booking',
  'my-appointments': 'booking',
  'my-notarial-requests': 'booking',
  'notarial-request': 'booking',
  'chat-room': 'booking',
  'transaction-history': 'history',
  'client-logs': 'logs',
  announcements: 'announcements',
  profile: 'dashboard',
};

function SidebarIcon({ type }) {
  if (type === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    );
  }

  if (type === 'booking') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }

  if (type === 'tracking') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
    );
  }

  if (type === 'messages') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  if (type === 'history') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.5 9a9 9 0 0 1 14.8-3.3L23 10M1 14l4.6 4.3A9 9 0 0 0 20.5 15" />
      </svg>
    );
  }

  if (type === 'announcements') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function MenuToggle({ isOpen, onToggle }) {
  return (
    <button
      type="button"
      className={`client-shell-menu-toggle ${isOpen ? 'is-open' : ''}`}
      onClick={onToggle}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <span />
      <span />
      <span />
    </button>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const NOTIF_GLYPH_STROKE = 2;

function ClientNotificationGlyph({ type }) {
  const t = String(type || '').toLowerCase();
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: NOTIF_GLYPH_STROKE, strokeLinecap: 'round', strokeLinejoin: 'round' };

  if (t === 'payment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (t === 'booking') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (t === 'consultation') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="14" y2="17" />
      </svg>
    );
  }
  if (t === 'reschedule') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (t === 'reminder') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function clientNotifGlyphClass(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'payment') return 'client-shell-notif-item__glyph--payment';
  if (t === 'booking') return 'client-shell-notif-item__glyph--booking';
  if (t === 'consultation') return 'client-shell-notif-item__glyph--consultation';
  if (t === 'reschedule') return 'client-shell-notif-item__glyph--reschedule';
  if (t === 'reminder') return 'client-shell-notif-item__glyph--reminder';
  return 'client-shell-notif-item__glyph--default';
}

function getInitials(name) {
  return String(name || 'Client')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getFirstName(name) {
  const displayName = String(name || '').trim();
  if (!displayName) return 'Client';
  return displayName.split(' ').filter(Boolean)[0] || 'Client';
}

export default function ClientShell({
  currentPage,
  profile,
  onNavigate,
  onSignOut,
  children,
  showNotaryModal = false,
  notaryWarningMessage = '',
  onCloseNotaryModal,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifError, setNotifError] = useState('');
  const contentRef = useRef(null);
  const activeMenu = ACTIVE_MENU_BY_PAGE[currentPage] || 'dashboard';
  const subtitle = PAGE_COPY[currentPage] || PAGE_COPY['home-logged'];

  const initials = useMemo(() => getInitials(profile?.full_name), [profile?.full_name]);
  const firstName = useMemo(() => getFirstName(profile?.full_name), [profile?.full_name]);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      if (!profile?.id) {
        setNotifications([]);
        return;
      }

      try {
        const rows = await fetchClientNotifications(profile.id, { limit: 20 });
        if (!cancelled) {
          setNotifications(rows);
          setNotifError('');
        }
      } catch (error) {
        if (!cancelled) {
          setNotifError(error.message || 'Unable to load notifications.');
        }
      }
    };

    loadNotifications();
    const unsubscribe = subscribeToClientNotifications(profile?.id, () => {
      loadNotifications();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile?.id]);

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPage]);

  const handleNavigate = (nextPage, params = {}) => {
    if (typeof onNavigate === 'function') {
      onNavigate(nextPage, params);
    }
    if (window.matchMedia('(max-width: 1100px)').matches) {
      setSidebarOpen(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (typeof onSignOut === 'function') {
        await onSignOut();
      }
    } catch (error) {
      console.error('[auth] client shell sign out failed', error);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
  };

  const markNotificationRead = (id) => {
    setNotifications((previous) => previous.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  return (
    <div className={`client-shell-app ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <div className="client-shell-mesh" />
      <div className="client-shell-orb client-shell-orb-a" />
      <div className="client-shell-orb client-shell-orb-b" />

      <aside className={`client-shell-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="client-shell-sidebar-header">
          <button type="button" className="client-shell-brand" onClick={() => handleNavigate('home-logged')}>
            <span className="client-shell-brand-logo">A</span>
            {sidebarOpen ? <span className="client-shell-brand-text">BATASMO</span> : null}
          </button>
        </div>

        <nav className="client-shell-nav" aria-label="Client menu">
          {MENU_ITEMS.map((item) => {
            const isActive = activeMenu === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`client-shell-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavigate(item.page)}
              >
                <span className="client-shell-nav-icon">
                  <SidebarIcon type={item.key} />
                </span>
                {sidebarOpen ? <span className="client-shell-nav-label">{item.label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="client-shell-sidebar-footer">
          <div className="client-shell-user">
            <button type="button" className="client-shell-user-avatar" onClick={() => handleNavigate('profile')}>
              {initials}
            </button>
            {sidebarOpen ? (
              <div className="client-shell-user-meta">
                <p>{profile?.full_name || 'Client'}</p>
                <button type="button" onClick={handleSignOut}>Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="client-shell-main">
        <header className="client-shell-topbar">
          <div className="client-shell-title-wrap">
            <MenuToggle isOpen={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
            <div>
              <h1>Client Dashboard</h1>
              <p>{subtitle}</p>
            </div>
          </div>

          <div className="client-shell-topbar-actions">
            <div className="client-shell-notif-wrap">
              <button
                type="button"
                className="client-shell-notif-btn"
                onClick={() => setNotifOpen((previous) => !previous)}
                aria-label="Open notifications"
              >
                <BellIcon />
                {unreadCount > 0 ? <span className="client-shell-notif-dot">{Math.min(unreadCount, 9)}</span> : null}
              </button>

              {notifOpen ? (
                <>
                  <button
                    type="button"
                    className="client-shell-notif-backdrop"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Close notifications"
                  />
                  <div className="client-shell-notif-panel" role="dialog" aria-label="Client notifications">
                    <div className="client-shell-notif-panel__header">
                      <span>Notifications</span>
                      {unreadCount > 0 ? (
                        <button type="button" onClick={markAllNotificationsRead}>Mark all read</button>
                      ) : null}
                    </div>

                    <div className="client-shell-notif-panel__list">
                      {notifError ? <p className="client-shell-notif-panel__error">{notifError}</p> : null}
                      {!notifError && notifications.length === 0 ? (
                        <p className="client-shell-notif-panel__empty">No notifications yet.</p>
                      ) : null}
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`client-shell-notif-item ${item.read ? '' : 'client-shell-notif-item--unread'}`}
                          onClick={() => {
                            markNotificationRead(item.id);
                            setNotifOpen(false);
                            if (item.appointmentId) {
                              handleNavigate('client-logs', { appointmentId: item.appointmentId });
                            } else {
                              handleNavigate('my-appointments');
                            }
                          }}
                        >
                          <div className="client-shell-notif-item__row">
                            <span className={`client-shell-notif-item__glyph ${clientNotifGlyphClass(item.type)}`}>
                              <ClientNotificationGlyph type={item.type} />
                            </span>
                            <div className="client-shell-notif-item__body">
                              <span className="client-shell-notif-item__title">{item.title}</span>
                              <span className="client-shell-notif-item__desc">{item.desc}</span>
                              <div className="client-shell-notif-item__meta">
                                <span className="client-shell-notif-item__time">{item.time}</span>
                                <span className="client-shell-notif-item__cta">
                                  {item.appointmentId ? 'Open consultation logs' : 'View appointments'}
                                  <span aria-hidden="true" className="client-shell-notif-item__cta-arrow">
                                    →
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <button type="button" className="client-shell-profile-chip" onClick={() => handleNavigate('profile')}>
              <span>Welcome, {firstName}</span>
              <span className="client-shell-profile-avatar">{initials}</span>
            </button>
          </div>
        </header>

        <section
          className={`client-shell-content ${currentPage === 'chat-room' ? 'client-shell-content--chat' : ''}`}
          ref={contentRef}
        >
          <div className={`client-shell-body ${currentPage === 'chat-room' ? 'client-shell-body--chat' : ''}`}>
            {children}
          </div>
        </section>
      </main>

      <button
        type="button"
        className={`client-shell-backdrop ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close menu"
      />

      {showNotaryModal ? (
        <div className="client-shell-notary-modal__overlay" onClick={onCloseNotaryModal}>
          <div className="client-shell-notary-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="client-shell-notary-modal__badge">Security Required</div>
            <h2>Continue on BatasMo Mobile App</h2>
            <p>{notaryWarningMessage}</p>

            <div className="client-shell-notary-modal__features">
              <span>Face Verification</span>
              <span>Identity Match</span>
              <span>Secure Document Flow</span>
            </div>

            <div className="client-shell-notary-modal__actions">
              <button type="button" className="client-shell-notary-modal__btn client-shell-notary-modal__btn--ghost" onClick={onCloseNotaryModal}>
                Not Now
              </button>
              <button
                type="button"
                className="client-shell-notary-modal__btn client-shell-notary-modal__btn--primary"
                onClick={onCloseNotaryModal}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
