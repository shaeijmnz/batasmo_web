import { useEffect, useRef, useState } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import './VideoCallModal.css';

// ─── Participant tile ────────────────────────────────────────────────────────

function ParticipantView({ participantId }) {
  const micRef = useRef(null);
  const videoRef = useRef(null);
  const { webcamStream, micStream, webcamOn, micOn, isLocal, displayName } =
    useParticipant(participantId);

  useEffect(() => {
    const el = micRef.current;
    if (!el) return;
    if (micOn && micStream) {
      const stream = new MediaStream([micStream.track]);
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [micStream, micOn]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (webcamOn && webcamStream) {
      const stream = new MediaStream([webcamStream.track]);
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [webcamStream, webcamOn]);

  const initials = (displayName || '?')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="vc-participant">
      <audio ref={micRef} autoPlay playsInline muted={isLocal} />

      {/* Video element always in DOM; hidden when cam is off so srcObject persists */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="vc-participant__video"
        style={{ display: webcamOn ? 'block' : 'none' }}
      />

      {!webcamOn && (
        <div className="vc-participant__avatar">{initials}</div>
      )}

      <div className="vc-participant__label">
        {displayName || 'Participant'}{isLocal ? ' (You)' : ''}
      </div>

      <div className="vc-participant__status">
        {!micOn && <span className="vc-participant__mic-off" title="Muted">🔇</span>}
      </div>
    </div>
  );
}

// ─── Controls bar ─────────────────────────────────────────────────────────────
// Reads mic/webcam state from useParticipant (authoritative reactive source).

function Controls({ onLeave, localParticipantId, toggleMic, toggleWebcam }) {
  // useParticipant gives the live, reactive state for the local participant.
  // localParticipantId is guaranteed to be a valid non-empty string here
  // because Controls is only rendered after joinState === 'JOINED' && localParticipant?.id is truthy.
  const { micOn, webcamOn } = useParticipant(localParticipantId);

  return (
    <div className="vc-controls">
      <button
        type="button"
        className={`vc-ctrl-btn ${micOn ? 'vc-ctrl-btn--active' : 'vc-ctrl-btn--muted'}`}
        onClick={() => toggleMic()}
        title={micOn ? 'Mute' : 'Unmute'}
      >
        {micOn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span>{micOn ? 'Mute' : 'Unmute'}</span>
      </button>

      <button
        type="button"
        className={`vc-ctrl-btn ${webcamOn ? 'vc-ctrl-btn--active' : 'vc-ctrl-btn--muted'}`}
        onClick={() => toggleWebcam()}
        title={webcamOn ? 'Stop Video' : 'Start Video'}
      >
        {webcamOn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
            <path d="M23 7l-7 5 7 5V7z" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
        <span>{webcamOn ? 'Stop Video' : 'Start Video'}</span>
      </button>

      <button
        type="button"
        className="vc-ctrl-btn vc-ctrl-btn--leave"
        onClick={onLeave}
        title="Leave Call"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 9.88a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.3 8.9" />
          <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
        <span>Leave</span>
      </button>
    </div>
  );
}

// ─── Meeting view ─────────────────────────────────────────────────────────────

const JOIN_TIMEOUT_MS = 30_000;

function MeetingView({ meetingId, onLeave }) {
  const [joinState, setJoinState] = useState('IDLE');
  const [joinError, setJoinError] = useState('');
  const hasJoinedRef = useRef(false);
  const timeoutRef = useRef(null);

  const {
    join,
    leave,
    participants,
    localParticipant,
    toggleMic,
    toggleWebcam,
  } = useMeeting({
    onMeetingJoined: () => {
      clearTimeout(timeoutRef.current);
      setJoinState('JOINED');
    },
    onMeetingLeft: onLeave,
    onError: (error) => {
      clearTimeout(timeoutRef.current);
      setJoinError(
        (error && (error.message || error.code))
          ? String(error.message || error.code)
          : 'Failed to connect to the video call.'
      );
      setJoinState('ERROR');
    },
  });

  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    setJoinState('JOINING');
    join();

    timeoutRef.current = setTimeout(() => {
      setJoinState((prev) => {
        if (prev === 'JOINING') {
          setJoinError('Connection timed out. Please check your internet and try again.');
          return 'ERROR';
        }
        return prev;
      });
    }, JOIN_TIMEOUT_MS);

    return () => clearTimeout(timeoutRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeave = () => {
    clearTimeout(timeoutRef.current);
    leave();
    onLeave();
  };

  return (
    <div className="vc-meeting">
      <div className="vc-meeting__id">Meeting ID: {meetingId}</div>

      {(joinState === 'IDLE' || joinState === 'JOINING') && (
        <div className="vc-connecting">
          <div className="vc-connecting__spinner" />
          <p>Connecting to video call…</p>
        </div>
      )}

      {joinState === 'ERROR' && (
        <div className="vc-connecting">
          <p className="vc-error-msg">{joinError}</p>
        </div>
      )}

      {joinState === 'JOINED' && (
        <div
          className={`vc-grid ${[...participants.keys()].length <= 2 ? 'vc-grid--sm' : 'vc-grid--lg'}`}
        >
          {[...participants.keys()].map((pid) => (
            <ParticipantView key={pid} participantId={pid} />
          ))}
        </div>
      )}

      {/* Full controls only when joined AND local participant is ready */}
      {joinState === 'JOINED' && localParticipant?.id ? (
        <Controls
          onLeave={handleLeave}
          localParticipantId={localParticipant.id}
          toggleMic={toggleMic}
          toggleWebcam={toggleWebcam}
        />
      ) : (
        /* Minimal leave button available at all times */
        <div className="vc-controls">
          <button
            type="button"
            className="vc-ctrl-btn vc-ctrl-btn--leave"
            onClick={handleLeave}
            title="Leave Call"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 9.88a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.3 8.9" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
            <span>Leave</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Public modal wrapper ────────────────────────────────────────────────────

/**
 * Props:
 *   meetingId      — VideoSDK room ID
 *   token          — VideoSDK auth token (JWT)
 *   participantName — Display name for the local user
 *   onClose        — Called when user leaves or closes the modal
 */
export default function VideoCallModal({ meetingId, token, participantName, onClose }) {
  const handleLeave = () => {
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="vc-overlay" role="dialog" aria-modal="true" aria-label="Video Call">
      <div className="vc-modal">
        <div className="vc-modal__header">
          <span className="vc-modal__title">Video Consultation</span>
          <button
            type="button"
            className="vc-modal__close"
            onClick={handleLeave}
            aria-label="Close video call"
          >
            ✕
          </button>
        </div>

        <MeetingProvider
          config={{
            meetingId,
            micEnabled: true,
            webcamEnabled: true,
            name: participantName || 'Participant',
            multiStream: true,
          }}
          token={token}
          joinWithoutUserInteraction={false}
          reinitialiseMeetingOnConfigChange={false}
        >
          <MeetingView meetingId={meetingId} onLeave={handleLeave} />
        </MeetingProvider>
      </div>
    </div>
  );
}
