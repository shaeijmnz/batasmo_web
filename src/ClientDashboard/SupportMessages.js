import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './SupportMessages.css';
import {
  fetchClientSupportThread,
  markClientSupportMessagesAsRead,
  sendClientSupportMessage,
  subscribeToClientSupport,
} from '../lib/userApi';

function formatTimeLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const now = new Date();
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();
  if (sameDay) {
    return parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SupportMessages({ profile }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const scrollRef = useRef(null);

  const refreshAndMarkRead = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const rows = await fetchClientSupportThread(profile.id);
      setMessages(rows);
      setLoadError('');
      await markClientSupportMessagesAsRead(profile.id);
    } catch (error) {
      setLoadError(error.message || 'Unable to load messages.');
    }
  }, [profile?.id]);

  useEffect(() => {
    let cancelled = false;
    refreshAndMarkRead();
    const unsubscribe = subscribeToClientSupport(profile?.id, () => {
      if (!cancelled) refreshAndMarkRead();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile?.id, refreshAndMarkRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !profile?.id) return;
    try {
      setSending(true);
      const newMsg = await sendClientSupportMessage({ clientId: profile.id, message: text });
      setMessages((previous) => {
        if (previous.some((m) => m.id === newMsg.id)) return previous;
        return [...previous, newMsg];
      });
      setDraft('');
    } catch (error) {
      setLoadError(error.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const conversation = useMemo(
    () => [...messages].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))),
    [messages],
  );

  return (
    <div className="support-messages">
      <header className="support-messages__head">
        <div className="support-messages__avatar">BM</div>
        <div>
          <h2>BatasMo Admin</h2>
          <p>Reach out for booking help, payment concerns, or any follow-ups.</p>
        </div>
      </header>

      {loadError ? <div className="support-messages__error">{loadError}</div> : null}

      <div className="support-messages__thread" ref={scrollRef}>
        {conversation.length === 0 ? (
          <div className="support-messages__empty">
            <h3>Start a conversation</h3>
            <p>Send a message to BatasMo Admin and we&apos;ll get back to you here.</p>
          </div>
        ) : (
          conversation.map((m) => (
            <div
              key={m.id}
              className={`support-messages__bubble support-messages__bubble--${m.senderRole === 'client' ? 'mine' : 'theirs'}`}
            >
              <div className="support-messages__bubble-body">{m.message}</div>
              <div className="support-messages__bubble-meta">{formatTimeLabel(m.createdAt)}</div>
            </div>
          ))
        )}
      </div>

      <form className="support-messages__composer" onSubmit={handleSend}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          rows={2}
          placeholder="Type your message to BatasMo Admin..."
          disabled={sending}
          maxLength={2000}
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
