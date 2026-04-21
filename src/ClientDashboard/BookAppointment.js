import { useEffect, useRef, useState, useCallback } from 'react';
import './BookAppointment.css';
import {
  assertNoActiveAppointmentForClient,
  createAppointmentBooking,
  fetchBookableAttorneys,
  getAppointmentPaymentStatus,
  getAvailability,
  invalidateAvailabilityCache,
  payForAppointment,
  subscribeToAvailabilitySlots,
} from '../lib/userApi';

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
const BaDashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const BaCalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const BaMyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
  </svg>
);
const BaNotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const BaAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const BaTransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const BaLogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);
const BaProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
// eslint-disable-next-line no-unused-vars
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ScaleSmIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const VerifiedIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#f5a623" stroke="none">
    <path d="M12 2l2.4 4.8 5.6.8-4 3.9.9 5.5L12 14.4l-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>
  </svg>
);

// ============================================================================
// Memoized Time Slot Button (prevents re-renders)
// ============================================================================

const TimeSlotButton = ({ timeStr, isSelected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 8px',
      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
      background: isSelected ? '#dbeafe' : '#fff',
      borderRadius: 4,
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: isSelected ? '600' : '400',
      transition: 'all 0.2s',
    }}
  >
    {timeStr}
  </button>
);

const mapFutureTimeStrings = (slots, date) => {
  const now = new Date();
  const isToday = date === now.toISOString().split('T')[0];

  const allTimes = (slots || []).map((slot) => slot.time);
  if (!isToday) {
    return { visibleTimes: allTimes, hiddenPastCount: 0 };
  }

  let hiddenPastCount = 0;
  const visibleTimes = allTimes.filter((timeStr) => {
    const [time, meridiemRaw] = String(timeStr || '').split(' ');
    const [hour, minute] = String(time || '').split(':').map(Number);
    const meridiem = String(meridiemRaw || '').toUpperCase();

    let hourNum = hour;
    if (meridiem === 'PM' && hourNum < 12) hourNum += 12;
    if (meridiem === 'AM' && hourNum === 12) hourNum = 0;

    const slotMinutes = hourNum * 60 + minute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isFuture = slotMinutes > nowMinutes;
    if (!isFuture) hiddenPastCount += 1;
    return isFuture;
  });

  return { visibleTimes, hiddenPastCount };
};

function BookAppointment({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attorneys, setAttorneys] = useState([]);
  const [attorneysLoading, setAttorneysLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedAttorney, setSelectedAttorney] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingAttorney, setBookingAttorney] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedAttorney, setConfirmedAttorney] = useState(null);
  const [bookingStep, setBookingStep] = useState(1); // 1=Date,Slot,Reason  2=Confirm before payment
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [hiddenPastSlotsCount, setHiddenPastSlotsCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [isPaying, setIsPaying] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const pendingTimeoutsRef = useRef([]);

  const loadAttorneys = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
    if (!silent) setAttorneysLoading(true);
    try {
      const rows = await fetchBookableAttorneys({ concern: '', onlyVerified: false });
      setAttorneys(rows);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load attorneys.');
      if (!silent) {
        setAttorneys([]);
      }
    } finally {
      if (!silent) setAttorneysLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    const guardedLoad = async (options = {}) => {
      if (disposed) return;
      await loadAttorneys(options);
    };

    guardedLoad();

    const pollId = window.setInterval(() => {
      guardedLoad({ silent: true });
    }, 10000);

    const handleFocus = () => {
      guardedLoad({ silent: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        guardedLoad({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      window.clearInterval(pollId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadAttorneys]);

  useEffect(() => {
    return () => {
      pendingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingTimeoutsRef.current = [];
      console.log('[lifecycle] BookAppointment unmounted');
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAvailabilitySlots(async (payload) => {
      const changedRow = payload?.new || payload?.old || {};
      const changedAttorneyId = changedRow.attorney_id;
      const changedDate = changedRow.date;

      invalidateAvailabilityCache(changedAttorneyId, changedDate);
      await loadAttorneys({ silent: true });

      if (!bookingAttorney?.id || !selectedDate) return;
      if (changedAttorneyId && String(changedAttorneyId) !== String(bookingAttorney.id)) return;

      try {
        setSlotsLoading(true);
        const updatedSlots = await getAvailability(bookingAttorney.id, selectedDate, { force: true });
        const { visibleTimes, hiddenPastCount } = mapFutureTimeStrings(updatedSlots, selectedDate);
        setAvailableSlots(visibleTimes);
        setHiddenPastSlotsCount(hiddenPastCount);
      } catch {
        // Keep the current UI state if realtime slot refresh fails.
      } finally {
        setSlotsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [bookingAttorney?.id, selectedDate, loadAttorneys]);

  const runDeferred = (callback, delayMs = 300) => {
    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delayMs);
    pendingTimeoutsRef.current.push(timeoutId);
  };

  const handleViewProfile = (attorney) => {
    setSelectedAttorney(attorney);
    setShowProfile(true);
  };

  const closeProfile = () => {
    setShowProfile(false);
    runDeferred(() => setSelectedAttorney(null));
  };

  const handleBookNow = (attorney) => {
    setBookingAttorney(attorney);
    setBookingStep(1);
    setSelectedDate('');
    setSelectedTime('');
    setReason('');
    setAvailableSlots([]);
    setHiddenPastSlotsCount(0);
    setPaymentMethod('GCash');
    setShowBooking(true);
  };

  const closeBooking = () => {
    setShowBooking(false);
    runDeferred(() => {
      setBookingAttorney(null);
      setBookingStep(1);
      setSelectedDate('');
      setSelectedTime('');
      setReason('');
      setAvailableSlots([]);
      setHiddenPastSlotsCount(0);
      setPaymentMethod('GCash');
      setConfirmedSlot(null);
    });
  };

  const handleDateChange = useCallback(async (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setHiddenPastSlotsCount(0);

    if (!date || !bookingAttorney) return;

    try {
      setSlotsLoading(true);
      
      // Get slots from database (already filtered by is_booked=false)
      const slots = await getAvailability(bookingAttorney.id, date, { force: true });

      const { visibleTimes, hiddenPastCount } = mapFutureTimeStrings(slots, date);
      setAvailableSlots(visibleTimes);
      setHiddenPastSlotsCount(hiddenPastCount);
      setSubmitError('');
    } catch (error) {
      setSubmitError('Failed to load available slots. Please try again.');
      setAvailableSlots([]);
      setHiddenPastSlotsCount(0);
    } finally {
      setSlotsLoading(false);
    }
  }, [bookingAttorney]);

  const buildScheduledIso = (dateStr, timeStr) => {
    const [time, meridiemRaw] = String(timeStr || '').split(' ');
    const [rawHour, rawMinute] = String(time || '').split(':').map(Number);
    const meridiem = String(meridiemRaw || '').toUpperCase();

    let hour = Number.isFinite(rawHour) ? rawHour : 0;
    const minute = Number.isFinite(rawMinute) ? rawMinute : 0;

    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    const [year, month, day] = String(dateStr || '').split('-').map(Number);
    const local = new Date(year, (month || 1) - 1, day || 1, hour, minute, 0);
    return local.toISOString();
  };

  const handlePayNow = async () => {
    if (!profile?.id || !bookingAttorney?.id || !selectedDate || !selectedTime) {
      setSubmitError('Please complete date and time selection before payment.');
      return;
    }

    let checkoutWindow = null;

    try {
      setIsPaying(true);
      setSubmitError('');

      // Pre-check before opening the PayMongo popup so the user sees a
      // clean error instead of a "preparing..." window that flashes and
      // closes when the backend throws.
      try {
        await assertNoActiveAppointmentForClient(profile.id);
      } catch (preCheckError) {
        setSubmitError(preCheckError?.message || 'Hindi ka pa puwedeng mag-book ng bagong consultation.');
        return;
      }

      checkoutWindow = window.open('', '_blank');
      if (checkoutWindow) {
        checkoutWindow.document.title = 'BatasMo Payment';
        checkoutWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 16px;">Preparing secure payment checkout...</p>';
      }

      const scheduledAtIso = buildScheduledIso(selectedDate, selectedTime);
      const slotDateTime = new Date(scheduledAtIso);
      if (Number.isNaN(slotDateTime.getTime()) || slotDateTime <= new Date()) {
        throw new Error('This selected slot is no longer in the future. Please choose another time.');
      }

      const bookingResult = await createAppointmentBooking({
        clientId: profile.id,
        attorneyId: bookingAttorney.id,
        title: `Consultation - ${bookingAttorney.specialty || 'General'}`,
        notes: reason.trim() || null,
        amount: bookingAttorney.amount || 2000,
        payload: {
          attorney_id: bookingAttorney.id,
          title: `Consultation - ${bookingAttorney.specialty || 'General'}`,
          notes: reason.trim() || null,
          scheduled_at: scheduledAtIso,
          slot_date: selectedDate,
          slot_time: selectedTime,
          amount: bookingAttorney.amount || 2000,
          duration_minutes: 60,
        },
      });

      const appointmentId = bookingResult?.appointmentId || null;
      if (!appointmentId) {
        throw new Error('Appointment was created but payment session could not start. Please try again.');
      }

      const session = await payForAppointment({
        appointmentId,
        clientId: profile.id,
        attorneyId: bookingAttorney.id,
        amount: bookingAttorney.amount || 2000,
        method: paymentMethod,
      });

      if (session?.checkoutUrl && checkoutWindow) {
        checkoutWindow.location.href = session.checkoutUrl;
      } else if (session?.checkoutUrl) {
        window.open(session.checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Checkout URL is missing. Please try again.');
      }

      const startedAt = Date.now();
      const timeoutMs = 5 * 60 * 1000;
      let paid = false;

      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const statusResult = await getAppointmentPaymentStatus(session.transactionId);
        const status = String(statusResult?.status || 'pending').toLowerCase();

        if (status === 'paid') {
          paid = true;
          break;
        }
        if (status === 'failed') {
          throw new Error('Payment failed. Please try again.');
        }
      }

      if (!paid) {
        throw new Error('Payment is still pending. Complete checkout, then try again in a few seconds.');
      }

      const parsedDate = new Date(`${selectedDate}T00:00:00`);
      setConfirmedSlot({
        dateLabel: Number.isNaN(parsedDate.getTime())
          ? selectedDate
          : parsedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        timeLabel: selectedTime,
      });
      setConfirmedAttorney(bookingAttorney);
      setShowBooking(false);
      setShowConfirmation(true);
    } catch (error) {
      if (checkoutWindow && !checkoutWindow.closed) {
        checkoutWindow.close();
      }
      setSubmitError(error?.message || 'Unable to complete payment. Please try again.');
    } finally {
      setIsPaying(false);
    }
  };

  const closeConfirmation = () => {
    setShowConfirmation(false);
    runDeferred(() => {
      setConfirmedAttorney(null);
      setConfirmedSlot(null);
      setBookingStep(1);
      setSelectedDate('');
      setSelectedTime('');
      setReason('');
      setAvailableSlots([]);
    });
  };
  return (
    <div className="ba-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="ba-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`ba-sidebar ${sidebarOpen ? 'ba-sidebar--open' : ''}`}>
        <div className="ba-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ba-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <BaDashboardIcon />,     nav: 'home-logged' },
            { label: 'Book Appointment',    icon: <BaCalendarIcon />,      nav: 'book-appointment' },
            { label: 'My Appointments',     icon: <BaMyApptIcon />,        nav: 'my-appointments' },
            { label: 'Notarial Requests',   icon: <BaNotarialIcon />,      nav: 'my-notarial-requests' },
            { label: 'Announcements',       icon: <BaAnnouncementIcon />,  nav: 'announcements' },
            { label: 'Transaction History', icon: <BaTransactionIcon />,   nav: 'transaction-history' },
            { label: 'Logs',                icon: <BaLogsIcon />,          nav: 'client-logs' },
            { label: 'Profile',             icon: <BaProfileIcon />,       nav: 'profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`ba-sidebar__item ${item.label === 'Book Appointment' ? 'ba-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="ba-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="ba-topbar">
        <div className="ba-topbar__left">
          <button className="ba-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="ba-breadcrumb">
            <span className="ba-breadcrumb__current">Book Appointment</span>
          </div>
        </div>
        <div className="ba-topbar__right">
          <button className="ba-icon-btn" onClick={() => onNavigate('chat-room')} title="Message Admin">
            <MessageIcon />
          </button>
          <button className="ba-icon-btn ba-bell" onClick={() => onNavigate('announcements')} title="Announcements">
            <BellIcon />
            <span className="ba-bell__dot" />
          </button>
          <div className="ba-profile" onClick={() => onNavigate('profile')} style={{ cursor: 'pointer' }}>
            <div className="ba-profile__info">
              <span className="ba-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="ba-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ba-main">
        {loadError ? <p>{loadError}</p> : null}
        <div className="ba-header">
          <h1>Book an Appointment</h1>
          <p>Select an attorney and book from their available time slots.</p>
        </div>

        {attorneysLoading ? (
          <p style={{ color: '#9ca3af', marginBottom: 12 }}>Loading attorneys...</p>
        ) : null}

        <div className="ba-grid">
          {attorneys.map((a, i) => (
            <div key={i} className="ba-card">
              <img src={a.img} alt={a.name} className="ba-card__photo" loading="lazy" decoding="async" />
              <div className="ba-card__name">
                {a.name} <VerifiedIcon />
              </div>
              <div className="ba-card__specialty">
                <ScaleSmIcon /> {a.specialty}
              </div>
              <div className="ba-card__exp">{a.exp}</div>
              <div className="ba-card__rating">
                ★ {a.rating.toFixed(1)} · {a.availableSlots.length} slots open
              </div>
              <div className="ba-card__price">{a.price}</div>
              <button
                className="ba-btn ba-btn--dark"
                onClick={() => handleBookNow(a)}
                title={a.availableSlots.length === 0 ? 'Open to check available dates and slots.' : 'Book now'}
              >
                Book Now
              </button>
              <button className="ba-btn ba-btn--ghost" onClick={() => handleViewProfile(a)}>View Profile</button>
            </div>
          ))}
        </div>
        {!attorneysLoading && !loadError && attorneys.length === 0 ? (
          <p style={{ color: '#9ca3af', marginTop: 12 }}>No attorneys found yet.</p>
        ) : null}
      </main>

      {/* Profile Modal */}
      {showProfile && selectedAttorney && (
        <div className="ba-modal-overlay" onClick={closeProfile}>
          <div className="ba-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ba-modal__header">
              <h2>Attorney Profile</h2>
              <button className="ba-modal__close" onClick={closeProfile}>✕</button>
            </div>
            
            <div className="ba-modal__content">
              <div className="ba-profile-header">
                <img src={selectedAttorney.img} alt={selectedAttorney.name} className="ba-profile-photo" loading="lazy" decoding="async" />
                <div className="ba-profile-info">
                  <h3 className="ba-profile-name">
                    {selectedAttorney.name} <VerifiedIcon />
                  </h3>
                  <p className="ba-profile-specialty">
                    <ScaleSmIcon /> {selectedAttorney.specialty}
                  </p>
                  <p className="ba-profile-exp">{selectedAttorney.exp}</p>
                  <p className="ba-profile-rating">
                    ★ {selectedAttorney.rating.toFixed(1)}/5.0 Rating
                  </p>
                </div>
              </div>

              <div className="ba-profile-section">
                <h4 className="ba-profile-section-title">Professional Biography</h4>
                <p className="ba-profile-bio">{selectedAttorney.bio}</p>
                <p className="ba-profile-details">{selectedAttorney.details}</p>
              </div>

              <div className="ba-profile-fee">
                <div className="ba-profile-fee-label">
                  CONSULTATION FEE
                  <span className="ba-profile-fee-desc">Initial Legal Assessment (1 Hour)</span>
                </div>
                <div className="ba-profile-fee-amount">{selectedAttorney.price}</div>
              </div>

              <div className="ba-profile-actions">
                <button
                  className="ba-btn ba-btn--dark ba-profile-btn"
                  onClick={() => { closeProfile(); handleBookNow(selectedAttorney); }}
                  title={(selectedAttorney?.availableSlots?.length || 0) === 0 ? 'Open to check available dates and slots.' : 'Book appointment'}
                >
                  Book Now
                </button>
                <button className="ba-btn ba-btn--ghost ba-profile-btn-secondary" onClick={closeProfile}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBooking && bookingAttorney && (
        <div className="ba-booking-overlay" onClick={closeBooking}>
          <div className="ba-booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ba-booking-header">
              <h2>Complete Your Booking</h2>
              <button className="ba-modal__close" onClick={closeBooking}>✕</button>
            </div>
            
            <div className="ba-booking-content">
              <div className="ba-booking-attorney-info">
                <div className="ba-booking-info-item">
                  <span className="ba-booking-label">Attorney:</span>
                  <span className="ba-booking-value">{bookingAttorney.name}</span>
                </div>
                <div className="ba-booking-info-item">
                  <span className="ba-booking-label">Specialty:</span>
                  <span className="ba-booking-value">{bookingAttorney.specialty}</span>
                </div>
                <div className="ba-booking-info-item">
                  <span className="ba-booking-label">Fee:</span>
                  <span className="ba-booking-value ba-booking-price">PHP 2,000.00</span>
                </div>
              </div>

              <div className="ba-booking-form">
                {submitError ? <div style={{ color: '#ef4444', marginBottom: 12, padding: 10, background: '#fee2e2', borderRadius: 4 }}>{submitError}</div> : null}

                {/* Step 1: Select Date & Time & Reason */}
                <div className="ba-form-group">
                  <label className="ba-form-label">Select Date</label>
                  <input
                    type="date"
                    className="ba-form-input"
                    value={selectedDate}
                    onChange={handleDateChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {selectedDate && bookingStep === 1 && (
                  <>
                    <div className="ba-form-group">
                      <label className="ba-form-label">Available Time Slots</label>
                      {hiddenPastSlotsCount > 0 ? (
                        <p style={{ color: '#f59e0b', marginBottom: 8, fontSize: '0.85rem' }}>
                          {hiddenPastSlotsCount} slot{hiddenPastSlotsCount > 1 ? 's were' : ' was'} hidden because the time already passed today.
                        </p>
                      ) : null}
                      {slotsLoading ? (
                        <p style={{ color: '#6b7280', textAlign: 'center' }}>Loading available slots...</p>
                      ) : availableSlots.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
                          {availableSlots.map((timeStr) => (
                            <TimeSlotButton
                              key={timeStr}
                              timeStr={timeStr}
                              isSelected={selectedTime === timeStr}
                              onClick={() => setSelectedTime(timeStr)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#ef4444' }}>No available slots for this date. Please select another date.</p>
                      )}
                    </div>

                    <div className="ba-form-group">
                      <label className="ba-form-label">Notes (Optional)</label>
                      <textarea
                        className="ba-form-textarea"
                        placeholder="Add notes for the attorney (optional)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows="3"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button
                        className="ba-booking-btn ba-booking-btn--submit"
                        onClick={() => {
                          if (!selectedTime) {
                            setSubmitError('Please select a time slot.');
                            return;
                          }
                          setSubmitError('');
                          setBookingStep(2);
                        }}
                        style={{ flex: 1 }}
                      >
                        Proceed to Payment →
                      </button>
                      <button className="ba-booking-btn ba-booking-btn--cancel" onClick={closeBooking}>Cancel</button>
                    </div>
                  </>
                )}

                {bookingStep === 2 && (
                  <>
                    <div className="ba-form-group">
                      <label className="ba-form-label">💳 Payment Method</label>
                      <select
                        className="ba-form-input"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="GCash">GCash</option>
                        <option value="Maya">Maya</option>
                      </select>
                    </div>

                    <div className="ba-form-group">
                      <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                        <div><strong>Date:</strong> {selectedDate}</div>
                        <div><strong>Time:</strong> {selectedTime}</div>
                        <div><strong>Amount:</strong> PHP 2,000.00</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button
                        className="ba-booking-btn ba-booking-btn--cancel"
                        onClick={() => setBookingStep(1)}
                        disabled={isPaying}
                      >
                        ← Back
                      </button>
                      <button
                        className="ba-booking-btn ba-booking-btn--submit"
                        onClick={handlePayNow}
                        disabled={isPaying}
                        style={{ flex: 1 }}
                      >
                        {isPaying ? 'Processing...' : 'Pay Now'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && confirmedAttorney && (
        <div className="ba-confirmation-overlay" onClick={closeConfirmation}>
          <div className="ba-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ba-confirmation-content">
              <div className="ba-confirmation-icon-wrapper">
                <div className="ba-confirmation-icon">✓</div>
              </div>
              
              <h2 className="ba-confirmation-title">Booking Confirmed!</h2>
              
              <div className="ba-confirmation-message">
                <p>Your consultation with <strong>{confirmedAttorney.name}</strong> has been confirmed and paid successfully.</p>
              </div>

              <div className="ba-confirmation-what-next">
                <h4 className="ba-what-next-title">What Happens Next?</h4>
                <ul className="ba-what-next-list">
                  <li>Your appointment status is now <strong>Approved</strong></li>
                  <li>The selected schedule slot is automatically blocked from further bookings</li>
                  <li>You will still receive reminders and announcements in your dashboard</li>
                </ul>
              </div>

              <div className="ba-booking-details-section">
                <h4 className="ba-details-title">Booking Details:</h4>
                <div className="ba-details-list">
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Attorney:</span>
                    <span className="ba-detail-value">{confirmedAttorney.name}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Specialty:</span>
                    <span className="ba-detail-value">{confirmedAttorney.specialty}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Date:</span>
                    <span className="ba-detail-value">{confirmedSlot?.dateLabel || 'Not selected'}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Time:</span>
                    <span className="ba-detail-value">{confirmedSlot?.timeLabel || 'Not selected'}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Fee:</span>
                    <span className="ba-detail-value ba-detail-fee">{confirmedAttorney.price}</span>
                  </div>
                </div>
              </div>

              <button className="ba-confirmation-btn" onClick={() => onNavigate('home-logged')}>Go Back to Dashboard</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat FAB */}
      <button className="ba-chat-fab" title="AI Assistant">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
          <circle cx="9" cy="13" r="1" fill="#fff" stroke="none"/>
          <circle cx="15" cy="13" r="1" fill="#fff" stroke="none"/>
          <path d="M9 17s1 1 3 1 3-1 3-1"/>
        </svg>
      </button>
    </div>
  );
}

export default BookAppointment;
