// A shift is one specific date plus either the day or the night shift (ADR-fec8e13).
// Dates are plain ISO strings ("YYYY-MM-DD"): no time zone, no clock time.

export type DayPart = 'day' | 'night';

export interface Shift {
  date: string; // YYYY-MM-DD
  part: DayPart;
}

/** Storage key of a shift, e.g. "2026-11-14:day". */
export type ShiftKey = `${string}:${DayPart}`;

export const shiftKeyPattern = /^\d{4}-\d{2}-\d{2}:(day|night)$/;
export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function shiftKey(shift: Shift): ShiftKey {
  return `${shift.date}:${shift.part}`;
}

export function parseShiftKey(key: string): Shift | null {
  if (!shiftKeyPattern.test(key)) return null;
  const [date, part] = key.split(':') as [string, DayPart];
  return { date, part };
}

/** Chronological order: by date, and the day shift before the night shift of the same date. */
export function compareShifts(a: Shift, b: Shift): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.part === b.part) return 0;
  return a.part === 'day' ? -1 : 1;
}

export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** The shift right after this one: day -> night of the same date, night -> day of the next date. */
export function nextShift(shift: Shift): Shift {
  return shift.part === 'day' ? { date: shift.date, part: 'night' } : { date: addDays(shift.date, 1), part: 'day' };
}

export function previousShift(shift: Shift): Shift {
  return shift.part === 'night' ? { date: shift.date, part: 'day' } : { date: addDays(shift.date, -1), part: 'night' };
}

/** All shifts from `from` to `to`, both inclusive, in chronological order. */
export function shiftsBetween(from: Shift, to: Shift): Shift[] {
  const result: Shift[] = [];
  for (let s = from; compareShifts(s, to) <= 0; s = nextShift(s)) result.push(s);
  return result;
}
