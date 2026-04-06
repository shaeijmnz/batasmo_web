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

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

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

function SignUp({ onNavigate, onEmailChange }) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    contact: '',
    password: '',
    confirmPassword: '',
    role: 'Client',
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
        role: form.role,
        phone: form.contact.trim(),
        age: parsedAge,
        address: form.address.trim(),
        guardianName: parsedAge < 18 ? form.guardianName.trim() : null,
        guardianContact: parsedAge < 18 ? form.guardianContact.trim() : null,
      });

      localStorage.setItem('batasmo_pending_otp_email', form.email.trim());
      localStorage.setItem('batasmo_pending_otp_role', form.role);

      if (onEmailChange) {
        onEmailChange({ email: form.email.trim(), role: form.role });
      }

      onNavigate('otp');
    } catch (error) {
      setErrorText(error.message || 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="su-page">
      {/* Navbar */}
      <nav className="su-nav">
        <div className="su-nav__inner">
          <div className="su-nav__logo" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
            <ScalesIcon size={28} color="#f5a623" />
            <span>BatasMo</span>
          </div>
          <ul className="su-nav__links">
            <li><a href="#home" onClick={() => onNavigate('home')}>Home</a></li>
            <li><a href="#attorneys">Attorneys</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#about">About</a></li>
          </ul>
          <div className="su-nav__actions">
            <button className="su-btn su-btn--outline" onClick={() => onNavigate('login')}>Login</button>
            <button className="su-btn su-btn--gold">Sign Up</button>
          </div>
        </div>
      </nav>

      {/* Form */}
      <main className="su-main">
        <div className="su-card">
          <div className="su-card__icon-wrap">
            <ScalesIcon size={32} color="#1e3a8a" />
          </div>
          <h2 className="su-card__title">Create Profile</h2>
          <p className="su-card__sub">Join the BatasMo legal network.</p>

          <div className="su-role-toggle">
            <button
              type="button"
              className={`su-role-btn ${form.role === 'Client' ? 'su-role-btn--active' : ''}`}
              onClick={() => setForm((prev) => ({ ...prev, role: 'Client' }))}
            >
              Client
            </button>
            <button
              type="button"
              className={`su-role-btn ${form.role === 'Attorney' ? 'su-role-btn--active' : ''}`}
              onClick={() => setForm((prev) => ({ ...prev, role: 'Attorney' }))}
            >
              Attorney
            </button>
          </div>

          <form className="su-form" onSubmit={handleSubmit}>
            <div className="su-field">
              <label>Full Name</label>
              <div className="su-input-wrap">
                <PersonIcon />
                <input
                  type="text"
                  name="fullName"
                  placeholder="John Doe"
                  value={form.fullName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="su-field">
              <label>Email Address</label>
              <div className="su-input-wrap">
                <MailIcon />
                <input
                  type="email"
                  name="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="su-field">
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

            <div className="su-field">
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

            <div className="su-field">
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

            {Number(form.age) > 0 && Number(form.age) < 18 ? (
              <>
                <div className="su-field">
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

                <div className="su-field">
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
              </>
            ) : null}

            <div className="su-field">
              <label>Password</label>
              <div className="su-input-wrap">
                <LockIcon />
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="su-field">
              <label>Confirm Password</label>
              <div className="su-input-wrap">
                <LockIcon />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            {errorText ? <p>{errorText}</p> : null}

            <button type="submit" className="su-btn su-btn--primary su-btn--full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="su-signin-link">
            Already have an account?{' '}
            <span onClick={() => onNavigate('login')}>Sign in here</span>
          </p>
        </div>
      </main>
    </div>
  );
}

export default SignUp;
