import { Holiday } from '../models/Holiday.js';

/**
 * Calculates working days between startDate and endDate,
 * strictly excluding Saturdays, Sundays, and official company holidays.
 *
 * @param {Object} options
 * @param {Date|string} options.startDate - Leave start date
 * @param {Date|string} options.endDate - Leave end date
 * @param {boolean} [options.isHalfDay=false] - Whether it is a half-day leave
 * @param {Array} [options.holidays=null] - Optional preloaded holidays array (for isolated testing or caching)
 * @returns {Promise<{
 *   workingDays: number,
 *   workingDates: string[],
 *   excludedDates: Array<{ date: string, type: 'weekend' | 'holiday', name: string }>,
 *   totalCalendarDays: number,
 *   weekendDays: number,
 *   holidayDays: number,
 * }>}
 */
export const calculateWorkingDays = async ({
  startDate,
  endDate,
  isHalfDay = false,
  holidays = null,
}) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return {
      workingDays: 0,
      workingDates: [],
      excludedDates: [],
      totalCalendarDays: 0,
      weekendDays: 0,
      holidayDays: 0,
    };
  }

  // Fetch company holidays from MongoDB if not supplied
  let holidayList = holidays;
  if (!holidayList) {
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    try {
      holidayList = await Holiday.find({
        date: {
          $gte: new Date(`${startYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${endYear}-12-31T23:59:59.999Z`),
        },
      });
    } catch {
      holidayList = [];
    }
  }

  // Build lookup map for holidays (both local YYYY-MM-DD and UTC YYYY-MM-DD for timezone resilience)
  const holidayMap = new Map();
  holidayList.forEach((h) => {
    if (!h.date) return;
    const hd = new Date(h.date);
    const localKey = `${hd.getFullYear()}-${String(hd.getMonth() + 1).padStart(2, '0')}-${String(hd.getDate()).padStart(2, '0')}`;
    const utcKey = `${hd.getUTCFullYear()}-${String(hd.getUTCMonth() + 1).padStart(2, '0')}-${String(hd.getUTCDate()).padStart(2, '0')}`;
    const name = h.name || 'Company Holiday';
    holidayMap.set(localKey, name);
    holidayMap.set(utcKey, name);
  });

  const workingDates = [];
  const excludedDates = [];
  let weekendDays = 0;
  let holidayDays = 0;
  let totalCalendarDays = 0;

  // Use local date stepping without time-of-day offsets
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateLimit = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cur <= endDateLimit) {
    totalCalendarDays++;
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      weekendDays++;
      excludedDates.push({
        date: dateStr,
        type: 'weekend',
        name: dayOfWeek === 0 ? 'Sunday' : 'Saturday',
      });
    } else if (holidayMap.has(dateStr)) {
      holidayDays++;
      excludedDates.push({
        date: dateStr,
        type: 'holiday',
        name: holidayMap.get(dateStr),
      });
    } else {
      workingDates.push(dateStr);
    }

    cur.setDate(cur.getDate() + 1);
  }

  let workingDays = workingDates.length;
  if (isHalfDay) {
    workingDays = workingDates.length > 0 ? 0.5 : 0;
  }

  return {
    workingDays,
    workingDates,
    excludedDates,
    totalCalendarDays,
    weekendDays,
    holidayDays,
  };
};

