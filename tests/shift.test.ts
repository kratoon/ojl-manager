import { describe, expect, it } from 'vitest';
import { compareShifts, nextShift, parseShiftKey, previousShift, shiftKey, shiftsBetween } from '../src/schedule/shift';

describe('shift keys', () => {
  it('round-trips', () => {
    const key = shiftKey({ date: '2026-11-14', part: 'night' });
    expect(key).toBe('2026-11-14:night');
    expect(parseShiftKey(key)).toEqual({ date: '2026-11-14', part: 'night' });
  });

  it('rejects malformed keys', () => {
    expect(parseShiftKey('2026-11-14')).toBeNull();
    expect(parseShiftKey('2026-11-14:both')).toBeNull();
  });
});

describe('shift order', () => {
  it('puts the day shift before the night shift of the same date', () => {
    expect(compareShifts({ date: '2026-11-14', part: 'day' }, { date: '2026-11-14', part: 'night' })).toBeLessThan(0);
    expect(compareShifts({ date: '2026-11-15', part: 'day' }, { date: '2026-11-14', part: 'night' })).toBeGreaterThan(0);
  });

  it('steps day -> night -> next day, across month and year ends', () => {
    expect(nextShift({ date: '2026-12-31', part: 'day' })).toEqual({ date: '2026-12-31', part: 'night' });
    expect(nextShift({ date: '2026-12-31', part: 'night' })).toEqual({ date: '2027-01-01', part: 'day' });
    expect(previousShift({ date: '2027-01-01', part: 'day' })).toEqual({ date: '2026-12-31', part: 'night' });
    expect(nextShift({ date: '2028-02-28', part: 'night' })).toEqual({ date: '2028-02-29', part: 'day' });
  });

  it('lists shifts between two shifts inclusively', () => {
    const shifts = shiftsBetween({ date: '2026-11-14', part: 'night' }, { date: '2026-11-15', part: 'night' });
    expect(shifts.map(shiftKey)).toEqual(['2026-11-14:night', '2026-11-15:day', '2026-11-15:night']);
  });
});
