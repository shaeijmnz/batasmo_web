import { useEffect, useRef, useState } from 'react';
import './NotarialRequest.css';
import {
  createNotarialRequest,
  getNotarialPaymentStatus,
  payForNotarialRequestViaPaymongo,
  replaceClientNotarialRequestDocument,
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
const NrDashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const NrCalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const NrMyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
  </svg>
);
const NrNotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const NrAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const NrTransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const NrProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const notarialServices = [
  { id: 1, name: 'Affidavit of Loss', description: 'Prepare and notarize an affidavit for lost documents or IDs.', amount: 1 },
];

const MAX_NOTARIAL_FILE_BYTES = 10 * 1024 * 1024;

const formatPeso = (amount) =>
  `PHP ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function NotarialRequest({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [paymentPhase, setPaymentPhase] = useState(null);
  const [isPaying, setIsPaying] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorTitle, setErrorTitle] = useState('Missing Information');
  const [errorMessage, setErrorMessage] = useState('');
  const pendingTimeoutRef = useRef(null);
  const cancelRequestedRef = useRef(false);
  const checkoutWindowRef = useRef(null);
  const draftRequestRef = useRef(null);

  const selectedServiceRow = notarialServices.find((item) => item.id === selectedService) || null;
  const payableAmount = Number(selectedServiceRow?.amount || 0);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      console.log('[lifecycle] NotarialRequest unmounted');
    };
  }, []);

  const handleServiceToggle = (serviceId) => {
    if (isPaying) return;
    setSelectedService(selectedService === serviceId ? null : serviceId);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_NOTARIAL_FILE_BYTES) {
      setUploadedFile(null);
      setErrorTitle('Missing Information');
      setErrorMessage('File is too large. Please keep it under 10 MB.');
      setShowError(true);
      e.target.value = '';
      return;
    }
    setUploadedFile(file);
  };

  const ensureDraftRequest = async () => {
    const existing = draftRequestRef.current;
    if (existing?.requestId && existing.fileName === uploadedFile.name && existing.serviceType === selectedServiceRow.name) {
      return existing.requestId;
    }

    if (existing?.requestId && existing.serviceType === selectedServiceRow.name) {
      await replaceClientNotarialRequestDocument({
        requestId: existing.requestId,
        file: uploadedFile,
        documentName: uploadedFile.name,
      });
      draftRequestRef.current = {
        requestId: existing.requestId,
        fileName: uploadedFile.name,
        serviceType: selectedServiceRow.name,
      };
      return existing.requestId;
    }

    const created = await createNotarialRequest({
      clientId: profile?.id,
      serviceType: selectedServiceRow?.name || 'Notarial Service',
      notes,
      file: uploadedFile,
      documentName: uploadedFile.name,
      amount: payableAmount,
    });
    const requestId = created?.requestId || null;
    if (!requestId) {
      throw new Error('Request was saved but payment could not start. Please try again.');
    }
    draftRequestRef.current = {
      requestId,
      fileName: uploadedFile.name,
      serviceType: selectedServiceRow.name,
    };
    return requestId;
  };

  const handleSubmit = async () => {
    if (!profile?.id || !selectedServiceRow || !uploadedFile) {
      setErrorTitle('Missing Information');
      setErrorMessage('Please select one service and upload a file');
      setShowError(true);
      return;
    }
    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      setErrorTitle('Missing Information');
      setErrorMessage('This service has no payable amount.');
      setShowError(true);
      return;
    }

    let checkoutWindow = null;
    let checkoutReady = false;
    cancelRequestedRef.current = false;
    checkoutWindowRef.current = null;

    try {
      checkoutWindow = window.open('', '_blank');
      checkoutWindowRef.current = checkoutWindow;
      if (checkoutWindow) {
        try {
          checkoutWindow.document.title = 'LegalLink Payment';
          checkoutWindow.document.body.innerHTML =
            '<p style="font-family: sans-serif; padding: 16px;">Preparing PayMongo checkout…</p>';
        } catch {
          // Ignore restricted document access.
        }
      }
    } catch {
      checkoutWindow = null;
    }

    try {
      setIsPaying(true);
      setShowError(false);
      setPendingCheckoutUrl('');
      setPaymentReference('');
      setPaymentPhase('paying');

      const requestId = await ensureDraftRequest();
      const session = await payForNotarialRequestViaPaymongo({
        requestId,
        clientId: profile.id,
        amount: payableAmount,
        method: 'qrph',
      });

      const checkoutUrl = String(session?.checkoutUrl || '').trim();
      if (!checkoutUrl) {
        throw new Error('Checkout URL is missing. Please try again.');
      }

      setPendingCheckoutUrl(checkoutUrl);
      checkoutReady = true;

      let checkoutOpened = false;
      if (checkoutWindow && !checkoutWindow.closed) {
        try {
          checkoutWindow.location.replace(checkoutUrl);
          checkoutOpened = true;
        } catch {
          checkoutOpened = false;
        }
      }
      if (!checkoutOpened) {
        const fallbackWindow = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        checkoutOpened = Boolean(fallbackWindow && !fallbackWindow.closed);
      }

      const startedAt = Date.now();
      const timeoutMs = 5 * 60 * 1000;
      let paid = false;
      let pollDelayMs = 2500;
      const waitForNextPoll = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

      while (Date.now() - startedAt < timeoutMs) {
        if (cancelRequestedRef.current) {
          throw new Error('Payment window closed. Your file is saved — open PayMongo again to finish payment.');
        }

        await waitForNextPoll(pollDelayMs);

        if (cancelRequestedRef.current) {
          throw new Error('Payment window closed. Your file is saved — open PayMongo again to finish payment.');
        }

        const statusResult = await getNotarialPaymentStatus(session.transactionId);
        const status = String(statusResult?.status || 'pending').toLowerCase();
        if (status === 'paid') {
          paid = true;
          break;
        }
        if (status === 'failed') {
          throw new Error('Payment failed. Please try again.');
        }
        pollDelayMs = Math.min(6000, pollDelayMs + 500);
      }

      if (!paid) {
        throw new Error('Payment is still pending. Keep the PayMongo tab open and finish checkout, then press Proceed to Payment again.');
      }

      setPaymentReference(session?.transactionId || '');
      setPendingCheckoutUrl('');
      setPaymentPhase('paid');
    } catch (error) {
      if (!checkoutReady && checkoutWindow && !checkoutWindow.closed) {
        try {
          checkoutWindow.close();
        } catch {
          // ignore
        }
      }
      setPaymentPhase(null);
      setErrorTitle('Payment not completed');
      setErrorMessage(error?.message || 'Unable to open PayMongo. Please try again.');
      setShowError(true);
    } finally {
      cancelRequestedRef.current = false;
      setIsPaying(false);
    }
  };

  const handleCancelPayment = () => {
    cancelRequestedRef.current = true;
    const checkoutWindow = checkoutWindowRef.current;
    if (checkoutWindow && !checkoutWindow.closed) {
      try {
        checkoutWindow.close();
      } catch {
        // ignore
      }
    }
  };

  const closeError = () => {
    setShowError(false);
  };

  const closeConfirmation = () => {
    if (paymentPhase !== 'paid') return;
    setPaymentPhase(null);
    pendingTimeoutRef.current = setTimeout(() => {
      draftRequestRef.current = null;
      setSelectedService(null);
      setUploadedFile(null);
      setNotes('');
      setPaymentReference('');
      setPendingCheckoutUrl('');
      onNavigate('client-notary-tracking');
      pendingTimeoutRef.current = null;
    }, 300);
  };

  return (
    <div className="nr-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="nr-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`nr-sidebar ${!sidebarOpen ? 'nr-sidebar--closed' : ''}`}>
        <div className="nr-sidebar__header">
          <button className="nr-sidebar__toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="nr-sidebar__logo">
            <img src="/logo/logo.jpg" alt="Logo" className="nr-sidebar__logo-img" />
            <ScalesIcon size={26} color="#f5a623" />
            <span>LegalLink</span>
          </div>
        </div>
        <nav className="nr-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <NrDashboardIcon />,     nav: 'home-logged' },
            { label: 'Book Appointment',    icon: <NrCalIcon />,           nav: 'book-appointment' },
            { label: 'My Appointments',     icon: <NrMyApptIcon />,        nav: 'my-appointments' },
            { label: 'Notarial Requests',   icon: <NrNotarialIcon />,      nav: 'my-notarial-requests' },
            { label: 'Announcements',       icon: <NrAnnouncementIcon />,  nav: 'announcements' },
            { label: 'Transaction History', icon: <NrTransactionIcon />,   nav: 'transaction-history' },
            { label: 'Profile',             icon: <NrProfileIcon />,       nav: 'profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`nr-sidebar__item ${item.label === 'Notarial Requests' ? 'nr-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="nr-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="nr-main">
        <div className="nr-header">
          <h1>Request Notarial Service</h1>
          <p>Choose a service, attach your file, then pay with PayMongo.</p>
        </div>

        <div className="nr-container">
          {/* Services Selection */}
          <div className="nr-section">
            <h2 className="nr-section-title">📋 Select Notarial Service</h2>
            <div className="nr-services-grid">
              {notarialServices.map((service) => (
                <div
                  key={service.id}
                  className={`nr-service-card ${selectedService === service.id ? 'nr-service-card--selected' : ''}`}
                  onClick={() => handleServiceToggle(service.id)}
                >
                  <div className="nr-service-checkbox">
                    {selectedService === service.id && <span>✓</span>}
                  </div>
                  <h3 className="nr-service-name">{service.name}</h3>
                  <p className="nr-service-desc">{service.description}</p>
                  <p className="nr-service-price">PHP {Number(service.amount || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="nr-section">
            <h2 className="nr-section-title">Upload Documents</h2>
            <div className="nr-file-upload">
              <input
                type="file"
                id="nr-file-input"
                className="nr-file-input"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt,.jpg,.png,.zip"
              />
              <label htmlFor="nr-file-input" className="nr-file-upload-label">
                <span className="nr-upload-icon">📤</span>
                <span className="nr-upload-text">
                  {uploadedFile ? (
                    <>
                      ✓ <strong>{uploadedFile.name}</strong>
                    </>
                  ) : (
                    <>Click to upload or drag & drop<br /><span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>PDF, DOC, DOCX, TXT, JPG, PNG, ZIP</span></>
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="nr-section">
            <h2 className="nr-section-title">Additional Notes (Optional)</h2>
            <textarea
              className="nr-notes-textarea"
              placeholder="Add any additional information or special requests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="5"
            />
          </div>

          {selectedServiceRow && uploadedFile ? (
            <div className="nr-pay-summary">
              <div className="nr-pay-summary__row">
                <span>Service</span>
                <strong>{selectedServiceRow.name}</strong>
              </div>
              <div className="nr-pay-summary__row">
                <span>Document</span>
                <strong>{uploadedFile.name}</strong>
              </div>
              <div className="nr-pay-summary__row nr-pay-summary__row--total">
                <span>Amount due</span>
                <strong>{formatPeso(payableAmount)}</strong>
              </div>
              <p className="nr-pay-summary__note">
                GCash, Maya, and QR Ph are available on the PayMongo page.
              </p>
            </div>
          ) : null}

          {/* Submit Button */}
          <div className="nr-actions">
            <button
              className="nr-btn nr-btn--submit"
              onClick={handleSubmit}
              disabled={isPaying || !selectedServiceRow || !uploadedFile}
            >
              {isPaying ? 'Opening PayMongo…' : 'Proceed to Payment'}
            </button>
            <button className="nr-btn nr-btn--cancel" onClick={() => onNavigate('home-logged')} disabled={isPaying}>Cancel</button>
          </div>
        </div>
      </main>

      {/* Error Modal */}
      {showError && (
        <div className="nr-error-overlay" onClick={closeError}>
          <div className="nr-error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nr-error-content">
              <div className="nr-error-icon-wrapper">
                <div className="nr-error-icon">⚠</div>
              </div>
              <h2 className="nr-error-title">{errorTitle}</h2>
              <p className="nr-error-message">{errorMessage}</p>
              <button className="nr-error-btn" onClick={closeError}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* PayMongo checkout / paid confirmation */}
      {paymentPhase && (
        <div className="nr-confirmation-overlay" onClick={paymentPhase === 'paid' ? closeConfirmation : undefined}>
          <div className="nr-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nr-confirmation-content">
              {paymentPhase === 'paying' ? (
                <>
                  <div className="nr-confirmation-icon-wrapper">
                    <div className="nr-confirmation-icon nr-confirmation-icon--pay">₱</div>
                  </div>
                  <h2 className="nr-confirmation-title">Pay with PayMongo</h2>
                  <div className="nr-confirmation-message">
                    <p>
                      Finish payment for <strong>{selectedServiceRow?.name}</strong> in the PayMongo tab.
                      This page will update when the payment is confirmed.
                    </p>
                  </div>
                  <div className="nr-request-details">
                    <h4 className="nr-details-title">Payment details</h4>
                    <div className="nr-details-list">
                      <div className="nr-detail-item">
                        <span className="nr-detail-label">Service</span>
                        <span className="nr-detail-value">{selectedServiceRow?.name}</span>
                      </div>
                      <div className="nr-detail-item">
                        <span className="nr-detail-label">Document</span>
                        <span className="nr-detail-value">{uploadedFile?.name}</span>
                      </div>
                      <div className="nr-detail-item">
                        <span className="nr-detail-label">Amount</span>
                        <span className="nr-detail-value">{formatPeso(payableAmount)}</span>
                      </div>
                    </div>
                  </div>
                  {pendingCheckoutUrl ? (
                    <a
                      className="nr-confirmation-btn nr-confirmation-btn--link"
                      href={pendingCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open PayMongo
                    </a>
                  ) : (
                    <p className="nr-pay-waiting">Preparing secure checkout…</p>
                  )}
                  <button type="button" className="nr-confirmation-btn nr-confirmation-btn--ghost" onClick={handleCancelPayment}>
                    Cancel payment
                  </button>
                </>
              ) : (
                <>
                  <div className="nr-confirmation-icon-wrapper">
                    <div className="nr-confirmation-icon">✓</div>
                  </div>
                  <h2 className="nr-confirmation-title">Payment successful</h2>
                  <div className="nr-confirmation-message">
                    <p>
                      Your notarial request for <strong>{selectedServiceRow?.name}</strong> is paid and now in the admin queue.
                    </p>
                  </div>
                  <div className="nr-confirmation-what-next">
                    <h4 className="nr-what-next-title">What happens next</h4>
                    <ul className="nr-what-next-list">
                      <li>PayMongo confirmed your payment</li>
                      <li>The request is in the admin notarial queue for processing</li>
                      <li>Track updates under Notary Status</li>
                    </ul>
                  </div>
                  <div className="nr-request-details">
                    <h4 className="nr-details-title">Receipt</h4>
                    <div className="nr-details-list">
                      <div className="nr-detail-item">
                        <span className="nr-detail-label">Service</span>
                        <span className="nr-detail-value">{selectedServiceRow?.name}</span>
                      </div>
                      <div className="nr-detail-item">
                        <span className="nr-detail-label">Document</span>
                        <span className="nr-detail-value">{uploadedFile?.name}</span>
                      </div>
                      <div className="nr-detail-item">
                        <span className="nr-detail-label">Amount paid</span>
                        <span className="nr-detail-value">{formatPeso(payableAmount)}</span>
                      </div>
                      {paymentReference ? (
                        <div className="nr-detail-item">
                          <span className="nr-detail-label">Reference</span>
                          <span className="nr-detail-value">{paymentReference}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button className="nr-confirmation-btn" onClick={closeConfirmation}>Go to Notary Status</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Chat FAB */}
      <button className="nr-chat-fab" title="AI Assistant">
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

export default NotarialRequest;
