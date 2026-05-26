import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WEEKDAY_LABELS,
  buildCalendarCells,
  formatDisplayDate,
  getTodayDateKey,
  monthKeyFromDate,
} from '../lib/availabilityScheduleUtils';
import {
  fetchClientAttorneyAvailabilityCalendar,
  getClientDayAvailabilityStatus,
} from '../lib/userApi';

const monthTitle = (monthCursor) =>
  monthCursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

function ClientAvailabilityCalendar({ attorneyId, selectedDate, onSelectDate }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [daySummary, setDaySummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const todayKey = getTodayDateKey();
  const calendarCells = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);

  const loadMonth = useCallback(async () => {
    if (!attorneyId) return;
    setLoading(true);
    setLoadError('');
    try {
      const summary = await fetchClientAttorneyAvailabilityCalendar(attorneyId, monthCursor);
      setDaySummary(summary);
    } catch (error) {
      setDaySummary({});
      setLoadError(error?.message || 'Could not load availability calendar.');
    } finally {
      setLoading(false);
    }
  }, [attorneyId, monthCursor]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const changeMonth = (offset) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const canGoPrev =
    monthKeyFromDate(monthCursor) > monthKeyFromDate(new Date());

  const handlePickDay = (dateKey, status) => {
    if (status !== 'available') return;
    onSelectDate(dateKey);
  };

  return (
    <div className="ba-cal">
      <div className="ba-cal__head">
        <button
          type="button"
          className="ba-cal__nav"
          onClick={() => changeMonth(-1)}
          disabled={!canGoPrev || loading}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h4 className="ba-cal__title">{monthTitle(monthCursor)}</h4>
        <button
          type="button"
          className="ba-cal__nav"
          onClick={() => changeMonth(1)}
          disabled={loading}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="ba-cal__weekdays">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="ba-cal__grid">
        {calendarCells.map((cell) => {
          if (cell.type === 'blank') {
            return <span key={cell.key} className="ba-cal__day ba-cal__day--blank" />;
          }

          const status = getClientDayAvailabilityStatus(cell.dateKey, daySummary, todayKey);
          const isSelected = cell.dateKey === selectedDate;
          const isToday = cell.dateKey === todayKey;
          const isClickable = status === 'available';

          return (
            <button
              key={cell.key}
              type="button"
              className={[
                'ba-cal__day',
                `ba-cal__day--${status}`,
                isSelected ? 'ba-cal__day--selected' : '',
                isToday ? 'ba-cal__day--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!isClickable || loading}
              onClick={() => handlePickDay(cell.dateKey, status)}
              title={
                status === 'available'
                  ? 'Open slots — tap to view times'
                  : status === 'fully_booked'
                    ? 'Fully booked'
                    : status === 'no_schedule'
                      ? 'No schedule on this day'
                      : 'Past date'
              }
            >
              <span className="ba-cal__day-num">{cell.day}</span>
              {status === 'available' ? <i className="ba-cal__dot ba-cal__dot--open" /> : null}
              {status === 'fully_booked' ? <i className="ba-cal__dot ba-cal__dot--full" /> : null}
            </button>
          );
        })}
      </div>

      <ul className="ba-cal__legend">
        <li>
          <i className="ba-cal__dot ba-cal__dot--open" /> Available
        </li>
        <li>
          <i className="ba-cal__dot ba-cal__dot--full" /> Fully booked
        </li>
        <li>
          <span className="ba-cal__legend-muted">—</span> No schedule
        </li>
      </ul>

      {loading ? <p className="ba-cal__hint">Loading calendar…</p> : null}
      {loadError ? <p className="ba-cal__error">{loadError}</p> : null}
      {selectedDate ? (
        <p className="ba-cal__selected">{formatDisplayDate(selectedDate)}</p>
      ) : (
        <p className="ba-cal__hint">Tap a highlighted day with open slots to choose a time.</p>
      )}
    </div>
  );
}

export default ClientAvailabilityCalendar;
