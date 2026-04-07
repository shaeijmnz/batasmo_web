import { useState, useEffect, useRef } from 'react';
import './OtpVerification.css';
import { resendSignUpOtp, verifySignUpOtp } from '../lib/authApi';
import { getCurrentSessionProfile, pageFromRole } from '../lib/userApi';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="12" cy="12" r="3" fill="#1e3a8a" stroke="none" />
  </svg>
);

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  if (typeof error.error_description === 'string') return error.error_description;
  return fallback;
};

function OtpVerification({ onNavigate, email = '', role = 'Client' }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorText, setErrorText] = useState('');
  const inputs = useRef([]);

  const pendingEmail = String(email || localStorage.getItem('batasmo_pending_otp_email') || '').trim();
  const pendingRole = String(role || localStorage.getItem('batasmo_pending_otp_role') || 'Client');

  /* mask email: john***@example.com */
  const maskedEmail = pendingEmail
    ? pendingEmail.replace(/^(.{4}).*(@.*)$/, '$1***$2')
    : 'your***@email.com';

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const handleChange = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputs.current[idx + 1].focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1].focus();
    }
  };

  const handleResend = () => {
    if (!pendingEmail || isResending || timer > 0) return;

    setErrorText('');
    setIsResending(true);

    resendSignUpOtp({ email: pendingEmail })
      .then(() => {
        setTimer(59);
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      })
      .catch((error) => {
        setErrorText(getErrorMessage(error, 'Failed to resend OTP.'));
      })
      .finally(() => {
        setIsResending(false);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = otp.join('');
    if (!pendingEmail) {
      setErrorText('Missing signup email context. Please sign up again.');
      return;
    }

    if (token.length !== 6) {
      setErrorText('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setErrorText('');
      setIsVerifying(true);
      await verifySignUpOtp({ email: pendingEmail, token });

      localStorage.removeItem('batasmo_pending_otp_email');
      localStorage.removeItem('batasmo_pending_otp_role');

      try {
        const { profile } = await getCurrentSessionProfile();
        if (profile?.role) {
          onNavigate(pageFromRole(profile.role));
          return;
        }
      } catch {
        // Fallback to role passed from signup context.
      }

      onNavigate(pageFromRole(pendingRole));
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Invalid or expired OTP code.'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="otp-page">
      {/* Navbar */}
      <nav className="otp-nav">
        <div className="otp-nav__inner">
          <div className="otp-nav__logo" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
            <ScalesIcon size={28} color="#f5a623" />
            <span>BatasMo</span>
          </div>
          <ul className="otp-nav__links">
            <li><a href="#home" onClick={() => onNavigate('home')}>Home</a></li>
            <li><a href="#attorneys">Attorneys</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#about">About</a></li>
          </ul>
        </div>
      </nav>

      {/* Main */}
      <main className="otp-main">
        <div className="otp-card">
          <div className="otp-card__icon-wrap">
            <ShieldIcon />
          </div>
          <h2 className="otp-card__title">OTP Verification</h2>
          <p className="otp-card__sub">
            Enter the 6-digit code sent to your email address<br />
            <span className="otp-card__email">{maskedEmail}</span>
          </p>

          <form className="otp-form" onSubmit={handleSubmit}>
            <div className="otp-boxes">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputs.current[i] = el}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(e.target.value, i)}
                  onKeyDown={e => handleKeyDown(e, i)}
                />
              ))}
            </div>

            <button type="submit" className="otp-btn" disabled={isVerifying}>
              {isVerifying ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          {errorText ? <p>{errorText}</p> : null}

          <p className="otp-resend-timer">
            Resend code in <span>00:{String(timer).padStart(2, '0')}</span>
          </p>
          <button
            className="otp-resend-btn"
            onClick={handleResend}
            disabled={timer > 0 || isResending || !pendingEmail}
          >
            {isResending ? 'Resending...' : 'Resend Code'}
          </button>

          <button className="otp-back" onClick={() => onNavigate('signup')}>
            ← Back to Sign Up
          </button>
        </div>
      </main>
    </div>
  );
}

export default OtpVerification;
