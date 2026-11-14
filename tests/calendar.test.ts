import { describe, expect, it } from 'vitest';
import { monthGrid, monthsBetween } from '../src/calendar/dates';

describe('monthGrid', () => {
  it('starts weeks on Monday and pads to full weeks', () => {
    // 1 Nov 2026 is a Sunday: six empty cells before it.
    const { weeks } = monthGrid(2026, 10);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // The padding days are real dates of the neighbouring months, marked as outside.
    expect(weeks[0]?.slice(0, 6).map((c) => `${c.date.getMonth()}-${c.day}`)).toEqual(['9-26', '9-27', '9-28', '9-29', '9-30', '9-31']);
    expect(weeks[0]?.slice(0, 6).every((c) => c.outside)).toBe(true);
    expect(weeks[0]?.[6]).toMatchObject({ day: 1, outside: false });
    expect(weeks.flat().filter((c) => !c.outside)).toHaveLength(30);
    expect(weeks.at(-1)?.at(-1)).toMatchObject({ day: 6, outside: true }); // trailing days of December
    expect(weeks.at(-1)?.at(-1)?.date.getMonth()).toBe(11);
  });

  it('handles a month starting on Monday', () => {
    // 1 Jun 2026 is a Monday.
    expect(monthGrid(2026, 5).weeks[0]?.[0]).toMatchObject({ day: 1, outside: false });
  });

  it('handles leap-year February', () => {
    expect(monthGrid(2028, 1).weeks.flat().filter((c) => !c.outside)).toHaveLength(29);
  });
});

describe('monthsBetween', () => {
  it('is inclusive and spans year boundaries', () => {
    expect(monthsBetween({ year: 2026, month: 10 }, { year: 2027, month: 1 })).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2027, month: 0 },
      { year: 2027, month: 1 },
    ]);
  });

  it('is empty when the end is before the start', () => {
    expect(monthsBetween({ year: 2026, month: 10 }, { year: 2026, month: 9 })).toEqual([]);
  });
});
