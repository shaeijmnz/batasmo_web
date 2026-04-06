import { useEffect, useMemo, useState } from 'react';
import './AdminConsultationStats.css';
import { fetchCompletedConsultations } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminConsultationStats({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const data = await fetchCompletedConsultations();
        if (isMounted) {
          setRows(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to load consultation analytics.');
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

  const totalCompleted = rows.length;
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const averageDuration = rows.length > 0
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0) / rows.length)
    : 0;

  const monthlyStats = useMemo(() => {
    const groups = new Map();

    rows.forEach((row) => {
      const date = row.scheduled_at ? new Date(row.scheduled_at) : null;
      if (!date) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const current = groups.get(key) || { month: label, consultations: 0, revenue: 0 };
      current.consultations += 1;
      current.revenue += Number(row.amount || 0);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value);
  }, [rows]);

  const topAttorneys = useMemo(() => {
    const groups = new Map();

    rows.forEach((row) => {
      const name = row.attorney?.full_name || 'Unknown Attorney';
      const current = groups.get(name) || { name, completed: 0, revenue: 0 };
      current.completed += 1;
      current.revenue += Number(row.amount || 0);
      groups.set(name, current);
    });

    return Array.from(groups.values())
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  }, [rows]);

  return (
    <div className="acs-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-consultations')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Consultation Statistics</h1>
          <span className="adm-detail-count">{loading ? 'Loading...' : 'Admin View'}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        {errorText ? <p>{errorText}</p> : null}
        <div className="acs-grid">
          <div className="acs-card">
            <span className="acs-card__label">Total Completed</span>
            <span className="acs-card__value">{totalCompleted}</span>
          </div>
          <div className="acs-card">
            <span className="acs-card__label">Total Revenue</span>
            <span className="acs-card__value">PHP {totalRevenue.toLocaleString()}</span>
          </div>
          <div className="acs-card">
            <span className="acs-card__label">Average Rating</span>
            <span className="acs-card__value">N/A</span>
          </div>
          <div className="acs-card">
            <span className="acs-card__label">Avg. Duration</span>
            <span className="acs-card__value">{averageDuration} mins</span>
          </div>
        </div>

        <section className="acs-panel">
          <h2>Monthly Performance</h2>
          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Completed Consultations</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.map(row => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{row.consultations}</td>
                  <td><strong>PHP {row.revenue.toLocaleString()}</strong></td>
                </tr>
              ))}
              {!loading && monthlyStats.length === 0 ? (
                <tr>
                  <td colSpan="3">No monthly consultation data available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="acs-panel">
          <h2>Top Performing Attorneys</h2>
          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Attorney</th>
                <th>Completed</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topAttorneys.map(item => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.completed}</td>
                  <td><strong>PHP {item.revenue.toLocaleString()}</strong></td>
                </tr>
              ))}
              {!loading && topAttorneys.length === 0 ? (
                <tr>
                  <td colSpan="3">No attorney performance data available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default AdminConsultationStats;
