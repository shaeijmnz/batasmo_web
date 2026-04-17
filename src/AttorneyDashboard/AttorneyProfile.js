import { useEffect, useState } from 'react';
import './AttorneyProfile.css';
import './AttorneyTheme.css';
import { fetchAttorneyProfile, saveAttorneyProfile, signOutUser } from '../lib/userApi';
import {
  isValidEmail,
  isValidPhoneNumber,
  sanitizePhoneInput,
  VALID_EMAIL_MESSAGE,
  VALID_PHONE_MESSAGE,
} from '../lib/validators';

/* ── BatasMo Styled Icons ── */
const ScalesIcon = ({ size = 24, color = '#f2c879' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f2c879" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const ScheduleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
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
  rating: 'N/A',
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
          rating: 'N/A',
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
    if (!isValidEmail(form.email)) return setErrorText(VALID_EMAIL_MESSAGE);
    if (!isValidPhoneNumber(form.phone)) return setErrorText(VALID_PHONE_MESSAGE);

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

  const sidebarItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Logs', icon: <LogsIcon />, nav: 'attorney-logs' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile', icon: <ProfileIcon />, nav: null },
  ];

  const getInitials = (name) => (name || 'A').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="ap-page">
      {sidebarOpen && <div className="ap-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`ap-sidebar ${sidebarOpen ? 'ap-sidebar--open' : ''}`}>
        <div className="ap-sidebar__logo">
          <ScalesIcon size={28} />
          <span>BatasMo</span>
        </div>
        <nav className="ap-sidebar__nav">
          {sidebarItems.map(item => (
            <button
              key={item.label}
              className={`ap-sidebar__item ${item.label === 'Profile' ? 'ap-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="ap-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="ap-topbar">
        <div className="ap-topbar__left">
          <button className="ap-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="ap-topbar__logo">
            <img src="/logo/logo.jpg" alt="BatasMo" className="ap-topbar__brand-logo" />
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
          <div className="ap-stat">
            <span className="ap-stat__value">{profile.rating}</span>
            <span className="ap-stat__label">Rating</span>
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