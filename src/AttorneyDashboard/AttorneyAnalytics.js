import { useEffect, useMemo, useState } from 'react';
import './AttorneyAnalytics.css';
import './AttorneyTheme.css';
import { fetchAttorneyConsultationAnalyticsData } from '../lib/userApi';

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

export default function AttorneyAnalytics({ onNavigate, profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [maxCount, setMaxCount] = useState(0);
  const [genderRows, setGenderRows] = useState([]);
  const [genderTotal, setGenderTotal] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!profile?.id) return;
      try {
        const data = await fetchAttorneyConsultationAnalyticsData(profile.id);
        if (!isMounted) return;
        setRows(data.rows || []);
        setTotal(Number(data.total || 0));
        setMaxCount(Number(data.maxCount || 0));
        setGenderRows(data?.gender?.rows || []);
        setGenderTotal(Number(data?.gender?.total || 0));
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setRows([]);
        setTotal(0);
        setMaxCount(0);
        setGenderRows([]);
        setGenderTotal(0);
        setLoadError(error.message || 'Unable to load analytics data.');
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const topType = rows[0]?.label || 'No data yet';

  const chartRows = useMemo(
    () => rows.slice(0, 8).map((row) => ({
      ...row,
      ratio: maxCount > 0 ? Math.max(8, Math.round((row.count / maxCount) * 100)) : 0,
    })),
    [rows, maxCount],
  );

  const sidebarItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, nav: 'attorney-home' },
    { label: 'Consultation Management', icon: <ScheduleIcon />, nav: 'upcoming-appointments' },
    { label: 'Logs', icon: <LogsIcon />, nav: 'attorney-logs' },
    { label: 'Announcement', icon: <AnnouncementIcon />, nav: 'attorney-announcements' },
    { label: 'Profile', icon: <ProfileIcon />, nav: 'attorney-profile' },
  ];

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
        {loadError ? <p>{loadError}</p> : null}

        <div className="aa-summary-grid">
          <div className="aa-summary-card">
            <p className="aa-summary-card__label">TOTAL CONSULTATIONS</p>
            <p className="aa-summary-card__value">{total}</p>
          </div>
          <div className="aa-summary-card">
            <p className="aa-summary-card__label">MOST FREQUENT TYPE</p>
            <p className="aa-summary-card__value aa-summary-card__value--type">{topType}</p>
          </div>
        </div>

        <section className="aa-chart-card">
          <div className="aa-chart-card__header">
            <h2>Consultation Type Frequency</h2>
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

        <section className="aa-chart-card aa-chart-card--gender">
          <div className="aa-chart-card__header">
            <h2>Client Registration by Gender</h2>
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
