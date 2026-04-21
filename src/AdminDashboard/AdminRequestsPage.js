import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Search, 
  Filter, Download, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './requests.css';
import './AdminTheme.css';

const normalizeNotaryStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'approved' || value === 'accepted' || value === 'in_process' || value === 'in-progress') return 'In Progress';
  if (value === 'completed') return 'Completed';
  if (value === 'cancelled' || value === 'rejected') return 'Cancelled';
  return 'Pending';
};

const formatDateLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTimeLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
};

const priorityFromStatus = (status) => {
  if (status === 'Pending') return 'High';
  if (status === 'In Progress') return 'Medium';
  return 'Low';
};

const AdminRequestsPage = ({ onNavigate = () => {}, profile = {}, onSignOut = () => {} }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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

  useEffect(() => {
    let isMounted = true;

    const loadNotaryRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('notarial_requests')
          .select('id, service_type, status, preferred_date, created_at, client:client_id(full_name), attorney:attorney_id(full_name)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const normalized = (data || []).map((row) => {
          const status = normalizeNotaryStatus(row.status);
          const schedule = row.preferred_date || row.created_at;
          return {
            id: row.id,
            title: row.service_type || 'Notary Request',
            status,
            category: 'Notary Service',
            priority: priorityFromStatus(status),
            client: row.client?.full_name || 'Client',
            attorney: row.attorney?.full_name || 'Unassigned',
            date: formatDateLabel(schedule),
            time: formatTimeLabel(schedule),
          };
        });

        if (!isMounted) return;
        setRequests(normalized);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setRequests([]);
          setLoadError(error.message || 'Failed to load notary requests.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadNotaryRequests();

    const notaryChannel = supabase
      .channel('admin-notary-requests-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notarial_requests' }, () => loadNotaryRequests())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(notaryChannel);
    };
  }, []);

  const requestStats = useMemo(() => {
    const pending = requests.filter((item) => item.status === 'Pending').length;
    const inProgress = requests.filter((item) => item.status === 'In Progress').length;
    const completed = requests.filter((item) => item.status === 'Completed').length;
    return [
      { label: 'Pending Requests', value: pending.toLocaleString(), color: '#eab308' },
      { label: 'In Progress', value: inProgress.toLocaleString(), color: '#3b82f6' },
      { label: 'Completed', value: completed.toLocaleString(), color: '#22c55e' },
      { label: 'Total Requests', value: requests.length.toLocaleString(), color: '#64748b' },
    ];
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const byTab = activeTab === 'All' ? requests : requests.filter((item) => item.status === activeTab);
    if (!term) return byTab;
    return byTab.filter((item) =>
      [item.title, item.client, item.attorney].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [activeTab, requests, searchTerm]);

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
            <div className="profile-avatar">{(profile?.full_name || 'Admin User').split(' ').map((p) => p[0] || '').slice(0,2).join('').toUpperCase() || 'AD'}</div>
            {isSidebarOpen && (
              <div className="profile-info">
                <p className="name">{profile?.full_name || 'Admin User'}</p>
                <p className="email">{profile?.email || ''}</p>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={() => onSignOut()}>
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
              <h2 className="title">Notary Requests</h2>
              <p className="subtitle">Manage all notary requests and document processing</p>
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
              <input
                type="text"
                placeholder="Search requests by client, attorney, or type..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
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
            {loadError ? <p className="requests-info-message">{loadError}</p> : null}
            {loading ? <p className="requests-info-message">Loading notary requests...</p> : null}
            {visibleRequests.map((req) => (
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
            {!loading && !loadError && visibleRequests.length === 0 ? (
              <p className="requests-info-message">No notary requests found.</p>
            ) : null}
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

export default AdminRequestsPage;