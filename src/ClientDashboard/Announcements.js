import { useState, useEffect } from 'react';
import './Announcements.css';
import { supabase } from '../lib/supabaseClient';

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
const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const AnnDashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const AnnCalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const AnnMyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
  </svg>
);
const AnnNotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const AnnAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const AnnTransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const AnnProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const MegaphoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const CalendarSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const getTypeIcon = (type) => {
  switch (type) {
    case 'reschedule':
      return (
        <div className="ann-card__type-icon ann-card__type-icon--reschedule">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </div>
      );
    case 'update':
      return (
        <div className="ann-card__type-icon ann-card__type-icon--update">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
      );
    case 'reminder':
      return (
        <div className="ann-card__type-icon ann-card__type-icon--reminder">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      );
    case 'general':
    default:
      return (
        <div className="ann-card__type-icon ann-card__type-icon--general">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
      );
  }
};

const getTypeLabel = (type) => {
  switch (type) {
    case 'reschedule': return 'Reschedule';
    case 'update': return 'Update';
    case 'reminder': return 'Reminder';
    case 'general': default: return 'General';
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'reschedule': return { bg: '#fef2f2', color: '#dc2626' };
    case 'update': return { bg: '#eff6ff', color: '#2563eb' };
    case 'reminder': return { bg: '#fffbeb', color: '#f59e0b' };
    case 'general': default: return { bg: '#eef2ff', color: '#6366f1' };
  }
};

function Announcements({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAnnouncements = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, body, type, is_read, created_at')
          .eq('user_id', profile.id)
          .in('type', ['admin_announcement', 'admin_general', 'admin_reschedule', 'admin_update', 'admin_reminder'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!isMounted) return;

        const mapped = (data || []).map((item) => {
          const dt = new Date(item.created_at);
          const type = String(item.type || 'admin_announcement').toLowerCase().replace(/^admin_/, '');
          const normalizedType = type.includes('resched')
            ? 'reschedule'
            : type.includes('remind')
              ? 'reminder'
              : type.includes('update')
                ? 'update'
                : 'general';
          return {
            id: item.id,
            type: normalizedType,
            title: item.title || 'Announcement',
            message: item.body || '',
            date: Number.isNaN(dt.getTime()) ? 'Today' : dt.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
            priority: normalizedType === 'reschedule' || normalizedType === 'reminder' ? 'high' : 'normal',
            read: !!item.is_read,
            adminName: 'BatasMo Admin',
          };
        });

        setAnnouncements(mapped);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAnnouncements([]);
        setLoadError(error.message || 'Unable to load announcements.');
      }
    };

    loadAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const filters = ['All', 'Reschedule', 'Update', 'Reminder', 'General'];

  const filteredAnnouncements = activeFilter === 'All'
    ? announcements
    : announcements.filter(a => a.type === activeFilter.toLowerCase());

  const unreadCount = announcements.filter(a => !a.read).length;

  const markAllRead = () => {
    setAnnouncements(prev => prev.map(a => ({ ...a, read: true })));
  };

  return (
    <div className="ann-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="ann-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`ann-sidebar ${sidebarOpen ? 'ann-sidebar--open' : ''}`}>
        <div className="ann-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ann-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <AnnDashboardIcon />,    nav: 'home-logged' },
            { label: 'Book Appointment',    icon: <AnnCalIcon />,          nav: 'book-appointment' },
            { label: 'My Appointments',     icon: <AnnMyApptIcon />,       nav: 'my-appointments' },
            { label: 'Notarial Requests',   icon: <AnnNotarialIcon />,     nav: 'my-notarial-requests' },
            { label: 'Announcements',       icon: <AnnAnnouncementIcon />, nav: 'announcements' },
            { label: 'Transaction History', icon: <AnnTransactionIcon />,  nav: 'transaction-history' },
            { label: 'Profile',             icon: <AnnProfileIcon />,      nav: 'profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`ann-sidebar__item ${item.label === 'Announcements' ? 'ann-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="ann-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="ann-topbar">
        <div className="ann-topbar__left">
          <button className="ann-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="ann-breadcrumb">
            <span className="ann-breadcrumb__current">Announcements</span>
          </div>
        </div>
        <div className="ann-topbar__right">
          <button className="ann-icon-btn" onClick={() => onNavigate('chat-room')} title="Message Admin">
            <MessageIcon />
          </button>
          <button className="ann-icon-btn ann-bell" onClick={markAllRead} title="Mark notifications as read">
            <BellIcon />
            {unreadCount > 0 && <span className="ann-bell__dot" />}
          </button>
          <div className="ann-profile" onClick={() => onNavigate('profile')} style={{ cursor: 'pointer' }}>
            <div className="ann-profile__info">
              <span className="ann-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="ann-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ann-main">
        <div className="ann-container">
          {loadError ? <p>{loadError}</p> : null}
          {/* Header */}
          <div className="ann-header">
            <div className="ann-header__text">
              <div className="ann-header__title-row">
                <MegaphoneIcon />
                <h1>Announcements</h1>
                {unreadCount > 0 && (
                  <span className="ann-header__unread-badge">{unreadCount} new</span>
                )}
              </div>
              <p>Messages and updates from BatasMo Admin</p>
            </div>
            {unreadCount > 0 && (
              <button className="ann-mark-all-btn" onClick={markAllRead}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="ann-filters">
            {filters.map(f => (
              <button
                key={f}
                className={`ann-filter-btn ${activeFilter === f ? 'ann-filter-btn--active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
                {f !== 'All' && (
                  <span className="ann-filter-count">
                    {announcements.filter(a => a.type === f.toLowerCase()).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Announcement Cards */}
          <div className="ann-list">
            {filteredAnnouncements.length === 0 ? (
              <div className="ann-empty">
                <MegaphoneIcon />
                <p>
                  {activeFilter === 'All'
                    ? 'No admin announcements yet'
                    : `No ${activeFilter.toLowerCase()} announcements`}
                </p>
              </div>
            ) : (
              filteredAnnouncements.map(ann => {
                const typeColor = getTypeColor(ann.type);
                return (
                  <div key={ann.id} className={`ann-card ${!ann.read ? 'ann-card--unread' : ''}`}>
                    <div className="ann-card__left">
                      {getTypeIcon(ann.type)}
                      {!ann.read && <span className="ann-card__unread-dot" />}
                    </div>
                    <div className="ann-card__body">
                      <div className="ann-card__top-row">
                        <span className="ann-card__title">{ann.title}</span>
                        <span className="ann-card__type-label" style={{ background: typeColor.bg, color: typeColor.color }}>
                          {getTypeLabel(ann.type)}
                        </span>
                        {ann.priority === 'high' && (
                          <span className="ann-card__priority">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="none">
                              <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6z"/><rect x="11" y="10" width="2" height="4"/><rect x="11" y="16" width="2" height="2"/>
                            </svg>
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="ann-card__message">{ann.message}</p>
                      <div className="ann-card__footer">
                        <span className="ann-card__date">
                          <CalendarSmall /> {ann.date}
                        </span>
                        <span className="ann-card__from">From: {ann.adminName}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Announcements;
