import './AttorneyNotificationDropdown.css';

const GLYPH_STROKE = 2;

function parseNotificationDisplay(n) {
  if (n.title && (n.body !== undefined && n.body !== null && String(n.body).trim() !== '')) {
    return { title: n.title, body: String(n.body).trim() };
  }
  if (n.title && (!n.body || !String(n.body).trim())) {
    return { title: n.title, body: n.text ? String(n.text).trim() : '' };
  }
  const t = String(n.text || '').trim();
  const colon = t.indexOf(': ');
  if (colon > 0) {
    return { title: t.slice(0, colon).trim(), body: t.slice(colon + 2).trim() };
  }
  return { title: 'Notification', body: t };
}

function NotificationGlyph({ type }) {
  const t = String(type || '').toLowerCase();
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: GLYPH_STROKE,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (t === 'payment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (t === 'booking') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (t === 'consultation') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="14" y2="17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20} {...common}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function glyphClass(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'payment') return 'atty-notif-item__glyph--payment';
  if (t === 'booking') return 'atty-notif-item__glyph--booking';
  if (t === 'consultation') return 'atty-notif-item__glyph--consultation';
  return 'atty-notif-item__glyph--default';
}

function typePillLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'payment') return 'Payment';
  if (t === 'booking') return 'Booking';
  if (t === 'consultation') return 'Consultation';
  if (t === 'reminder') return 'Reminder';
  return 'Update';
}

/**
 * Shared attorney notification dropdown: hierarchy, type icons, readable body text.
 */
export default function AttorneyNotificationDropdown({ open, onClose, notifications = [] }) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="atty-notif-backdrop" onClick={onClose} aria-label="Close notifications" />
      <div className="atty-notif-panel" role="dialog" aria-label="Notifications">
        <div className="atty-notif-panel__header">
          <span className="atty-notif-panel__title">Notifications</span>
          <button type="button" className="atty-notif-panel__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="atty-notif-panel__list">
          {notifications.length === 0 ? (
            <p className="atty-notif-empty">No notifications yet.</p>
          ) : (
            notifications.map((n) => {
              const { title, body } = parseNotificationDisplay(n);
              const type = n.type || 'general';
              return (
                <article key={n.id} className={`atty-notif-item ${n.unread ? 'atty-notif-item--unread' : ''}`}>
                  <div className="atty-notif-item__row">
                    <span className={`atty-notif-item__glyph ${glyphClass(type)}`}>
                      <NotificationGlyph type={type} />
                    </span>
                    <div className="atty-notif-item__body">
                      <div className="atty-notif-item__head">
                        <h3 className="atty-notif-item__title">{title}</h3>
                        <span className="atty-notif-item__pill">{typePillLabel(type)}</span>
                      </div>
                      {body ? <p className="atty-notif-item__desc">{body}</p> : null}
                      <div className="atty-notif-item__meta">
                        <time className="atty-notif-item__time">{n.time}</time>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
