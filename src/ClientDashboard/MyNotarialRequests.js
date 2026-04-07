import { useEffect, useState } from 'react';
import './MyNotarialRequests.css';
import { cancelNotarialRequest, fetchClientNotarialRequests, payForNotarialRequest } from '../lib/userApi';
import { isValidPhoneNumber, VALID_PHONE_MESSAGE } from '../lib/validators';

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const DocumentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
  </svg>
);

const filters = ['All', 'Pending', 'Approved', 'Completed', 'Rejected'];

function MyNotarialRequests({ onNavigate, profile }) {
  const [requests, setRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentCode, setPaymentCode] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Cancel confirmation
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      if (!profile?.id) return;

      try {
        const rows = await fetchClientNotarialRequests(profile.id);
        if (!isMounted) return;
        setRequests(rows);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Unable to load notarial requests.');
        }
      }
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const filteredRequests = activeFilter === 'All'
    ? requests
    : requests.filter(r => r.status === activeFilter.toUpperCase());

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return { bg: '#fef3c7', color: '#92400e' };
      case 'APPROVED': return { bg: '#d1fae5', color: '#065f46' };
      case 'COMPLETED': return { bg: '#1c1f2e', color: '#fff' };
      case 'REJECTED': return { bg: '#fee2e2', color: '#991b1b' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const getServiceIcon = (service) => {
    switch (service) {
      case 'Document Notarization':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" />
          </svg>
        );
      case 'Affidavit Preparation':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        );
      case 'Power of Attorney':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      case 'Acknowledgment Certification':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
          </svg>
        );
      case 'Jurat Service':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><circle cx="12" cy="15" r="2" />
          </svg>
        );
      default:
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        );
    }
  };

  const getProgressSteps = (status) => {
    const steps = [
      { label: 'Submitted', done: true },
      { label: 'Under Review', done: status !== 'PENDING' || status === 'REJECTED' },
      { label: 'Approved', done: status === 'APPROVED' || status === 'COMPLETED' },
      { label: 'Notarized', done: status === 'COMPLETED' },
    ];
    if (status === 'REJECTED') {
      return [
        { label: 'Submitted', done: true },
        { label: 'Under Review', done: true },
        { label: 'Declined', done: true, rejected: true },
      ];
    }
    return steps;
  };

  // Payment handlers
  const openPaymentModal = (req) => {
    setSelectedRequest(req);
    setShowPaymentModal(true);
    setSelectedPaymentMethod('');
    setPhoneNumber('');
    setPaymentCode('');
    setPaymentError('');
    setPaymentProcessing(false);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedRequest(null);
    setSelectedPaymentMethod('');
    setPhoneNumber('');
    setPaymentCode('');
    setPaymentError('');
    setPaymentProcessing(false);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentMethod) { setPaymentError('Please select a payment method'); return; }
    if (!isValidPhoneNumber(phoneNumber)) { setPaymentError(VALID_PHONE_MESSAGE); return; }
    if (!paymentCode || paymentCode.length < 4) { setPaymentError('Please enter a valid payment code (at least 4 digits)'); return; }

    setPaymentError('');
    setPaymentProcessing(true);

    try {
      await payForNotarialRequest({
        requestId: selectedRequest.id,
        clientId: profile?.id,
        attorneyId: selectedRequest.attorneyId,
        amount: selectedRequest.amount,
        method: selectedPaymentMethod,
      });
      setPaymentProcessing(false);
      setShowPaymentModal(false);
      setShowPaymentConfirmation(true);
      setRequests(prev => prev.map(r =>
        r.id === selectedRequest.id
          ? { ...r, payment: 'PAID', message: 'Payment Completed — Awaiting Notarization', detail: 'Payment confirmed. Your document is now queued for notarization by the assigned attorney.' }
          : r
      ));
      setLoadError('');
    } catch (error) {
      setPaymentProcessing(false);
      setPaymentError(error.message || 'Payment failed. Please try again.');
    }
  };

  const closePaymentConfirmation = () => {
    setShowPaymentConfirmation(false);
    setSelectedRequest(null);
  };

  // Cancel handlers
  const openCancelModal = (req) => { setCancelTarget(req); setShowCancelModal(true); };
  const closeCancelModal = () => { setShowCancelModal(false); setCancelTarget(null); };
  const confirmCancel = async () => {
    try {
      await cancelNotarialRequest(cancelTarget.id);
      setRequests(prev => prev.filter(r => r.id !== cancelTarget.id));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to cancel request.');
    }
    setShowCancelModal(false);
    setCancelTarget(null);
  };

  return (
    <div className="mnr-page">
      {/* Topbar */}
      <header className="mnr-topbar">
        <div className="mnr-topbar__left">
          <div className="mnr-breadcrumb">
            <span onClick={() => onNavigate('home-logged')}>Dashboard</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="mnr-breadcrumb__current">Notarial Requests</span>
          </div>
        </div>
        <div className="mnr-topbar__right">
          <button className="mnr-icon-btn mnr-bell">
            <BellIcon />
            <span className="mnr-bell__dot" />
          </button>
          <div className="mnr-profile">
            <div className="mnr-profile__info">
              <span className="mnr-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="mnr-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mnr-main">
        <div className="mnr-container">
          {loadError ? <p>{loadError}</p> : null}
          {/* Header */}
          <div className="mnr-header">
            <div className="mnr-header__text">
              <h1>My Notarial Requests</h1>
              <p>Track and manage all your notarial service requests</p>
            </div>
            <button className="mnr-new-request-btn" onClick={() => onNavigate('notarial-request')}>
              <DocumentIcon />
              New Request
            </button>
          </div>

          {/* Filter tabs */}
          <div className="mnr-filters">
            {filters.map(f => (
              <button
                key={f}
                className={`mnr-filter-btn ${activeFilter === f ? 'mnr-filter-btn--active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
                {f !== 'All' && (
                  <span className="mnr-filter-count">
                    {requests.filter(r => r.status === f.toUpperCase()).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Request Cards */}
          <div className="mnr-list">
            {filteredRequests.length === 0 ? (
              <div className="mnr-empty">
                <DocumentIcon />
                <p>No {activeFilter.toLowerCase()} requests found</p>
              </div>
            ) : (
              filteredRequests.map(req => {
                const statusStyle = getStatusColor(req.status);
                const isExpanded = expandedId === req.id;
                const steps = getProgressSteps(req.status);
                return (
                  <div key={req.id} className={`mnr-card ${isExpanded ? 'mnr-card--expanded' : ''}`}>
                    <div className="mnr-card__main" onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                      <div className="mnr-card__icon">
                        {getServiceIcon(req.service)}
                      </div>
                      <div className="mnr-card__info">
                        <div className="mnr-card__top-row">
                          <span className="mnr-card__service">{req.service}</span>
                          <span className="mnr-card__status" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                            {req.status}
                          </span>
                          {req.payment && (
                            <span className={`mnr-card__payment-badge ${req.payment === 'PAID' ? 'mnr-card__payment-badge--paid' : 'mnr-card__payment-badge--unpaid'}`}>
                              {req.payment === 'PAID' ? '✓ Paid' : 'Unpaid'}
                            </span>
                          )}
                        </div>
                        <span className="mnr-card__message">{req.message}</span>
                        <div className="mnr-card__meta">
                          <span className="mnr-card__meta-item">
                            <CalendarIcon /> {req.date}
                          </span>
                          <span className="mnr-card__meta-item">
                            <FileIcon /> {req.file}
                          </span>
                          {req.fee && (
                            <span className="mnr-card__meta-item mnr-card__meta-item--fee">
                              {req.fee}
                            </span>
                          )}
                          {req.assignedTo && (
                            <span className="mnr-card__meta-item mnr-card__meta-item--atty">
                              {req.assignedTo}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mnr-card__chevron">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mnr-card__details">
                        <div className="mnr-card__detail-section">
                          <h4>Request Details</h4>
                          <p className="mnr-card__detail-text">{req.detail}</p>
                          {req.notes && (
                            <div className="mnr-card__notes">
                              <NoteIcon />
                              <span>{req.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Tracker */}
                        <div className="mnr-card__progress-section">
                          <h4>Progress</h4>
                          <div className="mnr-progress">
                            {steps.map((step, i) => (
                              <div key={i} className={`mnr-progress__step ${step.done ? 'mnr-progress__step--done' : ''} ${step.rejected ? 'mnr-progress__step--rejected' : ''}`}>
                                <div className="mnr-progress__circle">
                                  {step.done && !step.rejected ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : step.rejected ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  ) : (
                                    <span>{i + 1}</span>
                                  )}
                                </div>
                                {i < steps.length - 1 && <div className={`mnr-progress__line ${steps[i + 1]?.done ? 'mnr-progress__line--done' : ''} ${steps[i + 1]?.rejected ? 'mnr-progress__line--rejected' : ''}`} />}
                                <span className="mnr-progress__label">{step.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mnr-card__actions">
                          {req.status === 'APPROVED' && req.payment === 'UNPAID' && (
                            <button className="mnr-btn mnr-btn--primary" onClick={() => openPaymentModal(req)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                              Proceed to Payment
                            </button>
                          )}
                          {req.status === 'APPROVED' && req.payment === 'PAID' && (
                            <span className="mnr-paid-label">✓ Payment Completed</span>
                          )}
                          {req.status === 'PENDING' && (
                            <button className="mnr-btn mnr-btn--danger" onClick={(e) => { e.stopPropagation(); openCancelModal(req); }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                              Cancel Request
                            </button>
                          )}
                          {req.status === 'REJECTED' && (
                            <button className="mnr-btn mnr-btn--secondary" onClick={() => onNavigate('notarial-request')}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                              Resubmit Request
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && selectedRequest && (
        <div className="mnr-payment-overlay" onClick={closePaymentModal}>
          <div className="mnr-payment-modal" onClick={e => e.stopPropagation()}>
            <div className="mnr-payment-modal__header">
              <h2>Payment for Notarial Service</h2>
              <button className="mnr-payment-modal__close" onClick={closePaymentModal}>&times;</button>
            </div>

            <div className="mnr-payment-modal__summary">
              <div className="mnr-payment-modal__summary-row">
                <span>Service</span>
                <span>{selectedRequest.service}</span>
              </div>
              <div className="mnr-payment-modal__summary-row">
                <span>Date Submitted</span>
                <span>{selectedRequest.date}</span>
              </div>
              <div className="mnr-payment-modal__summary-row mnr-payment-modal__summary-row--total">
                <span>Total Amount</span>
                <span>{selectedRequest.fee}</span>
              </div>
            </div>

            <div className="mnr-payment-modal__methods">
              <h3>Select Payment Method</h3>
              <div className="mnr-payment-modal__options">
                <div
                  className={`mnr-payment-option ${selectedPaymentMethod === 'gcash' ? 'mnr-payment-option--selected' : ''}`}
                  onClick={() => setSelectedPaymentMethod('gcash')}
                >
                  <div className="mnr-payment-option__icon mnr-payment-option__icon--gcash">G</div>
                  <div className="mnr-payment-option__info">
                    <span className="mnr-payment-option__name">GCash</span>
                    <span className="mnr-payment-option__desc">Pay with GCash e-wallet</span>
                  </div>
                  <div className={`mnr-payment-option__radio ${selectedPaymentMethod === 'gcash' ? 'mnr-payment-option__radio--active' : ''}`} />
                </div>
                <div
                  className={`mnr-payment-option ${selectedPaymentMethod === 'maya' ? 'mnr-payment-option--selected' : ''}`}
                  onClick={() => setSelectedPaymentMethod('maya')}
                >
                  <div className="mnr-payment-option__icon mnr-payment-option__icon--maya">M</div>
                  <div className="mnr-payment-option__info">
                    <span className="mnr-payment-option__name">Maya</span>
                    <span className="mnr-payment-option__desc">Pay with Maya e-wallet</span>
                  </div>
                  <div className={`mnr-payment-option__radio ${selectedPaymentMethod === 'maya' ? 'mnr-payment-option__radio--active' : ''}`} />
                </div>
              </div>
            </div>

            {selectedPaymentMethod && (
              <div className="mnr-payment-modal__fields">
                <label className="mnr-payment-field">
                  <span>Phone Number</span>
                  <div className="mnr-payment-field__input-wrap">
                    <span className="mnr-payment-field__prefix">+63</span>
                    <input
                      type="tel"
                      placeholder="9XX XXX XXXX"
                      maxLength="11"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    />
                  </div>
                </label>
                <label className="mnr-payment-field">
                  <span>Authentication Code</span>
                  <input
                    type="text"
                    placeholder="Enter code from your e-wallet"
                    value={paymentCode}
                    onChange={e => setPaymentCode(e.target.value)}
                  />
                </label>
              </div>
            )}

            {paymentError && <div className="mnr-payment-modal__error">{paymentError}</div>}

            <div className="mnr-payment-modal__actions">
              <button className="mnr-btn mnr-btn--secondary" onClick={closePaymentModal} disabled={paymentProcessing}>Cancel</button>
              <button className="mnr-btn mnr-btn--primary" onClick={handlePaymentSubmit} disabled={paymentProcessing}>
                {paymentProcessing ? (
                  <span className="mnr-spinner" />
                ) : (
                  <>Pay {selectedRequest.fee}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentConfirmation && selectedRequest && (
        <div className="mnr-payment-overlay" onClick={closePaymentConfirmation}>
          <div className="mnr-payment-modal mnr-payment-modal--confirm" onClick={e => e.stopPropagation()}>
            <div className="mnr-confirm-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2>Payment Successful!</h2>
            <p className="mnr-confirm-subtitle">Your payment has been processed successfully</p>
            <div className="mnr-confirm-receipt">
              <div className="mnr-confirm-receipt__row">
                <span>Reference No.</span>
                <span>NTR-{Date.now().toString().slice(-8)}</span>
              </div>
              <div className="mnr-confirm-receipt__row">
                <span>Service</span>
                <span>{selectedRequest.service}</span>
              </div>
              <div className="mnr-confirm-receipt__row">
                <span>Amount Paid</span>
                <span>{selectedRequest.fee}</span>
              </div>
              <div className="mnr-confirm-receipt__row">
                <span>Payment Method</span>
                <span>{selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya'}</span>
              </div>
              <div className="mnr-confirm-receipt__row">
                <span>Date</span>
                <span>{new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
            <button className="mnr-btn mnr-btn--primary mnr-btn--full" onClick={closePaymentConfirmation}>Done</button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && cancelTarget && (
        <div className="mnr-payment-overlay" onClick={closeCancelModal}>
          <div className="mnr-payment-modal mnr-payment-modal--cancel" onClick={e => e.stopPropagation()}>
            <div className="mnr-confirm-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2>Cancel Request?</h2>
            <p className="mnr-confirm-subtitle">Are you sure you want to cancel your <strong>{cancelTarget.service}</strong> request? This action cannot be undone.</p>
            <div className="mnr-payment-modal__actions">
              <button className="mnr-btn mnr-btn--secondary" onClick={closeCancelModal}>Keep Request</button>
              <button className="mnr-btn mnr-btn--danger" onClick={confirmCancel}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyNotarialRequests;
