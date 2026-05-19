import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminRescheduleRequests from '../AdminDashboard/AdminRescheduleRequests';
import AdminSupportDrawer from '../AdminDashboard/AdminSupportDrawer';
import '../AdminDashboard/AdminSupportDrawer.css';
import { notifyClientNotarialStatusUpdate } from '../lib/adminApi';
import {
  loadSecretaryCalendarAppointments,
  loadSecretaryClients,
  loadSecretaryNotarialRequests,
  loadSecretaryOverview,
  updateNotarialStatus,
  updateSecretaryConsultationStatus,
} from '../lib/secretaryData';
import {
  adminCreateWalkInClient,
  fetchAdminHomeNotifications,
  markAdminNotificationsAsRead,
  signOutUser,
  subscribeToAdminNotifications,
} from '../lib/userApi';
import { GMAIL_REQUIRED_MESSAGE, isGmailEmail } from '../lib/validators';
import './SecretaryTheme.css';
import './SecretaryHome.css';
import ladyJusticeImage from '../AdminDashboard/lady-justice.jpg';

const NAV_PAGES = [
  'Dashboard',
  'Consultation Management',
  'Notarial Requests',
  'Client Assistance',
  'Messages',
  'Appointment Calendar',
  'Profile',
];

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B0F19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const PesoIcon = () => <span className="sec-peso-icon">PHP</span>;

const isConsultationPending = (status) => {
  const value = String(status || '').toLowerCase();
  return value === 'pending' || value === 'requested' || value === 'awaiting';
};

const isNotarialAwaitingProcess = (status) => {
  const value = String(status || '').toLowerCase();
  return value === 'pending' || value === 'approved' || value === 'accepted';
};

const isNotarialInProcess = (status) => {
  const value = String(status || '').toLowerCase();
  return value === 'in_process' || value === 'in-progress';
};

const clientInitials = (name) =>
  String(name || 'Client')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function SecretaryConsole({ profile, onNavigate, onSignOut, initialPage = 'Dashboard' }) {
  const [activePage, setActivePage] = useState(
    NAV_PAGES.includes(initialPage) ? initialPage : 'Dashboard',
  );
  const [consultations, setConsultations] = useState([]);
  const [clients, setClients] = useState([]);
  const [notarialRequests, setNotarialRequests] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  const [stats, setStats] = useState({
    clientCount: 0,
    attorneyCount: 0,
    pendingRequestCount: 0,
    completedConsultationCount: 0,
  });
  const [pendingNotarialCount, setPendingNotarialCount] = useState(0);
  const [unreadSupport, setUnreadSupport] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionBusyId, setActionBusyId] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addFormError, setAddFormError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const displayName = profile?.full_name || 'Secretary';
  const email = profile?.email || '';
  const initials = useMemo(
    () =>
      displayName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'SE',
    [displayName],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [overview, notarial, calendar, clientRows, notifRows] = await Promise.all([
        loadSecretaryOverview(),
        loadSecretaryNotarialRequests(),
        loadSecretaryCalendarAppointments(),
        loadSecretaryClients(),
        profile?.id ? fetchAdminHomeNotifications(profile.id) : Promise.resolve([]),
      ]);
      setConsultations(overview.consultations);
      setStats(overview.stats);
      setPendingNotarialCount(overview.pendingNotarialCount);
      setUnreadSupport(overview.unreadSupport);
      setNotarialRequests(notarial);
      setCalendarItems(calendar);
      setClients(clientRows);
      setNotifications(notifRows);
    } catch (error) {
      setLoadError(error?.message || 'Unable to load secretary dashboard.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeToAdminNotifications(profile.id, () => {
      fetchAdminHomeNotifications(profile.id).then(setNotifications).catch(() => {});
      refreshAll();
    });
  }, [profile?.id, refreshAll]);

  const handleNavigation = (page) => {
    setActivePage(page);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {
      // local cleanup still runs in App
    }
    if (typeof onSignOut === 'function') onSignOut();
    else onNavigate?.('login');
  };

  const handleApproveConsultation = async (item) => {
    if (!item?.id || actionBusyId) return;
    setActionBusyId(item.id);
    try {
      await updateSecretaryConsultationStatus(item.id, 'confirmed');
      await refreshAll();
    } catch (error) {
      window.alert(error?.message || 'Could not update consultation.');
    } finally {
      setActionBusyId('');
    }
  };

  const handleNotarialStatus = async (item, nextStatus) => {
    if (!item?.id || actionBusyId) return;
    setActionBusyId(item.id);
    try {
      await updateNotarialStatus(item.id, nextStatus);
      await notifyClientNotarialStatusUpdate({
        clientId: item.raw?.client_id,
        requestId: item.id,
        status: nextStatus,
        documentType: item.documentType,
      });
      await refreshAll();
    } catch (error) {
      window.alert(error?.message || 'Could not update notarial request.');
    } finally {
      setActionBusyId('');
    }
  };

  const handleAddWalkInClient = async (event) => {
    event.preventDefault();
    setAddFormError('');
    const normalizedEmail = addEmail.trim().toLowerCase();
    if (!isGmailEmail(normalizedEmail)) {
      setAddFormError(GMAIL_REQUIRED_MESSAGE);
      return;
    }
    setAddSubmitting(true);
    try {
      const result = await adminCreateWalkInClient({
        email: normalizedEmail,
        fullName: addFullName.trim() || undefined,
      });
      setCreatedCredentials({
        email: result.email || normalizedEmail,
        password: result.generatedPassword,
        fullName: result.fullName || addFullName.trim() || 'Walk-in Client',
      });
      setAddEmail('');
      setAddFullName('');
      await refreshAll();
    } catch (error) {
      setAddFormError(error?.message || 'Could not create client account.');
    } finally {
      setAddSubmitting(false);
    }
  };

  const statusClass = (status) => {
    if (status === 'approved') return 'sec-queue-status sec-queue-status--approved';
    if (status === 'rejected') return 'sec-queue-status sec-queue-status--rejected';
    if (status === 'in review') return 'sec-queue-status sec-queue-status--approved';
    return 'sec-queue-status sec-queue-status--pending';
  };

  const renderPageShell = (title, subtitle, content) => (
    <section className="sec-page-panel">
      <div className="sec-page-panel__head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {content}
    </section>
  );

  const handleBellToggle = async () => {
    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    if (nextOpen && profile?.id) {
      try {
        await markAdminNotificationsAsRead(profile.id);
        setNotifications((rows) => rows.map((row) => ({ ...row, unread: false })));
      } catch {
        // non-blocking
      }
    }
  };

  const renderDashboardContent = () => {
    if (loading) {
      return (
        <section className="sec-page-panel">
          <p className="sec-muted">Loading secretary dashboard…</p>
        </section>
      );
    }

    if (loadError) {
      return (
        <section className="sec-page-panel">
          <p className="sec-muted">{loadError}</p>
          <button type="button" className="sec-view-btn" onClick={refreshAll}>
            Retry
          </button>
        </section>
      );
    }

    if (activePage === 'Consultation Management') {
      return renderPageShell(
        'Consultation Management',
        'Track booking status, assign follow-ups, and coordinate attorney schedules.',
        <div className="sec-page-grid sec-page-grid--two">
          <div className="sec-subcard">
            <h3>Consultations</h3>
            <div className="sec-table-list">
              {consultations.length > 0 ? (
                consultations.map((item) => (
                  <div key={item.id} className="sec-table-row">
                    <div>
                      <strong>{item.clientName}</strong>
                      <p>{item.area}</p>
                      <p className="sec-muted">Attorney: {item.attorneyName}</p>
                    </div>
                    <div className="sec-table-row__meta">
                      <span>{item.date} · {item.time}</span>
                      <span className={statusClass(item.status)}>{item.status}</span>
                      {isConsultationPending(item.status) ? (
                        <button
                          type="button"
                          className="sec-view-btn"
                          disabled={actionBusyId === item.id}
                          onClick={() => handleApproveConsultation(item)}
                        >
                          Approve
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="sec-muted">No consultations in queue.</p>
              )}
            </div>
          </div>
          <div className="sec-subcard">
            <h3>Reschedule Requests</h3>
            <AdminRescheduleRequests adminUserId={profile?.id} />
          </div>
        </div>,
      );
    }

    if (activePage === 'Notarial Requests') {
      return renderPageShell(
        'Notarial Requests',
        'Update document workflow status and notify clients when requests move forward.',
        <div className="sec-page-grid">
          {notarialRequests.length > 0 ? (
            notarialRequests.map((item) => (
              <article key={item.id} className="sec-subcard sec-subcard--compact">
                <h3>{item.clientName}</h3>
                <p className="sec-muted">{item.documentType}</p>
                <p className="sec-muted">Submitted: {item.submitted}</p>
                {item.notes ? <p className="sec-muted">Notes: {item.notes}</p> : null}
                <div className="sec-subcard__footer">
                  <span className={statusClass(item.status)}>{item.status}</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isNotarialAwaitingProcess(item.status) ? (
                      <button
                        type="button"
                        className="sec-view-btn"
                        disabled={actionBusyId === item.id}
                        onClick={() => handleNotarialStatus(item, 'in_process')}
                      >
                        In process
                      </button>
                    ) : null}
                    {isNotarialInProcess(item.status) ? (
                      <button
                        type="button"
                        className="sec-view-btn"
                        disabled={actionBusyId === item.id}
                        onClick={() => handleNotarialStatus(item, 'ready_for_pickup')}
                      >
                        Ready for pickup
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="sec-muted">No notarial requests in queue.</p>
          )}
        </div>,
      );
    }

    if (activePage === 'Client Assistance') {
      return renderPageShell(
        'Client Assistance',
        'Handle account support and client onboarding requests from one place.',
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              type="button"
              className="sec-view-btn"
              onClick={() => {
                setCreatedCredentials(null);
                setAddFormError('');
                setAddClientOpen(true);
              }}
            >
              Add walk-in client
            </button>
          </div>
          <div className="sec-page-grid">
            {clients.length > 0 ? (
              clients.map((client) => (
                <article key={client.id} className="sec-subcard sec-subcard--compact">
                  <h3>{client.name}</h3>
                  <p className="sec-muted">{client.email}</p>
                  {client.phone ? <p className="sec-muted">{client.phone}</p> : null}
                  <p className="sec-muted">Joined: {client.joined}</p>
                </article>
              ))
            ) : (
              <p className="sec-muted">No clients found.</p>
            )}
          </div>
        </>,
      );
    }

    if (activePage === 'Messages') {
      return renderPageShell(
        'Messages',
        'Review and respond to client support threads.',
        <div className="sec-support-embed">
          <AdminSupportDrawer
            open
            mode="page"
            onClose={() => {}}
            onUnreadChange={setUnreadSupport}
          />
        </div>,
      );
    }

    if (activePage === 'Appointment Calendar') {
      return renderPageShell(
        'Appointment Calendar',
        'Upcoming consultations for the next two weeks.',
        <div className="sec-subcard">
          <h3>Scheduled Appointments</h3>
          <div className="sec-table-list">
            {calendarItems.length > 0 ? (
              calendarItems.map((item) => (
                <div key={item.id} className="sec-table-row">
                  <div>
                    <strong>{item.clientName}</strong>
                    <p>{item.area}</p>
                    <p className="sec-muted">Attorney: {item.attorneyName}</p>
                  </div>
                  <div className="sec-table-row__meta">
                    <span>{item.date}</span>
                    <span>{item.time}</span>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="sec-muted">No appointments in the next 14 days.</p>
            )}
          </div>
        </div>,
      );
    }

    if (activePage === 'Profile') {
      return renderPageShell(
        'Secretary Profile',
        'Personal account details and assigned operations role.',
        <div className="sec-page-grid sec-page-grid--two">
          <article className="sec-subcard sec-profile-card">
            <div className="sec-avatar sec-avatar--large">{initials}</div>
            <div>
              <h3>{displayName}</h3>
              <p className="sec-muted">{email}</p>
            </div>
          </article>
          <article className="sec-subcard">
            <h3>Assigned Access</h3>
            <ul className="sec-detail-list">
              <li>Consultation and booking management</li>
              <li>Notarial request workflow updates</li>
              <li>Client assistance and walk-in onboarding</li>
              <li>Support messages and appointment calendar</li>
            </ul>
          </article>
        </div>,
      );
    }

    const nextConsultation = consultations[0];

    return (
      <>
        <div className="sec-hero-grid">
          <div className="sec-welcome">
            <div
              className="sec-welcome-art"
              style={{ backgroundImage: `url(${ladyJusticeImage})` }}
              aria-hidden="true"
            />
            <p className="sec-kicker">OPERATIONS OVERVIEW</p>
            <h1>Welcome back, secretary</h1>
            <p>
              Monitor consultations, assist attorneys, manage client requests, and keep
              operations running smoothly from one dashboard.
            </p>
            <div className="sec-hero-chips">
              <div className="sec-hero-chip">{consultations.length} consultations in queue</div>
              <div className="sec-hero-chip">{pendingNotarialCount} notarial requests</div>
              {unreadSupport > 0 ? (
                <div className="sec-hero-chip">{unreadSupport} unread support messages</div>
              ) : null}
            </div>
          </div>
          <div className="sec-next-consultation">
            <h3>Next Consultation</h3>
            {nextConsultation ? (
              <>
                <p className="sec-consultation-name">{nextConsultation.clientName}</p>
                <p className="sec-consultation-meta">{nextConsultation.area}</p>
                <p className="sec-consultation-time">
                  {nextConsultation.date} at {nextConsultation.time}
                </p>
              </>
            ) : (
              <p className="sec-empty-state">No upcoming consultations</p>
            )}
          </div>
        </div>

        <div className="sec-stats-grid">
          <div className="sec-stat-card">
            <div className="sec-stat-icon"><CalendarIcon /></div>
            <p className="sec-stat-label">REGISTERED CLIENTS</p>
            <h2 className="sec-stat-value">{stats.clientCount}</h2>
          </div>
          <div className="sec-stat-card">
            <div className="sec-stat-icon"><CalendarIcon /></div>
            <p className="sec-stat-label">CONSULTATIONS IN QUEUE</p>
            <h2 className="sec-stat-value">{consultations.length}</h2>
          </div>
          <div className="sec-stat-card">
            <div className="sec-stat-icon"><PesoIcon /></div>
            <p className="sec-stat-label">NOTARIAL QUEUE</p>
            <h2 className="sec-stat-value">{pendingNotarialCount}</h2>
            <button type="button" className="sec-view-btn" onClick={() => setSummaryOpen(true)}>
              View Summary
            </button>
          </div>
        </div>

        <div className="sec-queue-section">
          <div className="sec-queue-header">
            <h2>Consultation Queue</h2>
            <button
              type="button"
              className="sec-view-all-btn"
              onClick={() => handleNavigation('Consultation Management')}
            >
              View All
            </button>
          </div>
          <p className="sec-queue-desc">Pending client consultations sorted by date</p>
          <div className="sec-queue-list">
            {consultations.length > 0 ? (
              consultations.map((item) => (
                <div key={item.id} className="sec-queue-item">
                  <div className="sec-queue-avatar">{clientInitials(item.clientName)}</div>
                  <div className="sec-queue-info">
                    <h4>{item.clientName}</h4>
                    <p>{item.area}</p>
                  </div>
                  <div className="sec-queue-meta">
                    <p className="sec-queue-date">{item.date}</p>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="sec-empty-state">No pending consultations</p>
            )}
          </div>
        </div>
      </>
    );
  };

  const unreadNotificationCount = notifications.filter((row) => row.unread).length;

  return (
    <div className="sec-page">
      <aside className="sec-sidebar sec-sidebar--open">
        <div className="sec-sidebar__logo">
          <img src="/logo/logo.jpg" alt="BatasMo logo" className="sec-brand-logo" />
          <div className="sec-brand-text-wrap">
            <span className="sec-brand-title">BatasMo</span>
            <span className="sec-brand-sub">Secretary Console</span>
          </div>
        </div>
        <nav className="sec-sidebar__nav">
          {NAV_PAGES.map((label) => (
            <button
              key={label}
              type="button"
              className={`sec-sidebar__item ${activePage === label ? 'sec-sidebar__item--active' : ''}`}
              onClick={() => handleNavigation(label)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="sec-sidebar__item sec-sidebar__item--logout"
            onClick={handleLogout}
            style={{ marginTop: 'auto', color: '#d9534f', fontWeight: 'bold' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </nav>
      </aside>

      <header className="sec-topbar">
        <div className="sec-topbar__left">
          <h1 className="sec-topbar__title">{activePage}</h1>
        </div>
        <div className="sec-topbar__right">
          <div className="sec-notif-wrap">
            <button type="button" className="sec-icon-btn" onClick={handleBellToggle} aria-expanded={notifOpen}>
              <BellIcon />
              {unreadNotificationCount > 0 ? (
                <span className="sec-notif-badge">{unreadNotificationCount}</span>
              ) : null}
            </button>
            {notifOpen ? (
              <div className="sec-notif-dropdown">
                <div className="sec-notif-dropdown__head">
                  <strong>Notifications</strong>
                  <button type="button" className="sec-modal__close" onClick={() => setNotifOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="sec-notif-dropdown__list">
                  {notifications.length > 0 ? (
                    notifications.map((row) => (
                      <div key={row.id} className={`sec-notif-item ${row.unread ? 'sec-notif-item--unread' : ''}`}>
                        <strong>{row.title}</strong>
                        <p>{row.body}</p>
                        <span className="sec-muted">{row.time}</span>
                      </div>
                    ))
                  ) : (
                    <p className="sec-muted">No notifications yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="sec-profile" onClick={() => handleNavigation('Profile')} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') handleNavigation('Profile'); }}>
            <div className="sec-profile__name">{displayName}</div>
            <div className="sec-avatar">{initials}</div>
          </div>
        </div>
      </header>

      <main className="sec-main">
        {renderDashboardContent()}
      </main>

      {summaryOpen || addClientOpen ? (
        <div
          className="sec-modal-overlay"
          onClick={() => {
            setSummaryOpen(false);
            setAddClientOpen(false);
            setCreatedCredentials(null);
            setAddFormError('');
          }}
        >
          {summaryOpen ? (
            <section className="sec-modal" onClick={(event) => event.stopPropagation()}>
              <div className="sec-modal__header">
                <h3>Operations Summary</h3>
                <button type="button" className="sec-modal__close" onClick={() => setSummaryOpen(false)}>
                  Close
                </button>
              </div>
              <div className="sec-modal__body sec-modal__body--summary">
                <div className="sec-summary-card">
                  <span>Registered Clients</span>
                  <strong>{stats.clientCount}</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Consultations in Queue</span>
                  <strong>{consultations.length}</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Notarial Queue</span>
                  <strong>{pendingNotarialCount}</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Completed Consultations</span>
                  <strong>{stats.completedConsultationCount}</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Attorneys on Platform</span>
                  <strong>{stats.attorneyCount}</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Unread Support</span>
                  <strong>{unreadSupport}</strong>
                </div>
              </div>
            </section>
          ) : null}

          {addClientOpen ? (
            <section className="sec-modal" onClick={(event) => event.stopPropagation()}>
              <div className="sec-modal__header">
                <h3>Add Walk-in Client</h3>
                <button
                  type="button"
                  className="sec-modal__close"
                  onClick={() => {
                    setAddClientOpen(false);
                    setCreatedCredentials(null);
                    setAddFormError('');
                  }}
                >
                  Close
                </button>
              </div>
              <form className="sec-modal__body" onSubmit={handleAddWalkInClient}>
                {createdCredentials ? (
                  <div className="sec-subcard">
                    <h3>Account created</h3>
                    <p><strong>Name:</strong> {createdCredentials.fullName}</p>
                    <p><strong>Email:</strong> {createdCredentials.email}</p>
                    <p><strong>Temporary password:</strong> {createdCredentials.password}</p>
                    <p className="sec-muted">Share these credentials with the client securely.</p>
                  </div>
                ) : (
                  <>
                    <label className="sec-modal__field">
                      <span>Gmail address</span>
                      <input
                        type="email"
                        value={addEmail}
                        onChange={(event) => setAddEmail(event.target.value)}
                        placeholder="client@gmail.com"
                        required
                      />
                    </label>
                    <label className="sec-modal__field">
                      <span>Full name (optional)</span>
                      <input
                        type="text"
                        value={addFullName}
                        onChange={(event) => setAddFullName(event.target.value)}
                        placeholder="Client full name"
                      />
                    </label>
                    {addFormError ? <p className="sec-muted">{addFormError}</p> : null}
                    <div className="sec-modal__actions">
                      <button
                        type="button"
                        className="sec-secondary-btn"
                        onClick={() => {
                          setAddClientOpen(false);
                          setAddFormError('');
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="sec-view-btn" disabled={addSubmitting}>
                        {addSubmitting ? 'Creating…' : 'Create account'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SecretaryConsole;
