import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
  createCameraVideoTrack,
  createMicrophoneAudioTrack,
} from '@videosdk.live/react-sdk';
import './VideoCallModal.css';
import { isLowPowerVideoDevice } from '../lib/videoCallHelpers';

const JOIN_TIMEOUT_MS = 25_000;
const LAYOUT_DEBOUNCE_MS = 280;

const VIDEO_QUALITY_PRESETS = isLowPowerVideoDevice()
  ? ['h360p_w640p']
  : ['h540p_w960p', 'h360p_w640p'];

async function createPreferredCameraTrack() {
  for (const encoderConfig of VIDEO_QUALITY_PRESETS) {
    try {
      const track = await createCameraVideoTrack({
        encoderConfig,
        facingMode: 'user',
        optimizationMode: 'detail',
        multiStream: false,
      });
      if (track) return track;
    } catch (err) {
      console.warn('[video] camera preset failed', encoderConfig, err?.message || err);
    }
  }
  return null;
}

async function createPreferredAudioTrack() {
  try {
    return await createMicrophoneAudioTrack({
      encoderConfig: 'speech_standard',
      noiseConfig: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    console.warn('[video] mic preset failed', err?.message || err);
    return null;
  }
}

const attachMediaTrack = (element, track, enabled) => {
  if (!element) return;
  if (enabled && track) {
    const stream = new MediaStream([track]);
    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }
    element.play().catch(() => {});
    return;
  }
  if (element.srcObject) {
    element.srcObject = null;
  }
};

class VideoErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn('[VideoCallModal] SDK error caught by boundary:', error?.message, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="vc-connecting">
          <p className="vc-error-msg">
            Video call encountered an error. Please close and try again.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const ParticipantView = memo(function ParticipantView({ participantId }) {
  const micRef = useRef(null);
  const videoRef = useRef(null);
  const participant = useParticipant(participantId);
  const { webcamStream, micStream, webcamOn, micOn, isLocal, displayName } = participant || {};
  const hasLiveVideo = Boolean(webcamOn && webcamStream?.track);
  const videoTrackId = webcamStream?.track?.id;
  const micTrackId = micStream?.track?.id;

  useEffect(() => {
    const el = micRef.current;
    attachMediaTrack(el, micStream?.track, Boolean(micOn && micStream?.track));
    return () => {
      if (el?.srcObject) el.srcObject = null;
    };
  }, [micOn, micTrackId, micStream?.track]);

  useEffect(() => {
    const el = videoRef.current;
    attachMediaTrack(el, webcamStream?.track, Boolean(webcamOn && webcamStream?.track));
    return () => {
      if (el?.srcObject) el.srcObject = null;
    };
  }, [webcamOn, videoTrackId, webcamStream?.track]);

  const initials = useMemo(
    () =>
      (displayName || '?')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [displayName],
  );

  return (
    <div className="vc-participant">
      <audio ref={micRef} autoPlay playsInline muted={isLocal} />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="vc-participant__video"
        style={{ display: hasLiveVideo ? 'block' : 'none' }}
      />

      {!hasLiveVideo && <div className="vc-participant__avatar">{initials}</div>}

      <div className="vc-participant__label">
        {displayName || 'Participant'}
        {isLocal ? ' (You)' : ''}
      </div>

      <div className="vc-participant__status">
        {!micOn && (
          <span className="vc-participant__mic-off" title="Muted">
            🔇
          </span>
        )}
      </div>
    </div>
  );
});

const Controls = memo(function Controls({ onLeave, micOn, webcamOn, toggleMic, toggleWebcam }) {
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

      <button type="button" className="vc-ctrl-btn vc-ctrl-btn--leave" onClick={onLeave} title="Leave Call">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 9.88a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.3 8.9" />
          <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
        <span>Leave</span>
      </button>
    </div>
  );
});

const buildTwoParticipantLayout = (participantIds, localParticipantId) => {
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return { primary: null, secondary: null };
  }
  const remoteIds = participantIds.filter((pid) => String(pid) !== String(localParticipantId));
  const ordered = [...remoteIds];
  if (
    localParticipantId &&
    participantIds.some((pid) => String(pid) === String(localParticipantId))
  ) {
    ordered.push(localParticipantId);
  }
  return {
    primary: ordered[0] || null,
    secondary: ordered[1] || null,
  };
};

function MeetingStage({ participantIds, localParticipantId }) {
  const { primary, secondary } = useMemo(
    () => buildTwoParticipantLayout(participantIds, localParticipantId),
    [participantIds, localParticipantId],
  );

  if (!primary) return null;

  if (participantIds.length <= 2) {
    return (
      <div className="vc-stage">
        <div className="vc-stage__primary">
          <VideoErrorBoundary>
            <ParticipantView participantId={primary} />
          </VideoErrorBoundary>
        </div>
        {secondary ? (
          <div className="vc-stage__pip">
            <VideoErrorBoundary>
              <ParticipantView participantId={secondary} />
            </VideoErrorBoundary>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`vc-grid ${participantIds.length <= 2 ? 'vc-grid--sm' : 'vc-grid--lg'}`}>
      {participantIds.map((pid) => (
        <VideoErrorBoundary key={pid}>
          <ParticipantView participantId={pid} />
        </VideoErrorBoundary>
      ))}
    </div>
  );
}

function MeetingView({ meetingId, onLeave }) {
  const [joinState, setJoinState] = useState('IDLE');
  const [joinError, setJoinError] = useState('');
  const [participantIds, setParticipantIds] = useState([]);
  const hasJoinedRef = useRef(false);
  const timeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const layoutTimerRef = useRef(null);
  const participantsRef = useRef(null);

  const syncParticipantIds = useCallback(() => {
    const map = participantsRef.current;
    if (!map) return;
    const next = [...map.keys()].sort();
    setParticipantIds((prev) => {
      if (prev.length === next.length && prev.every((id, index) => id === next[index])) {
        return prev;
      }
      return next;
    });
  }, []);

  const scheduleParticipantSync = useCallback(() => {
    if (layoutTimerRef.current) window.clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = window.setTimeout(() => {
      layoutTimerRef.current = null;
      syncParticipantIds();
    }, LAYOUT_DEBOUNCE_MS);
  }, [syncParticipantIds]);

  const {
    join,
    leave,
    participants,
    localParticipant,
    toggleMic,
    toggleWebcam,
    localMicOn,
    localWebcamOn,
  } = useMeeting({
    onMeetingJoined: () => {
      clearTimeout(timeoutRef.current);
      retryCountRef.current = 0;
      setJoinState('JOINED');
      syncParticipantIds();
    },
    onMeetingLeft: onLeave,
    onParticipantJoined: scheduleParticipantSync,
    onParticipantLeft: scheduleParticipantSync,
    onWebcamRequested: ({ accept }) => {
      if (typeof accept === 'function') accept();
    },
    onMicRequested: ({ accept }) => {
      if (typeof accept === 'function') accept();
    },
    onError: (error) => {
      clearTimeout(timeoutRef.current);
      if (retryCountRef.current < 1) {
        retryCountRef.current += 1;
        setJoinState('JOINING');
        setJoinError('');
        window.setTimeout(() => {
          try {
            join();
          } catch {
            // Fall through to user-visible error state below.
          }
        }, 1200);
        return;
      }
      setJoinError(
        error && (error.message || error.code)
          ? String(error.message || error.code)
          : 'Failed to connect to the video call.',
      );
      setJoinState('ERROR');
    },
  });

  participantsRef.current = participants;

  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    setJoinState('JOINING');
    join();

    timeoutRef.current = window.setTimeout(() => {
      setJoinState((prev) => {
        if (prev === 'JOINING') {
          if (retryCountRef.current < 1) {
            retryCountRef.current += 1;
            try {
              join();
              return 'JOINING';
            } catch {
              // Continue to error state below.
            }
          }
          setJoinError('Connection timed out. Please check your internet and try again.');
          return 'ERROR';
        }
        return prev;
      });
    }, JOIN_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutRef.current);
      if (layoutTimerRef.current) {
        window.clearTimeout(layoutTimerRef.current);
        layoutTimerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeave = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (layoutTimerRef.current) {
      window.clearTimeout(layoutTimerRef.current);
      layoutTimerRef.current = null;
    }
    try {
      leave();
    } catch {
      // SDK may already be torn down.
    }
    onLeave();
  }, [leave, onLeave]);

  const localParticipantId = localParticipant?.id || null;

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

      {joinState === 'JOINED' && participantIds.length > 0 ? (
        <MeetingStage participantIds={participantIds} localParticipantId={localParticipantId} />
      ) : null}

      {joinState === 'JOINED' ? (
        <Controls
          onLeave={handleLeave}
          micOn={localMicOn ?? true}
          webcamOn={localWebcamOn ?? true}
          toggleMic={toggleMic}
          toggleWebcam={toggleWebcam}
        />
      ) : (
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

export default function VideoCallModal({ meetingId, token, participantName, onClose }) {
  const [preparedTracks, setPreparedTracks] = useState(null);
  const [tracksReady, setTracksReady] = useState(false);
  const [tracksError, setTracksError] = useState('');
  const trackCleanupRef = useRef(null);
  const useSdkDefaultTracks = isLowPowerVideoDevice();

  useEffect(() => {
    if (!meetingId || !token) return undefined;

    if (useSdkDefaultTracks) {
      setPreparedTracks(null);
      setTracksReady(true);
      setTracksError('');
      return undefined;
    }

    let cancelled = false;
    setTracksReady(false);
    setTracksError('');

    (async () => {
      const [videoTrack, audioTrack] = await Promise.all([
        createPreferredCameraTrack(),
        createPreferredAudioTrack(),
      ]);

      if (cancelled) {
        try {
          videoTrack?.stop?.();
        } catch {
          /* noop */
        }
        try {
          audioTrack?.stop?.();
        } catch {
          /* noop */
        }
        return;
      }

      trackCleanupRef.current = () => {
        try {
          videoTrack?.stop?.();
        } catch {
          /* noop */
        }
        try {
          audioTrack?.stop?.();
        } catch {
          /* noop */
        }
      };
      setPreparedTracks({ videoTrack, audioTrack });
      setTracksReady(true);

      if (!videoTrack && !audioTrack) {
        setTracksError('Using default camera/microphone.');
      }
    })();

    return () => {
      cancelled = true;
      if (typeof trackCleanupRef.current === 'function') {
        trackCleanupRef.current();
        trackCleanupRef.current = null;
      }
    };
  }, [meetingId, token, useSdkDefaultTracks]);

  const handleLeave = useCallback(() => {
    if (typeof trackCleanupRef.current === 'function') {
      trackCleanupRef.current();
      trackCleanupRef.current = null;
    }
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  const meetingConfig = useMemo(
    () => ({
      meetingId,
      micEnabled: true,
      webcamEnabled: true,
      name: participantName || 'Participant',
      multiStream: false,
      ...(preparedTracks?.videoTrack
        ? { customCameraVideoTrack: preparedTracks.videoTrack }
        : {}),
      ...(preparedTracks?.audioTrack
        ? { customMicrophoneAudioTrack: preparedTracks.audioTrack }
        : {}),
    }),
    [meetingId, participantName, preparedTracks?.audioTrack, preparedTracks?.videoTrack],
  );

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

        <VideoErrorBoundary>
          {tracksReady ? (
            <MeetingProvider
              config={meetingConfig}
              token={token}
              joinWithoutUserInteraction
              reinitialiseMeetingOnConfigChange={false}
            >
              <MeetingView meetingId={meetingId} onLeave={handleLeave} />
            </MeetingProvider>
          ) : (
            <div className="vc-connecting">
              <div className="vc-connecting__spinner" />
              <p>Preparing camera & microphone…</p>
              {tracksError ? (
                <p className="vc-error-msg" style={{ marginTop: 6 }}>
                  {tracksError}
                </p>
              ) : null}
            </div>
          )}
        </VideoErrorBoundary>
      </div>
    </div>
  );
}
