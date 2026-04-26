import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Plus, Search, 
  Filter, Download, Mail, Phone, Calendar, MoreVertical 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './AdminTheme.css';
import './clients.css';

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

const Clients = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState([]);
  const [clientMetrics, setClientMetrics] = useState({ total: 0, newThisMonth: 0, totalConsultations: 0 });
  const [onlineClientIds, setOnlineClientIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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

        const normalizedClients = profileRows.map((row) => ({
          id: row.id,
          avatar: initialsFromName(row.full_name),
          name: row.full_name || 'Unnamed Client',
          email: row.email || 'No email',
          phone: row.phone || 'No phone',
          joined: formatJoinedDate(row.created_at),
          consultations: Number(consultationsByClient.get(row.id) || 0),
        }));

        if (!isMounted) return;

        setClients(normalizedClients);
        setClientMetrics({
          total: profileRows.length,
          newThisMonth,
          totalConsultations: validConsultations.length,
        });
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

  useEffect(() => {
    const syncOnlineClients = (channel) => {
      const state = channel.presenceState();
      const nextOnlineIds = new Set();

      Object.values(state || {}).forEach((presences) => {
        (presences || []).forEach((presence) => {
          if (presence?.role === 'Client' && presence?.user_id) {
            nextOnlineIds.add(String(presence.user_id));
          }
        });
      });

      setOnlineClientIds(nextOnlineIds);
    };

    const presenceChannel = supabase
      .channel('online-clients')
      .on('presence', { event: 'sync' }, () => syncOnlineClients(presenceChannel))
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const clientStats = useMemo(() => [
    { label: 'Total Clients', value: clientMetrics.total.toLocaleString(), color: '#1e3a8a' },
    { label: 'Active Clients', value: onlineClientIds.size.toLocaleString(), color: '#22c55e' },
    { label: 'New This Month', value: clientMetrics.newThisMonth.toLocaleString(), color: '#eab308' },
    { label: 'Total Consultations', value: clientMetrics.totalConsultations.toLocaleString(), color: '#64748b' },
  ], [clientMetrics, onlineClientIds.size]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.email].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [clients, searchTerm]);

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
                placeholder="Search clients by name or email..."
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
                        <span className={`status-badge ${onlineClientIds.has(String(client.id)) ? 'online' : 'offline'}`}>
                          {onlineClientIds.has(String(client.id)) ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="contact-info">
                        <span><Mail size={14} /> {client.email}</span>
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

export default Clients;
