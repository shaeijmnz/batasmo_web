import { useState, useEffect, useRef, useCallback } from 'react';
import './OtpVerification.css';
import {
  PENDING_OTP_CHANNEL_KEY,
  PENDING_SIGNUP_USER_ID_KEY,
  PENDING_SMS_PHONE_KEY,
  OTP_RESUME_LOGIN_KEY,
  OTP_RESUME_SIGNUP_KEY,
  requestSignupSmsOtp,
  resendSignUpOtp,
  signInWithEmail,
  verifySignUpOtp,
  verifySignupSmsOtp,
} from '../lib/authApi';
import { getCurrentSessionProfile, pageFromRole } from '../lib/userApi';
import { isValidPhoneNumber, maskPhilippinePhone, sanitizePhoneInput, VALID_PHONE_MESSAGE } from '../lib/validators';

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

function OtpVerification({ onNavigate, email = '', role = 'Client', otpChannel: otpChannelProp = 'email' }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [delivery, setDelivery] = useState(() => {
    const stored = String(localStorage.getItem(PENDING_OTP_CHANNEL_KEY) || '').toLowerCase();
    if (stored === 'sms' || stored === 'email') return stored;
    const p = String(otpChannelProp || 'email').toLowerCase();
    return p === 'sms' ? 'sms' : 'email';
  });
  const [optionalPhone, setOptionalPhone] = useState(() => localStorage.getItem(PENDING_SMS_PHONE_KEY) || '');
  const [smsInitDone, setSmsInitDone] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const inputs = useRef([]);
  const smsAutoTriedRef = useRef(false);

  const pendingEmail = String(email || localStorage.getItem('batasmo_pending_otp_email') || '').trim();
  const pendingRole = String(role || localStorage.getItem('batasmo_pending_otp_role') || 'Client');
  const pendingUserId = String(localStorage.getItem(PENDING_SIGNUP_USER_ID_KEY) || '').trim();

  const maskedEmail = pendingEmail
    ? pendingEmail.replace(/^(.{4}).*(@.*)$/, '$1***$2')
    : 'your***@email.com';

  const destinationLabel =
    delivery === 'sms'
      ? maskPhilippinePhone(optionalPhone || localStorage.getItem(PENDING_SMS_PHONE_KEY) || '')
      : maskedEmail;

  const persistDelivery = useCallback((next) => {
    const v = next === 'sms' ? 'sms' : 'email';
    setDelivery(v);
    localStorage.setItem(PENDING_OTP_CHANNEL_KEY, v);
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  useEffect(() => {
    if (smsInitDone && delivery === 'sms') {
      setTimer(59);
    }
  }, [smsInitDone, delivery]);

  const sendSmsOtp = useCallback(
    async (otpPhoneOverride) => {
      const body = {
        email: pendingEmail,
        userId: pendingUserId || undefined,
        otpPhone: otpPhoneOverride || optionalPhone || localStorage.getItem(PENDING_SMS_PHONE_KEY) || undefined,
      };
      const data = await requestSignupSmsOtp(body);
      if (data?.userId) {
        localStorage.setItem(PENDING_SIGNUP_USER_ID_KEY, String(data.userId));
      }
      setSmsInitDone(true);
      setNeedsPhone(false);
    },
    [pendingEmail, pendingUserId, optionalPhone],
  );

  useEffect(() => {
    if (delivery !== 'sms' || !pendingEmail || smsAutoTriedRef.current) return;
    smsAutoTriedRef.current = true;
    setErrorText('');
    setSmsSending(true);
    setNeedsPhone(false);
    sendSmsOtp()
      .catch((err) => {
        const msg = String(err?.message || '');
        const needPhone =
          err?.code === 'PHONE_REQUIRED' || msg.includes('PHONE_REQUIRED') || msg.includes('Add a mobile number');
        if (needPhone) {
          setNeedsPhone(true);
          setSmsInitDone(false);
        } else {
          setErrorText(getErrorMessage(err, 'Could not send SMS code.'));
        }
      })
      .finally(() => {
        setSmsSending(false);
      });
  }, [delivery, pendingEmail, sendSmsOtp]);

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

    const done = () => {
      setTimer(59);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    };

    if (delivery === 'email') {
      resendSignUpOtp({ email: pendingEmail })
        .then(done)
        .catch((error) => {
          setErrorText(getErrorMessage(error, 'Failed to resend OTP.'));
        })
        .finally(() => {
          setIsResending(false);
        });
      return;
    }

    sendSmsOtp()
      .then(done)
      .catch((error) => {
        setErrorText(getErrorMessage(error, 'Failed to resend SMS.'));
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

    try {
      setErrorText('');
      setIsVerifying(true);

      if (delivery === 'email') {
        await verifySignUpOtp({ email: pendingEmail, token });
      } else {
        const uid = localStorage.getItem(PENDING_SIGNUP_USER_ID_KEY) || '';
        await verifySignupSmsOtp({ userId: uid || undefined, email: pendingEmail, token });

        const resumeRaw =
          sessionStorage.getItem(OTP_RESUME_LOGIN_KEY) || sessionStorage.getItem(OTP_RESUME_SIGNUP_KEY);
        if (!resumeRaw) {
          setErrorText('Session expired. Please sign in with your email and password.');
          setIsVerifying(false);
          return;
        }
        let resume;
        try {
          resume = JSON.parse(resumeRaw);
        } catch {
          setErrorText('Session expired. Please sign in with your email and password.');
          setIsVerifying(false);
          return;
        }
        await signInWithEmail({
          email: resume.email || pendingEmail,
          password: resume.password,
        });
      }

      localStorage.removeItem('batasmo_pending_otp_email');
      localStorage.removeItem('batasmo_pending_otp_role');
      localStorage.removeItem(PENDING_OTP_CHANNEL_KEY);
      localStorage.removeItem(PENDING_SIGNUP_USER_ID_KEY);
      localStorage.removeItem(PENDING_SMS_PHONE_KEY);
      clearOtpResumeSecrets();

      try {
        const { profile } = await getCurrentSessionProfile();
        if (profile?.role) {
          onNavigate(pageFromRole(profile.role));
          return;
        }
      } catch {
        /* fallback */
      }

      onNavigate(pageFromRole(pendingRole));
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Invalid or expired OTP code.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const onDeliveryChange = (next) => {
    if (next === delivery) return;
    persistDelivery(next);
    setOtp(['', '', '', '', '', '']);
    setErrorText('');
    if (next === 'sms') {
      smsAutoTriedRef.current = false;
      setSmsInitDone(false);
      setNeedsPhone(false);
      setTimer(59);
    }
  };

  const handleSavePhoneAndSend = async (e) => {
    e.preventDefault();
    if (!isValidPhoneNumber(optionalPhone)) {
      setErrorText(VALID_PHONE_MESSAGE);
      return;
    }
    localStorage.setItem(PENDING_SMS_PHONE_KEY, optionalPhone);
    setErrorText('');
    try {
      setSmsSending(true);
      await sendSmsOtp(optionalPhone);
      setTimer(59);
    } catch (err) {
      setErrorText(getErrorMessage(err, 'Could not send SMS.'));
    } finally {
      setSmsSending(false);
    }
  };

  return (
    <div className="otp-page">
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

      <main className="otp-main">
        <div className="otp-card">
          <div className="otp-card__icon-wrap">
            <ShieldIcon />
          </div>
          <h2 className="otp-card__title">OTP Verification</h2>
          <p className="otp-card__sub">
            {delivery === 'email' ? (
              <>
                Enter the 6-digit code sent to your email address<br />
                <span className="otp-card__email">{maskedEmail}</span>
              </>
            ) : (
              <>
                Enter the 6-digit code sent via SMS to<br />
                <span className="otp-card__email">{destinationLabel}</span><br />
                <span style={{ fontSize: 12, color: '#8b9aa7' }}>Code is valid for 15 minutes.</span>
              </>
            )}
          </p>

          <div className="otp-form" style={{ marginBottom: 12 }}>
            <p className="otp-card__sub" style={{ marginBottom: 8 }}>Receive code via</p>
            <label className="otp-delivery-label" style={{ marginRight: 16 }}>
              <input
                type="radio"
                name="otp-delivery"
                checked={delivery === 'email'}
                onChange={() => onDeliveryChange('email')}
              />
              {' '}Email
            </label>
            <label className="otp-delivery-label">
              <input
                type="radio"
                name="otp-delivery"
                checked={delivery === 'sms'}
                onChange={() => onDeliveryChange('sms')}
              />
              {' '}SMS
            </label>
          </div>

          {delivery === 'sms' && smsSending ? (
            <p className="otp-sms-status">Sending SMS...</p>
          ) : null}

          {delivery === 'sms' && needsPhone && !smsInitDone && !smsSending ? (
            <form className="otp-form" onSubmit={handleSavePhoneAndSend}>
              <p className="otp-card__sub">
                Add an 11-digit Philippine mobile number (09XXXXXXXXX) to receive SMS. Optional if your account already has one on file.
              </p>
              <input
                type="tel"
                className="otp-phone-input"
                value={optionalPhone}
                onChange={(ev) => setOptionalPhone(sanitizePhoneInput(ev.target.value))}
                placeholder="09XXXXXXXXX"
                maxLength={11}
              />
              <button type="submit" className="otp-btn" disabled={smsSending}>
                Save number &amp; send SMS
              </button>
            </form>
          ) : null}

          {delivery === 'email' || smsInitDone ? (
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
          ) : null}

          {errorText ? <p className="otp-error">{errorText}</p> : null}

          {(delivery === 'email' || smsInitDone) && !smsSending ? (
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
