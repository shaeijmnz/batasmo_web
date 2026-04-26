import { useEffect, useState } from 'react';
import './AdminUsers.css';
import { fetchAdminStats } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminUsers({ onNavigate }) {
  const [stats, setStats] = useState({
    clientCount: 0,
    attorneyCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const data = await fetchAdminStats();
        if (isMounted) {
          setStats({
            clientCount: data.clientCount,
            attorneyCount: data.attorneyCount,
          });
        }
      } catch {
        if (isMounted) {
          setStats({ clientCount: 0, attorneyCount: 0 });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">User Management</h1>
          <span className="adm-detail-count">Overview</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-users-grid">
          <button className="adm-users-tile" onClick={() => onNavigate('admin-clients')}>
            <span className="adm-users-tile__label">Clients</span>
            <span className="adm-users-tile__value">{loading ? '...' : stats.clientCount}</span>
            <span className="adm-users-tile__hint">Open clients list</span>
          </button>
          <button className="adm-users-tile" onClick={() => onNavigate('admin-attorneys')}>
            <span className="adm-users-tile__label">Attorneys</span>
            <span className="adm-users-tile__value">{loading ? '...' : stats.attorneyCount}</span>
            <span className="adm-users-tile__hint">Open attorneys list</span>
          </button>
        </div>

        <div className="adm-users-actions">
          <button className="adm-btn adm-btn--full adm-btn--manage" onClick={() => onNavigate('admin-clients')}>Manage Users</button>
          <button className="adm-btn adm-btn--full adm-btn--add" onClick={() => onNavigate('admin-add-user')}>Add New User</button>
          <button className="adm-btn adm-btn--full adm-btn--manage" onClick={() => onNavigate('admin-cms')}>Manage Public CMS</button>
          <button className="adm-btn adm-btn--full adm-btn--logs" onClick={() => onNavigate('admin-user-logs')}>View Logs</button>
        </div>
      </main>
    </div>
  );
}

export default AdminUsers;
