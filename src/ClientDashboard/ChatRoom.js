import { useEffect, useMemo, useRef, useState } from 'react';
import './ChatRoom.css';
import {
  deleteAppointmentMessage,
  fetchAppointmentMessages,
  fetchClientNotifications,
  fetchConsultationFeedback,
  fetchClientChatEligibleAppointments,
  getSignedUrlForAppointmentMessage,
  isConsultationChatActiveStatus,
  sendAppointmentAttachment,
  sendAppointmentMessage,
  subscribeToClientNotifications,
  submitConsultationFeedback,
  subscribeToAppointmentStatus,
  subscribeToAppointmentMessages,
  subscribeToConsultationRoomStatus,
  getOrCreateVideoMeeting,
  getVideoSdkToken,
  clearVideoMeetingId,
} from '../lib/userApi';
import VideoCallModal from '../components/VideoCallModal';

const ATTORNEY_AVATAR_BG = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';

const messageDateLabel = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Today';
  return parsed.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const mapMessage = (item) => ({
  id: item.id,
  from: item.isMine ? 'client' : 'attorney',
  text: String(item.text || ''),
  time: item.time || 'Now',
  createdAt: item.createdAt || new Date().toISOString(),
  date: messageDateLabel(item.createdAt),
  senderName: item.senderName || 'Attorney',
  messageType: item.messageType || 'text',
  fileBucket: item.fileBucket || null,
  filePath: item.filePath || null,
  fileName: item.fileName || null,
  mimeType: item.mimeType || null,
  fileSizeBytes: item.fileSizeBytes || null,
});

const mergeMessage = (existing, incoming) => {
  const byId = new Map(existing.map((item) => [item.id, item]));
  byId.set(incoming.id, incoming);
  return Array.from(byId.values()).sort((a, b) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
  );
};

function ChatRoom({ onNavigate, profile, initialAppointmentId = '' }) {
  const [threads, setThreads] = useState([]);
  const [activeAppointmentId, setActiveAppointmentId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [sending, setSending] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [signedUrlsByMessageId, setSignedUrlsByMessageId] = useState({});
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [timeWarningPopup, setTimeWarningPopup] = useState(null);
  const [videoCall, setVideoCall] = useState(null);
  const [videoCallLoading, setVideoCallLoading] = useState(false);
  const [videoCallError, setVideoCallError] = useState('');
  const [incomingCallData, setIncomingCallData] = useState(null);
  const videoCallRef = useRef(null);
  const messagesEndRef = useRef(null);
  const imagePickerRef = useRef(null);
  const filePickerRef = useRef(null);
  const shownTimeWarningIdsRef = useRef(new Set());
  const audioContextRef = useRef(null);

  const playTimeWarningCue = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch {
      // Ignore audio cue failures so popup still appears.
    }
  };

  const syncClosedSessionFeedbackState = async (appointmentId, options = {}) => {
    const openModalWhileLoading = options.openModalWhileLoading !== false;

    if (openModalWhileLoading) {
      setFeedbackSubmitted(false);
      setFeedbackModalOpen(true);
      setFeedbackError('');
    }

    try {
      const feedbackState = await fetchConsultationFeedback(appointmentId);
      if (feedbackState.submitted) {
        setFeedbackRating(Number(feedbackState.rating || 0));
        setFeedbackComment(String(feedbackState.comment || ''));
        setFeedbackSubmitted(true);
        setFeedbackModalOpen(true);
        setFeedbackError('');
      } else {
        setFeedbackSubmitted(false);
        setFeedbackModalOpen(true);
        setFeedbackError('');
      }
    } catch (error) {
      // Keep the feedback modal open so the client can still rate and submit.
      setFeedbackSubmitted(false);
      setFeedbackModalOpen(true);
      setFeedbackError('Please submit your feedback to finish this consultation.');
      setLoadError(error.message || 'Unable to load feedback status.');
    }
  };

  const activeThread = useMemo(
    () => threads.find((item) => String(item.id) === String(activeAppointmentId)) || null,
    [activeAppointmentId, threads],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    let isMounted = true;

    const loadThreads = async () => {
      if (!profile?.id) return;

      try {
        const rows = await fetchClientChatEligibleAppointments(profile.id);
        if (!isMounted) return;

        setThreads(rows);
        setActiveAppointmentId((previous) => {
          if (!rows.length) return '';
          if (initialAppointmentId && rows.some((item) => String(item.id) === String(initialAppointmentId))) {
            return String(initialAppointmentId);
          }
          if (previous && rows.some((item) => String(item.id) === String(previous))) return previous;
          return String(rows[0].id);
        });

        if (!rows.length) {
          setLoadError('Consultation chat opens at your scheduled appointment time.');
        } else {
          setLoadError('');
        }
      } catch (error) {
        if (!isMounted) return;
        setThreads([]);
        setActiveAppointmentId('');
        setLoadError(error.message || 'Unable to load consultation threads.');
      }
    };

    loadThreads();

    const refreshId = window.setInterval(() => {
      loadThreads();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshId);
    };
  }, [profile?.id, initialAppointmentId]);

  useEffect(() => {
    if (!initialAppointmentId || !threads.length) return;
    if (threads.some((item) => String(item.id) === String(initialAppointmentId))) {
      setActiveAppointmentId(String(initialAppointmentId));
    }
  }, [initialAppointmentId, threads]);

  useEffect(() => {
    if (!activeAppointmentId) {
      setMessages([]);
      setIsClosed(false);
      setSignedUrlsByMessageId({});
      setFeedbackModalOpen(false);
      setFeedbackRating(0);
      setFeedbackComment('');
      setFeedbackSubmitted(false);
      setFeedbackError('');
      return undefined;
    }

    let isMounted = true;

    const loadMessages = async () => {
      try {
        const response = await fetchAppointmentMessages(activeAppointmentId);
        if (!isMounted) return;

        setMessages((response.messages || []).map(mapMessage));
        setIsClosed(Boolean(response.isClosed));

        if (response.videoMeetingId && response.roomId && !videoCallRef.current) {
          try {
            await openIncomingByMeetingId({
              meetingId: response.videoMeetingId,
              roomId: response.roomId,
            });
          } catch {
            // Keep chat usable; user can still join from fallback button.
          }
        }

        if (response.isClosed) {
          await syncClosedSessionFeedbackState(activeAppointmentId);
          if (!isMounted) return;
        }
      } catch (error) {
        if (!isMounted) return;
        setMessages([]);
        setIsClosed(false);
        setLoadError(error.message || 'Unable to load consultation chat messages.');
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [activeAppointmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeAppointmentId || !isClosed) return;
    syncClosedSessionFeedbackState(activeAppointmentId);
  }, [activeAppointmentId, isClosed]);

  useEffect(() => {
    if (!activeAppointmentId) return undefined;

    const unsubscribe = subscribeToConsultationRoomStatus(activeAppointmentId, async ({ isClosed, videoMeetingId }) => {
      setIsClosed(Boolean(isClosed));
      if (isClosed) {
        await syncClosedSessionFeedbackState(activeAppointmentId);
      }

      // Auto-open video call when attorney starts one (video_meeting_id just appeared)
      if (videoMeetingId && !videoCallRef.current) {
        try {
          const response = await fetchAppointmentMessages(activeAppointmentId);
          await openIncomingByMeetingId({
            meetingId: videoMeetingId,
            roomId: response.roomId,
          });
        } catch (error) {
          setVideoCallError(
            error?.message || 'Incoming call is ready. Tap "Join Incoming Call" to connect.',
          );
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeAppointmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile?.id) return undefined;

    let cancelled = false;

    const maybeShowWarningPopup = async () => {
      try {
        const items = await fetchClientNotifications(profile.id, { limit: 20 });
        if (cancelled) return;

        const matchingWarning = items.find((item) => {
          const type = String(item?.type || '').toLowerCase();
          if (type !== 'consultation_time_warning') return false;

          const body = String(item?.desc || '');
          if (!activeAppointmentId) return true;
          return body.includes(`Ref #${activeAppointmentId}`);
        });

        if (!matchingWarning) return;

        const warningId = String(matchingWarning.id || '');
        if (!warningId || shownTimeWarningIdsRef.current.has(warningId)) return;

        shownTimeWarningIdsRef.current.add(warningId);
        playTimeWarningCue();
        setTimeWarningPopup({
          title: matchingWarning.title || 'Consultation Reminder',
          body: matchingWarning.desc || 'Only 10 minutes left. Please prepare your final questions.',
        });
      } catch {
        // Keep chat usable even if notifications fetch fails.
      }
    };

    maybeShowWarningPopup();
    const unsubscribe = subscribeToClientNotifications(profile.id, maybeShowWarningPopup);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile?.id, activeAppointmentId]);

  useEffect(() => {
    if (!activeAppointmentId) return undefined;

    const unsubscribe = subscribeToAppointmentStatus(activeAppointmentId, async (status) => {
      if (isConsultationChatActiveStatus(status)) return;

      setIsClosed(true);

      await syncClosedSessionFeedbackState(activeAppointmentId);
    });

    return () => {
      unsubscribe();
    };
  }, [activeAppointmentId]);

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
    if (!activeAppointmentId) return undefined;

    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      try {
        const stop = await subscribeToAppointmentMessages(activeAppointmentId, (item) => {
          const normalized = mapMessage(item);
          setMessages((previous) => mergeMessage(previous, normalized));
          setIsClosed(Boolean(item.isClosed));
        });

        if (!cancelled) {
          unsubscribe = stop;
        } else {
          stop();
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || 'Unable to connect to realtime chat updates.');
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      console.log('[lifecycle] ChatRoom realtime unsubscribed', { appointmentId: activeAppointmentId });
    };
  }, [activeAppointmentId]);

  useEffect(() => {
    if (!activeAppointmentId) return undefined;

    let cancelled = false;

    const refreshMessages = async () => {
      try {
        const response = await fetchAppointmentMessages(activeAppointmentId);
        if (cancelled) return;

        const incoming = (response.messages || []).map(mapMessage);
        setMessages((previous) => incoming.reduce(mergeMessage, previous));
        setIsClosed(Boolean(response.isClosed));
      } catch {
        // Keep current UI state if background refresh fails.
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

  const handleSend = async (event) => {
    event.preventDefault();
    const body = String(inputMsg || '').trim();
    if (!body || sending || isClosed || !activeAppointmentId) return;

    try {
      setSending(true);
      const sent = await sendAppointmentMessage(activeAppointmentId, body);
      setMessages((previous) => mergeMessage(previous, mapMessage(sent)));
      setInputMsg('');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentUpload = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile || sending || isClosed || !activeAppointmentId) return;

    try {
      setSending(true);
      const sent = await sendAppointmentAttachment(activeAppointmentId, selectedFile, inputMsg);
      setMessages((previous) => mergeMessage(previous, mapMessage(sent)));
      setInputMsg('');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to upload attachment.');
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
      setLoadError(error.message || 'Unable to delete message.');
    } finally {
      setDeletingMessageId('');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!activeAppointmentId || feedbackSubmitting) return;
    if (feedbackRating < 1 || feedbackRating > 5) {
      setFeedbackError('Please select a star rating before submitting feedback.');
      return;
    }

    try {
      setFeedbackSubmitting(true);
      setFeedbackError('');
      await submitConsultationFeedback({
        appointmentId: activeAppointmentId,
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setFeedbackSubmitted(true);
      setFeedbackModalOpen(false);
      setLoadError('');
      onNavigate('home-logged');
    } catch (error) {
      const message = error.message || 'Unable to submit feedback.';
      setLoadError(message);
      setFeedbackError(message);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const renderMessageBody = (msg, isClient) => {
    const hasResolvedUrl = Object.prototype.hasOwnProperty.call(signedUrlsByMessageId, msg.id);
    const signedUrl = signedUrlsByMessageId[msg.id];

    if (msg.messageType === 'image') {
      return (
        <>
          {!hasResolvedUrl ? (
            <p className="cr-msg__attachment-error">Loading image...</p>
          ) : signedUrl ? (
            <img
              src={signedUrl}
              alt={msg.fileName || 'Shared image'}
              className="cr-msg__image"
              loading="lazy"
            />
          ) : (
            <p className="cr-msg__attachment-error">Unable to load image.</p>
          )}
          {msg.text && msg.text !== 'Photo' ? <p>{msg.text}</p> : null}
        </>
      );
    }

    if (msg.messageType === 'file') {
      return (
        <>
          {!hasResolvedUrl ? (
            <p className="cr-msg__attachment-error">Loading file...</p>
          ) : signedUrl ? (
            <a
              className={`cr-msg__file-link ${isClient ? 'cr-msg__file-link--client' : ''}`}
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
            >
              {msg.fileName ? `📎 ${msg.fileName}` : '📎 Open file'}
            </a>
          ) : (
            <p className="cr-msg__attachment-error">Unable to open file.</p>
          )}
          {msg.text && msg.text !== 'Attachment' ? <p>{msg.text}</p> : null}
        </>
      );
    }

    return <p>{msg.text}</p>;
  };

  const openVideoCall = (callData) => {
    videoCallRef.current = callData;
    setVideoCall(callData);
    setIncomingCallData(null);
  };

  const warmupMediaPermissions = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Keep call flow working even when prompt is dismissed.
    }
  };

  const tryOpenIncomingCall = async (callData) => {
    setIncomingCallData(callData);
    await warmupMediaPermissions();
    openVideoCall(callData);
  };

  const openIncomingByMeetingId = async ({ meetingId, roomId }) => {
    if (!meetingId || !roomId) return;
    const token = await getVideoSdkToken();
    await tryOpenIncomingCall({ meetingId, roomId, token });
  };

  const handleStartVideoCall = async () => {
    if (!activeAppointmentId || videoCallLoading) return;
    setVideoCallLoading(true);
    setVideoCallError('');
    try {
      const { meetingId, roomId, token } = await getOrCreateVideoMeeting(activeAppointmentId);
      await warmupMediaPermissions();
      openVideoCall({ meetingId, roomId, token });
    } catch (err) {
      setVideoCallError(err.message || 'Failed to start video call.');
    } finally {
      setVideoCallLoading(false);
    }
  };

  const handleCloseVideoCall = async () => {
    if (videoCall?.roomId) {
      await clearVideoMeetingId(videoCall.roomId);
    }
    videoCallRef.current = null;
    setVideoCall(null);
  };

  const handleJoinIncomingCall = async () => {
    if (!incomingCallData || videoCallLoading) return;
    setVideoCallLoading(true);
    setVideoCallError('');
    try {
      await tryOpenIncomingCall(incomingCallData);
    } catch (error) {
      setVideoCallError(
        error?.message || 'Unable to connect yet. Please check internet and try joining again.',
      );
    } finally {
      setVideoCallLoading(false);
    }
  };

  useEffect(() => {
    if (!activeAppointmentId || isClosed || videoCall) return;
    warmupMediaPermissions();
  }, [activeAppointmentId, isClosed, videoCall]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cr-page">
      <div className="cr-chat-area">
        <div className="cr-session-bar">
          <div className="cr-session-bar__info">
            <span className="cr-session-label">Consultation Room</span>
            {activeThread ? (
              <span className="cr-session-meta">
                {activeThread.name} • {activeThread.title}
              </span>
            ) : (
              <span className="cr-session-meta">No active consultation threads</span>
            )}
          </div>

          <div className="cr-session-bar__actions">
            <button
              type="button"
              className="cr-video-call-btn"
              onClick={handleStartVideoCall}
              disabled={!activeAppointmentId || videoCallLoading || isClosed}
              title="Start Video Call"
            >
              {videoCallLoading ? (
                'Connecting…'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  Video Call
                </>
              )}
            </button>
            {threads.length > 0 ? (
              <select
                value={activeAppointmentId}
                onChange={(e) => setActiveAppointmentId(e.target.value)}
                className="cr-thread-select"
              >
                {threads.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} • {item.scheduleLabel}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        {videoCallError ? (
          <div className="cr-video-error">{videoCallError}</div>
        ) : null}
        {incomingCallData && !videoCall ? (
          <div className="cr-video-incoming">
            <button
              type="button"
              className="cr-video-call-btn"
              onClick={handleJoinIncomingCall}
              disabled={videoCallLoading}
            >
              {videoCallLoading ? 'Connecting…' : 'Join Incoming Call'}
            </button>
          </div>
        ) : null}

        <div className="cr-messages">
          {loadError ? (
            <div className="cr-msg cr-msg--system">
              <div className="cr-msg__system">{loadError}</div>
            </div>
          ) : null}

          {!loadError && !activeAppointmentId ? (
            <div className="cr-msg cr-msg--system">
              <div className="cr-msg__system">
                Start a consultation first. Chat is only accessible when the appointment status is started/active.
              </div>
            </div>
          ) : null}

          {messages.map((msg) => {
            const isClient = msg.from === 'client';
            return (
              <div key={msg.id} className={`cr-msg cr-msg--${isClient ? 'client' : 'admin'}`}>
                {!isClient ? (
                  <div className="cr-msg__avatar" style={{ background: ATTORNEY_AVATAR_BG }}>
                    {msg.senderName
                      .split(' ')
                      .filter(Boolean)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || 'AT'}
                  </div>
                ) : null}

                <div className="cr-msg__content">
                  <div className="cr-msg__bubble">
                    {!isClient ? <span className="cr-msg__sender">{msg.senderName || 'Attorney'}</span> : null}
                    {renderMessageBody(msg, isClient)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="cr-msg__time">{msg.time}</span>
                    {isClient ? (
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
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        <form className="cr-input-bar" onSubmit={handleSend}>
          {isClosed ? (
            <div className="cr-ended-bar">
              <p>This consultation room is closed.</p>
              <button type="button" className="cr-return-btn" onClick={() => onNavigate('my-appointments')}>
                Back to My Appointments
              </button>
            </div>
          ) : (
            <>
              <div className="cr-attach-actions">
                <button
                  type="button"
                  className="cr-attach-btn"
                  onClick={() => imagePickerRef.current?.click()}
                  disabled={!activeAppointmentId || sending}
                >
                  Photo
                </button>
                <button
                  type="button"
                  className="cr-attach-btn"
                  onClick={() => filePickerRef.current?.click()}
                  disabled={!activeAppointmentId || sending}
                >
                  File
                </button>
                <input
                  ref={imagePickerRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="cr-hidden-file-input"
                  onChange={handleAttachmentUpload}
                />
                <input
                  ref={filePickerRef}
                  type="file"
                  accept="application/pdf,.doc,.docx,text/plain,.txt"
                  className="cr-hidden-file-input"
                  onChange={handleAttachmentUpload}
                />
              </div>
              <div className="cr-input-wrapper">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder={activeAppointmentId ? 'Type your message...' : 'No active consultation'}
                  disabled={!activeAppointmentId || sending}
                />
              </div>
              <button type="submit" className="cr-send-btn" disabled={!inputMsg.trim() || !activeAppointmentId || sending}>
                {sending ? '...' : 'Send'}
              </button>
            </>
          )}
        </form>
      </div>

      {feedbackModalOpen ? (
        <div className="cr-feedback-overlay">
          <div className="cr-feedback-modal" role="dialog" aria-modal="true">
            {!feedbackSubmitted ? (
              <>
                <h2>Consultation Ended</h2>
                <p className="cr-feedback-subtitle">Please rate your attorney consultation experience.</p>
                <div className="cr-feedback-stars" aria-label="Rate attorney">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`cr-feedback-star ${feedbackRating >= value ? 'cr-feedback-star--active' : ''}`}
                      onClick={() => setFeedbackRating(value)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  className="cr-feedback-input"
                  rows="4"
                  placeholder="Share your feedback (optional)"
                  value={feedbackComment}
                  onChange={(event) => setFeedbackComment(event.target.value)}
                />
                {feedbackError ? <p className="cr-feedback-error">{feedbackError}</p> : null}
                <div className="cr-feedback-actions">
                  <button
                    type="button"
                    className="cr-feedback-submit"
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackSubmitting || feedbackRating < 1}
                  >
                    {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Thank You</h2>
                <p className="cr-feedback-subtitle">Your feedback has been submitted successfully.</p>
                <div className="cr-feedback-actions">
                  <button
                    type="button"
                    className="cr-feedback-return"
                    onClick={() => onNavigate('home-logged')}
                  >
                    Go to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {timeWarningPopup ? (
        <div className="cr-time-warning-overlay" onClick={() => setTimeWarningPopup(null)}>
          <div className="cr-time-warning-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{timeWarningPopup.title}</h3>
            <p>{timeWarningPopup.body}</p>
            <div className="cr-time-warning-actions">
              <button type="button" className="cr-time-warning-close" onClick={() => setTimeWarningPopup(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {videoCall ? (
        <VideoCallModal
          meetingId={videoCall.meetingId}
          token={videoCall.token || ''}
          participantName={profile?.full_name || profile?.email || 'Client'}
          onClose={handleCloseVideoCall}
        />
      ) : null}
    </div>
  );
}

export default ChatRoom;
