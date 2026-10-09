import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './AdminSupportNotifier.css';

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 12000;

async function resolveClientName(clientId) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', clientId)
    .maybeSingle();
  return data?.full_name || data?.email || 'A client';
}

export default function AdminSupportNotifier({ currentPage, onNavigate }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((clientId) => {
    setToasts((previous) => previous.filter((t) => t.clientId !== clientId));
    const timer = timersRef.current.get(clientId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(clientId);
    }
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    const channel = supabase
      .channel('support_admin_notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        async (payload) => {
          const row = payload?.new;
          if (!row || row.sender_role !== 'client' || !row.client_id) return;
          const clientName = await resolveClientName(row.client_id).catch(() => 'A client');
          const toast = {
            clientId: row.client_id,
            clientName,
            preview: String(row.message || '').slice(0, 120),
          };
          // One toast per client: a newer message replaces that client's older toast.
          setToasts((previous) =>
            [toast, ...previous.filter((t) => t.clientId !== row.client_id)].slice(0, MAX_TOASTS),
          );
          const existing = timers.get(row.client_id);
          if (existing) clearTimeout(existing);
          timers.set(
            row.client_id,
            setTimeout(() => {
              timers.delete(row.client_id);
              setToasts((previous) => previous.filter((t) => t.clientId !== row.client_id));
            }, AUTO_DISMISS_MS),
          );
        },
      )
      .subscribe();

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, []);

  if (!toasts.length) return null;

  const onMessagesPage = currentPage === 'admin-messages';

  return (
    <div className="adm-support-notifier" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.clientId} className="adm-support-notifier__toast">
          <span className="adm-support-notifier__icon" aria-hidden="true">
            <MessageSquare size={18} />
          </span>
          <div className="adm-support-notifier__text">
            <strong>New message from {t.clientName}</strong>
            {t.preview ? <p>{t.preview}</p> : null}
            {onMessagesPage ? null : (
              <button
                type="button"
                className="adm-support-notifier__open"
                onClick={() => {
                  setToasts([]);
                  onNavigate?.('admin-messages');
                }}
              >
                Open Messages
              </button>
            )}
          </div>
          <button
            type="button"
            className="adm-support-notifier__close"
            onClick={() => dismiss(t.clientId)}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
