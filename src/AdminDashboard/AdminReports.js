import { useEffect, useState } from 'react';
import './AdminDetail.css';
import { fetchNotifications, fetchPayoutRequests, fetchTransactions } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminReports({ onNavigate }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      try {
        const [transactions, payouts, notifications] = await Promise.all([
          fetchTransactions(200),
          fetchPayoutRequests(200),
          fetchNotifications(200),
        ]);

        const totalRevenue = transactions
          .filter((item) => item.payment_status === 'paid')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const pendingPayouts = payouts.filter((item) => item.status === 'requested' || item.status === 'processing').length;
        const unreadNotifs = notifications.filter((item) => !item.is_read).length;

        if (isMounted) {
          setReports([
            {
              id: 'transactions',
              title: 'Transactions Summary',
              period: `${transactions.length} records`,
              type: `Paid Revenue: PHP ${totalRevenue.toLocaleString()}`,
              generated: new Date().toLocaleDateString(),
            },
            {
              id: 'payouts',
              title: 'Payout Requests Queue',
              period: `${payouts.length} records`,
              type: `${pendingPayouts} pending`,
              generated: new Date().toLocaleDateString(),
            },
            {
              id: 'notifications',
              title: 'Notifications Activity',
              period: `${notifications.length} records`,
              type: `${unreadNotifs} unread`,
              generated: new Date().toLocaleDateString(),
            },
          ]);
        }
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to generate reports from database data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReports();

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
          <h1 className="adm-detail-title">Reports</h1>
          <span className="adm-detail-count">{loading ? '...' : reports.length}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          {errorText ? <p>{errorText}</p> : null}
          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Period</th>
                <th>Type</th>
                <th>Generated</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(item => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.period}</td>
                  <td>{item.type}</td>
                  <td>{item.generated}</td>
                </tr>
              ))}
              {!loading && reports.length === 0 ? (
                <tr>
                  <td colSpan="4">No report data available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminReports;
