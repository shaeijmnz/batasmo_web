import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  adminRescheduleAppointment,
  fetchAdminSupportMessages,
  fetchAdminSupportThreads,
  fetchAttorneyFreeSlotsForDate,
  fetchClientActiveAppointmentsForAdmin,
  markAdminSupportMessagesAsRead,
  sendAdminSupportMessage,
  subscribeToAdminSupport,
} from '../lib/userApi';
import './AdminSupportDrawer.css';

function formatTimeLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const now = new Date();
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();
  if (sameDay) {
    return parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatScheduleDateLabel(value) {
  if (!value) return 'TBD';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnlyLabel(dateIso) {
  if (!dateIso) return '';
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminSupportDrawer({ open, onClose, onUnreadChange, mode = 'drawer' }) {
  const [threads, setThreads] = useState([]);
  const [activeClientId, setActiveClientId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const scrollRef = useRef(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState(todayIso());
  const [freeSlots, setFreeSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [clientAppointments, setClientAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [pickedAppointmentId, setPickedAppointmentId] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleNotice, setScheduleNotice] = useState('');

  const pickedAppointment = useMemo(
    () => clientAppointments.find((a) => a.id === pickedAppointmentId) || null,
    [clientAppointments, pickedAppointmentId],
  );
  const pickedAttorneyId = pickedAppointment?.attorneyId || '';
  const selectedSlot = useMemo(
    () => freeSlots.find((s) => s.id === selectedSlotId) || null,
    [freeSlots, selectedSlotId],
  );

  const activeClientName = useMemo(
    () => threads.find((t) => t.clientId === activeClientId)?.clientName || 'Client',
    [threads, activeClientId],
  );

  const totalUnread = useMemo(
    () => threads.reduce((acc, t) => acc + (t.unreadFromClient || 0), 0),
    [threads],
  );

  const refreshThreads = useCallback(async () => {
    try {
      const rows = await fetchAdminSupportThreads({ limit: 200 });
      setThreads(rows);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load support threads.');
    }
  }, []);

  useEffect(() => {
    refreshThreads();
    const unsubscribe = subscribeToAdminSupport(() => {
      refreshThreads();
      if (activeClientId) {
        fetchAdminSupportMessages(activeClientId)
          .then((rows) => setMessages(rows))
          .catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [activeClientId, refreshThreads]);

  useEffect(() => {
    if (typeof onUnreadChange === 'function') onUnreadChange(totalUnread);
  }, [totalUnread, onUnreadChange]);

  useEffect(() => {
    // Reset the schedule panel state whenever the admin switches threads.
    setScheduleOpen(false);
    setSelectedSlotId('');
    setPickedAppointmentId('');
    setClientAppointments([]);
    setScheduleError('');
    setScheduleNotice('');
  }, [activeClientId]);

  useEffect(() => {
    if (!open || !activeClientId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchAdminSupportMessages(activeClientId);
        if (cancelled) return;
        setMessages(rows);
        await markAdminSupportMessagesAsRead(activeClientId);
        refreshThreads();
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load conversation.');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeClientId, open, refreshThreads]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!scheduleOpen || !activeClientId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setAppointmentsLoading(true);
        const list = await fetchClientActiveAppointmentsForAdmin(activeClientId);
        if (cancelled) return;
        setClientAppointments(list);
        setPickedAppointmentId((prev) =>
          list.some((a) => a.id === prev) ? prev : list[0]?.id || '',
        );
      } catch (err) {
        if (!cancelled) setScheduleError(err.message || 'Failed to load client appointments.');
      } finally {
        if (!cancelled) setAppointmentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleOpen, activeClientId]);

  useEffect(() => {
    setSelectedSlotId('');
    if (!scheduleOpen || !pickedAttorneyId || !pickedDate) {
      setFreeSlots([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setSlotsLoading(true);
        setScheduleError('');
        const slots = await fetchAttorneyFreeSlotsForDate(pickedAttorneyId, pickedDate);
        if (cancelled) return;
        setFreeSlots(slots);
      } catch (err) {
        if (!cancelled) setScheduleError(err.message || 'Failed to load available times.');
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleOpen, pickedAttorneyId, pickedDate]);

  const resetSchedulePanel = () => {
    setScheduleOpen(false);
    setScheduleError('');
    setScheduleNotice('');
    setSelectedSlotId('');
  };

  const handleSetNewSchedule = async () => {
    if (!activeClientId || !pickedAppointmentId || !selectedSlotId) return;
    const slotId = selectedSlotId;
    const attorneyName = pickedAppointment?.attorneyName || '';
    try {
      setScheduleBusy(true);
      setScheduleError('');
      const result = await adminRescheduleAppointment({
        appointmentId: pickedAppointmentId,
        newSlotId: slotId,
      });

      // Also drop a confirmation message in the chat thread for paper trail.
      const whenLabel = formatScheduleDateLabel(result.newScheduledIso);
      const confirmBody =
        `✅ Reschedule confirmed by Admin.\n` +
        `New schedule: ${whenLabel}${attorneyName ? ` with ${attorneyName}` : ''}.`;
      const policyBody =
        `⚠️ Reminder: Rescheduling is allowed only ONE time per consultation. ` +
        `If you miss this rescheduled appointment, your paid consultation fee will be forfeited and ` +
        `you will need to book (and pay for) a new consultation. ` +
        `Please make sure to attend on the new schedule above.`;

      try {
        const sentConfirm = await sendAdminSupportMessage({
          clientId: activeClientId,
          message: confirmBody,
        });
        setMessages((previous) =>
          previous.some((m) => m.id === sentConfirm.id) ? previous : [...previous, sentConfirm],
        );
      } catch (err) {
        console.warn('[support] reschedule chat ack failed', err);
      }

      try {
        const sentPolicy = await sendAdminSupportMessage({
          clientId: activeClientId,
          message: policyBody,
        });
        setMessages((previous) =>
          previous.some((m) => m.id === sentPolicy.id) ? previous : [...previous, sentPolicy],
        );
      } catch (err) {
        console.warn('[support] reschedule policy msg failed', err);
      }

      setScheduleNotice(`Rescheduled to ${whenLabel}. Client & attorney notified.`);
      setSelectedSlotId('');
      // Refresh free-slots so the booked one disappears.
      const fresh = await fetchAttorneyFreeSlotsForDate(pickedAttorneyId, pickedDate);
      setFreeSlots(fresh);
      // Refresh client's appointment list.
      const refreshedAppts = await fetchClientActiveAppointmentsForAdmin(activeClientId);
      setClientAppointments(refreshedAppts);
      refreshThreads();
    } catch (err) {
      setScheduleError(err.message || 'Failed to reschedule.');
    } finally {
      setScheduleBusy(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeClientId || sending) return;
    try {
      setSending(true);
      const sent = await sendAdminSupportMessage({ clientId: activeClientId, message: body });
      setMessages((previous) => {
        if (previous.some((m) => m.id === sent.id)) return previous;
        return [...previous, sent];
      });
      setDraft('');
      refreshThreads();
    } catch (error) {
      setLoadError(error.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const isPage = mode === 'page';

  return (
    <>
      {isPage ? null : (
        <button
          type="button"
          className="adm-support-backdrop"
          onClick={onClose}
          aria-label="Close support drawer"
        />
      )}
      <aside
        className={`adm-support-drawer ${isPage ? 'adm-support-drawer--page' : ''}`}
        role={isPage ? 'region' : 'dialog'}
        aria-label="Client support messages"
      >
        <header className="adm-support-drawer__head">
          <div>
            <h2>Client Messages</h2>
            <p>Reply to client support inquiries.</p>
          </div>
          {isPage ? null : (
            <button type="button" className="adm-support-drawer__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </header>

        {loadError ? <div className="adm-support-drawer__error">{loadError}</div> : null}

        <div className="adm-support-drawer__body">
          <div className="adm-support-drawer__list">
            {threads.length === 0 ? (
              <p className="adm-support-drawer__empty">No client messages yet.</p>
            ) : (
              threads.map((t) => {
                const active = t.clientId === activeClientId;
                return (
                  <button
                    key={t.clientId}
                    type="button"
                    className={`adm-support-thread ${active ? 'adm-support-thread--active' : ''}`}
                    onClick={() => setActiveClientId(t.clientId)}
                  >
                    <div className="adm-support-thread__row">
                      <span className="adm-support-thread__name">{t.clientName}</span>
                      <span className="adm-support-thread__time">{formatTimeLabel(t.lastAt)}</span>
                    </div>
                    <div className="adm-support-thread__row adm-support-thread__row--sub">
                      <span className="adm-support-thread__preview">
                        {t.lastSenderRole === 'admin' ? 'You: ' : ''}
                        {String(t.lastMessage || '').slice(0, 80)}
                      </span>
                      {t.unreadFromClient > 0 ? (
                        <span className="adm-support-thread__dot">{t.unreadFromClient}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="adm-support-drawer__chat">
            {!activeClientId ? (
              <div className="adm-support-drawer__placeholder">
                <h3>Select a client</h3>
                <p>Pick a conversation on the left to view messages and reply.</p>
              </div>
            ) : (
              <>
                <div className="adm-support-chat-head">
                  <span className="adm-support-chat-head__name">{activeClientName}</span>
                  <button
                    type="button"
                    className={`adm-support-drawer__sched-btn adm-support-chat-head__resched ${scheduleOpen ? 'adm-support-drawer__sched-btn--on' : ''}`}
                    onClick={() => setScheduleOpen((v) => !v)}
                    title="Set a new schedule for this client's appointment"
                  >
                    <CalendarClock size={15} aria-hidden="true" />
                    {scheduleOpen ? 'Close reschedule' : 'Reschedule'}
                  </button>
                </div>

                <div className="adm-support-drawer__thread" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <p className="adm-support-drawer__empty">No messages yet.</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`adm-support-bubble adm-support-bubble--${m.senderRole === 'admin' ? 'mine' : 'theirs'}`}
                      >
                        <div className="adm-support-bubble__body">{m.message}</div>
                        <div className="adm-support-bubble__meta">{formatTimeLabel(m.createdAt)}</div>
                      </div>
                    ))
                  )}
                </div>

                {scheduleOpen ? (
                  <div className="adm-support-sched">
                    <div className="adm-support-sched__head">
                      <strong>Reschedule {activeClientName}</strong>
                      <button type="button" onClick={resetSchedulePanel} aria-label="Close">
                        ✕
                      </button>
                    </div>
                    {clientAppointments.length === 0 ? (
                      <p className="adm-support-sched__empty">
                        {appointmentsLoading
                          ? 'Loading appointment…'
                          : 'This client has no active appointment to reschedule.'}
                      </p>
                    ) : (
                      <>
                        {clientAppointments.length > 1 ? (
                          <select
                            className="adm-support-sched__appt-select"
                            value={pickedAppointmentId}
                            onChange={(e) => setPickedAppointmentId(e.target.value)}
                          >
                            {clientAppointments.map((appt) => (
                              <option key={appt.id} value={appt.id}>
                                {formatScheduleDateLabel(appt.scheduledAt)}
                                {appt.attorneyName ? ` · ${appt.attorneyName}` : ''}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        {pickedAppointment ? (
                          <div className="adm-support-sched__current">
                            <span className="adm-support-sched__label">Current schedule</span>
                            <strong>{formatScheduleDateLabel(pickedAppointment.scheduledAt)}</strong>
                            <small>
                              {pickedAppointment.attorneyName || 'Assigned attorney'}
                              {pickedAppointment.title ? ` · ${pickedAppointment.title}` : ''}
                            </small>
                          </div>
                        ) : null}

                        <label className="adm-support-sched__date">
                          <span className="adm-support-sched__label">New date</span>
                          <input
                            type="date"
                            value={pickedDate}
                            min={todayIso()}
                            onChange={(e) => setPickedDate(e.target.value)}
                          />
                        </label>

                        <div>
                          <span className="adm-support-sched__label">New time</span>
                          <div className="adm-support-sched__slots">
                            {slotsLoading ? (
                              <p className="adm-support-sched__empty">Loading available times…</p>
                            ) : freeSlots.length ? (
                              freeSlots.map((s) => (
                                <button
                                  type="button"
                                  key={s.id}
                                  className={`adm-support-sched__slot ${
                                    selectedSlotId === s.id ? 'adm-support-sched__slot--on' : ''
                                  }`}
                                  onClick={() => setSelectedSlotId(s.id)}
                                >
                                  {s.label}
                                </button>
                              ))
                            ) : (
                              <p className="adm-support-sched__empty">
                                No available time on this date. Try another date.
                              </p>
                            )}
                          </div>
                        </div>

                        {scheduleError ? (
                          <div className="adm-support-sched__error">{scheduleError}</div>
                        ) : null}
                        {scheduleNotice ? (
                          <div className="adm-support-sched__notice">{scheduleNotice}</div>
                        ) : null}

                        <div className="adm-support-sched__actions">
                          <button
                            type="button"
                            className="adm-support-sched__btn adm-support-sched__btn--primary"
                            disabled={scheduleBusy || !selectedSlot || !pickedAppointmentId}
                            onClick={handleSetNewSchedule}
                          >
                            {scheduleBusy
                              ? 'Saving…'
                              : selectedSlot
                                ? `Reschedule to ${formatDateOnlyLabel(pickedDate)}, ${selectedSlot.label}`
                                : 'Pick a date & time'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                <div className="adm-support-drawer__composer-wrap">
                  <form className="adm-support-drawer__composer" onSubmit={handleSend}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
                        }
                      }}
                      rows={2}
                      placeholder="Reply to client..."
                      disabled={sending}
                      maxLength={2000}
                    />
                    <button type="submit" disabled={sending || !draft.trim()}>
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
