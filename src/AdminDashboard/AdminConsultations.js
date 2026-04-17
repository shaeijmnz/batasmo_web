import { useEffect, useMemo, useState } from 'react';
import './AdminConsultations.css';
import { clearTestBookings, fetchCompletedConsultations } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminConsultations({ onNavigate }) {
  const [consultations, setConsultations] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [actionText, setActionText] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState(null);

  const loadConsultations = async () => {
    try {
      const rows = await fetchCompletedConsultations();
      setConsultations(rows);
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Failed to load completed consultations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsultations();
  }, []);

  const handleClearTestBookings = async () => {
    const confirmed = window.confirm(
      'Clear all consultation bookings for retesting? This removes bookings from client and attorney views.',
    );
    if (!confirmed) return;

    setClearing(true);
    setActionText('');
    setErrorText('');
    try {
      const result = await clearTestBookings();
      setActionText(
        `Bookings cleared. Deleted ${Number(result?.deleted_appointments || 0)} appointment(s).`,
      );
      setConsultations([]);
      await loadConsultations();
    } catch (error) {
      setErrorText(error.message || 'Failed to clear test bookings.');
    } finally {
      setClearing(false);
    }
  };

  const filteredConsultations = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return consultations;

    return consultations.filter((item) => {
      const clientName = item.client?.full_name || '';
      const attorneyName = item.attorney?.full_name || '';
      const notes = item.notes || '';
      return (
        clientName.toLowerCase().includes(keyword)
        || attorneyName.toLowerCase().includes(keyword)
        || notes.toLowerCase().includes(keyword)
      );
    });
  }, [consultations, searchText]);

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Completed Consultations</h1>
          <span className="adm-detail-count">{loading ? '...' : consultations.length}</span>
        </div>
        <div className="adm-detail-actions">
          <button className="adm-detail-btn" onClick={() => onNavigate('admin-consultation-stats')}>Statistics</button>
          <button
            className="adm-detail-btn adm-detail-btn--danger"
            onClick={handleClearTestBookings}
            disabled={clearing}
          >
            {clearing ? 'Clearing...' : 'Clear Test Bookings'}
          </button>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <div className="adm-detail-search">
            <input
              type="text"
              placeholder="Search consultations..."
              className="adm-detail-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          {actionText ? <p className="adm-detail-info">{actionText}</p> : null}
          {errorText ? <p>{errorText}</p> : null}

          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Attorney</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Fee</th>
                <th>Rating</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsultations.map((cons) => (
                <tr key={cons.id} className="adm-detail-table__row--clickable">
                  <td>{cons.client?.full_name || 'Unknown Client'}</td>
                  <td>{cons.attorney?.full_name || 'Unknown Attorney'}</td>
                  <td>{cons.scheduled_at ? new Date(cons.scheduled_at).toLocaleDateString() : '-'}</td>
                  <td>{cons.duration_minutes ? `${cons.duration_minutes} mins` : '-'}</td>
                  <td><strong>{typeof cons.amount === 'number' ? `PHP ${cons.amount.toLocaleString()}` : 'PHP 0'}</strong></td>
                  <td><span className="adm-detail-rating">Completed</span></td>
                  <td><button className="adm-detail-row-btn" onClick={() => setSelectedTranscript(cons)}>View Notes</button></td>
                </tr>
              ))}
              {!loading && filteredConsultations.length === 0 ? (
                <tr>
                  <td colSpan="7">No completed consultations found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>

      {selectedTranscript && (
        <div className="adm-detail-modal-overlay" onClick={() => setSelectedTranscript(null)}>
          <div className="adm-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-detail-modal__header">
              <h2>Consultation Transcript</h2>
              <button className="adm-detail-modal__close" onClick={() => setSelectedTranscript(null)}>x</button>
            </div>
            <div className="adm-detail-modal__content">
              <div className="adm-detail-modal__row">
                <label>Client:</label>
                <p>{selectedTranscript.client?.full_name || 'Unknown Client'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Attorney:</label>
                <p>{selectedTranscript.attorney?.full_name || 'Unknown Attorney'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Date:</label>
                <p>{selectedTranscript.scheduled_at ? new Date(selectedTranscript.scheduled_at).toLocaleDateString() : '-'}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Consultation Notes:</label>
                <p>{selectedTranscript.notes || 'No notes saved for this consultation.'}</p>
              </div>
            </div>
            <div className="adm-detail-modal__actions">
              <button className="adm-detail-modal__btn adm-detail-modal__btn--close" onClick={() => setSelectedTranscript(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminConsultations;
