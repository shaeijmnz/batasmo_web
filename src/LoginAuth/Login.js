import { useEffect, useState } from 'react';
import './Login.css';
import { checkEmailLockout, signInWithEmail } from '../lib/authApi';
import { getCurrentSessionProfile, normalizeRole, pageFromRole } from '../lib/userApi';
import { isValidEmail, VALID_EMAIL_MESSAGE } from '../lib/validators';

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = ({ color = '#9ca3af' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ show }) => (
  show
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
);

function Login({ onNavigate, onAuthSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [lockedEmail, setLockedEmail] = useState('');

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatLockout = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleEmailBlur = async () => {
    const email = form.email.trim();
    if (!email || !isValidEmail(email)) return;

    try {
      const timeRemaining = await checkEmailLockout(email);
      if (timeRemaining > 0) {
        setLockoutSeconds(Math.ceil(timeRemaining));
        setLockedEmail(email.toLowerCase());
      } else if (lockedEmail === email.toLowerCase()) {
        setLockoutSeconds(0);
        setLockedEmail('');
      }
    } catch {
      // Ignore lockout probe errors to keep login responsive.
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email.trim() || !form.password) {
      setErrorText('Email and password are required.');
      return;
    }

    if (!isValidEmail(form.email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }

    if (lockoutSeconds > 0 && form.email.trim().toLowerCase() === lockedEmail) {
      setErrorText(`Account temporarily locked. Try again in ${formatLockout(lockoutSeconds)}.`);
      return;
    }

    setIsSubmitting(true);
    setErrorText('');

    try {
      const data = await signInWithEmail({
        email: form.email.trim(),
        password: form.password,
      });

      const user = data.user;
      const sessionProfile = await getCurrentSessionProfile();
      const profile = sessionProfile?.profile;

      const role = normalizeRole(profile?.role || user?.role || user?.user_metadata?.role || 'Client');
      const hydratedProfile = {
        id: profile?.id || user?.id,
        full_name: profile?.full_name || user?.name || user?.user_metadata?.full_name || '',
        email: profile?.email || user?.email || form.email.trim(),
        phone: profile?.phone || user?.phone || '',
        address: profile?.address || user?.address || '',
        role,
        age: profile?.age ?? null,
        guardian_name: profile?.guardian_name || '',
        guardian_contact: profile?.guardian_contact || '',
        guardian_details: profile?.guardian_details || '',
        updated_at: new Date().toISOString(),
      };

      if (onAuthSuccess) onAuthSuccess(hydratedProfile);
      onNavigate(pageFromRole(role));
    } catch (error) {
      if (String(error?.message || '').startsWith('LOCKOUT:')) {
        const timeRemaining = Number(String(error.message).split(':')[1] || 0);
        if (timeRemaining > 0) {
          setLockoutSeconds(timeRemaining);
          setLockedEmail(form.email.trim().toLowerCase());
          setErrorText(`Account temporarily locked. Try again in ${formatLockout(timeRemaining)}.`);
          return;
        }
      }

      const normalized = String(error?.message || '').toLowerCase();
      if (normalized.includes('email not confirmed') || normalized.includes('email not verified')) {
        localStorage.setItem('batasmo_pending_otp_email', form.email.trim());
        onNavigate('otp');
        return;
      }

      setErrorText(error.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="lg-auth-page">
      <div className="lg-auth-bg" />

      <main className="lg-auth-main">
        <div className="lg-auth-top">
          <button className="lg-back-button" onClick={() => onNavigate('home')}>
            Back
          </button>

          <div className="lg-brand-badge" onClick={() => onNavigate('home')}>
            <img src="/auth/logo.jpg" alt="BatasMo" className="lg-brand-logo" />
            <span className="lg-brand-text">BatasMo</span>
          </div>
        </div>

        <section className="lg-hero-card">
          <p className="lg-kicker">SECURE CLIENT ACCESS</p>
          <h1>Welcome back</h1>
          <p>Sign in to continue managing your consultations, appointments, and legal records.</p>

          <div className="lg-segment-wrap">
            <button type="button" className="lg-segment-btn lg-segment-btn--active">LOG IN</button>
            <button type="button" className="lg-segment-btn" onClick={() => onNavigate('signup')}>SIGN UP</button>
          </div>
        </section>

        <section className="lg-form-card">
          <div className="lg-form-heading">
            <h2>Secure Access</h2>
            <p>Use your credentials to continue.</p>
          </div>

          <form className="lg-form" onSubmit={handleSubmit}>
            <div className="lg-input-group">
              <label>Email Address</label>
              <div className="lg-input-wrap">
                <MailIcon />
                <input
                  type="email"
                  name="email"
                  placeholder="name@domain.com"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleEmailBlur}
                />
              </div>
            </div>

            <div className="lg-input-group">
              <label>Password</label>
              <div className="lg-input-wrap">
                <LockIcon />
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                />
                <button type="button" className="lg-eye" onClick={() => setShowPass(!showPass)}>
                  <EyeIcon show={showPass} />
                </button>
              </div>
            </div>

            <div className="lg-options-row">
              <label className="lg-checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe((prev) => !prev)}
                />
                <span className="lg-checkmark" />
                <span className="lg-option-text">Remember me</span>
              </label>

              <button type="button" className="lg-link-button" onClick={() => onNavigate('forgot-password')}>
                Forgot password?
              </button>
            </div>

            {errorText ? <p className="lg-error-text">{errorText}</p> : null}

            <button
              type="submit"
              className="lg-primary-btn"
              disabled={isSubmitting || (lockoutSeconds > 0 && form.email.trim().toLowerCase() === lockedEmail)}
            >
              {lockoutSeconds > 0 && form.email.trim().toLowerCase() === lockedEmail
                ? `Locked (${formatLockout(lockoutSeconds)})`
                : isSubmitting
                  ? 'Signing In...'
                  : 'LOG IN'}
            </button>
          </form>

          <div className="lg-footer-row">
            <span>Don&apos;t have an account? </span>
            <button type="button" className="lg-link-button" onClick={() => onNavigate('signup')}>
              Sign up
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
