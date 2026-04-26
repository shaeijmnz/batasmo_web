import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Plus, Search, 
  Filter, Download, Mail, MapPin, Phone, Calendar, MoreVertical 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './clients.css';
import './AdminTheme.css';

const formatJoinedDate = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const initialsFromName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CL';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
};

const AdminClientsPage = ({ onNavigate = () => {}, profile = {}, onSignOut = () => {} }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState([]);
  const [clientStats, setClientStats] = useState([
    { label: 'Total Clients', value: '0', color: '#1e3a8a' },
    { label: 'Active Clients', value: '0', color: '#22c55e' },
    { label: 'New This Month', value: '0', color: '#eab308' },
    { label: 'Total Consultations', value: '0', color: '#64748b' },
  ]);
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

    const loadClients = async () => {
      try {
        const [profilesRes, appointmentsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, phone, address, created_at')
            .eq('role', 'Client')
            .order('created_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('id, client_id, status, created_at')
            .order('created_at', { ascending: false }),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;

        const profileRows = profilesRes.data || [];
        const appointmentRows = appointmentsRes.data || [];
        const validConsultations = appointmentRows.filter(
          (row) => String(row.status || '').toLowerCase() !== 'cancelled',
        );

        const consultationsByClient = new Map();
        validConsultations.forEach((row) => {
          if (!row.client_id) return;
          consultationsByClient.set(
            row.client_id,
            Number(consultationsByClient.get(row.client_id) || 0) + 1,
          );
        });

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const newThisMonth = profileRows.filter((row) => {
          const created = row.created_at ? new Date(row.created_at) : null;
          if (!created || Number.isNaN(created.getTime())) return false;
          return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
        }).length;

        const activeClientIds = new Set(validConsultations.map((row) => row.client_id).filter(Boolean));

        const normalizedClients = profileRows.map((row) => ({
          id: row.id,
          avatar: initialsFromName(row.full_name),
          name: row.full_name || 'Unnamed Client',
          email: row.email || 'No email',
          location: row.address || 'No location provided',
          phone: row.phone || 'No phone',
          joined: formatJoinedDate(row.created_at),
          consultations: Number(consultationsByClient.get(row.id) || 0),
        }));

        if (!isMounted) return;

        setClients(normalizedClients);
        setClientStats([
          { label: 'Total Clients', value: profileRows.length.toLocaleString(), color: '#1e3a8a' },
          { label: 'Active Clients', value: activeClientIds.size.toLocaleString(), color: '#22c55e' },
          { label: 'New This Month', value: newThisMonth.toLocaleString(), color: '#eab308' },
          { label: 'Total Consultations', value: validConsultations.length.toLocaleString(), color: '#64748b' },
        ]);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setClients([]);
          setLoadError(error.message || 'Failed to load clients.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadClients();

    const profilesChannel = supabase
      .channel('admin-clients-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadClients())
      .subscribe();

    const appointmentsChannel = supabase
      .channel('admin-clients-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadClients())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, []);

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.email, client.location].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [clients, searchTerm]);

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
              <input
                type="text"
                placeholder="Search clients by name, email, or location..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="filter-actions">
              <button className="btn-secondary" onClick={() => handleQuickAction('Client filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Client export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          {/* Clients List */}
          <div className="clients-container">
            <div className="list-header">
              <h3>All Clients ({filteredClients.length})</h3>
            </div>
            {loadError ? <p className="clients-info-message">{loadError}</p> : null}
            {loading ? <p className="clients-info-message">Loading clients...</p> : null}
            <div className="client-stack">
              {filteredClients.map((client) => (
                <div key={client.id} className="client-row">
                  <div className="client-identity">
                    <div className="client-avatar">{client.avatar}</div>
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
              {!loading && !loadError && filteredClients.length === 0 ? (
                <p className="clients-info-message">No clients found.</p>
              ) : null}
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

export default AdminClientsPage;