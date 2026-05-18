import { useEffect, useState } from 'react';
import './ForgotPassword.css';
import { supabase } from '../lib/supabaseClient';
import { updatePasswordForCurrentUser } from '../lib/authApi';
import { isStrongPassword, VALID_PASSWORD_MESSAGE } from '../lib/validators';

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

const LockIcon = ({ color = '#1e3a8a' }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const LockInputIcon = ({ color = '#9ca3af' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ show }) => (
  show
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  return fallback;
};

function ResetPassword({ onNavigate }) {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  useEffect(() => {
    const isRecoveryActive = localStorage.getItem(RECOVERY_ACTIVE_KEY) === 'true';
    const isRecoveryVerified = localStorage.getItem(RECOVERY_VERIFIED_KEY) === 'true';
    const recoveryEmail = String(localStorage.getItem(RECOVERY_EMAIL_KEY) || '').trim();

    if (!isRecoveryActive || !isRecoveryVerified || !recoveryEmail) {
      onNavigate('forgot-password');
    }
  }, [onNavigate]);

  const rules = {
    length:   form.password.length >= 8,
    upper:    /[A-Z]/.test(form.password),
    lower:    /[a-z]/.test(form.password),
    number:   /[0-9]/.test(form.password),
    symbol:   /[^A-Za-z0-9]/.test(form.password),
    match:    form.password && form.password === form.confirm,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isStrongPassword(form.password)) {
      setErrorText(VALID_PASSWORD_MESSAGE);
      return;
    }

    if (!rules.match) {
      setErrorText('Password confirmation does not match.');
      return;
    }

    setErrorText('');
    setSuccessText('');
    setIsSubmitting(true);

    try {
      await updatePasswordForCurrentUser({ newPassword: form.password });
      localStorage.removeItem(RECOVERY_ACTIVE_KEY);
      localStorage.removeItem(RECOVERY_VERIFIED_KEY);
      localStorage.removeItem(RECOVERY_EMAIL_KEY);

      // Do not block UI/navigation on sign-out network latency.
      supabase.auth.signOut().catch(() => {
        // Ignore: user can still proceed to login since password has been updated.
      });

      setSuccessText('Password reset complete. Please log in with your new password.');
      setIsSubmitting(false);
      onNavigate('login');
      return;
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Unable to reset password right now. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
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
            <LockIcon />
          </div>
          <h2 className="fp-card__title">Set New Password</h2>
          <p className="fp-card__sub">
            Create a strong new password for your account. Make sure it's something you'll remember!
          </p>

          <form className="fp-form" onSubmit={handleSubmit}>
            <div className="fp-field">
              <label>New Password</label>
              <div className="fp-input-wrap">
                <LockInputIcon />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder=""
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" className="fp-eye" onClick={() => setShowPass(!showPass)}>
                  <EyeIcon show={showPass} />
                </button>
              </div>
            </div>

            <div className="fp-field">
              <label>Confirm Password</label>
              <div className="fp-input-wrap">
                <LockInputIcon />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder=""
                  value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  required
                />
                <button type="button" className="fp-eye" onClick={() => setShowConfirm(!showConfirm)}>
                  <EyeIcon show={showConfirm} />
                </button>
              </div>
            </div>

            {/* Password rules */}
            <div className="fp-rules">
              <div className={`fp-rule ${rules.length ? 'fp-rule--ok' : ''}`}>
                {rules.length ? <CheckIcon /> : <span className="fp-rule__dot" />}
                At least 8 characters
              </div>
              <div className={`fp-rule ${rules.upper ? 'fp-rule--ok' : ''}`}>
                {rules.upper ? <CheckIcon /> : <span className="fp-rule__dot" />}
                One uppercase letter
              </div>
              <div className={`fp-rule ${rules.lower ? 'fp-rule--ok' : ''}`}>
                {rules.lower ? <CheckIcon /> : <span className="fp-rule__dot" />}
                One lowercase letter
              </div>
              <div className={`fp-rule ${rules.number ? 'fp-rule--ok' : ''}`}>
                {rules.number ? <CheckIcon /> : <span className="fp-rule__dot" />}
                One number
              </div>
              <div className={`fp-rule ${rules.symbol ? 'fp-rule--ok' : ''}`}>
                {rules.symbol ? <CheckIcon /> : <span className="fp-rule__dot" />}
                One symbol
              </div>
              <div className={`fp-rule ${rules.match ? 'fp-rule--ok' : ''}`}>
                {rules.match ? <CheckIcon /> : <span className="fp-rule__dot" />}
                Passwords match
              </div>
            </div>

            <button type="submit" className="fp-btn fp-btn--primary fp-btn--full" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
            </button>
            {errorText ? <p>{errorText}</p> : null}
            {successText ? <p>{successText}</p> : null}
          </form>

          <button className="fp-back" onClick={() => onNavigate('forgot-password')}>
            ← Back
          </button>
        </div>
      </main>
    </div>
  );
}

export default ResetPassword;
