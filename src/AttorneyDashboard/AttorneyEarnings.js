import { useEffect, useState } from 'react';
import './AttorneyEarnings.css';
import { fetchAttorneyEarningsData } from '../lib/userApi';

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
const MessagesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
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
const TrendUpIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const CashIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1c1f2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
  </svg>
);
const TotalIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const MonthIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const PendingIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const PAGE_SIZE = 5;

const statusClass = (s) => {
  if (s === 'Released') return 'ae-status--released';
  if (s === 'Paid')     return 'ae-status--paid';
  return 'ae-status--pending';
};

export default function AttorneyEarnings({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [cashOutModal, setCashOutModal] = useState(false);
  const [cashOutSuccess, setCashOutSuccess] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ totalNet: 0, monthNet: 0, pendingPayout: 0 });
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!profile?.id) return;
      try {
        const data = await fetchAttorneyEarningsData(profile.id);
        if (!isMounted) return;
        setTransactions(data.rows);
        setStats({ totalNet: data.totalNet, monthNet: data.monthNet, pendingPayout: data.pendingPayout });
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setTransactions([]);
        setLoadError(error.message || 'Unable to load earnings data.');
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [profile]);

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE) || 1;
  const paginated = transactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const sidebarItems = [
    { label: 'Dashboard',    icon: <DashboardIcon />,    nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Messages',     icon: <MessagesIcon />,     nav: 'attorney-messages' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile',      icon: <ProfileIcon />,      nav: 'attorney-profile' },
  ];

  return (
    <div className="ae-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="ae-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`ae-sidebar ${sidebarOpen ? 'ae-sidebar--open' : ''}`}>
        <div className="ae-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ae-sidebar__nav">
          {sidebarItems.map(item => (
            <button
              key={item.label}
              className="ae-sidebar__item"
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="ae-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="ae-topbar">
        <div className="ae-topbar__left">
          <button className="ae-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="ae-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="ae-topbar__right">
          <div className="ae-topbar__user">
            <div className="ae-topbar__user-info">
              <span className="ae-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
              <span className="ae-topbar__user-role">Attorney</span>
            </div>
            <div className="ae-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ae-main">
        {loadError ? <p>{loadError}</p> : null}

        {/* Summary Cards */}
        <div className="ae-summary-grid">
          <div className="ae-summary-card">
            <div className="ae-summary-card__top">
              <div className="ae-summary-card__icon ae-summary-card__icon--gold">
                <TotalIcon />
              </div>
              <span className="ae-summary-card__trend"><TrendUpIcon /> +12.5%</span>
            </div>
            <div className="ae-summary-card__label">TOTAL EARNINGS</div>
            <div className="ae-summary-card__value">PHP {Number(stats.totalNet || 0).toFixed(2)}</div>
          </div>

          <div className="ae-summary-card">
            <div className="ae-summary-card__top">
              <div className="ae-summary-card__icon ae-summary-card__icon--indigo">
                <MonthIcon />
              </div>
              <span className="ae-summary-card__trend"><TrendUpIcon /> +8.2%</span>
            </div>
            <div className="ae-summary-card__label">THIS MONTH</div>
            <div className="ae-summary-card__value">PHP {Number(stats.monthNet || 0).toFixed(2)}</div>
          </div>

          <div className="ae-summary-card">
            <div className="ae-summary-card__top">
              <div className="ae-summary-card__icon ae-summary-card__icon--red">
                <PendingIcon />
              </div>
            </div>
            <div className="ae-summary-card__label">PENDING PAYOUT</div>
            <div className="ae-summary-card__value">PHP {Number(stats.pendingPayout || 0).toFixed(2)}</div>
          </div>

          {/* Cash Out */}
          <div className="ae-cashout-card" onClick={() => setCashOutModal(true)}>
            <CashIcon />
            <span className="ae-cashout-card__label">REQUEST PAYOUT</span>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="ae-table-card">
          <div className="ae-table-header">
            <span className="ae-table-title">TRANSACTION HISTORY</span>
          </div>
          <div className="ae-table-wrap">
            <table className="ae-table">
              <thead>
                <tr>
                  <th>CLIENT NAME</th>
                  <th>SERVICE TYPE</th>
                  <th>DATE</th>
                  <th>AMOUNT</th>
                  <th>PLATFORM FEE</th>
                  <th>NET EARNINGS</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(tx => (
                  <tr key={tx.id}>
                    <td className="ae-td--name">{tx.client}</td>
                    <td>{tx.service}</td>
                    <td>{tx.date}</td>
                    <td>{tx.amount}</td>
                    <td className="ae-td--fee">{tx.fee}</td>
                    <td className="ae-td--net">{tx.net}</td>
                    <td>
                      <span className={`ae-status ${statusClass(tx.status)}`}>{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ae-table-footer">
            <span>Showing {Math.min(currentPage * PAGE_SIZE, transactions.length)} of {transactions.length} transactions</span>
            <div className="ae-pagination">
              <button
                className="ae-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >Previous</button>
              <button
                className="ae-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >Next</button>
            </div>
          </div>
        </div>

        <p className="ae-footer-copy">© 2024 BatasMo Legal Platform. All rights reserved.</p>
      </main>

      {/* Cash Out Confirm Modal */}
      {cashOutModal && !cashOutSuccess && (
        <div className="ae-modal-overlay" onClick={() => setCashOutModal(false)}>
          <div className="ae-modal" onClick={e => e.stopPropagation()}>
            <h2>Request Payout</h2>
            <p className="ae-modal__sub">You are about to request payout for <strong>PHP {Number(stats.pendingPayout || 0).toFixed(2)}</strong>. Do you want to proceed?</p>
            <div className="ae-modal__actions">
              <button className="ae-modal__btn ae-modal__btn--cancel" onClick={() => setCashOutModal(false)}>Cancel</button>
              <button className="ae-modal__btn ae-modal__btn--confirm" onClick={() => { setCashOutSuccess(true); }}>
                Confirm Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Out Success Modal */}
      {cashOutModal && cashOutSuccess && (
        <div className="ae-modal-overlay" onClick={() => { setCashOutModal(false); setCashOutSuccess(false); }}>
          <div className="ae-modal ae-modal--success" onClick={e => e.stopPropagation()}>
            <div className="ae-modal__success-icon">✓</div>
            <h2>Payout Request Submitted!</h2>
            <p className="ae-modal__sub">Your payout of <strong>PHP {Number(stats.pendingPayout || 0).toFixed(2)}</strong> has been processed and will be credited to your account within 1–3 business days.</p>
            <div className="ae-modal__actions">
              <button className="ae-modal__btn ae-modal__btn--confirm" onClick={() => { setCashOutModal(false); setCashOutSuccess(false); }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
