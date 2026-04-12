import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Plus, Search, 
  Filter, Download, Mail, MapPin, Phone, Calendar, MoreVertical 
} from 'lucide-react';
import './Clients.css';

const Clients = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const handleQuickAction = (message) => window.alert(message);

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Consultations', icon: <MessageSquare size={20} />, path: '/consultations' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const clientStats = [
    { label: 'Total Clients', value: '2,543', color: '#1e3a8a' },
    { label: 'Active Clients', value: '2,187', color: '#22c55e' },
    { label: 'New This Month', value: '356', color: '#eab308' },
    { label: 'Total Consultations', value: '12,458', color: '#64748b' },
  ];

  const clientsList = [
    { id: 'MS', name: 'Maria Santos', email: 'maria.santos@email.com', location: 'Manila, Philippines', phone: '+63 912 345 6789', joined: 'Jan 15, 2024', consultations: 8 },
    { id: 'JR', name: 'John Reyes', email: 'john.reyes@email.com', location: 'Quezon City, Philippines', phone: '+63 923 456 7890', joined: 'Feb 3, 2024', consultations: 5 },
    { id: 'LT', name: 'Lisa Tan', email: 'lisa.tan@email.com', location: 'Makati, Philippines', phone: '+63 934 567 8901', joined: 'Dec 10, 2023', consultations: 12 },
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
              active={item.path === '/clients'}
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
          <button className="logout-btn" onClick={() => handleQuickAction('Logout clicked')}>
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="navbar">
          <div className="navbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              <Menu size={24} />
            </button>
            <h1 className="nav-title">Clients</h1>
          </div>
          <div className="navbar-right">
            <div className="bell-container">
              <Bell size={20} />
              <span className="dot"></span>
            </div>
          </div>
        </header>

        <div className="content-wrapper">
          <div className="page-header">
            <div>
              <h2 className="title">Clients Management</h2>
              <p className="subtitle">Manage and view all registered clients</p>
            </div>
            <button className="add-btn" onClick={() => handleQuickAction('Add New Client clicked')}>
              <Plus size={18} /> Add New Client
            </button>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            {clientStats.map((stat, index) => (
              <div key={index} className="stat-card" style={{ borderLeft: `4px solid ${stat.color}` }}>
                <h3 className="stat-value">{stat.value}</h3>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="filter-bar">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Search clients by name, email, or location..." />
            </div>
            <div className="filter-actions">
              <button className="btn-secondary" onClick={() => handleQuickAction('Client filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Client export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          {/* Clients List */}
          <div className="clients-container">
            <div className="list-header">
              <h3>All Clients ({clientsList.length})</h3>
            </div>
            <div className="client-stack">
              {clientsList.map((client) => (
                <div key={client.id} className="client-row">
                  <div className="client-identity">
                    <div className="client-avatar">{client.id}</div>
                    <div className="client-details">
                      <div className="name-wrapper">
                        <span className="client-name">{client.name}</span>
                        <span className="status-badge">Active</span>
                      </div>
                      <div className="contact-info">
                        <span><Mail size={14} /> {client.email}</span>
                        <span><MapPin size={14} /> {client.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="client-meta">
                    <div className="meta-info">
                      <span><Phone size={14} /> {client.phone}</span>
                      <span><Calendar size={14} /> Joined: {client.joined}</span>
                    </div>
                    <div className="consult-info">
                      <div className="count-group">
                        <span className="count">{client.consultations}</span>
                        <span className="label">Consultations</span>
                      </div>
                      <MoreVertical size={18} className="more-icon" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

export default Clients;