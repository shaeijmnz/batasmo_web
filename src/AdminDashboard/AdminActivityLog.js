import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarCheck, CreditCard, FileText, KeyRound, Lock,
  RefreshCw, ShieldAlert, UserPlus,
} from 'lucide-react';
import { fetchLoginSecurityActivity, fetchRecentSystemActivity } from '../lib/adminApi';
import './activity-log.css';

const RANGES = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

const FILTERS = ['All', 'Accounts', 'Bookings', 'Payments', 'Notarial', 'Sign-in'];

const HOUR_MS = 60 * 60 * 1000;

const formatDateTime = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const peso = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `PHP ${n.toFixed(2)}` : 'PHP —';
};

const personLabel = (fullName, email) => fullName || email || 'Unknown user';

/** Flags any client with `threshold` or more rows inside a sliding `windowMs`. */
const findBursts = (rows, { threshold, windowMs, filter = () => true }) => {
  const byClient = new Map();
  rows.filter(filter).forEach((row) => {
    if (!row.client_id) return;
    const list = byClient.get(row.client_id) || [];
    list.push(row);
    byClient.set(row.client_id, list);
  });

  const bursts = [];
  byClient.forEach((list) => {
    const sorted = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (let i = 0; i + threshold - 1 < sorted.length; i += 1) {
      const first = new Date(sorted[i].created_at).getTime();
      const last = new Date(sorted[i + threshold - 1].created_at).getTime();
      if (last - first <= windowMs) {
        bursts.push({ rows: sorted, latest: sorted[sorted.length - 1] });
        break;
      }
    }
  });
  return bursts;
};

const buildAlerts = (security, activity) => {
  const alerts = [];
  const lockedNow = new Set();

  (security?.locked || []).forEach((row) => {
    const who = personLabel(row.full_name, row.email);
    if (row.is_active) {
      lockedNow.add(String(row.email || '').toLowerCase());
      alerts.push({
        id: `lock-${row.email}`,
        severity: 'high',
        title: 'Account locked after repeated failed sign-ins',
        detail: `${who} (${row.email}) is locked until ${formatDateTime(row.lockout_until)}. Lockout level ${row.lockout_tier}.`,
        time: row.updated_at,
      });
    } else if (Number(row.lockout_tier) >= 2) {
      alerts.push({
        id: `relock-${row.email}`,
        severity: 'medium',
        title: 'Repeated account lockouts',
        detail: `${who} (${row.email}) has been locked ${row.lockout_tier} times.`,
        time: row.updated_at,
      });
    }
  });

  (security?.failed || []).forEach((row) => {
    const email = String(row.email || '').toLowerCase();
    if (lockedNow.has(email)) return;
    if (!row.has_account && row.attempts >= 2) {
      alerts.push({
        id: `unknown-${email}`,
        severity: 'medium',
        title: 'Sign-in attempts on an unregistered email',
        detail: `${row.attempts} failed attempts using ${email}, which has no LegalLink account.`,
        time: row.last_attempt,
      });
    } else if (row.attempts >= 3) {
      alerts.push({
        id: `failed-${email}`,
        severity: row.attempts >= 5 ? 'high' : 'medium',
        title: 'Multiple failed sign-ins',
        detail: `${row.attempts} failed attempts on ${personLabel(row.full_name, email)} (${email}).`,
        time: row.last_attempt,
      });
    }
  });

  (activity?.profiles || []).forEach((row) => {
    const role = String(row.role || '');
    if (role !== 'Admin' && role !== 'Attorney') return;
    alerts.push({
      id: `role-${row.id}`,
      severity: role === 'Admin' ? 'high' : 'medium',
      title: `New ${role.toLowerCase()} account created`,
      detail: `${personLabel(row.full_name, row.email)} was registered with ${role} access. Confirm this was authorized.`,
      time: row.created_at,
    });
  });

  findBursts(activity?.appointments || [], { threshold: 3, windowMs: HOUR_MS }).forEach(({ rows, latest }) => {
    alerts.push({
      id: `bookings-${latest.client_id}`,
      severity: 'medium',
      title: 'Rapid repeated bookings',
      detail: `${latest.client?.full_name || 'A client'} created ${rows.length} bookings, including 3 or more within one hour.`,
      time: latest.created_at,
    });
  });

  findBursts(activity?.transactions || [], {
    threshold: 3,
    windowMs: 24 * HOUR_MS,
    filter: (row) => String(row.payment_status || '').toLowerCase() === 'failed',
  }).forEach(({ rows, latest }) => {
    alerts.push({
      id: `payfail-${latest.client_id}`,
      severity: 'medium',
      title: 'Repeated failed payments',
      detail: `${latest.client?.full_name || 'A client'} had ${rows.length} failed payments within 24 hours.`,
      time: latest.created_at,
    });
  });

  findBursts(activity?.notarialRequests || [], { threshold: 3, windowMs: HOUR_MS }).forEach(({ rows, latest }) => {
    alerts.push({
      id: `notary-${latest.client_id}`,
      severity: 'medium',
      title: 'Rapid repeated notarial requests',
      detail: `${latest.client?.full_name || 'A client'} submitted ${rows.length} notarial requests, including 3 or more within one hour.`,
      time: latest.created_at,
    });
  });

  const rank = { high: 0, medium: 1 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(b.time) - new Date(a.time));
};

const buildEvents = (security, activity) => {
  const events = [];

  (activity?.profiles || []).forEach((row) => events.push({
    id: `p-${row.id}`,
    type: 'Accounts',
    icon: <UserPlus size={16} />,
    text: `New ${String(row.role || 'user').toLowerCase()} account: ${personLabel(row.full_name, row.email)}`,
    time: row.created_at,
  }));

  (activity?.appointments || []).forEach((row) => events.push({
    id: `a-${row.id}`,
    type: 'Bookings',
    icon: <CalendarCheck size={16} />,
    text: `${row.client?.full_name || 'Client'} booked ${row.title || 'a consultation'} with ${row.attorney?.full_name || 'an attorney'} (${row.status})`,
    time: row.created_at,
  }));

  (activity?.transactions || []).forEach((row) => events.push({
    id: `t-${row.id}`,
    type: 'Payments',
    icon: <CreditCard size={16} />,
    text: `Payment of ${peso(row.amount)} by ${row.client?.full_name || 'Client'} (${row.payment_status})`,
    time: row.created_at,
  }));

  (activity?.notarialRequests || []).forEach((row) => events.push({
    id: `n-${row.id}`,
    type: 'Notarial',
    icon: <FileText size={16} />,
    text: `${row.client?.full_name || 'Client'} requested ${row.service_type || 'a notarial service'} (${row.status})`,
    time: row.created_at,
  }));

  (security?.failed || []).forEach((row) => events.push({
    id: `f-${row.email}`,
    type: 'Sign-in',
    icon: <KeyRound size={16} />,
    text: `${row.attempts} failed sign-in attempt${row.attempts === 1 ? '' : 's'} for ${row.email}`,
    time: row.last_attempt,
  }));

  (security?.locked || []).forEach((row) => events.push({
    id: `l-${row.email}`,
    type: 'Sign-in',
    icon: <Lock size={16} />,
    text: `${row.email} was locked out (level ${row.lockout_tier})`,
    time: row.updated_at,
  }));

  return events.sort((a, b) => new Date(b.time) - new Date(a.time));
};

const ActivityLogSection = () => {
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState('All');
  const [security, setSecurity] = useState(null);
  const [securityAvailable, setSecurityAvailable] = useState(true);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [securityData, activityData] = await Promise.all([
        fetchLoginSecurityActivity(days),
        fetchRecentSystemActivity(days),
      ]);
      setSecurityAvailable(securityData !== null);
      setSecurity(securityData || { failed: [], locked: [] });
      setActivity(activityData);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load activity.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const alerts = useMemo(() => buildAlerts(security, activity), [security, activity]);
  const events = useMemo(() => buildEvents(security, activity), [security, activity]);
  const visibleEvents = useMemo(
    () => (filter === 'All' ? events : events.filter((event) => event.type === filter)).slice(0, 150),
    [events, filter],
  );

  const failedTotal = (security?.failed || []).reduce((sum, row) => sum + Number(row.attempts || 0), 0);
  const lockedActive = (security?.locked || []).filter((row) => row.is_active).length;

  return (
    <div className="settings-stack">
      <div className="card">
        <div className="aal-toolbar">
          <h3 className="card-title aal-title"><Activity size={18} /> Activity Log</h3>
          <div className="aal-controls">
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} disabled={loading}>
              {RANGES.map((range) => <option key={range.days} value={range.days}>{range.label}</option>)}
            </select>
            <button type="button" className="aal-refresh" onClick={load} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'aal-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
        <p className="settings-hint">
          Monitors new accounts, bookings, payments, notarial requests, and failed sign-ins, and flags activity that may need review.
          {lastUpdated ? ` Last updated ${formatDateTime(lastUpdated)}.` : ''}
        </p>
        {error ? <p className="settings-error">{error}</p> : null}
        {!securityAvailable ? (
          <p className="settings-hint">Sign-in monitoring is not installed yet. Run the admin login security SQL in Supabase to enable it.</p>
        ) : null}

        <div className="aal-stats">
          <Stat label="Alerts" value={alerts.length} tone={alerts.length ? 'danger' : 'ok'} />
          <Stat label="Failed sign-ins" value={failedTotal} tone={failedTotal ? 'warn' : 'ok'} />
          <Stat label="Locked accounts" value={lockedActive} tone={lockedActive ? 'danger' : 'ok'} />
          <Stat label="Activities" value={events.length} tone="info" />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title"><ShieldAlert size={18} /> Suspicious Activity</h3>
        {loading && !activity ? <p className="settings-hint">Checking activity...</p> : null}
        {!loading && alerts.length === 0 ? (
          <p className="aal-empty">No suspicious activity detected in this period.</p>
        ) : null}
        <ul className="aal-list">
          {alerts.map((alert) => (
            <li key={alert.id} className={`aal-alert aal-alert--${alert.severity}`}>
              <span className={`aal-badge aal-badge--${alert.severity}`}>{alert.severity === 'high' ? 'High' : 'Medium'}</span>
              <div className="aal-body">
                <p className="aal-alert-title">{alert.title}</p>
                <p className="aal-detail">{alert.detail}</p>
              </div>
              <span className="aal-time">{formatDateTime(alert.time)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3 className="card-title"><Activity size={18} /> Recent Activity</h3>
        <div className="aal-filters">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={`aal-filter ${filter === item ? 'active' : ''}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {!loading && visibleEvents.length === 0 ? <p className="aal-empty">No activity recorded in this period.</p> : null}
        <ul className="aal-list">
          {visibleEvents.map((event) => (
            <li key={event.id} className="aal-event">
              <span className="aal-event-icon">{event.icon}</span>
              <div className="aal-body">
                <p className="aal-detail aal-detail--strong">{event.text}</p>
                <p className="aal-type">{event.type}</p>
              </div>
              <span className="aal-time">{formatDateTime(event.time)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone }) => (
  <div className={`aal-stat aal-stat--${tone}`}>
    <span className="aal-stat-value">{value}</span>
    <span className="aal-stat-label">{label}</span>
  </div>
);

export default ActivityLogSection;
