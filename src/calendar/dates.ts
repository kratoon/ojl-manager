/** A day cell in a month grid, or null for padding before/after the month. */
export type DayCell = { date: Date; day: number } | null;

export interface MonthGrid {
  year: number;
  month: number; // 0-based
  weeks: DayCell[][]; // each week has 7 cells, Monday first
}

export function monthGrid(year: number, month: number): MonthGrid {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const cells: DayCell[] = [
    ...Array<DayCell>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i): DayCell => ({ date: new Date(year, month, i + 1), day: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}

export interface YearMonth {
  year: number;
  month: number; // 0-based
}

/** Consecutive months from `start` to `end`, both inclusive. Empty if `end` is before `start`. */
export function monthsBetween(start: YearMonth, end: YearMonth): YearMonth[] {
  const count = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) => {
    const d = new Date(start.year, start.month + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
