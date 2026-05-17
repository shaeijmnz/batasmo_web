import { useCallback, useEffect, useState } from 'react';
import {
  acceptClientRescheduleRequest,
  fetchPendingRescheduleRequestsForAdmin,
  rejectClientRescheduleRequest,
  subscribeToAdminNotifications,
} from '../lib/userApi';
import { supabase } from '../lib/supabaseClient';
import './AdminRescheduleRequests.css';

const formatWhen = (iso) => {
  if (!iso) return 'TBD';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function AdminRescheduleRequests({ adminUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const loadRows = useCallback(async () => {
    try {
      const pending = await fetchPendingRescheduleRequestsForAdmin();
      setRows(pending);
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Unable to load reschedule requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();

    const appointmentsChannel = supabase
      .channel('admin-reschedule-requests-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadRows();
      })
      .subscribe();

    const unsubNotif = adminUserId
      ? subscribeToAdminNotifications(adminUserId, loadRows)
      : () => {};

    return () => {
      supabase.removeChannel(appointmentsChannel);
      unsubNotif();
    };
  }, [adminUserId, loadRows]);

  const handleAccept = async (row) => {
    if (!row?.id || busyId) return;
    setBusyId(row.id);
    setErrorText('');
    try {
      await acceptClientRescheduleRequest({ appointmentId: row.id });
      await loadRows();
    } catch (error) {
      setErrorText(error.message || 'Could not accept reschedule.');
    } finally {
      setBusyId('');
    }
  };

  const handleReject = async (row) => {
    if (!row?.id || busyId) return;
    setBusyId(row.id);
    setErrorText('');
    try {
      await rejectClientRescheduleRequest({ appointmentId: row.id, adminNote: rejectNote });
      setRejectingId('');
      setRejectNote('');
      await loadRows();
    } catch (error) {
      setErrorText(error.message || 'Could not decline reschedule.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <section className="adm-resched-section">
        <p className="adm-resched-muted">Loading reschedule requests…</p>
      </section>
    );
  }

  if (!rows.length) {
    return null;
  }

  return (
    <section className="adm-resched-section" aria-label="Pending reschedule requests">
      <div className="adm-resched-section__header">
        <div>
          <h3>Reschedule requests</h3>
          <p>Clients chose a new date and time. Accept to update the consultation queue.</p>
        </div>
        <span className="adm-resched-count">{rows.length}</span>
      </div>

      {errorText ? <p className="adm-resched-error">{errorText}</p> : null}

      <div className="adm-resched-list">
        {rows.map((row) => (
          <article key={row.id} className="adm-resched-card">
            <div className="adm-resched-card__main">
              <p className="adm-resched-card__client">{row.clientName}</p>
              <p className="adm-resched-card__title">{row.title}</p>
              <p className="adm-resched-card__attorney">Atty. {row.attorneyName}</p>
              <div className="adm-resched-card__times">
                <span>
                  <strong>Current:</strong> {formatWhen(row.currentScheduledAt)}
                </span>
                <span>
                  <strong>Requested:</strong> {formatWhen(row.requestedScheduledAt)}
                </span>
              </div>
              {row.reason ? <p className="adm-resched-card__reason">“{row.reason}”</p> : null}
            </div>

            <div className="adm-resched-card__actions">
              <button
                type="button"
                className="adm-resched-btn adm-resched-btn--accept"
                disabled={Boolean(busyId)}
                onClick={() => handleAccept(row)}
              >
                {busyId === row.id ? 'Accepting…' : 'Accept'}
              </button>
              <button
                type="button"
                className="adm-resched-btn adm-resched-btn--decline"
                disabled={Boolean(busyId)}
                onClick={() => {
                  setRejectingId(row.id);
                  setRejectNote('');
                }}
              >
                Decline
              </button>
            </div>

            {rejectingId === row.id ? (
              <div className="adm-resched-reject">
                <label htmlFor={`reject-note-${row.id}`}>Optional note to client</label>
                <textarea
                  id={`reject-note-${row.id}`}
                  rows={2}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason for declining (optional)"
                />
                <div className="adm-resched-reject__actions">
                  <button type="button" className="adm-resched-btn adm-resched-btn--ghost" onClick={() => setRejectingId('')}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="adm-resched-btn adm-resched-btn--decline"
                    disabled={busyId === row.id}
                    onClick={() => handleReject(row)}
                  >
                    Confirm decline
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
