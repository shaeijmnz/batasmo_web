import { useEffect, useRef, useState } from 'react';
import './ManageAvailability.css';
import { fetchAttorneyAvailabilitySlots, saveAttorneyAvailabilitySlots } from '../lib/userApi';

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
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const createBlankSlot = () => {
  const now = new Date();
  return { date: now.toISOString().slice(0, 10), start: '09:00', end: '10:00' };
};

const toIso = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export default function ManageAvailability({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [slots, setSlots] = useState([createBlankSlot()]);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const saveResetTimeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyAvailabilitySlots(profile.id);
        if (!isMounted) return;

        if (!rows.length) {
          setSlots([createBlankSlot()]);
          return;
        }

        setSlots(
          rows.map((item) => {
            const start = new Date(item.startTime);
            const end = new Date(item.endTime);
            return {
              id: item.id,
              date: Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 10),
              start: Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(11, 16),
              end: Number.isNaN(end.getTime()) ? '' : end.toISOString().slice(11, 16),
            };
          }),
        );
        setLoadError('');
      } catch (error) {
        if (isMounted) setLoadError(error.message || 'Failed to load availability slots.');
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    return () => {
      if (saveResetTimeoutRef.current) {
        clearTimeout(saveResetTimeoutRef.current);
        saveResetTimeoutRef.current = null;
      }
      console.log('[lifecycle] ManageAvailability unmounted');
    };
  }, []);

  const updateSlot = (index, field, value) => {
    setSlots((prev) => prev.map((slot, idx) => (idx === index ? { ...slot, [field]: value } : slot)));
    setSaved(false);
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, createBlankSlot()]);
    setSaved(false);
  };

  const removeSlot = (index) => {
    setSlots((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [createBlankSlot()];
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile?.id) {
      setLoadError('Missing attorney profile. Please log in again.');
      return;
    }

    const now = new Date();
    const prepared = slots
      .map((slot) => ({
        startTime: toIso(slot.date, slot.start),
        endTime: toIso(slot.date, slot.end),
      }))
      .filter((slot) => {
        if (!slot.startTime || !slot.endTime) return false;
        const start = new Date(slot.startTime);
        const end = new Date(slot.endTime);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        if (end <= start) return false;
        return start > now;
      })
      .filter((slot) => Boolean(slot.startTime) && Boolean(slot.endTime));

    if (!prepared.length) {
      setLoadError('Please add at least one valid future schedule slot.');
      return;
    }

    try {
      await saveAttorneyAvailabilitySlots({ attorneyId: profile.id, slots: prepared });
      setLoadError('');
      setSaved(true);
      if (saveResetTimeoutRef.current) {
        clearTimeout(saveResetTimeoutRef.current);
      }
      saveResetTimeoutRef.current = setTimeout(() => {
        setSaved(false);
        saveResetTimeoutRef.current = null;
      }, 3000);
    } catch (error) {
      setLoadError(error.message || 'Failed to save availability schedule.');
    }
  };

  const sidebarItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Logs', icon: <LogsIcon />, nav: 'attorney-logs' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile', icon: <ProfileIcon />, nav: 'attorney-profile' },
  ];

  return (
    <div className="ma-page">
      {sidebarOpen && <div className="ma-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`ma-sidebar ${sidebarOpen ? 'ma-sidebar--open' : ''}`}>
        <div className="ma-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ma-sidebar__nav">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              className="ma-sidebar__item"
              onClick={() => {
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="ma-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="ma-topbar">
        <div className="ma-topbar__left">
          <button className="ma-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="ma-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="ma-topbar__right">
          <span className="ma-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
          <div className="ma-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      <main className="ma-main">
        <div className="ma-header">
          <div>
            <h1>Manage Availability</h1>
            <p>Set your date and time slots so clients can book consultations automatically.</p>
          </div>
          <button className="ma-save-btn" onClick={handleSave}>
            <CheckIcon /> Save Schedule
          </button>
        </div>

        {saved && (
          <div className="ma-toast">
            <CheckIcon /> Schedule saved successfully!
          </div>
        )}

        {loadError ? <p>{loadError}</p> : null}

        <div className="ma-schedule">
          {slots.map((slot, idx) => (
            <div className="ma-day-card ma-day-card--active" key={`${slot.id || 'slot'}-${idx}`}>
              <div className="ma-day-card__header">
                <span className="ma-day-card__name">Slot {idx + 1}</span>
              </div>

              <div className="ma-day-card__slots">
                <div className="ma-slot">
                  <ClockIcon />
                  <input type="date" className="ma-slot__select" value={slot.date} onChange={(e) => updateSlot(idx, 'date', e.target.value)} />
                  <input type="time" className="ma-slot__select" value={slot.start} onChange={(e) => updateSlot(idx, 'start', e.target.value)} />
                  <span className="ma-slot__to">to</span>
                  <input type="time" className="ma-slot__select" value={slot.end} onChange={(e) => updateSlot(idx, 'end', e.target.value)} />
                  {slots.length > 1 && (
                    <button className="ma-slot__remove" onClick={() => removeSlot(idx)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>

                <button className="ma-add-slot" onClick={addSlot}>
                  <PlusIcon /> Add Time Slot
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
