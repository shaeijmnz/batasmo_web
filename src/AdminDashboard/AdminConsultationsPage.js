import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Search, 
  Filter, Download, Video, Phone, MessageCircle, Star
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './consultations.css';
import './AdminTheme.css';

const normalizeConsultationStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return 'Completed';
  if (value === 'confirmed' || value === 'rescheduled') return 'Scheduled';
  if (value === 'started' || value === 'in_progress' || value === 'in-progress' || value === 'active') return 'In Progress';
  return 'Scheduled';
};

const formatDateLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDurationLabel = (minutes) => `${Number(minutes || 60)} min`;

const AdminConsultationsPage = ({ onNavigate = () => {}, profile = {}, onSignOut = () => {} }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState([]);
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

    const loadConsultations = async () => {
      try {
        const [appointmentsRes, feedbackRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, title, notes, scheduled_at, duration_minutes, status, client:client_id(full_name), attorney:attorney_id(full_name)')
            .order('scheduled_at', { ascending: false }),
          supabase
            .from('consultation_feedback')
            .select('appointment_id, rating, comment')
            .order('created_at', { ascending: false }),
        ]);

        if (appointmentsRes.error) throw appointmentsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;

        const feedbackByAppointment = new Map();
        (feedbackRes.data || []).forEach((row) => {
          if (!row.appointment_id || feedbackByAppointment.has(row.appointment_id)) return;
          feedbackByAppointment.set(row.appointment_id, {
            rating: Number(row.rating || 0),
            comment: String(row.comment || '').trim(),
          });
        });

        const normalized = (appointmentsRes.data || [])
          .filter((row) => String(row.status || '').toLowerCase() !== 'cancelled')
          .map((row) => {
            const status = normalizeConsultationStatus(row.status);
            const feedback = feedbackByAppointment.get(row.id);
            return {
              id: row.id,
              title: row.title || 'Consultation',
              type: 'Online Session',
              category: row.title || 'Consultation',
              status,
              client: row.client?.full_name || 'Client',
              attorney: row.attorney?.full_name || 'Attorney',
              date: formatDateLabel(row.scheduled_at),
              duration: formatDurationLabel(row.duration_minutes),
              rating: feedback?.rating || 0,
              notes: feedback?.comment || row.notes || '',
            };
          });

        if (!isMounted) return;
        setSessions(normalized);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setSessions([]);
          setLoadError(error.message || 'Failed to load consultations.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConsultations();

    const appointmentsChannel = supabase
      .channel('admin-consultations-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadConsultations())
      .subscribe();

    const feedbackChannel = supabase
      .channel('admin-consultations-feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_feedback' }, () => loadConsultations())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(feedbackChannel);
    };
  }, []);

  const stats = useMemo(() => {
    const completed = sessions.filter((item) => item.status === 'Completed').length;
    const scheduled = sessions.filter((item) => item.status === 'Scheduled').length;
    const inProgress = sessions.filter((item) => item.status === 'In Progress').length;
    return [
      { label: 'Completed', value: completed.toLocaleString(), color: '#22c55e' },
      { label: 'Scheduled', value: scheduled.toLocaleString(), color: '#eab308' },
      { label: 'In Progress', value: inProgress.toLocaleString(), color: '#3b82f6' },
      { label: 'Total Sessions', value: sessions.length.toLocaleString(), color: '#64748b' },
    ];
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const byTab = activeTab === 'All' ? sessions : sessions.filter((item) => item.status === activeTab);
    const term = searchTerm.trim().toLowerCase();
    if (!term) return byTab;
    return byTab.filter((item) =>
      [item.title, item.client, item.attorney, item.category].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [activeTab, sessions, searchTerm]);

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
            <div className="profile-avatar">{(profile?.full_name || 'Admin User').split(' ').map((p) => p[0] || '').slice(0,2).join('').toUpperCase() || 'AD'}</div>
            {isSidebarOpen && (
              <div className="profile-info">
                <p className="name">{profile?.full_name || 'Admin User'}</p>
                <p className="email">{profile?.email || ''}</p>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={() => onSignOut()}><LogOut size={18} /> {isSidebarOpen && <span>Logout</span>}</button>
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
              <input
                type="text"
                placeholder="Search consultations by client, attorney, or category..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
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
            {loadError ? <p className="consultations-info-message">{loadError}</p> : null}
            {loading ? <p className="consultations-info-message">Loading consultations...</p> : null}
            {visibleSessions.map((s) => (
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
            {!loading && !loadError && visibleSessions.length === 0 ? (
              <p className="consultations-info-message">No consultations found.</p>
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

export default AdminConsultationsPage;