import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText,
  BarChart3, Settings as SettingsIcon, LogOut, Menu,
  User, Lock, BellRing, Save, Globe
} from 'lucide-react';
import './AdminTheme.css';
import './settings.css';
import { getAppConfig, setAppConfig } from '../lib/userApi';

const handleQuickAction = (message) => window.alert(message);

const Settings = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Profile');
  const navigate = (path) => {
    const pageMap = {
      '/': 'admin-home',
      '/clients': 'admin-clients',
      '/attorneys': 'admin-attorneys',
      '/requests': 'admin-requests',
      '/consultations': 'admin-consultations',
      '/reports': 'admin-reports',
      '/settings': 'admin-settings',
    };
    onNavigate?.(pageMap[path] || 'admin-home');
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <SettingsIcon size={20} />, path: '/settings' },
  ];

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          {isSidebarOpen && <img src="/logo/logo.jpg" alt="BatasMo logo" className="brand-logo" />}
          {isSidebarOpen && <span className="logo-text">BatasMo</span>}
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              active={item.path === '/settings'}
              open={isSidebarOpen}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="profile-section">
            <div className="profile-avatar">AD</div>
            {isSidebarOpen && <div className="profile-info"><p className="name">Admin User</p><p className="email">admin@batasmo.com</p></div>}
          </div>
          <button className="logout-btn" onClick={() => handleQuickAction('Logout clicked')}><LogOut size={18} /> {isSidebarOpen && "Logout"}</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          <div className="page-header">
            <h2 className="title">Settings</h2>
            <p className="subtitle">Manage your account settings and preferences</p>
          </div>

          {/* TAB NAVIGATION */}
          <div className="settings-tabs">
            {['Profile', 'Security', 'Notifications'].map(tab => (
              <button 
                key={tab} 
                className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="settings-content">
            {activeTab === 'Profile' && <ProfileSection />}
            {activeTab === 'Security' && <SecuritySection />}
            {activeTab === 'Notifications' && <NotificationsSection />}
          </div>
        </div>
      </main>
    </div>
  );
};

/* --- SUB-COMPONENTS --- */

const ProfileSection = () => (
  <div className="settings-stack">
    <div className="card">
      <h3 className="card-title"><User size={18} /> Profile Information</h3>
      <div className="grid-2">
        <div className="input-group"><label>First Name</label><input type="text" defaultValue="Admin" /></div>
        <div className="input-group"><label>Last Name</label><input type="text" defaultValue="User" /></div>
      </div>
      <div className="input-group"><label>Email Address</label><input type="email" defaultValue="admin@batasmo.com" /></div>
      <div className="input-group"><label>Phone Number</label><input type="text" defaultValue="+63 912 345 6789" /></div>
      <div className="input-group">
        <label>Bio</label>
        <textarea defaultValue="System administrator for BatasMo online consultation platform."></textarea>
      </div>
      <button className="btn-save" onClick={() => handleQuickAction('Profile changes saved')}><Save size={16} /> Save Changes</button>
    </div>

    <div className="card">
      <h3 className="card-title"><Globe size={18} /> System Preferences</h3>
      <div className="input-group">
        <label>Language</label>
        <select><option>English</option></select>
      </div>
      <div className="input-group">
        <label>Timezone</label>
        <select><option>Asia/Manila (PHT)</option></select>
      </div>
      <button className="btn-save" onClick={() => handleQuickAction('System preferences saved')}><Save size={16} /> Save Preferences</button>
    </div>
  </div>
);

const coerceBooleanSetting = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
};

const SecuritySection = () => {
  const [settings, setSettings] = useState({
    prevent_double_booking: true,
    enforce_schedule_window: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSecuritySettings = async () => {
      try {
        const [doubleBooking, scheduleWindow] = await Promise.all([
          getAppConfig('prevent_double_booking', true),
          getAppConfig('enforce_schedule_window', true),
        ]);

        if (!mounted) return;
        setSettings({
          prevent_double_booking: coerceBooleanSetting(doubleBooking, true),
          enforce_schedule_window: coerceBooleanSetting(scheduleWindow, true),
        });
        setError('');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError.message || 'Unable to load security toggles.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSecuritySettings();

    return () => {
      mounted = false;
    };
  }, []);

  const updateToggle = async (key, checked) => {
    const previous = settings[key];
    setSettings((current) => ({ ...current, [key]: checked }));
    setSavingKey(key);
    setMessage('');
    setError('');

    try {
      await setAppConfig(key, checked);
      setMessage('Security setting saved. The app will apply this to clients and attorneys in realtime.');
    } catch (saveError) {
      setSettings((current) => ({ ...current, [key]: previous }));
      setError(saveError.message || 'Failed to save security setting.');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div className="settings-stack">
      <div className="card">
        <h3 className="card-title"><Lock size={18} /> Booking & Chat Validation</h3>
        {loading ? <p className="settings-hint">Loading security settings...</p> : null}
        {error ? <p className="settings-error">{error}</p> : null}
        {message ? <p className="settings-success">{message}</p> : null}

        <div className="toggle-item border-b">
          <div>
            <h4>Prevent Multiple Active Bookings</h4>
            <p>
              ON blocks clients from booking another consultation while they still have an active one.
              OFF allows repeated bookings for development testing.
            </p>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={settings.prevent_double_booking}
            disabled={loading || Boolean(savingKey)}
            onChange={(event) => updateToggle('prevent_double_booking', event.target.checked)}
          />
        </div>

        <div className="toggle-item">
          <div>
            <h4>Enforce Scheduled Chat Time</h4>
            <p>
              ON blocks client and attorney chat access until the scheduled consultation time.
              OFF lets paid consultations enter the chatroom anytime for retesting.
            </p>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={settings.enforce_schedule_window}
            disabled={loading || Boolean(savingKey)}
            onChange={(event) => updateToggle('enforce_schedule_window', event.target.checked)}
          />
        </div>
      </div>
    </div>
  );
};

const NotificationsSection = () => (
  <div className="settings-stack">
    <div className="card">
      <h3 className="card-title"><BellRing size={18} /> Email Notifications</h3>
      {['New Consultation Requests', 'Client Messages', 'Attorney Updates'].map(item => (
        <div key={item} className="toggle-item border-b">
          <div><h4>{item}</h4><p>Receive notifications for {item.toLowerCase()}</p></div>
          <input type="checkbox" className="switch" defaultChecked />
        </div>
      ))}
      <div className="toggle-item">
        <div><h4>Weekly Reports</h4><p>Get weekly summary reports via email</p></div>
        <input type="checkbox" className="switch" />
      </div>
    </div>
  </div>
);

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

export default Settings;
