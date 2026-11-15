import { describe, expect, it } from 'vitest';
import { clearShift, isMonthLocked, setMonthLock, unlockShift, type Assignments } from '../src/schedule/locks';

const base = (): Assignments => ({
  '2026-11-30:night': [{ employeeId: 'a', source: 'auto' }],
  '2026-12-01:day': [{ employeeId: 'a', source: 'auto' }, { employeeId: 'b', source: 'manual' }],
  '2026-12-02:night': [{ employeeId: 'c', source: 'auto' }],
  '2027-01-01:day': [{ employeeId: 'd', source: 'auto' }],
});

describe('month lock', () => {
  it('locks every entry of the month and nothing else', () => {
    const next = setMonthLock(base(), '2026-12', true);
    expect(next['2026-12-01:day']?.map((a) => a.source)).toEqual(['manual', 'manual']);
    expect(next['2026-12-02:night']?.[0]?.source).toBe('manual');
    expect(next['2026-11-30:night']).toEqual(base()['2026-11-30:night']);
    expect(next['2027-01-01:day']).toEqual(base()['2027-01-01:day']);
  });

  it('unlocks the month but keeps the employees', () => {
    const next = setMonthLock(setMonthLock(base(), '2026-12', true), '2026-12', false);
    expect(next['2026-12-01:day']).toEqual([{ employeeId: 'a', source: 'auto' }, { employeeId: 'b', source: 'auto' }]);
  });

  it('knows when a month is fully locked', () => {
    expect(isMonthLocked(base(), '2026-12')).toBe(false);
    expect(isMonthLocked(setMonthLock(base(), '2026-12', true), '2026-12')).toBe(true);
    expect(isMonthLocked(base(), '2028-01')).toBe(false); // nothing to lock
  });
});

describe('single shift', () => {
  it('unlocks but keeps the employees', () => {
    const locked = setMonthLock(base(), '2026-12', true);
    expect(unlockShift(locked, '2026-12-01:day')['2026-12-01:day']).toEqual([
      { employeeId: 'a', source: 'auto' },
      { employeeId: 'b', source: 'auto' },
    ]);
  });

  it('clears everybody, locked or not', () => {
    const next = clearShift(base(), '2026-12-01:day');
    expect('2026-12-01:day' in next).toBe(false);
    expect(Object.keys(next)).toHaveLength(3);
  });
});
