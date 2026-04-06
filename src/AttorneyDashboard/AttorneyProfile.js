import { useEffect, useState } from 'react';
import './AttorneyProfile.css';
import { fetchAttorneyProfile, saveAttorneyProfile } from '../lib/userApi';
import {
  isValidEmail,
  isValidPhoneNumber,
  sanitizePhoneInput,
  VALID_EMAIL_MESSAGE,
  VALID_PHONE_MESSAGE,
} from '../lib/validators';

/* ── Icons ── */
const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
const MessagesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
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
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const LocationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const BadgeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

const initialProfile = {
  name: 'Attorney',
  role: 'Senior Associate',
  email: '',
  phone: '',
  location: '',
  ibpNumber: 'IBP-12345',
  specializations: [],
  bio: '',
  consultations: 0,
  notarials: 0,
  rating: 'N/A',
};

export default function AttorneyProfile({ onNavigate, profile: sessionProfile, onProfileUpdated }) {
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
          consultations: data.consultationCount,
          notarials: data.notarialCount,
          rating: 'N/A',
        };

        setProfile(merged);
        setForm(merged);
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to load attorney profile.');
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [sessionProfile]);

  const handleSave = async () => {
    if (!sessionProfile?.id) return;

    if (!isValidEmail(form.email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }

    if (!isValidPhoneNumber(form.phone)) {
      setErrorText(VALID_PHONE_MESSAGE);
      return;
    }

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
        onProfileUpdated({
          ...sessionProfile,
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.location,
          role: 'Attorney',
        });
      }
    } catch (error) {
      setErrorText(error.message || 'Failed to save attorney profile.');
    }
  };

  const handleCancel = () => {
    setForm(profile);
    setEditing(false);
  };

  const sidebarItems = [
    { label: 'Dashboard',    icon: <DashboardIcon />,    nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Messages',     icon: <MessagesIcon />,     nav: 'attorney-messages' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile',      icon: <ProfileIcon />,      nav: null },
  ];

  return (
    <div className="ap-page">
      {sidebarOpen && <div className="ap-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`ap-sidebar ${sidebarOpen ? 'ap-sidebar--open' : ''}`}>
        <div className="ap-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
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
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="ap-topbar__right">
          <span className="ap-topbar__user-name">{profile.name}</span>
          <div className="ap-topbar__avatar">{(profile.name || 'A').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      <main className="ap-main">
        {errorText ? <p>{errorText}</p> : null}
        {/* Profile Header Card */}
        <div className="ap-profile-card">
          <div className="ap-profile-card__banner"></div>
          <div className="ap-profile-card__body">
            <div className="ap-profile-card__avatar">
              <span>{(profile.name || 'A').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>
            </div>
            <div className="ap-profile-card__info">
              <h1>{profile.name}</h1>
              <span className="ap-profile-card__role">{profile.role}</span>
              <div className="ap-profile-card__specs">
                {profile.specializations.map(s => (
                  <span key={s} className="ap-spec-tag">{s}</span>
                ))}
              </div>
            </div>
            {!editing && (
              <div className="ap-profile-actions">
                <button className="ap-edit-btn" onClick={() => setEditing(true)}>
                  <EditIcon /> Edit Profile
                </button>
                <button className="ap-signout-btn" onClick={() => onNavigate('home')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="ap-stats">
          <div className="ap-stat">
            <span className="ap-stat__value">{profile.consultations}</span>
            <span className="ap-stat__label">Consultations</span>
          </div>
          <div className="ap-stat">
            <span className="ap-stat__value">{profile.notarials}</span>
            <span className="ap-stat__label">Notarial Services</span>
          </div>
          <div className="ap-stat">
            <span className="ap-stat__value">{profile.rating}</span>
            <span className="ap-stat__label">Rating</span>
          </div>
        </div>

        {/* Details / Edit */}
        {!editing ? (
          <div className="ap-details-card">
            <h2>Personal Information</h2>
            <div className="ap-detail-grid">
              <div className="ap-detail">
                <MailIcon />
                <div>
                  <span className="ap-detail__label">Email</span>
                  <span className="ap-detail__value">{profile.email}</span>
                </div>
              </div>
              <div className="ap-detail">
                <PhoneIcon />
                <div>
                  <span className="ap-detail__label">Phone</span>
                  <span className="ap-detail__value">{profile.phone}</span>
                </div>
              </div>
              <div className="ap-detail">
                <LocationIcon />
                <div>
                  <span className="ap-detail__label">Location</span>
                  <span className="ap-detail__value">{profile.location}</span>
                </div>
              </div>
              <div className="ap-detail">
                <BadgeIcon />
                <div>
                  <span className="ap-detail__label">IBP Number</span>
                  <span className="ap-detail__value">{profile.ibpNumber}</span>
                </div>
              </div>
            </div>
            <h2 style={{ marginTop: 28 }}>About</h2>
            <p className="ap-bio">{profile.bio}</p>
          </div>
        ) : (
          <div className="ap-details-card">
            <h2>Edit Profile</h2>
            <div className="ap-form-grid">
              <label className="ap-field">
                <span>Full Name</span>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="ap-field">
                <span>Role / Title</span>
                <input type="text" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
              </label>
              <label className="ap-field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="ap-field">
                <span>Phone</span>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })} />
              </label>
              <label className="ap-field">
                <span>Location</span>
                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </label>
              <label className="ap-field">
                <span>IBP Number</span>
                <input type="text" value={form.ibpNumber} onChange={e => setForm({ ...form, ibpNumber: e.target.value })} />
              </label>
              <label className="ap-field ap-field--full">
                <span>Bio</span>
                <textarea rows="3" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
              </label>
            </div>
            <div className="ap-form-actions">
              <button className="ap-btn ap-btn--cancel" onClick={handleCancel}>Cancel</button>
              <button className="ap-btn ap-btn--save" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
