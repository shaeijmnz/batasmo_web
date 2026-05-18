import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import {
  fetchAttorneyAvailabilitySlots,
  saveAttorneyAvailabilitySlots,
} from '../lib/userApi';
import {
  SLOT_TIME_OPTIONS,
  WEEKDAY_LABELS,
  MONTHLY_WEEKDAY_OPTIONS,
  getTodayDateKey,
  formatDisplayDate,
  formatHourLabel,
  parseHourLabelTo24,
  monthKeyFromDate,
  isPastDateTime,
  buildCalendarCells,
  toDateKey,
} from '../lib/availabilityScheduleUtils';
import './ManageAvailability.css';

const ManageAvailabilityPanel = ({
  attorneyId,
  displayName = 'Attorney',
  variant = 'admin',
  embedded = false,
  onClose,
}) => {
  const isAttorney = variant === 'attorney';
  const [availabilityByDate, setAvailabilityByDate] = useState({});
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [monthlyTemplateTimes, setMonthlyTemplateTimes] = useState(['14:00', '15:00', '16:00']);
  const [monthlyTemplateWeekdays, setMonthlyTemplateWeekdays] = useState([1, 2, 3, 4, 5]);
  const [monthlyApplyMessage, setMonthlyApplyMessage] = useState('');

  const loadAvailability = useCallback(async (targetId) => {
    if (!targetId) return;

    setLoading(true);
    setError('');
    try {
      const rows = await fetchAttorneyAvailabilitySlots(targetId);
      const nextMap = {};

      rows.forEach((item) => {
        const dateKey = String(item.date || '').trim();
        if (!dateKey) return;

        const parsedTime = parseHourLabelTo24(item.startLabel);
        if (!parsedTime || !SLOT_TIME_OPTIONS.includes(parsedTime)) return;

        if (!nextMap[dateKey]) nextMap[dateKey] = [];
        if (!nextMap[dateKey].includes(parsedTime)) nextMap[dateKey].push(parsedTime);
      });

      Object.keys(nextMap).forEach((dateKey) => {
        nextMap[dateKey].sort();
      });

      setAvailabilityByDate(nextMap);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load availability.');
      setAvailabilityByDate({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!attorneyId) return;
    void loadAvailability(attorneyId);
  }, [attorneyId, loadAvailability]);

  const changeMonth = (offset) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSavedBanner(false);
    setSaveSuccess(null);
    setMonthlyApplyMessage('');
  };

  useEffect(() => {
    const currentMonthKey = monthKeyFromDate(monthCursor);
    if (!String(selectedDate || '').startsWith(currentMonthKey)) {
      const today = new Date();
      const todayKey = getTodayDateKey();
      setSelectedDate(monthKeyFromDate(today) === currentMonthKey ? todayKey : `${currentMonthKey}-01`);
    }
  }, [monthCursor, selectedDate]);

  const toggleTimeSlot = (time24) => {
    if (!selectedDate || isPastDateTime(selectedDate, time24)) return;

    setAvailabilityByDate((prev) => {
      const current = new Set(prev[selectedDate] || []);
      if (current.has(time24)) {
        current.delete(time24);
      } else {
        current.add(time24);
      }

      const next = { ...prev };
      const sorted = Array.from(current).sort();
      if (sorted.length > 0) {
        next[selectedDate] = sorted;
      } else {
        delete next[selectedDate];
      }
      return next;
    });
    setSavedBanner(false);
    setSaveSuccess(null);
    setMonthlyApplyMessage('');
  };

  const toggleMonthlyTemplateTime = (time24) => {
    setMonthlyTemplateTimes((prev) => {
      const current = new Set(prev);
      if (current.has(time24)) current.delete(time24);
      else current.add(time24);
      return Array.from(current).sort();
    });
    setSavedBanner(false);
    setSaveSuccess(null);
    setMonthlyApplyMessage('');
  };

  const toggleMonthlyWeekday = (weekday) => {
    setMonthlyTemplateWeekdays((prev) => {
      const current = new Set(prev);
      if (current.has(weekday)) current.delete(weekday);
      else current.add(weekday);
      return Array.from(current).sort((a, b) => a - b);
    });
    setSavedBanner(false);
    setSaveSuccess(null);
    setMonthlyApplyMessage('');
  };

  const applyMonthlyTemplate = () => {
    if (monthlyTemplateTimes.length === 0) {
      setError('Choose at least one monthly time slot before applying.');
      return;
    }

    if (monthlyTemplateWeekdays.length === 0) {
      setError('Choose at least one weekday before applying the monthly schedule.');
      return;
    }

    const selectedWeekdays = new Set(monthlyTemplateWeekdays);
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthAssignments = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      if (!selectedWeekdays.has(date.getDay())) continue;

      const dateKey = toDateKey(date);
      const futureTimes = monthlyTemplateTimes.filter((time24) => !isPastDateTime(dateKey, time24));
      monthAssignments.push({ dateKey, futureTimes });
    }

    setAvailabilityByDate((prev) => {
      const next = { ...prev };
      monthAssignments.forEach(({ dateKey, futureTimes }) => {
        if (futureTimes.length > 0) next[dateKey] = futureTimes;
        else delete next[dateKey];
      });
      return next;
    });

    setSavedBanner(false);
    setSaveSuccess(null);
    setError('');
    const appliedDateCount = monthAssignments.filter((item) => item.futureTimes.length > 0).length;
    setMonthlyApplyMessage(
      `Monthly template applied to ${appliedDateCount} date(s). Click Save Schedule to sync it to clients.`,
    );
  };

  const saveAvailability = async () => {
    if (!attorneyId) return;

    const now = new Date();
    const prepared = Object.entries(availabilityByDate)
      .flatMap(([dateKey, timeList]) =>
        (timeList || []).map((time24) => {
          const start = new Date(`${dateKey}T${time24}:00`);
          if (Number.isNaN(start.getTime()) || start <= now) return null;
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          return {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          };
        }),
      )
      .filter(Boolean);

    const dateCount = Object.values(availabilityByDate).filter((times) => (times || []).length > 0).length;

    setSaving(true);
    setError('');
    setSaveSuccess(null);
    try {
      await saveAttorneyAvailabilitySlots({ attorneyId, slots: prepared });
      await loadAvailability(attorneyId);
      setSavedBanner(true);
      setSaveSuccess({
        attorneyName: displayName,
        slotCount: prepared.length,
        dateCount,
      });
    } catch (saveError) {
      setError(saveError.message || 'Failed to save availability.');
      setSavedBanner(false);
      setSaveSuccess(null);
    } finally {
      setSaving(false);
    }
  };

  const calendarCells = buildCalendarCells(monthCursor);
  const selectedTimes = availabilityByDate[selectedDate] || [];
  const monthLabel = monthCursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  const kicker = isAttorney ? 'My Schedule' : 'Admin Schedule Control';
  const title = 'Manage Availability';
  const intro = isAttorney ? (
    <>
      Set your bookable consultation times. Changes appear on the <strong>client booking page</strong> right after you
      save — useful when you need to block time for emergencies.
    </>
  ) : (
    <>
      Set bookable time slots for <strong>{displayName}</strong>. These slots appear on the client booking page.
    </>
  );

  const pageContent = (
    <section
      className={`availability-page ${embedded ? 'availability-page--embedded' : ''} ${
        isAttorney ? 'availability-page--attorney' : ''
      }`}
    >
      <div className="availability-page__header">
        <div>
          <p className="availability-kicker">{kicker}</p>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
        {!embedded && onClose ? (
          <button type="button" className="availability-close-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        ) : null}
      </div>

      {error ? <p className="availability-error">{error}</p> : null}
      {savedBanner && !saveSuccess ? (
        <p className="availability-success">
          <CheckCircle size={16} /> Availability saved and synced to clients.
        </p>
      ) : null}
      {monthlyApplyMessage ? <p className="availability-info">{monthlyApplyMessage}</p> : null}

      <div className="availability-layout">
        <section className="availability-card">
          <div className="availability-calendar-head">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <h3>{monthLabel}</h3>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>

          <div className="availability-weekdays">
            {WEEKDAY_LABELS.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="availability-days">
            {calendarCells.map((cell) => {
              if (cell.type === 'blank') {
                return <span key={cell.key} className="availability-day availability-day--blank" />;
              }

              const hasAvailability = (availabilityByDate[cell.dateKey] || []).length > 0;
              const isSelected = cell.dateKey === selectedDate;
              const isToday = cell.dateKey === getTodayDateKey();

              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`availability-day ${isSelected ? 'availability-day--selected' : ''} ${
                    isToday ? 'availability-day--today' : ''
                  }`}
                  onClick={() => setSelectedDate(cell.dateKey)}
                >
                  <span>{cell.day}</span>
                  {hasAvailability ? <i className="availability-dot" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="availability-card">
          <div className="availability-slots-head">
            <div>
              <h3>{formatDisplayDate(selectedDate)}</h3>
              <p>{selectedTimes.length} active slot(s)</p>
            </div>
            <button type="button" className="availability-save-btn" onClick={saveAvailability} disabled={saving}>
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>

          {loading ? <p className="availability-muted">Loading availability...</p> : null}

          <div className="availability-slot-grid">
            {SLOT_TIME_OPTIONS.map((time24) => {
              const active = selectedTimes.includes(time24);
              const blockedByPast = isPastDateTime(selectedDate, time24);

              return (
                <button
                  key={time24}
                  type="button"
                  className={`availability-time-chip ${active ? 'availability-time-chip--active' : ''} ${
                    blockedByPast ? 'availability-time-chip--disabled' : ''
                  }`}
                  onClick={() => toggleTimeSlot(time24)}
                  disabled={blockedByPast}
                >
                  <strong>{formatHourLabel(time24)}</strong>
                  <span>{blockedByPast ? 'Past' : active ? 'Available' : 'Tap to enable'}</span>
                </button>
              );
            })}
          </div>

          <div className="monthly-template-card">
            <div className="monthly-template-head">
              <div>
                <h4>Monthly Template</h4>
                <p>Pick the usual days and times, then apply them to the whole visible month.</p>
              </div>
              <button type="button" className="monthly-apply-btn" onClick={applyMonthlyTemplate}>
                Apply to {monthLabel}
              </button>
            </div>

            <div className="monthly-template-section">
              <span className="monthly-template-label">Repeat on</span>
              <div className="monthly-weekday-grid">
                {MONTHLY_WEEKDAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={`monthly-weekday-chip ${
                      monthlyTemplateWeekdays.includes(day.value) ? 'monthly-weekday-chip--active' : ''
                    }`}
                    onClick={() => toggleMonthlyWeekday(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="monthly-template-section">
              <span className="monthly-template-label">Time slots</span>
              <div className="monthly-time-grid">
                {SLOT_TIME_OPTIONS.map((time24) => {
                  const active = monthlyTemplateTimes.includes(time24);
                  return (
                    <button
                      key={`monthly-${time24}`}
                      type="button"
                      className={`monthly-time-chip ${active ? 'monthly-time-chip--active' : ''}`}
                      onClick={() => toggleMonthlyTemplateTime(time24)}
                    >
                      {formatHourLabel(time24)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );

  const successModal = saveSuccess ? (
    <div
      className="availability-save-modal-overlay"
      role="presentation"
      onClick={() => setSaveSuccess(null)}
    >
      <div
        className="availability-save-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-save-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="availability-save-modal__icon" aria-hidden="true">
          <CheckCircle size={40} strokeWidth={2} />
        </div>
        <h3 id="availability-save-success-title">Schedule saved</h3>
        <p className="availability-save-modal__lead">
          {isAttorney ? (
            <>Your availability is now live on the <strong>client booking page</strong>.</>
          ) : (
            <>
              <strong>{saveSuccess.attorneyName}</strong>&apos;s availability is now live on the client booking page.
            </>
          )}
        </p>
        <ul className="availability-save-modal__stats">
          <li>
            <strong>{saveSuccess.slotCount}</strong> bookable time slot
            {saveSuccess.slotCount === 1 ? '' : 's'} saved
          </li>
          <li>
            Across <strong>{saveSuccess.dateCount}</strong> date
            {saveSuccess.dateCount === 1 ? '' : 's'}
          </li>
        </ul>
        <p className="availability-save-modal__hint">
          Clients can book these times immediately when they choose {isAttorney ? 'you' : 'this attorney'}.
        </p>
        <button type="button" className="availability-save-modal__btn" onClick={() => setSaveSuccess(null)}>
          Got it
        </button>
      </div>
    </div>
  ) : null;

  if (embedded) {
    return (
      <>
        {pageContent}
        {successModal}
      </>
    );
  }

  return (
    <>
      <div className="availability-page-overlay">{pageContent}</div>
      {successModal}
    </>
  );
};

export default ManageAvailabilityPanel;
