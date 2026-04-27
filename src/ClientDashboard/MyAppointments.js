import { useCallback, useEffect, useMemo, useState } from 'react';
import './MyAppointments.css';
import {
  fetchClientAppointmentsData,
  fetchClientForfeitedRescheduleAlerts,
  getAppointmentPaymentStatus,
  getAvailability,
  normalizeSlotTimeLabel,
  payForAppointment,
  rescheduleClientAppointment,
} from '../lib/userApi';

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const MaDashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const MaCalSideIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const MaMyApptSideIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
  </svg>
);
const MaNotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const MaAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const MaTransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const MaLogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);
const MaProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

function MyAppointments({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentCode, setPaymentCode] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointmentForReschedule, setSelectedAppointmentForReschedule] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [forfeitAlert, setForfeitAlert] = useState(null);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedAppointmentForTranscript, setSelectedAppointmentForTranscript] = useState(null);
  const [reschedulePolicyNotice, setReschedulePolicyNotice] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const loadAppointments = useCallback(async (options = {}) => {
    if (!profile?.id) return;
    if (!options.silent) setIsRefreshing(true);

    try {
      const rows = await fetchClientAppointmentsData(profile.id);
      setAppointments(rows);
      setLoadError('');
      setLastUpdatedAt(new Date());
    } catch (error) {
      setLoadError(error.message || 'Unable to load appointments.');
    } finally {
      if (!options.silent) setIsRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    let cancelled = false;

    const loadForfeitAlert = async () => {
      if (!profile?.id) return;
      try {
        const alerts = await fetchClientForfeitedRescheduleAlerts(profile.id);
        if (cancelled || !alerts.length) return;

        const nextAlert = alerts.find((item) => {
          const key = `batasmo_forfeit_alert_seen_${item.id}`;
          return localStorage.getItem(key) !== '1';
        });

        if (nextAlert) {
          setForfeitAlert(nextAlert);
        }
      } catch (error) {
        console.warn('[forfeit-alert] unable to load alerts', error);
      }
    };

    loadForfeitAlert();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const upcomingAppointments = useMemo(
    () => appointments.filter((item) => ['PENDING', 'APPROVED'].includes(String(item.status || '').toUpperCase())),
    [appointments],
  );

  const queueAppointments = useMemo(
    () =>
      upcomingAppointments
        .slice()
        .sort((a, b) => Number(a.scheduledAtTs || 0) - Number(b.scheduledAtTs || 0)),
    [upcomingAppointments],
  );

  const totalUpcoming = queueAppointments.length;
  const lastUpdatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : 'Not yet synced';

  const formatAttorneyName = (name) =>
    String(name || 'Attorney')
      .replace(/^\s*(atty\.?\s*)+/i, '')
      .trim();

  const getInitials = (name) =>
    String(name || 'AT')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const getReschedulePolicyState = (appointment) => {
    const status = String(appointment.rawStatus || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || status === 'rejected') {
      return {
        can: false,
        type: 'admin',
        title: 'Reschedule Assistance Needed',
        reason: 'This appointment is already closed and can no longer be rescheduled from your dashboard.',
      };
    }
    const msUntilSchedule = Number(appointment.scheduledAtTs || 0) - Date.now();
    if (!Number.isFinite(msUntilSchedule) || msUntilSchedule <= 0) {
      return {
        can: false,
        type: 'admin',
        title: 'Appointment Date Has Passed',
        reason: 'Your consultation schedule has already passed. Please contact BatasMo Admin for further reschedule assistance.',
      };
    }
    if (appointment.hasClientRescheduled) {
      return {
        can: false,
        type: 'admin',
        title: 'One-Time Reschedule Used',
        reason: 'You already used your one-time reschedule option for this appointment. Please contact BatasMo Admin for further changes.',
      };
    }
    if (!Number.isFinite(msUntilSchedule) || msUntilSchedule < 24 * 60 * 60 * 1000) {
      return {
        can: false,
        type: 'policy',
        title: 'Reschedule Window Closed',
        reason: 'Client reschedule requests are allowed only at least 1 day before the consultation schedule.',
      };
    }
    return { can: true, type: '', title: '', reason: '' };
  };

  const openRescheduleModal = (appointment) => {
    const policy = getReschedulePolicyState(appointment);
    if (!policy.can) {
      setReschedulePolicyNotice({
        ...policy,
        appointment,
      });
      return;
    }
    setSelectedAppointmentForReschedule(appointment);
    setRescheduleDate('');
    setRescheduleTime('');
    setRescheduleReason('');
    setRescheduleSlots([]);
    setRescheduleError('');
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedAppointmentForReschedule(null);
    setRescheduleDate('');
    setRescheduleTime('');
    setRescheduleReason('');
    setRescheduleSlots([]);
    setRescheduleError('');
    setRescheduleSubmitting(false);
  };

  const closeReschedulePolicyNotice = () => {
    setReschedulePolicyNotice(null);
  };

  const closeForfeitAlert = () => {
    if (forfeitAlert?.id) {
      localStorage.setItem(`batasmo_forfeit_alert_seen_${forfeitAlert.id}`, '1');
    }
    setForfeitAlert(null);
  };

  useEffect(() => {
    let cancelled = false;
    const loadSlots = async () => {
      if (!showRescheduleModal || !selectedAppointmentForReschedule?.attorneyId || !rescheduleDate) {
        setRescheduleSlots([]);
        return;
      }
      try {
        setRescheduleLoadingSlots(true);
        const slots = await getAvailability(selectedAppointmentForReschedule.attorneyId, rescheduleDate, { force: true });
        if (cancelled) return;
        const unique = Array.from(new Set((slots || []).map((s) => String(s.time || '').trim()).filter(Boolean)));
        setRescheduleSlots(unique);
        setRescheduleTime((prev) => (unique.includes(prev) ? prev : ''));
      } catch (error) {
        if (cancelled) return;
        setRescheduleSlots([]);
        setRescheduleError(error.message || 'Unable to load available slots.');
      } finally {
        if (!cancelled) setRescheduleLoadingSlots(false);
      }
    };
    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [showRescheduleModal, selectedAppointmentForReschedule, rescheduleDate]);

  const handleRescheduleSubmit = async () => {
    if (!selectedAppointmentForReschedule) return;
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please select a new date and time.');
      return;
    }

    setRescheduleSubmitting(true);
    setRescheduleError('');
    try {
      const normalizedTime = normalizeSlotTimeLabel(rescheduleTime);
      const nextSchedule = new Date(`${rescheduleDate}T${normalizedTime}`);
      if (Number.isNaN(nextSchedule.getTime())) {
        throw new Error('Invalid schedule selected.');
      }
      await rescheduleClientAppointment({
        appointmentId: selectedAppointmentForReschedule.id,
        scheduledAt: nextSchedule.toISOString(),
        note: rescheduleReason.trim(),
      });
      await loadAppointments();
      closeRescheduleModal();
    } catch (error) {
      setRescheduleError(error.message || 'Unable to reschedule appointment.');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const renderAppointmentCard = (appointment) => {
    const reschedulePolicy = getReschedulePolicyState(appointment);
    const canEnterChat = appointment.chatAccessible && appointment.payment === 'PAID' && appointment.status !== 'COMPLETED';
    const attorneyName = formatAttorneyName(appointment.attorney);
    const areaLabel = String(appointment.specialty || 'Consultation').toUpperCase();

    return (
      <div key={appointment.id} className="ma-appointment-card ma-appointment-card--queue">
        <div className="ma-queue-card__top">
          <div className="ma-queue-card__avatar">{getInitials(attorneyName)}</div>
          <div className="ma-queue-card__info">
            <h3 className="ma-attorney-name">{attorneyName}</h3>
            <p className="ma-queue-card__area">CONSULTATION - {areaLabel}</p>
          </div>
        </div>

        <div className="ma-queue-card__bottom">
          <div className="ma-queue-card__schedule">
            <CalendarIcon />
            <span>{appointment.date} • {appointment.time}</span>
          </div>

          <div className="ma-queue-card__btns">
            <button
              className={`ma-btn ma-btn--queue-secondary ${reschedulePolicy.can ? '' : 'ma-btn--needs-assistance'}`}
              title={reschedulePolicy.can ? 'Reschedule this appointment' : reschedulePolicy.reason}
              onClick={() => openRescheduleModal(appointment)}
            >
              RESCHEDULE
            </button>
            <button
              className="ma-btn ma-btn--queue-primary"
              disabled={!canEnterChat}
              onClick={() => canEnterChat && onNavigate('chat-room', { appointmentId: appointment.id })}
            >
              ENTER CONSULTATION
            </button>
          </div>
        </div>
      </div>
    );
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedAppointmentForPayment(null);
    setSelectedPaymentMethod('');
    setPhoneNumber('');
    setPaymentCode('');
    setPaymentError('');
    setPaymentProcessing(false);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentMethod) {
      setPaymentError('Please select a payment method');
      return;
    }

    setPaymentError('');
    setPaymentProcessing(true);

    let checkoutWindow = null;

    try {
      checkoutWindow = window.open('', '_blank');
      if (checkoutWindow) {
        checkoutWindow.document.title = 'BatasMo Payment';
        checkoutWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 16px;">Preparing secure payment checkout...</p>';
      }

      const session = await payForAppointment({
        appointmentId: selectedAppointmentForPayment.id,
        clientId: profile?.id,
        attorneyId: selectedAppointmentForPayment.attorneyId,
        amount: selectedAppointmentForPayment.amount,
        method: selectedPaymentMethod,
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
      let pollDelayMs = 2500;

      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
        const statusResult = await getAppointmentPaymentStatus(session.transactionId);
        const status = String(statusResult?.status || 'pending').toLowerCase();

        if (status === 'paid') {
          paid = true;
          break;
        }
        if (status === 'failed') {
          throw new Error('Payment failed. Please try again.');
        }
        // Gradually slow polling to reduce load while waiting.
        pollDelayMs = Math.min(6000, pollDelayMs + 500);
      }

      if (!paid) {
        throw new Error('Payment is still pending. Complete checkout, then try again in a few seconds.');
      }

      await loadAppointments();
      setShowPaymentModal(false);
      setShowPaymentConfirmation(true);
      setLoadError('');
    } catch (error) {
      if (checkoutWindow && !checkoutWindow.closed) {
        checkoutWindow.close();
      }
      setPaymentError(error.message || 'Payment failed. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const closePaymentConfirmation = () => {
    setShowPaymentConfirmation(false);
    setSelectedAppointmentForPayment(null);
    setSelectedPaymentMethod('');
    setPhoneNumber('');
    setPaymentCode('');
  };

  const closeTranscriptModal = () => {
    setShowTranscriptModal(false);
    setSelectedAppointmentForTranscript(null);
  };

  return (
    <div className="ma-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="ma-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`ma-sidebar ${sidebarOpen ? 'ma-sidebar--open' : ''}`}>
        <div className="ma-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ma-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <MaDashboardIcon />,     nav: 'home-logged' },
            { label: 'Book Appointment',    icon: <MaCalSideIcon />,       nav: 'book-appointment' },
            { label: 'My Appointments',     icon: <MaMyApptSideIcon />,    nav: 'my-appointments' },
            { label: 'Notarial Requests',   icon: <MaNotarialIcon />,      nav: 'my-notarial-requests' },
            { label: 'Announcements',       icon: <MaAnnouncementIcon />,  nav: 'announcements' },
            { label: 'Transaction History', icon: <MaTransactionIcon />,   nav: 'transaction-history' },
            { label: 'Logs',                icon: <MaLogsIcon />,          nav: 'client-logs' },
            { label: 'Profile',             icon: <MaProfileIcon />,       nav: 'profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`ma-sidebar__item ${item.label === 'My Appointments' ? 'ma-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="ma-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="ma-topbar">
        <div className="ma-topbar__left">
          <button className="ma-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="ma-breadcrumb">
            <span className="ma-breadcrumb__current">My Appointments</span>
          </div>
        </div>
        <div className="ma-topbar__right">
          <button className="ma-icon-btn" onClick={() => onNavigate('chat-room')} title="Message Admin">
            <MessageIcon />
          </button>
          <button className="ma-icon-btn ma-bell" onClick={() => onNavigate('announcements')} title="Announcements">
            <BellIcon />
            <span className="ma-bell__dot" />
          </button>
          <div className="ma-profile" onClick={() => onNavigate('profile')} style={{ cursor: 'pointer' }}>
            <div className="ma-profile__info">
                <span className="ma-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
              <div className="ma-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ma-main">
          {loadError ? <p>{loadError}</p> : null}
        <div className="ma-container">
          <section className="ma-summary">
            <div>
              <p className="ma-summary__label">UPCOMING CONSULTATIONS</p>
              <h2 className="ma-summary__count">{totalUpcoming}</h2>
              <p className="ma-summary__meta">Last synced: {lastUpdatedLabel}</p>
            </div>
            <button
              className="ma-summary__refresh"
              type="button"
              onClick={() => loadAppointments()}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </section>

          <section className="ma-reschedule-note" aria-label="Reschedule notice">
            <p className="ma-reschedule-note__title">Need to reschedule?</p>
            <p className="ma-reschedule-note__text">
              Clients may reschedule <strong>once only</strong>, and requests must be submitted at least <strong>1 day before</strong> the scheduled consultation.
              For additional changes, please contact <strong>admin support</strong>.
            </p>
          </section>

          <section className="ma-queue-section">
            <div className="ma-queue-section__header">
              <h2>UPCOMING THIS WEEK</h2>
              <span>{queueAppointments.length}</span>
            </div>
            <div className="ma-appointments-list">
              {queueAppointments.length > 0 ? (
                queueAppointments.map(renderAppointmentCard)
              ) : (
                <div className="ma-empty-state">
                  <p className="ma-empty-state__title">No appointments yet</p>
                  <p className="ma-empty-state__text">New bookings for you will appear here automatically.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Payment Modal */}
      {showRescheduleModal && selectedAppointmentForReschedule && (
        <div className="ma-reschedule-overlay" onClick={closeRescheduleModal}>
          <div className="ma-reschedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-reschedule-header">
              <h2>Reschedule Appointment</h2>
              <button className="ma-close-btn" onClick={closeRescheduleModal}>✕</button>
            </div>
            <div className="ma-reschedule-content">
              <div className="ma-reschedule-notice">
                One-time policy: Reschedule is allowed only once and must be made at least 1 day before the consultation schedule.
              </div>
              <div className="ma-form-group">
                <label>New Date</label>
                <input
                  type="date"
                  className="ma-form-input"
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleTime('');
                    setRescheduleError('');
                  }}
                />
              </div>
              <div className="ma-form-group">
                <label>Available Time</label>
                {rescheduleLoadingSlots ? (
                  <p className="ma-reschedule-info">Loading available slots...</p>
                ) : rescheduleSlots.length ? (
                  <select
                    className="ma-form-input"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                  >
                    <option value="">Select a time slot</option>
                    {rescheduleSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                ) : (
                  <p className="ma-reschedule-info">No slots available for this date yet.</p>
                )}
              </div>
              <div className="ma-form-group">
                <label>Reason (optional)</label>
                <textarea
                  className="ma-form-textarea"
                  rows="3"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Provide a brief and professional reason for your reschedule request."
                />
              </div>
              {rescheduleError ? <div className="ma-error-message">{rescheduleError}</div> : null}
              <div className="ma-reschedule-actions">
                <button className="ma-btn--cancel" onClick={closeRescheduleModal}>Cancel</button>
                <button
                  className="ma-btn--submit"
                  onClick={handleRescheduleSubmit}
                  disabled={rescheduleSubmitting}
                >
                  {rescheduleSubmitting ? 'Submitting...' : 'Confirm Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Policy Notice */}
      {reschedulePolicyNotice && (
        <div className="ma-policy-overlay" onClick={closeReschedulePolicyNotice}>
          <div className="ma-policy-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reschedule-policy-title">
            <div className="ma-policy-header">
              <div className="ma-policy-icon">
                <ScalesIcon size={22} color="#f5a623" />
              </div>
              <div>
                <p className="ma-policy-kicker">Reschedule Notice</p>
                <h2 id="reschedule-policy-title">{reschedulePolicyNotice.title}</h2>
              </div>
            </div>

            <div className="ma-policy-content">
              <p className="ma-policy-message">{reschedulePolicyNotice.reason}</p>

              <div className="ma-policy-details">
                <div>
                  <span>Attorney</span>
                  <strong>Atty. {formatAttorneyName(reschedulePolicyNotice.appointment?.attorney)}</strong>
                </div>
                <div>
                  <span>Schedule</span>
                  <strong>{reschedulePolicyNotice.appointment?.date} • {reschedulePolicyNotice.appointment?.time}</strong>
                </div>
              </div>

              <div className="ma-policy-support-box">
                For further schedule changes, please contact <strong>BatasMo Admin</strong> so your request can be reviewed properly.
              </div>

              <div className="ma-policy-actions">
                <button className="ma-btn--cancel" onClick={closeReschedulePolicyNotice}>Close</button>
                <button
                  className="ma-btn--submit"
                  onClick={() => {
                    closeReschedulePolicyNotice();
                    onNavigate('announcements');
                  }}
                >
                  Contact Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {forfeitAlert && (
        <div className="ma-forfeit-overlay" onClick={closeForfeitAlert}>
          <div className="ma-forfeit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Payment Forfeiture Notice</h2>
            <p className="ma-forfeit-modal__text">
              We regret to inform you that your rescheduled appointment for <strong>{forfeitAlert.title}</strong> with{' '}
              <strong>{forfeitAlert.attorneyName}</strong> on <strong>{forfeitAlert.scheduleLabel}</strong> was missed.
            </p>
            <p className="ma-forfeit-modal__text">
              In accordance with the platform policy, the paid consultation fee has been marked as <strong>forfeited</strong>.
              If you need assistance, please contact admin support for further guidance.
            </p>
            <div className="ma-forfeit-modal__actions">
              <button className="ma-btn--cancel" onClick={closeForfeitAlert}>Close</button>
              <button
                className="ma-btn--submit"
                onClick={() => {
                  closeForfeitAlert();
                  onNavigate('announcements');
                }}
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedAppointmentForPayment && (
        <div className="ma-payment-overlay" onClick={closePaymentModal}>
          <div className="ma-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-payment-header">
              <h2>💳 Payment</h2>
              <button className="ma-close-btn" onClick={closePaymentModal}>✕</button>
            </div>

            <div className="ma-payment-content">
              {/* Appointment Summary */}
              <div className="ma-payment-summary">
                <h4>Payment Summary</h4>
                <div className="ma-payment-summary-row">
                  <span>Attorney:</span>
                  <span>Atty. {formatAttorneyName(selectedAppointmentForPayment.attorney)}</span>
                </div>
                <div className="ma-payment-summary-row">
                  <span>Consultation Date:</span>
                  <span>{selectedAppointmentForPayment.date}</span>
                </div>
                <div className="ma-payment-summary-row">
                  <span>Time:</span>
                  <span>{selectedAppointmentForPayment.time}</span>
                </div>
                <div className="ma-payment-summary-row ma-payment-total">
                  <span>Total Amount:</span>
                  <span>{selectedAppointmentForPayment.fee}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="ma-payment-methods">
                <h4>Select Payment Method</h4>
                <div className="ma-payment-options">
                  <div 
                    className={`ma-payment-option ${selectedPaymentMethod === 'gcash' ? 'ma-payment-option--selected' : ''}`}
                    onClick={() => setSelectedPaymentMethod('gcash')}
                  >
                    <div className="ma-payment-option-logo ma-gcash-logo">
                      <span>G</span>
                    </div>
                    <div className="ma-payment-option-info">
                      <strong>GCash</strong>
                      <small>Pay via GCash e-wallet</small>
                    </div>
                    <div className="ma-payment-option-check">
                      {selectedPaymentMethod === 'gcash' && <span>✓</span>}
                    </div>
                  </div>

                  <div 
                    className={`ma-payment-option ${selectedPaymentMethod === 'maya' ? 'ma-payment-option--selected' : ''}`}
                    onClick={() => setSelectedPaymentMethod('maya')}
                  >
                    <div className="ma-payment-option-logo ma-maya-logo">
                      <span>M</span>
                    </div>
                    <div className="ma-payment-option-info">
                      <strong>Maya</strong>
                      <small>Pay via Maya e-wallet</small>
                    </div>
                    <div className="ma-payment-option-check">
                      {selectedPaymentMethod === 'maya' && <span>✓</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {selectedPaymentMethod && (
                <div className="ma-payment-details-form">
                  <h4>Enter {selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'} Details</h4>
                  
                  <div className="ma-payment-link-info">
                    <span className="ma-link-icon">🔗</span>
                    <span>Connecting to {selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'} payment gateway...</span>
                  </div>

                  <div className="ma-form-group">
                    <label>Mobile Number</label>
                    <div className="ma-phone-input-wrapper">
                      <span className="ma-phone-prefix">+63</span>
                      <input
                        type="tel"
                        className="ma-form-input ma-phone-input"
                        placeholder="9XX XXX XXXX"
                        maxLength="11"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      />
                    </div>
                  </div>

                  <div className="ma-form-group">
                    <label>{selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'} Authentication Code</label>
                    <input
                      type="password"
                      className="ma-form-input"
                      placeholder="Enter your authentication code"
                      value={paymentCode}
                      onChange={(e) => setPaymentCode(e.target.value)}
                    />
                    <small>Enter the code sent to your registered {selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'} number</small>
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="ma-error-message">{paymentError}</div>
              )}

              <div className="ma-payment-actions">
                <button className="ma-btn ma-btn--cancel" onClick={closePaymentModal}>Cancel</button>
                <button 
                  className="ma-btn ma-btn--pay" 
                  onClick={handlePaymentSubmit}
                  disabled={paymentProcessing}
                >
                  {paymentProcessing ? (
                    <span className="ma-processing">
                      <span className="ma-spinner"></span> Processing Payment...
                    </span>
                  ) : (
                    `Pay ${selectedAppointmentForPayment.fee}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentConfirmation && selectedAppointmentForPayment && (
        <div className="ma-payment-confirm-overlay" onClick={closePaymentConfirmation}>
          <div className="ma-payment-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-payment-confirm-content">
              <div className="ma-confirm-icon-wrapper">
                <div className="ma-confirm-icon ma-confirm-icon--success">✓</div>
              </div>

              <h2 className="ma-confirm-title">Payment Successful!</h2>

              <div className="ma-confirm-message">
                <p>Your payment of <strong>{selectedAppointmentForPayment.fee}</strong> has been received via <strong>{selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'}</strong>.</p>
              </div>

              <div className="ma-payment-receipt">
                <h4>Payment Receipt</h4>
                <div className="ma-receipt-row">
                  <span>Reference No:</span>
                  <span>BM-{Date.now().toString().slice(-8)}</span>
                </div>
                <div className="ma-receipt-row">
                  <span>Attorney:</span>
                  <span>Atty. {formatAttorneyName(selectedAppointmentForPayment.attorney)}</span>
                </div>
                <div className="ma-receipt-row">
                  <span>Consultation:</span>
                  <span>{selectedAppointmentForPayment.date} at {selectedAppointmentForPayment.time}</span>
                </div>
                <div className="ma-receipt-row">
                  <span>Payment Method:</span>
                  <span>{selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'}</span>
                </div>
                <div className="ma-receipt-row">
                  <span>Account:</span>
                  <span>+63{phoneNumber.slice(0, 3)}****{phoneNumber.slice(-3)}</span>
                </div>
                <div className="ma-receipt-row ma-receipt-total">
                  <span>Amount Paid:</span>
                  <span>{selectedAppointmentForPayment.fee}</span>
                </div>
              </div>

              <div className="ma-confirm-what-next ma-confirm-what-next--green">
                <h4>Your Appointment is Confirmed!</h4>
                <ul>
                  <li>Your consultation with Atty. {formatAttorneyName(selectedAppointmentForPayment.attorney)} is now fully confirmed</li>
                  <li>You will receive a reminder notification before your appointment</li>
                  <li>A payment receipt has been sent to your registered email</li>
                </ul>
              </div>

              <button className="ma-confirm-btn ma-confirm-btn--green" onClick={closePaymentConfirmation}>Back to Appointments</button>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {showTranscriptModal && selectedAppointmentForTranscript && (
        <div className="ma-transcript-overlay" onClick={closeTranscriptModal}>
          <div className="ma-transcript-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-transcript-header">
              <h2>📋 Consultation Transcript</h2>
              <button className="ma-close-btn" onClick={closeTranscriptModal}>✕</button>
            </div>

            <div className="ma-transcript-content">
              {/* Consultation Info */}
              <div className="ma-transcript-info">
                <div className="ma-transcript-info-row">
                  <span className="ma-transcript-label">Attorney:</span>
                  <span className="ma-transcript-value">Atty. {formatAttorneyName(selectedAppointmentForTranscript.attorney)}</span>
                </div>
                <div className="ma-transcript-info-row">
                  <span className="ma-transcript-label">Specialty:</span>
                  <span className="ma-transcript-value">{selectedAppointmentForTranscript.specialty}</span>
                </div>
                <div className="ma-transcript-info-row">
                  <span className="ma-transcript-label">Date & Time:</span>
                  <span className="ma-transcript-value">{selectedAppointmentForTranscript.date} at {selectedAppointmentForTranscript.time}</span>
                </div>
                <div className="ma-transcript-info-row">
                  <span className="ma-transcript-label">Consultation Type:</span>
                  <span className="ma-transcript-value">{selectedAppointmentForTranscript.type}</span>
                </div>
              </div>

              {/* Consultation Summary */}
              <div className="ma-transcript-summary">
                <h3>Consultation Summary</h3>
                <div className="ma-transcript-summary-box">
                  <p>
                    You had a consultation session with {formatAttorneyName(selectedAppointmentForTranscript.attorney)} regarding {selectedAppointmentForTranscript.specialty.toLowerCase()}.
                    The session covered important legal matters and provided comprehensive guidance on the next steps to address your concerns.
                  </p>
                  <p>
                    Key topics discussed during this session were thoroughly documented, and the attorney has provided professional recommendations for your case.
                  </p>
                </div>
              </div>

              {/* Key Points */}
              <div className="ma-transcript-section">
                <h3>Key Points Discussed</h3>
                <ul className="ma-transcript-list">
                  <li>Initial understanding of your legal concern and background</li>
                  <li>Review of relevant laws and regulations applicable to your case</li>
                  <li>Discussion of potential solutions and courses of action</li>
                  <li>Risks and benefits of different legal strategies</li>
                  <li>Timeline and expected outcomes</li>
                  <li>Next steps and recommended actions</li>
                </ul>
              </div>

              {/* Attorney Recommendations */}
              <div className="ma-transcript-section">
                <h3>Attorney Recommendations</h3>
                <div className="ma-transcript-recommendations">
                  <div className="ma-recommendation-item">
                    <span className="ma-rec-number">1</span>
                    <div className="ma-rec-content">
                      <strong>Gather Documentation</strong>
                      <p>Collect all relevant documents related to your case and prepare them for the next consultation or legal proceedings.</p>
                    </div>
                  </div>
                  <div className="ma-recommendation-item">
                    <span className="ma-rec-number">2</span>
                    <div className="ma-rec-content">
                      <strong>Follow-up Actions</strong>
                      <p>Complete any action items discussed during the session to move your case forward effectively.</p>
                    </div>
                  </div>
                  <div className="ma-recommendation-item">
                    <span className="ma-rec-number">3</span>
                    <div className="ma-rec-content">
                      <strong>Schedule Next Appointment</strong>
                      <p>Book your next consultation to discuss the progress and provide further legal assistance as needed.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="ma-transcript-actions">
                <button className="ma-btn ma-btn--secondary" onClick={closeTranscriptModal}>Close</button>
                <button className="ma-btn ma-btn--primary" onClick={() => { closeTranscriptModal(); onNavigate('book-appointment'); }}>Book Another Appointment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat FAB */}
      <button className="ma-chat-fab" title="AI Assistant">
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

export default MyAppointments;
