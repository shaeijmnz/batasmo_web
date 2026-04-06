import { useState } from 'react';
import './AdminProfile.css';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminProfile({ onNavigate }) {
  const [profile, setProfile] = useState({
    fullName: 'System Administrator',
    email: 'admin@batasmo.com',
    phone: '+63 917 000 1234',
    role: 'Admin',
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileMessage, setProfileMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');

  const handleProfileSave = (e) => {
    e.preventDefault();
    setProfileMessage('Profile details updated successfully.');
    setTimeout(() => setProfileMessage(''), 2500);
  };

  const handleSecuritySave = (e) => {
    e.preventDefault();
    if (!security.currentPassword || !security.newPassword || !security.confirmPassword) {
      setSecurityMessage('Please complete all security fields.');
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      setSecurityMessage('New password and confirm password do not match.');
      return;
    }

    setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setSecurityMessage('Security information updated successfully.');
    setTimeout(() => setSecurityMessage(''), 2500);
  };

  const handleSignOut = () => {
    onNavigate('login');
  };

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Admin Profile</h1>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-profile-layout">
          <section className="adm-detail-card">
            <h2 className="adm-profile-section-title">Profile Details</h2>
            <form onSubmit={handleProfileSave}>
              <div className="adm-detail-modal__row">
                <label>Full Name</label>
                <input
                  className="adm-detail-input"
                  value={profile.fullName}
                  onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="adm-detail-modal__row">
                <label>Email</label>
                <input
                  className="adm-detail-input"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="adm-detail-modal__row">
                <label>Phone</label>
                <input
                  className="adm-detail-input"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="adm-detail-modal__row">
                <label>Role</label>
                <input className="adm-detail-input" value={profile.role} disabled />
              </div>
              {profileMessage && <p className="adm-profile-message">{profileMessage}</p>}
              <button className="adm-detail-btn" type="submit">Save Profile</button>
            </form>
          </section>

          <section className="adm-detail-card">
            <h2 className="adm-profile-section-title">Security Info</h2>
            <form onSubmit={handleSecuritySave}>
              <div className="adm-detail-modal__row">
                <label>Current Password</label>
                <input
                  className="adm-detail-input"
                  type="password"
                  value={security.currentPassword}
                  onChange={(e) => setSecurity(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
              </div>
              <div className="adm-detail-modal__row">
                <label>New Password</label>
                <input
                  className="adm-detail-input"
                  type="password"
                  value={security.newPassword}
                  onChange={(e) => setSecurity(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
              <div className="adm-detail-modal__row">
                <label>Confirm New Password</label>
                <input
                  className="adm-detail-input"
                  type="password"
                  value={security.confirmPassword}
                  onChange={(e) => setSecurity(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
              {securityMessage && <p className="adm-profile-message">{securityMessage}</p>}
              <button className="adm-detail-btn" type="submit">Update Security</button>
            </form>
          </section>

          <section className="adm-detail-card adm-profile-signout-card">
            <h2 className="adm-profile-section-title">Session</h2>
            <p className="adm-profile-signout-text">Sign out your admin account from this session.</p>
            <button className="adm-profile-signout-btn" onClick={handleSignOut}>Sign Out</button>
          </section>
        </div>

        <div className="adm-detail-card">
          <div className="adm-detail-modal__row">
            <label>Last Login</label>
            <p>March 12, 2026 3:40 PM</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminProfile;
