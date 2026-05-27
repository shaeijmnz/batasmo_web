import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale,
  BarChart3, Settings, LogOut, Menu, Plus, Search, 
  Filter, Download, Mail, Calendar, X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { adminCreateWalkInAttorney } from '../lib/userApi';
import { isValidEmail, VALID_EMAIL_MESSAGE } from '../lib/validators';
import ManageAvailabilityPanel from '../components/ManageAvailabilityPanel';
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

const resolveAttorneyImage = (name) => {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^atty\s+/, '')
    .trim();

  if (normalized.includes('jeanne') && normalized.includes('anarna')) {
    return '/assets/attorneys/jeanne-luz-castillo-anarna.jpg';
  }

  if (normalized.includes('alston') && normalized.includes('anarna')) {
    return '/assets/attorneys/alston-kevin-anarna.jpg';
  }

  if (normalized.includes('allen') && normalized.includes('anarna')) {
    return '/assets/attorneys/allen-kristopher-anarna.png';
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Attorney')}&background=152238&color=ffffff`;
};

const Attorneys = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attorneyStats, setAttorneyStats] = useState([
    { label: 'Total Attorneys', value: '0', color: '#1e3a8a' },
    { label: 'Available Now', value: '0', color: '#22c55e' },
    { label: 'Total Consultations', value: '0', color: '#3b82f6' },
  ]);
  const [attorneysList, setAttorneysList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [availabilityAttorney, setAvailabilityAttorney] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addSpecialty, setAddSpecialty] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addFormError, setAddFormError] = useState('');
  const [addSuccessNotice, setAddSuccessNotice] = useState('');
  const [createdAttorney, setCreatedAttorney] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');
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
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const loadAttorneys = useCallback(async () => {
    try {
      const [profilesRes, attorneyProfilesRes, appointmentsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email')
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
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (attorneyProfilesRes.error) throw attorneyProfilesRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;

        const profileRows = profilesRes.data || [];
        const attorneyProfileRows = attorneyProfilesRes.data || [];
        const appointmentRows = appointmentsRes.data || [];

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

        const normalized = profileRows.map((row) => {
          const extra = attorneyProfileById.get(row.id);
          const activeCount = Number(activeByAttorney.get(row.id) || 0);
          return {
            id: row.id,
            name: row.full_name || 'Attorney',
            imageUrl: resolveAttorneyImage(row.full_name || 'Attorney'),
            status: computeAvailability(activeCount),
            specialty: formatSpecialty(extra?.specialties),
            experience: formatExperience(extra?.years_experience),
            email: row.email || 'No email',
            consultations: Number(consultationsByAttorney.get(row.id) || 0),
            cases: Number(completedCasesByAttorney.get(row.id) || 0),
          };
        });

      const availableCount = normalized.filter((item) => item.status === 'Available').length;
      const completedConsultations = normalized.reduce((sum, item) => sum + item.cases, 0);

      setAttorneysList(normalized);
      setAttorneyStats([
        { label: 'Total Attorneys', value: profileRows.length.toLocaleString(), color: '#1e3a8a' },
        { label: 'Available Now', value: availableCount.toLocaleString(), color: '#22c55e' },
        { label: 'Total Consultations', value: completedConsultations.toLocaleString(), color: '#3b82f6' },
      ]);
      setLoadError('');
    } catch (error) {
      setAttorneysList([]);
      setLoadError(error.message || 'Failed to load attorneys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(attorneyProfilesChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [loadAttorneys]);

  const filteredAttorneys = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return attorneysList;
    return attorneysList.filter((attorney) =>
      [attorney.name, attorney.specialty, attorney.email].some((value) =>
        String(value || '').toLowerCase().includes(term),
      ),
    );
  }, [attorneysList, searchTerm]);

  const openAvailabilityManager = (attorney) => {
    setAvailabilityAttorney(attorney);
  };

  const closeAvailabilityManager = () => {
    setAvailabilityAttorney(null);
  };

  const closeAddModal = () => {
    if (addSubmitting) return;
    setAddModalOpen(false);
    setAddFormError('');
    setCreatedAttorney(null);
    setCopyFeedback('');
  };

  const openAddAttorneyModal = () => {
    setAddFormError('');
    setAddSuccessNotice('');
    setCreatedAttorney(null);
    setCopyFeedback('');
    setAddModalOpen(true);
  };

  const copyAttorneyCredentials = async () => {
    if (!createdAttorney) return;
    const loginUrl = 'https://batasmo-web.vercel.app/login';
    const text = [
      `Welcome to BatasMo, ${createdAttorney.fullName}!`,
      '',
      `Email: ${createdAttorney.email}`,
      `Password: ${createdAttorney.password}`,
      `Sign in: ${loginUrl}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Copied to clipboard');
    } catch {
      setCopyFeedback('Could not copy — select and copy manually');
    }
  };

  const handleAddAttorney = async (event) => {
    event.preventDefault();
    setAddFormError('');
    const email = addEmail.trim().toLowerCase();
    const fullName = addFullName.trim();
    if (!email) {
      setAddFormError('Email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setAddFormError(VALID_EMAIL_MESSAGE);
      return;
    }
    if (!fullName) {
      setAddFormError('Attorney name is required.');
      return;
    }

    try {
      setAddSubmitting(true);
      const result = await adminCreateWalkInAttorney({
        email,
        fullName,
        specialty: addSpecialty.trim(),
      });
      const generatedPassword = result?.generatedPassword;
      if (!generatedPassword) {
        throw new Error('Account created but no password was returned. Check the backend deployment.');
      }
      setCreatedAttorney({
        email: result.email || email,
        password: generatedPassword,
        fullName: result.fullName || fullName,
      });
      setAddEmail('');
      setAddFullName('');
      setAddSpecialty('');
      setAddSuccessNotice(`Account created for ${email}. Share the generated password so the attorney can sign in.`);
      setLoading(true);
      await loadAttorneys();
    } catch (error) {
      setAddFormError(error.message || 'Unable to create attorney account.');
    } finally {
      setAddSubmitting(false);
    }
  };

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
            <button type="button" className="add-btn" onClick={openAddAttorneyModal}>
              <Plus size={18} /> Add New Attorney
            </button>
          </div>

          {addSuccessNotice ? (
            <p className="attorneys-success-message" role="status">{addSuccessNotice}</p>
          ) : null}

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
                    <img className="attorney-avatar" src={attorney.imageUrl} alt={`${attorney.name} profile`} />
                    <div className="attorney-details">
                      <div className="name-wrapper">
                        <span className="attorney-name">{attorney.name}</span>
                        <span className={`status-badge ${attorney.status.toLowerCase()}`}>{attorney.status}</span>
                      </div>
                      <div className="specialty-row">
                        <span className="specialty-badge">{attorney.specialty}</span>
                        <span className="exp-text">{attorney.experience}</span>
                      </div>
                      <div className="contact-info">
                        <span><Mail size={14} /> {attorney.email}</span>
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
                    <button
                      type="button"
                      className="manage-availability-btn"
                      onClick={() => openAvailabilityManager(attorney)}
                    >
                      <Calendar size={16} />
                      Manage Availability
                    </button>
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

      {addModalOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <div
            className="add-attorney-modal"
            role="dialog"
            aria-labelledby="add-attorney-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="add-attorney-title">Add attorney</h3>
              <button
                type="button"
                className="modal-close-btn"
                disabled={addSubmitting}
                onClick={closeAddModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {createdAttorney ? (
              <>
                <p className="modal-subtitle">
                  Account created for <strong>{createdAttorney.fullName}</strong>.
                  Share these login details with the attorney. After sign-in they will open the Attorney Dashboard.
                </p>
                <div className="attorney-created-credentials">
                  <p><strong>Email</strong> {createdAttorney.email}</p>
                  <p><strong>Password</strong> <code>{createdAttorney.password}</code></p>
                  <p><strong>Login</strong> https://batasmo-web.vercel.app/login</p>
                </div>
                {copyFeedback ? <p className="modal-copy-feedback">{copyFeedback}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="modal-cancel-btn" onClick={copyAttorneyCredentials}>
                    Copy credentials
                  </button>
                  <button type="button" className="modal-submit-btn" onClick={closeAddModal}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
            <p className="modal-subtitle">
              Creates an attorney login with a system-generated password. Copy and share the credentials after create.
            </p>
            <form className="modal-form" onSubmit={handleAddAttorney}>
              <div className="modal-input-group">
                <label htmlFor="add-attorney-email">Email</label>
                <input
                  id="add-attorney-email"
                  type="email"
                  autoComplete="off"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  disabled={addSubmitting}
                  required
                />
              </div>
              <div className="modal-input-group">
                <label htmlFor="add-attorney-name">Full name</label>
                <input
                  id="add-attorney-name"
                  type="text"
                  placeholder="Atty. Juan Dela Cruz"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  disabled={addSubmitting}
                  required
                />
              </div>
              <div className="modal-input-group">
                <label htmlFor="add-attorney-specialty">
                  Specialty <span className="modal-optional">(optional)</span>
                </label>
                <input
                  id="add-attorney-specialty"
                  type="text"
                  placeholder="Real Estate and Land Registration Law"
                  value={addSpecialty}
                  onChange={(e) => setAddSpecialty(e.target.value)}
                  disabled={addSubmitting}
                />
              </div>
              {addFormError ? <p className="modal-form-error">{addFormError}</p> : null}
              <div className="modal-actions">
                <button type="button" className="modal-cancel-btn" disabled={addSubmitting} onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn" disabled={addSubmitting}>
                  {addSubmitting ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
              </>
            )}
          </div>
        </div>
      ) : null}


      {availabilityAttorney ? (
        <ManageAvailabilityPanel
          attorneyId={availabilityAttorney.id}
          displayName={availabilityAttorney.name}
          variant="admin"
          onClose={closeAvailabilityManager}
        />
      ) : null}
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
