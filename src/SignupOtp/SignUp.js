import { useState } from 'react';
import './SignUp.css';
import { signUpWithEmail } from '../lib/authApi';
import {
  isValidEmail,
  isValidPhoneNumber,
  isStrongPassword,
  sanitizePhoneInput,
  VALID_EMAIL_MESSAGE,
  VALID_PHONE_MESSAGE,
  VALID_PASSWORD_MESSAGE,
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
  const [errors, setErrors] = useState({});

  const validateForm = (values) => {
    const nextErrors = {};

    if (!values.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }

    if (!values.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(values.email)) {
      nextErrors.email = VALID_EMAIL_MESSAGE;
    }

    if (!isValidPhoneNumber(values.contact)) {
      nextErrors.contact = VALID_PHONE_MESSAGE;
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
      if (!isValidPhoneNumber(values.guardianContact)) {
        nextErrors.guardianContact = 'Please enter a valid guardian contact number.';
      }
    }

    return nextErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'contact' || name === 'guardianContact') {
      setForm({ ...form, [name]: sanitizePhoneInput(value) });
      setErrors((prev) => ({ ...prev, [name]: '' }));
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

            <div className="su-input-group su-grid-2">
              <div>
                <label>Password</label>
                <div className="su-input-wrap">
                  <LockIcon />
                  <input
                    type="password"
                    name="password"
                    placeholder=""
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
                {errors.password ? <p className="su-error-text">{errors.password}</p> : null}
              </div>

              <div>
                <label>Confirm Password</label>
                <div className="su-input-wrap">
                  <LockIcon />
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder=""
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                {errors.confirmPassword ? <p className="su-error-text">{errors.confirmPassword}</p> : null}
              </div>
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
