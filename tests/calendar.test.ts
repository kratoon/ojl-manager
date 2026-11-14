import { describe, expect, it } from 'vitest';
import { monthGrid, monthsBetween } from '../src/calendar/dates';

describe('monthGrid', () => {
  it('starts weeks on Monday and pads to full weeks', () => {
    // 1 Nov 2026 is a Sunday: six empty cells before it.
    const { weeks } = monthGrid(2026, 10);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(weeks[0]?.[6]?.day).toBe(1);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('handles a month starting on Monday', () => {
    // 1 Jun 2026 is a Monday.
    expect(monthGrid(2026, 5).weeks[0]?.[0]?.day).toBe(1);
  });

  it('handles leap-year February', () => {
    expect(monthGrid(2028, 1).weeks.flat().filter(Boolean)).toHaveLength(29);
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
