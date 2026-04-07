import { useState } from 'react';
import './SignUp.css';
import { signUpWithEmail } from '../lib/authApi';
import {
  isValidEmail,
  isValidPhoneNumber,
  sanitizePhoneInput,
  VALID_EMAIL_MESSAGE,
  VALID_PHONE_MESSAGE,
} from '../lib/validators';

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

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  if (typeof error.error_description === 'string') return error.error_description;
  return fallback;
};

function SignUp({ onNavigate, onEmailChange }) {
  const [form, setForm] = useState({
    fullName: '',
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
  const [errorText, setErrorText] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'contact' || name === 'guardianContact') {
      setForm({ ...form, [name]: sanitizePhoneInput(value) });
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setErrorText('Please fill in all required fields.');
      return;
    }

    if (!isValidEmail(form.email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }

    if (!isValidPhoneNumber(form.contact)) {
      setErrorText(VALID_PHONE_MESSAGE);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorText('Passwords do not match.');
      return;
    }

    if (form.password.length < 6) {
      setErrorText('Minimum 6 characters for password.');
      return;
    }

    if (!form.age.trim() || Number(form.age) < 1) {
      setErrorText('Please enter a valid age.');
      return;
    }

    if (!form.address.trim()) {
      setErrorText('Address is required.');
      return;
    }

    const parsedAge = Number(form.age);
    if (parsedAge < 18) {
      if (!form.guardianName.trim()) {
        setErrorText('Guardian name is required for minors.');
        return;
      }

      if (!isValidPhoneNumber(form.guardianContact)) {
        setErrorText('Please enter a valid guardian contact number.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorText('');

    try {
      await signUpWithEmail({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: 'Client',
        phone: form.contact.trim(),
        age: parsedAge,
        address: form.address.trim(),
        guardianName: parsedAge < 18 ? form.guardianName.trim() : null,
        guardianContact: parsedAge < 18 ? form.guardianContact.trim() : null,
      });

      localStorage.setItem('batasmo_pending_otp_email', form.email.trim());
      localStorage.setItem('batasmo_pending_otp_role', 'Client');

      if (onEmailChange) {
        onEmailChange({ email: form.email.trim(), role: 'Client' });
      }

      onNavigate('otp');
    } catch (error) {
      setErrorText(getErrorMessage(error, 'Failed to create account.'));
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
                  placeholder="Juan Dela Cruz"
                  value={form.fullName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="su-input-group su-grid-2">
              <div>
                <label>Email Address</label>
                <div className="su-input-wrap">
                  <MailIcon />
                  <input
                    type="email"
                    name="email"
                    placeholder="name@domain.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label>Contact Number</label>
                <div className="su-input-wrap">
                  <PhoneIcon />
                  <input
                    type="tel"
                    name="contact"
                    placeholder="09123456789"
                    value={form.contact}
                    onChange={handleChange}
                  />
                </div>
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
                    placeholder="21"
                    min="1"
                    value={form.age}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label>Address</label>
                <div className="su-input-wrap">
                  <PersonIcon />
                  <input
                    type="text"
                    name="address"
                    placeholder="123 Legal St., Manila"
                    value={form.address}
                    onChange={handleChange}
                  />
                </div>
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
                      placeholder="Guardian Name"
                      value={form.guardianName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div>
                  <label>Guardian Contact Number</label>
                  <div className="su-input-wrap">
                    <PhoneIcon />
                    <input
                      type="tel"
                      name="guardianContact"
                      placeholder="09123456789"
                      value={form.guardianContact}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="su-input-group su-grid-2">
              <div>
                <label>Password</label>
                <div className="su-input-wrap">
                  <LockIcon />
                  <input
                    type="password"
                    name="password"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label>Confirm Password</label>
                <div className="su-input-wrap">
                  <LockIcon />
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {errorText ? <p className="su-error-text">{errorText}</p> : null}

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
