import { useState, useRef, useEffect } from 'react';
import './ChatRoom.css';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

function ChatRoom({ onNavigate }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'system',
      text: 'You are now connected with the BatasMo Admin. Feel free to raise any concerns, questions, or requests.',
      time: formatTime(new Date()),
    },
    {
      id: 2,
      from: 'admin',
      text: 'Hello! Welcome to BatasMo Support. I\'m the Admin. How can I assist you today?',
      time: formatTime(new Date()),
    },
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const adminResponses = [
    'Thank you for reaching out! I\'ll look into that for you right away.',
    'I understand your concern. Let me check the details and get back to you shortly.',
    'Sure! I can assist you with that. Could you please provide more information so I can process your request?',
    'Got it! I\'ll coordinate with the attorney regarding your request and update you as soon as possible.',
    'Thank you for informing us. I will escalate this to the appropriate team member and follow up with you.',
    'I\'ve noted your concern. Please allow us some time to review and we\'ll reach out to you with an update.',
    'Of course! For appointment-related concerns, you can also visit the My Appointments page for quick updates.',
    'Thank you for your patience. We\'re here to help — please don\'t hesitate to ask if you have further questions.',
  ];

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || sessionEnded) return;

    const userMessage = {
      id: messages.length + 1,
      from: 'client',
      text: inputMsg.trim(),
      time: formatTime(new Date()),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMsg('');

    // Simulate admin typing
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const response = adminResponses[Math.floor(Math.random() * adminResponses.length)];
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          from: 'admin',
          text: response,
          time: formatTime(new Date()),
        },
      ]);
    }, 1500 + Math.random() * 1500);
  };

  const handleEndSession = () => {
    setShowEndModal(false);
    setSessionEnded(true);
    setMessages(prev => [
      ...prev,
      {
        id: prev.length + 1,
        from: 'system',
        text: 'Chat session has ended. Thank you for contacting BatasMo Support. Have a great day!',
        time: formatTime(new Date()),
      },
    ]);
  };

  return (
    <div className="cr-page">
      {/* Header */}
      <header className="cr-header">
        <div className="cr-header__left">
          <button className="cr-back-btn" onClick={() => onNavigate('home-logged')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="cr-header__logo">
            <ScalesIcon size={22} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="cr-header__info">
          <div className="cr-header__attorney">
            <div className="cr-header__avatar cr-header__avatar--admin">AD</div>
            <div className="cr-header__details">
              <span className="cr-header__name">Admin</span>
              <span className="cr-header__area">Support &amp; Inquiries</span>
            </div>
          </div>
          <div className="cr-header__status">
            {!sessionEnded && <span className="cr-online-dot" />}
            <span>{sessionEnded ? 'Session Ended' : 'Online'}</span>
          </div>
        </div>
        <div className="cr-header__right">
          {!sessionEnded && (
            <button className="cr-end-btn" onClick={() => setShowEndModal(true)}>
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <div className="cr-chat-area">
        {/* Session Info Bar */}
        <div className="cr-session-bar">
          <div className="cr-session-bar__info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>This is a secure channel. Chat directly with our Admin for any concerns.</span>
          </div>
          <span className="cr-session-bar__date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Messages */}
        <div className="cr-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`cr-msg cr-msg--${msg.from}`}>
              {msg.from === 'admin' && (
                <div className="cr-msg__avatar cr-msg__avatar--admin">AD</div>
              )}
              <div className="cr-msg__content">
                {msg.from === 'system' ? (
                  <div className="cr-msg__system">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>{msg.text}</span>
                  </div>
                ) : (
                  <>
                    <div className="cr-msg__bubble">
                      {msg.from === 'admin' && <span className="cr-msg__sender">Admin</span>}
                      <p>{msg.text}</p>
                    </div>
                    <span className="cr-msg__time">{msg.time}</span>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="cr-msg cr-msg--admin">
              <div className="cr-msg__avatar cr-msg__avatar--admin">AD</div>
              <div className="cr-msg__content">
                <div className="cr-msg__bubble cr-typing">
                  <div className="cr-typing__dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form className="cr-input-bar" onSubmit={handleSend}>
          {sessionEnded ? (
            <div className="cr-ended-bar">
              <p>This consultation has ended.</p>
              <button type="button" className="cr-return-btn" onClick={() => onNavigate('home-logged')}>
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="cr-input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type your message..."
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  disabled={sessionEnded}
                />
              </div>
              <button type="submit" className="cr-send-btn" disabled={!inputMsg.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </>
          )}
        </form>
      </div>

      {/* End Session Modal */}
      {showEndModal && (
        <div className="cr-modal-overlay" onClick={() => setShowEndModal(false)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cr-modal__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3>Close Chat?</h3>
            <p>Are you sure you want to end your chat with Admin? You can always start a new conversation.</p>
            <div className="cr-modal__actions">
              <button className="cr-modal__cancel" onClick={() => setShowEndModal(false)}>
                Continue Chat
              </button>
              <button className="cr-modal__confirm" onClick={handleEndSession}>
                Close Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;
