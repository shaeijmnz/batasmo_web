import { useEffect, useState } from 'react';
import './AdminDetail.css';
import { fetchRecentProfileActivity } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminUserLogs({ onNavigate }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      try {
        const profiles = await fetchRecentProfileActivity(30);
        if (isMounted) {
          const mapped = profiles.map((item) => ({
            id: item.id,
            user: 'Admin',
            action: 'Updated profile record',
            target: item.full_name || item.email || item.id,
            time: item.updated_at ? new Date(item.updated_at).toLocaleString() : '-',
          }));
          setLogs(mapped);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-users')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">User Logs</h1>
          <span className="adm-detail-count">Recent</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{log.user}</td>
                  <td>{log.action}</td>
                  <td>{log.target}</td>
                  <td>{log.time}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="4">No user log data available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminUserLogs;
