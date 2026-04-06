import { useEffect, useMemo, useState } from 'react';
import './AdminAttorneys.css';
import { fetchAttorneys, setAttorneyVerification } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminAttorneys({ onNavigate }) {
  const [attorneys, setAttorneys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAttorneys = async () => {
      try {
        const rows = await fetchAttorneys();
        if (isMounted) {
          setAttorneys(rows);
        }
      } catch (error) {
        if (isMounted) {
          setActionError(error.message || 'Failed to load attorney profiles.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAttorneys();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAttorneys = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return attorneys;

    return attorneys.filter((row) => {
      const name = row.profiles?.full_name || '';
      const email = row.profiles?.email || '';
      const specialties = Array.isArray(row.specialties) ? row.specialties.join(' ') : '';
      return (
        name.toLowerCase().includes(keyword)
        || email.toLowerCase().includes(keyword)
        || specialties.toLowerCase().includes(keyword)
      );
    });
  }, [attorneys, searchText]);

  const handleVerification = async (userId, isVerified) => {
    try {
      await setAttorneyVerification(userId, isVerified);
      setAttorneys((prev) => prev.map((row) => (
        row.user_id === userId ? { ...row, is_verified: isVerified } : row
      )));
      setActionError('');
    } catch (error) {
      setActionError(error.message || 'Unable to update verification status.');
    }
  };

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Total Attorneys</h1>
          <span className="adm-detail-count">{loading ? '...' : attorneys.length}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <div className="adm-detail-search">
            <input
              type="text"
              placeholder="Search attorneys..."
              className="adm-detail-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          {actionError ? <p>{actionError}</p> : null}

          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialty</th>
                <th>Experience</th>
                <th>Consultation Fee</th>
                <th>Verification</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttorneys.map((attorney) => (
                <tr key={attorney.id} className="adm-detail-table__row--clickable">
                  <td>{attorney.profiles?.full_name || 'Unnamed Attorney'}</td>
                  <td>{Array.isArray(attorney.specialties) && attorney.specialties.length > 0 ? attorney.specialties.join(', ') : 'General Practice'}</td>
                  <td>{attorney.years_experience ? `${attorney.years_experience} years` : '-'}</td>
                  <td><strong>{typeof attorney.consultation_fee === 'number' ? `PHP ${attorney.consultation_fee.toLocaleString()}` : 'PHP 0'}</strong></td>
                  <td>
                    <span className={`adm-detail-badge adm-detail-badge--${attorney.is_verified ? 'active' : 'pending'}`}>
                      {attorney.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    {attorney.is_verified ? (
                      <button className="adm-detail-row-btn" onClick={() => handleVerification(attorney.user_id, false)}>Unverify</button>
                    ) : (
                      <button className="adm-detail-row-btn" onClick={() => handleVerification(attorney.user_id, true)}>Verify</button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filteredAttorneys.length === 0 ? (
                <tr>
                  <td colSpan="6">No attorney records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminAttorneys;
