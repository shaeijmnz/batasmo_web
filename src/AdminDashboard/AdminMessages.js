import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Scale,
  FileText,
  BarChart3,
  Settings,
  MessageSquare,
  LogOut,
  Menu,
} from 'lucide-react';
import AdminSupportDrawer from './AdminSupportDrawer';
import { signOutUser } from '../lib/userApi';
import './AdminTheme.css';
import './AdminMessages.css';

const NavItem = ({ icon, label, active, open, onClick }) => (
  <button
    type="button"
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
    title={open ? '' : label}
  >
    <span className="nav-icon">{icon}</span>
    {open ? <span className="nav-label">{label}</span> : null}
  </button>
);

const AdminMessages = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const navigate = (path) => {
    const pageMap = {
      '/': 'admin-home',
      '/clients': 'admin-clients',
      '/attorneys': 'admin-attorneys',
      '/requests': 'admin-requests',
      '/consultations': 'admin-consultations',
      '/reports': 'admin-reports',
      '/messages': 'admin-messages',
      '/settings': 'admin-settings',
    };
    onNavigate?.(pageMap[path] || 'admin-home');
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Messages', icon: <MessageSquare size={20} />, path: '/messages' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.warn('[admin] sign out failed', error);
    } finally {
      onNavigate?.('login');
    }
  };

  return (
    <div className="app-container">
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
              active={item.path === '/messages'}
              open={isSidebarOpen}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-section">
            <div className="profile-avatar">AD</div>
            {isSidebarOpen && (
              <div className="profile-info">
                <p className="name">Admin User</p>
                <p className="email">admin@batasmo.com</p>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="main-content adm-messages-main">
        <div className="adm-messages-page">
          <AdminSupportDrawer open mode="page" onClose={() => {}} />
        </div>
      </main>
    </div>
  );
};

export default AdminMessages;
