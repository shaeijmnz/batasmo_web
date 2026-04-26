import { useEffect, useState } from 'react';
import './AttorneyTheme.css';
import './AttorneyHome.css';
import {
  fetchAttorneyHomeData,
  isConsultationChatWindowOpen,
  markAttorneyNotificationsAsRead,
  subscribeToAttorneyAppointments,
  subscribeToAttorneyNotifications,
  calendarDaysFromTodayLocal,
} from '../lib/userApi';
import AttorneyNotificationDropdown from './AttorneyNotificationDropdown';

/* ── Icons ── */
const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const CalendarCheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" />
  </svg>
);
const AnalyticsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="7" /><rect x="11" y="8" width="3" height="10" /><rect x="16" y="5" width="3" height="13" />
  </svg>
);
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const MyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const formatNotifBadgeCount = (count) => {
  const safeCount = Number(count || 0);
  if (safeCount <= 0) return '';
  if (safeCount > 99) return '99+';
  return String(safeCount);
};

function AttorneyHome({ onNavigate, profile }) {
  const markAllReadStorageKey = `attorney-notifications-read-cutoff:${profile?.id || 'unknown'}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('Dashboard');
  const [notifOpen, setNotifOpen] = useState(false);
  const [consultations, setConsultations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [markAllReadCutoffIso, setMarkAllReadCutoffIso] = useState('');
  const [isMarkingNotificationsRead, setIsMarkingNotificationsRead] = useState(false);
  const [statsData, setStatsData] = useState({
    myAppointmentCount: 0,
  });
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!profile?.id) {
      setMarkAllReadCutoffIso('');
      return;
    }
    try {
      const storedValue = window.localStorage.getItem(markAllReadStorageKey) || '';
      setMarkAllReadCutoffIso(storedValue);
    } catch {
      setMarkAllReadCutoffIso('');
    }
  }, [markAllReadStorageKey, profile?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!profile?.id) return;
      try {
        const data = await fetchAttorneyHomeData(profile.id);
        if (isMounted) {
          setConsultations(data.consultations);
          setNotifications(data.notifications);
          setStatsData(data.stats);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Failed to load attorney dashboard data.');
        }
      }
    };

    loadData();

    const unsubscribe = subscribeToAttorneyAppointments(profile?.id, () => {
      loadData();
    });
    const unsubscribeNotifications = subscribeToAttorneyNotifications(profile?.id, () => {
      loadData();
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeNotifications();
    };
  }, [profile?.id]);

  const stats = [
    { label: 'My Appointments', value: String(statsData.myAppointmentCount), icon: <CalendarCheckIcon />, bg: '#eff6ff', border: '#3b82f6', nav: 'upcoming-appointments' },
    { label: 'Analytics', value: 'View Graph', icon: <AnalyticsIcon />, bg: '#ecfdf5', border: '#10b981', nav: 'attorney-analytics' },
  ];

  const sortedConsultations = [...consultations].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingCount = sortedConsultations.length;
  const cutoffTime = markAllReadCutoffIso ? new Date(markAllReadCutoffIso).getTime() : 0;
  const displayNotifications = notifications.map((n) => {
    const notificationTime = new Date(n.createdAt || 0).getTime() || 0;
    const unread = Boolean(n.unread) && notificationTime > cutoffTime;
    return { ...n, unread };
  });
  const unreadCount = displayNotifications.filter((n) => n.unread).length;
  const nextConsultation = sortedConsultations[0] || null;

  const handleMarkAllNotificationsRead = async () => {
    const unreadIds = notifications.filter((item) => item.unread).map((item) => item.id);
    if (!unreadIds.length || !profile?.id || isMarkingNotificationsRead) return;

    setIsMarkingNotificationsRead(true);
    const nowIso = new Date().toISOString();
    setMarkAllReadCutoffIso(nowIso);
    try {
      window.localStorage.setItem(markAllReadStorageKey, nowIso);
    } catch {
      // Keep in-memory fallback when local storage is blocked.
    }
    setNotifications((prev) => prev.map((item) => (item.unread ? { ...item, unread: false } : item)));

    try {
      await markAttorneyNotificationsAsRead(profile.id);
    } catch (error) {
      setMarkAllReadCutoffIso('');
      try {
        window.localStorage.removeItem(markAllReadStorageKey);
      } catch {
        // Ignore local storage cleanup failures.
      }
      setNotifications((prev) =>
        prev.map((item) => (unreadIds.includes(item.id) ? { ...item, unread: true } : item)),
      );
      setLoadError(error.message || 'Failed to mark notifications as read.');
    } finally {
      setIsMarkingNotificationsRead(false);
    }
  };

  const formatShortDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="att-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="att-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`att-sidebar ${sidebarOpen ? 'att-sidebar--open' : ''}`}>
        <div className="att-sidebar__logo">
          <img src="/logo/logo.jpg" alt="BatasMo logo" className="att-brand-logo" />
          <div className="att-brand-text-wrap">
            <span className="att-brand-title">BatasMo</span>
            <span className="att-brand-sub">Attorney Console</span>
          </div>
        </div>
        <nav className="att-sidebar__nav">
          {[
            { label: 'Dashboard',     icon: <DashboardIcon />, nav: 'attorney-home' },
            { label: 'Consultation Management',   icon: <MyApptIcon />,    nav: 'upcoming-appointments' },
            { label: 'Logs',          icon: <LogsIcon />,      nav: 'attorney-logs' },
            { label: 'Announcement',  icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
            { label: 'Profile',       icon: <ProfileIcon />,   nav: 'attorney-profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`att-sidebar__item ${activePage === item.label ? 'att-sidebar__item--active' : ''}`}
              onClick={() => {
                setActivePage(item.label);
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="att-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="att-topbar">
        <div className="att-topbar__left">
          <button className="att-icon-btn att-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="att-topbar__logo">
            <img src="/logo/logo.jpg" alt="BatasMo" className="att-topbar__brand-logo" />
            <div>
              <p className="att-topbar__eyebrow">Attorney Workspace</p>
              <span>Attorney Dashboard</span>
            </div>
          </div>
        </div>
        <div className="att-topbar__right" style={{ position: 'relative' }}>
          <button
            type="button"
            className="att-icon-btn att-notif-btn"
            onClick={() => setNotifOpen((v) => !v)}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
          >
            <BellIcon />
            {unreadCount > 0 ? <span className="att-notif-badge">{formatNotifBadgeCount(unreadCount)}</span> : null}
          </button>
          <AttorneyNotificationDropdown
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            notifications={displayNotifications}
            onMarkAllRead={handleMarkAllNotificationsRead}
            isMarkingAllRead={isMarkingNotificationsRead}
          />
          <div className="att-profile" style={{ cursor: 'pointer' }} onClick={() => onNavigate('attorney-profile')}>
            <div className="att-profile__info">
              <span className="att-profile__name">{profile?.full_name || 'Attorney'}</span>
            </div>
            <div className="att-avatar">{(profile?.full_name || 'A').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="att-main">
        <section className="att-hero-grid">
          <div className="att-welcome">
            <div className="att-welcome__text">
              <p className="att-kicker">LEGAL OPERATIONS OVERVIEW</p>
              <h1>Welcome back, {profile?.full_name || 'Attorney'}</h1>
              <p>Monitor consultations, respond faster, and keep your schedule aligned in one focused dashboard.</p>
            </div>
            <div className="att-hero-chips">
              <span className="att-hero-chip">{upcomingCount} upcoming consultations</span>
              <span className="att-hero-chip">{unreadCount} unread notifications</span>
            </div>
          </div>

          <aside className="att-spotlight-card">
            <div className="att-spotlight-head">
              <h3>Next Consultation</h3>
              <ScalesIcon size={18} color="#d4af37" />
            </div>
            {nextConsultation ? (
              <>
                <p className="att-spotlight-name">{nextConsultation.name}</p>
                <p className="att-spotlight-meta">{nextConsultation.area}</p>
                <p className="att-spotlight-meta">{formatShortDate(nextConsultation.date)} at {new Date(nextConsultation.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              </>
            ) : (
              <p className="att-spotlight-empty">No scheduled consultation yet.</p>
            )}
          </aside>
        </section>

        {loadError ? <p>{loadError}</p> : null}

        {/* Stats */}
        <div className="att-stats">
          {stats.map((s, i) => (
            <div
              className={`att-stat-card${s.nav ? ' att-stat-card--clickable' : ''}`}
              key={i}
              style={{ borderTop: `3px solid ${s.border}` }}
              onClick={() => s.nav && onNavigate(s.nav)}
            >
              <div className="att-stat-card__icon" style={{ background: s.bg }}>
                {s.icon}
              </div>
              <span className="att-stat-card__label">{s.label}</span>
              <span className="att-stat-card__value">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Consultation Queue */}
        <div className="att-queue-card">
          <div className="att-queue-card__header">
            <h2>Consultation Queue</h2>
            <button className="att-view-all" onClick={() => onNavigate('upcoming-appointments')}>View All</button>
          </div>
          <p className="att-queue-subtitle">Upcoming client consultations sorted by date</p>
          <div className="att-queue-list">
            {sortedConsultations
              .map((c, i) => {
                const today = new Date();
                const apptDate = new Date(c.date);
                const todayCal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const apptCal = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
                const isToday = todayCal.getTime() === apptCal.getTime();
                const daysUntil = calendarDaysFromTodayLocal(c.date);
                const canEnterChatroom = isConsultationChatWindowOpen({
                  status: c.status,
                  scheduledAt: c.scheduledAt,
                  slotDate: c.slotDate,
                  slotTime: c.slotTime,
                  paymentStatus: c.paymentStatus || 'unpaid',
                });

                const formatDate = (dateStr) => {
                  const d = new Date(dateStr);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                };

                return (
                  <div key={i} className={`att-queue-item ${isToday ? 'att-queue-item--today' : ''}`}>
                    <div className="att-queue-item__position">
                      <span className="att-queue-number">{i + 1}</span>
                    </div>
                    <div className="att-queue-item__date-block">
                      <span className="att-queue-month">{new Date(c.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="att-queue-day">{new Date(c.date).getDate()}</span>
                    </div>
                    <div className="att-queue-item__avatar">
                      {c.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="att-queue-item__info">
                      <span className="att-queue-item__name">{c.name}</span>
                      <span className="att-queue-item__area">{c.area}</span>
                      <span className="att-queue-item__time">
                        <ClockIcon /> {formatDate(c.date)} at {new Date(c.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                    <div className="att-queue-item__right">
                      <span className="att-badge att-badge--pending">{c.status}</span>
                      {canEnterChatroom ? (
                        <div className="att-queue-item__today-actions">
                          {isToday ? <span className="att-today-label">🔴 TODAY</span> : null}
                          <button className="att-enter-room-btn" onClick={() => onNavigate('attorney-messages', { appointmentId: c.id })}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Enter Chatroom
                          </button>
                        </div>
                      ) : isToday ? (
                        <div className="att-queue-item__today-actions">
                          <span className="att-today-label">🔴 TODAY</span>
                          <span className="att-queue-item__status-text">Waiting for scheduled time</span>
                        </div>
                      ) : (
                        <span className="att-queue-item__status-text">
                          {daysUntil === 1 ? 'Tomorrow' : daysUntil > 1 ? `In ${daysUntil} days` : 'Past'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            {!sortedConsultations.length ? (
              <div className="att-queue-empty">No consultations in queue yet.</div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AttorneyHome;
