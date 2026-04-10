import { useEffect, useRef, useState } from 'react';
import './ClientLogs.css';
import {
  fetchClientConsultationLogs,
  fetchConsultationTranscriptForAppointment,
  getSignedUrlForAppointmentMessage,
} from '../lib/userApi';

const renderStars = (rating) => {
  const safe = Math.max(0, Math.min(5, Number(rating || 0)));
  return '★★★★★'.slice(0, safe) + '☆☆☆☆☆'.slice(0, 5 - safe);
};

const mapTranscriptMessage = (item) => ({
  id: item.id,
  senderName: item.senderName || (item.isMine ? 'You' : 'Attorney'),
  text: String(item.text || ''),
  time: item.time || 'Now',
  messageType: item.messageType || 'text',
  fileBucket: item.fileBucket || null,
  filePath: item.filePath || null,
  fileName: item.fileName || null,
});

export default function ClientLogs({ profile, initialAppointmentId = '' }) {
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [activeLog, setActiveLog] = useState(null);
  const [transcriptMessages, setTranscriptMessages] = useState([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [signedUrlsByMessageId, setSignedUrlsByMessageId] = useState({});
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

  useEffect(() => {
    let cancelled = false;

    const unresolved = transcriptMessages.filter(
      (msg) =>
        (msg.messageType === 'image' || msg.messageType === 'file') &&
        msg.fileBucket &&
        msg.filePath &&
        !Object.prototype.hasOwnProperty.call(signedUrlsByMessageId, msg.id),
    );

    if (!unresolved.length) {
      return () => {
        cancelled = true;
      };
    }

    unresolved.forEach((msg) => {
      getSignedUrlForAppointmentMessage({ fileBucket: msg.fileBucket, filePath: msg.filePath })
        .then((url) => {
          if (cancelled) return;
          setSignedUrlsByMessageId((prev) => ({ ...prev, [msg.id]: url || '' }));
        })
        .catch(() => {
          if (cancelled) return;
          setSignedUrlsByMessageId((prev) => ({ ...prev, [msg.id]: '' }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [transcriptMessages, signedUrlsByMessageId]);

  const openTranscript = async (logItem) => {
    lastOpenedAppointmentRef.current = String(logItem?.id || '');
    setActiveLog(logItem);
    setTranscriptLoading(true);
    setTranscriptMessages([]);
    setSignedUrlsByMessageId({});

    try {
      const response = await fetchConsultationTranscriptForAppointment(logItem.id);
      setTranscriptMessages((response.messages || []).map(mapTranscriptMessage));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load transcript.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  return (
    <div className="clogs-page">
      <div className="clogs-header">
        <h1>Consultation Logs</h1>
        <p>Completed consultations, your ratings, and full conversation transcripts.</p>
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

              <button className="clogs-transcript-btn" onClick={() => openTranscript(item)}>
                View Transcript
              </button>
            </article>
          ))
        ) : (
          <div className="clogs-empty">No completed consultations yet.</div>
        )}
      </div>

      {activeLog ? (
        <div className="clogs-modal-overlay" onClick={() => setActiveLog(null)}>
          <div className="clogs-modal" onClick={(event) => event.stopPropagation()}>
            <div className="clogs-modal__header">
              <h2>Transcript</h2>
              <span>{activeLog.attorneyName} • {activeLog.dateLabel} {activeLog.timeLabel}</span>
              <button className="clogs-close-btn" onClick={() => setActiveLog(null)}>Close</button>
            </div>

            <div className="clogs-transcript">
              {transcriptLoading ? <p>Loading transcript...</p> : null}
              {!transcriptLoading && !transcriptMessages.length ? <p>No transcript messages found.</p> : null}
              {transcriptMessages.map((msg) => {
                const signedUrl = signedUrlsByMessageId[msg.id];
                const hasResolved = Object.prototype.hasOwnProperty.call(signedUrlsByMessageId, msg.id);
                return (
                  <div className="clogs-msg" key={msg.id}>
                    <div className="clogs-msg__head">
                      <strong>{msg.senderName}</strong>
                      <span>{msg.time}</span>
                    </div>

                    {msg.messageType === 'image' ? (
                      hasResolved ? (
                        signedUrl ? <img src={signedUrl} alt={msg.fileName || 'Image'} className="clogs-msg__image" /> : <p>Unable to load image.</p>
                      ) : (
                        <p>Loading image...</p>
                      )
                    ) : null}

                    {msg.messageType === 'file' ? (
                      hasResolved ? (
                        signedUrl ? (
                          <a href={signedUrl} target="_blank" rel="noreferrer">{msg.fileName || 'Open file'}</a>
                        ) : (
                          <p>Unable to load file.</p>
                        )
                      ) : (
                        <p>Loading file...</p>
                      )
                    ) : null}

                    {msg.text ? <p>{msg.text}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
