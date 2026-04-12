import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Star, Bell, DollarSign,
  X, Send, Trash2, Eye, AlertCircle, CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import './Dashboard.css';

const Dashboard = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const navigate = useNavigate();
  const handleQuickAction = (message) => window.alert(message);

  // Sample Data
  const clientsData = [
    { id: 1, name: 'Maria Santos', email: 'maria@email.com', phone: '09123456789', status: 'Active' },
    { id: 2, name: 'John Reyes', email: 'john@email.com', phone: '09234567890', status: 'Active' },
    { id: 3, name: 'Lisa Tan', email: 'lisa@email.com', phone: '09345678901', status: 'Active' },
    { id: 4, name: 'David Cruz', email: 'david@email.com', phone: '09456789012', status: 'Active' },
  ];

  const attorneysData = [
    { id: 1, name: 'Atty. Juan dela Cruz', specialty: 'Family Law', consultations: 234, rating: 4.9 },
    { id: 2, name: 'Atty. Ana Garcia', specialty: 'Corporate Law', consultations: 198, rating: 4.8 },
    { id: 3, name: 'Atty. Pedro Mendoza', specialty: 'Criminal Law', consultations: 176, rating: 4.9 },
    { id: 4, name: 'Atty. Rosa Santos', specialty: 'Labor Law', consultations: 165, rating: 4.7 },
  ];

  const [clients, setClients] = useState(clientsData);
  const [totalClients, setTotalClients] = useState(clientsData.length);
  const [attorneys, setAttorneys] = useState(attorneysData);
  const [totalAttorneys, setTotalAttorneys] = useState(attorneysData.length);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      try {
        const [
          { data: clientList, error: clientError },
          { count: clientCount, error: countError },
          { data: attorneyList, error: attorneyError },
          { count: attorneyCount, error: attorneyCountError },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .eq('role', 'Client')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Client'),
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'Attorney')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Attorney'),
        ]);

        if (clientError) throw clientError;
        if (countError) throw countError;
        if (attorneyError) throw attorneyError;
        if (attorneyCountError) throw attorneyCountError;

        const normalizedClients = (clientList || []).map((client) => ({
          id: client.id,
          name: client.full_name || 'Unnamed Client',
          email: client.email || 'No email',
          phone: client.phone || 'No phone',
          status: 'Active',
        }));

        const normalizedAttorneys = (attorneyList || []).map((attorney) => ({
          id: attorney.id,
          name: attorney.full_name || 'Unnamed Attorney',
          specialty: 'Not set',
          consultations: 0,
          rating: null,
          email: attorney.email || 'No email',
        }));

        if (!isMounted) {
          return;
        }

        if (normalizedClients.length > 0) {
          setClients(normalizedClients);
        }

        if (normalizedAttorneys.length > 0) {
          setAttorneys(normalizedAttorneys);
        }

        setTotalClients(clientCount ?? normalizedClients.length ?? clientsData.length);
        setTotalAttorneys(attorneyCount ?? normalizedAttorneys.length ?? attorneysData.length);
      } catch (error) {
        if (isMounted) {
          setClients(clientsData);
          setTotalClients(clientsData.length);
          setAttorneys(attorneysData);
          setTotalAttorneys(attorneysData.length);
        }
        console.error(error);
      }
    };

    loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  const pendingConsultations = [
    { id: 1, clientName: 'Maria Santos', attorneyName: 'Atty. Juan dela Cruz', date: '2025-04-10', time: '10:00 AM', specialty: 'Family Law', status: 'Scheduled' },
    { id: 2, clientName: 'John Reyes', attorneyName: 'Atty. Ana Garcia', date: '2025-04-11', time: '2:00 PM', specialty: 'Corporate Law', status: 'Scheduled' },
  ];

  const pendingNotaryRequests = [
    { id: 1, clientName: 'Lisa Tan', document: 'Contract Agreement', submissionDate: '2025-04-05', status: 'Pending' },
    { id: 2, clientName: 'David Cruz', document: 'Power of Attorney', submissionDate: '2025-04-06', status: 'Pending' },
  ];

  const completedConsultations = [
    { id: 1, clientName: 'Alice Johnson', attorneyName: 'Atty. Juan dela Cruz', date: '2025-04-01', time: '3:00 PM', specialty: 'Family Law', transcript: 'Consultation regarding divorce proceedings...' },
    { id: 2, clientName: 'Robert Smith', attorneyName: 'Atty. Ana Garcia', date: '2025-04-02', time: '10:30 AM', specialty: 'Corporate Law', transcript: 'Discussion on business merger strategies...' },
  ];

  const completedNotaryRequests = [
    { id: 1, clientName: 'Emma Wilson', document: 'Deed of Sale', completionDate: '2025-04-01', pickedUp: true },
    { id: 2, clientName: 'Michael Brown', document: 'Notarized Affidavit', completionDate: '2025-04-03', pickedUp: false },
  ];

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
    { label: 'Total Clients', value: totalClients, color: '#1e3a8a', icon: <Users size={20}/>, modal: 'clients' },
    { label: 'Total Attorneys', value: totalAttorneys, color: '#eab308', icon: <Scale size={20}/>, modal: 'attorneys' },
    { label: 'Pending Requests', value: pendingConsultations.length + pendingNotaryRequests.length, color: '#ef4444', icon: <FileText size={20}/>, modal: 'pendingRequests' },
    { label: 'Completed Consultations', value: completedConsultations.length + completedNotaryRequests.length, color: '#22c55e', icon: <MessageSquare size={20}/>, modal: 'completedRequests' },
  ];

  const revenueData = [45000, 52000, 48000, 61000, 58000, 68000];
  const weekData = [45, 52, 38, 66, 58, 42, 30];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const recentRequests = [
    { name: 'Maria Santos', atty: 'Atty. Juan dela Cruz', law: 'Family Law', status: 'Pending', age: '2 hours ago' },
    { name: 'John Reyes', atty: 'Atty. Ana Garcia', law: 'Corporate Law', status: 'In Progress', age: '4 hours ago' },
    { name: 'Lisa Tan', atty: 'Atty. Pedro Mendoza', law: 'Criminal Law', status: 'Pending', age: '5 hours ago' },
    { name: 'David Cruz', atty: 'Atty. Rosa Santos', law: 'Labor Law', status: 'Completed', age: '1 day ago' },
  ];

  const topAttorneys = [
    { rank: 1, name: 'Atty. Juan dela Cruz', law: 'Family Law', consultations: 234, rating: 4.9 },
    { rank: 2, name: 'Atty. Ana Garcia', law: 'Corporate Law', consultations: 198, rating: 4.8 },
    { rank: 3, name: 'Atty. Pedro Mendoza', law: 'Criminal Law', consultations: 176, rating: 4.9 },
    { rank: 4, name: 'Atty. Rosa Santos', law: 'Labor Law', consultations: 165, rating: 4.7 },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar Section */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <img src="/logo/logo.jpg" alt="BatasMo logo" className="brand-logo" />
          {isSidebarOpen && <span className="logo-text">BatasMo</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              active={item.path === '/'}
              open={isSidebarOpen}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">AD</div>
            {isSidebarOpen && (
              <div className="user-meta">
                <p className="user-name">Admin User</p>
                <p className="user-email">admin@batasmo.com</p>
              </div>
            )}
          </div>
          <button className="logout-action" onClick={() => handleQuickAction('Logout clicked')}>
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Section */}
      <main className="main-panel">
        <header className="top-bar">
          <div className="bar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              <Menu size={24} />
            </button>
            <h2 className="page-title">Dashboard</h2>
          </div>
          <div className="bar-right">
            <div className="notification-icon">
              <div className="red-dot"></div>
              <Bell size={20} />
            </div>
          </div>
        </header>

        <div className="scroll-content">
          {/* Stat Cards Grid */}
          <section className="stats-row">
            {stats.map((stat, i) => (
              <div 
                key={i} 
                className="stat-card clickable-card" 
                style={{ borderLeft: `4px solid ${stat.color}` }}
                onClick={() => setActiveModal(stat.modal)}
              >
                <div className="stat-label">
                  <span>{stat.label}</span>
                  <span style={{ color: '#94a3b8' }}>{stat.icon}</span>
                </div>
                <h3 className="stat-number">{stat.value}</h3>
              </div>
            ))}
          </section>

          <section className="grid-split charts-row">
            <section className="info-card chart-card">
              <div className="card-header">
                <h4><DollarSign size={18} /> Revenue Overview</h4>
              </div>
              <SimpleLineChart values={revenueData} labels={months} />
            </section>

            <section className="info-card chart-card">
              <div className="card-header">
                <h4>Weekly Consultations</h4>
              </div>
              <SimpleBarChart values={weekData} labels={days} />
            </section>
          </section>

          {/* Lower Sections */}
          <div className="grid-split dashboard-lower">
            <section className="info-card">
              <div className="card-header">
                <h4>Recent Requests</h4>
                <a href="#" className="view-all" onClick={(event) => {
                  event.preventDefault();
                  navigate('/requests');
                }}>View All</a>
              </div>
              <div className="list-stack">
                {recentRequests.map((item) => (
                  <RequestItem key={item.name} {...item} />
                ))}
              </div>
            </section>

            <section className="info-card">
              <div className="card-header">
                <h4>Top Attorneys</h4>
                <a href="#" className="view-all" onClick={(event) => {
                  event.preventDefault();
                  navigate('/attorneys');
                }}>View All</a>
              </div>
              <div className="list-stack">
                {topAttorneys.map((item) => (
                  <AttorneyItem key={item.rank} {...item} />
                ))}
              </div>
            </section>
          </div>

          <section className="info-card quick-actions-card">
            <div className="card-header"><h4>Quick Actions</h4></div>
            <div className="quick-actions-grid">
              <button className="quick-btn navy" onClick={() => handleQuickAction('Add Client clicked')}><Users size={16} /> Add Client</button>
              <button className="quick-btn gold" onClick={() => handleQuickAction('Add Attorney clicked')}><Scale size={16} /> Add Attorney</button>
              <button className="quick-btn light" onClick={() => navigate('/requests')}><FileText size={16} /> View Requests</button>
              <button className="quick-btn light" onClick={() => handleQuickAction('Generate Report clicked')}><BarChart3 size={16} /> Generate Report</button>
            </div>
          </section>
        </div>
      </main>

      {/* Modals */}
      {activeModal === 'clients' && (
        <ClientsModal 
          clients={clients} 
          onClose={() => setActiveModal(null)}
          onMessage={(client) => {
            setMessageInput('');
            window.alert(`Messaging ${client.name}: ${messageInput || 'Hello'}`);
          }}
          onRemove={(client) => window.alert(`Removed ${client.name}`)}
        />
      )}

      {activeModal === 'attorneys' && (
        <AttorneysModal 
          attorneys={attorneys} 
          onClose={() => setActiveModal(null)}
          onMessage={(attorney) => {
            setMessageInput('');
            window.alert(`Messaging ${attorney.name}: ${messageInput || 'Hello'}`);
          }}
        />
      )}

      {activeModal === 'pendingRequests' && (
        <PendingRequestsModal 
          consultations={pendingConsultations}
          notaryRequests={pendingNotaryRequests}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'completedRequests' && (
        <CompletedRequestsModal 
          consultations={completedConsultations}
          notaryRequests={completedNotaryRequests}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};

// Modal Components
const ClientsModal = ({ clients, onClose, onMessage, onRemove }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>All Clients</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="clients-list">
          {clients.map((client) => (
            <div key={client.id} className="client-item">
              <div className="client-info">
                <h4>{client.name}</h4>
                <p>{client.email}</p>
                <p>{client.phone}</p>
              </div>
              <div className="client-actions">
                <button className="btn-message" onClick={() => onMessage(client)}>
                  <MessageSquare size={16} /> Message
                </button>
                <button className="btn-remove" onClick={() => onRemove(client)}>
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AttorneysModal = ({ attorneys, onClose, onMessage }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>All Attorneys</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="attorneys-list">
          {attorneys.map((attorney) => (
            <div key={attorney.id} className="attorney-item">
              <div className="attorney-info">
                <h4>{attorney.name}</h4>
                <p>{attorney.specialty || 'No specialty yet'}</p>
                <p>
                  {(attorney.consultations ?? 0)} consultations
                  {attorney.rating ? ` • ${attorney.rating}⭐` : ''}
                </p>
              </div>
              <button className="btn-message" onClick={() => onMessage(attorney)}>
                <MessageSquare size={16} /> Message
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PendingRequestsModal = ({ consultations, notaryRequests, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Pending Requests</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="pending-sections">
          <div className="pending-section">
            <h3>Scheduled Consultations ({consultations.length})</h3>
            <div className="consultations-list">
              {consultations.map((consultation) => (
                <div key={consultation.id} className="consultation-item">
                  <div className="consultation-info">
                    <h4>{consultation.clientName}</h4>
                    <p>Attorney: {consultation.attorneyName}</p>
                    <p>Specialty: {consultation.specialty}</p>
                    <p>Date & Time: {consultation.date} at {consultation.time}</p>
                  </div>
                  <span className={`status-badge ${consultation.status.toLowerCase()}`}>{consultation.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pending-section">
            <h3>Pending Notary Requests ({notaryRequests.length})</h3>
            <div className="notary-list">
              {notaryRequests.map((notary) => (
                <div key={notary.id} className="notary-item">
                  <div className="notary-info">
                    <h4>{notary.clientName}</h4>
                    <p>Document: {notary.document}</p>
                    <p>Submitted: {notary.submissionDate}</p>
                  </div>
                  <span className={`status-badge ${notary.status.toLowerCase()}`}>
                    <AlertCircle size={14} /> {notary.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CompletedRequestsModal = ({ consultations, notaryRequests, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Completed Consultations & Notary Requests</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="completed-sections">
          <div className="completed-section">
            <h3>Completed Consultations ({consultations.length})</h3>
            <div className="completed-consultations-list">
              {consultations.map((consultation) => (
                <div key={consultation.id} className="completed-consultation-item">
                  <div className="consultation-overview">
                    <div className="overview-header">
                      <h4>{consultation.clientName}</h4>
                      <CheckCircle size={18} color="#22c55e" />
                    </div>
                    <div className="overview-details">
                      <p><strong>Attorney:</strong> {consultation.attorneyName}</p>
                      <p><strong>Specialty:</strong> {consultation.specialty}</p>
                      <p><strong>Date & Time:</strong> {consultation.date} at {consultation.time}</p>
                    </div>
                  </div>
                  <button className="btn-view-transcript" onClick={() => window.alert(`Transcript: ${consultation.transcript}`)}>
                    <Eye size={16} /> View Transcript
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="completed-section">
            <h3>Completed Notary Requests ({notaryRequests.length})</h3>
            <div className="completed-notary-list">
              {notaryRequests.map((notary) => (
                <div key={notary.id} className="completed-notary-item">
                  <div className="notary-overview">
                    <div className="overview-header">
                      <h4>{notary.clientName}</h4>
                      {notary.pickedUp ? (
                        <CheckCircle size={18} color="#22c55e" />
                      ) : (
                        <AlertCircle size={18} color="#ef4444" />
                      )}
                    </div>
                    <div className="overview-details">
                      <p><strong>Document:</strong> {notary.document}</p>
                      <p><strong>Completion Date:</strong> {notary.completionDate}</p>
                      <p><strong>Status:</strong> {notary.pickedUp ? '✓ Document Picked Up' : '⚠ Awaiting Pickup'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const RequestItem = ({ name, atty, law, status, age }) => (
  <div className="item-row">
    <div>
      <p className="item-title">{name}</p>
      <p className="item-subtitle">{atty}</p>
      <p className="item-subtitle">{law}</p>
    </div>
    <div className="item-meta-right">
      <div className={`status-tag ${status.toLowerCase().replace(" ", "")}`}>
        {status}
      </div>
      <p className="item-subtitle">{age}</p>
    </div>
  </div>
);

const AttorneyItem = ({ rank, name, law, consultations, rating }) => (
  <div className="item-row">
    <div className="rank-badge">#{rank}</div>
    <div style={{ flex: 1 }}>
      <p className="item-title">{name}</p>
      <p className="item-subtitle">{law}</p>
    </div>
    <div className="item-meta-right">
      <p className="item-title">{consultations}</p>
      <div className="rating-star">
        <Star size={12} fill="#eab308" color="#eab308" /> {rating}
      </div>
    </div>
  </div>
);

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

const SimpleLineChart = ({ values, labels }) => {
  const width = 560;
  const height = 240;
  const pad = 34;
  const min = Math.min(...values) * 0.75;
  const max = Math.max(...values) * 1.08;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const x = (i) => pad + (i / (values.length - 1)) * innerW;
  const y = (v) => pad + ((max - v) / (max - min)) * innerH;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart-svg" preserveAspectRatio="none">
      {[0, 1, 2, 3].map((step) => {
        const yy = pad + (step / 3) * innerH;
        return <line key={step} x1={pad} y1={yy} x2={width - pad} y2={yy} className="chart-grid-line" />;
      })}
      <path d={path} className="chart-line" />
      {values.map((v, i) => <circle key={labels[i]} cx={x(i)} cy={y(v)} r="4" className="chart-dot" />)}
      {labels.map((label, i) => (
        <text key={label} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis-label">{label}</text>
      ))}
    </svg>
  );
};

const SimpleBarChart = ({ values, labels }) => {
  const max = Math.max(...values);

  return (
    <div className="week-bar-chart">
      {values.map((value, i) => (
        <div key={labels[i]} className="bar-col">
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(value / max) * 100}%` }}></div>
          </div>
          <span className="chart-axis-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;