import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adminRescheduleAppointment,
  fetchAdminSupportMessages,
  fetchAdminSupportThreads,
  fetchAttorneyFreeSlotsForDate,
  fetchAttorneysForAdminPicker,
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

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminSupportDrawer({ open, onClose, onUnreadChange }) {
  const [threads, setThreads] = useState([]);
  const [activeClientId, setActiveClientId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const scrollRef = useRef(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attorneys, setAttorneys] = useState([]);
  const [pickedAttorneyId, setPickedAttorneyId] = useState('');
  const [pickedDate, setPickedDate] = useState(todayIso());
  const [freeSlots, setFreeSlots] = useState([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [clientAppointments, setClientAppointments] = useState([]);
  const [pickedAppointmentId, setPickedAppointmentId] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleNotice, setScheduleNotice] = useState('');

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
    setSelectedSlotIds([]);
    setPickedAppointmentId('');
    setPickedAttorneyId('');
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
    if (!scheduleOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAttorneysForAdminPicker();
        if (cancelled) return;
        setAttorneys(list);
      } catch (err) {
        if (!cancelled) setScheduleError(err.message || 'Failed to load attorneys.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleOpen]);

  useEffect(() => {
    if (!scheduleOpen || !activeClientId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchClientActiveAppointmentsForAdmin(activeClientId);
        if (cancelled) return;
        setClientAppointments(list);
        if (list.length === 1) {
          setPickedAppointmentId(list[0].id);
          if (!pickedAttorneyId && list[0].attorneyId) {
            setPickedAttorneyId(list[0].attorneyId);
          }
        }
      } catch (err) {
        if (!cancelled) setScheduleError(err.message || 'Failed to load client appointments.');
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleOpen, activeClientId]);

  useEffect(() => {
    if (!pickedAppointmentId || !clientAppointments.length) return;
    const appt = clientAppointments.find((a) => a.id === pickedAppointmentId);
    if (appt?.attorneyId) {
      setPickedAttorneyId((prev) => (prev === appt.attorneyId ? prev : appt.attorneyId));
    }
  }, [pickedAppointmentId, clientAppointments]);

  useEffect(() => {
    if (!scheduleOpen || !pickedAttorneyId || !pickedDate) {
      setFreeSlots([]);
      setSelectedSlotIds([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setScheduleError('');
        const slots = await fetchAttorneyFreeSlotsForDate(pickedAttorneyId, pickedDate);
        if (cancelled) return;
        setFreeSlots(slots);
        setSelectedSlotIds([]);
      } catch (err) {
        if (!cancelled) setScheduleError(err.message || 'Failed to load slots.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleOpen, pickedAttorneyId, pickedDate]);

  const toggleSlot = (slotId) => {
    setSelectedSlotIds((previous) =>
      previous.includes(slotId) ? previous.filter((id) => id !== slotId) : [...previous, slotId],
    );
  };

  const resetSchedulePanel = () => {
    setScheduleOpen(false);
    setScheduleError('');
    setScheduleNotice('');
    setSelectedSlotIds([]);
    setPickedAppointmentId('');
  };

  const selectedAttorneyName = useMemo(() => {
    const found = attorneys.find((a) => a.id === pickedAttorneyId);
    return found?.name || '';
  }, [attorneys, pickedAttorneyId]);

  const composeSlotsMessage = () => {
    const chosen = freeSlots.filter((s) => selectedSlotIds.includes(s.id));
    if (!chosen.length) return '';
    const lines = chosen.map((s) => `• ${pickedDate} at ${s.label}`);
    const header = `Available schedule with ${selectedAttorneyName || 'the attorney'}:`;
    const footer = 'Please reply with your preferred slot so we can confirm the reschedule.';
    return `${header}\n${lines.join('\n')}\n\n${footer}`;
  };

  const handleSendSlotsToChat = async () => {
    if (!activeClientId) return;
    const body = composeSlotsMessage();
    if (!body) {
      setScheduleError('Pick at least one slot first.');
      return;
    }
    try {
      setScheduleBusy(true);
      setScheduleError('');
      const sent = await sendAdminSupportMessage({ clientId: activeClientId, message: body });
      setMessages((previous) => (previous.some((m) => m.id === sent.id) ? previous : [...previous, sent]));
      setScheduleNotice('Sent to client chat.');
      refreshThreads();
    } catch (err) {
      setScheduleError(err.message || 'Failed to send.');
    } finally {
      setScheduleBusy(false);
    }
  };

  const handleSetNewSchedule = async () => {
    if (!activeClientId) return;
    if (selectedSlotIds.length !== 1) {
      setScheduleError('Pick exactly one slot to set as the new schedule.');
      return;
    }
    if (!pickedAppointmentId) {
      setScheduleError('Pick which client appointment to reschedule.');
      return;
    }
    const slotId = selectedSlotIds[0];
    try {
      setScheduleBusy(true);
      setScheduleError('');
      const result = await adminRescheduleAppointment({
        appointmentId: pickedAppointmentId,
        newSlotId: slotId,
      });

      // Also drop a confirmation message in the chat thread for paper trail.
      const slot = freeSlots.find((s) => s.id === slotId);
      const whenLabel = formatScheduleDateLabel(result.newScheduledIso);
      const body =
        `Reschedule confirmed by Admin.\n` +
        `New schedule: ${whenLabel}${selectedAttorneyName ? ` with ${selectedAttorneyName}` : ''}.\n` +
        `(Slot: ${pickedDate} at ${slot?.label || ''})`;
      try {
        const sent = await sendAdminSupportMessage({ clientId: activeClientId, message: body });
        setMessages((previous) =>
          previous.some((m) => m.id === sent.id) ? previous : [...previous, sent],
        );
      } catch (err) {
        console.warn('[support] reschedule chat ack failed', err);
      }

      setScheduleNotice('Schedule updated. Client & attorney notified.');
      setSelectedSlotIds([]);
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

  return (
    <>
      <button
        type="button"
        className="adm-support-backdrop"
        onClick={onClose}
        aria-label="Close support drawer"
      />
      <aside className="adm-support-drawer" role="dialog" aria-label="Client support messages">
        <header className="adm-support-drawer__head">
          <div>
            <h2>Client Messages</h2>
            <p>Reply to client support inquiries.</p>
          </div>
          <button type="button" className="adm-support-drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
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

                <form className="adm-support-drawer__composer" onSubmit={handleSend}>
                  <button
                    type="button"
                    className="adm-support-drawer__sched-btn"
                    onClick={() => setScheduleOpen((v) => !v)}
                    title="Send available schedule or set a new schedule"
                  >
                    {scheduleOpen ? 'Hide schedule helper' : 'Send available schedule'}
                  </button>
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

                {scheduleOpen ? (
                  <div className="adm-support-sched">
                    <div className="adm-support-sched__head">
                      <strong>Schedule helper</strong>
                      <button type="button" onClick={resetSchedulePanel} aria-label="Close">
                        ✕
                      </button>
                    </div>
                    <p className="adm-support-sched__hint">
                      After the client replies with a time, pick the <strong>same date</strong> here, tick{' '}
                      <strong>exactly one</strong> matching slot, choose their appointment below, then click{' '}
                      <strong>Set as new schedule</strong>. That updates the appointment for both the client and
                      attorney queues and sends notifications.
                    </p>

                    <div className="adm-support-sched__row">
                      <label>
                        <span>Attorney</span>
                        <select
                          value={pickedAttorneyId}
                          onChange={(e) => setPickedAttorneyId(e.target.value)}
                        >
                          <option value="">Select attorney</option>
                          {attorneys.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Date</span>
                        <input
                          type="date"
                          value={pickedDate}
                          min={todayIso()}
                          onChange={(e) => setPickedDate(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="adm-support-sched__slots">
                      {pickedAttorneyId ? (
                        freeSlots.length ? (
                          freeSlots.map((s) => {
                            const checked = selectedSlotIds.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className={`adm-support-sched__slot ${checked ? 'adm-support-sched__slot--on' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSlot(s.id)}
                                />
                                <span>{s.label}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="adm-support-sched__empty">
                            No open slots for this attorney on the selected date.
                          </p>
                        )
                      ) : (
                        <p className="adm-support-sched__empty">Pick an attorney to see slots.</p>
                      )}
                    </div>

                    {clientAppointments.length > 0 ? (
                      <label className="adm-support-sched__appt">
                        <span>Reschedule which appointment?</span>
                        <select
                          value={pickedAppointmentId}
                          onChange={(e) => setPickedAppointmentId(e.target.value)}
                        >
                          <option value="">— select appointment —</option>
                          {clientAppointments.map((appt) => (
                            <option key={appt.id} value={appt.id}>
                              {appt.title} • {formatScheduleDateLabel(appt.scheduledAt)}
                              {appt.attorneyName ? ` (${appt.attorneyName})` : ''} —{' '}
                              {appt.status}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    {scheduleError ? (
                      <div className="adm-support-sched__error">{scheduleError}</div>
                    ) : null}
                    {scheduleNotice ? (
                      <div className="adm-support-sched__notice">{scheduleNotice}</div>
                    ) : null}

                    <div className="adm-support-sched__actions">
                      <button
                        type="button"
                        className="adm-support-sched__btn adm-support-sched__btn--ghost"
                        disabled={scheduleBusy || selectedSlotIds.length === 0}
                        onClick={handleSendSlotsToChat}
                      >
                        Send to chat
                      </button>
                      <button
                        type="button"
                        className="adm-support-sched__btn adm-support-sched__btn--primary"
                        disabled={
                          scheduleBusy ||
                          selectedSlotIds.length !== 1 ||
                          !pickedAppointmentId
                        }
                        onClick={handleSetNewSchedule}
                      >
                        {scheduleBusy ? 'Saving…' : 'Set as new schedule'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
