import { useEffect, useState } from 'react';
import './AttorneyAnnouncements.css';
import { fetchAttorneyAnnouncementsData } from '../lib/userApi';

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
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const ScheduleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const MessagesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const MegaphoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10l4 4H8l4-4z"/><line x1="12" y1="22" x2="12" y2="16"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const tagColor = (tag) => {
  if (tag === 'Important') return { bg: '#fef2f2', color: '#dc2626' };
  if (tag === 'Maintenance') return { bg: '#fefce8', color: '#ca8a04' };
  if (tag === 'New Feature') return { bg: '#eff6ff', color: '#2563eb' };
  if (tag === 'Reminder') return { bg: '#fdf4ff', color: '#a855f7' };
  return { bg: '#f0fdf4', color: '#16a34a' };
};

export default function AttorneyAnnouncements({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyAnnouncementsData(profile.id);
        if (!isMounted) return;
        setAnnouncements(rows);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAnnouncements([]);
        setLoadError(error.message || 'Unable to load announcements.');
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const sidebarItems = [
    { label: 'Dashboard',    icon: <DashboardIcon />,    nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Messages',     icon: <MessagesIcon />,     nav: 'attorney-messages' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: null },
    { label: 'Profile',      icon: <ProfileIcon />,      nav: 'attorney-profile' },
  ];

  return (
    <div className="aa-page">
      {sidebarOpen && <div className="aa-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`aa-sidebar ${sidebarOpen ? 'aa-sidebar--open' : ''}`}>
        <div className="aa-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="aa-sidebar__nav">
          {sidebarItems.map(item => (
            <button
              key={item.label}
              className={`aa-sidebar__item ${item.label === 'Announcement' ? 'aa-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="aa-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="aa-topbar">
        <div className="aa-topbar__left">
          <button className="aa-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="aa-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="aa-topbar__right">
          <span className="aa-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
          <div className="aa-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      <main className="aa-main">
        {loadError ? <p>{loadError}</p> : null}
        <div className="aa-header">
          <div className="aa-header__title-row">
            <MegaphoneIcon />
            <h1>Announcements</h1>
          </div>
          <p>Stay updated with the latest news and updates from BatasMo Admin.</p>
        </div>

        <div className="aa-cards">
          {announcements.map(a => {
            const tc = tagColor(a.tag);
            const isExpanded = expandedId === a.id;
            return (
              <div className={`aa-card ${a.pinned ? 'aa-card--pinned' : ''}`} key={a.id}>
                <div className="aa-card__top">
                  <div className="aa-card__tags">
                    {a.pinned && (
                      <span className="aa-tag aa-tag--pinned"><PinIcon /> Pinned</span>
                    )}
                    <span className="aa-tag" style={{ background: tc.bg, color: tc.color }}>{a.tag}</span>
                  </div>
                  <div className="aa-card__date">
                    <CalendarIcon />
                    {a.date} · {a.time}
                  </div>
                </div>
                <h2 className="aa-card__title">{a.title}</h2>
                <p className={`aa-card__body ${isExpanded ? '' : 'aa-card__body--clamped'}`}>
                  {a.body}
                </p>
                {a.body.length > 150 && (
                  <button className="aa-card__toggle" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                    {isExpanded ? 'Show Less' : 'Read More'}
                  </button>
                )}
                <div className="aa-card__footer">
                  <span className="aa-card__author">Posted by <strong>{a.author}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
