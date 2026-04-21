import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Scale, FileText, MessageSquare,
  BarChart3, Settings as SettingsIcon, LogOut, Menu, Bell,
  User, Lock, BellRing, CreditCard, Save, Globe, Smartphone, Download, ShieldCheck
} from 'lucide-react';
import { getAppConfig, setAppConfig } from '../lib/userApi';
import { showWindowToast } from './adminUtils';
import './settings.css';
import './AdminTheme.css';

const handleQuickAction = (message) => window.alert(message);

const AdminSettingsPage = ({ onNavigate = () => {}, profile = {}, onSignOut = () => {} }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Profile');
  const [preventDoubleBooking, setPreventDoubleBooking] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const current = await getAppConfig('prevent_double_booking', true);
      if (!isMounted) return;
      const enabled = typeof current === 'boolean' ? current : String(current).toLowerCase() === 'true';
      setPreventDoubleBooking(enabled);
      setLoadingConfig(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleDoubleBooking = async () => {
    if (savingConfig) return;
    const next = !preventDoubleBooking;
    setPreventDoubleBooking(next);
    setSavingConfig(true);
    try {
      await setAppConfig('prevent_double_booking', next);
      showWindowToast(
        next
          ? 'Double-booking prevention is now ON. Clients cannot book while they have an active appointment.'
          : 'Double-booking prevention is now OFF. Clients can book unlimited appointments.',
      );
    } catch (error) {
      setPreventDoubleBooking(!next);
      showWindowToast(error.message || 'Failed to update setting.');
    } finally {
      setSavingConfig(false);
    }
  };
  const navigate = (to) => {
    const map = {
          "/": "admin-home",
          "/clients": "admin-clients",
          "/attorneys": "admin-attorneys",
          "/requests": "admin-requests",
          "/consultations": "admin-consultations",
          "/reports": "admin-reports",
          "/settings": "admin-settings"
    };
    const target = map[to] || to;
    if (typeof onNavigate === 'function') onNavigate(target);
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Consultations', icon: <MessageSquare size={20} />, path: '/consultations' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <SettingsIcon size={20} />, path: '/settings' },
  ];

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <img src="/logo/logo.jpg" alt="BatasMo logo" className="brand-logo" />
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
            <div className="profile-avatar">{(profile?.full_name || 'Admin User').split(' ').map((p) => p[0] || '').slice(0,2).join('').toUpperCase() || 'AD'}</div>
            {isSidebarOpen && <div className="profile-info"><p className="name">{profile?.full_name || 'Admin User'}</p><p className="email">{profile?.email || ''}</p></div>}
          </div>
          <button className="logout-btn" onClick={() => onSignOut()}><LogOut size={18} /> {isSidebarOpen && "Logout"}</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="navbar">
          <div className="navbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!isSidebarOpen)}><Menu size={24} /></button>
            <h1 className="nav-title">Settings</h1>
          </div>
          <div className="navbar-right"><div className="bell-container"><Bell size={20} /><span className="dot"></span></div></div>
        </header>

        <div className="content-wrapper">
          <div className="page-header">
            <h2 className="title">Settings</h2>
            <p className="subtitle">Manage your account settings and preferences</p>
          </div>

          {/* TAB NAVIGATION */}
          <div className="settings-tabs">
            {['Profile', 'Security', 'Notifications', 'Billing'].map(tab => (
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
            <div
              className="card"
              style={{
                borderLeft: `4px solid ${preventDoubleBooking ? '#22c55e' : '#ef4444'}`,
                marginBottom: 16,
              }}
            >
              <h3 className="card-title">
                <ShieldCheck size={18} /> Booking Rules
              </h3>
              <div
                className="toggle-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  paddingTop: 8,
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>Prevent Client Double Booking</h4>
                  <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
                    {preventDoubleBooking
                      ? 'ON — Clients with an active appointment cannot book another one until it is finished or cancelled.'
                      : 'OFF — Clients can book unlimited appointments even if they already have active ones. (Bypass mode)'}
                  </p>
                  {loadingConfig ? (
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                      Loading current setting...
                    </p>
                  ) : null}
                </div>
                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 56,
                    height: 30,
                    flexShrink: 0,
                    cursor: savingConfig ? 'wait' : 'pointer',
                    opacity: savingConfig ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={preventDoubleBooking}
                    onChange={toggleDoubleBooking}
                    disabled={savingConfig || loadingConfig}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: preventDoubleBooking ? '#22c55e' : '#cbd5e1',
                      borderRadius: 999,
                      transition: 'background 0.2s ease',
                    }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: preventDoubleBooking ? 29 : 3,
                      width: 24,
                      height: 24,
                      background: '#ffffff',
                      borderRadius: '50%',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
                    }}
                  />
                </label>
              </div>
            </div>

            {activeTab === 'Profile' && <ProfileSection />}
            {activeTab === 'Security' && <SecuritySection />}
            {activeTab === 'Notifications' && <NotificationsSection />}
            {activeTab === 'Billing' && <BillingSection />}
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

const SecuritySection = () => (
  <div className="settings-stack">
    <div className="card">
      <h3 className="card-title"><Lock size={18} /> Change Password</h3>
      <div className="input-group"><label>Current Password</label><input type="password" /></div>
      <div className="input-group"><label>New Password</label><input type="password" /></div>
      <div className="input-group"><label>Confirm New Password</label><input type="password" /></div>
      <button className="btn-save" onClick={() => handleQuickAction('Password update requested')}><Save size={16} /> Update Password</button>
    </div>
    <div className="card">
      <h3 className="card-title"><Smartphone size={18} /> Two-Factor Authentication</h3>
      <div className="toggle-item">
        <div><h4>Enable 2FA</h4><p>Add an extra layer of security</p></div>
        <input type="checkbox" className="switch" />
      </div>
      <button className="btn-save gold-outline" onClick={() => handleQuickAction('2FA configuration started')}>Configure 2FA</button>
    </div>
  </div>
);

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

const BillingSection = () => (
  <div className="settings-stack">
    <div className="card">
      <h3 className="card-title"><CreditCard size={18} /> Subscription Plan</h3>
      <div className="plan-banner">
        <div className="plan-info">
          <h4>Enterprise Plan</h4>
          <p>Unlimited attorneys and clients</p>
        </div>
        <div className="plan-price">₱29,999<span>/month</span></div>
      </div>
      <button className="btn-full gold" onClick={() => handleQuickAction('Subscription plan change opened')}>Change Plan</button>
    </div>
    
    <div className="card">
      <h3 className="card-title">Payment Method</h3>
      <div className="payment-method">
        <div className="visa-box">VISA</div>
        <div className="card-details">**** **** **** 4242 <span>Expires 12/2025</span></div>
        <button className="btn-edit" onClick={() => handleQuickAction('Payment method editing opened')}>Edit</button>
      </div>
      <button className="btn-add-method" onClick={() => handleQuickAction('Add payment method flow opened')}>Add New Payment Method</button>
    </div>

    <div className="card">
      <h3 className="card-title">Billing History</h3>
      {[1000, 1001, 1002].map((id, i) => (
        <div key={id} className="history-item">
          <div><p>Mar {1+i}, 2026</p><span>Invoice #{id}</span></div>
          <div className="history-right">
            <span className="price">₱29,999</span>
            <span className="status-paid">Paid</span>
            <Download size={16} className="dl-icon" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

export default AdminSettingsPage;