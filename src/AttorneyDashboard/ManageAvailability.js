import { useCallback, useEffect, useRef, useState } from 'react';
import './ManageAvailability.css';
import './AttorneyTheme.css';
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
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SLOT_TIME_OPTIONS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toDateKey = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateKey = () => toDateKey(new Date());

const formatDisplayDate = (dateKey) => {
  if (!dateKey) return 'No date selected';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatHourLabel = (time24) => {
  const [rawHour, rawMinute] = String(time24 || '').split(':').map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return String(time24 || '');
  const meridiem = rawHour >= 12 ? 'PM' : 'AM';
  const twelveHour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return `${String(twelveHour).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')} ${meridiem}`;
};

const parseHourLabelTo24 = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = String(match[2]).padStart(2, '0');
  const meridiem = String(match[3] || '').toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
};

const monthKeyFromDate = (dateValue) => `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}`;

const isPastDateTime = (dateKey, time24) => {
  const parsed = new Date(`${dateKey}T${time24}:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed <= new Date();
};

const buildCalendarCells = (monthCursor) => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingCount = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];

  for (let i = 0; i < leadingCount; i += 1) {
    cells.push({ type: 'blank', key: `leading-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({
      type: 'day',
      key: `day-${day}`,
      day,
      dateKey: toDateKey(date),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ type: 'blank', key: `trailing-${cells.length}` });
  }

  return cells;
};

export default function ManageAvailability({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [availabilityByDate, setAvailabilityByDate] = useState({});
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const saveResetTimeoutRef = useRef(null);

  const loadAvailability = useCallback(async () => {
    if (!profile?.id) return;

    setIsLoading(true);
    try {
      const rows = await fetchAttorneyAvailabilitySlots(profile.id);
      const nextMap = {};

      rows.forEach((item) => {
        const dateKey = String(item.date || '').trim();
        if (!dateKey) return;

        const parsedTime = parseHourLabelTo24(item.startLabel);
        if (!parsedTime) return;
        if (!SLOT_TIME_OPTIONS.includes(parsedTime)) return;

        if (!nextMap[dateKey]) nextMap[dateKey] = [];
        if (!nextMap[dateKey].includes(parsedTime)) nextMap[dateKey].push(parsedTime);
      });

      Object.keys(nextMap).forEach((dateKey) => {
        nextMap[dateKey].sort();
      });

      setAvailabilityByDate(nextMap);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to load availability slots.');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    const currentMonthKey = monthKeyFromDate(monthCursor);
    if (!String(selectedDate || '').startsWith(currentMonthKey)) {
      const today = new Date();
      const todayKey = toDateKey(today);
      if (monthKeyFromDate(today) === currentMonthKey) {
        setSelectedDate(todayKey);
      } else {
        setSelectedDate(`${currentMonthKey}-01`);
      }
    }
  }, [monthCursor, selectedDate]);

  useEffect(() => {
    return () => {
      if (saveResetTimeoutRef.current) {
        clearTimeout(saveResetTimeoutRef.current);
        saveResetTimeoutRef.current = null;
      }
    };
  }, []);

  const changeMonth = (offset) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSaved(false);
  };

  const toggleTimeSlot = (time24) => {
    if (!selectedDate) return;
    if (isPastDateTime(selectedDate, time24)) return;

    setAvailabilityByDate((prev) => {
      const current = new Set(prev[selectedDate] || []);
      if (current.has(time24)) {
        current.delete(time24);
      } else {
        current.add(time24);
      }

      const next = { ...prev };
      const sorted = Array.from(current).sort();
      if (sorted.length > 0) {
        next[selectedDate] = sorted;
      } else {
        delete next[selectedDate];
      }
      return next;
    });

    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile?.id) {
      setLoadError('Missing attorney profile. Please log in again.');
      return;
    }

    const now = new Date();
    const prepared = Object.entries(availabilityByDate)
      .flatMap(([dateKey, timeList]) =>
        (timeList || []).map((time24) => {
          const start = new Date(`${dateKey}T${time24}:00`);
          if (Number.isNaN(start.getTime()) || start <= now) return null;
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          return {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          };
        }),
      )
      .filter(Boolean);

    if (!prepared.length) {
      setLoadError('Please select at least one valid future time slot.');
      return;
    }

    try {
      await saveAttorneyAvailabilitySlots({ attorneyId: profile.id, slots: prepared });
      await loadAvailability();
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

  const calendarCells = buildCalendarCells(monthCursor);
  const selectedTimes = availabilityByDate[selectedDate] || [];
  const monthLabel = monthCursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  return (
    <div className="ma-page atty-page-wrapper">
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
              className={`ma-sidebar__item sidebar-item ${item.label === 'Consultation Management' ? 'ma-sidebar__item--active' : ''}`}
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
        </div>
        <div className="ma-topbar__right">
          <span className="ma-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
          <div className="ma-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      <main className="ma-main">
        <div className="ma-header">
          <div className="ma-header-group ap-header-group">
            <span className="ma-kicker ap-kicker">Attorney Workspace</span>
            <h1 className="ma-main-title ap-main-title">Manage Availability</h1>
            <p>Choose a month, tap a day, then toggle your active time slots for that day.</p>
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

        <section className="ma-calendar-card">
          <div className="ma-calendar-head">
            <button className="ma-month-nav" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <h2>{monthLabel}</h2>
            <button className="ma-month-nav" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>

          <div className="ma-weekdays">
            {WEEKDAY_LABELS.map((label, idx) => (
              <span key={`${label}-${idx}`}>{label}</span>
            ))}
          </div>

          <div className="ma-days-grid">
            {calendarCells.map((cell) => {
              if (cell.type === 'blank') {
                return <span key={cell.key} className="ma-day ma-day--blank" />;
              }

              const hasAvailability = (availabilityByDate[cell.dateKey] || []).length > 0;
              const isSelected = cell.dateKey === selectedDate;
              const isToday = cell.dateKey === getTodayDateKey();

              return (
                <button
                  key={cell.key}
                  className={`ma-day ${isSelected ? 'ma-day--selected' : ''} ${isToday ? 'ma-day--today' : ''}`}
                  onClick={() => setSelectedDate(cell.dateKey)}
                >
                  <span>{cell.day}</span>
                  {hasAvailability ? <i className="ma-day-dot" /> : null}
                </button>
              );
            })}
          </div>

          <div className="ma-legend">
            <span><i className="ma-day-dot" /> Available slots set</span>
          </div>
        </section>

        <section className="ma-slots-card">
          <div className="ma-slots-head">
            <h3>{formatDisplayDate(selectedDate)}</h3>
            <span>{selectedTimes.length} active slot(s)</span>
          </div>

          {isLoading ? <p>Loading availability...</p> : null}

          <div className="ma-slot-grid">
            {SLOT_TIME_OPTIONS.map((time24) => {
              const active = selectedTimes.includes(time24);
              const blockedByPast = isPastDateTime(selectedDate, time24);

              return (
                <button
                  key={time24}
                  className={`ma-time-chip ${active ? 'ma-time-chip--active' : ''} ${blockedByPast ? 'ma-time-chip--disabled' : ''}`}
                  onClick={() => toggleTimeSlot(time24)}
                  disabled={blockedByPast}
                >
                  <strong>{formatHourLabel(time24)}</strong>
                  <span>{blockedByPast ? 'Past' : active ? 'Available' : 'Tap to enable'}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
