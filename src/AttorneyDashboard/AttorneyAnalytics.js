import { useEffect, useMemo, useState } from 'react';
import './AttorneyAnalytics.css';
import './AttorneyTheme.css';
import { fetchAttorneyConsultationAnalyticsData } from '../lib/userApi';

const formatPhp = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

const defaultAnalytics = {
  rows: [],
  total: 0,
  maxCount: 0,
  gender: { rows: [], total: 0 },
  trend: [],
  status: [],
  averageRating: 0,
  ratingCount: 0,
  currentMonthRevenue: 0,
  previousMonthRevenue: 0,
  completedThisMonth: 0,
  completedPreviousMonth: 0,
  totalEarnings: 0,
};

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const ScheduleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LogsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><polyline points="14 2 14 8 20 8" />
  </svg>
);

const AnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

function MonthlyTrendChart({ trend }) {
  const safeTrend = useMemo(() => {
    if (trend?.length) return trend
    return Array.from({ length: 6 }, (_, i) => ({
      key: `empty-${i}`,
      month: '—',
      revenue: 0,
      consultations: 0,
    }))
  }, [trend])

  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, safeTrend.length - 1))

  useEffect(() => {
    setActiveIndex(Math.max(0, safeTrend.length - 1))
  }, [safeTrend])

  const maxRevenue = Math.max(...safeTrend.map((p) => Number(p.revenue || 0)), 1)
  const maxConsultations = Math.max(...safeTrend.map((p) => Number(p.consultations || 0)), 1)
  const active = safeTrend[Math.min(activeIndex, safeTrend.length - 1)] || safeTrend[0]

  return (
    <div className="aa-trend-chart">
      <div className="aa-trend-bars">
        {safeTrend.map((point, index) => (
          <button
            key={point.key || `${point.month}-${index}`}
            type="button"
            className={`aa-trend-month ${activeIndex === index ? 'aa-trend-month--active' : ''}`}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
          >
            <div className="aa-trend-bar-pair">
              <span
                className="aa-trend-bar aa-trend-bar--revenue"
                style={{ height: `${Math.max(8, (Number(point.revenue || 0) / maxRevenue) * 170)}px` }}
                title={`${point.month} revenue: ${formatPhp(point.revenue)}`}
              />
              <span
                className="aa-trend-bar aa-trend-bar--consultations"
                style={{ height: `${Math.max(8, (Number(point.consultations || 0) / maxConsultations) * 170)}px` }}
                title={`${point.month} completed: ${point.consultations}`}
              />
            </div>
            <span className="aa-trend-month-label">{point.month}</span>
          </button>
        ))}
      </div>
      <div className="aa-trend-legend">
        <span><i className="aa-legend-dot aa-legend-dot--revenue" /> Revenue</span>
        <span><i className="aa-legend-dot aa-legend-dot--consultations" /> Completed consultations</span>
      </div>
      <div className="aa-trend-tooltip">
        <span className="aa-trend-tooltip__month">{active?.month}</span>
        <span className="aa-trend-tooltip__value">{formatPhp(active?.revenue)}</span>
        <span className="aa-trend-tooltip__value">{Number(active?.consultations || 0)} completed</span>
      </div>
    </div>
  )
}

export default function AttorneyAnalytics({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!profile?.id) return;
      try {
        const data = await fetchAttorneyConsultationAnalyticsData(profile.id);
        if (!isMounted) return;
        setAnalytics({
          ...defaultAnalytics,
          ...data,
          gender: data?.gender || defaultAnalytics.gender,
          trend: Array.isArray(data?.trend) ? data.trend : defaultAnalytics.trend,
          status: Array.isArray(data?.status) ? data.status : defaultAnalytics.status,
        });
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAnalytics(defaultAnalytics);
        setLoadError(error.message || 'Unable to load analytics data.');
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const { rows, total, maxCount, gender, trend, status, averageRating, ratingCount, totalEarnings } = analytics;
  const topType = rows[0]?.label || 'No data yet';

  const chartRows = useMemo(
    () => rows.slice(0, 8).map((row) => ({
      ...row,
      ratio: maxCount > 0 ? Math.max(8, Math.round((row.count / maxCount) * 100)) : 0,
    })),
    [rows, maxCount],
  );

  const statusMax = useMemo(
    () => (status.length ? Math.max(...status.map((s) => Number(s.count || 0)), 1) : 1),
    [status],
  );

  const statusRows = useMemo(
    () => status.map((row) => ({
      ...row,
      ratio: statusMax > 0 ? Math.max(8, Math.round((Number(row.count || 0) / statusMax) * 100)) : 0,
    })),
    [status, statusMax],
  );

  const genderRows = gender?.rows || [];
  const genderTotal = Number(gender?.total || 0);

  const sidebarItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Logs', icon: <LogsIcon />, nav: 'attorney-logs' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile', icon: <ProfileIcon />, nav: 'attorney-profile' },
  ];

  const statusClassForLabel = (label) => {
    if (label === 'Completed') return 'aa-status-fill--completed';
    if (label === 'Cancelled') return 'aa-status-fill--cancelled';
    return 'aa-status-fill--upcoming';
  };

  return (
    <div className="aa-page">
      {sidebarOpen && <div className="aa-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`aa-sidebar ${sidebarOpen ? 'aa-sidebar--open' : ''}`}>
        <div className="aa-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="aa-sidebar__nav">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              className="aa-sidebar__item"
              onClick={() => {
                setSidebarOpen(false);
                if (item.nav) onNavigate(item.nav);
              }}
            >
              <span className="aa-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="aa-topbar">
        <div className="aa-topbar__left">
          <button className="aa-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="aa-topbar__logo">
            <ScalesIcon size={26} color="#f5a623" />
            <span>Attorney Analytics</span>
          </div>
        </div>
        <div className="aa-topbar__right">
          <button className="aa-notif-btn" type="button" aria-label="Notifications">
            <BellIcon />
          </button>
          <div className="aa-profile" onClick={() => onNavigate('attorney-profile')}>
            <span className="aa-profile__name">{profile?.full_name || 'Attorney'}</span>
            <div className="aa-avatar">
              {(profile?.full_name || 'A')
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="aa-main">
        {loadError ? <p className="aa-error">{loadError}</p> : null}

        <div className="aa-summary-grid">
          <div className="aa-summary-card">
            <p className="aa-summary-card__label">TOTAL CONSULTATIONS</p>
            <p className="aa-summary-card__value">{total}</p>
          </div>
          <div className="aa-summary-card">
            <p className="aa-summary-card__label">MOST FREQUENT TYPE</p>
            <p className="aa-summary-card__value aa-summary-card__value--type">{topType}</p>
          </div>
          <div className="aa-summary-card">
            <p className="aa-summary-card__label">TOTAL EARNINGS</p>
            <p className="aa-summary-card__value">{formatPhp(totalEarnings)}</p>
            <p className="aa-summary-card__hint">All-time paid transactions</p>
          </div>
          <div className="aa-summary-card">
            <p className="aa-summary-card__label">AVG. CLIENT RATING</p>
            {ratingCount > 0 ? (
              <>
                <p className="aa-summary-card__value">{Number(averageRating).toFixed(1)}</p>
                <p className="aa-summary-card__hint">★ from {ratingCount} review{ratingCount === 1 ? '' : 's'}</p>
              </>
            ) : (
              <>
                <p className="aa-summary-card__value aa-summary-card__value--muted">—</p>
                <p className="aa-summary-card__hint">No reviews yet</p>
              </>
            )}
          </div>
        </div>

        <section className="aa-chart-card aa-chart-card--trend">
          <div className="aa-chart-card__header">
            <div>
              <h2>Monthly trend</h2>
              <p className="aa-chart-card__sub">Revenue and completed consultations (last 6 months)</p>
            </div>
          </div>
          <MonthlyTrendChart trend={trend} />
        </section>

        <div className="aa-charts-split">
          <section className="aa-chart-card">
            <div className="aa-chart-card__header">
              <h2>Consultation type frequency</h2>
              <span>Top {chartRows.length || 0}</span>
            </div>

            {chartRows.length ? (
              <div className="aa-bar-chart">
                {chartRows.map((row) => (
                  <div key={row.label} className="aa-bar-row">
                    <div className="aa-bar-row__meta">
                      <span className="aa-bar-row__label">{row.label}</span>
                      <span className="aa-bar-row__count">{row.count}</span>
                    </div>
                    <div className="aa-bar-track">
                      <div className="aa-bar-fill" style={{ width: `${row.ratio}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="aa-empty">No consultation records yet.</p>
            )}
          </section>

          <section className="aa-chart-card aa-status-chart">
            <div className="aa-chart-card__header">
              <h2>Appointment status</h2>
              <span>{statusRows.reduce((s, r) => s + Number(r.count || 0), 0)} total</span>
            </div>

            {statusRows.length ? (
              <div className="aa-status-list">
                {statusRows.map((row) => (
                  <div key={row.label} className="aa-status-row">
                    <div className="aa-status-row__meta">
                      <span className="aa-status-row__label">{row.label}</span>
                      <span className="aa-status-row__count">{row.count}</span>
                    </div>
                    <div className="aa-status-track">
                      <div
                        className={`aa-status-fill ${statusClassForLabel(row.label)}`}
                        style={{ width: `${row.ratio}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="aa-empty">No appointments yet.</p>
            )}
          </section>
        </div>

        <section className="aa-chart-card aa-chart-card--gender">
          <div className="aa-chart-card__header aa-chart-card__header--stack">
            <div>
              <h2>Client registration by gender</h2>
              <p className="aa-chart-footnote">Includes legacy baseline for pre-gender-field accounts.</p>
            </div>
            <span>Total {genderTotal}</span>
          </div>

          {genderRows.length ? (
            <div className="aa-gender-chart">
              {genderRows.map((row) => (
                <div key={row.key} className="aa-gender-row">
                  <div className="aa-gender-row__meta">
                    <span className="aa-gender-row__label">{row.label}</span>
                    <span className="aa-gender-row__count">{row.count} ({row.percent}%)</span>
                  </div>
                  <div className="aa-gender-track">
                    <div className="aa-gender-fill" style={{ width: `${Math.max(row.percent, row.count > 0 ? 8 : 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="aa-empty">No gender registration records yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
