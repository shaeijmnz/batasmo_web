import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { updateNotarialStatus, createNotification } from '../lib/adminApi';
import './AdminRequests.css';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const isImageUrl = (url) => /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(String(url || ''));

const normalizeStatus = (raw) => {
  const v = String(raw || '').toLowerCase();
  if (v === 'approved' || v === 'accepted' || v === 'in_process' || v === 'in-progress') return 'in_process';
  if (v === 'completed') return 'completed';
  if (v === 'cancelled' || v === 'rejected' || v === 'closed') return 'closed';
  return 'pending';
};

const statusLabel = (status) => {
  if (status === 'in_process') return 'In Process';
  if (status === 'completed') return 'Ready for Pickup';
  if (status === 'closed') return 'Closed';
  return 'New';
};

const statusBadgeClass = (status) => {
  if (status === 'in_process') return 'adm-detail-badge--in-progress';
  if (status === 'completed') return 'adm-detail-badge--active';
  if (status === 'closed') return 'adm-detail-badge--inactive';
  return 'adm-detail-badge--pending';
};

const formatDate = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const TABS = ['All', 'In Process', 'Ready for Pickup', 'Closed'];

const tabToStatus = {
  'In Process': 'in_process',
  'Ready for Pickup': 'completed',
  Closed: 'closed',
};

/** Maps admin UI status to Postgres request_status enum values. */
const toDbNotarialStatus = (uiStatus) => {
  const value = String(uiStatus || '').toLowerCase();
  if (value === 'in_process') return 'accepted';
  if (value === 'closed') return 'cancelled';
  if (value === 'completed') return 'completed';
  return value;
};

function AdminRequests({ onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewRequest, setViewRequest] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 3500);
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('notarial_requests')
        .select('id, client_id, service_type, status, preferred_date, created_at, updated_at, notes, document_url, client:client_id(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(
        (data || []).map((row) => ({
          id: row.id,
          clientId: row.client_id,
          clientName: row.client?.full_name || 'Client',
          serviceType: row.service_type || 'Notarial Service',
          status: normalizeStatus(row.status),
          preferredDate: formatDate(row.preferred_date),
          submittedDate: formatDate(row.created_at),
          notes: row.notes || '',
          documentUrl: row.document_url || '',
        })),
      );
      setErrorText('');
    } catch (err) {
      setErrorText(err.message || 'Failed to load notarial requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const safeLoad = async () => {
      if (!isMounted) return;
      await loadRequests();
    };

    safeLoad();

    const channel = supabase
      .channel('admin-notarial-requests-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notarial_requests' }, () => {
        if (isMounted) loadRequests();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const visibleRequests = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const byTab =
      activeTab === 'All'
        ? requests
        : requests.filter((r) => r.status === tabToStatus[activeTab]);

    if (!term) return byTab;
    return byTab.filter((r) =>
      [r.clientName, r.serviceType].some((v) =>
        String(v || '').toLowerCase().includes(term),
      ),
    );
  }, [requests, activeTab, searchText]);

  const counts = useMemo(() => ({
    in_process: requests.filter((r) => r.status === 'in_process').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    closed: requests.filter((r) => r.status === 'closed').length,
    total: requests.length,
  }), [requests]);

  const updateStatus = async (req, newStatus) => {
    if (isUpdating) return false;
    setIsUpdating(true);
    try {
      await updateNotarialStatus(req.id, toDbNotarialStatus(newStatus));

      const bodyMap = {
        in_process: `Your notarial request for "${req.serviceType}" is now being processed.`,
        completed: `Your notarized document for "${req.serviceType}" is ready for pick up.`,
        closed: `Your notarial request for "${req.serviceType}" has been closed.`,
      };

      if (req.clientId && bodyMap[newStatus]) {
        await createNotification({
          userId: req.clientId,
          title: 'Notarial Request Update',
          body: bodyMap[newStatus],
          type: 'notarial_update',
        });
      }

      setRequests((prev) =>
        prev.map((row) => (row.id === req.id ? { ...row, status: newStatus } : row)),
      );

      if (newStatus === 'in_process') {
        setActiveTab('In Process');
      } else if (newStatus === 'completed') {
        setActiveTab('Ready for Pickup');
      } else if (newStatus === 'closed') {
        setActiveTab('Closed');
      }

      await loadRequests();
      showToast(`Request marked as ${statusLabel(newStatus)}.`);
      return true;
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const openDocument = (req) => {
    if (!req.documentUrl) {
      showToast('No document uploaded for this request.', 'error');
      return;
    }
    window.open(req.documentUrl, '_blank', 'noopener,noreferrer');
  };

  const handleModalStatusUpdate = async (req, newStatus) => {
    const ok = await updateStatus(req, newStatus);
    if (ok) {
      setViewRequest(null);
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
          <span className="adm-detail-count">{loading ? '…' : requests.length}</span>
        </div>
      </header>

      <main className="adm-detail-main">
        {/* Stats row */}
        <div className="adm-nr-stats">
          {[
            { label: 'In Process', value: counts.in_process, color: '#3b82f6' },
            { label: 'Ready for Pickup', value: counts.completed, color: '#22c55e' },
            { label: 'Closed', value: counts.closed, color: '#64748b' },
            { label: 'Total', value: counts.total, color: '#1e3a8a' },
          ].map((s) => (
            <div key={s.label} className="adm-nr-stat-card">
              <span className="adm-nr-stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="adm-nr-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="adm-detail-card">
          {/* Search */}
          <div className="adm-detail-search">
            <input
              type="text"
              placeholder="Search by client or service..."
              className="adm-detail-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {/* Tabs */}
          <div className="adm-nr-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`adm-nr-tab${activeTab === tab ? ' adm-nr-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {errorText ? <p className="adm-nr-error">{errorText}</p> : null}

          <table className="adm-detail-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Preferred Date</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((req) => (
                <tr key={req.id} className="adm-detail-table__row--clickable">
                  <td>{req.clientName}</td>
                  <td>{req.serviceType}</td>
                  <td>{req.preferredDate}</td>
                  <td>{req.submittedDate}</td>
                  <td>
                    <span className={`adm-detail-badge ${statusBadgeClass(req.status)}`}>
                      {statusLabel(req.status)}
                    </span>
                  </td>
                  <td>
                    <div className="adm-detail-row-actions">
                      <button
                        className="adm-detail-row-btn adm-detail-row-btn--view"
                        onClick={() => setViewRequest(req)}
                      >
                        View
                      </button>
                      {req.status === 'pending' && (
                        <button
                          className="adm-detail-row-btn adm-nr-btn--process"
                          disabled={isUpdating}
                          onClick={() => updateStatus(req, 'in_process')}
                        >
                          In Process
                        </button>
                      )}
                      {req.status === 'in_process' && (
                        <button
                          className="adm-detail-row-btn adm-nr-btn--pickup"
                          disabled={isUpdating}
                          onClick={() => updateStatus(req, 'completed')}
                        >
                          Ready for Pickup
                        </button>
                      )}
                      {(req.status === 'pending' || req.status === 'in_process') && (
                        <button
                          className="adm-detail-row-btn adm-nr-btn--close"
                          disabled={isUpdating}
                          onClick={() => updateStatus(req, 'closed')}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                    No notarial requests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>

      {/* View / Detail Modal */}
      {viewRequest && (
        <div className="adm-detail-modal-overlay" onClick={() => setViewRequest(null)}>
          <div className="adm-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-detail-modal__header">
              <h2>Notarial Request Details</h2>
              <button className="adm-detail-modal__close" onClick={() => setViewRequest(null)}>×</button>
            </div>
            <div className="adm-detail-modal__content">
              <div className="adm-detail-modal__row">
                <label>Client</label>
                <p>{viewRequest.clientName}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Service Type</label>
                <p>{viewRequest.serviceType}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Status</label>
                <p>
                  <span className={`adm-detail-badge ${statusBadgeClass(viewRequest.status)}`}>
                    {statusLabel(viewRequest.status)}
                  </span>
                </p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Preferred Date</label>
                <p>{viewRequest.preferredDate}</p>
              </div>
              <div className="adm-detail-modal__row">
                <label>Submitted</label>
                <p>{viewRequest.submittedDate}</p>
              </div>
              {viewRequest.notes ? (
                <div className="adm-detail-modal__row">
                  <label>Notes</label>
                  <p>{viewRequest.notes}</p>
                </div>
              ) : null}
              {viewRequest.documentUrl ? (
                <div className="adm-detail-modal__row">
                  <label>Document</label>
                  <div className="adm-detail-files">
                    <div className="adm-detail-file-item">
                      <span className="adm-detail-file-name">
                        {isImageUrl(viewRequest.documentUrl)
                          ? 'Attached Image'
                          : viewRequest.documentUrl.split('/').pop() || 'Document'}
                      </span>
                      <button
                        className="adm-detail-file-open"
                        onClick={() => openDocument(viewRequest)}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="adm-detail-modal__row">
                  <label>Document</label>
                  <p style={{ color: '#9ca3af' }}>No document uploaded</p>
                </div>
              )}
            </div>
            <div className="adm-detail-modal__actions">
              <button
                type="button"
                className="adm-detail-modal__btn adm-detail-modal__btn--dismiss"
                disabled={isUpdating}
                onClick={() => setViewRequest(null)}
              >
                Close
              </button>
              {viewRequest.status === 'pending' && (
                <button
                  type="button"
                  className="adm-detail-modal__btn adm-detail-modal__btn--approve"
                  disabled={isUpdating}
                  onClick={() => handleModalStatusUpdate(viewRequest, 'in_process')}
                >
                  {isUpdating ? 'Updating…' : 'Mark In Process'}
                </button>
              )}
              {viewRequest.status === 'in_process' && (
                <button
                  type="button"
                  className="adm-detail-modal__btn adm-detail-modal__btn--pickup"
                  disabled={isUpdating}
                  onClick={() => handleModalStatusUpdate(viewRequest, 'completed')}
                >
                  {isUpdating ? 'Updating…' : 'Ready for Pickup'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast ? (
        <div className={`adm-nr-toast adm-nr-toast--${toast.type}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

export default AdminRequests;
