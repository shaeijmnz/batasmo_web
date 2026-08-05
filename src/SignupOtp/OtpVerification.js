import { useState, useEffect, useRef, useCallback } from 'react';
import './OtpVerification.css';
import {
  PENDING_OTP_CHANNEL_KEY,
  PENDING_SIGNUP_ID_KEY,
  PENDING_SIGNUP_USER_ID_KEY,
  PENDING_SMS_PHONE_KEY,
  OTP_RESUME_LOGIN_KEY,
  OTP_RESUME_SIGNUP_KEY,
  resendSignUpOtp,
  sendSignupVerificationEmail,
  verifySignUpOtp,
} from '../lib/authApi';
import { supabase } from '../lib/supabaseClient';
import { getCurrentSessionProfile, pageFromRole } from '../lib/userApi';
import {
  beginSignupOtpFinishing,
  endSignupOtpFinishing,
  isSignupVerificationComplete,
} from '../lib/signupVerification';

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
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f2c879" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="12" cy="12" r="3" fill="#f2c879" stroke="none" />
  </svg>
);

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  if (typeof error.error_description === 'string') return error.error_description;
  return fallback;
};

/** Email-only OTP (signup). SMS toggle removed per product request. */
function OtpVerification({ onNavigate, onAuthSuccess, email = '', role = 'Client' }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [emailInitDone, setEmailInitDone] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const inputs = useRef([]);
  const emailAutoTriedRef = useRef(false);

  const pendingEmail = String(email || localStorage.getItem('batasmo_pending_otp_email') || '').trim();
  const pendingRole = String(role || localStorage.getItem('batasmo_pending_otp_role') || 'Client');
  const pendingSignupId = String(localStorage.getItem(PENDING_SIGNUP_ID_KEY) || '').trim();

  const maskedEmail = pendingEmail
    ? pendingEmail.replace(/^(.{4}).*(@.*)$/, '$1***$2')
    : 'your***@email.com';

  useEffect(() => {
    try {
      localStorage.setItem(PENDING_OTP_CHANNEL_KEY, 'email');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const guardOtpPage = async () => {
      if (!pendingEmail) {
        onNavigate('signup');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (user && isSignupVerificationComplete(user)) {
        try {
          const { profile } = await getCurrentSessionProfile();
          onNavigate(pageFromRole(profile?.role || pendingRole));
        } catch {
          onNavigate(pageFromRole(pendingRole));
        }
      }
    };

    guardOtpPage();

    return () => {
      cancelled = true;
    };
  }, [pendingEmail, pendingRole, onNavigate]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendEmailOtp = useCallback(async () => {
    const data = await sendSignupVerificationEmail({
      email: pendingEmail,
      pendingId: pendingSignupId || undefined,
    });
    if (data?.pendingId) {
      localStorage.setItem(PENDING_SIGNUP_ID_KEY, String(data.pendingId));
    }
    setEmailInitDone(true);
    setErrorText('');
    setSuccessText(
      'Verification email sent. Check Inbox and Spam — look for mail from Supabase Auth.',
    );
  }, [pendingEmail, pendingSignupId]);

  useEffect(() => {
    if (emailInitDone) {
      setTimer(59);
    }
  }, [emailInitDone]);

  useEffect(() => {
    if (!pendingEmail || emailAutoTriedRef.current) return;
    emailAutoTriedRef.current = true;
    setErrorText('');
    setEmailSending(true);
    sendEmailOtp()
      .catch((err) => {
        setErrorText(
          getErrorMessage(
            err,
            'Could not send verification email. Tap Resend Code below or use a new Gmail if you already tried signing up.',
          ),
        );
      })
      .finally(() => {
        setEmailSending(false);
      });
  }, [pendingEmail, sendEmailOtp]);

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
    setSuccessText('');
    setIsResending(true);

    const done = () => {
      setTimer(59);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    };

    resendSignUpOtp({
      email: pendingEmail,
      pendingId: pendingSignupId || undefined,
    })
      .then(() => {
        setSuccessText(
          'Verification email sent. Check Inbox and Spam — look for mail from Supabase Auth.',
        );
        done();
      })
      .catch((error) => {
        setErrorText(getErrorMessage(error, 'Failed to resend OTP.'));
      })
      .finally(() => {
        setIsResending(false);
      });
  };

  const clearOtpResumeSecrets = () => {
    try {
      sessionStorage.removeItem(OTP_RESUME_LOGIN_KEY);
      sessionStorage.removeItem(OTP_RESUME_SIGNUP_KEY);
    } catch {
      /* ignore */
    }
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

    beginSignupOtpFinishing();
    try {
      setErrorText('');
      setSuccessText('');
      setIsVerifying(true);

      const resumeRaw = sessionStorage.getItem(OTP_RESUME_SIGNUP_KEY);
      if (!resumeRaw) {
        setErrorText('Session expired. Please sign up again.');
        return;
      }
      let resume;
      try {
        resume = JSON.parse(resumeRaw);
      } catch {
        setErrorText('Session expired. Please sign up again.');
        return;
      }

      const verified = await verifySignUpOtp({
        email: pendingEmail,
        token,
        password: resume.password,
        pendingId: pendingSignupId || undefined,
      });
      let clientProfile = verified?.profile || null;

      if (!clientProfile?.id) {
        throw new Error('Account verified but profile did not load. Please try signing up again.');
      }

      if (typeof onAuthSuccess !== 'function') {
        throw new Error('App auth handler missing. Please refresh and try again.');
      }

      onAuthSuccess(clientProfile);

      localStorage.removeItem('batasmo_pending_otp_email');
      localStorage.removeItem('batasmo_pending_otp_role');
      localStorage.removeItem(PENDING_OTP_CHANNEL_KEY);
      localStorage.removeItem(PENDING_SIGNUP_ID_KEY);
      localStorage.removeItem(PENDING_SIGNUP_USER_ID_KEY);
      localStorage.removeItem(PENDING_SMS_PHONE_KEY);
      clearOtpResumeSecrets();
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Invalid or expired OTP code.'));
    } finally {
      endSignupOtpFinishing();
      setIsVerifying(false);
    }
  };

  return (
    <div className="otp-page">
      <nav className="otp-nav">
        <div className="otp-nav__inner">
          <div className="otp-nav__logo" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
            <ScalesIcon size={28} color="#f5a623" />
            <span>LegalLink</span>
          </div>
          <ul className="otp-nav__links">
            <li><a href="#home" onClick={() => onNavigate('home')}>Home</a></li>
            <li><a href="#attorneys">Attorneys</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#about">About</a></li>
          </ul>
        </div>
      </nav>

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

          {emailSending ? (
            <p className="otp-sms-status">Sending verification code to your Gmail...</p>
          ) : null}

          <form className="otp-form" onSubmit={handleSubmit}>
            <div className="otp-boxes">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e.target.value, i)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                />
              ))}
            </div>

            <button type="submit" className="otp-btn" disabled={isVerifying}>
              {isVerifying ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          {successText ? <p className="otp-success">{successText}</p> : null}
          {errorText ? <p className="otp-error">{errorText}</p> : null}

          {!emailSending ? (
            <>
              <p className="otp-resend-timer">
                Resend code in <span>00:{String(timer).padStart(2, '0')}</span>
              </p>
              <button
                className="otp-resend-btn"
                type="button"
                onClick={handleResend}
                disabled={timer > 0 || isResending || !pendingEmail}
              >
                {isResending ? 'Resending...' : 'Resend Code'}
              </button>
            </>
          ) : null}

          <button type="button" className="otp-back" onClick={() => onNavigate('signup')}>
            ← Back to Sign Up
          </button>
        </div>
      </main>
    </div>
  );
}

export default OtpVerification;
