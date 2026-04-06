import { useState, useRef, useEffect } from 'react';
import './AttorneyMessages.css';
import {
  fetchAppointmentMessages,
  fetchAttorneyUpcomingAppointments,
  sendAppointmentMessage,
} from '../lib/userApi';

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

export default function AttorneyMessages({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [activeAppointmentId, setActiveAppointmentId] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [loadError, setLoadError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const loadAppointments = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyUpcomingAppointments(profile.id);
        if (!isMounted) return;

        setAppointments(rows);
        if (!activeAppointmentId && rows.length > 0) {
          setActiveAppointmentId(rows[0].id);
        }
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAppointments([]);
        setLoadError(error.message || 'Unable to load consultation threads.');
      }
    };

    loadAppointments();

    return () => {
      isMounted = false;
    };
  }, [profile, activeAppointmentId]);

  useEffect(() => {
    if (!activeAppointmentId) {
      setMessages([]);
      setIsClosed(false);
      return undefined;
    }

    let isMounted = true;
    const loadMessages = async () => {
      try {
        const { messages: rows, isClosed: closed } = await fetchAppointmentMessages(activeAppointmentId);
        if (!isMounted) return;
        const mapped = rows.map((item) => ({
          id: item.id,
          sender: item.isMine ? 'attorney' : 'client',
          text: item.text,
          time: item.time,
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
    const intervalId = setInterval(loadMessages, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeAppointmentId]);

  const handleSend = async () => {
    if (!input.trim() || !activeAppointmentId || isClosed) return;

    try {
      await sendAppointmentMessage(activeAppointmentId, input.trim());
      setInput('');
      const { messages: rows, isClosed: closed } = await fetchAppointmentMessages(activeAppointmentId);
      const mapped = rows.map((item) => ({
        id: item.id,
        sender: item.isMine ? 'attorney' : 'client',
        text: item.text,
        time: item.time,
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
    }
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
    { label: 'Messages',     icon: <MessagesIcon />,     nav: null },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile',      icon: <ProfileIcon />,      nav: 'attorney-profile' },
  ];

  const activeAppointment = appointments.find((item) => item.id === activeAppointmentId) || null;
  const chatName = activeAppointment?.name || 'Client';
  const chatInitials = chatName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
              className={`am-sidebar__item ${item.label === 'Messages' ? 'am-sidebar__item--active' : ''}`}
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
          {appointments.length > 0 ? (
            <select
              value={activeAppointmentId}
              onChange={(e) => setActiveAppointmentId(e.target.value)}
              style={{ marginLeft: 'auto' }}
            >
              {appointments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.area}
                </option>
              ))}
            </select>
          ) : null}
        </div>

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
                    <p className="am-bubble__text">{msg.text}</p>
                    <span className="am-bubble__time">{msg.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="am-input-bar">
          <textarea
            className="am-input-bar__textarea"
            rows="1"
            placeholder={isClosed ? 'Consultation closed' : 'Type a message...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isClosed || !activeAppointmentId}
          />
          <button
            className="am-input-bar__send"
            onClick={handleSend}
            disabled={!input.trim() || isClosed || !activeAppointmentId}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
