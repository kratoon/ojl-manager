import { calendarMonthsAhead, calendarStart } from './config';
import { monthsBetween, type YearMonth } from './dates';
import { toIsoDate, type Shift } from '../schedule/shift';

/** The months shown: from the fixed start to today's month plus the configured months ahead. */
export function calendarMonths(today: Date): YearMonth[] {
  const end = new Date(today.getFullYear(), today.getMonth() + calendarMonthsAhead, 1);
  return monthsBetween(calendarStart, { year: end.getFullYear(), month: end.getMonth() });
}

/** First day shift to last night shift of the whole calendar. */
export function calendarRange(today: Date): { from: Shift; to: Shift } {
  const months = calendarMonths(today);
  const first = months[0] as YearMonth;
  const last = months[months.length - 1] as YearMonth;
  return {
    from: { date: toIsoDate(new Date(first.year, first.month, 1)), part: 'day' },
    to: { date: toIsoDate(new Date(last.year, last.month + 1, 0)), part: 'night' },
  };
}

/** Default start for regenerating: tomorrow's day shift (ADR-4a9d8da). */
export function tomorrowDay(today: Date): Shift {
  return { date: toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), part: 'day' };
}
