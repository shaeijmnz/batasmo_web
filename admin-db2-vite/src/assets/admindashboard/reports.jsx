import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Scale,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Bell,
  Download,
  TrendingUp,
  DollarSign,
  UserCheck,
  Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import './Reports.css';

const CATEGORY_COLORS = ['#12345a', '#d2a645', '#6b7280', '#10b981', '#ef4444', '#3b82f6'];

const getLastSixMonths = () => {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = date.toLocaleDateString('en-PH', { month: 'short' });
    result.push({ key, month });
  }
  return result;
};

const formatCurrency = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

const percentChange = (current, previous) => {
  const safePrev = Number(previous || 0);
  const safeCurrent = Number(current || 0);
  if (safePrev <= 0) {
    return safeCurrent > 0 ? '+100.0%' : '+0.0%';
  }
  const delta = ((safeCurrent - safePrev) / safePrev) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
};

const Reports = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revenueTrendData, setRevenueTrendData] = useState(getLastSixMonths().map((item) => ({ month: item.month, revenue: 0 })));
  const [consultationCategoryData, setConsultationCategoryData] = useState([]);
  const [attorneyPerformanceData, setAttorneyPerformanceData] = useState([]);
  const [reportStats, setReportStats] = useState([
    { label: 'Total Revenue', value: 'PHP 0', change: '+0.0%', icon: <DollarSign />, color: '#1e3a8a' },
    { label: 'Total Consultations', value: '0', change: '+0.0%', icon: <FileText />, color: '#eab308' },
    { label: 'Active Clients', value: '0', change: '+0.0%', icon: <UserCheck />, color: '#22c55e' },
    { label: 'Avg. Rating', value: '0.0', change: '+0.0', icon: <Star />, color: '#a855f7' },
  ]);

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

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      try {
        const months = getLastSixMonths();
        const monthRevenueMap = new Map(months.map((item) => [item.key, 0]));

        const [transactionsRes, appointmentsRes, feedbackRes, profilesRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, payment_status, created_at, client_id')
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: true }),
          supabase
            .from('appointments')
            .select('id, title, status, scheduled_at, attorney_id, attorney:attorney_id(full_name), client_id')
            .order('scheduled_at', { ascending: false }),
          supabase
            .from('consultation_feedback')
            .select('rating')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id')
            .eq('role', 'Client'),
        ]);

        if (transactionsRes.error) throw transactionsRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;
        if (profilesRes.error) throw profilesRes.error;

        const transactions = transactionsRes.data || [];
        const appointments = (appointmentsRes.data || []).filter(
          (item) => String(item.status || '').toLowerCase() !== 'cancelled',
        );
        const feedbackRows = feedbackRes.data || [];
        const clients = profilesRes.data || [];

        const now = new Date();
        const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        let currentRevenue = 0;
        let previousRevenue = 0;
        let currentConsultationCount = 0;
        let previousConsultationCount = 0;
        const activeClientIds = new Set();

        transactions.forEach((row) => {
          const createdAt = row.created_at ? new Date(row.created_at) : null;
          if (!createdAt || Number.isNaN(createdAt.getTime())) return;

          const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
          if (monthRevenueMap.has(monthKey)) {
            monthRevenueMap.set(monthKey, Number(monthRevenueMap.get(monthKey) || 0) + Number(row.amount || 0));
          }

          if (createdAt >= startCurrentMonth) {
            currentRevenue += Number(row.amount || 0);
          } else if (createdAt >= startPreviousMonth && createdAt < startCurrentMonth) {
            previousRevenue += Number(row.amount || 0);
          }

          if (row.client_id) activeClientIds.add(row.client_id);
        });

        const categoryCountMap = new Map();
        const attorneyPerformanceMap = new Map();

        appointments.forEach((row) => {
          const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at) : null;
          if (scheduledAt && !Number.isNaN(scheduledAt.getTime())) {
            if (scheduledAt >= startCurrentMonth) {
              currentConsultationCount += 1;
            } else if (scheduledAt >= startPreviousMonth && scheduledAt < startCurrentMonth) {
              previousConsultationCount += 1;
            }
          }

          const category = String(row.title || 'Consultation').trim();
          categoryCountMap.set(category, Number(categoryCountMap.get(category) || 0) + 1);

          const attorneyId = row.attorney_id;
          const attorneyName = row.attorney?.full_name || 'Attorney';
          if (attorneyId) {
            const existing = attorneyPerformanceMap.get(attorneyId) || { name: attorneyName, consultations: 0 };
            existing.consultations += 1;
            attorneyPerformanceMap.set(attorneyId, existing);
          }
        });

        const totalCategoryCount = Array.from(categoryCountMap.values()).reduce((sum, value) => sum + value, 0);
        const categories = Array.from(categoryCountMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value], index) => ({
            label,
            value: totalCategoryCount > 0 ? Number(((value / totalCategoryCount) * 100).toFixed(1)) : 0,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          }));

        const attorneyPerformance = Array.from(attorneyPerformanceMap.values())
          .sort((a, b) => b.consultations - a.consultations)
          .slice(0, 6);

        const ratingValues = feedbackRows.map((row) => Number(row.rating || 0)).filter((value) => value > 0);
        const currentAvgRating = ratingValues.length
          ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
          : 0;

        const liveStats = [
          {
            label: 'Total Revenue',
            value: `PHP ${Math.round(currentRevenue).toLocaleString()}`,
            change: percentChange(currentRevenue, previousRevenue),
            icon: <DollarSign />,
            color: '#1e3a8a',
          },
          {
            label: 'Total Consultations',
            value: currentConsultationCount.toLocaleString(),
            change: percentChange(currentConsultationCount, previousConsultationCount),
            icon: <FileText />,
            color: '#eab308',
          },
          {
            label: 'Active Clients',
            value: activeClientIds.size.toLocaleString(),
            change: percentChange(activeClientIds.size, clients.length),
            icon: <UserCheck />,
            color: '#22c55e',
          },
          {
            label: 'Avg. Rating',
            value: currentAvgRating.toFixed(1),
            change: `+${(currentAvgRating - 0).toFixed(1)}`,
            icon: <Star />,
            color: '#a855f7',
          },
        ];

        if (!isMounted) return;

        setRevenueTrendData(months.map((item) => ({ month: item.month, revenue: Number(monthRevenueMap.get(item.key) || 0) })));
        setConsultationCategoryData(categories);
        setAttorneyPerformanceData(attorneyPerformance);
        setReportStats(liveStats);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Failed to load reports.');
          setRevenueTrendData(getLastSixMonths().map((item) => ({ month: item.month, revenue: 0 })));
          setConsultationCategoryData([]);
          setAttorneyPerformanceData([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReports();

    const channels = [
      supabase
        .channel('reports-transactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => loadReports())
        .subscribe(),
      supabase
        .channel('reports-appointments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadReports())
        .subscribe(),
      supabase
        .channel('reports-feedback')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_feedback' }, () => loadReports())
        .subscribe(),
    ];

    return () => {
      isMounted = false;
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, []);

  const downloadCsv = (filename, header, rows) => {
    const csvContent = `${header}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadRevenueCsv = () => {
    const rows = revenueTrendData.map((row) => `${row.month},${row.revenue}`);
    downloadCsv('revenue-trend-report.csv', 'Month,Revenue', rows);
  };

  const downloadCategoryCsv = () => {
    const rows = consultationCategoryData.map((row) => `${row.label},${row.value}`);
    downloadCsv('consultation-categories.csv', 'Category,Percentage', rows);
  };

  const downloadPerformanceCsv = () => {
    const rows = attorneyPerformanceData.map((row) => `${row.name},${row.consultations}`);
    downloadCsv('attorney-performance.csv', 'Attorney,Consultations', rows);
  };

  return (
    <div className="app-container">
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
          <button className="logout-btn" onClick={() => handleQuickAction('Logout clicked')}><LogOut size={18} /> {isSidebarOpen && 'Logout'}</button>
        </div>
      </aside>

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

          {loadError ? <p className="report-info-message">{loadError}</p> : null}
          {loading ? <p className="report-info-message">Loading reports...</p> : null}

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

          <div className="chart-container main-trend">
            <div className="chart-header">
              <h3>Revenue & Consultations Trend</h3>
              <button className="chart-export" onClick={downloadRevenueCsv}><Download size={14} /> Export</button>
            </div>
            <RevenueTrendChart data={revenueTrendData} />
          </div>

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
  const safeData = data.length ? data : [{ month: 'N/A', revenue: 0 }];
  const [activeIndex, setActiveIndex] = useState(safeData.length - 1);

  const chartWidth = 860;
  const chartHeight = 280;
  const padding = { top: 24, right: 24, bottom: 40, left: 60 };

  const values = safeData.map((item) => Number(item.revenue || 0));
  const minValueRaw = Math.min(...values);
  const maxValueRaw = Math.max(...values);
  const minValue = minValueRaw === maxValueRaw ? minValueRaw - 1 : minValueRaw * 0.9;
  const maxValue = minValueRaw === maxValueRaw ? maxValueRaw + 1 : maxValueRaw * 1.08;

  const x = (index) => {
    const innerWidth = chartWidth - padding.left - padding.right;
    return safeData.length === 1 ? padding.left + innerWidth / 2 : padding.left + (index / (safeData.length - 1)) * innerWidth;
  };

  const y = (value) => {
    const innerHeight = chartHeight - padding.top - padding.bottom;
    const denominator = maxValue - minValue || 1;
    return padding.top + ((maxValue - value) / denominator) * innerHeight;
  };

  const linePath = safeData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.revenue)}`)
    .join(' ');

  const areaPath = `${linePath} L ${x(safeData.length - 1)} ${chartHeight - padding.bottom} L ${x(0)} ${chartHeight - padding.bottom} Z`;

  const activePoint = safeData[Math.min(activeIndex, safeData.length - 1)] || safeData[0];

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

        {safeData.map((point, index) => (
          <g key={`${point.month}-${index}`} onMouseEnter={() => setActiveIndex(index)}>
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
  if (!data.length) {
    return <p className="report-info-message">No consultation category data yet.</p>;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0) || 100;
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
          <text x="140" y="156" textAnchor="middle" className="pie-total-value">{Math.round(total)}%</text>
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
  if (!data.length) {
    return <p className="report-info-message">No attorney performance data yet.</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.consultations), 1);

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
