import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './UpcomingAppointments.css';
import './AttorneyTheme.css';
import {
  fetchAttorneyUpcomingAppointments,
  getAvailability,
  isConsultationChatWindowOpen,
  normalizeSlotTimeLabel,
  rescheduleAttorneyAppointment,
  subscribeToAttorneyAppointments,
} from '../lib/userApi';

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
const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><polyline points="14 2 14 8 20 8"/>
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
function RescheduleModal({ appointment, attorneyId, onClose, onConfirm }) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [note, setNote] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timeLoadError, setTimeLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadSlots = async () => {
      if (!attorneyId || !newDate) {
        setAvailableTimes([]);
        setTimeLoadError('');
        return;
      }

      try {
        setLoadingTimes(true);
        setTimeLoadError('');
        const slots = await getAvailability(attorneyId, newDate, { force: true });
        if (cancelled) return;

        const uniqueTimes = Array.from(new Set((slots || []).map((item) => String(item.time || '').trim()).filter(Boolean)));
        uniqueTimes.sort((a, b) => {
          const aLabel = normalizeSlotTimeLabel(a);
          const bLabel = normalizeSlotTimeLabel(b);
          const [aHour = '0', aMinute = '0'] = aLabel.split(':');
          const [bHour = '0', bMinute = '0'] = bLabel.split(':');
          const aValue = Number(aHour) * 60 + Number(aMinute);
          const bValue = Number(bHour) * 60 + Number(bMinute);
          return aValue - bValue;
        });

        setAvailableTimes(uniqueTimes);
        setNewTime((previous) => (uniqueTimes.includes(previous) ? previous : ''));
      } catch (error) {
        if (cancelled) return;
        setAvailableTimes([]);
        setTimeLoadError(error.message || 'Unable to load availability for this date.');
      } finally {
        if (!cancelled) {
          setLoadingTimes(false);
        }
      }
    };

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [attorneyId, newDate]);

  const hasSlots = availableTimes.length > 0;
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="ua-modal-overlay" onClick={onClose}>
      <div className="ua-modal" onClick={e => e.stopPropagation()}>
        <h2>Reschedule Appointment</h2>
        <p className="ua-modal__sub">Reschedule consultation with <strong>{appointment.name}</strong></p>

        <label className="ua-modal__label">New Date</label>
        <input
          type="date"
          className="ua-modal__input"
          value={newDate}
          min={minDate}
          onChange={e => {
            setNewDate(e.target.value);
            setNewTime('');
          }}
        />

        <label className="ua-modal__label">Available Time</label>
        {!newDate ? (
          <p className="ua-modal__hint">Select a date first to view your available time slots.</p>
        ) : loadingTimes ? (
          <p className="ua-modal__hint">Loading available slots...</p>
        ) : timeLoadError ? (
          <p className="ua-modal__error">{timeLoadError}</p>
        ) : hasSlots ? (
          <div className="ua-modal__slots">
            {availableTimes.map((slotTime) => (
              <button
                key={slotTime}
                type="button"
                className={`ua-modal__slot ${newTime === slotTime ? 'ua-modal__slot--active' : ''}`}
                onClick={() => setNewTime(slotTime)}
              >
                {slotTime}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="ua-modal__hint">No available slots for this date. You can set a custom time.</p>
            <input
              type="time"
              className="ua-modal__input"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </>
        )}

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const mountedRef = useRef(true);
  const fetchInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAppointments = useCallback(async (options = {}) => {
    if (!profile?.id) return;

    // Skip duplicate silent refreshes when a request is already in-flight.
    if (fetchInFlightRef.current && options?.silent) return;
    fetchInFlightRef.current = true;

    const silent = Boolean(options?.silent);
    if (!silent) setIsRefreshing(true);

    try {
      const rows = await fetchAttorneyUpcomingAppointments(profile.id, options);
      if (!mountedRef.current) return;
      setAppointments(rows);
      setLoadError('');
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (!mountedRef.current) return;
      setAppointments([]);
      setLoadError(error.message || 'Unable to load appointments.');
    } finally {
      fetchInFlightRef.current = false;
      if (!silent && mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [profile?.id]);

  useEffect(() => {
    loadAppointments({ force: true });

    const unsubscribe = subscribeToAttorneyAppointments(profile?.id, () => {
      loadAppointments({ force: true, silent: true });
    });

    const pollId = window.setInterval(() => {
      loadAppointments({ force: true, silent: true });
    }, 10000);

    const handleWindowFocus = () => {
      loadAppointments({ force: true, silent: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAppointments({ force: true, silent: true });
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe();
    };
  }, [loadAppointments, profile?.id]);

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

    const sortBySchedule = (rows) =>
      rows.slice().sort((a, b) => {
        const aTime = new Date(a.scheduledAt || 0).getTime() || 0;
        const bTime = new Date(b.scheduledAt || 0).getTime() || 0;
        return aTime - bTime;
      });

    return {
      todayAppts: today,
      tomorrowAppts: sortBySchedule(nextDay),
      weekAppts: sortBySchedule(week),
    };
  }, [appointments, currentYear, todayDate, tomorrowDate]);

  const totalUpcoming = todayAppts.length + tomorrowAppts.length + weekAppts.length;
  const lastUpdatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : 'Not yet synced';

  const attorneyAvatarSrc = useMemo(
    () => `https://ui-avatars.com/api/?name=${encodeURIComponent(attorneyDisplayName)}&background=1c1f2e&color=fff&size=38`,
    [attorneyDisplayName],
  );

  const handleReschedule = async (date, time, note) => {
    try {
      const normalizedTime = normalizeSlotTimeLabel(time);
      const rescheduledAt = new Date(`${date}T${normalizedTime}`);
      if (Number.isNaN(rescheduledAt.getTime())) {
        throw new Error('Invalid date/time selected.');
      }

      await rescheduleAttorneyAppointment({
        appointmentId: reschedAppt.id,
        scheduledAt: rescheduledAt.toISOString(),
        note,
      });
      await loadAppointments({ force: true, silent: true });
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to reschedule appointment.');
    }
    setReschedAppt(null);
  };

  const renderCard = (appt) => {
    const canEnterConsultation = isConsultationChatWindowOpen({
      status: appt.status,
      scheduledAt: appt.scheduledAt,
      slotDate: appt.slotDate,
      slotTime: appt.slotTime,
    });

    return (
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
            disabled={!canEnterConsultation}
            onClick={() => onNavigate('attorney-messages', { appointmentId: appt.id })}
          >
            ENTER CONSULTATION
          </button>
        </div>
      </div>
    </div>
    );
  };

  const renderSection = (title, items) => (
    <section className="ua-section" key={title}>
      <div className="ua-section__header">
        <h2 className="ua-section__title">{title}</h2>
        <span className="ua-section__count">{items.length}</span>
      </div>
      <div className="ua-section__grid">
        {items.length ? (
          items.map(renderCard)
        ) : (
          <div className="ua-empty-state" role="status" aria-live="polite">
            <p className="ua-empty-state__title">No appointments yet</p>
            <p className="ua-empty-state__text">
              New bookings for you will appear here automatically.
            </p>
          </div>
        )}
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
            { label: 'Logs',          icon: <LogsIcon />,               nav: 'attorney-logs' },
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
          <div className="ua-topbar__logo">
            <img src="/logo/logo.jpg" alt="BatasMo" className="ua-topbar__brand-logo" />
            <div>
              <p className="ua-topbar__eyebrow">Attorney Workspace</p>
              <span>My Appointments</span>
            </div>
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
        <section className="ua-summary">
          <div>
            <p className="ua-summary__label">UPCOMING CONSULTATIONS</p>
            <h2 className="ua-summary__count">{totalUpcoming}</h2>
            <p className="ua-summary__meta">Last synced: {lastUpdatedLabel}</p>
          </div>
          <button
            className="ua-summary__refresh"
            type="button"
            onClick={() => loadAppointments({ force: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </section>

        {loadError ? <p className="ua-load-error">{loadError}</p> : null}
        {renderSection("TODAY'S APPOINTMENTS", todayAppts)}
        {renderSection("TOMORROW'S APPOINTMENTS", tomorrowAppts)}
        {renderSection("UPCOMING THIS WEEK", weekAppts)}
      </main>

      {/* Reschedule Modal */}
      {reschedAppt && (
        <RescheduleModal
          appointment={reschedAppt}
          attorneyId={profile?.id}
          onClose={() => setReschedAppt(null)}
          onConfirm={handleReschedule}
        />
      )}
    </div>
  );
}

export default UpcomingAppointments;
