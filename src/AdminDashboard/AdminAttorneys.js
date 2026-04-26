import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Plus, Search, 
  Filter, Download, Mail, Phone, Star, Award, MoreVertical
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './AdminTheme.css';
import './attorneys.css';

const formatSpecialty = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || 'General Practice';
  }
  const text = String(value || '').trim();
  return text || 'General Practice';
};

const formatExperience = (years) => {
  const numeric = Number(years);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric} years experience`;
  }
  return 'Experience not set';
};

const computeAvailability = (activeCount) => (activeCount > 0 ? 'Busy' : 'Available');

const Attorneys = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attorneyStats, setAttorneyStats] = useState([
    { label: 'Total Attorneys', value: '0', color: '#1e3a8a' },
    { label: 'Available Now', value: '0', color: '#22c55e' },
    { label: 'Average Rating', value: '0.0', color: '#eab308' },
    { label: 'Total Consultations', value: '0', color: '#3b82f6' },
  ]);
  const [attorneysList, setAttorneysList] = useState([]);
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

    const loadAttorneys = async () => {
      try {
        const [profilesRes, attorneyProfilesRes, appointmentsRes, feedbackRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .eq('role', 'Attorney')
            .order('created_at', { ascending: false }),
          supabase
            .from('attorney_profiles')
            .select('user_id, years_experience, specialties')
            .order('created_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('id, attorney_id, status')
            .order('created_at', { ascending: false }),
          supabase
            .from('consultation_feedback')
            .select('attorney_id, rating')
            .order('created_at', { ascending: false }),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (attorneyProfilesRes.error) throw attorneyProfilesRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;

        const profileRows = profilesRes.data || [];
        const attorneyProfileRows = attorneyProfilesRes.data || [];
        const appointmentRows = appointmentsRes.data || [];
        const feedbackRows = feedbackRes.data || [];

        const attorneyProfileById = new Map(attorneyProfileRows.map((row) => [row.user_id, row]));

        const consultationsByAttorney = new Map();
        const completedCasesByAttorney = new Map();
        const activeByAttorney = new Map();
        appointmentRows.forEach((row) => {
          const attorneyId = row.attorney_id;
          if (!attorneyId) return;

          const status = String(row.status || '').toLowerCase();
          if (status !== 'cancelled') {
            consultationsByAttorney.set(
              attorneyId,
              Number(consultationsByAttorney.get(attorneyId) || 0) + 1,
            );
          }
          if (status === 'completed') {
            completedCasesByAttorney.set(
              attorneyId,
              Number(completedCasesByAttorney.get(attorneyId) || 0) + 1,
            );
          }
          if (status === 'started' || status === 'in_progress' || status === 'in-progress' || status === 'active') {
            activeByAttorney.set(attorneyId, Number(activeByAttorney.get(attorneyId) || 0) + 1);
          }
        });

        const ratingAggregateByAttorney = new Map();
        feedbackRows.forEach((row) => {
          const attorneyId = row.attorney_id;
          if (!attorneyId) return;
          const current = ratingAggregateByAttorney.get(attorneyId) || { total: 0, count: 0 };
          current.total += Number(row.rating || 0);
          current.count += 1;
          ratingAggregateByAttorney.set(attorneyId, current);
        });

        const normalized = profileRows.map((row) => {
          const extra = attorneyProfileById.get(row.id);
          const ratingData = ratingAggregateByAttorney.get(row.id) || { total: 0, count: 0 };
          const rating = ratingData.count > 0 ? (ratingData.total / ratingData.count) : 0;
          const activeCount = Number(activeByAttorney.get(row.id) || 0);
          return {
            id: row.id,
            name: row.full_name || 'Attorney',
            status: computeAvailability(activeCount),
            rating: rating.toFixed(1),
            specialty: formatSpecialty(extra?.specialties),
            experience: formatExperience(extra?.years_experience),
            email: row.email || 'No email',
            phone: row.phone || 'No phone',
            consultations: Number(consultationsByAttorney.get(row.id) || 0),
            cases: Number(completedCasesByAttorney.get(row.id) || 0),
          };
        });

        const availableCount = normalized.filter((item) => item.status === 'Available').length;
        const totalConsultations = normalized.reduce((sum, item) => sum + item.consultations, 0);
        const ratingValues = normalized.map((item) => Number(item.rating)).filter((value) => value > 0);
        const averageRating = ratingValues.length
          ? (ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(1)
          : '0.0';

        if (!isMounted) return;

        setAttorneysList(normalized);
        setAttorneyStats([
          { label: 'Total Attorneys', value: profileRows.length.toLocaleString(), color: '#1e3a8a' },
          { label: 'Available Now', value: availableCount.toLocaleString(), color: '#22c55e' },
          { label: 'Average Rating', value: averageRating, color: '#eab308' },
          { label: 'Total Consultations', value: totalConsultations.toLocaleString(), color: '#3b82f6' },
        ]);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setAttorneysList([]);
          setLoadError(error.message || 'Failed to load attorneys.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAttorneys();

    const profilesChannel = supabase
      .channel('admin-attorneys-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadAttorneys())
      .subscribe();

    const attorneyProfilesChannel = supabase
      .channel('admin-attorneys-profile-details')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attorney_profiles' }, () => loadAttorneys())
      .subscribe();

    const appointmentsChannel = supabase
      .channel('admin-attorneys-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadAttorneys())
      .subscribe();

    const feedbackChannel = supabase
      .channel('admin-attorneys-feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_feedback' }, () => loadAttorneys())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(attorneyProfilesChannel);
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(feedbackChannel);
    };
  }, []);

  const filteredAttorneys = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return attorneysList;
    return attorneysList.filter((attorney) =>
      [attorney.name, attorney.specialty, attorney.email].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [attorneysList, searchTerm]);

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
        <div className="content-wrapper">
          <div className="page-header">
            <div>
              <h2 className="title">Attorneys Management</h2>
              <p className="subtitle">Manage and view all registered attorneys</p>
            </div>
            <button className="add-btn" onClick={() => handleQuickAction('Use the main admin flow to add attorneys.')}> 
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
              <input
                type="text"
                placeholder="Search attorneys by name, specialty, or email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="filter-actions">
              <button className="btn-secondary" onClick={() => handleQuickAction('Attorney filters opened')}><Filter size={18} /> Filter</button>
              <button className="btn-secondary" onClick={() => handleQuickAction('Attorney export started')}><Download size={18} /> Export</button>
            </div>
          </div>

          {/* Attorneys List */}
          <div className="attorneys-container">
            <div className="list-header">
              <h3>All Attorneys ({filteredAttorneys.length})</h3>
            </div>
            {loadError ? <p className="attorneys-info-message">{loadError}</p> : null}
            {loading ? <p className="attorneys-info-message">Loading attorneys...</p> : null}
            <div className="attorney-stack">
              {filteredAttorneys.map((attorney) => (
                <div key={attorney.id} className="attorney-row">
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
              {!loading && !loadError && filteredAttorneys.length === 0 ? (
                <p className="attorneys-info-message">No attorneys found.</p>
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

export default Attorneys;
