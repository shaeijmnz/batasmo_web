import { useEffect, useState } from 'react';
import './ConsultationRequests.css';
import './AttorneyTheme.css';
import {
  fetchAttorneyConsultationRequests,
  subscribeToAttorneyAppointments,
  updateAttorneyConsultationRequestStatus,
} from '../lib/userApi';
import AttorneyNotificationDropdown from './AttorneyNotificationDropdown';

/* ── Icons ── */
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const formatNotifBadgeCount = (count) => {
  const safeCount = Number(count || 0);
  if (safeCount <= 0) return '';
  if (safeCount > 99) return '99+';
  return String(safeCount);
};
// eslint-disable-next-line no-unused-vars
const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const CalSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

function ConsultationRequests({ onNavigate, profile }) {
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  /* Modal state */
  const [modal, setModal] = useState({ type: null, requestId: null });
  const [rejectNote, setRejectNote] = useState('');
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedNote, setReschedNote] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async (options = {}) => {
      if (!profile?.id) return;

      try {
        const data = await fetchAttorneyConsultationRequests(profile.id, options);
        if (!isMounted) return;
        setRequests(data.requests);
        setNotifications(data.notifications);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Unable to load consultation requests.');
        }
      }
    };

    loadRequests({ force: true });

    const unsubscribe = subscribeToAttorneyAppointments(profile?.id, () => {
      loadRequests({ force: true });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [profile?.id]);

  const closeModal = () => {
    setModal({ type: null, requestId: null });
    setRejectNote('');
    setReschedDate('');
    setReschedTime('');
    setReschedNote('');
  };

  const confirmAccept = async () => {
    try {
      await updateAttorneyConsultationRequestStatus({ appointmentId: modal.requestId, status: 'confirmed' });
      setRequests(prev => prev.map(r => r.id === modal.requestId ? { ...r, status: 'Approved' } : r));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to approve request.');
    }
    closeModal();
  };

  const confirmReject = async () => {
    if (!rejectNote.trim()) return;
    try {
      await updateAttorneyConsultationRequestStatus({
        appointmentId: modal.requestId,
        status: 'rejected',
        note: rejectNote,
      });
      setRequests(prev => prev.map(r => r.id === modal.requestId ? { ...r, status: 'Rejected' } : r));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to reject request.');
    }
    closeModal();
  };

  const confirmReschedule = async () => {
    if (!reschedDate || !reschedTime) return;
    try {
      await updateAttorneyConsultationRequestStatus({
        appointmentId: modal.requestId,
        status: 'rescheduled',
        scheduledAt: new Date(`${reschedDate}T${reschedTime}`).toISOString(),
        note: reschedNote,
      });
      setRequests(prev => prev.map(r => r.id === modal.requestId ? { ...r, status: 'Rescheduled', date: reschedDate, time: reschedTime } : r));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to reschedule request.');
    }
    closeModal();
  };

  const getReq = () => requests.find(r => r.id === modal.requestId);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="cr-page atty-page-wrapper">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="cr-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`cr-sidebar ${sidebarOpen ? 'cr-sidebar--open' : ''}`}>
        <div className="cr-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="cr-sidebar__nav">
          {[
            { label: 'Dashboard',     icon: <DashboardIcon />,     nav: 'attorney-home' },
            { label: 'Consultation Management',   icon: <ScheduleIcon />,      nav: 'upcoming-appointments' },
            { label: 'Logs',          icon: <LogsIcon />,          nav: 'attorney-logs' },
            { label: 'Announcement',  icon: <AnnouncementIcon />,  nav: 'attorney-announcements' },
            { label: 'Profile',       icon: <ProfileIcon />,       nav: 'attorney-profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`cr-sidebar__item sidebar-item ${item.label === 'Consultation Management' ? 'cr-sidebar__item--active' : ''}`}
              onClick={() => {
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="cr-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="cr-topbar">
        <div className="cr-topbar__left">
          <button className="cr-back-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="cr-topbar__title">
            <span className="cr-topbar__title-text">Consultation Management</span>
          </div>
        </div>
        <div className="cr-topbar__right" style={{ position: 'relative' }}>
          <button
            type="button"
            className="cr-icon-btn cr-notif-btn"
            onClick={() => setNotifOpen((v) => !v)}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
          >
            <BellIcon />
            {unreadCount > 0 ? <span className="cr-notif-badge">{formatNotifBadgeCount(unreadCount)}</span> : null}
          </button>
          <AttorneyNotificationDropdown
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            notifications={notifications}
          />
          <div className="cr-profile" style={{ cursor: 'pointer' }} onClick={() => onNavigate('attorney-profile')}>
            <div className="cr-profile__info">
              <span className="cr-profile__name">{profile?.full_name || 'Attorney'}</span>
              <span className="cr-profile__status">PENDING</span>
            </div>
            <div className="cr-avatar">{(profile?.full_name || 'AT').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Request Cards */}
      <main className="cr-main">
        <div className="cr-header-group ap-header-group">
          <span className="cr-kicker ap-kicker">Attorney Workspace</span>
          <h1 className="cr-main-title ap-main-title">Consultation Requests</h1>
        </div>
        {loadError ? <p>{loadError}</p> : null}
        {requests.map(req => (
          <div className="cr-card glass-card" key={req.id}>
            <div className="cr-card__top">
              <div className="cr-card__left">
                <div className="cr-card__avatar">{req.initials}</div>
                <div className="cr-card__info">
                  <div className="cr-card__name-row">
                    <span className="cr-card__name">{req.name}</span>
                    <span className={`cr-status cr-status--${req.status.toLowerCase()}`}>{req.status.toUpperCase()}</span>
                  </div>
                  <div className="cr-card__meta">
                    <span><DocIcon /> {req.area}</span>
                    <span><CalSmallIcon /> {req.date} • {req.time}</span>
                    <span className="cr-card__paid">● {req.payment}</span>
                  </div>
                </div>
              </div>
              {req.status === 'Approved' && (
                <div className="cr-card__actions">
                  <button className="cr-enter-btn" onClick={() => onNavigate('attorney-messages', { appointmentId: req.id })}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    ENTER CONSULTATION
                  </button>
                </div>
              )}
            </div>
            <div className="cr-card__concern">
              <span className="cr-card__concern-label">BRIEF DESCRIPTION OF CONCERN</span>
              <div className="cr-card__concern-text">{req.concern}</div>
            </div>
          </div>
        ))}
      </main>

      {/* ── Accept Modal ── */}
      {modal.type === 'accept' && (
        <div className="cr-modal-overlay" onClick={closeModal}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal__icon cr-modal__icon--green">
              <CheckIcon />
            </div>
            <h3>Accept Consultation</h3>
            <p>Are you sure you want to accept the consultation request from <strong>{getReq()?.name}</strong>?</p>
            <p className="cr-modal__note">The client will be notified that you have accepted their consultation.</p>
            <div className="cr-modal__actions">
              <button className="cr-modal-btn cr-modal-btn--cancel" onClick={closeModal}>Cancel</button>
              <button className="cr-modal-btn cr-modal-btn--confirm cr-modal-btn--green" onClick={confirmAccept}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {modal.type === 'reject' && (
        <div className="cr-modal-overlay" onClick={closeModal}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal__icon cr-modal__icon--red">
              <XIcon />
            </div>
            <h3>Reject Consultation</h3>
            <p>Please provide a reason for rejecting <strong>{getReq()?.name}</strong>'s request.</p>
            <textarea
              className="cr-modal__textarea"
              placeholder="Enter your reason for rejection..."
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={4}
            />
            <div className="cr-modal__actions">
              <button className="cr-modal-btn cr-modal-btn--cancel" onClick={closeModal}>Cancel</button>
              <button className="cr-modal-btn cr-modal-btn--confirm cr-modal-btn--red" onClick={confirmReject} disabled={!rejectNote.trim()}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ── */}
      {modal.type === 'reschedule' && (
        <div className="cr-modal-overlay" onClick={closeModal}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal__icon cr-modal__icon--blue">
              <CalendarIcon />
            </div>
            <h3>Reschedule Consultation</h3>
            <p>Suggest a new date and time for <strong>{getReq()?.name}</strong>'s consultation.</p>
            <div className="cr-modal__fields">
              <div className="cr-modal__field">
                <label>New Date</label>
                <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} />
              </div>
              <div className="cr-modal__field">
                <label>New Time</label>
                <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} />
              </div>
            </div>
            <textarea
              className="cr-modal__textarea"
              placeholder="Optional note for the client..."
              value={reschedNote}
              onChange={e => setReschedNote(e.target.value)}
              rows={3}
            />
            <div className="cr-modal__actions">
              <button className="cr-modal-btn cr-modal-btn--cancel" onClick={closeModal}>Cancel</button>
              <button className="cr-modal-btn cr-modal-btn--confirm cr-modal-btn--blue" onClick={confirmReschedule} disabled={!reschedDate || !reschedTime}>Reschedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsultationRequests;
