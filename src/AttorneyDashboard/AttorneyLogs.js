import { useEffect, useMemo, useState } from 'react';
import './AttorneyLogs.css';
import './AttorneyTheme.css';
import {
  fetchAttorneyConsultationLogs,
  fetchConsultationTranscriptForAppointment,
  getSignedUrlForAppointmentMessage,
} from '../lib/userApi';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const ScheduleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const mapTranscriptMessage = (item) => ({
  id: item.id,
  senderName: item.senderName || (item.isMine ? 'You' : 'Client'),
  text: String(item.text || ''),
  time: item.time || 'Now',
  createdAt: item.createdAt || new Date().toISOString(),
  messageType: item.messageType || 'text',
  fileBucket: item.fileBucket || null,
  filePath: item.filePath || null,
  fileName: item.fileName || null,
});

export default function AttorneyLogs({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [activeLog, setActiveLog] = useState(null);
  const [transcriptMessages, setTranscriptMessages] = useState([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [signedUrlsByMessageId, setSignedUrlsByMessageId] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadLogs = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyConsultationLogs(profile.id, { force: true });
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
  }, [profile?.id]);

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

  const sidebarItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Logs', icon: <LogsIcon />, nav: null },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile', icon: <ProfileIcon />, nav: 'attorney-profile' },
  ];

  const openTranscript = async (logItem) => {
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

  const closeTranscript = () => {
    setActiveLog(null);
    setTranscriptMessages([]);
    setSignedUrlsByMessageId({});
  };

  const transcriptHeader = useMemo(() => {
    if (!activeLog) return '';
    return `${activeLog.clientName} - ${activeLog.dateLabel} ${activeLog.timeLabel}`;
  }, [activeLog]);

  return (
    <div className="al-page">
      {sidebarOpen && <div className="al-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`al-sidebar ${sidebarOpen ? 'al-sidebar--open' : ''}`}>
        <div className="al-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="al-sidebar__nav">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              className={`al-sidebar__item ${item.label === 'Logs' ? 'al-sidebar__item--active' : ''}`}
              onClick={() => {
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="al-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="al-topbar">
        <div className="al-topbar__left">
          <button className="al-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="al-topbar__logo">
            <span>Logs</span>
          </div>
        </div>
        <div className="al-topbar__right">
          <span className="al-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
          <div className="al-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      <main className="al-main">
        <div className="al-header">
          <h1>Consultation Logs</h1>
          <p>Completed consultations are archived here for backreading transcripts.</p>
        </div>

        {loadError ? <p className="al-error">{loadError}</p> : null}

        <div className="al-list">
          {logs.length ? (
            logs.map((item) => (
              <div className="al-item" key={item.id}>
                <div className="al-item__meta">
                  <h3>{item.clientName}</h3>
                  <p>{item.title}</p>
                  <span>{item.dateLabel} • {item.timeLabel}</span>
                </div>
                <button className="al-view-btn" onClick={() => openTranscript(item)}>
                  View Transcript
                </button>
              </div>
            ))
          ) : (
            <div className="al-empty">No completed consultations yet.</div>
          )}
        </div>
      </main>

      {activeLog ? (
        <div className="al-modal-overlay" onClick={closeTranscript}>
          <div className="al-modal" onClick={(event) => event.stopPropagation()}>
            <div className="al-modal__header">
              <h2>Transcript</h2>
              <span>{transcriptHeader}</span>
              <button className="al-close-btn" onClick={closeTranscript}>Close</button>
            </div>

            <div className="al-transcript">
              {transcriptLoading ? <p>Loading transcript...</p> : null}
              {!transcriptLoading && !transcriptMessages.length ? <p>No messages found for this session.</p> : null}
              {transcriptMessages.map((msg) => {
                const signedUrl = signedUrlsByMessageId[msg.id];
                const hasResolved = Object.prototype.hasOwnProperty.call(signedUrlsByMessageId, msg.id);
                return (
                  <div className="al-msg" key={msg.id}>
                    <div className="al-msg__head">
                      <strong>{msg.senderName || 'Participant'}</strong>
                      <span>{msg.time}</span>
                    </div>
                    {msg.messageType === 'image' ? (
                      hasResolved ? (
                        signedUrl ? <img src={signedUrl} alt={msg.fileName || 'Image'} className="al-msg__image" /> : <p>Unable to load image.</p>
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
