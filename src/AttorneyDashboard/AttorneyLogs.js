import { useEffect, useMemo, useRef, useState } from 'react';
import './AttorneyLogs.css';
import './AttorneyTheme.css';
import {
  fetchAttorneyConsultationLogs,
  fetchConsultationTranscriptForAppointment,
  saveAttorneyConsultationSummary,
  saveAttorneyConsultationBranch,
  fetchAttorneyProfile,
  subscribeToAttorneyAppointments,
} from '../lib/userApi';
import { attachLiveDataRefresh } from '../lib/liveDataRefresh';
import {
  getConsultationBranchesForAttorney,
  parseConsultationBranchFromTitle,
} from '../lib/consultationBranches';
import ConsultationSummaryForm from '../components/ConsultationSummaryForm';
import AttorneySidebar from './AttorneySidebar';

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export default function AttorneyLogs({ onNavigate, profile, initialAppointmentId = '' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [activeLog, setActiveLog] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [attorneySummaryDraft, setAttorneySummaryDraft] = useState('');
  const [summarySaving, setSummarySaving] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState('');
  const [sessionBranchDraft, setSessionBranchDraft] = useState('');
  const [attorneySpecialties, setAttorneySpecialties] = useState([]);
  const autoOpenedRef = useRef(false);

  const attorneyForBranches = useMemo(
    () => ({
      name: profile?.full_name || profile?.name || '',
      specialty: profile?.specialty || '',
      specialties: attorneySpecialties,
    }),
    [profile, attorneySpecialties],
  );

  const consultationBranches = useMemo(
    () => getConsultationBranchesForAttorney(attorneyForBranches),
    [attorneyForBranches],
  );

  const sessionBranchRequired = consultationBranches.length > 0;

  useEffect(() => {
    autoOpenedRef.current = false;
  }, [initialAppointmentId]);

  useEffect(() => {
    let mounted = true;

    const loadSpecialties = async () => {
      if (!profile?.id) {
        if (mounted) setAttorneySpecialties([]);
        return;
      }
      try {
        const data = await fetchAttorneyProfile(profile.id);
        if (!mounted) return;
        setAttorneySpecialties(Array.isArray(data?.specialties) ? data.specialties : []);
      } catch {
        if (mounted) setAttorneySpecialties([]);
      }
    };

    loadSpecialties();

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let mounted = true;

    const loadLogs = async () => {
      if (!profile?.id) return;
      try {
        const rows = await fetchAttorneyConsultationLogs(profile.id, { force: true });
        if (!mounted) return;
        setLogs(rows);
        setLoadError('');
      } catch (error) {
        if (!mounted) return;
        setLogs([]);
        setLoadError(error.message || 'Unable to load consultation logs.');
      }
    };

    const detachLiveRefresh = attachLiveDataRefresh({
      enabled: Boolean(profile?.id),
      reload: () => {
        void loadLogs();
      },
      subscribe: (onRealtime) => subscribeToAttorneyAppointments(profile.id, onRealtime),
      pollMs: 15000,
    });

    return () => {
      mounted = false;
      detachLiveRefresh();
    };
  }, [profile?.id]);

  const openTranscript = async (logItem) => {
    setActiveLog(logItem);
    setTranscriptLoading(true);
    setAttorneySummaryDraft('');
    setSessionBranchDraft(parseConsultationBranchFromTitle(logItem?.title || ''));
    setSummaryNotice('');

    try {
      const response = await fetchConsultationTranscriptForAppointment(logItem.id);
      setAttorneySummaryDraft(response.attorneyConsultationSummary || '');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load session summary.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const closeTranscript = () => {
    setActiveLog(null);
    setAttorneySummaryDraft('');
    setSessionBranchDraft('');
    setSummaryNotice('');
  };

  useEffect(() => {
    if (!initialAppointmentId || !logs.length || autoOpenedRef.current) return undefined;
    const match = logs.find((item) => String(item.id) === String(initialAppointmentId));
    if (!match) return undefined;

    autoOpenedRef.current = true;
    let cancelled = false;

    (async () => {
      setActiveLog(match);
      setTranscriptLoading(true);
      setAttorneySummaryDraft('');
      setSessionBranchDraft(parseConsultationBranchFromTitle(match?.title || ''));
      setSummaryNotice('');
      try {
        const response = await fetchConsultationTranscriptForAppointment(match.id);
        if (cancelled) return;
        setAttorneySummaryDraft(response.attorneyConsultationSummary || '');
        setLoadError('');
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load session summary.');
      } finally {
        if (!cancelled) setTranscriptLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAppointmentId, logs]);

  const handleSaveAttorneySummary = async () => {
    if (!activeLog?.id) return;
    try {
      setSummarySaving(true);
      setSummaryNotice('');
      if (sessionBranchRequired) {
        const branch = sessionBranchDraft.trim();
        if (!branch) {
          setSummaryNotice('Please select a consultation branch.');
          return;
        }
        if (!consultationBranches.includes(branch)) {
          setSummaryNotice('Please select a valid consultation branch.');
          return;
        }
        await saveAttorneyConsultationBranch({ appointmentId: activeLog.id, branch });
        setLogs((previous) =>
          previous.map((item) =>
            String(item.id) === String(activeLog.id)
              ? { ...item, title: `Consultation - ${branch}` }
              : item,
          ),
        );
        setActiveLog((previous) =>
          previous ? { ...previous, title: `Consultation - ${branch}` } : previous,
        );
      }
      await saveAttorneyConsultationSummary({ appointmentId: activeLog.id, summary: attorneySummaryDraft });
      closeTranscript();
    } catch (error) {
      setLoadError(error.message || 'Failed to save summary.');
    } finally {
      setSummarySaving(false);
    }
  };

  const transcriptHeader = useMemo(() => {
    if (!activeLog) return '';
    return `${activeLog.clientName} - ${activeLog.dateLabel} ${activeLog.timeLabel}`;
  }, [activeLog]);

  return (
    <div className="al-page">
      <AttorneySidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        active="attorney-logs"
        onNavigate={onNavigate}
      />

      <header className="al-topbar">
        <div className="al-topbar__left">
          <button className="al-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon />
          </button>
          <div className="al-topbar__logo">
            <span>Logs</span>
          </div>
        </div>
        <div className="al-topbar__right">
          <span className="al-topbar__user-name">{profile?.full_name || 'Attorney'}</span>
          <div className="al-topbar__avatar">{(profile?.full_name || 'AT').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>
        </div>
      </header>

      <main className="al-main">
        <div className="al-header">
          <h1>Consultation Logs</h1>
          <p>Completed consultations are archived here. Add a session summary for your client after each session.</p>
        </div>

        {loadError ? <p className="al-error">{loadError}</p> : null}

        <div className="al-list">
          {logs.length ? (
            logs.map((item) => (
              <div className="al-item" key={item.id}>
                <div className="al-item__meta">
                  <h3>{item.clientName}</h3>
                  <p>{item.title}</p>
                  <span>{item.dateLabel} • {item.timeLabel}</span>
                </div>
                <button className="al-view-btn" onClick={() => openTranscript(item)}>
                  View summary
                </button>
              </div>
            ))
          ) : (
            <div className="al-empty">No completed consultations yet.</div>
          )}
        </div>
      </main>

      {activeLog ? (
        <div className="al-modal-overlay" onClick={closeTranscript}>
          <div className="al-modal al-modal--summary-only" onClick={(event) => event.stopPropagation()}>
            <div className="al-modal__header">
              <h2>Session summary</h2>
              <span className="al-modal__header-meta">{transcriptHeader}</span>
              <button type="button" className="al-close-btn" onClick={closeTranscript}>Close</button>
            </div>

            <div className="al-modal__body al-modal__body--summary">
              <div className="al-summary-panel">
                <h3 className="al-summary-panel__title">Session summary for your client</h3>
                <p className="al-summary-panel__help">
                  Each part has a header and a box for your notes — para hindi magulo ang summary.
                </p>
                {sessionBranchRequired ? (
                  <div className="al-summary-panel__field">
                    <label className="al-summary-panel__label" htmlFor="session-branch">
                      Consultation branch
                    </label>
                    <select
                      id="session-branch"
                      className="al-summary-panel__select"
                      value={sessionBranchDraft}
                      onChange={(e) => setSessionBranchDraft(e.target.value)}
                      disabled={transcriptLoading || summarySaving}
                    >
                      <option value="">Select a branch…</option>
                      {consultationBranches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {transcriptLoading ? (
                  <p className="al-summary-panel__loading">Loading…</p>
                ) : (
                  <ConsultationSummaryForm
                    idPrefix="attorney-log-summary"
                    value={attorneySummaryDraft}
                    onChange={setAttorneySummaryDraft}
                    disabled={summarySaving}
                  />
                )}
                <div className="al-summary-panel__actions">
                  <button
                    type="button"
                    className="al-summary-save-btn"
                    onClick={handleSaveAttorneySummary}
                    disabled={
                      transcriptLoading ||
                      summarySaving ||
                      (sessionBranchRequired && !sessionBranchDraft.trim())
                    }
                  >
                    {summarySaving ? 'Saving...' : 'Save summary'}
                  </button>
                  {summaryNotice ? <span className="al-summary-panel__notice">{summaryNotice}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
