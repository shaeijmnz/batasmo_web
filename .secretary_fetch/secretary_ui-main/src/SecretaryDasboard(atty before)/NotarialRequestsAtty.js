import { useEffect, useState } from 'react';
import './SecretaryTheme.css';
import './SecretaryHome.css';

function NotarialRequestsAtty() {
  const [requests, setRequests] = useState([]);

  useEffect(() => setRequests([]), []);

  const verify = (id) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Verified' } : r));
  const markReady = (id) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Ready for pickup' } : r));

  return (
    <div className="sec-page">
      <h2>Notarial Requests</h2>
      <p className="sec-note">Review uploaded documents and notify clients when ready for pickup.</p>
      <div className="sec-list">
        {requests.length === 0 ? (
          <div className="sec-empty">No notarial requests.</div>
        ) : requests.map(r => (
          <div className="sec-list-item" key={r.id}>
            <div>
              <strong>{r.clientName || 'Client'}</strong>
              <div className="muted">{r.docType} • {r.status || 'submitted'}</div>
            </div>
            <div className="sec-actions">
              <button onClick={() => verify(r.id)}>Verify</button>
              <button onClick={() => markReady(r.id)}>Mark Ready</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotarialRequestsAtty;
