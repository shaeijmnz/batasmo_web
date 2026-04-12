import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Search, 
  Filter, Download, Video, Phone, MessageCircle, Star, ExternalLink 
} from 'lucide-react';
import './Consultations.css';

const Consultations = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
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

  const stats = [
    { label: 'Completed', value: '3', color: '#22c55e' },
    { label: 'Scheduled', value: '2', color: '#eab308' },
    { label: 'In Progress', value: '1', color: '#3b82f6' },
    { label: 'Total Sessions', value: '6', color: '#64748b' },
  ];

  const sessions = [
    { 
      id: 1, title: 'Divorce Consultation', type: 'Video Call', category: 'Family Law', 
      status: 'Completed', client: 'Maria Santos', attorney: 'Atty. Juan dela Cruz', 
      date: 'Apr 3, 2026', duration: '45 min', rating: 5, notes: 'Initial case assessment completed. Documents submitted.'
    },
    { 
      id: 2, title: 'Business Partnership', type: 'Phone Call', category: 'Corporate Law', 
      status: 'Completed', client: 'John Reyes', attorney: 'Atty. Ana Garcia', 
      date: 'Apr 3, 2026', duration: '30 min', rating: 4, notes: 'Follow-up consultation scheduled.'
    },
    { 
      id: 3, title: 'Legal Defense', type: 'Video Call', category: 'Criminal Law', 
      status: 'Scheduled', client: 'Lisa Tan', attorney: 'Atty. Pedro Mendoza', 
      date: 'Apr 5, 2026', duration: '60 min'
    },
    { 
      id: 4, title: 'Wrongful Termination', type: 'Chat', category: 'Labor Law', 
      status: 'Completed', client: 'David Cruz', attorney: 'Atty. Rosa Santos', 
      date: 'Apr 2, 2026', duration: '25 min', rating: 5, notes: 'Settlement proposal drafted.'
    }
  ];

  const getIcon = (type) => {
    if (type === 'Video Call') return <Video size={14} />;
    if (type === 'Phone Call') return <Phone size={14} />;
    return <MessageCircle size={14} />;
  };

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
              active={item.path === '/consultations'}
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
          <button className="logout-btn" onClick={() => handleQuickAction('Logout clicked')}><LogOut size={18} /> {isSidebarOpen && <span>Logout</span>}</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="navbar">
          <div className="navbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!isSidebarOpen)}><Menu size={24} /></button>
            <h1 className="nav-title">Consultations</h1>
          </div>
          <div className="bell-container"><Bell size={20} /><span className="dot"></span></div>
        </header>

        <div className="content-wrapper">
          <div className="page-header">
            <h2 className="title">Consultations</h2>
            <p className="subtitle">View and manage all consultation sessions</p>
          </div>

          <div className="stats-grid">
            {stats.map((s, i) => (
              <div key={i} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
                <h3 className="stat-value">{s.value}</h3>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="filter-bar">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Search consultations by client, attorney, or category..." />
            </div>
            <div className="action-buttons">
              <button className="btn-secondary" onClick={() => handleQuickAction('Consultation filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Consultation export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          <div className="tabs-container">
            {['All', 'Completed', 'Scheduled', 'In Progress'].map(tab => (
              <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>

          <div className="sessions-list">
            {sessions.map((s) => (
              <div 
                key={s.id} 
                className={`session-card ${expandedId === s.id ? 'expanded' : ''}`}
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div className="session-main">
                  <div className="session-left">
                    <h4 className="session-title">{s.title}</h4>
                    <div className="tag-group">
                      <span className="type-pill">{getIcon(s.type)} {s.type}</span>
                      <span className="category-pill">{s.category}</span>
                    </div>
                    <div className="client-info">
                      <p>Client: <strong>{s.client}</strong></p>
                      <p>Date: {s.date}</p>
                      {s.rating && (
                        <div className="rating">
                          Rating: {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} fill={i < s.rating ? "#eab308" : "none"} color={i < s.rating ? "#eab308" : "#cbd5e1"} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="session-right">
                    <span className={`status-tag ${s.status.toLowerCase().replace(' ', '')}`}>{s.status}</span>
                    <div className="attorney-info">
                      <p>Attorney: <strong>{s.attorney}</strong></p>
                      <p>Duration: {s.duration}</p>
                    </div>
                  </div>
                </div>

                {/* EXPANDED SECTION */}
                {expandedId === s.id && (
                  <div className="expanded-details">
                    <div className="notes-box">
                      <p className="notes-label">Notes:</p>
                      <p className="notes-text">{s.notes || 'No notes available for this session.'}</p>
                    </div>
                    <div className="action-row">
                      <button className="btn-primary" onClick={(event) => {
                        event.stopPropagation();
                        handleQuickAction(`Viewing details for ${s.title}`);
                      }}>View Details</button>
                      <button className="btn-outline" onClick={(event) => {
                        event.stopPropagation();
                        handleQuickAction(`Downloading report for ${s.title}`);
                      }}>Download Report</button>
                    </div>
                  </div>
                )}
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

export default Consultations;