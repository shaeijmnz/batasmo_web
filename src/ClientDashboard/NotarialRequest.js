import { useEffect, useRef, useState } from 'react';
import './NotarialRequest.css';
import { createNotarialRequest } from '../lib/userApi';

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
  { id: 1, name: 'Affidavit of Loss', description: 'Prepare and notarize an affidavit for lost documents or IDs.' },
];

function NotarialRequest({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const pendingTimeoutRef = useRef(null);

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
    setSelectedService(selectedService === serviceId ? null : serviceId);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!profile?.id || selectedService === null || !preferredDate || !uploadedFile) {
      setErrorMessage('Please select one service, choose a date, and upload a file');
      setShowError(true);
      return;
    }

    try {
      const selectedServiceRow = notarialServices.find((item) => item.id === selectedService);
      await createNotarialRequest({
        clientId: profile?.id,
        serviceType: selectedServiceRow?.name || 'Notarial Service',
        preferredDate,
        notes,
        documentName: uploadedFile.name,
      });
      setShowConfirmation(true);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to submit request.');
      setShowError(true);
    }
  };

  const closeError = () => {
    setShowError(false);
  };

  const closeConfirmation = () => {
    setShowConfirmation(false);
    pendingTimeoutRef.current = setTimeout(() => {
      setSelectedService(null);
      setPreferredDate('');
      setUploadedFile(null);
      setNotes('');
      onNavigate('home-logged');
      pendingTimeoutRef.current = null;
    }, 300);
  };

  return (
    <div className="nr-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="nr-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`nr-sidebar ${sidebarOpen ? 'nr-sidebar--open' : ''}`}>
        <div className="nr-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
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

      {/* Topbar */}
      <header className="nr-topbar">
        <div className="nr-topbar__left">
          <button className="nr-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="nr-breadcrumb">
            <span className="nr-breadcrumb__current">Request Notarial Service</span>
          </div>
        </div>
        <div className="nr-topbar__right">
          <button className="nr-icon-btn" onClick={() => onNavigate('chat-room')} title="Message Admin">
            <MessageIcon />
          </button>
          <button className="nr-icon-btn nr-bell" onClick={() => onNavigate('announcements')} title="Announcements">
            <BellIcon />
            <span className="nr-bell__dot" />
          </button>
          <div className="nr-profile" onClick={() => onNavigate('profile')} style={{ cursor: 'pointer' }}>
            <div className="nr-profile__info">
              <span className="nr-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="nr-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="nr-main">
        <div className="nr-header">
          <h1>Request Notarial Service</h1>
          <p>Choose the notarial services you need and upload your documents</p>
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
                </div>
              ))}
            </div>
          </div>

          {/* Preferred Date */}
          <div className="nr-section">
            <h2 className="nr-section-title">Preferred Service Date</h2>
            <input
              type="date"
              className="nr-date-input"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
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

          {/* Submit Button */}
          <div className="nr-actions">
            <button className="nr-btn nr-btn--submit" onClick={handleSubmit}>Submit Notarial Service Request</button>
            <button className="nr-btn nr-btn--cancel" onClick={() => onNavigate('home-logged')}>Cancel</button>
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
              <h2 className="nr-error-title">Missing Information</h2>
              <p className="nr-error-message">{errorMessage}</p>
              <button className="nr-error-btn" onClick={closeError}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="nr-confirmation-overlay" onClick={closeConfirmation}>
          <div className="nr-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nr-confirmation-content">
              <div className="nr-confirmation-icon-wrapper">
                <div className="nr-confirmation-icon">✓</div>
              </div>
              
              <h2 className="nr-confirmation-title">Request Submitted!</h2>
              
              <div className="nr-confirmation-message">
                <p>Your notarial service request for <strong>{notarialServices.find(s => s.id === selectedService)?.name}</strong> has been successfully submitted.</p>
              </div>

              <div className="nr-confirmation-what-next">
                <h4 className="nr-what-next-title">What Happens Next?</h4>
                <ul className="nr-what-next-list">
                  <li>Your request status is now <strong>Pending</strong> - awaiting notary review</li>
                  <li>Our notary will review your documents and respond within 24 hours</li>
                  <li>You will receive a notification when the request is accepted or declined</li>
                  <li>Payment will be required only after the notary accepts your request</li>
                </ul>
              </div>

              <div className="nr-request-details">
                <h4 className="nr-details-title">Request Details:</h4>
                <div className="nr-details-list">
                  <div className="nr-detail-item">
                    <span className="nr-detail-label">Service:</span>
                    <span className="nr-detail-value">
                      {notarialServices.find(s => s.id === selectedService)?.name}
                    </span>
                  </div>
                  <div className="nr-detail-item">
                    <span className="nr-detail-label">Preferred Date:</span>
                    <span className="nr-detail-value">{preferredDate}</span>
                  </div>
                  <div className="nr-detail-item">
                    <span className="nr-detail-label">Document:</span>
                    <span className="nr-detail-value">{uploadedFile?.name}</span>
                  </div>
                </div>
              </div>

              <button className="nr-confirmation-btn" onClick={closeConfirmation}>Back to Home</button>
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
