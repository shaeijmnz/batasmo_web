import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAdminSupportMessages,
  fetchAdminSupportThreads,
  markAdminSupportMessagesAsRead,
  sendAdminSupportMessage,
  subscribeToAdminSupport,
} from '../lib/userApi';
import './AdminSupportDrawer.css';

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

export default function AdminSupportDrawer({ open, onClose, onUnreadChange }) {
  const [threads, setThreads] = useState([]);
  const [activeClientId, setActiveClientId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const scrollRef = useRef(null);

  const totalUnread = useMemo(
    () => threads.reduce((acc, t) => acc + (t.unreadFromClient || 0), 0),
    [threads],
  );

  const refreshThreads = useCallback(async () => {
    try {
      const rows = await fetchAdminSupportThreads({ limit: 200 });
      setThreads(rows);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load support threads.');
    }
  }, []);

  useEffect(() => {
    refreshThreads();
    const unsubscribe = subscribeToAdminSupport(() => {
      refreshThreads();
      if (activeClientId) {
        fetchAdminSupportMessages(activeClientId)
          .then((rows) => setMessages(rows))
          .catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [activeClientId, refreshThreads]);

  useEffect(() => {
    if (typeof onUnreadChange === 'function') onUnreadChange(totalUnread);
  }, [totalUnread, onUnreadChange]);

  useEffect(() => {
    if (!open || !activeClientId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchAdminSupportMessages(activeClientId);
        if (cancelled) return;
        setMessages(rows);
        await markAdminSupportMessagesAsRead(activeClientId);
        refreshThreads();
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load conversation.');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeClientId, open, refreshThreads]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeClientId || sending) return;
    try {
      setSending(true);
      const sent = await sendAdminSupportMessage({ clientId: activeClientId, message: body });
      setMessages((previous) => {
        if (previous.some((m) => m.id === sent.id)) return previous;
        return [...previous, sent];
      });
      setDraft('');
      refreshThreads();
    } catch (error) {
      setLoadError(error.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="adm-support-backdrop"
        onClick={onClose}
        aria-label="Close support drawer"
      />
      <aside className="adm-support-drawer" role="dialog" aria-label="Client support messages">
        <header className="adm-support-drawer__head">
          <div>
            <h2>Client Messages</h2>
            <p>Reply to client support inquiries.</p>
          </div>
          <button type="button" className="adm-support-drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {loadError ? <div className="adm-support-drawer__error">{loadError}</div> : null}

        <div className="adm-support-drawer__body">
          <div className="adm-support-drawer__list">
            {threads.length === 0 ? (
              <p className="adm-support-drawer__empty">No client messages yet.</p>
            ) : (
              threads.map((t) => {
                const active = t.clientId === activeClientId;
                return (
                  <button
                    key={t.clientId}
                    type="button"
                    className={`adm-support-thread ${active ? 'adm-support-thread--active' : ''}`}
                    onClick={() => setActiveClientId(t.clientId)}
                  >
                    <div className="adm-support-thread__row">
                      <span className="adm-support-thread__name">{t.clientName}</span>
                      <span className="adm-support-thread__time">{formatTimeLabel(t.lastAt)}</span>
                    </div>
                    <div className="adm-support-thread__row adm-support-thread__row--sub">
                      <span className="adm-support-thread__preview">
                        {t.lastSenderRole === 'admin' ? 'You: ' : ''}
                        {String(t.lastMessage || '').slice(0, 80)}
                      </span>
                      {t.unreadFromClient > 0 ? (
                        <span className="adm-support-thread__dot">{t.unreadFromClient}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="adm-support-drawer__chat">
            {!activeClientId ? (
              <div className="adm-support-drawer__placeholder">
                <h3>Select a client</h3>
                <p>Pick a conversation on the left to view messages and reply.</p>
              </div>
            ) : (
              <>
                <div className="adm-support-drawer__thread" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <p className="adm-support-drawer__empty">No messages yet.</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`adm-support-bubble adm-support-bubble--${m.senderRole === 'admin' ? 'mine' : 'theirs'}`}
                      >
                        <div className="adm-support-bubble__body">{m.message}</div>
                        <div className="adm-support-bubble__meta">{formatTimeLabel(m.createdAt)}</div>
                      </div>
                    ))
                  )}
                </div>

                <form className="adm-support-drawer__composer" onSubmit={handleSend}>
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
                    placeholder="Reply to client..."
                    disabled={sending}
                    maxLength={2000}
                  />
                  <button type="submit" disabled={sending || !draft.trim()}>
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
