import { useEffect, useMemo, useState } from 'react';
import './MyAppointments.css';
import { fetchClientAppointmentsData, payForAppointment } from '../lib/userApi';
import { isValidPhoneNumber, VALID_PHONE_MESSAGE } from '../lib/validators';

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

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const LocationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

const FeesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h6a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-6" />
  </svg>
);

function MyAppointments({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentCode, setPaymentCode] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedAppointmentForTranscript, setSelectedAppointmentForTranscript] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAppointments = async () => {
      if (!profile?.id) return;

      try {
        const rows = await fetchClientAppointmentsData(profile.id);
        if (!isMounted) return;
        setAppointments(rows);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Unable to load appointments.');
        }
      }
    };

    loadAppointments();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const statusCounts = useMemo(() => ({
    Pending: appointments.filter(a => a.status === 'PENDING').length,
    Approved: appointments.filter(a => a.status === 'APPROVED').length,
    Completed: appointments.filter(a => a.status === 'COMPLETED').length,
    Rejected: appointments.filter(a => a.status === 'REJECTED').length,
  }), [appointments]);

  const filteredAppointments = useMemo(() => (
    filterStatus === 'All'
      ? appointments
      : appointments.filter(a => a.status === filterStatus.toUpperCase())
  ), [appointments, filterStatus]);

  const getStatusBadgeColor = (status) => {
    switch(status) {
      case 'PENDING': return '#fef08a';
      case 'APPROVED': return '#d1fae5';
      case 'COMPLETED': return '#d1d5db';
      case 'REJECTED': return '#fee2e2';
      default: return '#e5e7eb';
    }
  };

  const getStatusTextColor = (status) => {
    switch(status) {
      case 'PENDING': return '#b45309';
      case 'APPROVED': return '#065f46';
      case 'COMPLETED': return '#374151';
      case 'REJECTED': return '#991b1b';
      default: return '#4b5563';
    }
  };

  const getPaymentBadgeColor = (payment) => {
    return payment === 'PAID' ? '#dcfce7' : '#fef3c7';
  };

  const getPaymentTextColor = (payment) => {
    return payment === 'PAID' ? '#166534' : '#b45309';
  };


  const openPaymentModal = (appointment) => {
    setSelectedAppointmentForPayment(appointment);
    setShowPaymentModal(true);
    setSelectedPaymentMethod('');
    setPhoneNumber('');
    setPaymentCode('');
    setPaymentError('');
    setPaymentProcessing(false);
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
    if (!isValidPhoneNumber(phoneNumber)) {
      setPaymentError(VALID_PHONE_MESSAGE);
      return;
    }
    if (!paymentCode || paymentCode.length < 4) {
      setPaymentError('Please enter a valid payment code (at least 4 digits)');
      return;
    }

    setPaymentError('');
    setPaymentProcessing(true);

    try {
      await payForAppointment({
        appointmentId: selectedAppointmentForPayment.id,
        clientId: profile?.id,
        attorneyId: selectedAppointmentForPayment.attorneyId,
        amount: selectedAppointmentForPayment.amount,
        method: selectedPaymentMethod,
      });

      setPaymentProcessing(false);
      setShowPaymentModal(false);
      setShowPaymentConfirmation(true);
      setAppointments(prev => prev.map(a => 
        a.id === selectedAppointmentForPayment.id 
          ? { ...a, payment: 'PAID', status: 'APPROVED', message: 'Payment Completed', description: 'Your appointment has been confirmed. Please arrive 10 minutes early.' } 
          : a
      ));
      setLoadError('');
    } catch (error) {
      setPaymentProcessing(false);
      setPaymentError(error.message || 'Payment failed. Please try again.');
    }
  };

  const closePaymentConfirmation = () => {
    setShowPaymentConfirmation(false);
    setSelectedAppointmentForPayment(null);
    setSelectedPaymentMethod('');
    setPhoneNumber('');
    setPaymentCode('');
  };

  const openTranscriptModal = (appointment) => {
    setSelectedAppointmentForTranscript(appointment);
    setShowTranscriptModal(true);
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
        <div className="ma-header">
          <h1>My Appointments</h1>
          <p>Manage and track all your appointments</p>
        </div>

        <div className="ma-container">
          {/* Status Filters */}
          <div className="ma-filters">
            <button 
              className={`ma-filter-btn ${filterStatus === 'All' ? 'ma-filter-btn--active' : ''}`}
              onClick={() => setFilterStatus('All')}
            >
              All ({appointments.length})
            </button>
            <button 
              className={`ma-filter-btn ${filterStatus === 'Pending' ? 'ma-filter-btn--active' : ''}`}
              onClick={() => setFilterStatus('Pending')}
            >
              Pending: {statusCounts.Pending}
            </button>
            <button 
              className={`ma-filter-btn ${filterStatus === 'Approved' ? 'ma-filter-btn--active' : ''}`}
              onClick={() => setFilterStatus('Approved')}
            >
              Approved: {statusCounts.Approved}
            </button>
            <button 
              className={`ma-filter-btn ${filterStatus === 'Completed' ? 'ma-filter-btn--active' : ''}`}
              onClick={() => setFilterStatus('Completed')}
            >
              Completed: {statusCounts.Completed}
            </button>
            <button 
              className={`ma-filter-btn ${filterStatus === 'Rejected' ? 'ma-filter-btn--active' : ''}`}
              onClick={() => setFilterStatus('Rejected')}
            >
              Rejected: {statusCounts.Rejected}
            </button>
          </div>

          {/* Appointments List */}
          <div className="ma-appointments-list">
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map(appointment => (
                <div key={appointment.id} className="ma-appointment-card">
                  <div className="ma-card-header">
                    <div className="ma-attorney-info">
                      <h3 className="ma-attorney-name">
                        Atty. {appointment.attorney}
                      </h3>
                      <p className="ma-specialty">{appointment.specialty}</p>
                    </div>
                    <div className="ma-badges">
                      <span 
                        className="ma-badge ma-badge--status"
                        style={{
                          backgroundColor: getStatusBadgeColor(appointment.status),
                          color: getStatusTextColor(appointment.status)
                        }}
                      >
                        {appointment.status}
                      </span>
                      <span 
                        className="ma-badge ma-badge--payment"
                        style={{
                          backgroundColor: getPaymentBadgeColor(appointment.payment),
                          color: getPaymentTextColor(appointment.payment)
                        }}
                      >
                        {appointment.payment}
                      </span>
                    </div>
                  </div>

                  <div className="ma-appointment-details">
                    <div className="ma-detail">
                      <CalendarIcon />
                      <span>{appointment.date}</span>
                    </div>
                    <div className="ma-detail">
                      <ClockIcon />
                      <span>{appointment.time}</span>
                    </div>
                    <div className="ma-detail">
                      <LocationIcon />
                      <span>{appointment.type}</span>
                    </div>
                    <div className="ma-detail">
                      <FeesIcon />
                      <span className="ma-fee">{appointment.fee}</span>
                    </div>
                  </div>

                  <div className="ma-status-message">
                    <div className="ma-message-icon">⚠</div>
                    <div className="ma-message-content">
                      <strong>{appointment.message}</strong>
                      <p>{appointment.description}</p>
                    </div>
                  </div>

                  <div className="ma-card-actions">
                    <button 
                      className="ma-btn ma-btn--primary" 
                      disabled={appointment.status === 'PENDING' || appointment.payment === 'PAID'}
                      onClick={() => openPaymentModal(appointment)}
                      title={appointment.status === 'PENDING' ? 'Payment available after attorney approval' : appointment.payment === 'PAID' ? 'Payment already completed' : 'Proceed with payment'}
                    >
                      Proceed to Payment
                    </button>
                    {appointment.status === 'COMPLETED' && (
                      <button 
                        className="ma-btn ma-btn--tertiary"
                        onClick={() => openTranscriptModal(appointment)}
                        title="View consultation transcript and summary"
                      >
                        View Transcript
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="ma-empty-state">
                <p>No appointments found for this status.</p>
              </div>
            )}
          </div>
        </div>
      </main>

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
                  <span>Atty. {selectedAppointmentForPayment.attorney}</span>
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
                  <span>Atty. {selectedAppointmentForPayment.attorney}</span>
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
                  <li>Your consultation with Atty. {selectedAppointmentForPayment.attorney} is now fully confirmed</li>
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
                  <span className="ma-transcript-value">Atty. {selectedAppointmentForTranscript.attorney}</span>
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
                    You had a consultation session with {selectedAppointmentForTranscript.attorney} regarding {selectedAppointmentForTranscript.specialty.toLowerCase()}.
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
