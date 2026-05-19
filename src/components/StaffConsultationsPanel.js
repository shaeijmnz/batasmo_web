import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, Star, Video } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getConsultationSessionStatus } from '../lib/consultationStatus';
import '../AdminDashboard/consultations.css';

const formatScheduleForUi = (scheduledAt) => {
  const parsed = scheduledAt ? new Date(scheduledAt) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { date: 'TBD', time: 'TBD' };
  }

  return {
    date: parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
};

const formatDurationLabel = (minutes) => `${Number(minutes || 60)} min`;

const getIcon = (type) => {
  if (type === 'Video Call') return <Video size={14} />;
  if (type === 'Phone Call') return <Phone size={14} />;
  return <MessageCircle size={14} />;
};

/**
 * Admin-style consultations directory (stats, tabs, session cards).
 * Used inside Secretary console and can be embedded elsewhere.
 */
export default function StaffConsultationsPanel({ className = '' }) {
  const [activeTab, setActiveTab] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTranscript, setActiveTranscript] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadConsultations = async () => {
      try {
        const [appointmentsRes, feedbackRes, transactionsRes, roomsRes] = await Promise.all([
          supabase
            .from('appointments')
            .select(
              'id, title, notes, attorney_consultation_summary, scheduled_at, duration_minutes, status, client:client_id(full_name), attorney:attorney_id(full_name)',
            )
            .order('scheduled_at', { ascending: false }),
          supabase
            .from('consultation_feedback')
            .select('appointment_id, rating, comment')
            .order('created_at', { ascending: false }),
          supabase.from('transactions').select('appointment_id, payment_status'),
          supabase.from('consultation_rooms').select('appointment_id, is_closed, video_meeting_id'),
        ]);

        if (appointmentsRes.error) throw appointmentsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;
        if (transactionsRes.error) throw transactionsRes.error;
        if (roomsRes.error) throw roomsRes.error;

        const feedbackByAppointment = new Map();
        (feedbackRes.data || []).forEach((row) => {
          if (!row.appointment_id || feedbackByAppointment.has(row.appointment_id)) return;
          feedbackByAppointment.set(row.appointment_id, {
            rating: Number(row.rating || 0),
            comment: String(row.comment || '').trim(),
          });
        });

        const paidAppointmentIds = new Set(
          (transactionsRes.data || [])
            .filter((row) => String(row.payment_status || '').toLowerCase() === 'paid')
            .map((row) => row.appointment_id),
        );

        const roomByAppointment = new Map();
        (roomsRes.data || []).forEach((row) => {
          if (row.appointment_id) roomByAppointment.set(row.appointment_id, row);
        });

        const normalized = (appointmentsRes.data || [])
          .filter((row) => String(row.status || '').toLowerCase() !== 'cancelled')
          .map((row) => {
            const room = roomByAppointment.get(row.id);
            const status = getConsultationSessionStatus({
              appointmentStatus: row.status,
              isPaid: paidAppointmentIds.has(row.id),
              room,
            });
            if (!status) return null;
            const feedback = feedbackByAppointment.get(row.id);
            const { date, time } = formatScheduleForUi(row.scheduled_at);
            return {
              id: row.id,
              title: row.title || 'Consultation',
              type: 'Online Session',
              category: row.title || 'Consultation',
              status,
              client: row.client?.full_name || 'Client',
              attorney: row.attorney?.full_name || 'Attorney',
              date,
              time,
              duration: formatDurationLabel(row.duration_minutes),
              rating: feedback?.rating || 0,
              notes: feedback?.comment || row.notes || '',
              transcript: row.attorney_consultation_summary || '',
            };
          })
          .filter(Boolean);

        if (!isMounted) return;
        setSessions(normalized);
        setLoadError('');
      } catch (error) {
        if (isMounted) {
          setSessions([]);
          setLoadError(error.message || 'Failed to load consultations.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConsultations();

    const appointmentsChannel = supabase
      .channel('staff-consultations-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () =>
        loadConsultations(),
      )
      .subscribe();

    const feedbackChannel = supabase
      .channel('staff-consultations-feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_feedback' }, () =>
        loadConsultations(),
      )
      .subscribe();

    const transactionsChannel = supabase
      .channel('staff-consultations-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () =>
        loadConsultations(),
      )
      .subscribe();

    const roomsChannel = supabase
      .channel('staff-consultations-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultation_rooms' }, () =>
        loadConsultations(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(roomsChannel);
    };
  }, []);

  const stats = useMemo(() => {
    const completed = sessions.filter((item) => item.status === 'Completed').length;
    const scheduled = sessions.filter((item) => item.status === 'Scheduled').length;
    const inProgress = sessions.filter((item) => item.status === 'In Progress').length;
    return [
      { label: 'Completed', value: completed.toLocaleString(), color: '#22c55e' },
      { label: 'Scheduled', value: scheduled.toLocaleString(), color: '#eab308' },
      { label: 'In Progress', value: inProgress.toLocaleString(), color: '#3b82f6' },
      { label: 'Total Sessions', value: sessions.length.toLocaleString(), color: '#64748b' },
    ];
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    if (activeTab === 'All') return sessions;
    return sessions.filter((item) => item.status === activeTab);
  }, [activeTab, sessions]);

  return (
    <div className={`staff-consultations-panel ${className}`.trim()}>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card"
            style={{ borderLeft: `4px solid ${stat.color}` }}
          >
            <h3 className="stat-value">{stat.value}</h3>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="tabs-container">
        {['All', 'Completed', 'Scheduled', 'In Progress'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="sessions-list">
        {loadError ? <p className="consultations-info-message">{loadError}</p> : null}
        {loading ? <p className="consultations-info-message">Loading consultations…</p> : null}
        {visibleSessions.map((session) => (
          <div
            key={session.id}
            className={`session-card ${expandedId === session.id ? 'expanded' : ''}`}
            onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setExpandedId(expandedId === session.id ? null : session.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="session-main">
              <div className="session-left">
                <h4 className="session-title">{session.title}</h4>
                <div className="tag-group">
                  <span className="type-pill">
                    {getIcon(session.type)} {session.type}
                  </span>
                  <span className="category-pill">{session.category}</span>
                </div>
                <div className="client-info">
                  <p>
                    Client: <strong>{session.client}</strong>
                  </p>
                  <p>
                    Date: <strong>{session.date}</strong>
                  </p>
                  <p>
                    Time: <strong>{session.time}</strong>
                  </p>
                  {session.rating > 0 ? (
                    <div className="rating">
                      Rating:{' '}
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={index}
                          size={14}
                          fill={index < session.rating ? '#eab308' : 'none'}
                          color={index < session.rating ? '#eab308' : '#cbd5e1'}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="session-right">
                <span
                  className={`status-tag ${session.status.toLowerCase().replace(' ', '')}`}
                >
                  {session.status}
                </span>
                <div className="attorney-info">
                  <p>
                    Attorney: <strong>{session.attorney}</strong>
                  </p>
                  <p>Duration: {session.duration}</p>
                </div>
              </div>
            </div>

            {expandedId === session.id ? (
              <div className="expanded-details">
                <div className="notes-box">
                  <p className="notes-label">Notes:</p>
                  <p className="notes-text">
                    {session.notes || 'No notes available for this session.'}
                  </p>
                </div>
                {session.status === 'Completed' ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveTranscript(session);
                      }}
                    >
                      View Transcript
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        {!loading && !loadError && visibleSessions.length === 0 ? (
          <p className="consultations-info-message">No consultations found.</p>
        ) : null}
      </div>

      {activeTranscript ? (
        <div
          className="admin-consultation-modal-overlay"
          onClick={() => setActiveTranscript(null)}
          role="presentation"
        >
          <div
            className="admin-consultation-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-labelledby="staff-consultation-transcript-title"
          >
            <div className="admin-consultation-modal__header">
              <div>
                <h3 id="staff-consultation-transcript-title">Session Summary</h3>
                <p>
                  {activeTranscript.client} with {activeTranscript.attorney}
                </p>
              </div>
              <button
                type="button"
                className="admin-consultation-modal__close"
                onClick={() => setActiveTranscript(null)}
              >
                Close
              </button>
            </div>
            <div className="admin-consultation-modal__body">
              {activeTranscript.transcript ? (
                <p>{activeTranscript.transcript}</p>
              ) : (
                <p className="admin-consultation-modal__empty">
                  No attorney summary has been added for this completed session yet.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
