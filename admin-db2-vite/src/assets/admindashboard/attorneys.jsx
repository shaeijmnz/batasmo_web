import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Plus, Search, 
  Filter, Download, Mail, Phone, Star, Award, MoreVertical, X
} from 'lucide-react';
import './Attorneys.css';

const Attorneys = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const handleQuickAction = (message) => window.alert(message);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const initialAttorneyForm = {
    name: '',
    email: '',
    specialty: '',
  };

  const [attorneyForm, setAttorneyForm] = useState(initialAttorneyForm);

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Consultations', icon: <MessageSquare size={20} />, path: '/consultations' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const attorneyStats = [
    { label: 'Total Attorneys', value: '86', color: '#1e3a8a' },
    { label: 'Available Now', value: '72', color: '#22c55e' },
    { label: 'Average Rating', value: '4.8', color: '#eab308' },
    { label: 'Total Consultations', value: '1,243', color: '#3b82f6' },
  ];

  const [attorneysList, setAttorneysList] = useState([
    { 
      name: 'Atty. Juan dela Cruz', 
      status: 'Available', 
      rating: '4.9', 
      specialty: 'Family Law', 
      experience: '15 years experience', 
      email: 'juan.delacruz@batasmo.com', 
      phone: '+63 912 111 2222', 
      consultations: '234', 
      cases: '89' 
    },
    { 
      name: 'Atty. Ana Garcia', 
      status: 'Available', 
      rating: '4.8', 
      specialty: 'Corporate Law', 
      experience: '12 years experience', 
      email: 'ana.garcia@batasmo.com', 
      phone: '+63 923 222 3333', 
      consultations: '198', 
      cases: '76' 
    },
    { 
      name: 'Atty. Pedro Mendoza', 
      status: 'Busy', 
      rating: '4.9', 
      specialty: 'Criminal Law', 
      experience: '18 years experience', 
      email: 'pedro.mendoza@batasmo.com', 
      phone: '+63 934 333 4444', 
      consultations: '176', 
      cases: '92' 
    },
  ]);

  const handleOpenAddModal = () => {
    setAttorneyForm(initialAttorneyForm);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setAttorneyForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddAttorney = (event) => {
    event.preventDefault();

    if (!attorneyForm.name.trim() || !attorneyForm.email.trim() || !attorneyForm.specialty.trim()) {
      handleQuickAction('Please complete all fields before adding an attorney.');
      return;
    }

    const newAttorney = {
      name: attorneyForm.name.trim(),
      status: 'Available',
      rating: '4.8',
      specialty: attorneyForm.specialty.trim(),
      experience: 'Newly added',
      email: attorneyForm.email.trim(),
      phone: 'Not provided',
      consultations: '0',
      cases: '0',
    };

    setAttorneysList((prev) => [newAttorney, ...prev]);
    setIsAddModalOpen(false);
    handleQuickAction('Attorney added successfully.');
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
              active={item.path === '/attorneys'}
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
            <h1 className="nav-title">Attorneys</h1>
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
              <h2 className="title">Attorneys Management</h2>
              <p className="subtitle">Manage and view all registered attorneys</p>
            </div>
            <button className="add-btn" onClick={handleOpenAddModal}>
              <Plus size={18} /> Add New Attorney
            </button>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            {attorneyStats.map((stat, index) => (
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
              <input type="text" placeholder="Search attorneys by name, specialty, or email..." />
            </div>
            <div className="filter-actions">
              <button className="btn-secondary" onClick={() => handleQuickAction('Attorney filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Attorney export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          {/* Attorneys List */}
          <div className="attorneys-container">
            <div className="list-header">
              <h3>All Attorneys ({attorneysList.length})</h3>
            </div>
            <div className="attorney-stack">
              {attorneysList.map((attorney, i) => (
                <div key={i} className="attorney-row">
                  <div className="attorney-identity">
                    <div className="attorney-avatar">
                      <Award size={24} />
                    </div>
                    <div className="attorney-details">
                      <div className="name-wrapper">
                        <span className="attorney-name">{attorney.name}</span>
                        <span className={`status-badge ${attorney.status.toLowerCase()}`}>{attorney.status}</span>
                        <span className="rating-tag"><Star size={14} fill="#eab308" color="#eab308" /> {attorney.rating}</span>
                      </div>
                      <div className="specialty-row">
                        <span className="specialty-badge">{attorney.specialty}</span>
                        <span className="exp-text">{attorney.experience}</span>
                      </div>
                      <div className="contact-info">
                        <span><Mail size={14} /> {attorney.email}</span>
                        <span><Phone size={14} /> {attorney.phone}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="attorney-metrics">
                    <div className="metric-box">
                      <span className="m-value">{attorney.consultations}</span>
                      <span className="m-label">Consultations</span>
                    </div>
                    <div className="metric-box">
                      <span className="m-value">{attorney.cases}</span>
                      <span className="m-label">Cases</span>
                    </div>
                    <MoreVertical size={20} className="more-icon" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {isAddModalOpen && (
        <div className="modal-overlay" onClick={handleCloseAddModal}>
          <div className="add-attorney-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Attorney</h3>
              <button className="modal-close-btn" onClick={handleCloseAddModal}>
                <X size={20} />
              </button>
            </div>

            <p className="modal-subtitle">Add a new attorney to the system by filling out the form below.</p>

            <form className="modal-form" onSubmit={handleAddAttorney}>
              <div className="modal-input-group">
                <label htmlFor="attorney-name">Name</label>
                <input
                  id="attorney-name"
                  name="name"
                  type="text"
                  value={attorneyForm.name}
                  onChange={handleFormChange}
                  placeholder="Atty. Juan dela Cruz"
                />
              </div>

              <div className="modal-input-group">
                <label htmlFor="attorney-email">Email</label>
                <input
                  id="attorney-email"
                  name="email"
                  type="email"
                  value={attorneyForm.email}
                  onChange={handleFormChange}
                  placeholder="juan.delacruz@batasmo.com"
                />
              </div>

              <div className="modal-input-group">
                <label htmlFor="attorney-specialty">Specialty</label>
                <input
                  id="attorney-specialty"
                  name="specialty"
                  type="text"
                  value={attorneyForm.specialty}
                  onChange={handleFormChange}
                  placeholder="Family Law"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-cancel-btn" onClick={handleCloseAddModal}>Cancel</button>
                <button type="submit" className="modal-submit-btn">Add Attorney</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

export default Attorneys;