import { useState } from 'react';
import './SecretaryTheme.css';
import './SecretaryHome.css';
import ladyJusticeImage from '../AdminDashboard/lady-justice.jpg';

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

function AttorneyHome() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [consultations] = useState([
    { id: 1, clientName: 'Maria Santos', date: 'May 22, 2026', time: '10:00 AM', status: 'pending', area: 'Family Law' }
  ]);
  const [clientRequests] = useState([
    { id: 1, name: 'Luis De Leon', type: 'Profile Verification', submitted: 'Today, 9:30 AM', status: 'pending' },
    { id: 2, name: 'Elena Cruz', type: 'Document Assistance', submitted: 'Today, 8:15 AM', status: 'in review' }
  ]);
  const [messages] = useState([
    { id: 1, from: 'Atty. Ramos', preview: 'Please verify slots for tomorrow consultations.', time: '11:20 AM', unread: true },
    { id: 2, from: 'Front Desk', preview: 'New walk-in notarial request was recorded.', time: '9:05 AM', unread: false }
  ]);
  const [activityLogs] = useState([
    { id: 1, action: 'Consultation request marked as pending', by: 'Secretary', time: 'Today, 10:12 AM' },
    { id: 2, action: 'Client account updated', by: 'Secretary', time: 'Today, 8:42 AM' }
  ]);
  const [appointments] = useState(0);
  const [requestModal, setRequestModal] = useState(null);
  const [replyModal, setReplyModal] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [profileForm, setProfileForm] = useState({
    displayName: 'Secretary',
    email: 'secretary@batasmo.ph',
    phone: '+63 912 345 6789'
  });

  const handleNavigation = (page) => {
    setActivePage(page);
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

  const renderDashboardContent = () => {
    if (activePage === 'Consultation Management') {
      return renderPageShell(
        'Consultation Management',
        'Track booking status, assign follow-ups, and coordinate attorney schedules.',
        <div className="sec-page-grid sec-page-grid--two">
          <div className="sec-subcard">
            <h3>Pending Consultations</h3>
            <div className="sec-table-list">
              {consultations.map((item) => (
                <div key={item.id} className="sec-table-row">
                  <div>
                    <strong>{item.clientName}</strong>
                    <p>{item.area}</p>
                  </div>
                  <div className="sec-table-row__meta">
                    <span>{item.date}</span>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="sec-subcard">
            <h3>Scheduling Notes</h3>
            <ul className="sec-detail-list">
              <li>Confirm attorney availability 24 hours before client booking.</li>
              <li>Flag overlapping time slots before approval.</li>
              <li>Send reminders to clients one hour before consultation.</li>
            </ul>
          </div>
        </div>
      );
    }

    if (activePage === 'Client Assistance') {
      return renderPageShell(
        'Client Assistance',
        'Handle account support and client onboarding requests from one place.',
        <div className="sec-page-grid">
          {clientRequests.map((request) => (
            <article key={request.id} className="sec-subcard sec-subcard--compact">
              <h3>{request.name}</h3>
              <p className="sec-muted">{request.type}</p>
              <p className="sec-muted">Submitted: {request.submitted}</p>
              <div className="sec-subcard__footer">
                <span className={statusClass(request.status)}>{request.status}</span>
                <button className="sec-view-btn" onClick={() => setRequestModal(request)}>Open Request</button>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (activePage === 'Messages') {
      return renderPageShell(
        'Messages',
        'Review attorney and staff communications related to consultations.',
        <div className="sec-page-grid">
          {messages.map((message) => (
            <article key={message.id} className="sec-subcard sec-subcard--compact">
              <div className="sec-subcard__header-row">
                <h3>{message.from}</h3>
                <span className={message.unread ? 'sec-pill sec-pill--new' : 'sec-pill'}>{message.unread ? 'New' : 'Read'}</span>
              </div>
              <p className="sec-message-preview">{message.preview}</p>
              <div className="sec-subcard__footer">
                <span className="sec-muted">{message.time}</span>
                <button className="sec-view-btn" onClick={() => {
                  setReplyText(`Hello ${message.from},\n\n`);
                  setReplyModal(message);
                }}>
                  Reply
                </button>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (activePage === 'Logs') {
      return renderPageShell(
        'Logs',
        'Operational trail of secretary actions and client coordination updates.',
        <div className="sec-subcard">
          <h3>Recent Activity</h3>
          <div className="sec-table-list">
            {activityLogs.map((log) => (
              <div key={log.id} className="sec-table-row">
                <div>
                  <strong>{log.action}</strong>
                  <p>By {log.by}</p>
                </div>
                <div className="sec-table-row__meta">
                  <span>{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activePage === 'Profile') {
      return renderPageShell(
        'Secretary Profile',
        'Personal account details and assigned operations role.',
        <div className="sec-page-grid sec-page-grid--two">
          <article className="sec-subcard sec-profile-card">
            <div className="sec-avatar sec-avatar--large">SE</div>
            <div>
              <h3>Secretary</h3>
              <p className="sec-muted">Operations Coordinator</p>
            </div>
            <button className="sec-secondary-btn" onClick={() => setEditProfileOpen(true)}>Edit Profile</button>
          </article>
          <article className="sec-subcard">
            <h3>Assigned Access</h3>
            <ul className="sec-detail-list">
              <li>Consultation and booking management</li>
              <li>Client assistance requests</li>
              <li>Attorney communication support</li>
              <li>Dashboard activity logs</li>
            </ul>
          </article>
        </div>
      );
    }

    return (
      <>
        <div className="sec-hero-grid">
          <div className="sec-welcome">
            <div
              className="sec-welcome-art"
              style={{
                backgroundImage: `url(${ladyJusticeImage})`
              }}
              aria-hidden="true"
            />
            <p className="sec-kicker">OPERATIONS OVERVIEW</p>
            <h1>Welcome back, Secretary</h1>
            <p>Monitor consultations, assist attorneys, manage client requests, and keep operations running smoothly from one dashboard.</p>
            <div className="sec-hero-chips">
              <div className="sec-hero-chip">{consultations.length} pending consultations</div>
              <div className="sec-hero-chip">3 notarial requests</div>
            </div>
          </div>
          <div className="sec-next-consultation">
            <h3>Next Consultation</h3>
            {consultations.length > 0 ? (
              <>
                <p className="sec-consultation-name">{consultations[0].clientName}</p>
                <p className="sec-consultation-meta">{consultations[0].area}</p>
                <p className="sec-consultation-time">{consultations[0].date} at {consultations[0].time}</p>
              </>
            ) : (
              <p className="sec-empty-state">No upcoming consultations</p>
            )}
          </div>
        </div>

        <div className="sec-stats-grid">
          <div className="sec-stat-card">
            <div className="sec-stat-icon"><CalendarIcon /></div>
            <p className="sec-stat-label">MY APPOINTMENTS</p>
            <h2 className="sec-stat-value">{appointments}</h2>
          </div>
          <div className="sec-stat-card">
            <div className="sec-stat-icon"><PesoIcon /></div>
            <p className="sec-stat-label">OPERATIONS</p>
            <button className="sec-view-btn" onClick={() => setSummaryOpen(true)}>View Summary</button>
          </div>
        </div>

        <div className="sec-queue-section">
          <div className="sec-queue-header">
            <h2>Consultation Queue</h2>
            <button className="sec-view-all-btn">View All</button>
          </div>
          <p className="sec-queue-desc">Pending client consultations sorted by date</p>
          <div className="sec-queue-list">
            {consultations.length > 0 ? (
              consultations.map(c => (
                <div key={c.id} className="sec-queue-item">
                  <div className="sec-queue-avatar">{c.clientName.split(' ').map(n => n[0]).join('')}</div>
                  <div className="sec-queue-info">
                    <h4>{c.clientName}</h4>
                    <p>{c.area}</p>
                  </div>
                  <div className="sec-queue-meta">
                    <p className="sec-queue-date">{c.date}</p>
                    <span className={`sec-queue-status sec-queue-status--${c.status}`}>{c.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', color: '#5C5C5C', padding: '20px' }}>No pending consultations</p>
            )}
          </div>
        </div>
      </>
    );
  };

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
          {[
            'Dashboard',
            'Consultation Management',
            'Client Assistance',
            'Messages',
            'Logs',
            'Profile'
          ].map(label => (
            <button
              key={label}
              className={`sec-sidebar__item ${activePage === label ? 'sec-sidebar__item--active':''}`}
              onClick={() => handleNavigation(label)}
            >
              {label}
            </button>
          ))}
          <button 
            className="sec-sidebar__item sec-sidebar__item--logout"
            onClick={() => window.location.href = '/login'}
            style={{ marginTop: 'auto', color: '#d9534f', fontWeight: 'bold' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </nav>
      </aside>

      <header className="sec-topbar">
        <div className="sec-topbar__left">
          <h1 className="sec-topbar__title">Secretary Dashboard</h1>
        </div>
        <div className="sec-topbar__right">
          <button className="sec-icon-btn">
            <BellIcon />
          </button>
          <div className="sec-profile" onClick={() => handleNavigation('Profile')}>
            <div className="sec-profile__name">Secretary</div>
            <div className="sec-avatar">SE</div>
          </div>
        </div>
      </header>

      <main className="sec-main">
        {renderDashboardContent()}
      </main>

      {(requestModal || replyModal || summaryOpen || editProfileOpen) ? (
        <div className="sec-modal-overlay" onClick={() => {
          setRequestModal(null);
          setReplyModal(null);
          setSummaryOpen(false);
          setEditProfileOpen(false);
        }}>
          {requestModal ? (
            <section className="sec-modal" onClick={(event) => event.stopPropagation()}>
              <div className="sec-modal__header">
                <h3>Client Request Details</h3>
                <button className="sec-modal__close" onClick={() => setRequestModal(null)}>Close</button>
              </div>
              <div className="sec-modal__body">
                <p><strong>Name:</strong> {requestModal.name}</p>
                <p><strong>Request Type:</strong> {requestModal.type}</p>
                <p><strong>Submitted:</strong> {requestModal.submitted}</p>
                <p><strong>Status:</strong> {requestModal.status}</p>
                <div className="sec-modal__actions">
                  <button className="sec-secondary-btn">Request Documents</button>
                  <button className="sec-view-btn">Mark In Review</button>
                </div>
              </div>
            </section>
          ) : null}

          {replyModal ? (
            <section className="sec-modal" onClick={(event) => event.stopPropagation()}>
              <div className="sec-modal__header">
                <h3>Reply to {replyModal.from}</h3>
                <button className="sec-modal__close" onClick={() => setReplyModal(null)}>Close</button>
              </div>
              <div className="sec-modal__body">
                <p className="sec-muted">Original: {replyModal.preview}</p>
                <textarea
                  className="sec-modal__textarea"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  rows={7}
                  placeholder="Type your response"
                />
                <div className="sec-modal__actions">
                  <button className="sec-secondary-btn" onClick={() => setReplyText('')}>Clear</button>
                  <button className="sec-view-btn" onClick={() => setReplyModal(null)}>Send Reply</button>
                </div>
              </div>
            </section>
          ) : null}

          {summaryOpen ? (
            <section className="sec-modal" onClick={(event) => event.stopPropagation()}>
              <div className="sec-modal__header">
                <h3>Operations Summary</h3>
                <button className="sec-modal__close" onClick={() => setSummaryOpen(false)}>Close</button>
              </div>
              <div className="sec-modal__body sec-modal__body--summary">
                <div className="sec-summary-card">
                  <span>Total Collections</span>
                  <strong>PHP 12,500.00</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Pending Payments</span>
                  <strong>PHP 3,200.00</strong>
                </div>
                <div className="sec-summary-card">
                  <span>Completed Services</span>
                  <strong>18</strong>
                </div>
              </div>
            </section>
          ) : null}

          {editProfileOpen ? (
            <section className="sec-modal" onClick={(event) => event.stopPropagation()}>
              <div className="sec-modal__header">
                <h3>Edit Secretary Profile</h3>
                <button className="sec-modal__close" onClick={() => setEditProfileOpen(false)}>Close</button>
              </div>
              <form
                className="sec-modal__body"
                onSubmit={(event) => {
                  event.preventDefault();
                  setEditProfileOpen(false);
                }}
              >
                <label className="sec-modal__field">
                  <span>Display Name</span>
                  <input
                    value={profileForm.displayName}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  />
                </label>
                <label className="sec-modal__field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                <label className="sec-modal__field">
                  <span>Phone</span>
                  <input
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </label>
                <div className="sec-modal__actions">
                  <button type="button" className="sec-secondary-btn" onClick={() => setEditProfileOpen(false)}>Cancel</button>
                  <button type="submit" className="sec-view-btn">Save Changes</button>
                </div>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default AttorneyHome;
