import { useEffect, useState } from 'react';
import './ForgotPassword.css';
import {
  resendPasswordRecoveryOtp,
  startPasswordRecovery,
  verifyRecoveryOtp,
} from '../lib/authApi';
import { isValidEmail, VALID_EMAIL_MESSAGE } from '../lib/validators';

const RECOVERY_ACTIVE_KEY = 'batasmo_recovery_active';
const RECOVERY_EMAIL_KEY = 'batasmo_recovery_email';
const RECOVERY_VERIFIED_KEY = 'batasmo_recovery_verified';

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

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  const message = String(error.message || error || '').trim();
  const normalized = message.toLowerCase();

  if (normalized.includes('rate limit')) {
    return 'Too many OTP requests right now. Please wait a few minutes before trying again.';
  }

  if (normalized.includes('security purposes') && normalized.includes('60 seconds')) {
    return 'Please wait 60 seconds before requesting another OTP.';
  }

  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  return fallback;
};

function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState(String(localStorage.getItem(RECOVERY_EMAIL_KEY) || '').trim());
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [timer, setTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (timer <= 0) return undefined;
    const timeout = setTimeout(() => setTimer((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [timer]);

  const handleBackToLogin = () => {
    localStorage.removeItem(RECOVERY_ACTIVE_KEY);
    localStorage.removeItem(RECOVERY_EMAIL_KEY);
    localStorage.removeItem(RECOVERY_VERIFIED_KEY);
    onNavigate('login');
  };

  const handleSendOtp = async () => {
    if (!isValidEmail(email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }

    setErrorText('');
    setIsSubmitting(true);

    try {
      await startPasswordRecovery({ email: email.trim() });
      localStorage.setItem(RECOVERY_ACTIVE_KEY, 'true');
      localStorage.setItem(RECOVERY_EMAIL_KEY, email.trim());
      localStorage.removeItem(RECOVERY_VERIFIED_KEY);
      setStep('otp');
      setOtp('');
      setTimer(59);
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Failed to send OTP. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0 || isResending) return;
    if (!isValidEmail(email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }

    setErrorText('');
    setIsResending(true);

    try {
      await resendPasswordRecoveryOtp({ email: email.trim() });
      setTimer(59);
      setOtp('');
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Failed to resend OTP. Please try again.'));
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setErrorText('Please enter the 6-digit OTP sent to your email.');
      return;
    }

    setErrorText('');
    setIsSubmitting(true);

    try {
      await verifyRecoveryOtp({ email: email.trim(), token: otp });
      localStorage.setItem(RECOVERY_ACTIVE_KEY, 'true');
      localStorage.setItem(RECOVERY_VERIFIED_KEY, 'true');
      localStorage.setItem(RECOVERY_EMAIL_KEY, email.trim());
      onNavigate('reset-password');
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Invalid or expired OTP. Please request a new code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 'email') {
      await handleSendOtp();
      return;
    }

    await handleVerifyOtp();
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
            {step === 'email'
              ? "Enter your registered email and we'll send a 6-digit OTP code."
              : 'Enter only the 6-digit OTP code from your email to continue password reset.'}
          </p>

          <form className="fp-form" onSubmit={handleSubmit}>
            {step === 'email' ? (
              <div className="fp-field">
                <label>Email Address</label>
                <div className="fp-input-wrap">
                  <MailInputIcon />
                  <input
                    type="email"
                    placeholder=""
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="fp-field">
                  <label>Email Address</label>
                  <div className="fp-input-wrap">
                    <MailInputIcon />
                    <input type="email" value={email} readOnly />
                  </div>
                </div>

                <div className="fp-field">
                  <label>One-Time Password (OTP)</label>
                  <div className="fp-input-wrap">
                    <MailInputIcon />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder=""
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="fp-btn fp-btn--primary fp-btn--full"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? step === 'email'
                  ? 'Sending OTP...'
                  : 'Verifying OTP...'
                : step === 'email'
                  ? 'Send OTP'
                  : 'Verify OTP'}
            </button>

            {step === 'otp' ? (
              <>
                <p className="fp-resend-text">
                  {timer > 0
                    ? `Resend code in 00:${String(timer).padStart(2, '0')}`
                    : 'Didn\'t receive a code?'}
                </p>
                <button
                  type="button"
                  className="fp-btn fp-btn--outline fp-btn--full fp-btn--outline-card"
                  disabled={timer > 0 || isSubmitting || isResending}
                  onClick={handleResendOtp}
                >
                  {isResending ? 'Resending OTP...' : 'Resend OTP'}
                </button>
              </>
            ) : null}

            {errorText ? <p>{errorText}</p> : null}
          </form>

          <button className="fp-back" onClick={handleBackToLogin}>
            ← Back to Login
          </button>
        </div>
      </main>
    </div>
  );
}

export default ForgotPassword;
