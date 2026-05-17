import { useCallback, useEffect, useState } from 'react';
import {
  acceptClientRescheduleRequest,
  fetchPendingRescheduleRequestsForAdmin,
  rejectClientRescheduleRequest,
  subscribeToAdminNotifications,
} from '../lib/userApi';
import { supabase } from '../lib/supabaseClient';
import './AdminRescheduleRequests.css';

const formatAttorneyLabel = (name) => {
  const trimmed = String(name || 'Attorney').trim();
  return /^atty\.?/i.test(trimmed) ? trimmed : `Atty. ${trimmed}`;
};

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
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineNote, setDeclineNote] = useState('');
  const [declineNoteError, setDeclineNoteError] = useState('');

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

  const closeDeclineModal = () => {
    if (busyId) return;
    setDeclineTarget(null);
    setDeclineNote('');
    setDeclineNoteError('');
  };

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

  const handleReject = async () => {
    if (!declineTarget?.id || busyId) return;

    const note = declineNote.trim();
    if (!note) {
      setDeclineNoteError('Please tell the client why this reschedule was declined.');
      return;
    }

    setBusyId(declineTarget.id);
    setErrorText('');
    setDeclineNoteError('');
    try {
      await rejectClientRescheduleRequest({
        appointmentId: declineTarget.id,
        adminNote: note,
      });
      closeDeclineModal();
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
    <>
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
                <p className="adm-resched-card__attorney">{formatAttorneyLabel(row.attorneyName)}</p>
                <div className="adm-resched-card__times">
                  <span>
                    <strong>Current:</strong> {formatWhen(row.currentScheduledAt)}
                  </span>
                  <span>
                    <strong>Requested:</strong> {formatWhen(row.requestedScheduledAt)}
                  </span>
                </div>
                {row.reason ? (
                  <p className="adm-resched-card__reason">
                    <strong>Client note:</strong> {row.reason}
                  </p>
                ) : null}
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
                    setDeclineTarget(row);
                    setDeclineNote('');
                    setDeclineNoteError('');
                  }}
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {declineTarget ? (
        <div
          className="adm-resched-modal-overlay"
          role="presentation"
          onClick={closeDeclineModal}
        >
          <div
            className="adm-resched-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-resched-decline-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="adm-resched-decline-title">Decline reschedule request</h4>
            <p className="adm-resched-modal__summary">
              <strong>{declineTarget.clientName}</strong> requested{' '}
              <strong>{formatWhen(declineTarget.requestedScheduledAt)}</strong> instead of{' '}
              <strong>{formatWhen(declineTarget.currentScheduledAt)}</strong>.
            </p>

            <label htmlFor="adm-resched-decline-note">Reason for declining (required)</label>
            <textarea
              id="adm-resched-decline-note"
              rows={4}
              value={declineNote}
              onChange={(e) => {
                setDeclineNote(e.target.value);
                if (declineNoteError) setDeclineNoteError('');
              }}
              placeholder="e.g. That slot is no longer available. Please pick another time."
              autoFocus
            />
            {declineNoteError ? <p className="adm-resched-modal__error">{declineNoteError}</p> : null}

            <div className="adm-resched-modal__actions">
              <button
                type="button"
                className="adm-resched-btn adm-resched-btn--ghost"
                disabled={Boolean(busyId)}
                onClick={closeDeclineModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-resched-btn adm-resched-btn--decline"
                disabled={busyId === declineTarget.id}
                onClick={handleReject}
              >
                {busyId === declineTarget.id ? 'Declining…' : 'Send decline to client'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
