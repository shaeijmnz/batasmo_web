import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText,
  BarChart3, Settings as SettingsIcon, LogOut, Menu,
  User, Lock, BellRing, CreditCard, Save, Globe, Smartphone, Download
} from 'lucide-react';
import './AdminTheme.css';
import './settings.css';

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
        <div className="plan-price">PHP29,999<span>/month</span></div>
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
            <span className="price">PHP29,999</span>
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

export default Settings;
