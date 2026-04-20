import { useState } from 'react';
import './SignUp.css';
import {
  OTP_RESUME_SIGNUP_KEY,
  PENDING_OTP_CHANNEL_KEY,
  PENDING_SIGNUP_USER_ID_KEY,
  PENDING_SMS_PHONE_KEY,
  signUpWithEmail,
} from '../lib/authApi';
import {
  getPasswordRuleChecks,
  isValidEmail,
  isValidPhoneNumber,
  isStrongPassword,
  sanitizePhoneInput,
  VALID_PASSWORD_MESSAGE,
} from '../lib/validators';

const GMAIL_REQUIRED_MESSAGE = 'Please enter a valid Gmail address ending with @gmail.com.';
const PH_MOBILE_REQUIRED_MESSAGE = 'Please enter a valid 11-digit Philippine mobile number (example: 09XXXXXXXXX).';
const NUMBERS_ONLY_MESSAGE = 'Contact number must contain numbers only.';

const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ show }) =>
  show ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  if (typeof error.error_description === 'string') return error.error_description;
  return fallback;
};

function SignUp({ onNavigate, onEmailChange }) {
  const [otpDelivery, setOtpDelivery] = useState('email');
  const [form, setForm] = useState({
    fullName: '',
    sex: 'male',
    email: '',
    contact: '',
    password: '',
    confirmPassword: '',
    age: '',
    address: '',
    guardianName: '',
    guardianContact: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasInvalidPhoneInput, setHasInvalidPhoneInput] = useState({
    contact: false,
    guardianContact: false,
  });

  const validateForm = (values) => {
    const nextErrors = {};

    if (!values.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }

    const normalizedEmail = String(values.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(normalizedEmail) || !normalizedEmail.endsWith('@gmail.com')) {
      nextErrors.email = GMAIL_REQUIRED_MESSAGE;
    }

    if (values.sex !== 'male' && values.sex !== 'female' && values.sex !== 'others') {
      nextErrors.sex = 'Please select your gender.';
    }

    if (hasInvalidPhoneInput.contact) {
      nextErrors.contact = NUMBERS_ONLY_MESSAGE;
    } else if (!isValidPhoneNumber(values.contact) || !/^09\d{9}$/.test(String(values.contact || ''))) {
      nextErrors.contact = PH_MOBILE_REQUIRED_MESSAGE;
    }

    if (!values.password) {
      nextErrors.password = 'Password is required.';
    } else if (!isStrongPassword(values.password)) {
      nextErrors.password = VALID_PASSWORD_MESSAGE;
    }

    if (!values.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!values.age.trim() || Number(values.age) < 1) {
      nextErrors.age = 'Please enter a valid age.';
    }

    if (!values.address.trim()) {
      nextErrors.address = 'Address is required.';
    }

    const parsedAge = Number(values.age);
    if (parsedAge > 0 && parsedAge < 18) {
      if (!values.guardianName.trim()) {
        nextErrors.guardianName = 'Guardian name is required for minors.';
      }
      if (hasInvalidPhoneInput.guardianContact) {
        nextErrors.guardianContact = NUMBERS_ONLY_MESSAGE;
      } else if (
        !isValidPhoneNumber(values.guardianContact) ||
        !/^09\d{9}$/.test(String(values.guardianContact || ''))
      ) {
        nextErrors.guardianContact = 'Please enter a valid 11-digit guardian mobile number (09XXXXXXXXX).';
      }
    }

    if (otpDelivery === 'sms' && !isValidPhoneNumber(values.contact)) {
      nextErrors.contact = PH_MOBILE_REQUIRED_MESSAGE;
    }

    if (!agreedToTerms) {
      nextErrors.agreedToTerms = 'Please read and accept the Terms and Conditions to continue.';
    }

    return nextErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'contact' || name === 'guardianContact') {
      const hasNonDigitCharacters = /[^0-9]/.test(String(value || ''));
      setForm({ ...form, [name]: sanitizePhoneInput(value) });
      setHasInvalidPhoneInput((prev) => ({ ...prev, [name]: hasNonDigitCharacters }));
      setErrors((prev) => ({
        ...prev,
        [name]: hasNonDigitCharacters ? NUMBERS_ONLY_MESSAGE : '',
      }));
      return;
    }
    setForm({ ...form, [name]: value });
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const parsedAge = Number(form.age);

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await signUpWithEmail({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: 'Client',
        sex: form.sex,
        phone: form.contact.trim(),
        age: parsedAge,
        address: form.address.trim(),
        guardianName: parsedAge < 18 ? form.guardianName.trim() : null,
        guardianContact: parsedAge < 18 ? form.guardianContact.trim() : null,
        preferredOtpChannel: otpDelivery,
      });

      localStorage.setItem('batasmo_pending_otp_email', form.email.trim());
      localStorage.setItem('batasmo_pending_otp_role', 'Client');
      localStorage.setItem(PENDING_OTP_CHANNEL_KEY, otpDelivery);
      localStorage.setItem(PENDING_SMS_PHONE_KEY, form.contact.trim());
      if (result?.user?.id) {
        localStorage.setItem(PENDING_SIGNUP_USER_ID_KEY, String(result.user.id));
      }
      try {
        sessionStorage.setItem(
          OTP_RESUME_SIGNUP_KEY,
          JSON.stringify({ email: form.email.trim(), password: form.password }),
        );
      } catch {
        /* ignore */
      }

      if (onEmailChange) {
        onEmailChange({ email: form.email.trim(), role: 'Client', otpChannel: otpDelivery });
      }

      onNavigate('otp');
    } catch (error) {
      setErrors({ form: getErrorMessage(error, 'Failed to create account.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="su-auth-page">
      <div className="su-auth-bg" />

      <main className="su-auth-main">
        <div className="su-auth-top">
          <button className="su-back-button" onClick={() => onNavigate('home')}>
            Back
          </button>

          <div className="su-brand-badge" onClick={() => onNavigate('home')}>
            <img src="/auth/logo.jpg" alt="BatasMo" className="su-brand-logo" />
            <span className="su-brand-text">BatasMo</span>
          </div>
        </div>

        <section className="su-hero-card">
          <p className="su-kicker">CLIENT ACCOUNT REGISTRATION</p>
          <h1>Create your account</h1>
          <p>Set up a secure profile in a few steps and get legal support from verified professionals.</p>

          <div className="su-segment-wrap">
            <button type="button" className="su-segment-btn" onClick={() => onNavigate('login')}>LOG IN</button>
            <button type="button" className="su-segment-btn su-segment-btn--active">SIGN UP</button>
          </div>
        </section>

        <section className="su-form-card">
          <div className="su-form-heading">
            <h2>Join BatasMo</h2>
            <p>Create your legal profile and continue with OTP verification.</p>
          </div>

          <form className="su-form" onSubmit={handleSubmit}>
            <div className="su-input-group">
              <label>Full Name</label>
              <div className="su-input-wrap">
                <PersonIcon />
                <input
                  type="text"
                  name="fullName"
                  placeholder=""
                  value={form.fullName}
                  onChange={handleChange}
                />
              </div>
              {errors.fullName ? <p className="su-error-text">{errors.fullName}</p> : null}
            </div>

            <div className="su-input-group su-grid-2">
              <div>
                <label>Gender</label>
                <div className="su-input-wrap">
                  <PersonIcon />
                  <select
                    name="sex"
                    value={form.sex}
                    onChange={handleChange}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="others">Others</option>
                  </select>
                </div>
                {errors.sex ? <p className="su-error-text">{errors.sex}</p> : null}
              </div>

              <div>
                <label>Email Address</label>
                <div className="su-input-wrap">
                  <MailIcon />
                  <input
                    type="email"
                    name="email"
                    placeholder=""
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                {errors.email ? <p className="su-error-text">{errors.email}</p> : null}
              </div>

              <div>
                <label>Contact Number</label>
                <div className="su-input-wrap">
                  <PhoneIcon />
                  <input
                    type="tel"
                    name="contact"
                    placeholder=""
                    value={form.contact}
                    onChange={handleChange}
                  />
                </div>
                {errors.contact ? <p className="su-error-text">{errors.contact}</p> : null}
              </div>
            </div>

            <div className="su-input-group su-grid-2">
              <div>
                <label>Age</label>
                <div className="su-input-wrap">
                  <PersonIcon />
                  <input
                    type="number"
                    name="age"
                    placeholder=""
                    min="1"
                    value={form.age}
                    onChange={handleChange}
                  />
                </div>
                {errors.age ? <p className="su-error-text">{errors.age}</p> : null}
              </div>

              <div>
                <label>Address</label>
                <div className="su-input-wrap">
                  <PersonIcon />
                  <input
                    type="text"
                    name="address"
                    placeholder=""
                    value={form.address}
                    onChange={handleChange}
                  />
                </div>
                {errors.address ? <p className="su-error-text">{errors.address}</p> : null}
              </div>
            </div>

            {Number(form.age) > 0 && Number(form.age) < 18 ? (
              <div className="su-input-group su-grid-2">
                <div>
                  <label>Guardian Full Name</label>
                  <div className="su-input-wrap">
                    <PersonIcon />
                    <input
                      type="text"
                      name="guardianName"
                      placeholder=""
                      value={form.guardianName}
                      onChange={handleChange}
                    />
                  </div>
                  {errors.guardianName ? <p className="su-error-text">{errors.guardianName}</p> : null}
                </div>

                <div>
                  <label>Guardian Contact Number</label>
                  <div className="su-input-wrap">
                    <PhoneIcon />
                    <input
                      type="tel"
                      name="guardianContact"
                      placeholder=""
                      value={form.guardianContact}
                      onChange={handleChange}
                    />
                  </div>
                  {errors.guardianContact ? <p className="su-error-text">{errors.guardianContact}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="su-input-group su-otp-delivery-group">
              <label>Send verification code via</label>
              <div className="su-input-wrap su-otp-delivery-wrap">
                <label className="su-otp-delivery-option">
                  <input
                    type="radio"
                    name="otp-delivery"
                    checked={otpDelivery === 'email'}
                    onChange={() => setOtpDelivery('email')}
                  />
                  Email
                </label>
                <label className="su-otp-delivery-option">
                  <input
                    type="radio"
                    name="otp-delivery"
                    checked={otpDelivery === 'sms'}
                    onChange={() => setOtpDelivery('sms')}
                  />
                  SMS
                </label>
              </div>
              <p className="su-otp-delivery-help">
                Email uses the existing BatasMo email code. SMS uses IPROG and your contact number above.
              </p>
            </div>

            <div className="su-input-group su-grid-2">
              <div>
                <label>Password</label>
                <div className="su-input-wrap">
                  <LockIcon />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder=""
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="su-eye"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <EyeIcon show={showPassword} />
                  </button>
                </div>
                {form.password ? (
                  <ul
                    style={{
                      margin: '8px 0 0',
                      padding: 0,
                      listStyle: 'none',
                      fontSize: 12,
                      lineHeight: 1.4,
                      textAlign: 'left',
                    }}
                  >
                    {getPasswordRuleChecks(form.password).map((rule) => (
                      <li
                        key={rule.text}
                        style={{
                          color: rule.ok ? '#86efac' : '#9ca3af',
                          marginBottom: 3,
                        }}
                      >
                        {rule.ok ? '✓ ' : '○ '}
                        {rule.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {errors.password ? <p className="su-error-text">{errors.password}</p> : null}
              </div>

              <div>
                <label>Confirm Password</label>
                <div className="su-input-wrap">
                  <LockIcon />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder=""
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="su-eye"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    <EyeIcon show={showConfirmPassword} />
                  </button>
                </div>
                {form.confirmPassword ? (
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: 12,
                      textAlign: 'left',
                      color:
                        form.password === form.confirmPassword
                          ? '#86efac'
                          : '#f5b2b2',
                    }}
                  >
                    {form.password === form.confirmPassword
                      ? 'Passwords match.'
                      : 'Passwords do not match.'}
                  </p>
                ) : null}
                {errors.confirmPassword ? <p className="su-error-text">{errors.confirmPassword}</p> : null}
              </div>
            </div>

            <div className="su-input-group">
              <label>Terms and Conditions</label>
              <div
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: '#9ca3af',
                  marginBottom: 12,
                  textAlign: 'left',
                }}
              >
                <p style={{ margin: '0 0 12px', fontWeight: 600, color: '#e5e7eb' }}>Terms and Conditions</p>
                <p style={{ margin: '0 0 12px' }}>
                  By accessing and using the BatasMo platform, you agree to provide accurate and complete information and
                  to use the system only for lawful purposes. Users are responsible for maintaining the confidentiality of
                  their account and any activities performed under it.
                </p>
                <p style={{ margin: '0 0 12px' }}>
                  BatasMo respects and protects your personal data in accordance with the Data Privacy Act of 2012
                  (Republic Act No. 10173). All information submitted in the system will be securely stored and used
                  solely for the purpose of providing legal consultation and related services.
                </p>
                <p style={{ margin: 0 }}>
                  By proceeding, you confirm that you have read, understood, and agreed to these terms and conditions.
                </p>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#d1d5db',
                  textAlign: 'left',
                }}
              >
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    setErrors((prev) => ({ ...prev, agreedToTerms: '' }));
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  I confirm that I have read, understood, and agree to the Terms and Conditions above.
                </span>
              </label>
              {errors.agreedToTerms ? <p className="su-error-text">{errors.agreedToTerms}</p> : null}
            </div>

            {errors.form ? <p className="su-error-text">{errors.form}</p> : null}

            <button type="submit" className="su-primary-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="su-footer-row">
            <span>Already have an account? </span>
            <button type="button" className="su-link-button" onClick={() => onNavigate('login')}>
              Log in
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default SignUp;
