import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Bell, Download, 
  TrendingUp, DollarSign, UserCheck, Star
} from 'lucide-react';
import './Reports.css';

const revenueTrendData = [
  { month: 'Jan', revenue: 118000 },
  { month: 'Feb', revenue: 132000 },
  { month: 'Mar', revenue: 141000 },
  { month: 'Apr', revenue: 156000 },
  { month: 'May', revenue: 172000 },
  { month: 'Jun', revenue: 212000 },
];

const consultationCategoryData = [
  { label: 'Family Law', value: 28, color: '#12345a' },
  { label: 'Corporate Law', value: 20, color: '#d2a645' },
  { label: 'Criminal Law', value: 17, color: '#6b7280' },
  { label: 'Labor Law', value: 15, color: '#10b981' },
  { label: 'Tax Law', value: 11, color: '#ef4444' },
  { label: 'Immigration Law', value: 9, color: '#3b82f6' },
];

const attorneyPerformanceData = [
  { name: 'Atty. Juan dela Cruz', consultations: 238 },
  { name: 'Atty. Ana Garcia', consultations: 198 },
  { name: 'Atty. Pedro Mendoza', consultations: 176 },
  { name: 'Atty. Rosa Santos', consultations: 165 },
  { name: 'Atty. Miguel Rivera', consultations: 138 },
];

const formatCurrency = (value) => `PHP ${value.toLocaleString()}`;

const Reports = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const handleQuickAction = (message) => window.alert(message);

  const downloadRevenueCsv = () => {
    const header = 'Month,Revenue\n';
    const rows = revenueTrendData.map((row) => `${row.month},${row.revenue}`).join('\n');
    const csvContent = `${header}${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'revenue-trend-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCategoryCsv = () => {
    const header = 'Category,Percentage\n';
    const rows = consultationCategoryData.map((row) => `${row.label},${row.value}`).join('\n');
    const csvContent = `${header}${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'consultation-categories.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPerformanceCsv = () => {
    const header = 'Attorney,Consultations\n';
    const rows = attorneyPerformanceData.map((row) => `${row.name},${row.consultations}`).join('\n');
    const csvContent = `${header}${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'attorney-performance.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Consultations', icon: <MessageSquare size={20} />, path: '/consultations' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const reportStats = [
    { label: 'Total Revenue', value: '₱931,000', change: '+15.3%', icon: <DollarSign />, color: '#1e3a8a' },
    { label: 'Total Consultations', value: '1,178', change: '+12.8%', icon: <FileText />, color: '#eab308' },
    { label: 'Active Clients', value: '2,187', change: '+8.2%', icon: <UserCheck />, color: '#22c55e' },
    { label: 'Avg. Rating', value: '4.8', change: '+0.2', icon: <Star />, color: '#a855f7' },
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
              active={item.path === '/reports'}
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
          <button className="logout-btn" onClick={() => handleQuickAction('Logout clicked')}><LogOut size={18} /> {isSidebarOpen && "Logout"}</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="navbar">
          <div className="navbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!isSidebarOpen)}><Menu size={24} /></button>
            <h1 className="nav-title">Reports</h1>
          </div>
          <div className="navbar-right"><div className="bell-container"><Bell size={20} /><span className="dot"></span></div></div>
        </header>

        <div className="content-wrapper">
          <div className="page-header">
            <div>
              <h2 className="title">Reports & Analytics</h2>
              <p className="subtitle">View comprehensive reports and business insights</p>
            </div>
            <button className="export-all-btn" onClick={() => handleQuickAction('Exporting all reports')}><Download size={18} /> Export All Reports</button>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            {reportStats.map((stat, i) => (
              <div key={i} className="report-stat-card" style={{ borderLeft: `4px solid ${stat.color}` }}>
                <div className="stat-main">
                  <div className="stat-text">
                    <p className="stat-label">{stat.label}</p>
                    <h3 className="stat-value">{stat.value}</h3>
                    <p className="stat-change"><TrendingUp size={14} /> {stat.change} <span>from last period</span></p>
                  </div>
                  <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                    {stat.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Trend Chart */}
          <div className="chart-container main-trend">
            <div className="chart-header">
              <h3>Revenue & Consultations Trend</h3>
              <button className="chart-export" onClick={downloadRevenueCsv}><Download size={14} /> Export</button>
            </div>
            <RevenueTrendChart data={revenueTrendData} />
          </div>

          {/* Bottom Grid */}
          <div className="bottom-grid">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Consultations by Category</h3>
                <button className="chart-export" onClick={downloadCategoryCsv}><Download size={14} /> Export</button>
              </div>
              <ConsultationCategoryChart data={consultationCategoryData} />
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Top Attorney Performance</h3>
                <button className="chart-export" onClick={downloadPerformanceCsv}><Download size={14} /> Export</button>
              </div>
              <AttorneyPerformanceChart data={attorneyPerformanceData} />
            </div>
          </div>

          {/* Quick Report Generation */}
          <div className="generate-section">
            <h3>Generate Custom Reports</h3>
            <div className="report-buttons">
              <button className="gen-btn client" onClick={() => handleQuickAction('Generating Client Report')}>Client Report</button>
              <button className="gen-btn attorney" onClick={() => handleQuickAction('Generating Attorney Report')}>Attorney Report</button>
              <button className="gen-btn financial" onClick={() => handleQuickAction('Generating Financial Report')}>Financial Report</button>
              <button className="gen-btn activity" onClick={() => handleQuickAction('Generating Activity Report')}>Activity Report</button>
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

const RevenueTrendChart = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState(data.length - 1);

  const chartWidth = 860;
  const chartHeight = 280;
  const padding = { top: 24, right: 24, bottom: 40, left: 60 };

  const values = data.map((item) => item.revenue);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.08;

  const x = (index) => {
    const innerWidth = chartWidth - padding.left - padding.right;
    return padding.left + (index / (data.length - 1)) * innerWidth;
  };

  const y = (value) => {
    const innerHeight = chartHeight - padding.top - padding.bottom;
    return padding.top + ((maxValue - value) / (maxValue - minValue)) * innerHeight;
  };

  const linePath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.revenue)}`)
    .join(' ');

  const areaPath = `${linePath} L ${x(data.length - 1)} ${chartHeight - padding.bottom} L ${x(0)} ${chartHeight - padding.bottom} Z`;

  const activePoint = data[activeIndex];

  return (
    <div className="revenue-chart">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="revenue-chart-svg" preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3].map((step) => {
          const value = minValue + ((maxValue - minValue) * step) / 3;
          const yPos = y(value);
          return (
            <g key={step}>
              <line x1={padding.left} y1={yPos} x2={chartWidth - padding.right} y2={yPos} className="chart-grid-line" />
              <text x={padding.left - 10} y={yPos + 4} textAnchor="end" className="chart-axis-label">
                {Math.round(value / 1000)}k
              </text>
            </g>
          );
        })}

        <path d={areaPath} className="chart-area" />
        <path d={linePath} className="chart-line" />

        {data.map((point, index) => (
          <g key={point.month} onMouseEnter={() => setActiveIndex(index)}>
            <circle cx={x(index)} cy={y(point.revenue)} r={activeIndex === index ? 7 : 5} className="chart-point-hit" />
            <circle cx={x(index)} cy={y(point.revenue)} r={activeIndex === index ? 4 : 3} className="chart-point-core" />
            <text x={x(index)} y={chartHeight - 14} textAnchor="middle" className="chart-axis-label">
              {point.month}
            </text>
          </g>
        ))}
      </svg>

      <div className="chart-tooltip">
        <span className="tooltip-month">{activePoint.month}</span>
        <span className="tooltip-value">{formatCurrency(activePoint.revenue)}</span>
      </div>
    </div>
  );
};

const ConsultationCategoryChart = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 110;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const segments = data.map((item) => {
    const length = (item.value / total) * circumference;
    const segment = {
      ...item,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -cumulative,
    };
    cumulative += length;
    return segment;
  });

  return (
    <div className="pie-chart-layout">
      <div className="pie-chart-wrap">
        <svg viewBox="0 0 280 280" className="pie-chart-svg" role="img" aria-label="Consultations by category pie chart">
          <circle cx="140" cy="140" r={radius} fill="none" stroke="#f2e8d8" strokeWidth="46" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="46"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              transform="rotate(-90 140 140)"
            />
          ))}
          <circle cx="140" cy="140" r="74" fill="#fffaf2" />
          <text x="140" y="132" textAnchor="middle" className="pie-total-label">Total</text>
          <text x="140" y="156" textAnchor="middle" className="pie-total-value">{total}%</text>
        </svg>
      </div>

      <div className="pie-legend-grid">
        {data.map((item) => (
          <div key={item.label} className="pie-legend-item">
            <span className="pie-legend-dot" style={{ backgroundColor: item.color }}></span>
            <span>{item.label}: {item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AttorneyPerformanceChart = ({ data }) => {
  const maxValue = Math.max(...data.map((item) => item.consultations));

  return (
    <div className="performance-chart-list">
      {data.map((item) => (
        <div key={item.name} className="performance-row">
          <p className="performance-name">{item.name}</p>
          <div className="performance-bar-track">
            <div
              className="performance-bar-fill"
              style={{ width: `${(item.consultations / maxValue) * 100}%` }}
            ></div>
          </div>
          <span className="performance-value">{item.consultations}</span>
        </div>
      ))}
      <div className="performance-caption">Consultations completed per attorney</div>
    </div>
  );
};

export default Reports;