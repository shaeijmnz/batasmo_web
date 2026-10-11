import { useEffect, useState } from 'react';
import './AttorneyProfile.css';
import './AttorneyTheme.css';
import { fetchAttorneyProfile, saveAttorneyProfile, signOutUser } from '../lib/userApi';
import {
  isPhilippineMobile,
  isValidEmail,
  sanitizePhoneInput,
  VALID_EMAIL_MESSAGE,
  VALID_PHONE_MESSAGE,
} from '../lib/validators';
import AttorneySidebar from './AttorneySidebar';

/* ── LegalLink Styled Icons ── */
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f2c879" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const initialProfile = {
  name: 'Attorney',
  role: 'Senior Associate',
  email: '',
  phone: '',
  location: '',
  ibpNumber: '',
  specializations: [],
  bio: '',
  consultations: 0,
  notarials: 0,
};

export default function AttorneyProfile({ onNavigate, profile: sessionProfile, onSignOut, onProfileUpdated }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState(initialProfile);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (!sessionProfile?.id) return;
      try {
        const data = await fetchAttorneyProfile(sessionProfile.id);
        if (!isMounted) return;

        const merged = {
          name: data.profile?.full_name || sessionProfile.full_name || 'Attorney',
          role: data.attorney?.firm_name || 'Attorney',
          email: data.profile?.email || sessionProfile.email || '',
          phone: data.profile?.phone || '',
          location: data.profile?.address || '',
          ibpNumber: data.attorney?.prc_id || '',
          specializations: data.attorney?.specialties || [],
          bio: data.attorney?.bio || '',
          consultations: data.consultationCount || 0,
          notarials: data.notarialCount || 0,
        };

        setProfile(merged);
        setForm(merged);
      } catch (error) {
        if (isMounted) setErrorText(error.message || 'Failed to load attorney profile.');
      }
    };
    loadProfile();
    return () => { isMounted = false; };
  }, [sessionProfile]);

  const handleSave = async () => {
    if (!sessionProfile?.id) return;
    if (!form.name.trim()) return setErrorText('Full name is required.');
    if (!isValidEmail(form.email)) return setErrorText(VALID_EMAIL_MESSAGE);
    if (!isPhilippineMobile(form.phone)) return setErrorText(VALID_PHONE_MESSAGE);

    try {
      const payload = {
        fullName: form.name,
        role: form.role,
        email: form.email,
        phone: form.phone,
        location: form.location,
        ibpNumber: form.ibpNumber,
        bio: form.bio,
        specializations: form.specializations,
      };

      await saveAttorneyProfile(sessionProfile.id, payload);
      setProfile(form);
      setEditing(false);
      setErrorText('');
      if (onProfileUpdated) {
        onProfileUpdated({ ...sessionProfile, full_name: form.name, email: form.email });
      }
    } catch (error) {
      setErrorText(error.message || 'Failed to save attorney profile.');
    }
  };

  const handleSignOut = async () => {
    try {
      if (typeof onSignOut === 'function') {
        await onSignOut();
        return;
      }
      await signOutUser();
      onNavigate('login');
    } catch (error) {
      onNavigate('login');
    }
  };

  const getInitials = (name) => (name || 'A').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="ap-page">
      <AttorneySidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        active="attorney-profile"
        onNavigate={onNavigate}
      />

      <header className="ap-topbar">
        <div className="ap-topbar__left">
          <button className="ap-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="ap-topbar__logo">
            <img src="/logo/logo.jpg" alt="LegalLink" className="ap-topbar__brand-logo" />
            <div>
              <p className="ap-topbar__eyebrow">Attorney Workspace</p>
              <span>Attorney Dashboard</span>
            </div>
          </div>
        </div>
        <div className="ap-topbar__right">
          <div className="ap-profile">
            <div className="ap-profile__info">
              <span className="ap-profile__name">{profile.name}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="ap-main">
        {errorText && <div className="ap-error">{errorText}</div>}

        <div className="ap-profile-card">
          <div className="ap-profile-card__banner" />
          <div className="ap-profile-card__body">
            <div className="ap-profile-card__avatar">{getInitials(profile.name)}</div>
            <div className="ap-profile-card__info">
              <h1>{profile.name}</h1>
              <span className="ap-profile-card__role">{profile.role}</span>
              <div className="ap-profile-card__specs">
                {profile.specializations.map(s => <span key={s} className="ap-spec-tag">{s}</span>)}
              </div>
            </div>
            {!editing && (
              <div className="ap-profile-actions">
                <button className="ap-edit-btn" onClick={() => setEditing(true)}>Edit Profile</button>
                <button className="ap-signout-btn" onClick={handleSignOut}>Sign Out</button>
              </div>
            )}
          </div>
        </div>

        <div className="ap-stats">
          <div className="ap-stat">
            <span className="ap-stat__value">{profile.consultations}</span>
            <span className="ap-stat__label">Consultations</span>
          </div>
          <div className="ap-stat">
            <span className="ap-stat__value">{profile.notarials}</span>
            <span className="ap-stat__label">Notarials</span>
          </div>
        </div>

        <div className="ap-details-card">
          {!editing ? (
            <>
              <h2>Attorney Information</h2>
              <div className="ap-detail-grid">
                <div className="ap-detail">
                  <div><span className="ap-detail__label">Email Address</span><span className="ap-detail__value">{profile.email}</span></div>
                </div>
                <div className="ap-detail">
                  <div><span className="ap-detail__label">Phone Number</span><span className="ap-detail__value">{profile.phone}</span></div>
                </div>
                <div className="ap-detail">
                  <div><span className="ap-detail__label">Office Location</span><span className="ap-detail__value">{profile.location}</span></div>
                </div>
                <div className="ap-detail">
                  <div><span className="ap-detail__label">IBP/PRC ID</span><span className="ap-detail__value">{profile.ibpNumber}</span></div>
                </div>
              </div>
              <h2 style={{ marginTop: 28 }}>Professional Bio</h2>
              <p className="ap-bio">{profile.bio || 'No bio available.'}</p>
            </>
          ) : (
            <>
              <h2>Edit Profile</h2>
              <div className="ap-form-grid">
                <label className="ap-field"><span>Full Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                <label className="ap-field"><span>Firm/Title</span><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></label>
                <label className="ap-field"><span>Email</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
                <label className="ap-field"><span>Phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })} /></label>
                <label className="ap-field"><span>Location</span><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
                <label className="ap-field"><span>IBP Number</span><input value={form.ibpNumber} onChange={e => setForm({ ...form, ibpNumber: e.target.value })} /></label>
                <label className="ap-field ap-field--full"><span>Bio</span><textarea rows="4" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></label>
              </div>
              <div className="ap-form-actions">
                <button className="ap-btn ap-btn--cancel" onClick={() => { setForm(profile); setEditing(false); }}>Cancel</button>
                <button className="ap-btn ap-btn--save" onClick={handleSave}>Save Changes</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
