import { useEffect, useRef, useState } from 'react';
import './ProfilePage.css';
import { signOutUser, upsertProfile } from '../lib/userApi';
import {
  isValidEmail,
  isValidPhoneNumber,
  sanitizePhoneInput,
  VALID_EMAIL_MESSAGE,
  VALID_PHONE_MESSAGE,
} from '../lib/validators';

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
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const UserIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const LockIcon = ({ color = '#1e3a8a' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const LockSmIcon = ({ color = '#9ca3af' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const EyeIcon = ({ show }) => (
  show
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
);
const SignOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const PpDashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const PpCalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const PpMyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
  </svg>
);
const PpNotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const PpAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const PpTransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const PpProfileSideIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const PersonSmIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

function ProfilePage({ onNavigate, profile, onSignOut, onProfileUpdated }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [saved, setSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [info, setInfo] = useState({ fullName: '', email: '', contact: '', address: '' });
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [show, setShow] = useState({ current: false, newPass: false, confirm: false });
  const pendingTimeoutsRef = useRef([]);

  useEffect(() => {
    if (!profile) return;
    setInfo({
      fullName: profile.full_name || '',
      email: profile.email || '',
      contact: profile.phone || '',
      address: profile.address || '',
    });
  }, [profile]);

  useEffect(() => {
    return () => {
      pendingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingTimeoutsRef.current = [];
      console.log('[lifecycle] ProfilePage unmounted');
    };
  }, []);

  const scheduleAfter = (callback, delayMs) => {
    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delayMs);
    pendingTimeoutsRef.current.push(timeoutId);
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!isValidEmail(info.email)) {
      setErrorText(VALID_EMAIL_MESSAGE);
      return;
    }

    if (!isValidPhoneNumber(info.contact)) {
      setErrorText(VALID_PHONE_MESSAGE);
      return;
    }

    try {
      const nextProfile = {
        id: profile.id,
        full_name: info.fullName,
        email: info.email,
        phone: info.contact,
        address: info.address,
        role: profile.role || 'Client',
        updated_at: new Date().toISOString(),
      };
      await upsertProfile(nextProfile);
      if (onProfileUpdated) onProfileUpdated(nextProfile);
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Failed to save profile changes.');
      return;
    }

    setSaved(true);
    scheduleAfter(() => setSaved(false), 3000);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    setPwSaved(true);
    setPasswords({ current: '', newPass: '', confirm: '' });
    scheduleAfter(() => setPwSaved(false), 3000);
  };

  const handleSignOutClick = async () => {
    try {
      if (typeof onSignOut === 'function') {
        await onSignOut();
        return;
      }

      await signOutUser();
      onNavigate('login');
    } catch (error) {
      console.error('[auth] client profile sign out failed', error);
      onNavigate('login');
    }
  };

  return (
    <div className="pp-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="pp-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`pp-sidebar ${sidebarOpen ? 'pp-sidebar--open' : ''}`}>
        <div className="pp-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="pp-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <PpDashboardIcon />,     nav: 'home-logged' },
            { label: 'Book Appointment',    icon: <PpCalIcon />,           nav: 'book-appointment' },
            { label: 'My Appointments',     icon: <PpMyApptIcon />,        nav: 'my-appointments' },
            { label: 'Notarial Requests',   icon: <PpNotarialIcon />,      nav: 'my-notarial-requests' },
            { label: 'Announcements',       icon: <PpAnnouncementIcon />,  nav: 'announcements' },
            { label: 'Transaction History', icon: <PpTransactionIcon />,   nav: 'transaction-history' },
            { label: 'Profile',             icon: <PpProfileSideIcon />,   nav: 'profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`pp-sidebar__item ${item.label === 'Profile' ? 'pp-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="pp-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="pp-topbar">
        <div className="pp-topbar__left">
          <button className="pp-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="pp-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>BatasMo</span>
          </div>
        </div>
        <div className="pp-topbar__right">
          <button className="pp-icon-btn" onClick={() => onNavigate('chat-room')} title="Message Admin">
            <MessageIcon />
          </button>
          <button className="pp-icon-btn pp-bell" onClick={() => onNavigate('announcements')} title="Announcements">
            <BellIcon />
            <span className="pp-bell__dot" />
          </button>
          <div className="pp-profile" onClick={() => onNavigate('profile')}>
            <span className="pp-profile__name">{profile?.full_name || 'Client'}</span>
            <div className="pp-avatar">{(profile?.full_name || 'C').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
          <button className="pp-signout-btn" onClick={handleSignOutClick} title="Sign Out">
            <SignOutIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="pp-main">
        <div className="pp-heading">
          <h1>My Profile</h1>
          <p>Manage your personal information and account settings.</p>
        </div>

        <div className="pp-layout">
          {/* Left — avatar card */}
          <div className="pp-avatar-card">
            <div className="pp-avatar-big">{(profile?.full_name || 'C').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
            <h3>{profile?.full_name || 'Client'}</h3>
            <p>{profile?.email || '-'}</p>
            <div className="pp-avatar-card__divider" />
            <button className={`pp-tab-side ${activeTab === 'info' ? 'pp-tab-side--active' : ''}`} onClick={() => setActiveTab('info')}>
              <UserIcon /> Personal Info
            </button>
            <button className={`pp-tab-side ${activeTab === 'password' ? 'pp-tab-side--active' : ''}`} onClick={() => setActiveTab('password')}>
              <LockIcon color={activeTab === 'password' ? '#fff' : '#1e3a8a'} /> Change Password
            </button>
            <button className="pp-tab-side pp-tab-side--signout" onClick={handleSignOutClick}>
              <SignOutIcon /> Sign Out
            </button>
          </div>

          {/* Right — form */}
          <div className="pp-form-card">
            {activeTab === 'info' && (
              <>
                <div className="pp-form-card__header">
                  <UserIcon />
                  <div>
                    <h2>Personal Information</h2>
                    <p>Update your personal details below.</p>
                  </div>
                </div>
                <form className="pp-form" onSubmit={handleSaveInfo}>
                  {errorText ? <p>{errorText}</p> : null}
                  <div className="pp-field">
                    <label>Full Name</label>
                    <div className="pp-input-wrap">
                      <PersonSmIcon />
                      <input type="text" value={info.fullName} onChange={e => setInfo({ ...info, fullName: e.target.value })} placeholder="Full Name" />
                    </div>
                  </div>
                  <div className="pp-field">
                    <label>Email Address</label>
                    <div className="pp-input-wrap">
                      <MailIcon />
                      <input type="email" value={info.email} onChange={e => setInfo({ ...info, email: e.target.value })} placeholder="Email" />
                    </div>
                  </div>
                  <div className="pp-field">
                    <label>Contact Number</label>
                    <div className="pp-input-wrap">
                      <PhoneIcon />
                      <input type="tel" value={info.contact} onChange={e => setInfo({ ...info, contact: sanitizePhoneInput(e.target.value) })} placeholder="Contact Number" />
                    </div>
                  </div>
                  <div className="pp-field">
                    <label>Address</label>
                    <div className="pp-input-wrap">
                      <PersonSmIcon />
                      <input type="text" value={info.address} onChange={e => setInfo({ ...info, address: e.target.value })} placeholder="Address" />
                    </div>
                  </div>
                  <div className="pp-form-actions">
                    {saved && <span className="pp-saved">✓ Changes saved!</span>}
                    <button type="submit" className="pp-btn pp-btn--primary">Save Changes</button>
                  </div>
                </form>
              </>
            )}

            {activeTab === 'password' && (
              <>
                <div className="pp-form-card__header">
                  <LockIcon />
                  <div>
                    <h2>Change Password</h2>
                    <p>Keep your account secure with a strong password.</p>
                  </div>
                </div>
                <form className="pp-form" onSubmit={handleSavePassword}>
                  <div className="pp-field">
                    <label>Current Password</label>
                    <div className="pp-input-wrap">
                      <LockSmIcon />
                      <input type={show.current ? 'text' : 'password'} value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} placeholder="Enter current password" />
                      <button type="button" className="pp-eye" onClick={() => setShow({ ...show, current: !show.current })}><EyeIcon show={show.current} /></button>
                    </div>
                  </div>
                  <div className="pp-field">
                    <label>New Password</label>
                    <div className="pp-input-wrap">
                      <LockSmIcon />
                      <input type={show.newPass ? 'text' : 'password'} value={passwords.newPass} onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} placeholder="Enter new password" />
                      <button type="button" className="pp-eye" onClick={() => setShow({ ...show, newPass: !show.newPass })}><EyeIcon show={show.newPass} /></button>
                    </div>
                  </div>
                  <div className="pp-field">
                    <label>Confirm New Password</label>
                    <div className="pp-input-wrap">
                      <LockSmIcon />
                      <input type={show.confirm ? 'text' : 'password'} value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="Confirm new password" />
                      <button type="button" className="pp-eye" onClick={() => setShow({ ...show, confirm: !show.confirm })}><EyeIcon show={show.confirm} /></button>
                    </div>
                  </div>
                  <div className="pp-form-actions">
                    {pwSaved && <span className="pp-saved">✓ Password updated!</span>}
                    <button type="submit" className="pp-btn pp-btn--primary">Update Password</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
