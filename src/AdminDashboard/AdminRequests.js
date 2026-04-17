import { useEffect, useMemo, useState } from 'react';
import './AdminRequests.css';
import { fetchAppointmentRequests, updateAppointmentStatus } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminRequests({ onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [viewRequest, setViewRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      try {
        const rows = await fetchAppointmentRequests(200);
        if (isMounted) {
          setRequests(rows);
        }
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to load appointment requests.');
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

  const filteredRequests = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return requests;

    return requests.filter((req) => {
      const clientName = req.client?.full_name || '';
      const attorneyName = req.attorney?.full_name || '';
      const requestType = req.title || 'Consultation';
      return (
        clientName.toLowerCase().includes(keyword)
        || attorneyName.toLowerCase().includes(keyword)
        || requestType.toLowerCase().includes(keyword)
      );
    });
  }, [requests, searchText]);

  const processRequest = async (requestId, status) => {
    try {
      await updateAppointmentStatus(requestId, status);
      setRequests((prev) => prev.map((req) => (
        req.id === requestId ? { ...req, status } : req
      )));
      setSelectedRequest(null);
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Failed to update request status.');
    }
  };

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Pending Requests</h1>
          <span className="adm-detail-count">{loading ? '...' : filteredRequests.length}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <div className="adm-detail-search">
            <input
              type="text"
              placeholder="Search requests..."
              className="adm-detail-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          {errorText ? <p>{errorText}</p> : null}

          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Request Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="adm-detail-table__row--clickable">
                  <td>{req.client?.full_name || 'Unknown Client'}</td>
                  <td>{req.title || 'Consultation'}</td>
                  <td>{req.scheduled_at ? new Date(req.scheduled_at).toLocaleDateString() : '-'}</td>
                  <td><span className={`adm-detail-badge adm-detail-badge--${(req.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>{req.status || 'pending'}</span></td>
                  <td>
                    <div className="adm-detail-row-actions">
                      <button className="adm-detail-row-btn adm-detail-row-btn--view" onClick={() => setViewRequest(req)}>View</button>
                      <button className="adm-detail-row-btn" onClick={() => setSelectedRequest(req)}>Process</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="5">No pending appointment requests found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>

      {viewRequest && (
        <div className="adm-detail-modal-overlay" onClick={() => setViewRequest(null)}>
          <div className="adm-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-detail-modal__header">
              <h2>Request Details</h2>
              <button className="adm-detail-modal__close" onClick={() => setViewRequest(null)}>x</button>
            </div>
            <div className="adm-detail-modal__content">
              <div className="adm-detail-modal__row">
                <label>Client Name:</label>
                <p>{viewRequest.client?.full_name || 'Unknown Client'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Request Type:</label>
                <p>{viewRequest.title || 'Consultation'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Date & Time:</label>
                <p>{viewRequest.scheduled_at ? new Date(viewRequest.scheduled_at).toLocaleString() : '-'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Instructions:</label>
                <p>{viewRequest.notes || 'No additional notes submitted.'}</p>
              </div>
            </div>
            <div className="adm-detail-modal__actions">
              <button className="adm-detail-modal__btn adm-detail-modal__btn--close" onClick={() => setViewRequest(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="adm-detail-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="adm-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-detail-modal__header">
              <h2>Process Request</h2>
              <button className="adm-detail-modal__close" onClick={() => setSelectedRequest(null)}>×</button>
            </div>
            <div className="adm-detail-modal__content">
              <div className="adm-detail-modal__row">
                <label>Client Name:</label>
                <p>{selectedRequest.client?.full_name || 'Unknown Client'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Request Type:</label>
                <p>{selectedRequest.title || 'Consultation'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Date:</label>
                <p>{selectedRequest.scheduled_at ? new Date(selectedRequest.scheduled_at).toLocaleString() : '-'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Current Status:</label>
                <p>{selectedRequest.status}</p>
              </div>
            </div>
            <div className="adm-detail-modal__actions">
              <button className="adm-detail-modal__btn adm-detail-modal__btn--approve" onClick={() => processRequest(selectedRequest.id, 'confirmed')}>Approve</button>
              <button className="adm-detail-modal__btn adm-detail-modal__btn--close" onClick={() => setSelectedRequest(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminRequests;
