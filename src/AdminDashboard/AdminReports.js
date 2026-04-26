import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Scale,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Download,
  TrendingUp,
  DollarSign,
  UserCheck,
  Star,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './AdminTheme.css';
import './reports.css';

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

const normalizeNotarialStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'approved' || value === 'accepted' || value === 'in_process' || value === 'in-progress') return 'In Progress';
  if (value === 'completed') return 'Completed';
  if (value === 'cancelled' || value === 'rejected') return 'Cancelled';
  return 'Pending';
};

const percentChange = (current, previous) => {
  const safePrev = Number(previous || 0);
  const safeCurrent = Number(current || 0);
  if (safePrev <= 0) {
    return safeCurrent > 0 ? '+100.0%' : '+0.0%';
  }
  const delta = ((safeCurrent - safePrev) / safePrev) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
};

const Reports = ({ onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revenueTrendData, setRevenueTrendData] = useState(
    getLastSixMonths().map((item) => ({ month: item.month, revenue: 0, consultations: 0 })),
  );
  const [consultationCategoryData, setConsultationCategoryData] = useState([]);
  const [attorneyPerformanceData, setAttorneyPerformanceData] = useState([]);
  const [notarialStatusData, setNotarialStatusData] = useState([]);
  const [onlineClientIds, setOnlineClientIds] = useState(new Set());
  const [reportMetrics, setReportMetrics] = useState({
    totalRevenue: 0,
    currentRevenue: 0,
    previousRevenue: 0,
    totalCompletedConsultations: 0,
    currentCompletedConsultations: 0,
    previousCompletedConsultations: 0,
    averageRating: 0,
    currentAverageRating: 0,
    previousAverageRating: 0,
  });

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
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      try {
        const months = getLastSixMonths();
        const monthMetricsMap = new Map(months.map((item) => [item.key, { revenue: 0, consultations: 0 }]));

        const [transactionsRes, appointmentsRes, feedbackRes, notarialRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, payment_status, created_at, client_id, appointment_id, notarial_request_id')
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: true }),
          supabase
            .from('appointments')
            .select('id, title, status, scheduled_at, updated_at, attorney_id, attorney:attorney_id(full_name), client_id')
            .order('scheduled_at', { ascending: false }),
          supabase
            .from('consultation_feedback')
            .select('rating, created_at')
            .order('created_at', { ascending: false }),
          supabase
            .from('notarial_requests')
            .select('id, service_type, status, created_at, updated_at'),
        ]);

        if (transactionsRes.error) throw transactionsRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;
        if (notarialRes.error) throw notarialRes.error;

        const transactions = transactionsRes.data || [];
        const appointments = (appointmentsRes.data || []).filter(
          (item) => String(item.status || '').toLowerCase() !== 'cancelled',
        );
        const completedAppointments = appointments.filter((item) => String(item.status || '').toLowerCase() === 'completed');
        const feedbackRows = feedbackRes.data || [];
        const notarialRequests = notarialRes.data || [];

        const now = new Date();
        const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        let totalRevenue = 0;
        let currentRevenue = 0;
        let previousRevenue = 0;

        transactions.forEach((row) => {
          const createdAt = row.created_at ? new Date(row.created_at) : null;
          if (!createdAt || Number.isNaN(createdAt.getTime())) return;

          const amount = Number(row.amount || 0);
          totalRevenue += amount;
          const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
          if (monthMetricsMap.has(monthKey)) {
            const metrics = monthMetricsMap.get(monthKey);
            metrics.revenue += amount;
          }

          if (createdAt >= startCurrentMonth) {
            currentRevenue += amount;
          } else if (createdAt >= startPreviousMonth && createdAt < startCurrentMonth) {
            previousRevenue += amount;
          }
        });

        const categoryCountMap = new Map();
        const attorneyPerformanceMap = new Map();
        let currentCompletedConsultations = 0;
        let previousCompletedConsultations = 0;

        completedAppointments.forEach((row) => {
          const completedAt = row.updated_at || row.scheduled_at ? new Date(row.updated_at || row.scheduled_at) : null;
          if (completedAt && !Number.isNaN(completedAt.getTime())) {
            const monthKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}`;
            if (monthMetricsMap.has(monthKey)) {
              const metrics = monthMetricsMap.get(monthKey);
              metrics.consultations += 1;
            }
            if (completedAt >= startCurrentMonth) currentCompletedConsultations += 1;
            else if (completedAt >= startPreviousMonth && completedAt < startCurrentMonth) previousCompletedConsultations += 1;
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
            count: value,
            percentage: totalCategoryCount > 0 ? Number(((value / totalCategoryCount) * 100).toFixed(1)) : 0,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          }));

        const attorneyPerformance = Array.from(attorneyPerformanceMap.values())
          .sort((a, b) => b.consultations - a.consultations)
          .slice(0, 6);

        const ratingValues = feedbackRows.map((row) => Number(row.rating || 0)).filter((value) => value > 0);
        const averageRating = ratingValues.length
          ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
          : 0;
        const currentMonthRatings = feedbackRows
          .filter((row) => {
            const createdAt = row.created_at ? new Date(row.created_at) : null;
            return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= startCurrentMonth;
          })
          .map((row) => Number(row.rating || 0))
          .filter((value) => value > 0);
        const previousMonthRatings = feedbackRows
          .filter((row) => {
            const createdAt = row.created_at ? new Date(row.created_at) : null;
            return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= startPreviousMonth && createdAt < startCurrentMonth;
          })
          .map((row) => Number(row.rating || 0))
          .filter((value) => value > 0);
        const currentAverageRating = currentMonthRatings.length
          ? currentMonthRatings.reduce((sum, value) => sum + value, 0) / currentMonthRatings.length
          : 0;
        const previousAverageRating = previousMonthRatings.length
          ? previousMonthRatings.reduce((sum, value) => sum + value, 0) / previousMonthRatings.length
          : 0;

        const notarialStatusMap = new Map([
          ['Pending', 0],
          ['In Progress', 0],
          ['Completed', 0],
          ['Cancelled', 0],
        ]);
        notarialRequests.forEach((row) => {
          const normalized = normalizeNotarialStatus(row.status);
          notarialStatusMap.set(normalized, Number(notarialStatusMap.get(normalized) || 0) + 1);
        });
        const notarialStatuses = Array.from(notarialStatusMap.entries()).map(([label, count], index) => ({
          label,
          count,
          color: CATEGORY_COLORS[(index + 2) % CATEGORY_COLORS.length],
        }));

        if (!isMounted) return;

        setRevenueTrendData(months.map((item) => ({ month: item.month, ...monthMetricsMap.get(item.key) })));
        setConsultationCategoryData(categories);
        setAttorneyPerformanceData(attorneyPerformance);
        setNotarialStatusData(notarialStatuses);
        setReportMetrics({
          totalRevenue,
          currentRevenue,
          previousRevenue,
          totalCompletedConsultations: completedAppointments.length,
          currentCompletedConsultations,
          previousCompletedConsultations,
          averageRating,
          currentAverageRating,
          previousAverageRating,
        });
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Failed to load reports.');
          setRevenueTrendData(getLastSixMonths().map((item) => ({ month: item.month, revenue: 0, consultations: 0 })));
          setConsultationCategoryData([]);
          setAttorneyPerformanceData([]);
          setNotarialStatusData([]);
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
      supabase
        .channel('reports-notarial-requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notarial_requests' }, () => loadReports())
        .subscribe(),
    ];

    return () => {
      isMounted = false;
      channels.forEach((channel) => supabase.removeChannel(channel));
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

  const reportStats = useMemo(() => [
    {
      label: 'Total Revenue',
      value: `PHP ${Math.round(reportMetrics.totalRevenue).toLocaleString()}`,
      change: percentChange(reportMetrics.currentRevenue, reportMetrics.previousRevenue),
      caption: 'current month vs previous',
      icon: <DollarSign />,
      color: '#1e3a8a',
    },
    {
      label: 'Completed Consultations',
      value: reportMetrics.totalCompletedConsultations.toLocaleString(),
      change: percentChange(reportMetrics.currentCompletedConsultations, reportMetrics.previousCompletedConsultations),
      caption: 'current month vs previous',
      icon: <FileText />,
      color: '#eab308',
    },
    {
      label: 'Active Clients',
      value: onlineClientIds.size.toLocaleString(),
      change: '',
      caption: 'currently online',
      icon: <UserCheck />,
      color: '#22c55e',
    },
    {
      label: 'Avg. Rating',
      value: reportMetrics.averageRating.toFixed(1),
      change: (reportMetrics.currentAverageRating - reportMetrics.previousAverageRating).toFixed(1),
      caption: 'current month rating delta',
      icon: <Star />,
      color: '#a855f7',
    },
  ], [onlineClientIds.size, reportMetrics]);

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
    const rows = revenueTrendData.map((row) => `${row.month},${row.revenue},${row.consultations}`);
    downloadCsv('revenue-consultation-trend.csv', 'Month,Revenue,Completed Consultations', rows);
  };

  const downloadCategoryCsv = () => {
    const rows = consultationCategoryData.map((row) => `${row.label},${row.count},${row.percentage}`);
    downloadCsv('consultation-categories.csv', 'Category,Completed Consultations,Percentage', rows);
  };

  const downloadPerformanceCsv = () => {
    const rows = attorneyPerformanceData.map((row) => `${row.name},${row.consultations}`);
    downloadCsv('attorney-performance.csv', 'Attorney,Completed Consultations', rows);
  };

  const downloadNotarialCsv = () => {
    const rows = notarialStatusData.map((row) => `${row.label},${row.count}`);
    downloadCsv('notarial-request-status.csv', 'Status,Requests', rows);
  };

  const downloadAllReports = () => {
    const rows = [
      `Total Revenue,${Math.round(reportMetrics.totalRevenue)}`,
      `Completed Consultations,${reportMetrics.totalCompletedConsultations}`,
      `Active Clients Online,${onlineClientIds.size}`,
      `Average Rating,${reportMetrics.averageRating.toFixed(1)}`,
      '',
      'Monthly Trend',
      'Month,Revenue,Completed Consultations',
      ...revenueTrendData.map((row) => `${row.month},${row.revenue},${row.consultations}`),
      '',
      'Consultation Categories',
      'Category,Completed Consultations,Percentage',
      ...consultationCategoryData.map((row) => `${row.label},${row.count},${row.percentage}`),
      '',
      'Notarial Request Status',
      'Status,Requests',
      ...notarialStatusData.map((row) => `${row.label},${row.count}`),
      '',
      'Attorney Performance',
      'Attorney,Completed Consultations',
      ...attorneyPerformanceData.map((row) => `${row.name},${row.consultations}`),
    ];
    downloadCsv('batasmo-admin-reports.csv', 'Metric,Value', rows);
  };

  return (
    <div className="app-container">
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
        <div className="content-wrapper">
          <div className="page-header">
            <div>
              <h2 className="title">Reports & Analytics</h2>
              <p className="subtitle">View comprehensive reports and business insights</p>
            </div>
            <button className="export-all-btn" onClick={downloadAllReports}><Download size={18} /> Export All Reports</button>
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
                    <p className="stat-change">
                      {stat.change ? <><TrendingUp size={14} /> {stat.change}</> : null}
                      <span>{stat.caption}</span>
                    </p>
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
                <h3>Revenue & Completed Consultations Trend</h3>
              <button className="chart-export" onClick={downloadRevenueCsv}><Download size={14} /> Export</button>
            </div>
            <RevenueTrendChart data={revenueTrendData} />
          </div>

          <div className="bottom-grid">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Completed Consultations by Category</h3>
                <button className="chart-export" onClick={downloadCategoryCsv}><Download size={14} /> Export</button>
              </div>
              <ConsultationCategoryChart data={consultationCategoryData} />
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Notarial Request Status</h3>
                <button className="chart-export" onClick={downloadNotarialCsv}><Download size={14} /> Export</button>
              </div>
              <StatusBarChart data={notarialStatusData} emptyLabel="No notarial request data yet." />
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Top Attorney Performance</h3>
                <button className="chart-export" onClick={downloadPerformanceCsv}><Download size={14} /> Export</button>
              </div>
              <AttorneyPerformanceChart data={attorneyPerformanceData} />
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
  const safeData = data.length ? data : [{ month: 'N/A', revenue: 0, consultations: 0 }];
  const [activeIndex, setActiveIndex] = useState(safeData.length - 1);

  const maxRevenue = Math.max(...safeData.map((item) => Number(item.revenue || 0)), 1);
  const maxConsultations = Math.max(...safeData.map((item) => Number(item.consultations || 0)), 1);
  const activePoint = safeData[Math.min(activeIndex, safeData.length - 1)] || safeData[0];

  return (
    <div className="revenue-chart">
      <div className="trend-bars">
        {safeData.map((point, index) => (
          <button
            key={`${point.month}-${index}`}
            type="button"
            className={`trend-month ${activeIndex === index ? 'is-active' : ''}`}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
          >
            <div className="trend-bar-pair">
              <span
                className="trend-bar trend-bar--revenue"
                style={{ height: `${Math.max(8, (Number(point.revenue || 0) / maxRevenue) * 170)}px` }}
                title={`${point.month} revenue: ${formatCurrency(point.revenue)}`}
              />
              <span
                className="trend-bar trend-bar--consultations"
                style={{ height: `${Math.max(8, (Number(point.consultations || 0) / maxConsultations) * 170)}px` }}
                title={`${point.month} completed consultations: ${point.consultations}`}
              />
            </div>
            <span className="trend-month-label">{point.month}</span>
          </button>
        ))}
      </div>

      <div className="trend-legend">
        <span><i className="legend-dot legend-dot--revenue" /> Revenue</span>
        <span><i className="legend-dot legend-dot--consultations" /> Completed Consultations</span>
      </div>

      <div className="chart-tooltip">
        <span className="tooltip-month">{activePoint.month}</span>
        <span className="tooltip-value">{formatCurrency(activePoint.revenue)}</span>
        <span className="tooltip-value">{activePoint.consultations} completed</span>
      </div>
    </div>
  );
};

const ConsultationCategoryChart = ({ data }) => {
  if (!data.length) {
    return <p className="report-info-message">No consultation category data yet.</p>;
  }

  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="analytics-bar-list">
      {data.map((item) => (
        <div key={item.label} className="analytics-bar-row">
          <div className="analytics-bar-meta">
            <span>{item.label}</span>
            <strong>{item.count} ({item.percentage}%)</strong>
          </div>
          <div className="analytics-bar-track">
            <span
              className="analytics-bar-fill"
              style={{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const StatusBarChart = ({ data, emptyLabel }) => {
  const visible = (data || []).filter((item) => Number(item.count || 0) > 0);
  if (!visible.length) {
    return <p className="report-info-message">{emptyLabel}</p>;
  }

  const maxCount = Math.max(...visible.map((item) => item.count), 1);
  return (
    <div className="analytics-bar-list">
      {visible.map((item) => (
        <div key={item.label} className="analytics-bar-row">
          <div className="analytics-bar-meta">
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
          <div className="analytics-bar-track">
            <span
              className="analytics-bar-fill"
              style={{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
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

