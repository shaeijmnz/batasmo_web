export const SLOT_TIME_OPTIONS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const MONTHLY_WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export const toDateKey = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDateKey = () => toDateKey(new Date());

export const formatDisplayDate = (dateKey) => {
  if (!dateKey) return 'No date selected';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatHourLabel = (time24) => {
  const [rawHour, rawMinute] = String(time24 || '').split(':').map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return String(time24 || '');
  const meridiem = rawHour >= 12 ? 'PM' : 'AM';
  const twelveHour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return `${String(twelveHour).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')} ${meridiem}`;
};

export const parseHourLabelTo24 = (value) => {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = String(match[2]).padStart(2, '0');
  const meridiem = String(match[3] || '').toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
};

export const monthKeyFromDate = (dateValue) =>
  `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}`;

export const isPastDateTime = (dateKey, time24) => {
  const parsed = new Date(`${dateKey}T${time24}:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed <= new Date();
};

export const buildCalendarCells = (monthCursor) => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingCount = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < leadingCount; index += 1) {
    cells.push({ type: 'blank', key: `leading-${index}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({
      type: 'day',
      key: `day-${day}`,
      day,
      dateKey: toDateKey(date),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ type: 'blank', key: `trailing-${cells.length}` });
  }

  return cells;
};
