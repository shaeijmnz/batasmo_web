import { useEffect, useState } from 'react';
import './HomePage.css';
import { fetchClientHomeData } from '../lib/userApi';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CalendarIcon = ({ size = 28, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const DocumentIcon = ({ size = 28, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const AIIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z" />
    <circle cx="9" cy="13" r="1" fill="#fff" stroke="none" />
    <circle cx="15" cy="13" r="1" fill="#fff" stroke="none" />
    <path d="M9 17s1 1 3 1 3-1 3-1" />
  </svg>
);

const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const MyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="15" x2="16" y2="15"/>
  </svg>
);
const NotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);
const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const TransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

function HomePage({ onNavigate, profile, onSignOut }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('Dashboard');
  const [chatMsg, setChatMsg] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!profile?.id) return;

      try {
        const { appointments: appts, notifications: notif } = await fetchClientHomeData(profile.id);
        if (isMounted) {
          setAppointments(appts);
          setNotifications(notif);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Failed to load dashboard data.');
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'booking':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        );
      case 'approved':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        );
      case 'payment':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        );
      case 'reminder':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        );
      case 'rejected':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      case 'admin_announcement':
      case 'admin_message':
      case 'admin_notice':
      case 'notarial_update':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getNotifColor = (type) => {
    switch (type) {
      case 'booking': return '#eff6ff';
      case 'approved': return '#ecfdf5';
      case 'payment': return '#fffbeb';
      case 'reminder': return '#eef2ff';
      case 'rejected': return '#fef2f2';
      case 'admin_announcement':
      case 'admin_message':
      case 'admin_notice':
      case 'notarial_update':
        return '#eff6ff';
      default: return '#f3f4f6';
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    setMessages(prev => [
      ...prev,
      { from: 'user', text: chatMsg }
    ]);
    setChatMsg('');
  };

  return (
    <div className="hp-page">

      {/* Sidebar overlay */}
      {sidebarOpen && <div className="hp-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`hp-sidebar ${sidebarOpen ? 'hp-sidebar--open' : ''}`}>
        <div className="hp-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="hp-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <DashboardIcon /> },
            { label: 'Book Appointment',    icon: <CalendarIcon size={18} color="#9ca3af" /> },
            { label: 'My Appointments',     icon: <MyApptIcon /> },
            { label: 'Notarial Requests',   icon: <NotarialIcon /> },
            { label: 'Announcements',       icon: <AnnouncementIcon /> },
            { label: 'Transaction History', icon: <TransactionIcon /> },
            { label: 'Profile',             icon: <ProfileIcon /> },
          ].map(item => (
            <button
              key={item.label}
              className={`hp-sidebar__item ${activePage === item.label ? 'hp-sidebar__item--active' : ''}`}
              onClick={() => { setActivePage(item.label); setSidebarOpen(false); if (item.label === 'Profile') onNavigate('profile'); if (item.label === 'Book Appointment') onNavigate('book-appointment'); if (item.label === 'My Appointments') onNavigate('my-appointments'); if (item.label === 'Notarial Requests') onNavigate('my-notarial-requests'); if (item.label === 'Announcements') onNavigate('announcements'); if (item.label === 'Transaction History') onNavigate('transaction-history'); }}
            >
              <span className="hp-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="hp-topbar">
        <div className="hp-topbar__left">
          <button className="hp-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="hp-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="hp-topbar__right">
          <button className="hp-icon-btn hp-msg-btn" onClick={() => onNavigate('chat-room')} title="Message Admin">
            <MessageIcon />
          </button>
          <div className="hp-bell-wrapper">
            <button className="hp-icon-btn hp-bell" onClick={() => setNotifOpen(!notifOpen)}>
              <BellIcon />
              {unreadCount > 0 && <span className="hp-bell__dot">{unreadCount}</span>}
            </button>

            {/* Notification Dropdown */}
            {notifOpen && (
              <>
                <div className="hp-notif-overlay" onClick={() => setNotifOpen(false)} />
                <div className="hp-notif-panel">
                  <div className="hp-notif-panel__header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button className="hp-notif-mark-all" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="hp-notif-panel__list">
                    {notifications.length === 0 ? (
                      <div className="hp-notif-empty">No notifications yet</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`hp-notif-item ${!n.read ? 'hp-notif-item--unread' : ''}`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <div className="hp-notif-item__icon" style={{ background: getNotifColor(n.type) }}>
                            {getNotifIcon(n.type)}
                          </div>
                          <div className="hp-notif-item__content">
                            <span className="hp-notif-item__title">{n.title}</span>
                            <p className="hp-notif-item__desc">{n.desc}</p>
                            <span className="hp-notif-item__time">{n.time}</span>
                          </div>
                          {!n.read && <span className="hp-notif-item__dot" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="hp-profile" onClick={() => onNavigate('profile')} style={{ cursor: 'pointer' }}>
            <div className="hp-profile__info">
              <span className="hp-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="hp-avatar">{(profile?.full_name || 'C').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="hp-main">
        {/* Welcome */}
        <div className="hp-welcome">
          <h1>Welcome Back, {profile?.full_name || 'Client'}</h1>
          <p>Here's what's happening with your legal matters today.</p>
        </div>
        {loadError ? <p>{loadError}</p> : null}

        {/* Action Cards */}
        <div className="hp-actions">
          <div className="hp-action-card" onClick={() => onNavigate('book-appointment')}>
            <div className="hp-action-card__icon">
              <CalendarIcon />
            </div>
            <div>
              <h3>Book New Appointment</h3>
              <p>Schedule a consultation with our expert attorneys</p>
            </div>
          </div>
          <div className="hp-action-card" onClick={() => onNavigate('notarial-request')}>
            <div className="hp-action-card__icon">
              <DocumentIcon />
            </div>
            <div>
              <h3>Request Notarial Service</h3>
              <p>Get your documents notarized quickly and securely</p>
            </div>
          </div>
        </div>

        {/* Consultation Queue */}
        <div className="hp-queue-card">
          <div className="hp-queue-card__header">
            <h2>Consultation Queue</h2>
            <button className="hp-view-all" onClick={() => onNavigate('my-appointments')}>View All</button>
          </div>
          <p className="hp-queue-subtitle">Your upcoming consultations sorted by date</p>
          <div className="hp-queue-list">
            {[...appointments]
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((a, i) => {
                const today = new Date();
                const apptDate = new Date(a.date);
                const isToday = today.toDateString() === apptDate.toDateString();
                const isPast = apptDate < new Date(today.toDateString());
                const daysUntil = Math.ceil((apptDate - new Date(today.toDateString())) / (1000 * 60 * 60 * 24));
                
                const formatDate = (dateStr) => {
                  const d = new Date(dateStr);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                };

                return (
                  <div key={i} className={`hp-queue-item ${isToday ? 'hp-queue-item--today' : ''} ${isPast ? 'hp-queue-item--past' : ''}`}>
                    <div className="hp-queue-item__position">
                      <span className="hp-queue-number">{i + 1}</span>
                    </div>
                    <div className="hp-queue-item__date-block">
                      <span className="hp-queue-month">{new Date(a.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="hp-queue-day">{new Date(a.date).getDate()}</span>
                    </div>
                    <div className="hp-queue-item__info">
                      <span className="hp-queue-item__name">{a.name}</span>
                      <span className="hp-queue-item__area">{a.area}</span>
                      <span className="hp-queue-item__time">
                        <ClockIcon /> {formatDate(a.date)} at {new Date(a.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                    <div className="hp-queue-item__right">
                      <div className="hp-queue-item__badges">
                        <span className={`hp-badge hp-badge--status hp-badge--${String(a.status).toLowerCase()}`}>{a.status}</span>
                        <span className={`hp-badge hp-badge--pay hp-badge--${a.payment.toLowerCase()}`}>{a.payment}</span>
                      </div>
                      {isToday && a.payment === 'Paid' ? (
                        <div className="hp-queue-item__today-actions">
                          <span className="hp-today-label">🔴 TODAY</span>
                          <button className="hp-enter-room-btn" onClick={() => onNavigate('chat-room')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Enter Room
                          </button>
                        </div>
                      ) : isToday && a.payment !== 'Paid' ? (
                        <div className="hp-queue-item__today-actions">
                          <span className="hp-today-label">🔴 TODAY</span>
                          <span className="hp-payment-needed">Pay first to enter</span>
                        </div>
                      ) : isPast ? (
                        <span className="hp-queue-item__status-text hp-queue-item__status-text--past">Completed</span>
                      ) : (
                        <span className="hp-queue-item__status-text">
                          {daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </main>

      {/* AI Chatbot FAB */}
      <button className="hp-chat-fab" onClick={() => setChatOpen(!chatOpen)} title="AI Assistant">
        <AIIcon />
      </button>

      {/* Chat Window */}
      {chatOpen && (
        <div className="hp-chat-window">
          <div className="hp-chat-window__header">
            <div className="hp-chat-window__title">
              <AIIcon />
              <span>BatasMo AI</span>
            </div>
            <button className="hp-chat-window__close" onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <div className="hp-chat-window__messages">
            {messages.map((m, i) => (
              <div key={i} className={`hp-msg hp-msg--${m.from}`}>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <form className="hp-chat-window__input" onSubmit={sendMessage}>
            <input
              type="text"
              placeholder="Ask me anything..."
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
            />
            <button type="submit">➤</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default HomePage;
