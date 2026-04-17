import { useEffect, useState } from 'react';
import './NotarialRequestsAtty.css';
import './AttorneyTheme.css';
import { fetchAttorneyNotarialRequests, updateAttorneyNotarialRequestStatus } from '../lib/userApi';

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
const DocIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
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

function NotarialRequestsAtty({ onNavigate, profile }) {
  const [requests, setRequests] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  /* Modal state */
  const [modal, setModal] = useState({ type: null, requestId: null });
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyNotarialRequests(profile.id);
        if (!isMounted) return;
        setRequests(rows);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setRequests([]);
        setLoadError(error.message || 'Unable to load notarial requests.');
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const closeModal = () => {
    setModal({ type: null, requestId: null });
    setRejectNote('');
  };

  const handleAccept = (id) => {
    setModal({ type: 'accept', requestId: id });
  };

  const confirmAccept = async () => {
    try {
      await updateAttorneyNotarialRequestStatus({ requestId: modal.requestId, status: 'approved' });
      setRequests(prev => prev.map(r => r.id === modal.requestId ? { ...r, status: 'Approved' } : r));
      setModal({ type: 'accept-success', requestId: modal.requestId });
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to accept request.');
      closeModal();
    }
  };

  const handleReject = (id) => {
    setModal({ type: 'reject', requestId: id });
  };

  const confirmReject = async () => {
    if (!rejectNote.trim()) return;
    try {
      await updateAttorneyNotarialRequestStatus({ requestId: modal.requestId, status: 'rejected', note: rejectNote });
      setRequests(prev => prev.map(r => r.id === modal.requestId ? { ...r, status: 'Rejected' } : r));
      setLoadError('');
      closeModal();
    } catch (error) {
      setLoadError(error.message || 'Failed to reject request.');
    }
  };

  const handleMoreInfo = (id) => {
    setModal({ type: 'info', requestId: id });
  };

  const getReq = () => requests.find(r => r.id === modal.requestId);

  const getStatusClass = (status) => {
    if (status === 'Approved') return 'nra-status--approved';
    if (status === 'Rejected') return 'nra-status--rejected';
    if (status === 'Revision Requested') return 'nra-status--revision';
    return 'nra-status--pending';
  };

  return (
    <div className="nra-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="nra-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`nra-sidebar ${sidebarOpen ? 'nra-sidebar--open' : ''}`}>
        <div className="nra-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="nra-sidebar__nav">
          {[
            { label: 'Dashboard',     icon: <DashboardIcon />,     nav: 'attorney-home' },
            { label: 'Consultation Management',   icon: <ScheduleIcon />,      nav: 'upcoming-appointments' },
            { label: 'Logs',          icon: <LogsIcon />,          nav: 'attorney-logs' },
            { label: 'Announcement',  icon: <AnnouncementIcon />,  nav: 'attorney-announcements' },
            { label: 'Profile',       icon: <ProfileIcon />,       nav: 'attorney-profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`nra-sidebar__item ${item.label === 'Consultation Management' ? 'nra-sidebar__item--active' : ''}`}
              onClick={() => {
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="nra-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="nra-topbar">
        <div className="nra-topbar__left">
          <button className="nra-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="nra-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="nra-topbar__right">
          <div className="nra-profile">
            <div className="nra-profile__avatar">
              <ProfileIcon />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="nra-main">
        {loadError ? <p>{loadError}</p> : null}
        <div className="nra-header">
          <h1>Notarial Requests</h1>
          <p>Manage and review pending document requests from your clients.</p>
        </div>

        <div className="nra-cards">
          {requests.map(req => (
            <div className="nra-card" key={req.id}>
              <div className="nra-card__left">
                <div className="nra-card__icon">
                  <DocIcon />
                </div>
                <div className="nra-card__info">
                  <div className="nra-card__title-row">
                    <span className="nra-card__title">{req.docType}</span>
                    <span className={`nra-status ${getStatusClass(req.status)}`}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="nra-card__submitter">
                    Submitted by: <strong>{req.submittedBy}</strong>
                  </div>
                  <div className="nra-card__meta">
                    <span className="nra-card__file">
                      <DownloadIcon />
                      {req.fileName}
                    </span>
                    <span className="nra-card__date">
                      <CalendarIcon />
                      {req.date} • {req.time}
                    </span>
                  </div>
                </div>
              </div>
              <div className="nra-card__actions">
                <button className="nra-btn nra-btn--info" onClick={() => handleMoreInfo(req.id)}>
                  <InfoIcon /> MORE INFO
                </button>
                <button className="nra-btn nra-btn--reject" onClick={() => handleReject(req.id)}>
                  <XIcon /> REJECT
                </button>
                <button className="nra-btn nra-btn--accept" onClick={() => handleAccept(req.id)}>
                  <CheckIcon /> ACCEPT
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="nra-footer">
          Showing {requests.length} of {requests.length} requests
        </div>
      </main>

      {/* Accept Confirm Modal */}
      {modal.type === 'accept' && (
        <div className="nra-modal-overlay" onClick={closeModal}>
          <div className="nra-modal" onClick={e => e.stopPropagation()}>
            <h2>Accept Request</h2>
            <p className="nra-modal__sub">
              Are you sure you want to accept the <strong>{getReq()?.docType}</strong> request from {getReq()?.submittedBy}?
            </p>
            <div className="nra-modal__actions">
              <button className="nra-modal__btn nra-modal__btn--cancel" onClick={closeModal}>Cancel</button>
              <button className="nra-modal__btn nra-modal__btn--accept-confirm" onClick={confirmAccept}>
                Yes, Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Success Modal */}
      {modal.type === 'accept-success' && (
        <div className="nra-modal-overlay" onClick={closeModal}>
          <div className="nra-modal nra-modal--success" onClick={e => e.stopPropagation()}>
            <div className="nra-modal__success-icon">
              <CheckIcon />
            </div>
            <h2>Request Accepted!</h2>
            <p className="nra-modal__sub">
              The <strong>{getReq()?.docType}</strong> request from {getReq()?.submittedBy} has been successfully accepted.
            </p>
            <div className="nra-modal__actions">
              <button className="nra-modal__btn nra-modal__btn--accept-confirm" onClick={closeModal}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {modal.type === 'reject' && (
        <div className="nra-modal-overlay" onClick={closeModal}>
          <div className="nra-modal" onClick={e => e.stopPropagation()}>
            <h2>Reject Request</h2>
            <p className="nra-modal__sub">
              Provide a reason for rejecting <strong>{getReq()?.docType}</strong> from {getReq()?.submittedBy}
            </p>
            <label className="nra-modal__label">Reason for Rejection</label>
            <textarea
              className="nra-modal__textarea"
              rows="4"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Enter the reason for rejection..."
            />
            <div className="nra-modal__actions">
              <button className="nra-modal__btn nra-modal__btn--cancel" onClick={closeModal}>Cancel</button>
              <button className="nra-modal__btn nra-modal__btn--reject" disabled={!rejectNote.trim()} onClick={confirmReject}>
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* More Info Modal */}
      {modal.type === 'info' && (
        <div className="nra-modal-overlay" onClick={closeModal}>
          <div className="nra-modal" onClick={e => e.stopPropagation()}>
            <h2>Request Details</h2>
            <div className="nra-modal__detail">
              <strong>Document Type:</strong> {getReq()?.docType}
            </div>
            <div className="nra-modal__detail">
              <strong>Submitted By:</strong> {getReq()?.submittedBy}
            </div>
            <div className="nra-modal__detail">
              <strong>File:</strong> {getReq()?.fileName}
            </div>
            <div className="nra-modal__detail">
              <strong>Date:</strong> {getReq()?.date} at {getReq()?.time}
            </div>
            <div className="nra-modal__detail">
              <strong>Status:</strong> {getReq()?.status}
            </div>
            <div className="nra-modal__actions">
              <button className="nra-modal__btn nra-modal__btn--cancel" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotarialRequestsAtty;
