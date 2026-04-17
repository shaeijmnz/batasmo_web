import { useEffect, useRef, useState } from 'react';
import './ClientLogs.css';
import { fetchClientConsultationLogs, fetchConsultationTranscriptForAppointment } from '../lib/userApi';

const renderStars = (rating) => {
  const safe = Math.max(0, Math.min(5, Number(rating || 0)));
  return '★★★★★'.slice(0, safe) + '☆☆☆☆☆'.slice(0, 5 - safe);
};

export default function ClientLogs({ profile, initialAppointmentId = '' }) {
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [activeLog, setActiveLog] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [attorneySessionSummary, setAttorneySessionSummary] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const autoOpenedRef = useRef(false);
  const lastOpenedAppointmentRef = useRef('');

  useEffect(() => {
    autoOpenedRef.current = false;
    lastOpenedAppointmentRef.current = '';
  }, [initialAppointmentId]);

  useEffect(() => {
    let mounted = true;

    const loadLogs = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchClientConsultationLogs(profile.id);
        if (!mounted) return;
        setLogs(rows);
        setLoadError('');
      } catch (error) {
        if (!mounted) return;
        setLogs([]);
        setLoadError(error.message || 'Unable to load consultation logs.');
      }
    };

    loadLogs();

    return () => {
      mounted = false;
    };
  }, [profile?.id, retryTick]);

  useEffect(() => {
    if (!initialAppointmentId) return undefined;
    if (autoOpenedRef.current) return undefined;

    const targetId = String(initialAppointmentId);
    const match = logs.find((item) => String(item.id) === targetId);

    if (match) {
      autoOpenedRef.current = true;
      openTranscript(match);
      return undefined;
    }

    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      setRetryTick((value) => value + 1);
      if (attempts >= 6 || autoOpenedRef.current) {
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [initialAppointmentId, logs]);

  const closeModal = () => {
    setActiveLog(null);
    setAttorneySessionSummary('');
  };

  const openTranscript = async (logItem) => {
    lastOpenedAppointmentRef.current = String(logItem?.id || '');
    setActiveLog(logItem);
    setSummaryLoading(true);
    setAttorneySessionSummary('');

    try {
      const response = await fetchConsultationTranscriptForAppointment(logItem.id);
      setAttorneySessionSummary(response.attorneyConsultationSummary || '');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load session summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="clogs-page">
      <div className="clogs-header">
        <h1>Consultation Logs</h1>
        <p>Completed consultations, your ratings, and your attorney&apos;s session summary.</p>
      </div>

      {loadError ? <p className="clogs-error">{loadError}</p> : null}

      <div className="clogs-list">
        {logs.length ? (
          logs.map((item) => (
            <article
              className="clogs-item"
              key={item.id}
              style={
                String(item.id) === String(initialAppointmentId)
                  ? { borderColor: '#f5a623', boxShadow: '0 0 0 1px rgba(245, 166, 35, 0.22)' }
                  : undefined
              }
            >
              <div className="clogs-item__main">
                <h3>{item.attorneyName}</h3>
                <p>{item.title}</p>
                <span>{item.dateLabel} • {item.timeLabel}</span>
              </div>

              <div className="clogs-item__rating">
                <strong>Your Rating</strong>
                <div className={`clogs-stars ${item.rating > 0 ? 'is-rated' : ''}`}>
                  {item.rating > 0 ? renderStars(item.rating) : 'Not rated'}
                </div>
              </div>

              <button type="button" className="clogs-transcript-btn" onClick={() => openTranscript(item)}>
                View summary
              </button>
            </article>
          ))
        ) : (
          <div className="clogs-empty">No completed consultations yet.</div>
        )}
      </div>

      {activeLog ? (
        <div className="clogs-modal-overlay" onClick={closeModal}>
          <div className="clogs-modal clogs-modal--summary-only" onClick={(event) => event.stopPropagation()}>
            <div className="clogs-modal__header">
              <h2>Session summary</h2>
              <span className="clogs-modal__header-meta">{activeLog.attorneyName} • {activeLog.dateLabel} {activeLog.timeLabel}</span>
              <button type="button" className="clogs-close-btn" onClick={closeModal}>Close</button>
            </div>

            <div className="clogs-modal__body">
              {summaryLoading ? (
                <p className="clogs-summary-loading">Loading…</p>
              ) : attorneySessionSummary ? (
                <div className="clogs-attorney-summary clogs-attorney-summary--standalone">
                  <strong>From your attorney</strong>
                  <p>{attorneySessionSummary}</p>
                </div>
              ) : (
                <p className="clogs-summary-placeholder">
                  Your attorney hasn&apos;t added a session summary for this consultation yet. Check back later.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
