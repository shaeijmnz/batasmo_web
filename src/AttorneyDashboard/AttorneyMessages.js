import { useState, useRef, useEffect } from 'react';
import './AttorneyMessages.css';
import './AttorneyTheme.css';
import {
  deleteAppointmentMessage,
  endConsultationSession,
  fetchAppointmentMessages,
  fetchAttorneyUpcomingAppointments,
  getSignedUrlForAppointmentMessage,
  isConsultationChatWindowOpen,
  notifyClientConsultationTimeWarning,
  sendAppointmentAttachment,
  sendAppointmentMessage,
  subscribeToAttorneyAppointments,
  subscribeToAppointmentMessages,
} from '../lib/userApi';

const CONSULTATION_TIMER_TOTAL_SECONDS = 60 * 60;

const formatTimerLabel = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/* ── Icons ── */
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
const MessagesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
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
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

export default function AttorneyMessages({ onNavigate, profile, initialAppointmentId = '' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [activeAppointmentId, setActiveAppointmentId] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sending, setSending] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [endSessionConfirmOpen, setEndSessionConfirmOpen] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [signedUrlsByMessageId, setSignedUrlsByMessageId] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(CONSULTATION_TIMER_TOTAL_SECONDS);
  const messagesEndRef = useRef(null);
  const imagePickerRef = useRef(null);
  const filePickerRef = useRef(null);
  const timerStartedAtByAppointmentRef = useRef({});
  const tenMinuteReminderSentByAppointmentRef = useRef({});

  const mergeRealtimeMessage = (incoming) => {
    setMessages((previous) => {
      const existingById = new Map(previous.map((item) => [item.id, item]));
      existingById.set(incoming.id, incoming);
      return Array.from(existingById.values()).sort((a, b) =>
        String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
      );
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    console.log('[lifecycle] AttorneyMessages mounted', { userId: profile?.id || null })
    return () => {
      console.log('[lifecycle] AttorneyMessages unmounted', { userId: profile?.id || null })
    }
  }, [profile?.id])

  useEffect(() => {
    setAppointments([])
    setMessages([])
    setActiveAppointmentId('')
    setIsClosed(false)
    setLoadError('')
    setSignedUrlsByMessageId({})
  }, [profile?.id])

  useEffect(() => {
    let isMounted = true;

    const loadAppointments = async (options = {}) => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyUpcomingAppointments(profile.id, options);
        if (!isMounted) return;

        const activeRows = rows.filter((row) =>
          isConsultationChatWindowOpen({
            status: row.status,
            scheduledAt: row.scheduledAt,
            slotDate: row.slotDate,
            slotTime: row.slotTime,
          }),
        );
        setAppointments(activeRows);
        setActiveAppointmentId((prev) => {
          if (!activeRows.length) return ''
          if (initialAppointmentId && activeRows.some((row) => String(row.id) === String(initialAppointmentId))) {
            return String(initialAppointmentId)
          }
          if (prev && activeRows.some((row) => String(row.id) === String(prev))) return prev
          return String(activeRows[0].id)
        })

        if (!activeRows.length) {
          setLoadError('Consultation chat opens at the scheduled appointment time.');
        } else {
          setLoadError('');
        }
      } catch (error) {
        if (!isMounted) return;
        setAppointments([]);
        setLoadError(error.message || 'Unable to load consultation threads.');
      }
    };

    loadAppointments({ force: true });

    const unsubscribe = subscribeToAttorneyAppointments(profile?.id, () => {
      loadAppointments({ force: true });
    });

    const refreshId = window.setInterval(() => {
      loadAppointments({ force: true });
    }, 30000);

    return () => {
      isMounted = false;
      unsubscribe();
      window.clearInterval(refreshId);
    };
  }, [profile?.id, initialAppointmentId]);

  useEffect(() => {
    if (!initialAppointmentId || !appointments.length) return;
    if (appointments.some((item) => String(item.id) === String(initialAppointmentId))) {
      setActiveAppointmentId(String(initialAppointmentId));
    }
  }, [initialAppointmentId, appointments]);

  useEffect(() => {
    let cancelled = false;

    const messagesToResolve = messages.filter(
      (item) =>
        (item.messageType === 'image' || item.messageType === 'file') &&
        item.fileBucket &&
        item.filePath &&
        !Object.prototype.hasOwnProperty.call(signedUrlsByMessageId, item.id),
    );

    if (!messagesToResolve.length) {
      return () => {
        cancelled = true;
      };
    }

    messagesToResolve.forEach((item) => {
      getSignedUrlForAppointmentMessage({
        fileBucket: item.fileBucket,
        filePath: item.filePath,
      })
        .then((signedUrl) => {
          if (cancelled) return;
          setSignedUrlsByMessageId((previous) => ({
            ...previous,
            [item.id]: signedUrl || '',
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setSignedUrlsByMessageId((previous) => ({
            ...previous,
            [item.id]: '',
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [messages, signedUrlsByMessageId]);

  useEffect(() => {
    if (!profile?.id || !activeAppointmentId) {
      setMessages([]);
      setIsClosed(false);
      return undefined;
    }

    let isMounted = true;
    const currentAppointmentId = activeAppointmentId;
    const loadMessages = async () => {
      try {
        const { messages: rows, isClosed: closed } = await fetchAppointmentMessages(currentAppointmentId);
        if (!isMounted) return;
        const mapped = rows.map((item) => ({
          id: item.id,
          sender: item.isMine ? 'attorney' : 'client',
          text: item.text,
          time: item.time,
          createdAt: item.createdAt,
          messageType: item.messageType || 'text',
          fileBucket: item.fileBucket || null,
          filePath: item.filePath || null,
          fileName: item.fileName || null,
          mimeType: item.mimeType || null,
          fileSizeBytes: item.fileSizeBytes || null,
          date: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Today',
        }));
        setMessages(mapped);
        setIsClosed(closed);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error.message || 'Unable to load messages.');
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [profile?.id, activeAppointmentId]);

  useEffect(() => {
    if (!activeAppointmentId) return undefined;

    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      try {
        const stop = await subscribeToAppointmentMessages(activeAppointmentId, (item) => {
          const mapped = {
            id: item.id,
            sender: item.isMine ? 'attorney' : 'client',
            text: item.text,
            time: item.time,
            createdAt: item.createdAt,
            messageType: item.messageType || 'text',
            fileBucket: item.fileBucket || null,
            filePath: item.filePath || null,
            fileName: item.fileName || null,
            mimeType: item.mimeType || null,
            fileSizeBytes: item.fileSizeBytes || null,
            date: item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Today',
          };

          mergeRealtimeMessage(mapped);
          setIsClosed(Boolean(item.isClosed));
        });

        if (!cancelled) {
          unsubscribe = stop;
        } else {
          stop();
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || 'Unable to subscribe to live messages.');
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeAppointmentId]);

  useEffect(() => {
    if (!activeAppointmentId || isClosed) {
      setRemainingSeconds(CONSULTATION_TIMER_TOTAL_SECONDS);
      return undefined;
    }

    const appointmentKey = String(activeAppointmentId);
    if (!timerStartedAtByAppointmentRef.current[appointmentKey]) {
      timerStartedAtByAppointmentRef.current[appointmentKey] = Date.now();
    }

    let timerCancelled = false;

    const notifyTenMinuteWarning = async () => {
      try {
        await notifyClientConsultationTimeWarning(appointmentKey);
      } catch (error) {
        if (!timerCancelled) {
          console.warn('[chat-timer] failed to send client ten-minute warning', error);
        }
      }
    };

    const tick = () => {
      const startedAt = timerStartedAtByAppointmentRef.current[appointmentKey] || Date.now();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const nextRemaining = Math.max(0, CONSULTATION_TIMER_TOTAL_SECONDS - elapsedSeconds);
      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 10 * 60 && !tenMinuteReminderSentByAppointmentRef.current[appointmentKey]) {
        tenMinuteReminderSentByAppointmentRef.current[appointmentKey] = true;
        notifyTenMinuteWarning();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      timerCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeAppointmentId, isClosed]);

  useEffect(() => {
    if (!activeAppointmentId) return undefined;

    let cancelled = false;

    const refreshMessages = async () => {
      try {
        const { messages: rows, isClosed: closed } = await fetchAppointmentMessages(activeAppointmentId);
        if (cancelled) return;

        const mapped = rows.map((item) => ({
          id: item.id,
          sender: item.isMine ? 'attorney' : 'client',
          text: item.text,
          time: item.time,
          createdAt: item.createdAt,
          messageType: item.messageType || 'text',
          fileBucket: item.fileBucket || null,
          filePath: item.filePath || null,
          fileName: item.fileName || null,
          mimeType: item.mimeType || null,
          fileSizeBytes: item.fileSizeBytes || null,
          date: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Today',
        }));

        setMessages((previous) => {
          const existingById = new Map(previous.map((entry) => [entry.id, entry]));
          mapped.forEach((entry) => {
            existingById.set(entry.id, entry);
          });
          return Array.from(existingById.values()).sort((a, b) =>
            String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
          );
        });
        setIsClosed(Boolean(closed));
      } catch {
        // Preserve current state when background refresh fails.
      }
    };

    const pollId = window.setInterval(() => {
      refreshMessages();
    }, 3000);

    const handleWindowFocus = () => {
      refreshMessages();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshMessages();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeAppointmentId]);

  const handleSend = async () => {
    if (!input.trim() || !activeAppointmentId || isClosed || sending) return;

    try {
      setSending(true);
      await sendAppointmentMessage(activeAppointmentId, input.trim());
      setInput('');
      const { messages: rows, isClosed: closed } = await fetchAppointmentMessages(activeAppointmentId);
      const mapped = rows.map((item) => ({
        id: item.id,
        sender: item.isMine ? 'attorney' : 'client',
        text: item.text,
        time: item.time,
        createdAt: item.createdAt,
        messageType: item.messageType || 'text',
        fileBucket: item.fileBucket || null,
        filePath: item.filePath || null,
        fileName: item.fileName || null,
        mimeType: item.mimeType || null,
        fileSizeBytes: item.fileSizeBytes || null,
        date: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Today',
      }));
      setMessages(mapped);
      setIsClosed(closed);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentUpload = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile || !activeAppointmentId || isClosed || sending) return;

    try {
      setSending(true);
      const sent = await sendAppointmentAttachment(activeAppointmentId, selectedFile, input);
      const mapped = {
        id: sent.id,
        sender: sent.isMine ? 'attorney' : 'client',
        text: sent.text,
        time: sent.time,
        createdAt: sent.createdAt,
        messageType: sent.messageType || 'text',
        fileBucket: sent.fileBucket || null,
        filePath: sent.filePath || null,
        fileName: sent.fileName || null,
        mimeType: sent.mimeType || null,
        fileSizeBytes: sent.fileSizeBytes || null,
        date: sent.createdAt
          ? new Date(sent.createdAt).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Today',
      };

      mergeRealtimeMessage(mapped);
      setInput('');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to upload attachment.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeAppointmentId || !messageId || deletingMessageId) return;
    const shouldDelete = window.confirm('Delete this message/photo?');
    if (!shouldDelete) return;

    try {
      setDeletingMessageId(String(messageId));
      await deleteAppointmentMessage({ appointmentId: activeAppointmentId, messageId });
      setMessages((previous) => previous.filter((item) => String(item.id) !== String(messageId)));
      setSignedUrlsByMessageId((previous) => {
        const next = { ...previous };
        delete next[messageId];
        delete next[String(messageId)];
        return next;
      });
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Failed to delete message.');
    } finally {
      setDeletingMessageId('');
    }
  };

  const handleEndSession = async () => {
    if (!activeAppointmentId || isClosed || endingSession) return;

    try {
      setEndingSession(true);
      setEndSessionConfirmOpen(false);
      await endConsultationSession(activeAppointmentId);
      setIsClosed(true);
      setLoadError('');
      onNavigate('attorney-logs', { appointmentId: activeAppointmentId });
    } catch (error) {
      setLoadError(error.message || 'Failed to end consultation session.');
    } finally {
      setEndingSession(false);
    }
  };

  const openEndSessionConfirm = () => {
    if (!activeAppointmentId || isClosed || endingSession) return;
    setEndSessionConfirmOpen(true);
  };

  const renderMessageBody = (msg, isAttorney) => {
    const hasResolvedUrl = Object.prototype.hasOwnProperty.call(signedUrlsByMessageId, msg.id);
    const signedUrl = signedUrlsByMessageId[msg.id];

    if (msg.messageType === 'image') {
      return (
        <>
          {!hasResolvedUrl ? (
            <p className="am-bubble__attachment-error">Loading image...</p>
          ) : signedUrl ? (
            <img
              src={signedUrl}
              alt={msg.fileName || 'Shared image'}
              className="am-bubble__image"
              loading="lazy"
            />
          ) : (
            <p className="am-bubble__attachment-error">Unable to load image.</p>
          )}
          {msg.text && msg.text !== 'Photo' ? <p className="am-bubble__text">{msg.text}</p> : null}
        </>
      );
    }

    if (msg.messageType === 'file') {
      return (
        <>
          {!hasResolvedUrl ? (
            <p className="am-bubble__attachment-error">Loading file...</p>
          ) : signedUrl ? (
            <a
              className={`am-bubble__file-link ${isAttorney ? 'am-bubble__file-link--attorney' : ''}`}
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
            >
              {msg.fileName ? `📎 ${msg.fileName}` : '📎 Open file'}
            </a>
          ) : (
            <p className="am-bubble__attachment-error">Unable to open file.</p>
          )}
          {msg.text && msg.text !== 'Attachment' ? <p className="am-bubble__text">{msg.text}</p> : null}
        </>
      );
    }

    return <p className="am-bubble__text">{msg.text}</p>;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sidebarItems = [
    { label: 'Dashboard',    icon: <DashboardIcon />,    nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Logs',         icon: <LogsIcon />,         nav: 'attorney-logs' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile',      icon: <ProfileIcon />,      nav: 'attorney-profile' },
  ];

  const activeAppointment = appointments.find((item) => String(item.id) === String(activeAppointmentId)) || null;
  const chatName = activeAppointment?.name || 'Client';
  const chatInitials = chatName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const timerLabel = formatTimerLabel(remainingSeconds);
  const isTenMinuteWindow = remainingSeconds <= 10 * 60;

  return (
    <div className="am-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="am-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`am-sidebar ${sidebarOpen ? 'am-sidebar--open' : ''}`}>
        <div className="am-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="am-sidebar__nav">
          {sidebarItems.map(item => (
            <button
              key={item.label}
              className={`am-sidebar__item ${item.label === 'Consultation Management' ? 'am-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="am-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="am-topbar">
        <div className="am-topbar__left">
          <button className="am-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="am-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="am-topbar__right">
          <div className="am-topbar__user">
            <span className="am-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
          </div>
          <div className="am-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      {/* Chat Container */}
      <div className="am-chat-container">
        {/* Chat Header */}
        <div className="am-chat-header">
          <div className="am-chat-header__avatar">
            <span>{chatInitials || 'CL'}</span>
          </div>
          <div className="am-chat-header__info">
            <span className="am-chat-header__name">{chatName}</span>
            <span className="am-chat-header__status">
              <span className="am-online-dot"></span>
              {isClosed ? 'Consultation Closed' : 'Online'}
            </span>
          </div>
          {activeAppointmentId && !isClosed ? (
            <div className={`am-timer-chip ${isTenMinuteWindow ? 'am-timer-chip--warning' : ''}`}>
              <span className="am-timer-chip__label">Session Timer</span>
              <span className="am-timer-chip__value">{timerLabel}</span>
            </div>
          ) : null}
        </div>

        {activeAppointmentId && !isClosed ? (
          <div className="am-chat-actions">
            <button
              type="button"
              className="am-end-session-btn am-end-session-btn--top"
              onClick={openEndSessionConfirm}
              disabled={endingSession}
            >
              {endingSession ? 'Ending...' : 'End Session'}
            </button>
          </div>
        ) : null}

        {/* Messages */}
        <div className="am-messages">
          {loadError ? <p>{loadError}</p> : null}
          {!activeAppointmentId ? <p>No active consultation threads yet.</p> : null}
          {messages.map((msg, idx) => {
            const showDate = idx === 0 || messages[idx - 1].date !== msg.date;
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="am-date-divider">
                    <span>{msg.date}</span>
                  </div>
                )}
                <div className={`am-bubble-row ${msg.sender === 'attorney' ? 'am-bubble-row--right' : 'am-bubble-row--left'}`}>
                  {msg.sender === 'client' && (
                    <div className="am-bubble-avatar am-bubble-avatar--admin">{chatInitials || 'CL'}</div>
                  )}
                  <div className={`am-bubble ${msg.sender === 'attorney' ? 'am-bubble--attorney' : 'am-bubble--admin'}`}>
                    {renderMessageBody(msg, msg.sender === 'attorney')}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="am-bubble__time">{msg.time}</span>
                      {msg.sender === 'attorney' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={deletingMessageId === String(msg.id)}
                          style={{
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 8,
                            padding: '2px 8px',
                          }}
                        >
                          {deletingMessageId === String(msg.id) ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="am-input-bar">
          <div className="am-attach-actions">
            <button
              type="button"
              className="am-attach-btn"
              onClick={() => imagePickerRef.current?.click()}
              disabled={isClosed || !activeAppointmentId || sending}
            >
              Photo
            </button>
            <button
              type="button"
              className="am-attach-btn"
              onClick={() => filePickerRef.current?.click()}
              disabled={isClosed || !activeAppointmentId || sending}
            >
              File
            </button>
            <input
              ref={imagePickerRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="am-hidden-file-input"
              onChange={handleAttachmentUpload}
            />
            <input
              ref={filePickerRef}
              type="file"
              accept="application/pdf,.doc,.docx,text/plain,.txt"
              className="am-hidden-file-input"
              onChange={handleAttachmentUpload}
            />
          </div>
          <textarea
            className="am-input-bar__textarea"
            rows="1"
            placeholder={isClosed ? 'Consultation closed' : 'Type a message...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isClosed || !activeAppointmentId || sending}
          />
          <button
            className="am-input-bar__send"
            onClick={handleSend}
            disabled={!input.trim() || isClosed || !activeAppointmentId || sending}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {endSessionConfirmOpen ? (
        <div className="am-confirm-overlay" onClick={() => setEndSessionConfirmOpen(false)}>
          <div className="am-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h3>End Consultation Session?</h3>
            <p>This will close chat for both attorney and client.</p>
            <div className="am-confirm-actions">
              <button
                type="button"
                className="am-confirm-btn am-confirm-btn--ghost"
                onClick={() => setEndSessionConfirmOpen(false)}
                disabled={endingSession}
              >
                Cancel
              </button>
              <button
                type="button"
                className="am-confirm-btn am-confirm-btn--danger"
                onClick={handleEndSession}
                disabled={endingSession}
              >
                {endingSession ? 'Ending...' : 'Yes, End Session'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
