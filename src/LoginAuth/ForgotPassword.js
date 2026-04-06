import { useState } from 'react';
import './ForgotPassword.css';
import { isValidEmail, VALID_EMAIL_MESSAGE } from '../lib/validators';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

const MailIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const MailInputIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [errorText, setErrorText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }
    setErrorText('');
    onNavigate('reset-password');
  };

  return (
    <div className="fp-page">
      {/* Navbar */}
      <nav className="fp-nav">
        <div className="fp-nav__inner">
          <div className="fp-nav__logo" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
            <ScalesIcon size={28} color="#f5a623" />
            <span>BatasMo</span>
          </div>
          <ul className="fp-nav__links">
            <li><a href="#home" onClick={() => onNavigate('home')}>Home</a></li>
            <li><a href="#attorneys">Attorneys</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#about">About</a></li>
          </ul>
          <div className="fp-nav__actions">
            <button className="fp-btn fp-btn--outline" onClick={() => onNavigate('login')}>Login</button>
            <button className="fp-btn fp-btn--gold" onClick={() => onNavigate('signup')}>Sign Up</button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="fp-main">
        <div className="fp-card">
          <div className="fp-card__icon-wrap">
            <MailIcon />
          </div>
          <h2 className="fp-card__title">Forgot Password?</h2>
          <p className="fp-card__sub">
            No worries! Enter your registered email address and we'll send you a link to reset your password.
          </p>

          <form className="fp-form" onSubmit={handleSubmit}>
            <div className="fp-field">
              <label>Email Address</label>
              <div className="fp-input-wrap">
                <MailInputIcon />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="fp-btn fp-btn--primary fp-btn--full">
              Send Reset Link
            </button>
            {errorText ? <p>{errorText}</p> : null}
          </form>

          <button className="fp-back" onClick={() => onNavigate('login')}>
            ← Back to Login
          </button>
        </div>
      </main>
    </div>
  );
}

export default ForgotPassword;
