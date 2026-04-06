import { useState, useRef, useEffect } from 'react';
import './Announcements.css';
import { supabase } from '../lib/supabaseClient';

/* ── Icons ── */
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MegaphoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CalendarSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const getTypeIcon = (type) => {
  switch (type) {
    case 'reschedule':
      return (
        <div className="ann-card__type-icon ann-card__type-icon--reschedule">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </div>
      );
    case 'update':
      return (
        <div className="ann-card__type-icon ann-card__type-icon--update">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
      );
    case 'reminder':
      return (
        <div className="ann-card__type-icon ann-card__type-icon--reminder">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      );
    case 'general':
    default:
      return (
        <div className="ann-card__type-icon ann-card__type-icon--general">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
      );
  }
};

const getTypeLabel = (type) => {
  switch (type) {
    case 'reschedule': return 'Reschedule';
    case 'update': return 'Update';
    case 'reminder': return 'Reminder';
    case 'general': default: return 'General';
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'reschedule': return { bg: '#fef2f2', color: '#dc2626' };
    case 'update': return { bg: '#eff6ff', color: '#2563eb' };
    case 'reminder': return { bg: '#fffbeb', color: '#f59e0b' };
    case 'general': default: return { bg: '#eef2ff', color: '#6366f1' };
  }
};

function Announcements({ onNavigate, profile }) {
  const [announcements, setAnnouncements] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAnnouncement, setChatAnnouncement] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loadError, setLoadError] = useState('');
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadAnnouncements = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, body, type, is_read, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!isMounted) return;

        const mapped = (data || []).map((item) => {
          const dt = new Date(item.created_at);
          const type = (item.type || 'general').toLowerCase();
          const normalizedType = type.includes('resched') ? 'reschedule' : type.includes('remind') ? 'reminder' : type.includes('update') ? 'update' : 'general';
          return {
            id: item.id,
            type: normalizedType,
            title: item.title || 'Announcement',
            message: item.body || '',
            date: Number.isNaN(dt.getTime()) ? 'Today' : dt.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
            priority: normalizedType === 'reschedule' || normalizedType === 'reminder' ? 'high' : 'normal',
            read: !!item.is_read,
            adminName: 'BatasMo Admin',
            chatHistory: [{ from: 'admin', text: item.body || '', time: Number.isNaN(dt.getTime()) ? 'Now' : dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }) }],
          };
        });

        setAnnouncements(mapped);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAnnouncements([]);
        setLoadError(error.message || 'Unable to load announcements.');
      }
    };

    loadAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [profile]);

  const filters = ['All', 'Reschedule', 'Update', 'Reminder', 'General'];

  const filteredAnnouncements = activeFilter === 'All'
    ? announcements
    : announcements.filter(a => a.type === activeFilter.toLowerCase());

  const unreadCount = announcements.filter(a => !a.read).length;

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) chatInputRef.current?.focus();
  }, [chatOpen]);

  const openChat = (announcement) => {
    // Mark as read
    setAnnouncements(prev => prev.map(a =>
      a.id === announcement.id ? { ...a, read: true } : a
    ));
    setChatAnnouncement(announcement);
    setChatMessages(announcement.chatHistory || []);
    setChatOpen(true);
  };

  const closeChat = () => {
    // Save chat history back
    if (chatAnnouncement) {
      setAnnouncements(prev => prev.map(a =>
        a.id === chatAnnouncement.id ? { ...a, chatHistory: chatMessages } : a
      ));
    }
    setChatOpen(false);
    setChatAnnouncement(null);
    setChatMessages([]);
    setChatInput('');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });

    const userMsg = { from: 'user', text: chatInput.trim(), time: timeStr };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
  };

  const markAllRead = () => {
    setAnnouncements(prev => prev.map(a => ({ ...a, read: true })));
  };

  return (
    <div className="ann-page">
      {/* Topbar */}
      <header className="ann-topbar">
        <div className="ann-topbar__left">
          <div className="ann-breadcrumb">
            <span onClick={() => onNavigate('home-logged')}>Dashboard</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="ann-breadcrumb__current">Announcements</span>
          </div>
        </div>
        <div className="ann-topbar__right">
          <button className="ann-icon-btn ann-bell">
            <BellIcon />
            {unreadCount > 0 && <span className="ann-bell__dot" />}
          </button>
          <div className="ann-profile">
            <div className="ann-profile__info">
              <span className="ann-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="ann-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ann-main">
        <div className="ann-container">
          {loadError ? <p>{loadError}</p> : null}
          {/* Header */}
          <div className="ann-header">
            <div className="ann-header__text">
              <div className="ann-header__title-row">
                <MegaphoneIcon />
                <h1>Announcements</h1>
                {unreadCount > 0 && (
                  <span className="ann-header__unread-badge">{unreadCount} new</span>
                )}
              </div>
              <p>Messages and updates from BatasMo Admin</p>
            </div>
            {unreadCount > 0 && (
              <button className="ann-mark-all-btn" onClick={markAllRead}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="ann-filters">
            {filters.map(f => (
              <button
                key={f}
                className={`ann-filter-btn ${activeFilter === f ? 'ann-filter-btn--active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
                {f !== 'All' && (
                  <span className="ann-filter-count">
                    {announcements.filter(a => a.type === f.toLowerCase()).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Announcement Cards */}
          <div className="ann-list">
            {filteredAnnouncements.length === 0 ? (
              <div className="ann-empty">
                <MegaphoneIcon />
                <p>No {activeFilter.toLowerCase()} announcements</p>
              </div>
            ) : (
              filteredAnnouncements.map(ann => {
                const typeColor = getTypeColor(ann.type);
                return (
                  <div key={ann.id} className={`ann-card ${!ann.read ? 'ann-card--unread' : ''}`}>
                    <div className="ann-card__left">
                      {getTypeIcon(ann.type)}
                      {!ann.read && <span className="ann-card__unread-dot" />}
                    </div>
                    <div className="ann-card__body">
                      <div className="ann-card__top-row">
                        <span className="ann-card__title">{ann.title}</span>
                        <span className="ann-card__type-label" style={{ background: typeColor.bg, color: typeColor.color }}>
                          {getTypeLabel(ann.type)}
                        </span>
                        {ann.priority === 'high' && (
                          <span className="ann-card__priority">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="none">
                              <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6z"/><rect x="11" y="10" width="2" height="4"/><rect x="11" y="16" width="2" height="2"/>
                            </svg>
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="ann-card__message">{ann.message}</p>
                      <div className="ann-card__footer">
                        <span className="ann-card__date">
                          <CalendarSmall /> {ann.date}
                        </span>
                        <span className="ann-card__from">From: {ann.adminName}</span>
                      </div>
                    </div>
                    <div className="ann-card__actions">
                      <button className="ann-chat-btn" onClick={() => openChat(ann)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Chat Now
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ── Chat Panel (slide-in) ── */}
      {chatOpen && chatAnnouncement && (
        <>
          <div className="ann-chat-overlay" onClick={closeChat} />
          <div className="ann-chat-panel">
            {/* Chat Header */}
            <div className="ann-chat__header">
              <div className="ann-chat__header-info">
                <div className="ann-chat__header-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <span className="ann-chat__header-name">{chatAnnouncement.adminName}</span>
                  <span className="ann-chat__header-status">
                    <span className="ann-chat__online-dot" />
                    Online
                  </span>
                </div>
              </div>
              <button className="ann-chat__close-btn" onClick={closeChat}>
                <CloseIcon />
              </button>
            </div>

            {/* Announcement context banner */}
            <div className="ann-chat__context">
              <span className="ann-chat__context-label">Regarding:</span>
              <span className="ann-chat__context-title">{chatAnnouncement.title}</span>
            </div>

            {/* Messages */}
            <div className="ann-chat__messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`ann-chat__bubble ${msg.from === 'user' ? 'ann-chat__bubble--user' : 'ann-chat__bubble--admin'}`}>
                  {msg.from === 'admin' && (
                    <div className="ann-chat__bubble-avatar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                  )}
                  <div className="ann-chat__bubble-content">
                    <p>{msg.text}</p>
                    <span className="ann-chat__bubble-time">{msg.time}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form className="ann-chat__input-bar" onSubmit={sendMessage}>
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Type your message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="ann-chat__send-btn" disabled={!chatInput.trim()}>
                <SendIcon />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default Announcements;
