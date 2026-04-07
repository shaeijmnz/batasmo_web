import { useEffect, useMemo, useState } from 'react';
import './UpcomingAppointments.css';
import { fetchAttorneyUpcomingAppointments, rescheduleAttorneyAppointment } from '../lib/userApi';

/* ── Icons ── */
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
const ClockIcon = ({ color = '#f59e0b' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const CalendarIcon = ({ color = '#f59e0b' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
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
const SideAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

/* ── Reschedule Modal ── */
function RescheduleModal({ appointment, onClose, onConfirm }) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="ua-modal-overlay" onClick={onClose}>
      <div className="ua-modal" onClick={e => e.stopPropagation()}>
        <h2>Reschedule Appointment</h2>
        <p className="ua-modal__sub">Reschedule consultation with <strong>{appointment.name}</strong></p>

        <label className="ua-modal__label">New Date</label>
        <input type="date" className="ua-modal__input" value={newDate} onChange={e => setNewDate(e.target.value)} />

        <label className="ua-modal__label">New Time</label>
        <input type="time" className="ua-modal__input" value={newTime} onChange={e => setNewTime(e.target.value)} />

        <label className="ua-modal__label">Note (optional)</label>
        <textarea className="ua-modal__textarea" rows="3" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note for the client..." />

        <div className="ua-modal__actions">
          <button className="ua-modal__btn ua-modal__btn--cancel" onClick={onClose}>Cancel</button>
          <button className="ua-modal__btn ua-modal__btn--confirm" disabled={!newDate || !newTime} onClick={() => onConfirm(newDate, newTime, note)}>
            Confirm Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
const DEFAULT_NOTIFICATIONS = [];

function UpcomingAppointments({ onNavigate, profile }) {
  const [appointments, setAppointments] = useState([]);
  const [reschedAppt, setReschedAppt] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications] = useState(DEFAULT_NOTIFICATIONS);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyUpcomingAppointments(profile.id);
        if (!isMounted) return;
        setAppointments(rows);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAppointments([]);
        setLoadError(error.message || 'Unable to load appointments.');
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const now = new Date();
  const todayDate = now.toDateString();
  const tomorrow = new Date(now);
  const attorneyDisplayName = profile?.full_name || 'Attorney';
  const currentYear = now.getFullYear();

  tomorrow.setDate(now.getDate() + 1);
  const tomorrowDate = tomorrow.toDateString();

  const { todayAppts, tomorrowAppts, weekAppts } = useMemo(() => {
    const today = [];
    const nextDay = [];
    const week = [];

    appointments.forEach((appointment) => {
      const parsed = new Date(appointment.scheduledAt || `${appointment.date} ${currentYear}`);
      if (Number.isNaN(parsed.getTime())) {
        week.push(appointment);
        return;
      }

      const apptDate = parsed.toDateString();
      if (apptDate === todayDate) {
        today.push(appointment);
      } else if (apptDate === tomorrowDate) {
        nextDay.push(appointment);
      } else {
        week.push(appointment);
      }
    });

    return {
      todayAppts: today,
      tomorrowAppts: nextDay,
      weekAppts: week,
    };
  }, [appointments, currentYear, todayDate, tomorrowDate]);

  const attorneyAvatarSrc = useMemo(
    () => `https://ui-avatars.com/api/?name=${encodeURIComponent(attorneyDisplayName)}&background=1c1f2e&color=fff&size=38`,
    [attorneyDisplayName],
  );

  const handleReschedule = async (date, time, note) => {
    try {
      await rescheduleAttorneyAppointment({
        appointmentId: reschedAppt.id,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        note,
      });
      setAppointments(prev =>
        prev.map(a => a.id === reschedAppt.id ? { ...a, date, time } : a)
      );
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to reschedule appointment.');
    }
    setReschedAppt(null);
  };

  const renderCard = (appt) => (
    <div className="ua-card" key={appt.id}>
      <div className="ua-card__top">
        <div className="ua-card__avatar" style={{ background: appt.color }}>
          {appt.initials}
        </div>
        <div className="ua-card__info">
          <span className="ua-card__name">{appt.name}</span>
          <span className="ua-card__area">{appt.area}</span>
        </div>
      </div>

      <div className="ua-card__bottom">
        <div className="ua-card__time">
          {appt.date ? <CalendarIcon /> : <ClockIcon />}
          <span>{appt.date ? `${appt.date} • ${appt.time}` : appt.time}</span>
        </div>
        <div className="ua-card__actions">
          <button className="ua-btn ua-btn--reschedule" onClick={() => setReschedAppt(appt)}>
            RESCHEDULE
          </button>
          <button
            className="ua-btn ua-btn--enter"
            onClick={() => onNavigate('attorney-messages')}
          >
            ENTER CONSULTATION
          </button>
        </div>
      </div>
    </div>
  );

  const renderSection = (title, items) => (
    <section className="ua-section" key={title}>
      <div className="ua-section__header">
        <h2 className="ua-section__title">{title}</h2>
        <span className="ua-section__count">{items.length}</span>
      </div>
      <div className="ua-section__grid">
        {items.map(renderCard)}
      </div>
    </section>
  );

  return (
    <div className="ua-page">
      {/* Drawer overlay */}
      {drawerOpen && <div className="ua-drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Sidebar */}
      <aside className={`ua-sidebar ${drawerOpen ? 'ua-sidebar--open' : ''}`}>
        <div className="ua-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ua-sidebar__nav">
          {[
            { label: 'Dashboard',     icon: <DashboardIcon />,          nav: 'attorney-home' },
            { label: 'Consultation Management',   icon: <ScheduleIcon />,           nav: 'upcoming-appointments' },
            { label: 'Messages',      icon: <MessagesIcon />,           nav: 'attorney-messages' },
            { label: 'Announcement',  icon: <SideAnnouncementIcon />,   nav: 'attorney-announcements' },
            { label: 'Profile',       icon: <ProfileIcon />,            nav: 'attorney-profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`ua-sidebar__item ${item.label === 'Consultation Management' ? 'ua-sidebar__item--active' : ''}`}
              onClick={() => {
                setDrawerOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="ua-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="ua-topbar">
        <div className="ua-topbar__left">
          <button className="ua-menu-btn" onClick={() => setDrawerOpen(v => !v)}>
            <MenuIcon />
          </button>
          <div className="ua-topbar__title">
            <h1>My Appointments</h1>
          </div>
        </div>
        <div className="ua-topbar__right" style={{ position: 'relative' }}>
          <button className="ua-icon-btn ua-notif-btn" onClick={() => setNotifOpen(v => !v)}>
            <BellIcon />
            <span className="ua-notif-dot" />
          </button>
          {notifOpen && (
            <div className="ua-notif-panel">
              <div className="ua-notif-panel__header">
                <span>Notifications</span>
                <button className="ua-notif-panel__close" onClick={() => setNotifOpen(false)}>✕</button>
              </div>
              {notifications.map(n => (
                <div key={n.id} className={`ua-notif-item ${n.unread ? 'ua-notif-item--unread' : ''}`}>
                  <p className="ua-notif-item__text">{n.text}</p>
                  <span className="ua-notif-item__time">{n.time}</span>
                </div>
              ))}
            </div>
          )}
          <div className="ua-profile" style={{ cursor: 'pointer' }} onClick={() => onNavigate('attorney-profile')}>
            <div className="ua-profile__info">
              <span className="ua-profile__name">{attorneyDisplayName}</span>
              <span className="ua-profile__status">PENDING</span>
            </div>
            <div className="ua-profile__avatar">
              <img src={attorneyAvatarSrc} alt="avatar" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ua-main">
        {loadError ? <p>{loadError}</p> : null}
        {renderSection("TODAY'S APPOINTMENTS", todayAppts)}
        {renderSection("TOMORROW'S APPOINTMENTS", tomorrowAppts)}
        {renderSection("UPCOMING THIS WEEK", weekAppts)}
      </main>

      {/* Reschedule Modal */}
      {reschedAppt && (
        <RescheduleModal
          appointment={reschedAppt}
          onClose={() => setReschedAppt(null)}
          onConfirm={handleReschedule}
        />
      )}
    </div>
  );
}

export default UpcomingAppointments;
