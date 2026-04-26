import { useEffect, useMemo, useState } from 'react';
import './AdminClients.css';
import { createNotification, fetchClients } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminClients({ onNavigate }) {
  const [clients, setClients] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({ message: '', error: '' });

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      try {
        const rows = await fetchClients();
        if (isMounted) {
          setClients(rows);
        }
      } catch (error) {
        if (isMounted) {
          setActionState({ message: '', error: error.message || 'Failed to load clients.' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredClients = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return clients;

    return clients.filter((client) => {
      const fullName = client.full_name || '';
      const email = client.email || '';
      const phone = client.phone || '';
      return (
        fullName.toLowerCase().includes(keyword)
        || email.toLowerCase().includes(keyword)
        || phone.toLowerCase().includes(keyword)
      );
    });
  }, [clients, searchText]);

  const notifyClient = async (client) => {
    try {
      await createNotification({
        userId: client.id,
        title: 'Update from BatasMo Admin',
        body: 'Your request has been reviewed. Please open your dashboard for the latest status.',
        type: 'admin_notice',
      });
      setActionState({ message: `Notification sent to ${client.full_name || client.email}.`, error: '' });
    } catch (error) {
      setActionState({ message: '', error: error.message || 'Failed to send notification.' });
    }
  };

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Total Clients</h1>
          <span className="adm-detail-count">{loading ? '...' : clients.length}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <div className="adm-detail-search">
            <input
              type="text"
              placeholder="Search clients..."
              className="adm-detail-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          {actionState.message ? <p>{actionState.message}</p> : null}
          {actionState.error ? <p>{actionState.error}</p> : null}

          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Join Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} className="adm-detail-table__row--clickable">
                  <td>{client.full_name || 'Unnamed Client'}</td>
                  <td>{client.email || '-'}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}</td>
                  <td><span className="adm-detail-badge adm-detail-badge--active">Active</span></td>
                  <td>
                    <button className="adm-detail-row-btn" onClick={() => notifyClient(client)}>Notify</button>
                  </td>
                </tr>
              ))}
              {!loading && filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="6">No client records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminClients;
