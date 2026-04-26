import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText,
  BarChart3, Settings, LogOut, Menu, Plus, Search, 
  Filter, Download, Mail, Phone, Star, Calendar, CheckCircle, X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchAttorneyAvailabilitySlots, saveAttorneyAvailabilitySlots } from '../lib/userApi';
import './AdminTheme.css';
import './attorneys.css';

const formatSpecialty = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || 'General Practice';
  }
  const text = String(value || '').trim();
  return text || 'General Practice';
};

const formatExperience = (years) => {
  const numeric = Number(years);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric} years experience`;
  }
  return 'Experience not set';
};

const computeAvailability = (activeCount) => (activeCount > 0 ? 'Busy' : 'Available');

const resolveAttorneyImage = (name) => {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^atty\s+/, '')
    .trim();

  if (normalized.includes('jeanne') && normalized.includes('anarna')) {
    return '/assets/attorneys/jeanne-luz-castillo-anarna.jpg';
  }

  if (normalized.includes('alston') && normalized.includes('anarna')) {
    return '/assets/attorneys/alston-kevin-anarna.jpg';
  }

  if (normalized.includes('allen') && normalized.includes('anarna')) {
    return '/assets/attorneys/allen-kristopher-anarna.png';
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Attorney')}&background=152238&color=ffffff`;
};

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
const MONTHLY_WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

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

  for (let index = 0; index < leadingCount; index += 1) {
    cells.push({ type: 'blank', key: `leading-${index}` });
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

const Attorneys = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attorneyStats, setAttorneyStats] = useState([
    { label: 'Total Attorneys', value: '0', color: '#1e3a8a' },
    { label: 'Available Now', value: '0', color: '#22c55e' },
    { label: 'Total Consultations', value: '0', color: '#3b82f6' },
  ]);
  const [attorneysList, setAttorneysList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [availabilityAttorney, setAvailabilityAttorney] = useState(null);
  const [availabilityByDate, setAvailabilityByDate] = useState({});
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [monthlyTemplateTimes, setMonthlyTemplateTimes] = useState(['14:00', '15:00', '16:00']);
  const [monthlyTemplateWeekdays, setMonthlyTemplateWeekdays] = useState([1, 2, 3, 4, 5]);
  const [monthlyApplyMessage, setMonthlyApplyMessage] = useState('');
  const navigate = (path) => {
    const pageMap = {
      '/': 'admin-home',
      '/clients': 'admin-clients',
      '/attorneys': 'admin-attorneys',
      '/requests': 'admin-requests',
      '/consultations': 'admin-consultations',
      '/reports': 'admin-reports',
      '/settings': 'admin-settings',
    };
    onNavigate?.(pageMap[path] || 'admin-home');
  };
  const handleQuickAction = (message) => window.alert(message);

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadAttorneys = async () => {
      try {
        const [profilesRes, attorneyProfilesRes, appointmentsRes, feedbackRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .eq('role', 'Attorney')
            .order('created_at', { ascending: false }),
          supabase
            .from('attorney_profiles')
            .select('user_id, years_experience, specialties')
            .order('created_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('id, attorney_id, status')
            .order('created_at', { ascending: false }),
          supabase
            .from('consultation_feedback')
            .select('attorney_id, rating')
            .order('created_at', { ascending: false }),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (attorneyProfilesRes.error) throw attorneyProfilesRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;

        const profileRows = profilesRes.data || [];
        const attorneyProfileRows = attorneyProfilesRes.data || [];
        const appointmentRows = appointmentsRes.data || [];
        const feedbackRows = feedbackRes.data || [];

        const attorneyProfileById = new Map(attorneyProfileRows.map((row) => [row.user_id, row]));

        const consultationsByAttorney = new Map();
        const completedCasesByAttorney = new Map();
        const activeByAttorney = new Map();
        appointmentRows.forEach((row) => {
          const attorneyId = row.attorney_id;
          if (!attorneyId) return;

          const status = String(row.status || '').toLowerCase();
          if (status !== 'cancelled') {
            consultationsByAttorney.set(
              attorneyId,
              Number(consultationsByAttorney.get(attorneyId) || 0) + 1,
            );
          }
          if (status === 'completed') {
            completedCasesByAttorney.set(
              attorneyId,
              Number(completedCasesByAttorney.get(attorneyId) || 0) + 1,
            );
          }
          if (status === 'started' || status === 'in_progress' || status === 'in-progress' || status === 'active') {
            activeByAttorney.set(attorneyId, Number(activeByAttorney.get(attorneyId) || 0) + 1);
          }
        });

        const ratingAggregateByAttorney = new Map();
        feedbackRows.forEach((row) => {
          const attorneyId = row.attorney_id;
          if (!attorneyId) return;
          const current = ratingAggregateByAttorney.get(attorneyId) || { total: 0, count: 0 };
          current.total += Number(row.rating || 0);
          current.count += 1;
          ratingAggregateByAttorney.set(attorneyId, current);
        });

        const normalized = profileRows.map((row) => {
          const extra = attorneyProfileById.get(row.id);
          const ratingData = ratingAggregateByAttorney.get(row.id) || { total: 0, count: 0 };
          const rating = ratingData.count > 0 ? (ratingData.total / ratingData.count) : 0;
          const activeCount = Number(activeByAttorney.get(row.id) || 0);
          return {
            id: row.id,
            name: row.full_name || 'Attorney',
            imageUrl: resolveAttorneyImage(row.full_name || 'Attorney'),
            status: computeAvailability(activeCount),
            rating: rating.toFixed(1),
            specialty: formatSpecialty(extra?.specialties),
            experience: formatExperience(extra?.years_experience),
            email: row.email || 'No email',
            phone: row.phone || 'No phone',
            consultations: Number(consultationsByAttorney.get(row.id) || 0),
            cases: Number(completedCasesByAttorney.get(row.id) || 0),
          };
        });

        const availableCount = normalized.filter((item) => item.status === 'Available').length;
        const completedConsultations = normalized.reduce((sum, item) => sum + item.cases, 0);

        if (!isMounted) return;

        setAttorneysList(normalized);
        setAttorneyStats([
          { label: 'Total Attorneys', value: profileRows.length.toLocaleString(), color: '#1e3a8a' },
          { label: 'Available Now', value: availableCount.toLocaleString(), color: '#22c55e' },
          { label: 'Total Consultations', value: completedConsultations.toLocaleString(), color: '#3b82f6' },
        ]);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setAttorneysList([]);
          setLoadError(error.message || 'Failed to load attorneys.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAttorneys();

    const profilesChannel = supabase
      .channel('admin-attorneys-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadAttorneys())
      .subscribe();

    const attorneyProfilesChannel = supabase
      .channel('admin-attorneys-profile-details')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attorney_profiles' }, () => loadAttorneys())
      .subscribe();

    const appointmentsChannel = supabase
      .channel('admin-attorneys-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadAttorneys())
      .subscribe();

    const feedbackChannel = supabase
      .channel('admin-attorneys-feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_feedback' }, () => loadAttorneys())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(attorneyProfilesChannel);
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(feedbackChannel);
    };
  }, []);

  const filteredAttorneys = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return attorneysList;
    return attorneysList.filter((attorney) =>
      [attorney.name, attorney.specialty, attorney.email].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [attorneysList, searchTerm]);

  const loadAvailabilityForAttorney = useCallback(async (attorneyId) => {
    if (!attorneyId) return;

    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const rows = await fetchAttorneyAvailabilitySlots(attorneyId);
      const nextMap = {};

      rows.forEach((item) => {
        const dateKey = String(item.date || '').trim();
        if (!dateKey) return;

        const parsedTime = parseHourLabelTo24(item.startLabel);
        if (!parsedTime || !SLOT_TIME_OPTIONS.includes(parsedTime)) return;

        if (!nextMap[dateKey]) nextMap[dateKey] = [];
        if (!nextMap[dateKey].includes(parsedTime)) nextMap[dateKey].push(parsedTime);
      });

      Object.keys(nextMap).forEach((dateKey) => {
        nextMap[dateKey].sort();
      });

      setAvailabilityByDate(nextMap);
    } catch (error) {
      setAvailabilityError(error.message || 'Failed to load attorney availability.');
      setAvailabilityByDate({});
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  const openAvailabilityManager = (attorney) => {
    const now = new Date();
    setAvailabilityAttorney(attorney);
    setAvailabilityByDate({});
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(getTodayDateKey());
    setAvailabilitySaved(false);
    setAvailabilityError('');
    setMonthlyApplyMessage('');
    loadAvailabilityForAttorney(attorney.id);
  };

  const closeAvailabilityManager = () => {
    setAvailabilityAttorney(null);
    setAvailabilityByDate({});
    setAvailabilityError('');
    setAvailabilitySaved(false);
    setMonthlyApplyMessage('');
  };

  const changeMonth = (offset) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setAvailabilitySaved(false);
    setMonthlyApplyMessage('');
  };

  useEffect(() => {
    const currentMonthKey = monthKeyFromDate(monthCursor);
    if (!String(selectedDate || '').startsWith(currentMonthKey)) {
      const today = new Date();
      const todayKey = toDateKey(today);
      setSelectedDate(monthKeyFromDate(today) === currentMonthKey ? todayKey : `${currentMonthKey}-01`);
    }
  }, [monthCursor, selectedDate]);

  const toggleTimeSlot = (time24) => {
    if (!selectedDate || isPastDateTime(selectedDate, time24)) return;

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
    setAvailabilitySaved(false);
    setMonthlyApplyMessage('');
  };

  const toggleMonthlyTemplateTime = (time24) => {
    setMonthlyTemplateTimes((prev) => {
      const current = new Set(prev);
      if (current.has(time24)) {
        current.delete(time24);
      } else {
        current.add(time24);
      }
      return Array.from(current).sort();
    });
    setAvailabilitySaved(false);
    setMonthlyApplyMessage('');
  };

  const toggleMonthlyWeekday = (weekday) => {
    setMonthlyTemplateWeekdays((prev) => {
      const current = new Set(prev);
      if (current.has(weekday)) {
        current.delete(weekday);
      } else {
        current.add(weekday);
      }
      return Array.from(current).sort((a, b) => a - b);
    });
    setAvailabilitySaved(false);
    setMonthlyApplyMessage('');
  };

  const applyMonthlyTemplate = () => {
    if (monthlyTemplateTimes.length === 0) {
      setAvailabilityError('Choose at least one monthly time slot before applying.');
      return;
    }

    if (monthlyTemplateWeekdays.length === 0) {
      setAvailabilityError('Choose at least one weekday before applying the monthly schedule.');
      return;
    }

    const selectedWeekdays = new Set(monthlyTemplateWeekdays);
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthAssignments = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      if (!selectedWeekdays.has(date.getDay())) continue;

      const dateKey = toDateKey(date);
      const futureTimes = monthlyTemplateTimes.filter((time24) => !isPastDateTime(dateKey, time24));
      monthAssignments.push({ dateKey, futureTimes });
    }

    setAvailabilityByDate((prev) => {
      const next = { ...prev };

      monthAssignments.forEach(({ dateKey, futureTimes }) => {
        if (futureTimes.length > 0) {
          next[dateKey] = futureTimes;
        } else {
          delete next[dateKey];
        }
      });

      return next;
    });

    setAvailabilitySaved(false);
    setAvailabilityError('');
    const appliedDateCount = monthAssignments.filter((item) => item.futureTimes.length > 0).length;
    setMonthlyApplyMessage(`Monthly template applied to ${appliedDateCount} date(s). Click Save Schedule to sync it to clients.`);
  };

  const saveAvailability = async () => {
    if (!availabilityAttorney?.id) return;

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

    setAvailabilitySaving(true);
    setAvailabilityError('');
    try {
      await saveAttorneyAvailabilitySlots({ attorneyId: availabilityAttorney.id, slots: prepared });
      await loadAvailabilityForAttorney(availabilityAttorney.id);
      setAvailabilitySaved(true);
    } catch (error) {
      setAvailabilityError(error.message || 'Failed to save attorney availability.');
      setAvailabilitySaved(false);
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const calendarCells = buildCalendarCells(monthCursor);
  const selectedTimes = availabilityByDate[selectedDate] || [];
  const monthLabel = monthCursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          {isSidebarOpen && <img src="/logo/logo.jpg" alt="BatasMo logo" className="brand-logo" />}
          {isSidebarOpen && <span className="logo-text">BatasMo</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              active={item.path === '/attorneys'}
              open={isSidebarOpen}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-section">
            <div className="profile-avatar">AD</div>
            {isSidebarOpen && (
              <div className="profile-info">
                <p className="name">Admin User</p>
                <p className="email">admin@batasmo.com</p>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={() => handleQuickAction('Logout clicked')}>
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="content-wrapper">
          <div className="page-header">
            <div>
              <h2 className="title">Attorneys Management</h2>
              <p className="subtitle">Manage and view all registered attorneys</p>
            </div>
            <button className="add-btn" onClick={() => handleQuickAction('Use the main admin flow to add attorneys.')}> 
              <Plus size={18} /> Add New Attorney
            </button>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            {attorneyStats.map((stat, index) => (
              <div key={index} className="stat-card" style={{ borderLeft: `4px solid ${stat.color}` }}>
                <h3 className="stat-value">{stat.value}</h3>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="filter-bar">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search attorneys by name, specialty, or email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="filter-actions">
              <button className="btn-secondary" onClick={() => handleQuickAction('Attorney filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Attorney export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          {/* Attorneys List */}
          <div className="attorneys-container">
            <div className="list-header">
              <h3>All Attorneys ({filteredAttorneys.length})</h3>
            </div>
            {loadError ? <p className="attorneys-info-message">{loadError}</p> : null}
            {loading ? <p className="attorneys-info-message">Loading attorneys...</p> : null}
            <div className="attorney-stack">
              {filteredAttorneys.map((attorney) => (
                <div key={attorney.id} className="attorney-row">
                  <div className="attorney-identity">
                    <img className="attorney-avatar" src={attorney.imageUrl} alt={`${attorney.name} profile`} />
                    <div className="attorney-details">
                      <div className="name-wrapper">
                        <span className="attorney-name">{attorney.name}</span>
                        <span className={`status-badge ${attorney.status.toLowerCase()}`}>{attorney.status}</span>
                        <span className="rating-tag"><Star size={14} fill="#eab308" color="#eab308" /> {attorney.rating}</span>
                      </div>
                      <div className="specialty-row">
                        <span className="specialty-badge">{attorney.specialty}</span>
                        <span className="exp-text">{attorney.experience}</span>
                      </div>
                      <div className="contact-info">
                        <span><Mail size={14} /> {attorney.email}</span>
                        <span><Phone size={14} /> {attorney.phone}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="attorney-metrics">
                    <div className="metric-box">
                      <span className="m-value">{attorney.consultations}</span>
                      <span className="m-label">Consultations</span>
                    </div>
                    <div className="metric-box">
                      <span className="m-value">{attorney.cases}</span>
                      <span className="m-label">Cases</span>
                    </div>
                    <button
                      type="button"
                      className="manage-availability-btn"
                      onClick={() => openAvailabilityManager(attorney)}
                    >
                      <Calendar size={16} />
                      Manage Availability
                    </button>
                  </div>
                </div>
              ))}
              {!loading && !loadError && filteredAttorneys.length === 0 ? (
                <p className="attorneys-info-message">No attorneys found.</p>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {availabilityAttorney ? (
        <div className="availability-page-overlay">
          <section className="availability-page">
            <div className="availability-page__header">
              <div>
                <p className="availability-kicker">Admin Schedule Control</p>
                <h2>Manage Availability</h2>
                <p>
                  Set bookable time slots for <strong>{availabilityAttorney.name}</strong>. These slots appear on the client booking page.
                </p>
              </div>
              <button type="button" className="availability-close-btn" onClick={closeAvailabilityManager}>
                <X size={22} />
              </button>
            </div>

            {availabilityError ? <p className="availability-error">{availabilityError}</p> : null}
            {availabilitySaved ? (
              <p className="availability-success">
                <CheckCircle size={16} /> Availability saved and synced to clients.
              </p>
            ) : null}
            {monthlyApplyMessage ? <p className="availability-info">{monthlyApplyMessage}</p> : null}

            <div className="availability-layout">
              <section className="availability-card">
                <div className="availability-calendar-head">
                  <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
                  <h3>{monthLabel}</h3>
                  <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
                </div>

                <div className="availability-weekdays">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <span key={`${label}-${index}`}>{label}</span>
                  ))}
                </div>

                <div className="availability-days">
                  {calendarCells.map((cell) => {
                    if (cell.type === 'blank') {
                      return <span key={cell.key} className="availability-day availability-day--blank" />;
                    }

                    const hasAvailability = (availabilityByDate[cell.dateKey] || []).length > 0;
                    const isSelected = cell.dateKey === selectedDate;
                    const isToday = cell.dateKey === getTodayDateKey();

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        className={`availability-day ${isSelected ? 'availability-day--selected' : ''} ${isToday ? 'availability-day--today' : ''}`}
                        onClick={() => setSelectedDate(cell.dateKey)}
                      >
                        <span>{cell.day}</span>
                        {hasAvailability ? <i className="availability-dot" /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="availability-card">
                <div className="availability-slots-head">
                  <div>
                    <h3>{formatDisplayDate(selectedDate)}</h3>
                    <p>{selectedTimes.length} active slot(s)</p>
                  </div>
                  <button
                    type="button"
                    className="availability-save-btn"
                    onClick={saveAvailability}
                    disabled={availabilitySaving}
                  >
                    {availabilitySaving ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>

                {availabilityLoading ? <p className="availability-muted">Loading availability...</p> : null}

                <div className="availability-slot-grid">
                  {SLOT_TIME_OPTIONS.map((time24) => {
                    const active = selectedTimes.includes(time24);
                    const blockedByPast = isPastDateTime(selectedDate, time24);

                    return (
                      <button
                        key={time24}
                        type="button"
                        className={`availability-time-chip ${active ? 'availability-time-chip--active' : ''} ${blockedByPast ? 'availability-time-chip--disabled' : ''}`}
                        onClick={() => toggleTimeSlot(time24)}
                        disabled={blockedByPast}
                      >
                        <strong>{formatHourLabel(time24)}</strong>
                        <span>{blockedByPast ? 'Past' : active ? 'Available' : 'Tap to enable'}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="monthly-template-card">
                  <div className="monthly-template-head">
                    <div>
                      <h4>Monthly Template</h4>
                      <p>Pick the usual days and times, then apply them to the whole visible month.</p>
                    </div>
                    <button type="button" className="monthly-apply-btn" onClick={applyMonthlyTemplate}>
                      Apply to {monthLabel}
                    </button>
                  </div>

                  <div className="monthly-template-section">
                    <span className="monthly-template-label">Repeat on</span>
                    <div className="monthly-weekday-grid">
                      {MONTHLY_WEEKDAY_OPTIONS.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          className={`monthly-weekday-chip ${monthlyTemplateWeekdays.includes(day.value) ? 'monthly-weekday-chip--active' : ''}`}
                          onClick={() => toggleMonthlyWeekday(day.value)}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="monthly-template-section">
                    <span className="monthly-template-label">Time slots</span>
                    <div className="monthly-time-grid">
                      {SLOT_TIME_OPTIONS.map((time24) => {
                        const active = monthlyTemplateTimes.includes(time24);
                        return (
                          <button
                            key={`monthly-${time24}`}
                            type="button"
                            className={`monthly-time-chip ${active ? 'monthly-time-chip--active' : ''}`}
                            onClick={() => toggleMonthlyTemplateTime(time24)}
                          >
                            {formatHourLabel(time24)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

export default Attorneys;
