import { useEffect, useState } from 'react';
import './AdminDashboard.css';
import {
  fetchAdminStats,
  fetchNotarialRequests,
  fetchPendingConsultations,
} from '../lib/adminApi';

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

const UserMgmtIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ConsultationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const NotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);

const ReportsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
);

const CmsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

function AdminDashboard({ onNavigate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('Dashboard');
  const [stats, setStats] = useState({
    clientCount: 0,
    attorneyCount: 0,
    pendingRequestCount: 0,
    completedConsultationCount: 0,
  });
  const [pendingConsultations, setPendingConsultations] = useState([]);
  const [notarialRequests, setNotarialRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const [statRows, consultationRows, notarialRows] = await Promise.all([
          fetchAdminStats(),
          fetchPendingConsultations(5),
          fetchNotarialRequests(5),
        ]);

        if (isMounted) {
          setStats(statRows);
          setPendingConsultations(consultationRows);
          setNotarialRequests(notarialRows);
        }
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to load admin dashboard data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const statCards = [
    { label: 'Total Clients', value: stats.clientCount },
    { label: 'Total Attorneys', value: stats.attorneyCount },
    { label: 'Pending Requests', value: stats.pendingRequestCount },
    { label: 'Completed Consultations', value: stats.completedConsultationCount },
  ];

  const sidebarItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, nav: 'admin-home' },
    { label: 'User Management', icon: <UserMgmtIcon />, nav: 'admin-users' },
    { label: 'Consultation Requests', icon: <ConsultationIcon />, nav: 'admin-consultations' },
    { label: 'Notarial Requests', icon: <NotarialIcon />, nav: 'admin-notarial' },
    { label: 'Reports', icon: <ReportsIcon />, nav: 'admin-reports' },
    { label: 'CMS', icon: <CmsIcon />, nav: 'admin-cms' },
    { label: 'Profile', icon: <ProfileIcon />, nav: 'admin-profile' },
  ];

  const handleStatClick = (i) => {
    const navPaths = ['admin-clients', 'admin-attorneys', 'admin-requests', 'admin-consultations'];
    onNavigate(navPaths[i] || 'admin-home');
  };

  const getBadgeClass = (status) => {
    const base = status.toLowerCase().replace(/\s+/g, '-');
    return `adm-badge adm-badge--${base}`;
  };

  const pendingNotarialCount = notarialRequests.filter((row) => row.status === 'pending').length;
  const reviewBacklog = pendingConsultations.length + pendingNotarialCount;
  const completionRate =
    stats.pendingRequestCount + stats.completedConsultationCount > 0
      ? Math.round((stats.completedConsultationCount / (stats.pendingRequestCount + stats.completedConsultationCount)) * 100)
      : 0;

  return (
    <div className="adm-page">
      {sidebarOpen && <div className="adm-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`adm-sidebar ${sidebarOpen ? 'adm-sidebar--open' : ''}`}>
        <div className="adm-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="adm-sidebar__nav">
          {sidebarItems.map(item => (
            <button
              key={item.label}
              className={`adm-sidebar__item ${activePage === item.label ? 'adm-sidebar__item--active' : ''}`}
              onClick={() => {
                setActivePage(item.label);
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="adm-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="adm-topbar">
        <div className="adm-topbar__left">
          <button className="adm-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="adm-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>Admin Dashboard</span>
          </div>
        </div>
        <div className="adm-topbar__right">
          <div className="adm-profile" onClick={() => onNavigate('admin-profile')}>
            <div className="adm-profile__info">
              <span className="adm-profile__name">Admin</span>
            </div>
            <div className="adm-avatar">A</div>
          </div>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-stats">
          {statCards.map((s, i) => (
            <button 
              key={i} 
              className="adm-stat-card adm-stat-card--clickable"
              onClick={() => handleStatClick(i)}
              title={`View ${s.label}`}
            >
              <span className="adm-stat-card__label">{s.label}</span>
              <span className="adm-stat-card__value">{loading ? '...' : s.value}</span>
            </button>
          ))}
        </div>
        {errorText ? <p>{errorText}</p> : null}

        <div className="adm-grid">
          <div className="adm-card">
            <h3 className="adm-card__title">System Analytics Snapshot</h3>
            <div className="adm-notif-list">
              <div className="adm-notif-item">
                <p className="adm-notif-item__text">Review backlog</p>
                <span className="adm-notif-item__time">{loading ? '...' : `${reviewBacklog} active items`}</span>
              </div>
              <div className="adm-notif-item">
                <p className="adm-notif-item__text">Consultation completion rate</p>
                <span className="adm-notif-item__time">{loading ? '...' : `${completionRate}%`}</span>
              </div>
              <div className="adm-notif-item">
                <p className="adm-notif-item__text">Pending notarial requests</p>
                <span className="adm-notif-item__time">{loading ? '...' : pendingNotarialCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-grid">
          <div className="adm-table-card">
            <h3 className="adm-card__title">Pending Consultations</h3>
            <table className="adm-table adm-table--clickable">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Attorney</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingConsultations.map((c, i) => (
                  <tr 
                    key={c.id || i}
                    className="adm-table__row--clickable"
                    onClick={() => onNavigate('admin-consultations')}
                    title="Open consultation list"
                  >
                    <td>{c.client?.full_name || 'Unknown Client'}</td>
                    <td>{c.attorney?.full_name || 'Unknown Attorney'}</td>
                    <td><span className={getBadgeClass(c.status || 'pending')}>{c.status || 'pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adm-table-card">
            <h3 className="adm-card__title">Notarial Requests</h3>
            <table className="adm-table adm-table--clickable">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Document Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {notarialRequests.map((n, i) => (
                  <tr 
                    key={n.id || i}
                    className="adm-table__row--clickable"
                    onClick={() => onNavigate('admin-notarial')}
                    title="Open notarial requests"
                  >
                    <td>{n.client?.full_name || 'Unknown Client'}</td>
                    <td>{n.service_type || '-'}</td>
                    <td><span className={getBadgeClass(n.status || 'pending')}>{n.status || 'pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

    </div>
  );
}

export default AdminDashboard;
