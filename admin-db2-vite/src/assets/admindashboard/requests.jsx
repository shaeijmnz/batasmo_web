import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Search, 
  Filter, Download, Calendar, Clock, User, ChevronRight 
} from 'lucide-react';
import './Requests.css';

const Requests = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
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

  const requestStats = [
    { label: 'Pending Requests', value: '3', color: '#eab308' },
    { label: 'In Progress', value: '2', color: '#3b82f6' },
    { label: 'Completed', value: '1', color: '#22c55e' },
    { label: 'Total Requests', value: '7', color: '#64748b' },
  ];

  const requests = [
    { 
      id: 1, title: 'Divorce Consultation', status: 'Pending', category: 'Family Law', 
      priority: 'High', client: 'Maria Santos', attorney: 'Atty. Juan dela Cruz', 
      date: 'Apr 4, 2026', time: '2:30 PM' 
    },
    { 
      id: 2, title: 'Tax Compliance Advisory', status: 'In Progress', category: 'Tax Law', 
      priority: 'Low', client: 'Anna Lopez', attorney: 'Atty. Miguel Rivera', 
      date: 'Apr 4, 2026', time: '1:00 PM' 
    },
    { 
      id: 3, title: 'Visa Application Assistance', status: 'Pending', category: 'Immigration Law', 
      priority: 'Medium', client: 'Robert Garcia', attorney: 'Atty. Carmen Lopez', 
      date: 'Apr 5, 2026', time: '11:30 AM' 
    },
    { 
      id: 4, title: 'Child Support Modification', status: 'Cancelled', category: 'Family Law', 
      priority: 'Low', client: 'Sofia Ramos', attorney: 'Atty. Juan dela Cruz', 
      date: 'Apr 2, 2026', time: '4:00 PM' 
    },
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
              active={item.path === '/requests'}
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
            <h1 className="nav-title">Requests</h1>
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
              <h2 className="title">Consultation Requests</h2>
              <p className="subtitle">Manage all consultation requests and appointments</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            {requestStats.map((stat, index) => (
              <div key={index} className="stat-card" style={{ borderLeft: `4px solid ${stat.color}` }}>
                <h3 className="stat-value">{stat.value}</h3>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="search-filter-section">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Search requests by client, attorney, type, or subject..." />
            </div>
            <div className="action-buttons">
              <button className="btn-secondary" onClick={() => handleQuickAction('Request filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Request export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="tabs-container">
            {['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'].map(tab => (
              <button 
                key={tab} 
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div className="requests-stack">
            {requests.map((req) => (
              <div key={req.id} className="request-card">
                <div className="request-header">
                  <div className="header-left">
                    <h3 className="request-title">{req.title}</h3>
                    <div className="tag-group">
                      <span className={`status-pill ${req.status.toLowerCase().replace(' ', '')}`}>
                        <Clock size={12} /> {req.status}
                      </span>
                      <span className="category-pill">{req.category}</span>
                    </div>
                  </div>
                  <span className={`priority-tag ${req.priority.toLowerCase()}`}>
                    {req.priority}
                  </span>
                </div>

                <div className="request-body">
                  <div className="info-column">
                    <div className="info-item">
                      <span className="info-label">Client:</span>
                      <span className="info-text">{req.client}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Date:</span>
                      <span className="info-text">{req.date}</span>
                    </div>
                  </div>
                  <div className="info-column">
                    <div className="info-item">
                      <span className="info-label">Attorney:</span>
                      <span className="info-text">{req.attorney}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Time:</span>
                      <span className="info-text">{req.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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

export default Requests;