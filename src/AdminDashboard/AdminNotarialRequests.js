import { useEffect, useMemo, useState } from 'react';
import './AdminNotarialRequests.css';
import { createNotification, fetchNotarialRequests, updateNotarialStatus } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const statusFlow = ['pending', 'accepted', 'rejected', 'completed'];

const statusLabel = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
};

function AdminNotarialRequests({ onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [activeStatus, setActiveStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      try {
        const rows = await fetchNotarialRequests(200);
        if (isMounted) {
          setRequests(rows);
        }
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to load notarial requests.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusCounts = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  }), [requests]);

  const visibleRequests = useMemo(
    () => requests.filter((row) => row.status === activeStatus),
    [activeStatus, requests],
  );

  const updateRequestStatus = async (id, status) => {
    try {
      await updateNotarialStatus(id, status);
      setRequests((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Unable to update request status.');
    }
  };

  const handleNotifyClient = async (requestItem) => {
    try {
      await createNotification({
        userId: requestItem.client_id,
        title: 'Notarial Request Update',
        body: `Your request for ${requestItem.service_type} is now marked as ${statusLabel[requestItem.status] || requestItem.status}.`,
        type: 'notarial_update',
      });
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Unable to notify client.');
    }
  };

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Notarial Requests</h1>
          <span className="adm-detail-count">{requests.length}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <div className="anr-status-filters">
            {statusFlow.map(status => (
              <button
                key={status}
                className={`anr-status-btn ${activeStatus === status ? 'anr-status-btn--active' : ''}`}
                onClick={() => setActiveStatus(status)}
              >
                {statusLabel[status]} ({statusCounts[status]})
              </button>
            ))}
          </div>
          {errorText ? <p>{errorText}</p> : null}

          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Document</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length > 0 ? (
                visibleRequests.map(item => (
                  <tr key={item.id}>
                    <td>{item.client?.full_name || 'Unknown Client'}</td>
                    <td>{item.service_type}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                      <span className={`adm-detail-badge adm-detail-badge--${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === 'pending' && (
                        <div className="anr-actions">
                          <button className="anr-btn anr-btn--accept" onClick={() => updateRequestStatus(item.id, 'accepted')}>Accept</button>
                          <button className="anr-btn anr-btn--reject" onClick={() => updateRequestStatus(item.id, 'rejected')}>Reject</button>
                        </div>
                      )}

                      {item.status === 'accepted' && (
                        <div className="anr-actions">
                          <button className="anr-btn anr-btn--ready" onClick={() => updateRequestStatus(item.id, 'completed')}>Mark Completed</button>
                        </div>
                      )}

                      {item.status === 'completed' && (
                        <div className="anr-actions">
                          <button className="anr-btn anr-btn--notify" onClick={() => handleNotifyClient(item)}>Notify Client</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="anr-empty-state">{loading ? 'Loading requests...' : 'No requests in this stage.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminNotarialRequests;
